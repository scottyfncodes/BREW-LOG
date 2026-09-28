# BREW LOG

A personal beer journal for two. Log the beers you meet, wherever you meet them, and watch your history grow into a landscape.

**Live app:** https://scottyfncodes.github.io/BREW-LOG/

- **Home** — the Beer Landscape. Each style is a mountain range, each beer a light placed at the height of its score (1.0 in the foothills, 10.0 on the summit), each brewery a star, each place a cairn on the trail. It starts as an empty twilight horizon and deepens into a full night sky as history accumulates.
- **Log** — beer, brewery, style, a tactile 1.0–10.0 score for Scott and Ellen (either, both, or neither), date, notes, photo, and optional place/ABV/first-time.
- **Beers** — searchable library (name, brewery, style, place, notes) with filters and sorts including each person's rating and biggest disagreement.
- **Breweries** — built automatically from what you've actually logged.
- **Insights** — "Our taste" observations (only when the data supports them), style breakdown, per-person style ratings, rating distribution, brewery performance, timeline, disagreements, and a Beer Map drawn only from your own places.
- **Settings** — CSV import (column mapping, preview, duplicate detection), CSV export, full JSON backup/restore with photos, names, theme.

## Data

Everything is stored on-device in IndexedDB (no account, no server). Photos are resized to ≤1600px JPEG with a 480px thumbnail. The app requests persistent storage; export a backup now and then.

Schema (`src/data/types.ts`): `Person`, `Brewery`, `Beer`, `Rating` (one per beer per person), `Photo`. The shared score is always computed (average of individual ratings) and never stored over them. All persistence goes through the `Repository` interface in `src/data/db.ts`, so a sync backend can be added later.

## Develop

```sh
npm install
npm run dev          # local dev server
npm run typecheck
npm test             # unit tests (vitest + fake-indexeddb)
npm run test:e2e     # builds, then Playwright on iPhone + desktop
node scripts/make-icons.mjs   # regenerate app icons
```

Pushing to `main` runs the tests and deploys `dist/` to GitHub Pages via Actions (Settings → Pages → Source: **GitHub Actions**).
