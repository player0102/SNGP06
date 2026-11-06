/* Test de fumée (hors production) — rend l'application dans jsdom. */
import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = 'http://127.0.0.1:3000';
const realFetch = globalThis.fetch;
let cookie = '';

async function login(matricule, password) {
  const res = await realFetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matricule, password }),
  });
  cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  console.log('login', matricule, res.status);
  return res.ok;
}

await login('10001', 'Admin@06');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));

const dom = new JSDOM(fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8'), {
  url: `${BASE}/`,
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;

global.window = window;
global.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
global.localStorage = window.localStorage;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.CustomEvent = window.CustomEvent;
global.Event = window.Event;
global.EventSource = class {
  constructor() { setTimeout(() => this.onopen?.(), 10); }
  addEventListener() {}
  close() {}
};
global.fetch = (input, init = {}) => {
  const url = String(input).startsWith('http') ? String(input) : BASE + String(input);
  return realFetch(url, { ...init, headers: { ...(init.headers || {}), cookie } });
};

window.addEventListener('unhandledrejection', (e) => errors.push(`unhandled: ${e.reason?.message || e.reason}`));
window.addEventListener('error', (e) => errors.push(`error: ${e.message}`));

const app = await import('../../public/js/app.js');
await new Promise((r) => setTimeout(r, 900));

const q = (sel) => window.document.querySelector(sel);

console.log('app visible :', !q('#app-shell').hidden);
console.log('login caché :', q('#login-screen').hidden);
console.log('utilisateur :', q('#user-name').textContent, '/', q('#user-role').textContent);
console.log('menu latéral :', window.document.querySelectorAll('.side-item').length, 'entrées');
console.log('dashboard HTML :', q('#workspace').innerHTML.length, 'caractères');

const routes = [
  ['interventions'], ['engins'], ['effectif'], ['historique'], ['gardes'], ['consignes'],
  ['crss'], ['aptitudes'], ['antares'], ['neosis-mobile'], ['administration'], ['mon-compte'],
];
for (const [route] of routes) {
  window.location.hash = `#/${route}`;
  await app.renderRoute();
  await new Promise((r) => setTimeout(r, 250));
  const html = q('#workspace').innerHTML;
  const bad = html.includes('alert-error') || html.includes('Chargement…');
  console.log(`${bad ? '✗' : '✓'} ${route.padEnd(16)} ${html.length} car.`);
  if (bad) {
    const m = html.match(/alert-error[^>]*>(.{0,220})/s);
    console.log('   ↳', m ? m[1].replace(/\s+/g, ' ').slice(0, 200) : html.slice(0, 200));
  }
}

// Détail d'une intervention
const list = await (await fetch('/api/interventions?limit=1')).json();
if (list.items[0]) {
  window.location.hash = `#/intervention/${list.items[0].id}`;
  await app.renderRoute();
  await new Promise((r) => setTimeout(r, 250));
  const html = q('#workspace').innerHTML;
  console.log(`${html.includes('alert-error') ? '✗' : '✓'} intervention/${list.items[0].numero} ${html.length} car.`);
}

console.log('\nErreurs JS :', errors.length);
errors.slice(0, 12).forEach((e) => console.log('  -', e.slice(0, 300)));
process.exit(errors.length ? 1 : 0);
