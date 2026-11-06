import { api } from '../api.js';
import { state, can } from '../state.js';
import {
  esc, icon, pageHead, badge, prioriteBadge, fmtDate, fmtTime, fmtTimeS, elapsed, duree,
  openModal, toast, emptyState,
} from '../util.js';

export async function render(container, id) {
  let current = null;

  const load = async () => {
    const data = await api(`/api/interventions/${encodeURIComponent(id)}`);
    current = data;
    container.innerHTML = markup(data, container);
    wire(container, data, load);
  };

  state.refresh = () => load().catch(() => {});
  await load();
}

function markup({ intervention: iv, antares }, container) {
  const etape = iv.etape ?? 0;
  const steps = ['Alerte', 'Départ', 'Sur les lieux', 'En action', 'Retour', 'Clôturée'];
  const closed = iv.statut === 'Clôturée';
  const canWrite = can('interventions.write');

  const horaires = [
    ['Alerte', iv.alerte_le],
    ['Départ', iv.depart_le],
    ['Arrivée sur les lieux', iv.arrivee_le],
    ['Clôture', iv.cloture_le],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(fmtDate(v))} <span class="muted small">(${esc(fmtTimeS(v))})</span></dd>`)
    .join('');

  const engins = iv.engins
    .map(
      (e) => `<div class="engin-card ${e.equipage_detail.length ? 'is-engage' : ''}" style="padding:10px 12px">
        <div class="engin-top">
          <div>
            <div class="engin-name">${esc(e.indicatif)}</div>
            <div class="engin-type">${esc(e.role)} · ${esc(e.cis)}</div>
          </div>
          <span class="spacer"></span>
          <span class="badge badge-engage">${esc(e.type)}</span>
        </div>
        ${e.chef ? `<div class="small muted">Chef d’agrès : <strong style="color:var(--ink-700)">${esc(e.chef.grade)} ${esc(e.chef.prenom)} ${esc(e.chef.nom)}</strong></div>` : ''}
        <div class="engin-crew">
          ${e.equipage_detail.length
            ? e.equipage_detail
                .map(
                  (p, idx) => `<div class="row"><span class="avatar-sm" style="width:20px;height:20px;font-size:8.5px">${esc(p.prenom[0] || '')}${esc(p.nom[0] || '')}</span>
                    <span>${esc(p.grade)} ${esc(p.nom)} ${esc(p.prenom)}</span>
                    <span class="mat mono" style="margin-left:auto;color:var(--muted-500);font-size:10px">${esc(p.matricule)}</span>
                    ${idx === 0 ? '<span class="role">Chef d’agrès</span>' : ''}</div>`,
                )
                .join('')
            : '<span class="small muted">Équipage en cours de constitution.</span>'}
        </div>
      </div>`,
    )
    .join('');

  const timeline = [...(iv.evenements || [])]
    .reverse()
    .map(
      (e) => `<div class="timeline-item">
        <div class="timeline-time">${esc(fmtDate(e.ts))}</div>
        <div class="timeline-text">${esc(e.texte)}</div>
      </div>`,
    )
    .join('');

  const lastAntares = antares[antares.length - 1];

  return `<div class="page">
    ${pageHead({
      title: `${iv.nature} — ${iv.commune}`,
      subtitle: `Dossier SIN ${esc(iv.numero)} · ouvert le ${esc(fmtDate(iv.cree_le))} · source ${esc(iv.source)}`,
      iconName: 'flame',
      breadcrumb: ['Opérations', 'Synoptique des interventions', iv.numero],
      actions: `
        <a class="btn btn-sm" href="#/interventions">${icon('chevron-left')} Retour</a>
        <button class="btn btn-sm" data-print>${icon('printer')} Imprimer</button>
        ${!closed && canWrite ? `
          <button class="btn btn-sm" data-renfort>${icon('plus')} Renfort</button>
          <button class="btn btn-sm btn-navy" data-etape>${icon('arrow-right')} Étape suivante</button>
          <button class="btn btn-sm btn-primary" data-cloturer>${icon('check')} Clôturer</button>` : ''}
        ${closed && canWrite ? `<button class="btn btn-sm btn-primary" data-crss>${icon('clipboard')} Établir le CRSS</button>` : ''}`,
    })}

    <div class="grid grid-2-1">
      <div class="stack">
        <div class="card">
          <div class="card-head">
            ${icon('pin')}<h3>Situation opérationnelle</h3>
            <div class="card-head-actions">
              ${prioriteBadge(iv.priorite)}
              ${badge(iv.statut_label)}
            </div>
          </div>
          <div class="card-body">
            <div class="grid grid-2" style="gap:16px">
              <dl class="kv">
                <dt>Nature du sinistre</dt><dd>${esc(iv.nature)}</dd>
                <dt>Famille</dt><dd>${esc(state.refs.familles[iv.famille] || iv.famille)}</dd>
                <dt>Adresse</dt><dd>${esc(iv.adresse)}</dd>
                <dt>Commune</dt><dd>${esc(iv.commune)} (06)</dd>
                <dt>Source de l’alerte</dt><dd>${esc(iv.source)}</dd>
                <dt>Chef de dispositif</dt>
                <dd>${iv.chef_agres ? `${esc(iv.chef_agres.grade)} ${esc(iv.chef_agres.prenom)} ${esc(iv.chef_agres.nom)}` : '—'}</dd>
              </dl>
              <dl class="kv" style="grid-template-columns:130px 1fr">
                ${horaires}
                <dt>Durée</dt><dd>${esc(duree(iv.cree_le, iv.cloture_le || null))}</dd>
                <dt>Victimes</dt><dd>${iv.victimes == null ? '<span class="muted">Bilan en cours</span>' : `${iv.victimes} personne(s)`}</dd>
              </dl>
            </div>
            <div class="divider"></div>
            <div>
              <div class="field-label" style="margin-bottom:5px">Bilan / compte rendu du chef de dispositif</div>
              <p class="small" style="color:${iv.bilan ? 'var(--ink-700)' : 'var(--muted-500)'};line-height:1.65">
                ${iv.bilan ? esc(iv.bilan) : 'Aucun bilan transmis pour le moment.'}
              </p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${icon('truck')}<h3>Moyens engagés</h3>
            <div class="card-head-actions"><span class="badge badge-mono">${iv.engins.length} engin(s)</span></div>
          </div>
          <div class="card-body">
            ${iv.engins.length ? `<div class="grid grid-2" style="gap:10px">${engins}</div>` : emptyState('truck', 'Aucun engin engagé')}
          </div>
        </div>

        <div class="card">
          <div class="card-head">${icon('clock')}<h3>Chronologie de l’intervention</h3></div>
          <div class="card-body">
            ${timeline ? `<div class="timeline">${timeline}</div>` : emptyState('clock', 'Aucun événement')}
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head">${icon('radio')}<h3>Progression</h3></div>
          <div class="card-body">
            <div class="stack" style="gap:7px">
              ${steps.map((s, i) => {
                const done = etape > i || (closed && i <= 5);
                const active = !closed && etape === i;
                return `<div class="row" style="gap:8px">
                  <span style="width:19px;height:19px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:700;
                    background:${done ? 'var(--red-600)' : active ? '#fff' : 'var(--bg-100)'};
                    color:${done ? '#fff' : active ? 'var(--red-600)' : 'var(--muted-500)'};
                    border:1.5px solid ${done || active ? 'var(--red-600)' : 'var(--line-300)'}">${done ? '✓' : i + 1}</span>
                  <span class="small" style="font-weight:${active ? '700' : '500'};color:${active ? 'var(--ink-900)' : done ? 'var(--ink-700)' : 'var(--muted-500)'}">${esc(s)}</span>
                  ${active ? '<span class="spacer"></span><span class="badge badge-encours">En cours</span>' : ''}
                </div>`;
              }).join('')}
            </div>
            <div class="divider"></div>
            <div class="row" style="justify-content:space-between">
              <span class="small muted">Temps écoulé</span>
              <strong class="mono">${esc(duree(iv.cree_le, iv.cloture_le || null))}</strong>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">${icon('send')}<h3>Transmissions ANTARES</h3>
            <div class="card-head-actions"><a class="btn btn-xs btn-ghost" href="#/antares">Gérer</a></div>
          </div>
          <div class="card-body">
            ${lastAntares ? `<div class="msg-meta"><span class="badge badge-info">${esc(lastAntares.libelle)}</span></div>
              <div class="msg-paper" style="max-height:220px;overflow:auto;font-size:10.6px">${esc(lastAntares.texte)}</div>`
              : '<p class="small muted">Aucun message émis.</p>'}
            <div class="row" style="margin-top:10px;gap:6px">
              <button class="btn btn-sm" data-copy-antares="${esc(lastAntares?.texte || '')}">${icon('copy')} Copier</button>
              <a class="btn btn-sm" href="#/antares">${icon('external')} Rédiger un message</a>
            </div>
          </div>
        </div>

        ${iv.crss ? `<div class="card">
          <div class="card-head">${icon('clipboard')}<h3>Compte rendu (CRSS)</h3></div>
          <div class="card-body">
            <dl class="kv" style="grid-template-columns:110px 1fr">
              <dt>Rédigé par</dt><dd>${esc(iv.crss.redige_par)}</dd>
              <dt>Le</dt><dd>${esc(fmtDate(iv.crss.redige_le))}</dd>
              <dt>Visa</dt><dd>${esc(iv.crss.visa || 'Chef de garde')}</dd>
            </dl>
            <p class="small" style="margin-top:8px;color:var(--ink-700);line-height:1.6">${esc(iv.crss.bilan || '')}</p>
          </div>
          <div class="card-foot"><a href="#/crss">${icon('clipboard')} Ouvrir le registre des CRSS</a></div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

function wire(container, data, reload) {
  const iv = data.intervention;

  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-print]')) window.print();

    const copy = e.target.closest('[data-copy-antares]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copyAntares);
      toast('Message ANTARES copié dans le presse-papiers.', 'success');
    }

    if (e.target.closest('[data-etape]')) {
      try {
        await api(`/api/interventions/${iv.id}`, { method: 'PATCH', body: { action: 'etape' } });
        toast('L’intervention a été avancée à l’étape suivante.', 'success');
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    if (e.target.closest('[data-cloturer]')) openCloture(iv, reload);
    if (e.target.closest('[data-renfort]')) openRenfort(iv, reload);
    if (e.target.closest('[data-crss]')) openCrss(iv, reload);
  });
}

/* --------------------------- Modales d'action ---------------------- */

function openCloture(iv, reload) {
  openModal({
    title: 'Clôturer l’intervention',
    subtitle: `${iv.numero} — ${iv.nature}, ${iv.commune}`,
    iconName: 'check',
    body: `<form id="form-cloture">
      <label class="field">
        <span class="field-label">Bilan de l’intervention</span>
        <textarea class="textarea" name="bilan" rows="5" placeholder="Situation à l’arrivée, actions réalisées, bilan humain et matériel, suites données…">${esc(iv.bilan || '')}</textarea>
        <span class="field-hint">Ce texte sera reporté dans le CRSS et dans le message ANTARES de clôture.</span>
      </label>
      <div class="alert alert-warning">${icon('alert')}<span>La clôture remet automatiquement les engins et les personnels en disponibilité.</span></div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary">${icon('check')} Confirmer la clôture</button>
      </div>
    </form>`,
    onMount(modal, close) {
      modal.querySelector('#form-cloture').addEventListener('submit', async (e) => {
        e.preventDefault();
        const bilan = new FormData(e.target).get('bilan');
        try {
          await api(`/api/interventions/${iv.id}`, { method: 'PATCH', body: { action: 'cloturer', bilan } });
          close();
          toast('Intervention clôturée — CRSS disponible.', 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

async function openRenfort(iv, reload) {
  let engins = [];
  try {
    const data = await api('/api/engins?statut=Disponible');
    engins = data.items;
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  openModal({
    title: 'Demande de renfort',
    subtitle: `Moyens disponibles — ${iv.numero}`,
    iconName: 'plus',
    size: 'modal-lg',
    body: `<form id="form-renfort">
      <p class="small muted" style="margin-bottom:12px">Sélectionnez un ou plusieurs engins à engager en renfort sur l’intervention.</p>
      <div class="grid grid-2" style="gap:8px;max-height:320px;overflow:auto">
        ${engins
          .map(
            (e) => `<label class="row" style="gap:8px;padding:8px 10px;border:1px solid var(--line-200);border-radius:5px;cursor:pointer">
              <input type="checkbox" name="engins" value="${esc(e.indicatif)}" style="accent-color:var(--red-600)" />
              <span><strong style="font-size:12px">${esc(e.indicatif)}</strong>
              <span class="cell-sub" style="display:block">${esc(e.type_libelle)} · ${esc(e.cis)}</span></span>
            </label>`,
          )
          .join('') || '<p class="muted small">Aucun engin disponible.</p>'}
      </div>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary" ${engins.length ? '' : 'disabled'}>${icon('plus')} Engager le renfort</button>
      </div>
    </form>`,
    onMount(modal, close) {
      modal.querySelector('#form-renfort').addEventListener('submit', async (e) => {
        e.preventDefault();
        const selected = [...modal.querySelectorAll('input[name=engins]:checked')].map((i) => i.value);
        if (!selected.length) {
          toast('Sélectionnez au moins un engin.', 'warning');
          return;
        }
        try {
          await api(`/api/interventions/${iv.id}`, { method: 'PATCH', body: { action: 'renfort', engins: selected } });
          close();
          toast(`Renfort engagé : ${selected.join(', ')}`, 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}

function openCrss(iv, reload) {
  openModal({
    title: 'Établir le compte rendu de sortie de secours',
    subtitle: `${iv.numero} — ${iv.nature}, ${iv.commune}`,
    iconName: 'clipboard',
    size: 'modal-lg',
    body: `<form id="form-crss">
      <label class="field">
        <span class="field-label">Bilan et actions réalisées</span>
        <textarea class="textarea" name="bilan" rows="4">${esc(iv.crss?.bilan || iv.bilan || '')}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Conséquences / orientation des victimes</span>
        <textarea class="textarea" name="consequences" rows="2">${esc(iv.crss?.consequences || '')}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Suites données</span>
        <textarea class="textarea" name="suites" rows="2">${esc(iv.crss?.suites || '')}</textarea>
      </label>
      <div class="form-actions">
        <button type="button" class="btn" data-close>Annuler</button>
        <button type="submit" class="btn btn-primary">${icon('check')} Valider le CRSS</button>
      </div>
    </form>`,
    onMount(modal, close) {
      modal.querySelector('#form-crss').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api('/api/crss', {
            method: 'POST',
            body: {
              intervention_id: iv.id,
              bilan: fd.get('bilan'),
              consequences: fd.get('consequences'),
              suites: fd.get('suites'),
            },
          });
          close();
          toast('Compte rendu enregistré et transmis au CODIS.', 'success');
          reload();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    },
  });
}
