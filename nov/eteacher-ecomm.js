/* LLA self-service checkout — eTeacher CRM wiring.
 * Applies the SAME API rules as the longevitylifeacademy.com website integration
 * (lp/_assets/eteacher-leads.js): ProductID 26 (Longevity), USA-only hard gate
 * (NANP phone -> E.164, 50 states + DC), CountryIsoCode/ByIp always 'US',
 * AdminNotes <=4000 with 'US State: XX' prefix, click-ID + UTM attribution in
 * DynamicParameters (30-day persistence), integer CampaignID only, and the
 * docs section 4 retry policy for non-order writes only; order creation is never
 * automatically replayed after an ambiguous response.
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
var BLUEPRINT_CLASSES = [{"courseId":170275,"semesterId":2395,"start":"2026-11-23","sourceTimestamp":"2026-11-23T21:00:00","sourceOffset":-4,"day":"23","mon":"Nov","month":"November","wd":"Mon","et":"8:00 PM","ct":"7:00 PM","pt":"5:00 PM"},{"courseId":170277,"semesterId":2395,"start":"2026-11-25","sourceTimestamp":"2026-11-25T13:00:00","sourceOffset":-4,"day":"25","mon":"Nov","month":"November","wd":"Wed","et":"12:00 PM","ct":"11:00 AM","pt":"9:00 AM"}];
  function selectedBlueprintClass(text){text=String(text||'');return BLUEPRINT_CLASSES.find(function(c){return text.indexOf(c.start)!==-1||new RegExp(c.mon+'[ ]*'+c.day,'i').test(text)})||null;}

  var CFG = window.LLA_ECOMM_CONFIG = window.LLA_ECOMM_CONFIG || {};
  CFG.workerBase = CFG.workerBase || 'https://eteacher-leads-proxy.gitter-omri.workers.dev';
  CFG.env = CFG.env || 'production';          // 'staging' | 'production'
  CFG.mode = CFG.mode || 'lead';              // 'lead' (proven AddNewLead path) | 'ecomm' (3-route spec)
  CFG.campaignId = CFG.campaignId || '118854'; // Dedicated November campaign fallback, including direct checkout entries.
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
  if (CFG.crmPrice.firstPayment     == null) CFG.crmPrice.firstPayment     = 169;
  if (CFG.crmPrice.numberOfPayments == null) CFG.crmPrice.numberOfPayments = 5;
  if (CFG.crmPrice.leftToPay        == null) CFG.crmPrice.leftToPay        = 676;

  /* Two-plan offer, Sep 9 2026. Monthly and Upfront against the SAME course.
   *   monthly = 5 x $179  = $895 total (36% off $1,395 list)
   *   upfront = 1 x $799  = $799 total (43% off $1,395 list, ~$96 less than monthly)
   * Verified staging Sep 9 2026: order 8017410, student 11638211,
   * Airwallex intent int_sgpvzggzxhm4mqvafja, amount 799 USD, catalogue untouched. */
  CFG.crmPlans = CFG.crmPlans || {
    monthly: { firstPayment: 169, numberOfPayments: 5, leftToPay: 676 },
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
  var ATTR_KEYS = ['gclid','fbclid','msclkid','ttclid','li_fat_id','wbraid','gbraid','utm_source','utm_medium','utm_campaign','utm_content','utm_term','cid','adGroupID','cq_src'];
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
        if ((k === 'cid' || k === 'adGroupID') && !/^[1-9]\d*$/.test(String(v || ''))) v = '';
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
    // Creating a CRM order is not safely replayable after an ambiguous response.
    var createsOrder = /\/api\/lead\/ecomm$/.test(url);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      mode: 'cors'
    }).then(function(res){
      // 202 is the Worker's accepted asynchronous payment-report response.
      // Retrying an accepted response can duplicate downstream reporting.
      if (res.status >= 200 && res.status < 300) return res.json().then(function(b){ return { ok: true, status: res.status, body: b }; }).catch(function(){ return { ok: true, status: res.status, body: null }; });
      if (res.status >= 400 && res.status < 500) return { ok: false, status: res.status, retryable: false };
      if (!createsOrder && attempt < 3) {
        var delay = Math.pow(2, attempt - 1) * 1000;
        return new Promise(function(resolve){ setTimeout(function(){ resolve(postWithRetry(url, payload, attempt + 1)); }, delay); });
      }
      return { ok: false, status: res.status, retryable: true };
    }).catch(function(err){
      if (!createsOrder && attempt < 3) {
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
      stateCode = fields.stateIso || ((window.LLA_US && window.LLA_US.stateForAreaCode) ? window.LLA_US.stateForAreaCode(ac) : '');
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

    var attr = getAttribution() || {};
    var source = String(attr.utm_source || attr.cq_src || '').toLowerCase();
    var isMeta = !!attr.fbclid || /^(facebook|instagram|meta|fb|ig)$/.test(source) || /^(118148|118149)$/.test(String(attr.cid || ''));
    var isGoogle = !isMeta && (!!(attr.gclid || attr.wbraid || attr.gbraid) || /^(google|googleads|adwords)$/.test(source));
    var dyn = buildDynamicParameters(attr);
    if (isGoogle && CFG.googleCampaignId && /^[1-9]\d*$/.test(String(CFG.googleCampaignId))) {
      dyn = (dyn ? dyn + ';' : '') + 'google_campaign_id=' + String(CFG.googleCampaignId);
    }
    if (dyn) payload.DynamicParameters = dyn.slice(0, 4000);
    // Aug 5 2026 eTeacher dev: CampaignID does not exist on this endpoint, it is ignored.
    // The campaign is read from QueryString only, as cid=<id>.
    delete payload.CampaignID;
    (function () {
      var qs = (payload.QueryString || '').replace(/\?/g, '&');
      var currentCid = new URLSearchParams(qs).get('cid') || '';
      var cid = /^[1-9]\d*$/.test(currentCid) ? currentCid : (/^[1-9]\d*$/.test(String(attr.cid || '')) ? String(attr.cid) : (/^[1-9]\d*$/.test(String(CFG.campaignId || '')) ? String(CFG.campaignId) : (isGoogle ? String(CFG.googleCampaignId || '') : '')));
      // Remove only invalid cid parameters; leave raw click IDs byte-for-byte intact.
      qs = qs.split('&').filter(function(pair){ return !/^cid=/.test(pair) || /^[1-9]\d*$/.test(pair.slice(4)); }).join('&');
      // Keep the campaign first and unique, including when a long email query
      // is truncated. Leave all other values (especially click IDs) untouched.
      if (/^[1-9]\d*$/.test(cid)) {
        qs = qs.split('&').filter(function(pair){ return pair && !/^cid=/.test(pair); }).join('&');
        qs = 'cid=' + cid + (qs ? '&' + qs : '');
      }
      if (/^[1-9]\d*$/.test(String(attr.adGroupID || '')) && !/(^|&)adGroupID=/.test(qs)) qs += (qs ? '&' : '') + 'adGroupID=' + attr.adGroupID;
      payload.QueryString = qs.slice(0, 2000);
    })();

    // ECOMM (AddNewECommerceLeadAndOrder) required DTO fields, per eTeacher dev team
    // Aug 4 2026: MainAbroadCourseId missing = server NRE. Values come from config
    // (window.LLA_ECOMM_CONFIG.crmCourse), set per environment once eTeacher provides them.
    if (CFG.mode === 'ecomm') {
      var crs = CFG.crmCourse || {};
      payload.MainAbroadCourseId = crs.mainAbroadCourseId != null ? crs.mainAbroadCourseId : 0;
      payload.PreferredCourseId  = crs.preferredCourseId  != null ? crs.preferredCourseId  : 168663;
      // 2026-09-24 VP Operations: send the CLASS matching the chosen start date plus its SEMESTER, under the
      // admin-form field names (select#PrefferdCourseID / select#ActivitySessionLevel1ID), so the buyer is assigned.
      // From GetECommerceFirstPaymentDetails.AvailableClasses (course 258 / 1774, semester 2273 "2026-10 - Longevity"):
      //   Mon Oct 12 8:00 PM ET -> CourseID 168662 ; Wed Oct 14 11:00 AM ET -> CourseID 168663
      var selected = selectedBlueprintClass(fields.startDate);
      payload.PrefferdCourseID = selected ? selected.courseId : 0;
      payload.PreferredCourseId = selected ? selected.courseId : 0;
      payload.ActivitySessionLevel1ID = selected ? selected.semesterId : 0;
      payload.SemesterID = selected ? selected.semesterId : 0;
      payload.AbroadCourseId     = crs.abroadCourseId     != null ? crs.abroadCourseId     : 1774;
      payload.LanguageId         = crs.languageId         != null ? crs.languageId         : 1;
      payload.IsTrial            = crs.isTrial            != null ? crs.isTrial            : 0; // 0 = NoTrial (full-price order), 1 = Trial
      // Discounted price for this order (activePrice() picks monthly vs upfront).
      var pr = activePrice();
      payload.FirstPayment     = Number(pr.firstPayment);
      // UI configuration counts all payments; CRM counts installments AFTER today.
      payload.NumberOfPayments = pr.plan === 'upfront' ? 1 : Math.max(0, Number(pr.numberOfPayments) - 1);
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
  var CREATE_ATTEMPT_KEY = 'lla_ecomm_create_attempt_v1';
  /* 2026-11-08 fix: the attempt marker is only meaningful while a create request
   * can still be in flight. A finished request (any HTTP response or network
   * error) clears it; a marker older than 45 s is stale (page unloaded mid-flight)
   * and must not lock the buyer out of checkout. */
  var CREATE_ATTEMPT_TTL_MS = 45000;
  function attemptInFlight(){
    try {
      var raw = sessionStorage.getItem(CREATE_ATTEMPT_KEY);
      if (!raw) return false;
      var m = JSON.parse(raw);
      if (!m || !m.ts || (Date.now() - Number(m.ts)) > CREATE_ATTEMPT_TTL_MS) { sessionStorage.removeItem(CREATE_ATTEMPT_KEY); return false; }
      return true;
    } catch(e) { try { sessionStorage.removeItem(CREATE_ATTEMPT_KEY); } catch(ignore) {} return false; }
  }
  var _creating = null;
  function buyerKey(payload){
    return String(payload.Email || payload.EmailAddress || '').trim().toLowerCase() + '|' +
      String(payload.Phone || payload.PhoneNumber || payload.MobilePhone || '').replace(/\D/g, '');
  }
  function readPending(){
    try {
      var raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return (obj && obj.payload && (obj.env || 'production') === CFG.env) ? obj : null;
    } catch(e) { return null; }
  }
  function readIds(){
    try {
      var pending = readPending();
      var q = new URLSearchParams(location.search);
      if (!pending && q.get('stid') && q.get('orderid') && (q.get('env') || 'production') === CFG.env) return { stid: q.get('stid'), orderid: q.get('orderid'), env: CFG.env };
      var raw = sessionStorage.getItem('lla_ecomm_ids');
      var o = raw ? JSON.parse(raw) : null;
      if (pending && (!o || o.buyerKey !== buyerKey(pending.payload))) return null;
      return (o && o.stid && o.orderid && (o.env || 'production') === CFG.env) ? o : null;
    } catch(e) { return null; }
  }

  /* ---------- Public API ---------- */
  function rememberOrderQuote(stid, orderid, payload){
    // Local consistency evidence, not an authorization or server-side discount.
    // Bind it to the created order rather than today's mutable promo state.
    try {
      sessionStorage.setItem('lla_vip_base_v2', JSON.stringify({
        studentId: String(stid), orderId: String(orderid), env: CFG.env,
        payload: JSON.parse(JSON.stringify(payload))
      }));
      sessionStorage.setItem('lla_order_quote_v1', JSON.stringify({
        stid: String(stid), orderid: String(orderid),
        firstPayment: Number(payload.FirstPayment),
        numberOfPayments: Number(payload.NumberOfPayments),
        leftToPay: Number(payload.LeftToPay), currency: 'USD', env: CFG.env,
        scheduleVersion: 2,
        paymentPerMonth: Number(payload.NumberOfPayments) > 0 ? Number(payload.LeftToPay) / Number(payload.NumberOfPayments) : 0,
        total: Number(payload.FirstPayment) + Number(payload.LeftToPay)
      }));
    } catch(e){}
  }
  window.LLA_ECOMM = {
    config: CFG,
    getAttribution: getAttribution,
    getExpectedOrderQuote: function(ids, details){
      try {
        var q = JSON.parse(sessionStorage.getItem('lla_order_quote_v1') || 'null');
        if (q && ids && q.stid === String(ids.stid) && q.orderid === String(ids.orderid) &&
            (!q.env || q.env === CFG.env) && q.currency === 'USD' &&
            ((Number(q.numberOfPayments) === 4 && Number(q.leftToPay) === Number(q.firstPayment) * 4 &&
              (Number(q.firstPayment) === 149 || Number(q.firstPayment) === 179)) ||
             (Number(q.numberOfPayments) === 4 && Number(q.leftToPay) === 676 &&
              (Number(q.firstPayment) === 79 || Number(q.firstPayment) === 169)) ||
             (Number(q.numberOfPayments) <= 1 && Number(q.firstPayment) === 799 && Number(q.leftToPay) === 0))) {
          q.paymentPerMonth = Number(q.numberOfPayments) ? Number(q.leftToPay) / Number(q.numberOfPayments) : 0;
          q.total = Number(q.firstPayment) + Number(q.leftToPay);
          return q;
        }
      } catch(e){}
      // Existing emailed orders must not depend on this browser having created
      // them. Recover only from the current CRM response for the exact order.
      // No URL price, promo storage or newly created order is used as authority.
      var d = details || {}, course = d.CoursePrice || {};
      if (!ids || String(d.OrderId) !== String(ids.orderid) ||
          String(d.StudentId) !== String(ids.stid) ||
          Number(d.MainAbroadCourseID ?? course.MainAbroadCourseID) !== Number(CFG.crmCourse.mainAbroadCourseId) ||
          Number(d.AbroadCourseID ?? course.AbroadCourseID) !== Number(CFG.crmCourse.abroadCourseId) ||
          d.AmountToCharge == null || d.OrderCoursePrice == null) return null;
      var first = Number(d.FirstPayment ?? d.AmountToCharge), n = Number(d.NumOfPayments);
      var left = Number(d.LeftToPay ?? (Number(d.OrderCoursePrice) - first));
      // These are the existing published contracts, not new coupon eligibility.
      // An unknown adjusted quote needs review rather than a silently invented
      // installment schedule. The gateway and CRM amount are checked separately.
      var promo = window.LLA_PROMO || {};
      var allowed = [
        { firstPayment: 79, numberOfPayments: 4, leftToPay: 676 },
        { firstPayment: 169, numberOfPayments: 4, leftToPay: 676 },
        { firstPayment: 179, numberOfPayments: 4, leftToPay: 716 },
        { firstPayment: 799, numberOfPayments: 0, leftToPay: 0 },
        { firstPayment: 799, numberOfPayments: 1, leftToPay: 0 },
        { firstPayment: 149, numberOfPayments: 4, leftToPay: 596 }
      ];
      var matches = allowed.some(function(p){
        return p && first === Number(p.firstPayment) && n === Number(p.numberOfPayments) && left === Number(p.leftToPay);
      });
      if (!matches || first !== Number(d.AmountToCharge)) return null;
      return { stid:String(ids.stid), orderid:String(ids.orderid), firstPayment:first,
        numberOfPayments:n, leftToPay:left, paymentPerMonth:n ? left/n : 0,
        total:first+left, env:CFG.env, scheduleVersion:2, currency:'USD', source:'crm-existing-order' };
    },
    stageLead: function(fields){
      try {
        // Check before payload construction updates the tracking identity.
        if (attemptInFlight()) return { ok: false, error: 'order_confirmation_pending' };
      } catch(e) { return { ok: false, error: 'storage_unavailable' }; }
      var built = buildLeadPayload(fields);
      if (built.error) return { ok: false, error: built.error, reason: built.reason };
      try {
        // Never replace the evidence needed to reconcile an uncertain request.
        if (attemptInFlight()) return { ok: false, error: 'order_confirmation_pending' };
        // A newly started enrollment uses its displayed price, not IDs cached
        // before this offer changed. Existing explicit checkout URLs stay intact.
        var explicit = new URLSearchParams(location.search);
        var oldQuote = null;
        try { oldQuote = JSON.parse(sessionStorage.getItem('lla_order_quote_v1') || 'null'); } catch(ignore) {}
        var priorIds = JSON.parse(sessionStorage.getItem('lla_ecomm_ids') || 'null');
        if ((priorIds && priorIds.buyerKey !== buyerKey(built.payload)) ||
            (!explicit.get('orderid') && oldQuote &&
            (Number(oldQuote.firstPayment)!==Number(built.payload.FirstPayment) ||
             Number(oldQuote.numberOfPayments)!==Number(built.payload.NumberOfPayments) ||
             Number(oldQuote.leftToPay)!==Number(built.payload.LeftToPay)))) {
          sessionStorage.removeItem('lla_ecomm_ids');
          sessionStorage.removeItem('lla_order_quote_v1');
          sessionStorage.removeItem('lla_selected_class_v1');
        }
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ payload: built.payload, env: CFG.env, ts: Date.now() }));
        _creating = null;
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
      try {
        if (attemptInFlight()) return Promise.reject(new Error('ORDER_CONFIRMATION_PENDING'));
        // Persist before sending: a refresh or lost response must not replay it.
        sessionStorage.setItem(CREATE_ATTEMPT_KEY, JSON.stringify({ env: CFG.env, buyerKey: buyerKey(pending.payload), ts: Date.now() }));
      } catch(e) { return Promise.reject(new Error('ORDER_STORAGE_UNAVAILABLE')); }
      /* PLAN FIX (2026-09-17). The payload is snapshotted on screen 1, BEFORE the
       * buyer picks Monthly/Upfront on screen 2, so it carried the default monthly
       * price (FirstPayment 179 x 5) even when the buyer chose "$799 one payment"
       * (verified live: order 8026893, AmountToCharge 179, NumOfPayments 5).
       * Re-resolve the plan here, on the payment screen where ?plan= is final, so
       * the CRM order and the Airwallex intent match what the buyer selected. */
      try {
        var _pr = activePrice(); var _pl = pending.payload;
        _pl.FirstPayment     = Number(_pr.firstPayment);
        _pl.NumberOfPayments = _pr.plan === 'upfront' ? 1 : Math.max(0, Number(_pr.numberOfPayments) - 1);
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
          var out = { stid: String(stid), orderid: String(orderid), env: CFG.env };
          try{sessionStorage.setItem('lla_selected_class_v1',JSON.stringify({orderid:String(orderid),env:CFG.env,courseId:pending.payload.PreferredCourseId,semesterId:pending.payload.SemesterID}))}catch(e){}
          rememberOrderQuote(stid, orderid, pending.payload);
          try {
            sessionStorage.setItem('lla_ecomm_ids', JSON.stringify({ stid: out.stid, orderid: out.orderid, env: CFG.env, buyerKey: buyerKey(pending.payload), ts: Date.now() }));
            sessionStorage.removeItem(PENDING_KEY);
            sessionStorage.removeItem(CREATE_ATTEMPT_KEY);
          } catch(e){}
          return out;
        }
        var err = new Error('LEAD_CREATE_FAILED');
        err.status = (r && r.status) || 0;
        err.retryable = !!(r && r.retryable);
        throw err;
      }).catch(function(e){
        _creating = null;
        // The request finished (response received or network error): nothing is in flight, so unlock retry.
        try { sessionStorage.removeItem(CREATE_ATTEMPT_KEY); } catch(ignore) {}
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
            rememberOrderQuote(stid, orderid, built.payload);
            try { sessionStorage.setItem('lla_ecomm_ids', JSON.stringify({ stid: String(stid), orderid: String(orderid), env: CFG.env, ts: Date.now() })); } catch(e){}
          }
          return r;
        });
      }
      // 'lead' mode: proven website path — CRM connected via /Students/AddNewLead.
      return postWithRetry(base + '/leads/' + CFG.env, built.payload);
    },
    getCheckoutIds: function(){
      return readIds();
    },
    fetchCheckoutDetails: function(ids){
      if (!ids || CFG.mode !== 'ecomm' || (ids.env || 'production') !== CFG.env) return Promise.resolve(null);
      var base = CFG.workerBase.replace(/\/$/, '');
      var prefix = CFG.env === 'staging' ? '/staging' : '';
      return postWithRetry(base + prefix + '/api/checkout/details', { studentId: String(ids.stid), orderId: String(ids.orderid) })
        .then(function(r){ return r.ok ? r.body : null; });
    },
    classForStart: function(startText){ return selectedBlueprintClass(startText); },
    reportPayment: function(report){
      // NEVER include raw card data (Pan/CardNumber/Cvv/Cvc/SecurityCode) — worker rejects it.
      if (CFG.mode !== 'ecomm') return Promise.resolve({ ok: false, error: 'ecomm_mode_off' });
      var base = CFG.workerBase.replace(/\/$/, '');
      var prefix = CFG.env === 'staging' ? '/staging' : '';
      // 2026-09-24 VP Operations: SetECommercePayment carries PreferredCourseId (spec optional field) so the
      // paid student is assigned to the class/semester; admin-form names sent alongside.
      try {
        if (report && report.PreferredCourseId == null) {
          var sd = ''; try { sd = sessionStorage.getItem('lla_start_date') || ''; } catch(e) {}
          if (!sd) sd = ((document.getElementById('emDate') || {}).value) || '';
          var cls = window.LLA_ECOMM.classForStart(sd);
          if(!cls){try{var saved=JSON.parse(sessionStorage.getItem('lla_selected_class_v1')||'null');if(saved&&String(saved.orderid)===String(report.OrderId)&&saved.env===CFG.env&&saved.courseId)cls=saved}catch(e){}}
          if(!cls)throw new Error('CLASS_SELECTION_REQUIRED');
          report.PreferredCourseId = String(cls.courseId);
          report.PrefferdCourseID = String(cls.courseId);
          report.ActivitySessionLevel1ID = String(cls.semesterId);
          report.SemesterID = String(cls.semesterId);
        }
      } catch(e) {}
      return postWithRetry(base + prefix + '/api/checkout/payments/crm', report);
    }
  };
})();
