import { describe, expect, it } from 'vitest';
import { Store, type BeerInput } from '../src/store';
import { IDBRepository } from '../src/data/db';
import { makeBackup, parseBackup } from '../src/data/backup';

let n = 0;
async function fresh(name = `test-${n++}`) {
  const s = new Store(new IDBRepository(name));
  await s.init();
  return { s, name };
}
const base = (over: Partial<BeerInput> = {}): BeerInput => ({
  breweryName: 'Avery Brewing',
  name: 'Maharaja IPA',
  style: 'IPA',
  date: '2026-09-27',
  scores: { scott: 8.4, ellen: 9.0 },
  ...over,
});

describe('store + IndexedDB persistence', () => {
  it('seeds the two tasters on first run', async () => {
    const { s } = await fresh();
    expect(s.people.map((p) => p.name)).toEqual(['Scott', 'Ellen']);
  });

  it('logs a beer and survives a reload', async () => {
    const { s, name } = await fresh();
    const id = await s.saveBeer(base({ notes: 'Big citrus. More bitter than expected.', city: 'Denver', state: 'Colorado' }));
    expect(s.arrival).toBe(id);
    const again = new Store(new IDBRepository(name));
    await again.init();
    const v = again.view(id)!;
    expect(v.beer.name).toBe('Maharaja IPA');
    expect(v.breweryName).toBe('Avery Brewing');
    expect(v.scores).toEqual({ scott: 8.4, ellen: 9 });
    expect(v.shared).toBe(8.7);
    expect(v.beer.notes).toMatch(/citrus/);
    expect(again.people).toHaveLength(2);
  });

  it('builds breweries automatically and reuses them', async () => {
    const { s } = await fresh();
    await s.saveBeer(base());
    await s.saveBeer(base({ name: 'Out of Bounds', breweryName: 'avery brewing co.' }));
    expect(s.snap.breweries).toHaveLength(1);
    await s.saveBeer(base({ name: 'Pils', breweryName: 'Bierstadt' }));
    expect(s.snap.breweries).toHaveLength(2);
  });

  it('supports one, both, or neither rating and edits without losing data', async () => {
    const { s, name } = await fresh();
    const a = await s.saveBeer(base({ scores: { scott: 7.2 } }));
    const b = await s.saveBeer(base({ name: 'x', scores: {} }));
    expect(s.view(a)!.score).toBe(7.2);
    expect(s.view(a)!.shared).toBeUndefined();
    expect(s.view(b)!.score).toBeUndefined();
    await s.saveBeer({ ...base({ scores: { ellen: 9.1, scott: undefined } }), id: a });
    const again = new Store(new IDBRepository(name));
    await again.init();
    expect(again.view(a)!.scores).toEqual({ ellen: 9.1 });
    expect(again.snap.beers).toHaveLength(2);
  });

  it('validates scores and required fields', async () => {
    const { s } = await fresh();
    await expect(s.saveBeer(base({ scores: { scott: 10.5 } }))).rejects.toThrow(/1.0 and 10.0/);
    await expect(s.saveBeer(base({ scores: { scott: 0 } }))).rejects.toThrow();
    await expect(s.saveBeer(base({ name: '  ' }))).rejects.toThrow(/name/);
    await expect(s.saveBeer(base({ breweryName: '' }))).rejects.toThrow(/brewery/i);
    expect(await s.saveBeer(base({ scores: { scott: 10, ellen: 1 } }))).toBeTruthy();
    expect(s.snap.beers).toHaveLength(1);
  });

  it('clears optional fields on edit', async () => {
    const { s } = await fresh();
    const id = await s.saveBeer(base({ notes: 'memory', city: 'Denver', abv: 6.5 }));
    await s.saveBeer({ ...base({ notes: '', city: '', abv: undefined }), id });
    const v = s.view(id)!;
    expect(v.beer.notes).toBeUndefined();
    expect(v.beer.city).toBeUndefined();
    expect(v.beer.abv).toBeUndefined();
  });

  it('stores, replaces and removes photos', async () => {
    const { s, name } = await fresh();
    const photo = { id: 'ph1', blob: new Blob(['full'], { type: 'image/jpeg' }), thumb: new Blob(['t'], { type: 'image/jpeg' }), width: 10, height: 10, createdAt: 1 };
    const id = await s.saveBeer(base({ photo }));
    const again = new Store(new IDBRepository(name));
    await again.init();
    expect(again.view(id)!.beer.photoId).toBe('ph1');
    const stored = await again.repo.getPhoto('ph1');
    expect(stored?.width).toBe(10);
    await again.saveBeer({ ...base({ photo: null }), id });
    expect(again.view(id)!.beer.photoId).toBeUndefined();
    expect(await again.repo.getPhoto('ph1')).toBeUndefined();
  });

  it('deletes a beer with its ratings, and forgets empty breweries', async () => {
    const { s } = await fresh();
    const id = await s.saveBeer(base());
    await s.deleteBeer(id);
    expect(s.snap.beers).toHaveLength(0);
    expect(s.snap.ratings).toHaveLength(0);
    expect(s.snap.breweries).toHaveLength(0);
  });

  it('removes leftover sample data on startup without touching real entries', async () => {
    const { s, name } = await fresh();
    const mine = await s.saveBeer(base());
    const now = Date.now();
    await s.repo.bulkPut({
      breweries: [{ id: 'demo_br_0', name: 'Sample Ales', createdAt: now, updatedAt: now, demo: true }],
      beers: [{ id: 'demo_b_0', breweryId: 'demo_br_0', name: 'Sample', style: 'IPA', date: '2026-01-01', createdAt: now, updatedAt: now, demo: true }],
      ratings: [{ id: 'demo_b_0:scott', beerId: 'demo_b_0', personId: 'scott', score: 8, updatedAt: now }],
    });
    const again = new Store(new IDBRepository(name));
    await again.init();
    expect(again.snap.beers.map((b) => b.id)).toEqual([mine]);
    expect(again.snap.breweries.map((b) => b.name)).toEqual(['Avery Brewing']);
    expect(again.snap.ratings.every((r) => r.beerId === mine)).toBe(true);
  });

  it('backs up and restores by merging', async () => {
    const { s } = await fresh();
    const id = await s.saveBeer(base());
    const backup = await makeBackup(s.snap, await s.repo.allPhotos());
    const { snapshot, photos } = parseBackup(JSON.stringify(backup));
    const { s: other } = await fresh();
    await other.saveBeer(base({ name: 'Already here' }));
    const res = await other.restore(snapshot, photos);
    expect(res.added).toBe(1);
    expect(other.snap.beers).toHaveLength(2);
    expect(other.view(id)!.shared).toBe(8.7);
    // restoring twice adds nothing
    expect((await other.restore(snapshot, photos)).added).toBe(0);
    expect(() => parseBackup('{"hello":1}')).toThrow(/backup/);
  });
});

describe('regressions', () => {
  it('keeps a blank style/date as strings so views never crash', async () => {
    const { s, name } = await fresh();
    const id = await s.saveBeer(base({ style: '', scores: {} }));
    expect(s.view(id)!.beer.style).toBe('');
    const again = new Store(new IDBRepository(name));
    await again.init();
    expect(again.view(id)!.beer.style).toBe('');
  });
});
