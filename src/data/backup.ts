import type { Photo, Snapshot } from './types';

export const BACKUP_FORMAT = 'brew-log-backup';
export const BACKUP_VERSION = 1;

interface SerializedPhoto {
  id: string;
  data: string;
  thumb: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface Backup extends Snapshot {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  photos: SerializedPhoto[];
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataURLToBlob(url: string): Blob {
  const [head, body] = url.split(',');
  const mime = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function makeBackup(snap: Snapshot, photos: Photo[]): Promise<Backup> {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...snap,
    photos: await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        data: await blobToDataURL(p.blob),
        thumb: await blobToDataURL(p.thumb),
        width: p.width,
        height: p.height,
        createdAt: p.createdAt,
      })),
    ),
  };
}

export function parseBackup(text: string): { snapshot: Snapshot; photos: Photo[] } {
  let data: Partial<Backup>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (data.format !== BACKUP_FORMAT || !Array.isArray(data.beers)) {
    throw new Error("That doesn't look like a BREW LOG backup.");
  }
  if ((data.version ?? 0) > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of BREW LOG.');
  }
  return {
    snapshot: {
      people: data.people ?? [],
      breweries: data.breweries ?? [],
      beers: data.beers ?? [],
      ratings: data.ratings ?? [],
    },
    photos: (data.photos ?? []).map((p) => ({
      id: p.id,
      blob: dataURLToBlob(p.data),
      thumb: dataURLToBlob(p.thumb),
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
    })),
  };
}

/**
 * Merge a backup into existing data without losing anything: records are
 * matched by id and the most recently updated version wins.
 */
export function mergeSnapshots(current: Snapshot, incoming: Snapshot): { merged: Snapshot; added: number; updated: number } {
  let added = 0;
  let updated = 0;
  function mergeList<T extends { id: string; updatedAt?: number }>(a: T[], b: T[], count = false): T[] {
    const map = new Map(a.map((x) => [x.id, x]));
    for (const x of b) {
      const cur = map.get(x.id);
      if (!cur) {
        map.set(x.id, x);
        if (count) added++;
      } else if ((x.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
        map.set(x.id, x);
        if (count) updated++;
      }
    }
    return [...map.values()];
  }
  const merged: Snapshot = {
    people: mergeList(current.people as (typeof current.people[number] & { updatedAt?: number })[], incoming.people),
    breweries: mergeList(current.breweries, incoming.breweries),
    beers: mergeList(current.beers, incoming.beers, true),
    ratings: mergeList(current.ratings, incoming.ratings),
  };
  return { merged, added, updated };
}
