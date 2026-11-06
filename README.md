# SNGP 06 — Système Numérique de Gestion des Personnels

Application web de conduite opérationnelle pour un service départemental d'incendie et de
secours (SDIS 06 — CODIS Nice) : effectifs et disponibilité, synoptique des interventions et
des engins, feuille de garde, historique des dossiers SIN, consignes opérationnelles, comptes
rendus de sortie de secours (CRSS), messages ANTARES, aptitudes et administration des comptes.

L'interface reprend les codes du poste de travail NEOSIS : barre de menus, bandeau SDIS,
tableau de bord temps réel, terminologie opérationnelle française (CIS, CSP, CTA-CODIS, FPT,
VSAV, VSR, EPA, CCF, CCRM, SIN, P1/P2/P3…), avec les accès terrain **BIP BIRDY** (bips
d'alerte individuels) et **Tablette Bilan NEOFIBI**. Aucune mention SAMU n'est présente.

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Modules de l'application](#modules-de-lapplication)
- [Fonctionnalités transverses](#fonctionnalités-transverses)
- [Architecture](#architecture)
- [API HTTP](#api-http)
- [Données et simulation](#données-et-simulation)
- [Paramètres et sécurité](#paramètres-et-sécurité)
- [Outils de contrôle](#outils-de-contrôle)

## Démarrage rapide

Prérequis : **Node.js ≥ 18** (testé en 22). Aucune dépendance npm n'est nécessaire pour
exécuter l'application (serveur HTTP et stockage écrits avec la bibliothèque standard).

```bash
npm start          # ou : node server/index.js
# → http://localhost:3000
```

Variables d'environnement :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3000` | Port d'écoute |
| `HOST` | `0.0.0.0` | Interface d'écoute |

Les données sont persistées dans `data/sngp06.json` (créé au premier démarrage, ignoré par
Git). Supprimer ce fichier régénère un jeu de démonstration complet et cohérent.

## Comptes de démonstration

L'identification se fait **par matricule** (et non par nom), avec un mot de passe nominatif.

| Matricule | Mot de passe | Rôle | Profil |
| --- | --- | --- | --- |
| `10001` | `Admin@06` | Administrateur | Compte initial du système (protégé : ni supprimable, ni désactivable) |
| `10245` | `Codis@2026` | Officier | Chef du CTA-CODIS |
| `10302` | `Officier@06` | Officier | Chef de groupe, officier de permanence |
| `10401` | `Operateur@06` | Opérateur CTA | Chef d'agrès FPT, opérateur CTA |
| `20100` | `Antibes@2026` | Opérateur CTA | Chef de centre (CSP Antibes) |
| `30122` | `Cannes@2026` | Opérateur CTA | Chef de groupe (CSP Cannes) |

Un administrateur peut créer d'autres comptes **administrateurs** depuis
`Administration → Comptes → Créer un compte`, en rattachant le compte à une fiche personnel
existante ou en créant la fiche. Les droits sont effectifs dès la connexion suivante.

## Modules de l'application

| Vue | Route | Contenu |
| --- | --- | --- |
| Tableau de bord | `#/tableau-de-bord` | Indicateurs départementaux, synoptique cartographique, garde du jour, activité 24 h, journal des opérations |
| Synoptique des interventions | `#/interventions` | Carte opérationnelle, filtres (famille, centre, statut), dossiers en cours et clôturés |
| Dossier d'intervention | `#/intervention/:id` | Situation, chronologie, progression par étapes, moyens engagés et équipages, bilan, messages ANTARES |
| Synoptique des engins | `#/engins` | Parc par centre, disponibilité, immatriculation, radio, kilométrage, modification de statut |
| Effectif et disponibilité | `#/effectif` | 71 personnels, aptitudes, garde, statut, fiche individuelle et changement de disponibilité |
| Feuille de garde | `#/gardes` | Garde du jour, planning hebdomadaire, composition par CIS (chef de garde, effectif, engins armés) |
| Historique des interventions | `#/historique` | Dossiers clôturés, durée, moyens, bilan, export CSV |
| Consignes opérationnelles | `#/consignes` | Base documentaire (référence, catégorie, diffusion, lecteur) |
| Comptes rendus de sortie de secours | `#/crss` | Registre des CRSS, rédaction et visa |
| Aptitudes des personnels | `#/aptitudes` | Matrice personnels × qualifications, échéances à 90 jours, effectifs par aptitude |
| Messages ANTARES | `#/antares` | Dossiers de sinistre, message de départ / situation / renfort / clôture, transmission CODIS |
| NEOSIS Web/Mobile | `#/neosis-mobile` | Aperçu du terminal embarqué et des fonctions mobiles |
| Administration | `#/administration` | Comptes, journal d'audit, sessions actives, paramètres de sécurité |
| Mon compte | `#/mon-compte` | Identité, coordonnées, sécurité de l'accès, historique personnel |

## Fonctionnalités transverses

- **Authentification nominative** par matricule, mot de passe haché (scrypt + sel), cookie de
  session `HttpOnly`, expiration après inactivité.
- **Comptes administrateurs configurables** : création, modification, réinitialisation de mot de
  passe, désactivation et suppression ; garde-fous sur le compte initial.
- **Journal d'audit** horodaté (connexions, échecs, actions d'administration, actes
  opérationnels) avec niveaux `info` / `alerte`.
- **Sessions actives** : liste, révocation individuelle, fermeture automatique.
- **Temps réel** : flux SSE (`/api/events`) qui rafraîchit les vues à chaque événement
  opérationnel (nouvelle alerte, étape, clôture, changement de disponibilité).
- **Simulation opérationnelle** : génération d'alertes et progression des étapes pour animer la
  démonstration (désactivable dans les paramètres).
- **Politique de mot de passe** paramétrable (longueur, majuscule, minuscule, chiffre, caractère
  spécial) et verrouillage temporaire après N échecs.
- **Impression** des vues et documents (CRSS, consignes) via la feuille de style dédiée.
- **Périphériques de terrain** : état du parc BIP BIRDY (porteurs, autotests, batterie) et des
  tablettes bilan NEOFIBI (bilans du jour, synchronisation), accessibles depuis le bandeau et
  le menu Sapeurs-Pompiers.

## Architecture

```
server/
  index.js     serveur HTTP, fichiers statiques, SSE, démarrage
  routes.js    routage REST, permissions, validation
  auth.js      hachage scrypt, sessions
  store.js     persistance JSON (écriture atomique)
  seed.js      jeu de données de démonstration (personnels, engins, dossiers, consignes…)
  ops.js       logique opérationnelle (étapes, équipages, CRSS, ANTARES)
  sim.js       simulation des alertes et progressions
  events.js    bus d'événements et diffusion SSE
public/
  index.html   coque applicative, écran de connexion, sprite d'icônes SVG
  css/app.css  design system (thème clair, densité « poste de travail »)
  js/app.js    routeur, coque, menus, connexion, modales
  js/api.js    client HTTP
  js/util.js   helpers de rendu (badges, cartes, carte SVG, formats)
  js/state.js  état partagé et permissions
  js/views/    une vue par module
tools/qa/      captures d'écran et tests de fumée (non nécessaires à l'exécution)
```

## API HTTP

Authentification par cookie de session. Les réponses sont en JSON.

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Connexion (matricule + mot de passe) |
| `POST` | `/api/auth/logout` | Fermeture de session |
| `GET` | `/api/auth/me` | Utilisateur courant |
| `POST` | `/api/auth/change-password` | Changement de mot de passe |
| `POST` | `/api/auth/profile` | Mise à jour des coordonnées |
| `GET` | `/api/bootstrap` | Référentiels (CIS, grades, familles, aptitudes, communes, politiques) |
| `GET` | `/api/dashboard` · `/api/stats` | Indicateurs du tableau de bord et de la barre d'état |
| `GET/POST` | `/api/interventions` | Liste filtrée / création d'un dossier SIN |
| `GET` | `/api/interventions/:id` | Détail d'un dossier |
| `PATCH` | `/api/interventions/:id` | Étape suivante, clôture, renfort, bilan |
| `GET` | `/api/interventions/:id/antares` | Message ANTARES associé |
| `GET` | `/api/personnels` · `/api/personnels/:matricule` | Effectif et fiche individuelle |
| `PATCH` | `/api/personnels/:matricule` | Disponibilité / statut |
| `GET` | `/api/engins` · `PATCH /api/engins/:indicatif` | Parc matériel et disponibilité |
| `GET` | `/api/gardes` · `/api/gardes/semaine` | Garde du jour et planning |
| `GET` | `/api/consignes` · `/api/consignes/:id` | Base documentaire |
| `GET` | `/api/aptitudes` | Matrice et échéances |
| `GET/POST` | `/api/crss` | Registre et rédaction des CRSS |
| `GET/POST/PATCH/DELETE` | `/api/admin/users…` | Gestion des comptes (admin) |
| `GET` | `/api/admin/audit` · `/api/admin/sessions` · `/api/admin/settings` · `/api/admin/stats` | Administration (admin) |
| `GET` | `/api/events` | Flux temps réel (SSE) |

## Données et simulation

Le jeu de démonstration est déterministe (graine fixe) : 71 personnels répartis sur 8 CIS,
32 engins, une soixantaine de dossiers SIN sur les dernières semaines, 8 consignes, une
rotation de gardes A–D et une matrice de 24 qualifications SDIS 06.

La simulation (`server/sim.js`) crée de nouvelles alertes selon la cadence paramétrée
(120 s par défaut) et fait progresser les dossiers en cours (départ, sur les lieux, action,
retour, clôture) en affectant les équipages disponibles. Elle s'arrête lorsque l'option
« Générer des alertes automatiquement » est désactivée.

## Paramètres et sécurité

Modifiables dans `Administration → Paramètres` : nom du système, organisation, durée de
session (60 min), tentatives avant verrouillage (5), durée du verrouillage (5 min), politique
de mot de passe (8 caractères, majuscule, minuscule, chiffre), simulation et cadence.

Bonnes pratiques appliquées : mots de passe salés et hachés (scrypt 64 octets), comparaison en
temps constant, cookie de session `HttpOnly` + `SameSite=Lax`, contrôle de permission par route,
validation systématique des entrées, journalisation des accès refusés, écriture atomique du
fichier de données.

> Application de démonstration : les données sont fictives et aucune liaison réelle avec les
> systèmes NTS, ANTARES ou les réseaux opérationnels du SDIS n'est établie.

## Outils de contrôle

```bash
npm i --no-save jsdom puppeteer-core @sparticuz/chromium
node tools/qa/routes-smoke.mjs    # parcours de toutes les vues (jsdom)
node tools/qa/login-smoke.mjs     # écran de connexion et session (jsdom)
node tools/qa/shots.mjs           # captures 1440×900 dans tools/qa/out/
```

Voir `tools/qa/README.md` pour les prérequis Chromium sous Linux minimal.
