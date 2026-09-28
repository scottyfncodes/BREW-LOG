import type { Beer, Brewery, Rating, Snapshot } from './types';
import { hash01 } from './util';

// Clearly-fictional sample history, flagged `demo: true` so it can be
// removed in one tap from Settings without touching real entries.

const BREWERIES: [string, string, string, string][] = [
  ['Switchback Ridge Brewing', 'Denver', 'Colorado', 'USA'],
  ['Aspen Hollow Ales', 'Boulder', 'Colorado', 'USA'],
  ['Cache la Poudre Works', 'Fort Collins', 'Colorado', 'USA'],
  ['Lone Mesa Brewing', 'Austin', 'Texas', 'USA'],
  ['Kelp Line Beer Co.', 'San Diego', 'California', 'USA'],
  ['Brauhaus am Fluss', 'Munich', 'Bavaria', 'Germany'],
  ['Brasserie de la Lanterne', 'Brussels', '', 'Belgium'],
  ['Kumo Brewing', 'Tokyo', '', 'Japan'],
  ['Timberline Fermentory', 'Leadville', 'Colorado', 'USA'],
];

// [brewery idx, name, style, scott, ellen, where, note]
const BEERS: [number, string, string, number | null, number | null, string, string][] = [
  [0, 'Trailhead IPA', 'IPA', 8.4, 9.0, 'Switchback Ridge taproom', 'Big citrus. More bitter than expected.'],
  [0, 'Scree Field Pils', 'Pilsner', 8.1, 8.6, 'Switchback Ridge taproom', ''],
  [1, 'Flatirons Hazy', 'Hazy IPA', 9.1, 8.2, 'Aspen Hollow patio', 'Had this after hiking Chautauqua.'],
  [1, 'Snowmelt Kölsch', 'Kölsch', 7.4, 8.8, 'Home', 'Ellen loved this one.'],
  [2, 'Poudre Canyon Amber', 'Amber', 7.0, 6.2, 'Cache la Poudre Works', ''],
  [2, 'Horsetooth Stout', 'Stout', 9.4, 6.3, "Friend's house", 'We could not agree on this one at all.'],
  [3, 'Barton Springs Lager', 'Lager', 7.8, 8.0, 'Rainey Street bar', 'First beer of the trip.'],
  [3, 'Mesa Sunset Sour', 'Sour', 6.8, 9.2, 'Lone Mesa Brewing', 'Tart, bright, a little funky.'],
  [4, 'Tidepool West Coast', 'West Coast IPA', 9.6, 8.9, 'Kelp Line tasting room', 'Pine and grapefruit. Perfect after the beach.'],
  [4, 'Marine Layer Pale', 'Pale Ale', 7.9, null, 'Hotel bar', ''],
  [5, 'Flusshelles', 'Lager', 9.0, 9.3, 'Beer garden by the river', 'Liter mugs under chestnut trees.'],
  [5, 'Dunkles Holz', 'Dunkel', 8.2, 7.6, 'Brauhaus am Fluss', ''],
  [6, 'Lanterne Tripel', 'Tripel', 8.8, 8.1, 'Grand Place café', 'Terrible weather. Great beer.'],
  [6, 'Petite Saison', 'Saison', 8.0, 8.9, 'Brasserie de la Lanterne', ''],
  [7, 'Kumo Yuzu Wheat', 'Wheat', 7.2, 9.5, 'Izakaya in Shibuya', 'Yuzu everything. Ellen wants to go back.'],
  [7, 'Kumo Black Lager', 'Schwarzbier', 8.3, 7.7, 'Kumo Brewing', ''],
  [8, 'Mosquito Pass Porter', 'Porter', 8.6, 8.4, 'Timberline Fermentory', 'Ten thousand feet up. Tasted like campfire.'],
  [8, 'Summit Double', 'Double IPA', 10.0, 9.2, 'Timberline Fermentory', 'The one we still talk about.'],
  [0, 'Switchback Hazy', 'Hazy IPA', 8.0, 8.4, 'Coors Field', 'Rockies lost. Beer won.'],
  [1, 'Mountain Sun Brown', 'Brown Ale', 6.9, 7.1, 'Home', ''],
  [2, 'Fort Pils', 'Pilsner', 8.5, 8.2, 'Old Town square', ''],
  [3, 'Hill Country Gose', 'Gose', 5.9, 8.4, 'Lone Mesa Brewing', 'Salty. Very salty.'],
  [4, 'Kelp Line Mexican Lager', 'Mexican Lager', 7.6, 7.9, 'Taco shop', ''],
  [0, 'Ridge Runner Red', 'Red Ale', 7.3, null, 'Switchback Ridge taproom', ''],
  [2, 'Poudre Imperial Stout', 'Imperial Stout', 9.2, 7.0, 'Home', 'Fireplace night.'],
  [8, 'Leadville Lager', 'Lager', 7.7, 8.1, 'Camping at Turquoise Lake', 'Cold creek, cold beer.'],
  [1, 'Aspen Hollow IPA', 'IPA', 8.7, 8.5, 'Aspen Hollow patio', ''],
  [5, 'Märzenfest', 'Märzen', 8.9, 8.7, 'Oktoberfest tent', ''],
  [6, 'Rouge Kriek', 'Sour', 7.5, 9.0, 'Brussels bottle shop', ''],
];

export function demoSnapshot(now = Date.now(), today = new Date()): Omit<Snapshot, 'people'> {
  const breweries: Brewery[] = BREWERIES.map(([name, city, state, country], i) => ({
    id: `demo_br_${i}`,
    name,
    city,
    state: state || undefined,
    country,
    createdAt: now,
    updatedAt: now,
    demo: true,
  }));
  const beers: Beer[] = [];
  const ratings: Rating[] = [];
  // Spread entries across the last ~20 months, oldest first.
  const n = BEERS.length;
  BEERS.forEach(([bi, name, style, scott, ellen, where, note], i) => {
    const id = `demo_b_${i}`;
    const daysAgo = Math.round(((n - i) / n) * 600 + hash01(name) * 12);
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const br = breweries[bi];
    beers.push({
      id,
      breweryId: br.id,
      name,
      style,
      date,
      location: where || undefined,
      city: br.city,
      state: br.state,
      country: br.country,
      abv: Math.round((4.2 + hash01(name + 'abv') * 6) * 10) / 10,
      notes: note || undefined,
      firstTime: hash01(name + 'ft') > 0.3,
      createdAt: now - (n - i) * 1000,
      updatedAt: now,
      demo: true,
    });
    if (scott !== null) ratings.push({ id: `${id}:scott`, beerId: id, personId: 'scott', score: scott, updatedAt: now });
    if (ellen !== null) ratings.push({ id: `${id}:ellen`, beerId: id, personId: 'ellen', score: ellen, updatedAt: now });
  });
  return { breweries, beers, ratings };
}
