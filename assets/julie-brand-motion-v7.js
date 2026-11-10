/* Original-pixel brand reveal. No redrawn logos, no geometry changes. */
(function () {
  'use strict';
  var own = document.currentScript;
  var base = new URL('.', own ? own.src : location.href);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (!document.querySelector('link[data-brand-motion-v7]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('julie-brand-motion-v7.css', base).href;
    css.dataset.brandMotionV7 = 'true';
    document.head.appendChild(css);
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      if (el.tagName === 'VIDEO') {
        if (!reduce.matches) {
          el.muted = true;
          el.play().catch(function () {});
        }
      } else if (!reduce.matches && !el.dataset.revealed) {
        el.dataset.revealed = 'true';
        var layer = el.querySelector('.bm-v7-byline');
        if (layer) layer.animate([
          { clipPath: 'inset(74% 100% 0 0)', opacity: 0.35 },
          { clipPath: 'inset(74% 0% 0 0)', opacity: 1 }
        ], { duration: 1600, easing: 'cubic-bezier(.2,.65,.2,1)', fill: 'none' });
      }
    });
  }, { threshold: 0.15 });
  function enhance(root) {
    (root || document).querySelectorAll('.nav-logo img, footer img[alt*="Longevity"], .checkout-brand img, .ck-logo img, .cklogo img, img.cklogo, header.co-head .logo img').forEach(function (img) {
      if (img.closest('.bm-v7-lockup')) return;
      /* Use the original complete approved lockup, split only at its empty gutter. */
      var lockup = document.createElement('span');
      lockup.className = 'bm-v7-lockup';
      img.parentNode.insertBefore(lockup, img);
      lockup.appendChild(img);
      img.classList.add('bm-v7-original');
      var layer = img.cloneNode(false);
      layer.removeAttribute('id');
      layer.removeAttribute('width');
      layer.removeAttribute('height');
      layer.alt = '';
      layer.setAttribute('aria-hidden', 'true');
      layer.className = 'bm-v7-byline';
      lockup.appendChild(layer);
      observer.observe(lockup);
    });
    document.querySelectorAll('video.eteacher-motion').forEach(function (video) {
      if (video.dataset.bmV7) return;
      video.dataset.bmV7 = 'true';
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      video.removeAttribute('autoplay');
      if (reduce.matches) {
        video.pause();
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach(function (s) { s.removeAttribute('src'); });
        video.load();
      } else observer.observe(video);
    });
  }
  window.LLABrandMotionV7 = { enhance: enhance };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { enhance(); });
  else enhance();
  new MutationObserver(function (changes) {
    if (changes.some(function (c) { return c.addedNodes.length; })) enhance();
  }).observe(document.documentElement, { childList: true, subtree: true });
  reduce.addEventListener('change', function () {
    if (reduce.matches) {
      document.querySelectorAll('.bm-v7-byline').forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
      document.querySelectorAll('video.eteacher-motion').forEach(function (v) { v.pause(); v.load(); });
    }
  });
})();
