import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialDb } from './seed.js';
import { hashPassword } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'sngp06.json');

let state = null;
let saveTimer = null;
let dirty = false;

export function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Migration douce : complète les champs apparus depuis la première installation.
      state.settings = state.settings || {};
      state.sessions = state.sessions || [];
      state.audit = state.audit || [];
      console.log(`[db] base chargée — ${state.interventions.length} interventions, ${state.personnels.length} personnels`);
      return state;
    } catch (err) {
      console.error('[db] base illisible, réinstallation :', err.message);
      fs.renameSync(DATA_FILE, `${DATA_FILE}.corrompu-${Date.now()}`);
    }
  }
  state = buildInitialDb({ hashPassword });
  saveNow();
  console.log('[db] base initialisée');
  return state;
}

export function getDb() {
  if (!state) throw new Error('Base non initialisée');
  return state;
}

/** Écriture différée (200 ms) pour éviter les accès disque répétés. */
export function save() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (dirty) saveNow();
  }, 200);
}

export function saveNow() {
  dirty = false;
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
}

export function resetDb() {
  if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
  state = buildInitialDb({ hashPassword });
  saveNow();
  return state;
}

export function addAudit(entry) {
  const db = getDb();
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  db.audit.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts,
    niveau: 'info',
    ...entry,
  });
  if (db.audit.length > 2000) db.audit.length = 2000;
  save();
}

export function nowString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function parseTs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const t = new Date(String(value).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? null : t;
}
