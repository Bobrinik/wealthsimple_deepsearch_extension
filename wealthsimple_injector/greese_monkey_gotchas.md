# Greasemonkey / Tampermonkey gotchas

Notes and solutions for userscript issues in this project.

---

## Fetching from localhost (e.g. the Deep Search server)

### The issue

When a userscript on a site like `https://my.wealthsimple.com` tries to call your local API (e.g. `http://localhost:8000`), the request can fail or never run:

- **With `GM_xmlhttpRequest`**: Tampermonkey (and similar) only allow requests to hosts you declare with `@connect`. If you don’t add `@connect localhost` and `@connect 127.0.0.1`, the request is blocked and your `onload` / `onerror` may never fire, so the UI can stick on “Loading…”.
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
   The FastAPI server must allow the page’s origin. In `app/server.py` we use:
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
3. Use a fallback or try/catch so that if the API isn’t available you show an error instead of hanging on “Loading…”.

Reference: the Notes panel was first implemented with `GM_xmlhttpRequest` and `@connect`; it was later switched to `fetch()` + `@grant none` to match the working Deep Research script (`grease_monkey.user.js`).
