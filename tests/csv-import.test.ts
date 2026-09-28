import { describe, expect, it } from 'vitest';
import { parseCSV, toCSV } from '../src/data/csv';
import { analyzeRows, autoMap, exportCSV, planImport, splitPlace } from '../src/data/importer';
import { buildViews, DEFAULT_PEOPLE } from '../src/data/views';
import type { Snapshot } from '../src/data/types';
import { makeSnap } from './helpers';

const empty = (): Snapshot => ({ people: DEFAULT_PEOPLE.map((p) => ({ ...p })), breweries: [], beers: [], ratings: [] });

function merge(s: Snapshot, plan: ReturnType<typeof planImport>): Snapshot {
  return { ...s, breweries: [...s.breweries, ...plan.breweries], beers: [...s.beers, ...plan.beers], ratings: [...s.ratings, ...plan.ratings] };
}

describe('csv', () => {
  it('parses quotes, escaped quotes, newlines in cells, CRLF and BOM', () => {
    const rows = parseCSV('﻿a,b,c\r\n1,"two, too","say ""hi""\nthere"\r\n\r\n3,,x');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'two, too', 'say "hi"\nthere'],
      ['3', '', 'x'],
    ]);
  });
  it('detects semicolon and tab delimiters', () => {
    expect(parseCSV('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCSV('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('round-trips through toCSV', () => {
    const data = [['x', 'a,b', 'q"uote', 'multi\nline', ' pad ']];
    expect(parseCSV(toCSV(data))).toEqual(data);
  });
});

describe('import mapping', () => {
  it('guesses columns from typical spreadsheet headers', () => {
    const m = autoMap(['Date', 'Brewery', 'Beer', 'Style', 'Scott', 'Ellen', 'Avg', 'Notes', 'Location', 'ABV'], DEFAULT_PEOPLE);
    expect(Object.values(m)).toEqual(['date', 'brewery', 'beer', 'style', 'score:scott', 'score:ellen', 'shared', 'notes', 'place', 'abv']);
  });
  it('splits combined locations', () => {
    expect(splitPlace('Denver, CO')).toEqual({ city: 'Denver', state: 'Colorado', country: 'USA' });
    expect(splitPlace('Munich, Germany')).toEqual({ city: 'Munich', country: 'Germany' });
    expect(splitPlace('Texas')).toEqual({ state: 'Texas', country: 'USA' });
  });
});

describe('import analysis & duplicates', () => {
  const csv = `Date,Brewery,Beer,Style,Scott,Ellen,Shared,Notes,Location
9/27/2026,Avery Brewing,Maharaja IPA,IPA,8.4,9.0,,Big citrus.,"Denver, CO"
9/27/2026,Avery Brewing Co.,Maharaja IPA,IPA,8.4,9.0,,dup in file,"Denver, CO"
10/1/2026,Avery,Maharaja IPA,IPA,8.0,,,again later,
,Ghost Brewery,,Stout,5,5,,,
1/2/2025,Oskar Blues,Dale's Pale Ale,pale ale,,,7.9,Only a shared score,
3/3/2025,Oskar Blues,Mama's Little Yella Pils,Pilsner,11,8.1,,bad scott score,`;
  const rows = parseCSV(csv);
  const snap = empty();
  const mapping = autoMap(rows[0], snap.people);
  const analyzed = analyzeRows(rows.slice(1), mapping, snap);

  it('flags in-file duplicates, repeats, and invalid rows', () => {
    expect(analyzed.map((r) => r.status)).toEqual(['new', 'duplicate', 'new', 'invalid', 'new', 'new']);
    expect(analyzed[5].issues[0]).toMatch(/Ignored score/);
    expect(analyzed[5].scores).toEqual({ ellen: 8.1 });
  });

  it('plans an import that reuses breweries and never invents ratings', () => {
    const plan = planImport(analyzed, snap);
    expect(plan.beers).toHaveLength(4);
    expect(plan.breweries.map((b) => b.name)).toEqual(['Avery Brewing', 'Oskar Blues']);
    const next = merge(snap, plan);
    const views = buildViews(next);
    const dale = views.find((v) => v.beer.name === "Dale's Pale Ale")!;
    expect(dale.scores).toEqual({});
    expect(dale.score).toBe(7.9);
    expect(dale.beer.style).toBe('Pale Ale');
    const m = views.find((v) => v.beer.notes === 'Big citrus.')!;
    expect(m.shared).toBe(8.7);
    expect(m.beer.city).toBe('Denver');
    expect(m.beer.state).toBe('Colorado');
  });

  it('detects duplicates against existing data and does not overwrite by default', () => {
    const first = merge(snap, planImport(analyzed, snap));
    const again = analyzeRows(rows.slice(1), mapping, first);
    expect(again.filter((r) => r.status === 'duplicate')).toHaveLength(5);
    expect(planImport(again, first).beers).toHaveLength(0);
    expect(planImport(again, first, { includeDuplicates: true }).beers).toHaveLength(5);
    // existing entries untouched
    expect(first.beers).toHaveLength(4);
  });

  it('marks the same beer on a new date as a repeat, which can be excluded', () => {
    const base = makeSnap([{ name: 'Maharaja IPA', brewery: 'Avery Brewing', date: '2020-01-01' }]);
    const r = analyzeRows(rows.slice(1, 2), mapping, base);
    expect(r[0].status).toBe('repeat');
    expect(planImport(r, base, { includeRepeats: false }).beers).toHaveLength(0);
    expect(planImport(r, base).beers).toHaveLength(1);
    expect(planImport(r, base).breweries).toHaveLength(0);
  });
});

describe('export', () => {
  it('exports everything and re-imports losslessly', () => {
    const snap = makeSnap([
      { name: 'Maharaja', brewery: 'Avery', style: 'IPA', scott: 8.4, ellen: 9.0, date: '2026-09-27', city: 'Denver', state: 'Colorado', country: 'USA', notes: 'Big, "citrus", bitter\nsecond line' },
      { name: 'Solo', brewery: 'Victory', style: 'Pils', ellen: 6.5, date: '2026-01-01' },
      { name: 'Legacy', brewery: 'Victory', style: 'Pils', imported: 7.7, date: '2026-01-02' },
    ]);
    const csv = exportCSV(snap);
    const rows = parseCSV(csv);
    expect(rows[0].slice(0, 7)).toEqual(['Date', 'Brewery', 'Beer', 'Style', 'Scott Score', 'Ellen Score', 'Shared Score']);
    expect(rows).toHaveLength(4);
    const fresh = empty();
    const mapping = autoMap(rows[0], fresh.people);
    const plan = planImport(analyzeRows(rows.slice(1), mapping, fresh), fresh);
    const views = buildViews(merge(fresh, plan));
    const m = views.find((v) => v.beer.name === 'Maharaja')!;
    expect(m.scores).toEqual({ scott: 8.4, ellen: 9 });
    expect(m.beer.notes).toBe('Big, "citrus", bitter\nsecond line');
    expect(m.beer.state).toBe('Colorado');
    expect(views.find((v) => v.beer.name === 'Solo')!.scores).toEqual({ ellen: 6.5 });
    expect(views.find((v) => v.beer.name === 'Legacy')!.score).toBe(7.7);
  });
});
