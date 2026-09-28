/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ==========================================================================
   transcribe.js — OFFLINE speech-to-text for the OneNote clone
   Real WebAssembly inference: OpenAI Whisper (tiny, multilingual, int8) run
   through ONNX Runtime Web — everything executes locally in this browser.
   No server, no cloud, no fake output. If the model cannot load, the dialog
   says so honestly.
   Model files : ./models/Xenova/whisper-tiny/...   (~45 MB, downloaded once
                 with the app; served statically like any other asset)
   Engine files: ./vendor/transformers/ (MIT — @xenova/transformers 2.17.2)
   ========================================================================== */
'use strict';
(function () {
  const ON = window.ON;
  const { el, $, $$, uid, svgIcon, fmtKB } = ON;

  /* ---------------- lazy pipeline ---------------- */
  let XP = null, pipe = null, pipeLoading = null;
  let modelState = 'idle';   // idle | loading | ready | error
  let modelErr = '';
  const modelWatchers = new Set();
  function setModelState(s, err) {
    modelState = s; modelErr = err || '';
    modelWatchers.forEach(fn => { try { fn(s, modelErr); } catch (e) { /* watcher gone */ } });
  }

  async function ensurePipe(onProgress) {
    if (pipe) { setModelState('ready'); return pipe; }
    if (!pipeLoading) {
      setModelState('loading');
      pipeLoading = (async () => {
        XP = await import('./vendor/transformers/transformers.min.js');
        XP.env.allowRemoteModels = false;
        XP.env.allowLocalModels = true;
        XP.env.localModelPath = './models/';
        XP.env.useBrowserCache = true;
        try {
          XP.env.backends.onnx.wasm.numThreads =
            (self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1);
        } catch (e) { /* older Sandboxes */ }
        const p = await XP.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny',
          { quantized: true, progress_callback: onProgress });
        pipe = p;
        setModelState('ready');
        return p;
      })();
      pipeLoading.catch(err => { setModelState('error', (err && err.message) || String(err)); pipeLoading = null; throw err; });
      pipeLoading.catch(() => {});
    }
    return pipeLoading;
  }

  /* ---------------- audio decode -> 16 kHz mono Float32 ---------------- */
  async function decodeTo16k(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('This browser has no Web Audio support.');
    const ac = new AC();
    let buf;
    try { buf = await ac.decodeAudioData(await blob.arrayBuffer()); }
    catch (e) {
      try { ac.close(); } catch (_) { }
      throw new Error('Could not decode that audio file (unknown or corrupt format). WAV, MP3, M4A, OGG, WEBM and FLAC usually work.');
    }
    const TARGET = 16000;
    let pcm;
    if (buf.sampleRate !== TARGET || buf.numberOfChannels > 1) {
      const frames = Math.max(1, Math.ceil(buf.duration * TARGET));
      const off = new OfflineAudioContext(1, frames, TARGET);
      const src = off.createBufferSource();
      src.buffer = buf; src.connect(off.destination); src.start();
      const ren = await off.startRendering();
      pcm = ren.getChannelData(0);
    } else pcm = buf.getChannelData(0);
    const dur = buf.duration;
    try { ac.close(); } catch (_) { }
    return { pcm, dur };
  }

  /* ---------------- core transcription ---------------- */
  async function runTranscription(blob, hooks) {
    hooks = hooks || {};
    const asr = await ensurePipe(hooks.modelProgress);
    const { pcm, dur } = await decodeTo16k(blob);
    hooks.decoded && hooks.decoded(dur);
    let chunkNo = 0;
    const out = await asr(pcm, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
      callback_function: item => {
        try {
          const t = asr.tokenizer.decode(item[0].output_token_ids, { skip_special_tokens: true });
          hooks.partial && hooks.partial(t);
        } catch (e) { /* transient */ }
      },
      chunk_callback: () => { chunkNo++; hooks.chunk && hooks.chunk(chunkNo); },
    });
    const text = (out && out.text != null ? out.text : (typeof out === 'string' ? out : '')).trim();
    return { text, dur };
  }

  function fmtSecs(s) {
    s = Math.max(0, Math.round(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------------- insert into page ---------------- */
  function insertIntoPage(text) {
    const p = ON.curPg(); if (!p) return false;
    const lines = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return false;
    const pos = ON.freeSpot ? ON.freeSpot() : { x: 24, y: 90 };
    const paras = lines.map(t => ({ runs: [{ t }], style: 'normal', align: null, level: 0, bullet: 'none', tags: [], spaceAfter: null, line: null }));
    ON.pushHistory('Transcribe audio');
    p.containers.push({ id: uid(), kind: 'text', x: pos.x, y: pos.y, w: null, h: null, ro: 0, paras, touched: Date.now() });
    ON.markDirty(); ON.renderAll();
    ON.toast && ON.toast('Transcript inserted on the page');
    return true;
  }

  /* ---------------- the dialog ---------------- */
  function openTranscribe(preBlob, preName) {
    let busy = false, srcBlob = preBlob || null, result = '';
    let rec = null, recStream = null, recChunks = [], recTimer = null, recStart = 0, recSecs = 0;
    let meterRAF = 0, levelCtx = null, analyser = null;

    /* --- body --- */
    const micRadio = el('input', { type: 'radio', name: 'tsd-src', id: 'tsd-r-mic', checked: 'checked' });
    const fileRadio = el('input', { type: 'radio', name: 'tsd-src', id: 'tsd-r-file' });
    const recBtn = el('button', { class: 'btn', type: 'button', html: svgIcon('record', 13) + ' Record' });
    const recTime = el('span', { class: 'tsd-time' }, '00:00');
    const meter = el('canvas', { class: 'tsd-meter', width: '120', height: '22' });
    const fileInput = el('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.m4a,.ogg,.oga,.webm,.flac,.opus', style: 'display:none' });
    const fileBtn = el('button', { class: 'btn', type: 'button' }, 'Browse…');
    const fileName = el('span', { class: 'tsd-fname' }, preName && preBlob ? preName + ' (' + fmtKB(preBlob.size) + ')' : 'no file chosen');
    if (preBlob) fileRadio.checked = true, micRadio.checked = false;

    const chip = el('span', { class: 'tsd-chip' }, 'Speech model: not loaded');
    const progWrap = el('div', { class: 'tsd-bar' }, el('i'));
    const progLab = el('span', { class: 'tsd-proglab' }, '');
    const ta = el('textarea', { class: 'tsd-ta', placeholder: 'The transcript appears here as it is recognized…', spellcheck: 'false' });
    const status = el('div', { class: 'tsd-status' }, srcBlob ? 'Source ready — press Transcribe.' : 'Pick a source: record from the microphone or choose an audio file.');
    if (srcBlob) fileName.textContent = (preName || 'audio') + ' (' + fmtKB(srcBlob.size) + ')';

    const body = el('div', { class: 'tsd' },
      el('div', { class: 'tsd-note', html: svgIcon('transcribe', 15) }, el('span', null, 'Runs 100% offline in this browser — WebAssembly build of Whisper (tiny, 99 languages incl. Hindi). Nothing is uploaded.')),
      el('div', { class: 'tsd-row' },
        el('div', { class: 'tsd-cell' }, micRadio, el('label', { for: 'tsd-r-mic' }, 'Microphone'), recBtn, recTime, meter),
      ),
      el('div', { class: 'tsd-row' },
        el('div', { class: 'tsd-cell' }, fileRadio, el('label', { for: 'tsd-r-file' }, 'Audio file'), fileBtn, fileName, fileInput),
      ),
      el('div', { class: 'tsd-row tsd-modelrow' }, chip, progWrap, progLab),
      el('div', { class: 'tsd-lab' }, 'Transcript'),
      ta,
      status,
    );

    const ovl = ON.dlg({
      title: 'Transcribe Audio — Offline (WASM Whisper)',
      width: 560,
      body,
      buttons: [
        { label: 'Transcribe', pri: false, fn: () => { go(); return false; } },
        { label: 'Insert Text', pri: true, fn: () => { const ok = insertIntoPage(result || ta.value); return ok; } },
        { label: 'Copy', fn: () => { copyText(); return false; } },
        { label: 'Close', fn: () => { cleanup(); } },
      ],
    });
    const footBtns = $$('.d-foot .btn', ovl);
    const [btnGo, btnIns, btnCopy] = footBtns;
    btnIns.disabled = true; btnCopy.disabled = true;

    /* --- status helpers --- */
    function setStatus(t, isErr) { status.textContent = t; status.classList.toggle('err', !!isErr); }
    function setProg(pct, lab) {
      progWrap.firstChild.style.width = Math.round(pct) + '%';
      progLab.textContent = lab || '';
    }
    function update() {
      btnGo.disabled = busy || !srcBlob;
      btnIns.disabled = busy || !(result || ta.value.trim());
      btnCopy.disabled = !(result || ta.value.trim());
      recBtn.disabled = busy;
      fileBtn.disabled = busy;
    }
    update();

    /* --- model state display --- */
    const filesSeen = {};
    function onModelProgress(ev) {
      if (!ev) return;
      if (ev.status === 'progress' && ev.total) {
        filesSeen[ev.file] = (ev.loaded / ev.total) * 100;
        const vals = Object.values(filesSeen);
        const total = vals.reduce((a, b) => a + b, 0) / vals.length;
        setProg(total, (ev.file || '') + ' — ' + Math.round((ev.loaded / ev.total) * 100) + '%');
      } else if (ev.status === 'done') {
        filesSeen[ev.file] = 100;
        setProg(100, 'compiling…');
      }
    }
    function onWatch(s, err) {
      if (!ovl.isConnected) { modelWatchers.delete(onWatch); return; }
      if (s === 'ready') { chip.textContent = 'Speech model: ready (local)'; chip.classList.add('ok'); setProg(100, ''); }
      else if (s === 'loading') { chip.textContent = 'Speech model: loading…'; chip.classList.remove('ok'); }
      else if (s === 'error') { chip.textContent = 'Speech model: failed to load'; chip.classList.remove('ok'); }
    }
    modelWatchers.add(onWatch); onWatch(modelState, modelErr);

    /* --- recording --- */
    function tick() {
      recSecs = (Date.now() - recStart) / 1000;
      recTime.textContent = fmtSecs(recSecs);
      if (!ovl.isConnected) stopRec(true);
    }
    function stopMeter() {
      if (meterRAF) cancelAnimationFrame(meterRAF), meterRAF = 0;
      if (levelCtx) { try { levelCtx.close(); } catch (e) { } levelCtx = null; }
      const g = meter.getContext('2d'); g && g.clearRect(0, 0, meter.width, meter.height);
    }
    function startMeter(stream) {
      try {
        levelCtx = new (window.AudioContext || window.webkitAudioContext)();
        const srcN = levelCtx.createMediaStreamSource(stream);
        analyser = levelCtx.createAnalyser(); analyser.fftSize = 256;
        srcN.connect(analyser);
        const g = meter.getContext('2d');
        const data = new Uint8Array(analyser.frequencyBinCount);
        const draw = () => {
          if (!levelCtx) return;
          analyser.getByteFrequencyData(data);
          g.clearRect(0, 0, meter.width, meter.height);
          const nb = 24, bw = meter.width / nb;
          g.fillStyle = '#7719AA';
          for (let i = 0; i < nb; i++) {
            const v = data[Math.floor(i * data.length / nb / 2)] / 255;
            const h = Math.max(2, v * meter.height);
            g.fillRect(i * bw + 1, meter.height - h, bw - 2, h);
          }
          meterRAF = requestAnimationFrame(draw);
        };
        draw();
      } catch (e) { /* meter is cosmetic */ }
    }
    async function startRec() {
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { setStatus('Microphone recording is not supported by this browser.', true); return; }
      try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { setStatus('Microphone access was denied.', true); return; }
      recChunks = []; recSecs = 0;
      try { rec = new MediaRecorder(recStream); }
      catch (e) { setStatus('This browser cannot record audio (no MediaRecorder).', true); recStream.getTracks().forEach(t => t.stop()); return; }
      rec.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
      rec.onstop = () => {
        stopMeter(); if (recTimer) clearInterval(recTimer), recTimer = null;
        try { recStream.getTracks().forEach(t => t.stop()); } catch (e) { }
        const b = new Blob(recChunks, { type: (rec && rec.mimeType) || 'audio/webm' });
        rec = null;
        if (!ovl.isConnected || !b.size) return;
        srcBlob = b;
        fileName.textContent = 'Microphone recording (' + fmtSecs(recSecs) + ', ' + fmtKB(b.size) + ')';
        micRadio.checked = true;
        setStatus('Recording ready — press Transcribe.');
        update();
      };
      rec.start(250);
      recStart = Date.now();
      recTimer = setInterval(tick, 250);
      startMeter(recStream);
      recBtn.innerHTML = svgIcon('record', 13) + ' Stop';
      setStatus('Recording… press Stop when done.');
    }
    function stopRec(silent) {
      if (rec && rec.state !== 'inactive') { rec.stop(); }
      else { stopMeter(); if (recTimer) clearInterval(recTimer), recTimer = null; if (recStream) try { recStream.getTracks().forEach(t => t.stop()); } catch (e) { } }
      recBtn.innerHTML = svgIcon('record', 13) + ' Record';
      if (!silent) setStatus('Processing recording…');
    }
    function cleanup() { stopRec(true); modelWatchers.delete(onWatch); }
    recBtn.addEventListener('click', () => { if (rec) stopRec(); else startRec(); });

    /* --- file pick --- */
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      srcBlob = f;
      fileName.textContent = f.name + ' (' + fmtKB(f.size) + ')';
      setStatus('File ready — press Transcribe.');
      update();
    });

    /* --- copy --- */
    function copyText() {
      const t = result || ta.value;
      if (!t.trim()) return;
      const done = () => ON.toast && ON.toast('Transcript copied');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => { });
      else { ta.select(); try { document.execCommand('copy'); done(); } catch (e) { } }
    }

    /* --- the run --- */
    async function go() {
      if (busy || !srcBlob) return;
      if (location.protocol === 'file:') {
        setStatus('Browsers block loading the speech model from a raw file:// page. Serve this folder with any static server (e.g. "python -m http.server") and open that address — then transcription works fully offline.', true);
        return;
      }
      busy = true; result = ''; ta.value = ''; setProg(0, '');
      update();
      const t0 = Date.now();
      try {
        setStatus(modelState === 'ready' ? 'Preparing audio…' : 'Loading speech model (first use takes a moment)…');
        const out = await runTranscription(srcBlob, {
          modelProgress: onModelProgress,
          decoded: dur => setStatus('Transcribing ' + fmtSecs(dur) + ' of audio …'),
          partial: t => { ta.value = t.trim(); },
          chunk: n => { const base = 'Transcribing…'; if (modelState === 'ready') setStatus(base + ' (chunk ' + n + ')'); },
        });
        if (!ovl.isConnected) return;
        result = out.text;
        ta.value = result;
        if (result) setStatus('Done — ' + fmtSecs(out.dur) + ' of audio transcribed in ' + fmtSecs((Date.now() - t0) / 1000) + '. Review the text, then Insert Text.');
        else setStatus('Finished, but no speech was detected in this audio.');
      } catch (e) {
        if (!ovl.isConnected) return;
        setStatus('Error: ' + ((e && e.message) || String(e)), true);
      }
      busy = false; update();
    }

    update();
    return ovl;
  }

  /* ---------------- public API ---------------- */
  ON.openTranscribe = openTranscribe;
  ON.openTranscribeFromContainer = function (c) {
    if (!c || !c.src) { ON.toast && ON.toast('This audio note has no embedded data to transcribe.'); return; }
    fetch(c.src).then(r => r.blob()).then(b => openTranscribe(b, (c.nm || 'audio') + ' (embedded)'))
      .catch(e => ON.toast && ON.toast('Could not read the embedded audio.'));
  };
  ON.transcribeBlob = function (blob, hooks) { return runTranscription(blob, hooks || {}); };
  ON.transcribeModelState = function () { return { state: modelState, err: modelErr }; };
})();
