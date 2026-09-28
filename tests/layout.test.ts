import { describe, expect, it } from 'vitest';
import { computeLayout, pickBeer, rangeHeightAt } from '../src/viz/layout';
import { buildViews } from '../src/data/views';
import { bigSnap, makeSnap } from './helpers';

const W = 390;
const H = 640;

describe('beer landscape layout', () => {
  it('is sparse but valid with zero beers', () => {
    const L = computeLayout([], [], W, H);
    expect(L.ranges).toHaveLength(0);
    expect(L.beers).toHaveLength(0);
    expect(L.stars).toHaveLength(0);
    expect(L.maturity).toBe(0);
  });

  for (const n of [1, 10, 50, 100, 1000]) {
    it(`places ${n} beers inside the canvas, on their mountains`, () => {
      const snap = bigSnap(n);
      const views = buildViews(snap);
      const L = computeLayout(views, snap.breweries, W, H);
      expect(L.beers).toHaveLength(n);
      expect(L.ranges.length).toBeGreaterThan(0);
      expect(L.ranges.length).toBeLessThanOrEqual(10);
      const byKey = new Map(L.ranges.map((r) => [r.key, r]));
      for (const b of L.beers) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        expect(b.y).toBeLessThanOrEqual(L.base);
        expect(b.y).toBeGreaterThan(0);
        // The dot is never floating above its own ridge.
        const r = byKey.get(b.rangeKey)!;
        expect(b.y).toBeGreaterThanOrEqual(L.base - rangeHeightAt(r, b.x) - 0.5);
      }
      expect(L.stars.length).toBe(new Set(views.map((v) => v.beer.breweryId)).size);
    });
  }

  it('gets richer as history grows', () => {
    const small = bigSnap(10);
    const big = bigSnap(200);
    const a = computeLayout(buildViews(small), small.breweries, W, H);
    const b = computeLayout(buildViews(big), big.breweries, W, H);
    expect(b.maturity).toBeGreaterThan(a.maturity);
    expect(Math.max(...b.ranges.map((r) => r.strata))).toBeGreaterThan(Math.max(...a.ranges.map((r) => r.strata)));
    expect(b.trail.length).toBeGreaterThan(0);
  });

  it('puts higher scores higher and 10.0 on the summit', () => {
    const snap = makeSnap([
      { name: 'low', brewery: 'a', style: 'IPA', scott: 2 },
      { name: 'mid', brewery: 'a', style: 'IPA', scott: 6 },
      { name: 'top', brewery: 'a', style: 'IPA', scott: 10 },
    ]);
    const views = buildViews(snap);
    const L = computeLayout(views, snap.breweries, W, H);
    const y = (name: string) => L.beers.find((b) => b.id === views.find((v) => v.beer.name === name)!.beer.id)!;
    expect(y('top').y).toBeLessThan(y('mid').y);
    expect(y('mid').y).toBeLessThan(y('low').y);
    expect(y('top').summit).toBe(true);
    expect(y('top').x).toBeCloseTo(L.ranges[0].cx);
  });

  it('is deterministic and supports tapping', () => {
    const snap = bigSnap(40);
    const views = buildViews(snap);
    const a = computeLayout(views, snap.breweries, W, H);
    const b = computeLayout(views, snap.breweries, W, H);
    expect(a.beers).toEqual(b.beers);
    const t = a.beers[5];
    expect(pickBeer(a, t.x + 1, t.y + 1)?.id).toBeDefined();
    expect(pickBeer(a, -100, -100)).toBeUndefined();
  });

  it('lays out 5,000 beers quickly', () => {
    const snap = bigSnap(5000);
    const views = buildViews(snap);
    const t = performance.now();
    computeLayout(views, snap.breweries, 1200, 800);
    expect(performance.now() - t).toBeLessThan(300);
  });
});
