import { useEffect, useState } from 'preact/hooks';
import type { Beer, BeerView, Brewery, ID, Person, Photo, Rating, Snapshot } from './data/types';
import { IDBRepository, type Repository } from './data/db';
import { buildViews, DEFAULT_PEOPLE } from './data/views';
import { demoSnapshot } from './data/demo';
import { breweryKey, isValidScore, round1, titleish, todayISO, uid } from './data/util';
import { canonicalStyle } from './data/styles';
import { mergeSnapshots } from './data/backup';
import { stripUndefined, type ImportPlan } from './data/importer';

export interface BeerInput {
  id?: ID;
  breweryName: string;
  name: string;
  style: string;
  date: string;
  scores: Record<ID, number | undefined>;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  abv?: number;
  notes?: string;
  firstTime?: boolean;
  /** New photo to attach, or null to remove the existing one. */
  photo?: Photo | null;
}

export class ValidationError extends Error {}

export function validateInput(input: BeerInput): string[] {
  const errs: string[] = [];
  if (!input.name.trim()) errs.push('Give the beer a name.');
  if (!input.breweryName.trim()) errs.push('Which brewery made it?');
  for (const s of Object.values(input.scores)) {
    if (s !== undefined && !isValidScore(s)) errs.push('Scores must be between 1.0 and 10.0.');
  }
  if (input.abv !== undefined && (!Number.isFinite(input.abv) || input.abv < 0 || input.abv > 70)) errs.push('ABV looks off.');
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errs.push('Date should be a calendar date.');
  return errs;
}

type Listener = () => void;

export class Store {
  snap: Snapshot = { people: [], breweries: [], beers: [], ratings: [] };
  views: BeerView[] = [];
  ready = false;
  error?: string;
  /** Most recently saved beer, so Home can animate it into the landscape. */
  arrival?: ID;
  private listeners = new Set<Listener>();
  private photoUrls = new Map<string, string>();

  constructor(public repo: Repository = new IDBRepository()) {}

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    this.views = buildViews(this.snap);
    for (const l of this.listeners) l();
  }

  get people(): Person[] {
    return [...this.snap.people].sort((a, b) => a.order - b.order);
  }

  async init() {
    try {
      this.snap = await this.repo.load();
      if (!this.snap.people.length) {
        await this.repo.savePeople(DEFAULT_PEOPLE);
        this.snap.people = DEFAULT_PEOPLE.map((p) => ({ ...p }));
      }
      this.ready = true;
      // Ask the browser not to evict our data under storage pressure.
      navigator.storage?.persist?.().catch(() => undefined);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.ready = true;
    }
    this.emit();
  }

  get hasDemo() {
    return this.snap.beers.some((b) => b.demo);
  }

  view(id: ID) {
    return this.views.find((v) => v.beer.id === id);
  }

  brewery(id: ID) {
    return this.snap.breweries.find((b) => b.id === id);
  }

  findBreweryByName(name: string): Brewery | undefined {
    const k = breweryKey(name);
    if (!k) return undefined;
    return this.snap.breweries.find((b) => breweryKey(b.name) === k);
  }

  async saveBeer(input: BeerInput): Promise<ID> {
    const errs = validateInput(input);
    if (errs.length) throw new ValidationError(errs[0]);
    const now = Date.now();
    const existing = input.id ? this.snap.beers.find((b) => b.id === input.id) : undefined;

    let brewery = this.findBreweryByName(input.breweryName);
    let newBrewery: Brewery | undefined;
    if (!brewery) {
      newBrewery = brewery = { id: uid('br_'), name: titleish(input.breweryName), createdAt: now, updatedAt: now };
    }

    let photoId = existing?.photoId;
    if (input.photo === null && photoId) {
      await this.repo.deletePhoto(photoId);
      this.forgetPhoto(photoId);
      photoId = undefined;
    } else if (input.photo) {
      if (photoId) {
        await this.repo.deletePhoto(photoId);
        this.forgetPhoto(photoId);
      }
      await this.repo.putPhoto(input.photo);
      photoId = input.photo.id;
    }

    const id = existing?.id ?? uid('b_');
    const knownStyles = [...new Set(this.snap.beers.map((b) => b.style))];
    const beer: Beer = stripUndefined({
      ...(existing ?? {}),
      id,
      breweryId: brewery.id,
      name: titleish(input.name),
      style: canonicalStyle(input.style, knownStyles),
      date: input.date || todayISO(),
      location: input.location?.trim(),
      city: input.city?.trim(),
      state: input.state?.trim(),
      country: input.country?.trim(),
      abv: input.abv,
      notes: input.notes?.trim(),
      firstTime: input.firstTime,
      photoId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } as Beer);
    if (existing) {
      // Explicitly cleared optional fields must not survive via the spread.
      for (const k of ['location', 'city', 'state', 'country', 'abv', 'notes', 'firstTime', 'photoId'] as const) {
        if (beer[k] === undefined) delete beer[k];
      }
      if (!photoId) delete beer.photoId;
      // Keep an imported shared score only while nobody has rated it.
    }
    const ratings: Rating[] = Object.entries(input.scores)
      .filter((e): e is [string, number] => e[1] !== undefined)
      .map(([personId, score]) => ({ id: `${id}:${personId}`, beerId: id, personId, score: round1(score), updatedAt: now }));

    await this.repo.saveBeer(beer, ratings, newBrewery);

    if (newBrewery) this.snap.breweries = [...this.snap.breweries, newBrewery];
    this.snap.beers = existing ? this.snap.beers.map((b) => (b.id === id ? beer : b)) : [...this.snap.beers, beer];
    this.snap.ratings = [...this.snap.ratings.filter((r) => r.beerId !== id), ...ratings];
    if (!existing) this.arrival = id;
    await this.pruneOrphanBreweries();
    this.emit();
    return id;
  }

  async deleteBeer(id: ID) {
    const beer = this.snap.beers.find((b) => b.id === id);
    await this.repo.deleteBeer(id);
    if (beer?.photoId) this.forgetPhoto(beer.photoId);
    this.snap.beers = this.snap.beers.filter((b) => b.id !== id);
    this.snap.ratings = this.snap.ratings.filter((r) => r.beerId !== id);
    await this.pruneOrphanBreweries();
    this.emit();
  }

  /** Breweries exist only because we drank something there. */
  private async pruneOrphanBreweries() {
    const used = new Set(this.snap.beers.map((b) => b.breweryId));
    const orphans = this.snap.breweries.filter((b) => !used.has(b.id));
    for (const o of orphans) await this.repo.deleteBrewery(o.id);
    if (orphans.length) this.snap.breweries = this.snap.breweries.filter((b) => used.has(b.id));
  }

  async updateBrewery(b: Brewery) {
    const next = stripUndefined({ ...b, name: titleish(b.name), updatedAt: Date.now() });
    await this.repo.saveBrewery(next);
    this.snap.breweries = this.snap.breweries.map((x) => (x.id === b.id ? next : x));
    this.emit();
  }

  async updatePeople(people: Person[]) {
    await this.repo.savePeople(people);
    this.snap.people = people;
    this.emit();
  }

  async loadDemo() {
    const demo = demoSnapshot();
    await this.repo.bulkPut(demo);
    const ids = new Set(this.snap.beers.map((b) => b.id));
    this.snap.beers = [...this.snap.beers, ...demo.beers.filter((b) => !ids.has(b.id))];
    const bids = new Set(this.snap.breweries.map((b) => b.id));
    this.snap.breweries = [...this.snap.breweries, ...demo.breweries.filter((b) => !bids.has(b.id))];
    const rids = new Set(this.snap.ratings.map((r) => r.id));
    this.snap.ratings = [...this.snap.ratings, ...demo.ratings.filter((r) => !rids.has(r.id))];
    this.emit();
  }

  async clear(which: 'demo' | 'all') {
    await this.repo.clear(which);
    for (const url of this.photoUrls.values()) URL.revokeObjectURL(url);
    this.photoUrls.clear();
    this.snap = await this.repo.load();
    this.emit();
  }

  async applyImport(plan: ImportPlan) {
    await this.repo.bulkPut(plan);
    this.snap.breweries = [...this.snap.breweries, ...plan.breweries];
    this.snap.beers = [...this.snap.beers, ...plan.beers];
    this.snap.ratings = [...this.snap.ratings, ...plan.ratings];
    this.emit();
  }

  async restore(incoming: Snapshot, photos: Photo[]) {
    const { merged, added, updated } = mergeSnapshots(this.snap, incoming);
    await this.repo.bulkPut(merged, photos);
    this.snap = await this.repo.load();
    this.emit();
    return { added, updated };
  }

  async photoURL(id: ID, size: 'thumb' | 'full' = 'thumb'): Promise<string | undefined> {
    const key = `${id}:${size}`;
    const cached = this.photoUrls.get(key);
    if (cached) return cached;
    const p = await this.repo.getPhoto(id);
    if (!p) return undefined;
    const url = URL.createObjectURL(size === 'thumb' ? p.thumb : p.blob);
    this.photoUrls.set(key, url);
    return url;
  }

  private forgetPhoto(id: ID) {
    for (const size of ['thumb', 'full']) {
      const k = `${id}:${size}`;
      const u = this.photoUrls.get(k);
      if (u) URL.revokeObjectURL(u);
      this.photoUrls.delete(k);
    }
  }
}

export const store = new Store();

/** Re-render when the store changes. */
export function useStore(): Store {
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = store.subscribe(() => setTick((t) => t + 1));
    // The store may have changed (e.g. finished loading) before we subscribed.
    setTick((t) => t + 1);
    return () => {
      off();
    };
  }, []);
  return store;
}

export function usePhoto(id: ID | undefined, size: 'thumb' | 'full' = 'thumb'): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    setUrl(undefined);
    if (id) store.photoURL(id, size).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id, size]);
  return url;
}
