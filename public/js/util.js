/* =====================================================================
   SNGP 06 — utilitaires d'interface
   ===================================================================== */

/* ----------------------------- Formatage ---------------------------- */

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

/** Parse "AAAA-MM-JJ HH:MM:SS" comme une date locale (sans conversion TZ). */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = String(value).match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

const pad = (n) => String(n).padStart(2, '0');

export function fmtDate(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtDateOnly(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function fmtTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtTimeS(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function fmtLongDate(value) {
  const d = parseDate(value) || new Date();
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

export function duree(from, to) {
  const a = parseDate(from);
  const b = to ? parseDate(to) : new Date();
  if (!a || !b) return '—';
  const min = Math.max(0, Math.round((b - a) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

export function elapsed(value) {
  const d = parseDate(value);
  if (!d) return '—';
  const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDaysISO(dateStr, days) {
  const d = parseDate(dateStr) || new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateLongFromISO(dateStr) {
  return fmtLongDate(dateStr);
}

export function initials(prenom = '', nom = '') {
  return `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase();
}

export function fullName(personne) {
  if (!personne) return '—';
  return `${personne.prenom || ''} ${personne.nom || ''}`.trim();
}

export function pad2(n) {
  return pad(n);
}

/* ------------------------------ Badges ----------------------------- */

const STATUTS_CLASSES = {
  Disponible: 'disponible',
  'En intervention': 'engage',
  Engagé: 'engage',
  Engage: 'engage',
  Repos: 'repos',
  Congé: 'conge',
  Formation: 'formation',
  Indisponible: 'indisponible',
  Maintenance: 'maintenance',
  'Clôturée': 'cloturee',
  'Cloturee': 'cloturee',
  'En cours': 'encours',
  Alerte: 'encours',
  'Départ': 'depart',
  'Sur les lieux': 'surplace',
  'En action': 'encours',
  Retour: 'retour',
};
export function badge(statut, extra = '') {
  const cls = STATUTS_CLASSES[statut] || 'outline';
  return `<span class="badge badge-${cls} ${extra}">${esc(statut)}</span>`;
}

export const ROLE_LABEL = {
  admin: 'Administrateur',
  officier: 'Officier',
  operateur: 'Opérateur CTA',
};

export function rolePill(role) {
  return `<span class="role-pill ${esc(role)}">${esc(ROLE_LABEL[role] || role)}</span>`;
}

export function prioriteBadge(p) {
  const key = String(p || 'P3').toLowerCase();
  return `<span class="badge badge-${key}">${esc(p || 'P3')}</span>`;
}

export function familleChip(famille, label) {
  return `<span class="chip">${icon('dot')} ${esc(label || famille)}</span>`;
}

/* --------------------------- Notifications ------------------------- */

export function toast(message, type = 'info', title = '') {
  const root = document.getElementById('toasts');
  if (!root) return;
  const icons = { info: 'bell', success: 'check', error: 'alert', warning: 'alert' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(icons[type] || 'bell')}<div>${title ? `<strong>${esc(title)}</strong>` : ''}${esc(message)}</div>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }, 4800);
}

/* ------------------------------ Modale ----------------------------- */

let openModals = 0;

export function openModal({
  title = 'Information',
  subtitle = '',
  iconName = 'file',
  tone = '',
  size = '',
  body = '',
  footer = '',
  closable = true,
  onMount,
}) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <span class="modal-head-icon ${tone}">${icon(iconName)}</span>
        <div>
          <h3>${esc(title)}</h3>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        ${closable ? `<button class="modal-close" data-close aria-label="Fermer">${icon('x')}</button>` : ''}
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(backdrop);
  openModals++;

  const close = () => {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    openModals--;
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && closable) close();
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && closable) close();
    if (e.target.closest('[data-close]')) close();
  });
  const modal = backdrop.querySelector('.modal');
  if (onMount) onMount(modal, close, backdrop);
  const firstInput = modal.querySelector('input, select, textarea, button.btn-primary');
  if (firstInput) setTimeout(() => firstInput.focus(), 60);
  return { close, el: modal, backdrop };
}

export function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
  openModals = 0;
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmer', tone = 'danger', iconName = 'alert' }) {
  return new Promise((resolve) => {
    const m = openModal({
      title,
      iconName,
      tone: tone === 'danger' ? 'danger' : '',
      size: 'modal-sm',
      body: `<p style="font-size:12.8px;line-height:1.6;color:var(--ink-700)">${message}</p>`,
      footer: `<button class="btn" data-cancel>Annuler</button>
               <button class="btn ${tone === 'danger' ? 'btn-primary' : 'btn-blue'}" data-ok>${esc(confirmLabel)}</button>`,
      onMount(modal, close) {
        modal.querySelector('[data-cancel]').onclick = () => {
          close();
          resolve(false);
        };
        modal.querySelector('[data-ok]').onclick = () => {
          close();
          resolve(true);
        };
        modal.addEventListener('click', (e) => {
          if (e.target.hasAttribute('data-close')) resolve(false);
        });
      },
    });
    m.backdrop.addEventListener('click', (e) => {
      if (e.target === m.backdrop) resolve(false);
    });
  });
}

/* ------------------------------ Divers ----------------------------- */

export function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function skeleton(label = 'Chargement des données…') {
  return `<div class="card"><div class="card-body" style="display:flex;align-items:center;gap:10px;color:var(--muted-500);font-size:12.5px">
    ${icon('refresh', 'spin')} ${esc(label)}
  </div></div>`;
}

/* =====================================================================
   CARTE / SYNOPTIQUE
   ===================================================================== */

const MAP = { w: 1000, h: 640, minLng: 6.85, maxLng: 7.56, minLat: 43.47, maxLat: 44.1 };

export function project(lng, lat) {
  const x = ((lng - MAP.minLng) / (MAP.maxLng - MAP.minLng)) * MAP.w;
  const y = ((MAP.maxLat - lat) / (MAP.maxLat - MAP.minLat)) * MAP.h;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

const COAST = [
  [6.858, 43.478], [6.885, 43.483], [6.905, 43.49], [6.94, 43.508], [6.965, 43.532],
  [6.995, 43.542], [7.017, 43.553], [7.05, 43.556], [7.09, 43.567], [7.124, 43.581],
  [7.148, 43.635], [7.16, 43.662], [7.188, 43.673], [7.21, 43.69], [7.24, 43.698],
  [7.262, 43.7], [7.28, 43.702], [7.3, 43.698], [7.325, 43.7], [7.34, 43.706],
  [7.36, 43.725], [7.4, 43.74], [7.45, 43.76], [7.5, 43.777], [7.54, 43.787], [7.56, 43.79],
];

const VILLES = [
  { nom: 'Nice', lng: 7.262, lat: 43.7102, big: true, dx: 8, dy: 14 },
  { nom: 'Cannes', lng: 7.0174, lat: 43.5528, big: true, dx: -8, dy: -7, anchor: 'end' },
  { nom: 'Antibes', lng: 7.1239, lat: 43.5808, big: true, dx: 10, dy: 4 },
  { nom: 'Grasse', lng: 6.9225, lat: 43.6598, big: true, dx: -9, dy: 4, anchor: 'end' },
  { nom: 'Menton', lng: 7.5, lat: 43.7765, big: true, dx: -10, dy: 3, anchor: 'end' },
  { nom: 'Cagnes-s-Mer', lng: 7.1479, lat: 43.6635, dx: -9, dy: 12, anchor: 'end' },
  { nom: 'St-Laurent', lng: 7.1881, lat: 43.6731, dx: 9, dy: 3 },
  { nom: 'Vence', lng: 7.1119, lat: 43.7225, dx: 9, dy: 3 },
  { nom: 'Valbonne', lng: 7.0086, lat: 43.6414, dx: 8, dy: 3, small: true },
  { nom: 'Carros', lng: 7.1863, lat: 43.7903, dx: 8, dy: 3, small: true },
  { nom: 'Contes', lng: 7.3147, lat: 43.8122, dx: 8, dy: 3, small: true },
  { nom: 'Sospel', lng: 7.4469, lat: 43.8778, dx: 8, dy: 3, small: true },
  { nom: 'St-Martin-Vésubie', lng: 7.3333, lat: 44.0694, dx: 8, dy: 3, small: true },
  { nom: 'Puget-Théniers', lng: 6.8944, lat: 43.9486, dx: 8, dy: 3, small: true },
  { nom: 'Breil-sur-Roya', lng: 7.5144, lat: 43.9422, dx: -8, dy: 3, small: true, anchor: 'end' },
  { nom: 'Théoule', lng: 6.9403, lat: 43.5075, dx: -8, dy: -6, small: true, anchor: 'end' },
];

const CIS_MAP = [
  { code: 'NICE', nom: 'CSP Nice', lng: 7.262, lat: 43.7102 },
  { code: 'ANTIBES', nom: 'CSP Antibes', lng: 7.1239, lat: 43.5808 },
  { code: 'CANNES', nom: 'CSP Cannes', lng: 7.0174, lat: 43.5528 },
  { code: 'GRASSE', nom: 'CIS Grasse', lng: 6.9225, lat: 43.6598 },
  { code: 'MENTON', nom: 'CIS Menton', lng: 7.5, lat: 43.7765 },
  { code: 'CAGNES', nom: 'CIS Cagnes', lng: 7.1479, lat: 43.6635 },
  { code: 'STLAURENT', nom: 'CIS St-Laurent', lng: 7.1881, lat: 43.6731 },
  { code: 'VENCE', nom: 'CIS Vence', lng: 7.1119, lat: 43.7225 },
];

const P1 = '#c8102e';
const P2 = '#e07b00';
const P3 = '#2b6f9e';
const PRIO_COLOR = { P1, P2, P3 };

function polylinePoints(points) {
  return points.map(([lng, lat]) => project(lng, lat).join(',')).join(' ');
}

function pathFrom(points) {
  return points.map(([lng, lat], i) => `${i === 0 ? 'M' : 'L'}${project(lng, lat).join(' ')}`).join(' ');
}

/** Courbe lissée (Catmull-Rom -> Bézier cubique) pour un tracé naturel. */
function smoothPath(points) {
  const pts = points.map(([lng, lat]) => project(lng, lat));
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function mapSvg(interventions = [], { compact = false, showEngins = false, crop = false } = {}) {
  const vb = crop ? { x: 0, y: 235, w: MAP.w, h: 335 } : { x: 0, y: 0, w: MAP.w, h: MAP.h };
  const coastPath = smoothPath(COAST);
  const first = project(COAST[0][0], COAST[0][1]);
  const last = project(COAST[COAST.length - 1][0], COAST[COAST.length - 1][1]);
  const seaPath = `M0,${MAP.h} L${first.join(',')} ${coastPath.slice(coastPath.indexOf('C'))} L${MAP.w},${last[1]} L${MAP.w},${MAP.h} Z`;

  const massifs = [
    'M120,60 L250,30 L320,90 L280,150 L190,170 L110,120 Z',
    'M330,20 L470,10 L540,80 L500,160 L380,150 L300,90 Z',
    'M560,30 L700,10 L790,70 L760,150 L640,170 L560,110 Z',
    'M120,200 L230,170 L300,230 L260,300 L160,310 L90,260 Z',
    'M640,190 L750,170 L830,230 L800,300 L700,310 L630,260 Z',
  ]
    .map((d) => `<path d="${d}" fill="#e8f1e4" opacity="0.75"/>`)
    .join('');

  const highways = [
    [6.87, 43.535], [6.94, 43.555], [7.02, 43.565], [7.1, 43.585], [7.15, 43.645],
    [7.2, 43.675], [7.262, 43.698], [7.33, 43.712], [7.42, 43.748], [7.5, 43.788],
  ];
  const highwayPath = smoothPath(highways);

  const villes = VILLES.map((v) => {
    const [x, y] = project(v.lng, v.lat);
    const r = v.big ? 3 : 2.2;
    return `<g>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#7c93a8" stroke="#ffffff" stroke-width="1.1"/>
      <text x="${x + (v.dx || 6)}" y="${y + (v.dy || 3)}" text-anchor="${v.anchor || 'start'}"
        font-family="Segoe UI, Arial, sans-serif" font-size="${v.small ? 8.6 : 10.5}"
        font-weight="${v.big ? 600 : 500}" fill="${v.big ? '#41566b' : '#7c8d9e'}"
        stroke="#eef4ee" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">${esc(v.nom)}</text>
    </g>`;
  }).join('');

  const cisMarks = CIS_MAP.map((c) => {
    const [x, y] = project(c.lng, c.lat);
    return `<g class="marker" data-cis="${c.code}">
      <rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.6" fill="#ffffff" stroke="#2b6f9e" stroke-width="1.5"/>
      <rect x="${x - 2}" y="${y - 2}" width="4" height="4" rx="0.6" fill="#2b6f9e"/>
      <title>${esc(c.nom)}</title>
    </g>`;
  }).join('');

  const markers = interventions
    .filter((iv) => typeof iv.lng === 'number' && typeof iv.lat === 'number')
    .map((iv) => {
      const [x, y] = project(iv.lng, iv.lat);
      const color = PRIO_COLOR[iv.priorite] || P3;
      return `<g class="marker" data-iv="${esc(iv.id)}">
        <circle cx="${x}" cy="${y}" r="9" fill="${color}" fill-opacity="0.18"/>
        <circle cx="${x}" cy="${y}" r="5.6" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
        <title>${esc(iv.numero)} — ${esc(iv.nature)} — ${esc(iv.commune)}</title>
      </g>`;
    })
    .join('');

  const engins = showEngins
    ? CIS_MAP.map((c) => {
        const [x, y] = project(c.lng, c.lat);
        return `<g>
          <rect x="${x + 7}" y="${y - 15}" width="7" height="7" rx="1" fill="#ffffff" stroke="#22384d" stroke-width="1.2"/>
          <text x="${x + 17}" y="${y - 8.5}" font-family="Segoe UI, Arial, sans-serif" font-size="7.4" fill="#33475b">${esc(c.code)}</text>
        </g>`;
      }).join('')
    : '';

  return `<svg class="map-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Carte opérationnelle des Alpes-Maritimes" font-family="Segoe UI, Arial, sans-serif">
    <rect width="${MAP.w}" height="${MAP.h}" fill="#f4f8f3"/>
    ${massifs}
    <path d="M140,320 L260,290 L330,350 L300,430 L200,450 L130,395 Z" fill="#eef4ea" opacity="0.8"/>
    <path d="M520,250 L640,220 L720,290 L690,360 L580,370 L510,310 Z" fill="#eef4ea" opacity="0.8"/>
    <path d="${seaPath}" fill="#bcd9ef"/>
    <path d="${coastPath}" fill="none" stroke="#7fb0d2" stroke-width="2"/>
    <path d="M${project(7.53, 43.79).join(' ')} L${project(7.52, 43.9).join(' ')} L${project(7.49, 44.1).join(' ')}" fill="none" stroke="#c0a9a9" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.8"/>
    <path d="M${project(6.885, 43.47).join(' ')} L${project(6.86, 43.7).join(' ')} L${project(6.86, 44.1).join(' ')}" fill="none" stroke="#c0a9a9" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.8"/>
    <path d="${highwayPath}" fill="none" stroke="#f2c583" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${highwayPath}" fill="none" stroke="#fbe6c4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${project(7.06, 43.55)[0]}" y="${project(7.06, 43.55)[1] + 14}" font-size="9" font-weight="700" fill="#a4864f">A8</text>
    <text x="655" y="${vb.y + vb.h - 34}" text-anchor="middle" font-size="11.5" letter-spacing="4.5" font-weight="600" fill="#5f93b8">MER MÉDITERRANÉE</text>
    ${villes}
    ${cisMarks}
    ${engins}
    ${markers}
    <g transform="translate(${MAP.w - 62}, ${vb.y + 56})" opacity="0.78">
      <circle cx="0" cy="0" r="17" fill="#ffffff" stroke="#9fb2c4" stroke-width="1"/>
      <path d="M0,-13 L4.5,5 L0,1.6 L-4.5,5 Z" fill="#43566a"/>
      <text x="0" y="-21" text-anchor="middle" font-size="9" font-weight="700" fill="#43566a">N</text>
    </g>
    <g transform="translate(${MAP.w - 104}, ${vb.y + vb.h - 22})" opacity="0.82">
      <line x1="0" y1="0" x2="72" y2="0" stroke="#3f566b" stroke-width="1.6"/>
      <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#3f566b" stroke-width="1.6"/>
      <line x1="72" y1="-3.5" x2="72" y2="3.5" stroke="#3f566b" stroke-width="1.6"/>
      <text x="36" y="-7" text-anchor="middle" font-size="8.5" font-weight="700" fill="#3f566b"
        stroke="#bcd9ef" stroke-width="2.4" paint-order="stroke">10 km</text>
    </g>
  </svg>`;
}

export function mapLegend(extra = '') {
  return `<div class="map-legend">
    <span><i class="legend-dot p1"></i> P1 — Secours urgente</span>
    <span><i class="legend-dot p2"></i> P2</span>
    <span><i class="legend-dot p3"></i> P3</span>
    <span><i class="legend-square"></i> Centre de secours</span>
    ${extra}
  </div>`;
}

export const CIS_LABEL = Object.fromEntries(CIS_MAP.map((c) => [c.code, c.nom]));

/* ------------------------ Barres d'activité ------------------------ */

export function activityBars(slots) {
  const max = Math.max(1, ...(slots || []));
  const bars = (slots || []).map((v, i) => {
    const h = Math.max(2, Math.round((v / max) * 100));
    return `<div class="bar" style="height:${h}%" data-tip="${23 - i} h — ${v} intervention(s)">
      <span></span></div>`;
  }).join('');
  return `<div class="activity-chart">${bars}</div>
    <div class="activity-axis"><span>-24 h</span><span>-18 h</span><span>-12 h</span><span>-6 h</span><span>maintenant</span></div>`;
}

/* --------------------------- En-têtes de page ---------------------- */

export function pageHead({ title, subtitle = '', iconName = 'grid', breadcrumb = [], actions = '' }) {
  const crumbs = ['SNGP 06', ...breadcrumb]
    .map((b) => `<span>${esc(b)}</span>`)
    .join(icon('chevron-right'));
  return `<div class="page-head">
    <div class="page-head-main">
      <div class="breadcrumb">${crumbs}</div>
      <h1 class="page-title">${icon(iconName)} ${esc(title)}</h1>
      ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ''}
    </div>
    <div class="page-actions">${actions}</div>
  </div>`;
}

export function emptyState(iconName, title, text = '') {
  return `<div class="empty">${icon(iconName)}<strong>${esc(title)}</strong>${text ? esc(text) : ''}</div>`;
}

export function errorBox(message) {
  return `<div class="alert alert-error">${icon('alert')}<span>${esc(message)}</span></div>`;
}
