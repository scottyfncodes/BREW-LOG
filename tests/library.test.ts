import { describe, expect, it } from 'vitest';
import { buildViews } from '../src/data/views';
import { applyFilters, sortViews } from '../src/data/library';
import { makeSnap, bigSnap } from './helpers';

const snap = makeSnap([
  { name: 'Maharaja', brewery: 'Avery Brewing', style: 'IPA', scott: 8.4, ellen: 9.0, date: '2026-09-27', city: 'Denver', state: 'Colorado', notes: 'Had this after hiking.' },
  { name: 'Prima Pils', brewery: 'Victory', style: 'Pilsner', scott: 6.0, date: '2025-05-01', city: 'Austin', state: 'Texas', location: "Friend's porch" },
  { name: 'Weihenstephaner', brewery: 'Weihenstephan', style: 'Hefeweizen', ellen: 9.6, date: '2024-08-10', city: 'Freising', country: 'Germany' },
  { name: 'Mystery', brewery: 'Nobody Knows', style: 'Sour', date: '2026-01-01' },
]);
const views = buildViews(snap);
const ids = ['scott', 'ellen'];
const names = (vs: typeof views) => vs.map((v) => v.beer.name);

describe('search', () => {
  it('searches beer, brewery, style, location and notes', () => {
    expect(names(applyFilters(views, { q: 'maha' }))).toEqual(['Maharaja']);
    expect(names(applyFilters(views, { q: 'avery' }))).toEqual(['Maharaja']);
    expect(names(applyFilters(views, { q: 'pilsner' }))).toEqual(['Prima Pils']);
    expect(names(applyFilters(views, { q: 'hiking' }))).toEqual(['Maharaja']);
    expect(names(applyFilters(views, { q: 'porch' }))).toEqual(['Prima Pils']);
    expect(names(applyFilters(views, { q: 'germany' }))).toEqual(['Weihenstephaner']);
    expect(names(applyFilters(views, { q: 'denver hiking' }))).toEqual(['Maharaja']);
    expect(applyFilters(views, { q: 'denver pils' })).toHaveLength(0);
  });
});

describe('filters', () => {
  it('filters by style, brewery, dates, rating range and place', () => {
    expect(names(applyFilters(views, { styles: ['ipa'] }))).toEqual(['Maharaja']);
    expect(names(applyFilters(views, { breweryIds: [views[1].beer.breweryId] }))).toEqual(['Prima Pils']);
    expect(names(applyFilters(views, { dateFrom: '2025-01-01', dateTo: '2025-12-31' }))).toEqual(['Prima Pils']);
    expect(names(applyFilters(views, { minScore: 8.5 }))).toEqual(['Maharaja', 'Weihenstephaner']);
    expect(names(applyFilters(views, { maxScore: 7 }))).toEqual(['Prima Pils']);
    expect(names(applyFilters(views, { place: 'texas' }))).toEqual(['Prima Pils']);
  });
  it('filters by who rated', () => {
    expect(names(applyFilters(views, { rater: 'scott' }, ids))).toEqual(['Maharaja', 'Prima Pils']);
    expect(names(applyFilters(views, { rater: 'ellen' }, ids))).toEqual(['Maharaja', 'Weihenstephaner']);
    expect(names(applyFilters(views, { rater: 'both' }, ids))).toEqual(['Maharaja']);
    expect(names(applyFilters(views, { rater: 'none' }, ids))).toEqual(['Mystery']);
  });
});

describe('sorting', () => {
  it('sorts every way the library offers, unrated last', () => {
    expect(names(sortViews(views, 'newest'))).toEqual(['Maharaja', 'Mystery', 'Prima Pils', 'Weihenstephaner']);
    expect(names(sortViews(views, 'oldest'))[0]).toBe('Weihenstephaner');
    expect(names(sortViews(views, 'highest'))).toEqual(['Weihenstephaner', 'Maharaja', 'Prima Pils', 'Mystery']);
    expect(names(sortViews(views, 'lowest'))).toEqual(['Prima Pils', 'Maharaja', 'Weihenstephaner', 'Mystery']);
    expect(names(sortViews(views, 'person:scott')).slice(0, 2)).toEqual(['Maharaja', 'Prima Pils']);
    expect(names(sortViews(views, 'person:ellen'))[0]).toBe('Weihenstephaner');
    expect(names(sortViews(views, 'disagreement'))[0]).toBe('Maharaja');
    expect(names(sortViews(views, 'brewery'))[0]).toBe('Maharaja');
    expect(names(sortViews(views, 'style'))[0]).toBe('Weihenstephaner');
  });
  it('stays fast with thousands of beers', () => {
    const big = buildViews(bigSnap(3000));
    const t = performance.now();
    const r = sortViews(applyFilters(big, { q: 'beer 1', minScore: 5 }, ids), 'highest');
    expect(r.length).toBeGreaterThan(0);
    expect(performance.now() - t).toBeLessThan(250);
  });
});
