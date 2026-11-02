// OWNER: combat engineer. Combat pose overlay for Spider-Man.
// The animation layer (src/player/anim/animator.js, owned by the animation agent) writes the skeleton every frame inside
// player.update(). Its one-shot overlay has no cross-fade between successive one-shots (combo chains would pop), so combat
// runs its own small clip stack on top: after player.update() it reads the animator's pose, blends a stack of combat clip
// tracks over it (each new track cross-fades in over the previous ones, optional upper-body mask) and writes it back.
// Clips are sampled through the animator's ClipLib (hips XZ locked: the combat module moves the capsule itself).
import { Pose, blendPoses } from '../../player/anim/skeleton.js';
import { clamp, smooth } from './util.js';

export class PoseLayer {
  constructor(rig) {
    this.rig = rig; this.tracks = []; this.ok = false;
  }
  init() {
    const an = this.rig.animator;
    if (!an || !an.skel || !an.clips) return false;
    if (this.an === an) return true;
    this.an = an; this.skel = an.skel; this.clips = an.clips; const N = this.skel.N;
    this.base = new Pose(N); this.tmp = new Pose(N); this.out = new Pose(N);
    this.masks = { upper: an.maskFor?.('upper') || null, arms: an.maskFor?.('arms') || null };
    this.ok = true; return true;
  }
  has(name) { return this.init() && this.clips.has(name); }
  dur(name) { return this.init() ? this.clips.dur(name) : 0; }
  // play a clip segment: from/until in clip seconds; hold = freeze at `until` (or the end) instead of finishing
  play(name, { from = 0, until = null, ts = 1, fade = 0.08, mask = null, hold = true, id = null } = {}) {
    if (!this.has(name)) return null;
    const tr = { name, t: from, ts, until: until ?? this.clips.dur(name), fade, w: fade <= 0 ? 1 : 0, out: 0, fadeOut: 0.2, mask: mask ? this.masks[mask] : null, hold, id: id || name, dead: false };
    // full-body tracks cross-fade over whatever is below (buried tracks are dropped once covered);
    // masked tracks replace older tracks with the same id
    if (mask) for (const o of this.tracks) if (o.id === tr.id && !o.out) { o.out = 1e-6; o.fadeOut = Math.max(fade, 0.05); }
    this.tracks.push(tr);
    return tr;
  }
  stop(fadeOut = 0.22) { for (const t of this.tracks) if (!t.out) { t.out = 1e-6; t.fadeOut = fadeOut; } }
  stopId(id, fadeOut = 0.2) { for (const t of this.tracks) if (t.id === id && !t.out) { t.out = 1e-6; t.fadeOut = fadeOut; } }
  get active() { return this.tracks.length > 0; }
  top() { return this.tracks[this.tracks.length - 1] || null; }
  apply(dt) {
    if (!this.tracks.length || !this.init()) return;
    for (const t of this.tracks) {
      t.t = Math.min(t.until, t.t + dt * t.ts);
      t.w = Math.min(1, t.w + dt / Math.max(1e-3, t.fade));
      if (t.out) t.out += dt / Math.max(1e-3, t.fadeOut);
      if (!t.hold && t.t >= t.until && !t.out) t.out = 1e-6;
      if (t.out >= 1) t.dead = true;
    }
    let cover = -1; for (let i = this.tracks.length - 1; i >= 0; i--) { const t = this.tracks[i]; if (!t.mask && t.w >= 1 && !t.out) { cover = i; break; } }
    this.tracks = this.tracks.filter((t, i) => !t.dead && (cover < 0 || i >= cover || t.mask));
    if (!this.tracks.length) return;
    this.skel.read(this.base);
    this.out.copy(this.base);
    for (const t of this.tracks) {
      const env = smooth(t.w) * (1 - smooth(t.out));
      if (env < 0.001) continue;
      this.clips.sample(t.name, t.t, this.tmp, { loop: false, lock: 'xz' });
      blendPoses(this.out, this.tmp, env, this.out, t.mask);
    }
    this.skel.apply(this.out);
    this.rig.object.updateMatrixWorld(true);
  }
}
