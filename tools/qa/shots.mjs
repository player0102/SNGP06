/**
 * Capture d'écran de contrôle visuel — SNGP 06
 *
 * Prérequis : serveur lancé sur http://127.0.0.1:3000 et les paquets
 *             puppeteer-core + @sparticuz/chromium installés (--no-save).
 * Usage     : node tools/qa/shots.mjs
 * Sortie    : tools/qa/out/*.png
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:3000';
const OUT = new URL('./out/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  executablePath: await chromium.executablePath(),
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: process.env.QA_LD_LIBRARY_PATH || '' },
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) console.log('CONSOLE:', m.text().slice(0, 200));
});
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(BASE, { waitUntil: 'networkidle2' });
await shot('01-login');

await page.type('#login-matricule', process.env.QA_MATRICULE || '10001');
await page.type('#login-password', process.env.QA_PASSWORD || 'Admin@06');
await Promise.all([page.click('#login-submit'), page.waitForSelector('.page')]);
await wait(1500);
await shot('02-dashboard');

const views = [
  'interventions', 'engins', 'effectif', 'gardes', 'historique', 'consignes',
  'crss', 'aptitudes', 'antares', 'neosis-mobile', 'administration', 'mon-compte',
];
let n = 3;
for (const hash of views) {
  await page.evaluate((h) => { location.hash = '#/' + h; }, hash);
  await wait(1100);
  await shot(`${String(n).padStart(2, '0')}-${hash}`);
  n += 1;
}

await page.evaluate(async () => {
  const r = await fetch('/api/interventions?statut=en_cours&limit=1', { credentials: 'same-origin' });
  const d = await r.json();
  if (d.items[0]) location.hash = '#/intervention/' + d.items[0].id;
});
await wait(1300);
await shot('15-intervention');

// Modale « Nouvelle alerte »
await page.evaluate(() => { location.hash = '#/interventions'; });
await wait(1100);
const btn = await page.$('[data-act="nouvelle-alerte"]');
if (btn) { await btn.click(); await wait(800); await shot('16-modal-alerte'); }

console.log(`captures écrites dans ${OUT}`);
await browser.close();
