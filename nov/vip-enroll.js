/* VIP Masterclass enrollment + CGM shipping address -> CRM (8 Nov 2026).
 * Same student (StudentId bound), second product: after the Blueprint payment is
 * approved, send one $0 order for the Julie VIP Masterclass (Sat Nov 14, 12:00 PM ET)
 * to the same CRM endpoint. Verified on eTeacher staging 8 Nov 2026: passing
 * StudentId returns the SAME StudentId (11693197 -> order 8074702, 0.69 s).
 * Course/class IDs are the ones the live masterclass page uses:
 * MainAbroadCourseId 283 / AbroadCourseId 1823, class CourseID 170142, SemesterID 2394.
 * The CGM shipping address (window.__llaAddress) travels in the order note so it is
 * stored on the customer record in the CRM. Fires once per paid order; never touches
 * the Blueprint order, its ids, the Airwallex intent or tracking. */
(function () {
  'use strict';
  if (window.LLA_VIP_ENROLL) return;
  var MC = { main: 283, abroad: 1823, classId: 170142, semester: 2394 };
  function clean(s) { return String(s || '').replace(/[^0-9A-Za-z]/g, ''); }
  function addressText() {
    try {
      var a = typeof window.__llaAddress === 'function' ? window.__llaAddress() : null;
      if (!a) return '';
      var s = a.shipping || a.billing || {};
      var line = [s.street, s.city, s.state, s.zip].filter(Boolean).join(', ');
      if (!line) return '';
      return ' | CGM ship to: ' + line + (a.shipSameAsBilling ? ' (same as billing)' : ' (separate shipping address)');
    } catch (e) { return ''; }
  }
  function basePayload() {
    var p = null;
    try { var q = JSON.parse(sessionStorage.getItem('lla_order_quote_v1') || 'null'); if (q) p = {}; } catch (e) {}
    try { var pd = JSON.parse(sessionStorage.getItem('lla_ecomm_pending') || 'null'); if (pd && pd.payload) p = JSON.parse(JSON.stringify(pd.payload)); } catch (e) {}
    try { var snap = JSON.parse(sessionStorage.getItem('lla_vip_base_v1') || 'null'); if (snap) p = snap; } catch (e) {}
    return p;
  }
  function send(report) {
    var cfg = window.LLA_ECOMM_CONFIG || {};
    if (cfg.mode && cfg.mode !== 'ecomm') return;
    if (!report || !report.StudentId || !report.OrderId || report.IsApproved !== true) return;
    var P = window.LLA_PROMO; if (P && P.active === false) return;         /* VIP comes with the JULIE249 offer */
    var key = 'lla_vip_mc_' + report.OrderId;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) {}
    var p = basePayload();
    if (!p) {
      var c = {}; try { c = JSON.parse(sessionStorage.getItem('lla_checkout_contact_v1') || '{}'); } catch (e) {}
      var parts = String(c.fullName || '').trim().split(/\s+/);
      p = { ProductID: 26, FirstName: parts[0] || 'Blueprint', LastName: parts.slice(1).join(' ') || 'Student', Email: c.email || '', MobilePhone: c.phone || '',
            CountryIsoCode: c.countryIso || 'US', CountryIsoCodeByIp: 'US', LanguageId: 101, IsTrial: 0,
            LandingPage: location.href, ReferringSite: location.hostname, QueryString: location.search.replace(/^\?/, ''), DynamicParameters: '' };
    }
    p.StudentId = Number(report.StudentId);
    p.MainAbroadCourseId = MC.main; p.AbroadCourseId = MC.abroad;
    p.PrefferdCourseID = MC.classId; p.PreferredCourseId = MC.classId;
    p.ActivitySessionLevel1ID = MC.semester; p.SemesterID = MC.semester;
    p.FirstPayment = 0; p.NumberOfPayments = 0; p.LeftToPay = 0;
    var dp = typeof p.DynamicParameters === 'string' ? p.DynamicParameters : '';
    dp = dp.replace(/(^|&)plan=[a-z]+/g, '').replace(/(^|&)message=[^&]*/g, '');
    dp += '&plan=vipmasterclass&bporder=' + clean(report.OrderId) + '&message=' + encodeURIComponent(
      'VIP Masterclass with Julie Gibson Clark Sat Nov 14 12PM ET included free with paid Blueprint order ' + clean(report.OrderId) + addressText());
    p.DynamicParameters = dp.replace(/^&+/, '').replace(/&&+/g, '&').slice(0, 4000);
    var url = String(cfg.workerBase || '').replace(/\/$/, '') + (cfg.env === 'staging' ? '/staging' : '') + '/api/lead/ecomm';
    if (!/^https:\/\//.test(url)) return;
    try { fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  function wrap() {
    var api = window.LLA_ECOMM;
    if (!api || typeof api.reportPayment !== 'function') return false;
    if (api.__vipWrapped) return true;
    /* snapshot the staged buyer payload before createStagedOrder removes it */
    try { var pd = JSON.parse(sessionStorage.getItem('lla_ecomm_pending') || 'null'); if (pd && pd.payload) sessionStorage.setItem('lla_vip_base_v1', JSON.stringify(pd.payload)); } catch (e) {}
    var orig = api.reportPayment;
    api.reportPayment = function (report) {
      try { send(report); } catch (e) {}
      return orig.apply(this, arguments);
    };
    api.__vipWrapped = true;
    return true;
  }
  window.LLA_VIP_ENROLL = { release: 'lla-vip-enroll-20261108-paid', course: MC };
  if (!wrap()) { var n = 0, t = setInterval(function () { if (wrap() || ++n > 80) clearInterval(t); }, 250); }
})();
