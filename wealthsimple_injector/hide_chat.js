// ==UserScript==
// @name         Wealthsimple Chat Nuker v3
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Blocks Wealthsimple/Decagon AI chat widget via iframe, DOM, and request blocking
// @author       You
// @match        https://my.wealthsimple.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const BLOCKED_KEYWORDS = ['decagon.ai', 'team-theme', 'chat-widget', 'agent-chat'];

    // ─── 1. BLOCK IFRAMES ───────────────────────────────────────────────────────
    // Intercept iframe src assignment before they even load
    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        set(value) {
            if (BLOCKED_KEYWORDS.some(kw => value?.includes(kw))) {
                console.log('[Nuker] Blocked iframe src:', value);
                return; // silently swallow it
            }
            nativeDescriptor.set.call(this, value);
        },
        get() {
            return nativeDescriptor.get.call(this);
        }
    });

    // ─── 2. BLOCK SCRIPT TAGS ───────────────────────────────────────────────────
    // Same trick for scripts that load the chat SDK
    const nativeSrcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        set(value) {
            if (BLOCKED_KEYWORDS.some(kw => value?.includes(kw))) {
                console.log('[Nuker] Blocked script src:', value);
                return;
            }
            nativeSrcDesc.set.call(this, value);
        },
        get() {
            return nativeSrcDesc.get.call(this);
        }
    });

    // ─── 3. CSS HIDE (belt + suspenders) ────────────────────────────────────────
    const css = `
        [aria-label="Open Chat Agent"],
        .team-theme-widget,
        iframe[src*="decagon.ai"],
        div:has(> img[src*="decagon.ai"]) {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
            width: 0 !important;
            height: 0 !important;
        }
    `;
    const injectStyle = (root) => {
        const style = document.createElement('style');
        style.textContent = css;
        (root.head || root).appendChild(style);
    };
    injectStyle(document);

    // ─── 4. DOM NUKER (handles Shadow DOM + iframes + regular DOM) ──────────────
    const nukeNode = (root = document) => {
        // Remove matching iframes
        root.querySelectorAll('iframe').forEach(iframe => {
            if (BLOCKED_KEYWORDS.some(kw => (iframe.src || '').includes(kw))) {
                console.log('[Nuker] Removed iframe:', iframe.src);
                iframe.remove();
            }
        });

        // Remove chat widget elements
        root.querySelectorAll('[aria-label="Open Chat Agent"], .team-theme-widget').forEach(el => {
            el.closest('.team-theme-widget')?.remove() || el.remove();
        });

        // Recurse into shadow roots
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                nukeNode(el.shadowRoot);
                // Also inject CSS into each shadow root so it stays hidden
                injectStyle(el.shadowRoot);
            }
        });
    };

    // ─── 5. MUTATION OBSERVER ───────────────────────────────────────────────────
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                nukeNode();
                break; // one pass is enough per batch
            }
        }
    });

    // ─── 6. INIT ────────────────────────────────────────────────────────────────
    const init = () => {
        nukeNode();
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    // Interval fallsafe for React re-renders / lazy loads
    setInterval(nukeNode, 1500);

})();