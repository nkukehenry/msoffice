<div align="center">

<img alt="Office" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect x='4' y='4' width='24' height='24' rx='3' fill='%23f25022'/%3E%3Crect x='32' y='4' width='24' height='24' rx='3' fill='%237fba00'/%3E%3Crect x='4' y='32' width='24' height='24' rx='3' fill='%2300a4ef'/%3E%3Crect x='32' y='32' width='24' height='24' rx='3' fill='%23ffb900'/%3E%3C/svg%3E">

# Office Web Edition (Clone)

**A pixel-faithful office suite in the browser** — Office.com-style dashboard plus **all four apps: Excel, Word, PowerPoint, OneNote** —
built from **plain HTML/CSS/JS with zero dependencies and zero build tooling**, saved into **IndexedDB**, and guarded by
**~1,140 automated end-to-end checks**.

</div>

---

## Start here

```bash
cd /home/user                       # the suite root
python3 -m http.server 8002 --bind 0.0.0.0
# open http://localhost:8002/   → the Office dashboard
```

The dashboard is the front door: app tiles, **Recent documents** gathered live from every
app's IndexedDB, and one **dark-mode switch that syncs into every app** (it writes each
app's IndexedDB theme key, so every app boots in the same mode).

| Port | What | Root |
|---:|---|---|
| **8002** | ⭐ Office dashboard + all apps under one origin | suite root (`/home/user`) |
| 8001 | Excel alone (test server) | `excel/` |
| 8003 | OneNote alone (test server) | `onenote/` |
| 8004 | Word alone (test server) | `word/` |
| 8005 | PowerPoint alone (test server) | `powerpoint/` |

Serving the suite root is all you need for daily use; the per-app ports exist so each
app's tracker battery can point at a stable URL.

## The apps

| App | Folder | Status |
|---|---|---|
| **Excel** | [`excel/`](excel/README.md) | Flagship. 265+ formula functions, charts, `.xlsx` **and legacy `.xls` round-trip** (BIFF8 reader + SpreadsheetML-2003 writer), print engine, dark mode — stable |
| **Word** | [`word/`](word/README.md) | Stable: print-layout pages, styles, footnotes, `.docx`/`.doc` **import + export**, real tab stops, drag & drop, exact-sheet printing, dark mode incl. backstage, IndexedDB |
| **PowerPoint** | [`powerpoint/`](powerpoint/README.md) | Stable: slides, designer, transitions, slideshow, `.pptx` **and legacy `.ppt` import** (slide text from the CFB stream), `.pptx` round-trip, dark mode, IndexedDB |
| **OneNote** | [`onenote/`](onenote/README.md) | Stable: notebooks, ink, tags, search, transcribe, dark mode, IndexedDB (OneNote has no OOXML/legacy open format — Microsoft never defined one — so there is nothing to round-trip; HTML/JSON export provided) |

All four apps follow the same house rules and sit behind the dashboard's live tiles.

## House rules

1. **Zero dependencies, zero build.** Open `index.html` from any static server; there's no `npm install` for the apps.
2. **IndexedDB only.** No `localStorage` anywhere — every app carries a tiny `idb.js` engine (`XKV`) that hydrates the store into memory at boot and flushes writes asynchronously. Keys are namespaced: `xc.*` (Excel), `oc.*` (OneNote), `wc.*` (Word), `pc.*` (PowerPoint).
3. **Dark mode everywhere**, persisted and dashboard-synced.
4. **Trackers or it didn't happen.** Behaviors get Playwright batteries that drive the real app through its public namespace (`X`, `ON`) and treat any `pageerror` as failure.

## Repository map

```
index.html          ⭐ Office dashboard (serve the root: python3 -m http.server 8002)
excel/        the Excel app + its 12-suite battery + README
onenote/      the OneNote app + smoke/full suites + README
word/         the Word app + 6 suites incl. the 26-check batch8 gauntlet + README
powerpoint/   the PowerPoint app + smoke/full/chaos/foreign suites + README
```

## License

[`Apache License 2.0`](LICENSE)
# msoffice
