<div align="center">

# OneNote Clone — Web Edition

**A freeform notebook app in the browser: purple chrome, sections and pages, ink drawing, tags, tables, media, and a page that never ends.**
Zero dependencies · zero build · vanilla JS · storage on IndexedDB.

</div>

---

## What it is

A faithful front-end recreation of Microsoft OneNote's desktop surface:

- **Notebook model** — notebooks → section tabs → page list, with an always-available "Personal (Web)" notebook seeded on first run, instant add/rename of sections, and page tabs down the right edge.
- **Freeform canvas** — click anywhere and type. Ruled and grid page styles, full rich text (bold/italic/underline, lists, styles), tables pasted or inserted as grids, links, and symbols.
- **Draw tab** — real ink: colored pens, an eraser, and lasso select over hand-drawn strokes, rendered crisp on removable layers.
- **Tags** — the classic gallery: To Do, Important, Question, and friends, round-tripped through the search pane.
- **Search** — instant find across every page of every notebook, with a scoped results pane that jumps straight to the hit.
- **Insert** — images, audio/video embeds, and an honest **Transcribe** dialog (audio file → text, with the model chip telling you exactly which engine ran).
- **Review & History** — spellcheck with a custom in-browser dictionary (your added words persist), page versions/recycle bin, backstage with Info / Open / Print.

## Run it

```bash
cd onenote-clone
python3 -m http.server 8003 --bind 0.0.0.0
# open http://localhost:8003/
```

Or use the **Office dashboard** at the repo root (serves every app together, dark mode shared):
```bash
cd ..                     # workspace root
python3 -m http.server 8002 --bind 0.0.0.0
# open http://localhost:8002/  → click the OneNote tile
```

## Storage

**Exports.** File → Save As offers the whole notebook as `.onenote.json` and the current
page as a **same-as-view `.html`** — absolute container positions, the app's own
`runStyle()` per span (colors, highlights, b/i/u, heading sizes, font stacks), todo
boxes, tables, pictures and ink strokes re-drawn as an SVG overlay. Verified by
`../_exports-suite.js` (12 checks) including computed-style probes of the rendered file.

Everything lives in **IndexedDB** (`onenote-web-edition`) — notebook library, last session (notebook/section/page/zoom), options, pens, custom dictionary. No localStorage anywhere; no server; export happens client-side.

## Layout

```
index.html   chrome DOM: title bar · ribbon · nav pane · section strip · page
icons.js     SVG glyph registry
idb.js       IndexedDB key/value engine (hydrated at boot)
app.js       model: notebooks/sections/pages, persistence, core surface
app2.js      ribbon commands, dialogs, tags, spellcheck, links/symbols
app3.js      ink: pens, eraser, lasso, drawing surfaces
app4.js      backstage (Info/Open/Print), options, search pane
transcribe.js audio → text pipeline
note.css     full chrome + dark mode
```
---

<div align="center">
<i>OneNote Web Edition · Version 16.0 (Clone) · hand-rolled in vanilla JS.</i><br>
License: Apache License 2.0
</div>
