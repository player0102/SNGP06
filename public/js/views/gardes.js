import { api } from '../api.js';
import { state } from '../state.js';
import {
  esc, icon, pageHead, badge, initials, emptyState, todayISO, addDaysISO, dateLongFromISO, fmtDateOnly,
} from '../util.js';

export async function render(container) {
  let date = todayISO();
  let mode = 'jour';

  container.innerHTML = `<div class="page">
    ${pageHead({
      title: 'Feuille de garde',
      subtitle: 'Composition des gardes et armement des centres de secours',
      iconName: 'calendar',
      breadcrumb: ['Personnel', 'Feuille de garde'],
      actions: `<button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        <button class="btn btn-sm" onclick="window.print()">${icon('printer')} Imprimer</button>`,
    })}

    <div class="toolbar">
      <div class="tabs" style="border:0;padding:0">
        <button class="tab active" data-mode="jour">${icon('calendar')} Garde du jour</button>
        <button class="tab" data-mode="semaine">${icon('chart')} Planning hebdomadaire</button>
      </div>
      <div class="spacer"></div>
      <div class="row" id="date-nav">
        <button class="btn btn-sm btn-icon" data-day="-1" title="Jour précédent">${icon('chevron-left')}</button>
        <input class="input" type="date" id="g-date" value="${date}" style="width:158px" />
        <button class="btn btn-sm btn-icon" data-day="1" title="Jour suivant">${icon('chevron-right')}</button>
        <button class="btn btn-sm" data-today>Aujourd’hui</button>
      </div>
    </div>

    <div id="g-content"></div>
  </div>`;

  const contentEl = container.querySelector('#g-content');
  const dateInput = container.querySelector('#g-date');

  const loadJour = async () => {
    const data = await api(`/api/gardes?date=${date}`);
    const f = data.feuille;
    contentEl.innerHTML = `
      <div class="grid grid-4" style="margin-bottom:14px">
        <div class="kpi red">
          <div class="kpi-top"><span class="kpi-label">Garde</span><span class="kpi-icon">${icon('shield')}</span></div>
          <div class="kpi-value">Garde ${esc(f.garde)}</div>
          <div class="kpi-foot">${esc(dateLongFromISO(f.date))}</div>
        </div>
        <div class="kpi blue">
          <div class="kpi-top"><span class="kpi-label">Effectif de garde</span><span class="kpi-icon">${icon('users')}</span></div>
          <div class="kpi-value">${f.total_personnels}<small>personnels</small></div>
          <div class="kpi-foot">répartis sur ${f.centres.filter((c) => c.effectif_count).length} centres</div>
        </div>
        <div class="kpi green">
          <div class="kpi-top"><span class="kpi-label">Engins armés</span><span class="kpi-icon">${icon('truck')}</span></div>
          <div class="kpi-value">${f.total_engins}<small>engins</small></div>
          <div class="kpi-foot">prêts à partir</div>
        </div>
        <div class="kpi amber">
          <div class="kpi-top"><span class="kpi-label">Horaires</span><span class="kpi-icon">${icon('clock')}</span></div>
          <div class="kpi-value" style="font-size:16px">${esc(f.horaires.jour)}</div>
          <div class="kpi-foot">nuit ${esc(f.horaires.nuit)}</div>
        </div>
      </div>

      <div class="garde-grid">
        ${f.centres
          .map(
            (c) => `<div class="garde-card">
              <div class="garde-card-head">
                <span class="garde-letter">${esc(f.garde)}</span>
                <div><strong>${esc(c.nom)}</strong><span>${esc(c.commune)} — 06</span></div>
                <span class="spacer"></span>
                <span class="badge badge-mono">${c.effectif_count} pers.</span>
              </div>
              <div class="garde-body">
                <div class="row" style="gap:7px">
                  <span class="avatar-sm">${c.chef ? esc(initials(c.chef.prenom, c.chef.nom)) : '—'}</span>
                  <div><div style="font-size:11.8px;font-weight:600">${c.chef ? `${esc(c.chef.grade)} ${esc(c.chef.prenom)} ${esc(c.chef.nom)}` : 'Chef de garde non désigné'}</div>
                  <div class="cell-sub">Chef de garde</div></div>
                </div>
                <div class="garde-effectif">
                  ${c.effectif.slice(0, 8).map((p) => `<div class="row">
                    <span class="dot-statut" style="width:6px;height:6px;border-radius:50%;background:${p.statut === 'Disponible' ? 'var(--green-600)' : p.statut === 'En intervention' ? 'var(--red-600)' : 'var(--muted-500)'}"></span>
                    <span>${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}</span>
                    <span class="mat">${esc(p.matricule)}</span>
                  </div>`).join('')}
                  ${c.effectif.length > 8 ? `<div class="cell-sub">+ ${c.effectif.length - 8} autre(s) personnel(s)</div>` : ''}
                  ${!c.effectif.length ? '<span class="cell-sub">Aucun personnel affecté à cette garde.</span>' : ''}
                </div>
                <div class="garde-engins">
                  ${c.engins.map((e) => `<span class="chip">${icon('truck')} ${esc(e.indicatif)}</span>`).join('')}
                  ${!c.engins.length ? '<span class="cell-sub">Aucun engin affecté</span>' : ''}
                </div>
              </div>
              <div class="garde-foot">
                <span>${icon('clock')} ${esc(f.horaires.jour)}</span><span class="spacer"></span>
                <span>${c.engins_count} engins</span>
              </div>
            </div>`,
          )
          .join('')}
      </div>`;
  };

  const loadSemaine = async () => {
    const data = await api('/api/gardes/semaine');
    contentEl.innerHTML = `<div class="card">
      <div class="card-head">${icon('calendar')}<h3>Planning des gardes — 7 jours</h3>
        <div class="card-head-actions"><span class="badge badge-outline">Rotation A / B / C / D</span></div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Date</th><th>Garde</th>${state.refs.cis.map((c) => `<th class="text-right">${esc(c.commune)}</th>`).join('')}<th class="text-right">Total</th></tr></thead>
        <tbody>
          ${data.jours
            .map(
              (j) => `<tr${j.date === todayISO() ? ' style="background:#f4f9ff"' : ''}>
                <td class="cell-strong nowrap">${esc(dateLongFromISO(j.date))}${j.date === todayISO() ? ' <span class="badge badge-info">Aujourd’hui</span>' : ''}</td>
                <td><span class="badge badge-outline no-dot">Garde ${esc(j.garde)}</span></td>
                ${state.refs.cis
                  .map((c) => {
                    const centre = j.centres.find((x) => x.cis === c.code);
                    return `<td class="text-right">${centre?.effectif ?? 0} <span class="muted small">pers.</span><div class="cell-sub">${centre?.engins ?? 0} engins</div></td>`;
                  })
                  .join('')}
                <td class="text-right cell-strong">${j.effectif}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>
      <div class="card-foot">${icon('clock')} Les gardes de 12 h débutent à 07:30 et 19:30. La rotation est assurée par le CTA-CODIS.</div>
    </div>`;
  };

  const load = async () => {
    if (mode === 'jour') await loadJour();
    else await loadSemaine();
  };

  state.refresh = () => load().catch(() => {});

  container.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      container.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      container.querySelector('#date-nav').style.display = mode === 'jour' ? '' : 'none';
      load();
    });
  });

  dateInput.addEventListener('change', () => {
    date = dateInput.value || todayISO();
    load();
  });
  container.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      date = addDaysISO(date, Number(btn.dataset.day));
      dateInput.value = date;
      load();
    });
  });
  container.querySelector('[data-today]').addEventListener('click', () => {
    date = todayISO();
    dateInput.value = date;
    load();
  });

  await load();
}
