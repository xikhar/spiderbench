/**
 * GPU timing profiler for render passes using WebGL2 timer queries.
 *
 * @module render-profiler
 * @version 1.0.0
 * @file src/render/profiler.ts
 * @since 0.0.1
 * @description Exports GpuProfiler to bracket and aggregate GPU pass timings, poll query results, and report averaged millisecond measurements per pass.
 */

import type * as THREE from "three";

export class GpuProfiler {
    gl: WebGL2RenderingContext;
    ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    enabled: boolean;
    pending: { name: string; q: WebGLQuery }[];
    free: WebGLQuery[];
    current: { name: string; q: WebGLQuery } | null;
    acc: Record<string, { sum: number; n: number }>;
    last: Record<string, number>;

    constructor(renderer: THREE.WebGLRenderer, enabled: boolean) {
        this.gl = renderer.getContext() as WebGL2RenderingContext;
        this.ext = enabled
            ? (this.gl.getExtension("EXT_disjoint_timer_query_webgl2") as {
                  TIME_ELAPSED_EXT: number;
                  GPU_DISJOINT_EXT: number;
              } | null)
            : null;
        this.enabled = !!this.ext;
        this.pending = [];
        this.free = [];
        this.current = null;
        this.acc = {};
        this.last = {};
    }
    begin(name: string): void {
        if (!this.enabled) return;
        this.end();
        const gl = this.gl;
        const q = this.free.pop() || (gl.createQuery() as WebGLQuery);
        gl.beginQuery(this.ext!.TIME_ELAPSED_EXT, q);
        this.current = { name, q };
    }
    end(): void {
        if (!this.enabled || !this.current) return;
        this.gl.endQuery(this.ext!.TIME_ELAPSED_EXT);
        this.pending.push(this.current);
        this.current = null;
    }
    poll(): void {
        if (!this.enabled) return;
        const gl = this.gl;
        const disjoint = gl.getParameter(this.ext!.GPU_DISJOINT_EXT);
        while (this.pending.length) {
            const p = this.pending[0];
            if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
            this.pending.shift();
            const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT) as number;
            this.free.push(p.q);
            if (disjoint) continue;
            const a = this.acc[p.name] || (this.acc[p.name] = { sum: 0, n: 0 });
            a.sum += ns / 1e6;
            a.n++;
        }
    }
    /** average ms per pass since last reset */
    report(reset = false): Record<string, number> {
        const out: Record<string, number> = {};
        let total = 0;
        for (const k in this.acc) {
            const a = this.acc[k];
            out[k] = +(a.sum / Math.max(1, a.n)).toFixed(3);
            total += a.sum / Math.max(1, a.n);
        }
        out.total = +total.toFixed(3);
        if (reset) this.acc = {};
        return out;
    }
}
