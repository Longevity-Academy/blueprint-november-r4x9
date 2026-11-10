/* LLA self-service checkout — eTeacher CRM wiring.
 * Applies the SAME API rules as the longevitylifeacademy.com website integration
 * (lp/_assets/eteacher-leads.js): ProductID 26 (Longevity), USA-only hard gate
 * (NANP phone -> E.164, 50 states + DC), CountryIsoCode/ByIp always 'US',
 * AdminNotes <=4000 with 'US State: XX' prefix, click-ID + UTM attribution in
 * DynamicParameters (30-day persistence), integer CampaignID only, and the
 * docs section 4 retry policy: 3 attempts, exp backoff from 1s, 5xx/network only.
 *
 * Flow (Cloudflare ecommerce spec):
 *   Step 1 Continue  -> POST {worker}/api/lead/ecomm  -> { orderid, stid }
 *   checkout.html    -> POST {worker}/api/checkout/details (live mode)
 *   gateway result   -> POST {worker}/api/checkout/payments/crm
 * Until the ecommerce CRM endpoints are enabled, ECOMM_MODE 'lead' routes the
 * same normalized payload through the existing proven path:
 *   POST {worker}/leads/{env} -> {CRM}/Students/AddNewLead
 */
(function(){
  var CFG = window.LLA_ECOMM_CONFIG = window.LLA_ECOMM_CONFIG || {};
  CFG.workerBase = CFG.workerBase || 'https://eteacher-leads-proxy.gitter-omri.workers.dev';
  CFG.env = CFG.env || 'production';          // 'staging' | 'production'
  CFG.mode = CFG.mode || 'lead';              // 'lead' (proven AddNewLead path) | 'ecomm' (3-route spec)
  CFG.campaignId = CFG.campaignId || '';      // eTeacher internal CampaignID (integer) — eTeacher to provide for self-service checkout
  CFG.googleCampaignId = CFG.googleCampaignId || '116641'; // LGV_EN_GGL_Search_US_2026-05-05_#116641 — matches homepage payload
  // Final CRM course identity per eTeacher dev team, Aug 4 2026:
  // MainAbroadCourseID 258 = The Longevity Blueprint, LanguageID 101 = English.
  // PreferredCourseId not issued separately -> same course (258).
  CFG.crmCourse = CFG.crmCourse || {};
  if (CFG.crmCourse.mainAbroadCourseId == null) CFG.crmCourse.mainAbroadCourseId = 258;
  if (CFG.crmCourse.preferredCourseId  == null) CFG.crmCourse.preferredCourseId  = -1;   // Aug 5 2026 eTeacher dev: must be -1, 258 is a different ID type
  if (CFG.crmCourse.abroadCourseId     == null) CFG.crmCourse.abroadCourseId     = 1774; // Aug 5 2026 eTeacher dev: the class-level course ID
  if (CFG.crmCourse.languageId         == null) CFG.crmCourse.languageId         = 101;
  if (CFG.crmCourse.isTrial            == null) CFG.crmCourse.isTrial            = 0;

  function isValidEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

  /* ---------- Click-ID + UTM capture (identical to website integration) ---------- */
  var ATTR_KEYS = ['gclid','fbclid','msclkid','ttclid','li_fat_id','wbraid','gbraid','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  var ATTR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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
      var found = {}; var hasAny = false;
      ATTR_KEYS.forEach(function(k){ var v = params.get(k); if (v) { found[k] = v; hasAny = true; } });
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

  /* ---------- Retry policy per docs section 4 ---------- */
  function postWithRetry(url, payload, attempt){
    attempt = attempt || 1;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      mode: 'cors'
    }).then(function(res){
      if (res.status === 200) return res.json().then(function(b){ return { ok: true, status: 200, body: b }; }).catch(function(){ return { ok: true, status: 200, body: null }; });
      if (res.status >= 400 && res.status < 500) return { ok: false, status: res.status, retryable: false };
      if (attempt < 3) {
        var delay = Math.pow(2, attempt - 1) * 1000;
        return new Promise(function(resolve){ setTimeout(function(){ resolve(postWithRetry(url, payload, attempt + 1)); }, delay); });
      }
      return { ok: false, status: res.status, retryable: true };
    }).catch(function(err){
      if (attempt < 3) {
        var delay = Math.pow(2, attempt - 1) * 1000;
        return new Promise(function(resolve){ setTimeout(function(){ resolve(postWithRetry(url, payload, attempt + 1)); }, delay); });
      }
      return { ok: false, status: 0, retryable: true, error: String(err) };
    });
  }

  /* ---------- Lead payload (hard validation per docs section 3.3) ---------- */
  var US_STATES = { AL:1,AK:1,AZ:1,AR:1,CA:1,CO:1,CT:1,DE:1,DC:1,FL:1,GA:1,HI:1,ID:1,IL:1,IN:1,IA:1,KS:1,KY:1,LA:1,ME:1,MD:1,MA:1,MI:1,MN:1,MS:1,MO:1,MT:1,NE:1,NV:1,NH:1,NJ:1,NM:1,NY:1,NC:1,ND:1,OH:1,OK:1,OR:1,PA:1,RI:1,SC:1,SD:1,TN:1,TX:1,UT:1,VT:1,VA:1,WA:1,WV:1,WI:1,WY:1 };

  function buildLeadPayload(fields){
    if (!fields || !fields.fullName || !isValidEmail(fields.email||'') || !fields.phone) {
      return { error: 'Missing or invalid fields' };
    }
    var parts = String(fields.fullName).trim().split(/\s+/);
    if (parts.length < 2) return { error: 'need_full_name' };
    var firstName = parts.shift();
    var lastName = parts.join(' ');

    /* Country: United States plus the rest of the world (same branch as the
     * live funnel). US path unchanged; a non-US country validates the number
     * against its own dial plan and sends E.164. Pricing currency guard: the
     * order is always created as US (USD), real country kept in AdminNotes. */
    var countryIso = 'US';
    try { if (window.LLA_COUNTRY && window.LLA_COUNTRY.selected) countryIso = window.LLA_COUNTRY.selected() || 'US'; } catch (e) {}
    if (fields.countryIso) countryIso = String(fields.countryIso).toUpperCase();
    var e164, stateCode = '';
    if (countryIso === 'US') {
      var usPhone = (window.LLA_US && window.LLA_US.validatePhone)
        ? window.LLA_US.validatePhone(fields.phone)
        : { ok: false, reason: 'validator_unavailable' };
      if (!usPhone.ok) return { error: 'non_us_phone', reason: usPhone.reason };
      var ac = (usPhone.e164 || '').slice(2, 5);
      stateCode = (window.LLA_US && window.LLA_US.stateForAreaCode) ? window.LLA_US.stateForAreaCode(ac) : '';
      if (!US_STATES[stateCode]) return { error: 'invalid_state' };
      e164 = usPhone.e164;
    } else {
      var intl = (window.LLA_COUNTRY && window.LLA_COUNTRY.toE164)
        ? window.LLA_COUNTRY.toE164(fields.phone, countryIso)
        : { ok: false, reason: 'validator_unavailable' };
      if (!intl.ok) return { error: 'invalid_phone', reason: intl.reason };
      e164 = intl.e164;
    }

    var payload = {
      ProductID: 26,
      FirstName: firstName,
      LastName: lastName,
      Email: String(fields.email).trim(),
      MobilePhone: e164,
      CountryIsoCode: 'US',
      CountryIsoCodeByIp: 'US',
      State: stateCode,
      StateProvinceRegion: stateCode,
      LandingPage: window.location.href,
      UserAgent: navigator.userAgent,
      ReferringSite: document.referrer || window.location.hostname,
      QueryString: (window.location.search || '').replace(/^\?/, '')
    };
    var notes = (countryIso === 'US' ? 'US State: ' + stateCode : 'Country: ' + countryIso) + ' | SELF-SERVICE ECOMM CHECKOUT: The Longevity Blueprint';
    if (fields.startDate) notes += ' · Start: ' + fields.startDate;
    if (fields.smsConsent !== undefined) notes += ' · SMS consent: ' + (fields.smsConsent ? 'yes' : 'no');
    if (fields.promoCode) notes += ' · Promo: ' + fields.promoCode;
    payload.AdminNotes = notes.slice(0, 4000);

    var dyn = buildDynamicParameters(getAttribution());
    if (CFG.googleCampaignId && /^\d+$/.test(String(CFG.googleCampaignId))) {
      dyn = (dyn ? dyn + ';' : '') + 'google_campaign_id=' + String(CFG.googleCampaignId);
    }
    if (dyn) payload.DynamicParameters = dyn.slice(0, 4000);
    // Aug 5 2026 eTeacher dev: CampaignID does not exist on this endpoint, it is ignored.
    // The campaign is read from QueryString only, as cid=<id>.
    delete payload.CampaignID;
    (function () {
      var cid = CFG.campaignId && /^\d+$/.test(String(CFG.campaignId)) ? String(CFG.campaignId) : String(CFG.googleCampaignId || '');
      if (!/^\d+$/.test(cid)) return;
      var qs = payload.QueryString || '';
      if (!/(^|&)cid=/.test(qs)) qs = qs ? qs + '&cid=' + cid : 'cid=' + cid;
      payload.QueryString = qs.slice(0, 2000);
    })();

    // ECOMM (AddNewECommerceLeadAndOrder) required DTO fields, per eTeacher dev team
    // Aug 4 2026: MainAbroadCourseId missing = server NRE. Values come from config
    // (window.LLA_ECOMM_CONFIG.crmCourse), set per environment once eTeacher provides them.
    if (CFG.mode === 'ecomm') {
      var crs = CFG.crmCourse || {};
      payload.MainAbroadCourseId = crs.mainAbroadCourseId != null ? crs.mainAbroadCourseId : 0;
      payload.PreferredCourseId  = crs.preferredCourseId  != null ? crs.preferredCourseId  : -1;
      payload.AbroadCourseId     = crs.abroadCourseId     != null ? crs.abroadCourseId     : 1774;
      payload.LanguageId         = crs.languageId         != null ? crs.languageId         : 1;
      payload.IsTrial            = crs.isTrial            != null ? crs.isTrial            : 0; // 0 = NoTrial (full-price order), 1 = Trial
      // State handling per eTeacher dev, Aug 4 2026 (final): do NOT send State,
      // StateProvinceRegion or StateId (a StateId suppresses their ISO lookup).
      // Pass the ISO code as 'stateisocodebyip' inside DynamicParameters; the CRM
      // resolves it to the internal ID, validated against the country.
      delete payload.State;
      delete payload.StateProvinceRegion;
      delete payload.StateId;
      // AdminNotes is not a field on this endpoint; the 'message' key inside
      // DynamicParameters lands in the lead's notes. Spaces must be %20 ('+' is
      // stripped server-side); avoid '|' and '.' characters in values.
      delete payload.AdminNotes;
      var noteWords = ['US', 'State', stateCode, 'SELF', 'SERVICE', 'ECOMM', 'CHECKOUT', 'The', 'Longevity', 'Blueprint'];
      if (fields.startDate)  noteWords = noteWords.concat(['Start', String(fields.startDate)]);
      if (fields.smsConsent !== undefined) noteWords = noteWords.concat(['SMS', 'consent', fields.smsConsent ? 'yes' : 'no']);
      if (fields.promoCode)  noteWords = noteWords.concat(['Promo', String(fields.promoCode)]);
      var message = noteWords.map(function(w){ return String(w).replace(/[^A-Za-z0-9_\-]/g, ''); })
                             .filter(function(w){ return w.length; }).join('%20');
      var dynExtra = 'stateisocodebyip=' + stateCode + '&message=' + message;
      payload.DynamicParameters = ((payload.DynamicParameters ? payload.DynamicParameters + '&' : '') + dynExtra).slice(0, 4000);
    }
    return { payload: payload };
  }

  /* ---------- Public API ---------- */
  window.LLA_ECOMM = {
    config: CFG,
    getAttribution: getAttribution,
    submitLead: function(fields){
      var built = buildLeadPayload(fields);
      if (built.error) return Promise.resolve({ ok: false, status: 0, error: built.error, reason: built.reason });
      var base = CFG.workerBase.replace(/\/$/, '');
      if (CFG.mode === 'ecomm') {
        var prefix = CFG.env === 'staging' ? '/staging' : '';
        return postWithRetry(base + prefix + '/api/lead/ecomm', built.payload).then(function(r){
          if (r.ok && r.body && r.body.stid) {
            try { sessionStorage.setItem('lla_ecomm_ids', JSON.stringify({ stid: r.body.stid, orderid: r.body.orderid, ts: Date.now() })); } catch(e){}
          }
          return r;
        });
      }
      // 'lead' mode: proven website path — CRM connected via /Students/AddNewLead.
      return postWithRetry(base + '/leads/' + CFG.env, built.payload);
    },
    getCheckoutIds: function(){
      try {
        var q = new URLSearchParams(location.search);
        if (q.get('stid') && q.get('orderid')) return { stid: q.get('stid'), orderid: q.get('orderid') };
        var raw = sessionStorage.getItem('lla_ecomm_ids');
        return raw ? JSON.parse(raw) : null;
      } catch(e) { return null; }
    },
    fetchCheckoutDetails: function(ids){
      if (!ids || CFG.mode !== 'ecomm') return Promise.resolve(null);
      var base = CFG.workerBase.replace(/\/$/, '');
      var prefix = CFG.env === 'staging' ? '/staging' : '';
      return postWithRetry(base + prefix + '/api/checkout/details', { studentId: String(ids.stid), orderId: String(ids.orderid) })
        .then(function(r){ return r.ok ? r.body : null; });
    },
    reportPayment: function(report){
      // NEVER include raw card data (Pan/CardNumber/Cvv/Cvc/SecurityCode) — worker rejects it.
      if (CFG.mode !== 'ecomm') return Promise.resolve({ ok: false, error: 'ecomm_mode_off' });
      var base = CFG.workerBase.replace(/\/$/, '');
      var prefix = CFG.env === 'staging' ? '/staging' : '';
      return postWithRetry(base + prefix + '/api/checkout/payments/crm', report);
    }
  };
})();
