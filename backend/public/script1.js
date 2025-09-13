/* NAV: hamburger open/close */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mainNav = document.getElementById('mainNav');

hamburger.addEventListener('click', () => {
  const expanded = hamburger.getAttribute('aria-expanded') === 'true';
  hamburger.setAttribute('aria-expanded', String(!expanded));
  mobileMenu.style.display = expanded ? 'none' : 'block';
  mobileMenu.setAttribute('aria-hidden', String(expanded));
});

/* Click outside to close mobile menu */
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-inner') && mobileMenu.style.display === 'block') {
    mobileMenu.style.display = 'none';
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.setAttribute('aria-hidden', 'true');
  }
});

/* Intersection Observer for animated reveal */
const observerOptions = { root: null, rootMargin: '0px', threshold: 0.12 };
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
      // optional: unobserve after reveal to improve perf
      revealObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

/* attach to elements */
document.querySelectorAll('.fade-up').forEach(el => revealObserver.observe(el));
document.querySelectorAll('.feature-card').forEach(el => revealObserver.observe(el));
document.querySelectorAll('.post-card').forEach(el => revealObserver.observe(el));

/* add small parallax on hero (mouse move) for desktop */
const hero = document.querySelector('.hero');
if (hero) {
  hero.addEventListener('mousemove', (e) => {
    if (window.innerWidth < 880) return;
    const x = (e.clientX - window.innerWidth / 2) / 40;
    const y = (e.clientY - window.innerHeight / 2) / 40;
    hero.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
  hero.addEventListener('mouseleave', () => hero.style.transform = 'none');
}

/* CTA subtle micro-interaction */
document.querySelectorAll('.btn-primary').forEach(btn => {
  btn.addEventListener('mouseenter', () => btn.animate([
    { transform: 'translateY(0)' },
    { transform: 'translateY(-6px)' },
    { transform: 'translateY(0)' }
  ], { duration: 380, iterations: 1 }));
});
