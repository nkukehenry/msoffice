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
   boot.js — first-run seed data, session restore, wire-up
   ========================================================================== */
'use strict';
(function () {
  const ON = window.ON;
  function seedLibrary() {
    const l = ON.lib();
    if (!Object.keys(l).length) {
      const nb = ON.newNotebook('Personal (Web)', '#7719AA');
      const s1 = ON.newSection('Quick Notes', '#8F80AD');
      const s2 = ON.newSection('Research', '#7BA0CE');
      nb.sections.push(s1, s2);
      const p1 = ON.newPage('Welcome to OneNote');
      const tc = p1.containers[0];
      // enrich the welcome page with a small working demo (no emoji anywhere)
      p1.containers.push({ ...ON.newContainer(24, 130), paras: [
        { runs: [{ t: 'Getting around', b: true, size: 17 }], style: 'h2', align: null, level: 0, bullet: 'none', tags: [] },
        { runs: [{ t: 'Click anywhere on the page and start typing — that is it.' }], style: 'normal', align: null, level: 0, bullet: 'char', tags: [] },
        { runs: [{ t: 'Press Ctrl+1 next to a line to add a To Do tag; click its box to check it off.' }], style: 'normal', align: null, level: 0, bullet: 'char', tags: ['todo'], checked: false },
        { runs: [{ t: 'Use Draw for ink: pen, highlighter, eraser, lasso, and ink-to-shape.' }], style: 'normal', align: null, level: 0, bullet: 'char', tags: [] },
        { runs: [{ t: 'Ctrl+E searches every notebook, section, and page.' }], style: 'normal', align: null, level: 0, bullet: 'char', tags: [] },
      ] });
      s1.pages.push(p1);
      const p2 = ON.newPage('');
      s1.pages.push(p2);
      s2.pages.push(ON.newPage(''));
      state_.nbs[nb.name] = nb;
      state_.nbName = nb.name; state_.secId = s1.id; state_.pgId = p1.id;
      const lib = ON.lib(); lib[nb.name] = { name: nb.name, color: nb.color, created: nb.created, modified: nb.modified, json: JSON.stringify(nb) };
      ON.setLib(lib);
      ON.session();
    }
  }
  const state_ = ON.state;
  function restore() {
    let s = null;
    try { s = JSON.parse(XKV.get('oc.session') || 'null'); } catch { }
    let name = s && s.nbName;
    if (!name || !ON.lib()[name]) name = Object.keys(ON.lib())[0];
    state_.nbName = name;
    ON.loadNb(name);
    const nb = ON.curNb();
    if (s && s.secId) state_.secId = nb.sections.find(x => x.id === s.secId) ? s.secId : (nb.sections[0] && nb.sections[0].id);
    else state_.secId = nb.sections[0] && nb.sections[0].id;
    const sec = ON.curNb() && ON.curSec();
    if (s && s.pgId && sec && sec.pages.find(x => x.id === s.pgId)) state_.pgId = s.pgId;
    if (s && s.zoom) state_.zoom = s.zoom;
    if (XKV.get('oc.opts')) { try { state_.opts = JSON.parse(XKV.get('oc.opts')); } catch { } }
    if (XKV.get('oc.pens')) { try { state_.pens = JSON.parse(XKV.get('oc.pens')); } catch { } }
  }
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      /* hydrate IndexedDB-backed storage BEFORE seed/restore reads anything */
      if (window.XKV) await XKV.ready;
      seedLibrary();
      restore();
      ON.initCore();
      if (ON.initRibbon) ON.initRibbon();
      if (ON.initInk) ON.initInk();
      if (ON.initNav) ON.initNav();
      if (ON.initTellme) ON.initTellme();
      /* theme: hydrate persisted dark preference + titlebar ☾ toggle */
      (function initTheme() {
        const apply = v => { document.body.classList.toggle('dark', !!v); if (ON.renderCanvas) ON.renderCanvas(); };
        let v = false;
        try { v = window.XKV && XKV.get('oc.theme') === 'dark'; } catch (e) { }
        apply(v);
        const tb = document.getElementById('titlebar');
        if (tb) {
          const btn = document.createElement('button');
          btn.id = 'tb-theme';
          btn.title = 'Toggle dark / light';
          btn.textContent = v ? '☀' : '☾';
          btn.style.cssText = 'color:#fff;font-size:14px;background:transparent;border:none;cursor:pointer;padding:2px 8px;align-self:center';
          btn.addEventListener('click', () => {
            v = !document.body.classList.contains('dark');
            apply(v);
            btn.textContent = v ? '☀' : '☾';
            try { XKV.set('oc.theme', v ? 'dark' : 'light'); } catch (e) { }
          });
          const win = tb.querySelector('.win-btn');
          (win ? win.parentElement : tb).appendChild(btn);
        }
      })();
      ON.session();
    } catch (err) { console.error('[boot] FAILED:', err && err.message, err && err.stack); }
  });
})();
