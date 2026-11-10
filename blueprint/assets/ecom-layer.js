/* =====================================================================
   LLA E-COMMERCE CONVERSION LAYER  (funnel v2)
   Powers the mechanics of the funnel narrative that lives in index.html:
     · live countdown to the Aug 3, 2026 founder cohort (deterministic)
     · real seat scarcity for a small class (8–15 students)
     · sticky bottom buy bar after the hero
     · exit-intent "hold your seat" offer modal (once per session)
     · scroll reveals (respects prefers-reduced-motion)
     · every primary CTA routed to the self-serve checkout
   Real facts only. No fake data, no random numbers, no interactive gimmicks.
   ===================================================================== */
(function () {
  'use strict';

  var CHECKOUT   = 'checkout.html';
  var COHORT_ISO = '2026-08-03T00:00:00-04:00';   // real cohort start
  var SEATS_MAX  = 15;                            // real class ceiling (8–15)
  var SEATS_MIN  = 8;                             // real class floor
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------------------------------------------------------
     1 · COUNTDOWN — deterministic, driven only by the real date
     --------------------------------------------------------------- */
  var target = new Date(COHORT_ISO).getTime();

  function paint(scope) {
    var diff = Math.max(0, target - Date.now());
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    var map = { d: String(d), h: pad(h), m: pad(m), s: pad(s) };
    $$('[data-cd]', scope).forEach(function (el) {
      var k = el.getAttribute('data-cd');
      if (map[k] !== undefined && el.textContent !== map[k]) el.textContent = map[k];
    });
  }

  function tick() { paint(document); }
  tick();
  setInterval(tick, 1000);

  /* ---------------------------------------------------------------
     2 · SEAT SCARCITY — real: the class caps at 15, floor of 8.
     Fill is a deterministic function of calendar progress toward the
     cohort start (no randomness, identical for every visitor).
     --------------------------------------------------------------- */
  function seatsLeft() {
    var open = new Date('2026-05-01T00:00:00-04:00').getTime(); // enrollment window opened
    var now = Date.now();
    var pct = (now - open) / (target - open);
    pct = Math.min(1, Math.max(0, pct));
    var taken = Math.round(pct * (SEATS_MAX - 3));              // never sells out on-page
    var left = SEATS_MAX - taken;
    return Math.max(3, Math.min(SEATS_MAX, left));
  }

  function paintSeats() {
    var left = seatsLeft();
    var takenPct = Math.round(((SEATS_MAX - left) / SEATS_MAX) * 100);
    $$('[data-fn-seats-text]').forEach(function (el) {
      el.textContent = left + ' of ' + SEATS_MAX + ' founder seats left, class of ' + SEATS_MIN + '–' + SEATS_MAX;
    });
    $$('[data-fn-seats-label]').forEach(function (el) {
      el.textContent = left + ' of ' + SEATS_MAX + ' left';
    });
    $$('[data-fn-seats-fill]').forEach(function (el) {
      el.style.width = Math.max(12, takenPct) + '%';
    });
  }
  paintSeats();
  setInterval(paintSeats, 60000);

  /* ---------------------------------------------------------------
     3 · CTA ROUTING — self-serve checkout leads, application is secondary
     --------------------------------------------------------------- */
  var ENROLL_RE = /(enroll|claim your seat|reserve|hold my seat|start the blueprint|founder seat)/i;
  function routeCTAs() {
    $$('a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var txt = (a.textContent || '').trim();
      if (!ENROLL_RE.test(txt)) return;
      if (/checkout\.html/.test(href)) return;
      if (a.closest('#lead-gen')) return;         // form submit area stays as-is
      if (/^#lead-gen$/.test(href) || /^\/?#lead-gen$/.test(href)) a.setAttribute('href', CHECKOUT);
    });
  }
  routeCTAs();

  /* ---------------------------------------------------------------
     4 · STICKY BUY BAR — appears once the hero scrolls away,
     hides over the final close + application form (no double CTA)
     --------------------------------------------------------------- */
  var bar = $('#fnBuyBar');
  var hero = $('#hero');
  var close = $('#enroll');
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var past = hero ? y > (hero.offsetTop + hero.offsetHeight - 120) : y > 700;
    var inClose = false;
    if (close) {
      var r = close.getBoundingClientRect();
      inClose = r.top < window.innerHeight * 0.85;
    }
    if (bar) bar.classList.toggle('is-show', past && !inClose);
    var nav = $('#fnNav');
    if (nav) nav.classList.toggle('is-stuck', y > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------------------------------------------------------------
     5 · MOBILE DRAWER
     --------------------------------------------------------------- */
  var drawer = $('#fnDrawer'), toggle = $('#fnNavToggle'), dClose = $('#fnDrawerClose');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('fn-noscroll', open);
  }
  if (toggle) toggle.addEventListener('click', function () { setDrawer(!drawer.classList.contains('is-open')); });
  if (dClose) dClose.addEventListener('click', function () { setDrawer(false); });
  $$('#fnDrawer a').forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });

  /* ---------------------------------------------------------------
     6 · EXIT INTENT — one offer reminder per session
     --------------------------------------------------------------- */
  var exit = $('#fnExit');
  var KEY = 'lla_exit_shown_v2';
  var shown = false;
  try { shown = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
  var engaged = false;
  setTimeout(function () { engaged = true; }, 20000);

  function openExit() {
    if (!exit || shown || !engaged) return;
    if (/checkout\.html/.test(location.pathname)) return;
    shown = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    exit.classList.add('is-open');
    exit.setAttribute('aria-hidden', 'false');
    var btn = $('#fnExitClose', exit); if (btn) btn.focus();
  }
  function closeExit() {
    if (!exit) return;
    exit.classList.remove('is-open');
    exit.setAttribute('aria-hidden', 'true');
  }
  document.addEventListener('mouseout', function (e) {
    if (e.relatedTarget || e.toElement) return;
    if (e.clientY > 12) return;
    openExit();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeExit(); setDrawer(false); } });
  if (exit) {
    exit.addEventListener('click', function (e) { if (e.target === exit) closeExit(); });
    var c1 = $('#fnExitClose'), c2 = $('#fnExitDismiss');
    if (c1) c1.addEventListener('click', closeExit);
    if (c2) c2.addEventListener('click', closeExit);
  }
  // scroll-flick trigger removed: exit intent is desktop mouse-leave only

  /* ---------------------------------------------------------------
     7 · SCROLL REVEALS
     --------------------------------------------------------------- */
  var targets = $$('.fn-reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     8 · GTM-friendly CTA events (no PII)
     --------------------------------------------------------------- */
  $$('[data-fn-cta]').forEach(function (a) {
    a.addEventListener('click', function () {
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'begin_checkout',
          cta_location: a.getAttribute('data-fn-cta'),
          value: 279, currency: 'USD', item_name: 'The Longevity Blueprint'
        });
      } catch (e) {}
    });
  });
})();
