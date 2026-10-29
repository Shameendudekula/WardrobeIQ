/* WardrobeIQ — shared UI behaviours (nav, reveal, toasts, tilt, counters) */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Nav: solid background once the page scrolls */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Mobile menu */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    const setOpen = (open) => {
      hamburger.setAttribute('aria-expanded', String(open));
      mobileMenu.classList.toggle('open', open);
      mobileMenu.setAttribute('aria-hidden', String(!open));
    };
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(hamburger.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav')) setOpen(false);
    });
    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  }

  /* Scroll reveal: elements with [data-reveal]; children of [data-stagger] get incremental delays */
  document.querySelectorAll('[data-stagger]').forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty('--i', i));
  });
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  const observeReveals = (root = document) => {
    root.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => revealObserver.observe(el));
  };
  observeReveals();

  /* 3D tilt on hover for [data-tilt] (pointer devices only) */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const bindTilt = (root = document) => {
    if (!canHover || reduceMotion) return;
    root.querySelectorAll('[data-tilt]:not([data-tilt-bound])').forEach((el) => {
      el.setAttribute('data-tilt-bound', '');
      const max = Number(el.dataset.tilt) || 8;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-4px)`;
        el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
        el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  };
  bindTilt();

  /* Animated number counters */
  const animateCount = (el, to, duration = 900) => {
    const from = Number(el.dataset.current || 0);
    el.dataset.current = to;
    if (reduceMotion || from === to) { el.textContent = to; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* Toast notifications */
  let stack;
  const ICONS = { success: '✓', error: '!', info: 'i' };
  const toast = (message, type = 'info', timeout = 3200) => {
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${ICONS[type] || ICONS.info}</span><span></span>`;
    el.lastChild.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, timeout);
  };

  /* Authenticated JSON API calls. Throws Error with .code/.status from the API's { code, message } body. */
  const api = async (url, { method = 'GET', body } = {}) => {
    const token = localStorage.getItem('token');
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body && !isForm ? JSON.stringify(body) : body,
      });
    } catch {
      throw Object.assign(new Error('Network error — check your connection and try again.'), { code: 'NETWORK_ERROR' });
    }
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw Object.assign(new Error('Please log in again.'), { code: 'UNAUTHORIZED', status: 401 });
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || `Request failed (${res.status})`), { code: data.code, status: res.status });
    return data;
  };

  /* Decode the (unverified) JWT payload for display purposes only */
  const currentUser = () => {
    try {
      const p = JSON.parse(atob(localStorage.getItem('token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (p.exp && p.exp * 1000 < Date.now()) return null;
      return p;
    } catch { return null; }
  };

  window.WIQ = { toast, observeReveals, bindTilt, animateCount, reduceMotion, api, currentUser };
})();
