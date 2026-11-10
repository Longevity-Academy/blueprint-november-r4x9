/* Text-only adaptation of the original pages.dev components. No design replacement. */
(function(){
 const descriptions=[
  'Plan meals using protein, fiber and food processing. Compare your glucose responses to foods and meal timing, and understand gut health.',
  'Understand sleep architecture and circadian rhythm. Test light, temperature, wake time and evening meals using your sleep log.',
  'Plan strength, cardio, stability and balance. Understand VO₂ max and compare glucose responses to post-meal movement.',
  'Evaluate supplement evidence and wearable data. Distinguish clinical trials from anecdotes and review decisions with your clinician.',
  'Understand the relationship between stress and glucose. Practise breathing and body-reset tools, then record your responses.',
  'Combine health data and daily habits into your written Blueprint. Include social connection, a tracking schedule and a 90-day plan.'
 ];
 function text(selector,value){const e=document.querySelector(selector);if(e&&e.textContent!==value)e.textContent=value}
 function html(selector,value){const e=document.querySelector(selector);if(e&&e.innerHTML!==value)e.innerHTML=value}
 function apply(){
  document.title='The Longevity Blueprint | Masterclass attendee course information';
  if(!document.getElementById('attendee-source-field-styles')){
   const css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\n');
   const rules=[...css.matchAll(/([^{}]*#enrollModal[^{}]*\.em-in[^{}]*)\{([^{}]*)\}/g)];
   const style=document.createElement('style');style.id='attendee-source-field-styles';
   style.textContent=rules.map(m=>m[1].replaceAll('#enrollModal','#ask')+'{'+m[2]+'}\n'+m[1].replaceAll('#enrollModal','.attendee-coupon')+'{'+m[2]+'}').join('\n')+'\n.attendee-coupon button[data-coupon]{color:inherit}html{scroll-padding-top:130px}';
   document.head.append(style);
  }
  html('#hero h1','Build your personal longevity protocol in <span class="pdp-cine-blue">18 live classes.</span>');
  html('#hero .pdp-cine-sub','18 live small-group classes with Julie and the LLA faculty. Abbott Lingo CGM shipped free. You leave with a written protocol built on your own numbers.');
  text('#hero figcaption span','Founding Faculty, Longevity Life Academy');
  const heroCTA=document.querySelector('#hero .pdp-cine-cta');if(heroCTA){heroCTA.href='#offer';heroCTA.dataset.enrollCourse='1';heroCTA.innerHTML='Enroll now';}
  document.querySelectorAll('#learn-com .topic-v2-desc').forEach((p,i)=>{if(descriptions[i])p.textContent=descriptions[i]});
  html('#included h2','What the course <em>includes</em>');
  html('#cgm h2','Abbott Lingo sensor <em>and app</em>');
  text('#vip h2',"Included in November: Julie Gibson Clark's VIP Masterclass, live on November 14.");
  html('#offer h2','Tuition and <em>coupon codes</em>');
  text('#offer .lp-lead','18 live classes, learning-platform access, Julie’s VIP masterclass and one Abbott Lingo sensor with U.S. shipping.');
  text('#offer .lp-big b','79');text('#offer .lp-saverow s','$169 / month');
  text('#offer .lp-pill','Masterclass credit');
  html('#offer .lp-total','<b>$755 total</b><small>$90 masterclass credit applied to month 1.</small>');
  text('#codeApply','Apply code and enroll');
  text('#offer .lp-julie-t b','Masterclass attendee code');
  html('#offer .lp-trust','<b>Full refund within 14 days of registration.</b> Questions? Call +1-888-230-5110.');
  html('#syllabus h2','The 18-class <em>syllabus</em>');
  html('#teachers h2','Course <em>faculty</em>');
  html('#mechanism h2','Course <em>timeline</em>');
  text('#mechanism .fn-lead','Confirm your class with the enrollment team. Complete 18 weekly sessions and develop your written Blueprint.');
  const steps=document.querySelectorAll('#mechanism .fn-journey-step');
  if(steps[0]){steps[0].querySelector('h3').textContent='Enrollment and platform access';steps[0].querySelector('p').textContent='The team confirms your class, coupon and enrollment details, then explains access to the learning platform.'}
  if(steps[1])steps[1].querySelector('p').textContent='50 minutes live with your instructor and classmates. Your available start date and weekly meeting time are confirmed by the enrollment team.';
  if(steps[3])steps[3].querySelector('h3').textContent='Weekly learning and practice';
  html('#whatitis h2','How the live <em>course works</em>');
  const methodTitles=['Live classes and recordings','Health data and weekly practice','Group discussion and peer feedback','Your written protocol'];
  document.querySelectorAll('#whatitis .pdp-value-card h3').forEach((h,i)=>{if(methodTitles[i])h.textContent=methodTitles[i]});
  html('#faq h2','Frequently asked <em>questions</em>');
  document.querySelectorAll('#faq .faq-item').forEach(item=>{
   if(/How much does it cost/i.test(item.textContent)){const answer=item.querySelector('.faq-a-inner');if(answer)answer.textContent='Regular tuition is $169 per month for five months, $845 total. Apply JULIE249 or MASTERCLASS-VIP for a $90 masterclass credit: $79 in month 1, then four monthly payments of $169. Total: $755.'}
  });
  const strip=document.getElementById('mockStrip');if(strip)strip.innerHTML='<span class="t lg">Use your masterclass coupon code</span><span class="t sm"><a href="#offer" data-coupon="JULIE249">JULIE249</a><span>or</span><a href="#offer" data-coupon="MASTERCLASS-VIP">MASTERCLASS-VIP</a></span><a class="code" href="#offer" data-coupon="JULIE249">JULIE249</a><a class="code" href="#offer" data-coupon="MASTERCLASS-VIP">MASTERCLASS-VIP</a>';
  const bar=document.getElementById('mockBar');if(bar){const price=bar.querySelector('.l b');if(price)price.textContent='$79 month 1';const a=bar.querySelector('a');if(a){a.href='#offer';a.dataset.enrollCourse='1';a.textContent='Enroll now'}}
  document.querySelectorAll('a[href*="checkout.html"]').forEach(a=>{a.href='#offer';a.removeAttribute('data-plan')});
  document.querySelectorAll('header a[href="#offer"]').forEach(a=>{a.textContent='Enroll now';a.dataset.enrollCourse='1'});
  // The captured source places this initializer before the carousel markup.
  // Run the original one-card scroll behavior after that markup exists.
  const rail=document.getElementById('tgRail');
  if(rail&&!rail.dataset.attendeeBound){
   rail.dataset.attendeeBound='1';
   const step=()=>{const card=rail.querySelector('.topic-v2');return card?card.getBoundingClientRect().width+20:400};
   document.querySelector('#learn-com .tg-prev')?.addEventListener('click',()=>rail.scrollBy({left:-step(),behavior:'smooth'}));
   document.querySelector('#learn-com .tg-next')?.addEventListener('click',()=>rail.scrollBy({left:step(),behavior:'smooth'}));
   const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const video=entry.target;if(entry.isIntersecting&&!matchMedia('(prefers-reduced-motion:reduce)').matches)video.play().catch(()=>{});else video.pause()}),{threshold:.2});
   rail.querySelectorAll('video').forEach(video=>{
    video.muted=true;
    if(!video.poster)video.poster=video.src.replace('/assets/','/assets/posters/').replace(/\.mp4(?:\?.*)?$/,'.jpg');
    observer.observe(video);
   });
  }
 }
 apply();document.addEventListener('DOMContentLoaded',apply);window.addEventListener('load',apply);setTimeout(apply,1000);setTimeout(()=>{apply();document.documentElement.dataset.attendeeReady='stable'},2500);
 document.addEventListener('click',function(e){
  const code=e.target.closest('[data-coupon]');if(code){const field=document.getElementById('codeInput');if(field)field.value=code.dataset.coupon;}
  const a=e.target.closest('a[href="#offer"],a[href="#ask"],a[href="#learn-com"]');
  if(a){e.preventDefault();e.stopImmediatePropagation();document.querySelector(a.getAttribute('href'))?.scrollIntoView({behavior:'smooth'});}
 },true);
})();
