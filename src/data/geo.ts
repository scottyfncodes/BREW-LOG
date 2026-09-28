// Tiny built-in gazetteer so the Beer Map needs no network or map tiles.
// Only places present in the user's own data are ever drawn.

/** Classic US tile-grid layout: [row, col]. */
export const US_TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 11],
  VT: [1, 10], NH: [1, 11],
  WA: [2, 1], ID: [2, 2], MT: [2, 3], ND: [2, 4], MN: [2, 5], IL: [2, 6], WI: [2, 7], MI: [2, 8], NY: [2, 9], RI: [2, 10], MA: [2, 11],
  OR: [3, 1], NV: [3, 2], WY: [3, 3], SD: [3, 4], IA: [3, 5], IN: [3, 6], OH: [3, 7], PA: [3, 8], NJ: [3, 9], CT: [3, 10],
  CA: [4, 1], UT: [4, 2], CO: [4, 3], NE: [4, 4], MO: [4, 5], KY: [4, 6], WV: [4, 7], VA: [4, 8], MD: [4, 9], DE: [4, 10],
  AZ: [5, 2], NM: [5, 3], KS: [5, 4], AR: [5, 5], TN: [5, 6], NC: [5, 7], SC: [5, 8], DC: [5, 9],
  OK: [6, 4], LA: [6, 5], MS: [6, 6], AL: [6, 7], GA: [6, 8],
  HI: [7, 0], TX: [7, 4], FL: [7, 9],
};

const STATE_NAMES: Record<string, string> = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado', CT: 'connecticut',
  DE: 'delaware', FL: 'florida', GA: 'georgia', HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts', MI: 'michigan',
  MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new hampshire',
  NJ: 'new jersey', NM: 'new mexico', NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio',
  OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina', SD: 'south dakota',
  TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington', WV: 'west virginia',
  WI: 'wisconsin', WY: 'wyoming', DC: 'district of columbia',
};

export function usStateCode(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.trim().toLowerCase();
  if (t.length === 2 && STATE_NAMES[t.toUpperCase()]) return t.toUpperCase();
  return Object.entries(STATE_NAMES).find(([, n]) => n === t)?.[0];
}

export function stateName(code: string): string {
  return (STATE_NAMES[code] ?? code).replace(/\b\w/g, (c) => c.toUpperCase());
}

// [lat, lon, display name]
const COUNTRIES: Record<string, [number, number, string]> = {
  usa: [39, -98, 'USA'], canada: [56, -106, 'Canada'], mexico: [23, -102, 'Mexico'],
  germany: [51, 10, 'Germany'], belgium: [50.6, 4.6, 'Belgium'], netherlands: [52.2, 5.3, 'Netherlands'],
  uk: [54, -2, 'United Kingdom'], england: [52.8, -1.5, 'England'], scotland: [56.8, -4.2, 'Scotland'], wales: [52.3, -3.7, 'Wales'],
  ireland: [53.2, -8, 'Ireland'], france: [46.5, 2.5, 'France'], spain: [40, -3.7, 'Spain'], portugal: [39.5, -8, 'Portugal'],
  italy: [42.8, 12.5, 'Italy'], switzerland: [46.8, 8.2, 'Switzerland'], austria: [47.5, 14.5, 'Austria'],
  czechia: [49.8, 15.5, 'Czechia'], poland: [52, 19, 'Poland'], denmark: [56, 10, 'Denmark'], norway: [61, 9, 'Norway'],
  sweden: [62, 15, 'Sweden'], finland: [64, 26, 'Finland'], iceland: [65, -18, 'Iceland'], luxembourg: [49.8, 6.1, 'Luxembourg'],
  slovakia: [48.7, 19.7, 'Slovakia'], slovenia: [46.1, 14.8, 'Slovenia'], hungary: [47.2, 19.5, 'Hungary'], croatia: [45.1, 15.2, 'Croatia'],
  estonia: [58.7, 25.5, 'Estonia'], latvia: [56.9, 24.6, 'Latvia'], lithuania: [55.2, 23.9, 'Lithuania'], greece: [39, 22, 'Greece'],
  turkey: [39, 35, 'Türkiye'], ukraine: [49, 32, 'Ukraine'], russia: [60, 90, 'Russia'], israel: [31.4, 35, 'Israel'],
  japan: [36.5, 138, 'Japan'], china: [35, 103, 'China'], southkorea: [36.5, 127.8, 'South Korea'], taiwan: [23.7, 121, 'Taiwan'],
  vietnam: [16, 107, 'Vietnam'], thailand: [15, 101, 'Thailand'], philippines: [12.5, 122, 'Philippines'], singapore: [1.35, 103.8, 'Singapore'],
  indonesia: [-2, 118, 'Indonesia'], india: [22, 79, 'India'], australia: [-25, 134, 'Australia'], newzealand: [-41.5, 172.5, 'New Zealand'],
  brazil: [-10, -52, 'Brazil'], argentina: [-34, -64, 'Argentina'], chile: [-33, -71, 'Chile'], peru: [-9.5, -75, 'Peru'],
  colombia: [4, -73, 'Colombia'], costarica: [10, -84, 'Costa Rica'], cuba: [21.5, -79, 'Cuba'], puertorico: [18.2, -66.5, 'Puerto Rico'],
  jamaica: [18.1, -77.3, 'Jamaica'], southafrica: [-29, 24, 'South Africa'], kenya: [0.5, 38, 'Kenya'], egypt: [26.5, 30, 'Egypt'],
  morocco: [31.8, -7, 'Morocco'], belize: [17.2, -88.7, 'Belize'], bahamas: [24.5, -77.5, 'Bahamas'],
};

const ALIASES: Record<string, string> = {
  us: 'usa', usofa: 'usa', unitedstates: 'usa', unitedstatesofamerica: 'usa', america: 'usa',
  unitedkingdom: 'uk', greatbritain: 'uk', britain: 'uk', gb: 'uk',
  czechrepublic: 'czechia', korea: 'southkorea', republicofkorea: 'southkorea', holland: 'netherlands',
  deutschland: 'germany', espana: 'spain', turkiye: 'turkey', nz: 'newzealand', mx: 'mexico', ca: 'canada',
};

export function countryInfo(name: string | undefined): { key: string; lat: number; lon: number; name: string } | undefined {
  if (!name) return undefined;
  let k = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
  k = ALIASES[k] ?? k;
  const c = COUNTRIES[k];
  return c ? { key: k, lat: c[0], lon: c[1], name: c[2] } : undefined;
}
