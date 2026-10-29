/* WardrobeIQ — landing page: hero parallax */
(() => {
  const visual = document.getElementById('heroVisual');
  if (!visual) return;

  // Switch from intro animations to idle floating once the intro has played
  setTimeout(() => visual.classList.add('ready'), 2300);

  if (WIQ.reduceMotion || !window.matchMedia('(hover: hover)').matches) return;

  const layers = [...visual.querySelectorAll('[data-depth]')];
  let raf = null;
  window.addEventListener('pointermove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      layers.forEach((el) => {
        const d = Number(el.dataset.depth);
        el.style.translate = `${(-x * d).toFixed(1)}px ${(-y * d).toFixed(1)}px`;
      });
    });
  });
})();
