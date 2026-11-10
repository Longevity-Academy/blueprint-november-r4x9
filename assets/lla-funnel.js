/* LLA funnel events for www.longevitylifeacademy.com (homepage enrollment popup).
 * 2026-11-04: ports the pages.dev LLA_FUNNEL pair to the .com homepage, which only
 * sent PageView / ViewContent / Purchase until now.
 *   AddToCart        - screen 1 "Continue" passed validation (details staged, no CRM record)
 *   InitiateCheckout - screen 2 "Continue" is about to open /checkout.html (order created)
 * Browser Pixel copy + server copy share one event_id so Meta dedupes the pair.
 * Gate: LLA_PAGE_META.mode()==='live' (qa=1 / llatest=1 / lla_tester / staging / non-.com host
 * all stay silent). A tester email typed into any email field flags the device (sticky,
 * same B7 rule as pages.dev: team domains + gitter only) and silences Pixel + relay.
 * No CRM, checkout, payment or AC code is touched by this file.
 */
(function (root) {
  var PIXEL = '1440305917310328';
  var RELAY = 'https://lla-ac-events.vercel.app/api/meta/capi';
  var CONTENT_ID = 'lla-longevity-blueprint';
  var RELEASE = 'lla-funnel-20261104-1';
  var doc = root.document;

  function get(store, key) { try { return root[store].getItem(key) || ''; } catch (_) { return ''; } }
  function set(store, key, v) { try { root[store].setItem(key, v); } catch (_) {} }
  function cookie(name) {
    var m = doc.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? m[1] : '';
  }
  function live() {
    try { return !!(root.LLA_PAGE_META && root.LLA_PAGE_META.mode() === 'live'); } catch (_) { return false; }
  }
  function letters(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
  function digits(s) { return String(s || '').replace(/[^0-9]/g, ''); }

  /* Identity: staged fields from the popup first (screen 1 holds them in memory only),
     then the stored buyer identity written by eteacher-ecomm.js once the order exists. */
  function identity(fields) {
    var i = null;
    try { i = JSON.parse(root.sessionStorage.getItem('lla_buyer_v1') || 'null'); } catch (_) {}
    if (!i || !i.email) { try { i = JSON.parse(root.localStorage.getItem('lla_identity_v1') || 'null'); } catch (_) {} }
    i = i || {};
    var out = {
      email: i.email ? String(i.email).trim().toLowerCase() : '',
      phone: i.phone ? digits(i.phone) : '',
      fn: letters(i.fn), ln: letters(i.ln),
      st: i.st ? String(i.st).trim().toLowerCase() : '',
      country: i.country ? String(i.country).trim().toLowerCase() : '',
      external_id: get('localStorage', 'lla_xid_v1')
    };
    if (fields) {
      if (fields.email && !out.email) out.email = String(fields.email).trim().toLowerCase();
      if (fields.phone && !out.phone) out.phone = digits(fields.phone);
      if (fields.fullName && !out.fn) {
        var parts = String(fields.fullName).trim().split(/\s+/);
        out.fn = letters(parts[0]); out.ln = letters(parts.slice(1).join(''));
      }
      if (fields.countryIso && !out.country) out.country = String(fields.countryIso).trim().toLowerCase();
    }
    return out;
  }

  /* Click id: _fbc cookie byte for byte -> stored first-landing click -> exact fbclid in the URL. */
  function fbc() {
    var c = cookie('_fbc'); if (c) return c;
    var q = (root.location.search.match(/[?&]fbclid=([^&#]+)/) || [])[1] || '';
    if (!/^[A-Za-z0-9_-]+$/.test(q)) q = '';
    var s = null; try { s = JSON.parse(root.localStorage.getItem('lla_fbc_v1') || 'null'); } catch (_) {}
    if (s && s.v && (Date.now() - (s.ts || 0)) < 7776000000 && (!q || s.raw === q)) return s.v;
    if (q) { var v = 'fb.1.' + Date.now() + '.' + q; set('localStorage', 'lla_fbc_v1', JSON.stringify({v: v, raw: q, ts: Date.now()})); return v; }
    return '';
  }

  function price() {
    var p = 169;
    try {
      var pl = get('sessionStorage', 'lla_plan') || get('localStorage', 'lla_plan') || 'monthly';
      var cfg = root.LLA_ECOMM_CONFIG || {};
      if (cfg.crmPlans && cfg.crmPlans[pl] && cfg.crmPlans[pl].firstPayment) p = Number(cfg.crmPlans[pl].firstPayment);
      else if (cfg.crmPrice && cfg.crmPrice.firstPayment) p = Number(cfg.crmPrice.firstPayment);
    } catch (_) {}
    return p;
  }
  function ctaLoc() { return get('sessionStorage', 'lla_cta_location'); }

  var pending = [], inFlight = {};
  function replayAllowed(item, key) {
    var stamp = item && item.event_time;
    var age = Date.now() / 1000 - stamp;
    if (typeof stamp === 'number' && Number.isFinite(stamp) && stamp > 0 &&
        age >= 0 && age < 86400) return true;
    // This is not an accepted receipt. Keep a terminal marker so Pixel stays once-only.
    if (key) set('sessionStorage', key, JSON.stringify({
      status: 'expired', event_id: item && item.event_id || '',
      event_name: item && item.event_name || '', event_time: stamp || null
    }));
    return false;
  }
  function post(entry) {
    var item = entry.item, key = entry.key;
    if (!live() || inFlight[item.event_id]) return;
    if (!replayAllowed(item, key)) return;
    inFlight[item.event_id] = true;
    function attempt(n) {
      if (!live()) { delete inFlight[item.event_id]; return; }
      if (!replayAllowed(item, key)) { delete inFlight[item.event_id]; return; }
      var settled = false;
      // Do not abort an ambiguous keepalive delivery: retries share its event_id.
      var timer = root.setTimeout(function () { finish(false, true); }, 5000);
      function finish(ok, retryable) {
        if (settled) return;
        settled = true; root.clearTimeout(timer);
        if (ok) {
          if (key) set('sessionStorage', key, '1');
          delete inFlight[item.event_id];
        } else if (retryable && n < 3 && live()) {
          root.setTimeout(function () { attempt(n + 1); }, n * 500);
        } else {
          // Preserve the original envelope for a later explicit retry, not a new Pixel event.
          delete inFlight[item.event_id];
        }
      }
      try {
        root.fetch(RELAY, {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(item), keepalive: true}).then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (body) {
            finish(response.ok && body.ok === true && Number(body.events_received) >= 1,
              response.status === 429 || response.status >= 500 || response.ok);
          });
        }).catch(function () { finish(false, true); });
      } catch (_) { finish(false, true); }
    }
    attempt(1);
  }
  function flush() {
    var batch = pending; pending = [];
    batch.forEach(post);
  }
  /* Server copy leaves 1.5 s after the Pixel copy (Meta keeps the first event per event_id and the
     Pixel copy carries the real _fbc cookie). Flushed at once when the page is being left. */
  function queue(item, now, key) {
    pending.push({item: item, key: key});
    if (now) flush(); else root.setTimeout(flush, 1500);
  }

  function track(name, key, fields, now) {
    if (!live()) return false;
    var saved = key && get('sessionStorage', key);
    if (saved) {
      if (saved === '1') return false;
      try {
        var retry = JSON.parse(saved);
        if (retry && retry.event_id && retry.event_name === name) {
          if (retry.status === 'expired' || !replayAllowed(retry, key)) return false;
          queue(retry, true, key);
          return false; // Pixel remains once-only, even when the server copy needs retry.
        }
      } catch (_) {}
      return false;
    }
    try {
      var i = identity(fields);
      var ud = {external_id: i.external_id};
      if (i.email) ud.em = i.email; if (i.phone) ud.ph = i.phone;
      if (i.fn) ud.fn = i.fn; if (i.ln) ud.ln = i.ln;
      if (i.st) ud.st = i.st; if (i.country) ud.country = i.country;
      try { if (root.fbq) root.fbq('init', PIXEL, ud); } catch (_) {}
      var id = 'lla_' + name.toLowerCase() + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      var val = price(), loc = ctaLoc();
      var data = {value: val, currency: 'USD', content_name: 'Longevity Blueprint', content_type: 'product',
        content_ids: [CONTENT_ID], contents: [{id: CONTENT_ID, quantity: 1, item_price: val}]};
      if (loc) data.cta_location = loc;
      try { if (root.fbq) root.fbq('track', name, data, {eventID: id}); } catch (_) {}
      var item = {event_name: name, event_id: id,
        email: i.email, phone: i.phone, fn: i.fn, ln: i.ln, st: i.st, country: i.country,
        external_id: i.external_id, value: val, currency: 'USD',
        content_name: 'Longevity Blueprint', order_id: '', content_type: 'product',
        content_ids: [CONTENT_ID], contents: data.contents, cta_location: loc,
        event_time: Math.floor(Date.now() / 1000), user_agent: root.navigator.userAgent,
        url: root.location.href, release: RELEASE, fbp: cookie('_fbp'), fbc: fbc()};
      if (key) set('sessionStorage', key, JSON.stringify(item));
      queue(item, now, key);
      return true;
    } catch (_) { return false; }
  }

  /* Tester devices: a team / test email typed into any email field flags the device for good
     (localStorage lla_tester=1, read by LLA_PAGE_META.mode()) and silences the Pixel queue. */
  function isTesterEmail(e) {
    e = String(e || '').trim().toLowerCase();
    return /@(example\.(com|org|net)|test\.com|mailinator\.com|eteacher[a-z0-9-]*\.[a-z.]+|gita-?agency\.[a-z.]+)$/.test(e) || /gitter/.test(e);
  }
  function silence() {
    set('localStorage', 'lla_tester', '1');   /* LLA_PAGE_META.mode() -> 'off'; the fbq wrapper in index.html then drops every track call */
    pending = [];
  }
  doc.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t && t.type === 'email' && isTesterEmail(t.value)) silence();
  }, true);

  root.LLA_FUNNEL = {
    release: RELEASE,
    addToCart: function (fields) { return track('AddToCart', 'lla_ev_atc_v1', fields, false); },
    initiateCheckout: function (fields) { return track('InitiateCheckout', 'lla_ev_ic_v1', fields, true); },
    isTesterEmail: isTesterEmail, flush: flush
  };
  root.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') flush(); });
})(window);
