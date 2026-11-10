/* Receipt evidence + bounded redelivery. No extra Meta events, no identity storage.
 * Retries reuse the SAME event_id (Meta dedups), only on network failure / HTTP 429 / 5xx.
 * An unconfirmed Purchase is kept in localStorage and replayed once on the next checkout load.
 * "accepted" means the relay reports a Meta receipt, NOT attribution or a real buyer. */
(function () {
  'use strict';
  var KEY = 'lla_delivery_receipts_v1', MAX = 100, PKEY = 'lla_unconfirmed_purchase_v1';
  function read() {
    try { var x = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(x) ? x : []; }
    catch (_) { return []; }
  }
  function write(row) {
    try {
      var rows = read().filter(function (x) { return x.event_id !== row.event_id; });
      rows.push(row); sessionStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX)));
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('lla:delivery-receipt', {detail: row})); } catch (_) {}
  }
  window.__llaDeliveryReceipts = read;
  var pending=[];
  window.__llaNavigateTracked=function(url){
    pending.slice().forEach(function(send){send();});
    var start=Date.now(), navigated=false;
    function navigate(){if(navigated)return;navigated=true;window.location.href=url;}
    function ready(){
      if(window.LLA_LIVE===false || (window.fbq&&window.fbq.callMethod)){setTimeout(navigate,250);return;}
      if(Date.now()-start>=1200){navigate();return;}
      setTimeout(ready,50);
    }
    ready();
  };
  window.__llaRelay = function (body) {
    if (window.LLA_LIVE === false) return;
    var payload;
    try {
      payload = JSON.parse(body);
    } catch (_) { return; }
    if (!payload.event_id || !payload.event_name) return;
    var row = {
      event_id: String(payload.event_id).slice(0, 160),
      event_name: String(payload.event_name).slice(0, 80),
      queued_at: new Date().toISOString(), status: 'queued',
      test_classification: payload.test_event_code ? 'declared_test' : 'unclassified'
    };
    write(row);
    var started = false, timer;
    function go(ev) {
      if (started) return;
      started = true; clearTimeout(timer);
      pending=pending.filter(function(send){return send!==go;});
      window.removeEventListener('pagehide', go);
      if (window.LLA_LIVE === false) { row.status = 'excluded'; write(row); return; }
      row.status = 'dispatching'; row.dispatched_at = new Date().toISOString(); write(row);
      try {
        // Preserve the previous send-time cookie refresh, after Pixel initialization.
        // Historical commerce fbc has already been resolved by the caller.
        if (!['AddToCart', 'InitiateCheckout', 'Purchase'].includes(payload.event_name) && window.__llaRefreshClickPayload) body = window.__llaRefreshClickPayload(body);
        if(ev&&ev.type==='pagehide'&&navigator.sendBeacon){
          if(navigator.sendBeacon('https://lla-ac-events.vercel.app/api/meta/capi',new Blob([body],{type:'text/plain'}))){
            row.status='beacon_queued';write(row);return;
          }
        }
        var RETRY_MS = [1500, 4000, 10000], attempt = 0;
        function finalWarn(reason, extra) {
          try { console.warn('[LLA relay] ' + payload.event_name + ' ' + reason + ' after ' + (attempt + 1) + ' attempt(s)', row.event_id, extra || ''); } catch (_) {}
          if (payload.event_name === 'Purchase' && row.status !== 'accepted' && row.status !== 'rejected') {
            try { localStorage.setItem(PKEY, JSON.stringify({body: body, event_id: row.event_id, ts: Date.now()})); } catch (_) {}
          }
        }
        function attemptSend() {
          row.attempts = attempt + 1; write(row);
          fetch('https://lla-ac-events.vercel.app/api/meta/capi', {
            method: 'POST', headers: {'Content-Type': 'text/plain'}, body: body, keepalive: true
          }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (data) {
              row.http_status = r.status;
              row.meta_status = typeof data.meta_status === 'number' ? data.meta_status : null;
              row.events_received = typeof data.events_received === 'number' ? data.events_received : null;
              var retryable = (r.status === 429 || r.status >= 500);
              if (retryable && attempt < RETRY_MS.length) { row.status = 'retrying'; write(row); setTimeout(function () { attempt++; attemptSend(); }, RETRY_MS[attempt]); return; }
              row.status = data.excluded === true ? 'excluded' :
                (r.ok && data.ok === true && data.events_received === 1 ? 'accepted' : 'rejected');
              row.responded_at = new Date().toISOString();
              write(row);
              if (row.status === 'accepted' && payload.event_name === 'Purchase') { try { localStorage.removeItem(PKEY); } catch (_) {} }
              if (row.status === 'rejected') finalWarn('rejected by relay', 'HTTP ' + r.status + (data.error ? ' ' + data.error : ''));
              if (row.status === 'unconfirmed') finalWarn('unconfirmed');
            });
          }).catch(function (e) {
            if (attempt < RETRY_MS.length) { row.status = 'retrying'; write(row); setTimeout(function () { attempt++; attemptSend(); }, RETRY_MS[attempt]); return; }
            row.status = 'unconfirmed'; write(row); finalWarn('unconfirmed (network)', e && e.message);
          });
        }
        attemptSend();
      } catch (_) { row.status = 'unconfirmed'; write(row); }
    }
    if (['AddToCart', 'InitiateCheckout', 'Purchase'].includes(payload.event_name)) { go(); return; }
    pending.push(go);
    timer = setTimeout(go, 1500);
    window.addEventListener('pagehide', go, {once: true});
  };
  // Replay a Purchase whose delivery was never confirmed (same event_id -> Meta dedups). Once, max 24h old.
  try {
    var saved = JSON.parse(localStorage.getItem(PKEY) || 'null');
    if (saved && saved.body && Date.now() - (saved.ts || 0) < 86400000 && window.LLA_LIVE !== false) {
      localStorage.removeItem(PKEY);
      setTimeout(function () {
        try { console.warn('[LLA relay] replaying unconfirmed Purchase', saved.event_id); } catch (_) {}
        window.__llaRelay(saved.body);
      }, 2000);
    } else if (saved) { localStorage.removeItem(PKEY); }
  } catch (_) {}
})();
