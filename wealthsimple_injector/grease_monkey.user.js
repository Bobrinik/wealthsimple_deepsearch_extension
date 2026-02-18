// ==UserScript==
// @name        About Section - Deep Research Button
// @version     2.0
// @description Injects a Deep Research button under the About section, backed by a local smolagents server
// @match       *://*/*
// @run-at      document-idle
// @grant       none
// ==/UserScript==

(function () {
  'use strict';

  const API_BASE    = 'http://localhost:8000';
  const HEALTH_URL  = `${API_BASE}/health`;
  const RUN_URL     = `${API_BASE}/run`;

  // ── Health check ─────────────────────────────────────────────────────────────

  async function checkHealth() {
    try {
      const res = await fetch(HEALTH_URL, { method: 'GET', signal: AbortSignal.timeout(4000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────────

  function waitForAboutSection(callback, timeout = 15000) {
    function findAbout() {
      const candidates = document.querySelectorAll('div[data-fs-privacy-rule="unmask"]');
      for (const div of candidates) {
        const heading = div.querySelector('h2');
        if (heading && heading.textContent.trim().toLowerCase().includes('about')) {
          return div;
        }
      }
      return null;
    }

    const existing = findAbout();
    if (existing) { callback(existing); return; }

    const observer = new MutationObserver(() => {
      const el = findAbout();
      if (el) { observer.disconnect(); callback(el); }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), timeout);
  }

  function extractAboutText(sectionEl) {
    const clone = sectionEl.cloneNode(true);
    clone.querySelectorAll('button').forEach(btn => btn.remove());
    return {
      heading: clone.querySelector('h2')?.textContent.trim() ?? '',
      body:    clone.querySelector('p')?.textContent.trim()  ?? '',
    };
  }

  // ── Styles ────────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('gm-styles')) return;
    const style = document.createElement('style');
    style.id = 'gm-styles';
    style.textContent = `
      /* ── Button ─────────────────────────────────────────── */
      #gm-deep-research-btn {
        display:        inline-flex;
        align-items:    center;
        gap:            7px;
        margin-top:     10px;
        padding:        6px 14px;
        background:     #141414;
        color:          rgba(255,255,255,0.90);
        font-weight:    500;
        font-size:      12px;
        letter-spacing: 0.35px;
        border:         1px solid rgba(255,165,0,0.35);
        border-radius:  5px;
        cursor:         pointer;
        transition:     background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        outline:        none;
        position:       relative;
      }
      #gm-deep-research-btn:hover:not(:disabled) {
        background:   #1a1a1a;
        border-color: rgba(255,165,0,0.55);
      }
      #gm-deep-research-btn:focus-visible {
        outline:        2px solid rgba(255,165,0,0.45);
        outline-offset: 2px;
      }
      #gm-deep-research-btn:disabled {
        opacity: 0.38;
        cursor:  not-allowed;
        border-color: rgba(180,180,180,0.25);
        filter: grayscale(1);
      }
      #gm-deep-research-btn svg {
        opacity:     0.75;
        flex-shrink: 0;
      }

      /* Offline badge */
      #gm-offline-badge {
        font-size:      10px;
        font-weight:    600;
        letter-spacing: 0.5px;
        color:          rgba(255,80,80,0.75);
        margin-left:    2px;
      }

      /* ── Spinner ─────────────────────────────────────────── */
      .gm-spinner {
        width:  12px;
        height: 12px;
        border: 2px solid rgba(255,165,0,0.20);
        border-top-color: rgba(255,165,0,0.80);
        border-radius: 50%;
        animation: gm-spin 0.7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes gm-spin {
        to { transform: rotate(360deg); }
      }

      /* ── Loading state on the card ───────────────────────── */
      .gm-loading {
        transition: filter 0.35s ease, opacity 0.35s ease !important;
        filter:     blur(4px) !important;
        opacity:    0.5       !important;
        user-select: none;
        pointer-events: none;
      }

      /* Shimmer overlay */
      #gm-shimmer {
        position:   absolute;
        inset:      0;
        z-index:    10;
        background: linear-gradient(
          105deg,
          transparent              30%,
          rgba(255,165,0,0.07)     50%,
          transparent              70%
        );
        background-size: 200% 100%;
        animation:  gm-sweep 1.4s ease-in-out infinite;
        pointer-events: none;
        border-radius: inherit;
      }
      @keyframes gm-sweep {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* ── Result reveal ───────────────────────────────────── */
      .gm-result-text {
        white-space: pre-wrap;
        animation: gm-fadein 0.5s ease forwards;
      }
      @keyframes gm-fadein {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0);   }
      }

      /* ── Error state ─────────────────────────────────────── */
      .gm-error-text {
        color: rgba(255,100,100,0.85) !important;
        font-style: italic;
        animation: gm-fadein 0.4s ease forwards;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Card styling ──────────────────────────────────────────────────────────────

  function applyCardStyling(section) {
    Object.assign(section.style, {
      outline:      'none',
      border:       '1px solid rgba(255,255,255,0.10)',
      borderLeft:   'none',
      borderRadius: '6px',
      padding:      '14px 16px 14px 20px',
      boxShadow:    '0 0 0 1px rgba(255,255,255,0.06) inset, 0 12px 40px rgba(0,0,0,0.45)',
      position:     'relative',
      overflow:     'hidden',
    });

    if (!section.querySelector('#gm-accent-pip')) {
      const pip = document.createElement('span');
      pip.id = 'gm-accent-pip';
      Object.assign(pip.style, {
        position:      'absolute',
        top:           '12px',
        bottom:        '12px',
        left:          '0',
        width:         '3px',
        background:    'rgba(255,165,0,0.45)',
        borderRadius:  '0 2px 2px 0',
        filter:        'blur(0.6px)',
        pointerEvents: 'none',
      });
      section.appendChild(pip);
    }
  }

  // ── Loading / result helpers ──────────────────────────────────────────────────

  const ICON_SVG = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="rgba(255,165,0,0.80)" stroke-width="2.2"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>`;

  function setButtonIdle(btn) {
    btn.disabled = false;
    btn.innerHTML = `${ICON_SVG} Deep Research`;
  }

  function setButtonLoading(btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="gm-spinner"></span> Researching…`;
  }

  function setButtonOffline(btn) {
    btn.disabled = true;
    btn.innerHTML = `${ICON_SVG} Deep Research <span id="gm-offline-badge">OFFLINE</span>`;
    btn.title = 'Local research server is unreachable (localhost:8000)';
  }

  function startLoadingCard(section) {
    section.classList.add('gm-loading');
    const shimmer = document.createElement('div');
    shimmer.id = 'gm-shimmer';
    section.appendChild(shimmer);
  }

  function stopLoadingCard(section) {
    section.classList.remove('gm-loading');
    document.getElementById('gm-shimmer')?.remove();
  }

  function showResultInCard(section, text, isError = false) {
    stopLoadingCard(section);
    const p = section.querySelector('p');
    if (p) {
      p.classList.remove('gm-result-text', 'gm-error-text');
      // Force reflow so animation replays
      void p.offsetWidth;
      p.classList.add(isError ? 'gm-error-text' : 'gm-result-text');
      p.innerText = text;
    }
  }

  // ── Button injection ──────────────────────────────────────────────────────────

  function injectDeepResearchButton(section, heading, body, serverHealthy) {
    if (document.getElementById('gm-deep-research-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'gm-deep-research-btn';

    if (serverHealthy) {
      setButtonIdle(btn);
    } else {
      setButtonOffline(btn);
    }

    btn.addEventListener('click', async () => {
      // Re-check health right before firing
      const healthy = await checkHealth();
      if (!healthy) {
        setButtonOffline(btn);
        return;
      }

      setButtonLoading(btn);
      startLoadingCard(section);

      const task = [
        heading ? `Company: ${heading}` : '',
        body    ? `About: ${body}`      : '',
      ].filter(Boolean).join('\n');

      try {
        const res = await fetch(RUN_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ task }),
        });

        if (!res.ok) throw new Error(`Server responded ${res.status}`);

        const data = await res.json();
        showResultInCard(section, data.result ?? 'No result returned.');
      } catch (err) {
        console.error('[AboutScript] Research failed:', err);
        showResultInCard(section, `Research failed: ${err.message}`, true);
      } finally {
        setButtonIdle(btn);
      }
    });

    section.insertAdjacentElement('afterend', btn);
  }

  // ── Main ──────────────────────────────────────────────────────────────────────

  waitForAboutSection(async (section) => {
    const { heading, body } = extractAboutText(section);

    console.log(`[AboutScript] heading: ${heading}`);
    console.log(`[AboutScript] body: ${body}`);

    injectStyles();
    applyCardStyling(section);

    const serverHealthy = await checkHealth();
    console.log(`[AboutScript] server healthy: ${serverHealthy}`);

    injectDeepResearchButton(section, heading, body, serverHealthy);
  });

})();