// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}

// Fade-in Animation on Scroll
const fadeElements = document.querySelectorAll('.fade-in');

window.addEventListener('scroll', () => {
  fadeElements.forEach(el => {
    const position = el.getBoundingClientRect().top;
    const screenPos = window.innerHeight / 1.3;
    if (position < screenPos) {
      el.classList.add('visible');
    }
  });
});
