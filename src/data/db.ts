import type { Beer, Brewery, ID, Person, Photo, Rating, Snapshot } from './types';

/**
 * Persistence boundary. The app only talks to this interface, so a future
 * cloud-sync implementation can wrap or replace the IndexedDB one.
 */
export interface Repository {
  load(): Promise<Snapshot>;
  saveBeer(beer: Beer, ratings: Rating[], brewery?: Brewery): Promise<void>;
  saveBrewery(brewery: Brewery): Promise<void>;
  savePeople(people: Person[]): Promise<void>;
  deleteBeer(id: ID): Promise<void>;
  deleteBrewery(id: ID): Promise<void>;
  bulkPut(data: Partial<Snapshot>, photos?: Photo[]): Promise<void>;
  putPhoto(photo: Photo): Promise<void>;
  getPhoto(id: ID): Promise<Photo | undefined>;
  allPhotos(): Promise<Photo[]>;
  deletePhoto(id: ID): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
  clear(filter?: 'demo' | 'all'): Promise<void>;
}

const DB_NAME = 'brew-log';
const DB_VERSION = 1;
const STORES = ['people', 'breweries', 'beers', 'ratings', 'photos', 'meta'] as const;
type StoreName = (typeof STORES)[number];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export function openDatabase(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('people')) db.createObjectStore('people', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('breweries')) db.createObjectStore('breweries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('beers')) {
        const s = db.createObjectStore('beers', { keyPath: 'id' });
        s.createIndex('breweryId', 'breweryId');
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('ratings')) {
        const s = db.createObjectStore('ratings', { keyPath: 'id' });
        s.createIndex('beerId', 'beerId');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('Database upgrade blocked by another tab'));
  });
}

export class IDBRepository implements Repository {
  private dbp: Promise<IDBDatabase>;

  constructor(name = DB_NAME) {
    this.dbp = openDatabase(name);
  }

  private async tx(stores: StoreName[], mode: IDBTransactionMode) {
    const db = await this.dbp;
    return db.transaction(stores, mode);
  }

  async load(): Promise<Snapshot> {
    const t = await this.tx(['people', 'breweries', 'beers', 'ratings'], 'readonly');
    const [people, breweries, beers, ratings] = await Promise.all([
      req(t.objectStore('people').getAll()),
      req(t.objectStore('breweries').getAll()),
      req(t.objectStore('beers').getAll()),
      req(t.objectStore('ratings').getAll()),
    ]);
    return { people, breweries, beers, ratings } as Snapshot;
  }

  async saveBeer(beer: Beer, ratings: Rating[], brewery?: Brewery): Promise<void> {
    const t = await this.tx(['beers', 'ratings', 'breweries'], 'readwrite');
    if (brewery) t.objectStore('breweries').put(brewery);
    t.objectStore('beers').put(beer);
    const rs = t.objectStore('ratings');
    // Replace this beer's ratings with exactly the provided set.
    const existing = (await req(rs.index('beerId').getAllKeys(beer.id))) as string[];
    const keep = new Set(ratings.map((r) => r.id));
    for (const k of existing) if (!keep.has(k)) rs.delete(k);
    for (const r of ratings) rs.put(r);
    await done(t);
  }

  async saveBrewery(brewery: Brewery): Promise<void> {
    const t = await this.tx(['breweries'], 'readwrite');
    t.objectStore('breweries').put(brewery);
    await done(t);
  }

  async savePeople(people: Person[]): Promise<void> {
    const t = await this.tx(['people'], 'readwrite');
    for (const p of people) t.objectStore('people').put(p);
    await done(t);
  }

  async deleteBeer(id: ID): Promise<void> {
    const t = await this.tx(['beers', 'ratings', 'photos'], 'readwrite');
    const beer = (await req(t.objectStore('beers').get(id))) as Beer | undefined;
    const keys = await req(t.objectStore('ratings').index('beerId').getAllKeys(id));
    for (const k of keys) t.objectStore('ratings').delete(k);
    if (beer?.photoId) t.objectStore('photos').delete(beer.photoId);
    t.objectStore('beers').delete(id);
    await done(t);
  }

  async deleteBrewery(id: ID): Promise<void> {
    const t = await this.tx(['breweries'], 'readwrite');
    t.objectStore('breweries').delete(id);
    await done(t);
  }

  async bulkPut(data: Partial<Snapshot>, photos: Photo[] = []): Promise<void> {
    const t = await this.tx(['people', 'breweries', 'beers', 'ratings', 'photos'], 'readwrite');
    for (const p of data.people ?? []) t.objectStore('people').put(p);
    for (const b of data.breweries ?? []) t.objectStore('breweries').put(b);
    for (const b of data.beers ?? []) t.objectStore('beers').put(b);
    for (const r of data.ratings ?? []) t.objectStore('ratings').put(r);
    for (const p of photos) t.objectStore('photos').put(p);
    await done(t);
  }

  async putPhoto(photo: Photo): Promise<void> {
    const t = await this.tx(['photos'], 'readwrite');
    t.objectStore('photos').put(photo);
    await done(t);
  }

  async getPhoto(id: ID): Promise<Photo | undefined> {
    const t = await this.tx(['photos'], 'readonly');
    return (await req(t.objectStore('photos').get(id))) as Photo | undefined;
  }

  async allPhotos(): Promise<Photo[]> {
    const t = await this.tx(['photos'], 'readonly');
    return (await req(t.objectStore('photos').getAll())) as Photo[];
  }

  async deletePhoto(id: ID): Promise<void> {
    const t = await this.tx(['photos'], 'readwrite');
    t.objectStore('photos').delete(id);
    await done(t);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const t = await this.tx(['meta'], 'readonly');
    return (await req(t.objectStore('meta').get(key))) as T | undefined;
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    const t = await this.tx(['meta'], 'readwrite');
    t.objectStore('meta').put(value as unknown, key);
    await done(t);
  }

  async clear(filter: 'demo' | 'all' = 'all'): Promise<void> {
    if (filter === 'all') {
      const t = await this.tx(['breweries', 'beers', 'ratings', 'photos'], 'readwrite');
      for (const s of ['breweries', 'beers', 'ratings', 'photos'] as const) t.objectStore(s).clear();
      await done(t);
      return;
    }
    const snap = await this.load();
    const demoBeers = snap.beers.filter((b) => b.demo);
    const t = await this.tx(['breweries', 'beers', 'ratings', 'photos'], 'readwrite');
    const demoIds = new Set(demoBeers.map((b) => b.id));
    for (const b of demoBeers) {
      t.objectStore('beers').delete(b.id);
      if (b.photoId) t.objectStore('photos').delete(b.photoId);
    }
    for (const r of snap.ratings) if (demoIds.has(r.beerId)) t.objectStore('ratings').delete(r.id);
    // Only remove demo breweries that no real beer points to.
    const used = new Set(snap.beers.filter((b) => !b.demo).map((b) => b.breweryId));
    for (const br of snap.breweries) if (br.demo && !used.has(br.id)) t.objectStore('breweries').delete(br.id);
    await done(t);
  }
}
