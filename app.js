/* Eimverk : motion layer, ported 1:1 from the CO'COON system.
   Constants below are the reference's own (theme.js, lines 4894-4934). */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reference constants, verbatim ---- */
  var EASE = { DEFAULT: 'power3.out', SMOOTH: 'power2.inOut', SNAP: 'power4.out', LUXE: 'luxe' };
  var DUR  = { FAST: .4, MEDIUM: .6, DEFAULT: .8, SLOW: 1.2 };
  var STAG = { MICRO: .02, TIGHT: .04, DEFAULT: .1, RELAXED: .2 };
  var DELAY_INTRO = .3;
  var DIST = { Y: '3.75rem', X: '2.5rem' };
  var TRIG_START = 'top 85%';
  var PARA = { SPEED: .15, MAX: .4, REVEAL: .3 };
  var SHADOW = { MAX: .5, FOLLOW: 1 };
  var ABOVE_MOBILE = '(min-width: 48rem)';

  if (typeof gsap === 'undefined') { document.querySelectorAll('[data-reveal]').forEach(function(n){n.style.opacity=1;}); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* CustomEase is a paid plugin; register the reference's "luxe" curve
     (0.16, 1, 0.3, 1) as an equivalent solved cubic bezier. */
  (function registerLuxe() {
    function bez(x1, y1, x2, y2) {
      function A(a, b) { return 1 - 3 * b + 3 * a; }
      function B(a, b) { return 3 * b - 6 * a; }
      function C(a) { return 3 * a; }
      function calc(t, a, b) { return ((A(a, b) * t + B(a, b)) * t + C(a)) * t; }
      function slope(t, a, b) { return 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a); }
      return function (x) {
        var t = x;
        for (var i = 0; i < 5; i++) {
          var s = slope(t, x1, x2);
          if (s === 0) break;
          t -= (calc(t, x1, x2) - x) / s;
        }
        return calc(t, y1, y2);
      };
    }
    gsap.registerEase('luxe', bez(0.16, 1, 0.3, 1));
    /* UI curves, see the UI block below. */
    gsap.registerEase('uiOut', bez(0.23, 1, 0.32, 1));
    gsap.registerEase('uiDrawer', bez(0.32, 0.72, 0, 1));
  })();

  /* ================= UI timing (motion review) =================
     The reference constants above stay as the record of the source system, and
     the marketing motion (hero intro, scroll reveals, parallax, footer) still
     runs on them. These values replace them on *interactive* UI only, where the
     review found the reference's own timing outside the craft bar:

       - entering and exiting elements ease out; the reference's power2.inOut
         eases in for its first half and delays the frame the user watches
       - the mega panel measured 875ms click-to-settle against a 200-500ms
         budget for a drawer
       - the nav underline ran 800ms on hover, against a 300ms UI ceiling
       - the burger toggle ran 400ms, against 100-160ms for press feedback
       - the hero stagger ran 100ms per line, against a 30-80ms band

     Deleting this block and restoring the DUR/EASE/STAG references at the four
     call sites returns the build to reference timing exactly. */
  var UI = {
    OUT: 'uiOut',
    DRAWER: 'uiDrawer',
    UNDERLINE: .18,
    PANEL: .35,
    TOGGLE: .16,
    STAGGER: .05
  };

  /* ---- viewport unit vars (reference writes these on resize) ---- */
  var root = document.documentElement;
  function setVH() {
    root.style.setProperty('--dvh', (window.innerHeight * .01) + 'px');
    root.style.setProperty('--svh', (root.clientHeight * .01) + 'px');
    root.style.setProperty('--lvh', '1vh');
  }
  setVH();
  window.addEventListener('resize', setVH, false);

  var rem = parseFloat(getComputedStyle(root).fontSize) || 16;
  function toPx(v) { return parseFloat(v) * rem; }

  /* ---- Lenis: reference config exactly (lerp .1, smoothWheel only) ----
     smoothWheel-only means touch scrolling stays native, so this does not
     damage mobile. Driven by the gsap ticker like the reference. */
  var lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ================= cocoon-link underline =================
     enter from the left, exit to the right, never reverses. */
  document.querySelectorAll('.link').forEach(function (wrap) {
    var line = wrap.querySelector('.link__line');
    var anchor = wrap.querySelector('.link__anchor') || wrap.querySelector('a,button');
    if (!line || !anchor) return;
    gsap.set(line, { x: 0, xPercent: -101 });
    if (reduce) return;
    var enter = function () {
      if (gsap.getProperty(line, 'xPercent') >= 100) gsap.set(line, { xPercent: -101 });
      gsap.to(line, { xPercent: 0, duration: UI.UNDERLINE, ease: UI.OUT, overwrite: true });
    };
    var leave = function () {
      gsap.to(line, { xPercent: 101, duration: UI.UNDERLINE, ease: UI.OUT, overwrite: true });
    };
    anchor.addEventListener('mouseenter', enter);
    anchor.addEventListener('focus', enter);
    anchor.addEventListener('mouseleave', leave);
    anchor.addEventListener('blur', leave);
    anchor.addEventListener('click', leave);
  });

  /* ================= nav theme, section-scoped =================
     IntersectionObserver collapsed to the navbar's vertical centre line. */
  (function navTheme() {
    var navbar = document.querySelector('.navbar');
    var page = document.getElementById('page');
    if (!navbar || !page || !('IntersectionObserver' in window)) return;
    var states = new Map(), sections = [], io = null;

    function centre() {
      var r = navbar.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    }
    function apply() {
      var theme = 'light';
      sections.forEach(function (s) { if (states.get(s)) theme = s.dataset.navTheme || theme; });
      if (navbar.getAttribute('data-nav-theme') !== theme) navbar.setAttribute('data-nav-theme', theme);
    }
    function build() {
      if (io) io.disconnect();
      var c = centre(), vh = window.innerHeight || 0;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { states.set(e.target, e.isIntersecting); });
        apply();
      }, { rootMargin: '-' + c + 'px 0px -' + Math.max(0, vh - c - 1) + 'px 0px', threshold: 0 });
      states.clear();
      sections = Array.prototype.slice.call(page.querySelectorAll('[data-nav-theme]'));
      sections.forEach(function (s) { io.observe(s); });
    }
    build();
    window.addEventListener('resize', function () { requestAnimationFrame(build); }, { passive: true });

    /* The navbar is transparent over the hero and carries a ground below it.
       Same collapsed-to-the-navbar-line trick as the theme observer, watching
       the hero alone: while any part of the hero crosses that line the bar
       stays transparent, and the moment it does not, the ground fades in. */
    var hero = page.querySelector('.hero');
    if (hero) {
      var c2 = centre(), vh2 = window.innerHeight || 0;
      var solidIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          navbar.setAttribute('data-nav-solid', e.isIntersecting ? 'off' : 'on');
        });
      }, { rootMargin: '-' + c2 + 'px 0px -' + Math.max(0, vh2 - c2 - 1) + 'px 0px', threshold: 0 });
      solidIO.observe(hero);
    }
  })();

  /* ================= parallax =================
     fromTo(-speed*containerSize -> +speed*containerSize), scrubbed,
     desktop + motion-ok only, exactly as the reference gates it. */
  var mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference) and ' + ABOVE_MOBILE, function () {
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var raw = parseFloat(el.dataset.parallaxSpeed);
      var speed = isNaN(raw) ? PARA.SPEED : gsap.utils.clamp(-PARA.MAX, PARA.MAX, raw);
      if (!speed) return;
      var container = el.closest('[data-parallax-container]') || el.parentElement || el;
      gsap.fromTo(el,
        { y: function () { return -speed * container.offsetHeight; } },
        {
          y: function () { return speed * container.offsetHeight; },
          ease: 'none',
          scrollTrigger: { trigger: container, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
        });
    });
  });

  /* ================= hero intro =================
     media scale 1.06 over SLOW, heading lines yPercent 110 masked,
     fades y DIST.Y with RELAXED offset. */
  (function hero() {
    var heading = document.querySelector('[data-hero-heading]');
    var media = document.querySelector('.hero__media');
    var fades = document.querySelectorAll('[data-hero-fade]');
    if (reduce) { gsap.set([media].concat(Array.prototype.slice.call(fades)).filter(Boolean), { autoAlpha: 1 }); return; }

    /* split into real rendered lines and mask them (SplitText lines + mask) */
    var lines = [];
    if (heading) {
      var html = heading.innerHTML.split(/<br\s*\/?>/i).map(function (s) { return s.trim(); });
      heading.innerHTML = '';
      lines = html.map(function (t) {
        var outer = document.createElement('span'); outer.className = 'line';
        var inner = document.createElement('span'); inner.innerHTML = t;
        outer.appendChild(inner); heading.appendChild(outer);
        return inner;
      });
      gsap.set(lines, { yPercent: 110 });
    }
    gsap.set(fades, { autoAlpha: 0, y: toPx(DIST.Y) });

    var tl = gsap.timeline({ defaults: { ease: EASE.DEFAULT, duration: DUR.DEFAULT } });
    if (media) tl.from(media, { scale: 1.06, duration: DUR.SLOW }, 0);
    if (lines.length) tl.to(lines, { yPercent: 0, stagger: UI.STAGGER }, 0);
    tl.to(fades, { autoAlpha: 1, y: 0, stagger: UI.STAGGER }, '<+=' + STAG.RELAXED);
  })();

  /* ================= reviews rail =================
     pointer drag with 4px threshold, click suppression,
     snap-back tween FAST/SNAP, arrow paging by one card + gap. */
  (function reviews() {
    var track = document.querySelector('[data-reviews-track]');
    if (!track) return;
    var items = track.querySelectorAll('.reviews__item');
    var prev = document.querySelector('[data-reviews-prev]');
    var next = document.querySelector('[data-reviews-next]');
    var dragging = false, moved = false, suppress = false, startX = 0, lastX = 0, settle = null;
    var lastT = 0, vel = 0;

    function gap() { var g = parseFloat(getComputedStyle(track).columnGap); return isNaN(g) ? 0 : g; }
    function step() { return (items[0] ? items[0].offsetWidth : 0) + gap(); }
    function arrows() {
      var max = track.scrollWidth - track.clientWidth;
      if (prev) { prev.disabled = track.scrollLeft <= 1; prev.setAttribute('aria-disabled', String(prev.disabled)); }
      if (next) { next.disabled = track.scrollLeft >= max - 1; next.setAttribute('aria-disabled', String(next.disabled)); }
    }
    function page(dir) { track.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' }); }

    if (prev) prev.addEventListener('click', function () { page(-1); });
    if (next) next.addEventListener('click', function () { page(1); });
    track.addEventListener('scroll', arrows, { passive: true });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(arrows).observe(track);
    arrows();

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button > 0) return;
      if (settle) { settle.kill(); settle = null; }
      dragging = true; moved = false; suppress = false;
      startX = lastX = e.clientX; lastT = e.timeStamp; vel = 0;
      if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dt = Math.max(1, e.timeStamp - lastT);
      track.scrollLeft -= dx;
      /* smoothed instantaneous velocity in px/ms, so a flick is measurable */
      vel = vel * 0.6 + (dx / dt) * 0.4;
      lastX = e.clientX; lastT = e.timeStamp;
      if (!moved && Math.abs(e.clientX - startX) > 4) {
        moved = true; track.classList.add('is-dragging');
        if (window.getSelection) window.getSelection().removeAllRanges();
      }
      if (moved) e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!moved) { track.classList.remove('is-dragging'); return; }
      suppress = true;
      var s = step();
      if (s <= 0 || reduce) { track.classList.remove('is-dragging'); return; }
      /* A flick should be enough. Position-only rounding made a fast, short
         swipe spring back because it had not crossed half a card. */
      var target;
      if (Math.abs(vel) > 0.11) {
        target = (Math.round(track.scrollLeft / s) + (vel < 0 ? 1 : -1)) * s;
      } else {
        target = Math.round(track.scrollLeft / s) * s;
      }
      target = gsap.utils.clamp(0, Math.max(0, track.scrollWidth - track.clientWidth), target);
      var proxy = { x: track.scrollLeft };
      settle = gsap.to(proxy, {
        x: target, duration: DUR.FAST, ease: EASE.SNAP,
        onUpdate: function () { track.scrollLeft = proxy.x; },
        onComplete: function () { settle = null; track.classList.remove('is-dragging'); }
      });
    }
    track.addEventListener('click', function (e) {
      if (suppress) { suppress = false; e.preventDefault(); e.stopPropagation(); }
    }, true);
  })();

  /* ================= footer =================
     yPercent -REVEAL*100 -> 0 scrubbed over its own reveal, plus the
     pointer-tracked drop-shadow on the wordmark (quickTo, FOLLOW 1s). */
  (function footer() {
    var foot = document.querySelector('.footer');
    if (!foot) return;
    mm.add('(prefers-reduced-motion: no-preference) and ' + ABOVE_MOBILE, function () {
      gsap.fromTo(foot, { yPercent: -PARA.REVEAL * 100 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: foot.parentElement || foot, start: 'top bottom', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true }
      });
    });

    /* The reference tracks the pointer here and drives --footer-shadow-x/y so
       the wordmark's rim light follows the cursor. Removed: it re-rasterised
       two stacked drop-shadow() filters over 15rem display type on every
       pointermove, including touch drags where the effect cannot be seen. The
       static rim light stays, which is the part that reads. */
  })();

  /* ================= nav toggle (burger to X) =================
     Reference geometry: the two hairlines rest at -/+0.25rem and rotate
     to -/+45 into an X while the panel is open. */
  (function navToggle() {
    var OFFSET = '0.25rem', ROT = 45, PANEL = 'mega';
    var button = document.querySelector('.navbar__burger');
    if (!button) return;
    var lines = button.querySelectorAll('.navbar__burger-line');
    if (lines.length !== 2) return;
    var top = lines[0], bottom = lines[1];

    gsap.set(top, { y: '-' + OFFSET, rotation: 0 });
    gsap.set(bottom, { y: OFFSET, rotation: 0 });

    function setState(isOpen) {
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      var a = isOpen ? { y: 0, rotation: ROT } : { y: '-' + OFFSET, rotation: 0 };
      var b = isOpen ? { y: 0, rotation: -ROT } : { y: OFFSET, rotation: 0 };
      if (reduce) { gsap.set(top, a); gsap.set(bottom, b); return; }
      gsap.to(top, Object.assign({}, a, { duration: UI.TOGGLE, ease: UI.OUT, overwrite: true }));
      gsap.to(bottom, Object.assign({}, b, { duration: UI.TOGGLE, ease: UI.OUT, overwrite: true }));
    }

    document.addEventListener('shift-modal:open', function (e) {
      if (!e.detail || e.detail.id === PANEL) setState(true);
    });
    document.addEventListener('shift-modal:close', function (e) {
      if (!e.detail || e.detail.id === PANEL) setState(false);
    });
  })();


  /* ================= products =================
     Every line of copy below is Eimverk's own, from flokiwhisky.is product
     pages, abridged. Nothing added: no ABV, age or cask claim that is not on
     their page for that expression. */
  var PRODUCTS = {
    'single-malt': { f:'floki', family:'Flóki whisky', name:'Flóki Single Malt', note:'3 years, single barrel', img:'p-single-malt', hover:'b-single-malt',
      copy:['The first edition was released in November 2017, when it became the first Icelandic single malt whisky.','Handcrafted from 100% locally farmed Icelandic barley. A subtle yet complex malt that takes its own form of the traditional whisky experience, exploring new grounds, much like Hrafna-Flóki himself.'],
      specs:[['Cask','Ex-Flóki Young Malt barrels'],['Age','3 years'],['Bottling','Single barrel'],['Matured','Under Mount Hekla']] },
    'young-malt': { f:'floki', family:'Flóki whisky', name:'Flóki Young Malt', note:'The first Flóki, 2014', img:'p-young-malt', hover:'b-young-malt',
      copy:['The very first Flóki to reach shelves, back in 2014. Hand-crafted from 100% Icelandic barley and aged in selected new oak barrels.','Custom-made distillation equipment extracts the full flavour of the barley: a complex malt with a blend of characteristics you would expect from bourbon, Scotch and Irish whiskies.'],
      specs:[['Cask','Selected new oak'],['Age','2 years'],['Bottling','Single barrel']] },
    'single-malt-dung': { f:'floki', family:'Flóki whisky', name:'Flóki Sheep Dung Smoked Reserve', note:'First in the world', img:'p-single-malt-dung', hover:'b-single-malt-dung',
      copy:['A truly unique smoked malt. An old Icelandic smoking tradition, sheep dung, smokes the barley, the way Icelanders preserved food and heated houses for centuries.','Sweet smoky notes complement the intense flavour of the Icelandic barley, with a rich, lingering aftertaste that brings you back to the farm.'],
      specs:[['Smoke','Sheep dung, traditional method'],['Cask','Ex-Flóki Young Malt barrels'],['Age','3 years'],['Bottling','Single barrel']] },
    'young-malt-dung': { f:'floki', family:'Flóki whisky', name:'Flóki Young Malt Sheep Dung Smoked', note:'2 years, smoked', img:'p-young-malt-dung', hover:'b-young-malt-dung',
      copy:['The young malt, smoked with sheep dung by traditional Icelandic methods and materials.','Handcrafted from 100% Icelandic barley and aged in selected new oak barrels under the base of Mount Hekla.'],
      specs:[['Smoke','Sheep dung, traditional method'],['Cask','Selected new oak'],['Age','2 years'],['Bottling','Single barrel']] },
    'birch': { f:'floki', family:'Flóki whisky', name:'Flóki Icelandic Birch Finish', note:'Finished in birch', img:'p-birch', hover:'b-birch',
      copy:['Birch is one of Iceland’s few native trees. First released in 2019, this reserve is matured in American oak for three years and finished for three months in Icelandic birch casks.','The porous birch lends apple blossom, heather and moss with honey, licorice and mint, and an aftertaste of cinnamon, nutmeg and dried fruit.'],
      specs:[['Cask','American oak'],['Finish','3 months, Icelandic birch'],['Age','3 years'],['Bottling','Single barrel']] },
    'sherry': { f:'floki', family:'Flóki whisky', name:'Flóki Sherry Cask Finish', note:'First fill Oloroso', img:'p-sherry', hover:'b-sherry',
      copy:['First released in 2019. Matured in American oak and finished in first fill Oloroso sherry casks.','A single barrel bottling, aged for three years in ex-Flóki Young Malt barrels under the roots of Mount Hekla.'],
      specs:[['Cask','American oak'],['Finish','First fill Oloroso sherry'],['Age','3 years'],['Bottling','Single barrel']] },
    'beer': { f:'floki', family:'Flóki whisky', name:'Flóki Beer Cask Finish', note:'Icelandic craft beer cask', img:'p-beer', hover:'b-beer',
      copy:['First released in 2019. Matured in American oak and finished in a cask that previously held beer from one of Iceland’s craft breweries.','A single barrel bottling, aged for three years in ex-Flóki Young Malt barrels under the roots of Mount Hekla.'],
      specs:[['Cask','American oak'],['Finish','Icelandic craft beer cask'],['Age','3 years'],['Bottling','Single barrel']] },
    'vor-small': { f:'vor', family:'Vor gin', name:'Vor Gin Small Batch', note:'500 bottles a batch', img:'p-vor-small', hover:'b-vor-small',
      copy:['Made in the style of a 19th-century Icelandic gin: 100% Icelandic barley, infused with herbs and botanicals native to Iceland at the turn of the 20th century, and triple distilled.','Handcrafted in batches of only 500 bottles, rich with Icelandic juniper, rhubarb, kelp and birch.'],
      specs:[['Base','100% Icelandic barley'],['Botanicals','Juniper, rhubarb, kelp, birch'],['Distilled','Three times'],['Batch','500 bottles']] },
    'vor-barrel': { f:'vor', family:'Vor gin', name:'Vor Gin Barrel Aged Reserve', note:'Virgin whisky barrels', img:'p-vor-barrel', hover:'b-vor-barrel',
      copy:['The small batch gin, matured in virgin whisky barrels.','The barrel gives Vor earthy vanilla notes that complement its complex botanical mix.'],
      specs:[['Base','100% Icelandic barley'],['Cask','Virgin whisky barrels'],['Distilled','Three times']] },
    'vor-navy': { f:'vor', family:'Vor gin', name:'Vor Gin Navy Strength Reserve', note:'57% ABV', img:'p-vor-navy', hover:'b-vor-navy',
      copy:['The same 19th-century Icelandic recipe, bottled at navy strength.','At 57% the Icelandic botanicals come through even more intensely.'],
      specs:[['Base','100% Icelandic barley'],['Strength','57% ABV'],['Distilled','Three times']] },
    'viti-aquavit': { f:'viti', family:'Víti brennivín', name:'Víti Icelandic Premium Aquavit', note:'Caraway, triple distilled', img:'p-viti-aquavit', hover:'b-viti-aquavit',
      copy:['Aquavit, called brennivín in Iceland, is the traditional spirit of Iceland, with a dominant flavour of caraway.','Víti is triple distilled in a custom-made small batch still from 100% Icelandic ingredients, so the essential oils of the native botanicals are preserved through distillation.'],
      specs:[['Base','100% Icelandic barley'],['Flavour','Caraway'],['Distilled','Three times, small batch']] },
    'viti-schnapps': { f:'viti', family:'Víti brennivín', name:'Víti Icelandic Schnapps', note:'Angelica and native herbs', img:'p-viti-schnapps', hover:'b-viti-schnapps',
      copy:['Triple distilled and flavoured with caraway seeds, angelica root and other native Icelandic herbs and botanicals.'],
      specs:[['Base','100% Icelandic barley'],['Botanicals','Caraway, angelica, native herbs'],['Distilled','Three times']] },
    'viti-winter': { f:'viti', family:'Víti brennivín', name:'Víti Winter Reserve', note:'Limited, barrel matured', img:'p-viti-winter', hover:'b-viti-winter',
      copy:['A limited edition, matured in virgin whisky barrels in the style of a Scandinavian aquavit.','Triple distilled, flavoured with caraway, angelica root and native Icelandic botanicals.'],
      specs:[['Base','100% Icelandic barley'],['Cask','Virgin whisky barrels'],['Edition','Limited']] }
  };

  (function products() {
    var order = { floki:['single-malt','young-malt','single-malt-dung','young-malt-dung','birch','sherry','beer'], vor:['vor-small','vor-barrel','vor-navy'], viti:['viti-aquavit','viti-schnapps','viti-winter'] };
    function card(id) {
      var p = PRODUCTS[id];
      return '<article class="product-card" data-product="' + id + '" data-modal-open="product" tabindex="0" role="button" aria-haspopup="dialog">' +
        '<div class="product-card__media">' +
        '<img class="product-card__image" src="assets/img/' + p.img + '-800.webp" srcset="assets/img/' + p.img + '-400.webp 400w, assets/img/' + p.img + '-800.webp 800w" sizes="(min-width: 48rem) 22vw, 45vw" alt="' + p.name + ' bottle" width="800" height="1000" loading="lazy">' +
        '<img class="product-card__image product-card__image--secondary" src="assets/img/' + p.hover + '-800.webp" srcset="assets/img/' + p.hover + '-400.webp 400w, assets/img/' + p.hover + '-800.webp 800w" sizes="(min-width: 48rem) 22vw, 45vw" alt="" width="800" height="1000" loading="lazy" aria-hidden="true">' +
        '</div><div class="product-card__info type-small text-black"><div class="product-card__meta"><span>' + p.name + '</span></div><span class="product-card__note">' + p.note + '</span></div></article>';
    }
    document.querySelectorAll('[data-product-grid]').forEach(function (grid) {
      grid.innerHTML = (order[grid.dataset.productGrid] || []).map(card).join('');
    });

    var panel = document.querySelector('[data-panel="product"]');
    if (!panel) return;
    var img = panel.querySelector('[data-product-image]');
    var name = panel.querySelector('[data-product-name]');
    var fam = panel.querySelector('[data-product-family]');
    var copy = panel.querySelector('[data-product-copy]');
    var specs = panel.querySelector('[data-product-specs]');
    var scroller = panel.querySelector('.product__scroll');
    function fill(id) {
      var p = PRODUCTS[id]; if (!p) return;
      img.src = 'assets/img/' + p.img + '-800.webp'; img.alt = p.name + ' bottle';
      name.textContent = p.name; fam.textContent = p.family;
      copy.innerHTML = p.copy.map(function (t) { return '<p>' + t + '</p>'; }).join('');
      specs.innerHTML = p.specs.map(function (r) { return '<div class="product__spec"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
      if (scroller) scroller.scrollTop = 0;
    }
    /* Capture phase, so the panel is filled before the modal opens it. */
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-product]'); if (c) fill(c.getAttribute('data-product'));
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var c = e.target.closest && e.target.closest('[data-product][role="button"]');
      if (c) { e.preventDefault(); c.click(); }
    });
  })();

  /* ================= shift modal (panel + page shove) ================= */
  (function modal() {
    var page = document.getElementById('page');
    var overlay = document.querySelector('[data-overlay]');
    var navbar = document.querySelector('.navbar');
    var openId = null, lastFocus = null, openedAt = 0;

    function panelFor(id) { return document.querySelector('[data-panel="' + id + '"]'); }

    function open(id) {
      if (!id || openId === id) return;
      var panel = panelFor(id);
      if (!panel || !page) return;
      openId = id; lastFocus = document.activeElement; openedAt = performance.now();
      document.body.classList.add('is-modal-open');
      if (overlay) overlay.classList.add('is-active');
      var axis = panel.getAttribute('data-axis') || 'x';
      root.dataset.modal = id; root.dataset.modalAxis = axis;
      if (lenis) lenis.stop();

      var r = panel.getBoundingClientRect();
      var to = axis === 'y' ? { y: r.height } : { x: -r.width };
      var d = reduce ? 0 : UI.PANEL, ez = UI.DRAWER;
      gsap.to(page, Object.assign({}, to, { duration: d, ease: ez }));
      gsap.to(panel, axis === 'y' ? { y: 0, duration: d, ease: ez } : { x: 0, duration: d, ease: ez });
      if (navbar && axis === 'x') gsap.to(navbar, { x: -r.width, duration: d, ease: ez });
      if (overlay) gsap.to(overlay, { opacity: 1, duration: d, ease: ez });
      panel.setAttribute('aria-hidden', 'false');
      var f = panel.querySelector('button, [href], input, [tabindex]');
      if (f) f.focus();
      megaIntro(panel);
      document.dispatchEvent(new CustomEvent('shift-modal:open', { detail: { id: id } }));
    }

    function close() {
      if (!openId || !page) return;
      var closedId = openId;
      var panel = panelFor(openId);
      var axis = (panel && panel.getAttribute('data-axis')) || 'x';
      var d = reduce ? 0 : UI.PANEL, ez = UI.DRAWER;
      openId = null;
      gsap.to(page, {
        x: 0, y: 0, duration: d, ease: ez,
        onComplete: function () {
          document.body.classList.remove('is-modal-open');
          if (lenis) lenis.start();
        }
      });
      if (navbar) gsap.to(navbar, { x: 0, duration: d, ease: ez });
      if (panel) gsap.to(panel, axis === 'y' ? { y: '-100%', duration: d, ease: ez } : { x: '100%', duration: d, ease: ez });
      if (overlay) gsap.to(overlay, {
        opacity: 0, duration: d, ease: ez,
        onComplete: function () { overlay.classList.remove('is-active'); }
      });
      if (panel) panel.setAttribute('aria-hidden', 'true');
      if (lastFocus) lastFocus.focus();
      delete root.dataset.modal; delete root.dataset.modalAxis;
      document.dispatchEvent(new CustomEvent('shift-modal:close', { detail: { id: closedId } }));
    }

    /* mega intro: bar wipes L to R, nav wipes top down, lines scaleY,
       split lines rise. Delayed by DELAY_INTRO behind the shove. */
    function megaIntro(panel) {
      if (reduce || !panel.classList.contains('mega')) return;
      var bar = panel.querySelector('.mega__bar');
      var grid = panel.querySelector('[data-mega-grid]');
      var lines = panel.querySelectorAll('[data-mega-line]');
      var splits = panel.querySelectorAll('[data-mega-split]');
      var links = panel.querySelectorAll('[data-mega-link]');
      gsap.set(links, { pointerEvents: 'none' });
      var tl = gsap.timeline({
        delay: DELAY_INTRO,
        defaults: { ease: EASE.LUXE, duration: DUR.DEFAULT },
        onComplete: function () { gsap.set(links, { pointerEvents: 'auto' }); }
      });
      if (bar) tl.fromTo(bar, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }, 0);
      if (grid) tl.fromTo(grid, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }, 0);
      if (lines.length) tl.fromTo(lines, { scaleY: 0 }, { scaleY: 1 }, 0);
      if (splits.length) tl.from(splits, { yPercent: 100, opacity: 0, stagger: STAG.MICRO }, 0);
    }

    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-modal-open]');
      if (o) { e.preventDefault(); open(o.getAttribute('data-modal-open')); return; }
      if (e.target.closest('[data-modal-close]')) { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    if (overlay) overlay.addEventListener('click', close);

    /* Desktop wheel closes the mega panel, as the reference does, but only on a
       deliberate scroll. Opening the panel right after scrolling used to have
       leftover trackpad inertia close it again on the same gesture. */
    window.addEventListener('wheel', function (e) {
      if (!openId) return;
      if (performance.now() - openedAt < 350) return;
      if (Math.abs(e.deltaY) < 4) return;
      if (window.matchMedia('(min-width: 64rem)').matches) close();
    }, { passive: true });
  })();

  /* ================= scroll reveals ================= */
  if (!reduce) {
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el, { autoAlpha: 0, y: toPx(DIST.Y) }, {
        autoAlpha: 1, y: 0, duration: DUR.DEFAULT, ease: EASE.LUXE,
        scrollTrigger: { trigger: el, start: TRIG_START, once: true }
      });
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function (n) { n.style.opacity = 1; });
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
