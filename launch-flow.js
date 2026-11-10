(function(){
 'use strict';
 const appBase=new URL('.',document.currentScript.src);
 function enrollmentURL(){
  const u=new URL('blueprint/',appBase);
  u.search=location.search;u.hash='';
  const code=document.getElementById('codeInput')?.value||window.LLA_PROMO?.code||u.searchParams.get('code')||'JULIE249';
  if(['JULIE249','MASTERCLASS-VIP'].includes(code.trim().toUpperCase()))u.searchParams.set('code',code.trim().toUpperCase());
  u.searchParams.set('plan','monthly');u.searchParams.set('enroll','1');return u.href;
 }
 function apply(){
  const hero=document.getElementById('hero'),pillars=document.getElementById('learn-com'),syllabus=document.getElementById('syllabus'),offer=document.getElementById('offer');
  const vip=document.getElementById('vip');
  const headline=document.querySelector('#hero h1'),sub=document.querySelector('#hero .pdp-cine-sub');
  if(headline)headline.innerHTML='Build your personal longevity protocol in <span class="pdp-cine-blue">18 live classes.</span>';
  if(sub)sub.textContent='18 live small-group classes with Julie and the LLA faculty. Abbott Lingo CGM shipped free. You leave with a written protocol built on your own numbers.';
  if(hero&&pillars&&syllabus&&offer){
   if(hero.nextElementSibling!==pillars)hero.insertAdjacentElement('afterend',pillars);
   if(pillars.nextElementSibling!==syllabus)pillars.insertAdjacentElement('afterend',syllabus);
   if(syllabus.nextElementSibling!==offer)syllabus.insertAdjacentElement('afterend',offer);
   if(vip&&offer.nextElementSibling!==vip)offer.insertAdjacentElement('afterend',vip);
  }
  document.querySelectorAll('#hero .pdp-cine-cta,header .fn-nav-pill,#mockBar a,a').forEach(a=>{
   if(!a.matches('#hero .pdp-cine-cta,header .fn-nav-pill,#mockBar a')&&!/^enroll\s*now$/i.test(a.textContent.trim()))return;
   a.href='#enrollModal';a.dataset.enrollCourse='1';if(a.textContent!=='Enroll now')a.textContent='Enroll now';
  });
  const bar=document.getElementById('mockBar');
  if(bar){bar.classList.add('on');const title=bar.querySelector('.l i');if(title)title.textContent='The Longevity Blueprint';const label=bar.querySelector('.l b');if(label)label.textContent='$79 month 1';}
  if(hero&&!document.getElementById('heroCouponNote')){
   const cta=hero.querySelector('.pdp-cine-cta');
   if(cta)cta.insertAdjacentHTML('afterend','<p id="heroCouponNote">Masterclass credit · <b>JULIE249</b> / <b>MASTERCLASS-VIP</b></p>');
  }
 }
 window.addEventListener('click',e=>{
  const trigger=e.target.closest('[data-enroll-course],#codeApply,#attCodeApply,a,button');
  if(!trigger)return;
  const coupon=trigger.matches('#codeApply,#attCodeApply');
  if(!coupon&&!trigger.dataset.enrollCourse&&!/^enroll\s*now$/i.test(trigger.textContent.trim()))return;
  const input=document.getElementById('codeInput')||document.getElementById('attCodeInput');
  const code=(input?.value||window.LLA_PROMO?.code||'JULIE249').trim().toUpperCase();
  if(coupon&&!window.LLA_PROMO?.isValid(code))return;
  e.preventDefault();e.stopImmediatePropagation();
  const modal=document.getElementById('enrollModal');
  if(modal){
   if(window.LLA_PROMO?.isValid(code)){window.LLA_PROMO.activate(code);const promo=document.getElementById('emPromo');if(promo)promo.value=code;document.getElementById('emApply')?.click();}
   modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  }
  else location.assign(enrollmentURL());
 },true);
 apply();document.addEventListener('DOMContentLoaded',apply);window.addEventListener('load',apply);
 setTimeout(apply,1300);setTimeout(apply,3000);
})();
