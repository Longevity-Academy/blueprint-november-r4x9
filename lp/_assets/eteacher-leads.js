(function(){
  var ETEACHER_ENV = 'production'; // staging-tested 2026-05-06; flipped to production per CEO request
  // Routed through Cloudflare Worker proxy (adds CORS headers; eTeacher API has none)
  // Worker source: workspace/eteacher-proxy-worker/src/index.js
  var ENDPOINTS = {
    staging:    'https://eteacher-leads-proxy.gitter-omri.workers.dev/leads/staging',
    production: 'https://eteacher-leads-proxy.gitter-omri.workers.dev/leads/production'
  };

  // Best-effort country-by-IP lookup (free, no key, single attempt, no PII).
  // Used only to populate CountryIsoCodeByIp; failure is non-blocking.
  var ipCountryPromise = null;
  function getIpCountry(){
    if (ipCountryPromise) return ipCountryPromise;
    ipCountryPromise = fetch('https://ipapi.co/country/', { method: 'GET', cache: 'force-cache' })
      .then(function(r){ return r.ok ? r.text() : ''; })
      .then(function(t){ t = (t||'').trim().toUpperCase(); return /^[A-Z]{2}$/.test(t) ? t : ''; })
      .catch(function(){ return ''; });
    return ipCountryPromise;
  }

  function isValidEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

  // ---------- Click-ID + UTM capture ----------
  // Captures gclid/fbclid/etc + utm_* on first landing, persists 30d in localStorage,
  // and surfaces them via window.eTeacherLeads.getAttribution() for inclusion on submit.
  var ATTR_KEYS = ['gclid','fbclid','msclkid','ttclid','li_fat_id','wbraid','gbraid','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  var ATTR_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  var ATTR_STORAGE_KEY = 'lla_attribution_v1';
  function readAttributionStorage(){
    try {
      var raw = localStorage.getItem(ATTR_STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || (Date.now() - obj.ts) > ATTR_TTL_MS) return null;
      return obj;
    } catch(e) { return null; }
  }
  function captureAttribution(){
    try {
      var params = new URLSearchParams(window.location.search || '');
      var found = {};
      var hasAny = false;
      ATTR_KEYS.forEach(function(k){
        var v = params.get(k);
        if (v) { found[k] = v; hasAny = true; }
      });
      if (hasAny) {
        found.ts = Date.now();
        found.first_landing = window.location.href;
        found.first_referrer = document.referrer || '';
        try { localStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(found)); } catch(e){}
        return found;
      }
      return readAttributionStorage();
    } catch(e) { return null; }
  }
  var _cachedAttribution = captureAttribution();
  function getAttribution(){ return _cachedAttribution || readAttributionStorage(); }
  function buildDynamicParameters(attr){
    if (!attr) return '';
    var pairs = [];
    ATTR_KEYS.forEach(function(k){ if (attr[k]) pairs.push(k + '=' + attr[k]); });
    return pairs.join(';');
  }

  // Retry policy per docs section 4: 3 attempts, exp backoff starting at 1s, only on 5xx / network.
  function postWithRetry(url, payload, attempt){
    attempt = attempt || 1;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      mode: 'cors'
    }).then(function(res){
      if (res.status === 200) return { ok: true, status: 200 };
      if (res.status >= 400 && res.status < 500) return { ok: false, status: res.status, retryable: false };
      // 5xx -> retry
      if (attempt < 3) {
        var delay = Math.pow(2, attempt - 1) * 1000;
        return new Promise(function(resolve){
          setTimeout(function(){ resolve(postWithRetry(url, payload, attempt + 1)); }, delay);
        });
      }
      return { ok: false, status: res.status, retryable: true };
    }).catch(function(err){
      // Network error -> retry
      if (attempt < 3) {
        var delay = Math.pow(2, attempt - 1) * 1000;
        return new Promise(function(resolve){
          setTimeout(function(){ resolve(postWithRetry(url, payload, attempt + 1)); }, delay);
        });
      }
      return { ok: false, status: 0, retryable: true, error: String(err) };
    });
  }

  // Public API: window.eTeacherLeads.submit(fields)
  // fields: { firstName, lastName, email, phone, countryIso, adminNotes }
  // Returns Promise<{ ok: bool, status: number, error?: string }>
  window.eTeacherLeads = {
    endpoint: ENDPOINTS[ETEACHER_ENV],
    env: ETEACHER_ENV,
    getAttribution: getAttribution,
    submit: function(fields){
      // Hard validation per docs section 3.3.
      if (!fields || !fields.firstName || !fields.lastName || !isValidEmail(fields.email||'') || !fields.phone || !fields.countryIso) {
        return Promise.resolve({ ok: false, status: 0, error: 'Missing or invalid fields' });
      }
      // ---- USA-ONLY HARD GATE ----------------------------------------------
      // The CRM was tagging leads by phone dial code, letting non-US numbers
      // (Macau +853, Germany +49, China +86, etc.) through. We now REQUIRE a
      // valid US (+1 NANP) phone with an assigned US area code, and we ALWAYS
      // send CountryIsoCode = 'US'. The selected US state goes in State fields.
      var usPhone = (window.LLA_US && window.LLA_US.validatePhone)
        ? window.LLA_US.validatePhone(fields.phone)
        : { ok: false, reason: 'validator_unavailable' };
      if (!usPhone.ok) {
        return Promise.resolve({ ok: false, status: 0, error: 'non_us_phone', reason: usPhone.reason });
      }
      // countryIso coming from the form is actually the US STATE code. Keep it
      // as the state, and reject anything that is not one of the 50 states + DC.
      var stateCode = String(fields.countryIso).toUpperCase();
      var US_STATES = { AL:1,AK:1,AZ:1,AR:1,CA:1,CO:1,CT:1,DE:1,DC:1,FL:1,GA:1,HI:1,ID:1,IL:1,IN:1,IA:1,KS:1,KY:1,LA:1,ME:1,MD:1,MA:1,MI:1,MN:1,MS:1,MO:1,MT:1,NE:1,NV:1,NH:1,NJ:1,NM:1,NY:1,NC:1,ND:1,OH:1,OK:1,OR:1,PA:1,RI:1,SC:1,SD:1,TN:1,TX:1,UT:1,VT:1,VA:1,WA:1,WV:1,WI:1,WY:1 };
      if (!US_STATES[stateCode]) {
        return Promise.resolve({ ok: false, status: 0, error: 'invalid_state' });
      }
      return getIpCountry().then(function(ipCountry){
        var payload = {
          ProductID: 26,
          FirstName: String(fields.firstName).trim(),
          LastName:  String(fields.lastName).trim(),
          Email:     String(fields.email).trim(),
          MobilePhone: usPhone.e164,
          CountryIsoCode: 'US',
          State: stateCode,
          StateProvinceRegion: stateCode,
          LandingPage: window.location.href,
          UserAgent: navigator.userAgent,
          ReferringSite: document.referrer || window.location.hostname,
          QueryString: (window.location.search || '').replace(/^\?/, '')
        };
        // Always report US for the IP-derived country too, so a foreign IP can
        // never re-tag this lead as non-US downstream.
        payload.CountryIsoCodeByIp = 'US';
        // Always surface the selected US state in AdminNotes (in case the CRM
        // does not map the State field), plus any existing admin notes.
        var notes = 'US State: ' + stateCode;
        if (fields.adminNotes) notes += ' | ' + String(fields.adminNotes);
        payload.AdminNotes = notes.slice(0, 4000);
        // Attribution: pass click IDs + UTMs to eTeacher in DynamicParameters
        var attr = getAttribution();
        var dyn = buildDynamicParameters(attr);
        // Also include Google Ads Campaign ID in DynamicParameters for eTeacher visibility
        var googleCampaignId = '';
        if (fields.googleCampaignId && /^\d+$/.test(String(fields.googleCampaignId))) {
          googleCampaignId = String(fields.googleCampaignId);
          dyn = (dyn ? dyn + ';' : '') + 'google_campaign_id=' + googleCampaignId;
        }
        if (dyn) payload.DynamicParameters = dyn.slice(0, 4000);
        // eTeacher CampaignID (their internal integer). Configure via window.LLA_CAMPAIGN_IDS.
        if (fields.campaignId && /^\d+$/.test(String(fields.campaignId))) {
          payload.CampaignID = parseInt(fields.campaignId, 10);
        }
        return postWithRetry(ENDPOINTS[ETEACHER_ENV], payload);
      });
    }
  };
})();
