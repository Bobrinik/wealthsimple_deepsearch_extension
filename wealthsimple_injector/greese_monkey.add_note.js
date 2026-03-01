// ==UserScript==
// @name         Wealthsimple Stock Annotations
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Rich text annotation panel with images, videos, links and formatting
// @author       You
// @match        https://my.wealthsimple.com/app/security-details/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';
  
    // ── Persistence bridge: parent page handles localStorage on behalf of iframe ──
    window.addEventListener('message', (e) => {
      if (!e.data || e.data.source !== 'ws-annot') return;
      const { action, key, value } = e.data;
      if (action === 'set') {
        try { localStorage.setItem(key, value); } catch (_) {}
      } else if (action === 'get') {
        let val = null;
        try { val = localStorage.getItem(key); } catch (_) {}
        e.source.postMessage({ source: 'ws-annot-reply', key, value: val }, '*');
      }
    });

    // ── Open existing note in the same panel (from notes list) ──────────────────
    window.addEventListener('ws-open-note-edit', (e) => {
      if (e.detail && e.detail.cache_key) {
        injectPanel({
          cache_key: e.detail.cache_key,
          content: e.detail.content != null ? e.detail.content : '',
          title: e.detail.title || e.detail.cache_key
        });
        const btn = document.getElementById('ws-annot-toggle');
        if (btn && btn.getAttribute('role') === 'tab') setTabActive(btn, true);
      }
    });
  
    // ── Extract ticker from URL e.g. /app/security-details/NYSE-WCP ──
    function getTicker() {
      const m = location.pathname.match(/security-details\/([^/?#]+)/);
      if (!m) return 'STOCK';
      const parts = m[1].split('-');
      return parts.length > 1 ? parts.slice(1).join('-') : m[1];
    }
  
    // ── Scrape company name from the page header DOM ──
    // Anchors on the stable data-testid="watchlist-cta" button, then walks
    // to the sibling <p> that holds the full company name.
    function getCompanyName() {
      try {
        const btn = document.querySelector('[data-testid="watchlist-cta"]');
        if (!btn) return '';
        // Structure: btn → div(icon wrap) → div.PlcCN → parent div → p(company name)
        const plcCN = btn.closest('div')?.parentElement;        // div.PlcCN
        const nameP = plcCN?.parentElement?.querySelector('p:last-of-type'); // "Whitecap Resources Inc."
        return nameP?.textContent?.trim() || '';
      } catch (_) { return ''; }
    }
  
    function buildHTML(ticker, companyName) {
      const storageKey = `ws-annot-${ticker}`;
      return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
    :root {
      --bg:        #141414;
      --surface:   #1c1c1c;
      --border:    #2e2e2e;
      --border2:   #3a3a3a;
      --text:      #e8e8e8;
      --muted:     #666;
      --accent:    #4f8ef7;
      --accent2:   #7c6af7;
      --danger:    #f74f4f;
      --success:   #4fcc8a;
      --toolbar-h: 48px;
      --header-h:  44px;
    }
  
    html, body {
      height: 100%; width: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 14px;
      overflow: hidden;
    }
  
    /* ── Layout ── */
    #shell {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
  
    /* ── Header ── */
    #header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      height: var(--header-h);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
  
    #ticker-icon {
      width: 26px; height: 26px;
      border: 1.5px solid var(--border2);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 8px;
      font-weight: 600;
      color: var(--accent);
      letter-spacing: -0.5px;
      flex-shrink: 0;
    }
  
    #ticker-label {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--text);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #ticker-label span {
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 11px;
      font-weight: 400;
      color: var(--muted);
      letter-spacing: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  
    #save-indicator {
      font-size: 10px;
      color: var(--muted);
      transition: color 0.3s;
    }
    #save-indicator.saved { color: var(--success); }
  
    #btn-close {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--muted);
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      transition: color 0.15s, background 0.15s;
    }
    #btn-close:hover { color: var(--danger); background: rgba(247,79,79,0.1); }
  
    /* ── Editor area ── */
    #editor-wrap {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      scrollbar-width: thin;
      scrollbar-color: var(--border2) transparent;
    }
  
    #editor {
      min-height: 100%;
      outline: none;
      line-height: 1.7;
      color: var(--text);
      font-size: 14px;
      font-family: 'IBM Plex Sans', sans-serif;
      word-break: break-word;
      white-space: pre-wrap;
    }
  
    #editor:empty::before {
      content: attr(data-placeholder);
      color: var(--muted);
      pointer-events: none;
    }
  
    /* ── Editor content styling ── */
    #editor h1 {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.3;
      margin: 8px 0 4px;
      color: var(--text);
      letter-spacing: -0.3px;
    }
    #editor h2 {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
      margin: 6px 0 3px;
      color: #bbb;
    }
    #editor strong { color: var(--text); }
    #editor em { color: #bbb; }
    #editor ul, #editor ol {
      padding-left: 22px;
      margin: 4px 0;
    }
    #editor li { margin: 2px 0; }
  
    #editor a {
      color: var(--accent);
      text-decoration: underline;
      text-decoration-color: rgba(79,142,247,0.4);
      text-underline-offset: 2px;
      transition: text-decoration-color 0.15s;
    }
    #editor a:hover { text-decoration-color: var(--accent); }
  
    /* ── Embedded image ── */
    .annot-img-wrap {
      margin: 10px 0;
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .annot-img-wrap img {
      max-width: 100%;
      border-radius: 6px;
      border: 1px solid var(--border2);
      display: block;
    }
    .annot-img-wrap .img-remove {
      position: absolute;
      top: 6px; right: 6px;
      background: rgba(0,0,0,0.75);
      border: none; border-radius: 4px;
      color: #fff; cursor: pointer;
      font-size: 11px; padding: 2px 7px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .annot-img-wrap:hover .img-remove { opacity: 1; }
  
    /* ── Embedded video ── */
    .annot-video-wrap {
      margin: 10px 0;
      position: relative;
    }
    .annot-video-wrap iframe {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 8px;
      border: 1px solid var(--border2);
      display: block;
    }
    .annot-video-wrap .vid-remove {
      position: absolute;
      top: 8px; right: 8px;
      background: rgba(0,0,0,0.75);
      border: none; border-radius: 4px;
      color: #fff; cursor: pointer;
      font-size: 11px; padding: 2px 7px;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .annot-video-wrap:hover .vid-remove { opacity: 1; }
  
    /* ── Toolbar ── */
    #toolbar {
      display: flex;
      align-items: center;
      gap: 1px;
      padding: 0 8px;
      height: var(--toolbar-h);
      background: var(--surface);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
      overflow: hidden;
    }
  
    .tb-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--muted);
      border-radius: 5px;
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .tb-btn:hover { color: var(--text); background: var(--border); }
    .tb-btn.active { color: var(--accent); background: rgba(79,142,247,0.12); }
    .tb-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  
    .tb-sep {
      width: 1px; height: 18px;
      background: var(--border2);
      margin: 0 3px;
      flex-shrink: 0;
    }
  
    #tb-spacer { flex: 1; min-width: 4px; }
  
    #btn-done {
      background: var(--accent);
      border: none; border-radius: 6px;
      color: #fff;
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 12px;
      font-weight: 500;
      padding: 5px 12px;
      cursor: pointer;
      transition: opacity 0.15s;
      flex-shrink: 0;
      white-space: nowrap;
    }
    #btn-done:hover { opacity: 0.85; }
  
    /* ── Modals ── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 999;
      backdrop-filter: blur(2px);
      animation: fadeIn 0.12s ease;
    }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  
    .modal {
      background: var(--surface);
      border: 1px solid var(--border2);
      border-radius: 10px;
      padding: 20px;
      width: min(340px, 90vw);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      animation: slideUp 0.15s ease;
    }
    @keyframes slideUp { from { transform: translateY(8px); opacity:0 } to { transform: translateY(0); opacity:1 } }
  
    .modal h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 14px;
    }
  
    .modal input[type="text"], .modal input[type="url"] {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border2);
      border-radius: 6px;
      color: var(--text);
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 13px;
      padding: 9px 12px;
      outline: none;
      margin-bottom: 10px;
      transition: border-color 0.15s;
    }
    .modal input:focus { border-color: var(--accent); }
  
    .modal-actions {
      display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;
    }
    .modal-actions button {
      border: none; border-radius: 6px;
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      padding: 7px 16px; cursor: pointer;
      transition: opacity 0.15s;
    }
    .modal-actions .btn-cancel { background: var(--border2); color: var(--text); }
    .modal-actions .btn-cancel:hover { opacity: 0.8; }
    .modal-actions .btn-confirm { background: var(--accent); color: #fff; }
    .modal-actions .btn-confirm:hover { opacity: 0.85; }
  
    /* file upload drop zone */
    .drop-zone {
      border: 2px dashed var(--border2);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      cursor: pointer;
      margin-bottom: 10px;
      transition: border-color 0.15s, background 0.15s;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: var(--accent);
      background: rgba(79,142,247,0.05);
      color: var(--text);
    }
    .drop-zone input { display: none; }
    .drop-zone-icon { font-size: 26px; margin-bottom: 6px; }
    .modal-or { text-align: center; color: var(--muted); font-size: 12px; margin: 8px 0; }
  </style>
  </head>
  <body>
  <div id="shell">
  
    <!-- Header -->
    <div id="header">
      <div id="ticker-icon" title="${String(ticker).replace(/"/g, '&quot;')}">◈</div>
      <div id="ticker-label" title="${String(ticker).replace(/"/g, '&quot;')}">${companyName || ticker}</div>
      <span id="save-indicator">—</span>
      <button id="btn-close" title="Close">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  
    <!-- Editor -->
    <div id="editor-wrap">
      <div id="editor" contenteditable="true"
        data-placeholder="What's your narrative on this stock's future?"></div>
    </div>
  
    <!-- Toolbar -->
    <div id="toolbar">
      <button class="tb-btn" id="tb-h1" title="Heading 1">H1</button>
      <button class="tb-btn" id="tb-h2" title="Heading 2">H2</button>
      <div class="tb-sep"></div>
      <button class="tb-btn" id="tb-bold" title="Bold">
        <svg viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
      </button>
      <button class="tb-btn" id="tb-italic" title="Italic">
        <svg viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
      </button>
      <div class="tb-sep"></div>
      <button class="tb-btn" id="tb-ul" title="Bullet list">
        <svg viewBox="0 0 24 24"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
      </button>
      <button class="tb-btn" id="tb-ol" title="Numbered list">
        <svg viewBox="0 0 24 24"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
      </button>
      <div class="tb-sep"></div>
      <button class="tb-btn" id="tb-img" title="Insert image">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </button>
      <button class="tb-btn" id="tb-link" title="Insert link">
        <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
      <button class="tb-btn" id="tb-video" title="Embed YouTube video">
        <svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="var(--bg)"/></svg>
      </button>
      <div id="tb-spacer"></div>
      <button id="btn-done">Save</button>
    </div>
  
  </div>
  
  <script>
  const STORAGE_KEY = ${JSON.stringify(storageKey)};
  const API_BASE = 'http://localhost:8000';
  const TICKER = ${JSON.stringify(ticker)};
  const COMPANY_NAME = ${JSON.stringify(companyName || '')};
  const editor = document.getElementById('editor');
  let saveTimer = null;
  let savedRange = null;
  let EDIT_EXISTING_CACHE_KEY = null;
  var initSignalReceived = false;
  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'ws-annot' && e.data.action === 'initExisting') {
      initSignalReceived = true;
      EDIT_EXISTING_CACHE_KEY = e.data.cache_key;
      var html = e.data.content || '';
      html = html.replace(/src=(["'])\\/notes\\/images\\//g, 'src=\$1' + API_BASE + '/notes/images/');
      editor.innerHTML = html;
      var lbl = document.getElementById('ticker-label');
      if (lbl && e.data.title) lbl.textContent = e.data.title;
      document.querySelectorAll('.img-remove, .vid-remove').forEach(attachRemoveBtn);
    }
    if (e.data && e.data.source === 'ws-annot' && e.data.action === 'initNew') {
      initSignalReceived = true;
      editor.innerHTML = '';
    }
  });

  // ── Persistence via postMessage to parent ──────────────────────────────────
  function saveToParent(html) {
    window.parent.postMessage({ source: 'ws-annot', action: 'set', key: STORAGE_KEY, value: html }, '*');
    var savePromise;
    if (EDIT_EXISTING_CACHE_KEY) {
      savePromise = fetch(API_BASE + '/notes/' + encodeURIComponent(EDIT_EXISTING_CACHE_KEY), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html })
      }).catch(function() {});
    } else {
      savePromise = fetch(API_BASE + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: TICKER, company_name: COMPANY_NAME || null, content: html, sec_id: null })
      }).catch(function() {});
    }
    const ind = document.getElementById('save-indicator');
    ind.textContent = 'Saved';
    ind.classList.add('saved');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() { ind.textContent = '—'; ind.classList.remove('saved'); }, 2000);
    return savePromise;
  }
  
  function loadFromParent() {
    return new Promise(resolve => {
      const handler = (e) => {
        if (e.data?.source === 'ws-annot-reply' && e.data.key === STORAGE_KEY) {
          window.removeEventListener('message', handler);
          resolve(e.data.value);
        }
      };
      window.addEventListener('message', handler);
      window.parent.postMessage({ source: 'ws-annot', action: 'get', key: STORAGE_KEY }, '*');
      setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 1500);
    });
  }
  
  // Only load from storage when not opening a clean new note (initNew) or existing note (initExisting)
  setTimeout(function() {
    if (initSignalReceived) return;
    loadFromParent().then(val => {
      if (val) editor.innerHTML = val;
      document.querySelectorAll('.img-remove, .vid-remove').forEach(attachRemoveBtn);
    });
  }, 150);
  
  // Auto-save on input
  editor.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveToParent(editor.innerHTML), 800);
  });
  
  // ── Save selection before toolbar button focus steals it ──────────────────
  editor.addEventListener('keyup', saveSelection);
  editor.addEventListener('mouseup', saveSelection);
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
  
  // ── Toolbar formatting ─────────────────────────────────────────────────────
  function execFmt(cmd, val) {
    restoreSelection();
    editor.focus();
    document.execCommand(cmd, false, val || null);
    saveToParent(editor.innerHTML);
  }
  
  document.getElementById('tb-h1').addEventListener('mousedown', e => { e.preventDefault(); execFmt('formatBlock', 'h1'); });
  document.getElementById('tb-h2').addEventListener('mousedown', e => { e.preventDefault(); execFmt('formatBlock', 'h2'); });
  document.getElementById('tb-bold').addEventListener('mousedown', e => { e.preventDefault(); execFmt('bold'); });
  document.getElementById('tb-italic').addEventListener('mousedown', e => { e.preventDefault(); execFmt('italic'); });
  document.getElementById('tb-ul').addEventListener('mousedown', e => { e.preventDefault(); execFmt('insertUnorderedList'); });
  document.getElementById('tb-ol').addEventListener('mousedown', e => { e.preventDefault(); execFmt('insertOrderedList'); });
  
  // ── Active state tracking ──────────────────────────────────────────────────
  editor.addEventListener('keyup', updateActiveStates);
  editor.addEventListener('mouseup', updateActiveStates);
  function updateActiveStates() {
    document.getElementById('tb-bold').classList.toggle('active', document.queryCommandState('bold'));
    document.getElementById('tb-italic').classList.toggle('active', document.queryCommandState('italic'));
    document.getElementById('tb-ul').classList.toggle('active', document.queryCommandState('insertUnorderedList'));
    document.getElementById('tb-ol').classList.toggle('active', document.queryCommandState('insertOrderedList'));
  }
  
  // ── Modal helper ───────────────────────────────────────────────────────────
  function showModal(html, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = \`<div class="modal">\${html}</div>\`;
    document.body.appendChild(overlay);
  
    overlay.querySelector('.btn-confirm')?.addEventListener('click', () => {
      onConfirm(overlay);
      overlay.remove();
    });
    overlay.querySelector('.btn-cancel')?.addEventListener('click', () => {
      if (onCancel) onCancel();
      overlay.remove();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) { if (onCancel) onCancel(); overlay.remove(); } });
    return overlay;
  }
  
  // ── Image insertion ────────────────────────────────────────────────────────
  document.getElementById('tb-img').addEventListener('click', () => {
    saveSelection();
    showModal(\`
      <h3>Insert Image</h3>
      <div class="drop-zone" id="drop-zone">
        <div class="drop-zone-icon">🖼</div>
        <div>Drop image here or click to upload</div>
        <input type="file" id="file-input" accept="image/*" />
      </div>
      <div class="modal-or">— or paste a URL —</div>
      <input type="url" id="img-url" placeholder="https://example.com/image.png" />
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Insert</button>
      </div>
    \`, (overlay) => {
      const url = overlay.querySelector('#img-url').value.trim();
      const file = overlay.querySelector('#file-input').files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => insertImage(e.target.result);
        reader.readAsDataURL(file);
      } else if (url) {
        insertImage(url);
      }
    });
  
    // Wire up drop zone
    setTimeout(() => {
      const dz = document.getElementById('drop-zone');
      const fi = document.getElementById('file-input');
      if (!dz || !fi) return;
      dz.addEventListener('click', () => fi.click());
      fi.addEventListener('change', () => {
        if (fi.files[0]) dz.querySelector('div:last-of-type').textContent = fi.files[0].name;
      });
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) {
          fi.files = e.dataTransfer.files;
          dz.querySelector('div:last-of-type').textContent = f.name;
        }
      });
    }, 50);
  });
  
  function attachRemoveBtn(btn) {
    btn.addEventListener('click', () => {
      btn.closest('.annot-img-wrap, .annot-video-wrap')?.remove();
      saveToParent(editor.innerHTML);
    });
  }
  
  function insertImage(src) {
    restoreSelection();
    editor.focus();
    const wrap = document.createElement('div');
    wrap.className = 'annot-img-wrap';
    wrap.contentEditable = 'false';
    const img = document.createElement('img');
    img.src = src;
    const rm = document.createElement('button');
    rm.className = 'img-remove';
    rm.textContent = '✕ Remove';
    attachRemoveBtn(rm);
    wrap.appendChild(img);
    wrap.appendChild(rm);
  
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(wrap);
      range.setStartAfter(wrap);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(wrap);
    }
    saveToParent(editor.innerHTML);
  }
  
  // ── Link insertion ─────────────────────────────────────────────────────────
  document.getElementById('tb-link').addEventListener('click', () => {
    saveSelection();
    const sel = window.getSelection();
    const selectedText = sel?.toString() || '';
    showModal(\`
      <h3>Insert Link</h3>
      <input type="text" id="link-text" placeholder="Link text" value="\${selectedText.replace(/"/g,'&quot;')}" />
      <input type="url" id="link-url" placeholder="https://example.com" />
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Insert</button>
      </div>
    \`, (overlay) => {
      const text = overlay.querySelector('#link-text').value.trim() || 'Link';
      const url  = overlay.querySelector('#link-url').value.trim();
      if (!url) return;
      restoreSelection();
      editor.focus();
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = text;
      const range = window.getSelection().getRangeAt(0);
      range.deleteContents();
      range.insertNode(a);
      range.setStartAfter(a);
      sel.removeAllRanges();
      sel.addRange(range);
      saveToParent(editor.innerHTML);
    });
  });
  
  // ── YouTube insertion ──────────────────────────────────────────────────────
  document.getElementById('tb-video').addEventListener('click', () => {
    saveSelection();
    showModal(\`
      <h3>Embed YouTube Video</h3>
      <input type="url" id="yt-url" placeholder="https://youtube.com/watch?v=..." />
      <div class="modal-actions">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-confirm">Embed</button>
      </div>
    \`, (overlay) => {
      const raw = overlay.querySelector('#yt-url').value.trim();
      const vid = extractYouTubeId(raw);
      if (!vid) { alert('Could not find a YouTube video ID in that URL.'); return; }
      insertVideo(vid);
    });
  });
  
  function extractYouTubeId(url) {
    const patterns = [
      /youtu\\.be\\/([\\w-]{11})/,
      /[?&]v=([\\w-]{11})/,
      /embed\\/([\\w-]{11})/,
      /shorts\\/([\\w-]{11})/,
    ];
    for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
    return null;
  }
  
  function insertVideo(videoId) {
    restoreSelection();
    editor.focus();
    const wrap = document.createElement('div');
    wrap.className = 'annot-video-wrap';
    wrap.contentEditable = 'false';
    const ifrm = document.createElement('iframe');
    ifrm.src = \`https://www.youtube-nocookie.com/embed/\${videoId}\`;
    ifrm.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    ifrm.allowFullscreen = true;
    ifrm.title = 'YouTube video';
    const rm = document.createElement('button');
    rm.className = 'vid-remove';
    rm.textContent = '✕ Remove';
    attachRemoveBtn(rm);
    wrap.appendChild(ifrm);
    wrap.appendChild(rm);
  
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(wrap);
      range.setStartAfter(wrap);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(wrap);
    }
    saveToParent(editor.innerHTML);
  }
  
  // ── Paste image support ────────────────────────────────────────────────────
  editor.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = ev => insertImage(ev.target.result);
        reader.readAsDataURL(item.getAsFile());
        return;
      }
    }
  });
  
  // ── Close / bell ───────────────────────────────────────────────────────────
  document.getElementById('btn-close').addEventListener('click', function() {
    window.parent.postMessage({ source: 'ws-annot', action: 'close' }, '*');
  });
  document.getElementById('btn-done').addEventListener('click', function() {
    var p = saveToParent(editor.innerHTML);
    Promise.resolve(p).then(function() {
      window.parent.postMessage({ source: 'ws-annot', action: 'close' }, '*');
    }, function() {
      window.parent.postMessage({ source: 'ws-annot', action: 'close' }, '*');
    });
  });
  </script>
  </body>
  </html>`;
    }
  
    function injectPanel(existingNote) {
      // If opening an existing note from the notes list, replace any current panel
      if (existingNote) {
        const existing = document.getElementById('ws-annot-container');
        if (existing) {
          existing.remove();
          const revoke = existing.getAttribute('data-blob-url');
          if (revoke) URL.revokeObjectURL(revoke);
        }
      } else if (document.getElementById('ws-annot-container')) {
        return;
      }

      const ticker = existingNote ? (existingNote.ticker || getTicker()) : getTicker();
      const companyName = existingNote ? (existingNote.companyName || existingNote.title || getCompanyName()) : getCompanyName();
      const htmlContent = buildHTML(ticker, companyName);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
  
      const MIN_W = 320, MIN_H = 260;
  
      const container = document.createElement('div');
      container.id = 'ws-annot-container';
      Object.assign(container.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '420px',
        height: '480px',
        zIndex: '2147483647',
        background: '#141414',
        border: '1px solid #2e2e2e',
        borderRadius: '10px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.85)',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
      });
  
      // ── Iframe ──────────────────────────────────────────────────────────────
      const iframeWrap = document.createElement('div');
      Object.assign(iframeWrap.style, {
        flex: '1', overflow: 'hidden',
        borderRadius: '10px', position: 'relative',
      });
      container.appendChild(iframeWrap);
  
      const iframe = document.createElement('iframe');
      Object.assign(iframe.style, {
        border: 'none', width: '100%', height: '100%', display: 'block',
      });
      iframe.src = blobUrl;
      iframe.sandbox = "allow-scripts allow-same-origin allow-modals allow-popups allow-downloads allow-forms allow-pointer-lock";
      iframe.setAttribute('allow', 'clipboard-read; clipboard-write;');
      iframeWrap.appendChild(iframe);
      container.setAttribute('data-blob-url', blobUrl);
      document.body.appendChild(container);

      if (existingNote && existingNote.cache_key) {
        iframe.addEventListener('load', function onLoad() {
          iframe.removeEventListener('load', onLoad);
          try {
            iframe.contentWindow.postMessage({
              source: 'ws-annot',
              action: 'initExisting',
              cache_key: existingNote.cache_key,
              content: existingNote.content || '',
              title: existingNote.title || ''
            }, '*');
          } catch (_) {}
        });
      } else {
        iframe.addEventListener('load', function onLoad() {
          iframe.removeEventListener('load', onLoad);
          try {
            iframe.contentWindow.postMessage({ source: 'ws-annot', action: 'initNew' }, '*');
          } catch (_) {}
        });
      }
  
      // ── Close via postMessage from iframe ────────────────────────────────────
      window.addEventListener('message', (e) => {
        if (e.data?.source === 'ws-annot' && e.data.action === 'close') {
          const url = container.getAttribute('data-blob-url');
          container.remove();
          if (url) URL.revokeObjectURL(url);
        }
      });
  
      // ── 8-direction resize handles ───────────────────────────────────────────
      const HANDLES = [
        { id: 'n',  cursor: 'n-resize',  top: true,  right: false, bottom: false, left: false },
        { id: 's',  cursor: 's-resize',  top: false, right: false, bottom: true,  left: false },
        { id: 'e',  cursor: 'e-resize',  top: false, right: true,  bottom: false, left: false },
        { id: 'w',  cursor: 'w-resize',  top: false, right: false, bottom: false, left: true  },
        { id: 'ne', cursor: 'ne-resize', top: true,  right: true,  bottom: false, left: false },
        { id: 'nw', cursor: 'nw-resize', top: true,  right: false, bottom: false, left: true  },
        { id: 'se', cursor: 'se-resize', top: false, right: true,  bottom: true,  left: false },
        { id: 'sw', cursor: 'sw-resize', top: false, right: false, bottom: true,  left: true  },
      ];
  
      HANDLES.forEach(h => {
        const E = 6, C = 14;
        const el = document.createElement('div');
        const isCorner = h.id.length === 2;
        Object.assign(el.style, {
          position: 'absolute', zIndex: '10', cursor: h.cursor,
          ...(isCorner ? { width: C + 'px', height: C + 'px' } : {}),
          ...((!isCorner && (h.top || h.bottom)) ? { height: E + 'px', left: C + 'px', right: C + 'px' } : {}),
          ...((!isCorner && (h.left || h.right)) ? { width: E + 'px', top: C + 'px', bottom: C + 'px' } : {}),
          ...(h.top    ? { top:    `-${E}px` } : {}),
          ...(h.bottom ? { bottom: `-${E}px` } : {}),
          ...(h.left   ? { left:   `-${E}px` } : {}),
          ...(h.right  ? { right:  `-${E}px` } : {}),
        });
        container.appendChild(el);
  
        let resizing = false, sX, sY, sW, sH, sR, sB;
        el.addEventListener('pointerdown', e => {
          e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
          resizing = true;
          sX = e.clientX; sY = e.clientY;
          const r = container.getBoundingClientRect();
          sW = r.width; sH = r.height;
          sR = window.innerWidth - r.right;
          sB = window.innerHeight - r.bottom;
          el.setPointerCapture(e.pointerId);
          iframe.style.pointerEvents = 'none';
        });
        el.addEventListener('pointermove', e => {
          if (!resizing) return;
          const dx = e.clientX - sX, dy = e.clientY - sY;
          if (h.right)  container.style.width  = Math.max(MIN_W, sW + dx) + 'px';
          if (h.bottom) container.style.height = Math.max(MIN_H, sH + dy) + 'px';
          if (h.left) {
            const nw = Math.max(MIN_W, sW - dx);
            container.style.width = nw + 'px';
            container.style.right = (sR + sW - nw) + 'px';
          }
          if (h.top) {
            const nh = Math.max(MIN_H, sH - dy);
            container.style.height = nh + 'px';
            container.style.bottom = (sB + sH - nh) + 'px';
          }
        });
        el.addEventListener('pointerup', () => { resizing = false; iframe.style.pointerEvents = ''; });
        el.addEventListener('pointercancel', () => { resizing = false; iframe.style.pointerEvents = ''; });
      });
  
      // ── Event isolation (bubble phase) ──────────────────────────────────────
      ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove',
       'click','dblclick','wheel','keydown','keyup','touchstart','touchmove','touchend'].forEach(ev => {
        container.addEventListener(ev, e => {
          e.stopImmediatePropagation(); e.stopPropagation();
        }, false);
      });
  
      // ── Focus ────────────────────────────────────────────────────────────────
      const focusIframe = () => { try { iframe.contentWindow?.focus(); } catch (_) {} };
      iframe.addEventListener('load', () => setTimeout(focusIframe, 200));
      container.addEventListener('mouseenter', focusIframe);
      container.addEventListener('pointerdown', focusIframe);
    }
  
    // ── Build the inline "Add note" tab button ───────────────────────────────
    function buildTabButton() {
      const btn = document.createElement('button');
      btn.id = 'ws-annot-toggle';
  
      // Mirror the Wealthsimple tab button structure exactly
      btn.type = 'button';
      btn.role = 'tab';
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
  
      // Inner wrapper matching WS tab DOM: <div><p>Add note</p></div>
      const inner = document.createElement('div');
      // Copy the layout classes pattern WS uses for inactive tabs
      Object.assign(inner.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      });
  
      const pencilSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.75"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
  
      inner.innerHTML = pencilSvg + '<span>Add note</span>';
      btn.appendChild(inner);
  
      // Ghost / outlined style: yellow border, transparent fill, yellow text
      Object.assign(btn.style, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '0 14px',
        height: '28px',
        alignSelf: 'center',
        background: 'transparent',
        border: '1.5px solid #F5C842',
        borderRadius: '8px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '13px',
        fontWeight: '600',
        color: '#F5C842',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        outline: 'none',
        flexShrink: '0',
        letterSpacing: '-0.01em',
        marginLeft: '8px',
      });
  
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(245,200,66,0.10)';
      });
      btn.addEventListener('mouseleave', () => {
        if (!document.getElementById('ws-annot-container')) {
          btn.style.background = 'transparent';
        }
      });
  
      btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        e.stopPropagation();
        const existing = document.getElementById('ws-annot-container');
        if (existing) {
          existing.remove();
          setTabActive(btn, false);
        } else {
          injectPanel();
          setTabActive(btn, true);
        }
      });
  
      return btn;
    }
  
    function setTabActive(btn, active) {
      if (active) {
        btn.style.background = 'rgba(245,200,66,0.15)';
        btn.style.color = '#F5C842';
        btn.style.borderColor = '#F5C842';
        btn.setAttribute('aria-selected', 'true');
        btn.querySelector('span').textContent = 'Hide note';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#F5C842';
        btn.style.borderColor = '#F5C842';
        btn.setAttribute('aria-selected', 'false');
        btn.querySelector('span').textContent = 'Add note';
      }
    }
  
    // ── Inject the toggle button into the Buy/Sell tablist ───────────────────
    function injectToggleButton() {
      if (document.getElementById('ws-annot-toggle')) return;
  
      // The tablist that contains Buy / Sell buttons
      const tablist = document.querySelector('[role="tablist"][data-scope="tabs"][data-part="list"]');
  
      if (tablist) {
        const btn = buildTabButton();
        // Match the tablist height so the bottom-border indicator aligns
        tablist.style.display = tablist.style.display || 'flex';
  
        tablist.appendChild(btn);
      } else {
        // ── Fallback: floating button if tablist not found ───────────────────
        const btn = document.createElement('button');
        btn.id = 'ws-annot-toggle';
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span>Add note</span>
        `;
        Object.assign(btn.style, {
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: '2147483646',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 22px',
          background: '#F5C842',
          color: '#3B2A00',
          border: 'none',
          borderRadius: '12px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          letterSpacing: '-0.01em',
        });
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'translateX(-50%) translateY(-2px)';
          btn.style.boxShadow = '0 8px 28px rgba(0,0,0,0.4)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'translateX(-50%)';
          btn.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)';
        });
        btn.addEventListener('click', (e) => {
          e.stopImmediatePropagation(); e.stopPropagation();
          const existing = document.getElementById('ws-annot-container');
          if (existing) {
            existing.remove();
            btn.querySelector('span').textContent = 'Add note';
          } else {
            injectPanel();
            btn.querySelector('span').textContent = 'Hide note';
          }
        });
        document.body.appendChild(btn);
      }
    }
  
    // Update toggle label/state when panel is closed via its own close button
    window.addEventListener('message', (e) => {
      if (e.data?.source === 'ws-annot' && e.data.action === 'close') {
        const btn = document.getElementById('ws-annot-toggle');
        if (!btn) return;
        if (btn.getAttribute('role') === 'tab') {
          setTabActive(btn, false);
        } else {
          btn.querySelector('span').textContent = 'Add note';
        }
      }
    });
  
    // ── Robust DOM observer: handles SPA navigation + React re-renders ─────────
    //
    // Strategy:
    //   • Watch every DOM mutation on the whole document.
    //   • On every mutation, if we're on a security-details page:
    //       - If the tablist exists but our button is missing → inject.
    //   • If we've navigated away → clean up.
    //
    // A short debounce prevents thrashing on rapid React patch bursts.
  
    let lastPath = '';
    let injectDebounce = null;
  
    function checkAndInject() {
      const onSecurityPage = /\/app\/security-details\//.test(location.href);
  
      if (!onSecurityPage) {
        // Navigated away — clean up
        document.getElementById('ws-annot-toggle')?.remove();
        document.getElementById('ws-annot-container')?.remove();
        return;
      }
  
      const tablist = document.querySelector('[role="tablist"][data-scope="tabs"][data-part="list"]');
      const alreadyThere = document.getElementById('ws-annot-toggle');
  
      // If the button exists but is floating (not inside the tablist), remove it
      // so we can re-inject it properly into the tablist once it's ready.
      if (alreadyThere && tablist && !tablist.contains(alreadyThere)) {
        alreadyThere.remove();
      }
  
      // Tablist is in the DOM but our button is missing (first load, React re-render,
      // or we just removed the misplaced floating fallback above)
      if (tablist && !document.getElementById('ws-annot-toggle')) {
        injectToggleButton();
      }
    }
  
    const observer = new MutationObserver(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
      }
      clearTimeout(injectDebounce);
      injectDebounce = setTimeout(checkAndInject, 100);
    });
  
    observer.observe(document.documentElement, { childList: true, subtree: true });
  
    // Also run immediately in case the page is already fully rendered
    checkAndInject();
  })();