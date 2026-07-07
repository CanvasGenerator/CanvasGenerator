/**
 * Bloc : Formulaire Candidature (FR + EN)
 * ─────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — onglet « Candidature »
 * (commun FR + international). Écoles concernées : EFAP, BRASSART, ESEC,
 * CREAD, ICART, MOPA, Ecole Bleue, IFA Paris, EFJ, 3WA.
 *
 * Champs visibles : Nom, Prénom, Pays de résidence, Email, Indicatif + Téléphone,
 *                   Niveau d'études, Campus, Programme souhaité (conditionnel), RGPD.
 * Champs cachés    : Marque, LangueSouhaitee (défaut « français » pour IFA Paris),
 *                    tracking (utm_*, gclid, consent…) via shared/tracking-fields.
 *
 * À la soumission : message invitant à consulter sa boîte mail
 * (mail d'activation vers le portail candidature).
 *
 * MODE TEST — soumission simulée en JS pur, PAS de <script> inline.
 * Logique via editor.on('component:mount').
 */

import { EDC_PICKLISTS, buildOptions } from '../shared/picklist-config.js';
import { fetchRgpdConfig } from '../shared/rgpd-config.js';
import { buildHiddenFields, populateHiddenFields } from '../shared/tracking-fields.js';
import { isProgrammeSchool, getProgrammes } from '../shared/programme-config.js';

export default function (editor, categories) {

    /* ── Traductions FR / EN ─────────────────────────────────────────── */
    const TRANS = {
        fr: {
            title:       'Candidature',
            subtitle:    'Déposez votre candidature. Vous recevrez un e-mail pour accéder à votre portail candidat.',
            lastName:    'Nom',
            firstName:   'Prénom',
            country:     'Pays de résidence',
            email:       'Adresse email',
            mobile:      'Portable',
            mobilePh:    '06 12 34 56 78',
            studyLevel:  "Niveau d'études",
            campus:      'Campus',
            programme:   'Programme souhaité',
            programmePh: 'Sélectionnez un programme...',
            rgpdLink:    'ici',
            submit:      'Je candidate',
            sending:     'Envoi en cours...',
            successTitle: name => `Merci, ${name} !`,
            successMsg:  email =>
                `Votre candidature a bien été enregistrée.<br>Consultez votre boîte mail : un e-mail vient d'être envoyé à <strong>${email}</strong> pour activer votre compte et accéder au portail candidature.`,
            errRequired: 'Ce champ est requis.',
            errEmail:    'Format e-mail invalide.',
            errEmailDom: 'Veuillez utiliser une adresse valide.',
            errPhone:    'Numéro invalide (ex: 06 12 34 56 78).',
            errGeneric:  'Une erreur est survenue, veuillez réessayer.',
        },
        en: {
            title:       'Application',
            subtitle:    'Submit your application. You will receive an email to access your applicant portal.',
            lastName:    'Last name',
            firstName:   'First name',
            country:     'Country of residence',
            email:       'Email address',
            mobile:      'Mobile',
            mobilePh:    '07 12 34 56 78',
            studyLevel:  'Level of study',
            campus:      'Campus',
            programme:   'Desired programme',
            programmePh: 'Select a programme...',
            rgpdLink:    'here',
            submit:      'Apply now',
            sending:     'Sending...',
            successTitle: name => `Thank you, ${name}!`,
            successMsg:  email =>
                `Your application has been registered.<br>Please check your inbox: an email has just been sent to <strong>${email}</strong> to activate your account and access the application portal.`,
            errRequired: 'This field is required.',
            errEmail:    'Invalid email format.',
            errEmailDom: 'Please use a valid email address.',
            errPhone:    'Invalid number (e.g. 07 12 34 56 78).',
            errGeneric:  'An error occurred, please try again.',
        }
    };

    /* ── Générateur HTML ─────────────────────────────────────────────── */
    function buildContent(lang) {
        const t = TRANS[lang] || TRANS.fr;
        const studyLevelOptions = buildOptions(EDC_PICKLISTS.studyLevel, '');
        const campusOptions      = buildOptions(EDC_PICKLISTS.campus,      '');
        const countryOptions     = buildOptions(EDC_PICKLISTS.countries,   '');
        const hidden = buildHiddenFields({ formName: 'Candidature', formType: 'candidature', lang });

        return `
<section class="cnd-section"
  data-gjs-removable="false"
  data-gjs-copyable="false"
  data-gjs-droppable="false"
  data-gjs-highlightable="false">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.cnd-section *, .cnd-section *::before, .cnd-section *::after { box-sizing: border-box; }
.cnd-section {
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 16px; background: transparent;
    font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222;
}
.cnd-card {
    width: 100%; max-width: 520px;
    background: #F4EFEA; padding: 24px 24px 28px;
}
.cnd-title { font-size: 18px; font-weight: 700; color: #111; margin: 0 0 4px; }
.cnd-subtitle { font-size: 12px; color: #666; margin: 0 0 18px; }
.cnd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.cnd-field { display: flex; flex-direction: column; margin-bottom: 12px; }
.cnd-row .cnd-field { margin-bottom: 0; }
.cnd-field.hidden { display: none; }
.cnd-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a4a;
    margin-bottom: 6px;
    display: block;
}
.cnd-label .req { color: inherit; }
.cnd-input, .cnd-select {
    width: 100%; height: 46px; padding: 0 14px;
    border: 1px solid #000; border-radius: 0;
    font-size: 13px; font-family: inherit; color: #000; background: #fff;
    outline: none; appearance: none; -webkit-appearance: none; transition: border-color 0.2s;
}
.cnd-input:focus, .cnd-select:focus { border-color: #666; }
.cnd-input.err, .cnd-select.err { border-color: #c00; }
.cnd-err-msg { font-size: 10px; color: #c00; margin-top: 4px; display: none; }
.cnd-err-msg.show { display: block; }
.cnd-sel-wrap { position: relative; }
.cnd-sel-wrap::after {
    content: '';
    position: absolute;
    right: 16px;
    top: 50%;
    width: 10px;
    height: 10px;
    border-right: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
}
.cnd-phone-wrap { display: flex; gap: 8px; }
.cnd-phone-prefix-wrap {
    position: relative;
    width: 110px;
    flex-shrink: 0;
}
.cnd-phone-prefix-wrap::after {
    content: '';
    position: absolute;
    right: 14px;
    top: 50%;
    width: 8px;
    height: 8px;
    border-right: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
}
.cnd-phone-prefix {
    width: 100%;
    height: 46px;
    padding: 0 24px 0 12px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    color: #000;
    background: #fff;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    cursor: pointer;
}
.cnd-rgpd { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0 20px; }
.cnd-rgpd input[type="checkbox"] {
    width: 18px;
    height: 18px;
    border: 1px solid #000;
    border-radius: 0;
    background: #fff;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    flex-shrink: 0;
    margin-top: 0;
}
.cnd-rgpd input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 13px;
    font-weight: 700;
    color: #000;
}
.cnd-rgpd-label { font-size: 11px; color: #333; line-height: 1.5; cursor: pointer; }
.cnd-rgpd-label a { color: #000; text-decoration: underline; }
.cnd-submit-wrap { display: block; width: 100%; }
.cnd-submit {
    width: 100%; display: inline-flex; justify-content: center; align-items: center;
    padding: 14px; background: #000; color: #fff;
    border: none; border-radius: 0; font-size: 14px; font-weight: 700;
    font-family: inherit; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: background 0.15s;
}
.cnd-submit::after {
    content: ' →';
}
.cnd-submit:hover { background: #222; }
.cnd-submit:disabled { background: #888; cursor: not-allowed; }
.cnd-success { display: none; padding: 16px 0 8px; text-align: center; }
.cnd-success h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: #111; }
.cnd-success p { font-size: 13px; color: #555; margin: 0; }
.cnd-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #fff; border-top-color: transparent;
    border-radius: 50%; animation: cnd-spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px;
}
@keyframes cnd-spin { to { transform: rotate(360deg); } }
@media(max-width:460px){
    .cnd-row { grid-template-columns: 1fr; }
    .cnd-phone-prefix-wrap { width: 90px; }
}
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="cnd-card">

    <h3 class="cnd-title">${t.title}</h3>
    <p class="cnd-subtitle">${t.subtitle}</p>

    <!-- Confirmation (masquée initialement) -->
    <div class="cnd-success">
        <div style="font-size:40px;margin-bottom:10px;">📧</div>
        <h3 class="cnd-success-title"></h3>
        <p class="cnd-success-msg"></p>
    </div>

    <!-- Formulaire -->
    <form class="cnd-form" data-lang="${lang}" novalidate>
${hidden}

        <!-- Nom / Prénom -->
        <div class="cnd-row">
            <div class="cnd-field">
                <label class="cnd-label">${t.lastName}<span class="req">*</span></label>
                <input class="cnd-input" type="text" name="LastName" required>
                <span class="cnd-err-msg">${t.errRequired}</span>
            </div>
            <div class="cnd-field">
                <label class="cnd-label">${t.firstName}<span class="req">*</span></label>
                <input class="cnd-input" type="text" name="FirstName" required>
                <span class="cnd-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Pays de résidence -->
        <div class="cnd-field">
            <label class="cnd-label">${t.country}<span class="req">*</span></label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select cnd-country" name="Country" required>
                    ${countryOptions}
                </select>
            </div>
            <span class="cnd-err-msg">${t.errRequired}</span>
        </div>

        <!-- Email / Portable -->
        <div class="cnd-row">
            <div class="cnd-field">
                <label class="cnd-label">${t.email}<span class="req">*</span></label>
                <input class="cnd-input cnd-email-input" type="email" name="EmailAddress" required>
                <span class="cnd-err-msg">${t.errEmail}</span>
            </div>
            <div class="cnd-field">
                <label class="cnd-label">${t.mobile}<span class="req">*</span></label>
                <div class="cnd-phone-wrap">
                    <div class="cnd-phone-prefix-wrap">
                        <select class="cnd-phone-prefix" aria-label="Prefix">
                            <option value="+33" selected>FR (+33)</option>
                            <option value="+32">BE (+32)</option>
                            <option value="+41">CH (+41)</option>
                            <option value="+352">LU (+352)</option>
                            <option value="+1">US (+1)</option>
                            <option value="+44">GB (+44)</option>
                            <option value="+212">MA (+212)</option>
                        </select>
                    </div>
                    <input class="cnd-input cnd-phone-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="cnd-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Niveau d'études / Campus -->
        <div class="cnd-row">
            <div class="cnd-field">
                <label class="cnd-label">${t.studyLevel}<span class="req">*</span></label>
                <div class="cnd-sel-wrap">
                    <select class="cnd-select cnd-niveau" name="StudyLevel" required>
                        ${studyLevelOptions}
                    </select>
                </div>
                <span class="cnd-err-msg">${t.errRequired}</span>
            </div>
            <div class="cnd-field">
                <label class="cnd-label">${t.campus}<span class="req">*</span></label>
                <div class="cnd-sel-wrap">
                    <select class="cnd-select cnd-campus" name="Campus" required>
                        ${campusOptions}
                    </select>
                </div>
                <span class="cnd-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Programme souhaité (conditionnel : niveau + campus + école) -->
        <div class="cnd-field cnd-programme-field hidden">
            <label class="cnd-label">${t.programme}</label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select cnd-programme-select" name="Programme">
                    <option value="">${t.programmePh}</option>
                </select>
            </div>
        </div>

        <!-- RGPD -->
        <div class="cnd-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true">
            <label class="cnd-rgpd-label">
                <span data-rgpd-text>...</span> <a data-rgpd-link href="#privacy-policy" target="_blank">${t.rgpdLink}</a>
            </label>
        </div>

        <div class="cnd-submit-wrap">
            <button type="submit" class="cnd-submit">${t.submit}</button>
        </div>
    </form>

</div><!-- /.cnd-card -->
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
        const wrap = field.closest('.cnd-field');
        const span = wrap && wrap.querySelector('.cnd-err-msg');
        if (span) { if (msg) span.textContent = msg; span.classList.add('show'); }
    }

    function clearFieldErr(field) {
        if (!field) return;
        field.classList.remove('err');
        const wrap = field.closest('.cnd-field');
        const span = wrap && wrap.querySelector('.cnd-err-msg');
        if (span) span.classList.remove('show');
    }

    function initCndForm(form) {
        if (!form || form.dataset.cndInit) return;
        form.dataset.cndInit = '1';

        const lang = form.dataset.lang || 'fr';
        const t    = TRANS[lang] || TRANS.fr;

        /* ── RGPD centralisé ── */
        fetchRgpdConfig(lang).then(({ text, url, linkLabel }) => {
            const textEl = form.querySelector('[data-rgpd-text]');
            const linkEl = form.querySelector('[data-rgpd-link]');
            if (textEl) textEl.textContent = text;
            if (linkEl) { linkEl.textContent = linkLabel; linkEl.href = url; }
        });

        /* ── Champs cachés (tracking / CRM + langue souhaitée IFA) ── */
        populateHiddenFields(form, { lang });

        const niveauEl        = form.querySelector('.cnd-niveau');
        const campusEl        = form.querySelector('.cnd-campus');
        const emailEl         = form.querySelector('.cnd-email-input');
        const phoneEl         = form.querySelector('.cnd-phone-input');
        const programmeField  = form.querySelector('.cnd-programme-field');
        const programmeSelect = form.querySelector('.cnd-programme-select');

        const school = (() => {
            try { return (form.ownerDocument.defaultView || window).CURRENT_SCHOOL || null; }
            catch (e) { return null; }
        })();
        const showProgramme = isProgrammeSchool(school);

        function refreshProgramme() {
            if (!programmeField || !programmeSelect) return;
            const niveau = niveauEl ? niveauEl.value : '';
            const campus = campusEl ? campusEl.value : '';
            const progs  = showProgramme ? getProgrammes(niveau, campus, lang) : [];
            if (progs.length > 0) {
                programmeSelect.innerHTML = `<option value="">${t.programmePh}</option>`
                    + progs.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
                programmeField.classList.remove('hidden');
            } else {
                programmeField.classList.add('hidden');
                programmeSelect.value = '';
            }
        }

        if (niveauEl) niveauEl.addEventListener('change', refreshProgramme);
        if (campusEl) campusEl.addEventListener('change', refreshProgramme);
        refreshProgramme();

        if (emailEl) emailEl.addEventListener('blur', function () {
            const e = validateEmail(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });
        if (phoneEl) phoneEl.addEventListener('blur', function () {
            const e = validatePhone(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            let ok = true;

            ['LastName', 'FirstName', 'Country', 'StudyLevel', 'Campus'].forEach(name => {
                const el = form.querySelector(`[name="${name}"]`);
                if (el && !el.value.trim()) { showFieldErr(el, t.errRequired); ok = false; }
                else if (el) clearFieldErr(el);
            });

            const ee = validateEmail((emailEl || {}).value || '', t);
            if (ee) { showFieldErr(emailEl, ee); ok = false; } else clearFieldErr(emailEl);

            const pe = validatePhone((phoneEl || {}).value || '', t);
            if (pe) { showFieldErr(phoneEl, pe); ok = false; } else clearFieldErr(phoneEl);

            if (!ok) {
                const firstErr = form.querySelector('.cnd-input.err, .cnd-select.err');
                if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            const btn = form.querySelector('.cnd-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="cnd-spinner"></span>${t.sending}`; }

            const data = {};
            new FormData(form).forEach((v, k) => { data[k] = v; });

            const prefixEl = form.querySelector('.cnd-phone-prefix');
            const prefix   = prefixEl ? prefixEl.value : '+33';
            const raw      = (data.MobilePhone || '').replace(/[\s\-.]/g, '').replace(/^0/, '');
            if (raw && !raw.startsWith('+')) data.MobilePhone = prefix + raw;

            const rgpd = data.RGPDConsent === 'true';
            data.HasOptedInEmail    = rgpd ? '1' : '0';
            data.HasOptedInSMS      = rgpd ? '1' : '0';
            data.HasOptedInWhatsApp = rgpd ? '1' : '0';
            data.HasOptedInPhone    = rgpd ? '1' : '0';

            /* MODE TEST : simulation d'envoi */
            new Promise(resolve => setTimeout(() => resolve({ ok: true }), 1000))
                .then(res => {
                    if (res.ok) {
                        form.style.display = 'none';
                        const card    = form.closest('.cnd-card');
                        const titleEl = card.querySelector('.cnd-title');
                        const subEl   = card.querySelector('.cnd-subtitle');
                        if (titleEl) titleEl.style.display = 'none';
                        if (subEl)   subEl.style.display   = 'none';

                        const successEl = card.querySelector('.cnd-success');
                        if (successEl) {
                            successEl.style.display = 'block';
                            const name   = ((data.FirstName || '') + ' ' + (data.LastName || '')).trim();
                            const titleS = successEl.querySelector('.cnd-success-title');
                            const msgS   = successEl.querySelector('.cnd-success-msg');
                            if (titleS) titleS.textContent = t.successTitle(name);
                            if (msgS)   msgS.innerHTML     = t.successMsg(data.EmailAddress || '');
                        }
                    } else {
                        if (btn) { btn.disabled = false; btn.textContent = t.submit; }
                        alert(t.errGeneric);
                    }
                });
        });
    }

    /* ── Hook GrapesJS ───────────────────────────────────────────────── */
    function tryInitCnd() {
        try {
            const doc = editor.Canvas.getDocument();
            if (!doc) return;
            doc.querySelectorAll('.cnd-form').forEach(initCndForm);
        } catch (e) { /* canvas pas encore prêt */ }
    }

    editor.on('component:mount', tryInitCnd);
    editor.on('load',            () => setTimeout(tryInitCnd, 300));

    /* ── Enregistrement des blocs FR + EN ────────────────────────────── */
    editor.BlockManager.add('form-candidature', {
        label: 'Formulaire Candidature',
        category: categories.FORMS,
        content: buildContent('fr'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-candidature-en', {
        label: 'Formulaire Candidature Anglais',
        category: categories.FORMS,
        content: buildContent('en'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
