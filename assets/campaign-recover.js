/* Recover only a same-site approved invitation that sent this browser here.
 * No default CID, no remembered arbitrary CID and no user-selected campaign. */
(function () {
  try {
    var base = location.pathname.split('/access-required.html')[0] + '/';
    var allowed = base === '/vip-masterclass-k7m2/' ? ['118853','118859'] : ['118854','118855','118860','118861'];
    var ref = new URL(document.referrer);
    if (ref.origin !== location.origin || ref.pathname.indexOf(base) !== 0 || /access-required\.html$/.test(ref.pathname)) return;
    var query = ref.search.replace(/^\?/, '').replace(/\?(?=[A-Za-z_][A-Za-z0-9_]*=)/g, '&').replace(/&amp;/gi, '&');
    var params = new URLSearchParams(query), values = [];
    params.forEach(function (v,k) { if (k.toLowerCase() === 'cid') values.push(v); });
    if (values.length !== 1 || allowed.indexOf(values[0]) === -1) return;
    var rest = query.split('&').filter(function (pair) {
      try { return decodeURIComponent(pair.split('=')[0]).toLowerCase() !== 'cid'; } catch (e) { return true; }
    }).filter(Boolean).join('&');
    var target = ref.pathname + '?cid=' + values[0] + (rest ? '&' + rest : '') + ref.hash;
    var key = 'lla_campaign_recovery_' + base;
    if (sessionStorage.getItem(key) === target) return;
    sessionStorage.setItem(key, target);
    location.replace(target);
  } catch (e) {}
})();
