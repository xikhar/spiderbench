/**
 * Combat pose layering.
 *
 * @module src-game-combat-poselayer
 * @version 1.0.0
 * @file src/game/combat/poselayer.ts
 * @since 0.0.1
 * @description Blends combat pose overrides on top of traversal and animation output.
 */

import { Pose, blendPoses } from "@/player/anim/skeleton";
import { smooth } from "./util";

type MaskName = "upper" | "arms" | null;

interface PlayOpts {
    from?: number;
    until?: number | null;
    ts?: number;
    fade?: number;
    mask?: MaskName;
    hold?: boolean;
    id?: string | null;
}

interface Track {
    name: string;
    t: number;
    ts: number;
    until: number;
    fade: number;
    w: number;
    out: number;
    fadeOut: number;
    mask: any;
    hold: boolean;
    id: string;
    dead: boolean;
}

export class PoseLayer {
    rig: any;
    tracks: Track[] = [];
    ok = false;
    an: any;
    skel: any;
    clips: any;
    base: any;
    tmp: any;
    out: any;
    masks: { upper: any; arms: any } = { upper: null, arms: null };

    constructor(rig: any) {
        this.rig = rig;
    }

    init(): boolean {
        const an = this.rig.animator;
        if (!an || !an.skel || !an.clips) return false;
        if (this.an === an) return true;
        this.an = an;
        this.skel = an.skel;
        this.clips = an.clips;
        const N = this.skel.N;
        this.base = new Pose(N);
        this.tmp = new Pose(N);
        this.out = new Pose(N);
        this.masks = {
            upper: an.maskFor?.("upper") || null,
            arms: an.maskFor?.("arms") || null,
        };
        this.ok = true;
        return true;
    }

    has(name: string): boolean {
        return this.init() && this.clips.has(name);
    }

    dur(name: string): number {
        return this.init() ? this.clips.dur(name) : 0;
    }

    play(
        name: string,
        {
            from = 0,
            until = null,
            ts = 1,
            fade = 0.08,
            mask = null,
            hold = true,
            id = null,
        }: PlayOpts = {},
    ): Track | null {
        if (!this.has(name)) return null;
        const tr: Track = {
            name,
            t: from,
            ts,
            until: until ?? this.clips.dur(name),
            fade,
            w: fade <= 0 ? 1 : 0,
            out: 0,
            fadeOut: 0.2,
            mask: mask ? this.masks[mask] : null,
            hold,
            id: id || name,
            dead: false,
        };

        if (mask)
            for (const o of this.tracks)
                if (o.id === tr.id && !o.out) {
                    o.out = 1e-6;
                    o.fadeOut = Math.max(fade, 0.05);
                }
        this.tracks.push(tr);
        return tr;
    }

    stop(fadeOut = 0.22): void {
        for (const t of this.tracks)
            if (!t.out) {
                t.out = 1e-6;
                t.fadeOut = fadeOut;
            }
    }

    stopId(id: string, fadeOut = 0.2): void {
        for (const t of this.tracks)
            if (t.id === id && !t.out) {
                t.out = 1e-6;
                t.fadeOut = fadeOut;
            }
    }

    get active(): boolean {
        return this.tracks.length > 0;
    }

    top(): Track | null {
        return this.tracks[this.tracks.length - 1] || null;
    }

    apply(dt: number): void {
        if (!this.tracks.length || !this.init()) return;
        for (const t of this.tracks) {
            t.t = Math.min(t.until, t.t + dt * t.ts);
            t.w = Math.min(1, t.w + dt / Math.max(1e-3, t.fade));
            if (t.out) t.out += dt / Math.max(1e-3, t.fadeOut);
            if (!t.hold && t.t >= t.until && !t.out) t.out = 1e-6;
            if (t.out >= 1) t.dead = true;
        }
        let cover = -1;
        for (let i = this.tracks.length - 1; i >= 0; i--) {
            const t = this.tracks[i];
            if (!t.mask && t.w >= 1 && !t.out) {
                cover = i;
                break;
            }
        }
        this.tracks = this.tracks.filter(
            (t, i) => !t.dead && (cover < 0 || i >= cover || t.mask),
        );
        if (!this.tracks.length) return;
        this.skel.read(this.base);
        this.out.copy(this.base);
        for (const t of this.tracks) {
            const env = smooth(t.w) * (1 - smooth(t.out));
            if (env < 0.001) continue;
            this.clips.sample(t.name, t.t, this.tmp, {
                loop: false,
                lock: "xz",
            });
            blendPoses(this.out, this.tmp, env, this.out, t.mask);
        }
        this.skel.apply(this.out);
        this.rig.object.updateMatrixWorld(true);
    }
}
