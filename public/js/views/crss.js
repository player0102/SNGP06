import { api } from '../api.js';
import { state, can } from '../state.js';
import {
  esc, icon, pageHead, badge, fmtDate, fmtDateOnly, openModal, toast, emptyState, debounce,
} from '../util.js';

export async function render(container) {
  let items = [];

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Compte rendu de sortie de secours',
      subtitle: 'Registre des CRSS validés — comptes rendus d’intervention du SDIS 06',
      iconName: 'clipboard',
      breadcrumb: ['Documentation', 'Compte Rendu de Sortie de Secours (CRSS)'],
      actions: `<button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        <button class="btn btn-sm" onclick="window.print()">${icon('printer')} Imprimer</button>`,
    })}
    <div class="toolbar">
      <div class="search-field">${icon('search')}
        <input class="input" id="cr-q" placeholder="Numéro SIN, nature, commune, bilan…" /></div>
      <div class="spacer"></div>
      <span class="small muted" id="cr-count"></span>
    </div>
    <div class="card">
      <div class="card-head">${icon('clipboard')}<h3>Comptes rendus enregistrés</h3>
        <div class="card-head-actions"><span class="badge badge-mono">CRSS</span></div>
      </div>
      <div id="cr-table"></div>
      <div class="card-foot">${icon('shield-check')} Chaque CRSS est visé par le chef de garde avant transmission au CODIS.</div>
    </div>
  </div>`;

  const tableEl = container.querySelector('#cr-table');
  const countEl = container.querySelector('#cr-count');

  const load = async () => {
    const q = container.querySelector('#cr-q').value.trim();
    const data = await api(`/api/crss?q=${encodeURIComponent(q)}`);
    items = data.items;
    countEl.textContent = `${data.total} compte(s) rendu(s)`;

    tableEl.innerHTML = items.length
      ? `<div class="table-wrap table-scroll"><table class="table">
          <thead><tr><th>Clôture</th><th>N° SIN</th><th>Nature</th><th>Commune</th><th>Chef de dispositif</th><th>Moyens</th><th>Victimes</th><th>CRSS</th><th class="cell-actions"></th></tr></thead>
          <tbody>
            ${items
              .map(
                (c) => `<tr class="clickable" data-id="${esc(c.id)}">
                  <td class="nowrap">${esc(fmtDateOnly(c.cloture_le))}<div class="cell-sub">${esc((c.cloture_le || '').slice(11, 16))}</div></td>
                  <td class="cell-num">${esc(c.numero)}</td>
                  <td>${esc(c.nature)}<div class="cell-sub">${esc(state.refs.familles[c.famille] || c.famille)}</div></td>
                  <td>${esc(c.commune)}<div class="cell-sub">${esc(c.adresse)}</div></td>
                  <td>${c.chef ? `${esc(c.chef.grade)} ${esc(c.chef.nom)}` : '—'}</td>
                  <td><span class="chip">${c.engins.length} moyen(s)</span></td>
                  <td>${c.victimes ? `<span class="badge badge-conge">${c.victimes}</span>` : '<span class="muted">0</span>'}</td>
                  <td>${c.crss?.redige_le ? `<span class="badge badge-disponible">Rédigé</span>` : '<span class="badge badge-indisponible">À établir</span>'}<div class="cell-sub">${esc(fmtDateOnly(c.crss?.redige_le))}</div></td>
                  <td class="cell-actions">${icon('chevron-right')}</td>
                </tr>`,
              )
              .join('')}
          </tbody></table></div>`
      : emptyState('clipboard', 'Aucun compte rendu', 'Les CRSS sont générés automatiquement à la clôture des interventions.');
  };

  state.refresh = () => load().catch(() => {});

  container.querySelector('#cr-q').addEventListener(
    'input',
    debounce(() => load(), 260),
  );

  tableEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const item = items.find((i) => i.id === row.dataset.id);
    if (item) openCrss(item, load);
  });

  await load();
}

function openCrss(item, reload) {
  const editable = can('crss.write');
  openModal({
    title: 'Compte rendu de sortie de secours',
    subtitle: `Dossier ${esc(item.numero)} — ${esc(item.nature)}, ${esc(item.commune)}`,
    iconName: 'clipboard',
    size: 'modal-lg',
    body: `<div class="msg-meta">
        ${badge('Clôturée')}
        <span class="chip">${icon('calendar')} ${esc(fmtDate(item.cloture_le))}</span>
        <span class="chip">${icon('truck')} ${esc(item.engins.join(', '))}</span>
        <span class="chip">${icon('user')} ${esc(item.chef ? `${item.chef.grade} ${item.chef.nom}` : '—')}</span>
      </div>
      <dl class="kv" style="grid-template-columns:150px 1fr;margin-bottom:14px">
        <dt>Nature</dt><dd>${esc(item.nature)} (${esc(state.refs.familles[item.famille] || item.famille)})</dd>
        <dt>Adresse</dt><dd>${esc(item.adresse)}, ${esc(item.commune)}</dd>
        <dt>Victimes</dt><dd>${item.victimes ?? 0} personne(s)</dd>
        <dt>Rédigé par</dt><dd>${esc(item.redige_par_nom || item.crss?.redige_par || '—')} <span class="muted">le ${esc(fmtDate(item.crss?.redige_le))}</span></dd>
        <dt>Visa</dt><dd>${esc(item.crss?.visa || 'Chef de garde')}</dd>
      </dl>
      <form id="form-crss-edit">
        <label class="field"><span class="field-label">Bilan et actions réalisées</span>
          <textarea class="textarea" name="bilan" rows="4" ${editable ? '' : 'disabled'}>${esc(item.crss?.bilan || '')}</textarea></label>
        <div class="form-grid">
          <label class="field"><span class="field-label">Conséquences</span>
            <textarea class="textarea" name="consequences" rows="2" ${editable ? '' : 'disabled'}>${esc(item.crss?.consequences || '')}</textarea></label>
          <label class="field"><span class="field-label">Suites données</span>
            <textarea class="textarea" name="suites" rows="2" ${editable ? '' : 'disabled'}>${esc(item.crss?.suites || '')}</textarea></label>
        </div>
        <div class="form-actions">
          <a class="btn" href="#/intervention/${esc(item.id)}" data-close>Ouvrir le dossier</a>
          <button type="button" class="btn" data-close>Fermer</button>
          ${editable ? `<button type="submit" class="btn btn-primary">${icon('check')} Enregistrer</button>` : ''}
        </div>
      </form>`,
    onMount(modal, close) {
      const form = modal.querySelector('#form-crss-edit');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
          await api('/api/crss', {
            method: 'POST',
            body: {
              intervention_id: item.id,
              bilan: fd.get('bilan'),
              consequences: fd.get('consequences'),
              suites: fd.get('suites'),
            },
          });
          close();
          toast('CRSS mis à jour.', 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}
