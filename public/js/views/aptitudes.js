import { api } from '../api.js';
import { state } from '../state.js';
import { esc, icon, pageHead, emptyState, fmtDateOnly, debounce } from '../util.js';

export async function render(container) {
  let data = null;
  let filters = { q: '', cis: '' };

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Aptitudes des personnels',
      subtitle: 'Matrice des qualifications opérationnelles et suivi des validités',
      iconName: 'award',
      breadcrumb: ['Personnel', 'Aptitudes des personnels'],
      actions: `<button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        <button class="btn btn-sm" onclick="window.print()">${icon('printer')} Imprimer</button>`,
    })}
    <div class="grid grid-4" id="a-stats"></div>
    <div class="toolbar">
      <div class="search-field">${icon('search')}
        <input class="input" id="a-q" placeholder="Nom ou matricule…" /></div>
      <div class="toolbar-group"><span class="toolbar-label">Centre</span>
      <select class="select" id="a-cis">
        <option value="">Tout le département</option>
        ${state.refs.cis.map((c) => `<option value="${esc(c.code)}">${esc(c.nom)}</option>`).join('')}
      </select></div>
      <div class="spacer"></div>
      <span class="small muted" id="a-legend">✓ valide · ⚠ expire sous 90 jours</span>
    </div>
    <div class="grid grid-2-1">
      <div class="card">
        <div class="card-head">${icon('award')}<h3>Matrice des aptitudes</h3>
          <div class="card-head-actions"><span class="badge badge-mono" id="a-count"></span></div>
        </div>
        <div id="a-matrix"></div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('alert')}<h3>Validités à surveiller</h3></div>
          <div id="a-expirations" style="max-height:430px;overflow:auto"></div>
        </div>
        <div class="card">
          <div class="card-head">${icon('chart')}<h3>Effectifs par aptitude</h3></div>
          <div class="card-body" id="a-parcode"></div>
        </div>
      </div>
    </div>
  </div>`;

  const matrixEl = container.querySelector('#a-matrix');
  const expEl = container.querySelector('#a-expirations');
  const statsEl = container.querySelector('#a-stats');
  const parCodeEl = container.querySelector('#a-parcode');
  const countEl = container.querySelector('#a-count');

  const load = async () => {
    data = await api('/api/aptitudes');
    const codes = data.referentiel.map((a) => a.code);
    const expireSoon = data.expirations.filter((e) => !e.expire).length;
    const expirees = data.expirations.filter((e) => e.expire).length;

    statsEl.innerHTML = [
      { label: 'Aptitudes référencées', value: codes.length, tone: '', icon: 'award', foot: 'qualifications SDIS 06' },
      { label: 'Validités < 90 jours', value: expireSoon, tone: 'amber', icon: 'clock', foot: 'recyclages à planifier' },
      { label: 'Qualifications expirées', value: expirees, tone: 'red', icon: 'alert', foot: 'personnels à retirer des départs' },
      { label: 'Personnels qualifiés', value: new Set(data.personnels.flatMap((p) => p.aptitudes.map((a) => p.matricule))).size, tone: 'green', icon: 'users', foot: 'au moins une aptitude' },
    ]
      .map(
        (c) => `<div class="kpi ${c.tone}">
          <div class="kpi-top"><span class="kpi-label">${esc(c.label)}</span><span class="kpi-icon">${icon(c.icon)}</span></div>
          <div class="kpi-value">${c.value}</div>
          <div class="kpi-foot">${esc(c.foot)}</div>
        </div>`,
      )
      .join('');

    const personnels = data.personnels.filter((p) => {
      if (filters.cis && p.cis !== filters.cis) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        if (!`${p.nom} ${p.prenom} ${p.matricule}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    countEl.textContent = `${personnels.length} personnel(s)`;

    matrixEl.innerHTML = personnels.length
      ? `<div class="matrix-wrap"><table class="matrix">
          <thead><tr><th style="min-width:210px">Personnel</th>${codes.map((c) => `<th title="${esc(data.referentiel.find((r) => r.code === c).libelle)}">${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${personnels
              .map((p) => {
                const map = new Map(p.aptitudes.map((a) => [a.code, a]));
                return `<tr>
                  <th title="${esc(p.matricule)}">${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}<br><span style="font-weight:400;font-size:9.5px;color:var(--muted-500)">${esc(p.cis)} · ${esc(p.matricule)}</span></th>
                  ${codes
                    .map((c) => {
                      const a = map.get(c);
                      if (!a) return '<td class="no">·</td>';
                      return `<td class="${a.expire ? 'expire' : 'ok'}" title="Validité ${esc(fmtDateOnly(a.validite))}">${a.expire ? '⚠' : '✓'}</td>`;
                    })
                    .join('')}
                </tr>`;
              })
              .join('')}
          </tbody></table></div>`
      : emptyState('award', 'Aucun personnel');

    expEl.innerHTML = data.expirations.length
      ? `<div class="list-clean">${data.expirations
          .map(
            (e) => `<div class="list-row">
              <span class="badge ${e.expire ? 'badge-engage' : 'badge-conge'}">${esc(e.code)}</span>
              <div class="grow"><div class="title">${esc(e.grade)} ${esc(e.nom)} ${esc(e.prenom)}</div>
              <div class="sub">${esc(e.libelle)} — validité ${esc(fmtDateOnly(e.validite))}</div></div>
              <span class="cell-sub">${esc(e.cis)}</span>
            </div>`,
          )
          .join('')}</div>`
      : emptyState('check', 'Aucune échéance', 'Toutes les qualifications sont à jour.');

    const max = Math.max(1, ...Object.values(data.stats));
    parCodeEl.innerHTML = data.referentiel
      .map(
        (r) => `<div class="row" style="gap:8px;margin-bottom:6px">
          <span class="badge badge-mono" style="width:52px;justify-content:center">${esc(r.code)}</span>
          <div style="flex:1"><div class="progress-line"><span style="width:${Math.round(((data.stats[r.code] || 0) / max) * 100)}%;background:var(--blue-500)"></span></div></div>
          <span class="cell-sub" style="width:22px;text-align:right">${data.stats[r.code] || 0}</span>
        </div>`,
      )
      .join('');
  };

  state.refresh = () => load().catch(() => {});

  container.querySelector('#a-q').addEventListener(
    'input',
    debounce((e) => {
      filters.q = e.target.value.trim();
      load();
    }, 250),
  );
  container.querySelector('#a-cis').addEventListener('change', (e) => {
    filters.cis = e.target.value;
    load();
  });

  await load();
}
