import { describe, expect, it } from 'vitest';
import { breweryKey, clampScore, formatScore, isValidScore, normalizeKey, parseDate, parseScore } from '../src/data/util';

describe('score validation', () => {
  it('accepts 1.0–10.0 with one decimal', () => {
    expect(parseScore('7.5')).toBe(7.5);
    expect(parseScore('8,2')).toBe(8.2);
    expect(parseScore(10)).toBe(10);
    expect(parseScore('1')).toBe(1);
    expect(parseScore(' 9.14 ')).toBe(9.1);
  });
  it('rejects out-of-range and junk', () => {
    for (const bad of ['0', '0.9', '10.1', '11', '-3', 'great', '', null, undefined, NaN]) expect(parseScore(bad)).toBeUndefined();
  });
  it('understands "x/10" and "x/5" notation', () => {
    expect(parseScore('8.5/10')).toBe(8.5);
    expect(parseScore('4/5')).toBe(8);
  });
  it('clamps and formats', () => {
    expect(clampScore(10.04)).toBe(10);
    expect(clampScore(0.2)).toBe(1);
    expect(clampScore(7.349)).toBe(7.3);
    expect(formatScore(10)).toBe('10.0');
    expect(formatScore(undefined)).toBe('—');
    expect(isValidScore(10.0)).toBe(true);
    expect(isValidScore(10.01)).toBe(false);
  });
});

describe('dates', () => {
  it('parses common spreadsheet formats', () => {
    expect(parseDate('2026-09-27')).toBe('2026-09-27');
    expect(parseDate('9/27/2026')).toBe('2026-09-27');
    expect(parseDate('9/27/26')).toBe('2026-09-27');
    expect(parseDate('27.09.2026')).toBe('2026-09-27');
    expect(parseDate('46292')).toBe('2026-09-27'); // Excel serial
    expect(parseDate('Sep 27 2026')).toBe('2026-09-27');
    expect(parseDate('whenever')).toBeUndefined();
    expect(parseDate('13/45/2026')).toBeUndefined();
  });
});

describe('keys', () => {
  it('matches brewery name variants', () => {
    expect(breweryKey('Avery Brewing Co.')).toBe(breweryKey('avery'));
    expect(breweryKey('The Avery Brewing Company')).toBe(breweryKey('Avery Brewing'));
    expect(breweryKey('Brasserie Cantillon')).not.toBe(breweryKey('Avery'));
    expect(breweryKey('Brewery')).toBe('brewery'); // never collapses to empty
    expect(normalizeKey('Märzen!')).toBe('marzen');
  });
});
