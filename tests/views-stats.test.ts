import { describe, expect, it } from 'vitest';
import { buildViews } from '../src/data/views';
import { byPlace, byStyle, disagreements, ourTaste, ratingDistribution, summarize, timeline } from '../src/data/stats';
import { makeSnap } from './helpers';

describe('two-person ratings', () => {
  const snap = makeSnap([
    { name: 'Maharaja', brewery: 'Avery', scott: 8.4, ellen: 9.0 },
    { name: 'Solo S', brewery: 'Avery', scott: 7.1 },
    { name: 'Solo E', brewery: 'Avery', ellen: 6.4 },
    { name: 'Nobody', brewery: 'Avery' },
    { name: 'Legacy', brewery: 'Avery', imported: 8.8 },
    { name: 'Legacy rated', brewery: 'Avery', imported: 3, scott: 9 },
  ]);
  const v = Object.fromEntries(buildViews(snap).map((x) => [x.beer.name, x]));

  it('averages both scores into a shared score without touching individual ones', () => {
    expect(v.Maharaja.shared).toBe(8.7);
    expect(v.Maharaja.score).toBe(8.7);
    expect(v.Maharaja.scores).toEqual({ scott: 8.4, ellen: 9.0 });
    expect(v.Maharaja.disagreement).toBe(0.6);
  });
  it('handles one or neither rater', () => {
    expect(v['Solo S'].shared).toBeUndefined();
    expect(v['Solo S'].score).toBe(7.1);
    expect(v['Solo E'].score).toBe(6.4);
    expect(v.Nobody.score).toBeUndefined();
    expect(v.Nobody.disagreement).toBeUndefined();
  });
  it('uses an imported shared score only when nobody has rated', () => {
    expect(v.Legacy.score).toBe(8.8);
    expect(v['Legacy rated'].score).toBe(9);
  });
});

describe('insights', () => {
  const snap = makeSnap([
    { name: 'A', brewery: 'Avery', style: 'IPA', scott: 9, ellen: 8, date: '2026-01-05', city: 'Denver', state: 'Colorado', country: 'USA' },
    { name: 'B', brewery: 'Avery', style: 'IPA', scott: 8, ellen: 8, date: '2026-03-05', city: 'Denver', state: 'Colorado', country: 'USA' },
    { name: 'C', brewery: 'Avery', style: 'IPA', scott: 9.4, ellen: 6.3, date: '2026-03-09' },
    { name: 'D', brewery: 'Weihen', style: 'Pilsner', scott: 7, date: '2026-04-01', city: 'Munich', country: 'Germany' },
    { name: 'E', brewery: 'Weihen', style: 'Pilsner', ellen: 10, date: '2026-04-02' },
  ]);
  const views = buildViews(snap);
  const people = snap.people;

  it('summarizes counts and per-person averages', () => {
    const s = summarize(views, people);
    expect(s.count).toBe(5);
    expect(s.breweryCount).toBe(2);
    expect(s.perPerson.find((p) => p.person.id === 'scott')!.count).toBe(4);
    expect(s.perPerson.find((p) => p.person.id === 'ellen')!.average).toBe(8.1);
    expect(s.sharedCount).toBe(3);
    expect(s.placeCount).toBe(2);
  });
  it('groups styles case-insensitively', () => {
    const g = byStyle(buildViews(makeSnap([{ name: 'x', brewery: 'a', style: 'ipa' }, { name: 'y', brewery: 'a', style: 'IPA' }])), people);
    expect(g).toHaveLength(1);
    expect(g[0].count).toBe(2);
  });
  it('finds disagreements, largest first', () => {
    const d = disagreements(views, 5);
    expect(d[0].beer.name).toBe('C');
    expect(d[0].disagreement).toBe(3.1);
  });
  it('puts 10.0 in the top bin and counts everyone', () => {
    const bins = ratingDistribution(views, people);
    expect(bins).toHaveLength(19);
    expect(bins[18].perPerson.ellen).toBe(1);
    expect(bins.reduce((a, b) => a + b.total, 0)).toBe(5);
  });
  it('fills empty months in the timeline', () => {
    const t = timeline(views);
    expect(t.map((m) => m.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(t[1].count).toBe(0);
  });
  it('only draws conclusions with enough data', () => {
    const taste = ourTaste(views, people);
    expect(taste.topBrewery?.label).toBe('Avery'); // 3 beers qualifies, Weihen (2) does not
    expect(taste.mostDivisive?.beer.name).toBe('C');
    expect(taste.mostLoggedStyle?.label).toBe('IPA');
    expect(taste.mostRecent?.beer.name).toBe('E');
    expect(taste.summits.map((s) => s.beer.name)).toEqual(['E']);

    const tiny = ourTaste(buildViews(makeSnap([{ name: 'x', brewery: 'a', scott: 9 }])), people);
    expect(tiny.topBrewery).toBeUndefined();
    expect(tiny.mostLoggedStyle).toBeUndefined();
    expect(tiny.styleTendencies).toHaveLength(0);
    expect(tiny.mostDivisive).toBeUndefined();
  });
  it('groups places', () => {
    const p = byPlace(views);
    expect(p[0].label).toBe('Denver, Colorado, USA');
    expect(p[0].count).toBe(2);
  });
  it('handles an empty history without NaN', () => {
    const s = summarize([], people);
    expect(s.average).toBeUndefined();
    expect(timeline([])).toEqual([]);
    expect(ourTaste([], people).mostRecent).toBeUndefined();
  });
});
