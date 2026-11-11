/* State selector for the November campaign copy only.
 * Retains the existing area-code fallback; an explicit choice takes priority.
 * No order creation, campaign attribution or payment behavior is changed. */
(function () {
  'use strict';
  var states = 'AL|Alabama;AK|Alaska;AZ|Arizona;AR|Arkansas;CA|California;CO|Colorado;CT|Connecticut;DE|Delaware;DC|District of Columbia;FL|Florida;GA|Georgia;HI|Hawaii;ID|Idaho;IL|Illinois;IN|Indiana;IA|Iowa;KS|Kansas;KY|Kentucky;LA|Louisiana;ME|Maine;MD|Maryland;MA|Massachusetts;MI|Michigan;MN|Minnesota;MS|Mississippi;MO|Missouri;MT|Montana;NE|Nebraska;NV|Nevada;NH|New Hampshire;NJ|New Jersey;NM|New Mexico;NY|New York;NC|North Carolina;ND|North Dakota;OH|Ohio;OK|Oklahoma;OR|Oregon;PA|Pennsylvania;RI|Rhode Island;SC|South Carolina;SD|South Dakota;TN|Tennessee;TX|Texas;UT|Utah;VT|Vermont;VA|Virginia;WA|Washington;WV|West Virginia;WI|Wisconsin;WY|Wyoming';
  function boot() {
    var field = document.getElementById('emStateField');
    var state = document.getElementById('emState');
    var country = document.getElementById('emCountry');
    var phone = document.getElementById('emPhone');
    if (!field || !state || !country || !phone || state.dataset.campaignStateReady) return;
    state.dataset.campaignStateReady = '1';
    states.split(';').forEach(function (row) {
      var pair = row.split('|'), option = document.createElement('option');
      option.value = pair[0]; option.textContent = pair[1]; state.appendChild(option);
    });
    function sync() {
      var us = country.value === 'US';
      field.hidden = !us;
      field.style.display = us ? '' : 'none';
      state.disabled = !us;
      if (!us) state.value = '';
    }
    country.addEventListener('change', sync);
    phone.addEventListener('blur', function () {
      if (country.value !== 'US' || state.value || !window.LLA_US) return;
      var p = window.LLA_US.validatePhone(phone.value);
      if (!p || !p.ok || !window.LLA_US.stateForAreaCode) return;
      var suggested = window.LLA_US.stateForAreaCode(p.e164.slice(2, 5));
      if (Array.prototype.some.call(state.options, function (o) { return o.value === suggested; })) state.value = suggested;
    });
    try {
      var saved = JSON.parse(sessionStorage.getItem('lla_checkout_contact_v1') || 'null');
      if (saved && saved.countryIso === 'US' && saved.stateIso) state.value = saved.stateIso;
    } catch (e) {}
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
