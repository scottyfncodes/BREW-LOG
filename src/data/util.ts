export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix + rand;
}

/** Round to one decimal, avoiding float noise. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Parse anything that looks like a score into a valid 1.0–10.0 value.
 * Returns undefined for blank or invalid input.
 */
export function parseScore(input: unknown): number | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input === 'number') return isValidScore(input) ? round1(input) : undefined;
  const s = String(input).trim().replace(',', '.');
  if (!s) return undefined;
  // Allow "8.5/10" style values.
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  if (m[2]) {
    const outOf = parseFloat(m[2]);
    if (!outOf) return undefined;
    n = (n / outOf) * 10;
  }
  n = round1(n);
  return isValidScore(n) ? n : undefined;
}

export function isValidScore(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= SCORE_MIN && n <= SCORE_MAX;
}

export function clampScore(n: number): number {
  return round1(Math.min(SCORE_MAX, Math.max(SCORE_MIN, n)));
}

export function formatScore(n: number | undefined): string {
  return n === undefined ? '—' : n.toFixed(1);
}

export function mean(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Parses an ISO date as a local calendar date (no timezone drift). */
export function isoParts(iso: string): { y: number; m: number; d: number } | undefined {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function formatDate(iso: string, style: 'long' | 'short' = 'long'): string {
  const p = isoParts(iso);
  if (!p) return iso || 'Undated';
  return style === 'long'
    ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`
    : `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[+m - 1]} ${y}`;
}

/**
 * Parse loosely formatted dates from spreadsheets into YYYY-MM-DD.
 * Supports ISO, US M/D/Y, D.M.Y, "Sep 27 2026", Excel serial numbers.
 */
export function parseDate(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return ymd(fixYear(+m[3]), +m[1], +m[2]);
  m = s.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{2,4})$/);
  if (m) return ymd(fixYear(+m[3]), +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    // Excel serial date (days since 1899-12-30).
    const ms = Date.UTC(1899, 11, 30) + Math.floor(parseFloat(s)) * 86400000;
    const d = new Date(ms);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return todayISO(new Date(t));
  return undefined;
}

function fixYear(y: number): number {
  if (y >= 100) return y;
  return y + (y > 69 ? 1900 : 2000);
}

function ymd(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fold(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ');
}

/** Case/accent/punctuation-insensitive key. */
export function normalizeKey(s: string | undefined): string {
  return fold(s).replace(/[^a-z0-9]+/g, '');
}

/** Brewery key that also ignores filler words ("Avery Brewing Co." == "Avery"). */
export function breweryKey(s: string | undefined): string {
  const stripped = fold(s)
    .replace(/\b(the|brewing|brewery|breweries|brewers|brewhouse|company|co|beer|craft|ales|inc|llc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
  return stripped || normalizeKey(s);
}

export function titleish(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Small deterministic hash -> [0,1). Used for stable visual placement. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
