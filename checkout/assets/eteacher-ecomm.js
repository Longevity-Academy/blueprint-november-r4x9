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
  if (CFG.crmCourse.preferredCourseId  == null) CFG.crmCourse.preferredCourseId  = 168663;  // 11 Aug 2026: US customer path - bind to an open cohort so CRM allocates class+price. 168663 = 2026-10 Longevity English open class
  if (CFG.crmCourse.abroadCourseId     == null) CFG.crmCourse.abroadCourseId     = 1774; // Aug 5 2026 eTeacher dev: the class-level course ID
  if (CFG.crmCourse.languageId         == null) CFG.crmCourse.languageId         = 101;
  if (CFG.crmCourse.isTrial            == null) CFG.crmCourse.isTrial            = 0;

  /* Custom price on the order. Verified live on eTeacher staging 8 Sep 2026:
   * sending FirstPayment moves AmountToCharge to the value sent (279.80 -> 179.00),
   * while the CRM's own catalogue stays untouched (CoursePrice 1399.00,
   * CoursePricePerMonth 280.00). This is the mechanism a sales rep uses to apply
   * a discount, and it configures nothing inside the CRM.
   *   list 279.80/mo, 1399.00 total  ->  179.00/mo, 895.00 total  = 36% off
   *   LeftToPay = 4 x 179.00 = 716.00 */
  CFG.crmPrice = CFG.crmPrice || {};
  if (CFG.crmPrice.firstPayment     == null) CFG.crmPrice.firstPayment     = 179;
  if (CFG.crmPrice.numberOfPayments == null) CFG.crmPrice.numberOfPayments = 5;
  if (CFG.crmPrice.leftToPay        == null) CFG.crmPrice.leftToPay        = 716;

  /* Two-plan offer, Sep 9 2026. Monthly and Upfront against the SAME course.
   *   monthly = 5 x $179  = $895 total (36% off $1,395 list)
   *   upfront = 1 x $799  = $799 total (43% off $1,395 list, ~$96 less than monthly)
   * Verified staging Sep 9 2026: order 8017410, student 11638211,
   * Airwallex intent int_sgpvzggzxhm4mqvafja, amount 799 USD, catalogue untouched. */
  CFG.crmPlans = CFG.crmPlans || {
    monthly: { firstPayment: 179, numberOfPayments: 5, leftToPay: 716 },
    upfront: { firstPayment: 799, numberOfPayments: 1, leftToPay: 0   }
  };
  function resolvePlan(){
    var pl = '';
    try { var q = new URLSearchParams(location.search); pl = q.get('plan') || ''; } catch(e){}
    if (pl !== 'monthly' && pl !== 'upfront') { try { pl = sessionStorage.getItem('lla_plan') || ''; } catch(e){} }
    if (pl !== 'monthly' && pl !== 'upfront') { try { pl = localStorage.getItem('lla_plan') || ''; } catch(e){} }
    if (pl !== 'monthly' && pl !== 'upfront') pl = 'monthly';
    return pl;
  }
  function activePrice(){
    var pl = resolvePlan();
    var chosen = CFG.crmPlans[pl] || CFG.crmPlans.monthly;
    return {
      plan: pl,
      firstPayment:     (CFG.crmPrice && CFG.crmPrice.firstPayment     != null && pl === 'monthly') ? CFG.crmPrice.firstPayment     : chosen.firstPayment,
      numberOfPayments: (CFG.crmPrice && CFG.crmPrice.numberOfPayments != null && pl === 'monthly') ? CFG.crmPrice.numberOfPayments : chosen.numberOfPayments,
      leftToPay:        (CFG.crmPrice && CFG.crmPrice.leftToPay        != null && pl === 'monthly') ? CFG.crmPrice.leftToPay        : chosen.leftToPay
    };
  }
  window.LLA_ECOMM_PLANS = { resolvePlan: resolvePlan, activePrice: activePrice };

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
  /* Raw query read, no decoding. URLSearchParams.get() percent-decodes and turns '+'
   * into a space. Doing that to fbclid corrupts it, and Meta then reports "Server
   * sending modified fbclid value in fbc parameter" and drops the attribution.
   * Click IDs must be stored exactly as they appeared in the URL. */
  var RAW_KEYS = { fbclid:1, gclid:1, wbraid:1, gbraid:1, msclkid:1, ttclid:1, li_fat_id:1 };
  function rawParam(n){
    try {
      var m = String(window.location.search || '').match(new RegExp('[?&]' + n + '=([^&#]*)'));
      return m ? m[1] : '';
    } catch(e) { return ''; }
  }
  function captureAttribution(){
    try {
      var params = new URLSearchParams(window.location.search || '');
      var found = {}; var hasAny = false;
      ATTR_KEYS.forEach(function(k){
        var v = RAW_KEYS[k] ? rawParam(k) : params.get(k);
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

    /* Country. The enrol modal now offers United States plus the rest of the
     * world. The United States branch below is exactly what it always was, so
     * a US lead reaches the CRM byte-for-byte as before; only a non-US country
     * takes the new branch.
     *
     * Per the Leads API doc, CountryIsoCode is a required ISO 3166-1 alpha-2
     * value and the examples are US, IL and GB, so a non-US code is supported.
     * MobilePhone is documented as a valid number for the lead's country with
     * E.164 preferred, not as US-only. */
    var countryIso = 'US';
    try {
      if (window.LLA_COUNTRY && window.LLA_COUNTRY.selected) countryIso = window.LLA_COUNTRY.selected() || 'US';
    } catch (e) {}
    if (fields.countryIso) countryIso = String(fields.countryIso).toUpperCase();

    var e164, stateCode = '';
    if (countryIso === 'US') {
      // Unchanged US path: valid US (+1 NANP) phone required.
      var usPhone = (window.LLA_US && window.LLA_US.validatePhone)
        ? window.LLA_US.validatePhone(fields.phone)
        : { ok: false, reason: 'validator_unavailable' };
      if (!usPhone.ok) return { error: 'non_us_phone', reason: usPhone.reason };
      // State: derived from the validated US area code (NANPA map). Every valid
      // US area code maps to a state, so the modal needs no extra field.
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
      // No state is asked for or sent outside the United States.
    }

    var payload = {
      ProductID: 26,
      FirstName: firstName,
      LastName: lastName,
      Email: String(fields.email).trim(),
      MobilePhone: e164,
      /* PRICING CURRENCY GUARD (2026-09-09). The CRM prices the order by
       * CountryIsoCode: an IL lead was minted an ILS Airwallex intent (verified
       * live, intent int_nlpd6cws2hm4v98p9p1). This product is sold in USD only,
       * so the order is always created as US and the buyer's real country is
       * recorded in AdminNotes and kept in the E.164 phone. */
      CountryIsoCode: 'US',
      CountryIsoCodeByIp: 'US',
      State: stateCode,
      StateProvinceRegion: stateCode,
      LandingPage: window.location.href,
      UserAgent: navigator.userAgent,
      ReferringSite: document.referrer || window.location.hostname,
      QueryString: (window.location.search || '').replace(/^\?/, '')
    };
    /* Persist the buyer identity for Meta matching. Meta scores every event on
     * how many match keys it carries, so storing the full set here lets the
     * store-page events and the checkout Purchase inherit name, phone, state
     * and a stable external_id instead of email alone. No new network call is
     * made and no CRM field is read or written differently. */
    try {
      var _xid = localStorage.getItem('lla_xid_v1');
      if (!_xid) { _xid = 'lla' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); localStorage.setItem('lla_xid_v1', _xid); }
      var _ident = {
        email: String(payload.Email || '').trim().toLowerCase(),
        phone: String(payload.MobilePhone || '').trim(),
        fn: String(payload.FirstName || '').toLowerCase().replace(/[^a-z]/g, ''),
        ln: String(payload.LastName || '').toLowerCase().replace(/[^a-z]/g, ''),
        st: String(payload.State || '').trim().toLowerCase(),
        country: 'us',
        external_id: _xid
      };
      localStorage.setItem('lla_identity_v1', JSON.stringify(_ident));
      try { sessionStorage.setItem('lla_buyer_v1', JSON.stringify(_ident)); } catch (e) {}
      if (window.dataLayer) window.dataLayer.push({ event: 'lla_identity_ready', lla_em: _ident.email, lla_ph: _ident.phone, lla_fn: _ident.fn, lla_ln: _ident.ln, lla_st: _ident.st, lla_country: 'us', lla_external_id: _xid });
      if (window.fbq) window.fbq('init', '1440305917310328', { em: _ident.email, ph: _ident.phone.replace(/[^0-9]/g, ''), fn: _ident.fn, ln: _ident.ln, st: _ident.st, country: 'us', external_id: _xid });
    } catch (e) {}

    var notes = 'Buyer country: ' + countryIso + ' | US State: ' + (stateCode || '-') + ' | SELF-SERVICE ECOMM CHECKOUT: The Longevity Blueprint';
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
      payload.PreferredCourseId  = crs.preferredCourseId  != null ? crs.preferredCourseId  : 168663;
      payload.AbroadCourseId     = crs.abroadCourseId     != null ? crs.abroadCourseId     : 1774;
      payload.LanguageId         = crs.languageId         != null ? crs.languageId         : 1;
      payload.IsTrial            = crs.isTrial            != null ? crs.isTrial            : 0; // 0 = NoTrial (full-price order), 1 = Trial
      // Discounted price for this order (activePrice() picks monthly vs upfront).
      var pr = activePrice();
      payload.FirstPayment     = Number(pr.firstPayment);
      payload.NumberOfPayments = Number(pr.numberOfPayments);
      payload.LeftToPay        = Number(pr.leftToPay);
      /* stamp the chosen plan on the CRM lead (allowed chars only) */
      var _planExtra = 'plan=' + pr.plan;
      payload.DynamicParameters = ((payload.DynamicParameters ? payload.DynamicParameters + '&' : '') + _planExtra);
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
      var noteWords = (countryIso === 'US')
        ? ['US', 'State', stateCode, 'SELF', 'SERVICE', 'ECOMM', 'CHECKOUT', 'The', 'Longevity', 'Blueprint']
        : ['Country', countryIso, 'SELF', 'SERVICE', 'ECOMM', 'CHECKOUT', 'The', 'Longevity', 'Blueprint'];
      if (fields.startDate)  noteWords = noteWords.concat(['Start', String(fields.startDate)]);
      if (fields.smsConsent !== undefined) noteWords = noteWords.concat(['SMS', 'consent', fields.smsConsent ? 'yes' : 'no']);
      if (fields.promoCode)  noteWords = noteWords.concat(['Promo', String(fields.promoCode)]);
      var message = noteWords.map(function(w){ return String(w).replace(/[^A-Za-z0-9_\-]/g, ''); })
                             .filter(function(w){ return w.length; }).join('%20');
      /* stateisocodebyip carries a US STATE ISO code, which the CRM resolves
         against the country. There is no state outside the United States, so
         the key is omitted rather than filled with something invented. */
      var dynExtra = (countryIso === 'US' && stateCode)
        ? ('stateisocodebyip=' + stateCode + '&message=' + message)
        : ('message=' + message);
      payload.DynamicParameters = ((payload.DynamicParameters ? payload.DynamicParameters + '&' : '') + dynExtra).slice(0, 4000);
    }
    return { payload: payload };
  }

  /* ---------- Staged lead (SOLUTION A) ----------
   * The details screen must not create a CRM record. stageLead() runs the SAME
   * hard validation as submitLead() and stores the finished payload, captured on
   * the store page so LandingPage / QueryString / ReferringSite / UserAgent and
   * the click-ID attribution are the ones the visitor actually arrived with.
   * createStagedOrder() is called by the payment page just before it asks the
   * CRM for the Airwallex intent. It is single-flight and id-reusing, so a
   * refresh, a back-button or a double click can never create a second order. */
  var PENDING_KEY = 'lla_ecomm_pending';
  var _creating = null;
  function readPending(){
    try {
      var raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return (obj && obj.payload) ? obj : null;
    } catch(e) { return null; }
  }
  function readIds(){
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('stid') && q.get('orderid')) return { stid: q.get('stid'), orderid: q.get('orderid') };
      var raw = sessionStorage.getItem('lla_ecomm_ids');
      var o = raw ? JSON.parse(raw) : null;
      return (o && o.stid && o.orderid) ? o : null;
    } catch(e) { return null; }
  }

  /* ---------- Public API ---------- */
  window.LLA_ECOMM = {
    config: CFG,
    getAttribution: getAttribution,
    stageLead: function(fields){
      var built = buildLeadPayload(fields);
      if (built.error) return { ok: false, error: built.error, reason: built.reason };
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ payload: built.payload, ts: Date.now() }));
      } catch(e) {
        return { ok: false, error: 'storage_unavailable' };
      }
      return { ok: true };
    },
    hasPendingLead: function(){ return !!readPending(); },
    createStagedOrder: function(){
      var ids = readIds();
      if (ids) return Promise.resolve(ids);
      if (_creating) return _creating;
      var pending = readPending();
      if (!pending) return Promise.reject(new Error('NO_PENDING_LEAD'));
      /* PLAN FIX (2026-09-17). The payload is snapshotted on screen 1, BEFORE the
       * buyer picks Monthly/Upfront on screen 2, so it carried the default monthly
       * price (FirstPayment 179 x 5) even when the buyer chose "$799 one payment"
       * (verified live: order 8026893, AmountToCharge 179, NumOfPayments 5).
       * Re-resolve the plan here, on the payment screen where ?plan= is final, so
       * the CRM order and the Airwallex intent match what the buyer selected. */
      try {
        var _pr = activePrice(); var _pl = pending.payload;
        _pl.FirstPayment     = Number(_pr.firstPayment);
        _pl.NumberOfPayments = Number(_pr.numberOfPayments);
        _pl.LeftToPay        = Number(_pr.leftToPay);
        if (typeof _pl.DynamicParameters === 'string') {
          _pl.DynamicParameters = /(^|&)plan=(monthly|upfront)/.test(_pl.DynamicParameters)
            ? _pl.DynamicParameters.replace(/(^|&)plan=(monthly|upfront)/, '$1plan=' + _pr.plan)
            : (_pl.DynamicParameters + '&plan=' + _pr.plan);
        }
      } catch(e){}
      var base = CFG.workerBase.replace(/\/$/, '');
      var prefix = CFG.env === 'staging' ? '/staging' : '';
      _creating = postWithRetry(base + prefix + '/api/lead/ecomm', pending.payload).then(function(r){
        var bb = (r && r.body) || {};
        var stid = bb.stid || bb.StudentId || bb.studentId || bb.StudentID || '';
        var orderid = bb.orderid || bb.OrderId || bb.orderId || bb.OrderID || '';
        if (r.ok && stid && orderid) {
          var out = { stid: String(stid), orderid: String(orderid) };
          try { sessionStorage.setItem('lla_ecomm_ids', JSON.stringify({ stid: out.stid, orderid: out.orderid, ts: Date.now() })); } catch(e){}
          try { sessionStorage.removeItem(PENDING_KEY); } catch(e){}
          return out;
        }
        var err = new Error('LEAD_CREATE_FAILED');
        err.status = (r && r.status) || 0;
        err.retryable = !!(r && r.retryable);
        throw err;
      }).catch(function(e){
        _creating = null;   // allow one clean retry from the payment screen
        throw e;
      });
      return _creating;
    },
    submitLead: function(fields){
      var built = buildLeadPayload(fields);
      if (built.error) return Promise.resolve({ ok: false, status: 0, error: built.error, reason: built.reason });
      var base = CFG.workerBase.replace(/\/$/, '');
      if (CFG.mode === 'ecomm') {
        var prefix = CFG.env === 'staging' ? '/staging' : '';
        return postWithRetry(base + prefix + '/api/lead/ecomm', built.payload).then(function(r){
          var bb = (r && r.body) || {};
          var stid = bb.stid || bb.StudentId || bb.studentId || bb.StudentID || '';
          var orderid = bb.orderid || bb.OrderId || bb.orderId || bb.OrderID || '';
          if (r.ok && stid && orderid) {
            try { sessionStorage.setItem('lla_ecomm_ids', JSON.stringify({ stid: String(stid), orderid: String(orderid), ts: Date.now() })); } catch(e){}
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
