import { api } from '../api.js';
import { state } from '../state.js';
import {
  esc, icon, pageHead, badge, prioriteBadge, fmtTime, initials, emptyState, todayISO,
} from '../util.js';

export async function render(container) {
  const load = async () => {
    const [gardes, interventions] = await Promise.all([
      api(`/api/gardes?date=${todayISO()}`),
      api('/api/interventions'),
    ]);
    const u = state.user;
    const garde = gardes.feuille;
    const monCentre = garde.centres.find((c) => c.cis === u.cis);
    const mesInterventions = interventions.items.filter(
      (iv) => iv.engins.some((e) => (e.equipage || []).includes(u.matricule)),
    );
    container.innerHTML = markup({ garde, monCentre, mesInterventions, all: interventions.items, u });
    state.refresh = () => load().catch(() => {});
  };
  state.refresh = () => load().catch(() => {});
  await load();
}

function markup({ garde, monCentre, mesInterventions, all, u }) {
  const now = new Date();
  const hhmm = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return `<div class="page">
    ${pageHead({
      title: 'NEOSIS Web/Mobile (Sapeurs-Pompiers)',
      subtitle: 'Terminal embarqué — consultation opérationnelle et bilan en mobilité',
      iconName: 'mobile',
      breadcrumb: ['Terminal', 'NEOSIS Web/Mobile'],
      actions: `<span class="badge badge-disponible">${icon('check')} Terminal synchronisé</span>
        <button class="btn btn-sm" data-act="refresh">${icon('refresh')} Synchroniser</button>`,
    })}

    <div class="grid grid-1-2">
      <div class="card">
        <div class="card-head">${icon('mobile')}<h3>Aperçu du terminal</h3>
          <div class="card-head-actions"><span class="badge badge-outline">Mode paysage</span></div>
        </div>
        <div class="mobile-stage">
          <div class="phone">
            <div class="phone-screen">
              <div class="phone-statusbar">
                <span>SDIS 06 · 4G</span>
                <span>${esc(hhmm)}</span>
              </div>
              <div class="phone-head">
                <div class="row">
                  <span class="avatar" style="width:26px;height:26px;font-size:10px">${esc(initials(u.prenom, u.nom))}</span>
                  <div><strong>NEOSIS Mobile</strong><small>${esc(u.grade)} ${esc(u.prenom)} ${esc(u.nom)}</small></div>
                  <span class="spacer"></span>
                  <span class="phone-badge">Garde ${esc(garde.garde)}</span>
                </div>
              </div>
              <div class="phone-body">
                <div class="phone-card">
                  <div class="row" style="justify-content:space-between">
                    <h4>Mon centre — ${esc(u.cis)}</h4>
                    ${icon('building')}
                  </div>
                  <p>${monCentre ? `${monCentre.effectif_count} personnels de garde · ${monCentre.engins_count} engins armés` : 'Centre non armé sur cette garde.'}</p>
                </div>

                <div class="phone-card">
                  <div class="row" style="justify-content:space-between">
                    <h4>Mes engagements</h4>
                    <span class="phone-badge hot">${mesInterventions.length}</span>
                  </div>
                  ${mesInterventions.length
                    ? mesInterventions
                        .map(
                          (iv) => `<div style="border-top:1px solid var(--line-100);padding-top:6px;margin-top:6px">
                            <div class="row" style="gap:5px">${prioriteBadge(iv.priorite)}<strong style="font-size:11px">${esc(iv.nature)}</strong></div>
                            <p>${esc(iv.commune)} · ${esc(iv.statut_label)} · ${esc(fmtTime(iv.cree_le))}</p>
                          </div>`,
                        )
                        .join('')
                    : '<p>Aucun engagement en cours.</p>'}
                </div>

                <div class="phone-card">
                  <div class="row" style="justify-content:space-between"><h4>Interventions du département</h4><span class="phone-badge">${all.length}</span></div>
                  ${all
                    .slice(0, 4)
                    .map(
                      (iv) => `<div class="row" style="gap:6px;border-top:1px solid var(--line-100);padding-top:6px;margin-top:6px">
                        <span style="font-size:10px;font-weight:700;color:${iv.priorite === 'P1' ? 'var(--red-600)' : 'var(--muted-600)'}">${esc(iv.priorite)}</span>
                        <span style="font-size:10.5px;flex:1">${esc(iv.nature)}</span>
                        <span style="font-size:9.5px;color:var(--muted-500)">${esc(iv.commune)}</span>
                      </div>`,
                    )
                    .join('')}
                </div>

                <div class="phone-card">
                  <h4>Message de situation</h4>
                  <p>Rédiger un message ANTARES ou un bilan depuis le terrain.</p>
                  <div class="row" style="gap:6px;margin-top:6px">
                    <span class="chip">${icon('send')} ANTARES</span>
                    <span class="chip">${icon('clipboard')} CRSS</span>
                  </div>
                </div>
              </div>
              <div class="phone-tabbar">
                <button class="phone-tab active">${icon('flame')}<span>Opérations</span></button>
                <button class="phone-tab">${icon('truck')}<span>Engins</span></button>
                <button class="phone-tab">${icon('clipboard')}<span>Bilan</span></button>
                <button class="phone-tab">${icon('radio')}<span>Radio</span></button>
              </div>
            </div>
          </div>
        </div>
        <div class="card-foot">${icon('check')} Dernière synchronisation : ${esc(hhmm)} · données ANTARES chiffrées.</div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('mobile')}<h3>Fonctionnalités du terminal</h3></div>
          <div class="card-body">
            <div class="stack" style="gap:11px">
              ${[
                ['radio', 'Réception des alertes en temps réel', 'Affectation automatique des engins et des missions.'],
                ['clipboard', 'Bilan et CRSS en mobilité', 'Saisie du bilan sur le terrain, transmission au CODIS.'],
                ['send', 'Messagerie ANTARES', 'Messages de départ, de situation, de renfort et de clôture.'],
                ['map', 'Géolocalisation des moyens', 'Position des engins et accès aux points d’eau.'],
                ['shield-check', 'Authentification nominative', 'Accès par matricule, session sécurisée et journalisée.'],
              ]
                .map(
                  ([ic, titre, desc]) => `<div class="row" style="gap:10px;align-items:flex-start">
                    <span class="avatar-sm" style="border-radius:6px">${icon(ic)}</span>
                    <div><div style="font-size:12.3px;font-weight:600">${esc(titre)}</div>
                    <div class="cell-sub">${esc(desc)}</div></div>
                  </div>`,
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${icon('truck')}<h3>Engins de mon centre</h3></div>
          <div class="list-clean">
            ${monCentre?.engins?.length
              ? monCentre.engins.map((e) => `<div class="list-row">${icon('truck')}
                  <span class="grow"><span class="title">${esc(e.indicatif)}</span><span class="sub">${esc(e.type)}</span></span>
                  ${badge(e.statut)}</div>`).join('')
              : `<div class="empty">${icon('truck')}<strong>Aucun engin</strong></div>`}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
