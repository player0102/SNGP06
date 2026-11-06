import crypto from 'node:crypto';

/**
 * Politique de mot de passe — contrôlée côté serveur.
 */
export function passwordErrors(pw, politique = {}) {
  const p = {
    longueur_min: 8,
    majuscule: true,
    minuscule: true,
    chiffre: true,
    special: false,
    ...politique,
  };
  const errors = [];
  if (typeof pw !== 'string' || pw.length < p.longueur_min) {
    errors.push(`au moins ${p.longueur_min} caractères`);
  }
  if (p.majuscule && !/[A-Z]/.test(pw || '')) errors.push('une majuscule');
  if (p.minuscule && !/[a-z]/.test(pw || '')) errors.push('une minuscule');
  if (p.chiffre && !/[0-9]/.test(pw || '')) errors.push('un chiffre');
  if (p.special && !/[^A-Za-z0-9]/.test(pw || '')) errors.push('un caractère spécial');
  return errors;
}

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(pw, salt, hash) {
  const computed = crypto.scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function sanitizeUser(user, personnel) {
  if (!user) return null;
  return {
    matricule: user.matricule,
    role: user.role,
    actif: user.actif,
    systeme: user.systeme,
    nom: personnel?.nom || '',
    prenom: personnel?.prenom || '',
    grade: personnel?.grade || '',
    fonction: personnel?.fonction || '',
    cis: personnel?.cis || '',
    email: personnel?.email || '',
    telephone: personnel?.telephone || '',
    dernier_acces: user.dernier_acces,
    dernier_ip: user.dernier_ip,
    mdp_change_le: user.mdp_change_le,
    mdp_a_changer: user.mdp_a_changer,
    cree_le: user.cree_le,
    cree_par: user.cree_par,
  };
}

export const ROLE_LABELS = {
  admin: 'Administrateur',
  officier: 'Officier',
  operateur: 'Opérateur CTA',
};

export const ROLES = Object.keys(ROLE_LABELS);

/** Droits par rôle — appliqués côté serveur sur chaque route. */
export const PERMISSIONS = {
  admin: ['*'],
  officier: [
    'interventions.write',
    'engins.write',
    'personnels.write',
    'crss.write',
    'antares.write',
  ],
  operateur: ['interventions.write', 'engins.write', 'crss.write', 'antares.write'],
};

export function can(role, permission) {
  const perms = PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

export function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const r = (s) => s[crypto.randomInt(s.length)];
  return (
    r(upper) + r(lower) + r(digits) + r('@#!%*-_') +
    r(upper) + r(lower) + r(lower) + r(digits) + r(lower) + r(digits) + r(lower)
  );
}
