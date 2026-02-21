// ==UserScript==
// @name         Wealthsimple Notes Panel
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds a notes panel on the left side of Wealthsimple security detail pages
// @author       You
// @match        https://my.wealthsimple.com/app/security-details/*
// @grant        GM_addStyle
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
    `;
    (document.head || document.documentElement).appendChild(STYLE);
  
    // =========================================================
    //  DATA — generate 100 sample notes
    // =========================================================
    const tags = ['buy','sell','hold','research','dividend','earnings','risk','general'];
    const titles = [
      'Q3 earnings beat expectations','Dividend increase announced','Fleet electrification opportunity',
      'Valuation looks stretched','Strong revenue growth trend','Management guidance raised',
      'Competitor analysis update','Technical breakout above $33','Insider buying activity',
      'Debt reduction progress','New client contract signed','Margin expansion continues',
      'Sector rotation risk','Interest rate sensitivity','Share buyback program active',
      'Analyst upgrade from TD','ESG rating improved','Free cash flow strong',
      'Supply chain headwinds easing','P/E ratio vs peers comparison','EV transition tailwinds',
      'Quarterly dividend reinvested','Position sizing review','Stop-loss level adjustment',
      'Earnings call key takeaways','Revenue per vehicle increasing','Operating leverage kicking in',
      'Watch for next ex-div date','Tariff impact assessment','Currency hedge considerations',
      'Book value per share growing','Customer retention rate high','Technology platform upgrade',
      'Acquisition pipeline rumors','Capital allocation strategy','ROE trending above 18%',
      'Organic growth acceleration','Fleet size expansion noted','Cost synergies realized',
      'Institutional ownership up','Short interest declining','Options activity unusual',
      'Resistance at $38 level','Support zone near $30','Moving average crossover',
      'RSI approaching overbought','Volume spike analysis','Sector ETF correlation check',
      'Tax-loss harvesting candidate','DRIP reinvestment tracked',
    ];
    const previews = [
      'Element reported EPS of $0.32 vs expected $0.28. Revenue came in at $580M above consensus...',
      'Board approved a 15% increase in quarterly dividend to $0.13 per share reflecting confidence...',
      'Fleet management companies stand to benefit from the EV transition as fleet operators need guidance...',
      'At 22.8x P/E the stock is trading above its 5-year average of 18x. Need continued growth...',
      'Revenue has grown at a 12% CAGR over the past 3 years. Recurring revenue model provides visibility...',
      'Management raised full-year guidance by 5% on strong demand for fleet optimization services...',
      'ARI and Wheels Donlen are closest competitors. EFN has scale advantages with 1.5M+ vehicles...',
      'Stock broke above $33 resistance on heavy volume. Next target is 52-week high of $38.26...',
      'CEO purchased 50,000 shares on the open market at $31.50. CFO also bought 20,000 shares...',
      'Net debt to EBITDA improved from 3.2x to 2.8x. Company targeting 2.5x by year-end...',
      'Signed multi-year agreement with Fortune 500 company for 15,000 vehicles. Estimated annual...',
      'Operating margins expanded 150bps YoY driven by technology platform efficiencies and scale...',
      'Growth to value rotation could pressure the stock short-term. Monitor sector flows closely...',
      'Rising rates increase borrowing costs for fleet financing. Each 25bps hike impacts margins...',
      'Company has repurchased $150M worth of shares YTD under the NCIB program. Accretive to EPS...',
      'TD Securities raised target to $40 from $36 citing improved fleet demand and margin trajectory...',
      'MSCI upgraded ESG rating from BBB to A which could attract more institutional capital flows...',
      'FCF yield of 6.2% compares favorably to peers. Strong conversion ratio of 85% from op CF...',
      'Chip shortages easing which means faster vehicle deliveries and reduced order backlogs...',
      'EFN trades at 22.8x vs peer average of 20x but has superior growth. Premium may be warranted...',
    ];
  
    function rndDate(daysBack) {
      const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random() * daysBack)); return d;
    }
    function fmt(d) {
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    function makeNotes(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const d = rndDate(365);
        out.push({
          title: titles[i % titles.length] + (i >= titles.length ? ' (#' + (i+1) + ')' : ''),
          preview: previews[i % previews.length],
          tag: tags[i % tags.length],
          date: d, dateStr: fmt(d),
          pinned: i < 3,
        });
      }
      out.sort((a,b) => (a.pinned&&!b.pinned?-1:!a.pinned&&b.pinned?1:b.date-a.date));
      return out;
    }
  
    const notes = makeNotes(100);
  
    // =========================================================
    //  DOM INJECTION — wait for #root to appear, then inject
    // =========================================================
    function injectPanel() {
      // Guard: only inject once
      if (document.getElementById('ws-notes-panel')) return;
  
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
          '<p>' + notes.length + ' notes \u00B7 EFN</p>' +
        '</div>' +
        '<input id="ws-notes-search" type="text" placeholder="Search notes..." />' +
        '<div id="ws-notes-list"></div>';
      document.body.appendChild(panel);
  
      const list = panel.querySelector('#ws-notes-list');
  
      function render(arr) {
        list.innerHTML = '';
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
          if (idx < arr.length - 1) {
            const div = document.createElement('div');
            div.className = 'ws-note-divider';
            list.appendChild(div);
          }
        });
      }
  
      render(notes);
  
      panel.querySelector('#ws-notes-search').addEventListener('input', function() {
        const q = this.value.toLowerCase();
        render(q ? notes.filter(function(n) {
          return n.title.toLowerCase().indexOf(q) !== -1 ||
                 n.preview.toLowerCase().indexOf(q) !== -1 ||
                 n.tag.indexOf(q) !== -1;
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