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
   OneNote clone — app2.js
   ribbon (7 tabs) | commands | galleries (styles/tags/pens) | palettes |
   dialogs | context menus | insert tools (table/pictures/files/link/symbol/
   date/time/recording/screen clip) | spelling | password protection
   ========================================================================== */
'use strict';
(function () {
  const ON = window.ON;
  const { el, $, $$, esc, uid, clamp, svgIcon, fmtKB, fmtDT } = ON;
  const A2 = { ctxEl: null };

  /* ============================ primitives ============================ */
  function closeAllPops() { $$('.pop').forEach(p => p.remove()); }
  function pop(anchor, node, opts) {
    closeAllPops();
    const pv = el('div', { class: 'pop' }); pv.appendChild(node);
    document.body.appendChild(pv);
    let x = 0, y = 0;
    if (anchor && anchor.getBoundingClientRect) { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
    else if (anchor && anchor.x != null) { x = anchor.x; y = anchor.y; }
    const pw = pv.offsetWidth || 240, ph = pv.offsetHeight || 300;
    x = clamp(x, 6, window.innerWidth - pw - 8);
    if (y + ph > window.innerHeight - 8) y = Math.max(8, y - ph - (anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect().height + 8 : 0));
    pv.style.left = x + 'px'; pv.style.top = y + 'px';
    setTimeout(() => document.addEventListener('mousedown', docClose, true), 0);
    function docClose(e) { if (!pv.contains(e.target)) { pv.remove(); document.removeEventListener('mousedown', docClose, true); } }
    pv.addEventListener('mousedown', e => { if (!e.target.closest('input,select')) e.preventDefault(); });
    return pv;
  }
  function menu(items) {
    const node = el('div', { class: 'menu' });
    items.forEach(it => {
      if (!it) return;
      if (it.sep) { node.appendChild(el('div', { class: 'msep' })); return; }
      if (it.hdr) { node.appendChild(el('div', { class: 'mi-hdr' }, it.hdr)); return; }
      if (it.html) { node.appendChild(it.html); return; }
      const mi = el('div', { class: 'mi' + (it.on ? ' on' : '') + (it.dis ? ' dis' : '') }, '',
        el('span', { class: 'ck', html: svgIcon('check', 15) }),
        it.icon ? el('span', { class: 'ic', html: svgIcon(it.icon, 16) }) : '',
        el('span', { class: 'lb' }, it.label || ''),
        it.sub ? el('span', { class: 'sub-caret', html: svgIcon('chevR', 12) }) : '');
      mi.addEventListener('click', e => { if (it.dis) return; const keep = it.fn && it.fn(e, mi); if (keep !== false) closeAllPops(); });
      if (it.sub) mi.addEventListener('mouseenter', () => { /* submenu handled via click tiles */ });
      node.appendChild(mi);
    });
    return node;
  }
  let dlgCount = 0;
  let dlgEsc = null;
  function dlg(opts) {
    ON.endEdit(true);
    const ovl = el('div', { class: 'dlg-ovl' });
    const d = el('div', { class: 'dlg', style: `width:${opts.width || 440}px` });
    dlgCount++;
    const closeFn = () => { dlgCount--; ovl.remove(); };
    d.appendChild(el('div', { class: 'd-head' }, opts.title, el('span', { class: 'x', html: svgIcon('x', 15), onclick: closeFn })));
    const body = el('div', { class: 'd-body' });
    if (opts.body) body.appendChild(opts.body);
    if (opts.bodyText) body.appendChild(el('div', { style: 'padding:8px 0' }, opts.bodyText));
    d.appendChild(body);
    const foot = el('div', { class: 'd-foot' });
    (opts.buttons || [{ label: 'OK', pri: true }]).forEach(b => {
      const btn = el('button', { class: 'btn' + (b.pri ? ' pri' : '') }, b.label);
      btn.addEventListener('click', () => { const keep = b.fn && b.fn(body); if (keep !== false) closeFn(); });
      foot.appendChild(btn);
    });
    d.appendChild(foot);
    ovl.appendChild(d); document.body.appendChild(ovl);
    ovl.addEventListener('mousedown', e => { if (e.target === ovl) { const cancel = (opts.buttons || []).find(b => /cancel|close/i.test(b.label)); (cancel && cancel.fn) && cancel.fn(body); closeFn(); } });
    dlgEsc = e2 => { if (e2.key === 'Escape') { closeFn(); } };
    document.addEventListener('keydown', dlgEsc, true);
    const rm = ovl.remove.bind(ovl);
    const origClose = closeFn;
    ovl._close = () => { document.removeEventListener('keydown', dlgEsc, true); origClose(); };
    const _rem = ovl.remove;
    ovl.remove = () => { document.removeEventListener('keydown ', dlgEsc, true); document.removeEventListener('keydown', dlgEsc, true); _rem.call(ovl); };
    const first = $('input,textarea', d); if (first) setTimeout(() => first.focus(), 40);
    return ovl;
  }
  function inputBox(title, label, def, opts) {
    opts = opts || {};
    return new Promise(res => {
      const inp = el('input', { type: 'text', value: def || '' });
      const ovl = dlg({
        title, width: 380,
        body: el('div', null, el('div', { class: 'fld' }, el('span', { class: 'flb' }, label), inp)),
        buttons: [
          { label: 'OK', pri: true, fn: () => { res(inp.value); if (opts.onOk) opts.onOk(inp.value); } },
          { label: 'Cancel', fn: () => res(null) },
        ]
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { res(inp.value); if (opts.onOk) opts.onOk(inp.value); ovl._close(); } });
      inp.focus(); inp.select();
    });
  }
  function msgBox(title, text, opts) {
    return dlg(Object.assign({ title, bodyText: text, buttons: [{ label: 'OK', pri: true }] }, opts || {}));
  }
  /* palette popup */
  const PAL_THEME = ['#FFFFFF', '#000000', '#EEECE1', '#1F497D', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646'];
  const PAL_SHADES = [
    ['#F2F2F2', '#7F7F7F', '#DDD9C3', '#C6D9F0', '#DBE5F1', '#F2DCDB', '#EBF1DD', '#E5E0EC', '#DAEEF3', '#FDE9D9'],
    ['#D8D8D8', '#595959', '#C4BD97', '#B8CCE4', '#B8CCE4', '#E5B9B7', '#D7E3BC', '#CCC1D9', '#B7DDE8', '#FBD5B5'],
    ['#BFBFBF', '#3F3F3F', '#938953', '#95B3D7', '#95B3D7', '#D99694', '#C3D69B', '#B2A2C7', '#92CDDC', '#FABF8F'],
    ['#A5A5A5', '#262626', '#494429', '#548DD4', '#366092', '#953734', '#77933C', '#5F497A', '#31859B', '#E36C09'],
    ['#7F7F7F', '#0C0C0C', '#1D1B10', '#17365D', '#244061', '#632423', '#4F6128', '#3F3151', '#205867', '#974806'],
  ];
  function palettePop(anchor, opts) {
    opts = opts || {};
    const node = el('div', { class: 'pal' });
    node.appendChild(el('div', { class: 'pal-lab' }, opts.title || 'Theme Colors'));
    // none/auto row
    if (opts.autoLabel) {
      const it = el('div', { class: 'mi', style: 'padding:4px 6px;margin:0 -2px 4px' }, el('span', { class: 'lb' }, opts.autoLabel));
      it.addEventListener('click', () => { opts.onPick(null); closeAllPops(); });
      node.appendChild(it);
    }
    const row = el('div', { class: 'sw-row' });
    PAL_THEME.forEach(c => {
      const sw = el('span', { class: 'pal-sw' + (c === '#FFFFFF' && opts.autoFirst ? ' none' : ''), title: c, style: `background:${c}` });
      sw.addEventListener('click', () => { opts.onPick(c); closeAllPops(); });
      row.appendChild(sw);
    });
    node.appendChild(row);
    PAL_SHADES.forEach(rr => {
      const row2 = el('div', { class: 'sw-row' });
      rr.forEach(c => {
        const sw = el('span', { class: 'pal-sw', title: c, style: `background:${c}` });
        sw.addEventListener('click', () => { opts.onPick(c); closeAllPops(); });
        row2.appendChild(sw);
      });
      node.appendChild(row2);
    });
    if (opts.customLabel !== false) {
      const more = el('div', { class: 'pal-more' }, opts.customLabel || 'More Colors...');
      more.addEventListener('click', () => {
        closeAllPops();
        const inp = el('input', { type: 'color', value: opts.current || '#FF0000' });
        dlg({
          title: 'Colors', width: 300,
          body: el('div', { class: 'fld' }, el('span', { class: 'flb' }, 'Pick a color'), inp),
          buttons: [{ label: 'OK', pri: true, fn: () => opts.onPick(inp.value) }, { label: 'Cancel' }],
        });
      });
      node.appendChild(more);
    }
    return pop(anchor, node);
  }

  /* ============================ state helpers ============================ */
  function editingContainer() { return ON.state.editing || null; }
  function textTargetC() {
    // container to apply text commands to: editing one, else selected single text container
    const st = ON.state;
    if (curEditingId()) return ON.containerById(curEditingId());
    const c = ON.selContainers()[0];
    return c && c.kind === 'text' ? c : null;
  }
  function curEditingId() { return ON.state.sel && ON.state.sel.cis && ON.state.sel._editing ? ON.state.sel._editing : (window.onEditingId || null); }
  ON.isEditing = () => !!document.querySelector('#cdivs [contenteditable="true"]');
  ON.editingCid = () => { const t = $('#cdivs .oc-txt[contenteditable="true"]'); return t ? t.dataset.txt : null; };
  function targetTextC() {
    const cid = ON.editingCid();
    if (cid) return ON.containerById(cid);
    const c = ON.selContainers()[0];
    return c && c.kind === 'text' ? c : null;
  }
  function withWholeOrCaret(fnWhole) {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') { fnWhole(c, null); ON.markDirty(); ON.renderCanvas(); }
      else ON.sbMsg('Click into text first');
      return;
    }
    fnWhole(ON.containerById(cid), ON.caretParaIdx());
  }
  function sb(t) { toast(t); }
  ON.sbMsg = sb;

  // mini toast (OneNote has no status bar; feedback via gentle toast)
  let toastT = null;
  function toast(txt) {
    let t = $('#on-toast');
    if (!t) { t = el('div', { id: 'on-toast' }); document.body.appendChild(t); }
    t.textContent = txt; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
  }

  /* ============================ clipboard ============================ */
  let clip = null; // {type:'containers'|'text', data, fmt?}
  function doCut() {
    const list = ON.selContainers();
    if (!ON.editingCid() && list.length) {
      clip = { type: 'containers', data: list.map(c => JSON.parse(JSON.stringify(c))) };
      ON.pushHistory('Cut'); const p = ON.curPg();
      p.containers = p.containers.filter(c => !list.includes(c));
      ON.state.sel.cis = []; ON.markDirty(); ON.renderAll();
      toast(list.length + ' object(s) cut — click the page then Paste');
      return;
    }
    document.execCommand('cut');
  }
  function doCopy(fmt) {
    const list = ON.selContainers();
    if (!ON.editingCid() && list.length) {
      clip = { type: 'containers', data: list.map(c => JSON.parse(JSON.stringify(c))) };
      toast('Copied ' + list.length + ' object(s) — click the page then Paste');
      return;
    }
    if (ON.editingCid()) {
      document.execCommand('copy');
      const s = getSelection();
      if (s && s.toString()) clip = { type: 'text', data: s.toString(), fmt };
    }
  }
  function doPaste(mode) {
    if (clip && clip.type === 'containers' && clip.data && clip.data.length) {
      const p = ON.curPg(); if (!p) return;
      ON.pushHistory('Paste');
      const news = clip.data.map(c => ({ ...JSON.parse(JSON.stringify(c)), id: uid(), x: c.x + 26, y: c.y + 26, touched: Date.now() }));
      p.containers.push(...news);
      ON.state.sel.cis = news.map(c => c.id);
      ON.markDirty(); ON.renderAll();
      toast('Pasted ' + news.length + ' object(s)');
      return;
    }
    const cid = ON.editingCid();
    if (cid) {
      if (clip && clip.type === 'text') {
        if (mode === 'textonly') {
          ON.applyFontRun({ font: 'Calibri', size: null, color: null, hl: null });
          document.execCommand('insertText', false, clip.data); return;
        }
        document.execCommand('insertText', false, clip.data); return;
      }
      navigator.clipboard && navigator.clipboard.readText().then(t => { if (t) { document.execCommand('insertText', false, t); } }).catch(() => toast('Clipboard access blocked — use Ctrl+V'));
      return;
    }
    toast('Copy something first');
  }

  /* ============================ format painter ============================ */
  let painter = null;
  function toggleFormatPainter(btn) {
    const cid = ON.editingCid();
    let src = null;
    if (cid) {
      const c = ON.containerById(cid); const i = ON.caretParaIdx();
      const p = c && c.paras[i];
      if (p) src = { run: { ...p.runs[0], t: '' }, style: p.style, bullet: p.bullet, align: p.align, level: p.level };
    } else { src = { run: { t: '' }, style: 'normal', bullet: 'none', align: null, level: 0 }; }
    painter = src;
    btn.classList.add('tog', 'on');
    toast('Format Painter on — click a paragraph to apply');
    const once = e => {
      const pEl = e.target.closest && e.target.closest('.oc-txt p');
      if (pEl && cid) {
        const tc = ON.containerById(pEl.closest('.oc-txt').dataset.txt);
        const idx = parseInt(pEl.dataset.idx, 10);
        if (tc && tc.paras[idx]) {
          ON.pushHistory('Format Painter');
          Object.assign(tc.paras[idx], { style: src.style, bullet: src.bullet, align: src.align, level: src.level });
          tc.paras[idx].runs = tc.paras[idx].runs.map(r => ({ ...src.run, t: r.t }));
          ON.markDirty(); ON.renderCanvas();
        }
      }
      painter = null; btn.classList.remove('tog', 'on');
      document.removeEventListener('mousedown', once, true);
    };
    setTimeout(() => document.addEventListener('mousedown', once, true), 10);
  }
  ON.setFormatPainterApply = painter;

  /* ============================ fonts/text group commands ============================ */
  function fontSizeSpin(dirMaybe) {
    const inp = $('#fs-inp');
    const v = Math.round(parseFloat(inp && inp.value) || 14) + (dirMaybe > 0 ? 2 : -2);
    const nv = clamp(v, 8, 72); if (inp) inp.value = nv;
    setFontSize(nv);
  }
  function setFontSize(v) {
    v = clamp(parseFloat(v) || 14, 8, 72);
    if (!applyWholeParaOrSel(p => {
      push_();
      const of = selRangeIn(p.el);
      applyPatchRange(p, of, r => r.size = v);
    })) toast('Click into text first');
  }
  function setFontFamily(fam) {
    if (!applyWholeParaOrSel(p => {
      push_();
      const of = selRangeIn(p.el);
      applyPatchRange(p, of, r => r.font = fam);
    })) toast('Click into text first');
  }
  function push_() { ON.pushHistory('Font'); }
  function selRangeIn(pEl) {
    const s = getSelection(); if (!s.rangeCount) return { start: 0, end: 0 };
    const r = s.getRangeAt(0);
    const pre = document.createRange(); pre.selectNodeContents(pEl); pre.setEnd(r.startContainer, r.startOffset);
    const a = pre.toString().length;
    return { start: a, end: a + r.toString().length };
  }
  function applyPatchRange(pWrap, of, fn) {
    const { c, idx } = pWrap;
    const p = c.paras[idx];
    if (of.start === of.end) { p.runs.forEach(fn); }
    else {
      splitAt(p, of.start); splitAt(p, of.end);
      let pos = 0;
      p.runs.forEach(r => { const L = r.t.length; if (pos >= of.start && pos + L <= of.end && L) fn(r); pos += L; });
      mergeRuns(p);
    }
    rerender(c, idx, of.start);
  }
  function splitAt(p, off) {
    let pos = 0; const out = [];
    for (const r of p.runs) {
      const L = r.t.length;
      if (pos < off && off < pos + L) out.push({ ...r, t: r.t.slice(0, off - pos) }, { ...r, t: r.t.slice(off - pos) });
      else out.push(r);
      pos += L;
    }
    p.runs = out;
  }
  function mergeRuns(p) {
    const out = []; const sig = r => JSON.stringify({ ...r, t: '' });
    for (const r of p.runs) { const l = out[out.length - 1]; if (l && sig(l) === sig(r)) l.t += r.t; else out.push(r); }
    p.runs = out.filter(r => r.t) || out;
    if (!p.runs.length) p.runs = [{ t: '' }];
  }
  function rerender(c, idx, off) {
    const t = $(`#cdivs [data-txt="${c.id}"]`);
    if (t) {
      const pElNow = t.querySelector(`p[data-idx="${idx}"]`);
      const offNow = off != null ? off : 0;
      t.innerHTML = ON.parasToHTML ? ON.parasToHTML(c) : parasLocal(c);
      restoreCaretOff(t, idx, offNow);
    }
    ON.markDirty();
  }
  function parasLocal(c) {
    // delegate to app.js renderer via temporary eval path
    return ON._parasToHTML ? ON._parasToHTML(c) : (window.$appParasToHTML ? window.$appParasToHTML(c) : c.paras.map((p, i) => parasLocalOne(p, i)).join(''));
  }
  function parasLocalOne(p, i) {
    // fallback: plain paragraph (should not be hit — app.js exposes renderer)
    const stCls = (ON.STYLES[p.style] || ON.STYLES.normal).cls;
    const esc2 = esc;
    const body = p.runs.map(r => `<span>${esc2(r.t).replace(/\n/g, '<br>')}</span>`).join('');
    return `<p class="pl ${stCls}" data-idx="${i}" data-style="${p.style || 'normal'}" data-tags="${(p.tags || []).join(',')}"${p.checked ? ' data-checked="1"' : ''}>${body || '<br>'}</p>`;
  }
  function restoreCaretOff(t, idx, off) {
    const pEl = t.querySelector(`p[data-idx="${idx}"]`); if (!pEl) return;
    const tw = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT);
    let n, pos = 0;
    while ((n = tw.nextNode())) { const L = n.nodeValue.length; if (pos + L >= off) { const r = document.createRange(); r.setStart(n, off - pos); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } pos += L; }
    const r = document.createRange(); r.selectNodeContents(pEl); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function applyWholeParaOrSel(fn) {
    const cid = ON.editingCid();
    if (!cid) return false;
    const c = ON.containerById(cid); const idx = ON.caretParaIdx();
    if (idx == null || !c.paras[idx]) return false;
    fn({ c, idx, el: $(`#cdivs [data-txt="${cid}"] p[data-idx="${idx}"]`) });
    return true;
  }
  /* expose for app.js rerenderEditText equivalence */
  ON._applyPatchRange = applyPatchRange;

  /* styles/tags/align wrappers honoring whole-container selection */
  function cmdStyle(key) {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') { ON.pushHistory('Styles'); c.paras.forEach(p => p.style = key); ON.markDirty(); ON.renderCanvas(); return; }
      toast('Click into text first'); return;
    }
    ON.applyParaStyle(key);
  }
  function cmdBullet(kind) {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') { ON.pushHistory('Bullets'); c.paras.forEach(p => p.bullet = p.bullet === kind ? 'none' : kind); ON.markDirty(); ON.renderCanvas(); return; }
      toast('Click into text first'); return;
    }
    ON.applyBulletToggle(kind);
  }
  function cmdAlign(al) {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') { ON.pushHistory('Align'); c.paras.forEach(p => p.align = p.align === al ? null : al); ON.markDirty(); ON.renderCanvas(); return; }
      toast('Click into text first'); return;
    }
    ON.applyAlign(al);
  }
  function cmdToggleTag(k) {
    const cid = ON.editingCid();
    if (!cid) {
      const list = ON.selContainers();
      const c = list.find(x => x.kind === 'text');
      if (c) { ON.pushHistory('Tag'); c.paras.forEach(p => { p.tags = p.tags && p.tags[0] === k ? [] : [k]; }); ON.markDirty(); ON.renderCanvas(); return; }
      toast('Click into text first'); return;
    }
    ON.toggleTagAtCaret(k);
  }
  function cmdToggle(prop) {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') {
        ON.pushHistory('Text style');
        c.paras.forEach(p => { const on = !p.runs.every(r => !!r[prop]); p.runs.forEach(r => r[prop] = on); });
        ON.markDirty(); ON.renderCanvas(); return;
      }
      toast('Click into text first'); return;
    }
    ON.applyRunStyleToggle(prop);
  }
  function cmdHighlight(color) {
    if (!applyWholeParaOrSel(pw => {
      ON.pushHistory('Text Highlight');
      const of = selRangeIn(pw.el);
      applyPatchRange(pw, of, r => r.hl = color === '#FFFFFF' ? null : color);
    })) toast('Click into text first');
  }
  function cmdFontColor(color) {
    if (!applyWholeParaOrSel(pw => {
      ON.pushHistory('Font Color');
      const of = selRangeIn(pw.el);
      applyPatchRange(pw, of, r => r.color = color);
    })) toast('Click into text first');
  }
  function cmdIndent(out) {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') { ON.pushHistory('Indent'); c.paras.forEach(p => p.level = clamp((p.level || 0) + (out ? -1 : 1), 0, 7)); ON.markDirty(); ON.renderCanvas(); return; }
      toast('Click into text first'); return;
    }
    const c = ON.containerById(cid); const i = ON.caretParaIdx(); if (c && i != null) (out ? ON.outdentPara : ON.indentPara)(c, i);
  }
  function cmdClearFmt() {
    const cid = ON.editingCid();
    if (!cid) {
      const c = ON.selContainers()[0];
      if (c && c.kind === 'text') { ON.pushHistory('Clear formatting'); c.paras.forEach(p => { p.runs = p.runs.map(r => ({ t: r.t })); p.style = 'normal'; p.bullet = 'none'; p.align = null; p.level = 0; }); ON.markDirty(); ON.renderCanvas(); return; }
      toast('Click into text first'); return;
    }
    ON.clearFormatting();
  }

  /* ============================ galleries ============================ */
  function stylePreview(st) {
    const css = { title: 'font-size:20px;font-family:"Calibri Light",Calibri', h1: 'font-size:17px;font-family:"Calibri Light",Calibri', h2: 'font-size:15px;font-family:"Calibri Light",Calibri', h3: 'font-size:13.5px;font-family:"Calibri Light",Calibri', h4: 'font-size:12.5px;font-family:"Calibri Light",Calibri;font-style:italic', h5: 'font-size:12px;font-family:"Calibri Light",Calibri', h6: 'font-size:10.5px;font-family:"Calibri Light",Calibri;text-transform:uppercase', quote: 'font-style:italic;color:#605E5C', code: 'font-family:Consolas;background:#F5F4F2;padding:2px 3px', normal: 'font-size:13px' }[st];
    return css || '';
  }
  function buildStylesStrip(host) {
    host.innerHTML = '';
    const show = ['title', 'h1', 'h2', 'h3', 'normal'];
    show.forEach(k => {
      const def = ON.STYLES[k];
      const sw = el('div', { class: 'st-sw', title: def.label + (k === 'normal' ? ' (Ctrl+Shift+N)' : '') },
        el('div', { class: 'st-prev', style: stylePreview(k) }, 'AaBbCc'),
        el('div', { class: 'st-nm' }, def.label));
      sw.addEventListener('mousedown', e => { e.preventDefault(); cmdStyle(k); });
      host.appendChild(sw);
    });
    const more = el('div', { class: 'st-sw', style: 'width:22px', title: 'More Styles' }, el('span', { html: svgIcon('chevD', 14) }));
    more.addEventListener('mousedown', e => { e.preventDefault(); stylesGallery(more); });
    host.appendChild(more);
  }
  function stylesGallery(anchor) {
    const node = el('div', { class: 'menu', style: 'min-width:240px' });
    node.appendChild(el('div', { class: 'mi-hdr' }, 'Styles'));
    ON.STYLES_LIST.forEach(k => {
      const def = ON.STYLES[k];
      const it = el('div', { class: 'mi' },
        el('span', { class: 'lb', style: stylePreview(k) }, def.label));
      it.addEventListener('click', () => { cmdStyle(k); closeAllPops(); });
      node.appendChild(it);
    });
    node.appendChild(el('div', { class: 'msep' }));
    const clr = el('div', { class: 'mi' }, el('span', { class: 'ic', html: svgIcon('clearFmt', 16) }), el('span', { class: 'lb' }, 'Clear Formatting'));
    clr.addEventListener('click', () => { cmdClearFmt(); closeAllPops(); });
    node.appendChild(clr);
    pop(anchor, node);
  }
  const TAGS_MAIN = ['todo', 'important', 'question', 'remember'];
  function buildTagsStrip(host) {
    host.innerHTML = '';
    TAGS_MAIN.forEach(k => {
      const tg = ON.TAGS[k];
      const sw = el('div', { class: 'tg-sw', title: tg.label + (tg.key ? ' (' + tg.key + ')' : '') },
        el('span', { class: 'tg-g', html: svgIcon(tg.icon, 20), style: `color:${tg.color || '#262626'}` }),
        el('div', { class: 'tg-nm' }, tg.label.replace(' for Later', '')));
      sw.addEventListener('mousedown', e => { e.preventDefault(); cmdToggleTag(k); });
      host.appendChild(sw);
    });
    const more = el('div', { class: 'tg-sw tg-more', style: 'width:22px', title: 'More Tags' }, el('span', { html: svgIcon('chevD', 14) }));
    more.addEventListener('mousedown', e => { e.preventDefault(); tagsGallery(more); });
    host.appendChild(more);
  }
  function tagsGallery(anchor) {
    const node = el('div', { class: 'tggal' });
    node.appendChild(el('div', { class: 'mi-hdr' }, 'Tags'));
    const mk = (k) => {
      const tg = ON.TAGS[k];
      const it = el('div', { class: 'tg-it' },
        `<span class="ptag ${tg.box ? 'todo' : ''}" style="${tg.box ? '' : `color:${tg.color || '#605E5C'}`};pointer-events:none">${tg.box ? svgIcon('check', 15) : svgIcon(tg.icon, 15)}</span>`,
        el('span', { class: 'lb' }, tg.label));
      it.addEventListener('click', () => { cmdToggleTag(k); closeAllPops(); });
      node.appendChild(it);
    };
    Object.keys(ON.TAGS).forEach(mk);
    node.appendChild(el('div', { class: 'msep' }));
    const rm = el('div', { class: 'mi' }, el('span', { class: 'ic', html: svgIcon('removeTags', 16) }), el('span', { class: 'lb' }, 'Remove Tag'));
    rm.addEventListener('click', () => {
      const cid = ON.editingCid();
      if (!cid) { const c = ON.selContainers()[0]; if (c && c.kind === 'text') { ON.pushHistory('Remove Tag'); c.paras.forEach(p => { p.tags = []; p.checked = false; }); ON.markDirty(); ON.renderCanvas(); } }
      else { const c = ON.containerById(cid); const i = ON.caretParaIdx(); ON.pushHistory('Remove Tag'); c.paras[i].tags = []; c.paras[i].checked = false; ON.rerenderEditText(c, i); }
      closeAllPops();
    });
    node.appendChild(rm);
    const ft = el('div', { class: 'mi' }, el('span', { class: 'ic', html: svgIcon('findTags', 16) }), el('span', { class: 'lb' }, 'Find Tags'));
    ft.addEventListener('click', () => { closeAllPops(); ON.openTagsPane && ON.openTagsPane(); });
    node.appendChild(ft);
    pop(anchor, node);
  }

  /* ============================ insert commands ============================ */
  function tableGrid(anchor) {
    const node = el('div', { class: 'tbgrid' });
    const lab = el('div', { class: 'tblab' }, '1 x 1 Table');
    const grid = el('div', { style: 'width:180px' });
    let hr = 0, hc = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) {
      const cell = el('div', { class: 'tbc', 'data-r': r, 'data-c': c });
      cell.addEventListener('mouseenter', () => {
        hr = r; hc = c;
        $$('.tbc', grid).forEach(x => x.classList.toggle('hov', +x.dataset.r <= r && +x.dataset.c <= c));
        lab.textContent = `${r + 1} x ${c + 1} Table`;
      });
      cell.addEventListener('mousedown', e => { e.preventDefault(); closeAllPops(); insertTable(r + 1, c + 1); });
      grid.appendChild(cell);
    }
    node.appendChild(grid); node.appendChild(lab);
    pop(anchor, node);
  }
  function freeSpot(w, h) {
    // find a neat place to drop an insert: below the LOWEST live container
    const p = ON.curPg();
    let y = 40, x = 24;
    if (p && p.containers.length) {
      const zoom = ON.state.zoom || 1;
      const pgEl = document.getElementById('page');
      const pgTop = pgEl ? pgEl.getBoundingClientRect().top : 0;
      let lows = 0;
      p.containers.forEach(c => {
        let bottom;
        const n = document.querySelector('#cdivs [data-cid="' + c.id + '"]');
        if (n) bottom = (n.getBoundingClientRect().bottom - pgTop) / zoom;
        else bottom = c.y + (c.h || 80);
        if (bottom > lows) lows = bottom;
      });
      y = Math.round(lows + 22);
    }
    if (y > 1500) { y = 60; x = 60 + (p.containers.length % 6) * 40; }
    return { x, y };
  }
  function insertTable(rows, cols, prefill) {
    const p = ON.curPg(); if (!p) return;
    const pos = freeSpot();
    const c = ON.newTableContainer(pos.x, pos.y, rows, cols);
    if (prefill) prefill(c);
    ON.pushHistory('Insert table ' + rows + 'x' + cols);
    p.containers.push(c); ON.state.sel.cis = [c.id];
    ON.markDirty(); ON.renderAll();
    toast('Table inserted — double-click a cell to type; right-click for row/column tools');
  }
  function insertPictureDialog() {
    const inp = el('input', { type: 'file', accept: 'image/*' }); inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = inp.files[0]; inp.remove(); if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const p = ON.curPg(); if (!p) return;
          const pos = freeSpot();
          const w = Math.min(560, img.width);
          const c = { id: uid(), kind: 'pic', x: pos.x, y: pos.y, w, h: null, src: rd.result, nm: f.name, touched: Date.now() };
          ON.pushHistory('Insert picture');
          p.containers.push(c); ON.state.sel.cis = [c.id];
          ON.markDirty(); ON.renderAll();
          toast('Picture inserted — drag an edge handle to resize');
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    });
    inp.click();
  }
  function insertOnlinePicture() {
    const inp = el('input', { type: 'text', placeholder: 'https://example.com/image.png' });
    dlg({
      title: 'Online Pictures', width: 460,
      body: el('div', null, el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:110px' }, 'Image address'), inp),
        el('div', { class: 'pg-sub' }, 'The image is loaded directly from the web address you enter.')),
      buttons: [{ label: 'Insert', pri: true, fn: () => {
        const u = inp.value.trim(); if (!u) return;
        const p = ON.curPg(); if (!p) return;
        const pos = freeSpot();
        ON.pushHistory('Insert online picture');
        p.containers.push({ id: uid(), kind: 'pic', x: pos.x, y: pos.y, w: 420, h: null, src: u, nm: u.split('/').pop() || 'web image', touched: Date.now() });
        ON.markDirty(); ON.renderAll();
      } }, { label: 'Cancel' }],
    });
    inp.focus();
  }
  async function screenClip() {
    ON.endEdit(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast('Screen capture is not supported by this browser'); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream; video.muted = true;
      await video.play();
      await new Promise(r => setTimeout(r, 240));
      const cv = document.createElement('canvas');
      cv.width = video.videoWidth; cv.height = video.videoHeight;
      cv.getContext('2d').drawImage(video, 0, 0);
      track.stop();
      const url = cv.toDataURL('image/png');
      const p = ON.curPg(); if (!p) return;
      const pos = freeSpot();
      ON.pushHistory('Screen clipping');
      p.containers.push({ id: uid(), kind: 'pic', x: pos.x, y: pos.y, w: Math.min(720, cv.width), h: null, src: url, nm: 'Screen clipping', touched: Date.now() });
      ON.markDirty(); ON.renderAll();
      toast('Screen clipping inserted');
    } catch (e) { toast('Screen capture dismissed or unavailable'); }
  }
  function attachFile(printoutMode) {
    const inp = el('input', { type: 'file' }); inp.style.display = 'none';
    if (printoutMode) { inp.accept = 'image/*'; inp.multiple = true; }
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      Array.from(inp.files).forEach(f => {
        if (f.size > 4 * 1024 * 1024) { toast(`"${f.name}" is large (>4 MB) — storing the file reference only.`); }
        const rd = new FileReader();
        rd.onload = () => {
          const p = ON.curPg(); if (!p) return;
          const pos = freeSpot();
          const isImg = /^image\//.test(f.type) && printoutMode;
          ON.pushHistory(printoutMode ? 'File printout' : 'Insert file');
          p.containers.push({
            id: uid(), kind: isImg ? 'pic' : 'file', x: pos.x + (p.containers.length % 3) * 14, y: pos.y, w: isImg ? 480 : null, h: null,
            src: f.size > 4 * 1024 * 1024 ? null : rd.result, nm: f.name, fs: fmtKB(f.size) + ' — inserted ' + new Date().toLocaleDateString(), touched: Date.now(),
          });
          ON.markDirty(); ON.renderAll();
        };
        rd.readAsDataURL(f);
      });
      inp.remove();
    });
    inp.click();
  }
  function downloadFile(c) {
    if (c.src) {
      const a = document.createElement('a'); a.href = c.src; a.download = c.nm || 'file'; a.click();
      toast('Saved a copy: ' + c.nm);
    } else toast("Only the file reference \"" + (c.nm || "file") + "\" is stored (original file was too large to embed).");
  }
  ON.downloadFile = downloadFile;
  ON.replacePicture = function (c) {
    const inp = el('input', { type: 'file', accept: 'image/*' }); inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = inp.files[0]; inp.remove(); if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { ON.pushHistory('Change picture'); c.src = rd.result; c.nm = f.name; ON.markDirty(); ON.renderAll(); };
      rd.readAsDataURL(f);
    });
    inp.click();
  };
  function linkDialog() {
    const t = el('input', { type: 'text', placeholder: 'Text to display' });
    const u = el('input', { type: 'text', placeholder: 'https://' });
    if (ON.editingCid()) { const s = getSelection(); if (s && s.toString()) t.value = s.toString(); }
    dlg({
      title: 'Link', width: 420,
      body: el('div', null,
        el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:120px' }, 'Text to display:'), t),
        el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:120px' }, 'Address:'), u)),
      buttons: [{ label: 'Link', pri: true, fn: () => {
        const txt = t.value || u.value; const url = u.value.trim(); if (!url) return;
        const cid = ON.editingCid();
        if (cid) {
          ON.pushHistory('Link');
          const c = ON.containerById(cid); const i = ON.caretParaIdx();
          const p = c.paras[i];
          const pEl = $(`#cdivs [data-txt="${cid}"] p[data-idx="${i}"]`);
          const of = selRangeIn(pEl);
          const run = { t: txt, link: url.startsWith('http') ? url : 'https://' + url };
          if (of.start === of.end) p.runs.push(run);
          else { splitAt(p, of.start); splitAt(p, of.end); let pos = 0; p.runs.forEach(r => { const L = r.t.length; if (pos >= of.start && pos + L <= of.end && L) { r.link = run.link; } pos += L; }); mergeRuns(p); }
          const tt = $(`#cdivs [data-txt="${cid}"]`);
          tt.innerHTML = ON._renderParas ? ON._renderParas(c) : parasLocal(c);
          restoreCaretOff(tt, i, of.start + txt.length);
          ON.markDirty();
        } else {
          const p = ON.curPg(); const pos = freeSpot();
          const c = ON.newContainer(pos.x, pos.y, 'text');
          c.paras = [ON.newPara('', { runs: [{ t: txt, link: url.startsWith('http') ? url : 'https://' + url }] })];
          ON.pushHistory('Link'); p.containers.push(c); ON.markDirty(); ON.renderAll();
        }
      } }, { label: 'Cancel' }],
    });
    t.focus();
  }
  /* hyperlink clicks */
  document.addEventListener('mousedown', e => {
    if (!e.ctrlKey) return;
    const lk = e.target.closest && e.target.closest('span[data-link]');
    if (lk) { e.preventDefault(); window.open(lk.dataset.link, '_blank'); }
  });
  function symbolDialog() {
    const SYMS = 'Ω µ π ∞ √ ∴ ≈ ≠ ± ° ∑ ∏ ∫ ∂ ∆ ∇ ∈ ∉ ∪ ∩ ⊆ ⊕ ⊗ ∀ ∃ λ α β γ δ ε θ ν ρ σ τ φ χ ψ ω Α Β Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω £ € ¥ ¢ § ¶ © ® ™ ✓ ✔ ✕ ✖ ← → ↑ ↓ ↔ ⇐ ⇒ ⇔ ◦ • ‣ ◆ ◊ ○ ● □ ■ ▲ ▶ ▼ ◀ ★ ☆ ♠ ♣ ♥ ♦ ♪ ♫ ☎ ✂ ☐ ☑ ☒ ☰'.split(' ');
    const node = el('div', { style: 'display:grid;grid-template-columns:repeat(12,1fr);gap:2px;max-height:300px;overflow:auto;width:430px' });
    SYMS.forEach(s => {
      const b = el('button', { class: 'btn', style: 'min-width:0;width:34px;height:30px;padding:0;font-size:15px' }, s);
      b.addEventListener('mousedown', e => {
        e.preventDefault();
        $$('.dlg .btn').forEach(x => x.style.background = '');
        b.style.background = '#EDE7F6';
        lastSym = s;
      });
      b.addEventListener('click', () => { insertSymbol(s); A2.symDlg && A2.symDlg.remove(); });
      node.appendChild(b);
    });
    let lastSym = null;
    A2.symDlg = dlg({ title: 'Symbol', width: 460, body: node, buttons: [{ label: 'Close' }] });
  }
  function insertSymbol(s) {
    const cid = ON.editingCid();
    const focusInEdit = !!(cid && document.activeElement && document.activeElement.closest && document.activeElement.closest('.oc-txt'));
    if (cid && focusInEdit) document.execCommand('insertText', false, s);
    else {
      const c = ON.selContainers()[0] || (ON.state._lecid && ON.containerById(ON.state._lecid)) || (function () { const cs = ON.curPg().containers.filter(x => x.kind === 'text' && !x.title); return cs[cs.length - 1]; })();
      if (c && c.kind === 'text') { ON.pushHistory('Insert symbol'); c.paras[c.paras.length - 1].runs.push({ t: s }); ON.markDirty(); ON.renderCanvas(); }
      else toast('Click into text first');
    }
  }
  function insertDateTime(kind) {
    const t = kind === 'date' ? new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) :
      kind === 'time' ? new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) :
      fmtDT(Date.now());
    if (ON.editingCid()) { document.execCommand('insertText', false, t); return; }
    const p = ON.curPg(); const pos = freeSpot();
    ON.pushHistory('Insert ' + kind);
    const c = ON.newContainer(pos.x, pos.y, 'text');
    c.paras = [ON.newPara(t)];
    p.containers.push(c); ON.markDirty(); ON.renderAll();
  }
  ON.insertDateTime = insertDateTime;
  /* record audio */
  let recorder = null, recChunks = [];
  async function recordAudio(btn) {
    if (recorder) { stopRecording(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Microphone recording is not supported by this browser'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recChunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => recChunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recChunks, { type: 'audio/webm' });
        const rd = new FileReader();
        rd.onload = () => {
          const p = ON.curPg(); if (!p) return;
          const pos = freeSpot();
          ON.pushHistory('Record audio');
          p.containers.push({ id: uid(), kind: 'audio', x: pos.x, y: pos.y, w: null, h: null, src: rd.result, nm: 'Audio note', at: Date.now(), touched: Date.now() });
          ON.markDirty(); ON.renderAll();
        };
        rd.readAsDataURL(blob);
        recorder = null;
        $$('.recBox').forEach(x => x.remove());
      };
      recorder.start();
      const box = el('div', { class: 'recBox pop', style: 'left:auto;right:16px;bottom:16px;top:auto;padding:10px 14px;display:flex;gap:10px;align-items:center;z-index:1200;position:fixed' },
        el('span', { class: 'tg-g', html: svgIcon('record', 16), style: 'color:#C43E1C' }),
        el('span', null, 'Recording…'),
        el('button', { class: 'btn pri', style: 'min-width:64px', onclick: stopRecording }, 'Stop'),
        el('button', { class: 'btn', style: 'min-width:64px', onclick: () => { recorder && recorder.stream.getTracks().forEach(t => t.stop()); recorder = null; recChunks = []; box.remove(); } }, 'Cancel'));
      document.body.appendChild(box);
      toast('Recording started — press Stop when done');
    } catch (e) { toast('Microphone access denied'); }
  }
  function stopRecording() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }

  /* ============================ table cell editing ============================ */
  ON.editTableCell = function (c, td) {
    if (!c || !td || td.contentEditable === 'true') return;
    if (ON.editingCid()) ON.endEdit(true);
    const tblEl = td.closest('table');
    const ri = Array.from(tblEl.rows).indexOf(td.parentNode);
    const ci = Array.from(td.parentNode.cells).indexOf(td);
    let fresh = td;
    if (!fresh.isConnected && ri >= 0 && ci >= 0) {
      const tbl2 = $(`#cdivs [data-cid="${c.id}"] table`);
      if (tbl2 && tbl2.rows[ri]) fresh = tbl2.rows[ri].cells[ci];
    }
    if (!fresh) return;
    window._onCellEdit = true;
    fresh.contentEditable = 'true'; fresh.focus();
    const sel = getSelection(); sel.selectAllChildren(fresh); sel.collapseToEnd();
    let done = false;
    const commit = ok => {
      if (done) return; done = true;
      window._onCellEdit = false;
      fresh.contentEditable = 'false';
      if (ok) {
        ON.pushHistory('Edit table cell');
        const tbl = fresh.closest('table');
        const r2 = Array.from(tbl.rows).indexOf(fresh.parentNode);
        const c2 = Array.from(fresh.parentNode.cells).indexOf(fresh);
        if (c.tbl[r2] && c.tbl[r2][c2] != null) { const cell = c.tbl[r2][c2]; const txt = fresh.innerText.replace(/\n+$/g, ''); if (cell && typeof cell === 'object') cell.text = txt; else c.tbl[r2][c2] = { text: txt || String(cell || '') }; }
        c.touched = Date.now(); ON.markDirty();
      }
      ON.renderCanvas();
    };
    fresh.addEventListener('blur', () => commit(true), { once: true });
    fresh.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); commit(false); }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(true); }
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault(); commit(true);
        const col = Array.from(fresh.parentNode.cells).indexOf(fresh);
        const rows2 = Array.from(fresh.closest('table').rows).indexOf(fresh.parentNode) + (ev.key === 'ArrowDown' ? 1 : -1);
        requestAnimationFrame(() => {
          const tbl2 = $(`#cdivs [data-cid="${c.id}"] table`);
          if (tbl2 && tbl2.rows[rows2]) ON.editTableCell(c, tbl2.rows[rows2].cells[col]);
        });
      }
      ev.stopPropagation();
    });
  };
  function insertRow(c, after) {
    ON.pushHistory('Insert row');
    const cols = c.tbl[0].length;
    c.tbl.splice(after + 1, 0, Array.from({ length: cols }, () => ({ text: '' })));
    ON.markDirty(); ON.renderAll();
  }
  function insertCol(c, after) {
    ON.pushHistory('Insert column');
    c.tbl.forEach(row => row.splice(after + 1, 0, { text: '' }));
    c.colW.splice(after + 1, 0, 1 / c.tbl[0].length);
    const t = 1 / c.colW.length;
    c.colW = c.colW.map(() => t);
    ON.markDirty(); ON.renderAll();
  }
  function deleteRow(c, ri) {
    if (c.tbl.length <= 1) { /* deleting last row removes table */ ON.pushHistory('Delete table'); const p = ON.curPg(); p.containers = p.containers.filter(x => x.id !== c.id); ON.state.sel.cis = []; ON.markDirty(); ON.renderAll(); return; }
    ON.pushHistory('Delete row'); c.tbl.splice(ri, 1); ON.markDirty(); ON.renderAll();
  }
  function deleteCol(c, ci) {
    if (c.tbl[0].length <= 1) { ON.pushHistory('Delete table'); const p = ON.curPg(); p.containers = p.containers.filter(x => x.id !== c.id); ON.state.sel.cis = []; ON.markDirty(); ON.renderAll(); return; }
    ON.pushHistory('Delete column'); c.tbl.forEach(r => r.splice(ci, 1)); c.colW.pop(); const t = 1 / c.colW.length; c.colW = c.colW.map(() => t); ON.markDirty(); ON.renderAll();
  }

  /* ============================ spelling ============================ */
  const DICT = { teh: 'the', recieve: 'receive', adress: 'address', wich: 'which', becuase: 'because', freind: 'friend', seach: 'search', seige: 'siege', beleive: 'believe', concious: 'conscious', definately: 'definitely', enviroment: 'environment', goverment: 'government', harrass: 'harass', immediatly: 'immediately', knowlege: 'knowledge', libary: 'library', maintenence: 'maintenance', neccessary: 'necessary', noticable: 'noticeable', occassion: 'occasion', posession: 'possession', prefering: 'preferring', publically: 'publicly', refering: 'referring', rember: 'remember', seperate: 'separate', succesful: 'successful', supercede: 'supersede', suppress: 'suppress', tomorow: 'tomorrow', wierd: 'weird', writting: 'writing', arguement: 'argument', calender: 'calendar', commited: 'committed', concensus: 'consensus', embarass: 'embarrass', grammer: 'grammar', humerous: 'humorous', independant: 'independent', managment: 'management', millenium: 'millennium', occurance: 'occurrence', persue: 'pursue', questionaire: 'questionnaire', recomend: 'recommend', responsability: 'responsibility', sucessful: 'successful', truely: 'truly', vaccum: 'vacuum', wichs: 'which', acheive: 'achieve' };
  let customDict = new Set(JSON.parse(XKV.get('oc.dict') || '[]'));
  function saveDict() { XKV.set('oc.dict', JSON.stringify([...customDict])); }
  function spellHits() {
    const hits = [];
    const nb = ON.curNb(); if (!nb) return hits;
    nb.sections.forEach(s => s.pages.forEach(p => p.containers.forEach(c => {
      if (c.kind !== 'text' || !c.paras) return;
      c.paras.forEach((para, pi) => para.runs.forEach(r => {
        (r.t.match(/[A-Za-z']+/g) || []).forEach(w => {
          const lw = w.toLowerCase();
          if (DICT[lw] && !customDict.has(lw)) hits.push({ s: s.id, sName: s.name, p: p.id, pName: p.name, c: c.id, pi, w, lw, fix: DICT[lw] });
        });
      }));
    })));
    return hits;
  }
  ON.runSpelling = function (scopeAll) {
    const hits = spellHits();
    if (!hits.length) { msgBox('Spelling', 'The spelling check is complete. No issues found.'); return; }
    let i = 0, ignored = new Set();
    const listEl = el('div', { class: 'tabbox' });
    const show = () => {
      while (i < hits.length && ignored.has(hits[i].lw)) i++;
      if (i >= hits.length) { A2.spelld && A2.spelld._close(); toast('Spelling check complete'); return; }
      const h = hits[i];
      $('#sp-word', A2.spelld).textContent = h.w;
      $('#sp-loc', A2.spelld).textContent = `${h.pName} — ${h.sName}`;
      $$('.btn', listEl)[0].textContent = h.fix;
    };
    const apply = fixed => {
      const h = hits[i];
      if (fixed) {
        ON.pushHistory('Spelling');
        const sec = ON.curNb().sections.find(s => s.id === h.s);
        const pg = sec.pages.find(p => p.id === h.p);
        const c = pg.containers.find(x => x.id === h.c);
        const rr = /[A-Za-z']+/g;
        c.paras[h.pi].runs.forEach(r => r.t = r.t.replace(new RegExp(`\\b${h.w}\\b`, 'g'), m => m[0] === m[0].toUpperCase() ? h.fix[0].toUpperCase() + h.fix.slice(1) : h.fix));
        if (pg.id === ON.state.pgId) ON.renderCanvas();
        ON.markDirty();
      }
      i++; show();
    };
    listEl.appendChild(el('div', null,
      el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:110px' }, 'Not in dictionary:'), el('b', { id: 'sp-word' }, '')),
      el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:110px' }, 'On page:'), el('span', { id: 'sp-loc' }, ''))));
    const sg = el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:110px' }, 'Suggestions:'), el('button', { class: 'btn' }, ''));
    sg.querySelector('.btn').addEventListener('click', () => apply(true));
    listEl.appendChild(sg);
    A2.spelld = dlg({
      title: 'Spelling', width: 420, body: listEl,
      buttons: [
        { label: 'Change', pri: true, fn: () => { apply(true); return false; } },
        { label: 'Ignore', fn: () => { ignored.add(hits[i].lw); i++; show(); return false; } },
        { label: 'Ignore All', fn: () => { hits.forEach(h => ignored.add(h.lw)); i = hits.length; show(); return false; } },
        { label: 'Add', fn: () => { customDict.add(hits[i].lw); saveDict(); i++; show(); return false; } },
        { label: 'Close' },
      ],
    });
    show();
  };

  /* ============================ password protection ============================ */
  async function sha(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  ON.setPassword = async function (sec) {
    const p1 = el('input', { type: 'password', placeholder: 'New password' });
    const p2 = el('input', { type: 'password', placeholder: 'Confirm password' });
    dlg({
      title: 'Password Protection', width: 430,
      body: el('div', null,
        el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:130px' }, 'Enter password:'), p1),
        el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:130px' }, 'Confirm password:'), p2),
        el('div', { class: 'pg-sub' }, 'The section locks immediately in this app. Protection is local to this device.')),
      buttons: [{ label: 'Set Password', pri: true, fn: async () => {
        if (!p1.value || p1.value.length < 3) { toast('Use a password of at least 3 characters'); return false; }
        if (p1.value !== p2.value) { toast('Passwords do not match'); return false; }
        const salt = uid();
        sec.pw = { salt, hash: await sha(salt + p1.value) };
        delete ON.state.locked[sec.id];
        ON.markDirty(); ON.persistNb(); ON.renderAll();
        toast(`Section "${sec.name}" is now password protected`);
      } }, { label: 'Cancel' }],
    });
    p1.focus();
  };
  ON.removePassword = async function (sec) {
    const p1 = el('input', { type: 'password', placeholder: 'Current password' });
    dlg({
      title: 'Remove Password', width: 400,
      body: el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:130px' }, 'Enter password:'), p1),
      buttons: [{ label: 'Remove', pri: true, fn: async () => {
        if (await sha(sec.pw.salt + p1.value) !== sec.pw.hash) { toast('Wrong password'); return false; }
        sec.pw = null; ON.state.locked[sec.id] = true;
        ON.markDirty(); ON.persistNb(); ON.renderAll();
        toast('Password protection removed');
      } }, { label: 'Cancel' }],
    });
    p1.focus();
  };
  ON.renderLockVeil = function () {
    const ovl = $('#lock-ovl');
    const sec = ON.curSec(); if (!sec) return;
    ovl.hidden = false;
    ovl.style.cssText = 'position:absolute;inset:0;z-index:800;';
    const wrap = $('#pagework'); wrap.style.position = 'relative';
    if (!ovl.parentElement || ovl.parentElement !== wrap) wrap.appendChild(ovl);
    ovl.innerHTML = '';
    const pw = el('input', { type: 'password', placeholder: 'Password' });
    const card = el('div', { class: 'lk-card' },
      el('div', { style: 'display:flex;gap:12px;align-items:center;margin-bottom:10px' }, el('span', { html: svgIcon('lock', 30) }),
        el('div', null, el('div', { style: 'font-size:16px;font-weight:600' }, 'This section is password protected.'), el('div', { class: 'pg-sub' }, `Enter the password to unlock "${esc(sec.name)}" for this session.`))),
      el('div', { class: 'fld' }, pw),
      el('button', { class: 'btn pri', style: 'width:100%' }, 'Unlock'));
    const unlock = async () => {
      if (await sha(sec.pw.salt + pw.value) === sec.pw.hash) { ON.state.locked[sec.id] = true; ON.renderCanvas(); }
      else { pw.value = ''; pw.placeholder = 'Wrong password — try again'; pw.focus(); }
    };
    pw.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); e.stopPropagation(); });
    card.querySelector('.btn').addEventListener('click', unlock);
    ovl.appendChild(card);
    pw.focus();
  };

  /* ============================ view commands ============================ */
  function setRule(rule) {
    const p = ON.curPg(); if (!p) return;
    ON.pushHistory(rule === 'rule' ? 'Rule lines' : rule === 'grid' ? 'Grid lines' : 'Page style');
    p.rule = rule;
    ON.markDirty(); ON.renderCanvas();
  }
  function setPageColor(c) {
    const p = ON.curPg(); if (!p) return;
    ON.pushHistory('Page color');
    p.bg = c || '#FFFFFF';
    ON.markDirty(); ON.renderCanvas();
  }
  function zoomBy(d) { ON.state.zoom = clamp(Math.round((ON.state.zoom + d) * 100) / 100, 0.35, 2.5); ON.renderCanvas(); ON.session(); }
  function zoom100() { ON.state.zoom = 1; ON.renderCanvas(); ON.session(); }
  function toggleHideTitle() {
    const p = ON.curPg(); if (!p) return;
    ON.pushHistory('Hide page title');
    p.hideTitle = !p.hideTitle;
    const tc = p.containers.find(c => c.title);
    if (tc) tc.hidden = p.hideTitle;
    ON.markDirty(); ON.renderCanvas();
  }
  function emailPage() {
    const p = ON.curPg(); if (!p) return;
    const text = p.containers.filter(c => c.kind === 'text').map(c => c.paras.map(x => ON.plainTextOf(x).trim()).filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
    const sub = encodeURIComponent(p.name);
    const body = encodeURIComponent(text.slice(0, 1600));
    const w = window.open(`mailto:?subject=${sub}&body=${body}`, '_self');
    if (!w) toast('Your browser blocked the email window');
  }

  /* ============================ history: versions ============================ */
  ON.snapshotVersion = function () {
    const nb = ON.curNb(); const p = ON.curPg(); if (!nb || !p) return;
    nb.versions = nb.versions || {};
    const arr = nb.versions[p.id] = nb.versions[p.id] || [];
    arr.push({ ts: Date.now(), json: JSON.stringify(p) });
    while (arr.length > 10) arr.shift();
  };
  function pageVersionsPane() {
    const nb = ON.curNb(); const p = ON.curPg();
    const arr = (nb.versions && nb.versions[p.id]) || [];
    const body = el('div', null, el('div', { class: 'fld' },
      el('span', { class: 'flb', style: 'width:70px' }, 'Versions for:'), el('b', null, p.name)),
      arr.length ? null : el('div', { class: 'pg-sub', style: 'padding:8px 0' }, 'No saved versions yet. Press Ctrl+S to save a version of this page.'));
    const list = el('div', { style: 'max-height:340px;overflow:auto' });
    [...arr].reverse().forEach((v, ri) => {
      const it = el('div', { class: 'hit-it', style: 'display:flex;gap:8px;align-items:center' },
        el('span', { style: 'flex:1' }, el('b', null, fmtDT(v.ts))),
        el('button', { class: 'btn', style: 'min-width:70px' }, 'Restore'));
      it.querySelector('.btn').addEventListener('click', () => {
        const target = ON.curNb().sections.find(s => s.id === ON.state.secId).pages.find(x => x.id === p.id);
        const back = JSON.stringify(target);
        ON.pushHistory('Restore version');
        const obj = JSON.parse(v.json);
        Object.keys(target).forEach(k => delete target[k]);
        Object.assign(target, obj);
        ON.markDirty(); ON.renderAll();
        A2.vers && A2.vers._close();
        toast('Restored version from ' + fmtDT(v.ts));
      });
      list.appendChild(it);
    });
    if (arr.length) body.appendChild(list);
    A2.vers = dlg({ title: 'Page Versions', width: 490, body });
  }

  /* ============================ context menus ============================ */
  function ctxMenu(e, items) {
    closeAllPops();
    ON.closeCtxMenu();
    const node = menu(items);
    const pv = pop({ x: e.clientX, y: e.clientY }, node);
    pv.classList.add('ctxmenu');
    $('#ctx-root').appendChild(pv);
    return pv;
  }
  ON.closeCtxMenu = () => { const r = $('#ctx-root'); if (r) r.innerHTML = ''; };
  ON.deleteSection = function (sec) {
    if (!sec) return;
    ON.pushHistory('Delete section');
    const nb = ON.curNb();
    nb.sections = nb.sections.filter(s => s.id !== sec.id);
    nb.bin.push({ kind: 'section', obj: sec, deletedAt: Date.now() });
    if (ON.state.secId === sec.id) { const next = nb.sections[0]; ON.state.secId = next ? next.id : null; ON.state.pgId = next && next.pages[0] ? next.pages[0].id : null; }
    ON.ensurePage(); ON.markDirty(); ON.renderAll();
    ON.toast ? ON.toast('Section moved to Notebook Recycle Bin') : toast('Section moved to Notebook Recycle Bin');
  };
  ON.secCtxMenu = function (e, sec) {
    if (!sec) return;
    const items = [
      { label: 'New Section', icon: 'plus', fn: () => ON.addSection() },
      { sep: true },
      { label: 'Rename', icon: 'copyW', fn: () => ON.renameSection(sec) },
      {
        label: 'Delete Section', icon: 'x', fn: () => { ON.deleteSection(sec);
        }
      },
      { label: 'Duplicate Section', icon: 'copyW', fn: () => { ON.pushHistory('Duplicate section'); const nb = ON.curNb(); const c = JSON.parse(JSON.stringify(sec)); c.id = uid(); c.name += ' (Copy)'; c.pages.forEach(p => p.id = uid()); const i = nb.sections.findIndex(s => s.id === sec.id); nb.sections.splice(i + 1, 0, c); ON.markDirty(); ON.renderAll(); } },
      { sep: true },
      {
        label: 'Section Color', icon: 'pageColor', fn: (e2, mi) => {
          closeAllPops();
          palettePop({ x: e.clientX + 8, y: e.clientY }, {
            title: 'Section Color', current: sec.color,
            onPick: c => { ON.pushHistory('Section color'); sec.color = c || '#8F80AD'; ON.markDirty(); ON.renderAll(); }
          });
          return false;
        }
      },
      { sep: true },
      sec.pw ? { label: 'Remove Password', icon: 'lock', fn: () => ON.removePassword(sec) } : { label: 'Password Protect This Section', icon: 'lock', fn: () => ON.setPassword(sec) },
      { sep: true },
      {
        label: 'Move to Group ▸', icon: 'chevR', fn: (e2, mi) => {
          const nb = ON.curNb();
          const opts = nb.groups.map(g => ({ label: g.name, on: sec.groupId === g.id, fn: () => { ON.pushHistory('Move to group'); sec.groupId = g.id; ON.markDirty(); ON.renderAll(); } }));
          opts.push({ sep: true }, { label: 'No Group', on: !sec.groupId, fn: () => { ON.pushHistory('Move out of group'); sec.groupId = null; ON.markDirty(); ON.renderAll(); } }, { label: 'New Group...', fn: () => { const g = ON.addGroup(); sec.groupId = g.id; ON.markDirty(); ON.renderAll(); } });
          const n2 = menu(opts); pop({ x: e.clientX + 200, y: e.clientY }, n2);
        }
      },
    ];
    ctxMenu(e, items);
  };
  ON.grpCtxMenu = function (e, g) {
    ctxMenu(e, [
      { label: 'Rename', icon: 'copyW', fn: () => { ON.pushHistory('Rename group'); inputBox('Rename Section Group', 'Name:', g.name, { onOk: v => { if (v && v.trim()) { g.name = v.trim(); ON.markDirty(); ON.renderAll(); } } }); } },
      { label: 'New Section', icon: 'plus', fn: () => ON.addSection(null, g.id) },
      { sep: true },
      { label: 'Ungroup (keep sections)', icon: 'x', fn: () => { ON.pushHistory('Ungroup'); const nb = ON.curNb(); nb.sections.forEach(s => { if (s.groupId === g.id) s.groupId = null; }); nb.groups = nb.groups.filter(x => x.id !== g.id); if (ON.state.grpOpen === g.id) ON.state.grpOpen = null; ON.markDirty(); ON.renderAll(); } },
      { label: 'Delete Group and Sections', icon: 'x', fn: () => { ON.pushHistory('Delete group'); const nb = ON.curNb(); nb.sections.filter(s => s.groupId === g.id).forEach(s => nb.bin.push({ kind: 'section', obj: s, deletedAt: Date.now() })); nb.sections = nb.sections.filter(s => s.groupId !== g.id); nb.groups = nb.groups.filter(x => x.id !== g.id); if (ON.state.grpOpen === g.id) ON.state.grpOpen = null; ON.ensurePage(); ON.markDirty(); ON.renderAll(); } },
    ]);
  };
  ON.renameSection = function (sec) {
    inputBox('Rename Section', 'Name:', sec.name, { onOk: v => { if (v && v.trim() && v.trim() !== sec.name) { ON.pushHistory('Rename section'); sec.name = v.trim(); ON.markDirty(); ON.renderAll(); } } });
  };
  ON.renamePage = function (p) {
    inputBox('Rename Page', 'Name:', p.name === 'Untitled page' ? '' : p.name, { onOk: v => {
      if (v && v.trim()) { ON.pushHistory('Rename page'); p.name = v.trim(); const tc = p.containers.find(c => c.title); if (tc) tc.paras[0].runs = [{ t: v.trim(), font: 'Calibri Light', size: 25 }]; ON.markDirty(); ON.renderAll(); }
    } });
  };
  ON.pgCtxMenu = function (e, p) {
    const s = ON.curSec();
    const idx = s.pages.findIndex(x => x.id === p.id);
    const lvl = p.level || 0;
    ctxMenu(e, [
      { label: 'New Page', icon: 'plus', fn: () => ON.addPage(p.id, lvl) },
      { sep: true },
      { label: 'Rename', icon: 'copyW', fn: () => ON.renamePage(p) },
      { label: 'Duplicate Page', icon: 'copyW', fn: () => { ON.pushHistory('Duplicate page'); const c = JSON.parse(JSON.stringify(p)); c.id = uid(); c.tid = uid(); const tc = c.containers.find(x => x.title); if (tc) tc.id = c.tid; c.name += ' (Copy)'; c.containers.forEach(cc => cc.id = uid()); s.pages.splice(idx + 1, 0, c); ON.markDirty(); ON.renderAll(); } },
      { label: 'Delete Page', icon: 'x', fn: () => ON.deletePage(p.id) },
      { sep: true },
      { label: 'Make Subpage', icon: 'chevR', dis: lvl >= 2 || idx === 0, fn: () => { ON.pushHistory('Make subpage'); p.level = clamp(lvl + 1, 0, 2); ON.markDirty(); ON.renderPages(); } },
      { label: 'Promote Subpage', icon: 'chevL', dis: lvl === 0, fn: () => { ON.pushHistory('Promote subpage'); p.level = clamp(lvl - 1, 0, 2); ON.markDirty(); ON.renderPages(); } },
      { sep: true },
      { label: 'Move Up', icon: 'chevU', dis: idx === 0, fn: () => { ON.pushHistory('Move page'); [s.pages[idx - 1], s.pages[idx]] = [s.pages[idx], s.pages[idx - 1]]; ON.markDirty(); ON.renderPages(); } },
      { label: 'Move Down', icon: 'chevD', dis: idx === s.pages.length - 1, fn: () => { ON.pushHistory('Move page'); [s.pages[idx + 1], s.pages[idx]] = [s.pages[idx], s.pages[idx + 1]]; ON.markDirty(); ON.renderPages(); } },
      { sep: true },
      { label: 'Page Color', icon: 'pageColor', fn: () => { closeAllPops(); palettePop({ x: e.clientX, y: e.clientY }, { title: 'Page Color', current: p.bg, onPick: setPageColor }); return false; } },
      p.rule !== 'rule' ? { label: 'Rule Lines', icon: 'ruleLines', fn: () => setRule('rule') } : { label: 'No Rule Lines', icon: 'x', fn: () => setRule('none') },
      { sep: true },
      { label: 'Page Versions', icon: 'clockEdits', fn: pageVersionsPane },
    ]);
  };
  ON.objCtxMenu = function (e, c) {
    if (!c) return;
    if (!ON.state.sel.cis.includes(c.id)) { ON.state.sel.cis = [c.id]; ON.selOnly(); }
    const items = [
      { label: 'Cut', icon: 'cutW', fn: doCut },
      { label: 'Copy', icon: 'copyW', fn: () => doCopy() },
      { label: 'Paste', icon: 'pasteW', fn: () => doPaste(), dis: !(clip && clip.type === 'containers') },
      { sep: true },
    ];
    if (c.kind === 'text' && !c.title) items.push({ label: 'Edit Text', icon: 'copyW', fn: () => ON.startTextEdit(c.id, true) });
    if (c.kind === 'pic') items.push({ label: 'Change Picture...', icon: 'picture', fn: () => ON.replacePicture(c) });
    if (c.kind === 'file') items.push({ label: 'Open Attachment', icon: 'attach', fn: () => downloadFile(c) });
    if (c.kind === 'audio') items.push({ label: 'Transcribe Audio', icon: 'transcribe', fn: () => ON.openTranscribeFromContainer && ON.openTranscribeFromContainer(c) });
    if (c.kind === 'table') {
      items.push({ hdr: 'Table' });
      items.push({ label: 'Insert Row Below', icon: 'table', fn: () => insertRow(c, 0) });
      items.push({ label: 'Insert Column To The Right', icon: 'table', fn: () => insertCol(c, 0) });
      items.push({ label: 'Delete Last Row', icon: 'x', fn: () => deleteRow(c, c.tbl.length - 1) });
      items.push({ label: 'Delete Last Column', icon: 'x', fn: () => deleteCol(c, c.tbl[0].length - 1) });
      items.push({ sep: true }, { label: 'Delete Table', icon: 'x', fn: () => deleteRow(c, -1) });
    }
    items.push({ sep: true });
    items.push({ label: 'Duplicate', icon: 'copyW', fn: () => ON.dupSelection() });
    items.push({ label: 'Delete', icon: 'x', fn: () => ON.deleteSelection() });
    ctxMenu(e, items);
  };
  ON.pageCtxMenu = function (e) {
    ctxMenu(e, [
      { label: 'Paste', icon: 'pasteW', fn: () => doPaste(), dis: !(clip && clip.type === 'containers') },
      { sep: true },
      { label: 'Select All Objects', icon: 'selectObj', fn: () => { const p = ON.curPg(); ON.state.sel.cis = p.containers.map(c => c.id); ON.selOnly(); } },
      { sep: true },
      { label: 'Rule Lines', icon: 'ruleLines', on: ON.curPg().rule === 'rule', fn: () => setRule(ON.curPg().rule === 'rule' ? 'none' : 'rule') },
      { label: 'Grid Lines', icon: 'gridLines', on: ON.curPg().rule === 'grid', fn: () => setRule(ON.curPg().rule === 'grid' ? 'none' : 'grid') },
      { label: 'Page Color', icon: 'pageColor', fn: () => { closeAllPops(); palettePop({ x: e.clientX, y: e.clientY }, { title: 'Page Color', current: ON.curPg().bg, onPick: setPageColor }); } },
    ]);
  };

  /* ============================ ribbon definition ============================ */
  const TABS = [
    { id: 'home', label: 'Home' },
    { id: 'insert', label: 'Insert' },
    { id: 'draw', label: 'Draw' },
    { id: 'history', label: 'History' },
    { id: 'review', label: 'Review' },
    { id: 'view', label: 'View' },
  ];
  function big(opts) {
    const lb = el('span', { class: 'lb' }, opts.label || '');
    if (opts.caret) lb.appendChild(el('span', { class: 'caret' }));
    const b = el('div', { class: 'bigButton' + (opts.split ? ' split' : ''), id: opts.id ? 'rb-' + opts.id : '', title: opts.title || opts.label },
      el('span', { class: 'ic', html: svgIcon(opts.icon, 34) }),
      lb);
    b.addEventListener('mousedown', e => {
      e.preventDefault();
      const r = b.getBoundingClientRect();
      if (opts.caret && e.clientY > r.bottom - 18 && opts.caretFn) opts.caretFn(b);
      else if (opts.fn) opts.fn(b, e);
      else if (opts.caretFn) opts.caretFn(b);
    });
    return b;
  }
  function small(opts) {
    const b = el('span', { class: 'smallButton' + (opts.tog ? ' tog' : ''), id: opts.id ? 'rb-' + opts.id : '', title: opts.title || opts.label },
      el('span', { class: 'ic', html: svgIcon(opts.icon, 17) }),
      opts.label ? el('span', { class: 'lb', html: opts.label + (opts.caret ? ' <span class="caret"></span>' : '') }) : '');
    b.addEventListener('mousedown', e => {
      e.preventDefault();
      const r = b.getBoundingClientRect();
      if (opts.caret && e.clientX > r.right - 16 && opts.caretFn) { opts.caretFn(b); return; }
      if (opts.fn) opts.fn(b, e);
      else if (opts.caretFn) opts.caretFn(b, e);
    });
    return b;
  }
  function grp(title, cols) {
    const g = el('div', { class: 'rgroup' });
    const items = el('div', { class: 'rg-items' });
    (Array.isArray(cols) ? cols : [cols]).forEach(c => {
      if (Array.isArray(c)) { const col = el('div', { class: 'rcol' }); c.flat().forEach(r => r && col.appendChild(r)); items.appendChild(col); }
      else items.appendChild(c);
    });
    const ttl = el('div', { class: 'rg-title' }, title);
    if (opts_arrow(grpApplier[title])) ttl.appendChild(el('span', { class: 'dlg-arrow', title: title + ' options', html: '⬈' }));
    g.appendChild(items); g.appendChild(ttl);
    return g;
  }
  function opts_arrow(fn) { return null; }
  const grpApplier = {};
  function sep() { return el('div', { class: 'rsep' }); }
  function row(...els) { return el('div', { class: 'rrow' }, ...els); }
  function icBtn(opts) {
    const b = el('span', { class: 'iconButton', id: opts.id ? 'rb-' + opts.id : '', title: opts.title || opts.label || '' });
    b.innerHTML = svgIcon(opts.icon, 17) + (opts.caret ? '<span class="caret"></span>' : '');
    b.addEventListener('mousedown', e => {
      e.preventDefault();
      const r = b.getBoundingClientRect();
      if (opts.caret && e.clientX > r.right - 12 && opts.caretFn) { opts.caretFn(b); return; }
      if (opts.fn) opts.fn(b, e); else if (opts.caretFn) opts.caretFn(b);
    });
    return b;
  }
  function fontSelect() {
    const sel = el('select', { id: 'font-sel', title: 'Font' });
    ON.FONTS.forEach(f => sel.appendChild(el('option', { value: f, style: `font-family:'${f}'` }, f)));
    sel.addEventListener('change', () => setFontFamily(sel.value));
    sel.addEventListener('mousedown', e => e.stopPropagation());
    return sel;
  }
  function sizeSpin() {
    const inp = el('input', { class: 'sinp', id: 'fs-inp', value: '14', title: 'Font Size' });
    inp.addEventListener('change', () => setFontSize(inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setFontSize(inp.value); inp.blur(); } e.stopPropagation(); });
    inp.addEventListener('mousedown', e => e.stopPropagation());
    const inc = el('span', { class: 'sinc' }, el('span', { html: '▴', title: 'Increase' }), el('span', { html: '▾', title: 'Decrease' }));
    inc.children[0].addEventListener('mousedown', e => { e.preventDefault(); fontSizeSpin(1); });
    inc.children[1].addEventListener('mousedown', e => { e.preventDefault(); fontSizeSpin(-1); });
    const w = el('span', { class: 'selwrap' }, inp, inc);
    return w;
  }

  /* 7 tabs */
  function buildHome() {
    const stylesHost = el('div', { id: 'styles-strip' });
    const tagsHost = el('div', { id: 'tags-strip' });
    const g1 = grp('Clipboard', [big({ id: 'paste', icon: 'pasteW', label: 'Paste', split: true, caret: true, fn: () => doPaste(), caretFn: b => { pop(b, menu([
      { hdr: 'Paste Options' },
      { label: 'Keep Source Formatting', icon: 'pasteW', fn: () => doPaste() },
      { label: 'Merge Formatting', icon: 'pasteW', fn: () => doPaste('merge') },
      { label: 'Text Only', icon: 'copyW', fn: () => doPaste('textonly') },
    ])); } }),
      [small({ icon: 'cutW', label: 'Cut', fn: doCut }), small({ icon: 'copyW', label: 'Copy', fn: () => doCopy() })],
      [small({ id: 'fmtpainter', icon: 'fmtPainter', label: 'Format Painter', fn: toggleFormatPainter })],
    ]);
    const g2 = grp('Basic Text', [
      row(el('span', { class: 'selwrap' }, fontSelect()), sizeSpin()),
      row(
        icBtn({ icon: 'growFont', title: 'Grow Font Size', fn: () => fontSizeSpin(1) }),
        icBtn({ icon: 'shrinkFont', title: 'Shrink Font Size', fn: () => fontSizeSpin(-1) }),
        icBtn({ id: 'bold', icon: 'boldL', title: 'Bold (Ctrl+B)', fn: () => cmdToggle('b') }),
        icBtn({ id: 'italic', icon: 'italicL', title: 'Italic (Ctrl+I)', fn: () => cmdToggle('i') }),
        icBtn({ id: 'underline', icon: 'underlineL', title: 'Underline (Ctrl+U)', fn: () => cmdToggle('u') }),
        icBtn({ id: 'strike', icon: 'strikeL', title: 'Strikethrough', fn: () => cmdToggle('strike') }),
        icBtn({ icon: 'sub', title: 'Subscript', fn: () => cmdToggle('sub') }),
        icBtn({ icon: 'sup', title: 'Superscript', fn: () => cmdToggle('sup') }),
      ),
      row(
        icBtn({ id: 'hl', icon: 'highlight', title: 'Text Highlight Color', caret: true, fn: () => cmdHighlight('#FFFF00'), caretFn: b => palettePop(b, { title: 'Text Highlight Color', autoLabel: 'No Color', onPick: c => cmdHighlight(c) }) }),
        icBtn({ id: 'fcol', icon: 'fontColor', title: 'Font Color', caret: true, fn: () => cmdFontColor('#C43E1C'), caretFn: b => palettePop(b, { title: 'Font Color', autoLabel: 'Automatic', onPick: c => cmdFontColor(c) }) }),
        icBtn({ icon: 'bullets', title: 'Bullets (Ctrl+.)', caret: true, fn: () => cmdBullet('char'), caretFn: b => pop(b, menu([
          { label: 'Bulleted List', icon: 'bullets', fn: () => cmdBullet('char') },
          { label: 'Numbered List', icon: 'numbering', fn: () => cmdBullet('num') },
          { label: 'Remove Bulleting', icon: 'removeTags', fn: () => { const c = ON.selContainers()[0]; if (ON.editingCid()) { const cc = ON.containerById(ON.editingCid()); const i = ON.caretParaIdx(); ON.pushHistory('Bullets'); cc.paras[i].bullet = 'none'; ON.rerenderEditText(cc, i); } else { cmdBullet('char'); } } },
        ])) }),
        icBtn({ icon: 'numbering', title: 'Numbering (Ctrl+/)', fn: () => cmdBullet('num') }),
        icBtn({ icon: 'indDec', title: 'Decrease Indent', fn: () => cmdIndent(true) }),
        icBtn({ icon: 'indInc', title: 'Increase Indent', fn: () => cmdIndent(false) }),
        icBtn({ id: 'alignl', icon: 'alignL', title: 'Align Left', caret: true, fn: () => cmdAlign('l'), caretFn: b => pop(b, menu([
          { label: 'Left', icon: 'alignL', fn: () => cmdAlign('l') }, { label: 'Center', icon: 'alignC', fn: () => cmdAlign('c') },
          { label: 'Right', icon: 'alignR', fn: () => cmdAlign('r') }, { label: 'Justify', icon: 'alignJ', fn: () => cmdAlign('j') },
        ])) }),
        icBtn({ icon: 'alignC', title: 'Center', fn: () => cmdAlign('c') }),
        icBtn({ icon: 'alignR', title: 'Align Right', fn: () => cmdAlign('r') }),
        icBtn({ id: 'clearfmt', icon: 'clearFmt', title: 'Clear Formatting', fn: cmdClearFmt }),
      ),
    ]);
    buildStylesStrip(stylesHost);
    buildTagsStrip(tagsHost);
    const gStyles = grp('Styles', stylesHost);
    const gTags = grp('Tags', [tagsHost, [
      small({ id: 'findtags', icon: 'findTags', label: 'Find Tags', fn: () => ON.openTagsPane && ON.openTagsPane() }),
      small({ id: 'removetag', icon: 'removeTags', label: 'Remove Tag', fn: () => { const cid = ON.editingCid(); if (cid) { const c = ON.containerById(cid); const i = ON.caretParaIdx(); ON.pushHistory('Remove Tag'); c.paras[i].tags = []; c.paras[i].checked = false; ON.rerenderEditText(c, i); } else { const c = ON.selContainers()[0]; if (c && c.kind === 'text') { ON.pushHistory('Remove Tag'); c.paras.forEach(p => { p.tags = []; p.checked = false; }); ON.markDirty(); ON.renderCanvas(); } } } }),
    ]]);
    const gMail = grp('Email', big({ id: 'emailpage', icon: 'emailPage', label: 'Email Page', title: 'Compose an email with this page', fn: emailPage }));
    return [g1, sep(), g2, sep(), gStyles, sep(), gTags, sep(), gMail];
  }
  function buildInsert() {
    return [
      grp('Tables', big({ id: 'intable', icon: 'table', label: 'Table', caret: true, fn: b => tableGrid(b), caretFn: b => tableGrid(b) })),
      sep(),
      grp('Files', [
        big({ id: 'infile', icon: 'attach', label: 'File Attachment', fn: () => attachFile(false) }),
        big({ id: 'infileprint', icon: 'fileIco', label: 'File Printout', fn: () => attachFile(true) }),
      ]),
      sep(),
      grp('Images', [
        big({ id: 'inpic', icon: 'picture', label: 'Pictures', fn: insertPictureDialog }),
        [[small({ id: 'inonlinepic', icon: 'onlinePic', label: 'Online Pictures', fn: insertOnlinePicture })],
        [small({ id: 'inscreen', icon: 'screen', label: 'Screen Clipping', fn: screenClip })]],
      ]),
      sep(),
      grp('Media', [
        big({ id: 'inrec', icon: 'record', label: 'Record Audio', fn: recordAudio }),
        big({ id: 'intrn', icon: 'transcribe', label: 'Transcribe', title: 'Speech to text, offline in this browser (WASM Whisper)', fn: () => ON.openTranscribe && ON.openTranscribe() }),
      ]),
      sep(),
      grp('Text', [
        [[small({ id: 'inlink', icon: 'link', label: 'Link', fn: linkDialog })],
        [small({ id: 'insymbol', icon: 'symbol', label: 'Symbol', fn: symbolDialog })]],
        [[small({ id: 'indate', icon: 'dateIco', label: 'Date', fn: () => insertDateTime('date') })],
        [small({ id: 'intime', icon: 'timeIco', label: 'Time', fn: () => insertDateTime('time') })]],
      ]),
      sep(),
      grp('Pages', big({ id: 'intempl', icon: 'template', label: 'Page Templates', fn: () => ON.openTemplatesPane && ON.openTemplatesPane() })),
    ];
  }
  function buildDraw() {
    const pensHost = el('div', { id: 'pens-strip' });
    const g = [
      grp('Tools', [
        big({ id: 'drselect', icon: 'selectObj', label: 'Select', title: 'Select objects (Esc)', fn: () => ON.setDrawMode && ON.setDrawMode(null) }),
        big({ id: 'drlasso', icon: 'lasso', label: 'Lasso Select', title: 'Draw a loop to select ink', fn: () => ON.setDrawMode && ON.setDrawMode('lasso') }),
      ]),
      sep(),
      grp('Pens', pensHost),
      sep(),
      ...[
        grp('Eraser', [
          big({ id: 'dreraser', icon: 'eraser', label: 'Eraser', split: true, caret: true, fn: () => ON.setDrawMode && ON.setDrawMode('eraser'), caretFn: b => pop(b, menu([
            { hdr: 'Eraser Size' },
            { label: 'Small', fn: () => { ON.setDrawMode && ON.setDrawMode('eraser', 4); } },
            { label: 'Medium', fn: () => { ON.setDrawMode && ON.setDrawMode('eraser', 9); } },
            { label: 'Large', fn: () => { ON.setDrawMode && ON.setDrawMode('eraser', 16); } },
            { sep: true },
            { label: 'Stroke Eraser', title: 'Erase whole strokes with one touch', fn: () => { ON.setDrawMode && ON.setDrawMode('eraser-stroke'); } },
          ])) }),
        ]),
        sep(),
        grp('Convert', [
          big({ id: 'drinkshape', icon: 'inkShape', label: 'Ink to Shape', title: 'Convert rough strokes to shapes as you draw', fn: () => ON.toggleInkShape && ON.toggleInkShape() }),
        ]),
        sep(),
        grp('Insert', [
          big({ id: 'drshapes', icon: 'shpRect', label: 'Shapes', caret: true, fn: b => shapesMenu(b), caretFn: b => shapesMenu(b) }),
        ]),
      ],
    ];
    return g;
  }
  function shapesMenu(b) {
    pop(b, menu([
      { hdr: 'Insert Shape' },
      { label: 'Line', icon: 'shpLine', fn: () => ON.setDrawMode && ON.setDrawMode('shape:line') },
      { label: 'Rectangle', icon: 'shpRect', fn: () => ON.setDrawMode && ON.setDrawMode('shape:rect') },
      { label: 'Ellipse', icon: 'shpEllipse', fn: () => ON.setDrawMode && ON.setDrawMode('shape:ellipse') },
      { label: 'Triangle', icon: 'shpTriangle', fn: () => ON.setDrawMode && ON.setDrawMode('shape:triangle') },
      { label: 'Arrow', icon: 'shpArrow', fn: () => ON.setDrawMode && ON.setDrawMode('shape:arrow') },
    ]));
  }
  function buildHistory() {
    return [
      grp('History', [
        big({ id: 'histrecent', icon: 'clockEdits', label: 'Recent Edits', split: true, caret: true, fn: () => { ON.state.recent = !ON.state.recent; ON.renderCanvas(); toast(ON.state.recent ? 'Highlighting edits from the last 24 hours' : 'Recent edits highlight off'); }, caretFn: b => pop(b, menu([
          { label: 'Show Last 24 Hours', on: ON.state.recent, fn: () => { ON.state.recent = true; ON.renderCanvas(); } },
          { label: 'Stop Highlighting', fn: () => { ON.state.recent = false; ON.renderCanvas(); } },
        ])) }),
        big({ id: 'histversions', icon: 'copyW', label: 'Page Versions', fn: pageVersionsPane }),
      ]),
      sep(),
      grp('Deleted Notes', big({ id: 'histbin', icon: 'bin', label: 'Notebook Recycle Bin', fn: () => ON.openRecycleBin && ON.openRecycleBin() })),
    ];
  }
  function buildReview() {
    return [
      grp('Proofing', big({ id: 'rvspell', icon: 'spell', label: 'Spelling', title: 'Spelling (F7)', fn: () => ON.runSpelling() })),
      sep(),
      grp('Protect', [
        big({ id: 'rvprotect', icon: 'lock', label: 'Password', caret: true, title: 'Password Protection', fn: b => {
          const sec = ON.curSec(); if (!sec) return;
          pop(b, menu([
            { hdr: `Section: ${sec.name}` },
            sec.pw ? { label: 'Remove Password Protection', icon: 'lock', fn: () => ON.removePassword(sec) } : { label: 'Password Protect This Section', icon: 'lock', fn: () => ON.setPassword(sec) },
            { sep: true },
            { label: 'Unlock Protected Sections...', fn: () => { const s2 = ON.curSec(); if (s2 && s2.pw) { delete ON.state.locked[s2.id]; ON.renderCanvas(); toast('Unlock prompt will appear on the page'); } } },
          ]));
        } }),
      ]),
    ];
  }
  function buildView() {
    return [
      grp('Views', [
        big({ id: 'vwnormal', icon: 'copyW', label: 'Normal View', fn: () => { $('#ribbon').classList.remove('off'); ON.renderCanvas(); } }),
        big({ id: 'vwfull', icon: 'fullScreen', label: 'Full Screen', title: 'Full-screen note taking (F11)', fn: () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}); } }),
      ]),
      sep(),
      grp('Page Setup', [
        [[small({ id: 'vwrule', icon: 'ruleLines', label: 'Rule Lines', tog: true, fn: () => setRule(ON.curPg().rule === 'rule' ? 'none' : 'rule') })],
        [small({ id: 'vwgrid', icon: 'gridLines', label: 'Grid Lines', tog: true, fn: () => setRule(ON.curPg().rule === 'grid' ? 'none' : 'grid') })],
        [small({ id: 'vwpgcolor', icon: 'pageColor', label: 'Page Color', caret: true, fn: b => palettePop(b, { title: 'Page Color', current: ON.curPg().bg, onPick: setPageColor }) })]],
        [[small({ id: 'vwhidetitle', icon: 'x', label: 'Hide Page Title', tog: true, fn: toggleHideTitle })]],
      ]),
      sep(),
      grp('Zoom', [
        [[small({ id: 'vwzoomin', icon: 'search', label: 'Zoom In', fn: () => zoomBy(0.15) })],
        [small({ id: 'vwzoomout', icon: 'search', label: 'Zoom Out', fn: () => zoomBy(-0.15) })],
        [small({ id: 'vwzoom100', icon: 'selectObj', label: '100%', fn: zoom100 })]],
      ]),
    ];
  }
  const TAB_BUILDERS = { home: buildHome, insert: buildInsert, draw: buildDraw, history: buildHistory, review: buildReview, view: buildView };

  /* ribbon frame + state refresh */
  function buildTabs() {
    const host = $('#tabs');
    const file = el('div', { class: 'tab', id: 'tab-file', 'data-tab': 'file' }, 'File');
    file.addEventListener('mousedown', e => { e.preventDefault(); ON.openBackstage && ON.openBackstage(); });
    host.appendChild(file);
    TABS.forEach(t => {
      const d = el('div', { class: 'tab' + (t.id === 'home' ? ' on' : ''), 'data-tab': t.id }, t.label);
      d.addEventListener('mousedown', e => { e.preventDefault(); showTab(t.id); });
      host.appendChild(d);
    });
  }
  function showTab(id) {
    $$('#tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === id));
    const r = $('#ribbon'); r.innerHTML = ''; r.classList.remove('off');
    (TAB_BUILDERS[id] || buildHome)().forEach(g => r.appendChild(g));
    updateRibbonState();
  }
  window.updateRibbonState = function () {
    const cid = ON.editingCid();
    const c = cid ? ON.containerById(cid) : null;
    const p = c && c.paras[ON.caretParaIdx()];
    const r0 = p && p.runs[0];
    const fsel = $('#font-sel'); if (fsel && r0) fsel.value = r0.font || (p.style === 'title' ? 'Calibri Light' : 'Calibri');
    const fsInp = $('#fs-inp'); if (fsInp && r0) fsInp.value = r0.size || { title: 25, h1: 21, h2: 17, h3: 15, h4: 14, h5: 13, h6: 12.5 }[p.style] || 14;
    const toggles = { bold: 'b', italic: 'i', underline: 'u', strike: 'strike' };
    Object.entries(toggles).forEach(([id, prop]) => {
      const b = $('#rb-' + id); if (b && p) b.classList.toggle('on', p.runs.every(r => !!r[prop]));
    });
    const pg = ON.curPg();
    const rBtn = $('#rb-vwrule'); if (rBtn && pg) rBtn.classList.toggle('on', pg.rule === 'rule');
    const gBtn = $('#rb-vwgrid'); if (gBtn && pg) gBtn.classList.toggle('on', pg.rule === 'grid');
    const hBtn = $('#rb-vwhidetitle'); if (hBtn && pg) hBtn.classList.toggle('on', !!pg.hideTitle);
    ON.updatePensUI && ON.updatePensUI();
  };
  ON.runCmdId = function (id) {
    const b = $('#rb-' + id);
    if (b) { ['mousedown', 'mouseup'].forEach(t => b.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))); return true; }
    if (CMDS[id]) { CMDS[id](); return true; }
    return false;
  };
  const CMDS = {
    'new-section': () => ON.addSection(),
    'new-page': () => ON.addPage(),
    'search': () => ON.openSearch && ON.openSearch(),
    'find-tags': () => ON.openTagsPane && ON.openTagsPane(),
    'spelling': () => ON.runSpelling(),
    'print': () => window.print(),
  };
  ON.initRibbon = function () {
    buildTabs(); showTab('home');
    $('#pg-add').addEventListener('mousedown', e => { e.preventDefault(); ON.addPage(); });
    $('#sec-add').innerHTML = svgIcon('plus', 15);
    $('#sec-add').addEventListener('mousedown', e => { e.preventDefault(); ON.addSection(); });
    $('#nb-cover').addEventListener('mousedown', e => { e.preventDefault(); ON.toggleNavPane && ON.toggleNavPane(); });
  };
  ON.layout = function () { ON.renderCanvas(); };

  /* exports used elsewhere */
  ON.pop = pop; ON.closeAllPops = closeAllPops; ON.dlg = dlg; ON.inputBox = inputBox; ON.msgBox = msgBox;
  ON.palettePop = palettePop; ON.menu = menu;
  ON.doCut = doCut; ON.doCopy = doCopy; ON.doPaste = doPaste; ON.duplicateSelection = () => { if (!ON.state.sel.cis.length) return ON.sbMsg && ON.sbMsg('Select something to duplicate'); doCopy(); doPaste(); }; ON._clip = () => clip; ON._setClip = c => clip = c;
  ON.insertTable = insertTable; ON.linkDialog = linkDialog; ON.symbolDialog = symbolDialog;
  ON.screenClip = screenClip; ON.attachFile = attachFile; ON.insertPictureDialog = insertPictureDialog;
  ON.pageVersionsPane = pageVersionsPane;
  ON.setPageColor = setPageColor; ON.setRule = setRule; ON.zoomBy = zoomBy; ON.emailPage = emailPage;
  ON.recordAudio = recordAudio;
  ON.freeSpot = freeSpot;
  ON.toast = toast; toast; 
  ON.stylePreview = stylePreview;
  ON.showTab = showTab;
  ON.buildStylesStrip = buildStylesStrip; ON.buildTagsStrip = buildTagsStrip;
})();
