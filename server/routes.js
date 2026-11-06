/**
 * API REST du SNGP 06.
 *
 * Chaque route déclare le rôle ou la permission requis ; le contrôle est
 * effectué côté serveur, jamais uniquement dans l'interface.
 */
import {
  getDb,
  save,
  addAudit,
  nowString,
} from './store.js';
import {
  verifyPassword,
  hashPassword,
  sanitizeUser,
  passwordErrors,
  newToken,
  can,
  ROLES,
  ROLE_LABELS,
  generatePassword,
} from './auth.js';
import * as ops from './ops.js';
import { NATURES, CIS, GRADES, APTITUDES_REF, ENGIN_TYPES, CIS_COORDS } from './seed.js';
import { broadcast, clientCount } from './events.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const SESSION_COOKIE = 'sngp_sid';

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function sessionFromRequest(req) {
  const db = getDb();
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  const duree = (db.settings.duree_session_minutes || 60) * 60e3;
  if (Date.now() - session.dernier_acces_ts > duree) {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    save();
    return null;
  }
  session.dernier_acces_ts = Date.now();
  session.dernier_acces = nowString();
  return session;
}

function clientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '—'
  ).replace('::ffff:', '');
}

function setSessionCookie(res, token, maxAgeSecondes) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSecondes}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers de présentation                                            */
/* ------------------------------------------------------------------ */

function userPublic(db, user) {
  const personnel = db.personnels.find((p) => p.matricule === user.matricule);
  return sanitizeUser(user, personnel);
}

function personnelPublic(p) {
  return {
    matricule: p.matricule,
    nom: p.nom,
    prenom: p.prenom,
    grade: p.grade,
    cis: p.cis,
    fonction: p.fonction,
    statut: p.statut,
    garde: p.garde,
    aptitudes: p.aptitudes,
    telephone: p.telephone,
    email: p.email,
    date_entree: p.date_entree,
  };
}

function enrichIntervention(db, iv) {
  return {
    ...iv,
    statut_label: ops.etapeLabel(iv),
    famille_label: ops.FAMILLE_LABELS[iv.famille] || iv.famille,
    engins: iv.engins.map((e) => ({
      ...e,
      equipage_detail: (e.equipage || [])
        .map((m) => db.personnels.find((p) => p.matricule === m))
        .filter(Boolean)
        .map((p) => ({ matricule: p.matricule, nom: p.nom, prenom: p.prenom, grade: p.grade })),
    })),
  };
}

function enginPublic(db, e) {
  const iv = e.intervention_id ? db.interventions.find((i) => i.id === e.intervention_id) : null;
  return {
    ...e,
    intervention: iv ? { id: iv.id, numero: iv.numero, nature: iv.nature } : null,
    equipage_detail: e.equipage
      .map((m) => db.personnels.find((p) => p.matricule === m))
      .filter(Boolean)
      .map((p) => ({ matricule: p.matricule, nom: p.nom, prenom: p.prenom, grade: p.grade })),
  };
}

function requirePermission(user, permission) {
  if (!can(user.role, permission)) {
    throw new HttpError(403, "Votre profil ne dispose pas des droits nécessaires pour cette action.");
  }
}

function startOfDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

export const routes = [];
const route = (method, pattern, opts, handler) =>
  routes.push({ method, pattern, ...(typeof opts === 'string' ? { role: opts } : opts), handler });

/* --------------------------- Authentification --------------------- */

route('POST', '/api/auth/login', { public: true }, (ctx) => {
  const db = getDb();
  const ip = clientIp(ctx.req);
  const matricule = String(ctx.body?.matricule || '').trim();
  const password = String(ctx.body?.password || '');

  if (!matricule || !password) {
    throw new HttpError(400, 'Matricule et mot de passe obligatoires.');
  }

  const user = db.users.find((u) => u.matricule === matricule);

  if (!user) {
    addAudit({ matricule: matricule || '—', action: 'Connexion refusée', detail: 'Matricule inconnu', ip, niveau: 'alerte' });
    save();
    throw new HttpError(401, 'Matricule ou mot de passe incorrect.');
  }

  if (user.verrouille_jusqu && new Date(user.verrouille_jusqu).getTime() > Date.now()) {
    const restant = Math.ceil((new Date(user.verrouille_jusqu).getTime() - Date.now()) / 60000);
    throw new HttpError(423, `Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${restant} minute(s).`);
  }

  if (!user.actif) {
    addAudit({ matricule, action: 'Connexion refusée', detail: 'Compte désactivé', ip, niveau: 'alerte' });
    save();
    throw new HttpError(403, "Ce compte a été désactivé. Contactez l'administrateur du système.");
  }

  if (!verifyPassword(password, user.salt, user.hash)) {
    user.tentatives = (user.tentatives || 0) + 1;
    const max = db.settings.tentatives_max || 5;
    let message = `Matricule ou mot de passe incorrect. (${user.tentatives}/${max})`;
    if (user.tentatives >= max) {
      const minutes = db.settings.verrouillage_minutes || 5;
      user.verrouille_jusqu = new Date(Date.now() + minutes * 60e3).toISOString();
      user.tentatives = 0;
      message = `Compte verrouillé pour ${minutes} minutes après ${max} tentatives infructueuses.`;
    }
    addAudit({ matricule, action: 'Connexion refusée', detail: 'Mot de passe incorrect', ip, niveau: 'alerte' });
    save();
    throw new HttpError(401, message);
  }

  user.tentatives = 0;
  user.verrouille_jusqu = null;
  user.dernier_acces = nowString();
  user.dernier_ip = ip;

  const token = newToken();
  const duree = db.settings.duree_session_minutes || 60;
  db.sessions = db.sessions.filter((s) => s.matricule !== matricule || Date.now() - s.dernier_acces_ts < duree * 60e3);
  db.sessions.push({
    token,
    matricule,
    ip,
    ua: String(ctx.req.headers['user-agent'] || '').slice(0, 180),
    debut: nowString(),
    dernier_acces: nowString(),
    dernier_acces_ts: Date.now(),
  });
  addAudit({ matricule, action: 'Connexion', detail: `Connexion réussie (${ip})`, ip });
  save();
  setSessionCookie(ctx.res, token, duree * 60);
  return { user: userPublic(db, user), duree_session_minutes: duree };
});

route('POST', '/api/auth/logout', {}, (ctx) => {
  const db = getDb();
  if (ctx.session) {
    db.sessions = db.sessions.filter((s) => s.token !== ctx.session.token);
    save();
    addAudit({ matricule: ctx.user.matricule, action: 'Déconnexion', detail: 'Session fermée', ip: clientIp(ctx.req) });
  }
  ctx.res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return { ok: true };
});

route('GET', '/api/auth/me', {}, (ctx) => {
  const db = getDb();
  return {
    user: userPublic(db, ctx.user),
    meta: db.meta,
    settings: publicSettings(db),
  };
});

route('POST', '/api/auth/change-password', {}, (ctx) => {
  const db = getDb();
  const { actuel, nouveau } = ctx.body || {};
  if (!verifyPassword(String(actuel || ''), ctx.user.salt, ctx.user.hash)) {
    throw new HttpError(400, 'Le mot de passe actuel est incorrect.');
  }
  const errors = passwordErrors(nouveau, db.settings.politique);
  if (errors.length) {
    throw new HttpError(400, `Le nouveau mot de passe doit contenir : ${errors.join(', ')}.`);
  }
  const { salt, hash } = hashPassword(nouveau);
  ctx.user.salt = salt;
  ctx.user.hash = hash;
  ctx.user.mdp_change_le = nowString();
  ctx.user.mdp_a_changer = false;
  addAudit({ matricule: ctx.user.matricule, action: 'Mot de passe', detail: 'Mot de passe modifié par l’utilisateur', ip: clientIp(ctx.req) });
  save();
  return { ok: true };
});

route('POST', '/api/auth/profile', {}, (ctx) => {
  const db = getDb();
  const p = db.personnels.find((x) => x.matricule === ctx.user.matricule);
  if (!p) throw new HttpError(404, 'Fiche personnel introuvable.');
  const { telephone, email } = ctx.body || {};
  if (telephone && !/^[0-9 +.()-]{8,20}$/.test(telephone)) throw new HttpError(400, 'Numéro de téléphone invalide.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Adresse de messagerie invalide.');
  if (telephone) p.telephone = telephone;
  if (email) p.email = email;
  addAudit({ matricule: ctx.user.matricule, action: 'Profil', detail: 'Coordonnées mises à jour', ip: clientIp(ctx.req) });
  save();
  return { user: userPublic(db, ctx.user) };
});

/* --------------------------- Référentiels ------------------------- */

function publicSettings(db) {
  return {
    organisation: db.settings.organisation,
    nom_systeme: db.settings.nom_systeme,
    duree_session_minutes: db.settings.duree_session_minutes,
    simulation: db.settings.simulation,
    cadence_alerte_secondes: db.settings.cadence_alerte_secondes,
    politique: db.settings.politique,
    tentatives_max: db.settings.tentatives_max,
    verrouillage_minutes: db.settings.verrouillage_minutes,
  };
}

route('GET', '/api/bootstrap', {}, (ctx) => {
  const db = getDb();
  return {
    user: userPublic(db, ctx.user),
    meta: db.meta,
    settings: publicSettings(db),
    stats: ops.statistiques(db),
    referentiels: {
      cis: CIS,
      communes: CIS.map((c) => ({ code: c.code, commune: c.commune, nom: c.nom, lat: c.lat, lng: c.lng })),
      natures: NATURES,
      grades: GRADES,
      aptitudes: APTITUDES_REF,
      engin_types: ENGIN_TYPES,
      familles: ops.FAMILLE_LABELS,
      priorites: ops.PRIORITES,
      etapes: ops.ETAPES,
      roles: ROLES.map((r) => ({ code: r, libelle: ROLE_LABELS[r] })),
      statuts_personnel: ['Disponible', 'En intervention', 'Repos', 'Congé', 'Formation', 'Indisponible'],
      statuts_engin: ['Disponible', 'Engagé', 'Maintenance', 'Indisponible'],
    },
    coordination: { connectes: clientCount(), serveur: 'OK' },
  };
});

/* --------------------------- Tableau de bord ---------------------- */

route('GET', '/api/dashboard', {}, (ctx) => {
  const db = getDb();
  const actives = db.interventions
    .filter((i) => i.statut !== 'Clôturée')
    .sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1));
  const garde = ops.feuilleDeGarde(db, startOfDay(0));
  return {
    stats: ops.statistiques(db),
    activite: ops.activite24h(db),
    interventions: actives.map((iv) => enrichIntervention(db, iv)),
    garde: {
      jour: garde.garde,
      effectif: garde.total_personnels,
      engins: garde.total_engins,
      horaires: garde.horaires,
    },
    engins: db.engins.map((e) => ({ indicatif: e.indicatif, type: e.type, cis: e.cis, statut: e.statut })),
    derniers_evenements: db.audit.slice(0, 12),
  };
});

route('GET', '/api/stats', {}, () => {
  const db = getDb();
  return {
    stats: ops.statistiques(db),
    coordination: { connectes: clientCount(), serveur: 'OK' },
  };
});

/* --------------------------- Interventions ------------------------ */

route('GET', '/api/interventions', {}, (ctx) => {
  const db = getDb();
  const { statut = 'en_cours', q = '', famille = '', cis = '', limit = '100', offset = '0' } = ctx.query;
  let list = db.interventions.slice();
  if (statut === 'en_cours') list = list.filter((i) => i.statut !== 'Clôturée');
  else if (statut === 'historique') list = list.filter((i) => i.statut === 'Clôturée');
  if (famille) list = list.filter((i) => i.famille === famille);
  if (cis) list = list.filter((i) => CIS.find((c) => c.commune === i.commune)?.code === cis);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((i) =>
      [i.numero, i.nature, i.adresse, i.commune, i.bilan, i.chef_agres?.nom]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }
  list.sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1));
  const total = list.length;
  const items = list.slice(Number(offset), Number(offset) + Number(limit)).map((i) => enrichIntervention(db, i));
  return { items, total };
});

route('GET', '/api/interventions/:id', {}, (ctx) => {
  const db = getDb();
  const iv = db.interventions.find((i) => i.id === ctx.params.id || i.numero === ctx.params.id);
  if (!iv) throw new HttpError(404, 'Intervention introuvable.');
  return {
    intervention: enrichIntervention(db, iv),
    antares: ops.historiqueAntares(iv),
  };
});

route('POST', '/api/interventions', { permission: 'interventions.write' }, (ctx) => {
  const db = getDb();
  const { nature, adresse, commune, priorite, source, engins } = ctx.body || {};
  if (!nature) throw new HttpError(400, 'La nature du sinistre est obligatoire.');
  if (!adresse || String(adresse).trim().length < 4) throw new HttpError(400, "L'adresse doit être renseignée.");
  if (!commune) throw new HttpError(400, 'La commune est obligatoire.');
  if (!CIS.some((c) => c.commune === commune)) throw new HttpError(400, 'Commune hors zone de compétence du SDIS 06.');

  const enginsChoisis = Array.isArray(engins) && engins.length
    ? engins
        .map((ind) => db.engins.find((e) => e.indicatif === ind))
        .filter((e) => e && e.statut === 'Disponible')
    : [];

  const iv = ops.creerIntervention(db, {
    nature,
    adresse: String(adresse).trim(),
    commune,
    priorite,
    source: source || 'Appel 18',
    enginsChoisis,
    auteur: ctx.user.matricule,
  });
  addAudit({
    matricule: ctx.user.matricule,
    action: 'Création intervention',
    detail: `${iv.numero} — ${iv.nature} — ${iv.commune}`,
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('alerte', { id: iv.id, numero: iv.numero, nature: iv.nature, commune: iv.commune, priorite: iv.priorite });
  return { intervention: enrichIntervention(db, iv) };
});

route('PATCH', '/api/interventions/:id', { permission: 'interventions.write' }, (ctx) => {
  const db = getDb();
  const iv = db.interventions.find((i) => i.id === ctx.params.id);
  if (!iv) throw new HttpError(404, 'Intervention introuvable.');
  const { action, bilan, engins } = ctx.body || {};

  if (action === 'etape') {
    if (iv.statut === 'Clôturée') throw new HttpError(400, 'Cette intervention est déjà clôturée.');
    ops.avancerIntervention(db, iv);
  } else if (action === 'cloturer') {
    if (iv.statut === 'Clôturée') throw new HttpError(400, 'Cette intervention est déjà clôturée.');
    if (bilan) iv.bilan = String(bilan).slice(0, 1200);
    let guard = 0;
    while (iv.statut !== 'Clôturée' && guard++ < 6) ops.avancerIntervention(db, iv);
    if (bilan) iv.crss.bilan = iv.bilan;
  } else if (action === 'renfort') {
    if (iv.statut === 'Clôturée') throw new HttpError(400, 'Intervention clôturée.');
    const ajoutes = (engins || [])
      .map((ind) => db.engins.find((e) => e.indicatif === ind))
      .filter((e) => e && e.statut === 'Disponible');
    if (!ajoutes.length) throw new HttpError(400, 'Aucun engin disponible sélectionné.');
    for (const e of ajoutes) {
      iv.engins.push({ indicatif: e.indicatif, type: e.type, cis: e.cis, role: 'Renfort', equipage: [], chef: null });
    }
    ops.affecterEquipages(db, iv);
    iv.evenements.push({
      ts: nowString(),
      texte: `Renfort demandé et engagé : ${ajoutes.map((e) => e.indicatif).join(', ')}`,
    });
  } else if (action === 'bilan') {
    iv.bilan = String(bilan || '').slice(0, 1200);
    iv.evenements.push({ ts: nowString(), texte: 'Bilan de situation mis à jour par le chef de dispositif' });
  } else {
    throw new HttpError(400, 'Action inconnue.');
  }

  addAudit({
    matricule: ctx.user.matricule,
    action: 'Mise à jour intervention',
    detail: `${iv.numero} — ${action}${iv.statut === 'Clôturée' ? ' (clôture)' : ''}`,
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('intervention', { id: iv.id, numero: iv.numero, statut: iv.statut, etape: iv.etape });
  return { intervention: enrichIntervention(db, iv) };
});

route('GET', '/api/interventions/:id/antares', {}, (ctx) => {
  const db = getDb();
  const iv = db.interventions.find((i) => i.id === ctx.params.id);
  if (!iv) throw new HttpError(404, 'Intervention introuvable.');
  return { numero: iv.numero, messages: ops.historiqueAntares(iv) };
});

/* --------------------------- Personnel ---------------------------- */

route('GET', '/api/personnels', {}, (ctx) => {
  const db = getDb();
  const { q = '', cis = '', statut = '', aptitude = '' } = ctx.query;
  let list = db.personnels.slice();
  if (cis) list = list.filter((p) => p.cis === cis);
  if (statut) list = list.filter((p) => p.statut === statut);
  if (aptitude) list = list.filter((p) => p.aptitudes.some((a) => a.code === aptitude));
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((p) =>
      [p.nom, p.prenom, p.matricule, p.grade, p.fonction].join(' ').toLowerCase().includes(needle),
    );
  }
  list.sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade) || a.nom.localeCompare(b.nom));
  const accounts = new Map(db.users.map((u) => [u.matricule, u]));
  return {
    items: list.map((p) => ({
      ...personnelPublic(p),
      compte: accounts.has(p.matricule)
        ? { role: accounts.get(p.matricule).role, actif: accounts.get(p.matricule).actif }
        : null,
      engagement: db.engins
        .filter((e) => e.statut === 'Engagé' && e.equipage.includes(p.matricule))
        .map((e) => ({ indicatif: e.indicatif, intervention_id: e.intervention_id })),
    })),
    total: list.length,
  };
});

route('GET', '/api/personnels/:matricule', {}, (ctx) => {
  const db = getDb();
  const p = db.personnels.find((x) => x.matricule === ctx.params.matricule);
  if (!p) throw new HttpError(404, 'Personnel introuvable.');
  const user = db.users.find((u) => u.matricule === p.matricule);
  const interventions = db.interventions
    .filter((i) => i.engins.some((e) => (e.equipage || []).includes(p.matricule)))
    .slice(0, 12)
    .map((i) => ({ id: i.id, numero: i.numero, nature: i.nature, cree_le: i.cree_le, statut: i.statut }));
  return {
    personnel: { ...personnelPublic(p), compte: user ? userPublic(db, user) : null, interventions },
  };
});

route('PATCH', '/api/personnels/:matricule', { permission: 'personnels.write' }, (ctx) => {
  const db = getDb();
  const p = db.personnels.find((x) => x.matricule === ctx.params.matricule);
  if (!p) throw new HttpError(404, 'Personnel introuvable.');
  const { statut } = ctx.body || {};
  const autorises = ['Disponible', 'Repos', 'Congé', 'Formation', 'Indisponible'];
  if (!autorises.includes(statut)) throw new HttpError(400, 'Statut de disponibilité invalide.');
  const engage = db.engins.find((e) => e.statut === 'Engagé' && e.equipage.includes(p.matricule));
  if (engage) throw new HttpError(409, `Ce personnel est engagé sur l'engin ${engage.indicatif}. Il ne peut pas être rendu indisponible.`);
  p.statut = statut;
  p.disponible = statut === 'Disponible';
  addAudit({
    matricule: ctx.user.matricule,
    action: 'Disponibilité personnel',
    detail: `${p.grade} ${p.nom} ${p.prenom} (${p.matricule}) → ${statut}`,
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('personnels', { matricule: p.matricule, statut });
  return { personnel: personnelPublic(p) };
});

/* --------------------------- Engins ------------------------------- */

route('GET', '/api/engins', {}, (ctx) => {
  const db = getDb();
  const { cis = '', statut = '', type = '' } = ctx.query;
  let list = db.engins.slice();
  if (cis) list = list.filter((e) => e.cis === cis);
  if (statut) list = list.filter((e) => e.statut === statut);
  if (type) list = list.filter((e) => e.type === type);
  list.sort((a, b) => a.indicatif.localeCompare(b.indicatif));
  return {
    items: list.map((e) => enginPublic(db, e)),
    total: list.length,
    stats: {
      total: db.engins.length,
      disponibles: db.engins.filter((e) => e.statut === 'Disponible').length,
      engages: db.engins.filter((e) => e.statut === 'Engagé').length,
      indisponibles: db.engins.filter((e) => e.statut !== 'Disponible' && e.statut !== 'Engagé').length,
    },
  };
});

route('PATCH', '/api/engins/:indicatif', { permission: 'engins.write' }, (ctx) => {
  const db = getDb();
  const engin = db.engins.find((e) => e.indicatif === ctx.params.indicatif);
  if (!engin) throw new HttpError(404, 'Engin introuvable.');
  const { statut, motif } = ctx.body || {};
  if (!['Disponible', 'Maintenance', 'Indisponible'].includes(statut)) {
    throw new HttpError(400, 'Statut engin invalide.');
  }
  if (engin.statut === 'Engagé') throw new HttpError(409, "Cet engin est engagé sur une intervention et ne peut pas être modifié.");
  engin.statut = statut;
  engin.motif = statut === 'Disponible' ? null : String(motif || '').slice(0, 200) || 'Indisponibilité technique';
  addAudit({
    matricule: ctx.user.matricule,
    action: 'Disponibilité engin',
    detail: `${engin.indicatif} → ${statut}${engin.motif ? ` (${engin.motif})` : ''}`,
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('engins', { indicatif: engin.indicatif, statut });
  return { engin: enginPublic(db, engin) };
});

/* --------------------------- Feuille de garde --------------------- */

route('GET', '/api/gardes', {}, (ctx) => {
  const db = getDb();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date || '') ? ctx.query.date : startOfDay(0);
  return { feuille: ops.feuilleDeGarde(db, date) };
});

route('GET', '/api/gardes/semaine', {}, (ctx) => {
  const db = getDb();
  const jours = [];
  for (let i = 0; i < 7; i++) {
    const date = startOfDay(i);
    const f = ops.feuilleDeGarde(db, date);
    jours.push({
      date,
      garde: f.garde,
      effectif: f.total_personnels,
      engins: f.total_engins,
      centres: f.centres.map((c) => ({ cis: c.cis, nom: c.nom, effectif: c.effectif_count, engins: c.engins_count })),
    });
  }
  return { jours };
});

/* --------------------------- Consignes ---------------------------- */

route('GET', '/api/consignes', {}, (ctx) => {
  const db = getDb();
  const { q = '', categorie = '' } = ctx.query;
  let list = db.consignes.slice();
  if (categorie) list = list.filter((c) => c.categorie === categorie);
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((c) => `${c.titre} ${c.reference} ${c.contenu}`.toLowerCase().includes(n));
  }
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  const categories = [...new Set(db.consignes.map((c) => c.categorie))].sort();
  return {
    items: list.map((c) => ({ ...c, extrait: c.contenu.replace(/\n/g, ' ').slice(0, 160) })),
    categories,
  };
});

route('GET', '/api/consignes/:id', {}, (ctx) => {
  const db = getDb();
  const c = db.consignes.find((x) => x.id === ctx.params.id);
  if (!c) throw new HttpError(404, 'Consigne introuvable.');
  const auteur = db.personnels.find((p) => p.matricule === c.auteur);
  return { consigne: { ...c, auteur_detail: auteur ? `${auteur.grade} ${auteur.prenom} ${auteur.nom}` : c.auteur } };
});

/* --------------------------- Aptitudes ---------------------------- */

route('GET', '/api/aptitudes', {}, (ctx) => {
  const db = getDb();
  const aujourdhui = startOfDay(0);
  const seuil = startOfDay(90);
  const parCode = {};
  for (const p of db.personnels) {
    for (const a of p.aptitudes) parCode[a.code] = (parCode[a.code] || 0) + 1;
  }
  const expirations = [];
  for (const p of db.personnels) {
    for (const a of p.aptitudes) {
      if (a.validite <= seuil) {
        expirations.push({
          matricule: p.matricule,
          nom: p.nom,
          prenom: p.prenom,
          grade: p.grade,
          cis: p.cis,
          code: a.code,
          libelle: a.libelle,
          validite: a.validite,
          expire: a.validite < aujourdhui,
        });
      }
    }
  }
  expirations.sort((a, b) => (a.validite < b.validite ? -1 : 1));
  return {
    referentiel: APTITUDES_REF,
    stats: parCode,
    expirations: expirations.slice(0, 60),
    personnels: db.personnels.map((p) => ({
      matricule: p.matricule,
      nom: p.nom,
      prenom: p.prenom,
      grade: p.grade,
      cis: p.cis,
      aptitudes: p.aptitudes.map((a) => ({ code: a.code, validite: a.validite, expire: a.validite < aujourdhui })),
    })),
  };
});

/* --------------------------- CRSS --------------------------------- */

route('GET', '/api/crss', {}, (ctx) => {
  const db = getDb();
  const { q = '' } = ctx.query;
  let list = db.interventions.filter((i) => i.crss);
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((i) => `${i.numero} ${i.nature} ${i.commune} ${i.crss.bilan}`.toLowerCase().includes(n));
  }
  list = list.slice().sort((a, b) => (a.cloture_le < b.cloture_le ? 1 : -1));
  return {
    items: list.slice(0, 120).map((i) => ({
      id: i.id,
      numero: i.numero,
      nature: i.nature,
      famille: i.famille,
      commune: i.commune,
      adresse: i.adresse,
      cloture_le: i.cloture_le,
      chef: i.chef_agres,
      crss: i.crss,
      redige_par_nom: (() => {
        const p = db.personnels.find((x) => x.matricule === i.crss?.redige_par);
        return p ? `${p.grade} ${p.nom} ${p.prenom}` : i.crss?.redige_par || '—';
      })(),
      engins: i.engins.map((e) => e.indicatif),
      victimes: i.victimes,
    })),
    total: list.length,
  };
});

route('POST', '/api/crss', { permission: 'crss.write' }, (ctx) => {
  const db = getDb();
  const { intervention_id, bilan, consequences, suites } = ctx.body || {};
  const iv = db.interventions.find((i) => i.id === intervention_id);
  if (!iv) throw new HttpError(404, 'Intervention introuvable.');
  if (iv.statut !== 'Clôturée') throw new HttpError(400, 'Le CRSS ne peut être établi qu’après clôture de l’intervention.');
  iv.crss = {
    ...(iv.crss || {}),
    redige_par: ctx.user.matricule,
    redige_le: nowString(),
    visa: 'Chef de garde',
    bilan: String(bilan ?? iv.bilan ?? '').slice(0, 2000),
    consequences: String(consequences ?? iv.crss?.consequences ?? '').slice(0, 500),
    suites: String(suites ?? iv.crss?.suites ?? '').slice(0, 500),
  };
  if (bilan) iv.bilan = iv.crss.bilan;
  addAudit({
    matricule: ctx.user.matricule,
    action: 'CRSS',
    detail: `Compte rendu établi pour ${iv.numero}`,
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('crss', { id: iv.id });
  return { ok: true, intervention: enrichIntervention(db, iv) };
});

/* --------------------------- Administration ----------------------- */

route('GET', '/api/admin/users', 'admin', (ctx) => {
  const db = getDb();
  const sessions = db.sessions.reduce((acc, s) => {
    acc[s.matricule] = (acc[s.matricule] || 0) + 1;
    return acc;
  }, {});
  return {
    items: db.users.map((u) => ({
      ...userPublic(db, u),
      sessions: sessions[u.matricule] || 0,
    })),
    libres: db.personnels
      .filter((p) => !db.users.some((u) => u.matricule === p.matricule))
      .map((p) => ({ matricule: p.matricule, nom: p.nom, prenom: p.prenom, grade: p.grade, cis: p.cis })),
  };
});

route('POST', '/api/admin/users', 'admin', (ctx) => {
  const db = getDb();
  const { matricule, role, mot_de_passe, doit_changer, nom, prenom, grade, cis, fonction } = ctx.body || {};
  const mat = String(matricule || '').trim();
  if (!/^\d{4,6}$/.test(mat)) throw new HttpError(400, 'Le matricule doit comporter 4 à 6 chiffres.');
  if (db.users.some((u) => u.matricule === mat)) throw new HttpError(409, 'Un compte existe déjà pour ce matricule.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide.');

  let personnel = db.personnels.find((p) => p.matricule === mat);
  if (!personnel) {
    if (!nom || !prenom) {
      throw new HttpError(400, 'Matricule inconnu : renseignez le nom et le prénom pour créer la fiche personnel.');
    }
    if (!GRADES.includes(grade)) throw new HttpError(400, 'Grade invalide.');
    if (!CIS.some((c) => c.code === cis) && cis !== 'CODIS') throw new HttpError(400, 'Centre de secours invalide.');
    personnel = {
      matricule: mat,
      nom: String(nom).toUpperCase().slice(0, 40),
      prenom: String(prenom).slice(0, 40),
      grade,
      cis,
      fonction: String(fonction || 'Personnel').slice(0, 120),
      aptitudes: [],
      garde: ['A', 'B', 'C', 'D'][db.personnels.length % 4],
      statut: 'Disponible',
      disponible: true,
      telephone: '',
      email: `${String(prenom).toLowerCase().replace(/[^a-z]/g, '')}.${String(nom).toLowerCase().replace(/[^a-z]/g, '')}@sdis06.fr`,
      date_entree: startOfDay(0),
    };
    db.personnels.push(personnel);
  }

  const password = mot_de_passe || generatePassword();
  const errors = passwordErrors(password, db.settings.politique);
  if (errors.length) throw new HttpError(400, `Le mot de passe doit contenir : ${errors.join(', ')}.`);
  const { salt, hash } = hashPassword(password);
  const user = {
    id: `usr-${Date.now()}`,
    matricule: mat,
    role,
    salt,
    hash,
    actif: true,
    systeme: false,
    cree_le: nowString(),
    cree_par: ctx.user.matricule,
    dernier_acces: null,
    dernier_ip: null,
    mdp_change_le: nowString(),
    mdp_a_changer: !!doit_changer,
    tentatives: 0,
    verrouille_jusqu: null,
  };
  db.users.push(user);
  addAudit({
    matricule: ctx.user.matricule,
    action: 'Création de compte',
    detail: `${personnel.grade} ${personnel.nom} ${personnel.prenom} (${mat}) — rôle ${ROLE_LABELS[role]}`,
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('admin', { action: 'user-created', matricule: mat });
  return { user: userPublic(db, user), mot_de_passe: mot_de_passe ? undefined : password };
});

route('PATCH', '/api/admin/users/:matricule', 'admin', (ctx) => {
  const db = getDb();
  const user = db.users.find((u) => u.matricule === ctx.params.matricule);
  if (!user) throw new HttpError(404, 'Compte introuvable.');
  const { role, actif, mdp_a_changer } = ctx.body || {};

  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide.');
    if (user.systeme && role !== 'admin') throw new HttpError(409, 'Le compte administrateur initial ne peut pas perdre ses droits.');
    if (user.matricule === ctx.user.matricule && role !== 'admin') throw new HttpError(409, 'Vous ne pouvez pas retirer vos propres droits d’administration.');
    if (role !== user.role) {
      addAudit({
        matricule: ctx.user.matricule,
        action: 'Modification de rôle',
        detail: `${user.matricule} : ${ROLE_LABELS[user.role]} → ${ROLE_LABELS[role]}`,
        ip: clientIp(ctx.req),
      });
      user.role = role;
    }
  }

  if (actif !== undefined) {
    if (user.systeme) throw new HttpError(409, 'Le compte administrateur initial ne peut pas être désactivé.');
    if (user.matricule === ctx.user.matricule) throw new HttpError(409, 'Vous ne pouvez pas désactiver votre propre compte.');
    user.actif = !!actif;
    if (!user.actif) db.sessions = db.sessions.filter((s) => s.matricule !== user.matricule);
    addAudit({
      matricule: ctx.user.matricule,
      action: 'Statut de compte',
      detail: `${user.matricule} — ${user.actif ? 'réactivé' : 'désactivé'}`,
      ip: clientIp(ctx.req),
    });
  }

  if (mdp_a_changer !== undefined) {
    user.mdp_a_changer = !!mdp_a_changer;
  }

  save();
  broadcast('admin', { action: 'user-updated', matricule: user.matricule });
  return { user: userPublic(db, user) };
});

route('POST', '/api/admin/users/:matricule/reset-password', 'admin', (ctx) => {
  const db = getDb();
  const user = db.users.find((u) => u.matricule === ctx.params.matricule);
  if (!user) throw new HttpError(404, 'Compte introuvable.');
  const password = ctx.body?.mot_de_passe || generatePassword();
  const errors = passwordErrors(password, db.settings.politique);
  if (errors.length) throw new HttpError(400, `Le mot de passe doit contenir : ${errors.join(', ')}.`);
  const { salt, hash } = hashPassword(password);
  user.salt = salt;
  user.hash = hash;
  user.mdp_change_le = nowString();
  user.mdp_a_changer = true;
  user.tentatives = 0;
  user.verrouille_jusqu = null;
  db.sessions = db.sessions.filter((s) => s.matricule !== user.matricule);
  addAudit({
    matricule: ctx.user.matricule,
    action: 'Réinitialisation de mot de passe',
    detail: `Compte ${user.matricule} — changement imposé à la prochaine connexion`,
    ip: clientIp(ctx.req),
    niveau: 'alerte',
  });
  save();
  return { ok: true, mot_de_passe: ctx.body?.mot_de_passe ? undefined : password };
});

route('DELETE', '/api/admin/users/:matricule', 'admin', (ctx) => {
  const db = getDb();
  const user = db.users.find((u) => u.matricule === ctx.params.matricule);
  if (!user) throw new HttpError(404, 'Compte introuvable.');
  if (user.systeme) throw new HttpError(409, 'Le compte administrateur initial ne peut pas être supprimé.');
  if (user.matricule === ctx.user.matricule) throw new HttpError(409, 'Vous ne pouvez pas supprimer votre propre compte.');
  db.users = db.users.filter((u) => u.matricule !== user.matricule);
  db.sessions = db.sessions.filter((s) => s.matricule !== user.matricule);
  addAudit({
    matricule: ctx.user.matricule,
    action: 'Suppression de compte',
    detail: `Compte ${user.matricule} supprimé`,
    ip: clientIp(ctx.req),
    niveau: 'alerte',
  });
  save();
  broadcast('admin', { action: 'user-deleted', matricule: user.matricule });
  return { ok: true };
});

route('GET', '/api/admin/audit', 'admin', (ctx) => {
  const db = getDb();
  const { q = '', niveau = '', limit = '200' } = ctx.query;
  let list = db.audit.slice();
  if (niveau) list = list.filter((a) => a.niveau === niveau);
  if (q) {
    const n = q.toLowerCase();
    list = list.filter((a) => `${a.matricule} ${a.action} ${a.detail}`.toLowerCase().includes(n));
  }
  return { items: list.slice(0, Number(limit)), total: list.length };
});

route('GET', '/api/admin/sessions', 'admin', (ctx) => {
  const db = getDb();
  return {
    items: db.sessions
      .slice()
      .sort((a, b) => b.dernier_acces_ts - a.dernier_acces_ts)
      .map((s) => {
        const p = db.personnels.find((x) => x.matricule === s.matricule);
        return {
          token_partiel: `${s.token.slice(0, 6)}…`,
          matricule: s.matricule,
          nom: p ? `${p.prenom} ${p.nom}` : '—',
          role: db.users.find((u) => u.matricule === s.matricule)?.role || '—',
          ip: s.ip,
          debut: s.debut,
          dernier_acces: s.dernier_acces,
          actuelle: ctx.session?.token === s.token,
        };
      }),
  };
});

route('DELETE', '/api/admin/sessions/:token', 'admin', (ctx) => {
  const db = getDb();
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.token.slice(0, 6) !== ctx.params.token && s.token !== ctx.params.token);
  save();
  addAudit({ matricule: ctx.user.matricule, action: 'Session', detail: 'Session(s) révoquée(s)', ip: clientIp(ctx.req) });
  return { ok: true, supprimees: before - db.sessions.length };
});

route('GET', '/api/admin/settings', 'admin', (ctx) => {
  const db = getDb();
  return { settings: db.settings, meta: db.meta };
});

route('PATCH', '/api/admin/settings', 'admin', (ctx) => {
  const db = getDb();
  const body = ctx.body || {};
  const s = db.settings;
  const details = [];

  if (body.organisation !== undefined) {
    s.organisation = String(body.organisation).slice(0, 120);
    details.push('organisation');
  }
  if (body.nom_systeme !== undefined) {
    s.nom_systeme = String(body.nom_systeme).slice(0, 60);
    details.push('nom du système');
  }
  if (body.duree_session_minutes !== undefined) {
    const v = Number(body.duree_session_minutes);
    if (!Number.isFinite(v) || v < 5 || v > 480) throw new HttpError(400, 'Durée de session attendue entre 5 et 480 minutes.');
    s.duree_session_minutes = v;
    details.push(`session ${v} min`);
  }
  if (body.tentatives_max !== undefined) {
    const v = Number(body.tentatives_max);
    if (!Number.isFinite(v) || v < 3 || v > 10) throw new HttpError(400, 'Nombre de tentatives attendu entre 3 et 10.');
    s.tentatives_max = v;
    details.push(`tentatives ${v}`);
  }
  if (body.verrouillage_minutes !== undefined) {
    const v = Number(body.verrouillage_minutes);
    if (!Number.isFinite(v) || v < 1 || v > 60) throw new HttpError(400, 'Verrouillage attendu entre 1 et 60 minutes.');
    s.verrouillage_minutes = v;
    details.push(`verrouillage ${v} min`);
  }
  if (body.simulation !== undefined) {
    s.simulation = !!body.simulation;
    details.push(`simulation ${s.simulation ? 'activée' : 'désactivée'}`);
  }
  if (body.cadence_alerte_secondes !== undefined) {
    const v = Number(body.cadence_alerte_secondes);
    if (!Number.isFinite(v) || v < 20 || v > 600) throw new HttpError(400, 'Cadence attendue entre 20 et 600 secondes.');
    s.cadence_alerte_secondes = v;
    details.push(`cadence ${v} s`);
  }
  if (body.politique) {
    const p = s.politique;
    if (body.politique.longueur_min !== undefined) {
      const v = Number(body.politique.longueur_min);
      if (!Number.isFinite(v) || v < 6 || v > 24) throw new HttpError(400, 'Longueur de mot de passe attendue entre 6 et 24.');
      p.longueur_min = v;
    }
    for (const k of ['majuscule', 'minuscule', 'chiffre', 'special']) {
      if (body.politique[k] !== undefined) p[k] = !!body.politique[k];
    }
    details.push('politique de mot de passe');
  }

  addAudit({
    matricule: ctx.user.matricule,
    action: 'Modification des paramètres',
    detail: details.join(', ') || 'aucune modification',
    ip: clientIp(ctx.req),
  });
  save();
  broadcast('settings', publicSettings(db));
  return { settings: db.settings };
});

route('GET', '/api/admin/stats', 'admin', (ctx) => {
  const db = getDb();
  return {
    comptes: db.users.length,
    comptes_actifs: db.users.filter((u) => u.actif).length,
    administrateurs: db.users.filter((u) => u.role === 'admin').length,
    sessions: db.sessions.length,
    audit: db.audit.length,
    personnels: db.personnels.length,
    engins: db.engins.length,
    interventions: db.interventions.length,
  };
});

/* ------------------------------------------------------------------ */
/*  Résolution                                                         */
/* ------------------------------------------------------------------ */

export function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const names = [];
    const regex = new RegExp(
      '^' +
        r.pattern.replace(/:[A-Za-z_]+/g, (m) => {
          names.push(m.slice(1));
          return '([^/]+)';
        }) +
        '/?$',
    );
    const m = pathname.match(regex);
    if (m) {
      const params = {};
      names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
      return { route: r, params };
    }
  }
  return null;
}
