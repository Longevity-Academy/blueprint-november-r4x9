
(function(){
  if(!window.LLA_US){var phoneScript=document.createElement('script');phoneScript.src=new URL('blueprint/assets/nanp-state-autofill.js?v=guest-qa1',document.currentScript.src).href;document.head.append(phoneScript)}
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('video[aria-hidden="true"]').forEach(function(v){v.removeAttribute('autoplay');v.pause()})}
  /* Selected code accompanies the callback request and the confirmed enrollment route. */
  var CODES={'JULIE249':1,'MASTERCLASS-VIP':1};
  var inp=document.getElementById('codeInput')||document.getElementById('attCodeInput'),btn=document.getElementById('codeApply'),msg=document.getElementById('codeMsg');
  function say(t,e){msg.textContent=t;msg.className='codemsg'+(e?' err':'')}
  function go(){var code=(inp.value||'').trim().toUpperCase().replace(/\s+/g,'');
    if(!code){say('Type the code from the chat, or the one in your VIP email.',1);inp.focus();document.getElementById('offer').scrollIntoView({behavior:'smooth',block:'center'});return}
    if(!CODES[code]){say('That code is not valid. Use the code Courtney shared in the Zoom chat, or the one in your VIP email.',1);inp.classList.remove('ok');document.getElementById('offer').scrollIntoView({behavior:'smooth',block:'center'});return}
    if(Date.now()>Date.parse('2026-10-30T23:59:59-04:00')){say('The attendee offer window has ended. Please ask our team about the current course offer.',1);return}
    inp.classList.add('ok');say('Code '+code+' applied. Opening secure enrollment.');
    try{sessionStorage.setItem('lla_promo_code',code)}catch(e){}
    var enrollment=new URL('blueprint/',location.href);
    enrollment.search=location.search;enrollment.searchParams.set('code',code);enrollment.searchParams.set('plan','monthly');enrollment.searchParams.set('enroll','1');
    location.assign(enrollment.href);
  }
  if(btn&&inp){
  btn.addEventListener('click',go);inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();go()}});
  var more=document.querySelectorAll('.js-apply');for(var k=0;k<more.length;k++)more[k].addEventListener('click',go);
  document.querySelectorAll('[data-coupon]').forEach(function(el){el.addEventListener('click',function(){var code=el.getAttribute('data-coupon');inp.value=code;inp.classList.add('ok');say('Code '+code+' selected. Apply it when you are ready.');if(el.tagName==='BUTTON')inp.focus()})});
  try{var q=new URLSearchParams(location.search).get('code');if(q&&CODES[q.trim().toUpperCase()]){inp.value=q.trim().toUpperCase();inp.classList.add('ok');say('Code '+inp.value+' selected. Apply it to continue to enrollment.')}}catch(e){}
  }

  /* Question form: proven website lead path (CRM AddNewLead through the proxy). ?env=staging for tests. */
  var f=document.getElementById('askForm')||document.getElementById('attAskForm');
  if(f){var params=new URLSearchParams(location.search),explicitEnv=(params.get('env')||'').toLowerCase();
    var qa=params.get('qa')==='1'||params.get('llatest')==='1';
    var env=explicitEnv==='staging'||(qa&&explicitEnv!=='production')?'staging':'production';
    var submitting=false;
    var W='https://eteacher-leads-proxy.gitter-omri.workers.dev';
    f.addEventListener('submit',function(e){e.preventDefault();if(submitting)return;var fd=new FormData(f),out=document.getElementById('askMsg')||document.getElementById('attAskMsg'),b=document.getElementById('askBtn')||document.getElementById('attAskBtn');
      function s(t,er){out.textContent=t;out.className='formmsg'+(er?' err':'')}
      if(fd.get('website')){s('Sent.');return}
      var fn=(fd.get('firstName')||'').trim(),ln=(fd.get('lastName')||'').trim(),em=(fd.get('email')||'').trim(),ph=(fd.get('phone')||'').trim(),qq=(fd.get('question')||'').trim();
      if(!fn||!ln||!em||!ph||!qq)return s('Please fill in every field so we can call you back.',1);
      if(!fd.get('contactConsent'))return s('Please confirm that our enrollment team may contact you.',1);
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return s('Please check your email address.',1);
      var usPhone=window.LLA_US&&window.LLA_US.validatePhone?window.LLA_US.validatePhone(ph):null;
      if(!usPhone||!usPhone.ok)return s('Please enter a valid US phone number, or message us on WhatsApp.',1);
      var e164=usPhone.e164,state=window.LLA_US.stateForAreaCode?window.LLA_US.stateForAreaCode(e164.slice(2,5)):'';
      var attribution=new URLSearchParams(location.search);
      try{var stored=window.eTeacherLeads&&window.eTeacherLeads.getAttribution?window.eTeacherLeads.getAttribution():{};Object.keys(stored||{}).forEach(function(key){if(/^(utm_[a-z_]+|fbclid|gclid|msclkid)$/.test(key)&&!attribution.has(key)&&stored[key])attribution.set(key,stored[key])})}catch(e){}
      var incomingCid=attribution.get('cid');attribution.delete('cid');attribution.set('cid',/^\d+$/.test(incomingCid||'')?incomingCid:'116641');attribution.set('src','masterclass-attendees');
      var payload={ProductID:26,FirstName:fn,LastName:ln,Email:em,MobilePhone:e164,CountryIsoCode:'US',CountryIsoCodeByIp:'US',State:state,StateProvinceRegion:state,LandingPage:location.href.split('#')[0],UserAgent:navigator.userAgent,ReferringSite:document.referrer||'',QueryString:attribution.toString(),AdminNotes:('MASTERCLASS ATTENDEE QUESTION (Julie Gibson Clark masterclass). Please call back and answer: '+qq).slice(0,4000)};
      var selectedCode=(inp.value||'').trim().toUpperCase().replace(/\s+/g,'');
      payload.AdminNotes+= '\nCallback preference: '+(fd.get('callbackTime')||'Any time')+'; time zone: '+(fd.get('timeZone')||'Not specified')+'. Contact consent: yes. Coupon: '+(CODES[selectedCode]?selectedCode:'not selected')+'.';
      submitting=true;b.disabled=true;b.textContent='Sending';s('');
      fetch(W+'/leads/'+env,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(async function(r){
        var raw=await r.text(),data;try{data=JSON.parse(raw)}catch(e){data=null}
        var receipt=data&&data.SendMessageResponse&&data.SendMessageResponse.SendMessageResult;
        if(!r.ok||!receipt||typeof receipt.MessageId!=='string'||!receipt.MessageId)throw new Error('Lead request not acknowledged');
        var eventId='lla_guest_lead_'+receipt.MessageId;
        window.__llaGuestLeadReceipt={messageId:receipt.MessageId,env:env,status:'queued',eventId:eventId};
        var isTest=qa||env!=='production'||window.LLA_LIVE===false||(window.__llaIsTesterEmail&&window.__llaIsTesterEmail(em));
        if(!isTest){
          var cookie=function(name){var hit=document.cookie.match(new RegExp('(?:^|;\\s*)'+name+'=([^;]*)'));return hit?decodeURIComponent(hit[1]):''};
          var xid;try{xid=localStorage.getItem('lla_xid_v1');if(!xid){xid='lla_'+crypto.randomUUID();localStorage.setItem('lla_xid_v1',xid)}}catch(e){xid=receipt.MessageId}
          var identity={email:em.toLowerCase(),phone:e164,fn:fn.toLowerCase(),ln:ln.toLowerCase(),st:String(state||'').toLowerCase(),country:'us',external_id:xid};
          try{localStorage.setItem('lla_identity_v1',JSON.stringify(identity));sessionStorage.setItem('lla_buyer_v1',JSON.stringify(identity))}catch(e){}
          window.dataLayer=window.dataLayer||[];
          window.dataLayer.push({event:'lla_guest_lead_accepted',form_id:'askForm',crm_status:'queued',env:env,lla_event_id:eventId});
          if(window.fbq){window.fbq('init','1440305917310328',{em:identity.email,ph:e164.replace(/\D/g,''),fn:identity.fn,ln:identity.ln,st:identity.st,country:'us',external_id:xid});window.fbq('track','Lead',{content_name:'Masterclass attendee callback',content_category:'Longevity Blueprint'},{eventID:eventId})}
          if(window.__llaRelay)window.__llaRelay(JSON.stringify(Object.assign({},identity,{event_name:'Lead',event_id:eventId,event_time:Math.floor(Date.now()/1000),url:location.href,user_agent:navigator.userAgent,fbp:cookie('_fbp'),fbc:cookie('_fbc'),content_name:'Masterclass attendee callback',form_id:'askForm'})));
        }
        s('Thank you. Your callback request has been submitted. Our enrollment team will follow up.');f.reset();b.textContent='Request submitted';
      }).catch(function(){submitting=false;b.disabled=false;b.textContent='Send question and request callback';s('We could not confirm your request. Your details are still here. Please try again, or contact our team on WhatsApp.',1)})})}

  /* Reveal: observer for motion, hard fallback so nothing can stay hidden */
  var els=document.querySelectorAll('.rv');setTimeout(function(){els.forEach(function(e){e.classList.add('in')})},900);
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(e){io.observe(e)})}else{els.forEach(function(e){e.classList.add('in')})}
})();
