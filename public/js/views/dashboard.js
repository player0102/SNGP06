import { api } from '../api.js';
import { state, can } from '../state.js';
import {
  esc, icon, pageHead, badge, prioriteBadge, fmtTime, elapsed, mapSvg, mapLegend,
  activityBars, emptyState, fmtLongDate, todayISO,
} from '../util.js';

export async function render(container) {
  const load = async () => {
    const d = await api('/api/dashboard');
    state.stats = d.stats;
    container.innerHTML = markup(d);
    wire(container);
  };
  state.refresh = () => load().catch(() => {});
  await load();
}

function kpi({ label, value, unit = '', foot = '', tone = '', iconName = 'grid', bar = null }) {
  return `<div class="kpi ${tone}">
    <div class="kpi-top">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-icon">${icon(iconName)}</span>
    </div>
    <div class="kpi-value">${value}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
    <div class="kpi-foot">${foot}</div>
    ${bar !== null ? `<div class="kpi-bar"><span style="width:${bar}%;${bar < 40 ? 'background:var(--red-600)' : bar < 70 ? 'background:#e07b00' : ''}"></span></div>` : ''}
  </div>`;
}

function markup(d) {
  const s = d.stats;
  const actives = d.interventions || [];
  const interventionsHtml = actives.length
    ? actives.map((iv) => interventionRow(iv)).join('')
    : emptyState('check', 'Aucune intervention en cours', 'Le département est calme — aucun moyen engagé actuellement.');

  const journal = (d.derniers_evenements || [])
    .slice(0, 9)
    .map(
      (e) => `<div class="list-row">
        <span class="avatar-sm" style="border-radius:5px">${icon('dot')}</span>
        <div class="grow"><div class="title">${esc(e.action)}</div><div class="sub">${esc(e.detail)}</div></div>
        <span class="cell-num" style="font-size:10.2px;color:var(--muted-500)">${esc(fmtTime(e.ts))}</span>
      </div>`,
    )
    .join('');

  const garde = d.garde || {};
  const dispoPers = s.taux_disponibilite_personnel ?? 0;
  const dispoEngins = s.taux_disponibilite_engins ?? 0;

  return `<div class="page">
    ${pageHead({
      title: 'Tableau de bord opérationnel',
      subtitle: `${fmtLongDate()} · CTA-CODIS Nice — situation départementale en temps réel`,
      iconName: 'grid',
      breadcrumb: ['Opérations', 'Tableau de bord'],
      actions: `
        <span class="badge badge-info">${icon('clock')} ${esc(new Date().toLocaleDateString('fr-FR'))}</span>
        <span class="badge badge-outline">Garde ${esc(s.garde || '—')}</span>
        <button class="btn btn-sm" data-act="refresh">${icon('refresh')} Actualiser</button>
        ${can('interventions.write') ? `<button class="btn btn-sm btn-primary" data-act="nouvelle-alerte">${icon('flame')} Nouvelle alerte</button>` : ''}`,
    })}

    <div class="grid grid-5">
      ${kpi({
        label: 'Interventions en cours',
        value: s.interventions_en_cours,
        tone: 'red',
        iconName: 'flame',
        foot: `<span class="down">${s.engins_engages} engins engagés</span>`,
      })}
      ${kpi({
        label: 'Personnels engagés',
        value: s.personnels_engages,
        tone: 'blue',
        iconName: 'users',
        foot: `sur ${s.personnels_total} personnels du département`,
      })}
      ${kpi({
        label: 'Disponibilité personnel',
        value: dispoPers,
        unit: '%',
        tone: 'green',
        iconName: 'shield-check',
        foot: `${s.personnels_disponibles} disponibles`,
        bar: dispoPers,
      })}
      ${kpi({
        label: 'Engins disponibles',
        value: s.engins_disponibles,
        unit: `/ ${s.engins_total}`,
        tone: 'amber',
        iconName: 'truck',
        foot: `${s.engins_total - s.engins_disponibles} indisponibles ou engagés`,
        bar: dispoEngins,
      })}
      ${kpi({
        label: 'Garde en cours',
        value: `Garde ${garde.jour || '—'}`,
        tone: '',
        iconName: 'calendar',
        foot: `${garde.effectif || 0} personnels · ${garde.engins || 0} engins armés`,
      })}
    </div>

    <div class="grid grid-2-1">
      <div class="card">
        <div class="card-head">
          ${icon('map')}
          <h3>Synoptique opérationnel — Alpes-Maritimes</h3>
          <div class="card-head-actions">
            <span class="badge badge-encours">${actives.length} intervention${actives.length > 1 ? 's' : ''}</span>
            <a class="btn btn-sm btn-ghost" href="#/interventions">Ouvrir ${icon('arrow-right')}</a>
          </div>
        </div>
        <div class="map-wrap">
          <div class="map-counter">${icon('radio')} Situation ${fmtTime(new Date())}</div>
          <div class="map-tools">
            <button class="map-tool" data-act="refresh" title="Actualiser">${icon('refresh')}</button>
            <a class="map-tool" href="#/engins" title="Synoptique des engins">${icon('truck')}</a>
          </div>
          ${mapSvg(actives)}
          ${mapLegend()}
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('calendar')}<h3>Garde du jour</h3>
            <div class="card-head-actions"><span class="badge badge-info">Garde ${esc(garde.jour || '—')}</span></div>
          </div>
          <div class="card-body">
            <div class="stat-inline">
              <div><b>${garde.effectif || 0}</b><span>Personnels</span></div>
              <div><b>${garde.engins || 0}</b><span>Engins armés</span></div>
              <div><b>${s.interventions_en_cours}</b><span>En cours</span></div>
            </div>
            <div class="divider"></div>
            <dl class="kv" style="grid-template-columns:110px 1fr">
              <dt>Garde de jour</dt><dd>${esc(garde.horaires?.jour || '07:30 — 19:30')}</dd>
              <dt>Garde de nuit</dt><dd>${esc(garde.horaires?.nuit || '19:30 — 07:30')}</dd>
              <dt>Centres armés</dt><dd>8 centres de secours</dd>
              <dt>Officier de permanence</dt><dd>Lt FONTAINE Élodie</dd>
            </dl>
            <a class="btn btn-sm btn-block" style="margin-top:12px" href="#/gardes">${icon('calendar')} Consulter la feuille de garde</a>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${icon('chart')}<h3>Activité opérationnelle — 24 h</h3>
            <div class="card-head-actions"><span class="count small muted">${s.par_famille ? Object.entries(s.par_famille).map(([k, v]) => `${k} ${v}`).join(' · ') : ''}</span></div>
          </div>
          <div class="card-body">
            ${activityBars(d.activite)}
            <div class="divider"></div>
            <div class="row" style="justify-content:space-between">
              <span class="small muted">Total dossiers SIN</span>
              <strong style="font-size:15px">${s.total_interventions}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-3-2">
      <div class="card">
        <div class="card-head">
          ${icon('radio')}<h3>Interventions en cours</h3>
          <div class="card-head-actions">
            <a class="btn btn-sm btn-ghost" href="#/interventions">Tout afficher ${icon('arrow-right')}</a>
          </div>
        </div>
        <div class="iv-list">${interventionsHtml}</div>
        <div class="card-foot">${icon('clock')} Données actualisées automatiquement à chaque événement opérationnel.</div>
      </div>

      <div class="card">
        <div class="card-head">${icon('history')}<h3>Journal des opérations</h3>
          <div class="card-head-actions"><span class="badge badge-mono">${esc(todayISO().split('-').reverse().join('/'))}</span></div>
        </div>
        <div class="list-clean">${journal || emptyState('file', 'Aucun événement')}</div>
        ${state.user.role === 'admin' ? `<div class="card-foot"><a href="#/administration">${icon('settings')} Journal complet et audit des accès</a></div>` : ''}
      </div>
    </div>
  </div>`;
}

function interventionRow(iv) {
  const etape = iv.etape ?? 0;
  const pct = Math.min(100, Math.round((etape / 5) * 100));
  const prio = (iv.priorite || 'P3').toLowerCase();
  return `<div class="iv-item" data-go="#/intervention/${esc(iv.id)}">
    <span class="iv-prio ${prio}"></span>
    <div class="iv-main">
      <div class="iv-line1">
        <span class="iv-nature">${esc(iv.nature)}</span>
        ${prioriteBadge(iv.priorite)}
        <span class="iv-num">${esc(iv.numero)}</span>
      </div>
      <div class="iv-line2">${icon('pin')} ${esc(iv.adresse)}, <strong>${esc(iv.commune)}</strong></div>
      <div class="iv-moyens">
        ${iv.engins.map((e) => `<span class="chip">${icon('truck')} ${esc(e.indicatif)}</span>`).join('')}
      </div>
    </div>
    <div class="iv-side">
      <span class="iv-timer ${prio}">${elapsed(iv.cree_le)}</span>
      ${badge(iv.statut_label)}
      <div class="iv-progress ${prio}">
        <div class="progress-line"><span style="width:${pct}%"></span></div>
        <small>${esc(iv.statut_label)}</small>
      </div>
    </div>
  </div>`;
}

function wire(container) {
  container.addEventListener('click', (e) => {
    const iv = e.target.closest('[data-go]');
    if (iv) {
      location.hash = iv.dataset.go;
      return;
    }
    const marker = e.target.closest('[data-iv]');
    if (marker) location.hash = `#/intervention/${marker.dataset.iv}`;
  });
}
