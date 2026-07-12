/**
 * Module partagé : moteur des formulaires d'ÉVÉNEMENT (JPO / Atelier / Stage)
 * ───────────────────────────────────────────────────────────────
 * Ces 3 formulaires partagent la même structure (campus + encart événement
 * daté + coordonnées + programme conditionnel). Ce module expose :
 *   • buildEventBlock(opts)     → génère le HTML d'une variante (FR/EN)
 *   • attachEventFormLogic(ed)  → attache la logique interactive (idempotent)
 *
 * Chaque formulaire a son propre dossier/bloc qui importe ce moteur :
 *   form-jpo/ · form-atelier/ · form-stage/
 *
 * MODE TEST : soumission simulée en JS pur, PAS de <script> inline
 * (non exécuté par GrapesJS via CDN). Logique via editor.on('component:mount').
 */

import { EDC_PICKLISTS, buildOptions } from './picklist-config.js';
import { fetchRgpdConfig } from './rgpd-config.js';
import { buildHiddenFields, populateHiddenFields } from './tracking-fields.js';
import { isProgrammeSchool, getProgrammes } from './programme-config.js';

    /* ── Picklists ──────────────────────────────────────────────────── */
    const campusOptions = buildOptions(
        EDC_PICKLISTS.campus.filter(o =>
            ['paris', 'lille', 'bordeaux', 'lyon', 'montpellier', 'nice', 'aix', 'nantes', 'toulouse', 'rennes'].includes(o.value)
        ), ''
    );
    const contactTypeOptions = buildOptions(
        EDC_PICKLISTS.contactType.filter(o => ['student', 'parent', 'professional'].includes(o.value)), ''
    );
    const studyLevelOptions = buildOptions(EDC_PICKLISTS.studyLevel, '');

    /* ── Données de test : prochaines JPO par campus ────────────────── */
    const jpoEvents = {
        fr: {
            paris:       { date: 'Samedi 14 mars 2026',  hours: '10h - 17h', address: '16 rue Jules Verne\n75011 Paris',                          conf: 'Conférence de présentation : 10h30\nConférence MBA : 14h00' },
            lille:       { date: 'Samedi 07 mars 2026',  hours: '10h - 13h', address: '1 bis, rue de Tenremonde\n59000 Lille',                     conf: 'Conférence de présentation : 10h30' },
            bordeaux:    { date: null, hours: null, address: null, conf: null },
            lyon:        { date: 'Samedi 28 mars 2026',  hours: '10h - 16h', address: '8 place Gailleton\n69002 Lyon',                             conf: 'Conférence de présentation : 10h30' },
            montpellier: { date: null, hours: null, address: null, conf: null },
            nice:        { date: 'Samedi 25 avril 2026', hours: '10h - 15h', address: '10 avenue Durante\n06000 Nice',                             conf: 'Conférence de présentation : 11h00' },
            aix:         { date: null, hours: null, address: null, conf: null },
            nantes:      { date: 'Samedi 16 mai 2026',   hours: '10h - 16h', address: "3 allée de l'Ile Gloriette\n44000 Nantes",                  conf: 'Conférence de présentation : 11h00\nConférence Bachelor : 14h30' },
            toulouse:    { date: 'Samedi 23 mai 2026',   hours: '10h - 16h', address: '5 esplanade Compans Caffarelli\n31000 Toulouse',            conf: 'Conférence de présentation : 10h30' },
            rennes:      { date: null, hours: null, address: null, conf: null }
        },
        en: {
            paris:       { date: 'Saturday, March 14 2026',  hours: '10am - 5pm', address: '16 rue Jules Verne\n75011 Paris',                      conf: 'Presentation talk: 10:30am\nMBA talk: 2:00pm' },
            lille:       { date: 'Saturday, March 7 2026',   hours: '10am - 1pm', address: '1 bis, rue de Tenremonde\n59000 Lille',                 conf: 'Presentation talk: 10:30am' },
            bordeaux:    { date: null, hours: null, address: null, conf: null },
            lyon:        { date: 'Saturday, March 28 2026',  hours: '10am - 4pm', address: '8 place Gailleton\n69002 Lyon',                        conf: 'Presentation talk: 10:30am' },
            montpellier: { date: null, hours: null, address: null, conf: null },
            nice:        { date: 'Saturday, April 25 2026',  hours: '10am - 3pm', address: '10 avenue Durante\n06000 Nice',                        conf: 'Presentation talk: 11:00am' },
            aix:         { date: null, hours: null, address: null, conf: null },
            nantes:      { date: 'Saturday, May 16 2026',    hours: '10am - 4pm', address: "3 allée de l'Ile Gloriette\n44000 Nantes",             conf: 'Presentation talk: 11:00am\nBachelor talk: 2:30pm' },
            toulouse:    { date: 'Saturday, May 23 2026',    hours: '10am - 4pm', address: '5 esplanade Compans Caffarelli\n31000 Toulouse',       conf: 'Presentation talk: 10:30am' },
            rennes:      { date: null, hours: null, address: null, conf: null }
        }
    };

    /* ── Traductions FR / EN ────────────────────────────────────────── */
    const TRANS = {
        fr: {
            campus:      'Campus',
            youAre:      'Vous êtes',
            lastName:    'Nom',
            firstName:   'Prénom',
            email:       'Adresse email',
            mobile:      'Portable',
            mobilePh:    '06 12 34 56 78',
            studyLevel:  "Niveau d'études",
            programme:   'Programme souhaité',
            programmePh: 'Sélectionnez un programme...',
            childLastName:  'Nom de votre enfant',
            childFirstName: 'Prénom de votre enfant',
            childPhone:     'Téléphone de votre enfant',
            rgpd:        "J'accepte d'être contacté(e) par l'école pour les finalités décrites",
            rgpdLink:    'ici',
            errRequired: 'Ce champ est requis.',
            errEmail:    'Format e-mail invalide.',
            errEmailDom: 'Veuillez utiliser une adresse valide.',
            errPhone:    'Numéro invalide (ex: 06 12 34 56 78).',
            errGeneric:  'Une erreur est survenue, veuillez réessayer.',
            sending:     'Envoi en cours...',
            successThanks:   name => `Merci, ${name} !`,
            successConfirm:  (date, campus, email) =>
                `Votre inscription du <strong>${date}</strong> sur le campus de <strong>${campus}</strong> a bien été enregistrée.<br>Un e-mail de confirmation sera envoyé à <strong>${email}</strong>.`,
        },
        en: {
            campus:      'Campus',
            youAre:      'You are',
            lastName:    'Last name',
            firstName:   'First name',
            email:       'Email address',
            mobile:      'Mobile',
            mobilePh:    '07 12 34 56 78',
            studyLevel:  'Level of study',
            programme:   'Desired programme',
            programmePh: 'Select a programme...',
            childLastName:  "Your child's last name",
            childFirstName: "Your child's first name",
            childPhone:     "Your child's phone",
            rgpd:        'I agree to be contacted by the school for the purposes described',
            rgpdLink:    'here',
            errRequired: 'This field is required.',
            errEmail:    'Invalid email format.',
            errEmailDom: 'Please use a valid email address.',
            errPhone:    'Invalid number (e.g. 07 12 34 56 78).',
            errGeneric:  'An error occurred, please try again.',
            sending:     'Sending...',
            successThanks:   name => `Thank you, ${name}!`,
            successConfirm:  (date, campus, email) =>
                `Your registration on <strong>${date}</strong> at the <strong>${campus}</strong> campus has been confirmed.<br>A confirmation email will be sent to <strong>${email}</strong>.`,
        }
    };

    /* ── Générateur HTML (sans <script>) ────────────────────────────── */
export function buildEventBlock({ typeEvenement, nomAction, submitLabel, formTitle, formSubtitle, lang = 'fr', showVousEtes = true, showChild = false }) {
        const t = TRANS[lang] || TRANS.fr;
        const hidden = buildHiddenFields({ formName: nomAction, formType: 'evenement', lang });
        return `
<section class="jpo-section"
  data-gjs-removable="false"
  data-gjs-copyable="false"
  data-gjs-droppable="false"
  data-gjs-highlightable="false">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.jpo-section *,
.jpo-section *::before,
.jpo-section *::after {
    box-sizing: border-box;
}

.jpo-section {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 16px;
    background: transparent;
    font-family: var(--brand-font, 'Inter', sans-serif);
    font-size: 13px;
    color: #222;
}

.jpo-card {
    width: 100%;
    max-width: 520px;
    background: #F4EFEA;
    padding: 24px 24px 28px;
    overflow: visible;
}

.jpo-campus-zone {
    background: transparent;
    padding: 0 0 10px 0;
}

.jpo-campus-zone .jpo-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a4a;
    margin-bottom: 6px;
    display: block;
}

.jpo-campus-zone .jpo-label .req {
    color: inherit;
}

.jpo-campus-select-wrap {
    position: relative;
    margin-bottom: 0;
}

.jpo-campus-select-wrap::after {
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

.jpo-campus-select {
    width: 100%;
    height: 46px;
    padding: 0 35px 0 14px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    font-weight: 600;
    color: #000;
    background: #fff;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition: border-color 0.2s;
}

.jpo-campus-select:focus {
    border-color: #666;
}

.jpo-event-card {
    display: none;
    padding: 16px 0 0;
    position: relative;
}

.jpo-event-inner {
    background: transparent;
    border-radius: 0;
    display: flex;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 12px;
}

.jpo-event-left {
    flex: 1;
}

.jpo-event-right {
    flex: 0 0 auto;
    font-size: 12px;
    color: #333;
    line-height: 1.5;
    text-align: right;
}

.jpo-event-date-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.jpo-radio-icon {
    width: 18px;
    height: 18px;
    border: 1.5px solid #000;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 2px;
}

.jpo-event-date {
    font-weight: 700;
    font-size: 13px;
    color: #000;
}

.jpo-event-detail {
    font-size: 12px;
    color: #333;
    line-height: 1.6;
    padding-left: 0;
    white-space: pre-line;
}

.jpo-pointer {
    display: none !important;
}

.jpo-form-zone {
    padding: 10px 0 0;
}

.jpo-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
}

.jpo-field.hidden {
    display: none !important;
}

.jpo-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
}

.jpo-row .jpo-field {
    margin-bottom: 0;
}

.jpo-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a4a;
    margin-bottom: 6px;
    display: block;
}

.jpo-label .req {
    color: inherit;
}

.jpo-input,
.jpo-select {
    width: 100%;
    height: 46px;
    padding: 0 14px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    color: #000;
    background: #fff;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 0.2s;
}

.jpo-input:focus,
.jpo-select:focus {
    border-color: #666;
}

.jpo-input.err,
.jpo-select.err {
    border-color: #c00;
}

.jpo-err-msg {
    font-size: 10px;
    color: #c00;
    margin-top: 4px;
    display: none;
}

.jpo-err-msg.show {
    display: block;
}

.jpo-sel-wrap {
    position: relative;
}

.jpo-sel-wrap::after {
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

.jpo-phone-wrap {
    display: flex;
    gap: 8px;
}

.jpo-phone-prefix-wrap {
    position: relative;
    width: 110px;
    flex-shrink: 0;
}

.jpo-phone-prefix-wrap::after {
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

.jpo-phone-prefix {
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

.jpo-rgpd {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 16px 0 20px;
}

.jpo-rgpd input[type="checkbox"] {
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

.jpo-rgpd input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 13px;
    font-weight: 700;
    color: #000;
}

.jpo-rgpd-label {
    font-size: 11px;
    color: #333;
    line-height: 1.5;
    cursor: pointer;
}

.jpo-rgpd-label a {
    color: #000;
    text-decoration: underline;
}

.jpo-submit-wrap {
    display: block;
    width: 100%;
}

.jpo-submit {
    width: 100%;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 14px;
    background: #000;
    color: #fff;
    border: none;
    border-radius: 0;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: background 0.15s;
}

.jpo-submit::after {
    content: ' →';
}

.jpo-submit:hover {
    background: #222;
}

.jpo-submit:disabled {
    background: #888;
    cursor: not-allowed;
}

.jpo-success {
    display: none;
    padding: 16px 0 8px;
    text-align: center;
}

.jpo-success h3 {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 8px;
    color: #111;
}

.jpo-success p {
    font-size: 13px;
    color: #555;
    margin: 0;
}

.jpo-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #fff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: jpo-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
}

@keyframes jpo-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 460px) {
    .jpo-row {
        grid-template-columns: 1fr;
    }

    .jpo-phone-prefix-wrap {
        width: 90px;
    }

    .jpo-event-inner {
        flex-direction: column;
        gap: 8px;
    }

    .jpo-event-right {
        max-width: 100%;
        text-align: left;
    }
}
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="jpo-card">

    <div class="jpo-campus-zone">
        <label class="jpo-label">Campus<span class="req">*</span></label>
        <div class="jpo-campus-select-wrap">
            <select class="jpo-campus-select" name="Campus" required>
                ${campusOptions}
            </select>
        </div>
        <div class="jpo-event-card">
            <div class="jpo-event-inner">
                <div class="jpo-event-left">
                    <div class="jpo-event-date-row">
                        <div class="jpo-radio-icon"></div>
                        <span class="jpo-event-date"></span>
                    </div>
                    <div class="jpo-event-detail"></div>
                </div>
                <div class="jpo-event-right"></div>
            </div>
        </div>
    </div>

    <div class="jpo-pointer"></div>

    <div class="jpo-success">
        <div style="font-size:36px;margin-bottom:10px;">✅</div>
        <h3 class="jpo-success-thanks"></h3>
        <p class="jpo-success-msg"></p>
    </div>

    <div class="jpo-form-zone">
    <form class="jpo-form" data-lang="${lang}" novalidate>
${hidden}
        <input type="hidden" name="TypeEvenement" value="${typeEvenement}">
        <input type="hidden" name="EventDate"     value="">
${showVousEtes ? `
        <div class="jpo-row">
            <div class="jpo-field">
                <label class="jpo-label">${t.youAre}<span class="req">*</span></label>
                <div class="jpo-sel-wrap">
                    <select class="jpo-select" name="VousEtes" required>
                        ${contactTypeOptions}
                    </select>
                </div>
                <span class="jpo-err-msg">${t.errRequired}</span>
            </div>
            <div class="jpo-field">
                <label class="jpo-label">${t.studyLevel}<span class="req">*</span></label>
                <div class="jpo-sel-wrap">
                    <select class="jpo-select jpo-niveau" name="StudyLevel" required>
                        ${studyLevelOptions}
                    </select>
                </div>
                <span class="jpo-err-msg">${t.errRequired}</span>
            </div>
        </div>` : `
        <div class="jpo-field">
            <label class="jpo-label">${t.studyLevel}<span class="req">*</span></label>
            <div class="jpo-sel-wrap">
                <select class="jpo-select jpo-niveau" name="StudyLevel" required>
                    ${studyLevelOptions}
                </select>
            </div>
            <span class="jpo-err-msg">${t.errRequired}</span>
        </div>`}

        <div class="jpo-row">
            <div class="jpo-field">
                <label class="jpo-label">${t.lastName}<span class="req">*</span></label>
                <input class="jpo-input" type="text" name="LastName" required>
                <span class="jpo-err-msg">${t.errRequired}</span>
            </div>
            <div class="jpo-field">
                <label class="jpo-label">${t.firstName}<span class="req">*</span></label>
                <input class="jpo-input" type="text" name="FirstName" required>
                <span class="jpo-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <div class="jpo-row">
            <div class="jpo-field">
                <label class="jpo-label">${t.email}<span class="req">*</span></label>
                <input class="jpo-input" type="email" name="EmailAddress" required>
                <span class="jpo-err-msg">${t.errEmail}</span>
            </div>
            <div class="jpo-field">
                <label class="jpo-label">${t.mobile}<span class="req">*</span></label>
                <div class="jpo-phone-wrap">
                    <div class="jpo-phone-prefix-wrap">
                        <select class="jpo-phone-prefix" aria-label="Prefix">
                            <option value="+33" selected>FR (+33)</option>
                            <option value="+32">BE (+32)</option>
                            <option value="+41">CH (+41)</option>
                            <option value="+352">LU (+352)</option>
                            <option value="+1">US (+1)</option>
                            <option value="+44">GB (+44)</option>
                            <option value="+212">MA (+212)</option>
                        </select>
                    </div>
                    <input class="jpo-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="jpo-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Programme souhaité (conditionnel : niveau + campus + école) -->
        <div class="jpo-field jpo-programme-field hidden">
            <label class="jpo-label">${t.programme}</label>
            <div class="jpo-sel-wrap">
                <select class="jpo-select jpo-programme-select" name="Programme">
                    <option value="">${t.programmePh}</option>
                </select>
            </div>
        </div>
${showChild ? `
        <!-- Champs conditionnels parent (facultatifs) -->
        <div class="jpo-field jpo-child-ln-field hidden">
            <label class="jpo-label">${t.childLastName}</label>
            <input class="jpo-input" type="text" name="ChildLastName">
        </div>
        <div class="jpo-field jpo-child-fn-field hidden">
            <label class="jpo-label">${t.childFirstName}</label>
            <input class="jpo-input" type="text" name="ChildFirstName">
        </div>
        <div class="jpo-field jpo-child-phone-field hidden">
            <label class="jpo-label">${t.childPhone}</label>
            <input class="jpo-input jpo-child-phone-input" type="tel" name="ChildPhone">
            <span class="jpo-err-msg">${t.errPhone}</span>
        </div>` : ''}

        <div class="jpo-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true">
            <label class="jpo-rgpd-label">
                <span data-rgpd-text>...</span>
                <a data-rgpd-link href="#privacy-policy" target="_blank">ici</a>
            </label>
        </div>

        <div class="jpo-submit-wrap">
            <button type="submit" class="jpo-submit">${submitLabel}</button>
        </div>
    </form>
    </div>

</div><!-- /.jpo-card -->
</section>`;
    }

    /* ══════════════════════════════════════════════════════════════════
     * LOGIQUE INTERACTIVE — exécutée depuis le module (pas inline)
     * Accède aux éléments du canvas via editor.Canvas.getDocument()
     * ══════════════════════════════════════════════════════════════════ */

    const BAD_DOMAINS = ['mailinator.com', 'guerrillamail.com', 'tempmail.com',
        'yopmail.com', 'trashmail.com', 'throwam.com', 'spam4.me', 'dispostable.com'];

    function validateEmail(val, t) {
        if (!val) return t.errRequired;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return t.errEmail;
        const domain = val.split('@')[1].toLowerCase();
        if (BAD_DOMAINS.includes(domain)) return t.errEmailDom;
        return null;
    }

    function validatePhone(val, t) {
        if (!val) return t.errRequired;
        const d = val.replace(/[\s\-\.()]/g, '').replace(/^0/, '');
        if (!/^[0-9]{7,14}$/.test(d)) return t.errPhone;
        return null;
    }

    function showFieldErr(field, msg) {
        if (!field) return;
        field.classList.add('err');
        const errSpan = field.closest('.jpo-field') && field.closest('.jpo-field').querySelector('.jpo-err-msg');
        if (errSpan) { if (msg) errSpan.textContent = msg; errSpan.classList.add('show'); }
    }

    function clearFieldErr(field) {
        if (!field) return;
        field.classList.remove('err');
        const errSpan = field.closest('.jpo-field') && field.closest('.jpo-field').querySelector('.jpo-err-msg');
        if (errSpan) errSpan.classList.remove('show');
    }

    function updateEventCard(doc, campusVal) {
        const card = doc.querySelector('.jpo-event-card');
        const dateEl = doc.querySelector('.jpo-event-date');
        const addrEl = doc.querySelector('.jpo-event-detail');
        const confEl = doc.querySelector('.jpo-event-right');
        const hidden = doc.querySelector('input[name="EventDate"]');
        if (!card) return;

        const ev = jpoEvents[campusVal];
        if (ev && ev.date) {
            if (dateEl) dateEl.textContent = ev.date;
            if (addrEl) addrEl.innerHTML = ev.hours + '<br>' + ev.address.replace(/\n/g, '<br>');
            if (confEl) {
                if (ev.conf) { confEl.style.display = ''; confEl.innerHTML = ev.conf.replace(/\n/g, '<br>'); }
                else { confEl.style.display = 'none'; confEl.innerHTML = ''; }
            }
            if (hidden) hidden.value = ev.date;
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
            if (hidden) hidden.value = '';
        }
    }

    function handleSubmit(data) {
        return new Promise(resolve => setTimeout(() => resolve({ ok: true }), 900));
    }

    function showConfirmation(card, data, t) {
        const formZone = card.querySelector('.jpo-form-zone');
        const success  = card.querySelector('.jpo-success');
        if (formZone) formZone.style.display = 'none';
        if (success) {
            success.style.display = 'block';
            const name = ((data.FirstName || '') + ' ' + (data.LastName || '')).trim();
            const thanks = success.querySelector('.jpo-success-thanks');
            const msg    = success.querySelector('.jpo-success-msg');
            if (thanks) thanks.textContent = t.successThanks(name);
            if (msg)    msg.innerHTML      = t.successConfirm(data.EventDate || '—', data.Campus || '—', data.EmailAddress || '');
        }
    }

/* ══════════════════════════════════════════════════════════════════
 * Attache la logique interactive (idempotent : une seule fois par éditeur)
 * ══════════════════════════════════════════════════════════════════ */
export function attachEventFormLogic(editor) {
    if (editor.__eventFormLogicAttached) return;
    editor.__eventFormLogicAttached = true;

    /* ── Initialise un campus-select (scopé à sa .jpo-card) ─────── */
    function initOneCampusSelect(campusSelect) {
        if (campusSelect.dataset.jpoInit) return;
        campusSelect.dataset.jpoInit = '1';

        const card = campusSelect.closest('.jpo-card');
        if (!card) return;

        const form = card.querySelector('.jpo-form');
        const lang = (form && form.dataset.lang) || 'fr';
        const t    = TRANS[lang] || TRANS.fr;

        /* ── RGPD : résolution depuis la source centrale ── */
        fetchRgpdConfig(lang).then(({ text, url, linkLabel }) => {
            const textEl = card.querySelector('[data-rgpd-text]');
            const linkEl = card.querySelector('[data-rgpd-link]');
            if (textEl) textEl.textContent = text;
            if (linkEl) { linkEl.textContent = linkLabel; linkEl.href = url; }
        });

        /* Scoped updateEventCard */
        function updateCard(val) {
            const cardEl = card.querySelector('.jpo-event-card');
            const dateEl = card.querySelector('.jpo-event-date');
            const addrEl = card.querySelector('.jpo-event-detail');
            const confEl = card.querySelector('.jpo-event-right');
            const hidden = card.querySelector('input[name="EventDate"]');
            const ev = (jpoEvents[lang] || jpoEvents.fr)[val];
            if (ev && ev.date) {
                if (dateEl) dateEl.textContent = ev.date;
                if (addrEl) addrEl.innerHTML = ev.hours + '<br>' + ev.address.replace(/\n/g, '<br>');
                if (confEl) {
                    if (ev.conf) { confEl.style.display = ''; confEl.innerHTML = ev.conf.replace(/\n/g, '<br>'); }
                    else         { confEl.style.display = 'none'; confEl.innerHTML = ''; }
                }
                if (hidden) hidden.value = ev.date;
                if (cardEl) cardEl.style.display = 'block';
            } else {
                if (cardEl) cardEl.style.display = 'none';
                if (hidden) hidden.value = '';
            }
        }

        campusSelect.addEventListener('change', function () {
            updateCard(this.value);
            if (form) {
                let h = form.querySelector('[name="Campus"]');
                if (!h) {
                    const doc = editor.Canvas.getDocument();
                    h = doc.createElement('input'); h.type = 'hidden'; h.name = 'Campus';
                    form.appendChild(h);
                }
                h.value = this.value;
            }
        });
        updateCard(campusSelect.value);

        if (!form) return;

        /* ── Champs cachés (tracking / CRM) ── */
        populateHiddenFields(form, { lang });

        /* ── Programme conditionnel (niveau + campus + école) ── */
        const niveauEl        = form.querySelector('.jpo-niveau');
        const vousEtesEl      = form.querySelector('[name="VousEtes"]');
        const programmeField  = form.querySelector('.jpo-programme-field');
        const programmeSelect = form.querySelector('.jpo-programme-select');
        const childPhoneEl    = form.querySelector('.jpo-child-phone-input');

        const school = (() => {
            try { return (form.ownerDocument.defaultView || window).CURRENT_SCHOOL || null; }
            catch (e) { return null; }
        })();
        const showProgramme = isProgrammeSchool(school);

        function refreshProgramme() {
            if (!programmeField || !programmeSelect) return;
            const niveau = niveauEl ? niveauEl.value : '';
            const campus = campusSelect ? campusSelect.value : '';
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

        function refreshChild() {
            const isParent = vousEtesEl && vousEtesEl.value === 'parent';
            ['jpo-child-ln-field', 'jpo-child-fn-field', 'jpo-child-phone-field'].forEach(cls => {
                const f = form.querySelector('.' + cls);
                if (f) f.classList.toggle('hidden', !isParent);
            });
            if (!isParent) {
                ['ChildLastName', 'ChildFirstName', 'ChildPhone'].forEach(n => {
                    const el = form.querySelector(`[name="${n}"]`);
                    if (el) el.value = '';
                });
            }
        }

        if (niveauEl)   niveauEl.addEventListener('change', refreshProgramme);
        if (vousEtesEl) vousEtesEl.addEventListener('change', refreshChild);
        campusSelect.addEventListener('change', refreshProgramme);
        refreshProgramme();
        refreshChild();

        const emailEl = form.querySelector('[name="EmailAddress"]');
        if (emailEl) emailEl.addEventListener('blur', function () {
            const e = validateEmail(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        const phoneEl = form.querySelector('[name="MobilePhone"]');
        if (phoneEl) phoneEl.addEventListener('blur', function () {
            const e = validatePhone(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            let ok = true;

            ['VousEtes', 'LastName', 'FirstName', 'StudyLevel'].forEach(name => {
                const el = form.querySelector(`[name="${name}"]`);
                if (el && !el.value.trim()) { showFieldErr(el, t.errRequired); ok = false; }
                else if (el) clearFieldErr(el);
            });

            if (!campusSelect.value) { campusSelect.classList.add('err'); ok = false; }
            else campusSelect.classList.remove('err');

            const ee = validateEmail((emailEl || {}).value || '', t);
            if (ee) { showFieldErr(emailEl, ee); ok = false; } else clearFieldErr(emailEl);

            const pe = validatePhone((phoneEl || {}).value || '', t);
            if (pe) { showFieldErr(phoneEl, pe); ok = false; } else clearFieldErr(phoneEl);

            const childPhoneField = form.querySelector('.jpo-child-phone-field');
            if (childPhoneField && !childPhoneField.classList.contains('hidden') && childPhoneEl && childPhoneEl.value.trim()) {
                const ce = validatePhone(childPhoneEl.value.trim(), t);
                if (ce) { showFieldErr(childPhoneEl, ce); ok = false; } else clearFieldErr(childPhoneEl);
            }

            if (!ok) return;

            const btn = form.querySelector('.jpo-submit');
            const originalLabel = btn ? btn.textContent : '';
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="jpo-spinner"></span>${t.sending}`; }

            const data = { Campus: campusSelect.value };
            new FormData(form).forEach((v, k) => { data[k] = v; });

            const prefixEl = form.querySelector('.jpo-phone-prefix');
            const prefix = prefixEl ? prefixEl.value : '+33';
            const raw = (data.MobilePhone || '').replace(/[\s\-.]/g, '').replace(/^0/, '');
            if (!raw.startsWith('+')) data.MobilePhone = prefix + raw;

            const rgpd = data.RGPDConsent === 'true';
            data.HasOptedInEmail    = rgpd ? '1' : '0';
            data.HasOptedInSMS      = rgpd ? '1' : '0';
            data.HasOptedInWhatsApp = rgpd ? '1' : '0';
            data.HasOptedInPhone    = rgpd ? '1' : '0';

            handleSubmit(data).then(res => {
                if (res.ok) {
                    showConfirmation(card, data, t);
                } else {
                    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
                    alert(t.errGeneric);
                }
            });
        });
    }

    /* ── Hook GrapesJS ───────────────────────────────────────────── */
    function tryInitAll() {
        try {
            const doc = editor.Canvas.getDocument();
            if (!doc) return;
            doc.querySelectorAll('.jpo-campus-select').forEach(initOneCampusSelect);
        } catch (e) { /* canvas pas encore prêt */ }
    }

    editor.on('component:mount', tryInitAll);
    editor.on('load', () => setTimeout(tryInitAll, 300));
}
