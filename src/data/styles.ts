// Sensible style suggestions. These are only suggestions — any custom
// style is allowed and becomes a first-class category once logged.
export const STYLE_SUGGESTIONS = [
  'IPA',
  'Hazy IPA',
  'West Coast IPA',
  'Double IPA',
  'Pale Ale',
  'Pilsner',
  'Lager',
  'Mexican Lager',
  'Amber',
  'Red Ale',
  'Brown Ale',
  'Porter',
  'Stout',
  'Imperial Stout',
  'Sour',
  'Gose',
  'Wheat',
  'Hefeweizen',
  'Belgian',
  'Saison',
  'Kölsch',
  'Märzen',
  'Bock',
  'Barleywine',
  'Cider',
  'Fruit Beer',
];

/**
 * Broad families used to group the home landscape into ranges, so
 * "Hazy IPA" and "Double IPA" share a mountain while insights still
 * show the exact styles.
 */
const FAMILIES: [string, RegExp][] = [
  ['IPA', /\b(ipa|india pale|neipa|dipa|tipa)\b/i],
  ['Stout', /\bstout\b/i],
  ['Porter', /\bporter\b/i],
  ['Sour', /\b(sour|gose|berliner|lambic|gueuze|wild|flanders|kettle)\b/i],
  ['Pilsner', /\b(pils|pilsner|pilsener)\b/i],
  ['Wheat', /\b(wheat|hefe|weizen|witbier|wit|weiss)\b/i],
  ['Belgian', /\b(belgian|saison|farmhouse|tripel|dubbel|quad|abbey|trappist)\b/i],
  ['Pale Ale', /\b(pale ale|apa|esb|bitter|blonde|golden|cream ale|kölsch|kolsch)\b/i],
  ['Lager', /\b(lager|helles|märzen|marzen|oktoberfest|bock|dunkel|schwarz|vienna|rauch|light)\b/i],
  ['Amber & Brown', /\b(amber|red|brown|scotch|irish|mild|altbier|alt)\b/i],
  ['Strong', /\b(barleywine|barley wine|old ale|wee heavy|strong)\b/i],
  ['Cider & Other', /\b(cider|mead|seltzer|radler|shandy|fruit|kombucha)\b/i],
];

export function styleFamily(style: string): string {
  const s = style.trim();
  if (!s) return 'Unstyled';
  for (const [family, re] of FAMILIES) if (re.test(s)) return family;
  // Unknown custom style: it becomes its own family.
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Canonical display for a style so "ipa" and "IPA" group together. */
export function canonicalStyle(style: string, known: string[] = []): string {
  const s = style.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const lower = s.toLowerCase();
  const hit = [...known, ...STYLE_SUGGESTIONS].find((k) => k.toLowerCase() === lower);
  return hit ?? s;
}
