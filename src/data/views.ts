import type { Beer, BeerView, Brewery, ID, Person, Rating, Snapshot } from './types';
import { mean, round1 } from './util';

export const DEFAULT_PEOPLE: Person[] = [
  { id: 'scott', name: 'Scott', color: '#c46f1c', order: 0 },
  { id: 'ellen', name: 'Ellen', color: '#008f89', order: 1 },
];

export function placeLabel(b: Pick<Beer, 'location' | 'city' | 'state' | 'country'>): string {
  const geo = [b.city, b.state, b.country && !isHomeCountry(b.country, b.state) ? b.country : undefined]
    .filter(Boolean)
    .join(', ');
  if (b.location && geo) return `${b.location} · ${geo}`;
  return b.location || geo || '';
}

/** Hide "USA" when a US state is already present, to keep labels tidy. */
function isHomeCountry(country: string, state?: string): boolean {
  return !!state && /^(us|usa|united states( of america)?)$/i.test(country.trim());
}

export function sharedScore(scores: number[]): number | undefined {
  const m = mean(scores);
  return m === undefined ? undefined : round1(m);
}

export function buildViews(snap: Snapshot): BeerView[] {
  const breweries = new Map<ID, Brewery>(snap.breweries.map((b) => [b.id, b]));
  const byBeer = new Map<ID, Rating[]>();
  for (const r of snap.ratings) {
    const list = byBeer.get(r.beerId);
    if (list) list.push(r);
    else byBeer.set(r.beerId, [r]);
  }
  const people = [...snap.people].sort((a, b) => a.order - b.order);
  const [p1, p2] = people;

  return snap.beers.map((raw) => {
    // Tolerate records missing required strings (older imports/backups).
    const beer = raw.style === undefined || raw.date === undefined || raw.name === undefined ? { ...raw, style: raw.style ?? '', date: raw.date ?? '', name: raw.name ?? '' } : raw;
    const rs = byBeer.get(beer.id) ?? [];
    const scores: Record<ID, number> = {};
    for (const r of rs) scores[r.personId] = r.score;
    const values = Object.values(scores);
    const shared = values.length >= 2 ? sharedScore(values) : undefined;
    const score = values.length ? sharedScore(values) : beer.importedScore;
    const disagreement =
      p1 && p2 && scores[p1.id] !== undefined && scores[p2.id] !== undefined
        ? round1(Math.abs(scores[p1.id] - scores[p2.id]))
        : undefined;
    const brewery = breweries.get(beer.breweryId);
    return {
      beer,
      brewery,
      breweryName: brewery?.name ?? 'Unknown brewery',
      scores,
      shared,
      score,
      disagreement,
      placeLabel: placeLabel(beer),
    };
  });
}

/** Newest first: by date, then by creation time. */
export function chronoDesc(a: BeerView, b: BeerView): number {
  if (a.beer.date !== b.beer.date) return a.beer.date < b.beer.date ? 1 : -1;
  return b.beer.createdAt - a.beer.createdAt;
}
