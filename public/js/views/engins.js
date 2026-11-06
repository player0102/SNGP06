import { api } from '../api.js';
import { state, can } from '../state.js';
import { esc, icon, pageHead, badge, openModal, toast, emptyState, debounce } from '../util.js';

export async function render(container) {
  const filters = { cis: '', type: '', statut: '', q: '' };

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Synoptique des engins',
      subtitle: 'Parc matériel du SDIS 06 — disponibilité et engagement opérationnel',
      iconName: 'truck',
      breadcrumb: ['Opérations', 'Synoptique des engins'],
      actions: `<button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        <a class="btn btn-sm" href="#/interventions">${icon('radio')} Interventions</a>`,
    })}
    <div class="grid grid-4" id="engins-stats"></div>
    <div class="toolbar">
      <div class="search-field">${icon('search')}
        <input class="input" id="e-q" placeholder="Rechercher un indicatif, une immatriculation…" /></div>
      <div class="toolbar-group"><span class="toolbar-label">Centre</span>
      <select class="select" id="e-cis">
        <option value="">Tout le département</option>
        ${state.refs.cis.map((c) => `<option value="${esc(c.code)}">${esc(c.nom)}</option>`).join('')}
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Type</span>
      <select class="select" id="e-type">
        <option value="">Tous les types</option>
        ${Object.entries(state.refs.engin_types).map(([k, v]) => `<option value="${esc(k)}">${esc(k)} — ${esc(v.libelle)}</option>`).join('')}
      </select></div>
      <div class="toolbar-group"><span class="toolbar-label">Statut</span>
      <select class="select" id="e-statut">
        <option value="">Tous</option>
        <option>Disponible</option>
        <option>Engagé</option>
        <option>Maintenance</option>
        <option>Indisponible</option>
      </select></div>
      <div class="spacer"></div>
      <span class="small muted" id="e-count"></span>
    </div>
    <div id="e-body"></div>
  </div>`;

  const statsEl = container.querySelector('#engins-stats');
  const bodyEl = container.querySelector('#e-body');
  const countEl = container.querySelector('#e-count');

  const load = async () => {
    const data = await api('/api/engins');
    const all = data.items;
    const st = data.stats;

    statsEl.innerHTML = [
      { label: 'Parc matériel', value: st.total, tone: '', icon: 'truck', foot: 'engins du département' },
      { label: 'Disponibles', value: st.disponibles, tone: 'green', icon: 'check', foot: `${Math.round((st.disponibles / st.total) * 100)} % du parc` },
      { label: 'Engagés', value: st.engages, tone: 'red', icon: 'flame', foot: 'en intervention' },
      { label: 'Indisponibles', value: st.indisponibles, tone: 'amber', icon: 'wrench', foot: 'maintenance ou indisponibilité' },
    ]
      .map(
        (c) => `<div class="kpi ${c.tone}">
          <div class="kpi-top"><span class="kpi-label">${esc(c.label)}</span><span class="kpi-icon">${icon(c.icon)}</span></div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-foot">${esc(c.foot)}</div>
        </div>`,
      )
      .join('');

    let items = all;
    if (filters.cis) items = items.filter((e) => e.cis === filters.cis);
    if (filters.type) items = items.filter((e) => e.type === filters.type);
    if (filters.statut) items = items.filter((e) => e.statut === filters.statut);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((e) => `${e.indicatif} ${e.immat} ${e.type_libelle}`.toLowerCase().includes(q));
    }
    countEl.textContent = `${items.length} engin(s)`;

    if (!items.length) {
      bodyEl.innerHTML = `<div class="card">${emptyState('truck', 'Aucun engin', 'Aucun engin ne correspond aux critères sélectionnés.')}</div>`;
      return;
    }

    const groupes = {};
    for (const e of items) {
      if (!groupes[e.cis]) groupes[e.cis] = [];
      groupes[e.cis].push(e);
    }

    bodyEl.innerHTML = state.refs.cis
      .filter((c) => groupes[c.code])
      .map(
        (c) => `<div class="stack" style="margin-bottom:16px">
          <div class="section-title">
            <h2>${esc(c.nom)} <span class="muted" style="font-weight:500;text-transform:none;letter-spacing:0">— ${esc(c.commune)}</span></h2>
            <span class="count">${groupes[c.code].length} engin(s)</span>
          </div>
          <div class="grid grid-3">${groupes[c.code].map((e) => card(e)).join('')}</div>
        </div>`,
      )
      .join('');
  };

  state.refresh = () => load().catch(() => {});

  container.querySelector('#e-q').addEventListener(
    'input',
    debounce((ev) => {
      filters.q = ev.target.value.trim();
      load();
    }, 280),
  );
  ['cis', 'type', 'statut'].forEach((k) => {
    container.querySelector(`#e-${k}`).addEventListener('change', (ev) => {
      filters[k] = ev.target.value;
      load();
    });
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-statut]');
    if (btn) {
      const engin = btn.dataset.engin;
      openStatutModal(engin, load);
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) location.hash = go.dataset.go;
  });

  await load();
}

function card(e) {
  const cls = e.statut === 'Engagé' ? 'is-engage' : e.statut === 'Disponible' ? 'is-dispo' : 'is-indispo';
  return `<div class="engin-card ${cls}">
    <div class="engin-top">
      <div>
        <div class="engin-name">${esc(e.indicatif)}</div>
        <div class="engin-type">${esc(e.type_libelle)}</div>
      </div>
      <span class="spacer"></span>
      ${badge(e.statut)}
    </div>
    <div class="engin-meta">
      <span>Immat. <b>${esc(e.immat)}</b></span>
      <span>Radio <b>${esc(e.radio)}</b></span>
      <span><b>${e.km.toLocaleString('fr-FR')}</b> km</span>
    </div>
    ${e.intervention ? `<div class="alert alert-warning" style="padding:6px 9px;font-size:11.4px">
        ${icon('flame')}<span>Engagé sur <a href="#/intervention/${esc(e.intervention.id)}">${esc(e.intervention.numero)}</a> — ${esc(e.intervention.nature)}</span>
      </div>` : ''}
    ${e.statut !== 'Disponible' && e.motif ? `<div class="small muted">${icon('wrench')} ${esc(e.motif)}</div>` : ''}
    <div class="engin-crew">
      <div class="row"><span class="cell-sub" style="font-weight:600">Équipage</span>
        <span class="spacer"></span>
        <span class="cell-sub">${e.equipage_detail.length}/${e.effectif} ${e.equipage_detail.length ? 'à bord' : 'théorique'}</span></div>
      ${e.equipage_detail.length
        ? e.equipage_detail
            .map(
              (p, i) => `<div class="row"><span>${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}</span>
                <span class="spacer"></span>${i === 0 ? '<span class="role">Chef</span>' : `<span class="mat mono" style="font-size:10px;color:var(--muted-500)">${esc(p.matricule)}</span>`}</div>`,
            )
            .join('')
        : `<span class="small muted">Aucun équipage affecté.</span>`}
    </div>
    ${can('engins.write') && e.statut !== 'Engagé'
      ? `<button class="btn btn-sm" data-statut data-engin="${esc(e.indicatif)}">${icon('sliders')} Modifier la disponibilité</button>`
      : ''}
  </div>`;
}

function openStatutModal(indicatif, reload) {
  openModal({
    title: 'Disponibilité de l’engin',
    subtitle: indicatif,
    iconName: 'sliders',
    body: `<form id="form-engin">
      <label class="field">
        <span class="field-label">Nouveau statut</span>
        <select class="select" name="statut">
          <option value="Disponible">Disponible</option>
          <option value="Maintenance">En maintenance</option>
          <option value="Indisponible">Indisponible</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">Motif / observation</span>
        <input class="input" name="motif" placeholder="Ex. passage au contrôle technique, panne pompe…" />
      </label>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary">${icon('check')} Enregistrer</button>
      </div>
    </form>`,
    onMount(modal, close) {
      modal.querySelector('#form-engin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api(`/api/engins/${encodeURIComponent(indicatif)}`, {
            method: 'PATCH',
            body: { statut: fd.get('statut'), motif: fd.get('motif') },
          });
          close();
          toast(`${indicatif} — statut mis à jour.`, 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}
