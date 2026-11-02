// OWNER: systems engineer. Inline SVG icon set (32x32 viewBox, line style) + badge wrappers + canvas images.
const P = {
  tower:
    '<path d="M16 29 L11 29 L14.2 12 M16 29 L21 29 L17.8 12 M12.6 21 L19.4 21 M13.4 16.5 L18.6 16.5 M13 21 L19 16.5 M19 21 L13 16.5"/><circle cx="16" cy="9.5" r="2" fill="currentColor"/><path d="M10.5 5.5 A7.5 7.5 0 0 0 10.5 13.5 M21.5 5.5 A7.5 7.5 0 0 1 21.5 13.5 M8 3 A11 11 0 0 0 8 16 M24 3 A11 11 0 0 1 24 16"/>',
  backpack:
    '<path d="M10 12 Q10 7 16 7 Q22 7 22 12 L22 26 Q22 27.5 20.5 27.5 L11.5 27.5 Q10 27.5 10 26 Z"/><path d="M13 7.5 L13 5 Q13 4 14 4 L18 4 Q19 4 19 5 L19 7.5"/><path d="M12.5 17 L19.5 17 L19.5 23.5 L12.5 23.5 Z"/><path d="M12.5 19.5 L19.5 19.5"/>',
  landmark:
    '<path d="M9 28 L9 12 L16 6 L23 12 L23 28 M5 28 L27 28 M12.5 28 L12.5 21 L19.5 21 L19.5 28 M13 15 L19 15"/><path d="M16 3.5 L16 6"/>',
  camera:
    '<path d="M5 11 L10 11 L12 8 L20 8 L22 11 L27 11 L27 24 L5 24 Z"/><circle cx="16" cy="17" r="4.5"/><circle cx="16" cy="17" r="1.5" fill="currentColor"/>',
  photo:
    '<path d="M7 5 L25 5 L25 27 L7 27 Z"/><path d="M9.5 7.5 L22.5 7.5 L22.5 20.5 L9.5 20.5 Z"/><path d="M9.5 18 L14 13.5 L17 16.5 L19 14.5 L22.5 18"/>',
  station:
    '<rect x="8" y="5" width="16" height="18" rx="4"/><path d="M8 14 L24 14 M12 23 L9.5 28 M20 23 L22.5 28 M11 18.5 L11.1 18.5 M21 18.5 L21.1 18.5 M13 8.5 L19 8.5"/>',
  crime:
    '<path d="M16 4 L28.5 26 L3.5 26 Z"/><path d="M16 12 L16 19"/><circle cx="16" cy="22.5" r="1.2" fill="currentColor"/>',
  chase:
    '<path d="M4 20 L6 14 Q7 12 9 12 L21 12 Q23 12 24.5 14 L27 18 L28 20 L28 23 L4 23 Z"/><circle cx="9.5" cy="23.5" r="2.3"/><circle cx="22.5" cy="23.5" r="2.3"/><path d="M10 12 L12 8 L19 8 L21.5 12"/><path d="M1 15 L3.5 15 M0.5 18.5 L3 18.5"/>',
  alarm:
    '<path d="M9 22 L9 15 A7 7 0 0 1 23 15 L23 22 Z"/><path d="M6 25 L26 25 M16 3 L16 5.5 M6 7 L8 9 M26 7 L24 9 M3 14 L5.5 14 M29 14 L26.5 14"/>',
  mugging:
    '<circle cx="12" cy="8" r="3"/><path d="M12 11 L11 19 L7 27 M11 19 L15 27 M12 13 L17 16 M12 13 L7 16"/><path d="M20 12 L27 12 L27 20 L20 20 Z M22 12 L22 10 L25 10 L25 12"/>',
  waypoint:
    '<path d="M16 3 L29 16 L16 29 L3 16 Z"/><path d="M16 9 L23 16 L16 23 L9 16 Z" fill="currentColor"/>',
  check: '<path d="M6 16.5 L13 23.5 L26.5 9" stroke-width="3.2"/>',
  lock: '<rect x="8" y="14" width="16" height="13" rx="1.5"/><path d="M11 14 L11 10 A5 5 0 0 1 21 10 L21 14"/>',
  swing:
    '<path d="M26 3 L13 17"/><circle cx="12" cy="19" r="2.6" fill="currentColor"/><path d="M4 27 Q9 29 15 25 M4 22 Q7 25 10 23"/>',
  reach:
    '<path d="M4 28 L26 6"/><path d="M19 6 L26 6 L26 13"/><circle cx="4.5" cy="27.5" r="2"/><path d="M12 4 L12.5 4 M6 10 L6.5 10"/>',
  zip: '<path d="M4 26 L22 8"/><path d="M15 8 L22 8 L22 15"/><path d="M24 3 L29 3 M27 1 L27 6 M4 17 L9 17 M12 26 L17 26"/>',
  jump: '<path d="M16 28 L16 6"/><path d="M9 13 L16 6 L23 13"/><path d="M7 28 L25 28"/><path d="M10 21 L16 15 L22 21"/>',
  wall: '<path d="M22 3 L22 29"/><path d="M22 7 L27 7 M22 13 L27 13 M22 19 L27 19 M22 25 L27 25"/><path d="M6 26 Q12 22 15 12 Q16.5 7 18 5"/><path d="M14 5 L18 5 L18.5 9"/>',
  trick:
    '<path d="M16 5 A11 11 0 1 1 5.5 12.5"/><path d="M4 7 L5.5 12.5 L11 11"/><circle cx="16" cy="16" r="2.5" fill="currentColor"/>',
  dive: '<path d="M16 3 L16 25"/><path d="M9 18 L16 25 L23 18"/><path d="M6 29 L26 29 M10 8 L10 13 M22 8 L22 13"/>',
  land: '<path d="M4 27 L28 27"/><path d="M9 27 L12 18 L16 21 L20 18 L23 27"/><circle cx="16" cy="12" r="3"/><path d="M5 23 L7 21 M27 23 L25 21"/>',
  scanner:
    '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><path d="M16 16 L24 8"/><circle cx="20" cy="19" r="1.3" fill="currentColor"/>',
  xp: '<path d="M16 3 L19.5 11.5 L28.5 12.3 L21.6 18.2 L23.7 27 L16 22.3 L8.3 27 L10.4 18.2 L3.5 12.3 L12.5 11.5 Z"/>',
  gps: '<path d="M16 29 Q7 18 7 12.5 A9 9 0 0 1 25 12.5 Q25 18 16 29 Z"/><circle cx="16" cy="12.5" r="3.2"/>',
  spider:
    '<g fill="currentColor" stroke="none"><ellipse cx="16" cy="11.5" rx="2.6" ry="3.4"/><ellipse cx="16" cy="19.5" rx="3.2" ry="5.2"/></g><path d="M13.6 10 L8 4.5 L6.5 9 M18.4 10 L24 4.5 L25.5 9 M13.5 12.6 L5 11 L3 17 M18.5 12.6 L27 11 L29 17 M13.2 18 L6 21 L6 28 M18.8 18 L26 21 L26 28 M14 22.5 L10.5 29 M18 22.5 L21.5 29" stroke-width="1.6"/>',
  map: '<path d="M4 7 L12 4 L20 7 L28 4 L28 25 L20 28 L12 25 L4 28 Z M12 4 L12 25 M20 7 L20 28"/>',
  suit: '<path d="M16 3 Q9 3 9 11 Q9 16 12 18 L10 29 L22 29 L20 18 Q23 16 23 11 Q23 3 16 3 Z"/><path d="M11 9 Q13 12 15 10.5 Q13.5 8 11 9 Z M21 9 Q19 12 17 10.5 Q18.5 8 21 9 Z" fill="currentColor"/>',
  gear: '<circle cx="16" cy="16" r="4.5"/><path d="M16 3 L16 7 M16 25 L16 29 M3 16 L7 16 M25 16 L29 16 M6.8 6.8 L9.6 9.6 M22.4 22.4 L25.2 25.2 M6.8 25.2 L9.6 22.4 M22.4 9.6 L25.2 6.8"/>',
  player: '<path d="M16 3 L26 27 L16 21 L6 27 Z" fill="currentColor"/>',
};
export const ICON_NAMES = Object.keys(P);

export function icon(name, { color = "currentColor", sw = 2 } = {}) {
  return `<svg viewBox="0 0 32 32" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${P[name] || ""}</svg>`;
}

// Insomniac-style map badge: coloured shape with a white glyph
export const BADGE = {
  tower: { shape: "hex", fill: "#e3262f", glyph: "tower" },
  towerDone: { shape: "hex", fill: "#2a6fd6", glyph: "tower" },
  backpack: { shape: "circle", fill: "#f07a22", glyph: "backpack" },
  landmark: { shape: "circle", fill: "#2eb5a3", glyph: "landmark" },
  photo: { shape: "circle", fill: "#a860d8", glyph: "photo" },
  station: { shape: "square", fill: "#1f9a57", glyph: "station" },
  stationLocked: { shape: "square", fill: "#4b5570", glyph: "station" },
  crime: { shape: "diamond", fill: "#e3262f", glyph: "crime" },
  chase: { shape: "diamond", fill: "#e3262f", glyph: "chase" },
  alarm: { shape: "diamond", fill: "#e3262f", glyph: "alarm" },
  mugging: { shape: "diamond", fill: "#e3262f", glyph: "mugging" },
  waypoint: { shape: "none", fill: "#f5b82e", glyph: "waypoint" },
  done: { shape: "circle", fill: "#39425c", glyph: "check" },
};
export function badge(kind, size = 34) {
  const b = BADGE[kind] || BADGE.done;
  const shape = {
    hex: '<path d="M16 1.5 L29 9 L29 23 L16 30.5 L3 23 L3 9 Z"/>',
    circle: '<circle cx="16" cy="16" r="14"/>',
    square: '<rect x="2.5" y="2.5" width="27" height="27" rx="5"/>',
    diamond: '<path d="M16 1 L31 16 L16 31 L1 16 Z"/>',
    none: "",
  }[b.shape];
  const glyph =
    b.shape === "none"
      ? `<g stroke="${b.fill}" stroke-width="2.2" fill="none" style="color:${b.fill}">${P[b.glyph]}</g>`
      : `<g transform="translate(6.4 6.4) scale(.6)" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color:#fff">${P[b.glyph]}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><g fill="${b.fill}" stroke="rgba(255,255,255,.9)" stroke-width="1.6">${shape}</g>${glyph}</svg>`;
}
const imgCache = new Map();
export function badgeImage(kind, size = 64) {
  const k = kind + size;
  if (imgCache.has(k)) return imgCache.get(k);
  const im = new Image();
  im.src =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(badge(kind, size));
  imgCache.set(k, im);
  return im;
}
