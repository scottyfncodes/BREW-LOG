import type { BeerView, ID } from './types';
import { chronoDesc } from './views';
import { normalizeKey } from './util';

export type SortKey =
  | 'newest'
  | 'oldest'
  | 'highest'
  | 'lowest'
  | 'brewery'
  | 'style'
  | 'disagreement'
  | `person:${string}`;

export interface Filters {
  q?: string;
  styles?: string[]; // lowercased style names
  breweryIds?: ID[];
  dateFrom?: string;
  dateTo?: string;
  minScore?: number;
  maxScore?: number;
  place?: string;
  /** 'any' | personId | 'both' | 'none' */
  rater?: string;
  photosOnly?: boolean;
}

export function searchText(v: BeerView): string {
  const b = v.beer;
  return [b.name, v.breweryName, b.style, b.location, b.city, b.state, b.country, b.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.styles?.length) n++;
  if (f.breweryIds?.length) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.minScore !== undefined || f.maxScore !== undefined) n++;
  if (f.place) n++;
  if (f.rater && f.rater !== 'any') n++;
  if (f.photosOnly) n++;
  return n;
}

export function applyFilters(views: BeerView[], f: Filters, personIds: ID[] = []): BeerView[] {
  const tokens = (f.q ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const styles = f.styles?.length ? new Set(f.styles) : undefined;
  const breweries = f.breweryIds?.length ? new Set(f.breweryIds) : undefined;
  const place = f.place ? normalizeKey(f.place) : '';

  return views.filter((v) => {
    const b = v.beer;
    if (tokens.length) {
      const text = searchText(v);
      if (!tokens.every((t) => text.includes(t))) return false;
    }
    if (styles && !styles.has(b.style.trim().toLowerCase())) return false;
    if (breweries && !breweries.has(b.breweryId)) return false;
    if (f.dateFrom && (!b.date || b.date < f.dateFrom)) return false;
    if (f.dateTo && (!b.date || b.date > f.dateTo)) return false;
    if (f.minScore !== undefined && (v.score === undefined || v.score < f.minScore)) return false;
    if (f.maxScore !== undefined && (v.score === undefined || v.score > f.maxScore)) return false;
    if (place) {
      const hay = [b.location, b.city, b.state, b.country].map(normalizeKey);
      if (!hay.some((h) => h && (h.includes(place) || place === h))) return false;
    }
    if (f.rater && f.rater !== 'any') {
      const rated = personIds.filter((id) => v.scores[id] !== undefined);
      if (f.rater === 'both' && rated.length < 2) return false;
      if (f.rater === 'none' && rated.length > 0) return false;
      if (f.rater !== 'both' && f.rater !== 'none' && v.scores[f.rater] === undefined) return false;
    }
    if (f.photosOnly && !b.photoId) return false;
    return true;
  });
}

const undefLast = (a: number | undefined, b: number | undefined, dir: 1 | -1) => {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return (a - b) * dir;
};

export function sortViews(views: BeerView[], sort: SortKey): BeerView[] {
  const out = [...views];
  if (sort.startsWith('person:')) {
    const id = sort.slice(7);
    return out.sort((a, b) => undefLast(a.scores[id], b.scores[id], -1) || chronoDesc(a, b));
  }
  switch (sort) {
    case 'oldest':
      return out.sort((a, b) => -chronoDesc(a, b));
    case 'highest':
      return out.sort((a, b) => undefLast(a.score, b.score, -1) || chronoDesc(a, b));
    case 'lowest':
      return out.sort((a, b) => undefLast(a.score, b.score, 1) || chronoDesc(a, b));
    case 'brewery':
      return out.sort((a, b) => a.breweryName.localeCompare(b.breweryName) || a.beer.name.localeCompare(b.beer.name));
    case 'style':
      return out.sort((a, b) => (a.beer.style || '~').localeCompare(b.beer.style || '~') || chronoDesc(a, b));
    case 'disagreement':
      return out.sort((a, b) => undefLast(a.disagreement, b.disagreement, -1) || chronoDesc(a, b));
    case 'newest':
    default:
      return out.sort(chronoDesc);
  }
}
