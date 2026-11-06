export const state = {
  user: null,
  meta: null,
  settings: null,
  refs: null,
  stats: null,
  coordination: null,
  viewId: null,
  refresh: null,
};

const PERMISSIONS = {
  admin: ['*'],
  officier: ['interventions.write', 'engins.write', 'personnels.write', 'crss.write', 'antares.write'],
  operateur: ['interventions.write', 'engins.write', 'crss.write', 'antares.write'],
};

export function can(permission) {
  const perms = PERMISSIONS[state.user?.role] || [];
  return perms.includes('*') || perms.includes(permission);
}

export const isAdmin = () => state.user?.role === 'admin';

export const ROLE_LABEL = {
  admin: 'Administrateur',
  officier: 'Officier',
  operateur: 'Opérateur CTA',
};

export function cisLabel(code) {
  return state.refs?.cis?.find((c) => c.code === code)?.nom || code;
}

export function refsStatuts() {
  return state.refs?.statuts_personnel || [];
}
