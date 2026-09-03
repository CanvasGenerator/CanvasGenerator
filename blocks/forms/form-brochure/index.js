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
import { fetchRgpdConfig, resolveRgpdConfig } from '../shared/rgpd-config.js';
import { buildHiddenFields, populateHiddenFields } from '../shared/tracking-fields.js';
import { validerEtRevelerRequis } from '../shared/champs-requis.js';
import { soumettre } from '../shared/envoi-socle.js';
import { montrerSucces, effacerMessage } from '../shared/message-confirmation.js';
import { isProgrammeSchool, getProgrammes } from '../shared/programme-config.js';
import { brancherCascadeProgramme } from '../shared/cascade-programme.js';
import { socleReadSnippet } from '../shared/socle-read-snippet.js';

import { ajouterBloc } from '../shared/blocs-desactives.js';
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
            speciality:     'Programme souhaité',
            specialityPh:   'Sélectionnez...',
            childLastName:  'Nom de votre enfant',
            childFirstName: 'Prénom de votre enfant',
            childPhone:     'Téléphone de votre enfant',
            rgpd:           "J'accepte d'être contacté(e) par l'école pour les finalités décrites",
            rgpdLink:       'ici',
            submit:         'Je télécharge la brochure',
            sending:        'Envoi en cours...',
            /* Le texte du socle, au mot pres : c'est lui que le visiteur lit
               sur une page publiee. Un apercu qui dirait autre chose ferait
               valider en recette un message qui n'existe nulle part. */
            successTitle:   'Votre brochure est prête !',
            successMsg:     'Vous pouvez dès maintenant la télécharger. '
                          + 'Elle vous a également été envoyée par email.',
            /* Le CTA du retour du 03/09. Sur une page publiee, l'URL vient de
               la DE via `SOCLE_DATA.brochures` ; ici, dans le builder, il n'y a
               pas de socle — le bouton est rendu avec une URL de demonstration
               pour que la maquette montre l'ecran complet. */
            ctaBrochure:    'Télécharger la brochure',
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
            speciality:     'Desired programme',
            specialityPh:   'Select...',
            childLastName:  "Your child's last name",
            childFirstName: "Your child's first name",
            childPhone:     "Your child's phone",
            rgpd:           'I agree to be contacted by the school for the purposes described',
            rgpdLink:       'here',
            submit:         'Download brochure',
            sending:        'Sending...',
            successTitle:   'Your brochure is ready!',
            successMsg:     'You can download it right now. It has also been '
                          + 'sent to you by email.',
            ctaBrochure:    'Download the brochure',
            errRequired:    'This field is required.',
            errEmail:       'Invalid email format.',
            errEmailDom:    'Please use a valid email address.',
            errPhone:       'Invalid number (e.g. 07 12 34 56 78).',
            errGeneric:     'An error occurred, please try again.',
        }
    };

    /* ── Générateur HTML ─────────────────────────────────────────────── */
    function buildContent(lang) {
        const t = TRANS[lang] || TRANS.fr;
        const rgpd = resolveRgpdConfig(lang);
        const contactTypeOptions = buildOptions(EDC_PICKLISTS.contactType, '');
        const studyLevelOptions  = buildOptions(EDC_PICKLISTS.studyLevel,  '');
        const campusOptions      = buildOptions(EDC_PICKLISTS.campus,      '');
        const countryOptions     = buildOptions(EDC_PICKLISTS.countries,   '');

        return `
<section class="brf-section"
  data-gjs-droppable="false"
  data-lp-form="1">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.brf-section *, .brf-section *::before, .brf-section *::after { box-sizing: border-box; }
.brf-section {
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 16px; background: transparent;
    font-family: var(--brand-font, 'Inter', sans-serif); font-size: 13px; color: var(--brand-text, #1a1a1a);
}
.brf-card {
    width: 100%; max-width: 520px;
    background: #F4EFEA; padding: 24px 24px 28px;
}
.brf-title { font-size: 18px; font-weight: 700; color: var(--brand-text, #1a1a1a); margin: 0 0 4px; }
.brf-subtitle { font-size: 12px; color: var(--brand-muted, #6b7280); margin: 0 0 18px; }
.brf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
/* Cellule de la grille, un champ par cellule. Elle existe pour que le niveau
   d'études et le campus ne soient pas FRERES : le socle réordonne les champs
   qui partagent un parent, et les laisse intacts sinon. min-width:0 parce
   qu'une cellule de grille refuse sinon de descendre sous la largeur de son
   contenu, et un <select> à libellés longs élargirait la colonne. */
.brf-col { min-width: 0; }
.brf-field { display: flex; flex-direction: column; margin-bottom: 12px; }
.brf-row .brf-field { margin-bottom: 0; }
.brf-field.hidden { display: none; }
.brf-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a4a;
    margin-bottom: 6px;
    display: block;
}
.brf-label .req { color: inherit; }
.brf-input, .brf-select {
    width: 100%; height: 46px; padding: 0 14px;
    border: 1px solid #000; border-radius: 0;
    font-size: 13px; font-family: inherit; color: #000; background: var(--brand-background, #ffffff);
    outline: none; appearance: none; -webkit-appearance: none; transition: border-color 0.2s;
}
.brf-input:focus, .brf-select:focus { border-color: var(--brand-muted, #6b7280); }
.brf-input.err, .brf-select.err { border-color: #c00; }
.brf-err-msg { font-size: 10px; color: #c00; margin-top: 4px; display: none; }
.brf-err-msg.show { display: block; }
.brf-sel-wrap { position: relative; }
.brf-sel-wrap::after {
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
.brf-phone-wrap { display: flex; gap: 8px; }
.brf-phone-prefix-wrap {
    position: relative;
    /* 112px et non 84 : le socle remplace les options par les 201
       indicatifs du CRM, dont les libelles sont du genre
       "+212 (Maroc)" la ou la liste de repli disait "MA (+212)". */
    width: 112px;
    flex-shrink: 0;
}
.brf-phone-prefix-wrap::after {
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
.brf-phone-prefix {
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
.brf-rgpd { flex-wrap: wrap; }
.brf-rgpd .brf-err-msg { flex-basis: 100%; margin-left: 28px; }

.brf-rgpd { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0 20px; }
.brf-rgpd input[type="checkbox"] {
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
.brf-rgpd input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 13px;
    font-weight: 700;
    color: #000;
}
.brf-rgpd-label { font-size: 11px; color: var(--brand-text, #1a1a1a); line-height: 1.5; cursor: pointer; }
.brf-rgpd-label a { color: #000; text-decoration: underline; }
.brf-submit-wrap { display: block; width: 100%; }
.brf-submit {
    /* display:block et NON inline-flex : le flex supprime les blancs entre deux
       éléments, donc l'espace tapé dans le libellé disparaissait dès que
       l'éditeur scindait le texte en plusieurs nœuds. */
    width: 100%; display: block; text-align: center;
    padding: 14px; background: #000; color: var(--brand-button-text, #ffffff);
    border: none; border-radius: 0; font-size: 14px; font-weight: 700;
    font-family: inherit; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: background 0.15s;
}
.brf-submit::after {
    content: '';
}
.brf-submit:hover { background: #222; }
.brf-submit:disabled { background: #888; cursor: not-allowed; }
.brf-success { display: none; padding: 16px 0 8px; text-align: center; }
.brf-success h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--brand-text, #1a1a1a); }
.brf-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #fff; border-top-color: transparent;
    border-radius: 50%; animation: brf-spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px;
}
@keyframes brf-spin { to { transform: rotate(360deg); } }
@media(max-width:460px){
    .brf-row { grid-template-columns: 1fr; }
    .brf-phone-prefix-wrap { width: 80px; }
}
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="brf-card">

    <h3 class="brf-title">${t.title}</h3>
    <p class="brf-subtitle">${t.subtitle}</p>

    <!-- Confirmation (masquée initialement) -->
    <div class="brf-success">
        <div style="font-size:40px;margin-bottom:10px;">✔️</div>
        <h3 class="brf-success-title"></h3>
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
    <form class="brf-form" data-lang="${lang}" method="post">
${buildHiddenFields({ formName: 'Telechargement_Brochure', formType: 'brochure', lang })}

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
                    <div class="brf-phone-prefix-wrap">
                        <select name="Indicatif" class="brf-phone-prefix" aria-label="Prefix">
                            <option value="33" selected>FR (+33)</option>
                            <option value="32">BE (+32)</option>
                            <option value="41">CH (+41)</option>
                            <option value="352">LU (+352)</option>
                            <option value="1">US (+1)</option>
                            <option value="44">GB (+44)</option>
                            <option value="212">MA (+212)</option>
                        </select>
                    </div>
                    <input class="brf-input brf-phone-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="brf-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Pays de résidence — position 6 de l'Excel des champs visibles :
             juste après le téléphone, avant le niveau d'études. Ce champ ne
             figure PAS dans la table NOM_DOM du socle, qui ne réordonne que
             campus, niveau, spécialité, rythme, langue, rentrée et programme :
             sa place ici est donc définitive, page publiée comprise. -->
        <div class="brf-field">
            <label class="brf-label">${t.country}<span class="req">*</span></label>
            <div class="brf-sel-wrap">
                <select class="brf-select" name="Country" required>
                    ${countryOptions}
                </select>
            </div>
            <span class="brf-err-msg">${t.errRequired}</span>
        </div>

        <!-- Niveau d'études / Campus — positions 7 et 8 de l'Excel.
             ═══════════════════════════════════════════════════════════════
             ⚠ CHAQUE CHAMP A SON PROPRE .brf-col. NE PAS LES REMETTRE FRERES
             DANS LE .brf-row.

             Sur la page publiée, le socle exécute appliquerOrdre() et
             réordonne le DOM par-dessus l'ordre écrit ici, selon OrdreChamps
             de l'école — qui vaut « campus,niveau,... » pour les dix écoles.
             Deux .brf-field frères dans le .brf-row formaient un groupe de
             deux porteurs, et le campus repassait donc devant le niveau :
             l'ordre était correct dans le builder et faux en ligne, le
             symptôme le plus coûteux à diagnostiquer.

             reordonner() sort quand un groupe compte moins de deux porteurs,
             et ne fait JAMAIS traverser une section à un champ. Un conteneur
             par champ donne donc deux groupes d'un seul porteur : le socle
             les laisse tous deux intacts, et l'ordre du gabarit est celui qui
             s'affiche. Couvert par le test « Brochure : un champ seul dans sa
             section n est pas deplace » (sfmc-ssjs/test/test-cascade.js).

             Le .brf-col est une cellule de la grille : la mise en page à deux
             colonnes est inchangée.

             ⚠ Pas d'accent grave dans ce commentaire : il vit DANS un template
             literal, où un accent grave ferme la chaîne et casse le module —
             l'erreur remonte alors sur le mot suivant, jamais sur la cause. -->
        <div class="brf-row">
            <div class="brf-col">
                <div class="brf-field">
                    <label class="brf-label">${t.studyLevel}<span class="req">*</span></label>
                    <div class="brf-sel-wrap">
                        <select class="brf-select brf-niveau" name="StudyLevel" required>
                            ${studyLevelOptions}
                        </select>
                    </div>
                    <span class="brf-err-msg">${t.errRequired}</span>
                </div>
            </div>
            <div class="brf-col">
                <div class="brf-field">
                    <label class="brf-label">${t.campus}<span class="req">*</span></label>
                    <div class="brf-sel-wrap">
                        <select class="brf-select lp-campus-select" name="Campus" required>
                            ${campusOptions}
                        </select>
                    </div>
                    <span class="brf-err-msg">${t.errRequired}</span>
                </div>
            </div>
        </div>

        <!-- Spécialité (règle §6) — seule brique de la cascade hors
             candidature : le contrat ne prévoit rythme, langue et rentrée que
             sur la candidature. Masquée au départ ; c'est le socle qui décide,
             selon la matrice de l'école et le nombre de valeurs restantes. Un
             champ à une seule valeur reste masqué mais renseigné, et part au CRM.

             C'est CE champ que « Champs visibles des formulaires.xlsx » appelle
             « Programme souhaité » — trois écoles le portent hors candidature :
             BRASSART, IFA Paris, MoPA.

             Inerte dans le builder, qui n'exécute pas le socle. -->
        <div class="brf-field brf-speciality-field hidden">
            <label class="brf-label">${t.speciality}</label>
            <div class="brf-sel-wrap">
                <select class="brf-select" name="Speciality" data-placeholder="${t.specialityPh}">
                    <option value="">${t.specialityPh}</option>
                </select>
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

        <!-- Champs conditionnels parent (facultatifs) -->
        <div class="brf-field brf-child-ln-field hidden">
            <label class="brf-label">${t.childLastName}</label>
            <input class="brf-input" type="text" name="ChildLastName">
        </div>
        <div class="brf-field brf-child-fn-field hidden">
            <label class="brf-label">${t.childFirstName}</label>
            <input class="brf-input" type="text" name="ChildFirstName">
        </div>
        <div class="brf-field brf-child-phone-field hidden">
            <label class="brf-label">${t.childPhone}</label>
            <input class="brf-input brf-child-phone-input" type="tel" name="ChildPhone">
            <span class="brf-err-msg">${t.errPhone}</span>
        </div>

        <!-- RGPD -->
        <div class="brf-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true" required>
            <label class="brf-rgpd-label">
                <span data-rgpd-text>${rgpd.text}</span> <a data-rgpd-link href="${rgpd.url}" target="_blank">${rgpd.linkLabel}</a>
            </label>
        </div>

        <div class="brf-submit-wrap">
            <!-- Libellé dans un <span> éditable : sur un <button> focalisé, la
                 touche Espace active le bouton au lieu d'insérer un caractère. -->
            <button type="submit" class="brf-submit"><span class="brf-submit-label" data-gjs-type="text">${t.submit}</span></button>
        </div>
    </form>

</div><!-- /.brf-card -->
${socleReadSnippet({ formType: 'brochure' })}
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

    /* ── LE CTA « TÉLÉCHARGER LA BROCHURE » DANS L'APERÇU ──────────────
     *
     * Retour client du 03/09 : le lien de téléchargement doit apparaître dans
     * la confirmation, juste après la soumission.
     *
     * ⚠ CE CODE NE SERT QU'À L'APERÇU DU BUILDER. Sur une page publiée, ce
     * fichier n'est pas chargé — le JS des blocs s'attache via
     * `component:mount`, donc dans le canvas GrapesJS seulement (cf.
     * PASSATION-FORMULAIRES.md §1.1). C'est le socle qui pose le vrai CTA, et
     * il en tire l'URL de `SOCLE_DATA.brochures`, alimenté par une Data
     * Extension.
     *
     * Cette DE N'EXISTE PAS ENCORE (état au 04/09). En attendant, l'aperçu
     * affiche le bouton avec une URL de démonstration, pour que la maquette
     * montre l'écran complet ; la page publiée, elle, affichera simplement le
     * message sans bouton tant que la DE n'est pas là.
     *
     * `res.statut === 'simule'` est ce qui distingue les deux : `soumettre()`
     * ne rend ce statut que lorsqu'aucun socle ne tourne. */
    function ctaDeDemo(res, t) {
        if (res.statut !== 'simule') return null;
        return { libelle: t.ctaBrochure, href: '#' };
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
            /* La preuve suit le texte affiché. Sans cela, une config RGPD
               rafraîchie ici laisserait le champ caché sur l'ancienne
               formulation : on prouverait l'acceptation d'un texte que la
               personne n'a jamais vu. */
            const preuveEl = form.querySelector('[name="LegalTexteAccepted"]');
            if (preuveEl && text) preuveEl.value = text;
        });

        /* ── Champs cachés (tracking / CRM) ── */
        populateHiddenFields(form, { lang });

        const vousEtesEl     = form.querySelector('.brf-vous-etes');
        const niveauEl       = form.querySelector('.brf-niveau');
        const campusEl       = form.querySelector('[name="Campus"]');
        const emailEl        = form.querySelector('.brf-email-input');
        const phoneEl        = form.querySelector('.brf-phone-input');
        const childPhoneEl   = form.querySelector('.brf-child-phone-input');
        const programmeField = form.querySelector('.brf-programme-field');
        const programmeSelect= form.querySelector('.brf-programme-select');
        const childLnField   = form.querySelector('.brf-child-ln-field');
        const childFnField   = form.querySelector('.brf-child-fn-field');
        const childPhoneField= form.querySelector('.brf-child-phone-field');

        const school = (() => {
            try { return (form.ownerDocument.defaultView || window).CURRENT_SCHOOL || null; }
            catch (e) { return null; }
        })();
        const showProgramme = isProgrammeSchool(school);

        /* ── Cascade de reconstitution du programme (règle §6) ────────────
           Quand le socle a publié les programmes, c'est ELLE qui pilote la
           spécialité, et le champ Programme n'a plus lieu d'être.

           Sinon — builder, ou Salesforce muet — on garde l'ancien
           comportement : un select Programme alimenté par niveau + campus.
           Les deux ne coexistent jamais. */
        const cascadeActive = brancherCascadeProgramme(form);

        function refreshConditions() {
            const vousEtes = vousEtesEl ? vousEtesEl.value : '';
            const niveau   = niveauEl   ? niveauEl.value   : '';
            const campus   = campusEl   ? campusEl.value   : '';

            /* Parent → champs enfant (Nom + Prénom + Téléphone, facultatifs) */
            const isParent = vousEtes === 'parent';
            [childLnField, childFnField, childPhoneField].forEach(f => {
                if (f) f.classList.toggle('hidden', !isParent);
            });
            if (!isParent) {
                ['ChildLastName', 'ChildFirstName', 'ChildPhone'].forEach(n => {
                    const el = form.querySelector(`[name="${n}"]`);
                    if (el) el.value = '';
                });
            }

            /* Niveau + campus + école → programmes. Sauté quand la cascade
               tient le sujet : elle a déjà masqué ce champ. */
            const progs = (showProgramme && !cascadeActive) ? getProgrammes(niveau, campus, lang) : [];
            if (!cascadeActive && programmeField && programmeSelect) {
                if (progs.length > 0) {
                    programmeSelect.innerHTML = `<option value="">${t.programmePh}</option>`
                        + progs.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
                    programmeField.classList.remove('hidden');
                } else {
                    programmeField.classList.add('hidden');
                    programmeSelect.value = '';
                }
            }
        }

        if (vousEtesEl) vousEtesEl.addEventListener('change', refreshConditions);
        if (niveauEl)   niveauEl.addEventListener('change', refreshConditions);
        if (campusEl)   campusEl.addEventListener('change', refreshConditions);
        refreshConditions();
        if (cascadeActive && programmeField) programmeField.classList.add('hidden');

        if (emailEl) emailEl.addEventListener('blur', function () {
            const e = validateEmail(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        if (phoneEl) phoneEl.addEventListener('blur', function () {
            const e = validatePhone(this.value.trim(), t);
            e ? showFieldErr(this, e) : clearFieldErr(this);
        });

        if (childPhoneEl) childPhoneEl.addEventListener('blur', function () {
            if (!this.value.trim()) { clearFieldErr(this); return; }
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

            if (childPhoneField && !childPhoneField.classList.contains('hidden') && childPhoneEl && childPhoneEl.value.trim()) {
                const ce = validatePhone(childPhoneEl.value.trim(), t);
                if (ce) { showFieldErr(childPhoneEl, ce); ok = false; } else clearFieldErr(childPhoneEl);
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
                           ses valeurs, et l'ecran `.brf-success` n'est plus
                           ouvert du tout — meme comportement que le socle sur
                           une page publiee. Sa liste de brochures « (PDF) »,
                           aux liens morts, disparait donc avec lui. */
                        montrerSucces(form, t.successTitle, t.successMsg,
                                      ctaDeDemo(res, t));
                    } else {
                        /* Le message du socle plutot qu'un « une erreur est
                           survenue » : c'est lui qui nomme le champ refuse. */
                        alert(res.message || t.errGeneric);
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
    ajouterBloc(editor,'form-brochure', {
        label: 'Formulaire Brochure',
        category: categories.FORMS,
        content: buildContent('fr'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    ajouterBloc(editor,'form-brochure-en', {
        label: 'Formulaire Brochure Anglais',
        category: categories.FORMS,
        content: buildContent('en'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
