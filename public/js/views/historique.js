import { api } from '../api.js';
import { state } from '../state.js';
import {
  esc, icon, pageHead, badge, prioriteBadge, fmtDate, fmtDateOnly, duree, emptyState, debounce, toast,
} from '../util.js';

export async function render(container) {
  let items = [];
  const filters = { q: '', famille: '', cis: '' };

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Historique des interventions',
      subtitle: 'Registre des dossiers de sinistre clôturés — 35 derniers jours',
      iconName: 'history',
      breadcrumb: ['Opérations', 'Historique des interventions'],
      actions: `<button class="btn btn-sm" data-export>${icon('download')} Exporter (CSV)</button>
        <a class="btn btn-sm" href="#/crss">${icon('clipboard')} Registre CRSS</a>
        <button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>`,
    })}
    <div class="toolbar">
      <div class="search-field">${icon('search')}
        <input class="input" id="h-q" placeholder="Numéro SIN, nature, adresse, bilan…" /></div>
      <div class="toolbar-group"><span class="toolbar-label">Famille</span>
      <select class="select" id="h-famille">
        <option value="">Toutes</option>
        ${Object.entries(state.refs.familles).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('')}
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Centre</span>
      <select class="select" id="h-cis">
        <option value="">Tout le département</option>
        ${state.refs.cis.map((c) => `<option value="${esc(c.code)}">${esc(c.commune)}</option>`).join('')}
      </select></div>
      <div class="spacer"></div>
      <span class="small muted" id="h-count"></span>
    </div>
    <div class="card">
      <div class="card-head">${icon('file')}<h3>Dossiers clôturés</h3>
        <div class="card-head-actions"><span class="badge badge-mono">SIN 06</span></div>
      </div>
      <div id="h-table"></div>
      <div class="card-foot">${icon('clock')} Les dossiers sont conservés et consultables pendant la durée réglementaire de 5 ans.</div>
    </div>
  </div>`;

  const tableEl = container.querySelector('#h-table');
  const countEl = container.querySelector('#h-count');

  const load = async () => {
    const params = new URLSearchParams({ statut: 'historique', q: filters.q, famille: filters.famille, cis: filters.cis, limit: '400' });
    const data = await api(`/api/interventions?${params.toString()}`);
    items = data.items;
    countEl.textContent = `${data.total} dossier(s)`;

    tableEl.innerHTML = items.length
      ? `<div class="table-wrap table-scroll"><table class="table">
          <thead><tr><th>Date</th><th>N° SIN</th><th>Nature</th><th>Commune</th><th>Moyens</th><th>Durée</th><th>Chef de dispositif</th><th>Bilan</th><th class="cell-actions"></th></tr></thead>
          <tbody>
            ${items
              .map(
                (iv) => `<tr class="clickable" data-go="#/intervention/${esc(iv.id)}">
                  <td class="nowrap"><span class="cell-strong">${esc(fmtDateOnly(iv.cree_le))}</span><div class="cell-sub">${esc(fmtDate(iv.cree_le).slice(11))}</div></td>
                  <td class="cell-num">${esc(iv.numero)}</td>
                  <td>${esc(iv.nature)}<div class="cell-sub">${esc(state.refs.familles[iv.famille] || iv.famille)}</div></td>
                  <td>${esc(iv.commune)}<div class="cell-sub">${esc(iv.adresse)}</div></td>
                  <td><span class="chip">${iv.engins.length} engin(s)</span></td>
                  <td class="nowrap">${esc(duree(iv.cree_le, iv.cloture_le))}</td>
                  <td>${iv.chef_agres ? `${esc(iv.chef_agres.grade)} ${esc(iv.chef_agres.nom)}` : '—'}</td>
                  <td style="max-width:280px"><span class="cell-sub" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(iv.bilan || '—')}</span></td>
                  <td class="cell-actions">${icon('chevron-right')}</td>
                </tr>`,
              )
              .join('')}
          </tbody></table></div>`
      : emptyState('history', 'Aucun dossier', 'Aucune intervention clôturée pour ces critères.');
  };

  state.refresh = () => load().catch(() => {});

  container.querySelector('#h-q').addEventListener(
    'input',
    debounce((e) => {
      filters.q = e.target.value.trim();
      load();
    }, 280),
  );
  ['famille', 'cis'].forEach((k) => {
    container.querySelector(`#h-${k}`).addEventListener('change', (e) => {
      filters[k] = e.target.value;
      load();
    });
  });

  container.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.dataset.go;
    if (e.target.closest('[data-export]')) exportCsv(items);
  });

  await load();
}

function exportCsv(items) {
  if (!items.length) {
    toast('Aucune donnée à exporter.', 'warning');
    return;
  }
  const rows = [
    ['Numero', 'Date', 'Nature', 'Famille', 'Commune', 'Adresse', 'Priorite', 'Engins', 'Duree', 'Chef', 'Bilan'],
    ...items.map((iv) => [
      iv.numero,
      iv.cree_le,
      iv.nature,
      state.refs.familles[iv.famille] || iv.famille,
      iv.commune,
      iv.adresse,
      iv.priorite,
      iv.engins.map((e) => e.indicatif).join(' / '),
      duree(iv.cree_le, iv.cloture_le),
      iv.chef_agres ? `${iv.chef_agres.grade} ${iv.chef_agres.nom}` : '',
      iv.bilan || '',
    ]),
  ];
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SNGP06_historique_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Export CSV généré.', 'success');
}
