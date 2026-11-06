import { api } from '../api.js';
import { state, ROLE_LABEL } from '../state.js';
import {
  esc, icon, pageHead, badge, openModal, confirmDialog, toast, emptyState, debounce,
  fmtDate, initials, fmtDateOnly,
} from '../util.js';

export async function render(container) {
  if (state.user.role !== 'admin') {
    container.innerHTML = `<div class="page">
      ${pageHead({ title: 'Administration', iconName: 'settings', breadcrumb: ['Système', 'Administration'] })}
      <div class="card"><div class="card-body"><div class="alert alert-error">${icon('lock')}<span>Cette section est réservée aux administrateurs du système.</span></div></div></div>
    </div>`;
    return;
  }

  let tab = 'comptes';
  let usersData = null;
  let auditData = null;
  let sessionsData = null;
  let settingsData = null;

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Administration du système',
      subtitle: 'Comptes nominatifs, journal d’audit, sessions et paramètres de sécurité',
      iconName: 'settings',
      breadcrumb: ['Système', 'Administration'],
      actions: `<button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>`,
    })}
    <div class="card">
      <div class="tabs" id="admin-tabs">
        <button class="tab active" data-tab="comptes">${icon('users')} Comptes <span class="count" id="tab-count-users">—</span></button>
        <button class="tab" data-tab="audit">${icon('history')} Journal d’audit <span class="count" id="tab-count-audit">—</span></button>
        <button class="tab" data-tab="sessions">${icon('lock')} Sessions <span class="count" id="tab-count-sessions">—</span></button>
        <button class="tab" data-tab="parametres">${icon('settings')} Paramètres</button>
      </div>
      <div class="card-body" id="admin-panel"></div>
    </div>
  </div>`;

  const panel = container.querySelector('#admin-panel');

  const loadAll = async () => {
    const [users, audit, sessions, settings] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/audit?limit=250'),
      api('/api/admin/sessions'),
      api('/api/admin/settings'),
    ]);
    usersData = users;
    auditData = audit;
    sessionsData = sessions;
    settingsData = settings;
    container.querySelector('#tab-count-users').textContent = users.items.length;
    container.querySelector('#tab-count-audit').textContent = audit.total;
    container.querySelector('#tab-count-sessions').textContent = sessions.items.length;
    renderTab();
  };

  const renderTab = () => {
    container.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'comptes') renderComptes(panel, usersData, reload);
    if (tab === 'audit') renderAudit(panel, auditData);
    if (tab === 'sessions') renderSessions(panel, sessionsData, reload);
    if (tab === 'parametres') renderParametres(panel, settingsData, reload);
  };

  async function reload() {
    try {
      await loadAll();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  container.querySelector('#admin-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    tab = btn.dataset.tab;
    renderTab();
  });

  state.refresh = () => reload();
  await loadAll();
}

/* ------------------------------------------------------------------ */
/*  Comptes                                                            */
/* ------------------------------------------------------------------ */

function renderComptes(panel, data, reload) {
  panel.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div>
        <div class="section-title" style="margin:0"><h2>Comptes d’accès au système</h2></div>
        <p class="small muted">Un compte est nominatif et rattaché à un matricule. ${data.items.filter((u) => u.role === 'admin').length} administrateur(s).</p>
      </div>
      <button class="btn btn-sm btn-primary" id="btn-new-user">${icon('plus')} Créer un compte</button>
    </div>
    <div class="table-wrap table-scroll"><table class="table">
      <thead><tr><th>Identité</th><th>Matricule</th><th>Rôle</th><th>État</th><th>Dernier accès</th><th>Dernière IP</th><th>Mot de passe</th><th class="cell-actions">Actions</th></tr></thead>
      <tbody>
        ${data.items
          .map(
            (u) => `<tr>
              <td><div class="row" style="gap:8px"><span class="avatar-sm">${esc(initials(u.prenom, u.nom))}</span>
                <div><div class="cell-strong">${esc(u.grade)} ${esc(u.nom)} ${esc(u.prenom)}</div>
                <div class="cell-sub">${esc(u.fonction)}</div></div></div></td>
              <td class="cell-num">${esc(u.matricule)} ${u.systeme ? '<span class="badge badge-outline" style="margin-left:4px">initial</span>' : ''}</td>
              <td><span class="role-pill ${esc(u.role)}">${esc(ROLE_LABEL[u.role] || u.role)}</span></td>
              <td>${u.actif ? '<span class="badge badge-disponible">Actif</span>' : '<span class="badge badge-indisponible">Désactivé</span>'}</td>
              <td class="nowrap">${esc(u.dernier_acces ? fmtDate(u.dernier_acces) : 'Jamais')}</td>
              <td class="cell-num">${esc(u.dernier_ip || '—')}</td>
              <td>${u.mdp_a_changer ? '<span class="badge badge-conge">À changer</span>' : '<span class="cell-sub">À jour</span>'}<div class="cell-sub">${esc(fmtDateOnly(u.mdp_change_le))}</div></td>
              <td class="cell-actions">
                <button class="btn btn-xs" data-edit="${esc(u.matricule)}" title="Modifier">${icon('edit')}</button>
                <button class="btn btn-xs" data-reset="${esc(u.matricule)}" title="Réinitialiser le mot de passe">${icon('key')}</button>
                <button class="btn btn-xs btn-danger-ghost" data-del="${esc(u.matricule)}" title="Supprimer" ${u.systeme || u.matricule === state.user.matricule ? 'disabled' : ''}>${icon('trash')}</button>
              </td>
            </tr>`,
          )
          .join('')}
      </tbody></table></div>
    <div class="alert alert-info" style="margin-top:14px">${icon('shield-check')}<span>Le compte administrateur initial (matricule 10001) ne peut être ni supprimé, ni désactivé, ni privé de ses droits. Toute action est journalisée.</span></div>`;

  panel.querySelector('#btn-new-user').onclick = () => openCreateUser(data, reload);

  panel.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.onclick = () => openEditUser(data.items.find((u) => u.matricule === btn.dataset.edit), reload);
  });
  panel.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.onclick = () => resetPassword(data.items.find((u) => u.matricule === btn.dataset.reset), reload);
  });
  panel.querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      const user = data.items.find((u) => u.matricule === btn.dataset.del);
      const ok = await confirmDialog({
        title: 'Supprimer le compte',
        message: `Confirmez-vous la suppression définitive du compte <strong>${esc(user.matricule)} — ${esc(user.grade)} ${esc(user.nom)} ${esc(user.prenom)}</strong> ?<br><br>La session en cours sera immédiatement fermée. La fiche personnel est conservée.`,
        confirmLabel: 'Supprimer le compte',
      });
      if (!ok) return;
      try {
        await api(`/api/admin/users/${encodeURIComponent(user.matricule)}`, { method: 'DELETE' });
        toast('Compte supprimé.', 'success');
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });
}

function openCreateUser(data, reload) {
  const libres = data.libres;
  openModal({
    title: 'Création d’un compte d’accès',
    subtitle: 'Le compte est rattaché à un matricule et à une fiche personnel',
    iconName: 'users',
    size: 'modal-lg',
    body: `<form id="form-user">
      <div class="form-section">Personnel</div>
      <label class="field">
        <span class="field-label">Personnel sans compte</span>
        <select class="select" name="personnel" id="u-personnel">
          <option value="">— Créer une nouvelle fiche personnel —</option>
          ${libres.map((p) => `<option value="${esc(p.matricule)}">${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)} — ${esc(p.cis)} (${esc(p.matricule)})</option>`).join('')}
        </select>
      </label>

      <div id="u-existing" hidden>
        <div class="form-grid">
          <label class="field"><span class="field-label">Matricule</span>
            <input class="input" name="matricule_existant" id="u-mat-existant" readonly /></label>
        </div>
      </div>

      <div id="u-nouveau">
        <div class="form-grid">
          <label class="field"><span class="field-label">Matricule <span class="req">*</span></span>
            <input class="input" name="matricule" id="u-mat" placeholder="5 chiffres" maxlength="6" /></label>
          <label class="field"><span class="field-label">Grade</span>
            <select class="select" name="grade">${state.refs.grades.map((g) => `<option ${g === 'Sapeur 1re classe' ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
          <label class="field"><span class="field-label">Nom</span>
            <input class="input" name="nom" placeholder="NOM" /></label>
          <label class="field"><span class="field-label">Prénom</span>
            <input class="input" name="prenom" placeholder="Prénom" /></label>
          <label class="field"><span class="field-label">Centre de secours</span>
            <select class="select" name="cis">${state.refs.cis.map((c) => `<option value="${esc(c.code)}">${esc(c.nom)}</option>`).join('')}<option value="CODIS">CODIS / état-major</option></select></label>
          <label class="field"><span class="field-label">Fonction</span>
            <input class="input" name="fonction" placeholder="Ex. Chef d’agrès FPT" /></label>
        </div>
      </div>

      <div class="form-section" style="margin-top:6px">Droits et authentification</div>
      <div class="form-grid">
        <label class="field"><span class="field-label">Rôle <span class="req">*</span></span>
          <select class="select" name="role" required>
            ${state.refs.roles.map((r) => `<option value="${esc(r.code)}" ${r.code === 'operateur' ? 'selected' : ''}>${esc(r.libelle)}</option>`).join('')}
          </select>
          <span class="field-hint">Les administrateurs peuvent gérer les comptes et les paramètres.</span>
        </label>
        <label class="field"><span class="field-label">Mot de passe initial</span>
          <input class="input" name="mot_de_passe" placeholder="Laisser vide pour générer" autocomplete="new-password" />
          <span class="field-hint">Politique : ${esc(policyText())}</span>
        </label>
      </div>
      <div class="policy-toggle">
        <span>Imposer le changement de mot de passe à la première connexion</span>
        <label class="switch"><input type="checkbox" name="doit_changer" checked /><i></i></label>
      </div>

      <div class="form-actions">
        <button type="button" class="btn" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary">${icon('check')} Créer le compte</button>
      </div>
    </form>`,
    onMount(modal, close) {
      const form = modal.querySelector('#form-user');
      const select = modal.querySelector('#u-personnel');
      const blocNouveau = modal.querySelector('#u-nouveau');
      const blocExistant = modal.querySelector('#u-existing');

      select.addEventListener('change', () => {
        const val = select.value;
        blocNouveau.hidden = !!val;
        blocExistant.hidden = !val;
        modal.querySelector('#u-mat-existant').value = val;
        for (const input of blocNouveau.querySelectorAll('input, select')) {
          input.disabled = !!val;
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const existing = select.value;
        const body = {
          role: fd.get('role'),
          doit_changer: fd.get('doit_changer') === 'on',
        };
        if (existing) {
          body.matricule = existing;
        } else {
          body.matricule = String(fd.get('matricule') || '').trim();
          body.nom = fd.get('nom');
          body.prenom = fd.get('prenom');
          body.grade = fd.get('grade');
          body.cis = fd.get('cis');
          body.fonction = fd.get('fonction');
        }
        const pwd = String(fd.get('mot_de_passe') || '').trim();
        if (pwd) body.mot_de_passe = pwd;

        try {
          const res = await api('/api/admin/users', { method: 'POST', body });
          close();
          if (res.mot_de_passe) showGeneratedPassword(body.matricule, res.mot_de_passe);
          else toast('Compte créé.', 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

function openEditUser(user, reload) {
  openModal({
    title: 'Modifier le compte',
    subtitle: `${esc(user.grade)} ${esc(user.nom)} ${esc(user.prenom)} — matricule ${esc(user.matricule)}`,
    iconName: 'edit',
    body: `<form id="form-edit-user">
      <div class="form-grid">
        <label class="field"><span class="field-label">Rôle</span>
          <select class="select" name="role" ${user.systeme ? 'disabled' : ''}>
            ${state.refs.roles.map((r) => `<option value="${esc(r.code)}" ${r.code === user.role ? 'selected' : ''}>${esc(r.libelle)}</option>`).join('')}
          </select>
          ${user.systeme ? '<span class="field-hint">Compte administrateur initial — rôle verrouillé.</span>' : ''}
        </label>
        <label class="field"><span class="field-label">État du compte</span>
          <select class="select" name="actif" ${user.systeme ? 'disabled' : ''}>
            <option value="1" ${user.actif ? 'selected' : ''}>Actif</option>
            <option value="0" ${!user.actif ? 'selected' : ''}>Désactivé</option>
          </select>
          ${user.systeme ? '<span class="field-hint">Ce compte ne peut pas être désactivé.</span>' : ''}
        </label>
      </div>
      <div class="policy-toggle">
        <span>Imposer un changement de mot de passe à la prochaine connexion</span>
        <label class="switch"><input type="checkbox" name="mdp_a_changer" ${user.mdp_a_changer ? 'checked' : ''} /><i></i></label>
      </div>
      <div class="alert alert-info" style="margin-top:12px">${icon('shield')}<span>Les sessions actives du compte sont conservées. Toute modification est tracée dans le journal d’audit.</span></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary">${icon('check')} Enregistrer</button>
      </div>
    </form>`,
    onMount(modal, close) {
      modal.querySelector('#form-edit-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = { mdp_a_changer: fd.get('mdp_a_changer') === 'on' };
        if (!user.systeme) {
          body.role = fd.get('role');
          body.actif = fd.get('actif') === '1';
        }
        try {
          await api(`/api/admin/users/${encodeURIComponent(user.matricule)}`, { method: 'PATCH', body });
          close();
          toast('Compte mis à jour.', 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

async function resetPassword(user, reload) {
  const ok = await confirmDialog({
    title: 'Réinitialiser le mot de passe',
    message: `Un nouveau mot de passe sera généré pour <strong>${esc(user.matricule)} — ${esc(user.nom)} ${esc(user.prenom)}</strong>.<br><br>Le changement sera imposé à la prochaine connexion et les sessions actives seront fermées.`,
    confirmLabel: 'Réinitialiser',
    tone: 'danger',
    iconName: 'key',
  });
  if (!ok) return;
  try {
    const res = await api(`/api/admin/users/${encodeURIComponent(user.matricule)}/reset-password`, { method: 'POST', body: {} });
    showGeneratedPassword(user.matricule, res.mot_de_passe);
    reload();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function showGeneratedPassword(matricule, password) {
  openModal({
    title: 'Mot de passe généré',
    subtitle: 'À communiquer à l’intéressé par un canal sécurisé',
    iconName: 'key',
    body: `<div class="alert alert-warning" style="margin-bottom:14px">${icon('alert')}<span>Ce mot de passe ne sera plus affiché. Notez-le avant de fermer cette fenêtre.</span></div>
      <dl class="kv">
        <dt>Matricule</dt><dd class="mono">${esc(matricule)}</dd>
        <dt>Mot de passe</dt><dd class="mono" style="font-size:15px;letter-spacing:0.04em">${esc(password)}</dd>
      </dl>
      <div class="form-actions">
        <button class="btn" data-copy-pwd>${icon('copy')} Copier</button>
        <button class="btn btn-primary" data-close>J’ai noté le mot de passe</button>
      </div>`,
    onMount(modal, close) {
      modal.querySelector('[data-copy-pwd]').onclick = () => {
        navigator.clipboard?.writeText(`Matricule ${matricule} — mot de passe : ${password}`);
        toast('Identifiants copiés.', 'success');
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Audit                                                             */
/* ------------------------------------------------------------------ */

function renderAudit(panel, data) {
  panel.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div class="section-title" style="margin:0"><h2>Journal d’audit</h2><span class="count">${data.total} entrée(s)</span></div>
      <div class="row" style="gap:7px">
        <div class="search-field" style="min-width:230px">${icon('search')}<input class="input" id="au-q" placeholder="Rechercher un acteur, une action…" /></div>
        <select class="select" id="au-niveau" style="width:auto"><option value="">Tous niveaux</option><option value="info">Information</option><option value="alerte">Alerte</option></select>
      </div>
    </div>
    <div id="au-list">${auditList(data.items)}</div>`;

  const list = panel.querySelector('#au-list');
  const search = debounce(async (e) => {
    const q = e.target.value.trim();
    const niveau = panel.querySelector('#au-niveau').value;
    const res = await api(`/api/admin/audit?q=${encodeURIComponent(q)}&niveau=${niveau}&limit=400`);
    list.innerHTML = auditList(res.items);
  }, 280);
  panel.querySelector('#au-q').addEventListener('input', search);
  panel.querySelector('#au-niveau').addEventListener('change', async (e) => {
    const q = panel.querySelector('#au-q').value.trim();
    const res = await api(`/api/admin/audit?q=${encodeURIComponent(q)}&niveau=${e.target.value}&limit=400`);
    list.innerHTML = auditList(res.items);
  });
}

function auditList(items) {
  if (!items.length) return emptyState('history', 'Aucune entrée', 'Aucun événement ne correspond à ces critères.');
  return `<div class="table-wrap table-scroll">${items
    .map(
      (a) => `<div class="audit-line">
        <span class="audit-ts">${esc(fmtDate(a.ts))}</span>
        <span class="audit-acteur">${esc(a.matricule)}</span>
        <span><span class="audit-action">${esc(a.action)}</span> <span class="audit-detail">— ${esc(a.detail)}</span></span>
        <span class="audit-level ${esc(a.niveau || 'info')}">${esc(a.niveau === 'alerte' ? 'Alerte' : 'Info')}</span>
      </div>`,
    )
    .join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/*  Sessions                                                          */
/* ------------------------------------------------------------------ */

function renderSessions(panel, data, reload) {
  panel.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div class="section-title" style="margin:0"><h2>Sessions actives</h2><span class="count">${data.items.length}</span></div>
      <span class="small muted">${icon('clock')} Fermeture automatique après inactivité (${state.settings.duree_session_minutes} min)</span>
    </div>
    ${data.items.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Utilisateur</th><th>Matricule</th><th>Rôle</th><th>Adresse IP</th><th>Ouverture</th><th>Dernière activité</th><th class="cell-actions">Action</th></tr></thead>
          <tbody>
            ${data.items
              .map(
                (s) => `<tr>
                  <td class="cell-strong">${esc(s.nom)} ${s.actuelle ? '<span class="badge badge-info" style="margin-left:6px">Session courante</span>' : ''}</td>
                  <td class="cell-num">${esc(s.matricule)}</td>
                  <td><span class="role-pill ${esc(s.role)}">${esc(ROLE_LABEL[s.role] || s.role)}</span></td>
                  <td class="cell-num">${esc(s.ip)}</td>
                  <td class="nowrap">${esc(fmtDate(s.debut))}</td>
                  <td class="nowrap">${esc(fmtDate(s.dernier_acces))}</td>
                  <td class="cell-actions"><button class="btn btn-xs btn-danger-ghost" data-revoke="${esc(s.token_partiel.replace('…', ''))}" ${s.actuelle ? 'disabled' : ''}>${icon('power')} Révoquer</button></td>
                </tr>`,
              )
              .join('')}
          </tbody></table></div>`
      : emptyState('lock', 'Aucune session active')}`;

  panel.querySelectorAll('[data-revoke]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await api(`/api/admin/sessions/${encodeURIComponent(btn.dataset.revoke)}`, { method: 'DELETE' });
        toast('Session révoquée.', 'success');
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Paramètres                                                        */
/* ------------------------------------------------------------------ */

function renderParametres(panel, data, reload) {
  const s = data.settings;
  panel.innerHTML = `
    <form id="form-settings">
      <div class="grid grid-2" style="gap:0 26px">
        <div>
          <div class="form-section">Identité du système</div>
          <label class="field"><span class="field-label">Nom du système</span>
            <input class="input" name="nom_systeme" value="${esc(s.nom_systeme)}" /></label>
          <label class="field"><span class="field-label">Organisation</span>
            <input class="input" name="organisation" value="${esc(s.organisation)}" /></label>

          <div class="form-section" style="margin-top:16px">Sécurité des accès</div>
          <label class="field"><span class="field-label">Durée de session (minutes)</span>
            <input class="input" type="number" name="duree_session_minutes" min="5" max="480" value="${Number(s.duree_session_minutes)}" />
            <span class="field-hint">Déconnexion automatique après inactivité.</span></label>
          <div class="form-grid">
            <label class="field"><span class="field-label">Tentatives avant verrouillage</span>
              <input class="input" type="number" name="tentatives_max" min="3" max="10" value="${Number(s.tentatives_max)}" /></label>
            <label class="field"><span class="field-label">Durée du verrouillage (min)</span>
              <input class="input" type="number" name="verrouillage_minutes" min="1" max="60" value="${Number(s.verrouillage_minutes)}" /></label>
          </div>

          <div class="form-section" style="margin-top:16px">Simulation opérationnelle</div>
          <div class="policy-toggle">
            <span>Générer des alertes automatiquement</span>
            <label class="switch"><input type="checkbox" name="simulation" ${s.simulation ? 'checked' : ''} /><i></i></label>
          </div>
          <label class="field" style="margin-top:10px"><span class="field-label">Cadence moyenne des alertes (secondes)</span>
            <input class="input" type="number" name="cadence_alerte_secondes" min="20" max="600" value="${Number(s.cadence_alerte_secondes)}" />
            <span class="field-hint">Utilisé pour la démonstration et les exercices.</span></label>
        </div>

        <div>
          <div class="form-section">Politique de mot de passe</div>
          <label class="field"><span class="field-label">Longueur minimale</span>
            <input class="input" type="number" name="longueur_min" min="6" max="24" value="${Number(s.politique.longueur_min)}" /></label>
          <div class="policy-toggle"><span>Exiger au moins une majuscule</span>
            <label class="switch"><input type="checkbox" name="majuscule" ${s.politique.majuscule ? 'checked' : ''} /><i></i></label></div>
          <div class="policy-toggle"><span>Exiger au moins une minuscule</span>
            <label class="switch"><input type="checkbox" name="minuscule" ${s.politique.minuscule ? 'checked' : ''} /><i></i></label></div>
          <div class="policy-toggle"><span>Exiger au moins un chiffre</span>
            <label class="switch"><input type="checkbox" name="chiffre" ${s.politique.chiffre ? 'checked' : ''} /><i></i></label></div>
          <div class="policy-toggle"><span>Exiger un caractère spécial</span>
            <label class="switch"><input type="checkbox" name="special" ${s.politique.special ? 'checked' : ''} /><i></i></label></div>

          <div class="form-section" style="margin-top:20px">Informations serveur</div>
          <dl class="kv">
            <dt>Version</dt><dd>${esc(data.meta.version)}</dd>
            <dt>Édition</dt><dd>${esc(data.meta.edition)}</dd>
            <dt>N° de série</dt><dd class="mono">${esc(data.meta.numero_serie)}</dd>
            <dt>Installation</dt><dd>${esc(data.meta.installation)}</dd>
            <dt>Dernière sauvegarde</dt><dd>${esc(data.meta.derniere_sauvegarde)}</dd>
         </dl>

          <div class="alert alert-warning" style="margin-top:16px">${icon('alert')}<span>Les modifications de sécurité s’appliquent immédiatement à l’ensemble des postes connectés.</span></div>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn" data-act="refresh">Annuler</button>
        <button type="submit" class="btn btn-primary">${icon('check')} Enregistrer les paramètres</button>
      </div>
    </form>`;

  panel.querySelector('#form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      nom_systeme: fd.get('nom_systeme'),
      organisation: fd.get('organisation'),
      duree_session_minutes: Number(fd.get('duree_session_minutes')),
      tentatives_max: Number(fd.get('tentatives_max')),
      verrouillage_minutes: Number(fd.get('verrouillage_minutes')),
      simulation: fd.get('simulation') === 'on',
      cadence_alerte_secondes: Number(fd.get('cadence_alerte_secondes')),
      politique: {
        longueur_min: Number(fd.get('longueur_min')),
        majuscule: fd.get('majuscule') === 'on',
        minuscule: fd.get('minuscule') === 'on',
        chiffre: fd.get('chiffre') === 'on',
        special: fd.get('special') === 'on',
      },
    };
    try {
      const res = await api('/api/admin/settings', { method: 'PATCH', body });
      state.settings = { ...state.settings, ...res.settings };
      toast('Paramètres enregistrés.', 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function policyText() {
  const p = state.settings?.politique || {};
  const parts = [`${p.longueur_min || 8} caractères`];
  if (p.majuscule) parts.push('majuscule');
  if (p.minuscule) parts.push('minuscule');
  if (p.chiffre) parts.push('chiffre');
  if (p.special) parts.push('spécial');
  return parts.join(', ');
}
