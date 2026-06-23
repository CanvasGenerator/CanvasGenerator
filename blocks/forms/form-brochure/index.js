/**
 * Bloc : Formulaire Téléchargement de Brochure (FR + EN)
 * ─────────────────────────────────────────────────────────
 * MODE TEST : soumission gérée en JS pur (pas d'AMPscript).
 *
 * Architecture : PAS de <script> inline (non exécuté par GrapesJS CDN).
 * Logique via editor.on('component:mount') + editor.Canvas.getDocument().
 * Sélecteurs par classe/name — GrapesJS remplace les attributs id.
 */

import { EDC_PICKLISTS, buildOptions } from '../shared/picklist-config.js';
import { fetchRgpdConfig } from '../shared/rgpd-config.js';

export default function (editor, categories) {

    /* ── Traductions FR / EN ─────────────────────────────────────────── */
    const TRANS = {
        fr: {
            title:          'Télécharger notre brochure',
            subtitle:       'Renseignez vos coordonnées pour recevoir votre brochure par e-mail.',
            youAre:         'Vous êtes',
            lastName:       'Nom',
            firstName:      'Prénom',
            email:          'Adresse email',
            mobile:         'Portable',
            mobilePh:       '06 12 34 56 78',
            studyLevel:     "Niveau d'études",
            campus:         'Campus souhaité',
            country:        'Pays de résidence',
            programme:      'Programme souhaité',
            programmePh:    'Sélectionnez un programme...',
            childFirstName: 'Prénom de votre enfant',
            childEmail:     'Email de votre enfant',
            rgpd:           "J'accepte d'être contacté(e) par l'école pour les finalités décrites",
            rgpdLink:       'ici',
            submit:         'Je télécharge la brochure',
            sending:        'Envoi en cours...',
            successTitle:   name => `Merci, ${name} !`,
            successMsg:     email => `Votre demande a été enregistrée. Vos documents seront envoyés à <strong>${email}</strong>.`,
            successListTitle: 'Vous trouverez vos documents ci-dessous au format PDF :',
            errRequired:    'Ce champ est requis.',
            errEmail:       'Format e-mail invalide.',
            errEmailDom:    'Veuillez utiliser une adresse valide.',
            errPhone:       'Numéro invalide (ex: 06 12 34 56 78).',
            errGeneric:     'Une erreur est survenue, veuillez réessayer.',
        },
        en: {
            title:          'Download our brochure',
            subtitle:       'Fill in your details to receive your brochure by email.',
            youAre:         'You are',
            lastName:       'Last name',
            firstName:      'First name',
            email:          'Email address',
            mobile:         'Mobile',
            mobilePh:       '07 12 34 56 78',
            studyLevel:     'Level of study',
            campus:         'Desired campus',
            country:        'Country of residence',
            programme:      'Desired programme',
            programmePh:    'Select a programme...',
            childFirstName: "Your child's first name",
            childEmail:     "Your child's email",
            rgpd:           'I agree to be contacted by the school for the purposes described',
            rgpdLink:       'here',
            submit:         'Download brochure',
            sending:        'Sending...',
            successTitle:   name => `Thank you, ${name}!`,
            successMsg:     email => `Your request has been registered. Your documents will be sent to <strong>${email}</strong>.`,
            successListTitle: 'Your documents are available below in PDF format:',
            errRequired:    'This field is required.',
            errEmail:       'Invalid email format.',
            errEmailDom:    'Please use a valid email address.',
            errPhone:       'Invalid number (e.g. 07 12 34 56 78).',
            errGeneric:     'An error occurred, please try again.',
        }
    };

    /* ── Données de test : spécialités par niveau d'études ──────────── */
    const specialitesByLevel = {
        'bac+2': [
            { value: 'comm_publique', label: 'Communication Publique & Influence' },
            { value: 'comm_event',    label: 'Communication et Management Événementiel' },
            { value: 'sport_comm',    label: 'Sport Business & Communication' }
        ],
        'bac+3': [
            { value: 'comm_publique', label: 'Communication Publique & Influence' },
            { value: 'comm_event',    label: 'Communication et Management Événementiel' },
            { value: 'creation_pub',  label: 'Création & Stratégies Publicitaires' },
            { value: 'prod_audio',    label: 'Communication & Production Audiovisuelle' },
            { value: 'sport_comm',    label: 'Sport Business & Communication' },
            { value: 'comm_gastro',   label: 'Communication & Gastronomie' }
        ],
        'bac+4': [
            { value: 'comm_marketing', label: 'Communication et Marketing Stratégique' },
            { value: 'comm_event',     label: 'Communication et Management Événementiel' },
            { value: 'sport_comm',     label: 'Sport Business & Communication' }
        ],
        'bac+5': [
            { value: 'mba_comm',     label: 'MBA Communication & Leadership' },
            { value: 'mba_marketing',label: 'MBA Marketing Digital' },
            { value: 'mba_event',    label: 'MBA Event Management' }
        ]
    };

    /* ── Données de test : brochures par campus × niveau ────────────── */
    const BROCHURES = {
        paris: {
            'bac+2': ['Brochure Bachelor 1re année (Paris)', 'Brochure BTS Communication (Paris)'],
            'bac+3': ['Brochure Bachelor 3e année (Paris)', 'Brochure Communication Publique (Paris)'],
            'bac+5': ['Brochure MBA Communication (Paris)', 'Brochure MBA Marketing Digital (Paris)']
        },
        lille: {
            'bac+2': ['Brochure Bachelor 1re année (Lille)'],
            'bac+3': ['Brochure Bachelor 3e année (Lille)'],
            'bac+5': ['Brochure MBA Communication (Lille)']
        }
    };

    /* ── Générateur HTML ─────────────────────────────────────────────── */
    function buildContent(lang) {
        const t = TRANS[lang] || TRANS.fr;
        const contactTypeOptions = buildOptions(EDC_PICKLISTS.contactType, '');
        const studyLevelOptions  = buildOptions(EDC_PICKLISTS.studyLevel,  '');
        const campusOptions      = buildOptions(EDC_PICKLISTS.campus,      '');
        const countryOptions     = buildOptions(EDC_PICKLISTS.countries,   '');

        return `
<section class="brf-section"
  data-gjs-removable="false"
  data-gjs-copyable="false"
  data-gjs-droppable="false"
  data-gjs-highlightable="false">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.brf-section *, .brf-section *::before, .brf-section *::after { box-sizing: border-box; }
.brf-section {
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 16px; background: transparent;
    font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222;
}
.brf-card {
    width: 100%; max-width: 520px;
    border-radius: 4px; background: #fff; padding: 24px 24px 28px;
}
.brf-title { font-size: 18px; font-weight: 700; color: #111; margin: 0 0 4px; }
.brf-subtitle { font-size: 12px; color: #666; margin: 0 0 18px; }
.brf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
.brf-field { display: flex; flex-direction: column; margin-bottom: 10px; }
.brf-row .brf-field { margin-bottom: 0; }
.brf-field.hidden { display: none; }
.brf-label { font-size: 12px; color: #333; margin-bottom: 3px; display: block; }
.brf-label .req { color: #c00; }
.brf-input, .brf-select {
    width: 100%; height: 34px; padding: 0 10px;
    border: 1px solid #bbb; border-radius: 2px;
    font-size: 13px; font-family: inherit; color: #111; background: #fff;
    outline: none; appearance: none; -webkit-appearance: none; transition: border-color 0.15s;
}
.brf-input:focus, .brf-select:focus { border-color: #888; }
.brf-input.err, .brf-select.err { border-color: #c00; }
.brf-err-msg { font-size: 10px; color: #c00; margin-top: 2px; display: none; }
.brf-err-msg.show { display: block; }
.brf-sel-wrap { position: relative; }
.brf-sel-wrap::after {
    content: ''; position: absolute; right: 10px; top: 50%;
    transform: translateY(-50%); pointer-events: none;
    border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #666;
}
.brf-phone-wrap { display: flex; gap: 6px; }
.brf-phone-prefix {
    width: 72px; flex-shrink: 0; height: 34px; padding: 0 6px;
    border: 1px solid #bbb; border-radius: 2px; font-size: 12px;
    font-family: inherit; background: #fff; appearance: none; -webkit-appearance: none; outline: none;
}
.brf-rgpd { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0 16px; }
.brf-rgpd input[type="checkbox"] { width: 14px; height: 14px; margin-top: 2px; flex-shrink: 0; cursor: pointer; accent-color: #333; }
.brf-rgpd-label { font-size: 11px; color: #333; line-height: 1.5; cursor: pointer; }
.brf-rgpd-label a { color: #333; text-decoration: underline; }
.brf-submit-wrap { display: flex; justify-content: center; }
.brf-submit {
    width: 50%; display: inline-flex; justify-content: center; align-items: center;
    padding: 11px; background: #111; color: #fff;
    border: none; border-radius: 3px; font-size: 14px; font-weight: 700;
    font-family: inherit; cursor: pointer; letter-spacing: 0.02em; transition: background 0.15s;
}
.brf-submit:hover { background: #333; }
.brf-submit:disabled { background: #888; cursor: not-allowed; }
.brf-success { display: none; padding: 16px 0 8px; text-align: center; }
.brf-success h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #111; }
.brf-success p { font-size: 13px; color: #555; margin: 0 0 16px; }
.brf-brochure-list { text-align: left; background: #fafafa; border-radius: 4px; padding: 14px 18px; }
.brf-brochure-list p { font-size: 12px; font-weight: 700; margin: 0 0 8px; color: #333; }
.brf-brochure-list ul { margin: 0; padding-left: 16px; }
.brf-brochure-list li { margin-bottom: 6px; }
.brf-brochure-list a { font-size: 13px; color: #1a56db; }
.brf-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #fff; border-top-color: transparent;
    border-radius: 50%; animation: brf-spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px;
}
@keyframes brf-spin { to { transform: rotate(360deg); } }
@media(max-width:460px){ .brf-row { grid-template-columns: 1fr; } .brf-phone-prefix { width: 60px; } }
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="brf-card">

    <h3 class="brf-title">${t.title}</h3>
    <p class="brf-subtitle">${t.subtitle}</p>

    <!-- Confirmation (masquée initialement) -->
    <div class="brf-success">
        <div style="font-size:40px;margin-bottom:10px;">✅</div>
        <h3 class="brf-success-title"></h3>
        <p class="brf-success-msg"></p>
        <div class="brf-brochure-list">
            <p class="brf-brochure-list-title">${t.successListTitle}</p>
            <ul class="brf-brochure-links"></ul>
        </div>
    </div>

    <!-- Formulaire -->
    <form class="brf-form" data-lang="${lang}" novalidate>
        <input type="hidden" name="submitted" value="true">
        <input type="hidden" name="Marque"    value="">

        <!-- Vous êtes -->
        <div class="brf-field">
            <label class="brf-label">${t.youAre}<span class="req">*</span></label>
            <div class="brf-sel-wrap">
                <select class="brf-select brf-vous-etes" name="VousEtes" required>
                    ${contactTypeOptions}
                </select>
            </div>
            <span class="brf-err-msg">${t.errRequired}</span>
        </div>

        <!-- Nom / Prénom -->
        <div class="brf-row">
            <div class="brf-field">
                <label class="brf-label">${t.lastName}<span class="req">*</span></label>
                <input class="brf-input" type="text" name="LastName" required>
                <span class="brf-err-msg">${t.errRequired}</span>
            </div>
            <div class="brf-field">
                <label class="brf-label">${t.firstName}<span class="req">*</span></label>
                <input class="brf-input" type="text" name="FirstName" required>
                <span class="brf-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Email / Portable -->
        <div class="brf-row">
            <div class="brf-field">
                <label class="brf-label">${t.email}<span class="req">*</span></label>
                <input class="brf-input brf-email-input" type="email" name="EmailAddress" required>
                <span class="brf-err-msg">${t.errEmail}</span>
            </div>
            <div class="brf-field">
                <label class="brf-label">${t.mobile}<span class="req">*</span></label>
                <div class="brf-phone-wrap">
                    <select class="brf-phone-prefix" aria-label="Prefix">
                        <option value="+33">+33</option>
                        <option value="+32">+32</option>
                        <option value="+41">+41</option>
                        <option value="+352">+352</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                        <option value="+212">+212</option>
                    </select>
                    <input class="brf-input brf-phone-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="brf-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Niveau d'études / Campus -->
        <div class="brf-row">
            <div class="brf-field">
                <label class="brf-label">${t.studyLevel}<span class="req">*</span></label>
                <div class="brf-sel-wrap">
                    <select class="brf-select brf-niveau" name="StudyLevel" required>
                        ${studyLevelOptions}
                    </select>
                </div>
                <span class="brf-err-msg">${t.errRequired}</span>
            </div>
            <div class="brf-field">
                <label class="brf-label">${t.campus}<span class="req">*</span></label>
                <div class="brf-sel-wrap">
                    <select class="brf-select" name="Campus" required>
                        ${campusOptions}
                    </select>
                </div>
                <span class="brf-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Programme (conditionnel : visible si niveau a des spécialités) -->
        <div class="brf-field brf-programme-field hidden">
            <label class="brf-label">${t.programme}</label>
            <div class="brf-sel-wrap">
                <select class="brf-select brf-programme-select" name="Programme">
                    <option value="">${t.programmePh}</option>
                </select>
            </div>
        </div>

        <!-- Pays de résidence -->
        <div class="brf-field">
            <label class="brf-label">${t.country}<span class="req">*</span></label>
            <div class="brf-sel-wrap">
                <select class="brf-select" name="Country" required>
                    ${countryOptions}
                </select>
            </div>
            <span class="brf-err-msg">${t.errRequired}</span>
        </div>

        <!-- Champs conditionnels parent -->
        <div class="brf-field brf-child-fn-field hidden">
            <label class="brf-label">${t.childFirstName}</label>
            <input class="brf-input" type="text" name="ChildFirstName">
        </div>
        <div class="brf-field brf-child-email-field hidden">
            <label class="brf-label">${t.childEmail}</label>
            <input class="brf-input brf-child-email-input" type="email" name="ChildEmail">
            <span class="brf-err-msg">${t.errEmail}</span>
        </div>

        <!-- RGPD -->
        <div class="brf-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true">
            <label class="brf-rgpd-label">
                <span data-rgpd-text>...</span> <a data-rgpd-link href="#privacy-policy" target="_blank">ici</a>
            </label>
        </div>

        <div class="brf-submit-wrap">
            <button type="submit" class="brf-submit">${t.submit}</button>
        </div>
    </form>

</div><!-- /.brf-card -->
</section>`;
    }

    /* ══════════════════════════════════════════════════════════════════
     * LOGIQUE INTERACTIVE — via editor.on('component:mount')
     * ══════════════════════════════════════════════════════════════════ */

    const BAD_DOMAINS = ['mailinator.com','guerrillamail.com','tempmail.com',
        'yopmail.com','trashmail.com','throwam.com','spam4.me','dispostable.com'];

    function validateEmail(val, t) {
        if (!val) return t.errRequired;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return t.errEmail;
        const domain = val.split('@')[1].toLowerCase();
        if (BAD_DOMAINS.includes(domain)) return t.errEmailDom;
        return null;
    }

    function validatePhone(val, t) {
        if (!val) return t.errRequired;
        const d = val.replace(/[\s\-.()]/g, '').replace(/^0/, '');
        if (!/^[0-9]{7,14}$/.test(d)) return t.errPhone;
        return null;
    }

    function showFieldErr(field, msg) {
        if (!field) return;
        field.classList.add('err');
        const wrap = field.closest('.brf-field');
        const span = wrap && wrap.querySelector('.brf-err-msg');
        if (span) { if (msg) span.textContent = msg; span.classList.add('show'); }
    }

    function clearFieldErr(field) {
        if (!field) return;
        field.classList.remove('err');
        const wrap = field.closest('.brf-field');
        const span = wrap && wrap.querySelector('.brf-err-msg');
        if (span) span.classList.remove('show');
    }

    function initBrfForm(form) {
        if (!form || form.dataset.brfInit) return;
        form.dataset.brfInit = '1';

        const lang = form.dataset.lang || 'fr';
        const t    = TRANS[lang] || TRANS.fr;

        /* ── RGPD : résolution depuis la source centrale ── */
        fetchRgpdConfig(lang).then(({ text, url, linkLabel }) => {
            const textEl = form.querySelector('[data-rgpd-text]');
            const linkEl = form.querySelector('[data-rgpd-link]');
            if (textEl) textEl.textContent = text;
            if (linkEl) { linkEl.textContent = linkLabel; linkEl.href = url; }
        });

        const vousEtesEl    = form.querySelector('.brf-vous-etes');
        const niveauEl      = form.querySelector('.brf-niveau');
        const emailEl       = form.querySelector('.brf-email-input');
        const phoneEl       = form.querySelector('.brf-phone-input');
        const childEmailEl  = form.querySelector('.brf-child-email-input');
        const programmeField= form.querySelector('.brf-programme-field');
        const programmeSelect=form.querySelector('.brf-programme-select');
        const childFnField  = form.querySelector('.brf-child-fn-field');
        const childEmField  = form.querySelector('.brf-child-email-field');

        function refreshConditions() {
            const vousEtes = vousEtesEl ? vousEtesEl.value : '';
            const niveau   = niveauEl   ? niveauEl.value   : '';

            /* Parent → champs enfant */
            const isParent = vousEtes === 'parent';
            if (childFnField) childFnField.classList.toggle('hidden', !isParent);
            if (childEmField) childEmField.classList.toggle('hidden', !isParent);
            if (!isParent) {
                const fn = form.querySelector('[name="ChildFirstName"]');
                if (fn) fn.value = '';
                if (childEmailEl) childEmailEl.value = '';
            }

            /* Niveau → spécialités */
            const specs = specialitesByLevel[niveau] || [];
            if (programmeField && programmeSelect) {
                if (specs.length > 0) {
                    programmeSelect.innerHTML = `<option value="">${t.programmePh}</option>`
                        + specs.map(s => `<option value="${s.value}">${s.label}</option>`).join('');
                    programmeField.classList.remove('hidden');
                } else {
                    programmeField.classList.add('hidden');
                    programmeSelect.value = '';
                }
            }
        }

        if (vousEtesEl) vousEtesEl.addEventListener('change', refreshConditions);
        if (niveauEl)   niveauEl.addEventListener('change', refreshConditions);
        refreshConditions();

        if (emailEl) emailEl.addEventListener('blur', function () {
            const e = validateEmail(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        if (phoneEl) phoneEl.addEventListener('blur', function () {
            const e = validatePhone(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        if (childEmailEl) childEmailEl.addEventListener('blur', function () {
            if (!this.value.trim()) { clearFieldErr(this); return; }
            const e = validateEmail(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            let ok = true;

            ['VousEtes', 'LastName', 'FirstName', 'StudyLevel', 'Campus', 'Country'].forEach(name => {
                const el = form.querySelector(`[name="${name}"]`);
                if (el && !el.value.trim()) { showFieldErr(el, t.errRequired); ok = false; }
                else if (el) clearFieldErr(el);
            });

            const ee = validateEmail((emailEl || {}).value || '', t);
            if (ee) { showFieldErr(emailEl, ee); ok = false; } else clearFieldErr(emailEl);

            const pe = validatePhone((phoneEl || {}).value || '', t);
            if (pe) { showFieldErr(phoneEl, pe); ok = false; } else clearFieldErr(phoneEl);

            if (childEmField && !childEmField.classList.contains('hidden') && childEmailEl && childEmailEl.value.trim()) {
                const ce = validateEmail(childEmailEl.value.trim(), t);
                if (ce) { showFieldErr(childEmailEl, ce); ok = false; } else clearFieldErr(childEmailEl);
            }

            if (!ok) {
                const firstErr = form.querySelector('.brf-input.err, .brf-select.err');
                if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            const btn = form.querySelector('.brf-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="brf-spinner"></span>${t.sending}`; }

            const data = {};
            new FormData(form).forEach((v, k) => { data[k] = v; });

            const prefixEl = form.querySelector('.brf-phone-prefix');
            const prefix   = prefixEl ? prefixEl.value : '+33';
            const raw      = (data.MobilePhone || '').replace(/[\s\-.]/g, '').replace(/^0/, '');
            if (raw && !raw.startsWith('+')) data.MobilePhone = prefix + raw;

            const rgpd = data.RGPDConsent === 'true';
            data.HasOptedInEmail    = rgpd ? '1' : '0';
            data.HasOptedInSMS      = rgpd ? '1' : '0';
            data.HasOptedInWhatsApp = rgpd ? '1' : '0';

            /* MODE TEST : simulation d'envoi */
            new Promise(resolve => setTimeout(() => resolve({ ok: true }), 1000))
                .then(res => {
                    if (res.ok) {
                        /* Confirmation */
                        form.style.display = 'none';
                        const titleEl = form.closest('.brf-card').querySelector('.brf-title');
                        const subEl   = form.closest('.brf-card').querySelector('.brf-subtitle');
                        if (titleEl) titleEl.style.display = 'none';
                        if (subEl)   subEl.style.display   = 'none';

                        const successEl  = form.closest('.brf-card').querySelector('.brf-success');
                        if (successEl) {
                            successEl.style.display = 'block';
                            const titleS = successEl.querySelector('.brf-success-title');
                            const msgS   = successEl.querySelector('.brf-success-msg');
                            const listEl = successEl.querySelector('.brf-brochure-links');
                            const name   = ((data.FirstName || '') + ' ' + (data.LastName || '')).trim();
                            if (titleS) titleS.textContent = t.successTitle(name);
                            if (msgS)   msgS.innerHTML     = t.successMsg(data.EmailAddress || '');
                            if (listEl) {
                                const campusBrochures = (BROCHURES[data.Campus] || {})[data.StudyLevel] || [
                                    'Brochure générale ' + (data.Campus || 'école')
                                ];
                                listEl.innerHTML = campusBrochures
                                    .map(title => `<li><a href="#" onclick="return false;">${title} (PDF)</a></li>`)
                                    .join('');
                            }
                        }
                    } else {
                        if (btn) { btn.disabled = false; btn.textContent = t.submit; }
                        alert(t.errGeneric);
                    }
                });
        });
    }

    /* ── Hook GrapesJS ───────────────────────────────────────────────── */
    function tryInitBrf() {
        try {
            const doc = editor.Canvas.getDocument();
            if (!doc) return;
            doc.querySelectorAll('.brf-form').forEach(initBrfForm);
        } catch (e) { /* canvas pas encore prêt */ }
    }

    editor.on('component:mount', tryInitBrf);
    editor.on('load',            () => setTimeout(tryInitBrf, 300));

    /* ── Enregistrement des blocs FR + EN ────────────────────────────── */
    editor.BlockManager.add('form-brochure', {
        label: 'Formulaire Brochure',
        category: categories.FORMS,
        content: buildContent('fr'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-brochure-en', {
        label: 'Formulaire Brochure Anglais',
        category: categories.FORMS,
        content: buildContent('en'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
