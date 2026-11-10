/*! LLA AI-Search Attribution v1 — 2026-08-17
 * Purpose: measure every lead/sale that originated from an AI assistant
 * (ChatGPT, Claude, Perplexity, Copilot, Gemini, Grok, DeepSeek, Meta AI...).
 * How:
 *   1) Detects AI referrers (and utm_source values like "chatgpt.com") on landing.
 *   2) Persists first-touch ai_source for 30 days in localStorage (lla_ai_attr_v1).
 *   3) Pushes dataLayer events for GTM/GA4 ("ai_search_visit" + ai_source var).
 *   4) Transparently stamps ai_source/ai_ref into DynamicParameters of every
 *      CRM payload POSTed to *.gitter-omri.workers.dev (leads + checkout),
 *      so eTeacher CRM shows the AI channel on each lead and sale.
 * Note: Google AI Overviews clicks arrive with a plain google.com referrer and
 * cannot be separated client-side; they are measured via Search Console instead.
 */
(function () {
  'use strict';
  var KEY = 'lla_ai_attr_v1';
  var TTL = 30 * 24 * 60 * 60 * 1000; // 30 days, same policy as lla_attribution_v1

  // hostname regex -> canonical AI source name
  var HOST_RULES = [
    [/(^|\.)chatgpt\.com$/i, 'chatgpt'],
    [/(^|\.)openai\.com$/i, 'chatgpt'],
    [/(^|\.)perplexity\.ai$/i, 'perplexity'],
    [/(^|\.)claude\.ai$/i, 'claude'],
    [/(^|\.)anthropic\.com$/i, 'claude'],
    [/copilot\.microsoft\.com$/i, 'copilot'],
    [/(^|\.)gemini\.google\.com$/i, 'gemini'],
    [/(^|\.)bard\.google\.com$/i, 'gemini'],
    [/(^|\.)meta\.ai$/i, 'meta_ai'],
    [/(^|\.)grok\.com$/i, 'grok'],
    [/(^|\.)x\.ai$/i, 'grok'],
    [/chat\.mistral\.ai$/i, 'mistral'],
    [/(^|\.)deepseek\.com$/i, 'deepseek'],
    [/(^|\.)you\.com$/i, 'you_com'],
    [/(^|\.)duck\.ai$/i, 'duck_ai']
  ];

  // utm_source substring -> canonical AI source (ChatGPT appends utm_source=chatgpt.com)
  var UTM_RULES = [
    ['chatgpt', 'chatgpt'], ['openai', 'chatgpt'],
    ['perplexity', 'perplexity'],
    ['claude', 'claude'], ['anthropic', 'claude'],
    ['copilot', 'copilot'],
    ['gemini', 'gemini'],
    ['grok', 'grok'],
    ['deepseek', 'deepseek'],
    ['meta.ai', 'meta_ai'],
    ['mistral', 'mistral']
  ];

  function readStored() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || (Date.now() - obj.ts) > TTL) return null;
      return obj;
    } catch (e) { return null; }
  }

  function detect() {
    try {
      var ref = document.referrer || '';
      if (ref) {
        var host = '';
        try { host = new URL(ref).hostname || ''; } catch (e) {}
        for (var i = 0; i < HOST_RULES.length; i++) {
          if (HOST_RULES[i][0].test(host)) return { src: HOST_RULES[i][1], ref: host };
        }
      }
      var utm = (new URLSearchParams(location.search || '').get('utm_source') || '').toLowerCase();
      if (utm) {
        for (var j = 0; j < UTM_RULES.length; j++) {
          if (utm.indexOf(UTM_RULES[j][0]) !== -1) return { src: UTM_RULES[j][1], ref: 'utm:' + utm };
        }
      }
      return null;
    } catch (e) { return null; }
  }

  var stored = readStored();
  var hit = detect();
  var isNew = false;
  // First-touch wins within the 30-day window (same model as click-ID capture).
  if (hit && !stored) {
    stored = {
      src: hit.src,
      ref: hit.ref,
      ts: Date.now(),
      landing: location.pathname + location.search
    };
    try { localStorage.setItem(KEY, JSON.stringify(stored)); } catch (e) {}
    isNew = true;
  }

  // ---- GTM / GA4 surface ----
  try {
    window.dataLayer = window.dataLayer || [];
    if (stored) window.dataLayer.push({ ai_source: stored.src, ai_referrer: stored.ref });
    if (isNew) {
      window.dataLayer.push({
        event: 'ai_search_visit',
        ai_source: stored.src,
        ai_referrer: stored.ref,
        ai_landing: stored.landing
      });
    }
  } catch (e) {}

  // ---- CRM surface: stamp every payload sent to our worker proxies ----
  // Covers lead forms (eteacher-leads-proxy) and checkout (lla-checkout)
  // without touching each page's payload builder.
  function stamp(bodyStr) {
    var attr = readStored();
    if (!attr || !attr.src) return bodyStr;
    var p = JSON.parse(bodyStr);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return bodyStr;
    var extra = 'ai_source=' + attr.src + ';ai_ref=' + attr.ref;
    p.DynamicParameters = ((p.DynamicParameters ? p.DynamicParameters + ';' : '') + extra).slice(0, 4000);
    return JSON.stringify(p);
  }

  try {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (url.indexOf('.gitter-omri.workers.dev') !== -1 &&
            init && typeof init.body === 'string' && /^\s*\{/.test(init.body)) {
          init.body = stamp(init.body);
        }
      } catch (e) { /* never block a lead on attribution */ }
      return origFetch.apply(this, arguments);
    };
  } catch (e) {}

  // Debug/manual access
  window.llaAI = { get: readStored };
})();
