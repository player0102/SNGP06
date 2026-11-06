import { render as dashboard } from './dashboard.js';
import { render as interventions } from './interventions.js';
import { render as intervention } from './intervention.js';
import { render as engins } from './engins.js';
import { render as effectif } from './effectif.js';
import { render as historique } from './historique.js';
import { render as gardes } from './gardes.js';
import { render as consignes } from './consignes.js';
import { render as crss } from './crss.js';
import { render as aptitudes } from './aptitudes.js';
import { render as antares } from './antares.js';
import { render as mobile } from './mobile.js';
import { render as admin } from './admin.js';
import { render as compte } from './compte.js';

export const VIEWS = {
  'tableau-de-bord': dashboard,
  interventions,
  intervention,
  engins,
  effectif,
  historique,
  gardes,
  consignes,
  consigne: consignes,
  crss,
  aptitudes,
  antares,
  'neosis-mobile': mobile,
  administration: admin,
  admin,
  'mon-compte': compte,
  compte,
};
