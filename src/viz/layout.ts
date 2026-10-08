import type { BeerView, Brewery, ID } from '../data/types';
import { styleFamily } from '../data/styles';
import { hash01 } from '../data/util';

/**
 * The Beer Landscape.
 *
 *  - Each style family is a mountain range. More beers → a taller, broader
 *    range with more strata lines.
 *  - Each beer sits on its range at an elevation equal to its score:
 *    1.0 at the foothills, 10.0 on the summit.
 *  - Each brewery is a star in the sky; brighter when rated higher.
 *  - Places are cairns along a trail across the foreground, in the order
 *    we first drank there.
 *
 * Everything here is pure and deterministic so it can be tested and so
 * the picture stays stable between visits.
 */

export interface Range {
  key: string;
  label: string;
  count: number;
  average?: number;
  cx: number;
  /** Half-width scale in px. */
  w: number;
  /** Peak height in px above the base line. */
  h: number;
  depth: number; // 0 = front, 1 = back (largest ranges sit furthest back)
  seed: number;
  strata: number;
}

export interface PlacedBeer {
  id: ID;
  x: number;
  y: number;
  r: number;
  score?: number;
  rangeKey: string;
  summit: boolean;
  recency: number; // 0 oldest … 1 newest
}

export interface Star {
  id: ID;
  label: string;
  x: number;
  y: number;
  r: number;
  brightness: number;
  count: number;
  firstDate: string;
}

export interface Cairn {
  key: string;
  label: string;
  x: number;
  y: number;
  r: number;
  count: number;
}

export interface Layout {
  width: number;
  height: number;
  base: number;
  ranges: Range[];
  beers: PlacedBeer[];
  stars: Star[];
  trail: Cairn[];
  /** 0 = first light, 1 = a deep, full night sky. */
  maturity: number;
}

export const MAX_RANGES = 10;
/** Where the mountains meet the ground, as a fraction of canvas height. */
export const BASE_FRAC = 0.66;
const PEAK_SHARPNESS = 1.7;

/** Ridge profile: 0…1 at offset t (in half-widths) from the range centre. */
export function ridge(t: number, seed: number): number {
  const core = Math.exp(-PEAK_SHARPNESS * t * t);
  // Gentle deterministic undulation so ranges don't look like bell curves.
  const wobble =
    0.06 * Math.sin(t * 5.1 + seed * 12) * (1 - Math.min(1, Math.abs(t) / 2.2)) +
    0.03 * Math.sin(t * 11.3 + seed * 31);
  return Math.max(0, core * (1 + wobble));
}

/** Height of a range (px above base) at canvas x. */
export function rangeHeightAt(r: Range, x: number): number {
  return r.h * ridge((x - r.cx) / r.w, r.seed);
}

export function computeLayout(
  views: BeerView[],
  breweries: Brewery[],
  width: number,
  height: number,
): Layout {
  const base = height * BASE_FRAC;
  const maturity = Math.min(1, Math.sqrt(views.length / 160));

  // --- Ranges -------------------------------------------------------------
  const fam = new Map<string, BeerView[]>();
  for (const v of views) {
    const f = styleFamily(v.beer.style);
    (fam.get(f) ?? fam.set(f, []).get(f)!).push(v);
  }
  let groups = [...fam.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const maxRanges = Math.max(4, Math.min(MAX_RANGES, Math.floor(width / 46)));
  if (groups.length > maxRanges) {
    const head = groups.slice(0, maxRanges - 1);
    const rest = groups.slice(maxRanges - 1).flatMap(([, vs]) => vs);
    groups = [...head, ['More styles', rest]];
  }
  const maxCount = groups[0]?.[1].length ?? 1;
  const n = groups.length;
  const maxH = height * 0.46;
  const minH = height * 0.12;
  const usable = width * 0.94;

  // Largest range in the middle, then alternate outwards for a massif shape.
  const slots: number[] = [];
  for (let i = 0; i < n; i++) {
    const offset = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
    slots.push(offset);
  }
  const minSlot = Math.min(0, ...slots);
  const maxSlot = Math.max(0, ...slots);
  const span = Math.max(1, maxSlot - minSlot);

  const ranges: Range[] = groups.map(([label, vs], i) => {
    const frac = Math.sqrt(vs.length / maxCount);
    const seed = hash01(label);
    const pos = n === 1 ? 0.5 : (slots[i] - minSlot) / span;
    const jitter = n === 1 ? 0 : (seed - 0.5) * (usable / (n + 1)) * 0.35;
    const cx = width * 0.03 + usable * (0.08 + pos * 0.84) + jitter;
    const scored = vs.map((v) => v.score).filter((s): s is number => s !== undefined);
    return {
      key: label,
      label,
      count: vs.length,
      average: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : undefined,
      cx,
      w: (usable / Math.max(2.4, n * 0.62)) * (0.5 + 0.5 * frac),
      h: minH + (maxH - minH) * frac,
      depth: n === 1 ? 0.5 : 1 - i / (n - 1),
      seed,
      strata: Math.min(14, 2 + Math.round(Math.sqrt(vs.length) * 2)),
    };
  });

  // --- Beers ----------------------------------------------------------------
  const rangeOf = new Map<string, Range>();
  for (const r of ranges) rangeOf.set(r.key, r);
  const other = rangeOf.get('More styles');
  const order = [...views].sort((a, b) => (a.beer.date + a.beer.createdAt).localeCompare(b.beer.date + b.beer.createdAt));
  const rank = new Map(order.map((v, i) => [v.beer.id, order.length > 1 ? i / (order.length - 1) : 1]));
  const dotR = Math.max(1.3, Math.min(3.2, 4.2 - Math.log10(views.length + 1) * 0.9));

  const beers: PlacedBeer[] = views.map((v) => {
    const r = rangeOf.get(styleFamily(v.beer.style)) ?? other ?? ranges[0];
    const s = v.score;
    // Unscored beers rest low on the slopes.
    const e = s === undefined ? 0.06 : Math.max(0.02, (s - 1) / 9);
    const u = hash01(v.beer.id) * 2 - 1; // -1…1 across the slope
    const k = hash01(v.beer.id + 'k');
    // Width of the mountain at this elevation (inverse of the core profile).
    const halfT = e >= 0.999 ? 0 : Math.sqrt(-Math.log(Math.max(e, 1e-3)) / PEAK_SHARPNESS);
    let x = r.cx + r.w * halfT * u * 0.88;
    let y = base - e * r.h;
    // Keep the point inside the mountain even where the ridge wobbles.
    const ridgeY = base - rangeHeightAt(r, x);
    if (y < ridgeY + 2) y = ridgeY + 2 + k * 2;
    if (s !== undefined && s >= 9.95) {
      x = r.cx;
      y = base - rangeHeightAt(r, r.cx) + 1;
    }
    return {
      id: v.beer.id,
      x,
      y: Math.min(y, base - 1),
      r: dotR * (s === undefined ? 0.7 : 0.75 + (s / 10) * 0.6),
      score: s,
      rangeKey: r.key,
      summit: s !== undefined && s >= 9.95,
      recency: rank.get(v.beer.id) ?? 1,
    };
  });

  // --- Stars (breweries) ------------------------------------------------------
  const byBrewery = new Map<ID, BeerView[]>();
  for (const v of views) (byBrewery.get(v.beer.breweryId) ?? byBrewery.set(v.beer.breweryId, []).get(v.beer.breweryId)!).push(v);
  const skyTop = height * 0.06;
  const skyBottom = base - maxH - height * 0.02;
  const stars: Star[] = breweries
    .filter((b) => byBrewery.has(b.id))
    .map((b) => {
      const vs = byBrewery.get(b.id)!;
      const scored = vs.map((v) => v.score).filter((s): s is number => s !== undefined);
      const avg = scored.length ? scored.reduce((a, c) => a + c, 0) / scored.length : 6;
      const hx = hash01(b.id + 'x');
      const hy = hash01(b.id + 'y');
      return {
        id: b.id,
        label: b.name,
        x: width * (0.04 + hx * 0.92),
        y: skyTop + Math.pow(hy, 1.3) * Math.max(10, skyBottom - skyTop),
        r: 0.9 + Math.min(2.6, Math.sqrt(vs.length) * 0.7),
        brightness: Math.max(0.25, Math.min(1, (avg - 3) / 7)),
        count: vs.length,
        firstDate: vs.map((v) => v.beer.date).filter(Boolean).sort()[0] ?? '',
      };
    })
    .sort((a, b) => a.firstDate.localeCompare(b.firstDate));

  // --- Trail of places ----------------------------------------------------------
  const places = new Map<string, { label: string; count: number; first: string }>();
  for (const v of order) {
    const { city, state, country } = v.beer;
    const label = city || state || country;
    if (!label) continue;
    const key = [city, state, country].join('|').toLowerCase();
    const p = places.get(key);
    if (p) p.count++;
    else places.set(key, { label, count: 1, first: v.beer.date });
  }
  const pl = [...places.entries()];
  const groundH = height - base;
  const trail: Cairn[] = pl.map(([key, p], i) => {
    const t = pl.length === 1 ? 0.5 : i / (pl.length - 1);
    const x = width * (0.08 + t * 0.84);
    // The trail meanders through the foreground.
    const y = base + Math.min(26, groundH * 0.12) * (0.9 + 0.35 * Math.sin(t * Math.PI * 3 + 0.6));
    return { key, label: p.label, x, y, r: 1.8 + Math.min(4, Math.sqrt(p.count) * 1.1), count: p.count };
  });

  return { width, height, base, ranges, beers, stars, trail, maturity };
}

/**
 * A ghost of the landscape to come, shown before the first beer: sketched
 * ranges with a few lights on their slopes, a scatter of stars and a short
 * trail of cairns. Labels are the style families most people meet first.
 * Pure and deterministic, like the real layout, so the first screen is stable.
 */
export interface Preview {
  ranges: Range[];
  beers: { x: number; y: number; r: number }[];
  stars: { x: number; y: number; r: number }[];
  trail: { x: number; y: number; r: number }[];
}

const PREVIEW_STYLES: [label: string, size: number][] = [
  ['IPA', 1],
  ['Lager', 0.78],
  ['Stout', 0.66],
  ['Sour', 0.5],
  ['Wheat', 0.42],
];

export function previewLayout(width: number, height: number): Preview {
  const base = height * BASE_FRAC;
  const usable = width * 0.94;
  const n = Math.min(PREVIEW_STYLES.length, Math.max(3, Math.floor(width / 110)));
  const groups = PREVIEW_STYLES.slice(0, n);
  const slots = groups.map((_, i) => Math.ceil(i / 2) * (i % 2 ? -1 : 1));
  const minSlot = Math.min(0, ...slots);
  const span = Math.max(1, Math.max(0, ...slots) - minSlot);
  const maxH = height * 0.26;
  const minH = height * 0.1;

  const ranges: Range[] = groups.map(([label, size], i) => {
    const seed = hash01(label);
    const pos = (slots[i] - minSlot) / span;
    return {
      key: label,
      label,
      count: 0,
      cx: width * 0.03 + usable * (0.1 + pos * 0.8) + (seed - 0.5) * (usable / (n + 1)) * 0.3,
      w: (usable / Math.max(2.4, n * 0.62)) * (0.5 + 0.5 * size),
      h: minH + (maxH - minH) * size,
      depth: 1 - i / Math.max(1, n - 1),
      seed,
      strata: 3,
    };
  });

  // A handful of lights per range, scattered at believable scores.
  const beers = ranges.flatMap((r, i) =>
    [0.82, 0.55, 0.38, 0.68].slice(0, 2 + (i % 3)).map((e, j) => {
      const u = hash01(`${r.key}u${j}`) * 2 - 1;
      const halfT = Math.sqrt(-Math.log(e) / PEAK_SHARPNESS);
      const x = Math.max(6, Math.min(width - 6, r.cx + r.w * halfT * u * 0.8));
      return { x, y: Math.min(base - 2, base - rangeHeightAt(r, x) + 3 + (1 - e) * r.h * 0.5), r: 2.4 };
    }),
  );

  // Stars sit in a loose band just above the peaks, spread evenly across.
  const skyBottom = base - maxH - height * 0.03;
  const count = Math.round(5 + width / 120);
  const stars = Array.from({ length: count }, (_, i) => ({
    x: width * (0.06 + ((i + 0.2 + hash01(`ps${i}x`) * 0.6) / count) * 0.88),
    y: skyBottom - height * (0.02 + hash01(`ps${i}y`) * 0.09),
    r: 1 + hash01(`ps${i}r`) * 0.9,
  }));

  const groundH = height - base;
  const trail = [0.18, 0.5, 0.82].map((t) => ({
    x: width * t,
    y: base + Math.min(26, groundH * 0.12) * (0.9 + 0.35 * Math.sin(t * Math.PI * 3 + 0.6)),
    r: 2.6,
  }));

  return { ranges, beers, stars, trail };
}

/** Find the beer dot nearest a point (for taps), within `radius` px. */
export function pickBeer(layout: Layout, x: number, y: number, radius = 22): PlacedBeer | undefined {
  let best: PlacedBeer | undefined;
  let bestD = radius * radius;
  for (const b of layout.beers) {
    const d = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

export function pickStar(layout: Layout, x: number, y: number, radius = 20): Star | undefined {
  let best: Star | undefined;
  let bestD = radius * radius;
  for (const s of layout.stars) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
