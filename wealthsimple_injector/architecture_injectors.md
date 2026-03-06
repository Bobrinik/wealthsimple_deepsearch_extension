# Injector Architecture

## Overview

Six Tampermonkey userscripts inject UI enhancements into `my.wealthsimple.com`. They run independently (no shared module), communicate via DOM Custom Events and `postMessage`, and share a local FastAPI backend at `http://localhost:8000`.

---

## Scripts at a Glance

| File | Script name | `@match` | `@run-at` | Role |
|---|---|---|---|---|
| `deep_search.js` | About Section – Deep Research Button | `*://*/*` | `document-idle` | Injects "Deep Research" button under the About section |
| `notes_panel.js` | Wealthsimple Notes Panel | `*.wealthsimple.com/app/security-details/*` | `document-start` | Left-side panel listing all saved research notes |
| `add_note_button.js` | Wealthsimple Stock Annotations | `*.wealthsimple.com/app/security-details/*` | `document-end` | Floating rich-text note editor (sandboxed iframe) |
| `enhanced_news.js` | News Section – High Density Override | `*://*/*` | `document-idle` | Replaces native news section with high-density feed |
| `hide_chat.js` | Wealthsimple Chat Nuker | `*.wealthsimple.com/*` | `document-start` | Blocks/removes the Decagon AI chat widget |

All scripts use **`@grant none`**, running in page context with plain `fetch()` (no `GM_xmlhttpRequest`). This is intentional — see [`docs/greese_monkey_gotchas.md`](../docs/greese_monkey_gotchas.md).

---

## Backend API

All scripts that need data call a single local FastAPI server:

```
Base URL: http://localhost:8000
```

| Endpoint | Method | Used by |
|---|---|---|
| `/health` | GET | `deep_search.js` |
| `/run` | POST `{ task, sec_id }` | `deep_search.js` |
| `/notes` | GET | `notes_panel.js` |
| `/notes/:cache_key` | DELETE | `notes_panel.js` |
| `/news?symbol=&limit=` | GET | `enhanced_news.js` |

The server must include CORS headers allowing `https://my.wealthsimple.com`.

---

## Inter-Script Communication

Scripts cannot `import` each other. They communicate via two mechanisms:

### 1. DOM Custom Events (script ↔ script, same window)

```
deep_search.js
  └─ document.dispatchEvent('deep-search-result-received', { result, sec_id })
        └──► notes_panel.js listens → refreshes note list via GET /notes

notes_panel.js
  └─ window.dispatchEvent('ws-open-note-edit', { cache_key, content, title })
        └──► add_note_button.js listens → loads note into editor panel
```

**Flow: user clicks Deep Research → result saved → panel refreshes automatically**

1. User clicks "Deep Research" button (`deep_search.js`)
2. Script POSTs to `/run`, receives AI result
3. Dispatches `deep-search-result-received` on `document`
4. `notes_panel.js` catches event, re-fetches `GET /notes`, re-renders list

**Flow: user clicks note in panel → editor opens**

1. User clicks a note item in the left panel (`notes_panel.js`)
2. Dispatches `ws-open-note-edit` on `window` with `{ cache_key, content, title }`
3. `add_note_button.js` catches event, calls `injectPanel({ ... })` to open/populate editor

### 2. `postMessage` Bridge (iframe ↔ parent page)

`add_note_button.js` renders its editor inside a sandboxed iframe (blob URL, no `allow-same-origin`). Because the iframe has an opaque origin, it cannot access `localStorage` directly. The parent page acts as a storage proxy:

```
iframe (ws-annot editor)
  └─ postMessage({ source: 'ws-annot', action: 'get'|'set', key, value }, '*')
        └──► parent window listener in add_note_button.js
               ├─ 'set' → localStorage.setItem(key, value)
               └─ 'get' → e.source.postMessage({ source: 'ws-annot-reply', key, value }, '*')
                               └──► iframe receives reply, continues
```

(Excalidraw / analysis board, if present) does **not** implement this bridge — drawings are lost on navigation (opaque origin limitation, documented in gotchas).

---

## DOM Injection Strategies

Scripts must inject UI into a React SPA that re-renders aggressively and navigates without full page reloads. Three patterns are used:

### Pattern A — Polling loop (`setInterval` tick)
Used by: `deep_search.js`, `enhanced_news.js`

```
setInterval(tick, 600ms)

tick():
  1. Am I on a /security-details/ page?    → skip if not
  2. Did the sec-id change?               → reset state, remove stale UI
  3. Is my element already in DOM?        → skip if yes
  4. Is the target section rendered yet?  → skip if not
  5. Inject UI
```

This handles initial load, SPA navigation, and React re-renders with zero navigation detection logic.

### Pattern B — MutationObserver + polling fallback
Used by: `notes_panel.js`

```
DOMContentLoaded / readyState check
  └─ tryInject() → waits for #root to have children
       └─ if fails → MutationObserver on documentElement
            └─ fallback: setInterval every 500ms for up to 30s
                 └─ also a separate MutationObserver for SPA URL changes
```

### Pattern C — MutationObserver only (simple)
Used by: `hide_chat.js`

```
MutationObserver on documentElement (childList + subtree)
  └─ on any mutation → check URL / nuke elements
```

`hide_chat.js` also adds a 1500ms `setInterval` as a belt-and-suspenders fallback.

---

## Sandboxed Iframe Pattern

`add_note_button.js` (and any analysis board script) render complex third-party UI in sandboxed iframes to isolate their DOM and avoid Wealthsimple's CSP.

```
Parent page (my.wealthsimple.com)
  └─ <iframe src="blob:..." sandbox="allow-scripts allow-modals ...">
       └─ Self-contained HTML document
            ├─ UMD scripts loaded via <script src="https://unpkg.com/...">
            └─ App mounted into DOM
```

Key constraints:
- **No `allow-same-origin`** → opaque origin → Wealthsimple's CSP does not apply to the iframe
- **UMD builds only** — ESM importmaps are unreliable in blob iframes (see gotchas)
- **No `localStorage`** inside iframe — use postMessage bridge to parent if persistence is needed
- Event bubbling from iframe to parent is blocked by stopping propagation on the container element

---

## Execution Order on Page Load

```
document-start  │  hide_chat.js      (blocks chat widget before DOM exists)
                │  notes_panel.js    (injects styles immediately, waits for #root)
                │
document-idle   │  deep_search.js    (starts polling for About section)
                │  enhanced_news.js  (starts polling for News section)
                │
document-end    │  add_note_button.js (injects annotation panel)
```

---

## Communication Diagram

```
┌─────────────────────────────────────────────────────────┐
│                my.wealthsimple.com page                 │
│                                                         │
│  ┌──────────────────┐   deep-search-result-received    │
│  │  deep_search.js  │─────────────────────────────────►│
│  │                  │   (document CustomEvent)         │
│  │                  │◄──────────────┐                  │
│  │  POST /run       │               │                  │
│  │  GET  /health    │    ┌──────────┴──────────┐       │
│  └──────────────────┘    │  notes_panel.js     │       │
│                          │                     │       │
│  ┌──────────────────┐    └─────────────────────┘       │
│  │ add_note_button  │◄─── GET  /notes, DELETE /notes   │
│  │      .js         │                                  │
│  │  ws-open-note-   │◄── ws-open-note-edit             │
│  │  edit listener   │    (window CustomEvent)          │
│  │  ┌─────────────┐ │  postMessage (ws-annot)          │
│  │  │  blob iframe│◄┤►  localStorage bridge            │
│  │  │  (editor)   │ │                                  │
│  │  └─────────────┘ │                                  │
│  └──────────────────┘                                  │
│                                                         │
│  ┌──────────────────┐  GET /news?symbol=...            │
│  │ enhanced_news.js │──────────────────────────────────►│
│  └──────────────────┘                                  │
│                                                         │
│  ┌──────────────────┐  (no API calls, no events)       │
│  │   hide_chat.js   │  blocks chat widget DOM/scripts  │
│  └──────────────────┘                                  │
└─────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  localhost:8000    │
                    │  FastAPI backend   │
                    │                   │
                    │  GET  /health      │
                    │  POST /run         │
                    │  GET  /notes       │
                    │  DELETE /notes/:id │
                    │  GET  /news        │
                    └────────────────────┘
```
