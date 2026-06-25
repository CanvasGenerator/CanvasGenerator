/**
 * Bloc : Formulaire Pré-candidature (FR + EN)
 * ────────────────────────────────────────────────────
 * Champs : Nom, Prénom, Email, Portable (+indicatif),
 *          Niveau d'études, Campus, Pays de résidence,
 *          Programme souhaité (masqué par défaut), RGPD
 *
 * MODE TEST — pas de <script> inline (non exécuté par GrapesJS CDN).
 * Logique interactive via editor.on('component:mount').
 * La langue est détectée via data-lang sur <form class="pc-form">.
 */

import { EDC_PICKLISTS, buildOptions } from '../shared/picklist-config.js';
import { fetchRgpdConfig } from '../shared/rgpd-config.js';

export default function (editor, categories) {

    /* ── Traductions ───────────────────────────────────────────────── */
    const TRANS = {
        fr: {
            title:        'Pré-candidature',
            subtitle:     'Déposez votre pré-candidature. Notre équipe pédagogique vous contactera rapidement.',
            lastName:     'Nom',
            lastNamePh:   'Dupont',
            firstName:    'Prénom',
            firstNamePh:  'Marie',
            email:        'Adresse e-mail',
            emailPh:      'exemple@email.com',
            mobile:       'Portable',
            mobilePh:     '06 12 34 56 78',
            studyLevel:   "Niveau d'études",
            studyLevelPh: "Niveau d'études...",
            campus:       'Campus souhaité',
            campusPh:     'Campus souhaité...',
            country:      'Pays de résidence',
            countryPh:    'Pays de résidence...',
            programme:    'Programme souhaité',
            programmePh:  'Sélectionnez un programme...',
            rgpd:         "J'accepte d'être contacté(e) par l'école pour les finalités décrites",
            rgpdLink:     'ici',
            submit:       'Je candidate',
            sending:      'Envoi en cours...',
            successTitle: 'Pré-candidature enregistrée !',
            successMsg:   (name, campus, email) =>
                `Merci ${name}, votre demande pour le campus de <strong>${campus}</strong> a bien été reçue.<br>
                Nous vous contacterons à <strong>${email}</strong>.`,
            errRequired:  'Ce champ est requis.',
            errEmailFmt:  'Format e-mail invalide.',
            errEmailDom:  'Veuillez utiliser une adresse valide.',
            errPhone:     'Numéro invalide (ex: 06 12 34 56 78).',
            errGeneric:   'Une erreur est survenue, veuillez réessayer.',
        },
        en: {
            title:        'Pre-application',
            subtitle:     'Submit your pre-application. Our academic team will contact you shortly.',
            lastName:     'Last name',
            lastNamePh:   'Smith',
            firstName:    'First name',
            firstNamePh:  'Mary',
            email:        'Email address',
            emailPh:      'example@email.com',
            mobile:       'Mobile',
            mobilePh:     '07 12 34 56 78',
            studyLevel:   'Level of study',
            studyLevelPh: 'Level of study...',
            campus:       'Desired campus',
            campusPh:     'Desired campus...',
            country:      'Country of residence',
            countryPh:    'Country of residence...',
            programme:    'Desired programme',
            programmePh:  'Select a programme...',
            rgpd:         'I agree to be contacted by the school for the purposes described',
            rgpdLink:     'here',
            submit:       'Apply now',
            sending:      'Sending...',
            successTitle: 'Pre-application received!',
            successMsg:   (name, campus, email) =>
                `Thank you ${name}, your application for the <strong>${campus}</strong> campus has been received.<br>
                We will contact you at <strong>${email}</strong>.`,
            errRequired:  'This field is required.',
            errEmailFmt:  'Invalid email format.',
            errEmailDom:  'Please use a valid email address.',
            errPhone:     'Invalid number (e.g. 07 12 34 56 78).',
            errGeneric:   'An error occurred, please try again.',
        }
    };

    /* ── Programmes de test (activables selon l'école) ─────────────── */
    const programmes = {
        fr: {
            'bac+2': ['Bachelor 1ère année', 'BTS Communication', 'BTS Design'],
            'bac+3': ['Bachelor 2ème année', 'Licence Pro Communication', 'Bachelor Spécialisé'],
            'bac+4': ['Master 1 Communication', 'Master 1 Design', 'MBA 1ère année'],
            'bac+5': ['Master 2 Communication', 'Master 2 Design', 'MBA 2ème année', 'Mastère Spécialisé'],
        },
        en: {
            'bac+2': ['1st Year Bachelor', 'Communication Studies', 'Design Studies'],
            'bac+3': ['2nd Year Bachelor', 'Professional Communication', 'Specialised Bachelor'],
            'bac+4': ['Master 1 Communication', 'Master 1 Design', 'MBA 1st Year'],
            'bac+5': ['Master 2 Communication', 'Master 2 Design', 'MBA 2nd Year', 'Specialised Master'],
        }
    };

    /* ── Générateur HTML ───────────────────────────────────────────── */
    function buildContent(lang) {
        const t = TRANS[lang];

        const studyLevelOptions = buildOptions(EDC_PICKLISTS.studyLevel, t.studyLevelPh);
        const campusOptions     = buildOptions(EDC_PICKLISTS.campus,     t.campusPh);
        const countryOptions    = buildOptions(EDC_PICKLISTS.countries,  t.countryPh);

        return `
<section class="pc-section"
  data-gjs-removable="false"
  data-gjs-copyable="false"
  data-gjs-droppable="false"
  data-gjs-highlightable="false">
<style>
.pc-section *, .pc-section *::before, .pc-section *::after { box-sizing: border-box; }
.pc-section {
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 16px; background: transparent;
    font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #222;
}
.pc-card {
    width: 100%; max-width: 520px;
    border-radius: 4px; background: #fff; padding: 24px 24px 28px;
}
.pc-title { font-size: 18px; font-weight: 700; color: #111; margin: 0 0 4px; }
.pc-subtitle { font-size: 12px; color: #666; margin: 0 0 18px; }
.pc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
.pc-field { display: flex; flex-direction: column; margin-bottom: 10px; }
.pc-row .pc-field { margin-bottom: 0; }
.pc-label { font-size: 12px; color: #333; margin-bottom: 3px; display: block; }
.pc-label .req { color: #c00; }
.pc-input, .pc-select {
    width: 100%; height: 34px; padding: 0 10px;
    border: 1px solid #bbb; border-radius: 2px;
    font-size: 13px; font-family: inherit; color: #111; background: #fff;
    outline: none; appearance: none; -webkit-appearance: none; transition: border-color 0.15s;
}
.pc-input:focus, .pc-select:focus { border-color: #888; }
.pc-input.err, .pc-select.err { border-color: #c00; }
.pc-err-msg { font-size: 10px; color: #c00; margin-top: 2px; display: none; }
.pc-err-msg.show { display: block; }
.pc-sel-wrap { position: relative; }
.pc-sel-wrap::after {
    content: ''; position: absolute; right: 10px; top: 50%;
    transform: translateY(-50%); pointer-events: none;
    border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #666;
}
.pc-phone-wrap { display: flex; gap: 6px; }
.pc-phone-prefix {
    width: 72px; flex-shrink: 0; height: 34px; padding: 0 6px;
    border: 1px solid #bbb; border-radius: 2px; font-size: 12px;
    font-family: inherit; background: #fff; appearance: none; -webkit-appearance: none; outline: none;
}
.pc-programme-wrap { display: none; }
.pc-rgpd { display: flex; align-items: flex-start; gap: 8px; margin: 10px 0 16px; }
.pc-rgpd input[type="checkbox"] { width: 14px; height: 14px; margin-top: 2px; flex-shrink: 0; cursor: pointer; accent-color: #333; }
.pc-rgpd-label { font-size: 11px; color: #333; line-height: 1.5; cursor: pointer; }
.pc-rgpd-label a { color: #333; text-decoration: underline; }
.pc-submit-wrap { display: flex; justify-content: center; }
.pc-submit {
    width: 50%; display: inline-flex; justify-content: center; align-items: center;
    padding: 11px; background: #111; color: #fff;
    border: none; border-radius: 3px; font-size: 14px; font-weight: 700;
    font-family: inherit; cursor: pointer; letter-spacing: 0.02em; transition: background 0.15s;
}
.pc-submit:hover { background: #333; }
.pc-submit:disabled { background: #888; cursor: not-allowed; }
.pc-success { display: none; text-align: center; padding: 20px 0 8px; }
.pc-success h3 { font-size: 16px; font-weight: 700; color: #111; margin: 0 0 8px; }
.pc-success p { font-size: 13px; color: #555; margin: 0; }
.pc-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #fff; border-top-color: transparent;
    border-radius: 50%; animation: pc-spin 0.7s linear infinite;
    vertical-align: middle; margin-right: 6px;
}
@keyframes pc-spin { to { transform: rotate(360deg); } }
@media(max-width:460px){ .pc-row { grid-template-columns: 1fr; } .pc-phone-prefix { width: 60px; } }
</style>

<div class="pc-card">
    <h3 class="pc-title">${t.title}</h3>
    <p class="pc-subtitle">${t.subtitle}</p>

    <!-- Succès -->
    <div class="pc-success">
        <div style="font-size:36px;margin-bottom:10px;">✅</div>
        <h3 class="pc-success-title">${t.successTitle}</h3>
        <p class="pc-success-msg"></p>
    </div>

    <!-- Formulaire -->
    <form class="pc-form" data-lang="${lang}" novalidate>
        <input type="hidden" name="submitted" value="true">
        <input type="hidden" name="Marque"    value="">

        <!-- Nom / Prénom -->
        <div class="pc-row">
            <div class="pc-field">
                <label class="pc-label">${t.lastName}<span class="req">*</span></label>
                <input class="pc-input" type="text" name="LastName" required placeholder="${t.lastNamePh}">
                <span class="pc-err-msg">${t.errRequired}</span>
            </div>
            <div class="pc-field">
                <label class="pc-label">${t.firstName}<span class="req">*</span></label>
                <input class="pc-input" type="text" name="FirstName" required placeholder="${t.firstNamePh}">
                <span class="pc-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Email / Portable -->
        <div class="pc-row">
            <div class="pc-field">
                <label class="pc-label">${t.email}<span class="req">*</span></label>
                <input class="pc-input" type="email" name="EmailAddress" required placeholder="${t.emailPh}">
                <span class="pc-err-msg">${t.errEmailFmt}</span>
            </div>
            <div class="pc-field">
                <label class="pc-label">${t.mobile}<span class="req">*</span></label>
                <div class="pc-phone-wrap">
                    <select class="pc-phone-prefix" aria-label="Prefix">
                        <option value="+33">+33</option>
                        <option value="+32">+32</option>
                        <option value="+41">+41</option>
                        <option value="+352">+352</option>
                        <option value="+1">+1</option>
                        <option value="+44">+44</option>
                        <option value="+212">+212</option>
                    </select>
                    <input class="pc-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="pc-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Niveau d'études / Campus -->
        <div class="pc-row">
            <div class="pc-field">
                <label class="pc-label">${t.studyLevel}<span class="req">*</span></label>
                <div class="pc-sel-wrap">
                    <select class="pc-select" name="StudyLevel" required>
                        ${studyLevelOptions}
                    </select>
                </div>
                <span class="pc-err-msg">${t.errRequired}</span>
            </div>
            <div class="pc-field">
                <label class="pc-label">${t.campus}<span class="req">*</span></label>
                <div class="pc-sel-wrap">
                    <select class="pc-select" name="Campus" required>
                        ${campusOptions}
                    </select>
                </div>
                <span class="pc-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Pays de résidence -->
        <div class="pc-field">
            <label class="pc-label">${t.country}<span class="req">*</span></label>
            <div class="pc-sel-wrap">
                <select class="pc-select" name="Country" required>
                    ${countryOptions}
                </select>
            </div>
            <span class="pc-err-msg">${t.errRequired}</span>
        </div>

        <!-- Programme souhaité (masqué par défaut) -->
        <div class="pc-field pc-programme-wrap">
            <label class="pc-label">${t.programme}</label>
            <div class="pc-sel-wrap">
                <select class="pc-select" name="Programme">
                    <option value="">${t.programmePh}</option>
                </select>
            </div>
        </div>

        <!-- RGPD -->
        <div class="pc-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true">
            <label class="pc-rgpd-label">
                <span data-rgpd-text>...</span> <a data-rgpd-link href="#privacy-policy" target="_blank">ici</a>
            </label>
        </div>

        <div class="pc-submit-wrap">
            <button type="submit" class="pc-submit">${t.submit}</button>
        </div>
    </form>
</div>
</section>`;
    }

    /* ══════════════════════════════════════════════════════════════════
     * LOGIQUE INTERACTIVE — via editor.on('component:mount')
     * ══════════════════════════════════════════════════════════════════ */

    const BAD_DOMAINS = ['mailinator.com','guerrillamail.com','tempmail.com',
        'yopmail.com','trashmail.com','throwam.com','spam4.me','dispostable.com'];

    function validateEmail(val, t) {
        if (!val) return t.errRequired;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return t.errEmailFmt;
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
        const wrap = field.closest('.pc-field');
        const span = wrap && wrap.querySelector('.pc-err-msg');
        if (span) { if (msg) span.textContent = msg; span.classList.add('show'); }
    }

    function clearFieldErr(field) {
        if (!field) return;
        field.classList.remove('err');
        const wrap = field.closest('.pc-field');
        const span = wrap && wrap.querySelector('.pc-err-msg');
        if (span) span.classList.remove('show');
    }

    function updateProgrammes(doc, form, levelVal, lang) {
        const progSelect = form.querySelector('[name="Programme"]');
        if (!progSelect) return;
        const t    = TRANS[lang];
        const list = (programmes[lang] || programmes.fr)[levelVal] || [];
        progSelect.innerHTML = `<option value="">${t.programmePh}</option>`
            + list.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    function handleSubmit(data) {
        return new Promise(resolve => setTimeout(() => resolve({ ok: true }), 900));
    }

    function showConfirmation(doc, data, t) {
        const form    = doc.querySelector('.pc-form');
        const success = doc.querySelector('.pc-success');
        const title   = doc.querySelector('.pc-title');
        const sub     = doc.querySelector('.pc-subtitle');
        if (form)  form.style.display  = 'none';
        if (title) title.style.display = 'none';
        if (sub)   sub.style.display   = 'none';
        if (success) {
            success.style.display = 'block';
            const msgEl = success.querySelector('.pc-success-msg');
            const name  = ((data.FirstName || '') + ' ' + (data.LastName || '')).trim();
            if (msgEl) msgEl.innerHTML = t.successMsg(name, data.Campus || '—', data.EmailAddress || '');
        }
    }

    function initPcForm(form, doc) {
        if (!form || form.dataset.pcInit) return;
        form.dataset.pcInit = '1';

        const lang    = form.dataset.lang || 'fr';
        const t       = TRANS[lang];

        /* ── RGPD : résolution depuis la source centrale ── */
        fetchRgpdConfig(lang).then(({ text, url, linkLabel }) => {
            const textEl = form.querySelector('[data-rgpd-text]');
            const linkEl = form.querySelector('[data-rgpd-link]');
            if (textEl) textEl.textContent = text;
            if (linkEl) { linkEl.textContent = linkLabel; linkEl.href = url; }
        });

        const emailEl = form.querySelector('[name="EmailAddress"]');
        const phoneEl = form.querySelector('[name="MobilePhone"]');
        const levelEl = form.querySelector('[name="StudyLevel"]');

        /* Validation temps réel */
        if (emailEl) emailEl.addEventListener('blur', function () {
            const e = validateEmail(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        if (phoneEl) phoneEl.addEventListener('blur', function () {
            const e = validatePhone(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        /* Niveau d'études → programmes */
        if (levelEl) levelEl.addEventListener('change', function () {
            updateProgrammes(doc, form, this.value, lang);
        });

        /* Soumission */
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            let ok = true;

            ['LastName', 'FirstName', 'StudyLevel', 'Campus', 'Country'].forEach(name => {
                const el = form.querySelector(`[name="${name}"]`);
                if (el && !el.value.trim()) { showFieldErr(el, t.errRequired); ok = false; }
                else if (el) clearFieldErr(el);
            });

            const ee = validateEmail((emailEl || {}).value || '', t);
            if (ee) { showFieldErr(emailEl, ee); ok = false; } else clearFieldErr(emailEl);

            const pe = validatePhone((phoneEl || {}).value || '', t);
            if (pe) { showFieldErr(phoneEl, pe); ok = false; } else clearFieldErr(phoneEl);

            if (!ok) return;

            const btn = form.querySelector('.pc-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="pc-spinner"></span>${t.sending}`; }

            const data = {};
            new FormData(form).forEach((v, k) => { data[k] = v; });

            const prefixEl = form.querySelector('.pc-phone-prefix');
            const prefix   = prefixEl ? prefixEl.value : '+33';
            const raw      = (data.MobilePhone || '').replace(/[\s\-.]/g, '').replace(/^0/, '');
            if (raw && !raw.startsWith('+')) data.MobilePhone = prefix + raw;

            const rgpd = data.RGPDConsent === 'true';
            data.HasOptedInEmail    = rgpd ? '1' : '0';
            data.HasOptedInSMS      = rgpd ? '1' : '0';
            data.HasOptedInWhatsApp = rgpd ? '1' : '0';

            handleSubmit(data).then(res => {
                if (res.ok) {
                    showConfirmation(doc, data, t);
                } else {
                    if (btn) { btn.disabled = false; btn.textContent = t.submit; }
                    alert(t.errGeneric);
                }
            });
        });
    }

    /* ── Hook GrapesJS ───────────────────────────────────────────── */
    function tryInitPc() {
        try {
            const doc = editor.Canvas.getDocument();
            if (!doc) return;
            doc.querySelectorAll('.pc-form').forEach(form => initPcForm(form, doc));
        } catch (e) { /* canvas pas encore prêt */ }
    }

    editor.on('component:mount', tryInitPc);
    editor.on('load',            () => setTimeout(tryInitPc, 300));

    /* ── Enregistrement des blocs FR + EN ────────────────────────── */
    editor.BlockManager.add('form-precandidature', {
        label: 'Formulaire Pré-candidature',
        category: categories.FORMS,
        content: buildContent('fr'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-precandidature-en', {
        label: 'Formulaire Pré-candidature Anglais',
        category: categories.FORMS,
        content: buildContent('en'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
