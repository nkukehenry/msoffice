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
   app4.js — navigation pane, full-text search, tags summary, templates,
   recycle bin, backstage (File menu), Tell-Me, window close.
   ========================================================================== */
'use strict';
(function () {
  const ON = window.ON;
  const $ = ON.$, $$ = ON.$$, el = ON.el, esc = ON.esc, uid = ON.uid, fmtDT = ON.fmtDT, svgIcon = ON.svgIcon;
  const state = ON.state;
  const ACCENT = '#7719AA';

  /* ==================== helpers ==================== */
  function serializeNb(name) {
    if (name === state.nbName && ON.curNb()) return ON.curNb();       // freshest, in-memory
    try { return JSON.parse(ON.lib()[name].json); } catch (e) { return null; }
  }
  function saveOpts() { try { XKV.set('oc.opts', JSON.stringify(state.opts || {})); } catch (e) { } }
  function jumpTo(hit) {
    /* hit: {nb, secId, pgId, cid?} */
    if (hit.nb && hit.nb !== state.nbName) switchNotebook(hit.nb, true);
    state.grpOpen = hit.grpId || null;
    state.secId = hit.secId;
    ON.ensurePage();
    if (hit.pgId) state.pgId = hit.pgId;
    ON.session(); ON.renderAll();
    if (hit.cid) {
      setTimeout(() => {
        const n = document.querySelector('.oc[data-cid="' + hit.cid + '"]');
        if (n) {
          n.scrollIntoView({ block: 'center', inline: 'center' });
          n.classList.add('flash');
          setTimeout(() => n.classList.remove('flash'), 1600);
        }
      }, 60);
    }
  }
  ON.jumpTo = jumpTo;

  /* ==================== notebooks / switching ==================== */
  function switchNotebook(name, quiet) {
    if (!ON.lib()[name]) return;
    ON.persistNb();
    state.nbName = name;
    ON.loadNb(name);
    ON.clearHist && ON.clearHist();
    const nb = ON.curNb(); if (!nb) return;
    state.grpOpen = null;
    state.secId = nb.sections.length ? nb.sections[0].id : null;
    const sec = ON.curSec();
    state.pgId = sec && sec.pages.length ? sec.pages[0].id : null;
    ON.ensurePage();
    state.sel.cis = [];
    ON.session(); ON.renderAll();
    if (!quiet) ON.toast && ON.toast('Opened notebook: ' + name);
  }
  ON.switchNotebook = switchNotebook;
  function addNotebookDialog() {
    let color = ON.NB_COLORS[0];
    const sw = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 2px' });
    const inp = el('input', { type: 'text', value: 'New Notebook', spellcheck: 'false' });
    ON.NB_COLORS.forEach(c => {
      const s = el('span', { style: `width:24px;height:24px;border-radius:3px;background:${c};cursor:pointer;border:2px solid ${c === color ? '#323130' : 'transparent'}` });
      s.addEventListener('mousedown', e => { e.preventDefault(); color = c; sw.querySelectorAll('span').forEach(x => x.style.borderColor = 'transparent'); s.style.borderColor = '#323130'; });
      sw.appendChild(s);
    });
    ON.dlg({
      title: 'New Notebook', width: 420,
      body: el('div', null,
        el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:110px' }, 'Name:'), inp),
        el('div', { class: 'fld' }, el('span', { class: 'flb', style: 'width:110px' }, 'Color:'), sw)),
      buttons: [
        {
          label: 'Create', pri: true, fn: () => {
            const name = (inp.value || '').trim();
            if (!name) { ON.toast && ON.toast('Type a notebook name'); return false; }
            if (ON.lib()[name]) { ON.toast && ON.toast('A notebook with that name exists'); return false; }
            const nb = ON.newNotebook(name, color);
            const sec = ON.newSection('New Section 1');
            const pg = ON.newPage('Untitled page');
            sec.pages.push(pg); nb.sections.push(sec);
            state.nbs[name] = nb;
            const l = ON.lib();
            l[name] = { name, color, created: nb.created, modified: nb.modified, json: JSON.stringify(nb) };
            ON.setLib(l);
            state.nbName = name; state.secId = sec.id; state.pgId = pg.id; state.grpOpen = null;
            ON.session(); ON.renderAll(); renderNavIfOpen();
            ON.toast && ON.toast('Notebook created: ' + name);
          }
        },
        { label: 'Cancel' },
      ],
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }
  ON.addNotebookDialog = addNotebookDialog;

  /* ==================== navigation pane ==================== */
  function renderNav() {
    const host = $('#nav-scroll'); if (!host) return;
    host.innerHTML = '';
    const libx = ON.lib();
    const names = Object.keys(libx);
    if (!names.length) { host.appendChild(el('div', { class: 'nv-empty' }, 'No notebooks yet.')); }
    names.forEach(name => {
      const meta = libx[name];
      const nb = name === state.nbName ? ON.curNb() : null;
      const open = state._navOpen ? !!state._navOpen[name] : name === state.nbName;
      const secCount = nb ? nb.sections.length : (function () { try { return JSON.parse(meta.json).sections.length; } catch (e) { return 0; } })();
      const head = el('div', { class: 'nv-nb' + (name === state.nbName ? ' on' : '') },
        el('span', { class: 'nv-caret', html: svgIcon(open ? 'chevD' : 'chevR', 12) }),
        el('span', { class: 'nv-dot', style: `background:${meta.color || ACCENT}` }),
        el('span', { class: 'nv-nm', title: name }, name),
        el('span', { class: 'nv-n', title: secCount + ' sections' }, String(secCount)));
      head.addEventListener('mousedown', e => {
        e.preventDefault();
        state._navOpen = state._navOpen || {};
        if (name !== state.nbName) { state._navOpen[name] = true; switchNotebook(name, true); renderNav(); return; }
        state._navOpen[name] = !open;
        renderNav();
      });
      host.appendChild(head);
      if (!open) return;
      const list = el('div', { class: 'nv-secs' });
      const nb2 = name === state.nbName ? ON.curNb() : serializeNb(name);
      (nb2 && nb2.sections ? nb2.sections : []).forEach(sec => {
        const grp = sec.groupId && nb2.groups ? (nb2.groups.find(g => g.id === sec.groupId) || null) : null;
        const row = el('div', { class: 'nv-sec' + (name === state.nbName && sec.id === state.secId ? ' on' : ''), style: grp ? 'padding-left:44px' : '' },
          el('span', { class: 'nv-sdot', style: `background:${sec.color || '#8F80AD'}` }),
          el('span', { class: 'nv-nm' }, sec.name || 'New Section'),
          sec.pw ? el('span', { class: 'nv-lk', title: 'Password protected', html: svgIcon('lock', 11) }) : '');
        row.addEventListener('mousedown', e => {
          e.preventDefault();
          if (name !== state.nbName) switchNotebook(name, true);
          state.grpOpen = sec.groupId || null;
          state.secId = sec.id;
          ON.ensurePage();
          state.pgId = ON.curSec().pages.length ? ON.curSec().pages[0].id : state.pgId;
          ON.session(); ON.renderAll(); renderNav();
        });
        list.appendChild(row);
      });
      host.appendChild(list);
    });
  }
  window.renderNavIfOpen = function () {
    const np = $('#navpane');
    if (np && !np.hidden) renderNav();
  };
  ON.toggleNavPane = function () {
    const np = $('#navpane'); if (!np) return;
    np.hidden = !np.hidden;
    if (!np.hidden) renderNav();
    ON.layout ? ON.layout() : ON.renderCanvas();
  };
  ON.initNav = function () {
    const add = $('#nav-addnb');
    if (add) {
      $('#nav-addnb-ico').innerHTML = svgIcon('plus', 15);
      add.addEventListener('mousedown', e => { e.preventDefault(); addNotebookDialog(); });
    }
    const inp = $('#nav-search');
    if (inp) inp.addEventListener('mousedown', e => { e.preventDefault(); ON.openSearch(''); });
  };

  /* ==================== search (Ctrl+E) ==================== */
  function collectText(pg) {
    let s = '';
    (pg.containers || []).forEach(c => (c.paras || []).forEach(pp => s += (pp.runs || []).map(r => r.t).join('') + '\n'));
    return s;
  }
  function scan(q, scope) {
    const ql = q.toLowerCase();
    const res = [];
    const names = Object.keys(ON.lib());
    names.forEach(nbName => {
      if (scope === 'notebook' && nbName !== state.nbName) return;
      const nb = serializeNb(nbName); if (!nb) return;
      (nb.sections || []).forEach(sec => {
        if (scope === 'section' && sec.id !== state.secId) return;
        if ((sec.name || '').toLowerCase().includes(ql)) {
          res.push({ kind: 'section', nb: nbName, secId: sec.id, grpId: sec.groupId, name: sec.name, crumb: nbName });
        }
        (sec.pages || []).forEach(pg => {
          const ttl = pg.name || 'Untitled page';
          const text = collectText(pg);
          const inT = ttl.toLowerCase().includes(ql);
          const idx = text.toLowerCase().indexOf(ql);
          if (!inT && idx < 0) return;
          let cid = null;
          if (idx >= 0) {
            let acc = 0;
            outer: for (const c of (pg.containers || [])) {
              for (const pp of (c.paras || [])) {
                const tl = (pp.runs || []).map(r => r.t).join('').length + 1;
                if (acc + tl > idx) { cid = c.id; break outer; }
                acc += tl;
              }
            }
          }
          let count = inT ? 1 : 0;
          if (idx >= 0) { count += (text.toLowerCase().split(ql).length - 1); }
          const snip = idx >= 0 ? text.slice(Math.max(0, idx - 42), Math.min(text.length, idx + q.length + 46)).replace(/\n+/g, ' ') : '';
          res.push({ kind: 'page', nb: nbName, secId: sec.id, pgId: pg.id, grpId: sec.groupId, name: ttl, crumb: nbName + ' ▸ ' + sec.name, snip, ql, count, cid, modified: pg.modified });
        });
      });
    });
    res.sort((a, b) => (b.count || 0) - (a.count || 0) || (b.modified || 0) - (a.modified || 0));
    return res.slice(0, 60);
  }
  function hiSnip(snip, q) {
    const i = snip.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(snip);
    return esc(snip.slice(0, i)) + '<mark>' + esc(snip.slice(i, i + q.length)) + '</mark>' + esc(snip.slice(i + q.length));
  }
  ON.openSearch = function (prefill) {
    ON.endEdit(true);
    ON.persistNb();
    const ovl = $('#search-ovl'); if (!ovl) return;
    ovl.hidden = false;
    ovl.innerHTML = '';
    let scope = 'all';
    const card = el('div', { class: 'sr-card' });
    const inp = el('input', { type: 'text', placeholder: 'Search all notebooks…', value: prefill || '', spellcheck: 'false' });
    card.appendChild(el('div', { class: 'sr-head' }, el('span', { html: svgIcon('search', 17) }), inp,
      el('span', { class: 'x', title: 'Close (Esc)', html: svgIcon('x', 15), style: 'cursor:pointer;color:#605E5C', onclick: ON.closeSearch })));
    const chips = el('div', { class: 'sr-scope' }, el('span', null, 'Find:'));
    [['section', 'This Section'], ['notebook', 'This Notebook'], ['all', 'All Notebooks']].forEach(([v, lab]) => {
      const c = el('span', { class: 'chip' + (v === scope ? ' on' : ''), 'data-sc': v }, lab);
      c.addEventListener('mousedown', e => { e.preventDefault(); scope = v; chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x.dataset.sc === v)); run(); });
      chips.appendChild(c);
    });
    card.appendChild(chips);
    const res = el('div', { class: 'sr-res' });
    card.appendChild(res);
    ovl.appendChild(card);
    function run() {
      const q = inp.value.trim();
      res.innerHTML = '';
      if (!q) {
        res.appendChild(el('div', { class: 'sr-hint' },
          el('div', { class: 't' }, 'Search tips'),
          el('div', { class: 's' }, 'Type to search page titles, page text, and section names across your notebooks.'),
          el('div', { class: 's' }, 'Narrow the scope with the buttons above. Click a result to jump to it.')));
        return;
      }
      const hits = scan(q, scope);
      if (!hits.length) {
        res.appendChild(el('div', { class: 'sr-none' }, 'No results for “' + q + '” in ' + { section: 'this section', notebook: 'this notebook', all: 'any notebook' }[scope] + '.'));
        return;
      }
      res.appendChild(el('div', { class: 'sr-count' }, hits.length + ' result' + (hits.length > 1 ? 's' : '')));
      hits.forEach(h => {
        const it = el('div', { class: 'hit-it' },
          el('div', { class: 'hit-pg', html: (h.kind === 'section' ? svgIcon('template', 12) + ' ' : '') + esc(h.name) }),
          el('div', { class: 'hit-cr' }, h.crumb),
          h.snip ? el('div', { class: 'hit-tx', html: '…' + hiSnip(h.snip, q) + '…' }) : '');
        it.addEventListener('mousedown', e => {
          e.preventDefault();
          ON.closeSearch();
          jumpTo(h);
        });
        res.appendChild(it);
      });
    }
    let deb = null;
    inp.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(run, 130); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); ON.closeSearch(); }
      if (e.key === 'Enter') { e.preventDefault(); const first = res.querySelector('.hit-it'); if (first) first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
      e.stopPropagation();
    });
    ovl.addEventListener('mousedown', e => { if (e.target === ovl) ON.closeSearch(); });
    run();
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  };
  ON.closeSearch = function () { const ovl = $('#search-ovl'); if (ovl) { ovl.hidden = true; ovl.innerHTML = ''; } };

  /* ==================== tags summary pane ==================== */
  function scanTags(scope) {
    const out = [];
    Object.keys(ON.lib()).forEach(nbName => {
      if (scope === 'notebook' && nbName !== state.nbName) return;
      const nb = serializeNb(nbName); if (!nb) return;
      (nb.sections || []).forEach(sec => {
        if (scope === 'section' && sec.id !== state.secId) return;
        (sec.pages || []).forEach(pg => {
          (pg.containers || []).forEach(c => (c.paras || []).forEach(pp => {
            (pp.tags || []).forEach(tk => {
              out.push({ tag: tk, checked: !!pp.checked, text: (pp.runs || []).map(r => r.t).join('') || '(empty)', nb: nbName, secId: sec.id, secName: sec.name, pgId: pg.id, pgName: pg.name || 'Untitled page', grpId: sec.groupId, cid: c.id });
            });
          }));
        });
      });
    });
    return out;
  }
  ON.openTagsPane = function () {
    const sp = $('#sidepane'); if (!sp) return;
    ON.endEdit(true);
    sp.hidden = false;
    let scope = 'notebook';
    const body = el('div', { class: 'sp-body' });
    function refresh() {
      const items = scanTags(scope);
      body.innerHTML = '';
      const sc = el('div', { class: 'sp-scope' }, el('span', null, 'Search:'));
      const sel = el('select');
      [['section', 'This Section'], ['notebook', 'This Notebook'], ['all', 'All Notebooks']].forEach(([v, l]) => sel.appendChild(el('option', { value: v }, l)));
      sel.value = scope;
      sel.addEventListener('change', () => { scope = sel.value; refresh(); });
      sc.appendChild(sel);
      body.appendChild(sc);
      if (!items.length) {
        body.appendChild(el('div', { class: 'sp-none' }, 'No tags found in ' + { section: 'this section', notebook: 'this notebook', all: 'any notebook' }[scope] + '.'));
      } else {
        const byTag = {};
        items.forEach(it => { (byTag[it.tag] = byTag[it.tag] || []).push(it); });
        Object.keys(byTag).forEach(tk => {
          const def = ON.TAGS[tk] || { name: tk };
          const arr = byTag[tk];
          const grp = el('div', { class: 'tg-grp' });
          grp.appendChild(el('div', { class: 'tg-h', html: `<span class="tg-ic">${ON.tagGlyphHTML({ tags: [tk], checked: false })}</span><span class="tg-nm">${esc(def.name || tk)}</span><span class="tg-n">${arr.length}</span>` }));
          arr.forEach(it => {
            const row = el('div', { class: 'hit-it tg-it' },
              el('span', { class: 'tg-ck', html: ON.tagGlyphHTML({ tags: [tk], checked: it.checked }) }),
              el('span', { class: 'tg-tx', title: it.text }, it.text.length > 64 ? it.text.slice(0, 64) + '…' : it.text),
              el('span', { class: 'hit-cr tg-pg' }, it.pgName + ' · ' + it.secName));
            row.addEventListener('mousedown', e => { e.preventDefault(); sp.hidden = true; jumpTo(it); });
            grp.appendChild(row);
          });
          body.appendChild(grp);
        });
      }
      const foot = el('div', { class: 'sp-foot' });
      const mk = el('button', { class: 'btn pri', style: 'width:100%' }, 'Create Summary Page');
      mk.addEventListener('click', () => {
        const items = scanTags(scope);
        if (!items.length) { ON.toast && ON.toast('No tags to summarize'); return; }
        const sec = ON.curSec(); if (!sec) return;
        ON.pushNow('Tags summary page');
        const pg = ON.newPage('Tagged Notes Summary');
        const c = ON.newContainer(24, 120);
        c.w = 560;
        c.paras = [{ runs: [{ t: 'Tagged Notes Summary', b: true }], style: 'h1', align: null, level: 0, bullet: 'none', tags: [] },
        { runs: [{ t: 'Scope: ' + { section: 'This Section', notebook: 'This Notebook', all: 'All Notebooks' }[scope] + ' · ' + items.length + ' item' + (items.length > 1 ? 's' : ''), color: '#666666', size: 11 }], style: 'normal', align: null, level: 0, bullet: 'none', tags: [] }];
        items.forEach(it => {
          c.paras.push({ runs: [{ t: it.text, strike: it.checked || undefined }, { t: '   — ' + it.pgName, color: '#666666', size: 11 }], style: 'normal', align: null, level: 0, bullet: 'none', tags: [it.tag], checked: it.checked });
        });
        pg.containers.push(c);
        sec.pages.push(pg);
        state.pgId = pg.id;
        ON.markDirty(); ON.renderAll();
        sp.hidden = true;
        ON.toast && ON.toast('Summary page created');
      });
      foot.appendChild(mk);
      body.appendChild(foot);
    }
    sp.innerHTML = '';
    sp.appendChild(el('div', { class: 'sp-h' }, el('span', { html: svgIcon('todo', 15), style: 'color:' + ACCENT + ';margin-right:8px' }), 'Tags Summary',
      el('span', { class: 'x', html: svgIcon('x', 15), onclick: () => sp.hidden = true })));
    sp.appendChild(body);
    refresh();
  };

  /* ==================== templates pane ==================== */
  const TEMPLATES = [
    {
      name: 'Meeting Notes', desc: 'Agenda, notes, and action items with To Do tags',
      paras: [
        { t: 'Meeting Notes', st: 'h1' }, { t: 'Date: ', b: true }, { t: 'Location: ', b: true }, { t: 'Attendees: ', b: true },
        { t: 'Agenda', st: 'h2' }, { t: '', bult: 'char', bullet: 'char' }, { t: '', bullet: 'char' },
        { t: 'Notes', st: 'h2' }, { t: '', bullet: 'char' },
        { t: 'Action Items', st: 'h2' }, { t: 'Follow up…', tag: 'todo' }, { t: 'Send summary…', tag: 'todo' },
      ]
    },
    {
      name: 'Class Notes', desc: 'Course header, key points, and open questions',
      paras: [
        { t: 'Class Notes', st: 'h1' }, { t: 'Course: ', b: true }, { t: 'Date: ', b: true }, { t: 'Instructor: ', b: true },
        { t: 'Key Points', st: 'h2' }, { t: '', bullet: 'char' }, { t: '', bullet: 'char' }, { t: '', bullet: 'char' },
        { t: 'Questions to Review', st: 'h2' }, { t: '', tag: 'question' },
      ]
    },
    {
      name: 'Simple To Do', desc: 'A checklist you can tick off',
      paras: [
        { t: 'To Do List', st: 'h1' },
        { t: 'First task', tag: 'todo' }, { t: 'Second task', tag: 'todo' }, { t: 'Third task', tag: 'todo' }, { t: '', tag: 'todo' }, { t: '', tag: 'todo' },
      ]
    },
    {
      name: 'Project Overview', desc: 'Goal, scope, owners, and milestones',
      paras: [
        { t: 'Project Overview', st: 'h1' }, { t: 'Project: ', b: true }, { t: 'Owner: ', b: true }, { t: 'Status: ', b: true },
        { t: 'Goal', st: 'h2' }, { t: '', bullet: 'char' },
        { t: 'Scope', st: 'h2' }, { t: '', bullet: 'char' },
        { t: 'Milestones', st: 'h2' }, { t: 'Kickoff', tag: 'todo' }, { t: 'First deliverable', tag: 'todo' }, { t: 'Review', tag: 'todo' },
      ]
    },
  ];
  function applyTemplate(tpl) {
    const pg = ON.curPg(), sec = ON.curSec();
    if (!pg || !sec) return;
    const hasContent = pg.containers.length > 1 || (pg.containers[0] && pg.containers[0].paras.some(pp => (pp.runs || []).map(r => r.t).join('').trim()));
    const doIt = () => {
      ON.pushNow('Apply template');
      if (!pg.name || pg.name === 'Untitled page') { pg.name = tpl.name; }
      const c = ON.newContainer(24, 118);
      c.w = 600;
      c.paras = tpl.paras.map(p => ({
        runs: [{ t: p.t || '', b: p.b || undefined }], style: p.st || 'normal', align: null, level: 0,
        bullet: p.bullet || 'none', tags: p.tag ? [p.tag] : [], checked: false,
      }));
      pg.containers = [c];
      pg.ink = [];
      ON.markDirty(); ON.renderAll();
      ON.toast && ON.toast('Template applied: ' + tpl.name);
    };
    if (hasContent) {
      ON.dlg({
        title: 'Apply Template', width: 420,
        bodyText: `Applying “${tpl.name}” replaces the content on this page. Continue?`,
        buttons: [{ label: 'Apply', pri: true, fn: doIt }, { label: 'Cancel' }],
      });
    } else doIt();
  }
  ON.openTemplatesPane = function () {
    const sp = $('#sidepane'); if (!sp) return;
    ON.endEdit(true);
    sp.hidden = false;
    sp.innerHTML = '';
    sp.appendChild(el('div', { class: 'sp-h' }, el('span', { html: svgIcon('template', 15), style: 'color:' + ACCENT + ';margin-right:8px' }), 'Page Templates',
      el('span', { class: 'x', html: svgIcon('x', 15), onclick: () => sp.hidden = true })));
    const body = el('div', { class: 'sp-body' });
    body.appendChild(el('div', { class: 'sp-none', style: 'text-align:left;padding:4px 6px 10px' }, 'Click a template to apply it to this page:'));
    TEMPLATES.forEach(t => {
      const c = el('div', { class: 'hit-it tp-card' },
        el('div', { class: 'hit-pg' }, t.name),
        el('div', { class: 'hit-tx' }, t.desc));
      c.addEventListener('mousedown', e => { e.preventDefault(); sp.hidden = true; applyTemplate(t); });
      body.appendChild(c);
    });
    sp.appendChild(body);
  };

  /* ==================== recycle bin ==================== */
  ON.openRecycleBin = function () {
    const nb = ON.curNb(); if (!nb) return;
    nb.bin = nb.bin || [];
    const body = el('div', null,
      el('div', { class: 'pg-sub', style: 'padding-bottom:8px' }, `Deleted pages and sections in “${ON.esc(nb.name)}” are kept for 60 days before they are purged.`));
    if (!nb.bin.length) {
      body.appendChild(el('div', { class: 'pg-sub', style: 'padding:18px 0;text-align:center;color:#8A8886' }, 'The recycle bin is empty.'));
    }
    const list = el('div', { style: 'max-height:320px;overflow:auto' });
    [...nb.bin].reverse().forEach((entry, ri) => {
      const idx = nb.bin.length - 1 - ri;
      const nm = entry.kind === 'page' ? (entry.obj.name || 'Untitled page') : (entry.obj.name || 'Section');
      const row = el('div', { class: 'hit-it', style: 'display:flex;align-items:center;gap:9px' },
        el('span', { html: svgIcon(entry.kind === 'page' ? 'newdoc' : 'openF', 16), style: 'color:#605E5C;display:inline-flex' }),
        el('span', { style: 'flex:1;min-width:0' },
          el('div', { class: 'hit-pg' }, nm),
          el('div', { class: 'hit-cr' }, (entry.kind === 'page' ? 'Page' + (entry.secName ? ' · from ' + entry.secName : '') : 'Section') + ' · deleted ' + fmtDT(entry.deletedAt))),
        el('button', { class: 'btn' }, 'Restore'),
        el('button', { class: 'btn danger' }, 'Delete'));
      const [btnRes, btnDel] = row.querySelectorAll('button');
      btnRes.addEventListener('click', () => {
        ON.pushNow('Restore from recycle bin');
        if (entry.kind === 'page') {
          let sec = nb.sections.find(s => s.id === entry.secId) || nb.sections[0];
          if (!sec) { sec = ON.newSection('New Section 1'); nb.sections.push(sec); }
          sec.pages.push(entry.obj);
        } else {
          nb.sections.push(entry.obj);
        }
        nb.bin.splice(idx, 1);
        ON.markDirty(); ON.persistNb(); ON.renderAll();
        refresh();
        ON.toast && ON.toast('Restored: ' + nm);
      });
      btnDel.addEventListener('click', () => {
        ON.pushNow('Purge item');
        nb.bin.splice(idx, 1);
        ON.markDirty(); ON.persistNb();
        refresh();
      });
      list.appendChild(row);
    });
    body.appendChild(list);
    const btns = [{ label: 'Close', pri: true }];
    if (nb.bin.length) btns.unshift({
      label: 'Empty Recycle Bin', fn: () => {
        ON.pushNow('Empty recycle bin');
        nb.bin.length = 0;
        ON.markDirty(); ON.persistNb();
        refresh();
      }
    });
    let d = null;
    function refresh() { if (d) { d.remove(); } ON.openRecycleBin(); }
    d = ON.dlg({ title: 'Notebook Recycle Bin — ' + nb.name, width: 560, body, buttons: btns });
  };

  /* ==================== backstage (File menu) ==================== */
  const BS_TABS = [
    ['info', 'Info'], ['new', 'New'], ['open', 'Open'], ['saveas', 'Save As'], ['print', 'Print'], ['share', 'Share'],
    ['account', 'Account'], ['feedback', 'Feedback'], ['options', 'Options'],
  ];
  function bsClose() { const o = $('#bs-ovl'); if (o) o.hidden = true; }
  ON.closeBackstage = bsClose;
  function pageCount(nb) { return (nb.sections || []).reduce((n, s) => n + (s.pages ? s.pages.length : 0), 0); }
  function bsBody(page) {
    const nb = ON.curNb();
    const w = el('div', { class: 'bs-page' });
    if (page === 'info') {
      const secs = nb ? nb.sections.length : 0, pgs = nb ? pageCount(nb) : 0;
      const prot = nb ? nb.sections.filter(s => s.pw) : [];
      w.appendChild(el('div', { class: 'bs-h' }, 'Information about ' + esc(nb ? nb.name : '')));
      w.appendChild(el('div', { class: 'bs-sub' }, nb ? (nb.sections.length + ' sections · ' + pgs + ' pages · ' + (nb.groups ? nb.groups.length : 0) + ' section groups') : ''));
      const rows = el('div', { class: 'bs-info' });
      [['Notebook', nb ? nb.name : '—'],
      ['Color', ''],
      ['Sections', String(secs)],
      ['Pages', String(pgs)],
      ['Created', nb ? fmtDT(nb.created) : '—'],
      ['Last modified', nb ? fmtDT(nb.modified) : '—'],
      ['Storage', 'Browser local storage (auto-save)'],
      ['Protected sections', prot.length ? prot.map(s => s.name).join(', ') : 'None'],
      ['Recycle bin', nb ? (nb.bin || []).length + ' item(s)' : '—'],
      ].forEach(([k, v]) => {
        const r = el('div', { class: 'bs-ir' }, el('span', { class: 'k' }, k));
        if (k === 'Color') r.appendChild(el('span', { class: 'v' }, el('span', { class: 'nv-dot', style: `background:${nb ? nb.color : ACCENT};display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px` }), ' ' + (nb ? nb.color : '')));
        else r.appendChild(el('span', { class: 'v' }, v));
        rows.appendChild(r);
      });
      w.appendChild(rows);
      const prot2 = el('div', { style: 'margin-top:18px;display:flex;gap:10px' });
      const b1 = el('button', { class: 'btn' }, 'Protected Section Settings');
      b1.addEventListener('click', () => { bsClose(); ON.showTab('review'); ON.runCmdId('rvprotect'); });
      const b2 = el('button', { class: 'btn' }, 'Version History for This Page');
      b2.addEventListener('click', () => { bsClose(); ON.pageVersionsPane(); });
      prot2.appendChild(b1); prot2.appendChild(b2);
      w.appendChild(prot2);
    }
    else if (page === 'new') {
      w.appendChild(el('div', { class: 'bs-h' }, 'New Notebook'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Create a notebook stored in this browser. Give it a name and pick a color.'));
      const btn = el('button', { class: 'btn pri big' }, 'New Notebook…');
      btn.addEventListener('click', () => { bsClose(); addNotebookDialog(); });
      const card = el('div', { class: 'bs-card' },
        el('div', { class: 't' }, el('span', { html: svgIcon('onenote', 26) }), ' Blank notebook'),
        el('div', { class: 'd' }, 'One section to get you started; add more with Ctrl+T.'), btn);
      w.appendChild(card);
    }
    else if (page === 'open') {
      w.appendChild(el('div', { class: 'bs-h' }, 'Open Notebook'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Notebooks saved in this browser:'));
      const libx = ON.lib();
      const names = Object.keys(libx);
      const list = el('div', { class: 'bs-list' });
      if (!names.length) list.appendChild(el('div', { class: 'bs-sub' }, 'No notebooks yet.'));
      names.forEach(name => {
        const meta = libx[name];
        const it = JSON.parse(meta.json || '{}');
        const row = el('div', { class: 'bs-item' + (name === state.nbName ? ' cur' : '') },
          el('span', { class: 'nv-dot', style: `background:${meta.color || ACCENT}` }),
          el('span', { class: 't' }, name),
          el('span', { class: 'm' }, (it.sections ? it.sections.length : 0) + ' sections · ' + (it.sections || []).reduce((n, s) => n + (s.pages ? s.pages.length : 0), 0) + ' pages · modified ' + fmtDT(meta.modified)),
          name === state.nbName ? el('span', { class: 'tag-open' }, 'Current') : '',
          el('span', { class: 'del', title: 'Delete notebook', html: svgIcon('bin', 14) }));
        row.addEventListener('mousedown', e => {
          if (e.target.closest('.del')) return;
          e.preventDefault(); bsClose(); switchNotebook(name);
        });
        row.querySelector('.del').addEventListener('mousedown', e => {
          e.preventDefault(); e.stopPropagation();
          ON.dlg({
            title: 'Delete Notebook', width: 420,
            bodyText: `Permanently delete “${name}” and all of its notes? This cannot be undone.`,
            buttons: [{
              label: 'Delete', pri: true, fn: () => {
                const l = ON.lib(); delete l[name]; ON.setLib(l);
                delete state.nbs[name];
                if (state.nbName === name) {
                  const rest = Object.keys(ON.lib());
                  if (rest.length) { switchNotebook(rest[0], true); }
                  else { state.nbName = null; state.secId = null; state.pgId = null; bootBlank(); }
                }
                bsClose(); ON.renderAll(); renderNavIfOpen();
                ON.toast && ON.toast('Deleted notebook: ' + name);
              }
            }, { label: 'Cancel' }],
          });
        });
        list.appendChild(row);
      });
      w.appendChild(list);
    }
    else if (page === 'saveas') {
      w.appendChild(el('div', { class: 'bs-h' }, 'Save As'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Export a copy — notes are always saved to this browser automatically.'));
      const c1 = el('div', { class: 'bs-card' },
        el('div', { class: 't' }, 'Notebook backup (.json)'),
        el('div', { class: 'd' }, 'Every section, page, tag, and ink stroke of “' + esc(nb.name) + '” as one file.'));
      const b1 = el('button', { class: 'btn pri' }, 'Download Notebook');
      b1.addEventListener('click', () => {
        ON.persistNb();
        const blob = new Blob([JSON.stringify(serializeNb(state.nbName), null, 2)], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: (state.nbName || 'notebook') + '.onenote.json' });
        document.body.appendChild(a); a.click(); a.remove();
        ON.toast && ON.toast('Notebook exported');
      });
      c1.appendChild(b1);
      const c2 = el('div', { class: 'bs-card' },
        el('div', { class: 't' }, 'Current page as web page (.html)'),
        el('div', { class: 'd' }, 'A stand-alone HTML copy of the page you are looking at.'));
      const b2 = el('button', { class: 'btn' }, 'Export Page');
      b2.addEventListener('click', () => exportPageHTML());
      c2.appendChild(b2);
      w.appendChild(c1); w.appendChild(c2);
    }
    else if (page === 'print') {
      w.appendChild(el('div', { class: 'bs-h' }, 'Print'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Print the current page. Only the note page is sent to the printer.'));
      const pg = ON.curPg();
      const card = el('div', { class: 'bs-card' },
        el('div', { class: 't' }, esc(pg ? (pg.name || 'Untitled page') : '')),
        el('div', { class: 'd' }, (pg ? (pg.containers || []).length : 0) + ' objects on the page'));
      const b = el('button', { class: 'btn pri big' });
      b.innerHTML = svgIcon('print', 14) + ' Print';
      b.addEventListener('click', () => { bsClose(); setTimeout(() => window.print(), 60); });
      card.appendChild(b);
      w.appendChild(card);
    }
    else if (page === 'share') {
      w.appendChild(el('div', { class: 'bs-h' }, 'Share'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Send this page to someone.'));
      const card = el('div', { class: 'bs-card' },
        el('div', { class: 't' }, 'Email Page'),
        el('div', { class: 'd' }, 'Opens your mail app with the page text in the body.'));
      const b = el('button', { class: 'btn pri' }, 'Email Page');
      b.addEventListener('click', () => { bsClose(); ON.emailPage && ON.emailPage(); });
      card.appendChild(b);
      const card2 = el('div', { class: 'bs-card' },
        el('div', { class: 't' }, 'Export Page as HTML'),
        el('div', { class: 'd' }, 'A file you can send or post anywhere.'));
      const b2 = el('button', { class: 'btn' }, 'Export Page');
      b2.addEventListener('click', () => exportPageHTML());
      card2.appendChild(b2);
      w.appendChild(card); w.appendChild(card2);
    }
    else if (page === 'account') {
      w.appendChild(el('div', { class: 'bs-h' }, 'Account'));
      const card = el('div', { class: 'bs-acct' },
        el('span', { class: 'av', html: svgIcon('user', 34) }),
        el('div', null,
          el('div', { class: 'nm' }, 'User'),
          el('div', { class: 'em' }, 'Local account'),
          el('div', { class: 'bs-sub', style: 'margin-top:6px' }, 'Notes live in this browser only — no sign-in needed. AutoSave keeps every change.')));
      w.appendChild(card);
    }
    else if (page === 'feedback') {
      w.appendChild(el('div', { class: 'bs-h' }, 'Feedback to Microsoft'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Tell us what you liked, or what we could do better.'));
      const ta = el('textarea', { class: 'bs-ta', rows: 6, placeholder: 'Type your feedback here…' });
      w.appendChild(ta);
      const b = el('button', { class: 'btn pri' }, 'Send Feedback');
      b.addEventListener('click', () => {
        const v = (ta.value || '').trim();
        if (!v) { ON.toast && ON.toast('Type a message first'); return; }
        try {
          const log = JSON.parse(XKV.get('oc.feedback') || '[]');
          log.push({ t: Date.now(), msg: v });
          XKV.set('oc.feedback', JSON.stringify(log));
        } catch (e) { }
        ta.value = '';
        ON.msgBox('Feedback', 'Thank you! Your feedback was recorded.');
      });
      w.appendChild(b);
    }
    else if (page === 'options') {
      state.opts = state.opts || {};
      w.appendChild(el('div', { class: 'bs-h' }, 'OneNote Options'));
      w.appendChild(el('div', { class: 'bs-sub' }, 'Settings apply immediately and are remembered.'));
      const grp1 = el('div', { class: 'bs-og' });
      grp1.appendChild(el('div', { class: 'h' }, 'Save'));
      const cb = el('input', { type: 'checkbox', id: 'opt-as' });
      cb.checked = state.opts.autosave !== false;
      const cbL = el('label', { class: 'bs-ck', for: 'opt-as' }, ' AutoSave changes to this browser');
      cb.addEventListener('change', () => {
        state.opts.autosave = cb.checked;
        saveOpts();
        if (cb.checked) { ON.persistNb(); ON.unsavedMark && ON.unsavedMark(false); }
        ON.toast && ON.toast(cb.checked ? 'AutoSave on' : 'AutoSave off — press Ctrl+S to save');
      });
      grp1.appendChild(el('div', null, cb, cbL));
      grp1.appendChild(el('div', { class: 'bs-sub' }, 'With AutoSave off, changes are kept in memory until you press Ctrl+S.'));
      w.appendChild(grp1);
      const grp2 = el('div', { class: 'bs-og' });
      grp2.appendChild(el('div', { class: 'h' }, 'Editing defaults'));
      const fsel = el('select');
      ON.FONTS.forEach(f => fsel.appendChild(el('option', { value: f }, f)));
      fsel.value = state.opts.defFont || 'Calibri';
      fsel.addEventListener('change', () => { state.opts.defFont = fsel.value === 'Calibri' ? null : fsel.value; saveOpts(); ON.toast && ON.toast('Default font: ' + fsel.value); });
      grp2.appendChild(el('div', { class: 'fld' }, el('span', { class: 'flb' }, 'Default font (new pages)'), fsel));
      const cselIn = el('select');
      [''].concat(ON.SEC_COLORS).forEach(c => cselIn.appendChild(el('option', { value: c }, c ? c : '(default lavender)')));
      cselIn.value = state.opts.secColor || '';
      cselIn.addEventListener('change', () => { state.opts.secColor = cselIn.value || null; saveOpts(); ON.toast && ON.toast('Default section color saved'); });
      grp2.appendChild(el('div', { class: 'fld' }, el('span', { class: 'flb' }, 'Default section color'), cselIn));
      w.appendChild(grp2);
      const grp3 = el('div', { class: 'bs-og' });
      grp3.appendChild(el('div', { class: 'h' }, 'Application'));
      const r1 = el('div', { class: 'bs-ir' }, el('span', { class: 'k' }, 'Product'), el('span', { class: 'v' }, 'OneNote (HTML/CSS/JS — desktop experience)'));
      const r2 = el('div', { class: 'bs-ir' }, el('span', { class: 'k' }, 'Storage used'), el('span', { class: 'v' }, ((XKV.get('oc.lib') || '').length / 1024).toFixed(1) + ' KB'));
      grp3.appendChild(r1); grp3.appendChild(r2);
      const rst = el('button', { class: 'btn danger', style: 'margin-top:10px' }, 'Reset All Data…');
      rst.addEventListener('click', () => {
        ON.dlg({
          title: 'Reset All Data', width: 430,
          bodyText: 'Erase every notebook, option, and history from this browser and reload the welcome notebook?',
          buttons: [{
            label: 'Erase Everything', pri: true, fn: () => {
              ['oc.lib', 'oc.session', 'oc.opts', 'oc.dict', 'oc.pens', 'oc.feedback'].forEach(k => XKV.del(k));
              location.reload();
            }
          }, { label: 'Cancel' }],
        });
      });
      grp3.appendChild(rst);
      w.appendChild(grp3);
    }
    return w;
  }
  function bootBlank() {
    const nb = ON.newNotebook('Personal (Web)', ACCENT);
    const sec = ON.newSection('Quick Notes');
    const pg = ON.newPage('Untitled page');
    sec.pages.push(pg); nb.sections.push(sec);
    state.nbs[nb.name] = nb;
    const l = ON.lib(); l[nb.name] = { name: nb.name, color: nb.color, created: nb.created, modified: nb.modified, json: JSON.stringify(nb) };
    ON.setLib(l);
    state.nbName = nb.name; state.secId = sec.id; state.pgId = pg.id; state.grpOpen = null;
    ON.session();
  }
  function exportPageHTML() {
    const pg = ON.curPg(); if (!pg) return;
    /* same-as-view export: absolute container positions, full run styling via
       the app's own runStyle(), todo boxes, tables, pictures, and ink strokes
       re-drawn as an SVG overlay — so the file looks like the page on screen. */
    const paraStyle = pp => {
      const a = [];
      if (pp.align && pp.align !== 'left') a.push('text-align:' + pp.align);
      if (pp.bu) a.push('padding-left:22px');
      return a.length ? ' style="' + a.join(';') + '"' : '';
    };
    const bullet = pp => {
      if (pp.style === 'title' || pp.style === 'pdate') return '';
      if (pp.bu === 'auto') return '<span style="position:absolute;left:0">•</span>';
      return '';
    };
    const runsHtml = pp => (pp.runs || []).map(r => {
      const css = ((typeof runStyle === 'function') ? runStyle(r, pp.style) : '').replace(/"/g, '&quot;');   // font stacks contain double quotes — must not break the style attribute
      const t = ON.esc(r.t);
      return `<span style="${css}${r.link ? ';cursor:pointer" data-href="' + ON.esc(r.link) : ''}">${t}</span>`;
    }).join('');
    const pgW = Math.max(760, ...(pg.containers || []).map(c => (c.x || 0) + (c.w || 0) + 40), ...((pg.ink || []).flatMap(st => (st.pts || []).map(pt => pt[0] + 30))));
    const pgH = Math.max(560, ...(pg.containers || []).map(c => (c.y || 0) + 200), ...((pg.ink || []).flatMap(st => (st.pts || []).map(pt => pt[1] + 30))));
    let body = '';
    (pg.containers || []).forEach(c => {
      if (c.kind === 'pic' && c.src) { body += `<div style="position:absolute;left:${c.x}px;top:${c.y}px"><img src="${c.src}" style="max-width:${c.w || 320}px" alt="${ON.esc(c.nm || 'picture')}"/></div>`; return; }
      if (c.kind === 'table' && c.tbl) {
        body += `<div style="position:absolute;left:${c.x}px;top:${c.y}px"><table>${c.tbl.map(r => '<tr>' + r.map(cell => '<td>' + ON.esc(typeof tableCellText === 'function' ? tableCellText(cell) : (cell == null ? '' : String(cell))) + '</td>').join('') + '</tr>').join('')}</table></div>`;
        return;
      }
      let inner = '';
      (c.paras || []).forEach(pp => {
        const txt = runsHtml(pp);
        const mark = (pp.tags || []).includes('todo') ? (pp.checked ? '☑ ' : '☐ ') : (pp.tags || []).length ? '▸ ' : '';
        const listPad = pp.bu ? 'position:relative;' : '';
        if (!txt.replace(/<[^>]*>/g, '').trim()) { inner += '<div style="min-height:1em"></div>'; return; }
        inner += `<div style="${listPad}${paraStyle(pp).replace(/^ style="|"$/g, '')}">${bullet(pp)}${mark}${txt}</div>`;
      });
      body += `<div style="position:absolute;left:${c.x}px;top:${c.y}px;width:${c.w || 320}px">${inner}</div>`;
    });
    if ((pg.ink || []).length) {
      const paths = (pg.ink || []).map(st => {
        const d = st.kind === 'shape' ? (ON.shapeD ? ON.shapeD(st) : '') : strokePath(st.pts);
        const op = st.mode === 'hi' ? ' stroke-opacity="0.55"' : '';
        return `<path d="${d}" fill="none" stroke="${st.color || '#000'}" stroke-width="${st.w || 2}" stroke-linecap="round" stroke-linejoin="round"${op}/>`;
      }).join('');
      body += `<svg style="position:absolute;left:0;top:0;pointer-events:none" width="${pgW}" height="${pgH}" viewBox="0 0 ${pgW} ${pgH}">${paths}</svg>`;
    }
    const css = `html,body{margin:0;padding:0;background:#E8E6E4;font-family:Calibri,'Segoe UI',sans-serif;}
.onpage{position:relative;margin:14px auto;background:${pg.bg && pg.bg !== '#FFFFFF' ? pg.bg : '#FFFFFF'};width:${pgW}px;min-height:${pgH}px;box-shadow:0 1px 5px rgba(0,0,0,.18);color:#1E1E1E;}
table{border-collapse:collapse}td,th{border:1px solid #A6A6A6;padding:4px 8px;font-size:10pt}
.ptag{display:inline-block;width:15px;height:15px;border:1.5px solid #605E5C;text-align:center;line-height:13px;margin-right:4px;vertical-align:-1px}
@media print{body{background:#fff}.onpage{box-shadow:none;margin:0}}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${ON.esc(pg.name || 'page')}</title><style>${css}</style></head><body><div class="onpage">${body}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (pg.name || 'page').replace(/[^\w\d]+/g, '_') + '.html' });
    document.body.appendChild(a); a.click(); a.remove();
    ON.toast && ON.toast('Page exported as HTML');
  }
  ON.exportPageHTML = exportPageHTML;
  ON.openBackstage = function (page) {
    ON.endEdit(true);
    let ov = $('#bs-ovl');
    if (!ov) {
      ov = el('div', { id: 'bs-ovl' });
      document.body.appendChild(ov);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) { e.stopPropagation(); bsClose(); } }, true);
    }
    ov.hidden = false;
    build(page || 'info');
    function build(cur) {
      ov.innerHTML = '';
      const rail = el('div', { class: 'bs-rail' });
      const back = el('span', { class: 'bs-back', title: 'Back (Esc)', html: svgIcon('chevL', 16) });
      back.addEventListener('mousedown', e => { e.preventDefault(); bsClose(); });
      rail.appendChild(back);
      rail.appendChild(el('div', { class: 'bs-brand', html: svgIcon('onenote', 30) }));
      rail.appendChild(el('div', { class: 'bs-file' }, 'File'));
      BS_TABS.forEach(([id, lab]) => {
        const t = el('div', { class: 'bs-tab' + (id === cur ? ' on' : ''), 'data-t': id }, lab);
        t.addEventListener('mousedown', e => { e.preventDefault(); build(id); });
        rail.appendChild(t);
      });
      const body = el('div', { class: 'bs-body' }, bsBody(cur));
      ov.appendChild(rail); ov.appendChild(body);
    }
  };

  /* ==================== Tell-Me ==================== */
  function tmCmds() {
    const T = (label, tab, id, kws, fn) => ({ label, tab, id, kws: (kws || '') + ' ' + label.toLowerCase(), fn });
    return [
      T('Bold', 'home', 'bold', 'strong b ctrl+b'),
      T('Italic', 'home', 'italic', 'italics i emphasis'),
      T('Underline', 'home', 'underline', 'u'),
      T('Strikethrough', 'home', 'strike', 'strike through abc'),
      T('Text Highlight Color', 'home', 'hl', 'marker yellow highlight'),
      T('Font Color', 'home', 'fcol', 'text color red'),
      T('Align Left', 'home', 'alignl', 'align left paragraph'),
      T('Clear Formatting', 'home', 'clearfmt', 'remove formatting eraser'),
      T('Bullets', null, null, 'bullet list dots', () => ON.applyBulletToggle('char')),
      T('Numbering', null, null, 'numbered list order 1 2 3', () => ON.applyBulletToggle('num')),
      T('Heading 1', null, null, 'h1 title big style', () => ON.applyParaStyle('h1')),
      T('Heading 2', null, null, 'h2 subtitle style', () => ON.applyParaStyle('h2')),
      T('To Do Tag', null, null, 'checkbox task todo ctrl+1', () => ON.toggleTagAtCaret('todo')),
      T('Important Tag', null, null, 'star important ctrl+2', () => ON.toggleTagAtCaret('important')),
      T('Question Tag', null, null, 'question mark help ctrl+3', () => ON.toggleTagAtCaret('question')),
      T('Find Tags', null, 'findtags', 'tag summary todo list find', () => ON.openTagsPane()),
      T('Email Page', 'home', 'emailpage', 'send mail'),
      T('Table', 'insert', 'intable', 'insert table grid rows columns'),
      T('Pictures', 'insert', 'inpic', 'image photo insert'),
      T('File Attachment', 'insert', 'infile', 'attach file document'),
      T('File Printout', 'insert', 'infileprint', 'printout images'),
      T('Link', 'insert', 'inlink', 'hyperlink url web ctrl+k'),
      T('Symbol', 'insert', 'insymbol', 'special character math'),
      T('Date', 'insert', 'indate', 'today date stamp'),
      T('Time', 'insert', 'intime', 'clock time stamp'),
      T('Page Templates', null, null, 'template meeting class notes', () => ON.openTemplatesPane()),
      T('Pen', 'draw', null, 'draw ink handwriting write', () => ON.setDrawMode('pen')),
      T('Highlighter', 'draw', null, 'marker draw', () => { ON.state.draw.penIdx = (ON.state.pens || []).findIndex(p => p.kind === 'hi'); ON.setDrawMode('pen'); }),
      T('Eraser', 'draw', 'dreraser', 'remove ink erase'),
      T('Lasso Select', 'draw', 'drlasso', 'select ink loop'),
      T('Ink to Shape', 'draw', 'drinkshape', 'convert shape circle square neat'),
      T('Shapes', 'draw', 'drshapes', 'rectangle ellipse arrow line draw'),
      T('Recent Edits', 'history', 'histrecent', 'changes highlight yellow who edited'),
      T('Page Versions', null, null, 'history restore old copy undo', () => ON.pageVersionsPane()),
      T('Recycle Bin', null, null, 'deleted notes restore trash', () => ON.openRecycleBin()),
      T('Spelling', null, 'spelling', 'spell check grammar f7 proofing', () => ON.runSpelling()),
      T('Password Protect Section', 'review', 'rvprotect', 'lock encrypt secure private'),
      T('Rule Lines', 'view', 'vwrule', 'ruled lined paper'),
      T('Grid Lines', 'view', 'vwgrid', 'graph paper squares'),
      T('Page Color', 'view', 'vwpgcolor', 'background paper color'),
      T('Hide Page Title', 'view', 'vwhidetitle', 'remove title'),
      T('Zoom In', 'view', 'vwzoomin', 'magnify enlarge'),
      T('Zoom Out', 'view', 'vwzoomout', 'shrink smaller'),
      T('Zoom 100%', 'view', 'vwzoom100', 'reset zoom actual size'),
      T('Full Screen', 'view', 'vwfull', 'maximize f11'),
      T('New Page', null, 'new-page', 'add page ctrl+n', () => ON.addPage()),
      T('New Section', null, 'new-section', 'add tab ctrl+t', () => ON.addSection()),
      T('New Section Group', null, null, 'folder organize tabs', () => ON.addGroup()),
      T('Search', null, 'search', 'find ctrl+e locate', () => ON.openSearch('')),
      T('Print', null, 'print', 'printer paper ctrl+p', () => window.print()),
      T('Options', null, null, 'settings preferences autosave', () => ON.openBackstage('options')),
    ];
  }
  ON.initTellme = function () {
    const box = $('#tellme'); const popEl = $('#tellme-pop');
    if (!box || !popEl) return;
    $('#tellme-ico').innerHTML = svgIcon('tellme', 14);
    const cmds = tmCmds();
    let sel = 0, matches = [];
    function hide() { popEl.hidden = true; popEl.innerHTML = ''; sel = 0; }
    function runCmd(c) {
      hide(); box.value = ''; box.blur();
      if (c.tab && ON.showTab) ON.showTab(c.tab);
      if (c.fn) { c.fn(); return; }
      if (c.id && ON.runCmdId(c.id)) return;
      ON.toast && ON.toast('Could not run: ' + c.label);
    }
    function refresh() {
      const q = box.value.trim().toLowerCase();
      if (!q) { hide(); return; }
      matches = cmds.filter(c => c.kws.includes(q)).slice(0, 8);
      if (!matches.length) {
        popEl.innerHTML = '<div class="tm-none">No commands found. Try “table”, “tag”, “pen”, “print”…</div>';
        popEl.hidden = false;
        return;
      }
      sel = Math.min(sel, matches.length - 1);
      popEl.innerHTML = '';
      popEl.appendChild(el('div', { class: 'tm-hdr' }, 'Actions'));
      matches.forEach((c, i) => {
        const it = el('div', { class: 'tm-it' + (i === sel ? ' sel' : '') },
          el('span', { class: 'lb' }, c.label),
          el('span', { class: 'tb' }, c.tab ? c.tab[0].toUpperCase() + c.tab.slice(1) : ''));
        it.addEventListener('mousedown', e => { e.preventDefault(); runCmd(c); });
        it.addEventListener('mouseenter', () => { sel = i; popEl.querySelectorAll('.tm-it').forEach((x, xi) => x.classList.toggle('sel', xi === sel)); });
        popEl.appendChild(it);
      });
      popEl.appendChild(el('div', { class: 'tm-foot' }, 'Enter to run · Esc to close'));
      popEl.hidden = false;
    }
    box.addEventListener('input', refresh);
    box.addEventListener('focus', refresh);
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); box.blur(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); sel = Math.min(sel + 1, matches.length - 1); refresh(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); sel = Math.max(sel - 1, 0); refresh(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (matches[sel]) runCmd(matches[sel]); }
    });
    document.addEventListener('mousedown', e => { if (!e.target.closest('#tellme-wrap')) hide(); }, true);
  };

  /* ==================== window close ==================== */
  ON.closeApp = function () {
    ON.persistNb(); ON.session();
    ON.dlg({
      title: 'OneNote', width: 400,
      body: el('div', { style: 'padding:6px 0;display:flex;gap:12px;align-items:flex-start' },
        el('span', { html: svgIcon('onenote', 30) }),
        el('div', null,
          el('div', { style: 'font-weight:600;margin-bottom:4px' }, 'Your notes are saved.'),
          el('div', { style: 'color:#605E5C;font-size:12px' }, 'AutoSave has stored every change in this browser. You can close the tab whenever you like.'))),
      buttons: [{ label: 'OK', pri: true }],
    });
  };
})();
