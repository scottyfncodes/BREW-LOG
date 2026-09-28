// Core schema for BREW LOG. Everything is plain, serialisable data so a
// sync layer can be added later without reshaping records.

export type ID = string;

export interface Person {
  id: ID;
  name: string;
  /** Accent colour used in charts. */
  color: string;
  order: number;
}

export interface Brewery {
  id: ID;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export interface Beer {
  id: ID;
  breweryId: ID;
  name: string;
  style: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  /** Where it was consumed: a brewery, bar, home, a friend's house… */
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  abv?: number;
  notes?: string;
  photoId?: ID;
  firstTime?: boolean;
  /**
   * A shared score carried over from an import when no individual scores
   * were available. Individual ratings always take precedence.
   */
  importedScore?: number;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export interface Rating {
  /** `${beerId}:${personId}` */
  id: string;
  beerId: ID;
  personId: ID;
  score: number;
  updatedAt: number;
}

export interface Photo {
  id: ID;
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export interface Snapshot {
  people: Person[];
  breweries: Brewery[];
  beers: Beer[];
  ratings: Rating[];
}

/** A beer joined with everything a screen needs to render it. */
export interface BeerView {
  beer: Beer;
  brewery: Brewery | undefined;
  breweryName: string;
  /** personId -> score */
  scores: Record<ID, number>;
  /** Average of all individual scores present (the Shared Score when ≥2). */
  shared: number | undefined;
  /** Best single number to show: shared, else the only rating, else imported. */
  score: number | undefined;
  /** Absolute difference between the first two people, when both rated. */
  disagreement: number | undefined;
  placeLabel: string;
}
