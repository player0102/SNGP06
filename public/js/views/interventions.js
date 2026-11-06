import { api } from '../api.js';
import { state, can } from '../state.js';
import {
  esc, icon, pageHead, badge, prioriteBadge, fmtTime, elapsed, mapSvg, mapLegend, emptyState, debounce,
} from '../util.js';

export async function render(container) {
  const filters = { statut: 'en_cours', q: '', famille: '', cis: '' };

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Synoptique des interventions',
      subtitle: 'Suivi en temps réel des opérations en cours sur le département',
      iconName: 'radio',
      breadcrumb: ['Opérations', 'Synoptique des interventions'],
      actions: `
        <button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        <a class="btn btn-sm" href="#/historique">${icon('history')} Historique</a>
        ${can('interventions.write') ? `<button class="btn btn-sm btn-primary" data-act="nouvelle-alerte">${icon('flame')} Nouvelle alerte</button>` : ''}`,
    })}

    <div class="toolbar">
      <div class="search-field">
        ${icon('search')}
        <input class="input" id="f-q" placeholder="N° SIN, nature, adresse…" />
      </div>
      <div class="toolbar-group"><span class="toolbar-label">Famille</span>
      <select class="select" id="f-famille">
        <option value="">Toutes</option>
        ${Object.entries(state.refs.familles).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Centre</span>
      <select class="select" id="f-cis">
        <option value="">Tout le département</option>
        ${state.refs.cis.map((c) => `<option value="${esc(c.code)}">${esc(c.nom)}</option>`).join('')}
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Statut</span>
      <select class="select" id="f-statut">
        <option value="en_cours">En cours uniquement</option>
        <option value="historique">Clôturées</option>
        <option value="toutes">Toutes</option>
      </select></div>
      <div class="spacer"></div>
      <span class="small muted" id="iv-total"></span>
    </div>

    <div class="card">
      <div class="card-head">
        ${icon('map')}<h3>Cartographie opérationnelle</h3>
        <div class="card-head-actions">
          <span class="badge badge-outline" id="map-count">—</span>
          <a class="btn btn-sm btn-ghost" href="#/engins">${icon('truck')} Engins</a>
        </div>
      </div>
      <div class="map-wrap" id="iv-map"></div>
    </div>

    <div class="card">
      <div class="card-head">
        ${icon('list')}<h3>Dossiers de sinistre</h3>
        <div class="card-head-actions"><span class="badge badge-mono">SIN 06</span></div>
      </div>
      <div id="iv-table"></div>
    </div>
  </div>`;

  const mapEl = container.querySelector('#iv-map');
  const tableEl = container.querySelector('#iv-table');
  const countEl = container.querySelector('#map-count');
  const totalEl = container.querySelector('#iv-total');

  const load = async () => {
    const params = new URLSearchParams({
      statut: filters.statut,
      q: filters.q,
      famille: filters.famille,
      cis: filters.cis,
      limit: '300',
    });
    const data = await api(`/api/interventions?${params.toString()}`);
    const items = data.items;

    const actives = items.filter((i) => i.statut !== 'Clôturée');
    mapEl.innerHTML = `${mapSvg(actives, { crop: true })}${mapLegend()}
      <div class="map-counter">${icon('radio')} ${actives.length} intervention(s) en cours</div>`;
    countEl.textContent = `${actives.length} en cours`;
    totalEl.textContent = `${data.total} dossier(s)`;

    tableEl.innerHTML = items.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr>
            <th>N° SIN</th><th>Heure</th><th>Nature</th><th>Commune / adresse</th>
            <th>Priorité</th><th>Moyens engagés</th><th>État</th><th>Chef de dispositif</th><th class="cell-actions"></th>
          </tr></thead>
          <tbody>
            ${items.map((iv) => `<tr class="clickable" data-go="#/intervention/${esc(iv.id)}">
              <td class="cell-num">${esc(iv.numero)}</td>
              <td class="cell-num">${esc(fmtTime(iv.cree_le))}</td>
              <td><span class="cell-strong">${esc(iv.nature)}</span><div class="cell-sub">${esc(state.refs.familles[iv.famille] || iv.famille)}</div></td>
              <td>${esc(iv.commune)}<div class="cell-sub">${esc(iv.adresse)}</div></td>
              <td>${prioriteBadge(iv.priorite)}</td>
              <td><div class="row row-wrap" style="gap:4px">${iv.engins.map((e) => `<span class="chip">${esc(e.indicatif)}</span>`).join('')}</div></td>
              <td>${badge(iv.statut_label)}<div class="cell-sub">${elapsed(iv.cree_le)}</div></td>
              <td>${iv.chef_agres ? `${esc(iv.chef_agres.grade)} ${esc(iv.chef_agres.nom)}` : '—'}</td>
              <td class="cell-actions">${icon('chevron-right')}</td>
            </tr>`).join('')}
          </tbody></table></div>`
      : emptyState('check', 'Aucune intervention', 'Aucun dossier ne correspond aux critères sélectionnés.');
  };

  const reload = async () => {
    try {
      await load();
    } catch (err) {
      tableEl.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  };

  state.refresh = reload;

  container.querySelector('#f-q').addEventListener(
    'input',
    debounce((e) => {
      filters.q = e.target.value.trim();
      reload();
    }, 300),
  );
  container.querySelector('#f-famille').addEventListener('change', (e) => {
    filters.famille = e.target.value;
    reload();
  });
  container.querySelector('#f-cis').addEventListener('change', (e) => {
    filters.cis = e.target.value;
    reload();
  });
  container.querySelector('#f-statut').addEventListener('change', (e) => {
    filters.statut = e.target.value;
    reload();
  });

  container.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.dataset.go;
    const marker = e.target.closest('[data-iv]');
    if (marker) location.hash = `#/intervention/${marker.dataset.iv}`;
  });

  await reload();
}
