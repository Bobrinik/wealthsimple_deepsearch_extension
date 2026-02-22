// ==UserScript==
// @name        About Section - Deep Research Button
// @version     3.0
// @description Injects a Deep Research button under the About section, backed by a local smolagents server
// @match       *://*/*
// @run-at      document-idle
// @grant       none
// ==/UserScript==

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────── */

  const API_BASE   = 'http://localhost:8000';
  const HEALTH_URL = `${API_BASE}/health`;
  const RUN_URL    = `${API_BASE}/run`;
  const POLL_MS    = 600;
  const BTN_ID     = 'gm-deep-research-btn';

  /* ── Logging ────────────────────────────────────────────────── */

  const VER  = '3.0';
  const log  = (...a) => console.log(`[AboutScript v${VER}]`, ...a);
  const warn = (...a) => console.warn(`[AboutScript v${VER}]`, ...a);

  /* ── Styles (injected once) ─────────────────────────────────── */

  function ensureStyles() {
    if (document.getElementById('gm-styles')) return;
    const s = document.createElement('style');
    s.id = 'gm-styles';
    s.textContent = `
      #${BTN_ID} {
        display:inline-flex;align-items:center;gap:7px;
        margin-top:10px;padding:6px 14px;
        background:#141414;color:rgba(255,255,255,.9);
        font-weight:500;font-size:12px;letter-spacing:.35px;
        border:1px solid rgba(255,165,0,.35);border-radius:5px;
        cursor:pointer;outline:none;position:relative;
        transition:background .18s,border-color .18s,opacity .18s;
      }
      #${BTN_ID}:hover:not(:disabled){background:#1a1a1a;border-color:rgba(255,165,0,.55)}
      #${BTN_ID}:focus-visible{outline:2px solid rgba(255,165,0,.45);outline-offset:2px}
      #${BTN_ID}:disabled{opacity:.38;cursor:not-allowed;border-color:rgba(180,180,180,.25);filter:grayscale(1)}
      #${BTN_ID} svg{opacity:.75;flex-shrink:0}
      #gm-offline-badge{font-size:10px;font-weight:600;letter-spacing:.5px;color:rgba(255,80,80,.75);margin-left:2px}
      .gm-spinner{width:12px;height:12px;border:2px solid rgba(255,165,0,.2);border-top-color:rgba(255,165,0,.8);border-radius:50%;animation:gm-spin .7s linear infinite;flex-shrink:0}
      @keyframes gm-spin{to{transform:rotate(360deg)}}
      .gm-loading{transition:filter .35s,opacity .35s!important;filter:blur(4px)!important;opacity:.5!important;user-select:none;pointer-events:none}
      #gm-shimmer{position:absolute;inset:0;z-index:10;background:linear-gradient(105deg,transparent 30%,rgba(255,165,0,.07) 50%,transparent 70%);background-size:200% 100%;animation:gm-sweep 1.4s ease-in-out infinite;pointer-events:none;border-radius:inherit}
      @keyframes gm-sweep{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .gm-result-text{white-space:pre-wrap;animation:gm-fadein .5s ease forwards}
      @keyframes gm-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .gm-error-text{color:rgba(255,100,100,.85)!important;font-style:italic;animation:gm-fadein .4s ease forwards}
    `;
    document.head.appendChild(s);
  }

  /* ── Helpers ─────────────────────────────────────────────────── */

  const ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,165,0,.80)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

  function setIdle(b)    { b.disabled = false; b.innerHTML = `${ICON_SVG} Deep Research`; }
  function setLoading(b) { b.disabled = true;  b.innerHTML = `<span class="gm-spinner"></span> Researching…`; }
  function setOffline(b) { b.disabled = true;  b.innerHTML = `${ICON_SVG} Deep Research <span id="gm-offline-badge">OFFLINE</span>`; b.title = 'localhost:8000 unreachable'; }

  async function checkHealth() {
    try { const r = await fetch(HEALTH_URL, { method: 'GET', signal: AbortSignal.timeout(4000) }); return r.ok; }
    catch { return false; }
  }

  function getSecId() {
    const m = location.pathname.match(/\/security-details\/(sec-s-[a-f0-9]+)/i);
    return m ? m[1] : null;
  }

  function isSecurityPage() {
    return /\/security-details\/sec-s-/.test(location.pathname);
  }

  /* ── Find the About section ─────────────────────────────────── */

  function findAboutSection() {
    // Strategy 1: unmask div with h2 "about" + non-empty <p>
    for (const div of document.querySelectorAll('div[data-fs-privacy-rule="unmask"]')) {
      const h = div.querySelector('h2');
      if (h && h.textContent.trim().toLowerCase().includes('about')) {
        const p = div.querySelector('p');
        if (p && p.textContent.trim().length > 10) return div;
      }
    }
    // Strategy 2: any h2 "about" → check parent
    for (const h2 of document.querySelectorAll('h2')) {
      if (h2.textContent.trim().toLowerCase().includes('about')) {
        const parent = h2.parentElement;
        if (parent) {
          const p = parent.querySelector('p');
          if (p && p.textContent.trim().length > 10) return parent;
        }
      }
    }
    return null;
  }

  /* ── Card styling ───────────────────────────────────────────── */

  function applyCardStyling(sec) {
    if (sec.dataset.gmStyled) return;
    sec.dataset.gmStyled = '1';
    Object.assign(sec.style, {
      outline:'none', border:'1px solid rgba(255,255,255,.10)',
      borderLeft:'none', borderRadius:'6px',
      padding:'14px 16px 14px 20px',
      boxShadow:'0 0 0 1px rgba(255,255,255,.06) inset, 0 12px 40px rgba(0,0,0,.45)',
      position:'relative', overflow:'hidden',
    });
    const pip = document.createElement('span');
    pip.id = 'gm-accent-pip';
    Object.assign(pip.style, {
      position:'absolute',top:'12px',bottom:'12px',left:'0',
      width:'3px',background:'rgba(255,165,0,.45)',
      borderRadius:'0 2px 2px 0',filter:'blur(0.6px)',pointerEvents:'none',
    });
    sec.appendChild(pip);
  }

  /* ── Loading / result display ───────────────────────────────── */

  function startLoading(sec) {
    sec.classList.add('gm-loading');
    if (!document.getElementById('gm-shimmer')) {
      const sh = document.createElement('div'); sh.id = 'gm-shimmer'; sec.appendChild(sh);
    }
  }
  function stopLoading(sec) { sec.classList.remove('gm-loading'); document.getElementById('gm-shimmer')?.remove(); }
  function showResult(sec, text, err = false) {
    stopLoading(sec);
    const p = sec.querySelector('p');
    if (p) { p.className = ''; p.classList.add(err ? 'gm-error-text' : 'gm-result-text'); p.innerText = text; }
  }

  /* ── Extract text from section ──────────────────────────────── */

  function extractText(sec) {
    const clone = sec.cloneNode(true);
    clone.querySelectorAll('button').forEach(b => b.remove());
    return {
      heading: clone.querySelector('h2')?.textContent.trim() ?? '',
      body:    clone.querySelector('p')?.textContent.trim()  ?? '',
    };
  }

  /* ── Create button ──────────────────────────────────────────── */

  function createButton(section) {
    const btn = document.createElement('button');
    btn.id = BTN_ID;

    const { heading, body } = extractText(section);

    btn.addEventListener('click', async () => {
      const ok = await checkHealth();
      if (!ok) { setOffline(btn); return; }
      setLoading(btn);
      startLoading(section);
      const t0 = Date.now();
      const task = [heading ? `Company: ${heading}` : '', body ? `About: ${body}` : ''].filter(Boolean).join('\n');
      const minWait = async () => { const d = Date.now() - t0; if (d < 4000) await new Promise(r => setTimeout(r, 4000 - d)); };
      const secId = getSecId();
      try {
        const res = await fetch(RUN_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ task, sec_id: secId }) });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json();
        await minWait();
        showResult(section, data.result ?? 'No result returned.');
        document.dispatchEvent(new CustomEvent('deep-search-result-received', { detail: { result: data.result, sec_id: secId } }));
      } catch (e) {
        console.error('[AboutScript]', e);
        await minWait();
        showResult(section, `Research failed: ${e.message}`, true);
      } finally { setIdle(btn); }
    });

    return btn;
  }

  /* ═══════════════════════════════════════════════════════════════
     THE MAIN LOOP — runs every POLL_MS forever.

     On each tick:
       1. Am I on a /security-details/ page?    → if no, skip
       2. Does the About section exist in DOM?   → if no, skip
       3. Is my button already there?            → if yes, skip
       4. Otherwise → inject the button

     This handles: initial load, SPA navigation, React re-renders
     that destroy the button — all with zero navigation detection.
     ═══════════════════════════════════════════════════════════════ */

  let lastSecId     = null;
  let healthChecked = false;
  let serverHealthy = false;
  let loopCount     = 0;

  async function tick() {
    loopCount++;

    // 1) Only act on security pages
    if (!isSecurityPage()) return;

    const curSecId = getSecId();

    // 2) If sec-id changed, reset health cache and clean up
    if (curSecId !== lastSecId) {
      if (lastSecId !== null) log(`Security changed: ${lastSecId} → ${curSecId}`);
      lastSecId = curSecId;
      healthChecked = false;
      // Remove stale button (might belong to old security)
      document.getElementById(BTN_ID)?.remove();
    }

    // 3) Button already present and in the DOM? → nothing to do
    const existing = document.getElementById(BTN_ID);
    if (existing && document.body.contains(existing)) return;

    // 4) Find the About section
    const section = findAboutSection();
    if (!section) {
      if (loopCount % 16 === 0) log(`tick #${loopCount}: About section not in DOM yet`);
      return;
    }

    // 5) Inject!
    log(`tick #${loopCount}: Found About section → injecting (sec=${curSecId})`);

    ensureStyles();
    applyCardStyling(section);

    if (!healthChecked) {
      serverHealthy = await checkHealth();
      healthChecked = true;
      log(`Server health: ${serverHealthy}`);
    }

    const btn = createButton(section);
    serverHealthy ? setIdle(btn) : setOffline(btn);
    section.insertAdjacentElement('afterend', btn);

    log('✓ Button injected');
  }

  /* ── Start ──────────────────────────────────────────────────── */

  log(`Loaded.  url=${location.href}  readyState=${document.readyState}`);
  setInterval(tick, POLL_MS);
  tick();  // run once immediately

})();