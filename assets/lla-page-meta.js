/* Brand homepage measurement only. No lead, order or payment operations.
 * GTM retains ownership of custom events. One browser/server pair per page view.
 */
(function (root) {
  'use strict';
  if (root.LLA_PAGE_META) return;
  var doc = root.document, loc = root.location;
  var RELAY = 'https://lla-ac-events.vercel.app/api/meta/capi';
  var pageId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  var pvId = 'lla_pv_' + pageId, vcId = 'lla_vc_' + pageId;
  var seenPV = false, started = false, pending = [], receipts = [];
  var query = new URLSearchParams(loc.search);
  var test = /^TEST\d{3,10}$/.test(query.get('meta_test') || '') ? query.get('meta_test') : '';
  function get(store, key) { try { return root[store].getItem(key) || ''; } catch (_) { return ''; } }
  function parse(value) { try { return JSON.parse(value || 'null') || {}; } catch (_) { return {}; } }
  function mode() {
    if (query.get('qa') === '1' || query.get('llatest') === '1' ||
        get('localStorage', 'lla_tester') === '1' ||
        query.get('env') === 'staging' ||
        (root.LLA_ECOMM_CONFIG && root.LLA_ECOMM_CONFIG.env === 'staging')) return 'off';
    if (loc.protocol !== 'https:' || !/^(www\.)?longevitylifeacademy\.com$/.test(loc.hostname) ||
        !/^\/blueprint-november-r4x9\/(?:index\.html)?$/.test(loc.pathname)) return 'off';
    return test ? 'test' : 'live';
  }
  function cookie(name) {
    var m = String(doc.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    return m ? m[1] : '';
  }
  function identity() {
    var i = parse(get('sessionStorage', 'lla_buyer_v1'));
    if (!i.email) i = parse(get('localStorage', 'lla_identity_v1'));
    return { email: String(i.email || '').trim().toLowerCase(),
      phone: String(i.phone || '').replace(/\D/g, ''),
      fn: String(i.fn || '').toLowerCase().replace(/[^a-z]/g, ''),
      ln: String(i.ln || '').toLowerCase().replace(/[^a-z]/g, ''),
      st: String(i.st || '').trim().toLowerCase(),
      country: String(i.country || '').trim().toLowerCase(),
      external_id: get('localStorage', 'lla_xid_v1') };
  }
  function clickId() {
    var raw = /[?&]fbclid=([^&#]+)/.exec(loc.search), value = raw ? raw[1] : '';
    try { value = decodeURIComponent(value); } catch (_) {}
    return /^[A-Za-z0-9_-]+$/.test(value) ? value : '';
  }
  function validFbc(value) {
    var m = /^fb\.\d+\.(\d{13})\.([A-Za-z0-9_-]+)$/.exec(value || '');
    return m && Number(m[1]) <= Date.now() + 300000 &&
      Date.now() - Number(m[1]) < 90 * 86400000 ? m : null;
  }
  function fbc() {
    var click = clickId(), current = cookie('_fbc'), c = validFbc(current);
    if (c && (!click || c[2] === click)) return current;
    var saved = parse(get('localStorage', 'lla_fbc_v1')), s = validFbc(saved.v);
    if (s && (!click || s[2] === click)) return saved.v;
    if (!click) return '';
    var value = 'fb.1.' + Date.now() + '.' + click;
    try {
      root.localStorage.setItem('lla_fbc_v1', JSON.stringify({v: value, raw: click, ts: Date.now()}));
      doc.cookie = '_fbc=' + value + '; domain=.longevitylifeacademy.com; path=/; max-age=7776000; SameSite=Lax; Secure';
    } catch (_) {}
    return value;
  }
  function payload(name, id) {
    var out = identity();
    out.event_name = name; out.event_id = id;
    out.event_time = Math.floor(Date.now() / 1000);
    out.url = loc.href; out.referrer = doc.referrer || '';
    out.release = 'lla-page-meta-20261104-1';
    if (name === 'ViewContent') {
      out.content_name = 'Longevity Life Academy';
      out.content_ids = ['longevity-life-academy'];
      out.content_type = 'product';
    }
    if (test) out.test_event_code = test;
    return out;
  }
  function send(item, attempt) {
    if (mode() === 'off') return;
    item.fbp = cookie('_fbp'); item.fbc = fbc(); item.fbclid = clickId();
    root.fetch(RELAY, {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(item), keepalive: true}).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        var accepted = response.ok && body.ok === true && Number(body.events_received) >= 1;
        receipts.push({event_name: item.event_name, event_id: item.event_id,
          status: accepted ? 'accepted' : 'rejected', http_status: response.status});
        if (!accepted && (response.status >= 500 || response.status === 429) && attempt < 3)
          root.setTimeout(function () { send(item, attempt + 1); }, 1500 * attempt);
      });
    }).catch(function () {
      receipts.push({event_name: item.event_name, event_id: item.event_id, status: 'network_error'});
      if (attempt < 3) root.setTimeout(function () { send(item, attempt + 1); }, 1500 * attempt);
    });
  }
  function flush() {
    var batch = pending; pending = [];
    batch.forEach(function (item) { send(item, 1); });
  }
  function queue(name, id) { pending.push(payload(name, id)); root.setTimeout(flush, 1500); }
  function filter(args) {
    var tracking = args[0] === 'track' || args[0] === 'trackCustom' ||
      args[0] === 'trackSingle' || args[0] === 'trackSingleCustom';
    if (tracking && mode() !== 'live') return false;
    if (args[0] === 'track' && args[1] === 'PageView') {
      if (seenPV) return false;
      seenPV = true;
      args[3] = args[3] || {};
      pvId = args[3].eventID || pvId;
      args[3].eventID = pvId;
      queue('PageView', pvId);
    }
    return true;
  }
  function start() {
    if (started || mode() === 'off') return;
    started = true;
    if (mode() === 'test') {
      seenPV = true; queue('PageView', pvId);
    } else if (!seenPV && root.fbq) root.fbq('track', 'PageView', {}, {eventID: pvId});
    var content = {content_name: 'Longevity Life Academy',
      content_ids: ['longevity-life-academy'], content_type: 'product'};
    if (mode() === 'live' && root.fbq) root.fbq('track', 'ViewContent', content, {eventID: vcId});
    queue('ViewContent', vcId);
  }
  root.LLA_PAGE_META = {release: 'lla-page-meta-20261104-1', filter: filter,
    mode: mode, receipts: receipts, start: start, flush: flush};
  root.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') flush(); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})(window);
