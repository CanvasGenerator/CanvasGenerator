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
import { fetchRgpdConfig, resolveRgpdConfig } from '../shared/rgpd-config.js';
import { buildHiddenFields, populateHiddenFields } from '../shared/tracking-fields.js';
import { validerEtRevelerRequis } from '../shared/champs-requis.js';
import { soumettre } from '../shared/envoi-socle.js';
import { montrerSucces, effacerMessage } from '../shared/message-confirmation.js';
import { isProgrammeSchool, getProgrammes, getPtatForProgramme } from '../shared/programme-config.js';
import { brancherCascadeProgramme } from '../shared/cascade-programme.js';
import { socleReadSnippet } from '../shared/socle-read-snippet.js';

import { ajouterBloc } from '../shared/blocs-desactives.js';
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
            speciality:  'Programme souhaité',
            rhythm:      'Rythme',
            language:    'Langue d\'enseignement',
            rentree:     'Rentrée',
            choisir:     'Sélectionnez...',
            programmePh: 'Sélectionnez un programme...',
            rgpdLink:    'ici',
            submit:      'Je candidate',
            sending:     'Envoi en cours...',
            /* Le texte du socle, au mot pres : c'est lui que le visiteur lit
               sur une page publiee. Un apercu qui dirait autre chose ferait
               valider en recette un message qui n'existe nulle part. */
            successTitle: 'Nous avons bien reçu votre demande de candidature',
            successMsg:  'Pour la finaliser et déposer votre dossier, créez '
                       + 'votre espace candidat via le lien envoyé par e-mail '
                       + '(pensez à vérifier vos spams).',
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
            speciality:  'Desired programme',
            rhythm:      'Study mode',
            language:    'Language of instruction',
            rentree:     'Intake',
            choisir:     'Select...',
            programmePh: 'Select a programme...',
            rgpdLink:    'here',
            submit:      'Apply now',
            sending:     'Sending...',
            successTitle: 'We have received your application',
            successMsg:  'To complete it and submit your file, create your '
                       + 'applicant account using the link sent by email '
                       + '(please check your spam folder).',
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
        const rgpd = resolveRgpdConfig(lang);
        const studyLevelOptions = buildOptions(EDC_PICKLISTS.studyLevel, '');
        const campusOptions      = buildOptions(EDC_PICKLISTS.campus,      '');
        const countryOptions     = buildOptions(EDC_PICKLISTS.countries,   '');
        const hidden = buildHiddenFields({ formName: 'Candidature', formType: 'candidature', lang });

        return `
<section class="cnd-section"
  data-gjs-droppable="false"
  data-lp-form="1">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.cnd-section *, .cnd-section *::before, .cnd-section *::after { box-sizing: border-box; }
.cnd-section {
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 16px; background: transparent;
    font-family: var(--brand-font, 'Inter', sans-serif); font-size: 13px; color: var(--brand-text, #1a1a1a);
}
.cnd-card {
    width: 100%; max-width: 520px;
    background: #F4EFEA; padding: 24px 24px 28px;
}
.cnd-title { font-size: 18px; font-weight: 700; color: var(--brand-text, #1a1a1a); margin: 0 0 4px; }
.cnd-subtitle { font-size: 12px; color: var(--brand-muted, #6b7280); margin: 0 0 18px; }
.cnd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
/* Cellule de la grille, un champ par cellule : elle existe pour que le campus
   et le niveau d'études ne soient pas FRERES, le socle ne réordonnant que les
   champs qui partagent un parent. min-width:0 parce qu'une cellule de grille
   refuse sinon de descendre sous la largeur de son contenu. */
.cnd-col { min-width: 0; }
.cnd-field { display: flex; flex-direction: column; margin-bottom: 12px; }
.cnd-row .cnd-field { margin-bottom: 0; }
.cnd-field.hidden { display: none; }
/* Un champ masque laisse sa CELLULE de grille en place : le voisin restait
   donc coince dans sa colonne, a droite, avec la moitie de la ligne vide a
   cote. C'est ce que donnait le niveau d'etudes sur les ecoles ou le campus
   n'est pas propose. La cellule vide s'efface, et celle qui reste occupe la
   ligne entiere. */
.cnd-row > .cnd-col:has(> .cnd-field.hidden) { display: none; }
.cnd-row:has(> .cnd-col > .cnd-field.hidden) { grid-template-columns: 1fr; }
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
    font-size: 13px; font-family: inherit; color: #000; background: var(--brand-background, #ffffff);
    outline: none; appearance: none; -webkit-appearance: none; transition: border-color 0.2s;
}
.cnd-input:focus, .cnd-select:focus { border-color: var(--brand-muted, #6b7280); }
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
    /* 112px et non 84 : le socle remplace les options par les 201
       indicatifs du CRM, dont les libelles sont du genre
       "+212 (Maroc)" la ou la liste de repli disait "MA (+212)". */
    width: 112px;
    flex-shrink: 0;
}
.cnd-phone-prefix-wrap::after {
    content: '';
    position: absolute;
    right: 8px;
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
    padding: 0 20px 0 8px;
    border: 1px solid #000;
    border-radius: 0;
    font-size: 11px;
    font-family: inherit;
    color: #000;
    background: var(--brand-background, #ffffff);
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    cursor: pointer;
}

/* Le consentement est un champ comme un autre : s'il manque, le message
   passe A LA LIGNE sous la case, et non a cote du libelle — le conteneur
   est en flex, un span y serait sinon aligne avec le texte legal. */
.cnd-rgpd { flex-wrap: wrap; }
.cnd-rgpd .cnd-err-msg { flex-basis: 100%; margin-left: 28px; }

.cnd-rgpd { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0 20px; }
.cnd-rgpd input[type="checkbox"] {
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
.cnd-rgpd-label { font-size: 11px; color: var(--brand-text, #1a1a1a); line-height: 1.5; cursor: pointer; }
.cnd-rgpd-label a { color: #000; text-decoration: underline; }
.cnd-submit-wrap { display: block; width: 100%; }
.cnd-submit {
    /* display:block et NON inline-flex. Dans un conteneur flex, CSS supprime les
       blancs situés ENTRE deux éléments. Quand l'éditeur de texte scinde le
       libellé en plusieurs nœuds, l'espace tapé disparaissait donc :
       « JE CANDIDATE » + « TEST » s'affichait « JE CANDIDATETEST ».
       Un bouton centre déjà son texte, le flex n'apportait rien. */
    width: 100%; display: block; text-align: center;
    padding: 14px; background: #000; color: var(--brand-button-text, #ffffff);
    border: none; border-radius: 0; font-size: 14px; font-weight: 700;
    font-family: inherit; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: background 0.15s;
}
.cnd-submit::after {
    content: '';
}
.cnd-submit:hover { background: #222; }
.cnd-submit:disabled { background: #888; cursor: not-allowed; }
.cnd-success { display: none; padding: 16px 0 8px; text-align: center; }
.cnd-success h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--brand-text, #1a1a1a); }
.cnd-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #fff; border-top-color: transparent;
    border-radius: 50%; animation: cnd-spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px;
}
@keyframes cnd-spin { to { transform: rotate(360deg); } }
@media(max-width:460px){
    .cnd-row { grid-template-columns: 1fr; }
    .cnd-phone-prefix-wrap { width: 80px; }
}
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="cnd-card">

    <h3 class="cnd-title">${t.title}</h3>
    <p class="cnd-subtitle">${t.subtitle}</p>

    <!-- Confirmation (masquée initialement) -->
    <div class="cnd-success">
        <div style="font-size:40px;margin-bottom:10px;">✔️</div>
        <h3 class="cnd-success-title"></h3>
    </div>

    <!-- Formulaire -->
    <!-- POST et validation NATIVE. Le JS des blocs ne tourne QUE dans le
         builder : sur une page publiee, il n'y a que le script du socle.
         Un formulaire sans method partait donc en GET natif, toutes les
         donnees dans l'URL — nom, e-mail, telephone.

         L'attribut novalidate est retire : c'est le NAVIGATEUR qui exige
         les champs affiches, sans une ligne de JS. Le socle pose et retire
         l'attribut required en meme temps qu'il montre ou masque un champ.

         ATTENTION : pas d'accent grave dans ce commentaire. Il vit DANS un
         template literal, ou un accent grave ferme la chaine et casse tout le
         module — l'erreur remonte alors sur le mot suivant, jamais sur la
         cause. -->
    <form class="cnd-form" data-lang="${lang}" method="post">
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
                        <select name="Indicatif" class="cnd-phone-prefix" aria-label="Prefix">
                            <option value="33" selected>FR (+33)</option>
                            <option value="32">BE (+32)</option>
                            <option value="41">CH (+41)</option>
                            <option value="352">LU (+352)</option>
                            <option value="1">US (+1)</option>
                            <option value="44">GB (+44)</option>
                            <option value="212">MA (+212)</option>
                        </select>
                    </div>
                    <input class="cnd-input cnd-phone-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="cnd-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Pays de résidence — ajouté sur la candidature, aligné sur la
             brochure : juste après le téléphone, avant campus / niveau.
             Comme sur la brochure, ce champ ne figure PAS dans la table NOM_DOM
             du socle, qui ne réordonne que campus, niveau, spécialité, rythme,
             langue, rentrée et programme : sa place ici est donc définitive,
             page publiée comprise. Le socle remplit ses options depuis le value
             set « Pays » du CRM (name="Country"), déjà pris en charge pour la
             brochure — rien à ajouter côté écriture. -->
        <div class="cnd-field">
            <label class="cnd-label">${t.country}<span class="req">*</span></label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select" name="Country" required>
                    ${countryOptions}
                </select>
            </div>
            <span class="cnd-err-msg">${t.errRequired}</span>
        </div>

        <!-- Campus / Niveau d'études — positions 5 et 6 de l'Excel des champs
             visibles, dans cet ordre : le campus AVANT le niveau, l'inverse de
             la brochure.
             ═══════════════════════════════════════════════════════════════
             ⚠ CHAQUE CHAMP A SON PROPRE .cnd-col. NE PAS LES REMETTRE FRERES
             DANS LE .cnd-row.

             Le socle réordonne les champs qui PARTAGENT un parent, selon
             OrdreChamps de l'école, et laisse intact tout groupe d'un seul
             champ. Deux .cnd-field frères formaient un groupe de deux, donc
             leur ordre venait de la configuration et non de ce gabarit : il
             pouvait différer entre le builder et la page publiée.

             Un conteneur par champ rend l'ordre écrit ici définitif.

             ⚠ NE PAS FAIRE PAREIL sur Spécialité / Rythme / Langue / Rentrée
             juste en dessous : ces quatre-là DOIVENT rester frères. Leur ordre
             relatif est une règle métier que le socle applique par école — IFA
             Paris demande la langue AVANT la spécialité, parce qu'on ne peut
             pas proposer une spécialité avant de savoir dans quelle langue
             elle est enseignée. Les cloisonner figerait cet ordre et casserait
             la règle.

             ⚠ Pas d'accent grave dans ce commentaire : il vit DANS un template
             literal, où un accent grave ferme la chaîne et casse le module. -->
        <div class="cnd-row">
            <div class="cnd-col">
                <div class="cnd-field">
                    <label class="cnd-label">${t.campus}<span class="req">*</span></label>
                    <div class="cnd-sel-wrap">
                        <select class="cnd-select cnd-campus lp-campus-select" name="Campus" required>
                            ${campusOptions}
                        </select>
                    </div>
                    <span class="cnd-err-msg">${t.errRequired}</span>
                </div>
            </div>
            <div class="cnd-col">
                <div class="cnd-field">
                    <label class="cnd-label">${t.studyLevel}<span class="req">*</span></label>
                    <div class="cnd-sel-wrap">
                        <select class="cnd-select cnd-niveau" name="StudyLevel" required>
                            ${studyLevelOptions}
                        </select>
                    </div>
                    <span class="cnd-err-msg">${t.errRequired}</span>
                </div>
            </div>
        </div>

        <!-- ═══════ RECONSTITUTION DU PROGRAMME ═══════
             Règle §6 : le programme est scindé en champs conditionnels —
             campus → niveau → spécialité → rythme → langue → rentrée. Chacun
             ne propose que ce qui reste atteignable, et le dernier choix
             désigne un programme unique, donc un PTAT.

             Tous masqués au départ : c'est la cascade qui décide de les
             montrer, selon l'école (ordre, affichage progressif) et le nombre
             de valeurs restantes. Un champ à une seule valeur reste masqué mais
             renseigné — la réponse part au CRM sans qu'on pose la question.

             Inertes dans le builder, qui n'exécute pas le socle. -->
        <div class="cnd-field cnd-speciality-field hidden">
            <label class="cnd-label">${t.speciality}</label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select" name="Speciality" data-placeholder="${t.choisir}">
                    <option value="">${t.choisir}</option>
                </select>
            </div>
        </div>
        <div class="cnd-field cnd-rhythm-field hidden">
            <label class="cnd-label">${t.rhythm}</label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select" name="Rhythm" data-placeholder="${t.choisir}">
                    <option value="">${t.choisir}</option>
                </select>
            </div>
        </div>
        <div class="cnd-field cnd-language-field hidden">
            <label class="cnd-label">${t.language}</label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select" name="Language" data-placeholder="${t.choisir}">
                    <option value="">${t.choisir}</option>
                </select>
            </div>
        </div>
        <div class="cnd-field cnd-rentree-field hidden">
            <label class="cnd-label">${t.rentree}</label>
            <div class="cnd-sel-wrap">
                <select class="cnd-select" name="Rentree" data-placeholder="${t.choisir}">
                    <option value="">${t.choisir}</option>
                </select>
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
            <!-- Rempli par majPtat() au choix du programme. Le socle s'en sert
                 pour ecrire PTAT_Id__c et pour armer les regles de blocage
                 candidature : vide, ces regles ne s'appliquent pas. -->
            <input type="hidden" name="PTAT_Id" value="">
        </div>

        <!-- RGPD -->
        <div class="cnd-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true" required>
            <label class="cnd-rgpd-label">
                <span data-rgpd-text>${rgpd.text}</span> <a data-rgpd-link href="${rgpd.url}" target="_blank">${rgpd.linkLabel}</a>
            </label>
        </div>

        <div class="cnd-submit-wrap">
            <!-- Libellé dans un <span> éditable : sur un <button> focalisé, la
                 touche Espace active le bouton au lieu d'insérer un caractère. -->
            <button type="submit" class="cnd-submit"><span class="cnd-submit-label" data-gjs-type="text">${t.submit}</span></button>
        </div>
    </form>

</div><!-- /.cnd-card -->
${socleReadSnippet({ formType: 'candidature' })}
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
            /* La preuve suit le texte affiché. Sans cela, une config RGPD
               rafraîchie ici laisserait le champ caché sur l'ancienne
               formulation : on prouverait l'acceptation d'un texte que la
               personne n'a jamais vu. */
            const preuveEl = form.querySelector('[name="LegalTexteAccepted"]');
            if (preuveEl && text) preuveEl.value = text;
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
            majPtat();
        }

        function majPtat() {
            const ptatEl = form.querySelector('[name="PTAT_Id"]');
            if (!ptatEl) return;
            ptatEl.value = programmeSelect
                ? getPtatForProgramme(programmeSelect.value)
                : '';
        }

        /* ── Cascade de reconstitution du programme ──────────────────────
           Quand le socle a publié les programmes, c'est ELLE qui pilote :
           spécialité, rythme, langue et rentrée reconstituent le programme, et
           le champ Programme devient un résultat qu'on ne montre plus.

           Sinon — builder, ou Salesforce muet — on garde l'ancien
           comportement : un select Programme alimenté par niveau + campus. Les
           deux ne coexistent jamais. */
        const cascadeActive = brancherCascadeProgramme(form);

        if (cascadeActive) {
            if (programmeField) programmeField.classList.add('hidden');
        } else {
            if (niveauEl) niveauEl.addEventListener('change', refreshProgramme);
            if (campusEl) campusEl.addEventListener('change', refreshProgramme);
            if (programmeSelect) programmeSelect.addEventListener('change', majPtat);
            refreshProgramme();
            majPtat();
        }

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

            /* Tout champ AFFICHÉ est obligatoire — arbitrage du 30/08. La
               liste ne peut plus être écrite ici : la cascade décide à
               l'exécution si la spécialité apparaît, et le socle rend les dates
               après coup. Ces champs-là n'étaient donc jamais contrôlés. */
            if (!validerEtRevelerRequis(form, { message: t.errRequired })) ok = false;

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

            /* Le numero et l'indicatif partent SEPAREMENT : le socle ecrit
               MobileNumber__c et IndicatifPick__c, et cette picklist attend
               "33" sans le "+". Concatener les deux laissait
               IndicatifPick__c vide et mettait "+33612345678" dans le
               numero. Indicatif part tout seul via FormData, maintenant que
               le select porte un name. */
            data.MobilePhone = (data.MobilePhone || '')
                .replace(/[\s\-.()]/g, '')
                .replace(/^\+/, '')
                .replace(/^0/, '');

            const rgpd = data.RGPDConsent === 'true';
            data.HasOptedInEmail    = rgpd ? '1' : '0';
            data.HasOptedInSMS      = rgpd ? '1' : '0';
            data.HasOptedInWhatsApp = rgpd ? '1' : '0';
            data.HasOptedInPhone    = rgpd ? '1' : '0';

            /* Envoi REEL au socle d'ecriture sur une page publiee, simulation
               dans le builder — ou aucun socle ne tourne. Le formulaire se
               poste a lui-meme : le socle est inclus dans la page.
               Voir shared/envoi-socle.js. */
            effacerMessage(form);

            soumettre(data, form.ownerDocument)
                .then(res => {
                    /* ⚠ LE BOUTON EST RENDU DANS TOUS LES CAS, succes compris.
                       Il ne l'etait pas jusqu'au 03/09, et c'etait sans
                       consequence : la confirmation emportait le formulaire
                       entier, bouton compris. Maintenant que le formulaire
                       RESTE, un bouton fige sur « Envoi... » serait la seule
                       chose cassee de l'ecran, et interdirait le renvoi. */
                    if (btn) { btn.disabled = false; btn.textContent = t.submit; }
                    if (res.ok) {
                        /* Retour du 03/09 : rien ne disparait. Le message
                           s'ajoute au-dessus du bouton, le formulaire garde
                           ses valeurs, et l'ecran `.cnd-success` n'est plus
                           ouvert du tout — meme comportement que le socle sur
                           une page publiee. */
                        montrerSucces(form, t.successTitle, t.successMsg);
                    } else {
                        /* Le message du socle plutot qu'un « une erreur est
                           survenue » : c'est lui qui nomme le champ refuse. */
                        alert(res.message || t.errGeneric);
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
    ajouterBloc(editor,'form-candidature', {
        label: 'Formulaire Candidature',
        category: categories.FORMS,
        content: buildContent('fr'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    ajouterBloc(editor,'form-candidature-en', {
        label: 'Formulaire Candidature Anglais',
        category: categories.FORMS,
        content: buildContent('en'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
