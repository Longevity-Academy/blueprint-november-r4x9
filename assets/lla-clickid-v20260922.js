/* LLA ClickID handoff v20260922: opaque IDs, query/fragment recovery, QA isolation. */
(function () {
  function queryValue(query, key) {
    var match = String(query || '').match(new RegExp('(?:^|[?&])' + key + '=([^&#]*)'));
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (e) { return ''; }
  }
  var click = queryValue(location.search, 'fbclid');
  if (!click) {
    var recovered = queryValue(String(location.hash || '').slice(1), 'fbclid');
    if (recovered && /^[A-Za-z0-9_-]+$/.test(recovered)) {
      try {
        var fixed = new URL(location.href);
        fixed.searchParams.set('fbclid', recovered);
        history.replaceState(history.state, '', fixed.href);
        click = recovered;
      } catch (e) {}
    }
  }
  if (!/^[A-Za-z0-9_-]+$/.test(click)) click = '';
  window.__llaDecorateCheckout = function (href) {
    try {
      var next = new URL(href, location.href);
      if (next.origin !== location.origin) return href;
      if (click) next.searchParams.set('fbclid', click);
      ['qa', 'llatest'].forEach(function (key) {
        if (queryValue(location.search, key) === '1') next.searchParams.set(key, '1');
      });
      return next.href;
    } catch (e) { return href; }
  };
  window.__llaRefreshClickPayload = function (body) {
    try {
      var payload = JSON.parse(body);
      var cookie = document.cookie.match(/(?:^|;\s*)_fbc=([^;]+)/);
      /* 2026-09-24: keep a spec-built fallback (fb.1.<ts>.<raw fbclid>) when the Pixel cookie is missing. */
      var stored = null; try { stored = JSON.parse(localStorage.getItem('lla_fbc_v1') || 'null'); } catch (e) {}
      payload.fbc = cookie ? cookie[1] : (payload.fbc || (stored && stored.v) || '');
      // Recovered original URL, never a fabricated or normalized click ID.
      payload.url = location.href;
      return JSON.stringify(payload);
    } catch (e) { return body; }
  };
})();
