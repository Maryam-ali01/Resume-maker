/* ==========================================================================
   INKFOLIO — shared behaviours (nav, custom cursor, stamp reveal)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }

  /* ---------- custom ink-nib cursor ---------- */
  // Only active on a real mouse + wide screen. Re-evaluates on resize, so the
  // native cursor is never left hidden without the custom one on screen.
  const root = document.documentElement;
  const cursorMQ = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px)');
  const NATIVE_SEL  = 'input:not([type="color"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select';
  const POINTER_SEL = 'a, button, [role="button"], .swatch, .photo-drop, input[type="color"], input[type="file"], summary';

  let cursorEl = null, dotEl = null, rafId = 0;
  let mx = 0, my = 0, dx = 0, dy = 0, seen = false;
  const handlers = [];

  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    handlers.push(() => target.removeEventListener(type, fn, opts));
  }

  function enableCursor() {
    if (cursorEl) return;
    cursorEl = document.createElement('div');
    cursorEl.id = 'ink-cursor';
    cursorEl.innerHTML = `<svg viewBox="0 0 26 26" width="26" height="26">
      <path d="M4 22 L18 3 C19.5 1 22.5 4 20.5 5.5 L4 22 Z" fill="#1B2A4A" stroke="#FBF8F1" stroke-width="0.6"/>
      <circle cx="5.5" cy="20.5" r="1.6" fill="#C08A2E"/>
    </svg>`;
    dotEl = document.createElement('div');
    dotEl.id = 'ink-cursor-dot';
    // appended to <html> (not <body>) so the page-load animation can't offset them
    root.append(cursorEl, dotEl);
    root.classList.add('has-ink-cursor');

    on(window, 'mousemove', e => {
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; dx = mx; dy = my; root.classList.add('ink-visible'); }
      cursorEl.style.transform = `translate3d(${mx}px, ${my}px, 0)`;

      if (Math.random() > 0.75) {
        const trail = document.createElement('div');
        trail.className = 'ink-trail-dot';
        trail.style.left = (mx + (Math.random() * 8 - 4)) + 'px';
        trail.style.top  = (my + (Math.random() * 8 - 4)) + 'px';
        root.appendChild(trail);
        setTimeout(() => trail.remove(), 650);
      }
    }, { passive: true });

    // hover states by delegation — also works for elements added later
    // (skill tags, new experience rows, scroll-to-top button …)
    on(document, 'mouseover', e => {
      const t = e.target instanceof Element ? e.target : null;
      root.classList.toggle('ink-native',  !!(t && t.closest(NATIVE_SEL)));
      root.classList.toggle('ink-pointer', !!(t && t.closest(POINTER_SEL)));
    });
    on(document, 'mouseleave', () => root.classList.remove('ink-visible'));
    on(document, 'mouseenter', () => { if (seen) root.classList.add('ink-visible'); });
    on(document, 'mousedown', () => root.classList.add('ink-down'));
    on(document, 'mouseup',   () => root.classList.remove('ink-down'));

    (function loop() {
      dx += (mx - dx) * 0.22;
      dy += (my - dy) * 0.22;
      dotEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      rafId = requestAnimationFrame(loop);
    })();
  }

  function disableCursor() {
    if (!cursorEl) return;
    cancelAnimationFrame(rafId);
    handlers.splice(0).forEach(off => off());
    cursorEl.remove(); dotEl.remove();
    cursorEl = dotEl = null; seen = false;
    root.classList.remove('has-ink-cursor', 'ink-visible', 'ink-native', 'ink-pointer', 'ink-down');
  }

  const syncCursor = () => (cursorMQ.matches ? enableCursor() : disableCursor());
  syncCursor();
  cursorMQ.addEventListener ? cursorMQ.addEventListener('change', syncCursor) : cursorMQ.addListener(syncCursor);

  /* ---------- hero stamp reveal ---------- */
  const stamp = document.querySelector('.stamp');
  if (stamp) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setTimeout(() => stamp.classList.add('stamped'), 450);
          obs.disconnect();
        }
      });
    }, { threshold: 0.4 });
    obs.observe(stamp);
  }

  /* ---------- scroll-reveal for sections/cards ---------- */
  const revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
  if (revealTargets.length) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    revealTargets.forEach(el => revealObs.observe(el));
  }

  /* ---------- button ripple micro-interaction ---------- */
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  /* ---------- scroll-to-top button ---------- */
  const toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Back to top');
  toTop.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M8 3L3 8M8 3l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(toTop);
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 480);
  });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});
