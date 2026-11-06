/**
 * Simulateur opérationnel — fait vivre le CTA-CODIS (nouvelles alertes,
 * progression des interventions, mise à jour des disponibilités).
 */
import { getDb, save, addAudit } from './store.js';
import { broadcast } from './events.js';
import {
  avancerIntervention,
  creerIntervention,
  randomStreet,
  affecterEquipages,
} from './ops.js';
import { NATURES, CIS } from './seed.js';

let timer = null;
let lastAlerte = 0;

function parse(value) {
  if (!value) return Infinity;
  const t = new Date(String(value).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? Infinity : t;
}

function engageEquipagesExistants(db) {
  for (const iv of db.interventions) {
    if (iv.statut === 'Clôturée') continue;
    const manque = iv.engins.some((e) => !e.equipage || e.equipage.length === 0);
    if (manque) {
      // Les engins déjà positionnés sur l'intervention sont marqués engagés.
      for (const item of iv.engins) {
        const engin = db.engins.find((e) => e.indicatif === item.indicatif);
        if (engin && engin.statut !== 'Engagé') {
          engin.statut = 'Engagé';
          engin.intervention_id = iv.id;
        }
      }
      affecterEquipages(db, iv);
      if (!iv.chef_agres) {
        const chef = iv.engins.map((e) => e.chef).find(Boolean);
        if (chef) iv.chef_agres = { matricule: chef.matricule, nom: chef.nom, prenom: chef.prenom, grade: chef.grade };
      }
    }
  }
  save();
}

export function demarrerSimulation() {
  const db = getDb();
  engageEquipagesExistants(db);
  if (db.settings.simulation === false) {
    console.log('[sim] simulation désactivée dans les paramètres');
    return;
  }
  lastAlerte = Date.now();
  console.log('[sim] simulateur opérationnel démarré');

  timer = setInterval(() => {
    const database = getDb();
    if (database.settings.simulation === false) return;
    const now = Date.now();
    let changed = false;

    const actives = database.interventions.filter((i) => i.statut !== 'Clôturée');
    for (const iv of actives) {
      if (parse(iv.prochaine_etape) <= now) {
        avancerIntervention(database, iv);
        changed = true;
        broadcast('intervention', { id: iv.id, numero: iv.numero, statut: iv.statut, etape: iv.etape });
      }
    }

    const cadence = Math.max(20, Number(database.settings.cadence_alerte_secondes) || 120) * 1000;
    const enCours = database.interventions.filter((i) => i.statut !== 'Clôturée');
    if (now - lastAlerte > cadence * (0.7 + Math.random() * 0.6) && enCours.length < 12) {
      lastAlerte = now;
      const nature = NATURES[Math.floor(Math.random() * NATURES.length)];
      const cis = CIS[Math.floor(Math.random() * CIS.length)];
      const iv = creerIntervention(database, {
        nature: nature.nature,
        adresse: randomStreet(cis.commune),
        commune: cis.commune,
        priorite: nature.priorite,
        source: ['Appel 18', 'Appel 112', 'ANTARES'][Math.floor(Math.random() * 3)],
        auteur: 'Simulateur',
        auto: true,
      });
      addAudit({
        matricule: 'SYSTEME',
        action: 'Nouvelle alerte',
        detail: `${iv.numero} — ${iv.nature} — ${iv.commune}`,
      });
      broadcast('alerte', { id: iv.id, numero: iv.numero, nature: iv.nature, commune: iv.commune, priorite: iv.priorite });
      changed = true;
    }

    if (changed) save();
  }, 3000);
  timer.unref?.();
}

export function arreterSimulation() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function reinitialiserCadence() {
  lastAlerte = Date.now();
}
