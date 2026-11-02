// OWNER: systems engineer. Persistent progress (localStorage). One JSON blob, debounced writes.
// In automated runs (?playtest=1 / ?shot=) the save is in-memory only (fresh every run) unless ?save=1,
// so scenarios stay deterministic and never clobber a player's real save. ?newgame wipes the stored save.
const KEY = 'spiderbench.save.v1';
const OLD_KEYS = ['spidey.save.v1']; // saves from before the project was renamed (Spidey -> Spiderbench) are carried over once

export const DEFAULT_SETTINGS = {
  quality: 'high', renderScale: 1, fpsLimit: 'auto', mouseSensitivity: 1, invertY: false,
  // (user r-mixdefaults) the user's tuned mix (80 / 4 / 16 / 10 / 6 %) is baked into audio.js TRIM: it is now 100 / 70 / 70 / 70 / 70
  masterVolume: 1, musicVolume: 0.7, sfxVolume: 0.7, ambienceVolume: 0.7, uiVolume: 0.7,
  audioV: 3, // settings older than 3 used the old volume scale: the audio sliders are reset to these defaults once on load
  showPins: true, minimalHud: false, subtitles: true, fovOffset: 0, motionBlur: 1, dof: 1, hudScale: 1, subtitleSize: 1,
  timeOfDay: 'day', // (lighting2 r3) fixed preset: day | morning | sunrise | sunset | dusk | night | overcast
  puddles: true, // (user r-nopuddles) water / wet patches on the ground in dry weather (rain always wets the streets)
  daySun: 'a', // (user r-daysun) Day preset sun direction: a (midday, SSW) | b (late morning, SE) | c (afternoon, WSW)
};

export function defaultState() {
  return {
    v: 1, xp: 0, level: 1, skillPoints: 1, skills: [], suit: 'advanced', suitsUnlocked: ['advanced', 'symbiote'],
    towers: [], stations: [], backpacks: [], landmarks: [], secretPhotos: [], photoThumbs: {},
    crimes: { stopped: 0, byType: {}, byDistrict: {} },
    waypoint: null, player: null, playTime: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createSave() {
  const q = new URLSearchParams(location.search);
  const persistent = (!q.has('playtest') && !q.has('shot')) || q.has('save');
  let state = defaultState();
  if (q.has('newgame')) { try { localStorage.removeItem(KEY); } catch {} }
  if (persistent) {
    try {
      if (localStorage.getItem(KEY) == null) for (const k of OLD_KEYS) { const o = localStorage.getItem(k); if (o != null) { localStorage.setItem(KEY, o); localStorage.removeItem(k); break; } }
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 1) state = { ...defaultState(), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) }, crimes: { ...defaultState().crimes, ...(s.crimes || {}) } };
        if (!(s.settings?.audioV >= 3)) { // old volume scale -> the new defaults (= the mix tuned on the old scale)
          for (const k of ['masterVolume', 'musicVolume', 'sfxVolume', 'ambienceVolume', 'uiVolume', 'musicV']) delete state.settings[k];
          Object.assign(state.settings, { masterVolume: 1, musicVolume: 0.7, sfxVolume: 0.7, ambienceVolume: 0.7, uiVolume: 0.7, audioV: 3 });
        }
      }
    } catch (e) { console.warn('[save] could not read save, starting fresh', e); }
  }
  let timer = 0;
  function writeNow() {
    timer = 0;
    if (!persistent) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {
      // quota: drop thumbnails first
      try { state.photoThumbs = {}; localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    }
  }
  return {
    get state() { return state; },
    persistent,
    markDirty(delay = 800) { if (!timer) timer = setTimeout(writeNow, delay); },
    flush() { if (timer) clearTimeout(timer); writeNow(); },
    reset() { const keepSettings = state.settings; state = defaultState(); state.settings = keepSettings; writeNow(); },
  };
}
