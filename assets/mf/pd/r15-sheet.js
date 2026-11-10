/* r15-sheet.js: force monthly plan + hide payment-plan label (2026-09-21). Does not touch CRM/Meta/Airwallex. */
(function () {
  'use strict';
  function forceMonthly() {
    try { sessionStorage.setItem('lla_plan', 'monthly'); } catch (e) {}
    try { localStorage.setItem('lla_plan', 'monthly'); } catch (e) {}
    try { if (typeof window.__llaPaintPlan === 'function') window.__llaPaintPlan(); } catch (e) {}
  }
  function hidePPLabel() {
    try {
      var pp = document.getElementById('pp');
      if (!pp) return;
      var prev = pp.previousElementSibling;
      if (prev && prev.tagName === 'LABEL') {
        prev.classList.add('r15-pp-lb');
        prev.style.setProperty('display', 'none', 'important');
      }
      pp.style.setProperty('display', 'none', 'important');
    } catch (e) {}
  }
  function init() {
    try {
      forceMonthly();
      hidePPLabel();
      var m = document.getElementById('enrollModal');
      if (!m || !window.MutationObserver) return;
      var was = m.classList.contains('open');
      new MutationObserver(function () {
        try {
          var is = m.classList.contains('open');
          if (is && !was) { forceMonthly(); hidePPLabel(); }
          was = is;
        } catch (e) {}
      }).observe(m, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  } catch (e) {}
})();

/* r15: tapping Julie's code box stores JULIE249 so the popup auto-applies it (the anchor already opens the popup) */
(function(){try{
  var J=document.getElementById('lpJulie'); if(!J) return;
  J.addEventListener('click',function(){
    try{ sessionStorage.setItem('lla_promo_code','JULIE249'); if(window.LLA_PROMO&&window.LLA_PROMO.activate) window.LLA_PROMO.activate(); }catch(e){}
    setTimeout(function(){ try{ var inp=document.getElementById('emPromo'), ap=document.getElementById('emApply'); if(inp&&ap&&ap.textContent!=='Applied'){ inp.value='JULIE249'; ap.click(); } }catch(e){} },700);
  });
}catch(e){}})();
