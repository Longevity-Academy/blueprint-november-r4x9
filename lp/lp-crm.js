/* LP CRM wiring — eTeacher endpoint, ProductID 26 (Longevity).
   CampaignID is now DYNAMIC: it is read from the ?cid= parameter on the landing
   URL sent by the email platform, so every future send is classified by its own
   campaign with no code change. Fallback (no/invalid cid present) = 117648.
   The CampaignID is the ONLY source classifier eTeacher CRM honors.
   Updated 2026-08-11 per Sandra (eTeacher Email Marketing). */
(function () {
  // Fallback used only when the URL carries no valid cid (e.g. direct visit).
  var LGV_CAMPAIGN_ID_FALLBACK = 117648;   // LGV_EN_EML Special Founders Gift v2 — 2026-07-29

  /* Reads the campaign id from the URL. Deliberately tolerant, because the
     email platform sometimes emits a second "?" instead of "&"
     (e.g. ...?k=lgv-aug26?cid=117648&adGroupId=-1...). A plain
     URLSearchParams('cid') read returns null on that shape, which is exactly
     why the page appeared to be hardcoded. This scans the whole URL. */
  function readCampaignId() {
    try {
      var url = String(window.location.href);
      var m = url.match(/[?&#]cid=(\d{4,10})/i);          // normal, well-formed
      if (!m) m = url.match(/[?&#][^?&#=]*cid=(\d{4,10})/i); // ?k=x?cid=... shape
      if (!m) m = url.match(/(?:^|[?&#/])cid[=:](\d{4,10})/i);
      if (m && m[1]) {
        var n = parseInt(m[1], 10);
        if (n > 0) return n;
      }
    } catch (e) {}
    return LGV_CAMPAIGN_ID_FALLBACK;
  }

  var LGV_CAMPAIGN_ID = readCampaignId();

  function boot() {
    if (!window.eTeacherLeads || !window.LLA_US) {
      return setTimeout(boot, 200);
    }

    var LP_ID = (window.LLA_LP_ATTRIBUTION && window.LLA_LP_ATTRIBUTION.lp_id) || 'lp';
    var ADMIN_PREFIX = 'LGV EMAIL LP · ' + LP_ID.toUpperCase() + ' · Founders Voucher Aug26 · CID ' + LGV_CAMPAIGN_ID;

    // Wipe any stale UTM email-marketing values from prior LP versions so
    // DynamicParameters no longer carries them into the CRM.
    try {
      var stored = JSON.parse(localStorage.getItem('lla_attribution_v1') || '{}');
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){ delete stored[k]; });
      stored.last_touch_at = Date.now();
      localStorage.setItem('lla_attribution_v1', JSON.stringify(stored));
    } catch (e) {}

    var form = document.getElementById('lp-lead-form');
    if (!form) return;
    var errBox = form.querySelector('.form-error');
    var thanks = document.getElementById('lp-thankyou');
    var submitBtn = form.querySelector('button[type="submit"]');

    function showErr(msg) {
      if (!errBox) { alert(msg); return; }
      errBox.textContent = msg;
      errBox.classList.add('visible');
    }
    function clearErr() {
      if (errBox) { errBox.classList.remove('visible'); errBox.textContent = ''; }
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErr();

      var stateVal = (form.querySelector('[name="country"]') || {}).value || '';
      var fields = {
        firstName: (form.querySelector('[name="firstName"]') || {}).value || '',
        lastName:  (form.querySelector('[name="lastName"]')  || {}).value || '',
        email:     (form.querySelector('[name="email"]')     || {}).value || '',
        phone:     (form.querySelector('[name="phone"]')     || {}).value || '',
        countryIso: stateVal,
        adminNotes: ADMIN_PREFIX,
        campaignId: LGV_CAMPAIGN_ID,      // <-- classifies as Longevity Email Marketing
        googleCampaignId: '116641'         // <-- matches homepage payload — required for CRM to populate state
      };
      fields.firstName = fields.firstName.trim();
      fields.lastName  = fields.lastName.trim();
      fields.email     = fields.email.trim();
      fields.phone     = fields.phone.trim();
      fields.countryIso = fields.countryIso.trim().toUpperCase();
      var _iso = 'US';
      try { if (window.LLA_COUNTRY && window.LLA_COUNTRY.selected) _iso = String(window.LLA_COUNTRY.selected() || 'US').toUpperCase(); } catch (e) {}
      if (_iso !== 'US') fields.countryIso = _iso;

      if (!fields.firstName) { showErr('Please enter your first name.'); return; }
      if (!fields.lastName)  { showErr('Please enter your last name.'); return; }
      if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { showErr('Please enter a valid email address.'); return; }
      if (!fields.phone) { showErr('Please enter your mobile number.'); return; }
      var _p = (_iso === 'US')
        ? ((window.LLA_US && window.LLA_US.validatePhone) ? window.LLA_US.validatePhone(fields.phone) : { ok: true })
        : ((window.LLA_COUNTRY && window.LLA_COUNTRY.toE164) ? window.LLA_COUNTRY.toE164(fields.phone, _iso) : { ok: true });
      if (!_p.ok) { showErr(_iso === 'US' ? 'Please enter a valid US mobile number, or pick your country from the list.' : 'Please enter a valid mobile number for the selected country.'); return; }
      if (!fields.countryIso) {
        showErr('Please select your state from the dropdown.');
        var sel = form.querySelector('[name="country"]');
        if (sel) { sel.focus(); sel.style.borderColor = '#ff6b6b'; }
        return;
      }

      form.classList.add('is-submitting');
      if (submitBtn) submitBtn.disabled = true;

      window.eTeacherLeads.submit(fields).then(function (res) {
        form.classList.remove('is-submitting');
        if (submitBtn) submitBtn.disabled = false;
        if (res && res.ok) {
          if (thanks) thanks.style.display = 'block';
          form.style.display = 'none';
          try {
            if (window.dataLayer) window.dataLayer.push({
              event: 'lp_lead_submit',
              lp_id: LP_ID,
              campaign_id: LGV_CAMPAIGN_ID,
              campaign_id_source: (String(window.location.href).toLowerCase().indexOf('cid=') > -1) ? 'url' : 'fallback',
              product_id: 26,
              crm_status: 'ok'
            });
          } catch (e) {}
        } else {
          var msg = 'We could not submit your application. Please try again in a moment.';
          if (res && res.error === 'non_us_phone') msg = 'Please enter a valid mobile number for the selected country.';
          else if (res && res.error === 'invalid_state') msg = 'Please select your state from the dropdown.';
          else if (res && res.error === 'invalid_phone') msg = 'Please enter a valid mobile number for the selected country.';
          else if (res && res.error === 'Missing or invalid fields') msg = 'Please check all fields are filled correctly.';
          showErr(msg);
        }
      }).catch(function () {
        form.classList.remove('is-submitting');
        if (submitBtn) submitBtn.disabled = false;
        showErr('Network error. Please try again.');
      });
    });
  }
  // QA hook so Sandra/eTeacher can verify the resolved value in console:
  // type  LLA_CAMPAIGN_ID  ->  should print the cid from the URL.
  try { window.LLA_CAMPAIGN_ID = LGV_CAMPAIGN_ID; } catch (e) {}

  boot();
})();
