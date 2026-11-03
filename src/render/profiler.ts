// GPU pass timing with EXT_disjoint_timer_query_webgl2 (enabled with ?prof=1).
type TimerQueryExtension = {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
};

type PendingQuery = {
  name: string;
  query: WebGLQuery;
};

type TimingAccumulator = {
  sum: number;
  n: number;
};

type RendererLike = {
  getContext(): WebGL2RenderingContext;
};

export class GpuProfiler {
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerQueryExtension | null;
  readonly enabled: boolean;
  private readonly pending: PendingQuery[] = [];
  private readonly free: WebGLQuery[] = [];
  private current: PendingQuery | null = null;
  private acc: Record<string, TimingAccumulator> = {};

  constructor(renderer: RendererLike, enabled: boolean) {
    this.gl = renderer.getContext();
    this.ext = enabled
      ? (this.gl.getExtension(
          "EXT_disjoint_timer_query_webgl2",
        ) as TimerQueryExtension | null)
      : null;
    this.enabled = this.ext !== null;
  }

  begin(name: string): void {
    if (!this.ext) return;
    this.end();
    const gl = this.gl;
    const q = this.free.pop() ?? gl.createQuery();
    if (!q) return;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.current = { name, query: q };
  }

  end(): void {
    if (!this.ext || !this.current) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.current);
    this.current = null;
  }

  poll(): void {
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const p = this.pending[0];
      if (!p) break;
      if (!gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      const ns = gl.getQueryParameter(p.query, gl.QUERY_RESULT) as number;
      this.free.push(p.query);
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
      if (!a) continue;
      out[k] = +(a.sum / Math.max(1, a.n)).toFixed(3);
      total += a.sum / Math.max(1, a.n);
    }
    out.total = +total.toFixed(3);
    if (reset) this.acc = {};
    return out;
  }
}
