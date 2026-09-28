import type { BeerView, Brewery, ID, Person } from './types';
import { chronoDesc } from './views';
import { mean, round1 } from './util';

export interface Summary {
  count: number;
  breweryCount: number;
  styleCount: number;
  placeCount: number;
  average?: number;
  perPerson: { person: Person; average?: number; count: number }[];
  sharedAverage?: number;
  sharedCount: number;
  firstDate?: string;
  lastDate?: string;
}

const avg1 = (xs: number[]) => {
  const m = mean(xs);
  return m === undefined ? undefined : round1(m);
};

function scored(views: BeerView[]): number[] {
  return views.map((v) => v.score).filter((s): s is number => s !== undefined);
}

function personScores(views: BeerView[], id: ID): number[] {
  return views.map((v) => v.scores[id]).filter((s): s is number => s !== undefined);
}

export function summarize(views: BeerView[], people: Person[]): Summary {
  const breweries = new Set(views.map((v) => v.beer.breweryId));
  const styles = new Set(views.map((v) => v.beer.style.toLowerCase()).filter(Boolean));
  const places = new Set(
    views.map((v) => [v.beer.city, v.beer.state, v.beer.country].filter(Boolean).join('|').toLowerCase()).filter(Boolean),
  );
  const dates = views.map((v) => v.beer.date).filter(Boolean).sort();
  const shared = views.map((v) => v.shared).filter((s): s is number => s !== undefined);
  return {
    count: views.length,
    breweryCount: breweries.size,
    styleCount: styles.size,
    placeCount: places.size,
    average: avg1(scored(views)),
    perPerson: people.map((person) => {
      const s = personScores(views, person.id);
      return { person, average: avg1(s), count: s.length };
    }),
    sharedAverage: avg1(shared),
    sharedCount: shared.length,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
  };
}

export interface GroupStat {
  key: string;
  label: string;
  count: number;
  average?: number;
  perPerson: Record<ID, number | undefined>;
  views: BeerView[];
}

function group(views: BeerView[], people: Person[], keyOf: (v: BeerView) => [string, string]): GroupStat[] {
  const map = new Map<string, { label: string; views: BeerView[] }>();
  for (const v of views) {
    const [key, label] = keyOf(v);
    const g = map.get(key);
    if (g) g.views.push(v);
    else map.set(key, { label, views: [v] });
  }
  return [...map.entries()]
    .map(([key, g]) => ({
      key,
      label: g.label,
      count: g.views.length,
      average: avg1(scored(g.views)),
      perPerson: Object.fromEntries(people.map((p) => [p.id, avg1(personScores(g.views, p.id))])),
      views: g.views,
    }))
    .sort((a, b) => b.count - a.count || (b.average ?? 0) - (a.average ?? 0) || a.label.localeCompare(b.label));
}

export function byStyle(views: BeerView[], people: Person[]): GroupStat[] {
  return group(views, people, (v) => {
    const s = v.beer.style.trim() || 'Unstyled';
    return [s.toLowerCase(), s];
  });
}

export function byBrewery(views: BeerView[], people: Person[]): GroupStat[] {
  return group(views, people, (v) => [v.beer.breweryId, v.breweryName]);
}

export interface BreweryDetail {
  brewery: Brewery;
  views: BeerView[];
  count: number;
  average?: number;
  perPerson: Record<ID, number | undefined>;
  best?: BeerView;
  first?: string;
  last?: string;
  photos: BeerView[];
  notes: BeerView[];
}

export function breweryDetail(brewery: Brewery, all: BeerView[], people: Person[]): BreweryDetail {
  const views = all.filter((v) => v.beer.breweryId === brewery.id).sort(chronoDesc);
  const dates = views.map((v) => v.beer.date).filter(Boolean).sort();
  const best = [...views].filter((v) => v.score !== undefined).sort((a, b) => b.score! - a.score!)[0];
  return {
    brewery,
    views,
    count: views.length,
    average: avg1(scored(views)),
    perPerson: Object.fromEntries(people.map((p) => [p.id, avg1(personScores(views, p.id))])),
    best,
    first: dates[0],
    last: dates[dates.length - 1],
    photos: views.filter((v) => v.beer.photoId),
    notes: views.filter((v) => v.beer.notes?.trim()),
  };
}

/** Half-point histogram from 1.0 to 10.0 (last bin includes 10.0). */
export function ratingDistribution(views: BeerView[], people: Person[]) {
  const bins = Array.from({ length: 19 }, (_, i) => ({
    from: 1 + i * 0.5,
    total: 0,
    perPerson: Object.fromEntries(people.map((p) => [p.id, 0])) as Record<ID, number>,
  }));
  const idx = (s: number) => Math.min(18, Math.max(0, Math.floor((s - 1) / 0.5 + 1e-9)));
  for (const v of views) {
    if (v.score !== undefined) bins[idx(v.score)].total++;
    for (const p of people) {
      const s = v.scores[p.id];
      if (s !== undefined) bins[idx(s)].perPerson[p.id]++;
    }
  }
  return bins;
}

export interface MonthStat {
  key: string; // YYYY-MM
  count: number;
  average?: number;
  views: BeerView[];
}

/** Every month from the first to last entry, including empty months. */
export function timeline(views: BeerView[]): MonthStat[] {
  const dated = views.filter((v) => /^\d{4}-\d{2}/.test(v.beer.date));
  if (!dated.length) return [];
  const map = new Map<string, BeerView[]>();
  for (const v of dated) {
    const k = v.beer.date.slice(0, 7);
    (map.get(k) ?? map.set(k, []).get(k)!).push(v);
  }
  const keys = [...map.keys()].sort();
  const out: MonthStat[] = [];
  let [y, m] = keys[0].split('-').map(Number);
  const [ey, em] = keys[keys.length - 1].split('-').map(Number);
  // Guard against absurd spans from bad dates.
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard++ < 1200) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    const vs = map.get(k) ?? [];
    out.push({ key: k, count: vs.length, average: avg1(scored(vs)), views: vs });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function disagreements(views: BeerView[], limit = 10, threshold = 0): BeerView[] {
  return views
    .filter((v) => v.disagreement !== undefined && v.disagreement > threshold)
    .sort((a, b) => b.disagreement! - a.disagreement! || chronoDesc(a, b))
    .slice(0, limit);
}

export interface PlaceStat {
  key: string;
  city?: string;
  state?: string;
  country?: string;
  label: string;
  count: number;
  average?: number;
  views: BeerView[];
}

export function byPlace(views: BeerView[]): PlaceStat[] {
  const map = new Map<string, PlaceStat>();
  for (const v of views) {
    const { city, state, country } = v.beer;
    if (!city && !state && !country) continue;
    const key = [city, state, country].map((s) => (s ?? '').trim().toLowerCase()).join('|');
    let p = map.get(key);
    if (!p) {
      p = { key, city, state, country, label: [city, state, country].filter(Boolean).join(', '), count: 0, views: [] };
      map.set(key, p);
    }
    p.count++;
    p.views.push(v);
  }
  for (const p of map.values()) p.average = avg1(scored(p.views));
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// "Our Taste": descriptive observations only, each gated on enough data.

export const MIN_STYLE_SAMPLE = 2;
export const MIN_BREWERY_SAMPLE = 3;
export const DIVISIVE_THRESHOLD = 1.0;

export interface Taste {
  styleTendencies: GroupStat[];
  mostLoggedStyle?: GroupStat;
  topBrewery?: GroupStat;
  mostDivisive?: BeerView;
  mostRecent?: BeerView;
  highest?: BeerView;
  summits: BeerView[];
}

export function ourTaste(views: BeerView[], people: Person[]): Taste {
  const styles = byStyle(views, people);
  const styleTendencies = styles
    .filter((s) => s.count >= MIN_STYLE_SAMPLE && s.average !== undefined)
    .sort((a, b) => b.average! - a.average!)
    .slice(0, 6);
  // Only claim a "most logged" style if it is strictly ahead of the rest.
  const mostLoggedStyle = styles[0] && styles[0].count >= 2 && (styles[1]?.count ?? 0) < styles[0].count ? styles[0] : undefined;
  const topBrewery = byBrewery(views, people)
    .filter((b) => b.count >= MIN_BREWERY_SAMPLE && b.average !== undefined)
    .sort((a, b) => b.average! - a.average! || b.count - a.count)[0];
  const [mostDivisive] = disagreements(views, 1, DIVISIVE_THRESHOLD - 1e-9);
  const mostRecent = [...views].sort(chronoDesc)[0];
  const highest = [...views].filter((v) => v.score !== undefined).sort((a, b) => b.score! - a.score! || chronoDesc(a, b))[0];
  const summits = views.filter((v) => v.score === 10 || Object.values(v.scores).some((s) => s === 10));
  return { styleTendencies, mostLoggedStyle, topBrewery, mostDivisive, mostRecent, highest, summits };
}
