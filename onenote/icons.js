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
   icons.js — hand-drawn SVG icon library for the OneNote clone
   Every icon is real SVG geometry (paths/strokes). No emoji, no fonts.
   svgIcon('name', size?) -> inline <svg> markup
   ========================================================================== */
'use strict';
(function () {
  const C = 'currentColor';
  const S = (d, w) => `<path d="${d}" fill="none" stroke="${C}" stroke-width="${w || 1.7}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const F = (d, fill) => `<path d="${d}" fill="${fill || C}"/>`;
  const M = (attrs, body) => ({ svg: false, body });
  const IC = {
    // ---- app / window chrome ----
    onenote: { body: `<rect width="24" height="24" rx="4" fill="#7719AA"/><text x="12" y="17.5" font-family="Segoe UI" font-weight="600" font-size="14" fill="#fff" text-anchor="middle">N</text>`, w: 24, h: 24 },
    undo: { body: S('M7 5 L3 9 L7 13') + S('M3 9 H15 A6 6 0 0 1 15 21 H11') },
    redo: { body: S('M17 5 L21 9 L17 13') + S('M21 9 H9 A6 6 0 0 0 9 21 H13') },
    qatSave: { body: F('M4.5 3.5 H17.5 L20.5 6.5 V19 A1.5 1.5 0 0 1 19 20.5 H5 A1.5 1.5 0 0 1 3.5 19 V5 A1.5 1.5 0 0 1 5 3.5 Z M7 3.5 V9 H16 V3.5 M6.8 12 H17.2 V20.3 H6.8 Z') + `<rect x="8" y="13.4" width="8" height="1.6" fill="#fff"/>` },
    min: { body: S('M4 18 H20', 2.4) },
    max: { body: `<rect x="5" y="5" width="14" height="14" rx="1.4" fill="none" stroke="${C}" stroke-width="2"/>` },
    closeW: { body: S('M5.5 5.5 L18.5 18.5 M18.5 5.5 L5.5 18.5', 2.2) },
    user: { body: S('M12 12.5 A4.2 4.2 0 1 0 12 4.1 A4.2 4.2 0 0 0 12 12.5 Z') + S('M3.8 21 C4.6 15.7 8 13.9 12 13.9 C16 13.9 19.4 15.7 20.2 21') },
    chevD: { body: S('M6 9.5 L12 15.5 L18 9.5', 2) },
    chevU: { body: S('M6 14.5 L12 8.5 L18 14.5', 2) },
    chevL: { body: S('M14.5 6 L8.5 12 L14.5 18', 2) },
    chevR: { body: S('M9.5 6 L15.5 12 L9.5 18', 2) },
    plus: { body: S('M12 4 V20 M4 12 H20', 2.4) },
    tellme: { body: S('M21 12 A8 8 0 0 1 12 20 H4 L6.4 16.4 A8 8 0 1 1 21 12 Z') + `<circle cx="9" cy="11.5" r="1.4" fill="${C}"/><circle cx="14.6" cy="11.5" r="1.4" fill="${C}"/>` },
    search: { body: S('M10.5 4.5 A6 6 0 1 0 10.5 16.5 A6 6 0 0 0 10.5 4.5 Z') + S('M15.2 15.2 L20.5 20.5', 2.4) },

    // ---- clipboard ----
    pasteW: { body: F('M7.8 4.4 Q12 -0.4 16.2 4.4 H18.2 A1.8 1.8 0 0 1 20 6.2 V19 A1.8 1.8 0 0 1 18.2 20.8 H5.8 A1.8 1.8 0 0 1 4 19 V6.2 A1.8 1.8 0 0 1 5.8 4.4 Z M12 2.8 a1.35 1.35 0 1 0 0 2.7 a1.35 1.35 0 0 0 0 -2.7 Z') + `<rect x="6.9" y="7.6" width="10.2" height="10.6" rx="0.8" fill="#fff" stroke="#EDEBE9" stroke-width="0.6"/>` + F('M8.4 9.6 H15.6 V11 H8.4 Z M8.4 12.6 H15.6 V14 H8.4 Z M8.4 15.6 H12.6 V17 H8.4 Z', '#605E5C') },
    cutW: { body: S('M7.2 13.8 L17.8 3.2 M7.2 3.2 L17.8 13.8') + `<circle cx="5.6" cy="16.6" r="2.9" fill="none" stroke="${C}" stroke-width="1.6"/><circle cx="18.4" cy="16.6" r="2.9" fill="none" stroke="${C}" stroke-width="1.6"/>` },
    copyW: { body: F('M9 3.5 H18.5 A1.5 1.5 0 0 1 20 5 V15.5 A1.5 1.5 0 0 1 18.5 17 H9 A1.5 1.5 0 0 1 7.5 15.5 V5 A1.5 1.5 0 0 1 9 3.5 Z M10.2 5.6 V15.4 H18.4 V5.6 Z') + F('M4 7.2 H5.7 V19 H15.3 V20.7 H5.5 A1.5 1.5 0 0 1 4 19.2 Z') },
    fmtPainter: { body: F('M6.5 2.8 H17.5 V7.2 H6.5 Z M10.6 8.6 H13.4 V11.4 A0.8 0.8 0 0 1 12.6 12.2 H11.4 A0.8 0.8 0 0 1 10.6 11.4 Z M11.2 13 H12.8 A1 1 0 0 1 13.8 14 V20 A1.8 1.8 0 0 1 12 21.8 A1.8 1.8 0 0 1 10.2 20 V14 A1 1 0 0 1 11.2 13 Z') },

    // ---- basic text ----
    highlight: { body: F('M5.2 14.2 L12.6 6.8 Q13.4 6 14.2 6.8 L16.2 8.8 Q17 9.6 16.2 10.4 L8.8 17.8 Q8 18.6 7.2 17.8 L5.2 15.8 Q4.4 15 5.2 14.2 Z') + F('M3.5 19.2 H20.5 V21.7 H3.5 Z', '#FFFF00') },
    fontColor: { body: F('M10.2 2.6 H13.8 L19.4 17.9 H16.3 L15.1 14.4 H8.9 L7.7 17.9 H4.6 Z M12 5.9 L9.8 12 H14.2 Z') + F('M3.5 19.2 H20.5 V21.7 H3.5 Z', '#C43E1C') },
    clearFmt: { body: F('M10.9 2.6 H13.1 L18.7 17.9 H15.8 L14.8 14.9 L13.2 11.2 L12 7.7 L10.9 11.2 H8.6 L9.7 13.8 L8.6 15.8 H5.6 L3.6 13.8 L8.4 7.8 L10.9 2.6 Z', '#605E5C') + S('M3.4 17.6 L12.4 17.6', 1.4) + S('M5 20.4 L14 20.4', 1.4) },
    growFont: { body: F('M8.9 3.6 H11.4 L16.6 17 H14.1 L13.3 14.5 H7.7 L6.9 17 H4.6 Z M10.1 7 L8.2 12.1 H12 Z') + F('M19.3 1.4 L22.7 5.4 H20.9 V10 H17.7 V5.4 H15.9 Z', '#0078D7') },
    shrinkFont: { body: F('M8.9 7 H11.4 L16.6 20.4 H14.1 L13.3 17.9 H7.7 L6.9 20.4 H4.6 Z M10.1 10.4 L8.2 15.5 H12 Z') + F('M19.3 10.2 L15.9 6.2 H17.7 V1.4 H20.9 V6.2 H22.7 Z', '#0078D7') },
    boldL: { body: `<text x="6.8" y="17.8" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="16" fill="${C}">B</text>` },
    italicL: { body: `<text x="9.6" y="17.6" font-family="Segoe UI, Arial, sans-serif" font-style="italic" font-size="16" fill="${C}">I</text>` },
    underlineL: { body: `<text x="7" y="16.4" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="${C}">U</text>` + F('M6.4 19.2 H17.6 V21 H6.4 Z') },
    strikeL: { body: `<text x="12" y="16.6" font-family="Segoe UI, Arial, sans-serif" font-size="13.5" text-anchor="middle" fill="${C}">ab</text>` + F('M3.2 11.4 H20.8 V13.1 H3.2 Z') },
    fileIco: { body: S('M6 2.5 H13.8 L18.8 7.5 V21.5 H6 Z', 1.7) + S('M13.8 2.7 V7.5 H18.6', 1.7) + F('M8.4 11 H15.6 V12.3 H8.4 Z M8.4 14.1 H15.6 V15.4 H8.4 Z M8.4 17.2 H13 V18.5 H8.4 Z') },
    bullets: { body: `<circle cx="4.2" cy="6" r="1.7" fill="${C}"/><circle cx="4.2" cy="12" r="1.7" fill="${C}"/><circle cx="4.2" cy="18" r="1.7" fill="${C}"/>` + F('M8.4 5 H20 V7 H8.4 Z M8.4 11 H20 V13 H8.4 Z M8.4 17 H20 V19 H8.4 Z') },
    numbering: { body: `<text x="3" y="8.6" font-family="Segoe UI" font-size="7.4" fill="${C}">1</text><text x="3" y="15" font-family="Segoe UI" font-size="7.4" fill="${C}">2</text>` + F('M8.4 5 H20 V7 H8.4 Z M8.4 11 H20 V13 H8.4 Z M8.4 17 H20 V19 H8.4 Z') },
    indDec: { body: F('M13 5 H21 V7 H13 Z M13 11 H21 V13 H13 Z M13 17 H21 V19 H13 Z') + F('M9.5 12 L3.5 12 M6.5 9 L3.5 12 L6.5 15 Z') + `<circle cx="4.6" cy="18" r="1.5" fill="${C}"/><circle cx="4.6" cy="6" r="1.5" fill="${C}"/>` },
    indInc: { body: F('M11 5 H20 V7 H11 Z M11 11 H20 V13 H11 Z M11 17 H20 V19 H11 Z') + F('M9.5 12 L3.5 12 M6.5 9 L3.5 12 L6.5 15 Z', '#0078D7') + `<circle cx="3.4" cy="18" r="1.5" fill="${C}"/><circle cx="3.4" cy="6" r="1.5" fill="${C}"/>` },
    alignL: { body: F('M3 4 H21 V6 H3 Z M3 8.5 H15 V10.5 H3 Z M3 13 H21 V15 H3 Z M3 17.5 H15 V19.5 H3 Z') },
    alignC: { body: F('M3 4 H21 V6 H3 Z M6 8.5 H18 V10.5 H6 Z M3 13 H21 V15 H3 Z M6 17.5 H18 V19.5 H6 Z') },
    alignR: { body: F('M3 4 H21 V6 H3 Z M9 8.5 H21 V10.5 H9 Z M3 13 H21 V15 H3 Z M9 17.5 H21 V19.5 H9 Z') },
    alignJ: { body: F('M3 4 H21 V6 H3 Z M3 8.5 H21 V10.5 H3 Z M3 13 H21 V15 H3 Z M3 17.5 H21 V19.5 H3 Z') },
    sub: { body: F('M2.5 3 H11.5 L13.6 7 H11.2 L9.4 4.6 H4.4 Z M2.5 17 H11.5 L13.7 13.4 H11.3 L9.5 15.4 H4.6 Z', '#605E5C') + `<text x="14" y="21" font-family="Segoe UI" font-size="11" fill="${C}">2</text>` },
    sup: { body: F('M2.5 3 H11.5 L13.6 7 H11.2 L9.4 4.6 H4.4 Z M2.5 17 H11.5 L13.7 13.4 H11.3 L9.5 15.4 H4.6 Z', '#605E5C') + `<text x="14" y="10" font-family="Segoe UI" font-size="11" fill="${C}">2</text>` },
    stylesMore: { body: S('M5 9.5 L12 16.5 L19 9.5', 2.2) },

    // ---- tags ----
    todo: { body: `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="${C}" stroke-width="1.8"/>` + S('M7 12.4 L10.6 16 L17.5 8.2', 2.2) },
    important: { body: F('M12 2.6 L14.4 8.4 L20.6 8.8 L15.9 13 L17.6 19.2 L12 15.8 L6.4 19.2 L8.1 13 L3.4 8.8 L9.6 8.4 Z') },
    question: { body: `<circle cx="12" cy="12" r="9" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M9.2 9.4 C9.2 7.5 10.5 6.4 12.1 6.4 C13.9 6.4 15 7.5 15 9.1 C15 10.9 13.6 11.1 12.6 12.1 C11.9 12.8 11.9 13.4 11.9 14.2') + `<circle cx="12" cy="17.3" r="1.3" fill="${C}"/>` },
    remember: { body: F('M5.2 12.6 L9 16.2 L9 20.4 L5.7 21.6 L5.7 15.9 L2.4 13 L5.2 12.6 Z') + F('M3 2.5 H20.6 A1.4 1.4 0 0 1 22 3.9 V9.6 L19.2 9.9 V5 H4.4 V21.6 H3 Z') + S('M6.6 7 H12.4 M6.6 10 H11', 1.4) },
    idea: { body: F('M12 2.5 A8 8 0 0 1 20 10.5 A8 8 0 0 1 12 18.5 A8 8 0 0 1 4 10.5 A8 8 0 0 1 12 2.5 Z') },
    password: { body: F('M12 2.5 L14.3 8.2 L20.4 8.6 L15.8 12.8 L17.5 18.9 L12 15.6 L6.5 18.9 L8.2 12.8 L3.6 8.6 L9.7 8.2 Z') + `<rect x="10.3" y="10.4" width="3.4" height="5.6" rx="0.6" fill="#fff"/>` + F('M11.4 10.4 V8.6 A0.6 0.6 0 0 1 12 8 V8 A0.6 0.6 0 0 1 12.6 8.6 V10.4 Z', '#fff') },
    website: { body: `<circle cx="12" cy="12" r="9" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M3.2 9.6 H20.8 M3.2 14.6 H20.8 M12 3 C9 6.4 9 17.6 12 21 M12 3 C15 6.4 15 17.6 12 21', 1.4) },
    call: { body: F('M6.2 2.8 C8 2.6 9.8 6.7 9 7.9 C8.4 8.8 7 9.2 7.6 10.4 C8.2 11.6 12 15.4 13.2 15.9 C14.4 16.4 14.8 15 15.8 14.5 C17 13.9 21 15.7 20.8 17.4 C20.6 19.8 16.6 21.6 14.6 21 C9 19.4 4.2 14.6 2.6 9 C1.8 6.9 3.4 3.1 6.2 2.8 Z') },
    critical: { body: F('M12 2.8 L22 20 H2 Z') + F('M11 8.6 H13 V14.6 H11 Z M11 16 H13 V18.4 H11 Z', '#fff') },
    todo1: { body: `<rect x="4" y="5" width="16" height="16" rx="2" fill="none" stroke="${C}" stroke-width="1.8"/>` + `<text x="12" y="17.4" font-family="Segoe UI" font-weight="600" font-size="12" fill="${C}" text-anchor="middle">1</text>` },
    todo2: { body: `<rect x="4" y="5" width="16" height="16" rx="2" fill="none" stroke="${C}" stroke-width="1.8"/>` + `<text x="12" y="17.4" font-family="Segoe UI" font-weight="600" font-size="12" fill="${C}" text-anchor="middle">2</text>` },
    client: { body: S('M12 11.6 A3.9 3.9 0 1 0 12 3.8 A3.9 3.9 0 0 0 12 11.6 Z') + S('M4.4 20.8 C5.1 15.6 8.3 13.9 12 13.9 C15.7 13.9 18.9 15.6 19.6 20.8') },
    book: { body: S('M4 3.5 H10.5 Q12 3.5 12 5 V20.5 Q12 19 10.5 19 H4 Z M20 3.5 H13.5 Q12 3.5 12 5 V20.5 Q12 19 13.5 19 H20 Z') },
    movie: { body: S('M3.5 5 H20.5 V19 H3.5 Z M7.8 5 L10 9.4 M12.2 5 L14.4 9.4 M16.6 5 L18.8 9.4') + `<circle cx="12" cy="14.6" r="3.4" fill="none" stroke="${C}" stroke-width="1.5"/>` },
    music: { body: S('M9 19 V6.5 L19.5 3.5 V16.5 M9 8.5 L19.5 5.5', 1.6) + `<circle cx="6.4" cy="18.9" r="2.8" fill="none" stroke="${C}" stroke-width="1.6"/><circle cx="16.9" cy="16.4" r="2.8" fill="none" stroke="${C}" stroke-width="1.6"/>` },
    findTags: { body: `<circle cx="10" cy="10" r="5.6" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M14.2 14.6 L20.3 20.7', 2.4) + `<rect x="7.4" y="7.4" width="5.2" height="5.2" rx="0.9" fill="none" stroke="${C}" stroke-width="1.2"/>` + S('M8.6 10 L9.7 11.1 L11.4 9.2', 1.2) },
    removeTags: { body: `<circle cx="12" cy="12" r="9.2" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M7.2 12 H16.8', 2.2) },

    // ---- insert ----
    table: { body: `<rect x="3" y="3.4" width="18" height="17.2" rx="1.2" fill="none" stroke="${C}" stroke-width="1.6"/>` + S('M9 3.4 V20.6 M15 3.4 V20.6 M3 9.2 H21 M3 15 H21', 1.3) },
    attach: { body: S('M15.8 7.6 L8.9 14.5 A2.2 2.2 0 0 1 5.8 11.4 L13.2 4 A3.8 3.8 0 0 1 18.6 9.4 L11.4 16.6 A5.4 5.4 0 0 1 3.8 9 L10.6 2.2', 1.6) },
    picture: { body: `<rect x="3" y="4" width="18" height="16" rx="1.4" fill="none" stroke="${C}" stroke-width="1.6"/>` + F('M3 15.6 L8.4 10.2 L13.4 15.2 L15.6 13 L21 18.6 V19 H3 Z', '#605E5C') + `<circle cx="16.4" cy="8.4" r="2" fill="#0078D7"/>` },
    screen: { body: S('M3.4 5 H20.6 V15 H3.4 Z M9 4 v11 M15 4 v11 M3.4 9 H20.6 M3.4 13 H20.6', 1.3) + S('M7 18.5 h10', 2) },
    link: { body: S('M9.5 14.5 L14.5 9.5 M8 11 L5.6 13.4 A3.6 3.6 0 0 0 10.7 18.5 L13.1 16.1 M16 13 L18.4 10.6 A3.6 3.6 0 0 0 13.3 5.5 L10.9 7.9', 1.7) },
    dateIco: { body: `<rect x="3.4" y="4.6" width="17.2" height="16" rx="1.4" fill="none" stroke="${C}" stroke-width="1.6"/>` + S('M7.5 2.8 V6.8 M16.5 2.8 V6.8 M3.4 9.2 H20.6', 1.6) + `<text x="12" y="17.6" font-family="Segoe UI" font-size="7.6" fill="${C}" text-anchor="middle">31</text>` },
    timeIco: { body: `<circle cx="12" cy="12" r="8.6" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M12 7 V12 L15.8 15.8', 1.7) },
    symbol: { body: F('M4 20 H20 V18.4 H4 Z') + `<text x="12" y="15.6" font-family="Segoe UI" font-size="15" fill="${C}" text-anchor="middle">Ω</text>` },
    template: { body: S('M4.5 3.4 H19.5 V20.6 H4.5 Z') + S('M7.4 7 H16.6 M7.4 10.6 H16.6 M7.4 14.2 H12.6', 1.5) + F('M14.8 14.2 H19.6 V16.4 H14.8 Z M14.8 17.8 H19.6 V20 H14.8 Z', '#0078D7') },
    onlinePic: { body: `<circle cx="12" cy="12" r="9" fill="none" stroke="${C}" stroke-width="1.6"/>` + S('M3.2 9.6 H20.8 M3.2 14.6 H20.8 M12 3 C9 6.4 9 17.6 12 21 M12 3 C15 6.4 15 17.6 12 21', 1.3) + F('M13.8 9 L18 12 L13.8 15 Z') },
    record: { body: `<circle cx="12" cy="12" r="8.6" fill="none" stroke="${C}" stroke-width="1.6"/>` + `<circle cx="12" cy="12" r="4.2" fill="#C43E1C"/>` },
    transcribe: { body: `<rect x="7.2" y="2.5" width="7.6" height="11.2" rx="3.8" fill="none" stroke="${C}" stroke-width="1.6"/>` + S('M4.6 10.2 V11.4 A6.4 6.4 0 0 0 17.4 11.4 V10.2', 1.6) + S('M11 17.8 V20.8 M7.5 20.8 H14.5', 1.7) + F('M18.8 4.2 H22.2 V5.5 H18.8 Z M18.8 9.6 H21.6 V10.9 H18.8 Z M18.8 15 H22.2 V16.3 H18.8 Z') },

    // ---- draw ----
    pen: { body: F('M3.4 20.4 L4.4 16.4 L15.8 5 L19 8.2 L7.6 19.6 Z') + F('M17.2 3.6 Q18.6 2.2 20 3.6 Q21.4 5 20 6.4 L18.2 8.2 L15.4 5.4 Z', '#605E5C') },
    highlighterPen: { body: F('M3.2 20.8 L4.6 15.8 L14.6 5.8 L18.2 9.4 L8.2 19.4 Z') + F('M16 4.4 Q17.4 3 18.8 4.4 Q20.2 5.8 18.8 7.2 L17.4 8.6 L13.8 5 Z', '#605E5C') + F('M2.6 21.5 H9.4 V20.1 H2.6 Z', '#FFEE00') },
    eraser: { body: F('M3.6 13.8 L11.4 6 Q12.2 5.2 13 6 L19 12 Q19.8 12.8 19 13.6 L12.8 19.8 Q12 20.6 11.2 19.8 L3.6 15.8 Q2.8 15 3.6 13.8 Z M6 14.8 L12.4 18.6 L18.2 12.8 L12.8 7.6 Z') + F('M13 20.8 H21 V19.2 H13 Z') },
    lasso: { body: S('M5 6 C8.5 3.5 15.5 3.5 19 6.5 C22 9.5 22 14.5 18 18 C14 21.5 7 21 4.6 16.5 C2.2 12 3 8.5 6.5 6.6', 1.6) + F('M4.3 17.2 L3 21.6 L7.4 20.3 Z') },
    selectObj: { body: F('M4.6 3.4 L11.6 20.4 L13.2 13.2 L20.4 11.6 Z') },
    inkShape: { body: S('M2.5 18.5 C3.5 13.5 6 9 9.2 8.2 C11.4 7.7 13.2 9.4 12.3 11.6 C11.6 13.2 9.6 13.4 8.9 12', 1.55) + `<path d="M11.6 13.6 L15 15.4" stroke="${C}" stroke-width="1.55" fill="none" stroke-linecap="round"/>` + `<circle cx="17.2" cy="16.4" r="4.4" fill="none" stroke="${C}" stroke-width="1.55"/>` + S('M14.5 3.5 L16 6 M18.8 2.8 L18 5.6 M21.5 6.2 L19.2 7.4', 1.3) },
    shpLine: { body: S('M4 20 L20 4', 2.6) },
    shpRect: { body: `<rect x="4" y="5" width="16" height="14" rx="0.6" fill="none" stroke="${C}" stroke-width="2"/>` },
    shpEllipse: { body: `<ellipse cx="12" cy="12" rx="8.4" ry="6.4" fill="none" stroke="${C}" stroke-width="2"/>` },
    shpTriangle: { body: S('M12 3.6 L21 20 L3 20 Z', 2) },
    shpArrow: { body: F('M4 10.6 H13.2 V5.2 L20.5 12 L13.2 18.8 V13.4 H4 Z') },

    // ---- history / review / view ----
    bin: { body: S('M4.5 6 H19.5 M9 6 V4.2 H15 V6 M6.5 6 L7.6 20.4 H16.4 L17.5 6 M10 9.5 V17 M14 9.5 V17', 1.5) },
    clockEdits: { body: `<circle cx="10.5" cy="12" r="7.6" fill="none" stroke="${C}" stroke-width="1.6"/>` + S('M10.5 7.6 V12 L14 15.5', 1.6) + S('M19.6 5 L21.4 6.8 M21.4 5 L19.6 6.8', 1.4) },
    spell: { body: `<text x="3" y="16.5" font-family="Segoe UI" font-weight="600" font-size="13" fill="${C}">ABC</text>` + S('M9 20.6 L11.4 23 M19 9.6 L21.5 9.6', 1.6) + S('M15.4 9.6 L20.6 3', 2) + S('M17 5.6 L21.4 8.6', 1.6) + S('M19.5 3.4 L22 5.4', 1.6) },
    lock: { body: `<rect x="6" y="10.6" width="12" height="9.4" rx="1.4" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M8.6 10.6 V7.8 A3.4 3.4 0 0 1 15.4 7.8 V10.6', 1.7) + `<circle cx="12" cy="15.2" r="1.5" fill="${C}"/>` },
    ruleLines: { body: S('M3.2 6 H20.8 M3.2 10 H20.8 M3.2 14 H20.8 M3.2 18 H20.8', 1.4) },
    gridLines: { body: S('M3.2 6 H20.8 M3.2 10 H20.8 M3.2 14 H20.8 M3.2 18 H20.8', 1.3) + S('M6 3.2 V20.8 M10 3.2 V20.8 M14 3.2 V20.8 M18 3.2 V20.8', 1.3) },
    pageColor: { body: F('M12 2.6 C7.5 9 5 12.4 5 15.1 A7 7 0 0 0 19 15.1 C19 12.4 16.5 9 12 2.6 Z') },
    fullScreen: { body: S('M8.6 4.2 H4.2 V8.6 M15.4 4.2 H19.8 V8.6 M8.6 19.8 H4.2 V15.4 M15.4 19.8 H19.8 V15.4', 2) },

    // ---- backstage ----
    info: { body: `<circle cx="12" cy="12" r="9.2" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M12 10.8 V16.4', 2) + `<circle cx="12" cy="7.5" r="1.5" fill="${C}"/>` },
    newdoc: { body: S('M5.5 3 H13.4 L18.5 8.1 V21 H5.5 Z M13 3.4 V8.5 H18.1', 1.6) + S('M12 12 V17.5 M9.2 14.75 H14.8', 1.9) },
    openF: { body: F('M3.4 6.2 Q3.4 4.9 4.7 4.9 H9.4 L11.4 7 H19.3 Q20.6 7 20.6 8.2 V17.8 Q20.6 19 19.3 19 H4.7 Q3.4 19 3.4 17.8 Z') + F('M3.4 10.6 H20.6 V17.8 Q20.6 19 19.3 19 H4.7 Q3.4 19 3.4 17.8 Z', '#888') },
    saveIco: { body: F('M4.5 3.5 H17.5 L20.5 6.5 V19 A1.5 1.5 0 0 1 19 20.5 H5 A1.5 1.5 0 0 1 3.5 19 V5 A1.5 1.5 0 0 1 5 3.5 Z M7 3.5 V9 H16 V3.5 M6.8 12 H17.2 V20.3 H6.8 Z') + `<rect x="8" y="13.4" width="8" height="1.6" fill="#fff"/>` },
    share: { body: `<circle cx="6.4" cy="12" r="2.9" fill="none" stroke="${C}" stroke-width="1.7"/><circle cx="17.6" cy="5.4" r="2.9" fill="none" stroke="${C}" stroke-width="1.7"/><circle cx="17.6" cy="18.6" r="2.9" fill="none" stroke="${C}" stroke-width="1.7"/>` + S('M9.2 10.8 L14.9 6.8 M9.2 13.2 L14.9 17.2', 1.7) },
    exportIco: { body: S('M12 3 V13.6 M12 3 L8 7 M12 3 L16 7', 2) + S('M4.5 10.5 V20.5 H19.5 V10.5', 2) },
    account: { body: S('M12 11.6 A3.9 3.9 0 1 0 12 3.8 A3.9 3.9 0 0 0 12 11.6 Z') + S('M4.4 20.8 C5.1 15.6 8.3 13.9 12 13.9 C15.7 13.9 18.9 15.6 19.6 20.8') },
    feedback: { body: S('M12 2.8 L14.8 8.4 L21 9 L16.4 13.4 L17.8 19.6 L12 16.4 L6.2 19.6 L7.6 13.4 L3 9 L9.2 8.4 Z') },
    options: { body: S('M12 8.6 A3.4 3.4 0 1 0 12 15.4 A3.4 3.4 0 0 0 12 8.6 Z') + S('M12 2.4 V5.4 M12 18.6 V21.6 M2.4 12 H5.4 M18.6 12 H21.6 M5.2 5.2 L7.3 7.3 M16.7 16.7 L18.8 18.8 M18.8 5.2 L16.7 7.3 M7.3 16.7 L5.2 18.8', 1.8) },
    print: { body: F('M6.5 3 H17.5 V7.4 H6.5 Z M5 7.4 Q3.4 7.4 3.4 9 V14.6 Q3.4 16.2 5 16.2 H6.4 V21 H17.6 V16.2 H19 Q20.6 16.2 20.6 14.6 V9 Q20.6 7.4 19 7.4 Z M8.2 15 H15.8 V19.4 H8.2 Z') },
    forward: { body: S('M5 15.6 L12 4 L19 15.6 M12 4 V20', 2.4) },
    emailPage: { body: S('M3.5 5.5 H20.5 V18.5 H3.5 Z M3.8 5.8 L12 12.4 L20.2 5.8', 1.6) },

    // ---- small glyphs / misc ----
    x: { body: S('M5.5 5.5 L18.5 18.5 M18.5 5.5 L5.5 18.5', 2) },
    check: { body: S('M4 12.6 L9.4 18 L20 6.2', 2.6) },
    dots: { body: `<circle cx="5" cy="12" r="1.9" fill="${C}"/><circle cx="12" cy="12" r="1.9" fill="${C}"/><circle cx="19" cy="12" r="1.9" fill="${C}"/>` },
    dnd: { body: `<circle cx="9" cy="5" r="1.5" fill="${C}"/><circle cx="15" cy="5" r="1.5" fill="${C}"/><circle cx="9" cy="12" r="1.5" fill="${C}"/><circle cx="15" cy="12" r="1.5" fill="${C}"/><circle cx="9" cy="19" r="1.5" fill="${C}"/><circle cx="15" cy="19" r="1.5" fill="${C}"/>` },
    confirmX: { body: S('M4.5 4.5 L19.5 19.5 M19.5 4.5 L4.5 19.5', 2.4) },
    pinP: { body: F('M14.6 2.9 L21.1 9.4 L12.8 12.4 L11.6 11.6 L14.6 2.9 Z') + S('M6 13.5 L10.5 18 M4 20 L8.5 15.5', 1.8) },
    arrowUpDn: { body: S('M8 4 V20 M8 4 L5 7 M8 4 L11 7', 1.8) + S('M16 20 V4 M16 20 L13 17 M16 20 L19 17', 1.8) },
  };
  window.svgIcon = function (name, size) {
    const ic = IC[name];
    const s = size || 20;
    if (!ic) return `<svg width="${s}" height="${s}" viewBox="0 0 24 24"></svg>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ic.body}</svg>`;
  };
  window.ON_ICONS = IC;
})();
