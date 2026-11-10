(function(){
  function init(){
    var btn = document.getElementById('llaMobileMenuBtn');
    var ov = document.getElementById('llaMobileNavOverlay');
    var cl = document.getElementById('llaMobileNavClose');
    if(!btn || !ov) return;
    btn.addEventListener('click', function(){ ov.classList.add('open'); btn.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; });
    if(cl) cl.addEventListener('click', function(){ ov.classList.remove('open'); btn.setAttribute('aria-expanded','false'); document.body.style.overflow=''; });
    ov.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ ov.classList.remove('open'); btn.setAttribute('aria-expanded','false'); document.body.style.overflow=''; }); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
