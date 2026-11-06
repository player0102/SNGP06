import { api } from '../api.js';
import { state } from '../state.js';
import { esc, icon, pageHead, fmtDateOnly, emptyState, debounce } from '../util.js';

export async function render(container, param) {
  let selected = param || null;
  let categories = [];

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Consignes opérationnelles',
      subtitle: 'Procédures, consignes de sécurité et notes de service du SDIS 06',
      iconName: 'book',
      breadcrumb: ['Documentation', 'Consignes opérationnelles'],
      actions: `<button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        <button class="btn btn-sm" onclick="window.print()">${icon('printer')} Imprimer</button>`,
    })}
    <div class="grid grid-1-2">
      <div class="stack">
        <div class="filter-col">
          <div class="search-field" style="max-width:none">${icon('search')}
            <input class="input" id="c-q" placeholder="Rechercher une consigne…" /></div>
          <select class="select" id="c-cat"><option value="">Toutes les catégories</option></select>
        </div>
        <div class="card">
          <div class="card-head">${icon('book')}<h3>Consignes diffusées</h3>
            <div class="card-head-actions"><span class="badge badge-mono" id="c-count"></span></div>
          </div>
          <div id="c-list" style="max-height:640px;overflow:auto"></div>
        </div>
      </div>
      <div id="c-reader"></div>
    </div>
  </div>`;

  const listEl = container.querySelector('#c-list');
  const readerEl = container.querySelector('#c-reader');
  const catEl = container.querySelector('#c-cat');
  let all = [];

  const loadList = async () => {
    const q = container.querySelector('#c-q').value.trim();
    const cat = catEl.value;
    const data = await api(`/api/consignes?q=${encodeURIComponent(q)}&categorie=${encodeURIComponent(cat)}`);
    all = data.items;
    if (!categories.length) {
      categories = data.categories;
      catEl.innerHTML = `<option value="">Toutes les catégories</option>${categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}`;
      catEl.value = cat;
    }
    container.querySelector('#c-count').textContent = `${data.items.length} document(s)`;

    listEl.innerHTML = all.length
      ? all
          .map(
            (c) => `<button class="list-row" data-id="${esc(c.id)}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line-100);cursor:pointer;text-align:left;${c.id === selected ? 'background:#eef5fc' : ''}">
              <span class="avatar-sm" style="border-radius:5px">${icon('file')}</span>
              <span class="grow"><span class="title">${esc(c.titre)}</span>
              <span class="sub">${esc(c.reference)} · ${esc(c.categorie)} · ${esc(fmtDateOnly(c.date))}</span></span>
              ${icon('chevron-right')}
            </button>`,
          )
          .join('')
      : emptyState('book', 'Aucune consigne');

    if (!selected && all.length) selected = all[0].id;
    if (selected) loadReader(selected);
  };

  const loadReader = async (id) => {
    try {
      const data = await api(`/api/consignes/${encodeURIComponent(id)}`);
      const c = data.consigne;
      readerEl.innerHTML = `<div class="card">
        <div class="card-head">
          ${icon('file')}<h3>${esc(c.titre)}</h3>
          <div class="card-head-actions"><span class="badge badge-outline">${esc(c.categorie)}</span></div>
        </div>
        <div class="card-body">
          <div class="row row-wrap" style="gap:8px;margin-bottom:14px">
            <span class="chip">${icon('file')} ${esc(c.reference)}</span>
            <span class="chip">${icon('calendar')} ${esc(fmtDateOnly(c.date))}</span>
            <span class="chip">${icon('users')} ${esc(c.diffusion)}</span>
            <span class="chip">${icon('user')} ${esc(c.auteur_detail || c.auteur)}</span>
          </div>
          <div class="doc-reader doc-body">${esc(c.contenu)}</div>
          <div class="divider"></div>
          <div class="row" style="gap:8px">
            <span class="small muted">Document interne SDIS 06 — diffusion ${esc(c.diffusion.toLowerCase())}.</span>
            <span class="spacer"></span>
            <button class="btn btn-sm" onclick="window.print()">${icon('printer')} Imprimer</button>
          </div>
        </div>
      </div>`;
    } catch (err) {
      readerEl.innerHTML = `<div class="card"><div class="card-body"><div class="alert alert-error">${icon('alert')}<span>${esc(err.message)}</span></div></div></div>`;
    }
  };

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    selected = btn.dataset.id;
    listEl.querySelectorAll('[data-id]').forEach((el) => {
      el.style.background = el === btn ? '#eef5fc' : 'none';
    });
    loadReader(selected);
  });

  container.querySelector('#c-q').addEventListener(
    'input',
    debounce(() => loadList(), 260),
  );
  catEl.addEventListener('change', () => loadList());

  state.refresh = () => loadList().catch(() => {});
  await loadList();
}
