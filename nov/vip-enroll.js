/* Included VIP Masterclass: only an approved Blueprint payment releases the
 * second, 100%-discounted order. A free order also needs explicit class
 * assignment; it must never send a fabricated payment report.
 * Order creates are never replayed after an ambiguous response. */
(function () {
  'use strict';
  if (window.LLA_VIP_ENROLL) return;
  var MC = { main: 283, abroad: 1823, campus: 4203, classId: 170142, semester: 2394 };
  var inflight = {};
  var apiState = window.LLA_VIP_ENROLL = {
    release: 'lla-vip-enroll-20261111-free-assigned', course: MC, lastPromise: null, lastResult: null
  };
  function clean(s) { return String(s || '').replace(/[^0-9A-Za-z]/g, ''); }
  function read(key) {
    var value = null;
    try { value = localStorage.getItem(key); } catch (e) {}
    try { if (!value) value = sessionStorage.getItem(key); } catch (e) {}
    try { return value ? JSON.parse(value) : null; } catch (e) { return null; }
  }
  function write(key, value) {
    var saved = false, text = JSON.stringify(value);
    try { localStorage.setItem(key, text); saved = true; } catch (e) {}
    try { sessionStorage.setItem(key, text); saved = true; } catch (e) {}
    return saved;
  }
  function addressText() {
    try {
      var a = typeof window.__llaAddress === 'function' ? window.__llaAddress() : null;
      if (!a) return '';
      var s = a.shipping || a.billing || {};
      var line = [s.street, s.city, s.state, s.zip].filter(Boolean).join(', ');
      return line ? ' CGM ship to ' + line : '';
    } catch (e) { return ''; }
  }
  function basePayload(report) {
    /* Only reuse a snapshot bound to this paid order, never a prior buyer. */
    var snap = read('lla_vip_base_v2');
    if (snap && snap.payload && (snap.env || 'production') === (window.LLA_ECOMM_CONFIG.env || 'production') && String(snap.studentId) === String(report.StudentId) &&
        String(snap.orderId) === String(report.OrderId)) {
      return JSON.parse(JSON.stringify(snap.payload));
    }
    var c = read('lla_checkout_contact_v1') || {};
    var parts = String(c.fullName || '').trim().split(/\s+/);
    return {
      ProductID: 26, FirstName: parts[0] || '', LastName: parts.slice(1).join(' ') || '',
      Email: c.email || '', MobilePhone: c.phone || '', CountryIsoCode: c.countryIso || 'US',
      CountryIsoCodeByIp: c.countryIso || 'US', LanguageId: 101, IsTrial: 0,
      LandingPage: location.href, ReferringSite: location.hostname,
      QueryString: location.search.replace(/^\?/, ''), DynamicParameters: ''
    };
  }
  function result(value) {
    apiState.lastResult = value;
    try {
      var host = document.getElementById('screen-done');
      if (host && value) {
        var note = document.getElementById('lla-vip-status');
        if (!note) { note = document.createElement('p'); note.id = 'lla-vip-status'; host.appendChild(note); }
        note.setAttribute('role', 'status');
        note.textContent = value.ok
          ? 'Your included VIP Masterclass is registered for November 14. No additional payment is due.'
          : 'Your Blueprint payment is separate from your included VIP Masterclass registration, which is not yet confirmed. Please contact advisor@longevitylifeacademy.com with your Blueprint order number. Do not pay again.';
      }
    } catch (e) {}
    return value;
  }
  function assign(base, key, state) {
    return fetch(base + '/api/checkout/assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        StudentID: Number(state.studentId), OrderID: Number(state.orderId), SecondaryCourseID: MC.classId,
        AssignNotes: 'Included free VIP Masterclass with paid Blueprint order ' + state.blueprintOrderId
      }), keepalive: true
    }).then(function (response) {
      if (!response.ok) throw new Error('class_assignment_' + response.status);
      state.status = 'assigned';
      write(key, state);
      return result({ ok: true, status: 'assigned', orderid: state.orderId, stid: state.studentId });
    }).catch(function (error) {
      /* Keep the created order IDs: a later approved-payment callback can retry
       * assignment without opening another order. */
      state.status = 'order-created';
      state.error = String(error.message || error);
      write(key, state);
      return result({ ok: false, status: 'assignment-pending', orderid: state.orderId });
    });
  }
  function send(report) {
    var cfg = window.LLA_ECOMM_CONFIG || {};
    if (cfg.mode !== 'ecomm' || !report || !/^[1-9]\d*$/.test(String(report.StudentId || '')) ||
        !/^[1-9]\d*$/.test(String(report.OrderId || '')) || report.IsApproved !== true) return Promise.resolve(null);
    var promo = window.LLA_PROMO;
    if (promo && promo.active === false) return Promise.resolve(null);
    var base = String(cfg.workerBase || '').replace(/\/$/, '') + (cfg.env === 'staging' ? '/staging' : '');
    if (!/^https:\/\//.test(base)) return Promise.resolve(null);
    var key = 'lla_vip_mc_v2_' + (cfg.env || 'production') + '_' + report.OrderId;
    if (inflight[key]) return inflight[key];
    var state = read(key);
    if (state && state.status === 'assigned') return Promise.resolve(result({ ok: true, status: 'already-assigned', orderid: state.orderId }));
    if (state && String(state.studentId) !== String(report.StudentId)) return Promise.resolve(result({ ok: false, status: 'identity-mismatch' }));
    if (state && state.orderId) {
      inflight[key] = assign(base, key, state).then(function (value) { delete inflight[key]; return value; });
      return inflight[key];
    }
    /* The previous implementation set this marker before its fire-and-forget
     * request. Without returned IDs its outcome is unknown, not safe to replay. */
    var legacy = false;
    try { legacy = !!sessionStorage.getItem('lla_vip_mc_' + report.OrderId); } catch (e) {}
    if (state || legacy) return Promise.resolve(result({ ok: false, status: 'confirmation-required' }));
    var p = basePayload(report);
    if (!p.FirstName || !p.LastName || !p.Email || !p.MobilePhone) return Promise.resolve(result({ ok: false, status: 'contact-confirmation-required' }));
    state = { status: 'creating', studentId: String(report.StudentId), blueprintOrderId: String(report.OrderId), ts: Date.now() };
    if (!write(key, state)) return Promise.resolve(result({ ok: false, status: 'storage-unavailable' }));
    p.StudentId = Number(report.StudentId);
    p.MainAbroadCourseId = MC.main; p.AbroadCourseId = MC.abroad;
    p.CampusId = MC.campus; p.CampusID = MC.campus;
    p.PrefferdCourseID = MC.classId; p.PreferredCourseId = MC.classId;
    p.ActivitySessionLevel1ID = MC.semester; p.SemesterID = MC.semester;
    p.FirstPayment = 0; p.NumberOfPayments = 0; p.LeftToPay = 0; p.DiscountPercent = 100;
    delete p.DiscountReason;
    var dp = typeof p.DynamicParameters === 'string' ? p.DynamicParameters : '';
    dp = dp.replace(/(^|[&;])plan=[^&;]*/g, '$1').replace(/(^|[&;])message=[^&;]*/g, '$1');
    dp += '&plan=vipmasterclass&bporder=' + clean(report.OrderId) + '&message=' + encodeURIComponent(
      'VIP Masterclass with Julie Gibson Clark Sat Nov 14 12PM ET included free with paid Blueprint order ' + clean(report.OrderId) + addressText());
    p.DynamicParameters = dp.replace(/^[&;]+/, '').replace(/&&+/g, '&').slice(0, 4000);
    inflight[key] = Promise.resolve().then(function () {
      return fetch(base + '/api/lead/ecomm', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(p), keepalive: true
      });
    }).then(function (response) {
      if (!response.ok) throw new Error('free_order_' + response.status);
      return response.json();
    }).then(function (body) {
      var stid = body.stid || body.StudentId || body.studentId || body.StudentID;
      var orderid = body.orderid || body.OrderId || body.orderId || body.OrderID;
      if (String(stid) !== String(report.StudentId) || !/^[1-9]\d*$/.test(String(orderid || '')) ||
          String(orderid) === String(report.OrderId)) throw new Error('free_order_identity_unconfirmed');
      state.status = 'order-created'; state.orderId = String(orderid);
      write(key, state);
      return assign(base, key, state);
    }).catch(function (error) {
      state.status = 'confirmation-required'; state.error = String(error.message || error);
      write(key, state);
      return result({ ok: false, status: 'confirmation-required' });
    }).then(function (value) { delete inflight[key]; return value; });
    return inflight[key];
  }
  function wrap() {
    var api = window.LLA_ECOMM;
    if (!api || typeof api.reportPayment !== 'function') return false;
    if (api.__vipWrapped) return true;
    var orig = api.reportPayment;
    api.reportPayment = function (report) {
      var paymentResult = orig.apply(this, arguments);
      /* Preserve the paid-order reporting promise and never report a payment
       * for the free add-on. The bonus cannot block the payment confirmation UI. */
      try { apiState.lastPromise = send(report); } catch (e) { result({ ok: false, status: 'confirmation-required' }); }
      return paymentResult;
    };
    api.__vipWrapped = true;
    return true;
  }
  if (!wrap()) { var n = 0, timer = setInterval(function () { if (wrap() || ++n > 80) clearInterval(timer); }, 250); }
})();
