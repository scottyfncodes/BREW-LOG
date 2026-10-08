import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const fixture = (f: string) => path.join(here, 'fixtures', f);

async function fresh(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByText('Every beer you two log grows this place.')).toBeVisible();
  return errors;
}

async function rate(page: Page, index: number, fraction: number) {
  const slider = page.getByRole('slider').nth(index);
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const pad = 14;
  await page.mouse.click(box.x + pad + (box.width - pad * 2) * fraction, box.y + 20);
}

// On first run the landscape's own button is the way in; afterwards it's the tab-bar +.
const logLink = (page: Page) => page.getByRole('link', { name: /^(Log a beer|Log your first beer)$/ });

async function logBeer(page: Page, name: string, brewery: string, style: string) {
  await logLink(page).click();
  await page.getByLabel('Beer', { exact: true }).fill(name);
  await page.getByLabel('Brewery').fill(brewery);
  await page.locator('#f-style').fill(style);
}

async function importCSV(page: Page, file: string) {
  await page.goto('./#/import');
  await page.getByLabel('Choose CSV file').setInputFiles(fixture(file));
}

test('empty states are intentional, not a wall of zeros', async ({ page }) => {
  const errors = await fresh(page);
  await expect(page.getByRole('link', { name: 'Log your first beer' })).toBeVisible();
  // One primary action: the tab-bar + steps aside while the landscape's button is there.
  await expect(page.getByRole('link', { name: 'Log a beer' })).toHaveCount(0);
  // The landscape fills the screen down to the tab bar — no dead band, no scroll.
  const fit = await page.evaluate(() => {
    const hero = document.querySelector('.hero')!.getBoundingClientRect();
    const nav = document.querySelector('.nav')!.getBoundingClientRect();
    const cta = [...document.querySelectorAll('a')].find((a) => a.textContent?.includes('Log your first beer'))!.getBoundingClientRect();
    const rail = nav.width < innerWidth / 2;
    return {
      gap: rail ? innerHeight - hero.bottom : nav.top - hero.bottom,
      scroll: document.documentElement.scrollHeight - innerHeight,
      ctaInView: cta.bottom <= (rail ? innerHeight : nav.top),
    };
  });
  expect(Math.abs(fit.gap)).toBeLessThanOrEqual(2);
  expect(fit.scroll).toBeLessThanOrEqual(1);
  expect(fit.ctaInView).toBe(true);
  await expect(page.getByText(/demo/i)).toHaveCount(0);
  await expect(page.locator('.stat-strip')).toHaveCount(0);
  await page.goto('./#/beers');
  await expect(page.getByText('No beers yet.')).toBeVisible();
  await page.goto('./#/breweries');
  await expect(page.getByText('No breweries yet.')).toBeVisible();
  await page.goto('./#/insights');
  await expect(page.getByText('Nothing to see — yet.')).toBeVisible();
  await page.goto('./#/gallery');
  await expect(page.getByText('No photos yet.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('log a beer with two ratings, see it land, and survive a reload', async ({ page }) => {
  const errors = await fresh(page);
  await logBeer(page, 'Maharaja IPA', 'Avery Brewing', 'IPA');
  // Scott ≈ 8.4, Ellen = 10.0 via keyboard
  await rate(page, 0, (8.4 - 1) / 9);
  const ellen = page.getByRole('slider').nth(1);
  await ellen.focus();
  await page.keyboard.press('End');
  await expect(ellen).toHaveAttribute('aria-valuenow', '10');
  await expect(page.getByText('Summit')).toBeVisible();
  await expect(page.locator('.shared-line')).toBeVisible();
  await page.getByLabel('Notes & memories').fill('Had this after hiking.');
  await page.getByRole('button', { name: 'Save beer' }).click();

  await expect(page.getByRole('status')).toContainText('Beer saved');
  await expect(page).toHaveURL(/#\/?$/);
  await expect(page.getByText('Your landscape is beginning to take shape.')).toBeVisible();
  await expect(page.locator('.stat-strip')).toContainText('1');
  await expect(page.getByRole('link', { name: 'Log a beer' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Your landscape is beginning to take shape.')).toBeVisible();
  await page.getByRole('link', { name: /Maharaja IPA/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Maharaja IPA' })).toBeVisible();
  await expect(page.locator('.people')).toContainText('10.0');
  await expect(page.locator('.memory')).toHaveText('Had this after hiking.');
  expect(errors).toEqual([]);
});

test('one-person rating and validation feedback', async ({ page }) => {
  await fresh(page);
  await logLink(page).click();
  await page.getByRole('button', { name: 'Save beer' }).click();
  await expect(page.getByRole('alert')).toContainText('name');
  await page.getByLabel('Beer', { exact: true }).fill('Solo Sipper');
  await page.getByRole('button', { name: 'Save beer' }).click();
  await expect(page.getByRole('alert')).toContainText('brewery');
  await page.getByLabel('Brewery').fill('Somewhere Ales');
  const scott = page.getByRole('slider').first();
  await scott.focus();
  await page.keyboard.press('ArrowRight'); // starts at 7.0 → 7.0 (first touch sets a value)
  await page.keyboard.press('ArrowRight');
  await expect(scott).toHaveAttribute('aria-valuenow', '7.1');
  await page.getByRole('button', { name: 'Save beer' }).click();
  await expect(page.getByRole('status')).toContainText('Beer saved');
  await page.goto('./#/beers');
  await expect(page.locator('.beer-card')).toContainText('7.1');
  await expect(page.locator('.beer-card .who')).toContainText('Scott');
});

test('photo attaches, persists and appears in the gallery', async ({ page }) => {
  await fresh(page);
  await logBeer(page, 'Photo Pils', 'Camera Brewing', 'Pilsner');
  // A tiny valid PNG generated on the fly.
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d')!;
    g.fillStyle = '#c80';
    g.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Add a photo').setInputFiles({ name: 'beer.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByAltText('Selected beer photo')).toBeVisible();
  await page.getByRole('button', { name: 'Save beer' }).click();
  await expect(page.getByRole('status')).toContainText('Beer saved');
  await page.reload();
  await page.goto('./#/gallery');
  await expect(page.locator('.polaroid img')).toBeVisible();
  const w = await page.locator('.polaroid img').evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(w).toBeGreaterThan(0);
});

test('CSV import with preview, duplicate detection, then search & filter', async ({ page }) => {
  await fresh(page);
  await importCSV(page, 'small.csv');
  await expect(page.getByText('2 new')).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 beers' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 2 beers');

  // Same file again: everything is a duplicate, nothing imported by default.
  await importCSV(page, 'small.csv');
  await expect(page.getByText('2 duplicates')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 0 beers' })).toBeDisabled();

  await page.goto('./#/beers');
  await expect(page.locator('.beer-card')).toHaveCount(2);
  await page.getByLabel('Search beers').fill('loved');
  await expect(page.locator('.beer-card')).toHaveCount(1);
  await expect(page.locator('.beer-card')).toContainText('Slow Pour Pils');
  await page.getByLabel('Search beers').fill('');
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^IPA/ }).click();
  await page.getByRole('button', { name: /Show 1 beer/ }).click();
  await expect(page.locator('.beer-card')).toHaveCount(1);
  await page.getByLabel('Sort by').selectOption('disagreement');
  await expect(page.locator('.beer-card')).toContainText('Maharaja');
});

test('CSV export downloads the full history', async ({ page }) => {
  await fresh(page);
  await importCSV(page, 'small.csv');
  await page.getByRole('button', { name: 'Import 2 beers' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 2 beers');
  await page.goto('./#/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV spreadsheet' }).click()]);
  const text = (await (await download.createReadStream()).toArray()).join('');
  expect(text).toContain('Maharaja IPA');
  expect(text).toContain('Scott Score');
  expect(text).toContain('8.7'); // shared score
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Full backup/ }).click()]);
  expect(backup.suggestedFilename()).toMatch(/\.json$/);
});

test('landscape and insights hold up with 150 beers', async ({ page }) => {
  const errors = await fresh(page);
  await importCSV(page, 'history-150.csv');
  await page.getByRole('button', { name: 'Import 150 beers' }).click();
  await expect(page.getByRole('heading', { name: /150 beers/ })).toBeVisible();
  // Tap a light on the landscape and follow it to the beer.
  const canvas = page.locator('.hero canvas');
  const opened = await page.evaluate(() => {
    const c = document.querySelector('.hero canvas') as HTMLCanvasElement;
    return c.width > 0 && c.height > 0;
  });
  expect(opened).toBe(true);
  await page.goto('./#/insights');
  await expect(page.getByText('We tend to rate…')).toBeVisible();
  await expect(page.getByText('Where we disagree')).toBeVisible();
  await expect(page.locator('.tilemap .tile.on').first()).toBeVisible();
  await page.goto('./#/beers');
  await expect(page.locator('.beer-card')).toHaveCount(60); // first page, more on scroll
  await page.goto('./#/breweries');
  await expect(page.locator('.brewery-card')).toHaveCount(31);
  expect(errors).toEqual([]);
  void canvas;
});

test('layout fits the screen without horizontal scroll and controls are labeled', async ({ page }) => {
  await fresh(page);
  await importCSV(page, 'small.csv');
  await page.getByRole('button', { name: 'Import 2 beers' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 2 beers');
  await page.goto('./#/beers');
  const beer = (await page.locator('.beer-card').first().getAttribute('href'))!;
  await page.goto('./#/breweries');
  const brewery = (await page.locator('.brewery-card').first().getAttribute('href'))!;
  for (const route of ['./', './#/log', './#/beers', './#/breweries', './#/insights', './#/settings', './' + beer, './' + brewery]) {
    await page.goto(route);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=slider]')]
        .filter((el) => {
          const e = el as HTMLElement;
          if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false;
          const name = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent?.trim() || (e as HTMLInputElement).labels?.length || e.getAttribute('title') || e.getAttribute('placeholder');
          return !name;
        })
        .map((e) => e.outerHTML.slice(0, 80)),
    );
    expect(unlabeled, `unlabeled controls on ${route}`).toEqual([]);
  }
});

test('PWA: manifest, icons and offline reload', async ({ page, context, browserName }) => {
  await page.goto('./');
  const manifest = await (await page.request.get('./manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  expect(await page.locator('link[rel=apple-touch-icon]').count()).toBe(1);
  expect(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content')).toBe('yes');
  test.skip(browserName !== 'chromium', 'service worker check only in chromium');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('BREW LOG').first()).toBeVisible();
  await expect(page.getByText('Every beer you two log grows this place.')).toBeVisible();
  await context.setOffline(false);
});
