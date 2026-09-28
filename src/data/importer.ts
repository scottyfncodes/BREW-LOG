import type { Beer, Brewery, Person, Rating, Snapshot } from './types';
import { buildViews } from './views';
import { toCSV } from './csv';
import { breweryKey, normalizeKey, parseDate, parseScore, titleish, uid } from './util';
import { canonicalStyle } from './styles';

export type FieldKey =
  | 'brewery'
  | 'beer'
  | 'style'
  | `score:${string}`
  | 'shared'
  | 'notes'
  | 'date'
  | 'location'
  | 'place'
  | 'city'
  | 'state'
  | 'country'
  | 'abv'
  | 'firstTime'
  | 'breweryCity'
  | 'breweryState'
  | 'breweryCountry';

export interface FieldDef {
  key: FieldKey;
  label: string;
  hint?: string;
  aliases: RegExp;
}

export function fieldDefs(people: Person[]): FieldDef[] {
  return [
    { key: 'brewery', label: 'Brewery', aliases: /^(brewery|brewer|brewery name|maker|producer)$/i },
    { key: 'beer', label: 'Beer', aliases: /^(beer|beer name|name|beverage|drink)$/i },
    { key: 'style', label: 'Style', aliases: /^(style|type|beer style|beer type|category)$/i },
    ...people.map((p) => ({
      key: `score:${p.id}` as FieldKey,
      label: `${p.name}'s score`,
      aliases: new RegExp(`^(${escapeRe(p.name)}|${escapeRe(p.name)}('?s)? ?(score|rating)|${escapeRe(p.name.charAt(0))})$`, 'i'),
    })),
    { key: 'shared', label: 'Shared score', hint: 'Used only when individual scores are missing', aliases: /^(shared|shared score|avg|average|score|rating|combined|overall|our score)$/i },
    { key: 'date', label: 'Date', aliases: /^(date|date tried|when|day|date consumed|tried)$/i },
    { key: 'notes', label: 'Notes', aliases: /^(notes?|comments?|memory|memories|thoughts|review|description)$/i },
    { key: 'location', label: 'Where (venue)', aliases: /^(where|venue|bar|place consumed|consumed at|where consumed|where it was consumed)$/i },
    { key: 'place', label: 'Location (e.g. "Denver, CO")', hint: 'Split into city / state / country', aliases: /^(location|place|city, ?state)$/i },
    { key: 'city', label: 'City', aliases: /^(city|town)$/i },
    { key: 'state', label: 'State / region', aliases: /^(state|province|region|state\/province|state\/region)$/i },
    { key: 'country', label: 'Country', aliases: /^(country|nation)$/i },
    { key: 'abv', label: 'ABV', aliases: /^(abv|abv ?%|alcohol|alc)$/i },
    { key: 'firstTime', label: 'First time?', aliases: /^(first|first time|first time\??|new|new to us)$/i },
    { key: 'breweryCity', label: 'Brewery city', aliases: /^(brewery city)$/i },
    { key: 'breweryState', label: 'Brewery state', aliases: /^(brewery state|brewery region)$/i },
    { key: 'breweryCountry', label: 'Brewery country', aliases: /^(brewery country)$/i },
  ];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** column index -> field key ('' = ignore) */
export type Mapping = Record<number, FieldKey | ''>;

export function autoMap(headers: string[], people: Person[]): Mapping {
  const defs = fieldDefs(people);
  const used = new Set<string>();
  const mapping: Mapping = {};
  headers.forEach((h, i) => {
    const clean = h.trim().replace(/\s+/g, ' ');
    const def = defs.find((d) => !used.has(d.key) && d.aliases.test(clean));
    mapping[i] = def ? def.key : '';
    if (def) used.add(def.key);
  });
  return mapping;
}

export type RowStatus = 'new' | 'duplicate' | 'repeat' | 'invalid';

export interface ImportRow {
  index: number;
  status: RowStatus;
  issues: string[];
  brewery: string;
  beer: string;
  style: string;
  date?: string;
  scores: Record<string, number>;
  shared?: number;
  notes?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  abv?: number;
  firstTime?: boolean;
  breweryCity?: string;
  breweryState?: string;
  breweryCountry?: string;
}

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

export function expandState(s: string | undefined): string | undefined {
  if (!s) return s;
  const t = s.trim();
  return US_STATES[t.toUpperCase()] ?? t;
}

export function isUSState(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim().toLowerCase();
  return Object.entries(US_STATES).some(([k, v]) => k.toLowerCase() === t || v.toLowerCase() === t);
}

/** "Denver, CO" -> city/state/country; "Munich, Germany" -> city/country. */
export function splitPlace(place: string): { city?: string; state?: string; country?: string } {
  const parts = place.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) {
    if (isUSState(parts[0])) return { state: expandState(parts[0]), country: 'USA' };
    return { city: parts[0] };
  }
  if (parts.length === 2) {
    if (isUSState(parts[1])) return { city: parts[0], state: expandState(parts[1]), country: 'USA' };
    return { city: parts[0], country: parts[1] };
  }
  return { city: parts[0], state: expandState(parts[1]), country: parts.slice(2).join(', ') };
}

function parseBool(s: string): boolean | undefined {
  const t = s.trim().toLowerCase();
  if (!t) return undefined;
  if (['y', 'yes', 'true', '1', 'x', '✓', 'first'].includes(t)) return true;
  if (['n', 'no', 'false', '0'].includes(t)) return false;
  return undefined;
}

function parseAbv(s: string): number | undefined {
  const n = parseFloat(s.replace('%', '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 70) return undefined;
  return Math.round(n * 10) / 10;
}

export function beerKey(brewery: string, beer: string): string {
  return `${breweryKey(brewery)}::${normalizeKey(beer)}`;
}

export function analyzeRows(rows: string[][], mapping: Mapping, snap: Snapshot): ImportRow[] {
  const breweryById = new Map(snap.breweries.map((b) => [b.id, b]));
  const existingExact = new Set<string>();
  const existingBeer = new Set<string>();
  for (const b of snap.beers) {
    const brewery = breweryById.get(b.breweryId)?.name ?? '';
    const k = beerKey(brewery, b.name);
    existingBeer.add(k);
    existingExact.add(`${k}@${b.date}`);
  }
  const seenInFile = new Set<string>();
  const knownStyles = [...new Set(snap.beers.map((b) => b.style))];

  return rows.map((cells, index) => {
    const r: ImportRow = { index, status: 'new', issues: [], brewery: '', beer: '', style: '', scores: {} };
    for (const [col, key] of Object.entries(mapping)) {
      if (!key) continue;
      const raw = (cells[+col] ?? '').trim();
      if (!raw) continue;
      if (key.startsWith('score:')) {
        const s = parseScore(raw);
        if (s === undefined) r.issues.push(`Ignored score “${raw}”`);
        else r.scores[key.slice(6)] = s;
        continue;
      }
      switch (key) {
        case 'brewery': r.brewery = titleish(raw); break;
        case 'beer': r.beer = titleish(raw); break;
        case 'style': r.style = canonicalStyle(raw, knownStyles); break;
        case 'shared': {
          const s = parseScore(raw);
          if (s === undefined) r.issues.push(`Ignored score “${raw}”`);
          else r.shared = s;
          break;
        }
        case 'date': {
          const d = parseDate(raw);
          if (!d) r.issues.push(`Couldn't read date “${raw}”`);
          else r.date = d;
          break;
        }
        case 'notes': r.notes = raw; break;
        case 'location': r.location = raw; break;
        case 'place': {
          const p = splitPlace(raw);
          r.city ??= p.city;
          r.state ??= p.state;
          r.country ??= p.country;
          break;
        }
        case 'city': r.city = raw; break;
        case 'state': r.state = expandState(raw); break;
        case 'country': r.country = raw; break;
        case 'abv': r.abv = parseAbv(raw); break;
        case 'firstTime': r.firstTime = parseBool(raw); break;
        case 'breweryCity': r.breweryCity = raw; break;
        case 'breweryState': r.breweryState = expandState(raw); break;
        case 'breweryCountry': r.breweryCountry = raw; break;
      }
    }
    if (!r.beer) {
      r.status = 'invalid';
      r.issues.unshift('Missing beer name');
      return r;
    }
    const k = beerKey(r.brewery, r.beer);
    const exact = `${k}@${r.date ?? ''}`;
    if (existingExact.has(exact) || seenInFile.has(exact)) {
      r.status = 'duplicate';
    } else if (existingBeer.has(k)) {
      // Same beer, a different day: a genuine re-encounter, but worth flagging.
      r.status = 'repeat';
    }
    seenInFile.add(exact);
    return r;
  });
}

export interface ImportPlan {
  breweries: Brewery[];
  beers: Beer[];
  ratings: Rating[];
}

export function planImport(
  rows: ImportRow[],
  snap: Snapshot,
  opts: { includeDuplicates?: boolean; includeRepeats?: boolean; fallbackDate?: string } = {},
): ImportPlan {
  const now = Date.now();
  const byKey = new Map(snap.breweries.map((b) => [breweryKey(b.name), b]));
  const newBreweries: Brewery[] = [];
  const beers: Beer[] = [];
  const ratings: Rating[] = [];
  const personIds = new Set(snap.people.map((p) => p.id));
  let i = 0;
  for (const r of rows) {
    if (r.status === 'invalid') continue;
    if (r.status === 'duplicate' && !opts.includeDuplicates) continue;
    if (r.status === 'repeat' && opts.includeRepeats === false) continue;
    const breweryName = r.brewery || 'Unknown brewery';
    let brewery = byKey.get(breweryKey(breweryName));
    if (!brewery) {
      brewery = {
        id: uid('br_'),
        name: breweryName,
        city: r.breweryCity,
        state: r.breweryState,
        country: r.breweryCountry,
        createdAt: now,
        updatedAt: now,
      };
      byKey.set(breweryKey(breweryName), brewery);
      newBreweries.push(brewery);
    }
    const id = uid('b_');
    const beer: Beer = {
      id,
      breweryId: brewery.id,
      name: r.beer,
      style: r.style,
      date: r.date ?? opts.fallbackDate ?? '',
      location: r.location,
      city: r.city,
      state: r.state,
      country: r.country,
      abv: r.abv,
      notes: r.notes,
      firstTime: r.firstTime,
      importedScore: Object.keys(r.scores).length ? undefined : r.shared,
      // Preserve file order for same-day entries.
      createdAt: now + i++,
      updatedAt: now,
    };
    beers.push(stripUndefined(beer));
    for (const [personId, score] of Object.entries(r.scores)) {
      if (!personIds.has(personId)) continue;
      ratings.push({ id: `${id}:${personId}`, beerId: id, personId, score, updatedAt: now });
    }
  }
  return { breweries: newBreweries, beers, ratings };
}

/** Drops empty optional fields. Required string fields are kept even when blank. */
const REQUIRED = new Set(['id', 'name', 'style', 'date', 'breweryId']);
export function stripUndefined<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) {
    if (o[k] === undefined || (o[k] === '' && !REQUIRED.has(k as string))) delete o[k];
  }
  return o;
}

// ---------------------------------------------------------------------------
// Export

export function exportCSV(snap: Snapshot): string {
  const people = [...snap.people].sort((a, b) => a.order - b.order);
  const views = buildViews(snap).sort((a, b) => (a.beer.date < b.beer.date ? -1 : a.beer.date > b.beer.date ? 1 : a.beer.createdAt - b.beer.createdAt));
  const header = [
    'Date', 'Brewery', 'Beer', 'Style',
    ...people.map((p) => `${p.name} Score`),
    'Shared Score', 'ABV', 'Where', 'City', 'State', 'Country', 'First Time', 'Notes',
    'Brewery City', 'Brewery State', 'Brewery Country',
  ];
  const rows = views.map((v) => {
    const b = v.beer;
    return [
      b.date, v.breweryName, b.name, b.style,
      ...people.map((p) => v.scores[p.id]?.toFixed(1)),
      (v.shared ?? b.importedScore)?.toFixed(1), b.abv, b.location, b.city, b.state, b.country,
      b.firstTime === undefined ? '' : b.firstTime ? 'Yes' : 'No',
      b.notes,
      v.brewery?.city, v.brewery?.state, v.brewery?.country,
    ];
  });
  return toCSV([header, ...rows]);
}
