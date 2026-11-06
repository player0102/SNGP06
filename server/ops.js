/**
 * Logique métier opérationnelle partagée entre l'API et le simulateur.
 */
import { GRADES, NATURES, CIS, STREETS, CIS_COORDS } from './seed.js';
import { nowString } from './store.js';

export const ETAPES = ['Alerte', 'Départ', 'Sur les lieux', 'En action', 'Retour', 'Clôturée'];

export const FAMILLE_LABELS = {
  INC: 'Incendie',
  FDF: 'Feux de forêt',
  SR: 'Secours routier',
  SAP: 'Secours à personne',
  DIV: 'Divers / risque',
  RCH: 'Recherche et sauvetage',
};

export const PRIORITES = ['P1', 'P2', 'P3'];

export function etapeLabel(iv) {
  if (iv.statut === 'Clôturée') return 'Clôturée';
  return ETAPES[iv.etape ?? 0] || 'Alerte';
}

export function numeroSuivant(db) {
  db.meta.compteur_sin = (db.meta.compteur_sin || 1000) + 1;
  const year = new Date().getFullYear();
  return `${year}-06-${db.meta.compteur_sin}`;
}

export function chiefOf(pdb, cis, exclude = []) {
  const list = pdb
    .filter((p) => p.cis === cis && !exclude.includes(p.matricule))
    .sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade));
  return list[0] || null;
}

/** Sélectionne des engins disponibles pour une nature donnée. */
export function choisirEngins(db, cis, types) {
  const out = [];
  for (const type of types) {
    let pool = db.engins.filter(
      (e) => e.type === type && e.statut === 'Disponible' && !out.includes(e),
    );
    const local = pool.filter((e) => e.cis === cis);
    if (local.length) pool = local;
    if (pool.length) out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out;
}

export function affecterEquipages(db, iv) {
  const personnels = db.personnels;
  for (const item of iv.engins) {
    const engin = db.engins.find((e) => e.indicatif === item.indicatif);
    if (!engin) continue;
    engin.statut = 'Engagé';
    engin.intervention_id = iv.id;
    const besoin = engin.effectif || 3;
    const deja = new Set(iv.engins.flatMap((x) => x.equipage || []));
    let pool = personnels.filter(
      (p) => p.cis === engin.cis && p.statut === 'Disponible' && !deja.has(p.matricule),
    );
    if (pool.length < besoin) {
      pool = pool.concat(
        personnels.filter(
          (p) => p.statut === 'Disponible' && p.cis !== engin.cis && !deja.has(p.matricule) && !pool.includes(p),
        ),
      );
    }
    pool.sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade));
    const equipage = pool.slice(0, besoin);
    engin.equipage = equipage.map((p) => p.matricule);
    item.equipage = [...engin.equipage];
    item.chef = equipage[0]
      ? { matricule: equipage[0].matricule, nom: equipage[0].nom, prenom: equipage[0].prenom, grade: equipage[0].grade }
      : null;
    for (const p of equipage) {
      p.statut = 'En intervention';
      p.disponible = false;
    }
  }
}

function liberer(db, iv) {
  for (const item of iv.engins) {
    const engin = db.engins.find((e) => e.indicatif === item.indicatif);
    if (engin && engin.intervention_id === iv.id) {
      engin.statut = 'Disponible';
      engin.intervention_id = null;
      for (const mat of engin.equipage) {
        const p = db.personnels.find((x) => x.matricule === mat);
        if (p && p.statut === 'En intervention') {
          p.statut = 'Disponible';
          p.disponible = true;
        }
      }
      engin.equipage = [];
    }
  }
}

export function creerIntervention(db, params) {
  const {
    nature,
    adresse,
    commune,
    priorite,
    source = 'Appel 18',
    enginsChoisis = [],
    auteur = 'Système',
    auto = false,
  } = params;

  const natureRef = NATURES.find((n) => n.nature === nature) || NATURES[0];
  const cis = CIS.find((c) => c.commune === commune) || CIS.find((c) => c.code === commune) || CIS[0];
  const coords = CIS_COORDS[cis.commune] || [cis.lat, cis.lng];
  const engins = enginsChoisis.length
    ? enginsChoisis
    : choisirEngins(db, cis.code, natureRef.moyens);

  const now = new Date();
  const iv = {
    id: `sin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    numero: numeroSuivant(db),
    famille: natureRef.famille,
    nature: natureRef.nature,
    adresse,
    commune: cis.commune,
    lat: +(coords[0] + (Math.random() - 0.5) * 0.014).toFixed(5),
    lng: +(coords[1] + (Math.random() - 0.5) * 0.018).toFixed(5),
    priorite: priorite || natureRef.priorite,
    statut: 'En cours',
    etape: 1,
    source,
    cree_le: nowString(),
    alerte_le: nowString(),
    depart_le: nowString(),
    arrivee_le: null,
    cloture_le: null,
    engins: engins.map((e, i) => ({
      indicatif: e.indicatif,
      type: e.type,
      cis: e.cis,
      role: i === 0 ? 'Chef de dispositif' : 'Moyen',
      equipage: [],
      chef: null,
    })),
    chef_agres: null,
    victimes: null,
    bilan: null,
    destinataire: 'CODIS 06',
    crss: null,
    auto,
    auteur,
    evenements: [{ ts: nowString(), texte: `Alerte reçue — ${natureRef.nature} — ${adresse}, ${cis.commune} (${source})` }],
    prochaine_etape: new Date(Date.now() + 20000 + Math.random() * 20000).toISOString(),
  };
  affecterEquipages(db, iv);
  const chef = iv.engins.map((e) => e.chef).find(Boolean) || chiefOf(db.personnels, cis.code);
  iv.chef_agres = chef
    ? { matricule: chef.matricule, nom: chef.nom, prenom: chef.prenom, grade: chef.grade }
    : null;
  if (iv.engins.length) {
    iv.evenements.push({
      ts: nowString(),
      texte: `Départ des moyens : ${iv.engins.map((e) => e.indicatif).join(', ')}`,
    });
  }
  db.interventions.unshift(iv);
  return iv;
}

const BILAN_PAR_FAMILLE = {
  INC: 'Foyer éteint à la lance, reconnaissance complète effectuée. Pas de propagation aux niveaux supérieurs. Bilan humain négatif.',
  FDF: 'Surface parcourue maîtrisée, noyage des lisières en cours. Aucune habitation menacée.',
  SR: 'Accident pris en charge, fluides neutralisés. Une victime légère transportée vers le CHU Pasteur.',
  SAP: 'Victime prise en charge par l’équipe du VSAV, transport vers le centre hospitalier du secteur.',
  DIV: 'Situation stabilisée après reconnaissance. Périmètre de sécurité levé.',
  RCH: 'Reconnaissance terminée, personne retrouvée saine et sauve, remise à la famille.',
};

/** Fait progresser une intervention d'une étape. */
export function avancerIntervention(db, iv) {
  if (iv.statut === 'Clôturée') return;
  const step = iv.etape ?? 0;
  const now = nowString();

  if (step < 2) {
    iv.etape = 2;
    iv.arrivee_le = now;
    iv.evenements.push({ ts: now, texte: `Arrivée sur les lieux — ${iv.engins.map((e) => e.indicatif).join(', ')}` });
    iv.evenements.push({ ts: now, texte: 'Reconnaissance en cours, point de situation transmis au CODIS' });
    iv.prochaine_etape = new Date(Date.now() + 30000 + Math.random() * 40000).toISOString();
    return;
  }
  if (step < 3) {
    iv.etape = 3;
    iv.evenements.push({ ts: now, texte: `Engagement des moyens — ${iv.famille === 'SAP' ? 'bilan et prise en charge' : 'attaque du sinistre'} en cours` });
    iv.prochaine_etape = new Date(Date.now() + 45000 + Math.random() * 60000).toISOString();
    return;
  }
  if (step < 4) {
    iv.etape = 4;
    iv.bilan = BILAN_PAR_FAMILLE[iv.famille] || BILAN_PAR_FAMILLE.DIV;
    iv.victimes = iv.famille === 'SAP' || iv.famille === 'SR' ? 1 : 0;
    iv.evenements.push({ ts: now, texte: 'Sinistre maîtrisé — retour au centre de secours en cours' });
    iv.prochaine_etape = new Date(Date.now() + 25000 + Math.random() * 30000).toISOString();
    return;
  }
  // Clôture
  iv.etape = 5;
  iv.statut = 'Clôturée';
  iv.cloture_le = now;
  iv.bilan = iv.bilan || BILAN_PAR_FAMILLE[iv.famille];
  iv.crss = {
    redige_par: iv.chef_agres?.matricule || '—',
    redige_le: now,
    visa: 'Chef de garde',
    bilan: iv.bilan,
    consequences: iv.famille === 'SAP' ? 'Transport vers le centre hospitalier du secteur.' : 'Aucune suite particulière.',
    suites: 'Engins remis en disponibilité après nettoyage et recomplètement.',
  };
  iv.evenements.push({ ts: now, texte: 'Intervention clôturée — CRSS transmis au CODIS' });
  iv.prochaine_etape = null;
  liberer(db, iv);
}

/* ------------------------------------------------------------------ */
/*  Message ANTARES                                                    */
/* ------------------------------------------------------------------ */

const ANTARES_TYPES = {
  DEPART: 'MESSAGE DE DEPART',
  SITUATION: 'MESSAGE DE SITUATION',
  RENFORT: 'DEMANDE DE RENFORT',
  CLOTURE: 'MESSAGE DE CLOTURE',
};

export function genererAntares(iv, type = 'DEPART') {
  const p = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const horodate = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} à ${p(now.getHours())}:${p(now.getMinutes())}`;
  const situation = {
    DEPART: `Moyens engagés : ${iv.engins.map((e) => e.indicatif).join(', ')}.`,
    SITUATION: iv.statut === 'Clôturée' ? iv.bilan : 'Sur les lieux, reconnaissance en cours, première estimation transmise.',
    RENFORT: 'Demande de moyen supplémentaire : 1 VSAV et 1 FPT en renfort.',
    CLOTURE: iv.bilan || 'Intervention terminée, moyens rentrés au centre de secours.',
  }[type] || '';
  const lignes = [
    `== MESSAGE ANTARES ==`,
    `EMETTEUR : CTA-CODIS 06 — NICE`,
    `EMIS LE  : ${horodate}`,
    `REF SIN  : ${iv.numero}`,
    `TYPE     : ${ANTARES_TYPES[type] || ANTARES_TYPES.DEPART}`,
    `NATURE   : ${iv.nature.toUpperCase()}`,
    `PRIORITE : ${iv.priorite}`,
    `LIEU     : ${iv.adresse.toUpperCase()} — ${iv.commune.toUpperCase()} (06)`,
    `MOYENS   : ${iv.engins.map((e) => e.indicatif).join(' / ') || 'AUCUN'}`,
    `SITUATION: ${situation}`,
    `DESTINAT.: CODIS 06 / CENTRE DE SECOURS CONCERNE`,
    `== FIN DE MESSAGE ==`,
  ];
  return lignes.join('\n');
}

export function historiqueAntares(iv) {
  const types = ['DEPART', 'SITUATION', 'RENFORT'];
  if (iv.statut === 'Clôturée') types.push('CLOTURE');
  return types.map((t) => ({ type: t, libelle: ANTARES_TYPES[t], texte: genererAntares(iv, t) }));
}

/* ------------------------------------------------------------------ */
/*  Feuille de garde                                                   */
/* ------------------------------------------------------------------ */

const GARDES = ['A', 'B', 'C', 'D'];

export function gardeDuJour(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const days = Math.floor(d.getTime() / 864e5);
  return GARDES[((days % 4) + 4) % 4];
}

export function feuilleDeGarde(db, dateStr) {
  const garde = gardeDuJour(dateStr);
  const centres = CIS.map((c) => {
    const effectif = db.personnels.filter((p) => p.cis === c.code && p.garde === garde);
    const chef = effectif.slice().sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade))[0];
    const engins = db.engins.filter((e) => e.cis === c.code && !['VLI', 'VPC'].includes(e.type));
    return {
      cis: c.code,
      nom: c.nom,
      commune: c.commune,
      chef: chef ? { matricule: chef.matricule, nom: chef.nom, prenom: chef.prenom, grade: chef.grade } : null,
      effectif: effectif.map((p) => ({
        matricule: p.matricule,
        nom: p.nom,
        prenom: p.prenom,
        grade: p.grade,
        statut: p.statut,
        aptitudes: p.aptitudes.map((a) => a.code),
      })),
      engins: engins.map((e) => ({ indicatif: e.indicatif, type: e.type, statut: e.statut })),
      effectif_count: effectif.length,
      engins_count: engins.length,
    };
  });
  return {
    date: dateStr,
    garde,
    libelle: `Garde ${garde}`,
    horaires: { jour: '07:30 — 19:30', nuit: '19:30 — 07:30' },
    centres,
    total_personnels: centres.reduce((s, c) => s + c.effectif_count, 0),
    total_engins: centres.reduce((s, c) => s + c.engins_count, 0),
  };
}

/* ------------------------------------------------------------------ */
/*  Statistiques & disponibilité                                       */
/* ------------------------------------------------------------------ */

export function statistiques(db) {
  const actives = db.interventions.filter((i) => i.statut !== 'Clôturée');
  const dispoPersonnels = db.personnels.filter((p) => p.statut === 'Disponible');
  const dispoEngins = db.engins.filter((e) => e.statut === 'Disponible');
  const engagePersonnels = db.personnels.filter((p) => p.statut === 'En intervention');

  const parFamille = {};
  for (const iv of db.interventions) parFamille[iv.famille] = (parFamille[iv.famille] || 0) + 1;

  const parCis = {};
  for (const iv of db.interventions) {
    const cis = CIS.find((c) => c.commune === iv.commune)?.code || 'AUTRE';
    parCis[cis] = (parCis[cis] || 0) + 1;
  }

  return {
    interventions_en_cours: actives.length,
    engins_engages: actives.reduce((s, i) => s + i.engins.length, 0),
    personnels_engages: engagePersonnels.length,
    personnels_disponibles: dispoPersonnels.length,
    personnels_total: db.personnels.length,
    engins_disponibles: dispoEngins.length,
    engins_total: db.engins.length,
    taux_disponibilite_personnel: Math.round((dispoPersonnels.length / db.personnels.length) * 100),
    taux_disponibilite_engins: Math.round((dispoEngins.length / db.engins.length) * 100),
    total_interventions: db.interventions.length,
    par_famille: parFamille,
    par_cis: parCis,
    garde: gardeDuJour(nowString().slice(0, 10)),
  };
}

export function activite24h(db) {
  const now = Date.now();
  const slots = new Array(24).fill(0);
  for (const iv of db.interventions) {
    const t = new Date(iv.cree_le.replace(' ', 'T')).getTime();
    if (Number.isNaN(t)) continue;
    const diff = now - t;
    if (diff >= 0 && diff < 24 * 3600e3) {
      const h = Math.floor(diff / 3600e3);
      slots[23 - h] += 1;
    }
  }
  return slots;
}

export function communesList() {
  return CIS.map((c) => ({ code: c.code, commune: c.commune, nom: c.nom, lat: c.lat, lng: c.lng }));
}

export function randomStreet(commune) {
  const list = STREETS[commune] || STREETS.Nice;
  return list[Math.floor(Math.random() * list.length)];
}
