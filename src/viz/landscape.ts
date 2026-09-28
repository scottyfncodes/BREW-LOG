import type { BeerView, Brewery } from '../data/types';
import { computeLayout, pickBeer, pickStar, rangeHeightAt, type Layout, type PlacedBeer, type Range, type Star } from './layout';
import { hash01 } from '../data/util';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const SKY_TOP_EARLY = hex('#2c3050');
const SKY_TOP_LATE = hex('#0f1226');
const SKY_MID_EARLY = hex('#6b4a6a');
const SKY_MID_LATE = hex('#2b2446');
const HORIZON_EARLY = hex('#f0a765');
const HORIZON_LATE = hex('#b8643c');
const RANGE_FRONT = hex('#261d2c');
const RANGE_BACK = hex('#5d4863');
const EMBER_LOW = hex('#b4643a');
const EMBER_HIGH = hex('#ffd98a');
const STAR = hex('#fff3dc');

export interface LandscapeOptions {
  onPickBeer?: (id: string, at: { x: number; y: number }) => void;
  onPickStar?: (id: string, at: { x: number; y: number }) => void;
  onPickNothing?: () => void;
  reducedMotion?: boolean;
  compact?: boolean;
}

export class Landscape {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private staticLayer = document.createElement('canvas');
  private dpr = 1;
  private w = 0;
  private h = 0;
  private views: BeerView[] = [];
  private breweries: Brewery[] = [];
  private layout?: Layout;
  private prevRanges = new Map<string, Range>();
  private growStart = 0;
  private arrival?: { id: string; start: number };
  private raf = 0;
  private running = false;
  private ro: ResizeObserver;
  private glow: HTMLCanvasElement;
  private highlight?: string;
  private ambient: { x: number; y: number; r: number; p: number; s: number }[] = [];

  constructor(canvas: HTMLCanvasElement, private opts: LandscapeOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.glow = makeGlowSprite();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener('click', this.onClick);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('click', this.onClick);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  setData(views: BeerView[], breweries: Brewery[], arrivalId?: string) {
    if (this.layout) this.prevRanges = new Map(this.layout.ranges.map((r) => [r.key, r]));
    this.views = views;
    this.breweries = breweries;
    this.relayout();
    const now = performance.now();
    if (!this.opts.reducedMotion && this.prevRanges.size) this.growStart = now;
    if (arrivalId && !this.opts.reducedMotion) this.arrival = { id: arrivalId, start: now + 250 };
    this.renderStatic(1);
    this.start();
  }

  setHighlight(id: string | undefined) {
    this.highlight = id;
    this.frame(performance.now());
  }

  getLayout() {
    return this.layout;
  }

  private onVisibility = () => {
    if (document.hidden) this.running = false;
    else this.start();
  };

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.w = rect.width;
    this.h = rect.height;
    for (const c of [this.canvas, this.staticLayer]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    this.prevRanges.clear();
    this.relayout();
    this.renderStatic(1);
    this.frame(performance.now());
    this.start();
  }

  private relayout() {
    if (!this.w) return;
    this.layout = computeLayout(this.views, this.breweries, this.w, this.h);
    const m = this.layout.maturity;
    const count = Math.round(36 + 180 * m);
    this.ambient = Array.from({ length: count }, (_, i) => ({
      x: hash01('ax' + i) * this.w,
      y: Math.pow(hash01('ay' + i), 1.6) * this.layout!.base * 0.8,
      r: 0.3 + hash01('ar' + i) * 0.9,
      p: hash01('ap' + i) * Math.PI * 2,
      s: 0.4 + hash01('as' + i) * 1.2,
    }));
  }

  private start() {
    if (this.running || document.hidden) return;
    if (this.opts.reducedMotion) {
      this.frame(performance.now());
      return;
    }
    this.running = true;
    let last = 0;
    const tick = (t: number) => {
      if (!this.running) return;
      // ~30fps is plenty for gentle twinkling and saves battery.
      if (t - last > 32) {
        last = t;
        const growing = this.growStart && t - this.growStart < 1400;
        if (growing) this.renderStatic(ease((t - this.growStart) / 1400));
        else if (this.growStart) {
          this.growStart = 0;
          this.prevRanges.clear();
          this.renderStatic(1);
        }
        this.frame(t);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private onClick = (e: MouseEvent) => {
    if (!this.layout) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beer = pickBeer(this.layout, x, y);
    if (beer) return this.opts.onPickBeer?.(beer.id, { x: beer.x, y: beer.y });
    const star = pickStar(this.layout, x, y);
    if (star) return this.opts.onPickStar?.(star.id, { x: star.x, y: star.y });
    this.opts.onPickNothing?.();
  };

  // -------------------------------------------------------------------------

  /** Interpolated ranges while the landscape grows into new data. */
  private rangesAt(t: number): Range[] {
    const L = this.layout!;
    if (t >= 1 || !this.prevRanges.size) return L.ranges;
    return L.ranges.map((r) => {
      const p = this.prevRanges.get(r.key);
      if (!p) return { ...r, h: r.h * t, w: r.w * (0.6 + 0.4 * t) };
      return { ...r, h: p.h + (r.h - p.h) * t, w: p.w + (r.w - p.w) * t, cx: p.cx + (r.cx - p.cx) * t };
    });
  }

  private renderStatic(t: number) {
    const L = this.layout;
    if (!L) return;
    const c = this.staticLayer.getContext('2d')!;
    const { w, h } = this;
    const m = L.maturity;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Sky deepens from first light to full night as history accumulates.
    const sky = c.createLinearGradient(0, 0, 0, L.base);
    sky.addColorStop(0, rgba(mix(SKY_TOP_EARLY, SKY_TOP_LATE, m)));
    sky.addColorStop(0.58, rgba(mix(SKY_MID_EARLY, SKY_MID_LATE, m)));
    sky.addColorStop(1, rgba(mix(HORIZON_EARLY, HORIZON_LATE, m)));
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);

    const sun = c.createRadialGradient(w * 0.5, L.base, 0, w * 0.5, L.base, Math.max(w, h) * 0.6);
    sun.addColorStop(0, `rgba(255,190,120,${0.35 - 0.15 * m})`);
    sun.addColorStop(1, 'rgba(255,190,120,0)');
    c.fillStyle = sun;
    c.fillRect(0, 0, w, h);

    // Brewery constellation: a faint path in the order we met them.
    if (L.stars.length > 1) {
      c.beginPath();
      L.stars.forEach((s, i) => (i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y)));
      c.strokeStyle = 'rgba(255,236,210,0.10)';
      c.lineWidth = 0.8;
      c.setLineDash([2, 4]);
      c.stroke();
      c.setLineDash([]);
    }

    // A distant horizon line is always there, even before the first beer.
    this.drawFarRidge(c, L);

    const ranges = [...this.rangesAt(t)].sort((a, b) => b.depth - a.depth);
    for (const r of ranges) this.drawRange(c, L, r);

    this.drawGround(c, L);
    this.drawTrail(c, L);
    this.drawLabels(c, ranges);

    const beers = t >= 1 ? L.beers : this.beersAt(ranges, L);
    for (const b of beers) if (b.id !== this.arrival?.id) this.drawBeer(c, b, 1);
  }

  private beersAt(ranges: Range[], L: Layout): PlacedBeer[] {
    // During growth, scale each beer's elevation with its range.
    const byKey = new Map(ranges.map((r) => [r.key, r]));
    const finals = new Map(L.ranges.map((r) => [r.key, r]));
    return L.beers.map((b) => {
      const r = byKey.get(b.rangeKey);
      const f = finals.get(b.rangeKey);
      if (!r || !f || !f.h) return b;
      const k = r.h / f.h;
      return { ...b, y: L.base - (L.base - b.y) * k, x: r.cx + (b.x - f.cx) * (r.w / f.w) };
    });
  }

  private drawFarRidge(c: CanvasRenderingContext2D, L: Layout) {
    const { w } = this;
    const empty = !L.ranges.length;
    c.beginPath();
    c.moveTo(0, L.base);
    for (let x = 0; x <= w; x += 6) {
      const t = x / w;
      const y =
        L.base -
        this.h * (empty ? 0.13 : 0.07) *
          (0.55 + 0.25 * Math.sin(t * 9.1 + 1.3) + 0.15 * Math.sin(t * 23.7) + 0.35 * Math.exp(-((t - 0.62) ** 2) / 0.01));
      c.lineTo(x, y);
    }
    c.lineTo(w, L.base);
    c.closePath();
    c.fillStyle = rgba(mix(RANGE_BACK, hex('#b88073'), 0.35), 0.55);
    c.fill();
    if (empty) {
      // Sparse, dashed survey lines hint at the landscape still to come.
      c.save();
      c.clip();
      c.strokeStyle = 'rgba(255,225,190,0.16)';
      c.setLineDash([3, 5]);
      for (let i = 1; i <= 3; i++) {
        c.beginPath();
        c.moveTo(0, L.base - i * 9);
        c.lineTo(w, L.base - i * 9);
        c.stroke();
      }
      c.restore();
    }
  }

  private rangePath(c: CanvasRenderingContext2D, L: Layout, r: Range) {
    const left = Math.max(0, r.cx - r.w * 2.4);
    const right = Math.min(this.w, r.cx + r.w * 2.4);
    c.beginPath();
    c.moveTo(left, L.base);
    for (let x = left; x <= right; x += 3) c.lineTo(x, L.base - rangeHeightAt(r, x));
    c.lineTo(right, L.base);
    c.closePath();
    return { left, right };
  }

  private drawRange(c: CanvasRenderingContext2D, L: Layout, r: Range) {
    const col = mix(RANGE_FRONT, RANGE_BACK, r.depth * 0.85);
    const { left, right } = this.rangePath(c, L, r);
    const g = c.createLinearGradient(0, L.base - r.h, 0, L.base);
    g.addColorStop(0, rgba(mix(col, hex('#9a6e78'), 0.18)));
    g.addColorStop(1, rgba(col));
    c.fillStyle = g;
    c.fill();

    // Topographic strata that follow the ridge, clipped inside it.
    c.save();
    c.clip();
    const alpha = 0.07 + 0.09 * (1 - r.depth);
    c.strokeStyle = `rgba(255,214,170,${alpha})`;
    c.lineWidth = 0.8;
    for (let j = 1; j <= r.strata; j++) {
      const d = (j / (r.strata + 1)) * r.h;
      c.beginPath();
      let pen = false;
      for (let x = left; x <= right; x += 3) {
        const hh = rangeHeightAt(r, x) - d;
        if (hh <= 0) {
          pen = false;
          continue;
        }
        const y = L.base - hh * (1 - 0.12 * Math.sin((x - r.cx) / r.w * 3 + j));
        if (!pen) {
          c.moveTo(x, y);
          pen = true;
        } else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();

    // Warm rim light along the ridge, facing the horizon glow.
    c.beginPath();
    let first = true;
    for (let x = left; x <= right; x += 3) {
      const y = L.base - rangeHeightAt(r, x);
      if (L.base - y < 1) {
        first = true;
        continue;
      }
      if (first) {
        c.moveTo(x, y);
        first = false;
      } else c.lineTo(x, y);
    }
    c.strokeStyle = `rgba(255,196,140,${0.25 + 0.25 * (1 - r.depth)})`;
    c.lineWidth = 1.1;
    c.stroke();
  }

  private drawGround(c: CanvasRenderingContext2D, L: Layout) {
    const { w, h } = this;
    c.beginPath();
    c.moveTo(0, L.base + 4);
    const gy = (x: number) => L.base + 2 + 3 * Math.sin(x / 57) + 2 * Math.sin(x / 13);
    for (let x = 0; x < w; x += 8) c.lineTo(x, gy(x));
    c.lineTo(w, gy(w));
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.closePath();
    const g = c.createLinearGradient(0, L.base, 0, h);
    g.addColorStop(0, '#221a26');
    g.addColorStop(1, '#130f17');
    c.fillStyle = g;
    c.fill();
  }

  private drawTrail(c: CanvasRenderingContext2D, L: Layout) {
    const t = L.trail;
    if (!t.length) return;
    if (t.length > 1) {
      c.beginPath();
      c.moveTo(t[0].x, t[0].y);
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1];
        const b = t[i];
        const mx = (a.x + b.x) / 2;
        c.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
      }
      c.strokeStyle = 'rgba(240,190,140,0.28)';
      c.setLineDash([2, 5]);
      c.lineWidth = 1;
      c.stroke();
      c.setLineDash([]);
    }
    const showLabels = t.length <= Math.floor(this.w / 70);
    c.font = `600 9px ${MONO}`;
    c.textAlign = 'center';
    for (const p of t) {
      // Cairn: a small stacked marker.
      c.fillStyle = 'rgba(240,190,140,0.85)';
      c.beginPath();
      c.moveTo(p.x, p.y - p.r * 1.8);
      c.lineTo(p.x + p.r, p.y);
      c.lineTo(p.x - p.r, p.y);
      c.closePath();
      c.fill();
      if (showLabels && this.h > 260 && !this.opts.compact) {
        c.fillStyle = 'rgba(240,210,180,0.55)';
        c.fillText(p.label.toUpperCase(), p.x, p.y + 11);
      }
    }
  }

  private drawLabels(c: CanvasRenderingContext2D, ranges: Range[]) {
    const L = this.layout!;
    const boxes: [number, number, number, number][] = [];
    const sorted = [...ranges].sort((a, b) => b.count - a.count);
    c.textAlign = 'center';
    for (const r of sorted) {
      if (r.h < 20) continue;
      const x = r.cx;
      const y = L.base - rangeHeightAt(r, r.cx) - 12;
      const label = r.label.toUpperCase();
      c.font = `600 ${this.w < 420 ? 8.5 : 10}px ${MONO}`;
      const tw = c.measureText(label).width;
      const box: [number, number, number, number] = [x - tw / 2 - 4, y - 18, x + tw / 2 + 4, y + 4];
      if (boxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      if (box[0] < 2 || box[2] > this.w - 2 || box[1] < 2) continue;
      boxes.push(box);
      c.fillStyle = 'rgba(255,236,214,0.78)';
      c.fillText(label, x, y - 6);
      c.fillStyle = 'rgba(255,214,170,0.5)';
      c.font = `500 ${this.w < 420 ? 8 : 9}px ${MONO}`;
      c.fillText(String(r.count), x, y + 3);
    }
  }

  private drawBeer(c: CanvasRenderingContext2D, b: PlacedBeer, alpha: number) {
    const s = b.score ?? 5;
    const t = Math.max(0, Math.min(1, (s - 4) / 6));
    const col = mix(EMBER_LOW, EMBER_HIGH, t);
    const glowR = b.r * (2.2 + t * 2.6);
    c.globalAlpha = alpha * (0.22 + 0.38 * t) * (0.7 + 0.3 * b.recency);
    c.drawImage(this.glow, b.x - glowR, b.y - glowR, glowR * 2, glowR * 2);
    c.globalAlpha = alpha * (0.6 + 0.4 * b.recency);
    c.fillStyle = rgba(col);
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.fill();
    if (b.summit) {
      // 10.0: a quiet four-point sparkle on the summit.
      c.strokeStyle = rgba(EMBER_HIGH, 0.9 * alpha);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(b.x - b.r * 3.4, b.y);
      c.lineTo(b.x + b.r * 3.4, b.y);
      c.moveTo(b.x, b.y - b.r * 3.4);
      c.lineTo(b.x, b.y + b.r * 3.4);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  private drawStar(c: CanvasRenderingContext2D, s: Star, tw: number) {
    const a = s.brightness * (0.75 + 0.25 * tw);
    const gr = s.r * 5;
    c.globalAlpha = a * 0.5;
    c.drawImage(this.glow, s.x - gr, s.y - gr, gr * 2, gr * 2);
    c.globalAlpha = Math.min(1, a + 0.15);
    c.fillStyle = rgba(STAR);
    c.beginPath();
    c.arc(s.x, s.y, s.r * 0.7, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }

  private frame(now: number) {
    const L = this.layout;
    if (!L || !this.w) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.staticLayer, 0, 0);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const motion = !this.opts.reducedMotion;
    const secs = now / 1000;

    for (const a of this.ambient) {
      const tw = motion ? 0.5 + 0.5 * Math.sin(secs * a.s + a.p) : 0.7;
      c.fillStyle = `rgba(255,243,220,${0.18 + 0.45 * tw * (a.y / L.base < 0.9 ? 1 : 0.4)})`;
      c.fillRect(a.x, a.y, a.r * 1.4, a.r * 1.4);
    }
    for (const s of L.stars) {
      const tw = motion ? 0.5 + 0.5 * Math.sin(secs * 0.8 + hash01(s.id) * 6.28) : 0.8;
      this.drawStar(c, s, tw);
    }

    if (this.arrival) {
      const b = L.beers.find((x) => x.id === this.arrival!.id);
      const t = (now - this.arrival.start) / 1600;
      if (!b) this.arrival = undefined;
      else if (t < 0) {
        // not yet
      } else if (t < 1) {
        const e = ease(t);
        const y = L.base + 6 + (b.y - L.base - 6) * e;
        this.drawBeer(c, { ...b, y }, Math.min(1, t * 3));
      } else {
        this.drawBeer(c, b, 1);
        const pulse = (t - 1) / 1.2;
        if (pulse < 1) {
          c.strokeStyle = `rgba(255,217,138,${0.6 * (1 - pulse)})`;
          c.lineWidth = 1;
          c.beginPath();
          c.arc(b.x, b.y, b.r + 18 * ease(pulse), 0, Math.PI * 2);
          c.stroke();
        } else {
          // Bake it into the static layer and stop special-casing it.
          this.arrival = undefined;
          this.renderStatic(1);
        }
      }
    }

    if (this.highlight) {
      const b = L.beers.find((x) => x.id === this.highlight);
      if (b) {
        c.strokeStyle = 'rgba(255,240,220,0.9)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
}

const MONO = `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace`;

function makeGlowSprite(): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 64;
  const c = s.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,150,1)');
  g.addColorStop(0.25, 'rgba(255,190,110,0.45)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return s;
}
