import { api, post, setUnauthorizedHandler } from './api.js';
import { state, can, isAdmin, ROLE_LABEL } from './state.js';
import { esc, icon, initials, fmtLongDate, toast, openModal, qs, qsa, closeAllModals } from './util.js';
import { VIEWS } from './views/index.js';

/* =====================================================================
   Définition de la navigation
   ===================================================================== */

const NAV_GROUPS = [
  {
    label: 'Opérations',
    items: [
      { key: 'tableau-de-bord', label: 'Tableau de bord', icon: 'grid' },
      { key: 'interventions', label: 'Synoptique des interventions', icon: 'radio', badge: 'active' },
      { key: 'engins', label: 'Synoptique des engins', icon: 'truck', badge: 'engins' },
      { key: 'historique', label: 'Historique des interventions', icon: 'history' },
    ],
  },
  {
    label: 'Personnel',
    items: [
      { key: 'effectif', label: 'Effectif et disponibilité', icon: 'users' },
      { key: 'gardes', label: 'Feuille de garde', icon: 'calendar' },
      { key: 'aptitudes', label: 'Aptitudes des personnels', icon: 'award' },
    ],
  },
  {
    label: 'Documentation',
    items: [
      { key: 'consignes', label: 'Consignes opérationnelles', icon: 'book' },
      { key: 'crss', label: 'Compte rendu de sortie (CRSS)', icon: 'clipboard' },
      { key: 'antares', label: 'Messages ANTARES', icon: 'send' },
    ],
  },
  {
    label: 'Terminal',
    items: [{ key: 'neosis-mobile', label: 'NEOSIS Web/Mobile', icon: 'mobile' }],
  },
  {
    label: 'Système',
    items: [
      { key: 'administration', label: 'Administration', icon: 'settings', adminOnly: true },
      { key: 'mon-compte', label: 'Mon compte', icon: 'user' },
    ],
  },
];

const MENU_ITEMS = {
  fichier: () => [
    { icon: 'flame', label: 'Nouvelle alerte…', action: 'nouvelle-alerte' },
    { sep: true },
    { icon: 'user', label: 'Mon compte', hash: '#/mon-compte' },
    { icon: 'key', label: 'Changer mon mot de passe…', action: 'change-password' },
    { sep: true },
    { icon: 'printer', label: 'Imprimer la vue courante', action: 'print' },
    { sep: true },
    { icon: 'logout', label: 'Déconnexion', action: 'logout' },
  ],
  edition: () => [
    { icon: 'search', label: 'Recherche globale', action: 'search', meta: 'Ctrl+K' },
    { icon: 'refresh', label: 'Actualiser la vue', action: 'refresh', meta: 'F5' },
    { sep: true },
    { icon: 'plus', label: 'Nouvelle intervention', action: 'nouvelle-alerte' },
    { icon: 'clipboard', label: 'Établir un CRSS', hash: '#/crss' },
    { icon: 'send', label: 'Rédiger un message ANTARES', hash: '#/antares' },
  ],
  serveur: () => [
    { icon: 'shield-check', label: 'État du serveur', action: 'etat-serveur' },
    { icon: 'chart', label: 'Informations système', action: 'infos-systeme' },
    ...(isAdmin()
      ? [
          { icon: 'users', label: 'Sessions actives', action: 'sessions' },
          { icon: 'settings', label: 'Paramètres du système', hash: '#/administration' },
        ]
      : []),
    { sep: true },
    { icon: 'refresh', label: 'Synchroniser les données', action: 'refresh' },
  ],
  nts: () => [
    { icon: 'send', label: 'Transmissions ANTARES', hash: '#/antares' },
    { icon: 'radio', label: 'État du réseau radio', action: 'reseau' },
    { icon: 'list', label: 'Journal des transmissions', action: 'transmissions' },
  ],
  'sapeurs-pompiers': () => [
    { group: 'Sapeurs-Pompiers' },
    { icon: 'users', label: 'Effectif et Disponibilité Sapeurs-Pompiers', hash: '#/effectif' },
    { icon: 'radio', label: 'Synoptique des interventions', hash: '#/interventions' },
    { icon: 'truck', label: 'Synoptique des engins', hash: '#/engins' },
    { sep: true },
    { group: 'NEOSIS Web/Mobile (Sapeurs-Pompiers)' },
    { icon: 'mobile', label: 'Terminal embarqué NEOSIS', hash: '#/neosis-mobile' },
    { icon: 'history', label: 'Historique des interventions', hash: '#/historique' },
    { icon: 'calendar', label: 'Feuille de garde', hash: '#/gardes' },
    { icon: 'book', label: 'Consignes opérationnelles', hash: '#/consignes' },
    { icon: 'clipboard', label: 'Compte Rendu de Sortie de Secours (CRSS)', hash: '#/crss' },
    { icon: 'award', label: 'Aptitudes des personnels', hash: '#/aptitudes' },
    { sep: true },
    { icon: 'send', label: 'Message ANTARES', hash: '#/antares' },
    { sep: true },
    { group: 'Périphériques de terrain' },
    { icon: 'radio', label: 'BIP BIRDY — alertes individuelles', action: 'birdy' },
    { icon: 'mobile', label: 'Tablette Bilan NEOFIBI', action: 'neofibi' },
  ],
};

/* =====================================================================
   Initialisation
   ===================================================================== */

const loginScreen = qs('#login-screen');
const appShell = qs('#app-shell');
const workspace = qs('#workspace');

let eventSource = null;
let heartbeat = null;
let currentMenu = null;

async function boot() {
  setUnauthorizedHandler(() => {
    disconnect();
    showLogin('Votre session a expiré. Veuillez vous reconnecter.');
  });

  wireLogin();
  wireMenubar();
  wireUserMenu();
  wireGlobalShortcuts();
  startClock();

  const saved = localStorage.getItem('sngp06.matricule');
  if (saved) {
    qs('#login-matricule').value = saved;
    qs('#login-remember').checked = true;
    setTimeout(() => qs('#login-password').focus(), 200);
  } else {
    setTimeout(() => qs('#login-matricule').focus(), 200);
  }

  try {
    const data = await api('/api/bootstrap');
    applyBootstrap(data);
    showApp();
  } catch {
    showLogin();
  }
}

function applyBootstrap(data) {
  state.user = data.user;
  state.meta = data.meta;
  state.settings = data.settings;
  state.refs = data.referentiels;
  state.stats = data.stats;
  state.coordination = data.coordination;
}

function showLogin(message = '') {
  appShell.hidden = true;
  loginScreen.hidden = false;
  const alert = qs('#login-alert');
  if (message) {
    alert.hidden = false;
    alert.innerHTML = `${icon('alert')}<span>${esc(message)}</span>`;
  } else {
    alert.hidden = true;
  }
  qs('#login-password').value = '';
  location.hash = '';
}

async function showApp() {
  loginScreen.hidden = true;
  appShell.hidden = false;

  renderUserChip();
  renderSidebar();
  renderStatusbar();

  if (state.user.mdp_a_changer) {
    openForcedPasswordChange();
  }

  wireShellActions();
  connectEvents();
  startHeartbeat();

  if (!location.hash || location.hash === '#') location.hash = '#/tableau-de-bord';
  await renderRoute();
}

/* =====================================================================
   Connexion
   ===================================================================== */

function wireLogin() {
  const form = qs('#login-form');
  const alert = qs('#login-alert');
  const submit = qs('#login-submit');

  qs('#toggle-password').addEventListener('click', () => {
    const input = qs('#login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  qsa('.demo-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      qs('#login-matricule').value = chip.dataset.mat;
      qs('#login-password').value = chip.dataset.pw;
      qs('#login-password').focus();
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const matricule = qs('#login-matricule').value.trim();
    const password = qs('#login-password').value;

    if (!matricule || !password) {
      alert.hidden = false;
      alert.innerHTML = `${icon('alert')}<span>Veuillez renseigner votre matricule et votre mot de passe.</span>`;
      return;
    }

    submit.disabled = true;
    submit.innerHTML = `${icon('refresh', 'spin')} Vérification…`;
    alert.hidden = true;

    try {
      await post('/api/auth/login', { matricule, password });
      if (qs('#login-remember').checked) localStorage.setItem('sngp06.matricule', matricule);
      else localStorage.removeItem('sngp06.matricule');

      const data = await api('/api/bootstrap');
      applyBootstrap(data);
      form.reset();
      await showApp();
      toast(`Bienvenue ${data.user.prenom} ${data.user.nom}`, 'success', 'Connexion établie');
    } catch (err) {
      alert.hidden = false;
      alert.innerHTML = `${icon('alert')}<span>${esc(err.message)}</span>`;
      qs('#login-password').select();
    } finally {
      submit.disabled = false;
      submit.innerHTML = `Se connecter ${icon('arrow-right')}`;
    }
  });
}

async function logout() {
  try {
    await post('/api/auth/logout');
  } catch {
    /* la session est peut-être déjà fermée */
  }
  disconnect();
  state.user = null;
  state.refresh = null;
  closeAllModals();
  showLogin('Vous avez été déconnecté du système.');
}

/* =====================================================================
   Coquille applicative
   ===================================================================== */

function renderUserChip() {
  const u = state.user;
  qs('#user-avatar').textContent = initials(u.prenom, u.nom);
  qs('#user-name').textContent = `${u.prenom} ${u.nom}`;
  qs('#user-role').textContent = `${u.grade} · ${ROLE_LABEL[u.role] || u.role}`;
}

function renderSidebar() {
  const currentKey = (location.hash || '#/tableau-de-bord').replace(/^#\//, '').split('?')[0].split('/')[0];
  const html = NAV_GROUPS.map((group) => {
    const items = group.items
      .filter((it) => !it.adminOnly || isAdmin())
      .map((it) => {
        let badge = '';
        if (it.badge === 'active' && state.stats?.interventions_en_cours) {
          badge = `<span class="side-badge">${state.stats.interventions_en_cours}</span>`;
        }
        if (it.badge === 'engins' && state.stats) {
          badge = `<span class="side-badge neutral">${state.stats.engins_disponibles}/${state.stats.engins_total}</span>`;
        }
        return `<a class="side-item ${it.key === currentKey ? 'active' : ''}" href="#/${it.key}">
          ${icon(it.icon)}<span>${esc(it.label)}</span>${badge}
        </a>`;
      })
      .join('');
    if (!items) return '';
    return `<div class="side-group"><div class="side-group-label">${esc(group.label)}</div></div>${items}`;
  }).join('');

  qs('#sidebar').innerHTML =
    html +
    `<div class="side-footer">
      <strong style="color:var(--ink-700)">${esc(state.settings?.organisation || 'SDIS 06')}</strong><br>
      Serveur CODIS-06-A · ${esc(state.meta?.version || '3.4.1')}<br>
      Zone : Alpes-Maritimes
    </div>`;
}

function renderStatusbar() {
  const s = state.stats;
  const u = state.user;
  qs('#status-alertes').textContent = `${s?.interventions_en_cours ?? 0} alerte${(s?.interventions_en_cours ?? 0) > 1 ? 's' : ''}`;
  qs('#status-garde').textContent = `Garde ${s?.garde || '—'} · ${s?.personnels_disponibles ?? 0} dispo`;
  qs('#status-user').textContent = `${u.grade} ${u.nom} ${u.prenom} — ${u.matricule}`;
  qs('#status-role').textContent = ROLE_LABEL[u.role] || u.role;
}

let menuOpen = null;

function wireMenubar() {
  const menubar = qs('#menubar');

  menubar.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-item[data-menu]');
    if (btn) {
      const key = btn.dataset.menu;
      if (menuOpen === key) {
        closeMenu();
        return;
      }
      openMenu(btn, key);
      return;
    }

    const row = e.target.closest('.menu-row');
    if (row) {
      closeMenu();
      const { hash, action } = row.dataset;
      if (hash) location.hash = hash;
      if (action) runAction(action);
    }
  });

  document.addEventListener('click', (e) => {
    if (menuOpen && !e.target.closest('#menubar')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

function openMenu(button, key) {
  closeMenu();
  const builder = MENU_ITEMS[key];
  if (!builder) return;
  const rows = builder();
  const dd = document.createElement('div');
  dd.className = 'menubar-dropdown';
  dd.style.left = `${button.offsetLeft}px`;
  dd.innerHTML = rows
    .map((r) => {
      if (r.sep) return '<div class="menu-sep"></div>';
      if (r.group) return `<div class="menu-group">${esc(r.group)}</div>`;
      return `<button class="menu-row" data-hash="${esc(r.hash || '')}" data-action="${esc(r.action || '')}">
        ${icon(r.icon || 'file')}<span>${esc(r.label)}</span>
        ${r.meta ? `<span class="menu-row-meta">${esc(r.meta)}</span>` : ''}
      </button>`;
    })
    .join('');
  qs('#menubar').appendChild(dd);
  button.setAttribute('aria-expanded', 'true');
  menuOpen = key;
}

function closeMenu() {
  qsa('.menubar-dropdown').forEach((d) => d.remove());
  qsa('.menu-item[aria-expanded]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  menuOpen = null;
}

function wireUserMenu() {
  const chip = qs('#user-chip');
  const popover = qs('#user-popover');

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !popover.hidden;
    popover.hidden = open;
    chip.setAttribute('aria-expanded', String(!open));
    if (!open) renderUserPopover();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#user-menu')) {
      popover.hidden = true;
      chip.setAttribute('aria-expanded', 'false');
    }
  });

  popover.addEventListener('click', (e) => {
    const item = e.target.closest('.popover-item');
    if (!item) return;
    popover.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
    if (item.dataset.hash) location.hash = item.dataset.hash;
    if (item.dataset.action) runAction(item.dataset.action);
  });
}

function renderUserPopover() {
  const u = state.user;
  qs('#user-popover').innerHTML = `
    <div class="popover-head">
      <span class="avatar" style="background:var(--blue-050);color:var(--blue-700);border-color:#c8def1">${initials(u.prenom, u.nom)}</span>
      <div>
        <strong>${esc(u.grade)} ${esc(u.prenom)} ${esc(u.nom)}</strong>
        <small>Matricule ${esc(u.matricule)} · ${esc(ROLE_LABEL[u.role] || u.role)}</small>
      </div>
    </div>
    <button class="popover-item" data-hash="#/mon-compte">${icon('user')} Mon compte</button>
    <button class="popover-item" data-action="change-password">${icon('key')} Changer de mot de passe</button>
    ${isAdmin() ? `<button class="popover-item" data-hash="#/administration">${icon('settings')} Administration</button>` : ''}
    <div class="popover-sep"></div>
    <button class="popover-item danger" data-action="logout">${icon('logout')} Déconnexion</button>`;
}

let shellWired = false;
function wireShellActions() {
  if (shellWired) return;
  shellWired = true;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el) runAction(el.dataset.act);
  });
  qs('#sidebar').addEventListener('click', (e) => {
    const link = e.target.closest('.side-item');
    if (link) window.scrollTo(0, 0);
  });
  qs('#btn-global-search').addEventListener('click', openGlobalSearch);
}

/* =====================================================================
   Actions communes
   ===================================================================== */

function runAction(action) {
  switch (action) {
    case 'logout':
      logout();
      break;
    case 'refresh':
      renderRoute();
      toast('Données actualisées', 'success');
      break;
    case 'print':
      window.print();
      break;
    case 'nouvelle-alerte':
      if (can('interventions.write')) openNouvelleAlerte();
      else toast('Votre profil ne permet pas de créer une intervention.', 'warning');
      break;
    case 'change-password':
      openChangePassword();
      break;
    case 'search':
      openGlobalSearch();
      break;
    case 'etat-serveur':
      openEtatServeur();
      break;
    case 'infos-systeme':
      openInfosSysteme();
      break;
    case 'sessions':
      location.hash = '#/administration';
      break;
    case 'birdy':
      openBirdy();
      break;
    case 'neofibi':
      openNeofibi();
      break;
    case 'reseau':
      openReseau();
      break;
    case 'transmissions':
      openTransmissions();
      break;
    default:
      break;
  }
}

/* --------------------------- Nouvelle alerte ----------------------- */

export async function openNouvelleAlerte() {
  const refs = state.refs;
  const natures = refs.natures;
  const communes = refs.communes;

  const { close } = openModal({
    title: 'Nouvelle alerte opérationnelle',
    subtitle: 'Enregistrement d’un appel 18 / 112 — Création du dossier SIN',
    iconName: 'flame',
    size: 'modal-lg',
    body: `
      <form id="form-alerte">
        <div class="form-grid">
          <label class="field span-2">
            <span class="field-label">Nature du sinistre <span class="req">*</span></span>
            <select class="select" name="nature" required>
              ${natures.map((n) => `<option value="${esc(n.nature)}">${esc(n.nature)} — ${esc(n.famille)} (${esc(n.priorite)})</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Commune <span class="req">*</span></span>
            <select class="select" name="commune" required>
              ${communes.map((c) => `<option value="${esc(c.commune)}">${esc(c.commune)} — ${esc(c.nom)}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Origine de l’appel</span>
            <select class="select" name="source">
              <option>Appel 18</option>
              <option>Appel 112</option>
              <option>ANTARES</option>
              <option>Détection automatique</option>
              <option>Appel sur site</option>
            </select>
          </label>
          <label class="field span-2">
            <span class="field-label">Adresse <span class="req">*</span></span>
            <input class="input" name="adresse" placeholder="Ex. 12 avenue Jean Médecin" required />
          </label>
          <div class="field span-2">
            <span class="field-label">Priorité de l’intervention</span>
            <div class="prio-picker">
              <label><input type="radio" name="priorite" value="P1" checked /><span><b>P1</b> Secours urgente</span></label>
              <label><input type="radio" name="priorite" value="P2" /><span><b>P2</b> Secours normal</span></label>
              <label><input type="radio" name="priorite" value="P3" /><span><b>P3</b> Différé</span></label>
            </div>
          </div>
          <div class="field span-2">
            <span class="field-label">Engins à engager <span class="field-hint-inline">— facultatif</span></span>
            <div class="engin-picker" id="na-engins"><span class="small muted" style="padding:8px">Chargement des engins disponibles…</span></div>
            <span class="field-hint">Sans sélection, les moyens sont déterminés automatiquement par le CTA.</span>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" data-close>Annuler</button>
          <button type="submit" class="btn btn-primary">${icon('flame')} Enregistrer l’alerte</button>
        </div>
      </form>`,
    onMount(modal) {
      const form = modal.querySelector('#form-alerte');
      const picker = form.querySelector('#na-engins');
      const communeField = form.querySelector('[name=commune]');

      async function loadEngins() {
        const data = await api('/api/engins?statut=Disponible');
        if (!data.items.length) {
          picker.innerHTML = '<span class="small muted" style="padding:8px">Aucun engin disponible.</span>';
          return;
        }
        picker.innerHTML = data.items
          .map((e) => `<label class="engin-opt">
            <input type="checkbox" value="${esc(e.indicatif)}" />
            <span class="engin-opt-id">${esc(e.indicatif)}</span>
            <span class="engin-opt-lib">${esc(e.type_libelle)}</span>
            <span class="engin-opt-cis">${esc(e.cis)}</span>
          </label>`)
          .join('');
      }
      loadEngins().catch(() => {});

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const engins = [...modal.querySelectorAll('#na-engins input:checked')].map((i) => i.value);
        try {
          const res = await api('/api/interventions', {
            method: 'POST',
            body: {
              nature: fd.get('nature'),
              commune: fd.get('commune'),
              adresse: fd.get('adresse'),
              source: fd.get('source'),
              priorite: fd.get('priorite'),
              engins,
            },
          });
          close();
          toast(`Dossier ${res.intervention.numero} créé — ${res.intervention.nature} à ${res.intervention.commune}`, 'success', 'Alerte enregistrée');
          location.hash = `#/intervention/${res.intervention.id}`;
          if (location.hash.includes(res.intervention.id)) renderRoute();
        } catch (err) {
          toast(err.message, 'error', 'Impossible d’enregistrer l’alerte');
        }
      });
    },
  });
  return close;
}

/* --------------------------- Mot de passe ------------------------- */

export function openChangePassword(forced = false) {
  openModal({
    title: forced ? 'Renouvellement obligatoire du mot de passe' : 'Changer mon mot de passe',
    subtitle: 'Le mot de passe est personnel et ne doit jamais être communiqué.',
    iconName: 'key',
    closable: !forced,
    body: `
      <form id="form-password">
        <label class="field">
          <span class="field-label">Mot de passe actuel</span>
          <input class="input" type="password" name="actuel" autocomplete="current-password" required />
        </label>
        <label class="field">
          <span class="field-label">Nouveau mot de passe</span>
          <input class="input" type="password" name="nouveau" autocomplete="new-password" required />
          <span class="field-hint">${policyHint()}</span>
        </label>
        <label class="field">
          <span class="field-label">Confirmation</span>
          <input class="input" type="password" name="confirmation" autocomplete="new-password" required />
        </label>
        <div class="form-actions">
          ${forced ? '' : '<button type="button" class="btn" data-close>Annuler</button>'}
          <button type="submit" class="btn btn-primary">${icon('check')} Valider</button>
        </div>
      </form>`,
    onMount(modal, close) {
      const form = modal.querySelector('#form-password');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        if (fd.get('nouveau') !== fd.get('confirmation')) {
          toast('Les deux mots de passe ne correspondent pas.', 'error');
          return;
        }
        try {
          await post('/api/auth/change-password', { actuel: fd.get('actuel'), nouveau: fd.get('nouveau') });
          state.user.mdp_a_changer = false;
          close();
          toast('Votre mot de passe a été modifié.', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

function openForcedPasswordChange() {
  openChangePassword(true);
}

export function policyHint() {
  const p = state.settings?.politique || {};
  const parts = [];
  parts.push(`${p.longueur_min || 8} caractères minimum`);
  if (p.majuscule) parts.push('une majuscule');
  if (p.minuscule) parts.push('une minuscule');
  if (p.chiffre) parts.push('un chiffre');
  if (p.special) parts.push('un caractère spécial');
  return parts.join(', ');
}

/* --------------------------- Recherche globale -------------------- */

function openGlobalSearch() {
  openModal({
    title: 'Recherche globale',
    subtitle: 'Interventions, personnels, consignes opérationnelles',
    iconName: 'search',
    size: 'modal-lg',
    body: `
      <div class="search-field" style="max-width:none;margin-bottom:14px">
        ${icon('search')}
        <input class="input" id="global-q" placeholder="Rechercher un numéro SIN, une nature, un nom, un matricule, une consigne…" autocomplete="off" />
      </div>
      <div id="global-results" class="stack" style="gap:10px">
        <p class="muted small">Saisissez au moins deux caractères pour lancer la recherche.</p>
      </div>`,
    onMount(modal) {
      const input = modal.querySelector('#global-q');
      const out = modal.querySelector('#global-results');
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) {
          out.innerHTML = '<p class="muted small">Saisissez au moins deux caractères pour lancer la recherche.</p>';
          return;
        }
        timer = setTimeout(async () => {
          try {
            const [ivs, pers, cons] = await Promise.all([
              api(`/api/interventions?q=${encodeURIComponent(q)}&statut=toutes&limit=6`),
              api(`/api/personnels?q=${encodeURIComponent(q)}`),
              api(`/api/consignes?q=${encodeURIComponent(q)}`),
            ]);
            const blocks = [];
            if (ivs.items.length) {
              blocks.push(`<div><div class="section-title"><h2>Interventions</h2><span class="count">${ivs.total}</span></div>
                <div class="card">${ivs.items.map((iv) => `
                  <button class="list-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line-100);cursor:pointer;text-align:left" data-go="#/intervention/${esc(iv.id)}">
                    <span class="badge badge-${(iv.priorite || 'p3').toLowerCase()}">${esc(iv.priorite)}</span>
                    <span class="grow"><span class="title">${esc(iv.nature)}</span>
                    <span class="sub">${esc(iv.numero)} · ${esc(iv.adresse)}, ${esc(iv.commune)}</span></span>
                    ${icon('chevron-right')}
                  </button>`).join('')}</div></div>`);
            }
            if (pers.items.length) {
              blocks.push(`<div><div class="section-title"><h2>Personnels</h2><span class="count">${pers.total}</span></div>
                <div class="card">${pers.items.slice(0, 6).map((p) => `
                  <button class="list-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line-100);cursor:pointer;text-align:left" data-go="#/effectif?q=${encodeURIComponent(p.matricule)}">
                    <span class="avatar-sm">${initials(p.prenom, p.nom)}</span>
                    <span class="grow"><span class="title">${esc(p.grade)} ${esc(p.prenom)} ${esc(p.nom)}</span>
                    <span class="sub">Matricule ${esc(p.matricule)} · ${esc(p.cis)}</span></span>
                    ${icon('chevron-right')}
                  </button>`).join('')}</div></div>`);
            }
            if (cons.items.length) {
              blocks.push(`<div><div class="section-title"><h2>Consignes</h2><span class="count">${cons.items.length}</span></div>
                <div class="card">${cons.items.slice(0, 5).map((c) => `
                  <button class="list-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line-100);cursor:pointer;text-align:left" data-go="#/consigne/${esc(c.id)}">
                    ${icon('book')}
                    <span class="grow"><span class="title">${esc(c.titre)}</span>
                    <span class="sub">${esc(c.reference)} · ${esc(c.categorie)}</span></span>
                    ${icon('chevron-right')}
                  </button>`).join('')}</div></div>`);
            }
            out.innerHTML = blocks.length ? blocks.join('') : '<p class="muted small">Aucun résultat pour cette recherche.</p>';
          } catch (err) {
            out.innerHTML = `<p class="muted small">${esc(err.message)}</p>`;
          }
        }, 260);
      });

      out.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-go]');
        if (!btn) return;
        location.hash = btn.dataset.go;
        closeAllModals();
        renderRoute();
      });
    },
  });
}

/* --------------------------- Serveur / NTS ------------------------ */

function openEtatServeur() {
  const s = state.settings || {};
  openModal({
    title: 'État du serveur CODIS-06-A',
    iconName: 'shield-check',
    body: `<dl class="kv">
      <dt>Serveur applicatif</dt><dd>CODIS-06-A · SNGP ${esc(state.meta?.version || '3.4.1')}</dd>
      <dt>Organisation</dt><dd>${esc(s.organisation || 'SDIS 06 — CODIS Nice')}</dd>
      <dt>Base de données</dt><dd>Opérationnelle — ${state.stats?.total_interventions ?? 0} dossiers SIN</dd>
      <dt>Postes connectés</dt><dd>${state.coordination?.connectes ?? 0} session(s) temps réel</dd>
      <dt>Simulation opérationnelle</dt><dd>${s.simulation ? 'Activée' : 'Désactivée'}</dd>
      <dt>Dernière sauvegarde</dt><dd>${esc(state.meta?.derniere_sauvegarde || '—')}</dd>
      <dt>Numéro de série</dt><dd class="mono">${esc(state.meta?.numero_serie || '—')}</dd>
    </dl>
    <div class="alert alert-info" style="margin-top:14px">${icon('shield-check')}<span>Le serveur est synchronisé avec le Centre de Traitement de l’Alerte. Les échanges ANTARES sont opérationnels.</span></div>`,
    footer: '<button class="btn" data-close>Fermer</button>',
  });
}

function openInfosSysteme() {
  openModal({
    title: 'Informations système',
    iconName: 'chart',
    body: `<dl class="kv">
      <dt>Application</dt><dd>SNGP 06 — Système Numérique de Gestion des Personnels</dd>
      <dt>Version</dt><dd>${esc(state.meta?.version || '3.4.1')} (build 2026.11)</dd>
      <dt>Édition</dt><dd>${esc(state.meta?.edition || 'SDIS 06')}</dd>
      <dt>Installation</dt><dd>${esc(state.meta?.installation || '—')}</dd>
      <dt>Utilisateur</dt><dd>${esc(state.user?.grade)} ${esc(state.user?.prenom)} ${esc(state.user?.nom)} — ${esc(state.user?.matricule)}</dd>
      <dt>Profil</dt><dd>${esc(ROLE_LABEL[state.user?.role] || '')}</dd>
      <dt>Centre</dt><dd>${esc(state.user?.cis || '—')}</dd>
      <dt>Droits</dt><dd>${isAdmin() ? 'Administration complète' : 'Droits opérationnels'}</dd>
    </dl>`,
    footer: '<button class="btn" data-close>Fermer</button>',
  });
}

function openReseau() {
  openModal({
    title: 'État du réseau radio',
    iconName: 'radio',
    body: `<div class="stack" style="gap:8px">
      ${[
        ['Canal CODIS 06', 'OK', 'green'],
        ['Canal groupement Ouest', 'OK', 'green'],
        ['Canal groupement Est', 'OK', 'green'],
        ['Relais MERCANTOUR', 'OK', 'green'],
        ['Relais CASTELLANE', 'OK', 'green'],
        ['Liaison ANTARES', 'OK', 'green'],
      ].map(([n, st]) => `<div class="row" style="justify-content:space-between;padding:8px 10px;border:1px solid var(--line-100);border-radius:5px">
        <span>${icon('radio')} ${esc(n)}</span><span class="badge badge-disponible">${esc(st)}</span></div>`).join('')}
    </div>`,
    footer: '<button class="btn" data-close>Fermer</button>',
  });
}

async function openBirdy() {
  const cis = state.refs?.cis || [];
  let personnels = [];
  try {
    const data = await api('/api/personnels');
    personnels = data.items || [];
  } catch {
    personnels = [];
  }
  const rows = cis
    .map((c, i) => {
      const p = personnels.find((x) => x.cis === c.code);
      const batterie = 68 + ((i * 9) % 31);
      const test = `07:${String(12 + i * 2).padStart(2, '0')}`;
      return `<tr>
        <td class="cell-num">BIP-06${String(i + 1).padStart(3, '0')}</td>
        <td>${p ? `${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}` : '—'}<div class="cell-sub">${esc(c.nom)}</div></td>
        <td>${batterie} %</td>
        <td class="cell-num">${test}</td>
        <td><span class="badge badge-disponible">Testé</span></td>
      </tr>`;
    })
    .join('');
  openModal({
    title: 'Réseau d’alerte BIP BIRDY',
    subtitle: 'Bip individuels des personnels d’astreinte — état du parc et autotests',
    iconName: 'radio',
    size: 'modal-lg',
    body: `<div class="msg-meta">
        <span class="chip">${icon('radio')} ${cis.length} bip suivis</span>
        <span class="chip">${icon('check')} Autotest quotidien 07:00</span>
        <span class="chip">${icon('shield-check')} Diffusion chiffrée</span>
      </div>
      <div class="table-wrap"><table class="table table-compact">
        <thead><tr><th>Bip</th><th>Porteur</th><th>Batterie</th><th>Dernier test</th><th>État</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="alert alert-info" style="margin-top:12px">${icon('info')}<span>Les bips sont affectés aux chefs de groupe d’astreinte. Un bip non testé sous 24 h est signalé au CTA.</span></div>`,
    footer: '<button class="btn" data-close>Fermer</button>',
  });
}

async function openNeofibi() {
  const cis = state.refs?.cis || [];
  const rows = cis
    .map((c, i) => {
      const sync = `17:${String(4 + i * 3).padStart(2, '0')}`;
      const bilans = 2 + ((i * 5) % 7);
      const etat = i === cis.length - 1
        ? '<span class="badge badge-maintenance">Synchro en attente</span>'
        : '<span class="badge badge-disponible">Synchronisée</span>';
      return `<tr>
        <td class="cell-num">NEOFIBI-${esc(c.code.slice(0, 3).toUpperCase())}-${String(i + 1).padStart(2, '0')}</td>
        <td class="nowrap">${esc(c.nom)}<div class="cell-sub">${esc(c.commune)} — ${esc(c.code)}</div></td>
        <td>${bilans} bilan(s)</td>
        <td class="cell-num">${sync}</td>
        <td>${etat}</td>
      </tr>`;
    })
    .join('');
  openModal({
    title: 'Tablettes bilan NEOFIBI',
    subtitle: 'Saisie du bilan sur le terrain et transmission au CODIS',
    iconName: 'mobile',
    size: 'modal-lg',
    body: `<div class="msg-meta">
        <span class="chip">${icon('mobile')} ${cis.length} tablettes · v4.2.1</span>
        <span class="chip">${icon('refresh')} Synchro Wi-Fi / 4G</span>
        <span class="chip">${icon('clipboard')} Bilans transmis au dossier SIN</span>
      </div>
      <div class="table-wrap"><table class="table table-compact">
        <thead><tr><th>Tablette</th><th>Centre</th><th>Bilans du jour</th><th>Synchro</th><th>État</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="alert alert-info" style="margin-top:12px">${icon('info')}<span>Les bilans saisis sont horodatés et rattachés au dossier d’intervention ; ils alimentent le CRSS à la clôture.</span></div>`,
    footer: '<button class="btn" data-close>Fermer</button>',
  });
}

function openTransmissions() {
  openModal({
    title: 'Journal des transmissions',
    iconName: 'list',
    size: 'modal-lg',
    body: `<div class="table-wrap"><table class="table table-compact">
      <thead><tr><th>Heure</th><th>Indicatif</th><th>Type</th><th>Message</th></tr></thead>
      <tbody>
        ${(state.lastTransmissions || []).length ? state.lastTransmissions.map((t) => `<tr><td class="cell-num">${esc(t.heure)}</td><td>${esc(t.indicatif)}</td><td>${esc(t.type)}</td><td>${esc(t.message)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">Aucune transmission enregistrée dans cette session.</td></tr>'}
      </tbody></table></div>`,
    footer: '<button class="btn" data-close>Fermer</button>',
  });
}

/* =====================================================================
   Routage
   ===================================================================== */

async function renderRoute() {
  if (!state.user) return;
  const raw = (location.hash || '#/tableau-de-bord').replace(/^#\/?/, '');
  const path = raw.split('?')[0];
  const [key, param] = path.split('/');
  const view = VIEWS[key] || VIEWS['tableau-de-bord'];

  state.refresh = null;
  renderSidebar();
  workspace.innerHTML = `<div class="page"><div class="card"><div class="card-body" style="display:flex;gap:10px;align-items:center;color:var(--muted-500)">${icon('refresh', 'spin')} Chargement…</div></div></div>`;
  workspace.scrollTop = 0;

  try {
    await view(workspace, param);
    document.title = `${titleFor(key)} — SNGP 06`;
  } catch (err) {
    if (err.status === 401) return;
    workspace.innerHTML = `<div class="page"><div class="card"><div class="card-body">
      <div class="alert alert-error">${icon('alert')}<span>${esc(err.message)}</span></div>
      <button class="btn" style="margin-top:12px" onclick="location.reload()">${icon('refresh')} Recharger l’application</button>
    </div></div></div>`;
  }
}

function titleFor(key) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) if (it.key === key) return it.label;
  }
  if (key === 'intervention') return 'Dossier d’intervention';
  if (key === 'consigne') return 'Consigne opérationnelle';
  return 'Tableau de bord';
}

window.addEventListener('hashchange', renderRoute);

/* =====================================================================
   Temps réel
   ===================================================================== */

function connectEvents() {
  disconnect();
  eventSource = new EventSource('/api/events');

  const refreshView = debounceView();

  eventSource.addEventListener('alerte', (e) => {
    let data = {};
    try {
      data = JSON.parse(e.data);
    } catch {
      /* ignore */
    }
    refreshView();
    refreshStats();
    if (data.numero) {
      toast(`${data.numero} — ${data.nature} à ${data.commune} (${data.priorite})`, 'warning', 'Nouvelle alerte');
    }
  });
  eventSource.addEventListener('intervention', refreshView);
  eventSource.addEventListener('engins', refreshView);
  eventSource.addEventListener('personnels', refreshView);
  eventSource.addEventListener('crss', refreshView);
  eventSource.addEventListener('settings', refreshView);
  eventSource.addEventListener('admin', refreshView);
  eventSource.addEventListener('ping', () => {
    qs('#menubar-status').innerHTML = `<span class="live-dot"></span> CODIS connecté`;
  });
  eventSource.onerror = () => {
    qs('#menubar-status').innerHTML = `<span class="live-dot" style="background:#e0a800;box-shadow:0 0 0 2px rgba(224,168,0,.2)"></span> Reconnexion…`;
  };
  eventSource.onopen = () => {
    qs('#menubar-status').innerHTML = `<span class="live-dot"></span> CODIS connecté`;
  };
}

function debounceView() {
  let t = null;
  return () => {
    clearTimeout(t);
    t = setTimeout(() => {
      // Ne pas re-rendre pendant la saisie d'un formulaire ni sous une modale.
      const tag = document.activeElement?.tagName;
      if (document.querySelector('.modal-backdrop')) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (document.hidden) return;
      if (state.refresh) state.refresh();
      else renderRoute();
    }, 900);
  };
}

function disconnect() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

function startHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  refreshStats();
  heartbeat = setInterval(refreshStats, 20000);
}

async function refreshStats() {
  if (!state.user) return;
  try {
    const data = await api('/api/stats');
    state.stats = data.stats;
    state.coordination = data.coordination;
    renderSidebar();
    renderStatusbar();
  } catch {
    /* silencieux */
  }
}

/* =====================================================================
   Horloge
   ===================================================================== */

function startClock() {
  const tick = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const time = qs('#clock-time');
    const date = qs('#clock-date');
    if (time) time.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    if (date) date.textContent = fmtLongDate(d).replace(/^\w/, (c) => c.toUpperCase());
  };
  tick();
  setInterval(tick, 1000);
}

/* =====================================================================
   Raccourcis
   ===================================================================== */

function wireGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearch();
    }
    if (e.key === 'F5' && state.user && !e.ctrlKey) {
      e.preventDefault();
      renderRoute();
    }
  });
}

/* =====================================================================
   Démarrage
   ===================================================================== */

boot();

export { renderRoute, refreshStats };
