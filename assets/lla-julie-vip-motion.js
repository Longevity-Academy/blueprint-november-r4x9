/* Presentation only: no tracking, CRM, checkout, cookies or network API calls. */
(function () {
  'use strict';
  var group = document.querySelector('#julie .jb4-motion');
  if (!group) return;
  var clips = Array.prototype.slice.call(group.querySelectorAll('[data-motion-src]'));
  var button = group.querySelector('.jb4-motion-toggle');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var userPaused = reduced.matches;
  var visible = false;
  function sync() {
    var run = visible && !document.hidden && !userPaused;
    clips.forEach(function (clip) {
      var video = clip.querySelector('video');
      if (!video && run) {
        video = document.createElement('video');
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.preload = 'none';
        video.poster = clip.querySelector('img').src;
        video.src = clip.getAttribute('data-motion-src');
        clip.appendChild(video);
      }
      if (!video) return;
      // Existing checkout cancellation removes src; never reattach or restart it.
      if (run && video.hasAttribute('src')) {
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () {});
      } else video.pause();
    });
    button.setAttribute('aria-label', userPaused ? 'Play animations' : 'Pause animations');
    button.setAttribute('aria-pressed', String(userPaused));
  }
  button.addEventListener('click', function () { userPaused = !userPaused; sync(); });
  document.addEventListener('visibilitychange', sync);
  function preferenceChanged() { userPaused = reduced.matches; sync(); }
  if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else if (reduced.addListener) reduced.addListener(preferenceChanged);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold:0.08 }).observe(document.getElementById('julie') || group);
  } else {
    userPaused = true;
    visible = true;
    sync();
  }
  sync();
})();
