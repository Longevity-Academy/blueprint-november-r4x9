(function(){
  'use strict';
  const root=document.documentElement;
  let focusTimer;
  function keepFieldVisible(){
    clearTimeout(focusTimer);
    focusTimer=setTimeout(()=>{
      const field=document.activeElement;
      if(!field?.matches('input:not([type=checkbox]),textarea,select')||!field.offsetHeight)return;
      if(!field.closest('#enrollModal.open,#askForm,#attAskForm,.attendee-coupon'))return;
      field.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      if(!field.closest('#enrollModal')){
        const top=Number.parseFloat(root.style.getPropertyValue('--guest-nav-height'))+56;
        const r=field.getBoundingClientRect();
        if(r.top<top)window.scrollBy({top:r.top-top,behavior:'instant'});
      }
    },80);
  }
  function viewport(){
    const nav=document.getElementById('fnNav');
    if(nav)root.style.setProperty('--guest-nav-height',Math.ceil(nav.getBoundingClientRect().height)+'px');
    root.style.setProperty('--guest-viewport-height',(window.visualViewport?.height||innerHeight)+'px');
    keepFieldVisible();
  }
  viewport();addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('resize',viewport);
  const nav=document.getElementById('fnNav');
  if(nav&&window.ResizeObserver)new ResizeObserver(viewport).observe(nav);
  const toggle=document.getElementById('fnNavToggle'),drawer=document.getElementById('fnDrawer'),close=document.getElementById('fnDrawerClose');
  if(toggle&&drawer&&close){
    let previousOverflow='';
    drawer.setAttribute('role','dialog');drawer.setAttribute('aria-label','Site navigation');drawer.setAttribute('aria-modal','true');
    function menu(open,returnFocus){
      if(open)previousOverflow=document.body.style.overflow;
      drawer.classList.toggle('is-open',open);drawer.setAttribute('aria-hidden',String(!open));
      toggle.setAttribute('aria-expanded',String(open));root.classList.toggle('guest-menu-open',open);
      document.body.style.overflow=open?'hidden':previousOverflow;
      if(open)close.focus();else if(returnFocus)toggle.focus();
    }
    toggle.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();menu(!drawer.classList.contains('is-open'),true)},true);
    close.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();menu(false,true)},true);
    drawer.addEventListener('click',e=>{if(e.target.closest('a'))menu(false,false)});
    addEventListener('click',e=>{if(drawer.classList.contains('is-open')&&e.target.closest('#fnDrawer a'))menu(false,false)},true);
    drawer.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();menu(false,true);}
      if(e.key==='Tab'){
        const focusable=[...drawer.querySelectorAll('a[href],button')].filter(el=>el.offsetHeight&&!el.disabled);
        const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    });
  }
  function forms(){
    const visible=[...document.querySelectorAll('#askForm,#attAskForm,.attendee-coupon')].some(e=>{
      const r=e.getBoundingClientRect();return r.width&&r.bottom>0&&r.top<innerHeight;
    });
    root.classList.toggle('guest-form-visible',visible);
  }
  addEventListener('scroll',forms,{passive:true});addEventListener('resize',forms);forms();
  document.addEventListener('focusin',e=>{root.classList.toggle('guest-form-focused',!!e.target.closest('input,textarea,select'));if(innerWidth<=760)keepFieldVisible()});
  document.addEventListener('focusout',()=>setTimeout(()=>root.classList.toggle('guest-form-focused',!!document.activeElement?.closest('input,textarea,select')),0));
  if(!document.getElementById('skills')){
    const section=document.getElementById('learn-com');
    if(section){const anchor=document.createElement('span');anchor.id='skills';section.prepend(anchor);}
  }
  function rails(){
    document.querySelectorAll('#tgRail,.lla-slider').forEach(rail=>{
      if(rail.dataset.guestKeyboard)return;
      rail.dataset.guestKeyboard='1';rail.tabIndex=0;
      rail.setAttribute('role','region');
      if(!rail.getAttribute('aria-label'))rail.setAttribute('aria-label',rail.id==='tgRail'?'Six longevity pillars. Swipe or use arrow keys.':'Course information. Swipe or use arrow keys.');
      rail.addEventListener('keydown',e=>{
        if(e.target!==rail||!['ArrowLeft','ArrowRight'].includes(e.key))return;
        e.preventDefault();
        const card=rail.firstElementChild;
        rail.scrollBy({left:(e.key==='ArrowRight'?1:-1)*((card?.getBoundingClientRect().width||rail.clientWidth)+20),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
      });
    });
  }
  rails();setTimeout(rails,3000);
  const code=document.getElementById('emPromo'),apply=document.getElementById('emApply');
  if(code&&apply){
    code.setAttribute('aria-label','Coupon code');
    function coupon(){
      const applied=!!(window.LLA_PROMO?.active&&window.LLA_PROMO.isValid(code.value)&&code.value.trim().toUpperCase()===window.LLA_PROMO.code);
      root.classList.toggle('guest-coupon-applied',applied);
      if(applied)apply.textContent='Applied';
      else if(apply.textContent==='Applied')apply.textContent='Apply';
    }
    code.addEventListener('input',coupon);
    apply.addEventListener('click',()=>setTimeout(coupon,0));
    const modal=document.getElementById('enrollModal');
    if(modal)new MutationObserver(coupon).observe(modal,{attributes:true,attributeFilter:['class'],subtree:true});
    coupon();setTimeout(coupon,2000);
  }
})();
