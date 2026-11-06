import { api } from '../api.js';
import { state, ROLE_LABEL, can } from '../state.js';
import { esc, icon, pageHead, badge, initials, fmtDate, fmtDateOnly, toast } from '../util.js';

export async function render(container) {
  const load = async () => {
    const data = await api(`/api/personnels/${encodeURIComponent(state.user.matricule)}`);
    const p = data.personnel;
    const u = state.user;
    const droits = {
      admin: ['Gestion des comptes et des droits', 'Journal d’audit et sessions', 'Paramètres de sécurité', 'Toutes les actions opérationnelles'],
      officier: ['Création et suivi des interventions', 'Disponibilité des engins et des personnels', 'CRSS et messages ANTARES'],
      operateur: ['Création et suivi des interventions', 'Disponibilité des engins', 'CRSS et messages ANTARES'],
    }[u.role] || [];

    container.innerHTML = `<div class="page">
      ${pageHead({
        title: 'Mon compte',
        subtitle: 'Informations nominatives, coordonnées et sécurité de l’accès',
        iconName: 'user',
        breadcrumb: ['Système', 'Mon compte'],
        actions: `<button class="btn btn-sm" data-act="change-password">${icon('key')} Changer de mot de passe</button>
          <button class="btn btn-sm" data-act="logout">${icon('logout')} Déconnexion</button>`,
      })}

      <div class="grid grid-1-2">
        <div class="card">
          <div class="card-head">${icon('user')}<h3>Identité</h3></div>
          <div class="card-body">
            <div class="row" style="gap:14px;margin-bottom:16px">
              <span class="avatar avatar-lg" style="background:linear-gradient(160deg,#2a6ea6,#17456d)">${esc(initials(p.prenom, p.nom))}</span>
              <div>
                <div style="font-size:15px;font-weight:700">${esc(p.grade)} ${esc(p.prenom)} ${esc(p.nom)}</div>
                <div class="small muted">${esc(p.fonction)}</div>
                <div class="row" style="gap:6px;margin-top:6px">
                  <span class="badge badge-mono">${esc(p.matricule)}</span>
                  <span class="badge badge-outline">${esc(p.cis)}</span>
                  <span class="role-pill ${esc(u.role)}">${esc(ROLE_LABEL[u.role] || u.role)}</span>
                </div>
              </div>
            </div>
            <dl class="kv">
              <dt>Centre d’affectation</dt><dd>${esc(p.cis)}</dd>
              <dt>Groupe de garde</dt><dd>Garde ${esc(p.garde)} (rotation)</dd>
              <dt>Entrée au SDIS</dt><dd>${esc(fmtDateOnly(p.date_entree))}</dd>
              <dt>Aptitudes</dt><dd>${p.aptitudes.length ? p.aptitudes.map((a) => `<span class="chip">${esc(a.code)}</span>`).join(' ') : '—'}</dd>
              <dt>Compte créé le</dt><dd>${esc(fmtDateOnly(u.cree_le))}</dd>
              <dt>Créé par</dt><dd>${esc(u.cree_par || '—')}</dd>
            </dl>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-head">${icon('bell')}<h3>Coordonnées</h3></div>
            <div class="card-body">
              <form id="form-profile">
                <div class="form-grid">
                  <label class="field"><span class="field-label">Téléphone</span>
                    <input class="input" name="telephone" value="${esc(p.telephone || '')}" placeholder="06 __ __ __ __" /></label>
                  <label class="field"><span class="field-label">Messagerie professionnelle</span>
                    <input class="input" name="email" type="email" value="${esc(p.email || '')}" /></label>
                </div>
                <div class="form-actions" style="margin-top:6px">
                  <button type="submit" class="btn btn-sm btn-primary">${icon('check')} Mettre à jour</button>
                </div>
              </form>
            </div>
          </div>

          <div class="card">
            <div class="card-head">${icon('lock')}<h3>Sécurité de l’accès</h3></div>
            <div class="card-body">
              <dl class="kv">
                <dt>Dernier accès</dt><dd>${esc(u.dernier_acces ? fmtDate(u.dernier_acces) : '—')}</dd>
                <dt>Dernière adresse IP</dt><dd class="mono">${esc(u.dernier_ip || '—')}</dd>
                <dt>Mot de passe modifié</dt><dd>${esc(fmtDate(u.mdp_change_le))}</dd>
                <dt>Durée de session</dt><dd>${state.settings.duree_session_minutes} minutes d’inactivité</dd>
                <dt>État</dt><dd>${u.actif ? '<span class="badge badge-disponible">Compte actif</span>' : '<span class="badge badge-indisponible">Compte désactivé</span>'}</dd>
              </dl>
              <div class="divider"></div>
              <div class="field-label" style="margin-bottom:7px">Droits associés au profil</div>
              <ul class="stack" style="gap:5px">
                ${droits.map((d) => `<li class="row small" style="gap:7px">${icon('check', 'ic-sm')} ${esc(d)}</li>`).join('')}
              </ul>
              ${u.mdp_a_changer ? `<div class="alert alert-warning" style="margin-top:12px">${icon('alert')}<span>Un changement de mot de passe est requis.</span></div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">${icon('flame')}<h3>Mes dernières interventions</h3>
          <div class="card-head-actions"><span class="badge badge-mono">${p.interventions.length}</span></div>
        </div>
        ${p.interventions.length
          ? `<div class="table-wrap"><table class="table table-compact">
              <thead><tr><th>N° SIN</th><th>Date</th><th>Nature</th><th>État</th><th class="cell-actions"></th></tr></thead>
              <tbody>${p.interventions
                .map(
                  (i) => `<tr class="clickable" data-go="#/intervention/${esc(i.id)}">
                    <td class="cell-num">${esc(i.numero)}</td>
                    <td>${esc(fmtDate(i.cree_le))}</td>
                    <td>${esc(i.nature)}</td>
                    <td>${badge(i.statut === 'Clôturée' ? 'Clôturée' : 'En cours')}</td>
                    <td class="cell-actions">${icon('chevron-right')}</td>
                  </tr>`,
                )
                .join('')}</tbody>
            </table></div>`
          : `<div class="empty">${icon('flame')}<strong>Aucune intervention</strong>Vous n’avez pas encore été engagé sur une opération.</div>`}
      </div>
    </div>`;

    container.querySelector('#form-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('/api/auth/profile', { method: 'POST', body: { telephone: fd.get('telephone'), email: fd.get('email') } });
        toast('Coordonnées mises à jour.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    container.querySelectorAll('[data-go]').forEach((row) => {
      row.addEventListener('click', () => (location.hash = row.dataset.go));
    });
  };

  state.refresh = () => load().catch(() => {});
  await load();
}
