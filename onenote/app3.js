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
   app3.js — Draw tab engine: pen drawer, ink strokes, erasers, lasso select,
   insert shapes, and ink-to-shape conversion. Pure pointer/mouse SVG ink.
   ========================================================================== */
'use strict';
(function () {
  const ON = window.ON;
  const $ = ON.$, $$ = ON.$$, el = ON.el, svgIcon = ON.svgIcon, clamp = ON.clamp, uid = ON.uid;
  const state = ON.state;

  /* ---------------- pen drawer (persisted) ---------------- */
  function defaultPens() {
    return [
      { kind: 'pen', color: '#000000', w: 1.6, name: 'Pen' },
      { kind: 'pen', color: '#000000', w: 3.2, name: 'Pen' },
      { kind: 'hi', color: '#FFFF00', w: 12, name: 'Highlighter' },
    ];
  }
  function pens() {
    if (!state.pens || !Array.isArray(state.pens) || !state.pens.length) { state.pens = defaultPens(); state.draw.penIdx = 0; }
    return state.pens;
  }
  function savePens() { try { XKV.set('oc.pens', JSON.stringify(state.pens)); } catch (e) { } }
  function curPen() {
    const ps = pens();
    const i = clamp(state.draw.penIdx == null ? 0 : state.draw.penIdx, 0, ps.length - 1);
    state.draw.penIdx = i;
    return ps[i];
  }
  function penGlyph(p) {
    if (p.kind === 'hi') {
      return `<svg width="26" height="22" viewBox="0 0 26 22"><path d="M3 18 Q8 6 13 12 T23 4" fill="none" stroke="${p.color}" stroke-width="7" stroke-opacity="0.55" stroke-linecap="round"/></svg>`;
    }
    const gw = clamp(p.w * 0.9 + 0.8, 1.4, 5);
    return `<svg width="26" height="22" viewBox="0 0 26 22"><path d="M3 18 Q8 6 13 12 T23 4" fill="none" stroke="${p.color}" stroke-width="${gw}" stroke-linecap="round"/></svg>`;
  }
  function penTile(p, i) {
    const on = state.draw.mode === 'pen' && state.draw.penIdx === i;
    const t = el('span', { class: 'pn-sw' + (on ? ' on' : ''), 'data-pen': i, title: p.name + (p.kind === 'hi' ? ' — click to draw, caret to customize' : ' — click to draw, caret to customize') });
    t.innerHTML = `<span class="pn-g">${penGlyph(p)}</span><span class="pn-cr">${svgIcon('chevD', 9)}</span>`;
    t.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const r = t.getBoundingClientRect();
      if (e.clientY > r.bottom - 12 || e.target.closest('.pn-cr')) { penOptsPop(t, i); return; }
      state.draw.penIdx = i;
      ON.setDrawMode('pen');
    });
    return t;
  }
  const PEN_THICKS = [1.6, 2.4, 3.2, 4.4, 6];
  const HI_THICKS = [8, 12, 16, 20];
  const PEN_COLORS = ['#000000', '#404040', '#C00000', '#E36C09', '#FFC000', '#4F81BD', '#0078D7', '#00B050', '#7719AA', '#FF6699', '#FFFFFF'];
  const HI_COLORS = ['#FFFF00', '#92D050', '#00B0F0', '#FF99CC', '#FFC000', '#B4A7D6', '#FF6666', '#FF9900'];
  function penOptsPop(anchor, i) {
    const p = pens()[i]; if (!p) return;
    const node = el('div', { style: 'padding:8px 10px;width:210px' });
    node.appendChild(el('div', { style: 'font-weight:600;font-size:12px;margin-bottom:6px' }, p.name + ' — ' + (p.kind === 'hi' ? 'Highlighter' : 'Pen')));
    node.appendChild(el('div', { style: 'font-size:11px;color:#605E5C;margin:2px 0 4px' }, 'Thickness'));
    const tr = el('div', { style: 'display:flex;gap:5px;margin-bottom:8px' });
    (p.kind === 'hi' ? HI_THICKS : PEN_THICKS).forEach(w => {
      const b = el('span', {
        style: `width:30px;height:24px;border:1px solid ${p.w === w ? '#7719AA' : '#D2D0CE'};display:flex;align-items:center;justify-content:center;cursor:pointer;background:${p.w === w ? '#EEE6F6' : '#fff'}`,
        html: `<span style="display:inline-block;width:16px;background:#323130;height:${clamp(w / 2 + (p.kind === 'hi' ? 3 : 0.6), 1, 12)}px;border-radius:2px;${p.kind === 'hi' ? 'opacity:.5' : ''}"></span>`
      });
      b.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); p.w = w; savePens(); ON.closeAllPops(); updatePensUI(); });
      tr.appendChild(b);
    });
    node.appendChild(tr);
    node.appendChild(el('div', { style: 'font-size:11px;color:#605E5C;margin:2px 0 4px' }, 'Color'));
    const cr = el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px' });
    (p.kind === 'hi' ? HI_COLORS : PEN_COLORS).forEach(c => {
      const s = el('span', {
        style: `width:20px;height:20px;border-radius:2px;border:1px solid ${p.color.toUpperCase() === c.toUpperCase() ? '#7719AA' : '#C8C6C4'};background:${c};cursor:pointer;${p.kind === 'hi' ? 'opacity:.75' : ''}`
      });
      s.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); p.color = c; savePens(); ON.closeAllPops(); updatePensUI(); });
      cr.appendChild(s);
    });
    node.appendChild(cr);
    if (pens().length > 1) {
      const del = el('button', { class: 'btn', style: 'margin-top:10px' }, 'Delete This Pen');
      del.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        state.pens.splice(i, 1);
        if (state.draw.penIdx >= state.pens.length) state.draw.penIdx = state.pens.length - 1;
        savePens(); ON.closeAllPops(); updatePensUI();
      });
      node.appendChild(del);
    }
    ON.pop(anchor, node);
  }
  function updateDrawBtns() {
    const m = state.draw.mode;
    const set = (id, on) => { const b = $('#rb-' + id); if (b) b.classList.toggle('on', !!on); };
    set('drselect', !m);
    set('drlasso', m === 'lasso');
    set('dreraser', m === 'eraser' || m === 'eraser-stroke');
    set('drinkshape', !!state.draw.inkShape);
    set('drshapes', (m || '').startsWith('shape:'));
  }
  ON.toggleInkShape = function () {
    state.draw.inkShape = !state.draw.inkShape;
    updateDrawBtns();
    ON.toast && ON.toast(state.draw.inkShape ? 'Ink to Shape on — drew shapes snap clean' : 'Ink to Shape off');
  };
  ON.setDrawMode = function (mode, opt) {
    if (mode === 'eraser') state.draw.eraserR = opt || state.draw.eraserR || 9;
    if (mode === 'eraser-stroke') state.draw.eraserR = 2.2;
    if (mode !== 'lasso' && state.lassoSel) ON.clearLasso();
    state.draw.mode = mode;
    const ink = $('#ink'); if (ink) ink.dataset.mode = mode || '';
    ON.renderInkLayer();
    updateDrawBtns();
    ON.updatePensUI && ON.updatePensUI();
    if (mode === 'lasso') ON.toast && ON.toast('Drag a loop around ink to select it');
  };
  ON.updatePensUI = function () {
    const host = $('#pens-strip'); if (!host) return;
    pens();
    host.innerHTML = '';
    state.pens.forEach((p, i) => host.appendChild(penTile(p, i)));
    const add = el('span', { class: 'pn-sw pn-add', title: 'Add Pen', style: 'width:24px' });
    add.innerHTML = `<span class="pn-g">${svgIcon('plus', 13)}</span><span class="pn-cr">${svgIcon('chevD', 9)}</span>`;
    add.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      ON.pop(add, ON.menu([
        { hdr: 'Add to Drawer' },
        { label: 'Pen', icon: 'pen', fn: () => { state.pens.push({ kind: 'pen', color: '#000000', w: 3.2, name: 'Pen' }); state.pens[state.pens.length - 1].color = PEN_COLORS[state.pens.length % PEN_COLORS.length]; savePens(); updatePensUI(); } },
        { label: 'Highlighter', icon: 'highlight', fn: () => { state.pens.push({ kind: 'hi', color: '#FFFF00', w: 12, name: 'Highlighter' }); savePens(); updatePensUI(); } },
      ]));
    });
    host.appendChild(add);
    updateDrawBtns();
  };

  /* ---------------- shared geometry ---------------- */
  function perpDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    if (!L2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.sqrt(L2);
  }
  ON.shapeD = function (st) {
    const a = st.pts[0], b = st.pts[1];
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    switch (st.shape) {
      case 'rect': return `M${x1},${y1} H${x2} V${y2} H${x1} Z`;
      case 'ellipse': return `M${x1},${cy} A${(w / 2).toFixed(2)},${(h / 2).toFixed(2)} 0 1 0 ${x2},${cy} A${(w / 2).toFixed(2)},${(h / 2).toFixed(2)} 0 1 0 ${x1},${cy} Z`;
      case 'triangle': return `M${cx},${y1} L${x2},${y2} L${x1},${y2} Z`;
      case 'line': return `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
      case 'arrow': {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const L = clamp(Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.22, 7, 16);
        const w1 = ang + Math.PI * 0.84, w2 = ang - Math.PI * 0.84;
        return `M${a[0]},${a[1]} L${b[0]},${b[1]} M${(b[0] + L * Math.cos(w1)).toFixed(1)},${(b[1] + L * Math.sin(w1)).toFixed(1)} L${b[0]},${b[1]} L${(b[0] + L * Math.cos(w2)).toFixed(1)},${(b[1] + L * Math.sin(w2)).toFixed(1)}`;
      }
    }
    return '';
  };
  function shapeSample(st) {
    const a = st.pts[0], b = st.pts[1];
    const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, pts = [];
    const lerpN = (p, q, n) => { for (let i = 0; i <= n; i++) pts.push([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]); };
    if (st.shape === 'line' || st.shape === 'arrow') { lerpN(a, b, 14); return pts; }
    if (st.shape === 'rect') { lerpN([x1, y1], [x2, y1], 8); lerpN([x2, y1], [x2, y2], 8); lerpN([x2, y2], [x1, y2], 8); lerpN([x1, y2], [x1, y1], 8); return pts; }
    if (st.shape === 'triangle') { lerpN([cx, y1], [x2, y2], 10); lerpN([x2, y2], [x1, y2], 10); lerpN([x1, y2], [cx, y1], 10); return pts; }
    for (let i = 0; i < 30; i++) { const t = i / 30 * 2 * Math.PI; pts.push([cx + (x2 - x1) / 2 * Math.cos(t), cy + (y2 - y1) / 2 * Math.sin(t)]); }
    return pts;
  }
  function samplePts(st) { return st.kind === 'shape' ? shapeSample(st) : (st.pts || []); }
  function segPtDist(q, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    if (!L2) return Math.hypot(q[0] - a[0], q[1] - a[1]);
    let t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy));
  }
  function strokeHitDist(st, q) {
    if (st.kind === 'shape') return Math.min.apply(null, samplePts(st).map(p => Math.hypot(p[0] - q[0], p[1] - q[1])));
    const pts = st.pts || [];
    let m = Infinity;
    for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segPtDist(q, pts[i], pts[i + 1]));
    if (pts.length) m = Math.min(m, Math.hypot(pts[pts.length - 1][0] - q[0], pts[pts.length - 1][1] - q[1]));
    return m;
  }

  /* ---------------- stroke lifecycle ---------------- */
  let act = null;          // active gesture
  function inkHist(label) {
    const nb = ON.curNb();
    if (nb && !nb._seedGuard) { ON.pushHistory(label); return; }
    ON.pushNow(label);
  }
  function livePath(st) {
    const svg = $('#ink');
    const n = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    n.setAttribute('fill', 'none');
    n.setAttribute('stroke', st.mode === 'hi' ? st.color : st.color);
    n.setAttribute('stroke-width', st.w);
    n.setAttribute('stroke-linecap', 'round'); n.setAttribute('stroke-linejoin', 'round');
    if (st.mode === 'hi') n.setAttribute('stroke-opacity', '0.55');
    if (st.kind === 'lasso') { n.setAttribute('stroke', '#0078D7'); n.setAttribute('stroke-width', '1.5'); n.setAttribute('stroke-dasharray', '5 3'); }
    svg.appendChild(n);
    return n;
  }
  function bindGesture() {
    const mv = e => { if (act) act.move(ON.pagePoint(e), e); };
    const up = e => {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      const a = act; act = null;
      if (a) a.up(ON.pagePoint(e));
    };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  }
  ON.inkDown = function (e) {
    if (e.button !== 0) return;
    const mode = state.draw.mode; if (!mode) return;
    const p = ON.curPg(); if (!p || !ON.secUnlocked()) return;
    e.preventDefault(); e.stopPropagation();
    ON.endEdit(true);
    const pt = ON.pagePoint(e);
    if (mode === 'eraser' || mode === 'eraser-stroke') {
      const g = { pushed: false };
      act = {
        kind: 'erase', g,
        move: q => { eraseAt(q, state.draw.eraserR || 2.2, g); },
        up: () => { }
      };
      act.move(pt);
      bindGesture();
      return;
    }
    if (mode === 'lasso') {
      const st = { id: uid(), kind: 'lasso', pts: [[pt.x, pt.y]] };
      const node = livePath(st);
      if (state.lassoSel) ON.clearLasso(true);
      act = {
        kind: 'lasso', st, node,
        move: q => { const l = st.pts[st.pts.length - 1]; if (Math.hypot(q.x - l[0], q.y - l[1]) > 1.5) { st.pts.push([q.x, q.y]); node.setAttribute('d', ON.strokePath(st.pts)); } },
        up: () => { node.remove(); finishLasso(st.pts); }
      };
      bindGesture();
      return;
    }
    if (mode.startsWith('shape:')) {
      const shape = mode.slice(6);
      const st = { id: uid(), kind: 'shape', shape, color: curPen().color, w: Math.max(curPen().w, 1.6), pts: [[pt.x, pt.y], [pt.x, pt.y]] };
      const node = livePath(st);
      inkHist('Insert shape');
      act = {
        kind: 'shape', st, node,
        move: q => { st.pts[1] = [q.x, q.y]; node.setAttribute('d', ON.shapeD(st)); },
        up: () => {
          node.remove();
          const w = Math.abs(st.pts[1][0] - st.pts[0][0]), h = Math.abs(st.pts[1][1] - st.pts[0][1]);
          const bigEnough = (shape === 'line' || shape === 'arrow') ? Math.hypot(w, h) > 6 : (w > 5 && h > 5);
          if (bigEnough) { p.ink = p.ink || []; p.ink.push(st); ON.markDirty(); }
          ON.renderInkLayer();
        }
      };
      bindGesture();
      return;
    }
    /* pen / highlighter */
    const pn = curPen();
    const st = { id: uid(), kind: 'ink', mode: pn.kind === 'hi' ? 'hi' : 'pen', color: pn.color, w: pn.w, pts: [[pt.x, pt.y]] };
    const node = livePath(st);
    inkHist('Ink');
    act = {
      kind: 'ink', st, node,
      move: q => { const l = st.pts[st.pts.length - 1]; if (Math.hypot(q.x - l[0], q.y - l[1]) > 1.4) { st.pts.push([q.x, q.y]); node.setAttribute('d', ON.strokePath(st.pts)); } },
      up: () => {
        node.remove();
        p.ink = p.ink || [];
        if (state.draw.inkShape && st.mode === 'pen') {
          const conv = inkToShape(st.pts);
          if (conv) { st.kind = 'shape'; st.shape = conv.shape; st.pts = conv.pts; }
        }
        p.ink.push(st);
        ON.markDirty(); ON.renderInkLayer();
      }
    };
    bindGesture();
  };
  function eraseAt(pt0, r, g) {
    const pt = [pt0.x != null ? pt0.x : pt0[0], pt0.y != null ? pt0.y : pt0[1]];
    const p = ON.curPg(); if (!p || !p.ink || !p.ink.length) return false;
    const before = p.ink.length;
    const hitR = st => strokeHitDist(st, pt);
    const kept = p.ink.filter(st => hitR(st) > r + (st.w || 2) / 2);
    if (kept.length === before) return false;
    if (g && !g.pushed) { inkHist('Erase'); g.pushed = true; }
    if (state.lassoSel) { state.lassoSel = null; hideLassoOv(); }
    p.ink = kept;
    ON.markDirty(); ON.renderInkLayer();
    return true;
  }

  /* ---------------- ink to shape ---------------- */
  function inkToShape(pts) {
    if (!pts || pts.length < 8) return null;
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    pts.forEach(q => { x1 = Math.min(x1, q[0]); y1 = Math.min(y1, q[1]); x2 = Math.max(x2, q[0]); y2 = Math.max(y2, q[1]); });
    const w = x2 - x1, h = y2 - y1;
    if (Math.max(w, h) < 22) return null;
    const first = pts[0], last = pts[pts.length - 1];
    const segLen = Math.hypot(last[0] - first[0], last[1] - first[1]);
    // 1) straight stroke -> line
    if (segLen > 18) {
      let maxDev = 0;
      for (const q of pts) maxDev = Math.max(maxDev, perpDist(q, first, last));
      if (maxDev < Math.max(6, 0.045 * segLen)) return { shape: 'line', pts: [[first[0], first[1]], [last[0], last[1]]] };
    }
    const diag = Math.hypot(w, h) || 1;
    if (segLen > diag * 0.42) return null; // open non-straight squiggle: keep as ink
    // 2) corner detection (wraparound-aware for closed strokes): deviation ratio > 0.22
    const n = pts.length;
    const win = Math.max(3, Math.round(n / 9));
    const dup = Math.hypot(pts[n - 1][0] - pts[0][0], pts[n - 1][1] - pts[0][1]) < diag * 0.08;
    const open = dup ? pts.slice(0, n - 1) : pts.slice();
    const m = open.length;
    const cands = [];
    for (let i = 0; i < m; i++) {
      const a = open[(i - win + m) % m], b2 = open[(i + win) % m];
      const chord = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1;
      const mx = (a[0] + b2[0]) / 2, my = (a[1] + b2[1]) / 2;
      const dev = Math.hypot(open[i][0] - mx, open[i][1] - my) / chord;
      if (dev > 0.22) cands.push({ i, dev });
    }
    cands.sort((a, b) => b.dev - a.dev);
    const chosen = [];
    for (const c of cands) {
      if (chosen.every(o => { const d = Math.abs(o.i - c.i); return Math.min(d, m - d) > win; })) chosen.push(c);
    }
    const corners = chosen.length;
    // 3) circularity
    let A = 0, P = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      A += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      P += Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    }
    A = Math.abs(A) / 2;
    const circ = P > 0 ? 4 * Math.PI * A / (P * P) : 0;
    let shape;
    if (corners <= 2) shape = circ > 0.6 ? 'ellipse' : 'rect';
    else if (corners === 3) shape = circ > 0.72 ? 'rect' : 'triangle';
    else shape = circ > 0.86 ? 'ellipse' : 'rect';
    return { shape, pts: [[x1, y1], [x2, y2]] };
  }
  ON._inkToShape = inkToShape; // exposed for tests

  /* ---------------- lasso select ---------------- */
  function ptInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function finishLasso(poly) {
    const p = ON.curPg(); if (!p) return;
    if (!p.ink || poly.length < 5) { state.lassoSel = null; ON.renderInkLayer(); return; }
    const ids = p.ink.filter(st => samplePts(st).some(q => ptInPoly(q[0], q[1], poly))).map(st => st.id);
    if (!ids.length) { state.lassoSel = null; ON.toast && ON.toast('No ink inside the loop'); ON.renderInkLayer(); return; }
    state.lassoSel = ids;
    ON.renderInkLayer();
    showLassoOv();
  }
  function lassoBBox() {
    const p = ON.curPg(); if (!p) return null;
    const set = new Set(state.lassoSel || []);
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9, found = false;
    (p.ink || []).filter(st => set.has(st.id)).forEach(st => samplePts(st).concat(st.pts || []).forEach(q => {
      found = true; x1 = Math.min(x1, q[0]); y1 = Math.min(y1, q[1]); x2 = Math.max(x2, q[0]); y2 = Math.max(y2, q[1]);
    }));
    if (!found) return null;
    const pad = 8;
    return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
  }
  function showLassoOv() {
    hideLassoOv();
    const bb = lassoBBox(); if (!bb) { ON.clearLasso(); return; }
    const ov = el('div', { id: 'lasso-ov', class: 'lasso-ov', style: `left:${bb.x}px;top:${bb.y}px;width:${bb.w}px;height:${bb.h}px` });
    const bar = el('div', { class: 'lasso-bar' },
      el('span', { class: 'lb' }, 'Ink selected'),
      el('span', { class: 'b', title: 'Delete selected ink (Del)', html: svgIcon('x', 12) }),
      el('span', { class: 'b ok', title: 'Done (Esc)', html: svgIcon('check', 12) }));
    bar.children[1].addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); ON.deleteLassoSel(); });
    bar.children[2].addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); ON.clearLasso(); });
    ov.appendChild(bar);
    ov.addEventListener('mousedown', e => {
      if (e.target.closest('.lasso-bar .b')) return;
      e.preventDefault(); e.stopPropagation();
      inkHist('Move ink');
      const start = ON.pagePoint(e);
      const p = ON.curPg(); const set = new Set(state.lassoSel);
      const orig = p.ink.filter(st => set.has(st.id)).map(st => JSON.parse(JSON.stringify(st.pts)));
      const mv = ev => {
        const q = ON.pagePoint(ev);
        const dx = q.x - start.x, dy = q.y - start.y;
        let i = 0;
        p.ink.forEach(st => {
          if (!set.has(st.id)) return;
          const src = orig[i++];
          st.pts = src.map(pp => [pp[0] + dx, pp[1] + dy]);
        });
        ov.style.left = (bb.x + dx) + 'px'; ov.style.top = (bb.y + dy) + 'px';
        ON.renderInkLayer();
      };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); ON.markDirty(); ON.renderInkLayer(); };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
    $('#page').appendChild(ov);
  }
  function hideLassoOv() { const o = $('#lasso-ov'); if (o) o.remove(); }
  ON.clearLasso = function (noRender) {
    state.lassoSel = null;
    hideLassoOv();
    if (!noRender) ON.renderInkLayer();
  };
  ON.deleteLassoSel = function () {
    const p = ON.curPg(); if (!p || !state.lassoSel) return;
    inkHist('Delete ink');
    const set = new Set(state.lassoSel);
    p.ink = (p.ink || []).filter(st => !set.has(st.id));
    state.lassoSel = null;
    hideLassoOv();
    ON.markDirty(); ON.renderInkLayer();
  };

  /* ---------------- init ---------------- */
  ON.initInk = function () {
    pens();
    savePens();
    updateDrawBtns();
  };
})();
