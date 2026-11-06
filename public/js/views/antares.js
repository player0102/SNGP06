import { api } from '../api.js';
import { state } from '../state.js';
import {
  esc, icon, pageHead, badge, prioriteBadge, fmtTime, toast, emptyState, debounce,
} from '../util.js';

export async function render(container) {
  let interventions = [];
  let selected = null;
  let messages = [];
  let activeType = 'DEPART';

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Messages ANTARES',
      subtitle: 'Transmissions opérationnelles vers le CODIS 06 — réseau ANTARES',
      iconName: 'send',
      breadcrumb: ['Documentation', 'Message ANTARES'],
      actions: `<span class="badge badge-disponible">${icon('radio')} Liaison ANTARES opérationnelle</span>
        <button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>`,
    })}

    <div class="grid grid-1-2">
      <div class="stack">
        <div class="toolbar" style="padding:8px 10px">
          <div class="search-field" style="max-width:none">${icon('search')}
            <input class="input" id="an-q" placeholder="N° SIN, nature, commune…" /></div>
        </div>
        <div class="card">
          <div class="card-head">${icon('radio')}<h3>Dossiers de sinistre</h3>
            <div class="card-head-actions"><span class="badge badge-mono" id="an-count"></span></div>
          </div>
          <div id="an-list" style="max-height:620px;overflow:auto"></div>
        </div>
      </div>

      <div id="an-preview">
        <div class="card"><div class="card-body">${emptyState('send', 'Sélectionnez un dossier', 'Choisissez une intervention pour rédiger ou consulter les messages ANTARES associés.')}</div></div>
      </div>
    </div>
  </div>`;

  const listEl = container.querySelector('#an-list');
  const previewEl = container.querySelector('#an-preview');
  const countEl = container.querySelector('#an-count');

  const loadList = async () => {
    const q = container.querySelector('#an-q').value.trim();
    const data = await api(`/api/interventions?statut=toutes&q=${encodeURIComponent(q)}&limit=150`);
    interventions = data.items;
    countEl.textContent = `${data.total} dossier(s)`;
    listEl.innerHTML = interventions.length
      ? interventions
          .map(
            (iv) => `<button class="list-row" data-id="${esc(iv.id)}" style="width:100%;background:${iv.id === selected ? '#eef5fc' : 'none'};border:0;border-bottom:1px solid var(--line-100);cursor:pointer;text-align:left">
              <span class="badge badge-${(iv.priorite || 'p3').toLowerCase()}">${esc(iv.priorite)}</span>
              <span class="grow"><span class="title">${esc(iv.nature)}</span>
              <span class="sub">${esc(iv.numero)} · ${esc(iv.commune)} · ${esc(fmtTime(iv.cree_le))}</span></span>
              ${badge(iv.statut_label)}
            </button>`,
          )
          .join('')
      : emptyState('send', 'Aucun dossier');

    if (!selected && interventions.length) select(interventions[0].id);
  };

  const select = async (id) => {
    selected = id;
    listEl.querySelectorAll('[data-id]').forEach((el) => {
      el.style.background = el.dataset.id === id ? '#eef5fc' : 'none';
    });
    try {
      const data = await api(`/api/interventions/${encodeURIComponent(id)}/antares`);
      messages = data.messages;
      activeType = messages[0]?.type || 'DEPART';
      renderPreview(data.numero);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const renderPreview = (numero) => {
    const iv = interventions.find((i) => i.id === selected);
    const msg = messages.find((m) => m.type === activeType) || messages[0];
    if (!iv || !msg) return;
    previewEl.innerHTML = `<div class="card">
      <div class="card-head">
        ${icon('send')}<h3>Message ANTARES — ${esc(numero)}</h3>
        <div class="card-head-actions">${prioriteBadge(iv.priorite)}</div>
      </div>
      <div class="card-body">
        <div class="msg-meta">
          <span class="chip">${icon('pin')} ${esc(iv.adresse)}, ${esc(iv.commune)}</span>
          <span class="chip">${icon('truck')} ${esc(iv.engins.map((e) => e.indicatif).join(', '))}</span>
          <span class="chip">${icon('user')} ${esc(iv.chef_agres ? `${iv.chef_agres.grade} ${iv.chef_agres.nom}` : '—')}</span>
        </div>
        <div class="msg-tabs">
          ${messages
            .map(
              (m) => `<button class="btn btn-sm ${m.type === activeType ? 'btn-navy' : ''}" data-type="${esc(m.type)}">${esc(m.libelle.replace('MESSAGE DE ', '').replace('DEMANDE DE ', ''))}</button>`,
            )
            .join('')}
        </div>
        <div class="msg-paper" id="antares-text">${esc(msg.texte)}</div>
        <div class="row" style="margin-top:12px;gap:7px;flex-wrap:wrap">
          <button class="btn btn-sm" data-copy>${icon('copy')} Copier</button>
          <button class="btn btn-sm" data-print>${icon('printer')} Imprimer</button>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-primary" data-transmit>${icon('send')} Transmettre au CODIS</button>
        </div>
        <div class="alert alert-info" style="margin-top:12px">${icon('shield-check')}<span>Message horodaté et archivé automatiquement. Toute transmission est tracée dans le journal d’audit.</span></div>
      </div>
    </div>`;

    previewEl.querySelectorAll('[data-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeType = btn.dataset.type;
        renderPreview(numero);
      });
    });
    previewEl.querySelector('[data-copy]').onclick = () => {
      navigator.clipboard?.writeText(msg.texte);
      toast('Message copié dans le presse-papiers.', 'success');
    };
    previewEl.querySelector('[data-print]').onclick = () => window.print();
    previewEl.querySelector('[data-transmit]').onclick = () => {
      state.lastTransmissions = state.lastTransmissions || [];
      state.lastTransmissions.unshift({
        heure: new Date().toLocaleTimeString('fr-FR'),
        indicatif: 'CODIS 06',
        type: msg.libelle,
        message: `${numero} — ${iv.nature} — ${iv.commune}`,
      });
      toast(`Message « ${msg.libelle} » transmis au CODIS 06.`, 'success', 'Transmission effectuée');
    };
  };

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn) select(btn.dataset.id);
  });

  container.querySelector('#an-q').addEventListener(
    'input',
    debounce(() => loadList(), 280),
  );

  state.refresh = () => loadList().catch(() => {});
  await loadList();
}
