import type { Beer, Brewery, Rating, Snapshot } from '../src/data/types';
import { DEFAULT_PEOPLE } from '../src/data/views';

let n = 0;
export function makeSnap(
  rows: { name: string; brewery: string; style?: string; date?: string; scott?: number; ellen?: number; city?: string; state?: string; country?: string; notes?: string; location?: string; imported?: number }[],
): Snapshot {
  const breweries = new Map<string, Brewery>();
  const beers: Beer[] = [];
  const ratings: Rating[] = [];
  rows.forEach((r, i) => {
    let br = breweries.get(r.brewery);
    if (!br) {
      br = { id: `br${breweries.size}`, name: r.brewery, createdAt: 0, updatedAt: 0 };
      breweries.set(r.brewery, br);
    }
    const id = `b${n++}`;
    beers.push({
      id, breweryId: br.id, name: r.name, style: r.style ?? 'IPA', date: r.date ?? `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      city: r.city, state: r.state, country: r.country, notes: r.notes, location: r.location, importedScore: r.imported,
      createdAt: i, updatedAt: i,
    });
    if (r.scott !== undefined) ratings.push({ id: `${id}:scott`, beerId: id, personId: 'scott', score: r.scott, updatedAt: 0 });
    if (r.ellen !== undefined) ratings.push({ id: `${id}:ellen`, beerId: id, personId: 'ellen', score: r.ellen, updatedAt: 0 });
  });
  return { people: DEFAULT_PEOPLE.map((p) => ({ ...p })), breweries: [...breweries.values()], beers, ratings };
}

const STYLES = ['IPA', 'Hazy IPA', 'Pilsner', 'Lager', 'Stout', 'Sour', 'Porter', 'Pale Ale', 'Saison', 'Gose', 'Kölsch', 'Barleywine', 'Weird Custom Style'];
export function bigSnap(count: number): Snapshot {
  const rows = Array.from({ length: count }, (_, i) => ({
    name: `Beer ${i}`,
    brewery: `Brewery ${i % Math.max(1, Math.floor(count / 4))}`,
    style: STYLES[i % STYLES.length],
    date: `20${20 + (i % 7)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    scott: i % 5 === 0 ? undefined : 1 + ((i * 37) % 91) / 10,
    ellen: i % 7 === 0 ? undefined : 1 + ((i * 53) % 91) / 10,
    city: ['Denver', 'Austin', 'Munich', 'Tokyo'][i % 4],
    state: ['Colorado', 'Texas', 'Bavaria', ''][i % 4] || undefined,
    country: ['USA', 'USA', 'Germany', 'Japan'][i % 4],
  }));
  return makeSnap(rows);
}
