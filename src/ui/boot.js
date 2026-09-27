// Boot loading screen (#boot: static markup in index.html, so it paints before any module has loaded). It covers the
// black canvas while the city builds, the character loads and the shaders link, and fades out after the first frame.
//   bootStage(text) -> Promise   resolves once the new label is painted: await it before long synchronous work
//   bootDone(instant?)           fade out and remove (instant: remove now, e.g. for ?shot= screenshots)
const el = document.getElementById('boot');
const label = el?.querySelector('.ld span');

export function bootStage(text) {
  if (label && !el.classList.contains('err')) label.textContent = text; // keep a start-up error on screen
  return new Promise(r => requestAnimationFrame(() => setTimeout(r))); // rAF runs before the paint, the timeout after it
}

export function bootDone(instant = false) {
  if (!el?.isConnected || el.classList.contains('done')) return;
  if (instant) { el.remove(); return; }
  el.classList.add('done');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
}
