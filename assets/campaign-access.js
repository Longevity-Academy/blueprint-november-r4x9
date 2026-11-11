/* Dedicated campaign-page routing. CID is attribution, not member authentication. */
(function () {
  'use strict';
  var path = location.pathname;
  var vip = path.indexOf('/vip-masterclass-k7m2/') === 0;
  var base = vip ? '/vip-masterclass-k7m2/' : '/blueprint-november-r4x9/';
  var allowed = vip ? ['118853', '118859'] : ['118854', '118855', '118860', '118861'];
  // CRM/email builders can append a second ? to the existing promo query.
  // Normalize separators only; preserve raw click-ID values.
  var query = String(location.search || '').replace(/^\?/, '').replace(/\?(?=[A-Za-z_][A-Za-z0-9_]*=)/g, '&').replace(/&amp;/gi, '&');
  var params = new URLSearchParams(query);
  var values = [];
  params.forEach(function (value, key) { if (key.toLowerCase() === 'cid') values.push(value); });
  var cid = values.length === 1 && allowed.indexOf(values[0]) !== -1 ? values[0] : '';
  window.LLA_CAMPAIGN_ACCESS = { allowed: !!cid, cid: cid, base: base };
  if (!cid) {
    location.replace(base + 'access-required.html');
    return;
  }
  var rest = query.split('&').filter(function (pair) {
    try { return decodeURIComponent(pair.split('=')[0]).toLowerCase() !== 'cid'; } catch (e) { return true; }
  }).filter(Boolean).join('&');
  try { history.replaceState(null, '', location.pathname + '?cid=' + cid + (rest ? '&' + rest : '') + location.hash); } catch (e) {}
  // Each internal navigation carries the original allowed campaign explicitly.
  document.addEventListener('click', function (event) {
    var a = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!a) return;
    if ((a.getAttribute('href') || '').charAt(0) === '#') return;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname.indexOf(base) === 0) {
        u.searchParams.set('cid', cid);
        a.href = u.href;
      }
    } catch (e) {}
  }, true);
})();
