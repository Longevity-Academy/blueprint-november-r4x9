(function(){
 'use strict';
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
 let pending=false;
 function text(s,v){all(s).forEach(e=>{if(e.textContent!==v)e.textContent=v})}
 function html(s,v){all(s).forEach(e=>{if(e.innerHTML!==v)e.innerHTML=v})}
 function render(){
  pending=false;const P=window.LLA_PROMO;if(!P)return;
  const active=P.active,first=active?79:169,total=active?755:845;
  const upfront=window.LLA_ECOMM_PLANS?.resolvePlan()==='upfront';
  const checkout=!!document.getElementById('sumRow1V');
  if(!checkout){
   text('#offer .lp-plan','Regular plan: $169 × 5');
   all('#offer .lp-plan').forEach(e=>e.classList.add('credit-plan-label'));
   const price=$('#offer .lp-big');
   if(price){price.className='lp-big credit-month-one';price.setAttribute('data-no-promo','');price.setAttribute('data-credit-price','');}
   html('#offer .credit-month-one','<s aria-label="Regular first payment">$169</s><strong>$79</strong><span>Month 1</span>');
   const totalEl=$('#offer .lp-total');
   if(totalEl){
    totalEl.classList.add('credit-total');totalEl.setAttribute('data-no-promo','');
    if(!$('#offer .credit-rest'))totalEl.insertAdjacentHTML('beforebegin','<div class="credit-rest" data-no-promo><span>Months 2–5</span><b>$169 <span style="font-size:16px;font-weight:400">/ month</span></b></div>');
    html('#offer .lp-total','<b>$755 total</b><small>$90 masterclass credit applied to month 1.</small>');
    if(!$('#offer .masterclass-credit-strip'))totalEl.insertAdjacentHTML('afterend','<div class="masterclass-credit-strip" data-no-promo><strong>Masterclass credit</strong><div class="credit-codes"><button type="button" data-credit-code="JULIE249">JULIE249</button><button type="button" data-credit-code="MASTERCLASS-VIP">MASTERCLASS-VIP</button></div></div>');
   }
   text('#codeApply','Apply code & enroll');
   text('#offer .lp-julie-t b','Masterclass credit');
   text('#offer .lp-julie-t > span','$90 off month 1: $79 today, then 4 × $169. $755 total.');
   text('#pp [data-pl="upfront"] .pp-sub','Total $799 USD, one payment');
   html('#offer .lp-lead','18 live classes, your learning platform, Julie’s masterclass and an Abbott Lingo sensor.');
   all('#faq .faq-item').forEach(e=>{if(/How much does it cost/i.test(e.querySelector('.faq-q')?.textContent||'')){const a=e.querySelector('.faq-a-inner');const t='Regular plan: five payments of $169, $845 total. Apply JULIE249 or MASTERCLASS-VIP for a $90 masterclass credit: $79 in month 1, then four monthly payments of $169. Total: $755.';if(a&&a.textContent!==t)a.textContent=t}});
   html('.att-price','<span class="att-big">$79</span><span class="att-unit">Month 1<br><s>$169</s></span>');
   html('.att-line','Then 4 monthly payments of $169. <b>$755 total.</b> Masterclass credit applied to month 1.');
   text('#enroll-mini .fn-pc-was','Masterclass credit');
   html('#enroll-mini .lla-mini-price','<b><sup>$</sup>79</b><span>Month 1<br>then 4 × $169 · $755 total</span>');
   text('#fnExit p b','Regular tuition: $169 per month');
   const strip=$('#mockStrip');
   if(strip){const markup='<span class="t lg">Masterclass credit</span><span class="t sm"><a href="#offer" data-credit-code="JULIE249">JULIE249</a><span>or</span><a href="#offer" data-credit-code="MASTERCLASS-VIP">MASTERCLASS-VIP</a></span><a class="code" href="#offer" data-credit-code="JULIE249">JULIE249</a><a class="code" href="#offer" data-credit-code="MASTERCLASS-VIP">MASTERCLASS-VIP</a>';if(strip.innerHTML!==markup)strip.innerHTML=markup;}
   text('#mockBar .l b','$79 month 1');
   const band=$('#emStep2 .em-band .b-v');
   if(band){band.setAttribute('data-no-promo','');html('#emStep2 .em-band .b-v',upfront?'<s style="opacity:.5;font-weight:500;margin-right:6px">$1,395.00</s>$799.00 <small>one payment</small>':(active?'<s data-no-promo style="opacity:.5;font-weight:500;margin-right:6px">$169.00</s>$79.00 today <small>then 4 × $169 monthly · $755 total</small>':'$169.00 <small>monthly · 5 payments · $845 total</small>'));}
   html('#pp [data-pl="monthly"] .pp-price','$'+first+' <small>today</small>');
   html('#pp [data-pl="monthly"] .pp-sub','Then 4 × $169 monthly · $'+total+' total');
   const sum=$('#emSum');
   if(sum){
    sum.classList.add('applied');sum.classList.remove('credit-summary');sum.setAttribute('data-no-promo','');
    const content=upfront?'<p class="h">Promo applied</p><div class="hero"><span class="big">$799</span><span class="per">one payment</span></div><div class="row"><span>Julie’s VIP Masterclass<small>Included with your enrollment</small></span><b>Free</b></div><div class="row pay"><span>You pay</span><b>$799 today, nothing more</b></div>':(active?'<p class="h">Promo applied</p><div class="hero"><span class="big">$79</span><span class="per">month 1</span><s>$169</s></div><div class="row"><span>$90 masterclass credit<small>$79 in month 1 instead of $169, then 4 × $169</small></span><b>$90</b></div><div class="row"><span>Julie’s VIP Masterclass<small>Included with your enrollment</small></span><b>Free</b></div><div class="row total"><span>You save</span><b>$90</b></div><div class="row pay"><span>You pay</span><b>$79 today, then 4 × $169</b></div>':'<p class="h">Regular plan</p><div class="hero"><span class="big">$169</span><span class="per">a month</span></div><div class="row pay"><span>You pay</span><b>5 payments of $169, $845 total</b></div>');
    if(sum.innerHTML!==content)sum.innerHTML=content;
   }
   const msg=$('#emPromoMsg');
   if(msg&&msg.classList.contains('ok'))text('#emPromoMsg',upfront?'Code applied. $799 one payment.':'Masterclass credit applied.');
   text('.att-big-offer','$79');
  }
  // Pricing card is indicative. On checkout, only its verified CRM quote controls amounts.
 }
 function schedule(){if(!pending){pending=true;setTimeout(render,20)}}
 const root=$('#enrollModal')||document.body;
 if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true,characterData:true});
 window.addEventListener('click',e=>{
  const code=e.target.closest('[data-credit-code]');if(!code)return;
  e.preventDefault();e.stopImmediatePropagation();
  const v=code.dataset.creditCode,field=$('#codeInput')||$('#attCodeInput');
  if(field){field.value=v;field.dispatchEvent(new Event('input',{bubbles:true}));}
  const modal=$('#enrollModal');
  if(modal?.classList.contains('open')){const input=$('#emPromo');if(input){input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));$('#emApply')?.click();}}
  else{window.LLA_PROMO?.activate(v);field?.focus({preventScroll:true});$('#offer')?.scrollIntoView({behavior:'smooth',block:'start'});}
  schedule();
 },true);
 window.addEventListener('lla:pricing',schedule);
 document.addEventListener('click',schedule);
 document.addEventListener('DOMContentLoaded',schedule);window.addEventListener('load',schedule);
 render();setTimeout(render,1200);setTimeout(render,2800);
})();
