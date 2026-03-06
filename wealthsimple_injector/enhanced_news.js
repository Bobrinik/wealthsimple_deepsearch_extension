// ==UserScript==
// @name        News Section - High Density Override
// @version     1.2
// @description Replaces the default News section with a high-density compacted news feed
// @match       *://*/*
// @run-at      document-idle
// @grant       none
// ==/UserScript==

(function () {
    'use strict';
  
    /* ── Config ─────────────────────────────────────────────────── */
  
    const POLL_MS     = 600;
    const CONTAINER_ID = 'gm-news-override';
    const STYLE_ID     = 'gm-news-styles';
    const API_BASE    = 'http://localhost:8000';
  
    /* ── Logging ────────────────────────────────────────────────── */
  
    const VER = '1.2';
    const log = (...a) => console.log(`[NewsOverride v${VER}]`, ...a);
  
    /* ── Helpers ─────────────────────────────────────────────────── */
  
    function isSecurityPage() {
      return /\/security-details\/sec-s-/.test(location.pathname);
    }
  
    function getTickerFromPage() {
      // Try to grab ticker from the page heading (e.g. "About EFN" → "EFN")
      for (const h2 of document.querySelectorAll('h2')) {
        const m = h2.textContent.trim().match(/^About\s+(.+)/i);
        if (m) return m[1];
      }
      // Fallback: first bold ticker-like text
      const el = document.querySelector('[data-testid="security-logo-image"]');
      return el?.alt ?? 'UNKNOWN';
    }
  
    /* ── Find the News section ──────────────────────────────────── */
  
    function findNewsSection() {
      // Look for the unmask div that contains a <p> with text "News"
      for (const div of document.querySelectorAll('div[data-fs-privacy-rule="unmask"]')) {
        const inner = div.querySelector('div');
        if (!inner) continue;
        const p = inner.querySelector(':scope > p');
        if (p && p.textContent.trim() === 'News') return div;
      }
      // Fallback: any container with a direct <p> child = "News"
      for (const p of document.querySelectorAll('p')) {
        if (p.textContent.trim() === 'News' && p.parentElement?.parentElement) {
          const candidate = p.parentElement.parentElement;
          if (candidate.querySelector('button')) return candidate;
        }
      }
      return null;
    }
  
    /* ── Fetch news from backend ─────────────────────────────────── */

    function formatTime(publishedDate) {
      const date = new Date(publishedDate.replace(' ', 'T'));
      const mins = Math.floor((Date.now() - date.getTime()) / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
      return `${Math.floor(mins / 1440)}d ago`;
    }

    async function fetchNews(ticker) {
      const url = `${API_BASE}/news?symbol=${encodeURIComponent(ticker)}&limit=100`;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    }
  
    /* ── Styles ─────────────────────────────────────────────────── */
  
    function ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        #${CONTAINER_ID} {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: rgba(255,255,255,.92);
        }
  
        .gm-news-header {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 8px;
        }
        .gm-news-header-title {
          font-size: 20px; font-weight: 700; color: #fff;
          margin: 0; padding: 0;
        }
        .gm-news-header-count {
          font-size: 11px; color: rgba(255,255,255,.35);
          letter-spacing: .3px;
        }
  
        .gm-news-list {
          display: flex; flex-direction: column;
          gap: 1px;
          background: rgba(255,255,255,.04);
          border-radius: 6px;
          overflow: hidden;
        }
  
        .gm-news-item {
          display: grid;
          grid-template-columns: 54px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          background: rgba(13,13,13,.95);
          cursor: pointer;
          transition: background .12s;
          min-height: 0;
        }
        .gm-news-item:hover {
          background: rgba(30,30,30,.95);
        }
  
        .gm-news-src {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,.40);
          letter-spacing: .2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
  
        .gm-news-title {
          font-size: 12px;
          font-weight: 400;
          color: rgba(255,255,255,.82);
          line-height: 1.3;
          margin: 0;
          /* Clamp to 1 line for density */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
  
        .gm-news-time {
          font-size: 10px;
          color: rgba(255,255,255,.28);
          white-space: nowrap;
          min-width: 36px;
          text-align: right;
          flex-shrink: 0;
        }
  
        .gm-news-footer {
          display: flex;
          justify-content: center;
          padding-top: 6px;
        }
        .gm-news-footer-btn {
          background: none; border: none; cursor: pointer;
          font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,.35);
          letter-spacing: .3px;
          padding: 4px 12px;
          border-radius: 4px;
          transition: color .15s, background .15s;
        }
        .gm-news-footer-btn:hover {
          color: rgba(255,255,255,.65);
          background: rgba(255,255,255,.06);
        }

        .gm-news-loading, .gm-news-error {
          padding: 16px 10px;
          font-size: 12px;
          color: rgba(255,255,255,.5);
          text-align: center;
        }
        .gm-news-error { color: rgba(255,180,100,.9); }
      `;
      document.head.appendChild(s);
    }
  
    /* ── Render ─────────────────────────────────────────────────── */

    const LIST_AREA_CLASS = 'gm-news-list-area';

    function renderNews(ticker) {
      const container = document.createElement('div');
      container.id = CONTAINER_ID;

      const header = document.createElement('div');
      header.className = 'gm-news-header';
      header.innerHTML = `
        <p class="gm-news-header-title">News</p>
        <span class="gm-news-header-count gm-news-count">—</span>
      `;
      container.appendChild(header);

      const listArea = document.createElement('div');
      listArea.className = LIST_AREA_CLASS;
      listArea.innerHTML = '<div class="gm-news-loading">Loading…</div>';
      container.appendChild(listArea);

      const footer = document.createElement('div');
      footer.className = 'gm-news-footer';
      footer.innerHTML = `<button class="gm-news-footer-btn">View all news ›</button>`;
      container.appendChild(footer);

      return container;
    }

    function fillNewsList(container, items) {
      const listArea = container.querySelector(`.${LIST_AREA_CLASS}`);
      const countEl = container.querySelector('.gm-news-count');
      if (!listArea || !countEl) return;

      countEl.textContent = `${items.length} stories`;

      const list = document.createElement('div');
      list.className = 'gm-news-list';
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'gm-news-item';
        row.title = item.url || item.title;
        const timeStr = item.publishedDate ? formatTime(item.publishedDate) : '—';
        const src = (item.publisher || item.site || '—').replace(/"/g, '&quot;');
        const title = (item.title || '').replace(/"/g, '&quot;');
        row.innerHTML = `
          <span class="gm-news-src">${src}</span>
          <p class="gm-news-title" title="${title}">${title}</p>
          <span class="gm-news-time">${timeStr}</span>
        `;
        if (item.url) {
          row.addEventListener('click', () => window.open(item.url, '_blank', 'noopener'));
        }
        list.appendChild(row);
      }
      listArea.innerHTML = '';
      listArea.appendChild(list);
    }

    function showNewsError(container, err) {
      const listArea = container.querySelector(`.${LIST_AREA_CLASS}`);
      const countEl = container.querySelector('.gm-news-count');
      if (listArea) listArea.innerHTML = `<div class="gm-news-error">Could not load news. ${(err && err.message) || String(err)}</div>`;
      if (countEl) countEl.textContent = '0 stories';
    }
  
    /* ═══════════════════════════════════════════════════════════════
       MAIN LOOP — same pattern as the Deep Research button script.
       Every POLL_MS:
         1. On a security page?
         2. News section exists?
         3. Already replaced?
         If 1+2 yes and 3 no → replace.
       ═══════════════════════════════════════════════════════════════ */
  
    let lastSecId  = null;
    let loopCount  = 0;
  
    function tick() {
      loopCount++;
  
      if (!isSecurityPage()) return;
  
      const curSecId = (location.pathname.match(/sec-s-[a-f0-9]+/i) || [null])[0];
  
      // Security changed → reset
      if (curSecId !== lastSecId) {
        if (lastSecId !== null) log(`Security changed → ${curSecId}`);
        lastSecId = curSecId;
        document.getElementById(CONTAINER_ID)?.remove();
      }
  
      // Already injected?
      if (document.getElementById(CONTAINER_ID)) return;
  
      // Find original News section
      const newsSection = findNewsSection();
      if (!newsSection) {
        if (loopCount % 16 === 0) log(`tick #${loopCount}: News section not in DOM yet`);
        return;
      }
  
      // Replace it
      const ticker = getTickerFromPage();
      log(`tick #${loopCount}: Found News section → replacing (ticker=${ticker}, sec=${curSecId})`);
  
      ensureStyles();

      const widget = renderNews(ticker);

      // Insert our widget and hide the original
      newsSection.parentElement.insertBefore(widget, newsSection);
      newsSection.style.display = 'none';
      newsSection.dataset.gmHidden = '1';

      log('✓ News section replaced');

      // Fetch from API and fill list
      fetchNews(ticker)
        .then((items) => fillNewsList(widget, items))
        .catch((err) => {
          log('News fetch failed', err);
          showNewsError(widget, err);
        });
    }
  
    /* ── Start ──────────────────────────────────────────────────── */
  
    log(`Loaded.  url=${location.href}`);
    setInterval(tick, POLL_MS);
    tick();
  
  })();