import fs from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = 'http://127.0.0.1:3000';
const realFetch = globalThis.fetch;
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));

const dom = new JSDOM(fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8'), { url: `${BASE}/`, pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
global.window = window;
global.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true });
global.localStorage = window.localStorage;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.CustomEvent = window.CustomEvent;
global.EventSource = class { constructor(){ setTimeout(()=>this.onopen?.(),5);} addEventListener(){} close(){} };
let cookie = '';
global.fetch = async (input, init = {}) => {
  const url = String(input).startsWith('http') ? String(input) : BASE + input;
  const res = await realFetch(url, { ...init, headers: { ...(init.headers || {}), ...(cookie ? { cookie } : {}) } });
  const set = res.headers.getSetCookie?.() || [];
  for (const c of set) {
    const pair = c.split(';')[0];
    if (pair.endsWith('=')) continue;
    cookie = pair;
  }
  return res;
};

await import('../../public/js/app.js');
await new Promise((r) => setTimeout(r, 600));
const q = (s) => window.document.querySelector(s);
console.log('login affiché :', !q('#login-screen').hidden, '| app cachée :', q('#app-shell').hidden);

// Mauvais mot de passe
q('#login-matricule').value = '10001';
q('#login-password').value = 'mauvais';
q('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 700));
console.log('message erreur :', q('#login-alert').hidden ? '(aucun)' : q('#login-alert').textContent.trim().slice(0, 90));

// Bon mot de passe
q('#login-password').value = 'Admin@06';
q('#login-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 900));
console.log('après connexion — app :', !q('#app-shell').hidden, '| workspace :', q('#workspace').innerHTML.length, 'car.');
console.log('utilisateur :', q('#user-name').textContent);
console.log('erreurs JS :', errors.length);
errors.forEach((e) => console.log(' -', e.slice(0, 200)));
process.exit(0);
