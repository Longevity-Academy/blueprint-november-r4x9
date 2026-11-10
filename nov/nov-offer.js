/* November 2026 offer wiring for longevitylifeacademy.com.
   Depends on nov/lla-promo.js (window.LLA_PROMO) and the page's own #enrollModal.
   Does not touch tracking, the Worker, or the checkout. */
(function(){
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s)}, all=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var P=window.LLA_PROMO;
  /* November default, same as pages.dev: the masterclass credit is on unless ?promo=off. */
  if(P&&!P.active&&new URLSearchParams(location.search).get('promo')!=='off'){P.activate('JULIE249');}

  /* Strip sits under the fixed header: measure it. */
  function placeStrip(){
    var strip=$('#novStrip'); if(!strip) return;
    var hdr=$('header')||$('.site-header')||$('nav');
    var h=hdr?Math.round(hdr.getBoundingClientRect().bottom):72;
    if(h<0||h>160) h=72;
    document.documentElement.style.setProperty('--nov-nav',h+'px');
    document.documentElement.classList.add('has-nov-strip');
  }
  placeStrip(); window.addEventListener('resize',placeStrip); window.addEventListener('load',placeStrip);

  /* Open the existing enroll modal (its own script listens for [data-checkout-open]). */
  function openModal(code){
    if(code&&P&&P.isValid(code)){P.activate(code);}
    var trigger=$('[data-checkout-open]');
    var tmp=null;
    if(!trigger){tmp=document.createElement('a');tmp.href='#';tmp.setAttribute('data-checkout-open','');tmp.style.display='none';document.body.appendChild(tmp);trigger=tmp;}
    trigger.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    if(tmp) tmp.remove();
    syncModal();
  }
  window.LLA_NOV_OPEN=openModal;

  /* Keep card, chips, coupon box, modal and float bar in sync with LLA_PROMO. */
  function syncModal(){
    var code=(P&&P.active)?P.code:'';
    var promo=$('#emPromo'); if(promo&&code&&!promo.value) promo.value=code;
    var apply=$('#emApply'); if(apply) apply.textContent=(P&&P.active)?'Applied':'Apply';
    var tuition=$('#novTuition');
    if(tuition){
      tuition.innerHTML=(P&&P.active)
        ? '$79 for month 1, then $169 a month for 4 months. $755 total. <small>Masterclass credit '+code+' applied.</small>'
        : '$169 a month for 5 months. $845 total. <small>Have a masterclass code? Enter it below for $79 on month 1.</small>';
    }
  }
  function syncPage(){
    var on=!!(P&&P.active), code=on?P.code:'';
    all('.nov-chip').forEach(function(c){c.classList.toggle('is-on',on&&c.getAttribute('data-nov-code')===code)});
    var inp=$('#novCoupon'); if(inp&&!inp.value&&code) inp.value=code;
    var big=$('#novPrice');
    if(big){big.innerHTML=on?'<s aria-label="Regular first payment">$169</s><strong>$79</strong><span>Month 1</span>':'<strong>$169</strong><span>Month 1</span>';}
    var tot=$('#novTotal');
    if(tot){tot.innerHTML=on?'<b>$755 total</b>$90 masterclass credit applied to month 1.':'<b>$845 total</b>Enter JULIE249 or MASTERCLASS-VIP for $79 on month 1.';}
    var pill=$('#llaFloatCta .lla-cta-pill');
    if(pill){pill.innerHTML='<span class="price">'+(on?'$79':'$169')+'</span><span class="mo">MONTH 1</span>';}
    var fc=$('#llaFloatCta'); if(fc){fc.setAttribute('aria-label','Enroll now in The Longevity Blueprint, '+(on?'$79':'$169')+' for month 1');}
    syncModal();
  }
  window.addEventListener('lla:pricing',syncPage);

  document.addEventListener('DOMContentLoaded',function(){
    /* Every Enroll / Apply CTA on the page opens the pop-up checkout. The lead-gen form itself is untouched. */
    all('a[href="#lead-gen"],a[href="/blueprint-november-r4x9/#lead-gen"],#llaFloatCta').forEach(function(a){
      if(a.closest('#lead-gen')&&!a.matches('.lg-buy')) return;
      var t=(a.textContent||'').replace(/\s+/g,' ').trim();
      if(a.id==='llaFloatCta'||/^(enroll now|apply now|apply|enroll)$/i.test(t)||/enroll now/i.test(t)){a.setAttribute('data-checkout-open','');a.setAttribute('href','#offer');}
    });
    all('.nov-chip,#novStrip .ns-code').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var c=b.getAttribute('data-nov-code');if(P)P.activate(c);var inp=$('#novCoupon');if(inp)inp.value=c;var pm=$('#emPromo');if(pm)pm.value=c;syncPage();if(b.closest('#novStrip')){var o=$('#offer');if(o)o.scrollIntoView({behavior:'smooth',block:'start'});}});});
    var strip=$('#novStrip'); if(strip){strip.addEventListener('click',function(){var o=$('#offer');if(o)o.scrollIntoView({behavior:'smooth',block:'start'});});}
    var apply=$('#novApply');
    if(apply){apply.addEventListener('click',function(){var inp=$('#novCoupon');var v=inp?inp.value.trim().toUpperCase():'';if(v&&P&&P.isValid(v)){P.activate(v);}else if(v&&P){P.deactivate();}var pm=$('#emPromo');if(pm)pm.value=v;syncPage();openModal(P&&P.isValid(v)?v:'');});}
    var inp=$('#novCoupon'); if(inp){inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();apply&&apply.click();}});}
    all('[data-nov-open]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();openModal(P&&P.active?P.code:'');});});
    var emApply=$('#emApply');
    if(emApply){emApply.addEventListener('click',function(){var pm=$('#emPromo');var v=pm?pm.value.trim().toUpperCase():'';if(P){if(v&&P.isValid(v))P.activate(v);else if(!v||!P.isValid(v))P.deactivate();}syncPage();},true);}
    syncPage();
  });
})();
