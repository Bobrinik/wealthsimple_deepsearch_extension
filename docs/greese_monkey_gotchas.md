# Greasemonkey / Tampermonkey gotchas

Notes and solutions for userscript issues in this project.

---

## Fetching from localhost (e.g. the Deep Search server)

### The issue

When a userscript on a site like `https://my.wealthsimple.com` tries to call your local API (e.g. `http://localhost:8000`), the request can fail or never run:

- **With `GM_xmlhttpRequest`**: Tampermonkey (and similar) only allow requests to hosts you declare with `@connect`. If you don't add `@connect localhost` and `@connect 127.0.0.1`, the request is blocked and your `onload` / `onerror` may never fire, so the UI can stick on "Loading…".
- **With `fetch()`**: If the script uses `@grant GM_xmlhttpRequest` (or other grants), it may run in a sandbox where `fetch` behaves differently or where `GM_xmlhttpRequest` is required. Using `fetch()` without the right setup can lead to CORS errors when the page (origin `https://my.wealthsimple.com`) calls `http://localhost:8000`.

### The solution used in this project

Use **plain `fetch()`** from the page context, same as the Deep Research button:

1. **`@grant none`**  
   Run the script in the page context (no sandbox). No `GM_xmlhttpRequest` or `@connect` needed.

2. **`fetch()` with timeout**  
   Call your API like the working script does:
   ```js
   const res = await fetch('http://localhost:8000/notes', {
     method: 'GET',
     signal: AbortSignal.timeout(10000),
   });
   const data = await res.json();
   ```

3. **CORS on the server**  
   The FastAPI server must allow the page's origin. In `app/main.py` we use:
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://my.wealthsimple.com", "http://localhost", "http://127.0.0.1"],
       allow_methods=["GET", "POST", "OPTIONS"],
       allow_headers=["*"],
   )
   ```

With this, the notes panel and the Deep Research button both call localhost the same way: `fetch()` from the page, with CORS enabled on the server.

### If you prefer `GM_xmlhttpRequest`

If you want to keep using `GM_xmlhttpRequest` (e.g. to avoid CORS or to use extension privileges):

1. Add **`@connect`** for every host you call:
   ```text
   // @connect      localhost
   // @connect      127.0.0.1
   ```
2. Accept the permission prompt Tampermonkey shows for those hosts the first time.
3. Use a fallback or try/catch so that if the API isn't available you show an error instead of hanging on "Loading…".

Reference: the Notes panel was first implemented with `GM_xmlhttpRequest` and `@connect`; it was later switched to `fetch()` + `@grant none` to match the working Deep Research script (`wealthsimple_injector/deep_search.js`).

---

## ESM importmaps don't work in blob iframes

### The issue

When you inject a third‑party app (e.g. Excalidraw) into the page by creating a **sandboxed iframe** whose document is served from a **blob URL**, the app may never mount and you get a blank canvas. The root cause is that **importmaps inside dynamically created blob URLs are unreliable** in sandboxed iframes across browsers. The script fails silently, so the canvas stays blank with no obvious error.

### The solution: use UMD/global script builds

Switch from ESM + importmap to **UMD builds** loaded via plain `<script>` tags from a CDN (e.g. unpkg.com). UMD scripts expose globals like `window.React`, `window.ReactDOM`, and `window.ExcalidrawLib`, which resolve correctly in any iframe and don't depend on importmap resolution.

- Load UMD scripts in the iframe document (e.g. React, ReactDOM, ExcalidrawLib) with `<script src="https://unpkg.com/...">` (or similar).
- After the scripts load, use the globals to mount the app (e.g. `ReactDOM.createRoot(...).render(React.createElement(ExcalidrawLib.Excalidraw, ...))`).

### Error handling

If the UMD scripts fail to load (network block, CDN down, etc.), show a **visible error message** (e.g. red text in the iframe) instead of leaving a blank/black box. Otherwise failures are silent and hard to debug.

### Drag for the panel

If the panel has a header that should be draggable, `cursor: move` alone is not enough. Implement drag with **pointer events**: on the header use `pointerdown` → `setPointerCapture` and then `pointermove` / `pointerup` to update the panel position. This works reliably in userscript-injected UI.

### Persistence limitation

Without `allow-same-origin` on the iframe, the iframe has an **opaque origin** and cannot use `localStorage`. So drawings (or any state) inside the iframe won't persist across page navigations. If you need persistence, the clean approach is **postMessage**: have the iframe send the app's state (e.g. Excalidraw `onChange` payload) to the parent page, and let the parent store it in its own `localStorage` and re-inject it when the panel is opened again.
