// ==UserScript==
// @name         Wealthsimple Notes Panel
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Adds a notes panel on the left side of Wealthsimple security detail pages
// @author       You
// @match        https://my.wealthsimple.com/app/security-details/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';
  
    // =========================================================
    //  STYLES — injected immediately (before DOM is ready)
    // =========================================================
    const STYLE = document.createElement('style');
    STYLE.textContent = `
      #ws-notes-panel {
        position: fixed;
        top: 0;
        left: 0;
        width: 300px;
        height: 100vh;
        background: #141414;
        border-right: 1px solid rgba(255,255,255,0.08);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #f5f4f4;
        transition: transform 0.25s ease;
      }
      #ws-notes-panel.collapsed {
        transform: translateX(-300px);
      }
  
      #ws-notes-toggle {
        position: fixed;
        top: 12px;
        left: 312px;
        z-index: 100000;
        background: #1f1f1f;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #f5f4f4;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.15s ease, left 0.25s ease;
      }
      #ws-notes-toggle:hover { background: #2a2a2a; }
      #ws-notes-toggle.collapsed { left: 12px; }
  
      #ws-notes-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      #ws-notes-header h2 {
        margin: 0 0 4px;
        font-size: 16px;
        font-weight: 600;
        color: #f5f4f4;
      }
      #ws-notes-header p {
        margin: 0;
        font-size: 12px;
        color: #94908d;
      }
  
      #ws-notes-search {
        margin: 12px 20px 0;
        padding: 8px 12px;
        background: #1f1f1f;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        color: #f5f4f4;
        font-size: 13px;
        outline: none;
        width: calc(100% - 40px);
        box-sizing: border-box;
        flex-shrink: 0;
      }
      #ws-notes-search::placeholder { color: #666; }
      #ws-notes-search:focus { border-color: rgba(255,255,255,0.25); }
  
      #ws-notes-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
        scrollbar-width: thin;
        scrollbar-color: #333 transparent;
      }
      #ws-notes-list::-webkit-scrollbar { width: 6px; }
      #ws-notes-list::-webkit-scrollbar-track { background: transparent; }
      #ws-notes-list::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  
      .ws-note-item {
        padding: 10px 20px;
        cursor: pointer;
        transition: background 0.12s ease;
        border-left: 3px solid transparent;
      }
      .ws-note-item:hover { background: rgba(255,255,255,0.04); }
      .ws-note-item.pinned { border-left-color: #f0b429; }
      .ws-note-item.pinned .ws-note-pin { display: inline; }
  
      .ws-note-title {
        font-size: 13px;
        font-weight: 500;
        color: #f5f4f4;
        margin: 0 0 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ws-note-preview {
        font-size: 12px;
        color: #94908d;
        margin: 0 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.4;
      }
      .ws-note-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #666;
      }
      .ws-note-tag {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 500;
      }
      .ws-note-tag.buy       { background: rgba(55,188,101,0.15); color: #37bc65; }
      .ws-note-tag.sell      { background: rgba(220,53,69,0.15);  color: #dc3545; }
      .ws-note-tag.hold      { background: rgba(240,180,41,0.15); color: #f0b429; }
      .ws-note-tag.research  { background: rgba(99,140,255,0.15); color: #638cff; }
      .ws-note-tag.dividend  { background: rgba(160,90,255,0.15); color: #a05aff; }
      .ws-note-tag.earnings  { background: rgba(0,188,212,0.15);  color: #00bcd4; }
      .ws-note-tag.risk      { background: rgba(255,87,34,0.15);  color: #ff5722; }
      .ws-note-tag.general   { background: rgba(255,255,255,0.08);color: #94908d; }
      .ws-note-pin { display: none; font-size: 10px; margin-right: 2px; }
      .ws-note-divider {
        height: 1px;
        background: rgba(255,255,255,0.05);
        margin: 0 20px;
      }

      /* Grouping by ticker */
      .ws-notes-ticker-group {
        margin-bottom: 4px;
      }
      .ws-notes-ticker-group-header {
        padding: 8px 20px 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #94908d;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: default;
        position: relative;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ws-notes-ticker-group-header-text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ws-notes-ticker-view-company {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 4px;
        color: #94908d;
        cursor: pointer;
        transition: color 0.12s ease, background 0.12s ease;
      }
      .ws-notes-ticker-view-company:hover {
        color: #f5f4f4;
        background: rgba(255,255,255,0.08);
      }
      .ws-notes-ticker-view-company svg {
        width: 14px;
        height: 14px;
      }
      .ws-notes-sec-id-tooltip {
        position: absolute;
        left: 20px;
        bottom: 100%;
        margin-bottom: 4px;
        padding: 6px 10px;
        background: #1f1f1f;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        color: #94908d;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s ease;
      }
      .ws-notes-ticker-group-header:hover .ws-notes-sec-id-tooltip.visible {
        opacity: 1;
      }
      .ws-note-item.ws-note-item--under-sec {
        padding-left: 28px;
      }
  
      /* Push the WS page content right when panel is open */
      body.ws-notes-open #root {
        margin-left: 300px !important;
        transition: margin-left 0.25s ease;
      }

      /* =========================
         MODAL
      ========================= */
      #ws-notes-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 100001;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      #ws-notes-modal-backdrop.open { display: flex; }

      #ws-notes-modal {
        width: min(900px, 96vw);
        max-height: min(82vh, 900px);
        background: #141414;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #ws-notes-modal-header {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      #ws-notes-modal-title {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
        color: #f5f4f4;
        line-height: 1.25;
      }
      #ws-notes-modal-sub {
        margin-top: 6px;
        font-size: 12px;
        color: #94908d;
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      #ws-notes-modal-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .ws-notes-modal-btn {
        background: #1f1f1f;
        border: 1px solid rgba(255,255,255,0.1);
        color: #f5f4f4;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
      }
      .ws-notes-modal-btn:hover { background: #2a2a2a; }
      #ws-notes-modal-delete { color: #e57373; }
      #ws-notes-modal-delete:hover { background: rgba(229,115,115,0.15); }
      #ws-notes-modal-view-company { text-decoration: none; }
      .ws-notes-modal-no-sec-id { font-size: 12px; color: #94908d; }
      #ws-notes-modal-gemini { text-decoration: none; padding: 6px 10px; }
      #ws-notes-modal-gemini svg { display: block; width: 20px; height: 20px; }

      #ws-notes-modal-body {
        padding: 14px 16px 18px;
        overflow: auto;
        scrollbar-width: thin;
        scrollbar-color: #333 transparent;
      }
      #ws-notes-modal-body::-webkit-scrollbar { width: 8px; }
      #ws-notes-modal-body::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }

      #ws-notes-modal-content {
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 13px;
        line-height: 1.55;
        color: #e7e5e5;
      }
    `;
    (document.head || document.documentElement).appendChild(STYLE);
  
    // =========================================================
    //  DATA — fetch saved deep search results from server
    // =========================================================
    const API_BASE = 'http://localhost:8000';
    const NOTES_URL = API_BASE + '/notes';

    function stripHtml(html) {
      if (typeof html !== 'string') return '';
      const div = document.createElement('div');
      div.innerHTML = html;
      return (div.textContent || div.innerText || '').trim();
    }

    function formatDate(createdAt) {
      if (!createdAt) return '';
      const d = new Date(createdAt);
      if (isNaN(d.getTime())) return createdAt;
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    async function fetchNotes() {
      try {
        const res = await fetch(NOTES_URL, { method: 'GET', signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { error: 'Server returned ' + res.status };
        const data = await res.json();
        const raw = (data && data.notes) ? data.notes : [];
        const notes = raw.map(function(n) {
          const fullText = stripHtml(n.result || '');
          var preview = fullText.replace(/\s+/g, ' ').slice(0, 120);
          if (preview.length === 120) preview += '...';
          var displayTitle = (n.ticker && String(n.ticker).trim()) || '';
          if (!displayTitle && n.cache_key && n.cache_key.indexOf('ws-annot-') === 0) {
            displayTitle = n.cache_key.slice(9).trim(); // strip "ws-annot-"
          }
          if (!displayTitle) displayTitle = (n.cache_key || 'Unknown').trim();
          var noteTitle = (n.title && String(n.title).trim()) || displayTitle;
          return {
            cache_key: n.cache_key || '',
            title: noteTitle,
            preview: preview || 'No preview',
            content: fullText || 'No content',
            rawContent: n.result || '', // keep raw (e.g. HTML) for opening in add_note editor
            tag: 'research',
            dateStr: formatDate(n.created_at),
            pinned: false,
            sec_id: n.sec_id || null,
            ticker: (n.ticker && String(n.ticker).trim()) || null,
          };
        });
        return { notes: notes };
      } catch (err) {
        return { error: err && err.message ? err.message : 'Could not reach server' };
      }
    }

    function getSymbolFromUrl() {
      var match = /\/app\/security-details\/([^/?#]+)/.exec(location.pathname);
      return match ? match[1] : '';
    }

    /** Derive display ticker from sec_id when API doesn't provide ticker (e.g. "NYSE-WCP" -> "WCP"). */
    function tickerFromSecId(secId) {
      if (!secId || typeof secId !== 'string') return null;
      var s = secId.trim();
      if (!s) return null;
      var dash = s.indexOf('-');
      if (dash !== -1 && dash < s.length - 1) return s.slice(dash + 1).trim();
      return s;
    }

    /** Groups notes by ticker (display name). Returns array of { ticker: string, secId: string|null, notes: note[] }. */
    function groupNotesByTicker(notes) {
      var map = Object.create(null);
      var order = [];
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        var displayTicker = (n.ticker && String(n.ticker).trim()) || tickerFromSecId(n.sec_id) || (n.sec_id && String(n.sec_id).trim()) || '\0other';
        var key = displayTicker;
        if (!map[key]) {
          map[key] = { ticker: key === '\0other' ? 'Other' : key, secId: n.sec_id || null, notes: [] };
          order.push(key);
        }
        map[key].notes.push(n);
        if (n.sec_id && !map[key].secId) map[key].secId = n.sec_id;
      }
      return order.map(function(k) {
        return map[k];
      });
    }
  
    // =========================================================
    //  DOM INJECTION — wait for #root to appear, then inject
    // =========================================================
    function injectPanel() {
      // Guard: only inject once
      if (document.getElementById('ws-notes-panel')) return;

      var symbol = getSymbolFromUrl();

      // --- Toggle button ---
      const toggle = document.createElement('button');
      toggle.id = 'ws-notes-toggle';
      toggle.innerHTML = '☰';
      toggle.title = 'Toggle notes panel';
      document.body.appendChild(toggle);

      // --- Panel ---
      const panel = document.createElement('div');
      panel.id = 'ws-notes-panel';
      panel.innerHTML =
        '<div id="ws-notes-header">' +
          '<h2>\u{1F4DD} Notes</h2>' +
          '<p id="ws-notes-subtitle">Loading…</p>' +
        '</div>' +
        '<input id="ws-notes-search" type="text" placeholder="Search notes..." />' +
        '<div id="ws-notes-list"></div>';
      document.body.appendChild(panel);

      // --- Modal (create once) ---
      function ensureModal() {
        if (document.getElementById('ws-notes-modal-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'ws-notes-modal-backdrop';
        backdrop.innerHTML =
          '<div id="ws-notes-modal" role="dialog" aria-modal="true" aria-label="Note details">' +
            '<div id="ws-notes-modal-header">' +
              '<div>' +
                '<h3 id="ws-notes-modal-title"></h3>' +
                '<div id="ws-notes-modal-sub"></div>' +
              '</div>' +
              '<div id="ws-notes-modal-actions">' +
                '<a class="ws-notes-modal-btn" id="ws-notes-modal-gemini" href="https://gemini.google.com/app" target="_blank" rel="noopener" title="Open Gemini"><svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 65 65"><mask id="ws-notes-gemini-mask" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="65" height="65"><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="#000"/><path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" fill="url(#ws-notes-gemini-paint)"/></mask><g mask="url(#ws-notes-gemini-mask)"><g filter="url(#ws-notes-gemini-f0)"><path d="M-5.859 50.734c7.498 2.663 16.116-2.33 19.249-11.152 3.133-8.821-.406-18.131-7.904-20.794-7.498-2.663-16.116 2.33-19.25 11.151-3.132 8.822.407 18.132 7.905 20.795z" fill="#FFE432"/></g><g filter="url(#ws-notes-gemini-f1)"><path d="M27.433 21.649c10.3 0 18.651-8.535 18.651-19.062 0-10.528-8.35-19.062-18.651-19.062S8.78-7.94 8.78 2.587c0 10.527 8.35 19.062 18.652 19.062z" fill="#FC413D"/></g><g filter="url(#ws-notes-gemini-f2)"><path d="M20.184 82.608c10.753-.525 18.918-12.244 18.237-26.174-.68-13.93-9.95-24.797-20.703-24.271C6.965 32.689-1.2 44.407-.519 58.337c.681 13.93 9.95 24.797 20.703 24.271z" fill="#00B95C"/></g><g filter="url(#ws-notes-gemini-f3)"><path d="M20.184 82.608c10.753-.525 18.918-12.244 18.237-26.174-.68-13.93-9.95-24.797-20.703-24.271C6.965 32.689-1.2 44.407-.519 58.337c.681 13.93 9.95 24.797 20.703 24.271z" fill="#00B95C"/></g><g filter="url(#ws-notes-gemini-f4)"><path d="M30.954 74.181c9.014-5.485 11.427-17.976 5.389-27.9-6.038-9.925-18.241-13.524-27.256-8.04-9.015 5.486-11.428 17.977-5.39 27.902 6.04 9.924 18.242 13.523 27.257 8.038z" fill="#00B95C"/></g><g filter="url(#ws-notes-gemini-f5)"><path d="M67.391 42.993c10.132 0 18.346-7.91 18.346-17.666 0-9.757-8.214-17.667-18.346-17.667s-18.346 7.91-18.346 17.667c0 9.757 8.214 17.666 18.346 17.666z" fill="#3186FF"/></g><g filter="url(#ws-notes-gemini-f6)"><path d="M-13.065 40.944c9.33 7.094 22.959 4.869 30.442-4.972 7.483-9.84 5.987-23.569-3.343-30.663C4.704-1.786-8.924.439-16.408 10.28c-7.483 9.84-5.986 23.57 3.343 30.664z" fill="#FBBC04"/></g><g filter="url(#ws-notes-gemini-f7)"><path d="M34.74 51.43c11.135 7.656 25.896 5.524 32.968-4.764 7.073-10.287 3.779-24.832-7.357-32.488C49.215 6.52 34.455 8.654 27.382 18.94c-7.072 10.288-3.779 24.833 7.357 32.49z" fill="#3186FF"/></g><g filter="url(#ws-notes-gemini-f8)"><path d="M54.984-2.336c2.833 3.852-.808 11.34-8.131 16.727-7.324 5.387-15.557 6.631-18.39 2.78-2.833-3.853.807-11.342 8.13-16.728 7.324-5.387 15.558-6.631 18.39-2.78z" fill="#749BFF"/></g><g filter="url(#ws-notes-gemini-f9)"><path d="M31.727 16.104C43.053 5.598 46.94-8.626 40.41-15.666c-6.53-7.04-21.006-4.232-32.332 6.274s-15.214 24.73-8.683 31.77c6.53 7.04 21.006 4.232 32.332-6.274z" fill="#FC413D"/></g><g filter="url(#ws-notes-gemini-f10)"><path d="M8.51 53.838c6.732 4.818 14.46 5.55 17.262 1.636 2.802-3.915-.384-10.994-7.116-15.812-6.731-4.818-14.46-5.55-17.261-1.636-2.802 3.915.383 10.994 7.115 15.812z" fill="#FFEE48"/></g></g><defs><filter id="ws-notes-gemini-f0" x="-19.824" y="13.152" width="39.274" height="43.217" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="2.46" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f1" x="-15.001" y="-40.257" width="84.868" height="85.688" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="11.891" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f2" x="-20.776" y="11.927" width="79.454" height="90.916" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="10.109" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f3" x="-20.776" y="11.927" width="79.454" height="90.916" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="10.109" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f4" x="-19.845" y="15.459" width="79.731" height="81.505" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="10.109" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f5" x="29.832" y="-11.552" width="75.117" height="73.758" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="9.606" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f6" x="-38.583" y="-16.253" width="78.135" height="78.758" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="8.706" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f7" x="8.107" y="-5.966" width="78.877" height="77.539" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="7.775" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f8" x="13.587" y="-18.488" width="56.272" height="51.81" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="6.957" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f9" x="-15.526" y="-31.297" width="70.856" height="69.306" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="5.876" result="effect1_foregroundBlur_2001_67"/></filter><filter id="ws-notes-gemini-f10" x="-14.168" y="20.964" width="55.501" height="51.571" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur stdDeviation="7.273" result="effect1_foregroundBlur_2001_67"/></filter><linearGradient id="ws-notes-gemini-paint" x1="18.447" y1="43.42" x2="52.153" y2="15.004" gradientUnits="userSpaceOnUse"><stop stop-color="#4893FC"/><stop offset=".27" stop-color="#4893FC"/><stop offset=".777" stop-color="#969DFF"/><stop offset="1" stop-color="#BD99FE"/></linearGradient></defs></svg></a>' +
                '<a class="ws-notes-modal-btn" id="ws-notes-modal-view-company" href="#" style="display:none" title="Open company security details">View company</a>' +
                '<span id="ws-notes-modal-no-sec-id" class="ws-notes-modal-no-sec-id" style="display:none">We cannot navigate to this company at this time.</span>' +
                '<button class="ws-notes-modal-btn" id="ws-notes-modal-delete" title="Delete note">Delete</button>' +
                '<button class="ws-notes-modal-btn" id="ws-notes-modal-copy" title="Copy note">Copy</button>' +
                '<button class="ws-notes-modal-btn" id="ws-notes-modal-close" title="Close">✕</button>' +
              '</div>' +
            '</div>' +
            '<div id="ws-notes-modal-body">' +
              '<div id="ws-notes-modal-content"></div>' +
            '</div>' +
          '</div>';

        document.body.appendChild(backdrop);

        // Close on backdrop click
        backdrop.addEventListener('click', function(e) {
          if (e.target === backdrop) closeModal();
        });

        // Close button
        backdrop.querySelector('#ws-notes-modal-close').addEventListener('click', closeModal);

        // Esc key
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') closeModal();
        });

        // Copy button
        backdrop.querySelector('#ws-notes-modal-copy').addEventListener('click', async function() {
          const txt = backdrop.querySelector('#ws-notes-modal-content').innerText || '';
          const btn = this;
          try {
            await navigator.clipboard.writeText(txt);
            var orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function() { btn.textContent = orig; }, 1500);
          } catch (_) {}
        });

        // Delete button — handler receives currentModalNote via closure set in openModal
        backdrop.querySelector('#ws-notes-modal-delete').addEventListener('click', function() {
          var note = backdrop.currentModalNote;
          if (!note || !note.cache_key) return;
          var deleteBtn = this;
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Deleting…';
          fetch(API_BASE + '/notes/' + encodeURIComponent(note.cache_key), { method: 'DELETE' })
            .then(function(res) {
              if (res.status === 404) throw new Error('Note not found');
              if (!res.ok) throw new Error('Delete failed');
              closeModal();
              notes = notes.filter(function(n) { return n.cache_key !== note.cache_key; });
              var q = (panel.querySelector('#ws-notes-search') && panel.querySelector('#ws-notes-search').value || '').toLowerCase();
              render(q ? notes.filter(function(n) {
                return n.title.toLowerCase().indexOf(q) !== -1 ||
                       n.preview.toLowerCase().indexOf(q) !== -1 ||
                       (n.tag && n.tag.indexOf(q) !== -1);
              }) : notes);
              updateSubtitle(notes.length, null);
            })
            .catch(function(err) {
              deleteBtn.disabled = false;
              deleteBtn.textContent = 'Delete';
              alert(err && err.message ? err.message : 'Could not delete note');
            });
        });
      }

      function openModal(note) {
        ensureModal();
        const backdrop = document.getElementById('ws-notes-modal-backdrop');
        backdrop.currentModalNote = note;
        var deleteBtn = backdrop.querySelector('#ws-notes-modal-delete');
        if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = 'Delete'; }
        const titleEl = backdrop.querySelector('#ws-notes-modal-title');
        const subEl = backdrop.querySelector('#ws-notes-modal-sub');
        const contentEl = backdrop.querySelector('#ws-notes-modal-content');

        titleEl.textContent = note.title || 'Note';

        // View company: use only sec_id from the notes endpoint (no fallback to current page)
        const viewCompanyEl = backdrop.querySelector('#ws-notes-modal-view-company');
        const noSecIdEl = backdrop.querySelector('#ws-notes-modal-no-sec-id');
        if (viewCompanyEl && noSecIdEl) {
          if (note.sec_id) {
            viewCompanyEl.href = 'https://my.wealthsimple.com/app/security-details/' + encodeURIComponent(note.sec_id);
            viewCompanyEl.style.display = '';
            noSecIdEl.style.display = 'none';
          } else {
            viewCompanyEl.href = '#';
            viewCompanyEl.style.display = 'none';
            noSecIdEl.style.display = '';
          }
        }

        // tag + date
        subEl.innerHTML = '';
        const tag = document.createElement('span');
        tag.className = 'ws-note-tag ' + (note.tag || 'general');
        tag.textContent = note.tag || 'general';
        const date = document.createElement('span');
        date.textContent = note.dateStr || '';

        subEl.appendChild(tag);
        subEl.appendChild(date);

        // IMPORTANT: render as text (not HTML) to avoid XSS
        contentEl.textContent = note.content || note.preview || '';

        backdrop.classList.add('open');
      }

      function closeModal() {
        const backdrop = document.getElementById('ws-notes-modal-backdrop');
        if (backdrop) backdrop.classList.remove('open');
      }

      const list = panel.querySelector('#ws-notes-list');
      const subtitle = panel.querySelector('#ws-notes-subtitle');
      var notes = [];

      function updateSubtitle(count, err) {
        if (err) {
          subtitle.textContent = err;
          return;
        }
        var sym = symbol ? ' · ' + symbol : '';
        subtitle.textContent = count + ' note' + (count !== 1 ? 's' : '');
      }

      function render(arr) {
        list.innerHTML = '';
        if (arr.length === 0) {
          list.innerHTML = '<div class="ws-note-item" style="color:#94908d;cursor:default;">No notes to show</div>';
          return;
        }
        var groups = groupNotesByTicker(arr);
        var hoverTimer = null;
        groups.forEach(function(grp, groupIdx) {
          var groupWrap = document.createElement('div');
          groupWrap.className = 'ws-notes-ticker-group';
          var header = document.createElement('div');
          header.className = 'ws-notes-ticker-group-header';
          var headerText = document.createElement('span');
          headerText.className = 'ws-notes-ticker-group-header-text';
          headerText.textContent = grp.ticker;
          headerText.title = grp.ticker;
          header.appendChild(headerText);
          if (grp.secId) {
            var viewBtn = document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'ws-notes-ticker-view-company';
            viewBtn.title = 'View company';
            viewBtn.setAttribute('aria-label', 'View company');
            viewBtn.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            viewBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = 'https://my.wealthsimple.com/app/security-details/' + encodeURIComponent(grp.secId);
            });
            header.appendChild(viewBtn);
          }
          if (grp.secId) {
            var tooltip = document.createElement('span');
            tooltip.className = 'ws-notes-sec-id-tooltip';
            tooltip.textContent = grp.secId;
            header.appendChild(tooltip);
            header.addEventListener('mouseenter', function() {
              var t = grp.secId;
              hoverTimer = setTimeout(function() {
                tooltip.classList.add('visible');
              }, 700);
            });
            header.addEventListener('mouseleave', function() {
              clearTimeout(hoverTimer);
              hoverTimer = null;
              tooltip.classList.remove('visible');
            });
          }
          groupWrap.appendChild(header);
          grp.notes.forEach(function(note, idx) {
            const item = document.createElement('div');
            item.className = 'ws-note-item' + (note.pinned ? ' pinned' : '') + ' ws-note-item--under-sec';
            item.innerHTML =
              '<div class="ws-note-title"><span class="ws-note-pin">\u{1F4CC} </span>' + note.title + '</div>' +
              '<div class="ws-note-preview">' + note.preview + '</div>' +
              '<div class="ws-note-meta">' +
                '<span class="ws-note-tag ' + note.tag + '">' + note.tag + '</span>' +
                '<span>' + note.dateStr + '</span>' +
              '</div>';
            groupWrap.appendChild(item);
            item.addEventListener('click', function() {
              window.dispatchEvent(new CustomEvent('ws-open-note-edit', {
                detail: {
                  cache_key: note.cache_key,
                  content: note.rawContent || note.content,
                  title: note.title,
                  sec_id: note.sec_id || null,
                  ticker: note.ticker || null
                }
              }));
            });
            if (idx < grp.notes.length - 1) {
              const div = document.createElement('div');
              div.className = 'ws-note-divider';
              groupWrap.appendChild(div);
            }
          });
          list.appendChild(groupWrap);
          if (groupIdx < groups.length - 1) {
            const div = document.createElement('div');
            div.className = 'ws-note-divider';
            list.appendChild(div);
          }
        });
      }

      list.innerHTML = '<div class="ws-note-item" style="color:#94908d;cursor:default;">Loading notes…</div>';
      (async function() {
        const result = await fetchNotes();
        if (result.error) {
          updateSubtitle(0, result.error);
          list.innerHTML = '<div class="ws-note-item" style="color:#94908d;cursor:default;">' + result.error + '</div>';
          return;
        }
        notes = result.notes || [];
        updateSubtitle(notes.length, null);
        render(notes);
      })();

      panel.querySelector('#ws-notes-search').addEventListener('input', function() {
        const q = this.value.toLowerCase();
        render(q ? notes.filter(function(n) {
          return n.title.toLowerCase().indexOf(q) !== -1 ||
                 n.preview.toLowerCase().indexOf(q) !== -1 ||
                 (n.tag && n.tag.indexOf(q) !== -1);
        }) : notes);
      });

      // Refresh notes when Deep Research script reports a new result
      document.addEventListener('deep-search-result-received', function() {
        fetchNotes().then(function(result) {
          if (result.error) {
            updateSubtitle(notes.length, result.error);
            return;
          }
          notes = result.notes || [];
          updateSubtitle(notes.length, null);
          render(notes);
        });
      });

      // Refresh notes when add-note panel saves (create/update)
      document.addEventListener('ws-note-saved', function() {
        fetchNotes().then(function(result) {
          if (result.error) {
            updateSubtitle(notes.length, result.error);
            return;
          }
          notes = result.notes || [];
          updateSubtitle(notes.length, null);
          render(notes);
        });
      });

      // --- Toggle ---
      let open = true;
      document.body.classList.add('ws-notes-open');

      toggle.addEventListener('click', function() {
        open = !open;
        panel.classList.toggle('collapsed', !open);
        toggle.classList.toggle('collapsed', !open);
        document.body.classList.toggle('ws-notes-open', open);
      });
    }
  
    // =========================================================
    //  WAIT STRATEGY — MutationObserver + fallback polling
    // =========================================================
    function tryInject() {
      // Wait until React has rendered real page content inside #root
      const root = document.getElementById('root');
      if (root && root.children.length > 0) {
        injectPanel();
        return true;
      }
      return false;
    }
  
    // Attempt on various DOM ready events
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      if (!tryInject()) startObserver();
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (!tryInject()) startObserver();
      });
    }
  
    function startObserver() {
      // MutationObserver watches for React rendering into #root
      const observer = new MutationObserver(function(mutations) {
        if (tryInject()) {
          observer.disconnect();
          clearInterval(pollId);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
  
      // Fallback: poll every 500ms for up to 30s
      let elapsed = 0;
      var pollId = setInterval(function() {
        elapsed += 500;
        if (tryInject() || elapsed > 30000) {
          clearInterval(pollId);
          observer.disconnect();
        }
      }, 500);
    }
  
    // Also handle SPA navigation (React router changes URL without reload)
    let lastUrl = location.href;
    new MutationObserver(function() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Remove old panel if navigating away, re-inject if on security page
        const old = document.getElementById('ws-notes-panel');
        const oldBtn = document.getElementById('ws-notes-toggle');
        if (old) old.remove();
        if (oldBtn) oldBtn.remove();
        document.body.classList.remove('ws-notes-open');
        if (/\/app\/security-details\//.test(location.href)) {
          setTimeout(function() { tryInject(); }, 1000);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  
  })();