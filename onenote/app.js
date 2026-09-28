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
   OneNote clone — app.js
   model | render | outline containers | free-form text editing | selection
   tags | undo history | persistence | zoom | keyboard
   ========================================================================== */
'use strict';

/* ---------------- tiny dom helpers ---------------- */
const $ = s => document.querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, attrs, ...kids) => {
  const d = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') d.className = v;
    else if (k === 'style') d.style.cssText = v;
    else if (k.startsWith('on')) d.addEventListener(k.slice(2), v);
    else if (k === 'html') d.innerHTML = v;
    else d.setAttribute(k, v);
  }
  for (const k of kids) {
    if (k == null) continue;
    if (typeof k === 'string' && k.trim().startsWith('<')) d.insertAdjacentHTML('beforeend', k);
    else d.append(k);
  }
  return d;
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => 'o' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtKB = n => n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
const fmtDT = ts => new Date(ts).toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const rgbToHex = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('') : c; };

/* ---------------- constants ---------------- */
const ACCENT = '#7719AA';
const PAGE_MARGIN = 14;             // cwrap inset
const PAGE_WALL = 380;              // whitespace border beyond content
const NB_COLORS = ['#7719AA', '#1E6AF1', '#008475', '#CA5010', '#C00000', '#5B5FC7', '#0B6A0B', '#69797E', '#BF9000', '#E3008C', '#7A7574', '#3B3B3B'];
const SEC_COLORS = ['#8F80AD', '#7BA0CE', '#83B29B', '#C2A24B', '#C7726B', '#A6A6A6', '#6D8FAD', '#BC7FB3', '#7BB8B0', '#C98C5E'];
const HL_COLORS = ['#FFFF00', '#92D050', '#00FFFF', '#FF99FF', '#FF6D4D', '#B0F0B0', '#FFFFFF'];
const FONTS = ['Calibri', 'Segoe UI', 'Arial', 'Calibri Light', 'Times New Roman', 'Georgia', 'Consolas', 'Courier New', 'Comic Sans MS', 'Verdana', 'Trebuchet MS'];
const SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
const FSTACK = '"Segoe UI", Tahoma, sans-serif';

const STYLES = {
  normal: { label: 'Normal', cls: '' },
  title: { label: 'Title', cls: 'style-title' },
  h1: { label: 'Heading 1', cls: 'style-h1' },
  h2: { label: 'Heading 2', cls: 'style-h2' },
  h3: { label: 'Heading 3', cls: 'style-h3' },
  h4: { label: 'Heading 4', cls: 'style-h4' },
  h5: { label: 'Heading 5', cls: 'style-h5' },
  h6: { label: 'Heading 6', cls: 'style-h6' },
  quote: { label: 'Quote', cls: 'style-quote' },
  code: { label: 'Code', cls: 'style-code' },
};
const STYLES_LIST = ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'quote', 'code', 'normal'];

const TAGS = {
  todo: { label: 'To Do', icon: 'todo', key: 'Ctrl+1', box: true },
  important: { label: 'Important', icon: 'important', color: '#D83B01' },
  question: { label: 'Question', icon: 'question', color: '#1E6AF1' },
  remember: { label: 'Remember for Later', icon: 'remember', color: '#5B2D8E' },
  critical: { label: 'Critical', icon: 'critical', color: '#C43E1C' },
  idea: { label: 'Idea', icon: 'idea', color: '#EED200' },
  password: { label: 'Password', icon: 'password', color: '#0B6A0B' },
  website: { label: 'Web Site to Visit', icon: 'website', color: '#0078D7' },
  call: { label: 'Call Back', icon: 'call', color: '#10893E' },
  book: { label: 'Book to Read', icon: 'book', color: '#744DA9' },
  movie: { label: 'Movie to See', icon: 'movie', color: '#038387' },
  music: { label: 'Music to Listen To', icon: 'music', color: '#69797E' },
  todo1: { label: 'To Do Priority 1', icon: 'todo1', box: true },
  todo2: { label: 'To Do Priority 2', icon: 'todo2', box: true },
  client: { label: 'Client Request', icon: 'client', color: '#926E7B' },
};

/* ---------------- state ---------------- */
const state = {
  lib: {},                 // all notebooks index {name: {json-thin}}
  nbs: {},                 // loaded notebooks map name-> full object
  nbName: null,            // active notebook name
  secId: null, pgId: null, // active section/page ids
  grpOpen: null,           // open section-group id (or null)
  zoom: 1, fit: false,
  sel: { cis: [] },        // selected container ids
  hist: [], histPos: 0, future: [],
  recent: false,           // recent-edits highlight on
  opts: {},                // {autosave:true, rule default?}
  pens: null,              // pen drawer list (Draw tab)
  draw: { mode: null },    // 'pen'|'eraser'|'lasso'|'shape:rect'|null
  locked: {},              // unlocked-this-session set: secId->true when verified
};
window.ON = { state };

/* ---------------- model: notebooks / sections / pages ---------------- */
let nbSessionT = null;
function lib() { try { state.lib = JSON.parse(XKV.get('oc.lib') || '{}'); } catch { state.lib = {}; } return state.lib; }
function setLib(l) { state.lib = l; XKV.set('oc.lib', JSON.stringify(l)); }
function persistNb() {
  const nb = curNb(); if (!nb) return;
  nb.modified = Date.now();
  state._unsaved = false;
  const l = lib();
  l[nb.name] = { name: nb.name, color: nb.color, created: nb.created, modified: nb.modified, json: JSON.stringify(nb) };
  setLib(l);
  session();
  updateChrome();
}
const persistNbDeb = debounce(persistNb, 1200);
function markDirty() { const nb = curNb(); if (nb) nb.modified = Date.now(); if (state.opts && state.opts.autosave === false) { state._unsaved = true; updateChrome(); return; } persistNbDeb(); }
function session() {
  XKV.set('oc.session', JSON.stringify({ nbName: state.nbName, secId: state.secId, pgId: state.pgId, zoom: state.zoom }));
}
function curNb() { return state.nbName ? state.nbs[state.nbName] || null : null; }
function loadNb(name) {
  if (state.nbs[name]) return state.nbs[name];
  const it = lib()[name];
  if (!it) return null;
  try { state.nbs[name] = JSON.parse(it.json); } catch { return null; }
  return state.nbs[name];
}
function newNotebook(name, color) {
  return { id: uid(), name, color: color || NB_COLORS[0], created: Date.now(), modified: Date.now(), pw: null, groups: [], sections: [], bin: [] };
}
function newSection(name, color, groupId) {
  return { id: uid(), name, color: color || SEC_COLORS[(Math.random() * SEC_COLORS.length) | 0], groupId: groupId || null, pw: null, pages: [] };
}
function newPage(title) {
  const tid = uid();
  return {
    id: uid(), name: title || 'Untitled page', level: 0, created: Date.now(), modified: Date.now(),
    bg: '#FFFFFF', rule: 'none', locked: false,
    containers: [{
      id: tid, kind: 'text', title: true, x: 22, y: 18, w: null, h: null, ro: 0, touched: Date.now(),
      paras: [
        { runs: [{ t: title || '', font: 'Calibri Light', size: 25 }], style: 'title', align: null, level: 0, bullet: 'none', tags: [] },
        { runs: [{ t: fmtDT(Date.now()), size: 12, color: '#8A8886' }], style: 'normal', cls: 'pdate', align: null, level: 0, bullet: 'none', tags: [] },
      ]
    }],
    ink: [], tid,
  };
}
function newContainer(x, y, kind) {
  return { id: uid(), kind: kind || 'text', x: Math.round(x), y: Math.round(y), w: null, h: null, ro: 0, paras: [newPara('')], touched: Date.now() };
}
function newPara(text, opts) {
  return Object.assign({ runs: [newRun(text || '')], style: 'normal', align: null, level: 0, bullet: 'none', tags: [], spaceAfter: null, line: null }, opts || {});
}
function newRun(text, opts) { const r = Object.assign({ t: text || '' }, opts || {}); if (state.opts && state.opts.defFont && !r.font) r.font = state.opts.defFont; return r; }
function plainTextOf(p) { return p.runs.map(r => r.t).join(''); }

/* section/page lookup */
function allSecs(nb) { return nb.sections; }
function curSec() {
  const nb = curNb(); if (!nb) return null;
  let s = nb.sections.find(x => x.id === state.secId);
  if (!s && nb.sections.length) { s = nb.sections[0]; state.secId = s.id; }
  return s || null;
}
function curPg() {
  const s = curSec(); if (!s) return null;
  if (s.locked && !state.locked[s.id]) return null;   // locked sections don't expose pages in canvas
  let p = s.pages.find(x => x.id === state.pgId);
  if (!p && s.pages.length) { p = s.pages[0]; state.pgId = p ? p.id : null; }
  return p || (s.pages[0] || null);
}
function secUnlocked() { const s = curSec(); return !s || !s.pw || state.locked[s.id]; }
function grpOf(sec) { const nb = curNb(); return nb && sec.groupId ? nb.groups.find(g => g.id === sec.groupId) : null; }
function pageById(pid) { const s = curSec(); return s ? s.pages.find(p => p.id === pid) : null; }
function containerById(cid) { const p = curPg(); return p ? p.containers.find(c => c.id === cid) : null; }
function ensurePage() {
  const s = curSec();
  if (!s) return null;
  if (!s.pages.length) { const p = newPage(''); s.pages.push(p); state.pgId = p.id; markDirty(); }
  const p = curPg(); if (p && !state.pgId) state.pgId = p.id;
  return curPg();
}

/* ---------------- undo ---------------- */
let pushTimer = null;
function pushHistory(label, quiet) {
  const nb = curNb(); if (!nb) return;
  if (!nb._seedGuard) { pushNow(label); nb._seedGuard = true; return; }
  if (!quiet && pushTimer && state._lastHistLab === label) { clearTimeout(pushTimer); pushTimer = setTimeout(() => { pushTimer = null; }, 1200); return; }
  state._lastHistLab = label;
  pushNow(label);
}
function pushNow(label) {
  const nb = curNb(); if (!nb) return;
  state.hist.push({ lab: label, json: JSON.stringify(nb) });
  if (state.hist.length > 80) state.hist.shift();
  state.future = [];
  state.histPos = state.hist.length;
  updateUndoUI();
}
function doUndo() {
  const nb = curNb();
  if (!state.hist.length || !nb) { sbMsg('Nothing to undo'); return; }
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  const target = state.hist.pop();
  state.future.push({ lab: target.lab, json: JSON.stringify(nb) });
  state.histPos = state.hist.length;
  try { state.nbs[state.nbName] = JSON.parse(target.json); } catch { return; }
  state.sel.cis = [];
  renderAll(); markDirty(); updateUndoUI();
  sbMsg(('Undo ' + (target.lab || '')).trim());
}
function doRedo() {
  const nb = curNb();
  if (!state.future.length || !nb) { sbMsg('Nothing to redo'); return; }
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  const target = state.future.pop();
  state.hist.push({ lab: target.lab, json: JSON.stringify(nb) });
  state.histPos = state.hist.length;
  try { state.nbs[state.nbName] = JSON.parse(target.json); } catch { return; }
  state.sel.cis = [];
  renderAll(); markDirty(); updateUndoUI();
  sbMsg(('Redo ' + (target.lab || '')).trim());
}

function updateUndoUI() {
  $('#qat [data-q="undo"]') && $('#qat [data-q="undo"]').classList.toggle('off', !state.hist.length);
  $('#qat [data-q="redo"]') && $('#qat [data-q="redo"]').classList.toggle('off', !state.future.length);
}

/* ---------------- text rendering ---------------- */
function runStyle(r, pStyle) {
  const css = [];
  const baseSize = r.size || (pStyle === 'title' ? 25 : pStyle && pStyle.startsWith('h') ? { h1: 21, h2: 17, h3: 15, h4: 14, h5: 13, h6: 12.5 }[pStyle] : null);
  if (baseSize) css.push(`font-size:${baseSize}pt`);
  const fam = r.font || (pStyle === 'title' ? 'Calibri Light' : 'Calibri');
  css.push(`font-family:'${fam}',${FSTACK}`);
  const styleBold = pStyle && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(pStyle);
  if (r.b || (styleBold && r.b !== false)) css.push('font-weight:700');
  if (r.i) css.push('font-style:italic');
  const dec = [];
  if (r.u) dec.push('underline');
  if (r.strike) dec.push('line-through');
  if (dec.length) css.push(`text-decoration:${dec.join(' ')}`);
  if (r.color) css.push(`color:${r.color}`);
  if (r.hl) css.push(`background-color:${r.hl}`);
  if (r.sub) css.push('vertical-align:sub;font-size:75%');
  if (r.sup) css.push('vertical-align:super;font-size:75%');
  if (r.link) css.push('color:#0563C1;text-decoration:underline');
  return css.join(';');
}
function tagGlyphHTML(p) {
  if (!p.tags || !p.tags.length) return '';
  return p.tags.map(k => {
    const tg = TAGS[k]; if (!tg) return '';
    if (tg.box) {
      return `<span class="ptag todo${p.checked ? ' checked' : ''}" data-tag="${k}" contenteditable="false" title="${tg.label}">${svgIcon('check', 15)}</span>`;
    }
    return `<span class="ptag" data-tag="${k}" contenteditable="false" title="${tg.label}" style="color:${tg.color || '#605E5C'}">${svgIcon(tg.icon, 15)}</span>`;
  }).join('');
}
function paraHTML(p, idx) {
  const st = STYLES[p.style] || STYLES.normal;
  const css = ['position:relative'];
  if (p.align) css.push(`text-align:${{ l: 'left', c: 'center', r: 'right', j: 'justify' }[p.align] || p.align}`);
  if (p.level) css.push(`margin-left:${p.level * 21}px`);
  if (p.spaceAfter != null) css.push(`margin-bottom:${p.spaceAfter}pt`);
  if (p.line != null) css.push(`line-height:${p.line}`);
  let cls = 'pl ' + st.cls;
  if (p.tags && p.tags.length) p.tags.forEach(k => { if (!TAGS[k]) return; });
  if (p.bullet === 'char') { cls += ' bu-char'; css.push(`--bullet:'•'`); }
  else if (p.bullet === 'num') cls += ' bu-auto';
  const tagBits = tagGlyphHTML(p);
  const body = p.runs.map(r => `<span style="${runStyle(r, p.style)}"${r.link ? ` data-link="${esc(r.link)}"` : ''}>${esc(r.t).replace(/\n/g, '<br>')}</span>`).join('');
  return `<p class="${cls}" data-idx="${idx}" data-style="${p.style || 'normal'}" data-tags="${(p.tags || []).join(',')}"${p.checked ? ' data-checked="1"' : ''}${p.level ? ` data-level="${p.level}"` : ''}${p.align ? ` data-align="${p.align}"` : ''} style="${css.join(';')}">${tagBits}${body || '<br>'}</p>`;
}
function parasToHTML(c) { return c.paras.map((p, i) => paraHTML(p, i)).join(''); }
function objTextEmpty(c) { return !c.paras || !c.paras.length || c.paras.every(p => !plainTextOf(p).trim() && !(p.tags || []).length); }

/* ---------------- container -> html ---------------- */
function containerHTML(c) {
  const st = [`left:${c.x}px`, `top:${c.y}px`];
  if (c.w) st.push(`width:${c.w}px`);
  if (c.h) st.push(`height:${c.h}px`);
  if (c.ro) st.push(`transform:rotate(${c.ro}deg)`);
  const cls = `oc${c.title ? ' opt-title' : ''}${state.sel.cis.includes(c.id) ? ' sel' : ''}${state.recent && recentEdited(c) ? ' touched' : ''}`;
  if (c.kind === 'text') {
    return `<div class="${cls}" data-cid="${c.id}" data-kind="text" style="${st.join(';')}"><div class="oc-bar" data-bar="1"></div><div class="oc-txt${state.recent && recentEdited(c) ? ' recent-mark' : ''}" data-txt="${c.id}"${c.title ? '' : ''}>${parasToHTML(c)}</div></div>`;
  }
  if (c.kind === 'pic') {
    return `<div class="${cls}" data-cid="${c.id}" data-kind="pic" style="${st.join(';')}"><div class="oc-bar" data-bar="1"></div><img class="ocimg" src="${c.src}" style="width:${c.w || 320}px" alt="${esc(c.nm || '')}" draggable="false"/></div>`;
  }
  if (c.kind === 'file') {
    const ic = /png|jpg|jpeg|gif|bmp|svg/i.test(c.nm || '') ? 'picture' : 'attach';
    return `<div class="${cls}" data-cid="${c.id}" data-kind="file" style="${st.join(';')}"><div class="oc-bar" data-bar="1"></div><div class="ocfile" data-fid="${c.id}">${svgIcon(ic, 22)}<span class="fmeta"><span class="fn">${esc(c.nm)}</span><span class="fs">${esc(c.fs || '')}</span></span></div></div>`;
  }
  if (c.kind === 'audio') {
    return `<div class="${cls}" data-cid="${c.id}" data-kind="audio" style="${st.join(';')}"><div class="oc-bar" data-bar="1"></div><div class="ocaudio"><audio controls src="${c.src}"></audio><div class="pg-sub">${esc(c.nm || 'Recording')} — ${fmtDT(c.at || Date.now())}</div></div></div>`;
  }
  if (c.kind === 'table') {
    return `<div class="${cls}" data-cid="${c.id}" data-kind="table" style="${st.join(';')}"><div class="oc-bar" data-bar="1"></div>${tableHTML(c)}</div>`;
  }
  return '';
}
function tableCellText(cell) { return (cell && typeof cell === 'object') ? (cell.text || '') : (cell == null ? '' : String(cell)); }
function tableHTML(c) {
  let h = `<div class="tblwrap" data-twrap="${c.id}"><table style="width:${c.w || 420}px"><colgroup>${c.colW.map(w => `<col style="width:${(w * 100).toFixed(2)}%"/>`).join('')}</colgroup>`;
  c.tbl.forEach((row, ri) => {
    h += '<tr>' + row.map((cell, ci) => { const t = tableCellText(cell); return `<td data-ri="${ri}" data-ci="${ci}">${t ? esc(t).replace(/\n/g, '<br>') : '<br>'}</td>`; }).join('') + '</tr>';
  });
  return h + '</table></div>';
}
function newTableContainer(x, y, rows, cols) {
  const c = newContainer(x, y, 'table');
  c.tbl = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ text: '' })));
  c.colW = Array.from({ length: cols }, () => 1 / cols);
  c.w = Math.max(360, cols * 100);
  return c;
}
function recentEdited(c) { return c.touched && (Date.now() - c.touched) < 24 * 3600 * 1000 && !c.title; }

/* ---------------- render stage ---------------- */
function renderAll() {
  renderStrip(); renderPages(); renderCanvas();
  if (window.renderNavIfOpen) window.renderNavIfOpen();
  updateChrome();
}
function updateChrome() {
  const nb = curNb(), s = curSec(), p = curPg();
  $('#doc-name') && ($('#doc-name').textContent = (nb ? nb.name : 'OneNote') + (state._unsaved ? ' *' : ''));
  $('#nb-dot') && ($('#nb-dot').style.background = nb ? nb.color : NB_COLORS[0]);
  $('#nb-name') && ($('#nb-name').textContent = nb ? nb.name : '');
  document.title = `${p && p.name !== 'Untitled page' ? p.name : (s ? s.name : '')} - OneNote`;
  $('#tb-icon').innerHTML = svgIcon('onenote', 18);
  $('#nb-caret').innerHTML = svgIcon('chevD', 11);
  updateUndoUI();
}
function requestRender() { requestAnimationFrame(renderAll); }

function renderStrip() {
  const nb = curNb(); if (!nb) return;
  const host = $('#sec-tabs');
  let out = '';
  const mk = (sec, on) => `<div class="sec-tab${on ? ' on' : ''}" data-sec="${sec.id}" style="--sc:${sec.color}" title="${esc(sec.name)}${sec.pw ? ' (password protected)' : ''}"><span class="st-nm">${esc(sec.name)}</span>${sec.pw && !state.locked[sec.id] ? `<span class="st-lock">${svgIcon('lock', 11)}</span>` : ''}</div>`;
  if (state.grpOpen) {
    const g = nb.groups.find(x => x.id === state.grpOpen);
    out += `<div class="sec-tab grp-back" data-back="1" title="Show all sections"><span class="st-nm">‹ ${esc(g ? g.name : '')}</span></div>`;
    out += nb.sections.filter(s => s.groupId === state.grpOpen).map(s => mk(s, s.id === state.secId)).join('');
  } else {
    out += nb.sections.filter(s => !s.groupId).map(s => mk(s, s.id === state.secId)).join('');
    out += nb.groups.map(g => `<div class="sec-tab grp" data-grp="${g.id}" title="Section group: ${esc(g.name)}" style="--sc:#B0ABC4"><span class="st-nm">${esc(g.name)}</span></div>`).join('');
  }
  host.innerHTML = out;
  $$('.sec-tab', host).forEach(t => {
    t.addEventListener('mousedown', e => {
      e.preventDefault();
      const back = t.dataset.back, grp = t.dataset.grp, sid = t.dataset.sec;
      if (back) { state.grpOpen = null; renderAll(); return; }
      if (grp) { state.grpOpen = grp; const first = nb.sections.find(s => s.groupId === grp); if (first && !nb.sections.find(s => s.id === state.secId && s.groupId === grp)) state.secId = first.id; if (first) state.pgId = first.pages[0] ? first.pages[0].id : null; renderAll(); return; }
      if (sid && sid !== state.secId) selectSection(sid);
    });
    t.addEventListener('contextmenu', e => {
      e.preventDefault();
      const sid = t.dataset.sec, gid = t.dataset.grp;
      if (sid && ON.secCtxMenu) ON.secCtxMenu(e, nb.sections.find(s => s.id === sid));
      else if (gid && ON.grpCtxMenu) ON.grpCtxMenu(e, nb.groups.find(g => g.id === gid));
      else if (ON.stripCtxMenu) ON.stripCtxMenu(e);
    });
    t.addEventListener('dblclick', e => {
      const sid = t.dataset.sec;
      if (sid) { const s = nb.sections.find(x => x.id === sid); if (s && ON.renameSection) ON.renameSection(s); }
    });
  });
}
function clearHist() { state.hist = []; state.future = []; state.histPos = 0; updateUndoUI(); }
function selectSection(sid) {
  clearHist();
  const nb = curNb(); if (!nb) return;
  const s = nb.sections.find(x => x.id === sid); if (!s) return;
  state.secId = sid; state.pgId = s.pages[0] ? s.pages[0].id : null;
  state.sel.cis = []; endEdit(true);
  session(); renderAll();
}
function selectPage(pid) {
  const s = curSec(); if (!s) return;
  if (!s.pages.find(p => p.id === pid)) return;
  state.pgId = pid; state.sel.cis = []; endEdit(true);
  session(); renderAll();
}
function addSection(name, groupId) {
  pushHistory('New section');
  const nb = curNb();
  const s = newSection(name || 'New Section 1', (state.opts && state.opts.secColor) || null, groupId || null);
  nb.sections.push(s); state.secId = s.id; state.pgId = null;
  ensurePage(); markDirty(); renderAll();
  return s;
}
function addGroup(name) {
  pushHistory('New section group');
  const nb = curNb();
  const g = { id: uid(), name: name || 'New Section Group' };
  nb.groups.push(g); state.grpOpen = g.id; markDirty(); renderAll();
  return g;
}
function addPage(afterPid, level, title) {
  pushHistory('New page');
  const s = curSec(); if (!s) return null;
  const p = newPage(title || '');
  if (level) p.level = level;
  const i = afterPid ? s.pages.findIndex(x => x.id === afterPid) : s.pages.length - 1;
  s.pages.splice(i + 1, 0, p);
  state.pgId = p.id; markDirty(); renderAll();
  return p;
}
function deletePage(pid) {
  const s = curSec(); if (!s) return;
  const i = s.pages.findIndex(p => p.id === pid); if (i < 0) return;
  pushHistory('Delete page');
  const page = s.pages[i];
  s.pages.splice(i, 1);
  curNb().bin.push({ kind: 'page', obj: page, secName: s.name, secId: s.id, deletedAt: Date.now() });
  if (state.pgId === pid) state.pgId = s.pages[Math.min(i, s.pages.length - 1)] ? s.pages[Math.min(i, s.pages.length - 1)].id : null;
  if (!s.pages.length) state.pgId = null;
  ensurePage(); markDirty(); renderAll();
}
function renderPages() {
  const host = $('#pg-list'); if (!host) return;
  const s = curSec();
  $('#pg-add-ico').innerHTML = svgIcon('plus', 14);
  if (!s) { host.innerHTML = ''; return; }
  host.innerHTML = '';
  s.pages.forEach((p, i) => {
    const prev = s.pages[i - 1];
    const lvl = p.level || 0;
    const sub = plainTextOf(p.containers[0] ? p.containers[0].paras[0] : { runs: [{ t: '' }] }).trim();
    const t = el('div', { class: `pg-tab${p.id === state.pgId ? ' on' : ''}${lvl ? ' l' + Math.min(lvl, 2) : ''}${p.locked ? ' locked' : ''}`, 'data-pg': p.id, title: esc(p.name + '\n' + fmtDT(p.created)) },
      el('div', { class: 'pg-nm', html: esc(p.name) }),
      el('div', { class: 'pg-sub', html: esc(sub || fmtDT(p.created)) }),
      el('span', { class: 'pg-del', title: 'Delete page', html: svgIcon('x', 10) }),
      el('span', { class: 'pg-lock', html: p.locked ? svgIcon('lock', 11) : '' }));
    t.addEventListener('mousedown', e => {
      if (e.target.closest('.pg-del')) return;
      e.preventDefault(); if (p.id !== state.pgId) selectPage(p.id);
    });
    t.addEventListener('dblclick', () => ON.renamePage && ON.renamePage(p));
    t.addEventListener('contextmenu', e => { e.preventDefault(); if (p.id !== state.pgId) selectPage(p.id); ON.pgCtxMenu && ON.pgCtxMenu(e, p); });
    const del = $('.pg-del', t);
    if (del) del.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if (confirm(`Delete page "${p.name}"?\nIt moves to the Notebook Recycle Bin where you can restore it.`)) deletePage(p.id); });
    host.appendChild(t);
  });
}

/* canvas sizing: an unbounded white note surface */
function pageMin() {
  return { w: $('#cwrap') ? Math.max(0, $('#cwrap').clientWidth - 2 * PAGE_MARGIN) : 800, h: $('#cwrap') ? Math.max(0, $('#cwrap').clientHeight - 2 * PAGE_MARGIN) : 600 };
}
function extentOf(p) {
  let w = 900, h = 640;
  (p.containers || []).forEach(c => { w = Math.max(w, c.x + (c.w || 0) + 40); h = Math.max(h, c.y + 60); });
  (p.ink || []).forEach(s2 => (s2.pts || []).forEach(pt => { w = Math.max(w, pt[0] + 40); h = Math.max(h, pt[1] + 40); }));
  return { w, h };
}
function renderCanvas() {
  const pgEl = $('#page'); if (!pgEl) return;
  const s = curSec(), p = ensurePage() && curPg();
  // page chrome (bg + rules + size)
  if (p) {
    // page background: an explicitly-set colour always wins; an implicit/default white
    // page renders as dark paper in dark mode (like real OneNote's dark background)
    const pbgRaw = (p.bg || '#FFFFFF').toUpperCase();
    const darkPaper = document.body.classList.contains('dark') && pbgRaw === '#FFFFFF';
    pgEl.style.backgroundColor = darkPaper ? '#1E2023' : (pbgRaw === '#FFFFFF' ? '#FFFFFF' : pbgRaw);
    pgEl.classList.toggle('rule', p.rule === 'rule');
    pgEl.classList.toggle('grid', p.rule === 'grid');
    const min = pageMin(), ex = extentOf(p);
    const w = Math.max(min.w, ex.w + PAGE_WALL), h = Math.max(min.h, ex.h + PAGE_WALL);
    pgEl.style.width = w * state.zoom + 'px'; pgEl.style.height = h * state.zoom + 'px';
    pgEl.style.transform = `scale(${state.zoom})`; pgEl.style.transformOrigin = '0 0';
    $('#ink').setAttribute('width', w); $('#ink').setAttribute('height', h);
  }
  // containers
  const host = $('#cdivs');
  host.innerHTML = '';
  if (p && secUnlocked()) {
    p.containers.forEach(c => host.insertAdjacentHTML('beforeend', containerHTML(c)));
    $$('.oc', host).forEach(attachContainer);
  }
  pgEl.style.display = secUnlocked() ? '' : 'none';
  $('#lock-ovl').hidden = secUnlocked();
  if (!secUnlocked()) ON.renderLockVeil && ON.renderLockVeil();
  renderInkLayer(); renderSelOverlay();
}
function renderInkLayer() {
  const svg = $('#ink'); if (!svg) return;
  svg.classList.toggle('draw', !!(state.draw && state.draw.mode));
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const p = curPg(); if (!p) return;
  (p.ink || []).forEach(st => {
    const el2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el2.setAttribute('d', st.kind === 'shape' ? (ON.shapeD ? ON.shapeD(st) : '') : strokePath(st.pts));
    el2.setAttribute('fill', 'none');
    el2.setAttribute('stroke', st.mode === 'hi' ? (st.color || '#FFEE0066') : st.color);
    el2.setAttribute('stroke-width', st.w);
    el2.setAttribute('stroke-linecap', 'round'); el2.setAttribute('stroke-linejoin', 'round');
    if (st.mode === 'hi') { el2.setAttribute('stroke-opacity', st.color && st.color.length > 7 ? '' : '0.55'); }
    el2.dataset.sid = st.id;
    if (state.lassoSel && state.lassoSel.includes(st.id)) { el2.setAttribute('stroke-dasharray', '6 3'); el2.setAttribute('stroke', '#0078D7'); el2.setAttribute('stroke-opacity', '0.9'); }
    svg.appendChild(el2);
  });
}
function strokePath(pts) {
  if (!pts || pts.length < 2) return pts && pts.length ? `M${pts[0][0]},${pts[0][1]} L${pts[0][0] + 0.1},${pts[0][1] + 0.1}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]},${pts[i][1]} ${xc},${yc}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0]},${last[1]}`;
  return d;
}

/* ---------------- selection overlay ---------------- */
function selContainers() { const p = curPg(); const set = new Set(state.sel.cis); return p ? p.containers.filter(c => set.has(c.id)) : []; }
function renderSelOverlay() {
  const ov = $('#csel'); if (!ov) return;
  const list = selContainers();
  if (!list.length || editing) { ov.hidden = true; return; }
  const b = bboxOf(list);
  ov.hidden = false;
  ov.style.left = b.x - 5 + 'px'; ov.style.top = b.y - 5 + 'px';
  ov.style.width = b.w + 10 + 'px'; ov.style.height = b.h + 10 + 'px';
  const one = list.length === 1;
  ov.innerHTML = `<span class="h" data-h="e"${one ? '' : ' style="display:none"'}></span><span class="h" data-h="se"${one ? '' : ' style="display:none"'}></span>`;
  $$('.h', ov).forEach(h => h.addEventListener('mousedown', e => startSelResize(e, list[0], h.dataset.h)));
}
function bboxOf(list) {
  let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity;
  list.forEach(c => { x = Math.min(x, c.x); y = Math.min(y, c.y); x2 = Math.max(x2, c.x + (c.w || 200)); y2 = Math.max(y2, c.y + (c.h || 60)); });
  return { x, y, w: x2 - x, h: y2 - y };
}

/* ---------------- container events: select / drag / resize ---------------- */
function pagePoint(e) {
  const r = $('#page').getBoundingClientRect();
  return { x: (e.clientX - r.left) / state.zoom, y: (e.clientY - r.top) / state.zoom };
}
function attachContainer(node) {
  const cid = node.dataset.cid;
  node.addEventListener('mousedown', e => onContainerMouseDown(e, node, cid));
  node.addEventListener('dblclick', e => onContainerDblClick(e, node, cid));
  node.addEventListener('contextmenu', e => { e.preventDefault(); ON.objCtxMenu && ON.objCtxMenu(e, containerById(cid)); });
}
function onContainerMouseDown(e, node, cid) {
  if (e.button !== 0) return;
  if (state.draw.mode) return; // ink mode: drawing handles pointers
  const c = containerById(cid); if (!c) return;
  if (editing === cid) {
    if (e.target.closest('.oc-bar') || e.target.closest('.ocimg') || e.target.closest('.ocfile')) {
      // allow drag-out from edit via bar
      e.preventDefault(); endEdit(true); selectContainer(cid, false); startObjDrag(e, [cid]); return;
    }
    return; // caret logic
  }
  if (editing) endEdit(true);
  const isSel = state.sel.cis.includes(cid);
  let dragIds;
  if (e.shiftKey || e.ctrlKey) {
    e.preventDefault();
    if (isSel) state.sel.cis = state.sel.cis.filter(x => x !== cid); else state.sel.cis.push(cid);
    selOnly(); return;
  }
  if (!isSel) { state.sel.cis = [cid]; selOnly(); }
  dragIds = [...state.sel.cis];
  if (e.target.closest('.oc-bar') || e.target.closest('.ocimg') || e.target.closest('.ocfile') || node.classList.contains('sel')) {
    startObjDrag(e, dragIds);
  }
}
function selOnly() { renderSelOverlay(); if (window.updateRibbonState) window.updateRibbonState(); }
function startObjDrag(e, ids) {
  e.preventDefault();
  const pt0 = pagePoint(e);
  const starts = ids.map(id => { const c = containerById(id); return { c, x: c.x, y: c.y }; }).filter(s2 => s2.c);
  let moved = false;
  const mm = ev => {
    const pt = pagePoint(ev);
    const dx = pt.x - pt0.x, dy = pt.y - pt0.y;
    if (!moved && Math.hypot(dx, dy) < 3) return;
    if (!moved) { moved = true; pushHistoryQuiet('Move objects'); }
    starts.forEach(s2 => { s2.c.x = Math.max(2, Math.round(s2.x + dx)); s2.c.y = Math.max(2, Math.round(s2.y + dy)); const n = $(`#cdivs [data-cid="${s2.c.id}"]`); if (n) { n.style.left = s2.c.x + 'px'; n.style.top = s2.c.y + 'px'; } });
    renderSelOverlay();
  };
  const mu = () => {
    document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
    if (moved) { markDirty(); renderCanvas(); }
  };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
}
function pushHistoryQuiet(label) {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  pushNow(label);
}
function startSelResize(e, c, dir) {
  e.preventDefault(); e.stopPropagation();
  const z = state.zoom;
  const sx = e.clientX, sy = e.clientY, w0 = c.w || 200, h0 = c.h || 0;
  pushHistoryQuiet('Resize object');
  const mm = ev => {
    const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
    if (dir === 'e' || dir === 'se') c.w = Math.max(60, Math.round(w0 + dx));
    if (dir === 'se' && c.kind === 'pic') c.h = Math.round(w0 + dx) * 0 + c.h; // pics scale by width only
    requestRender();
  };
  const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); markDirty(); renderCanvas(); };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
}
function deleteSelection() {
  if (!state.sel.cis.length) return;
  pushHistory('Delete objects');
  const p = curPg();
  p.containers = p.containers.filter(c => !state.sel.cis.includes(c.id));
  state.sel.cis = [];
  markDirty(); renderAll();
}
function selectContainer(cid, additive) {
  if (additive) { if (!state.sel.cis.includes(cid)) state.sel.cis.push(cid); }
  else state.sel.cis = [cid];
  selOnly();
}
function dupSelection() {
  const list = selContainers(); if (!list.length) return;
  endEdit(true);
  pushHistory('Duplicate');
  const p = curPg();
  const news = list.map(c => ({ ...JSON.parse(JSON.stringify(c)), id: uid(), x: c.x + 24, y: c.y + 24 }));
  p.containers.push(...news);
  state.sel.cis = news.map(c => c.id);
  markDirty(); renderAll();
}

/* ---------------- canvas click-to-type, marquee ---------------- */
let marquee = null;
function initCanvas() {
  const wrap = $('#cwrap');
  wrap.addEventListener('mousedown', onCanvasMouseDown);
  wrap.addEventListener('dblclick', e => { if (e.target.id === 'page' || e.target.id === 'cdivs' || e.target.id === 'ink') onCanvasEmptyClick(e, true); });
  wrap.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    state.zoom = clamp(Math.round((state.zoom + (e.deltaY < 0 ? 0.1 : -0.1)) * 100) / 100, 0.35, 2.5);
    renderCanvas(); session();
  }, { passive: false });
  wrap.addEventListener('contextmenu', e => {
    if (e.target.closest('.oc')) return;
    if (e.target.closest('#ink') && state.draw.mode) return;
    e.preventDefault(); ON.pageCtxMenu && ON.pageCtxMenu(e);
  });
}
function onCanvasMouseDown(e) {
  if (e.button !== 0) return;
  if (state.draw.mode) { ON.inkDown && ON.inkDown(e); return; }
  if (e.target.closest('.oc') || e.target.closest('#csel') || e.target.closest('.pop') || e.target.closest('.dlg')) return;
  if (e.target.closest('#lockveil')) return;
  if (!secUnlocked()) return;
  // maybe marquee; click-to-add on release
  const pt0 = pagePoint(e);
  const start = { x: e.clientX, y: e.clientY };
  let mq = null;
  const mm = ev => {
    if (mq) return;
    if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 7 * state.zoom) return;
    mq = el('div', { id: 'marquee' }); $('#page').appendChild(mq);
    const mup = ev2 => { document.removeEventListener('mousemove', mvx); document.removeEventListener('mouseup', mup); };
    const mvx = ev2 => {
      const pt = pagePoint(ev2);
      const x = Math.min(pt0.x, pt.x), y = Math.min(pt0.y, pt.y), w = Math.abs(pt.x - pt0.x), h = Math.abs(pt.y - pt0.y);
      mq.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
      const p = curPg();
      state.sel.cis = p.containers.filter(c => {
        const cw = c.w || 200, ch = c.h || 60;
        return c.x < x + w && c.x + cw > x && c.y < y + h && c.y + ch > y;
      }).map(c => c.id);
      renderSelOverlay();
      mqvClean = mvx; mquClean = mup;
      ev2.preventDefault();
    };
    document.addEventListener('mousemove', mvx); document.addEventListener('mouseup', mup);
  };
  const mu = ev => {
    document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu);
    const m = $('#marquee'); if (m) { m.remove(); renderCanvas(); return; }
    if (editing) endEdit(true);
    onCanvasEmptyClick(ev, false, pt0);
  };
  document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
}
let mqvClean = null, mquClean = null;
function onCanvasEmptyClick(e, dbl, pt0) {
  if (!secUnlocked()) return;
  const p = curPg(); if (!p) return;
  const pt = pt0 || pagePoint(e);
  state.sel.cis = [];
  const c = newContainer(pt.x, pt.y - 8, 'text');
  pushHistory('Add container');
  p.containers.push(c);
  markDirty(); renderCanvas();
  startTextEdit(c.id, true);
}

/* ---------------- text editing engine ---------------- */
let editing = null;   // container id being edited
function onContainerDblClick(e, node, cid) {
  const c = containerById(cid); if (!c) return;
  if (c.kind === 'text' && !e.target.closest('.oc-bar')) { if (editing !== cid) startTextEdit(cid); return; }
  if (c.kind === 'pic') { ON.replacePicture && ON.replacePicture(c); return; }
  if (c.kind === 'file') { ON.downloadFile && ON.downloadFile(c); return; }
  if (c.kind === 'table') {
    const td = e.target.closest('td, th');
    if (td) ON.editTableCell && ON.editTableCell(c, td);
  }
}
function startTextEdit(cid, caretEnd) {
  const c = containerById(cid);
  if (!c || c.kind !== 'text') return;
  if (!state.sel.cis.includes(cid)) state.sel.cis = [cid];
  editing = cid;
  state._lecid = cid;
  const txtEl = $(`#cdivs [data-txt="${cid}"]`);
  if (!txtEl) { editing = null; return; }
  // re-sync content exactly (a char may have opened this edit)
  txtEl.innerHTML = parasToHTML(c);
  txtEl.contentEditable = 'true';
  txtEl.spellcheck = true;
  txtEl.addEventListener('input', onEditInput);
  txtEl.addEventListener('keydown', onEditKey, true);
  txtEl.addEventListener('blur', onEditBlur);
  const oc = txtEl.closest('.oc');
  if (oc) oc.classList.remove('sel');
  txtEl.focus();
  if (caretEnd) { const r = document.createRange(); r.selectNodeContents(txtEl); r.collapse(false); const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r); }
  if (window.updateRibbonState) window.updateRibbonState();
  renderSelOverlay();
}
function endEdit(commit) {
  if (!editing) return;
  const c = containerById(editing);
  const txtEl = $(`#cdivs [data-txt="${editing}"]`);
  if (txtEl) {
    txtEl.contentEditable = 'false';
    if (commit && c) { syncModelFromDOM(txtEl, c); c.touched = Date.now(); }
  }
  // drop empty new containers (OneNote behavior)
  if (c && objTextEmpty(c) && !c.title) {
    const p = curPg();
    p.containers = p.containers.filter(x => x.id !== c.id);
    state.sel.cis = [];
    editing = null; markDirty(); renderAll(); return;
  }
  if (c && c.title) syncTitle(c);
  state.sel.cis = [];
  editing = null; markDirty(); renderAll();
}
function onEditBlur() {
  setTimeout(() => {
    if (!editing) return;
    const ae = document.activeElement;
    if (ae && (ae.closest('#cdivs') || ae.closest('.pop') || ae.closest('.dlg') || ae.closest('#ribbon') || ae.closest('#tellme-wrap') || ae.closest('.ctxmenu'))) return;
    endEdit(true);
  }, 70);
}
function onEditInput(e) {
  const txtEl = e.currentTarget;
  const c = containerById(editing); if (!c || !txtEl) return;
  syncModelFromDOM(txtEl, c);
  c.touched = Date.now();
  pushHistory('Text', true);
  markDirty();
}
function onEditKey(e) {
  const c = containerById(editing); if (!c) return;
  if (e.ctrlKey || e.metaKey) {
    const k = e.key;
    if (k === 'b' || k === 'B') { e.preventDefault(); applyRunStyleToggle('b'); return; }
    if (k === 'i' || k === 'I') { e.preventDefault(); applyRunStyleToggle('i'); return; }
    if (k === 'u' || k === 'U') { e.preventDefault(); applyRunStyleToggle('u'); return; }
    if (k === '1') { e.preventDefault(); toggleTagAtCaret('todo'); return; }
    if (k === '2') { e.preventDefault(); toggleTagAtCaret('important'); return; }
    if (k === '3') { e.preventDefault(); toggleTagAtCaret('question'); return; }
    if (k === '.') { e.preventDefault(); applyBulletToggle('char'); return; }
    if (k === '/') { e.preventDefault(); applyBulletToggle('num'); return; }
    if (k === 'z' || k === 'Z') { e.preventDefault(); endEdit(true); doUndo(); return; }
    if (k === 'y' || k === 'Y') { e.preventDefault(); doRedo(); return; }
    if (k === 'a' || k === 'A') { /* native select-all inside container */ return; }
    if (k === 'Enter') { e.preventDefault(); toggleTagAtCaret('todo'); return; }
    if (e.key === 'F7') { e.preventDefault(); ON.runSpelling && ON.runSpelling(); return; }
    if ((k === 'D' && e.shiftKey) || (k === 'T' && e.shiftKey)) { e.preventDefault(); ON.insertDateTime && ON.insertDateTime(k === 'D' ? 'date' : 'time'); return; }
  }
  if (e.key === 'Escape') { e.preventDefault(); endEdit(true); return; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const pIdx = caretParaIdx(); if (pIdx == null) return;
    e.shiftKey ? outdentPara(c, pIdx) : indentPara(c, pIdx);
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    splitParaAtCaret(c);
    return;
  }
  if (e.key === 'Backspace') {
    const pIdx = caretParaIdx();
    if (pIdx != null && pIdx > 0) {
      const p = c.paras[pIdx];
      const sel2 = window.getSelection();
      if (sel2.isCollapsed && caretOffsetInPara($(`.oc [data-txt="${c.id}"] p[data-idx="${pIdx}"]`)) === 0 && !(p.tags || []).length) {
        e.preventDefault();
        pushHistory('Merge paragraph');
        const prev = c.paras[pIdx - 1];
        prev.runs = prev.runs.concat(p.runs);
        c.paras.splice(pIdx, 1);
        const txtEl = $(`#cdivs [data-txt="${c.id}"]`);
        txtEl.innerHTML = parasToHTML(c);
        restoreCaretInPara(txtEl, pIdx - 1, plainTextOf(prev).length - plainTextOf(p).length);
        markDirty();
        return;
      }
    }
  }
}
function caretParaIdx() {
  const sel2 = window.getSelection(); if (!sel2.rangeCount) return null;
  const r0 = sel2.getRangeAt(0);
  let n = r0.startContainer, off = r0.startOffset;
  if (n.nodeType === 3) n = n.parentNode;
  if (!n || !n.closest) return null;
  const p = n.closest('p[data-idx]');
  if (p) return parseInt(p.dataset.idx, 10);
  // caret anchored on the .oc-txt wrapper itself (e.g. after collapse-to-end)
  const txt = n.classList && n.classList.contains('oc-txt') ? n : (n.closest && n.closest('.oc-txt'));
  if (txt) {
    const kids = Array.from(txt.querySelectorAll('p[data-idx]'));
    if (!kids.length) return null;
    let idx = off - 1; if (isNaN(idx) || idx < 0) idx = 0; if (idx >= kids.length) idx = kids.length - 1;
    return parseInt(kids[idx].dataset.idx, 10);
  }
  return null;
}
function caretOffsetInPara(pEl) {
  if (!pEl) return null;
  const sel2 = window.getSelection(); if (!sel2.rangeCount) return 0;
  const r = sel2.getRangeAt(0).cloneRange();
  const pre = document.createRange(); pre.selectNodeContents(pEl); pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}
function restoreCaretInPara(txtEl, idx, off) {
  const pEl = txtEl.querySelector(`p[data-idx="${idx}"]`); if (!pEl) return;
  const tw = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT);
  let n, pos = 0;
  while ((n = tw.nextNode())) { const L = n.nodeValue.length; if (pos + L >= off) { const r = document.createRange(); r.setStart(n, off - pos); r.collapse(true); const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r); return; } pos += L; }
  const r = document.createRange(); r.selectNodeContents(pEl); r.collapse(false);
  const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r);
}
function splitParaAtCaret(c) {
  const txtEl = $(`#cdivs [data-txt="${c.id}"]`);
  const pIdx = caretParaIdx(); if (pIdx == null) return;
  pushHistory('New paragraph');
  syncModelFromDOM(txtEl, c);
  const p = c.paras[pIdx];
  const off = caretOffsetInPara(txtEl.querySelector(`p[data-idx="${pIdx}"]`));
  const all = plainTextOf(p);
  // split runs at flat offset
  let pos = 0, left = [], right = [], done = false;
  p.runs.forEach(r => {
    if (done) { right.push({ ...r }); return; }
    const L = r.t.length;
    if (!done && pos + L >= off) {
      left.push({ ...r, t: r.t.slice(0, off - pos) });
      right.push({ ...r, t: r.t.slice(off - pos) });
      done = true; return;
    }
    pos += L; left.push({ ...r });
  });
  p.runs = left.length ? left : [newRun('')];
  const np = { ...JSON.parse(JSON.stringify(p)), runs: right.some(r => r.t) ? right : [newRun('')], tags: [] };
  if (p.bullet === 'num') np.bullet = 'num';
  c.paras.splice(pIdx + 1, 0, np);
  txtEl.innerHTML = parasToHTML(c);
  restoreCaretInPara(txtEl, pIdx + 1, 0);
  c.touched = Date.now(); markDirty();
}
function indentPara(c, idx) {
  pushHistory('Indent paragraph');
  const p = c.paras[idx]; p.level = clamp((p.level || 0) + 1, 0, 7);
  rerenderEditText(c, idx);
}
function outdentPara(c, idx) {
  pushHistory('Decrease indent');
  const p = c.paras[idx]; p.level = clamp((p.level || 0) - 1, 0, 7);
  rerenderEditText(c, idx);
}
function rerenderEditText(c, idx) {
  const txtEl = $(`#cdivs [data-txt="${c.id}"]`);
  const off = txtEl && txtEl.querySelector(`p[data-idx="${idx}"]`) ? caretOffsetInPara(txtEl.querySelector(`p[data-idx="${idx}"]`)) : 0;
  if (txtEl) { txtEl.innerHTML = parasToHTML(c); restoreCaretInPara(txtEl, idx, off); }
  markDirty();
}
function applyBulletToggle(kind) {
  const c = containerById(editing); if (!c) return;
  const i = caretParaIdx(); if (i == null) return;
  pushHistory(kind === 'num' ? 'Numbering' : 'Bullets');
  c.paras[i].bullet = c.paras[i].bullet === kind ? 'none' : kind;
  rerenderEditText(c, i);
}
function applyRunStyleToggle(prop) {
  const c = containerById(editing); if (!c) return;
  const sel2 = window.getSelection(); if (!sel2.rangeCount) return;
  pushHistory('Text style');
  const i = caretParaIdx(); if (i == null) return;
  const p = c.paras[i];
  const pEl = $(`#cdivs [data-txt="${c.id}"] p[data-idx="${i}"]`);
  const a = caretOffsetsInPara(pEl);
  if (a.start === a.end) {
    // collapsed caret: toggle the insertion style for upcoming typing (like OneNote)
    const cmdMap = { b: 'bold', i: 'italic', u: 'underline', strike: 'strikeThrough', sub: 'subscript', sup: 'superscript' };
    document.execCommand(cmdMap[prop] || 'bold', false, null);
    const on = document.queryCommandState(cmdMap[prop] || 'bold');
    ON._pendStyle = ON._pendStyle || {}; ON._pendStyle[prop] = on;
    return;
  }
  applyToRange(p, a, all => {
    // toggle: if whole selection already true -> false
    const cur = p.runs.every(r => !r[prop]) ? true : !p.runs.every(r => !!r[prop]);
    return cur;
  }, prop);
  const off = a.start < a.end ? a.start : caretOffsetInPara(pEl);
  const txtEl = $(`#cdivs [data-txt="${c.id}"]`);
  txtEl.innerHTML = parasToHTML(c);
  restoreCaretInPara(txtEl, i, off);
  markDirty();
}
function caretOffsetsInPara(pEl) {
  const sel2 = window.getSelection(); if (!sel2.rangeCount) return { start: 0, end: 0 };
  const r = sel2.getRangeAt(0);
  const pre = document.createRange(); pre.selectNodeContents(pEl); pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  return { start, end: start + r.toString().length };
}
function applyToRange(p, a, decide, prop) {
  // split runs at start/end, then apply prop=val to covered runs
  const { start, end } = a;
  if (start === end) { p.runs.forEach(r => r[prop] = decide()); return; }
  splitRunsAt(p, start); splitRunsAt(p, end);
  let pos = 0, val = decide();
  p.runs.forEach(r => {
    const L = r.t.length;
    if (pos >= start && pos + L <= end && L) r[prop] = val;
    pos += L;
  });
  mergeAdjacentRuns(p);
}
function splitRunsAt(p, off) {
  let pos = 0;
  const out = [];
  for (const r of p.runs) {
    const L = r.t.length;
    if (pos < off && off < pos + L) { out.push({ ...r, t: r.t.slice(0, off - pos) }, { ...r, t: r.t.slice(off - pos) }); }
    else out.push(r);
    pos += L;
  }
  p.runs = out;
}
function mergeAdjacentRuns(p) {
  const out = [];
  const sig = r => JSON.stringify({ ...r, t: '' });
  for (const r of p.runs) {
    const last = out[out.length - 1];
    if (last && sig(last) === sig(r)) last.t += r.t; else out.push(r);
  }
  p.runs = out.filter(r => r.t || p.runs.length === 1);
}
function toggleTagAtCaret(k) {
  const c = containerById(editing); if (!c) return;
  const i = caretParaIdx(); if (i == null) return;
  pushHistory('Tag');
  const p = c.paras[i];
  p.tags = p.tags && p.tags.length && p.tags[0] === k ? [] : [k];
  const o = caretOffsetsInPara($(`#cdivs [data-txt="${c.id}"] p[data-idx="${i}"]`));
  rerenderEditText(c, i);
  const txtEl = $(`#cdivs [data-txt="${c.id}"]`);
  restoreCaretInPara(txtEl, i, o.start);
}
function applyAlign(al) {
  al = ({ l: 'left', c: 'center', r: 'right', j: 'justify' })[al] || al;
  const c = containerById(editing); if (!c) return;
  const i = caretParaIdx(); if (i == null) return;
  pushHistory('Align');
  c.paras[i].align = c.paras[i].align === al ? null : al;
  rerenderEditText(c, i);
}
function applyParaStyle(styleKey) {
  const c = containerById(editing); if (!c) return;
  const i = caretParaIdx(); if (i == null) return;
  pushHistory('Styles');
  c.paras[i].style = styleKey === 'normal' ? 'normal' : styleKey;
  rerenderEditText(c, i);
}
function applyFontRun(patch) {
  const c = containerById(editing); if (!c) return;
  const i = caretParaIdx(); if (i == null) return;
  pushHistory('Font');
  const p = c.paras[i];
  const pEl = $(`#cdivs [data-txt="${c.id}"] p[data-idx="${i}"]`);
  const of = caretOffsetsInPara(pEl);
  if (of.start === of.end) p.runs.forEach(r => Object.assign(r, patch));
  else {
    splitRunsAt(p, of.start); splitRunsAt(p, of.end);
    let pos = 0;
    p.runs.forEach(r => { const L = r.t.length; if (pos >= of.start && pos + L <= of.end && L) Object.assign(r, patch); pos += L; });
  }
  mergeAdjacentRuns(p);
  const txtEl = $(`#cdivs [data-txt="${c.id}"]`);
  txtEl.innerHTML = parasToHTML(c);
  restoreCaretInPara(txtEl, i, of.start);
  markDirty();
}
function clearFormatting() {
  const c = containerById(editing); if (!c) return;
  const i = caretParaIdx(); if (i == null) return;
  pushHistory('Clear formatting');
  c.paras[i].runs = c.paras[i].runs.map(r => ({ t: r.t }));
  c.paras[i].style = 'normal'; c.paras[i].bullet = 'none'; c.paras[i].align = null; c.paras[i].level = 0;
  rerenderEditText(c, i);
}
function syncTitle(c) {
  const name = plainTextOf(c.paras[0]).trim();
  const p = curPg();
  if (p && name && p.name !== name) { p.name = name; renderPages(); }
}

/* ---------------- DOM -> model sync (TreeWalker with style inheritance) ---------------- */
const BASE_FONT = { font: 'Calibri', size: null, b: false, i: false, u: false, strike: false, color: null, hl: null };
function syncModelFromDOM(txtEl, c) {
  const paras = [];
  $$('p[data-idx]', txtEl).forEach((pEl, idx) => {
    const p = c.paras[idx] || newPara('');
    p.style = pEl.dataset.style || 'normal';
    p.level = parseInt(pEl.dataset.level || '0', 10) || 0;
    p.align = pEl.dataset.align || null;
    p.tags = pEl.dataset.tags ? pEl.dataset.tags.split(',').filter(Boolean) : [];
    p.checked = pEl.dataset.checked === '1';
    p.bullet = pEl.className.includes('bu-char') ? 'char' : pEl.className.includes('bu-auto') ? 'num' : 'none';
    p.runs = [];
    const base = { ...BASE_FONT };
    const walk = (node, st) => {
      if (node.nodeType === 3) {
        if (node.nodeValue.length) p.runs.push(cleanRun({ t: node.nodeValue, ...st }));
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.classList && node.classList.contains('ptag')) return;
      if (node.tagName === 'BR') { p.runs.push(cleanRun({ t: '\n', ...st })); return; }
      const ns = { ...st };
      const sty = node.style || {};
      if (node.tagName === 'B' || node.tagName === 'STRONG' || sty.fontWeight === 'bold' || sty.fontWeight === '700') ns.b = true;
      if (node.tagName === 'I' || node.tagName === 'EM' || sty.fontStyle === 'italic') ns.i = true;
      if (node.tagName === 'U' || (sty.textDecoration || '').includes('underline')) ns.u = true;
      if (node.tagName === 'S' || node.tagName === 'STRIKE' || (sty.textDecoration || '').includes('line-through')) ns.strike = true;
      if (node.tagName === 'SUB') ns.sub = true;
      if (node.tagName === 'SUP') ns.sup = true;
      if (sty.color) ns.color = rgbToHex(sty.color);
      if (sty.backgroundColor && sty.backgroundColor !== 'transparent') ns.hl = rgbToHex(sty.backgroundColor);
      if (sty.fontFamily) ns.font = sty.fontFamily.replace(/^['"]|['"].*$/g, '');
      if (sty.fontSize) { const m = /^([\d.]+)pt/.exec(sty.fontSize); if (m) ns.size = parseFloat(m[1]); }
      if (node.dataset && node.dataset.link) ns.link = node.dataset.link;
      Array.from(node.childNodes).forEach(kid => walk(kid, ns));
    };
    Array.from(pEl.childNodes).forEach(kid => walk(kid, base));
    // merge \n runs into previous
    const merged = [];
    p.runs.forEach(r => {
      if (r.t === '\n' && merged.length) merged[merged.length - 1].t += '\n';
      else merged.push(r);
    });
    p.runs = merged.length ? merged.filter(r => r.t.length || !merged.length) : [newRun('')];
    if (!p.runs.length) p.runs = [newRun('')];
    p.runs = p.runs.filter(r => r.t.length);
    if (!p.runs.length) p.runs = [newRun('')];
    paras.push(p);
  });
  // contenteditable may have produced bare divs (no p) — harvest them
  if (!paras.length) {
    const t = txtEl.innerText.replace(/\n+$/g, '');
    paras.push(...t.split('\n').map(l => newPara(l)));
  }
  c.paras = paras;
  if (c.title) syncTitle(c);
}
function cleanRun(r) {
  Object.keys(r).forEach(k => { if (r[k] === false || r[k] == null || r[k] === '') delete r[k]; });
  return r;
}

/* ---------------- status / misc ---------------- */
function sbMsg(t) { /* OneNote has no status bar: show toast-lite via title flash + console slot */
  const d = $('#sb-dismiss');
}
function msgBox(text, opts) { if (ON.dlg) return ON.dlg(opts && opts.opts || { title: opts && opts.title || 'OneNote', bodyText: text, buttons: opts && opts.buttons || [{ label: 'OK', pri: true }] }); }

/* ---------------- QAT, min/max/close, ribbon toggle ---------------- */
function initQat() {
  const q = $('#qat');
  q.innerHTML =
    `<span class="a2pill" id="autosave-pill" title="AutoSave">AutoSave <b>On</b></span>` +
    `<span class="qb" data-q="save" title="Save (Ctrl+S)">${svgIcon('qatSave', 15)}</span>` +
    `<span class="qb off" data-q="undo" title="Undo (Ctrl+Z)">${svgIcon('undo', 15)}</span>` +
    `<span class="qb off" data-q="redo" title="Redo (Ctrl+Y)">${svgIcon('redo', 15)}</span>`;
  $('#qat [data-q="save"]').addEventListener('mousedown', e => { e.preventDefault(); ON.snapshotVersion && ON.snapshotVersion(); persistNb(); ON.sbMsg && ON.sbMsg('All changes saved'); });
  $('#qat [data-q="undo"]').addEventListener('mousedown', e => { e.preventDefault(); doUndo(); });
  $('#qat [data-q="redo"]').addEventListener('mousedown', e => { e.preventDefault(); doRedo(); });
  $('#win-min').innerHTML = svgIcon('min', 13);
  $('#win-max').innerHTML = svgIcon('max', 13);
  $('#win-close').innerHTML = svgIcon('closeW', 13);
  $('#tb-ribbon-toggle').innerHTML = svgIcon('chevU', 13);
  $('#win-min').addEventListener('click', () => ON.sbMsg && ON.sbMsg('Minimize is a window-shell action — simulated here.'));
  $('#win-max').addEventListener('click', toggleMax);
  $('#win-close').addEventListener('click', ON.closeApp ? () => ON.closeApp() : () => {});
  $('#tb-ribbon-toggle').addEventListener('click', toggleRibbon);
  $('#tb-user').addEventListener('click', () => ON.openBackstage && ON.openBackstage('account'));
  $('#tb-user').innerHTML = svgIcon('user', 13) + '<span>User</span>';
}
function toggleMax() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
function toggleRibbon() { $('#ribbon').classList.toggle('off'); $('#tb-ribbon-toggle').innerHTML = svgIcon($('#ribbon').classList.contains('off') ? 'chevD' : 'chevU', 13); ON.layout ? ON.layout() : renderCanvas(); }

/* ---------------- keyboard (stage-scope) ---------------- */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#ctx-root .ctxmenu')) { ON.closeCtxMenu && ON.closeCtxMenu(); return; }
    if (e.key === 'Escape' && !$('#search-ovl').hidden) { ON.closeSearch && ON.closeSearch(); return; }
    const inText = e.target.closest('#cdivs, .dlg, .pop, .ctxmenu, #sidepane, input, select, textarea, #tellme, #search-ovl');
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key;
      if (k === 's' || k === 'S') { e.preventDefault(); ON.snapshotVersion && ON.snapshotVersion(); persistNb(); ON.sbMsg && ON.sbMsg('All changes saved'); return; }
      if (k === 'e' || k === 'E') { e.preventDefault(); ON.openSearch && ON.openSearch(); return; }
      if (k === 'n' || k === 'N') { e.preventDefault(); addPage(); return; }
      if (k === 't' || k === 'T') {
        if (e.shiftKey) return;
        e.preventDefault(); addSection(); return;
      }
      if (k === 'd' || k === 'D') { if (state.sel.cis.length && !inText) { e.preventDefault(); dupSelection(); return; } }
      if (k === '1' && e.altKey) { e.preventDefault(); toggleTagSel('todo'); return; }
    }
    if (e.altKey && !e.ctrlKey && ['1', '2', '3'].includes(e.key)) {
      e.preventDefault(); toggleTagSel({ '1': 'todo', '2': 'important', '3': 'question' }[e.key]); return;
    }
    if (e.key === 'F7') { e.preventDefault(); ON.runSpelling && ON.runSpelling(); return; }
    if (e.key === 'F1' && e.ctrlKey) { e.preventDefault(); toggleRibbon(); return; }
    if (e.key === 'F11') { e.preventDefault(); toggleMax(); return; }
    if (inText) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (state.lassoSel && state.lassoSel.length) { ON.deleteLassoSel && ON.deleteLassoSel(); return; }
      deleteSelection(); return;
    }
    if (e.key === 'Escape') {
      if (state.lassoSel) { ON.clearLasso && ON.clearLasso(); return; }
      if (state.draw.mode) { ON.setDrawMode && ON.setDrawMode(null); return; }
      state.sel.cis = []; endEdit(true); selOnly(); return;
    }
    if (state.sel.cis.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      pushHistoryQuiet('Move objects');
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      const m = e.shiftKey ? 10 : 1;
      selContainers().forEach(c => { c.x = Math.max(0, c.x + d[0] * m); c.y = Math.max(0, c.y + d[1] * m); });
      markDirty(); requestRender(); return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      if ((e.key === 'z' || e.key === 'Z')) { e.preventDefault(); doUndo(); return; }
      if ((e.key === 'y' || e.key === 'Y')) { e.preventDefault(); doRedo(); return; }
      if ((e.key === 'a' || e.key === 'A')) { e.preventDefault(); const p = curPg(); if (p) state.sel.cis = p.containers.map(c => c.id); selOnly(); return; }
    }
    // typing on a selected container starts edit
    if (state.sel.cis.length === 1 && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const c = containerById(state.sel.cis[0]);
      if (c && c.kind === 'text') {
        e.preventDefault();
        pushHistory('Text');
        c.paras = [newPara(e.key)];
        renderCanvas();
        startTextEdit(c.id, true);
      } else if (c && c.kind === 'pic') { ON.replacePicture && ON.replacePicture(c); }
      return;
    }
  });
}
function toggleTagSel(k) {
  if (editing) { toggleTagAtCaret(k); return; }
  const c = containerById(state.sel.cis[0]);
  if (!c || c.kind !== 'text') { ON.sbMsg && ON.sbMsg('Click into text to add a tag'); return; }
  pushHistory('Tag');
  c.paras.forEach(p => { p.tags = p.tags && p.tags[0] === k ? [] : [k]; });
  markDirty(); renderCanvas();
}

/* tag checkbox clicks (delegate) */
document.addEventListener('mousedown', e => {
  const tg = e.target.closest && e.target.closest('.ptag.todo');
  if (!tg) return;
  e.preventDefault(); e.stopPropagation();
  const pEl = tg.closest('p[data-idx]');
  const txtEl = tg.closest('.oc-txt');
  if (!pEl || !txtEl) return;
  const c = containerById(txtEl.dataset.txt); if (!c) return;
  const idx = parseInt(pEl.dataset.idx, 10);
  const p = c.paras[idx]; if (!p) return;
  pushHistory('Toggle to-do');
  p.checked = !p.checked;
  tg.classList.toggle('checked', !!p.checked);
  pEl.dataset.checked = p.checked ? '1' : '';
  markDirty();
}, true);

/* ---------------- resize ---------------- */
window.addEventListener('resize', debounce(renderCanvas, 120));

/* ---------------- exports ---------------- */
Object.assign(window.ON, {
  state, curNb, curSec, curPg, ensurePage,
  lib, setLib, loadNb, persistNb, markDirty, session,
  newNotebook, newSection, newPage, newContainer, newPara, newRun, newTableContainer,
  selectSection, selectPage, addSection, addGroup, addPage, deletePage,
  containerById, pageById, selContainers, selectContainer, deleteSelection, dupSelection,
  startTextEdit, endEdit, onEditInput, caretParaIdx, paraHTML, parasToHTML,
  applyRunStyleToggle, applyBulletToggle, applyAlign, applyParaStyle, applyFontRun, clearFormatting,
  toggleTagAtCaret, indentPara, outdentPara, rerenderEditText, splitParaAtCaret,
  pushHistory, pushNow, doUndo, doRedo,
  renderAll, requestRender, renderCanvas, renderStrip, renderPages, renderInkLayer, renderSelOverlay,
  pagePoint, extentOf, plainTextOf, objTextEmpty, syncTitle,
  ACCENT, NB_COLORS, SEC_COLORS, FONTS, SIZES, STYLES, STYLES_LIST, TAGS,
  el, $, $$, esc, clamp, uid, fmtKB, fmtDT, debounce, rgbToHex, svgIcon: window.svgIcon,
  strokePath, selOnly, grpOf, secUnlocked, tagGlyphHTML,
  sbMsg: t => { const m = document.getElementById('sb-msg'); if (m) m.textContent = t; },
});
window.ON._parasToHTML = parasToHTML;
window.ON._renderParas = parasToHTML;
window.ON.clearHist = clearHist;
window.ON.initCore = function () {
  clearHist();
  ensurePage();
  initCanvas(); initQat(); initKeyboard();
  renderAll();
};

/* exposed for theme toggles (dark paper re-render) */
window.ON.renderCanvas = renderCanvas;
