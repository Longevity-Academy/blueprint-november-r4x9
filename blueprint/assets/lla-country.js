/* LLA country selector — adds Rest of World to every lead form.
 *
 * WHY THIS IS A WRAPPER AND NOT AN EDIT
 * Every form used to offer a single dropdown that was labelled Country in the
 * markup but actually carried a US STATE code, and the submit path hard-gated
 * on a US NANP phone. The CEO needs non-US leads accepted. Rewriting each of
 * the inlined copies of that submit path would put every existing US lead at
 * risk, so instead this file wraps the existing eTeacherLeads.submit:
 *
 *   country === 'US'  ->  the original function is called, untouched. The US
 *                         payload is byte-for-byte what the CRM receives today.
 *   country !== 'US'  ->  this file builds the payload from the DOCUMENTED
 *                         fields only and posts it itself.
 *
 * FIELD CHOICES, FROM THE OFFICIAL LEADS API DOC
 *   CountryIsoCode      required, 2-letter ISO 3166-1 alpha-2, "US, IL, GB, ..."
 *   MobilePhone         required, "valid phone number for the lead's country",
 *                       E.164 preferred
 *   CountryIsoCodeByIp  optional, 2-letter ISO
 *   State / StateProvinceRegion are NOT in the documented field list. The doc
 *   says any property not listed is reserved for internal use and must not be
 *   sent unless eTeacher instructs it. They are therefore sent ONLY on the
 *   untouched US path, exactly as before, and never on the non-US path. The
 *   US state also continues to travel in AdminNotes, as it does today.
 *
 * NO DUPLICATE RISK: one submit gesture still produces exactly one POST. This
 * file adds no retry, no second endpoint and no background call, and it holds
 * a submitting flag so a double click cannot produce two leads.
 */
(function () {
  'use strict';
  if (window.LLA_COUNTRY) return;

  /* ISO 3166-1 alpha-2, name, dial code. US first, then alphabetical. */
  var RAW =
  'US|United States|1;AF|Afghanistan|93;AL|Albania|355;DZ|Algeria|213;AD|Andorra|376;AO|Angola|244;AG|Antigua and Barbuda|1;AR|Argentina|54;AM|Armenia|374;AU|Australia|61;AT|Austria|43;AZ|Azerbaijan|994;BS|Bahamas|1;BH|Bahrain|973;BD|Bangladesh|880;BB|Barbados|1;BY|Belarus|375;BE|Belgium|32;BZ|Belize|501;BJ|Benin|229;BM|Bermuda|1;BT|Bhutan|975;BO|Bolivia|591;BA|Bosnia and Herzegovina|387;BW|Botswana|267;BR|Brazil|55;BN|Brunei|673;BG|Bulgaria|359;BF|Burkina Faso|226;BI|Burundi|257;KH|Cambodia|855;CM|Cameroon|237;CA|Canada|1;CV|Cape Verde|238;KY|Cayman Islands|1;CF|Central African Republic|236;TD|Chad|235;CL|Chile|56;CN|China|86;CO|Colombia|57;KM|Comoros|269;CG|Congo|242;CD|Congo (DRC)|243;CR|Costa Rica|506;CI|Cote d Ivoire|225;HR|Croatia|385;CU|Cuba|53;CY|Cyprus|357;CZ|Czechia|420;DK|Denmark|45;DJ|Djibouti|253;DM|Dominica|1;DO|Dominican Republic|1;EC|Ecuador|593;EG|Egypt|20;SV|El Salvador|503;GQ|Equatorial Guinea|240;ER|Eritrea|291;EE|Estonia|372;SZ|Eswatini|268;ET|Ethiopia|251;FJ|Fiji|679;FI|Finland|358;FR|France|33;GA|Gabon|241;GM|Gambia|220;GE|Georgia|995;DE|Germany|49;GH|Ghana|233;GI|Gibraltar|350;GR|Greece|30;GD|Grenada|1;GT|Guatemala|502;GN|Guinea|224;GW|Guinea-Bissau|245;GY|Guyana|592;HT|Haiti|509;HN|Honduras|504;HK|Hong Kong|852;HU|Hungary|36;IS|Iceland|354;IN|India|91;ID|Indonesia|62;IR|Iran|98;IQ|Iraq|964;IE|Ireland|353;IL|Israel|972;IT|Italy|39;JM|Jamaica|1;JP|Japan|81;JO|Jordan|962;KZ|Kazakhstan|7;KE|Kenya|254;KI|Kiribati|686;KW|Kuwait|965;KG|Kyrgyzstan|996;LA|Laos|856;LV|Latvia|371;LB|Lebanon|961;LS|Lesotho|266;LR|Liberia|231;LY|Libya|218;LI|Liechtenstein|423;LT|Lithuania|370;LU|Luxembourg|352;MO|Macau|853;MG|Madagascar|261;MW|Malawi|265;MY|Malaysia|60;MV|Maldives|960;ML|Mali|223;MT|Malta|356;MH|Marshall Islands|692;MR|Mauritania|222;MU|Mauritius|230;MX|Mexico|52;FM|Micronesia|691;MD|Moldova|373;MC|Monaco|377;MN|Mongolia|976;ME|Montenegro|382;MA|Morocco|212;MZ|Mozambique|258;MM|Myanmar|95;NA|Namibia|264;NR|Nauru|674;NP|Nepal|977;NL|Netherlands|31;NZ|New Zealand|64;NI|Nicaragua|505;NE|Niger|227;NG|Nigeria|234;MK|North Macedonia|389;NO|Norway|47;OM|Oman|968;PK|Pakistan|92;PW|Palau|680;PS|Palestine|970;PA|Panama|507;PG|Papua New Guinea|675;PY|Paraguay|595;PE|Peru|51;PH|Philippines|63;PL|Poland|48;PT|Portugal|351;PR|Puerto Rico|1;QA|Qatar|974;RO|Romania|40;RU|Russia|7;RW|Rwanda|250;KN|Saint Kitts and Nevis|1;LC|Saint Lucia|1;VC|Saint Vincent and the Grenadines|1;WS|Samoa|685;SM|San Marino|378;SA|Saudi Arabia|966;SN|Senegal|221;RS|Serbia|381;SC|Seychelles|248;SL|Sierra Leone|232;SG|Singapore|65;SK|Slovakia|421;SI|Slovenia|386;SB|Solomon Islands|677;SO|Somalia|252;ZA|South Africa|27;KR|South Korea|82;SS|South Sudan|211;ES|Spain|34;LK|Sri Lanka|94;SD|Sudan|249;SR|Suriname|597;SE|Sweden|46;CH|Switzerland|41;SY|Syria|963;TW|Taiwan|886;TJ|Tajikistan|992;TZ|Tanzania|255;TH|Thailand|66;TL|Timor-Leste|670;TG|Togo|228;TO|Tonga|676;TT|Trinidad and Tobago|1;TN|Tunisia|216;TR|Turkey|90;TM|Turkmenistan|993;TV|Tuvalu|688;UG|Uganda|256;UA|Ukraine|380;AE|United Arab Emirates|971;GB|United Kingdom|44;UY|Uruguay|598;UZ|Uzbekistan|998;VU|Vanuatu|678;VA|Vatican City|379;VE|Venezuela|58;VN|Vietnam|84;YE|Yemen|967;ZM|Zambia|260;ZW|Zimbabwe|263';

  var LIST = RAW.split(';').map(function (r) {
    var p = r.split('|');
    return { iso: p[0], name: p[1], dial: p[2] };
  });
  var BY_ISO = {};
  LIST.forEach(function (c) { BY_ISO[c.iso] = c; });

  /* E.164: leading +, country calling code, 4 to 14 more digits, 15 digits max
     overall. Deliberately permissive beyond that. National numbering plans for
     190 countries are not something this file can police, and rejecting a real
     customer is worse than passing the CRM a number it can review. */
  function toE164(raw, iso) {
    var c = BY_ISO[iso];
    if (!c) return { ok: false, reason: 'unknown_country' };
    var s = String(raw || '').trim();
    var kept = s.replace(/[^\d+]/g, '');
    var digits;
    if (kept.charAt(0) === '+') {
      digits = kept.slice(1).replace(/\D/g, '');
    } else {
      digits = kept.replace(/\D/g, '');
      /* Strip a single leading trunk zero, used across most of Europe,
         Africa and Asia, before prefixing the country code. */
      if (digits.charAt(0) === '0') digits = digits.replace(/^0+/, '');
      /* Every country in the +1 North American plan shares the same code and
         carries its area code inside the national number. Prefixing a country
         specific code such as 1876 to a number that already begins 876 would
         send the CRM the area code twice, so +1 is treated as a plain prefix
         and a number that already starts with it is left alone. */
      if (c.dial === '1') {
        if (digits.length === 10) digits = '1' + digits;
      } else if (digits.indexOf(c.dial) !== 0) {
        digits = c.dial + digits;
      }
    }
    if (!/^\d{7,15}$/.test(digits)) return { ok: false, reason: 'phone_length' };
    return { ok: true, e164: '+' + digits };
  }

  function buildCountrySelect(id) {
    var sel = document.createElement('select');
    sel.id = id;
    sel.name = 'lla_country';
    sel.required = true;
    var ph = document.createElement('option');
    ph.value = ''; ph.textContent = 'Select your country';
    ph.disabled = true; ph.selected = true;
    sel.appendChild(ph);
    LIST.forEach(function (c, i) {
      var o = document.createElement('option');
      o.value = c.iso;
      o.textContent = c.name;
      sel.appendChild(o);
      if (i === 0) {
        var sep = document.createElement('option');
        sep.value = ''; sep.disabled = true;
        sep.textContent = '\u2500\u2500\u2500 Rest of world \u2500\u2500\u2500';
        sel.appendChild(sep);
      }
    });
    return sel;
  }

  /* Attach to every form that has the legacy state dropdown. */
  function enhance(stateSel) {
    if (!stateSel || stateSel.getAttribute('data-lla-country-done')) return;
    stateSel.setAttribute('data-lla-country-done', '1');

    var stateField = stateSel.closest('.lead-gen-v2-field') || stateSel.parentNode;
    var cid = 'lla-country-' + Math.random().toString(36).slice(2, 8);
    var wrap = document.createElement(stateField.tagName.toLowerCase());
    wrap.className = stateField.className;
    var lab = document.createElement('label');
    lab.setAttribute('for', cid);
    lab.textContent = 'Country';
    var csel = buildCountrySelect(cid);
    wrap.appendChild(lab);
    wrap.appendChild(csel);
    stateField.parentNode.insertBefore(wrap, stateField);

    /* The state question only makes sense for the United States. */
    function sync() {
      var isUS = csel.value === 'US';
      stateField.style.display = isUS ? '' : 'none';
      stateSel.required = isUS;
      if (!isUS) stateSel.value = '';
    }
    csel.addEventListener('change', sync);
    csel.value = 'US';
    sync();

    stateSel.setAttribute('data-lla-state', '1');
    csel.setAttribute('data-lla-country', '1');
  }

  /* A page may declare its own empty country select (the ecommerce enrol
     modal does, because it has no state dropdown to attach to). Fill it from
     the same list rather than duplicating 200 countries in the markup. */
  function fillDeclared() {
    var pre = document.querySelectorAll('select[data-lla-country="1"]');
    Array.prototype.forEach.call(pre, function (sel) {
      if (sel.options.length > 1) return;
      var built = buildCountrySelect(sel.id || 'lla-country-pre');
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      Array.prototype.forEach.call(built.options, function (o) {
        sel.appendChild(o.cloneNode(true));
      });
      sel.value = 'US';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function scan() {
    fillDeclared();
    var sels = document.querySelectorAll(
      'select#lg-country, select[name="country"], select#bioCountry, select#emState, select[name="state"]'
    );
    Array.prototype.forEach.call(sels, enhance);
  }

  function selectedCountry() {
    var c = document.querySelector('select[data-lla-country="1"]');
    return c && c.value ? c.value : 'US';
  }
  function selectedState() {
    var s = document.querySelector('select[data-lla-state="1"]');
    return s && s.value ? String(s.value).toUpperCase() : '';
  }

  /* Wrap the existing submit. */
  var submitting = false;
  function install() {
    if (!window.eTeacherLeads || window.eTeacherLeads.__llaCountryWrapped) return false;
    var original = window.eTeacherLeads.submit;
    var endpoint = window.eTeacherLeads.endpoint;
    var getAttr = window.eTeacherLeads.getAttribution;

    window.eTeacherLeads.submit = function (fields) {
      var iso = selectedCountry();

      /* UNITED STATES: original path, untouched. */
      if (iso === 'US') {
        var st = selectedState();
        if (st) fields = Object.assign({}, fields, { countryIso: st });
        return original.call(window.eTeacherLeads, fields);
      }

      /* REST OF WORLD: documented fields only. */
      if (submitting) return Promise.resolve({ ok: false, status: 0, error: 'in_flight' });
      if (!fields || !fields.firstName || !fields.lastName || !fields.email || !fields.phone) {
        return Promise.resolve({ ok: false, status: 0, error: 'Missing or invalid fields' });
      }
      var ph = toE164(fields.phone, iso);
      if (!ph.ok) return Promise.resolve({ ok: false, status: 0, error: 'invalid_phone', reason: ph.reason });

      var payload = {
        ProductID: 26,
        FirstName: String(fields.firstName).trim(),
        LastName: String(fields.lastName).trim(),
        Email: String(fields.email).trim(),
        MobilePhone: ph.e164,
        CountryIsoCode: iso,
        LandingPage: window.location.href,
        UserAgent: navigator.userAgent,
        ReferringSite: document.referrer || window.location.hostname,
        QueryString: (window.location.search || '').replace(/^\?/, '')
      };
      /* No State, no StateProvinceRegion. Undocumented outside the US path. */
      var notes = 'Country: ' + (BY_ISO[iso] ? BY_ISO[iso].name : iso);
      if (fields.adminNotes) notes += ' | ' + String(fields.adminNotes);
      payload.AdminNotes = notes.slice(0, 4000);
      try {
        var dyn = getAttr ? getAttr() : null;
        if (dyn && typeof dyn === 'object') {
          var parts = [];
          Object.keys(dyn).forEach(function (k) {
            if (dyn[k]) parts.push(k + '=' + encodeURIComponent(dyn[k]));
          });
          if (parts.length) payload.DynamicParameters = parts.join('&').slice(0, 4000);
        }
      } catch (e) {}
      if (fields.campaignId && /^\d+$/.test(String(fields.campaignId))) {
        payload.CampaignID = parseInt(fields.campaignId, 10);
      }

      submitting = true;
      return fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        submitting = false;
        return { ok: r.ok, status: r.status };
      }).catch(function () {
        submitting = false;
        return { ok: false, status: 0, error: 'network' };
      });
    };
    window.eTeacherLeads.__llaCountryWrapped = true;
    return true;
  }

  function boot() {
    scan();
    if (!install()) {
      var n = 0;
      var t = setInterval(function () {
        if (install() || ++n > 100) clearInterval(t);
      }, 100);
    }
    var mo = new MutationObserver(scan);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  window.LLA_COUNTRY = {
    list: LIST,
    toE164: toE164,
    selected: selectedCountry,
    state: selectedState
  };
})();
