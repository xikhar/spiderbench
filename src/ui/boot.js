// Boot loading screen (#boot: static markup in index.html, so it paints before any module has loaded). It shows the real
// load progress while the city builds, the character loads and the shaders link, and fades out after the first frame.
//   bootStage(text)           the stage label ('Building the city', ...)
//   bootProgress(step, f = 1) step `step` is f (0..1) done -> Promise|undefined: await it between long synchronous steps
//                             (it waits for a paint at most every ~100 ms, never in a background tab)
//   bootDone(instant?)        100 %: fade out and remove (instant: remove now, e.g. for ?shot= screenshots)
// Each step's share of the bar is when it finished on this browser's previous load (localStorage), or on a reference
// load (DEFAULT_PROFILE) the first time. The bar only moves when a step reports; a step the profile does not know yet
// (new code) holds the bar until the next known one, and the next load learns it.
const el = document.getElementById('boot');
const label = el?.querySelector('.ld span'), bar = el?.querySelector('.line i'), pct = el?.querySelector('.ld b');
const KEY = 'spidey.bootProfile';

// finish time of each step / time to the first frame, measured (Apple-silicon Mac, Chromium, local dev server)
const DEFAULT_PROFILE = {
  start: 0.017, 'city:tex': 0.036, 'city:gen': 0.205, 'city:landmarks': 0.254, 'city:roofs': 0.439,
  'city:signs': 0.455, 'city:tiles': 0.485, 'city:ground': 0.548, 'city:far': 0.571, 'city:bridges': 0.574,
  'city:hinterland': 0.584, 'city:vehicles': 0.587, 'city:highways': 0.587, 'city:props': 0.625,
  'city:treespots': 0.63, 'city:trees': 0.66, 'city:traffic': 0.666, 'city:life': 0.674, 'city:fit': 0.761,
  'city:trunks': 0.762, 'city:grid': 0.764, 'city:coll': 0.807, player: 0.825, pipeline: 0.825, shaders: 0.845,
  textures: 0.927,
};
let profile = DEFAULT_PROFILE;
try { const p = JSON.parse(localStorage.getItem(KEY)); if (p && typeof p === 'object') profile = p; } catch {}
const times = {};
let base = 0, shown = 0, painted = 0;

function show(f) {
  if (f <= shown || !bar) return;
  shown = f;
  bar.style.transform = `scaleX(${f})`;
  bar.parentElement.setAttribute('aria-valuenow', Math.floor(f * 100));
  if (pct) pct.textContent = Math.floor(f * 100) + '%';
}

function paint() {
  if (document.hidden || performance.now() - painted < 100) return; // rAF does not run in a background tab
  return new Promise(r => requestAnimationFrame(() => { painted = performance.now(); setTimeout(r); })); // rAF: before the paint, the timeout: after it
}

export function bootStage(text) {
  if (label && !el.classList.contains('err')) label.textContent = text; // keep a start-up error on screen
}

export function bootProgress(step, f = 1) {
  const end = profile[step];
  if (end !== undefined) { show(base + (end - base) * f); if (f >= 1) base = Math.max(base, end); }
  if (f >= 1) times[step] = performance.now(); // performance.now() counts from the navigation: module loading included
  return paint();
}

export function bootDone(instant = false) {
  if (!el?.isConnected || el.classList.contains('done')) return;
  if (instant) { el.remove(); return; }
  const total = performance.now(), learned = {};
  for (const k in times) learned[k] = +(times[k] / total).toFixed(4);
  try { localStorage.setItem(KEY, JSON.stringify(learned)); } catch {}
  show(1);
  el.classList.add('done');
  el.addEventListener('transitionend', e => { if (e.target === el) el.remove(); });
}
