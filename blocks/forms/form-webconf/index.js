/**
 * Bloc : Formulaire Inscription Webconférence
 * ───────────────────────────────────────────────────────────────
 * Même architecture que form-jpo :
 * - Pas de <script> inline dans le HTML
 * - Logique interactive via editor.on('component:mount')
 * - Préfixe CSS : wbc-
 * - 2 blocs : FR + EN
 */

import { EDC_PICKLISTS, buildOptions } from '../shared/picklist-config.js';
import { fetchRgpdConfig, resolveRgpdConfig } from '../shared/rgpd-config.js';

export default function (editor, categories) {

    /* ── Picklists ──────────────────────────────────────────────────── */
    const contactTypeOptions = buildOptions(
        EDC_PICKLISTS.contactType.filter(o => ['student', 'parent', 'professional'].includes(o.value)), ''
    );
    const studyLevelOptions = buildOptions(EDC_PICKLISTS.studyLevel, '');

    /* ── Sessions de webconférence par type ─────────────────────────── */
    const wbcSessions = {
        fr: {
            '1a-4a': {
                date:  'Jeudi 19 mars 2026',
                time:  '18h – 19h',
                topic: 'Présentation des formations 1ère année à 4ème année',
            },
            'mba-1': {
                date:  'Mardi 24 mars 2026',
                time:  '18h – 19h30',
                topic: 'Présentation des MBA — Session 1',
            },
            'mba-2': {
                date:  'Mardi 7 avril 2026',
                time:  '18h – 19h30',
                topic: 'Présentation des MBA — Session 2',
            },
        },
        en: {
            '1a-4a': {
                date:  'Thursday, March 19 2026',
                time:  '6pm – 7pm',
                topic: 'Undergraduate programme presentation',
            },
            'mba-1': {
                date:  'Tuesday, March 24 2026',
                time:  '6pm – 7:30pm',
                topic: 'MBA presentation — Session 1',
            },
            'mba-2': {
                date:  'Tuesday, April 7 2026',
                time:  '6pm – 7:30pm',
                topic: 'MBA presentation — Session 2',
            },
        }
    };

    /* ── Options du dropdown webconférence ──────────────────────────── */
    const wbcTypeOptionsFr =
        '<option value=""></option>' +
        '<option value="1a-4a">Webconférence 1A–4A</option>' +
        '<option value="mba-1">Webconférence MBA 1</option>' +
        '<option value="mba-2">Webconférence MBA 2</option>';

    const wbcTypeOptionsEn =
        '<option value=""></option>' +
        '<option value="1a-4a">Webconference 1st–4th year</option>' +
        '<option value="mba-1">Webconference MBA 1</option>' +
        '<option value="mba-2">Webconference MBA 2</option>';

    /* ── Traductions FR / EN ────────────────────────────────────────── */
    const TRANS = {
        fr: {
            webconf:     'Webconférence',
            online:      'En ligne',
            youAre:      'Vous êtes',
            lastName:    'Nom',
            firstName:   'Prénom',
            email:       'Adresse email',
            mobile:      'Portable',
            mobilePh:    '06 12 34 56 78',
            studyLevel:  "Niveau d'études",
            rgpd:        "J'accepte d'être contacté(e) par l'école pour les finalités décrites",
            rgpdLink:    'ici',
            errRequired: 'Ce champ est requis.',
            errEmail:    'Format e-mail invalide.',
            errEmailDom: 'Veuillez utiliser une adresse valide.',
            errPhone:    'Numéro invalide (ex: 06 12 34 56 78).',
            errGeneric:  'Une erreur est survenue, veuillez réessayer.',
            sending:     'Envoi en cours...',
            successThanks:  name => `Merci, ${name} !`,
            successConfirm: (date, topic, email) =>
                `Votre inscription à la webconférence <strong>${topic}</strong> du <strong>${date}</strong> a bien été enregistrée.<br>Un e-mail de confirmation sera envoyé à <strong>${email}</strong>.`,
        },
        en: {
            webconf:     'Webconference',
            online:      'Online',
            youAre:      'You are',
            lastName:    'Last name',
            firstName:   'First name',
            email:       'Email address',
            mobile:      'Mobile',
            mobilePh:    '07 12 34 56 78',
            studyLevel:  'Level of study',
            rgpd:        'I agree to be contacted by the school for the purposes described',
            rgpdLink:    'here',
            errRequired: 'This field is required.',
            errEmail:    'Invalid email format.',
            errEmailDom: 'Please use a valid email address.',
            errPhone:    'Invalid number (e.g. 07 12 34 56 78).',
            errGeneric:  'An error occurred, please try again.',
            sending:     'Sending...',
            successThanks:  name => `Thank you, ${name}!`,
            successConfirm: (date, topic, email) =>
                `Your registration for the <strong>${topic}</strong> webconference on <strong>${date}</strong> has been confirmed.<br>A confirmation email will be sent to <strong>${email}</strong>.`,
        }
    };

    /* ── Générateur HTML ────────────────────────────────────────────── */
    function buildBlock({ nomAction, submitLabel, lang = 'fr' }) {
        const t           = TRANS[lang] || TRANS.fr;
        const rgpd        = resolveRgpdConfig(lang);
        const typeOptions = lang === 'en' ? wbcTypeOptionsEn : wbcTypeOptionsFr;

        return `
<section class="wbc-section"
  data-gjs-removable="false"
  data-gjs-copyable="false"
  data-gjs-droppable="false"
  data-gjs-highlightable="false">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.wbc-section *,
.wbc-section *::before,
.wbc-section *::after { box-sizing: border-box; }

.wbc-section {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 16px;
    background: transparent;
    font-family: var(--brand-font, 'Inter', sans-serif);
    font-size: 13px;
    color: var(--brand-text, #1a1a1a);
}

.wbc-card {
    width: 100%;
    max-width: 520px;
    background: #F4EFEA;
    padding: 24px 24px 28px;
    overflow: visible;
}

.wbc-top-zone {
    background: transparent;
    padding: 0 0 10px 0;
}

.wbc-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a4a;
    margin-bottom: 6px;
    display: block;
}

.wbc-label .req { color: inherit; }

.wbc-sel-wrap {
    position: relative;
}

.wbc-sel-wrap::after {
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

.wbc-type-select {
    width: 100%;
    height: 46px;
    padding: 0 35px 0 14px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    color: #000;
    background: var(--brand-background, #ffffff);
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition: border-color 0.2s;
}

.wbc-type-select:focus { border-color: var(--brand-muted, #6b7280); }

.wbc-event-card {
    display: none;
    padding: 16px 0 0;
}

.wbc-event-inner {
    background: transparent;
    border-radius: 0;
    display: flex;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 12px;
}

.wbc-event-left { flex: 1; }

.wbc-event-right {
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--brand-text, #1a1a1a);
    line-height: 1.5;
    text-align: right;
}

.wbc-event-date-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.wbc-radio-icon {
    width: 18px;
    height: 18px;
    border: 1.5px solid #000;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 2px;
}

.wbc-event-date {
    font-weight: 700;
    font-size: 13px;
    color: #000;
}

.wbc-event-detail {
    font-size: 12px;
    color: var(--brand-text, #1a1a1a);
    line-height: 1.6;
    padding-left: 0;
    white-space: pre-line;
}

.wbc-online-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    background: #000;
    color: #fff;
    padding: 2px 8px;
    border-radius: 0;
    letter-spacing: 0.03em;
}

.wbc-pointer {
    display: none !important;
}

.wbc-form-zone { padding: 10px 0 0; }

.wbc-field {
    display: flex;
    flex-direction: column;
    margin-bottom: 12px;
}

.wbc-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
}

.wbc-row .wbc-field { margin-bottom: 0; }

.wbc-input,
.wbc-select {
    width: 100%;
    height: 46px;
    padding: 0 14px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    color: #000;
    background: var(--brand-background, #ffffff);
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 0.2s;
}

.wbc-input:focus,
.wbc-select:focus { border-color: var(--brand-muted, #6b7280); }

.wbc-input.err,
.wbc-select.err { border-color: #c00; }

.wbc-err-msg {
    font-size: 10px;
    color: #c00;
    margin-top: 4px;
    display: none;
}

.wbc-err-msg.show { display: block; }

.wbc-phone-wrap {
    display: flex;
    gap: 8px;
}

.wbc-phone-prefix-wrap {
    position: relative;
    width: 92px;
    flex-shrink: 0;
}

.wbc-phone-prefix-wrap::after {
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

.wbc-phone-prefix {
    width: 100%;
    height: 46px;
    padding: 0 24px 0 12px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 13px;
    font-family: inherit;
    color: #000;
    background: var(--brand-background, #ffffff);
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    cursor: pointer;
}

.wbc-rgpd {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 16px 0 20px;
}

.wbc-rgpd input[type="checkbox"] {
    width: 18px;
    height: 18px;
    border: 1px solid #000;
    border-radius: 0;
    background: var(--brand-background, #ffffff);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    flex-shrink: 0;
    margin-top: 0;
}

.wbc-rgpd input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 13px;
    font-weight: 700;
    color: #000;
}

.wbc-rgpd-label {
    font-size: 11px;
    color: var(--brand-text, #1a1a1a);
    line-height: 1.5;
    cursor: pointer;
}

.wbc-rgpd-label a { color: #000; text-decoration: underline; }

.wbc-submit-wrap { display: block; width: 100%; }

.wbc-submit {
    width: 100%;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 14px;
    background: #000;
    color: var(--brand-button-text, #ffffff);
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

.wbc-submit::after {
    content: '';
}

.wbc-submit:hover { background: #222; }
.wbc-submit:disabled { background: #888; cursor: not-allowed; }

.wbc-success {
    display: none;
    padding: 16px 0 8px;
    text-align: center;
}

.wbc-success h3 {
    font-size: 16px;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--brand-text, #1a1a1a);
}

.wbc-success p {
    font-size: 13px;
    color: var(--brand-muted, #6b7280);
    margin: 0;
}

.wbc-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #fff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: wbc-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
}

@keyframes wbc-spin { to { transform: rotate(360deg); } }

@media (max-width: 460px) {
    .wbc-row { grid-template-columns: 1fr; }
    .wbc-phone-prefix-wrap { width: 90px; }
    .wbc-event-inner { flex-direction: column; gap: 8px; }
    .wbc-event-right { max-width: 100%; text-align: left; }
}
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="wbc-card">

    <div class="wbc-top-zone">
        <label class="wbc-label">${t.webconf}<span class="req">*</span></label>
        <div class="wbc-sel-wrap">
            <select class="wbc-type-select" name="TypeWebconf" required>
                ${typeOptions}
            </select>
        </div>
        <div class="wbc-event-card">
            <div class="wbc-event-inner">
                <div class="wbc-event-left">
                    <div class="wbc-event-date-row">
                        <div class="wbc-radio-icon"></div>
                        <span class="wbc-event-date"></span>
                    </div>
                    <div class="wbc-event-detail"></div>
                </div>
                <div class="wbc-event-right">
                    <span class="wbc-online-badge">${t.online}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="wbc-pointer"></div>

    <div class="wbc-success">
        <div style="font-size:36px;margin-bottom:10px;">✅</div>
        <h3 class="wbc-success-thanks"></h3>
        <p class="wbc-success-msg"></p>
    </div>

    <div class="wbc-form-zone">
    <form class="wbc-form" data-lang="${lang}" novalidate>
        <input type="hidden" name="submitted"       value="true">
        <input type="hidden" name="TypeEvenement"   value="Webconference">
        <input type="hidden" name="NomAction"       value="${nomAction}">
        <input type="hidden" name="Marque"          value="">
        <input type="hidden" name="WebconfDate"     value="">
        <input type="hidden" name="WebconfTopic"    value="">

        <div class="wbc-field">
            <label class="wbc-label">${t.youAre}<span class="req">*</span></label>
            <div class="wbc-sel-wrap">
                <select class="wbc-select" name="VousEtes" required>
                    ${contactTypeOptions}
                </select>
            </div>
            <span class="wbc-err-msg">${t.errRequired}</span>
        </div>

        <div class="wbc-row">
            <div class="wbc-field">
                <label class="wbc-label">${t.lastName}<span class="req">*</span></label>
                <input class="wbc-input" type="text" name="LastName" required>
                <span class="wbc-err-msg">${t.errRequired}</span>
            </div>
            <div class="wbc-field">
                <label class="wbc-label">${t.firstName}<span class="req">*</span></label>
                <input class="wbc-input" type="text" name="FirstName" required>
                <span class="wbc-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <div class="wbc-row">
            <div class="wbc-field">
                <label class="wbc-label">${t.email}<span class="req">*</span></label>
                <input class="wbc-input" type="email" name="EmailAddress" required>
                <span class="wbc-err-msg">${t.errEmail}</span>
            </div>
            <div class="wbc-field">
                <label class="wbc-label">${t.mobile}<span class="req">*</span></label>
                <div class="wbc-phone-wrap">
                    <div class="wbc-phone-prefix-wrap">
                        <select class="wbc-phone-prefix" aria-label="Prefix">
                            <option value="+33" selected>FR (+33)</option>
                            <option value="+32">BE (+32)</option>
                            <option value="+41">CH (+41)</option>
                            <option value="+352">LU (+352)</option>
                            <option value="+1">US (+1)</option>
                            <option value="+44">GB (+44)</option>
                            <option value="+212">MA (+212)</option>
                        </select>
                    </div>
                    <input class="wbc-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="wbc-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <div class="wbc-field">
            <label class="wbc-label">${t.studyLevel}<span class="req">*</span></label>
            <div class="wbc-sel-wrap">
                <select class="wbc-select" name="StudyLevel" required>
                    ${studyLevelOptions}
                </select>
            </div>
            <span class="wbc-err-msg">${t.errRequired}</span>
        </div>

        <div class="wbc-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true">
            <label class="wbc-rgpd-label">
                <span data-rgpd-text>${rgpd.text}</span> <a data-rgpd-link href="${rgpd.url}" target="_blank">${rgpd.linkLabel}</a>
            </label>
        </div>

        <div class="wbc-submit-wrap">
            <button type="submit" class="wbc-submit">${submitLabel}</button>
        </div>
    </form>
    </div>

</div><!-- /.wbc-card -->
</section>`;
    }

    /* ══════════════════════════════════════════════════════════════════
     * LOGIQUE INTERACTIVE
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
        const errSpan = field.closest('.wbc-field') && field.closest('.wbc-field').querySelector('.wbc-err-msg');
        if (errSpan) { if (msg) errSpan.textContent = msg; errSpan.classList.add('show'); }
    }

    function clearFieldErr(field) {
        if (!field) return;
        field.classList.remove('err');
        const errSpan = field.closest('.wbc-field') && field.closest('.wbc-field').querySelector('.wbc-err-msg');
        if (errSpan) errSpan.classList.remove('show');
    }

    /* ── Initialise un type-select (scopé à sa .wbc-card) ──────────── */
    function initOneWbcSelect(typeSelect) {
        if (typeSelect.dataset.wbcInit) return;
        typeSelect.dataset.wbcInit = '1';

        const card = typeSelect.closest('.wbc-card');
        if (!card) return;

        const form  = card.querySelector('.wbc-form');
        const lang  = (form && form.dataset.lang) || 'fr';
        const t     = TRANS[lang] || TRANS.fr;
        const sessions = wbcSessions[lang] || wbcSessions.fr;

        /* ── RGPD : résolution depuis la source centrale ── */
        fetchRgpdConfig(lang).then(({ text, url, linkLabel }) => {
            const textEl = card.querySelector('[data-rgpd-text]');
            const linkEl = card.querySelector('[data-rgpd-link]');
            if (textEl) textEl.textContent = text;
            if (linkEl) { linkEl.textContent = linkLabel; linkEl.href = url; }
        });

        function updateCard(val) {
            const eventCard = card.querySelector('.wbc-event-card');
            const dateEl    = card.querySelector('.wbc-event-date');
            const detailEl  = card.querySelector('.wbc-event-detail');
            const hiddenDate  = card.querySelector('input[name="WebconfDate"]');
            const hiddenTopic = card.querySelector('input[name="WebconfTopic"]');
            const sess = sessions[val];

            if (sess) {
                if (dateEl)    dateEl.textContent = sess.date;
                if (detailEl)  detailEl.textContent = sess.time;
                if (hiddenDate)  hiddenDate.value = sess.date;
                if (hiddenTopic) hiddenTopic.value = sess.topic;
                if (eventCard) eventCard.style.display = 'block';
            } else {
                if (eventCard) eventCard.style.display = 'none';
                if (hiddenDate)  hiddenDate.value = '';
                if (hiddenTopic) hiddenTopic.value = '';
            }
        }

        typeSelect.addEventListener('change', function () {
            updateCard(this.value);
        });
        updateCard(typeSelect.value);

        if (!form) return;

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

            if (!typeSelect.value) { typeSelect.classList.add('err'); ok = false; }
            else typeSelect.classList.remove('err');

            const ee = validateEmail((emailEl || {}).value || '', t);
            if (ee) { showFieldErr(emailEl, ee); ok = false; } else clearFieldErr(emailEl);

            const pe = validatePhone((phoneEl || {}).value || '', t);
            if (pe) { showFieldErr(phoneEl, pe); ok = false; } else clearFieldErr(phoneEl);

            if (!ok) return;

            const btn = form.querySelector('.wbc-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="wbc-spinner"></span>${t.sending}`; }

            const data = { TypeWebconf: typeSelect.value };
            new FormData(form).forEach((v, k) => { data[k] = v; });

            const prefixEl = form.querySelector('.wbc-phone-prefix');
            const prefix   = prefixEl ? prefixEl.value : '+33';
            const raw      = (data.MobilePhone || '').replace(/[\s\-.]/g, '').replace(/^0/, '');
            if (!raw.startsWith('+')) data.MobilePhone = prefix + raw;

            const rgpd = data.RGPDConsent === 'true';
            data.HasOptedInEmail    = rgpd ? '1' : '0';
            data.HasOptedInSMS      = rgpd ? '1' : '0';
            data.HasOptedInWhatsApp = rgpd ? '1' : '0';

            /* Mode test — simule un appel API */
            setTimeout(() => {
                const formZone = card.querySelector('.wbc-form-zone');
                const success  = card.querySelector('.wbc-success');
                if (formZone) formZone.style.display = 'none';
                if (success) {
                    success.style.display = 'block';
                    const name   = ((data.FirstName || '') + ' ' + (data.LastName || '')).trim();
                    const thanks = success.querySelector('.wbc-success-thanks');
                    const msg    = success.querySelector('.wbc-success-msg');
                    if (thanks) thanks.textContent = t.successThanks(name);
                    if (msg)    msg.innerHTML      = t.successConfirm(
                        data.WebconfDate  || '—',
                        data.WebconfTopic || '—',
                        data.EmailAddress || ''
                    );
                }
            }, 900);
        });
    }

    /* ── Hook GrapesJS ───────────────────────────────────────────── */
    function tryInitAll() {
        try {
            const doc = editor.Canvas.getDocument();
            if (!doc) return;
            doc.querySelectorAll('.wbc-type-select').forEach(initOneWbcSelect);
        } catch (e) { /* canvas pas encore prêt */ }
    }

    editor.on('component:mount', tryInitAll);
    editor.on('load', () => setTimeout(tryInitAll, 300));

    /* ── Enregistrement des 2 blocs FR + EN ─────────────────────────── */
    editor.BlockManager.add('form-webconf', {
        label: 'Formulaire Webconférence',
        category: categories.FORMS,
        content: buildBlock({
            nomAction:   'Inscription_Webconference',
            submitLabel: "Je m'inscris",
            lang:        'fr'
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-webconf-en', {
        label: 'Formulaire Webconférence Anglais',
        category: categories.FORMS,
        content: buildBlock({
            nomAction:   'Inscription_Webconference',
            submitLabel: 'Register',
            lang:        'en'
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
