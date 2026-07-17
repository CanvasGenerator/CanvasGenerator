/**
 * Campus — source unique de vérité (côté éditeur)
 * ───────────────────────────────────────────────────────────────
 * Tous les composants campus (Nos Campus, Carrousel, champ des
 * formulaires) lisent la MÊME liste, résolue ici :
 *
 *   window.__LP_CAMPUSES    → liste complète chargée depuis /api/campuses
 *   window.__LP_CAMPUS_IDS  → IDs sélectionnés au niveau de la PAGE
 *                             (stockés dans Projects.properties.campusIds)
 *
 * getResolvedCampuses() renvoie la liste effective de la page (filtrée).
 * Un event `lp:campuses-changed` est émis sur `document` à chaque
 * changement (chargement, sélection, édition) → les composants se
 * re-rendent.
 *
 * Ce module expose aussi window.LPCampus pour que les composants
 * GrapesJS (dans blocks/ et MasterTemplate/) y accèdent sans import.
 */

const CAMPUS_EVENT = 'lp:campuses-changed';

/* ── Helpers ─────────────────────────────────────────────────── */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Un pays campus vaut-il « France » ? (vide = France par défaut). */
export function isFranceCountry(country) {
    const k = String(country || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return k === '' || k === 'france' || k === 'fr';
}

/** Liste effective des campus pour la page (sélection appliquée). */
export function getResolvedCampuses() {
    const all = Array.isArray(window.__LP_CAMPUSES) ? window.__LP_CAMPUSES : [];
    const ids = Array.isArray(window.__LP_CAMPUS_IDS) ? window.__LP_CAMPUS_IDS : [];
    if (!ids.length) return all.slice();            // aucune sélection ⇒ tous
    // On respecte l'ordre de la sélection de page.
    const byId = {};
    all.forEach(c => { byId[c.id] = c; });
    return ids.map(id => byId[id]).filter(Boolean);
}

/** Émet l'event de changement → tous les composants se re-rendent. */
export function notifyCampusChange() {
    document.dispatchEvent(new CustomEvent(CAMPUS_EVENT, {
        detail: { campuses: getResolvedCampuses() }
    }));
}

/** Charge la liste des campus de l'école courante depuis l'API (met en cache). */
export async function loadCampuses() {
    const school = _ctx.getSchoolId ? _ctx.getSchoolId() : '';
    try {
        const url = '/api/campuses' + (school ? `?school=${encodeURIComponent(school)}` : '');
        const r = await fetch(url);
        const data = await r.json();
        window.__LP_CAMPUSES = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('Campus: chargement impossible', e);
        window.__LP_CAMPUSES = window.__LP_CAMPUSES || [];
    }
    notifyCampusChange();
    return window.__LP_CAMPUSES;
}

/** Définit la sélection de campus de la page. */
export function setPageCampusIds(ids) {
    window.__LP_CAMPUS_IDS = Array.isArray(ids) ? ids.slice() : [];
    notifyCampusChange();
}

/* ── Contexte fourni par app.js (école / projet) ─────────────── */
let _ctx = {
    getSchoolId: () => (window.CURRENT_SCHOOL && window.CURRENT_SCHOOL.id) || 'master',
    getProjectName: () => '',
    onSelectionChange: () => {}
};

/* ═══════════════════════════════════════════════════════════════
   MODALE : gestion des campus (CRUD) + sélection au niveau page
   Réutilise le markup #campus-config-modal de index.html.
═══════════════════════════════════════════════════════════════ */

function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

async function apiCampus(method, id, payload) {
    // Toujours scoper par école : les campus sont cloisonnés par école.
    const school = _ctx.getSchoolId ? _ctx.getSchoolId() : '';
    const qs = school ? `?school=${encodeURIComponent(school)}` : '';
    const url = (id ? `/api/campuses/${encodeURIComponent(id)}` : '/api/campuses') + qs;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (payload) opts.body = JSON.stringify(payload);
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    // Le serveur peut renvoyer un corps vide → text() est plus sûr.
    const txt = await r.text();
    try { return txt ? JSON.parse(txt) : null; } catch { return null; }
}

/** Upload d'une image campus vers SFMC → renvoie l'URL publiée. */
async function uploadCampusImage(dataUrl, name) {
    const r = await fetch('/api/sfmc/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name || 'campus',
            schoolId: _ctx.getSchoolId(),
            projectName: _ctx.getProjectName(),
            dataUrl
        })
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error(t || ('HTTP ' + r.status));
    }
    const data = await r.json();
    if (!data || !data.url) throw new Error("Réponse d'upload invalide");
    return data.url;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
    });
}

let _modalWired = false;

/** Ouvre la modale de gestion + sélection des campus de la page. */
export function openCampusSettings() {
    const modal   = document.getElementById('campus-config-modal');
    const body    = document.getElementById('campus-config-body');
    const countEl = document.getElementById('campus-config-count');
    const selEl   = document.getElementById('campus-config-selected-count');
    if (!modal) return;

    modal.style.display = 'flex';
    body.innerHTML = '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">Chargement…</div>';
    countEl.textContent = '';
    selEl.textContent = '';

    // IDs actuellement sélectionnés pour la page
    const selectedIds = new Set(Array.isArray(window.__LP_CAMPUS_IDS) ? window.__LP_CAMPUS_IDS : []);

    function updateSelCount() {
        const checked = body.querySelectorAll('input.campus-check:checked').length;
        selEl.textContent = checked
            ? `${checked} campus appliqué${checked > 1 ? 's' : ''} à cette page`
            : 'Aucun campus sélectionné → tous les campus seront affichés';
    }

    function render(campuses) {
        window.__LP_CAMPUSES = campuses;
        countEl.textContent = `${campuses.length} campus en base`;

        if (!campuses.length) {
            body.innerHTML = '<div style="padding:32px;text-align:center;color:#9ca3af;font-size:13px;">Aucun campus en base. Ajoutez-en un ci-dessus !</div>';
            updateSelCount();
            return;
        }

        body.innerHTML = campuses.map(c => {
            const checked = selectedIds.has(c.id) ? 'checked' : '';
            const thumb = c.image_url
                ? `<img src="${escapeHtml(c.image_url)}" alt="" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex-shrink:0;">`
                : `<div style="width:38px;height:38px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;flex-shrink:0;"><i class="fas fa-image"></i></div>`;
            return `
            <div class="campus-row" data-id="${escapeHtml(c.id)}" style="border-bottom:1px solid #f3f4f6;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;">
                    <label style="display:flex;align-items:center;gap:12px;flex:1;cursor:pointer;margin:0;min-width:0;">
                        <input type="checkbox" class="campus-check" value="${escapeHtml(c.id)}" ${checked}
                            style="width:15px;height:15px;flex-shrink:0;cursor:pointer;accent-color:#1a7a5e;margin:0;">
                        ${thumb}
                        <div style="min-width:0;">
                            <div style="font-size:13px;font-weight:600;color:#111;line-height:1.35;">📍 ${escapeHtml(c.name)}${c.country ? ` <span style="font-weight:500;color:#6b7280;font-size:11px;">· ${escapeHtml(c.country)}</span>` : ''}</div>
                            <div style="font-size:11px;color:#9ca3af;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.address || 'Pas d’adresse')}</div>
                        </div>
                    </label>
                    <div style="display:flex;gap:4px;flex-shrink:0;align-items:center;">
                        <button type="button" class="btn-edit-campus" title="Modifier (image, adresse, lien)" style="border:none;background:none;color:#4b5563;cursor:pointer;padding:6px;font-size:14px;border-radius:4px;"><i class="fas fa-pen"></i></button>
                        <button type="button" class="btn-delete-campus" title="Supprimer" style="border:none;background:none;color:#ef4444;cursor:pointer;padding:6px;font-size:14px;border-radius:4px;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="campus-edit" style="display:none;padding:4px 20px 16px 20px;background:#fafafa;">
                    <div style="display:flex;gap:14px;align-items:flex-start;">
                        <div style="flex-shrink:0;text-align:center;">
                            <div class="campus-img-preview" style="width:88px;height:88px;border-radius:8px;background:#f3f4f6 center/cover no-repeat;border:1px solid #e5e7eb;${c.image_url ? `background-image:url('${escapeHtml(c.image_url)}');` : ''}display:flex;align-items:center;justify-content:center;color:#9ca3af;">${c.image_url ? '' : '<i class="fas fa-image"></i>'}</div>
                            <button type="button" class="btn-upload-campus-img" style="margin-top:6px;font-size:11px;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;color:#374151;"><i class="fas fa-upload"></i> Image</button>
                        </div>
                        <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
                            <input type="text" class="campus-f-name" value="${escapeHtml(c.name)}" placeholder="Nom du campus" style="padding:7px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:6px;outline:none;">
                            <input type="text" class="campus-f-image" value="${escapeHtml(c.image_url || '')}" placeholder="URL de l'image (ou upload)" style="padding:7px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:6px;outline:none;">
                            <input type="text" class="campus-f-address" value="${escapeHtml(c.address || '')}" placeholder="Adresse (affichée dans le carrousel)" style="padding:7px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:6px;outline:none;">
                            <select class="campus-f-country" style="padding:7px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:6px;outline:none;background:#fff;">
                                <option value="France" ${isFranceCountry(c.country) ? 'selected' : ''}>France</option>
                                <option value="International" ${isFranceCountry(c.country) ? '' : 'selected'}>International</option>
                            </select>
                            <input type="text" class="campus-f-link" value="${escapeHtml(c.link || '')}" placeholder="Lien (image cliquable dans le carrousel)" style="padding:7px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:6px;outline:none;">
                            <div style="display:flex;gap:8px;justify-content:flex-end;">
                                <button type="button" class="btn-cancel-edit-campus" style="font-size:12px;padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;color:#374151;">Fermer</button>
                                <button type="button" class="btn-save-campus" style="font-size:12px;padding:6px 12px;border:none;border-radius:6px;background:#1a7a5e;color:#fff;font-weight:600;cursor:pointer;">Enregistrer</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        wireRows();
        updateSelCount();
    }

    function wireRows() {
        body.querySelectorAll('input.campus-check').forEach(cb => {
            cb.addEventListener('change', updateSelCount);
        });

        body.querySelectorAll('.btn-edit-campus').forEach(btn => {
            btn.onclick = () => {
                const row = btn.closest('.campus-row');
                const panel = row.querySelector('.campus-edit');
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            };
        });

        body.querySelectorAll('.btn-cancel-edit-campus').forEach(btn => {
            btn.onclick = () => { btn.closest('.campus-edit').style.display = 'none'; };
        });

        body.querySelectorAll('.btn-upload-campus-img').forEach(btn => {
            btn.onclick = () => {
                const row = btn.closest('.campus-row');
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png,image/jpeg,image/gif';
                input.onchange = async () => {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    const orig = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    try {
                        const dataUrl = await fileToDataUrl(file);
                        const url = await uploadCampusImage(dataUrl, row.getAttribute('data-id'));
                        row.querySelector('.campus-f-image').value = url;
                        const prev = row.querySelector('.campus-img-preview');
                        prev.style.backgroundImage = `url('${url}')`;
                        prev.innerHTML = '';
                    } catch (e) {
                        alert('Erreur upload image : ' + e.message);
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = orig;
                    }
                };
                input.click();
            };
        });

        body.querySelectorAll('.btn-save-campus').forEach(btn => {
            btn.onclick = async () => {
                const row = btn.closest('.campus-row');
                const id = row.getAttribute('data-id');
                const payload = {
                    name:      row.querySelector('.campus-f-name').value.trim(),
                    image_url: row.querySelector('.campus-f-image').value.trim(),
                    address:   row.querySelector('.campus-f-address').value.trim(),
                    country:   row.querySelector('.campus-f-country').value.trim(),
                    link:      row.querySelector('.campus-f-link').value.trim()
                };
                if (!payload.name) { alert('Le nom est requis.'); return; }
                btn.disabled = true;
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    await apiCampus('PUT', id, payload);
                    await reload();
                } catch (e) {
                    alert('Erreur enregistrement : ' + e.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = orig;
                }
            };
        });

        body.querySelectorAll('.btn-delete-campus').forEach(btn => {
            btn.onclick = async () => {
                const row = btn.closest('.campus-row');
                const id = row.getAttribute('data-id');
                const name = row.querySelector('.campus-f-name')?.value || id;
                if (!confirm(`Supprimer le campus « ${name} » ?`)) return;
                try {
                    await apiCampus('DELETE', id);
                    selectedIds.delete(id);
                    await reload();
                } catch (e) {
                    alert('Erreur suppression : ' + e.message);
                }
            };
        });
    }

    function snapshotChecks() {
        // Conserve l'état des cases avant un reload (édition/ajout)
        body.querySelectorAll('input.campus-check').forEach(cb => {
            if (cb.checked) selectedIds.add(cb.value);
            else selectedIds.delete(cb.value);
        });
    }

    async function reload() {
        snapshotChecks();
        const campuses = await loadCampuses();
        render(campuses);
    }

    // Chargement initial
    loadCampuses().then(render);

    /* ── Wiring des boutons de la modale (une seule fois) ───────── */
    const btnAdd   = document.getElementById('btn-add-campus');
    const inputNew = document.getElementById('new-campus-name');

    async function handleAdd() {
        const name = inputNew.value.trim();
        if (!name) return;
        const id = slugify(name);
        btnAdd.disabled = true;
        const orig = btnAdd.innerHTML;
        btnAdd.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            await apiCampus('POST', null, { id, name, country: 'France' });
            inputNew.value = '';
            selectedIds.add(id);         // auto-sélection à l'ajout
            await reload();
        } catch (e) {
            alert("Erreur d'ajout : " + e.message);
        } finally {
            btnAdd.disabled = false;
            btnAdd.innerHTML = orig;
        }
    }

    if (!_modalWired) {
        _modalWired = true;

        btnAdd.onclick = handleAdd;
        inputNew.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
        };

        document.getElementById('btn-campus-select-all').onclick = () => {
            body.querySelectorAll('input.campus-check').forEach(cb => { cb.checked = true; });
            updateSelCount();
        };
        document.getElementById('btn-campus-deselect-all').onclick = () => {
            body.querySelectorAll('input.campus-check').forEach(cb => { cb.checked = false; });
            updateSelCount();
        };

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('btn-campus-config-close').onclick = close;
        document.getElementById('btn-campus-config-skip').onclick  = close;

        document.getElementById('btn-campus-config-confirm').onclick = () => {
            snapshotChecks();
            const ids = [...body.querySelectorAll('input.campus-check:checked')].map(cb => cb.value);
            setPageCampusIds(ids);
            _ctx.onSelectionChange(ids);
            close();
        };
    } else {
        // La modale existe déjà : on rebranche juste l'ajout au contexte courant
        btnAdd.onclick = handleAdd;
        inputNew.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
        };
    }
}

/**
 * Initialise le sous-système campus.
 * @param {Object} opts
 * @param {Function} opts.getSchoolId      - () => id école courante
 * @param {Function} opts.getProjectName   - () => nom projet courant (pour upload)
 * @param {Function} opts.onSelectionChange- (ids) => persiste dans properties
 */
export function initCampus(opts = {}) {
    if (opts.getSchoolId)       _ctx.getSchoolId = opts.getSchoolId;
    if (opts.getProjectName)    _ctx.getProjectName = opts.getProjectName;
    if (opts.onSelectionChange) _ctx.onSelectionChange = opts.onSelectionChange;

    // Expose pour les composants GrapesJS (blocks/ & MasterTemplate/)
    window.LPCampus = {
        getResolvedCampuses,
        escapeHtml,
        onChange(cb) { document.addEventListener(CAMPUS_EVENT, cb); }
    };

    // Chargement initial de la liste
    loadCampuses();

    // Bouton toolbar « Campus »
    const btn = document.getElementById('btn-page-campus');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); openCampusSettings(); });
}
