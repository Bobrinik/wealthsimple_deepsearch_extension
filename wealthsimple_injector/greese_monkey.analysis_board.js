// ==UserScript==
// @name         Wealthsimple Excalidraw (UMD Fix)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Uses UMD builds to reliably load Excalidraw inside a sandboxed blob iframe
// @author       You
// @match        https://my.wealthsimple.com/app/security-details/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // KEY FIX: Use UMD/global script tags instead of ESM importmaps.
    // Importmaps inside blob:// iframes are unreliable in sandboxed contexts
    // and cause Excalidraw to silently fail to mount — leaving a blank canvas.
    // UMD builds expose globals (React, ReactDOM, ExcalidrawLib) that always work.
    const rawHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />

        <!-- Step 1: Load React UMD globals FIRST -->
        <script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"><\/script>
        <script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"><\/script>

        <!-- Step 2: Point Excalidraw to its own CDN assets (fonts, icons, etc.) -->
        <script>window.EXCALIDRAW_ASSET_PATH = "https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/prod/";<\/script>

        <!-- Step 3: Load Excalidraw UMD — exposes window.ExcalidrawLib -->
        <link rel="stylesheet" href="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.css" />
        <script src="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js"><\/script>

        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body, html, #app {
            margin: 0; padding: 0;
            height: 100vh; width: 100vw;
            overflow: hidden;
            background: #121212;
          }
        </style>
      </head>
      <body>
        <div id="app" style="height:100%;width:100%;"></div>
        <script>
          // Guard: Show a visible error if Excalidraw UMD failed to load
          if (!window.ExcalidrawLib) {
            document.body.innerHTML = '<div style="color:red;padding:20px;font-family:sans-serif;">❌ Excalidraw failed to load. Check your network / CSP.</div>';
          } else {
            const { Excalidraw } = window.ExcalidrawLib;

            const App = () => {
              return React.createElement(Excalidraw, {
                theme: "dark",
                // Note: localStorage is NOT available in opaque-origin sandbox (no allow-same-origin).
                // Drawings persist for the lifetime of the page only.
                // To add persistence, you'd need postMessage back to the parent.
              });
            };

            ReactDOM.createRoot(document.getElementById("app"))
              .render(React.createElement(App));
          }
        <\/script>
      </body>
    </html>
    `;

    const blob = new Blob([rawHTML], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    function injectPanel() {
        if (document.getElementById('ws-excal-container')) return;

        const container = document.createElement('div');
        container.id = 'ws-excal-container';
        Object.assign(container.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '760px',
            height: '540px',
            zIndex: '2147483647',
            background: '#1a1a1a',
            border: '1px solid #555',
            borderRadius: '8px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            resize: 'both',
        });

        // ── Header (drag handle) ──────────────────────────────────────────────
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#ccc',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            fontWeight: '600',
            borderBottom: '1px solid #444',
            background: '#222',
            cursor: 'move',
            userSelect: 'none',
            flexShrink: '0',
        });
        header.innerHTML = `<span>📝 ANALYSIS BOARD</span><span id="ws-excal-close" style="cursor:pointer;font-size:14px;padding:0 4px;line-height:1;">✕</span>`;
        container.appendChild(header);

        // ── Iframe ────────────────────────────────────────────────────────────
        const iframe = document.createElement('iframe');
        iframe.id = 'ws-excal-iframe';
        Object.assign(iframe.style, {
            flex: '1',
            border: 'none',
            width: '100%',
            height: '100%',
            display: 'block',
        });
        iframe.src = blobUrl;

        // No allow-same-origin → opaque origin → Wealthsimple's CSP doesn't apply.
        // allow-scripts is required; others are for Excalidraw features.
        iframe.sandbox = "allow-scripts allow-modals allow-popups allow-downloads allow-pointer-lock allow-forms";
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write; pointer-lock;');

        container.appendChild(iframe);
        document.body.appendChild(container);

        // ── Event isolation (BUBBLE phase = after iframe receives events) ─────
        // Using capture=false means events travel INTO the iframe normally,
        // and are only stopped as they bubble back UP toward Wealthsimple's listeners.
        const blockedEvents = [
            'pointerdown','pointerup','pointermove','pointercancel',
            'mousedown','mouseup','mousemove','click','dblclick',
            'touchstart','touchmove','touchend','touchcancel',
            'wheel','keydown','keyup','keypress',
        ];
        blockedEvents.forEach(ev => {
            container.addEventListener(ev, e => {
                e.stopImmediatePropagation();
                e.stopPropagation();
            }, false); // false = bubble phase (CRITICAL — capture phase kills iframe input)
        });

        // ── Focus management ──────────────────────────────────────────────────
        const focusIframe = () => {
            try { iframe.contentWindow?.focus(); } catch(e) {}
        };
        iframe.addEventListener('load', () => setTimeout(focusIframe, 300));
        container.addEventListener('mouseenter', focusIframe);
        container.addEventListener('pointerdown', focusIframe);

        // ── Drag to move ──────────────────────────────────────────────────────
        let dragging = false, startX = 0, startY = 0, origRight = 20, origBottom = 20;

        header.addEventListener('pointerdown', (e) => {
            if (e.target.id === 'ws-excal-close') return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = container.getBoundingClientRect();
            origRight = window.innerWidth - rect.right;
            origBottom = window.innerHeight - rect.bottom;
            header.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        header.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            container.style.right = Math.max(0, origRight - dx) + 'px';
            container.style.bottom = Math.max(0, origBottom - dy) + 'px';
        });

        header.addEventListener('pointerup', () => { dragging = false; });

        // ── Close button ──────────────────────────────────────────────────────
        header.querySelector('#ws-excal-close').addEventListener('click', (e) => {
            e.stopPropagation();
            container.remove();
            URL.revokeObjectURL(blobUrl);
        });
    }

    // SPA-aware injection
    const observer = new MutationObserver(() => {
        if (/\/app\/security-details\//.test(location.href)) injectPanel();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (/\/app\/security-details\//.test(location.href)) injectPanel();
})();