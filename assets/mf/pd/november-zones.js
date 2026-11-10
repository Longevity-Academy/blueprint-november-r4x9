/* Copied byte for byte from pages.dev blueprint/assets/lla-country.js (the November block at its end). */
/* Blueprint November 2026: class identity unchanged; buyer-facing EST/PST only. */
(function(){
  if(window.__llaNovemberZones)return;
  window.__llaNovemberZones=true;
  var times={
    '2026-11-23':{et:'8:00 PM',pt:'5:00 PM',day:'Monday, November 23, 2026'},
    '2026-11-25':{et:'12:00 PM',pt:'9:00 AM',day:'Wednesday, November 25, 2026'}
  };
  function set(el,value){if(el&&el.textContent!==value)el.textContent=value;}
  function update(){
    var select=document.getElementById('emDate');if(!select)return;
    var opts=Array.from(select.querySelectorAll('option[data-start]'));
    opts.forEach(function(o){
      var t=times[o.dataset.start];if(!t)return;
      set(o,t.day+' · '+t.et+' EST / '+t.pt+' PST');
      /* Keep option values intact: existing listeners bind those values to CRM IDs. */
    });
    document.querySelectorAll('#dpList .dp-card').forEach(function(card){
      var day=card.querySelector('.dp-day'),t=day&&(/Nov\s*23/.test(day.textContent)?times['2026-11-23']:/Nov\s*25/.test(day.textContent)?times['2026-11-25']:null);
      if(t){set(card.querySelector('.dp-et'),t.et+' EST');set(card.querySelector('.dp-alt'),t.pt+' PST');}
    });
    var option=select.options[select.selectedIndex],t=option&&times[option.dataset.start];
    if(t){
      set(document.getElementById('emTimeVal'),t.day.split(',')[0]+'s · '+t.et+' EST · '+t.pt+' PST');
      var summary=document.getElementById('emSummary');
      if(summary&&/\bCT\b/.test(summary.textContent))set(summary,summary.textContent.replace(/\s*[·|]\s*\d{1,2}:\d{2}\s*[AP]M\s*CT/g,'').replace(/\bET\b/g,'EST').replace(/\bPT\b/g,'PST'));
    }
  }
  var pending=false;
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;update();});}
  document.addEventListener('DOMContentLoaded',schedule);
  document.addEventListener('change',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
})();
