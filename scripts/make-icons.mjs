// Renders the icon artwork to PNGs with the pre-installed Chromium.
// Usage: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { iconSVG } from './icon.svg.mjs';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('favicon.svg', out), iconSVG({ rounded: true }));

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
async function png(name, size, opts) {
  await page.setViewportSize({ width: size, height: size });
  const svg = iconSVG(opts).replace('width="512" height="512"', `width="${size}" height="${size}"`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const buf = await page.locator('svg').screenshot({ omitBackground: true });
  writeFileSync(new URL(name, out), buf);
}
await png('apple-touch-icon.png', 180, {});
await png('icon-192.png', 192, { rounded: false });
await png('icon-512.png', 512, { rounded: false });
await png('icon-maskable-512.png', 512, { pad: 56 });
await png('favicon-32.png', 32, { rounded: true });
await browser.close();
console.log('icons written');
