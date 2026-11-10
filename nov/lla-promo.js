/* Approved 2026-10-27: $79 month 1, then four $169 payments.
 * New regular monthly plan: five $169 payments. Credit: $90.
 * CRM NumberOfPayments is normalized to four remaining payments by ecomm.js. */
(function(){
 'use strict';
 const CODES=['JULIE249','MASTERCLASS-VIP'],KEY='lla_promo_code';
 const DEADLINE='2026-12-31T23:59:59-05:00';
 const q=new URLSearchParams(location.search);
 function normalize(v){return String(v||'').trim().toUpperCase();}

 function valid(v){return Date.now()<=Date.parse(DEADLINE)&&CODES.includes(normalize(v));}
 function stored(){try{const s=sessionStorage.getItem(KEY);if(s)return s;const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&Date.now()-Number(v.ts)<48*60*60*1000?v.code:''}catch{return ''}}
 function remember(v){try{sessionStorage.setItem(KEY,v);localStorage.setItem(KEY,JSON.stringify({code:v,ts:Date.now()}))}catch{}}
 const initial=valid(q.get('code'))?normalize(q.get('code')):valid(stored())?normalize(stored()):'JULIE249';
 const P=window.LLA_PROMO={
  code:initial,vipCode:CODES[1],codes:CODES.slice(),active:q.get('promo')!=='off'&&(valid(q.get('code'))||valid(stored())||q.get('promo')==='on'),
  deadline:DEADLINE,first:79,n:5,left:676,total:755,regular:169,regularTotal:845,list:845,monthly:169,credit:90,
  isValid:valid,remaining(){let d=Math.max(0,Date.parse(DEADLINE)-Date.now());return{d:Math.floor(d/864e5),h:Math.floor(d%864e5/36e5),m:Math.floor(d%36e5/6e4)}},
  activate(v){
   if(v!==undefined&&!valid(v))return false;
   if(valid(v))P.code=normalize(v);else if(valid(stored()))P.code=normalize(stored());
   P.active=true;remember(P.code);configure();notify();return true;
  },
  deactivate(){P.active=false;try{sessionStorage.removeItem(KEY);localStorage.removeItem(KEY)}catch{}configure();notify();return true;},
  configure
 };
 function configure(){
  const c=window.LLA_ECOMM_CONFIG=window.LLA_ECOMM_CONFIG||{};
  c.crmPrice={firstPayment:P.active?79:169,numberOfPayments:5,leftToPay:676};
  c.crmPlans={monthly:{...c.crmPrice},upfront:{firstPayment:799,numberOfPayments:1,leftToPay:0}};
 }
 function notify(){
  document.documentElement.classList.toggle('lla-promo-on',P.active);
  window.dispatchEvent(new Event('lla:pricing'));
 }
 configure();if(P.active)remember(P.code);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',notify);else notify();
})();
