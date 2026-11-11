/* Dedicated campaign-page routing. CID is attribution, not member authentication. */
(function () {
  'use strict';
  var path = location.pathname;
  var vip = path.indexOf('/vip-masterclass-k7m2/') === 0;
  var base = vip ? '/vip-masterclass-k7m2/' : '/blueprint-november-r4x9/';
  var allowed = vip ? ['118853', '118859'] : ['118854', '118855', '118860', '118861'];
  var params = new URLSearchParams(location.search);
  var values = params.getAll('cid');
  var cid = values.length === 1 && allowed.indexOf(values[0]) !== -1 ? values[0] : '';
  window.LLA_CAMPAIGN_ACCESS = { allowed: !!cid, cid: cid, base: base };
  if (!cid) {
    location.replace(base + 'access-required.html');
    return;
  }
  // Each internal navigation carries the original allowed campaign explicitly.
  document.addEventListener('click', function (event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!a) return;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname.indexOf(base) === 0) {
        u.searchParams.set('cid', cid);
        a.href = u.href;
      }
    } catch (e) {}
  }, true);
})();
