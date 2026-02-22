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
          return {
            cache_key: n.cache_key || '',
            title: (n.cache_key || 'Unknown').trim(),
            preview: preview || 'No preview',
            content: fullText || 'No content',
            tag: 'research',
            dateStr: formatDate(n.created_at),
            pinned: false,
            sec_id: n.sec_id || null,
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
                '<a class="ws-notes-modal-btn" id="ws-notes-modal-view-company" href="#" style="display:none" title="Open company security details">View company</a>' +
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

        // View company button: use note's sec_id, or current page sec_id when on security-details (for notes cached without sec_id)
        const viewCompanyEl = backdrop.querySelector('#ws-notes-modal-view-company');
        if (viewCompanyEl) {
          var secId = note.sec_id || getSymbolFromUrl();
          if (secId) {
            viewCompanyEl.href = 'https://my.wealthsimple.com/app/security-details/' + encodeURIComponent(secId);
            viewCompanyEl.style.display = '';
          } else {
            viewCompanyEl.href = '#';
            viewCompanyEl.style.display = 'none';
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
        subtitle.textContent = count + ' note' + (count !== 1 ? 's' : '') + sym;
      }

      function render(arr) {
        list.innerHTML = '';
        if (arr.length === 0) {
          list.innerHTML = '<div class="ws-note-item" style="color:#94908d;cursor:default;">No notes to show</div>';
          return;
        }
        arr.forEach(function(note, idx) {
          const item = document.createElement('div');
          item.className = 'ws-note-item' + (note.pinned ? ' pinned' : '');
          item.innerHTML =
            '<div class="ws-note-title"><span class="ws-note-pin">\u{1F4CC} </span>' + note.title + '</div>' +
            '<div class="ws-note-preview">' + note.preview + '</div>' +
            '<div class="ws-note-meta">' +
              '<span class="ws-note-tag ' + note.tag + '">' + note.tag + '</span>' +
              '<span>' + note.dateStr + '</span>' +
            '</div>';
          list.appendChild(item);
          item.addEventListener('click', function() {
            openModal(note);
          });
          if (idx < arr.length - 1) {
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