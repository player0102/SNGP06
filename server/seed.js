/**
 * SNGP 06 — Jeu de données initial (installation du système).
 *
 * Les données sont déterministes : un même déploiement produit toujours
 * la même base, ce qui facilite les démonstrations et les sauvegardes.
 */
import crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260606);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, len = 2) => String(n).padStart(len, '0');

function iso(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
function isoTime(d) {
  const x = new Date(d);
  return `${iso(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
}

export const GRADES = [
  'Sapeur 2e classe',
  'Sapeur 1re classe',
  'Caporal',
  'Caporal-chef',
  'Sergent',
  'Sergent-chef',
  'Adjudant',
  'Adjudant-chef',
  'Major',
  'Lieutenant',
  'Capitaine',
  'Commandant',
  'Lieutenant-colonel',
  'Colonel',
];

const APTITUDES_REF = [
  { code: 'SAP1', libelle: "Équipier secours d'urgence à personne" },
  { code: 'SAP2', libelle: 'Chef d\'agrès secours à personne' },
  { code: 'INC1', libelle: 'Équipier incendie' },
  { code: 'INC2', libelle: "Chef d'agrès incendie" },
  { code: 'INC3', libelle: 'Chef de groupe incendie' },
  { code: 'FDF1', libelle: 'Équipier feux de forêt' },
  { code: 'FDF2', libelle: "Chef d'agrès feux de forêt" },
  { code: 'FDF3', libelle: 'Chef de groupe feux de forêt' },
  { code: 'SR1', libelle: 'Équipier secours routier' },
  { code: 'SR2', libelle: "Chef d'agrès secours routier" },
  { code: 'RCH1', libelle: 'Équipier recherche et sauvetage' },
  { code: 'RCH2', libelle: 'Chef de dispositif recherche et sauvetage' },
  { code: 'GRIMP', libelle: 'Intervention en milieu périlleux' },
  { code: 'SAL1', libelle: 'Sauvetage aquatique — équipier' },
  { code: 'SAL2', libelle: 'Sauvetage aquatique — chef de dispositif' },
  { code: 'RCH', libelle: 'Risques chimiques et biologiques' },
  { code: 'ADR', libelle: 'Transport de matières dangereuses' },
  { code: 'CYNO', libelle: 'Conducteur de chien de recherche' },
  { code: 'PLG', libelle: 'Plongeur autonome' },
  { code: 'RAD', libelle: 'Opérateur radio CTA-CODIS' },
  { code: 'COD1', libelle: 'Chef de colonne' },
  { code: 'COD2', libelle: "Chef de site / gestion d'intervention majeure" },
  { code: 'MNG', libelle: 'Management de proximité' },
  { code: 'SSE', libelle: 'Sécurité et santé en intervention' },
];

/* ------------------------------------------------------------------ */
/*  Centres de secours                                                 */
/* ------------------------------------------------------------------ */

export const CIS = [
  { code: 'NICE', nom: 'CSP Nice — Centre', commune: 'Nice', adresse: '2 rue de la Condamine', lat: 43.7102, lng: 7.262 },
  { code: 'ANTIBES', nom: 'CSP Antibes', commune: 'Antibes', adresse: '24 av. Robert Soleau', lat: 43.5808, lng: 7.1239 },
  { code: 'CANNES', nom: 'CSP Cannes', commune: 'Cannes', adresse: '7 bd de la Croisette', lat: 43.5528, lng: 7.0174 },
  { code: 'GRASSE', nom: 'CIS Grasse', commune: 'Grasse', adresse: '5 bd du Jeu de Ballon', lat: 43.6598, lng: 6.9225 },
  { code: 'MENTON', nom: 'CIS Menton', commune: 'Menton', adresse: '3 av. de Verdun', lat: 43.7765, lng: 7.5 },
  { code: 'CAGNES', nom: 'CIS Cagnes-sur-Mer', commune: 'Cagnes-sur-Mer', adresse: '11 av. de la Gare', lat: 43.6635, lng: 7.1479 },
  { code: 'STLAURENT', nom: 'CIS Saint-Laurent-du-Var', commune: 'Saint-Laurent-du-Var', adresse: '7 av. de Verdun', lat: 43.6731, lng: 7.1881 },
  { code: 'VENCE', nom: 'CIS Vence', commune: 'Vence', adresse: '4 place du Grand Jardin', lat: 43.7225, lng: 7.1119 },
];

export const CIS_COORDS = Object.fromEntries(CIS.map((c) => [c.commune, [c.lat, c.lng]]));

/* ------------------------------------------------------------------ */
/*  Personnel                                                          */
/* ------------------------------------------------------------------ */

// [matricule, grade, nom, prénom, code CIS, fonction]
const PERSONNEL_TABLE = [
  ['10001', 'Colonel', 'DELAUNAY', 'Marc', 'CODIS', 'Directeur départemental adjoint — Administrateur du système'],
  ['10112', 'Lieutenant-colonel', 'VASSEUR', 'Hélène', 'CODIS', 'Chef du groupement des opérations'],
  ['10245', 'Capitaine', 'MERCIER', 'Sophie', 'CODIS', 'Chef du CTA-CODIS'],
  ['10288', 'Capitaine', 'LEROY', 'Antoine', 'NICE', 'Chef de compagnie Nice'],
  ['10302', 'Lieutenant', 'FONTAINE', 'Élodie', 'CODIS', 'Chef de groupe — Officier de permanence'],
  ['10345', 'Lieutenant', 'GARNIER', 'Pierre', 'NICE', 'Chef de groupe'],
  ['10401', 'Adjudant-chef', 'BENALI', 'Karim', 'CODIS', "Chef d'agrès FPT — Opérateur CTA"],
  ['10422', 'Adjudant-chef', 'DUPONT', 'Sylvie', 'NICE', "Chef d'agrès VSAV"],
  ['10456', 'Adjudant', 'MARTINEZ', 'Hugo', 'NICE', "Chef d'agrès FPT"],
  ['10478', 'Adjudant', 'ROUSSEAU', 'Claire', 'NICE', "Chef d'agrès SAP"],
  ['10502', 'Sergent-chef', 'MOREAU', 'Julien', 'NICE', 'Équipier incendie'],
  ['10523', 'Sergent-chef', 'PETIT', 'Amandine', 'NICE', 'Équipier SAP'],
  ['10547', 'Sergent', 'GARCIA', 'Luis', 'NICE', 'Équipier incendie'],
  ['10568', 'Sergent', 'LAMBERT', 'Chloé', 'NICE', 'Équipier SAP'],
  ['10590', 'Caporal-chef', 'SIMON', 'Nicolas', 'NICE', 'Équipier incendie'],
  ['10611', 'Caporal-chef', 'BERNARD', 'Léa', 'NICE', 'Équipier SAP'],
  ['10632', 'Caporal-chef', 'THOMAS', 'Yanis', 'NICE', 'Équipier incendie'],
  ['10654', 'Caporal', 'MICHEL', 'Emma', 'NICE', 'Équipier SAP'],
  ['10675', 'Caporal', 'DAVID', 'Rayan', 'NICE', 'Équipier incendie'],
  ['10696', 'Caporal', 'BLANC', 'Manon', 'NICE', 'Équipier SAP'],
  ['10718', 'Sapeur 1re classe', 'GUERIN', 'Lucas', 'NICE', 'Équipier'],
  ['10739', 'Sapeur 1re classe', 'FAURE', 'Inès', 'NICE', 'Équipier'],
  ['10760', 'Sapeur 2e classe', 'ROY', 'Maxime', 'NICE', 'Équipier'],
  ['10781', 'Sapeur 2e classe', 'AUBERT', 'Sarah', 'NICE', 'Équipier'],
  ['10802', 'Sapeur 2e classe', 'HENRY', 'Enzo', 'NICE', 'Équipier'],

  ['20100', 'Capitaine', 'ROUX', 'Vincent', 'ANTIBES', 'Chef de centre'],
  ['20121', 'Lieutenant', 'BLONDEAU', 'Céline', 'ANTIBES', 'Chef de groupe'],
  ['20145', 'Adjudant-chef', 'PERROT', 'Damien', 'ANTIBES', "Chef d'agrès FPT"],
  ['20167', 'Adjudant', 'CHAUVIN', 'Laura', 'ANTIBES', "Chef d'agrès VSAV"],
  ['20189', 'Sergent-chef', 'DUBOIS', 'Alexis', 'ANTIBES', 'Équipier incendie'],
  ['20210', 'Sergent', 'MERLIN', 'Julie', 'ANTIBES', 'Équipier SAP'],
  ['20232', 'Caporal-chef', 'LOPEZ', 'Kévin', 'ANTIBES', 'Équipier incendie'],
  ['20254', 'Caporal', 'GIRAUD', 'Nina', 'ANTIBES', 'Équipier SAP'],
  ['20276', 'Sapeur 1re classe', 'PASQUIER', 'Hugo', 'ANTIBES', 'Équipier'],
  ['20298', 'Sapeur 2e classe', 'CHEVALIER', 'Anaïs', 'ANTIBES', 'Équipier'],

  ['30100', 'Commandant', 'BONNET', 'Frédéric', 'CANNES', 'Chef de centre'],
  ['30122', 'Capitaine', 'ALBERTI', 'Giulia', 'CANNES', 'Chef de groupe'],
  ['30144', 'Adjudant-chef', 'RENAUD', 'Olivier', 'CANNES', "Chef d'agrès FPT"],
  ['30166', 'Adjudant', 'VICTOR', 'Marie', 'CANNES', "Chef d'agrès SAP"],
  ['30188', 'Sergent-chef', 'ANDRE', 'Thomas', 'CANNES', 'Équipier incendie'],
  ['30210', 'Caporal-chef', 'LEROY', 'Océane', 'CANNES', 'Équipier SAP'],
  ['30232', 'Caporal', 'COSTA', 'Anthony', 'CANNES', 'Équipier incendie'],
  ['30254', 'Sapeur 1re classe', 'MARTIN', 'Eva', 'CANNES', 'Équipier'],

  ['40100', 'Capitaine', 'DUPRE', 'Laetitia', 'GRASSE', 'Chef de centre'],
  ['40122', 'Lieutenant', 'SANCHEZ', 'Pablo', 'GRASSE', 'Chef de groupe'],
  ['40144', 'Adjudant-chef', 'GONZALEZ', 'Rémi', 'GRASSE', "Chef d'agrès FPT"],
  ['40166', 'Sergent-chef', 'BOUCHER', 'Camille', 'GRASSE', 'Équipier incendie'],
  ['40188', 'Caporal-chef', 'FABRE', 'Quentin', 'GRASSE', 'Équipier'],
  ['40210', 'Caporal', 'MARTY', 'Lou', 'GRASSE', 'Équipier SAP'],
  ['40232', 'Sapeur 2e classe', 'RICARD', 'Noah', 'GRASSE', 'Équipier'],

  ['50100', 'Capitaine', 'ORSINI', 'Paul', 'MENTON', 'Chef de centre'],
  ['50122', 'Lieutenant', 'BRIANCON', 'Marie', 'MENTON', 'Chef de groupe'],
  ['50144', 'Adjudant-chef', 'VENTURI', 'Jean', 'MENTON', "Chef d'agrès FPT"],
  ['50166', 'Sergent-chef', 'PALMERI', 'Lise', 'MENTON', 'Équipier incendie'],
  ['50188', 'Caporal', 'NERI', 'Matteo', 'MENTON', 'Équipier'],
  ['50210', 'Sapeur 1re classe', 'GIORDANO', 'Emma', 'MENTON', 'Équipier'],

  ['60100', 'Lieutenant', 'MARCHAND', 'Bruno', 'CAGNES', 'Chef de centre'],
  ['60122', 'Adjudant-chef', 'CLERC', 'Sandra', 'CAGNES', "Chef d'agrès FPT"],
  ['60144', 'Sergent-chef', 'PONS', 'Adrien', 'CAGNES', 'Équipier incendie'],
  ['60166', 'Caporal-chef', 'VIDAL', 'Lola', 'CAGNES', 'Équipier SAP'],
  ['60188', 'Sapeur 2e classe', 'BRUNET', 'Théo', 'CAGNES', 'Équipier'],

  ['70100', 'Capitaine', 'DA SILVA', 'Carlos', 'STLAURENT', 'Chef de centre'],
  ['70122', 'Adjudant', 'FERRARI', 'Lucie', 'STLAURENT', "Chef d'agrès VSAV"],
  ['70144', 'Sergent-chef', 'MAILLOT', 'Ryan', 'STLAURENT', 'Équipier incendie'],
  ['70166', 'Caporal', 'AMATO', 'Julia', 'STLAURENT', 'Équipier SAP'],
  ['70188', 'Sapeur 1re classe', 'BONNEFOY', 'Louis', 'STLAURENT', 'Équipier'],

  ['80100', 'Lieutenant', 'GILLET', 'Anne', 'VENCE', 'Chef de centre'],
  ['80122', 'Adjudant-chef', 'SERRANO', 'Marc', 'VENCE', "Chef d'agrès"],
  ['80144', 'Sergent', 'BLANCHARD', 'Eva', 'VENCE', 'Équipier incendie'],
  ['80166', 'Caporal', 'ROUX', 'Ilan', 'VENCE', 'Équipier SAP'],
  ['80188', 'Sapeur 2e classe', 'DI MEGLIO', 'Carla', 'VENCE', 'Équipier'],
];

const APTITUDE_POOL = {
  'Sapeur 2e classe': ['SAP1', 'INC1'],
  'Sapeur 1re classe': ['SAP1', 'INC1', 'FDF1'],
  Caporal: ['SAP1', 'INC1', 'FDF1', 'SR1'],
  'Caporal-chef': ['SAP1', 'SAP2', 'INC1', 'FDF1', 'SR1'],
  Sergent: ['SAP1', 'SAP2', 'INC1', 'INC2', 'SR1', 'RCH1'],
  'Sergent-chef': ['SAP1', 'SAP2', 'INC1', 'INC2', 'FDF1', 'SR2', 'RCH1'],
  Adjudant: ['SAP2', 'INC2', 'SR2', 'RCH1', 'ADR', 'SSE'],
  'Adjudant-chef': ['SAP2', 'INC2', 'FDF2', 'SR2', 'RCH2', 'ADR', 'SSE', 'MNG'],
  Major: ['SAP2', 'INC2', 'INC3', 'RCH2', 'MNG', 'SSE'],
  Lieutenant: ['SAP2', 'INC2', 'INC3', 'FDF2', 'COD1', 'MNG', 'RAD'],
  Capitaine: ['INC3', 'FDF3', 'COD1', 'COD2', 'MNG', 'RAD'],
  Commandant: ['INC3', 'FDF3', 'COD2', 'MNG'],
  'Lieutenant-colonel': ['INC3', 'FDF3', 'COD2', 'MNG'],
  Colonel: ['COD2', 'MNG'],
};

const SPECIALITES = {
  10401: ['GRIMP', 'RCH'],
  10456: ['GRIMP', 'SAL1'],
  10288: ['COD1', 'RCH'],
  20145: ['ADR'],
  30144: ['GRIMP', 'PLG'],
  40144: ['FDF2', 'CYNO'],
  50144: ['SAL2'],
  60122: ['RCH', 'ADR'],
  70122: ['SAP2', 'SAL1'],
  80122: ['GRIMP', 'FDF2'],
  10502: ['RCH', 'CYNO'],
  10632: ['ADR'],
  30122: ['SAL2', 'RAD'],
};

const STATUTS = ['Disponible', 'Disponible', 'Disponible', 'Disponible', 'Repos', 'Congé', 'Formation'];

export const STREETS = {
  Nice: [
    '12 avenue Jean Médecin', '45 promenade des Anglais', '8 boulevard Gambetta',
    '23 rue de France', '104 boulevard de Cessole', '5 place Masséna',
    '17 rue Pastorelli', '62 avenue de la Californie', '31 boulevard Gorbella',
    '9 rue Barla', '78 route de Turin', '3 quai des États-Unis',
    '55 boulevard de Riquier', '14 avenue des Arènes de Cimiez',
  ],
  Antibes: [
    '24 avenue Robert Soleau', '16 boulevard d’Aguillon', '9 chemin des Sables',
    '44 route de Grasse', '2 place du Général de Gaulle', '31 avenue de Nice',
  ],
  Cannes: [
    '18 rue d’Antibes', '7 boulevard de la Croisette', '33 avenue de Grasse',
    '12 rue Meynadier', '6 boulevard Carnot', '25 avenue du Docteur Picaud',
  ],
  Grasse: [
    '5 boulevard du Jeu de Ballon', '21 avenue Thiers', '14 chemin de Saint-Marc',
    '8 place aux Aires', '40 route de Cannes',
  ],
  Menton: [
    '3 avenue de Verdun', '28 rue Saint-Michel', '9 promenade du Soleil',
    '17 avenue Carnot', '5 quai Bonaparte',
  ],
  'Cagnes-sur-Mer': [
    '11 avenue de la Gare', '6 boulevard Maréchal Juin', '22 avenue de Nice',
    '4 chemin du Val Fleuri',
  ],
  'Saint-Laurent-du-Var': [
    '7 avenue de Verdun', '20 route du Bord de Mer', '9 avenue des Alpes',
    '14 boulevard de l’Eau Blanche',
  ],
  Vence: [
    '4 place du Grand Jardin', '13 avenue Henri Isnard', '8 chemin des Cayrons',
    '27 avenue de la Résistance',
  ],
  Valbonne: ['12 route de Cannes', '6 place des Arcades'],
  Carros: ['3 avenue du Général de Gaulle', '18 chemin de la Mairie'],
  'La Trinité': ['21 avenue de la République', '7 chemin du Vieux Village'],
  Èze: ['5 avenue de la Mer', '2 rue du Barri'],
  'Saint-Jean-Cap-Ferrat': ['9 avenue Denis Semeria', '11 chemin du Roy'],
  Beaulieu: ['4 boulevard Maréchal Leclerc'],
  Villefranche: ['6 quai de l’Amiral Courbet'],
  Sospel: ['2 avenue Jean Médecin'],
  Contes: ['15 route de Nice'],
  'Saint-Martin-Vésubie': ['8 place du Marché'],
};

/* ------------------------------------------------------------------ */
/*  Engins                                                             */
/* ------------------------------------------------------------------ */

const ENGIN_TYPES = {
  FPT: { libelle: 'Fourgon Pompe Tonne', equipage: 6 },
  VSAV: { libelle: "Véhicule de Secours et d'Assistance aux Victimes", equipage: 3 },
  VSR: { libelle: 'Véhicule de Secours Routier', equipage: 3 },
  EPA: { libelle: 'Échelle Pivotante Automatique', equipage: 3 },
  CCF: { libelle: 'Camion-Citerne Feux de forêt', equipage: 4 },
  CCRM: { libelle: 'Camion-Citerne Rural Moyen', equipage: 3 },
  VPC: { libelle: 'Véhicule Poste de Commandement', equipage: 3 },
  VLI: { libelle: 'Véhicule de Liaison', equipage: 2 },
};

const ENGINS_TABLE = [
  ['FPT NICE 1', 'FPT', 'NICE'],
  ['FPT NICE 2', 'FPT', 'NICE'],
  ['EPA NICE', 'EPA', 'NICE'],
  ['VSAV NICE 1', 'VSAV', 'NICE'],
  ['VSAV NICE 2', 'VSAV', 'NICE'],
  ['VSR NICE', 'VSR', 'NICE'],
  ['CCRM NICE', 'CCRM', 'NICE'],
  ['FPT ANTIBES 1', 'FPT', 'ANTIBES'],
  ['CCF ANTIBES 1', 'CCF', 'ANTIBES'],
  ['VSAV ANTIBES 1', 'VSAV', 'ANTIBES'],
  ['VSR ANTIBES', 'VSR', 'ANTIBES'],
  ['FPT CANNES 1', 'FPT', 'CANNES'],
  ['EPA CANNES', 'EPA', 'CANNES'],
  ['VSAV CANNES 1', 'VSAV', 'CANNES'],
  ['VSAV CANNES 2', 'VSAV', 'CANNES'],
  ['FPT GRASSE 1', 'FPT', 'GRASSE'],
  ['CCF GRASSE 1', 'CCF', 'GRASSE'],
  ['VSAV GRASSE 1', 'VSAV', 'GRASSE'],
  ['VSR GRASSE', 'VSR', 'GRASSE'],
  ['FPT MENTON 1', 'FPT', 'MENTON'],
  ['CCF MENTON 1', 'CCF', 'MENTON'],
  ['VSAV MENTON 1', 'VSAV', 'MENTON'],
  ['FPT CAGNES 1', 'FPT', 'CAGNES'],
  ['VSAV CAGNES 1', 'VSAV', 'CAGNES'],
  ['FPT ST LAURENT 1', 'FPT', 'STLAURENT'],
  ['VSR ST LAURENT', 'VSR', 'STLAURENT'],
  ['VSAV ST LAURENT 1', 'VSAV', 'STLAURENT'],
  ['FPT VENCE 1', 'FPT', 'VENCE'],
  ['CCF VENCE 1', 'CCF', 'VENCE'],
  ['VSAV VENCE 1', 'VSAV', 'VENCE'],
  ['VPC CODIS', 'VPC', 'CODIS'],
  ['VLI CODIS', 'VLI', 'CODIS'],
];

/* ------------------------------------------------------------------ */
/*  Natures d'intervention                                             */
/* ------------------------------------------------------------------ */

export const NATURES = [
  { famille: 'INC', nature: "Feu d'appartement", priorite: 'P1', moyens: ['FPT', 'EPA', 'VSAV'] },
  { famille: 'INC', nature: 'Feu de toiture', priorite: 'P1', moyens: ['FPT', 'EPA', 'VSAV'] },
  { famille: 'INC', nature: 'Feu de véhicule', priorite: 'P2', moyens: ['FPT', 'VSAV'] },
  { famille: 'INC', nature: 'Feu de cheminée', priorite: 'P3', moyens: ['FPT'] },
  { famille: 'INC', nature: 'Feu industriel', priorite: 'P1', moyens: ['FPT', 'FPT', 'EPA', 'VSAV'] },
  { famille: 'INC', nature: 'Feu de local commercial', priorite: 'P1', moyens: ['FPT', 'EPA', 'VSAV'] },
  { famille: 'FDF', nature: 'Feu de végétation', priorite: 'P2', moyens: ['CCF', 'CCF', 'FPT'] },
  { famille: 'SR', nature: 'Accident de la circulation', priorite: 'P1', moyens: ['VSR', 'VSAV', 'FPT'] },
  { famille: 'SR', nature: 'Accident avec incarcération', priorite: 'P1', moyens: ['VSR', 'VSAV', 'FPT'] },
  { famille: 'SR', nature: 'Dégagement de personne', priorite: 'P2', moyens: ['VSR', 'VSAV'] },
  { famille: 'SAP', nature: 'Malaise cardiaque', priorite: 'P1', moyens: ['VSAV'] },
  { famille: 'SAP', nature: 'Détresse respiratoire', priorite: 'P1', moyens: ['VSAV'] },
  { famille: 'SAP', nature: 'Chute de personne', priorite: 'P2', moyens: ['VSAV'] },
  { famille: 'SAP', nature: 'Intoxication au monoxyde de carbone', priorite: 'P2', moyens: ['VSAV', 'FPT'] },
  { famille: 'DIV', nature: 'Fuite de gaz', priorite: 'P1', moyens: ['FPT', 'VSAV'] },
  { famille: 'DIV', nature: 'Inondation de cave', priorite: 'P3', moyens: ['FPT'] },
  { famille: 'DIV', nature: 'Ascenseur bloqué', priorite: 'P3', moyens: ['VSAV', 'FPT'] },
  { famille: 'RCH', nature: 'Recherche de personne', priorite: 'P2', moyens: ['VSR', 'VSAV'] },
  { famille: 'RCH', nature: 'Personne isolée en milieu périlleux', priorite: 'P1', moyens: ['VSR', 'VSAV'] },
  { famille: 'DIV', nature: 'Fuite de matières dangereuses', priorite: 'P1', moyens: ['FPT', 'VSR'] },
];

const BILANS = {
  INC: [
    'Foyer circonscrit au 2e étage, extinction à la lance. Reconnaissance complète effectuée, pas de propagation. Logement ventilé, bilan humain négatif.',
    'Sinistre maîtrisé après déblai partiel. 1 victime incommodée par les fumées prise en charge par le VSAV.',
    'Feu éteint, dégâts limités au local. Dispositif de surveillance en place, relève assurée par le centre de secours local.',
  ],
  FDF: [
    'Surface parcourue d’environ 0,4 hectare, attaque par les flancs. Feu fixé, noyage et surveillance en cours.',
    'Départ de feu maîtrisé à proximité des habitations. Aucune victime, aucun dégât matériel hors végétation.',
  ],
  SR: [
    'Deux véhicules impliqués, aucune personne incarcérée. Bilan réalisé par le VSAV, une victime légère évacuée vers le CHU Pasteur.',
    'Choc frontal, désincarcération d’un conducteur réalisée à la cisaille. Victime médicalisée et transportée.',
    'Accident matériel, fluides au sol neutralisés. Circulation rétablie après dégagement des véhicules.',
  ],
  SAP: [
    'Victime consciente prise en charge par l’équipe du VSAV, orientation vers le centre hospitalier du secteur.',
    'Bilan réalisé sur place, transport médicalisé. Aucun moyen supplémentaire engagé.',
    'Personne laissée sur place après avis médical. Fiche bilan transmise au CTA.',
  ],
  DIV: [
    'Fuite localisée et neutralisée après coupure du réseau. Périmètre de sécurité levé, aucune victime.',
    'Reconnaissance effectuée, locaux ventilés. Intervention terminée, aucun moyen maintenu sur place.',
    'Situation stabilisée, reconnaissance des niveaux réalisée. Bilan humain négatif.',
  ],
  RCH: [
    'Personne retrouvée saine et sauve, remise à la famille. Dispositif de recherche levé.',
    'Recherche terminée après reconnaissance complète des secteurs. Aucune personne découverte, main courante établie.',
  ],
};

/* ------------------------------------------------------------------ */
/*  Consignes opérationnelles                                          */
/* ------------------------------------------------------------------ */

const CONSIGNES = [
  {
    reference: 'CO-06-2026-001',
    titre: "Consignes générales de sécurité en intervention",
    categorie: 'Sécurité',
    diffusion: 'Tout le personnel',
    contenu: "1. Port des EPI complet obligatoire dès la montée dans l'engin.\n2. ARI : contrôle d'étanchéité avant chaque engagement en atmosphère confinée.\n3. Engagement en binôme obligatoire en zone de feu.\n4. Point de rassemblement et contrôle des effectifs à l'arrivée sur les lieux.\n5. Compte rendu immédiat au CODIS de toute situation dangereuse ou de tout accident.",
  },
  {
    reference: 'CO-06-2026-014',
    titre: 'Procédure ANTARES — message de renfort',
    categorie: 'Transmissions',
    diffusion: 'Officiers, chefs d’agrès',
    contenu: "Tout message de renfort doit comporter : numéro SIN, nature, adresse, moyens déjà engagés, moyens demandés, situation tactique et point de rendez-vous.\nLe message est transmis au CODIS 06 qui assure la diffusion vers le centre de secours concerné.\nDélai de réponse attendu : 2 minutes maximum.",
  },
  {
    reference: 'CO-06-2026-018',
    titre: 'Emploi des engins élévateurs (EPA / BEA)',
    categorie: 'Opérations',
    diffusion: 'Chefs d’agrès, conducteurs',
    contenu: "La mise en station est réalisée hors périmètre de chute des éléments de construction.\nLe calage est obligatoire avant tout développement.\nLa surveillance du sol et des lignes électriques est assurée par un équipier dédié.\nAucune montée de personnel sans autorisation du chef d'agrès.",
  },
  {
    reference: 'CO-06-2026-022',
    titre: 'Campagne feux de forêt — dispositions estivales',
    categorie: 'Saisonnière',
    diffusion: 'Tout le personnel',
    contenu: "Du 15 juin au 30 septembre : niveau de risque communiqué chaque matin à 08h00.\nPré-positionnement des CCF dans les massifs classés à risque très sévère.\nInterdiction d'emploi des engins en zone non reconnue sans appui d'un chef de groupe.\nRavitailement en eau : points d'eau validés et référencés dans la base ANTARES.",
  },
  {
    reference: 'CO-06-2026-031',
    titre: 'Rédaction du Compte Rendu de Sortie de Secours (CRSS)',
    categorie: 'Administratif',
    diffusion: 'Chefs d’agrès, officiers',
    contenu: "Le CRSS est renseigné avant la remise en disponibilité de l'engin.\nIl mentionne obligatoirement : horaires réels, moyens engagés, bilan, actions réalisées et suites données.\nToute anomalie matérielle fait l'objet d'une fiche de signalement distincte.\nLe CRSS est visé par le chef de garde puis transmis au CODIS.",
  },
  {
    reference: 'CO-06-2026-035',
    titre: 'Hygiène et sécurité en caserne',
    categorie: 'Sécurité',
    diffusion: 'Tout le personnel',
    contenu: "Nettoyage des EPI après chaque intervention à risque de contamination.\nSéparation des circuits propre/sale dans la remise.\nDéclaration immédiate de tout accident de service ou accident d'exposition au sang.\nContrôle mensuel des équipements de protection individuelle.",
  },
  {
    reference: 'CO-06-2026-042',
    titre: 'Recherche et sauvetage de personne (RCH)',
    categorie: 'Opérations',
    diffusion: 'Chefs d’agrès, équipes RCH',
    contenu: "Reconnaissance systématique des points de passage obligés et des secteurs déjà parcourus.\nMise en place d'un point de commandement pour tout dispositif supérieur à 3 engins.\nCompte rendu toutes les 30 minutes au CODIS.\nClôture uniquement sur décision du chef de dispositif.",
  },
  {
    reference: 'CO-06-2026-047',
    titre: 'Gestion des comptes et des accès au SNGP',
    categorie: 'Système',
    diffusion: 'Administrateurs',
    contenu: "Tout compte est nominatif et rattaché à un matricule.\nLe mot de passe est personnel et ne doit jamais être partagé.\nLes droits d'administration sont accordés par décision du chef de groupement des opérations.\nToute création, modification ou suppression de compte est tracée dans le journal d'audit.",
  },
];

/* ------------------------------------------------------------------ */
/*  Construction de la base                                            */
/* ------------------------------------------------------------------ */

export function buildInitialDb({ hashPassword, verifyPassword }) {
  const now = new Date();
  const db = {
    meta: {
      version: '3.4.1',
      edition: 'SDIS 06',
      numero_serie: '06-SNGP-1998-0001',
      installation: isoTime(now),
      derniere_sauvegarde: isoTime(new Date(now.getTime() - 3600e3 * 6)),
      compteur_sin: 1147,
    },
    settings: {
      organisation: 'SDIS 06 — CODIS Nice',
      nom_systeme: 'SNGP 06',
      duree_session_minutes: 60,
      tentatives_max: 5,
      verrouillage_minutes: 5,
      politique: {
        longueur_min: 8,
        majuscule: true,
        minuscule: true,
        chiffre: true,
        special: false,
      },
      simulation: true,
      cadence_alerte_secondes: 120,
    },
    users: [],
    personnels: [],
    engins: [],
    interventions: [],
    consignes: [],
    audit: [],
    sessions: [],
  };

  /* --- Personnel ---------------------------------------------------- */
  const cisCounters = {};
  const personnelIndexInCis = (cis) => {
    cisCounters[cis] = (cisCounters[cis] || 0) + 1;
    return cisCounters[cis] - 1;
  };
  const aptRef = new Map(APTITUDES_REF.map((a) => [a.code, a]));
  const personnels = PERSONNEL_TABLE.map(([matricule, grade, nom, prenom, cis, fonction], idx) => {
    const pool = [...(APTITUDE_POOL[grade] || []), ...(SPECIALITES[matricule] || [])];
    const codes = [...new Set(pool)];
    const aptitudes = codes.map((code, k) => {
      // Quelques échéances proches ou dépassées pour le suivi des recyclages.
      let validite;
      if (idx % 9 === 0 && k === 0) validite = new Date(now.getTime() + randint(4, 75) * 864e5);
      else if (idx % 31 === 0 && k === 0) validite = new Date(now.getTime() - randint(10, 90) * 864e5);
      else validite = new Date(now.getTime() + randint(120, 900) * 864e5);
      return {
        code,
        libelle: aptRef.get(code)?.libelle || code,
        obtention: iso(new Date(now.getTime() - randint(400, 5200) * 864e5)),
        validite: iso(validite),
      };
    });
    const garde = ['A', 'B', 'C', 'D'][idx % 4];
    const idxCis = personnelIndexInCis(cis, idx);
    const statut =
      cis === 'CODIS'
        ? 'Disponible'
        : idxCis % 5 === 3
          ? 'Repos'
          : idxCis % 9 === 5
            ? 'Congé'
            : idxCis % 13 === 7
              ? 'Formation'
              : 'Disponible';
    return {
      matricule,
      nom,
      prenom,
      grade,
      cis,
      fonction,
      aptitudes,
      garde,
      statut,
      disponible: statut === 'Disponible',
      telephone: `06 ${randint(10, 99)} ${randint(10, 99)} ${randint(10, 99)} ${randint(10, 99)}`,
      email: `${prenom.toLowerCase().replace(/[^a-z]/g, '')}.${nom.toLowerCase().replace(/[^a-z]/g, '')}@sdis06.fr`,
      date_entree: iso(new Date(now.getTime() - randint(200, 9000) * 864e5)),
      admin: false,
    };
  });

  const personnelByMatricule = new Map(personnels.map((p) => [p.matricule, p]));
  db.personnels = personnels;

  /* --- Engins ------------------------------------------------------- */
  db.engins = ENGINS_TABLE.map(([indicatif, type, cis]) => {
    const t = ENGIN_TYPES[type];
    const immat = `${String.fromCharCode(65 + randint(0, 25))}${String.fromCharCode(65 + randint(0, 25))}-${randint(100, 999)}-${String.fromCharCode(65 + randint(0, 25))}${String.fromCharCode(65 + randint(0, 25))}`;
    return {
      indicatif,
      type,
      type_libelle: t.libelle,
      cis,
      immat,
      effectif: t.equipage,
      equipage: [],
      statut: 'Disponible',
      intervention_id: null,
      km: randint(18000, 210000),
      mise_en_service: String(randint(2009, 2024)),
      radio: `06-${randint(1000, 9999)}`,
    };
  });

  /* --- Comptes ------------------------------------------------------ */
  const accounts = [
    ['10001', 'admin', 'Admin@06', true],
    ['10245', 'officier', 'Codis@2026', false],
    ['10302', 'officier', 'Officier@06', false],
    ['10401', 'operateur', 'Operateur@06', false],
    ['20100', 'operateur', 'Antibes@2026', false],
    ['30122', 'operateur', 'Cannes@2026', false],
  ];
  for (const [matricule, role, password, systeme] of accounts) {
    const p = personnelByMatricule.get(matricule);
    if (!p) continue;
    const { salt, hash } = hashPassword(password);
    db.users.push({
      id: crypto.randomUUID(),
      matricule,
      role,
      salt,
      hash,
      actif: true,
      systeme: !!systeme,
      cree_le: isoTime(new Date(now.getTime() - randint(30, 400) * 864e5)),
      cree_par: systeme ? 'INSTALLATION' : '10001',
      dernier_acces: isoTime(new Date(now.getTime() - randint(1, 72) * 36e5)),
      dernier_ip: `10.6.${randint(1, 20)}.${randint(2, 240)}`,
      mdp_change_le: isoTime(new Date(now.getTime() - randint(10, 200) * 864e5)),
      mdp_a_changer: false,
      tentatives: 0,
      verrouille_jusqu: null,
    });
  }

  /* --- Consignes ---------------------------------------------------- */
  db.consignes = CONSIGNES.map((c, i) => ({
    id: `consigne-${i + 1}`,
    ...c,
    date: iso(new Date(now.getTime() - randint(5, 320) * 864e5)),
    auteur: pick(['10245', '10302', '10112']),
    diffusion_count: randint(40, 420),
  }));

  /* --- Interventions terminées (historique) ------------------------- */
  const enginsByCis = new Map();
  for (const e of db.engins) {
    if (!enginsByCis.has(e.cis)) enginsByCis.set(e.cis, []);
    enginsByCis.get(e.cis).push(e);
  }

  let sin = 1010;
  const history = [];
  for (let day = 34; day >= 0; day--) {
    const perDay = randint(0, 3);
    for (let k = 0; k < perDay; k++) {
      const nature = pick(NATURES);
      const cis = pick(CIS);
      const addr = pick(STREETS[cis.commune] || STREETS.Nice);
      const start = new Date(now.getTime() - day * 864e5 - randint(0, 20) * 36e5 - randint(0, 59) * 60e3);
      const dur = randint(22, 165) * 60e3;
      const engins = pickEnginsFor(db.engins, cis, nature.moyens);
      sin++;
      const numero = `2026-06-${sin}`;
      const victimes = /SAP|SR|INC/.test(nature.famille) ? randint(0, 2) : 0;
      history.push({
        id: crypto.randomUUID(),
        numero,
        famille: nature.famille,
        nature: nature.nature,
        adresse: addr,
        commune: cis.commune,
        lat: +(cis.lat + (rnd() - 0.5) * 0.018).toFixed(5),
        lng: +(cis.lng + (rnd() - 0.5) * 0.022).toFixed(5),
        priorite: nature.priorite,
        statut: 'Clôturée',
        source: pick(['Appel 18', 'Appel 112', 'ANTARES', 'Appel 18', 'Détection automatique']),
        cree_le: isoTime(start),
        alerte_le: isoTime(start),
        depart_le: isoTime(new Date(start.getTime() + randint(1, 3) * 60e3)),
        arrivee_le: isoTime(new Date(start.getTime() + randint(6, 15) * 60e3)),
        cloture_le: isoTime(new Date(start.getTime() + dur)),
        engins: engins.map((e, i) => ({ indicatif: e.indicatif, type: e.type, cis: e.cis, role: i === 0 ? 'Chef de dispositif' : 'Moyen' })),
        chef_agres: chefFor(db.personnels, engins[0]?.cis || cis.code),
        victimes,
        bilan: pick(BILANS[nature.famille] || BILANS.DIV),
        destinataire: 'CODIS 06',
        crss: {
          redige_par: chefFor(db.personnels, engins[0]?.cis || cis.code).matricule,
          redige_le: isoTime(new Date(start.getTime() + dur + 8 * 60e3)),
          visa: 'Chef de garde',
        },
        evenements: [
          { ts: isoTime(start), texte: `Alerte reçue — ${nature.nature} — ${addr}, ${cis.commune}` },
          { ts: isoTime(new Date(start.getTime() + 2 * 60e3)), texte: `Départ des moyens : ${engins.map((e) => e.indicatif).join(', ')}` },
          { ts: isoTime(new Date(start.getTime() + 11 * 60e3)), texte: 'Arrivée sur les lieux, reconnaissance en cours' },
          { ts: isoTime(new Date(start.getTime() + dur)), texte: 'Intervention terminée, moyens rentrés au centre' },
        ],
      });
    }
  }
  history.sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1));
  db.interventions = history;
  db.meta.compteur_sin = sin;

  /* --- Interventions en cours --------------------------------------- */
  const activeSeeds = [
    { nature: NATURES[0], cis: CIS[0], addr: '12 avenue Jean Médecin', etape: 3, ago: 22 * 60e3 },
    { nature: NATURES[7], cis: CIS[1], addr: '24 avenue Robert Soleau', etape: 2, ago: 9 * 60e3 },
    { nature: NATURES[14], cis: CIS[2], addr: '18 rue d’Antibes', etape: 2, ago: 15 * 60e3 },
  ];
  for (const s of activeSeeds) {
    const start = new Date(now.getTime() - s.ago);
    const engins = pickEnginsFor(db.engins, s.cis, s.nature.moyens);
    sin++;
    const iv = {
      id: crypto.randomUUID(),
      numero: `2026-06-${sin}`,
      famille: s.nature.famille,
      nature: s.nature.nature,
      adresse: s.addr,
      commune: s.cis.commune,
      lat: +(s.cis.lat + (rnd() - 0.5) * 0.012).toFixed(5),
      lng: +(s.cis.lng + (rnd() - 0.5) * 0.016).toFixed(5),
      priorite: s.nature.priorite,
      statut: 'En cours',
      etape: s.etape,
      source: pick(['Appel 18', 'Appel 112', 'ANTARES']),
      cree_le: isoTime(start),
      alerte_le: isoTime(start),
      depart_le: isoTime(new Date(start.getTime() + 90e3)),
      arrivee_le: isoTime(new Date(start.getTime() + 6 * 60e3)),
      cloture_le: null,
      engins: engins.map((e, i) => ({ indicatif: e.indicatif, type: e.type, cis: e.cis, role: i === 0 ? 'Chef de dispositif' : 'Moyen' })),
      chef_agres: chefFor(db.personnels, engins[0]?.cis || s.cis.code),
      victimes: null,
      bilan: null,
      destinataire: 'CODIS 06',
      crss: null,
      prochaine_etape: isoTime(new Date(now.getTime() + randint(25, 70) * 1000)),
      evenements: [
        { ts: isoTime(start), texte: `Alerte reçue — ${s.nature.nature} — ${s.addr}, ${s.cis.commune}` },
        { ts: isoTime(new Date(start.getTime() + 90e3)), texte: `Départ : ${engins.map((e) => e.indicatif).join(', ')}` },
        { ts: isoTime(new Date(start.getTime() + 6 * 60e3)), texte: 'Arrivée sur les lieux, reconnaissance en cours' },
      ],
    };
    db.interventions.unshift(iv);
  }
  db.meta.compteur_sin = sin;

  /* --- Journal d'audit initial -------------------------------------- */
  db.audit = [
    ['INSTALLATION', 'Installation du système', 'Base initialisée — version 3.4.1'],
    ['10001', 'Création de compte', 'Compte administrateur initial (matricule 10001)'],
    ['10001', 'Création de compte', '6 comptes nominatifs créés à l’installation'],
    ['10245', 'Connexion', 'Connexion réussie depuis 10.6.4.12'],
    ['10001', 'Modification des paramètres', 'Durée de session portée à 60 minutes'],
  ].map(([matricule, action, detail], i) => ({
    id: crypto.randomUUID(),
    ts: isoTime(new Date(now.getTime() - (db.audit.length + i) * 36e5)),
    matricule,
    action,
    detail,
    ip: '10.6.1.10',
    niveau: 'info',
  }));

  return db;
}

function chefFor(personnels, cisCode) {
  const list = personnels
    .filter((p) => p.cis === cisCode || cisCode === 'CODIS')
    .sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade));
  const p = list[0] || personnels[0];
  return { matricule: p.matricule, nom: p.nom, prenom: p.prenom, grade: p.grade };
}

function pickEnginsFor(engins, cis, besoins) {
  const out = [];
  for (const type of besoins) {
    let candidates = engins.filter((e) => e.type === type && e.cis === cis.code && !out.includes(e));
    if (!candidates.length) candidates = engins.filter((e) => e.type === type && !out.includes(e));
    if (candidates.length) out.push(candidates[Math.floor(rnd() * candidates.length)]);
  }
  return out;
}

export { APTITUDES_REF, ENGIN_TYPES };
