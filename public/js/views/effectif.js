import { api } from '../api.js';
import { state, can, ROLE_LABEL } from '../state.js';
import {
  esc, icon, pageHead, badge, initials, openModal, toast, emptyState, debounce, fmtDate, fmtDateOnly,
} from '../util.js';

export async function render(container) {
  const filters = { q: '', cis: '', statut: '', aptitude: '' };

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Effectif et disponibilité',
      subtitle: 'Sapeurs-pompiers du SDIS 06 — situation individuelle et aptitudes',
      iconName: 'users',
      breadcrumb: ['Personnel', 'Effectif et disponibilité'],
      actions: `<a class="btn btn-sm" href="#/gardes">${icon('calendar')} Feuille de garde</a>
        <a class="btn btn-sm" href="#/aptitudes">${icon('award')} Aptitudes</a>
        <button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>`,
    })}
    <div class="grid grid-4" id="p-stats"></div>
    <div class="toolbar">
      <div class="search-field">${icon('search')}
        <input class="input" id="p-q" placeholder="Nom, prénom ou matricule…" /></div>
      <div class="toolbar-group"><span class="toolbar-label">Centre</span>
      <select class="select" id="p-cis">
        <option value="">Tout le département</option>
        ${state.refs.cis.map((c) => `<option value="${esc(c.code)}">${esc(c.nom)}</option>`).join('')}
        <option value="CODIS">CODIS / état-major</option>
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Disponibilité</span>
      <select class="select" id="p-statut">
        <option value="">Toutes</option>
        ${state.refs.statuts_personnel.map((s) => `<option>${esc(s)}</option>`).join('')}
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Aptitude</span>
      <select class="select" id="p-aptitude">
        <option value="">Toutes</option>
        ${state.refs.aptitudes.map((a) => `<option value="${esc(a.code)}">${esc(a.code)} — ${esc(a.libelle)}</option>`).join('')}
      </select></div>
      <div class="spacer"></div>
      <span class="small muted" id="p-count"></span>
    </div>
    <div class="card">
      <div class="card-head">${icon('users')}<h3>Personnels</h3>
        <div class="card-head-actions"><span class="badge badge-mono">SDIS 06</span></div>
      </div>
      <div id="p-table"></div>
    </div>
  </div>`;

  const tableEl = container.querySelector('#p-table');
  const statsEl = container.querySelector('#p-stats');
  const countEl = container.querySelector('#p-count');

  const load = async () => {
    const all = await api('/api/personnels');
    const counts = {
      total: all.total,
      dispo: all.items.filter((p) => p.statut === 'Disponible').length,
      engage: all.items.filter((p) => p.statut === 'En intervention').length,
      indispo: all.items.filter((p) => !['Disponible', 'En intervention'].includes(p.statut)).length,
    };
    statsEl.innerHTML = [
      { label: 'Effectif départemental', value: counts.total, tone: 'blue', icon: 'users', foot: 'personnels enregistrés' },
      { label: 'Disponibles', value: counts.dispo, tone: 'green', icon: 'check', foot: `${Math.round((counts.dispo / counts.total) * 100)} % de l’effectif` },
      { label: 'En intervention', value: counts.engage, tone: 'red', icon: 'flame', foot: 'engagés sur un engin' },
      { label: 'Indisponibles', value: counts.indispo, tone: 'amber', icon: 'clock', foot: 'repos, congés, formation' },
    ]
      .map(
        (c) => `<div class="kpi ${c.tone}">
          <div class="kpi-top"><span class="kpi-label">${esc(c.label)}</span><span class="kpi-icon">${icon(c.icon)}</span></div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-foot">${esc(c.foot)}</div>
        </div>`,
      )
      .join('');

    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.cis) params.set('cis', filters.cis);
    if (filters.statut) params.set('statut', filters.statut);
    if (filters.aptitude) params.set('aptitude', filters.aptitude);
    const data = await api(`/api/personnels?${params.toString()}`);
    countEl.textContent = `${data.total} personnel(s)`;

    tableEl.innerHTML = data.items.length
      ? `<div class="table-wrap table-scroll"><table class="table">
          <thead><tr><th>Grade et identité</th><th>Matricule</th><th>Affectation</th><th>Aptitudes</th><th>Garde</th><th>Disponibilité</th><th>Compte</th><th class="cell-actions"></th></tr></thead>
          <tbody>
            ${data.items
              .map(
                (p) => `<tr class="clickable" data-mat="${esc(p.matricule)}">
                  <td><div class="row" style="gap:8px"><span class="avatar-sm">${initials(p.prenom, p.nom)}</span>
                    <div><div class="cell-strong">${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}</div>
                    <div class="cell-sub">${esc(p.fonction)}</div></div></div></td>
                  <td class="cell-num">${esc(p.matricule)}</td>
                  <td>${esc(p.cis)}</td>
                  <td><div class="row row-wrap" style="gap:3px">
                    ${p.aptitudes.slice(0, 4).map((a) => `<span class="chip">${esc(a.code)}</span>`).join('')}
                    ${p.aptitudes.length > 4 ? `<span class="chip">+${p.aptitudes.length - 4}</span>` : ''}
                  </div></td>
                  <td><span class="badge badge-outline">${esc(p.garde)}</span></td>
                  <td>${badge(p.statut)}</td>
                  <td>${p.compte ? `<span class="role-pill ${esc(p.compte.role)}">${esc(ROLE_LABEL[p.compte.role] || p.compte.role)}</span>` : '<span class="muted small">—</span>'}</td>
                  <td class="cell-actions">${icon('chevron-right')}</td>
                </tr>`,
              )
              .join('')}
          </tbody></table></div>`
      : `<div class="empty">${icon('users')}<strong>Aucun personnel</strong>Aucun résultat pour ces critères.</div>`;
  };

  state.refresh = () => load().catch(() => {});

  container.querySelector('#p-q').addEventListener(
    'input',
    debounce((e) => {
      filters.q = e.target.value.trim();
      load();
    }, 280),
  );
  ['cis', 'statut', 'aptitude'].forEach((k) => {
    container.querySelector(`#p-${k}`).addEventListener('change', (e) => {
      filters[k] = e.target.value;
      load();
    });
  });

  container.querySelector('#p-table').addEventListener('click', (e) => {
    const row = e.target.closest('[data-mat]');
    if (row) openPersonnel(row.dataset.mat, load);
  });

  const urlQ = new URLSearchParams(location.hash.split('?')[1] || '');
  if (urlQ.get('q')) {
    filters.q = urlQ.get('q');
    container.querySelector('#p-q').value = filters.q;
  }

  await load();
}

async function openPersonnel(matricule, reload) {
  let data;
  try {
    data = await api(`/api/personnels/${encodeURIComponent(matricule)}`);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  const p = data.personnel;
  const editable = can('personnels.write') && p.statut !== 'En intervention';

  openModal({
    title: `${p.grade} ${p.prenom} ${p.nom}`,
    subtitle: `Matricule ${esc(p.matricule)} · ${esc(p.cis)} · garde ${esc(p.garde)}`,
    iconName: 'user',
    size: 'modal-lg',
    body: `<div class="grid grid-2" style="gap:18px">
      <div>
        <div class="form-section">Identité</div>
        <dl class="kv" style="grid-template-columns:120px 1fr">
          <dt>Grade</dt><dd>${esc(p.grade)}</dd>
          <dt>Fonction</dt><dd>${esc(p.fonction)}</dd>
          <dt>Affectation</dt><dd>${esc(p.cis)}</dd>
          <dt>Entrée au SDIS</dt><dd>${esc(fmtDateOnly(p.date_entree))}</dd>
          <dt>Téléphone</dt><dd>${esc(p.telephone || '—')}</dd>
          <dt>Messagerie</dt><dd>${esc(p.email || '—')}</dd>
          <dt>Disponibilité</dt><dd>${badge(p.statut)}</dd>
        </dl>
        ${editable
          ? `<div class="field" style="margin-top:12px">
              <span class="field-label">Modifier la disponibilité</span>
              <div class="row">
                <select class="select" id="p-new-statut">
                  ${['Disponible', 'Repos', 'Congé', 'Formation', 'Indisponible'].map((s) => `<option ${s === p.statut ? 'selected' : ''}>${esc(s)}</option>`).join('')}
                </select>
                <button class="btn btn-primary btn-sm" id="p-save-statut">${icon('check')} Appliquer</button>
              </div>
            </div>`
          : p.statut === 'En intervention'
            ? `<div class="alert alert-warning" style="margin-top:12px">${icon('flame')}<span>Personnel actuellement engagé sur une intervention.</span></div>`
            : ''}
      </div>
      <div>
        <div class="form-section">Aptitudes et qualifications</div>
        ${p.aptitudes.length
          ? `<div class="stack" style="gap:5px">${p.aptitudes
              .map(
                (a) => `<div class="row" style="padding:6px 9px;border:1px solid var(--line-100);border-radius:4px">
                  <span class="badge badge-mono">${esc(a.code)}</span>
                  <span class="small" style="flex:1">${esc(a.libelle)}</span>
                  <span class="cell-sub">${esc(fmtDateOnly(a.validite))}</span>
                </div>`,
              )
              .join('')}</div>`
          : '<p class="muted small">Aucune aptitude enregistrée.</p>'}
        <div class="form-section" style="margin-top:16px">Compte utilisateur</div>
        ${p.compte
          ? `<dl class="kv" style="grid-template-columns:120px 1fr">
              <dt>Rôle</dt><dd>${esc(ROLE_LABEL[p.compte.role] || p.compte.role)}</dd>
              <dt>État</dt><dd>${p.compte.actif ? '<span class="badge badge-disponible">Actif</span>' : '<span class="badge badge-indisponible">Désactivé</span>'}</dd>
              <dt>Dernier accès</dt><dd>${esc(p.compte.dernier_acces ? fmtDate(p.compte.dernier_acces) : '—')}</dd>
              <dt>Créé le</dt><dd>${esc(fmtDateOnly(p.compte.cree_le))}</dd>
            </dl>`
          : '<p class="muted small">Ce personnel ne dispose pas d’un compte d’accès au système.</p>'}
      </div>
    </div>
    <div class="form-section" style="margin-top:16px">Dernières interventions</div>
    ${p.interventions.length
      ? `<div class="table-wrap"><table class="table table-compact">
          <thead><tr><th>N° SIN</th><th>Date</th><th>Nature</th><th>État</th></tr></thead>
          <tbody>${p.interventions
            .map(
              (i) => `<tr><td class="cell-num">${esc(i.numero)}</td><td>${esc(fmtDateOnly(i.cree_le))}</td>
                <td>${esc(i.nature)}</td><td>${badge(i.statut === 'Clôturée' ? 'Clôturée' : 'En cours')}</td></tr>`,
            )
            .join('')}</tbody></table></div>`
      : '<p class="muted small">Aucune intervention enregistrée.</p>'}`,
    footer: `<button class="btn" data-close>Fermer</button>`,
    onMount(modal, close) {
      const save = modal.querySelector('#p-save-statut');
      if (save) {
        save.onclick = async () => {
          const statut = modal.querySelector('#p-new-statut').value;
          try {
            await api(`/api/personnels/${encodeURIComponent(matricule)}`, { method: 'PATCH', body: { statut } });
            toast(`Disponibilité mise à jour : ${statut}`, 'success');
            close();
            reload();
          } catch (err) {
            toast(err.message, 'error');
          }
        };
      }
    },
  });
}
