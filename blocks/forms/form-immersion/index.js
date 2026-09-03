/**
 * Bloc : Formulaire Demande d'immersion (FR + EN)
 * ─────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — onglet « Demande immersion ».
 * Écoles concernées : BRASSART, ESEC, CREAD, MOPA, Ecole Bleue, 3WA, IFA Paris.
 *
 * Champs visibles : Nom, Prénom, Email, Indicatif + Téléphone,
 *                   Niveau d'études, Campus, Programme souhaité (conditionnel), RGPD.
 * Champs cachés    : Marque + tracking (utm_*, gclid, consent…) via shared/tracking-fields.
 *
 * À la soumission : message de confirmation + mail accusé de réception,
 * puis prise de contact téléphonique par le responsable développement.
 *
 * MODE TEST — soumission simulée en JS pur, PAS de <script> inline
 * (non exécuté par GrapesJS CDN). Logique via editor.on('component:mount').
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
            dateChoix:   'Choisissez votre date',
            /* Campus sans date : avertissement rendu en CSS pur (::before),
               sans modification du socle. */
            noDate:      "Aucune date n'est disponible pour ce campus. "
                         + "L'inscription est impossible : merci de choisir un autre campus.",
            ateliers:    'Au programme',
            title:       "Demande d'immersion",
            subtitle:    "Vivez une journée dans notre école. Laissez-nous vos coordonnées, notre équipe vous recontacte.",
            lastName:    'Nom',
            firstName:   'Prénom',
            email:       'Adresse email',
            mobile:      'Portable',
            mobilePh:    '06 12 34 56 78',
            studyLevel:  "Niveau d'études",
            campus:      'Campus',
            programme:   'Programme souhaité',
            programmePh: 'Sélectionnez un programme...',
            speciality:   'Programme souhaité',
            specialityPh: 'Sélectionnez...',
            rgpdLink:    'ici',
            submit:      'Envoyer ma demande',
            sending:     'Envoi en cours...',
            /* Le texte du socle, au mot pres : c'est lui que le visiteur lit
               sur une page publiee. Un apercu qui dirait autre chose ferait
               valider en recette un message qui n'existe nulle part. */
            successTitle: 'Votre demande de participation est confirmée !',
            successMsg:  'Notre équipe des admissions vous contactera '
                       + 'prochainement par téléphone afin de convenir '
                       + 'd\'une date.',
            errRequired: 'Ce champ est requis.',
            errEmail:    'Format e-mail invalide.',
            errEmailDom: 'Veuillez utiliser une adresse valide.',
            errPhone:    'Numéro invalide (ex: 06 12 34 56 78).',
            errGeneric:  'Une erreur est survenue, veuillez réessayer.',
        },
        en: {
            dateChoix:   'Choose your date',
            noDate:      'No date is available for this campus. '
                         + 'Registration is not possible: please choose another campus.',
            ateliers:    'Programme',
            title:       'Immersion request',
            subtitle:    'Spend a day at our school. Leave us your details and our team will contact you.',
            lastName:    'Last name',
            firstName:   'First name',
            email:       'Email address',
            mobile:      'Mobile',
            mobilePh:    '07 12 34 56 78',
            studyLevel:  'Level of study',
            campus:      'Campus',
            programme:   'Desired programme',
            programmePh: 'Select a programme...',
            speciality:   'Desired programme',
            specialityPh: 'Select...',
            rgpdLink:    'here',
            submit:      'Send my request',
            sending:     'Sending...',
            successTitle: 'Your request to attend is confirmed!',
            successMsg:  'Our admissions team will contact you shortly by '
                       + 'phone to arrange a date.',
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
        const hidden = buildHiddenFields({ formName: 'Demande_Immersion', formType: 'immersion', lang });

        return `
<section class="imf-section"
  data-gjs-droppable="false"
  data-lp-form="1">

<!-- ═══════════ STYLES ═══════════ -->
<style>
.imf-section *, .imf-section *::before, .imf-section *::after { box-sizing: border-box; }
.imf-section {
    display: flex; justify-content: center; align-items: flex-start;
    padding: 40px 16px; background: transparent;
    font-family: var(--brand-font, 'Inter', sans-serif); font-size: 13px; color: var(--brand-text, #1a1a1a);
}
.imf-card {
    width: 100%; max-width: 520px;
    background: #F4EFEA; padding: 24px 24px 28px;
}
.imf-title { font-size: 18px; font-weight: 700; color: var(--brand-text, #1a1a1a); margin: 0 0 4px; }
.imf-subtitle { font-size: 12px; color: var(--brand-muted, #6b7280); margin: 0 0 18px; }
.imf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
/* Cellule de la grille, un champ par cellule : elle existe pour que le niveau
   d'études et le campus ne soient pas FRERES, le socle ne réordonnant que les
   champs qui partagent un parent. min-width:0 parce qu'une cellule de grille
   refuse sinon de descendre sous la largeur de son contenu. */
.imf-col { min-width: 0; }
.imf-field { display: flex; flex-direction: column; margin-bottom: 12px; }
.imf-row .imf-field { margin-bottom: 0; }
.imf-field.hidden { display: none; }
.imf-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4a4a4a;
    margin-bottom: 6px;
    display: block;
}
.imf-label .req { color: inherit; }
.imf-input, .imf-select {
    width: 100%; height: 46px; padding: 0 14px;
    border: 1px solid #000; border-radius: 0;
    font-size: 13px; font-family: inherit; color: #000; background: var(--brand-background, #ffffff);
    outline: none; appearance: none; -webkit-appearance: none; transition: border-color 0.2s;
}
.imf-input:focus, .imf-select:focus { border-color: var(--brand-muted, #6b7280); }
.imf-input.err, .imf-select.err { border-color: #c00; }
.imf-err-msg { font-size: 10px; color: #c00; margin-top: 4px; display: none; }
.imf-err-msg.show { display: block; }
.imf-sel-wrap { position: relative; }
.imf-sel-wrap::after {
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
.imf-phone-wrap { display: flex; gap: 8px; }
.imf-dates,
.imf-ateliers { display: grid; gap: 8px; }
.imf-dates label,
.imf-ateliers label {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border: 1px solid #e2e2e2; border-radius: 8px;
    cursor: pointer; font-size: 14px; line-height: 1.45; background: #fff;
    transition: border-color .15s ease, background .15s ease;
}
.imf-dates label:hover,
.imf-ateliers label:hover { border-color: #b9b9b9; }
.imf-dates input,
.imf-ateliers input { margin-top: 3px; flex-shrink: 0; }
.imf-dates label:has(input:checked),
.imf-ateliers label:has(input:checked) { border-color: #1a1a1a; background: #fafafa; }

/* Meme structure en deux colonnes que les autres formulaires evenement : le
   socle rend les memes classes, quel que soit le formulaire qui l'accueille. */
.socle-instance-corps {
    display: flex; flex: 1; gap: 16px;
    justify-content: space-between; align-items: flex-start; flex-wrap: wrap;
}
/* ── Meme habillage que la carte evenement du builder ────────────────────
   Capture du 03/09 : deux colonnes, le QUAND a gauche sous une icone
   calendrier (date, horaires, conference), le OU a droite sous une icone
   epingle (campus, adresse), separees par un trait vertical.

   Ce CSS vit EN DOUBLE avec shared/event-form.js : toute retouche ici doit
   y etre reportee. Les icones sont en CSS, le mot-cle currentColor n'existant
   pas dans une data-URI : la couleur est celle de .jpo-event-ico, #333.

   ⚠ Ces regles visent des elements que le socle cree A L'EXECUTION. Elles ne
   survivent a la publication que grace a SELECTEURS_RUNTIME dans
   lib/htmlCleaner.js. */
.imf-dates label {
    border-color: #e6e1da;
    background: transparent;
    padding: 16px 18px;
    font-size: 12px;
}
.socle-instance-quand,
.socle-instance-ou {
    display: grid;
    grid-template-columns: 20px 1fr;
    column-gap: 10px;
    row-gap: 2px;
    align-items: start;
    flex: 1;
    min-width: 0;
}
.socle-instance-quand > *,
.socle-instance-ou > * { grid-column: 2; }
.socle-instance-quand::before,
.socle-instance-ou::before {
    content: '';
    width: 20px;
    height: 20px;
    margin-top: 1px;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
}
/* L'icone tient la colonne 1 sur toute la hauteur : elle reste en regard de
   la date meme quand les lignes s'ajoutent en dessous. */
.socle-instance-quand::before {
    grid-row: 1 / -1;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='1.7'%3E%3Crect x='3' y='4.5' width='18' height='16.5' rx='2'/%3E%3Cpath d='M3 9.5h18M8 2.5v4M16 2.5v4' stroke-linecap='round'/%3E%3C/svg%3E");
}
.socle-instance-ou::before {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='1.7'%3E%3Cpath d='M12 21.5s7-6.5 7-11.5a7 7 0 1 0-14 0c0 5 7 11.5 7 11.5z' stroke-linejoin='round'/%3E%3Ccircle cx='12' cy='10' r='2.6'/%3E%3C/svg%3E");
}
.socle-instance-ou {
    border-left: 1px solid #e0dad2;
    padding-left: 18px;
}
.socle-instance-date { font-weight: 700; font-size: 13px; color: #000; }
.socle-instance-lieu { font-size: 12px; color: #555; line-height: 1.5; white-space: pre-line; }
/* Sous 560px les colonnes s'empilent : le trait vertical devient un filet. */
@media (max-width: 560px) {
    .socle-instance-ou {
        border-left: 0; padding-left: 0;
        border-top: 1px solid #e0dad2; padding-top: 10px;
    }
}
/* Bloc entier masque tant qu'il n'y a rien a proposer : un intitule sans
   option n'apprend rien. */
.imf-dates-field:has(.imf-dates:empty),
.imf-ateliers-field:has(.imf-ateliers:empty) { display: none; }

/* Campus sans aucune date. Tant qu'aucun campus n'est choisi, la regle
   ci-dessus masque le bloc — il n'y a rien a annoncer. Des qu'un campus EST
   choisi (select required, donc :valid) et que le socle n'a rendu aucune
   date, on avertit et on neutralise l'envoi. Le ::before ne compte pas dans
   :empty, donc aucune modification du socle n'est necessaire. */
.imf-card:has(.imf-campus:valid) .imf-dates-field:has(.imf-dates:empty) {
    display: flex;
}
.imf-card:has(.imf-campus:valid) .imf-dates:empty::before {
    content: "${t.noDate}";
    display: block;
    padding: 10px 12px;
    border: 1px solid #c00; border-radius: 8px;
    background: #fff5f5; color: #c00;
    font-size: 13px; line-height: 1.45;
}
.imf-card:has(.imf-campus:valid):has(.imf-dates:empty) .imf-submit {
    background: #888; cursor: not-allowed; pointer-events: none;
}

.imf-phone-prefix-wrap {
    position: relative;
    /* 112px et non 84 : le socle remplace les options par les 201
       indicatifs du CRM, dont les libelles sont du genre
       "+212 (Maroc)" la ou la liste de repli disait "MA (+212)". */
    width: 112px;
    flex-shrink: 0;
}
.imf-phone-prefix-wrap::after {
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
.imf-phone-prefix {
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
.imf-rgpd { flex-wrap: wrap; }
.imf-rgpd .imf-err-msg { flex-basis: 100%; margin-left: 28px; }

.imf-rgpd { display: flex; align-items: flex-start; gap: 10px; margin: 16px 0 20px; }
.imf-rgpd input[type="checkbox"] {
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
.imf-rgpd input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 13px;
    font-weight: 700;
    color: #000;
}
.imf-rgpd-label { font-size: 11px; color: var(--brand-text, #1a1a1a); line-height: 1.5; cursor: pointer; }
.imf-rgpd-label a { color: #000; text-decoration: underline; }
.imf-submit-wrap { display: block; width: 100%; }
.imf-submit {
    /* display:block et NON inline-flex : le flex supprime les blancs entre deux
       éléments, donc l'espace tapé dans le libellé disparaissait dès que
       l'éditeur scindait le texte en plusieurs nœuds. */
    width: 100%; display: block; text-align: center;
    padding: 14px; background: #000; color: var(--brand-button-text, #ffffff);
    border: none; border-radius: 0; font-size: 14px; font-weight: 700;
    font-family: inherit; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: background 0.15s;
}
.imf-submit::after {
    content: '';
}
.imf-submit:hover { background: #222; }
.imf-submit:disabled { background: #888; cursor: not-allowed; }
.imf-success { display: none; padding: 16px 0 8px; text-align: center; }
.imf-success h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--brand-text, #1a1a1a); }
.imf-spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid #fff; border-top-color: transparent;
    border-radius: 50%; animation: imf-spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px;
}
@keyframes imf-spin { to { transform: rotate(360deg); } }
@media(max-width:460px){
    .imf-row { grid-template-columns: 1fr; }
    .imf-phone-prefix-wrap { width: 80px; }
}
</style>

<!-- ═══════════ CARD ═══════════ -->
<div class="imf-card">

    <h3 class="imf-title">${t.title}</h3>
    <p class="imf-subtitle">${t.subtitle}</p>

    <!-- Confirmation (masquée initialement) -->
    <div class="imf-success">
        <div style="font-size:40px;margin-bottom:10px;">✔️</div>
        <h3 class="imf-success-title"></h3>
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
    <form class="imf-form" data-lang="${lang}" method="post">
${hidden}

        <!-- Nom / Prénom -->
        <div class="imf-row">
            <div class="imf-field">
                <label class="imf-label">${t.lastName}<span class="req">*</span></label>
                <input class="imf-input" type="text" name="LastName" required>
                <span class="imf-err-msg">${t.errRequired}</span>
            </div>
            <div class="imf-field">
                <label class="imf-label">${t.firstName}<span class="req">*</span></label>
                <input class="imf-input" type="text" name="FirstName" required>
                <span class="imf-err-msg">${t.errRequired}</span>
            </div>
        </div>

        <!-- Email / Portable -->
        <div class="imf-row">
            <div class="imf-field">
                <label class="imf-label">${t.email}<span class="req">*</span></label>
                <input class="imf-input imf-email-input" type="email" name="EmailAddress" required>
                <span class="imf-err-msg">${t.errEmail}</span>
            </div>
            <div class="imf-field">
                <label class="imf-label">${t.mobile}<span class="req">*</span></label>
                <div class="imf-phone-wrap">
                    <div class="imf-phone-prefix-wrap">
                        <select name="Indicatif" class="imf-phone-prefix" aria-label="Prefix">
                            <option value="33" selected>FR (+33)</option>
                            <option value="32">BE (+32)</option>
                            <option value="41">CH (+41)</option>
                            <option value="352">LU (+352)</option>
                            <option value="1">US (+1)</option>
                            <option value="44">GB (+44)</option>
                            <option value="212">MA (+212)</option>
                        </select>
                    </div>
                    <input class="imf-input imf-phone-input" type="tel" name="MobilePhone" required placeholder="${t.mobilePh}" style="flex:1;">
                </div>
                <span class="imf-err-msg">${t.errPhone}</span>
            </div>
        </div>

        <!-- Niveau d'études / Campus -->
        <!-- Niveau d'études / Campus — positions 5 et 6 de l'Excel des champs
             visibles : le niveau AVANT le campus, comme la brochure et à
             l'inverse de la candidature.
             ═══════════════════════════════════════════════════════════════
             ⚠ CHAQUE CHAMP A SON PROPRE .imf-col. NE PAS LES REMETTRE FRERES
             DANS LE .imf-row.

             Le socle réordonne les champs qui PARTAGENT un parent, selon
             OrdreChamps de l'école — qui vaut « campus,niveau,... » pour les
             dix écoles. Deux .imf-field frères formaient un groupe de deux, et
             le campus repassait donc devant le niveau sur la page publiée,
             alors que le builder montrait le bon ordre.

             Un conteneur par champ donne deux groupes d'un seul porteur, que
             le socle laisse intacts.

             ⚠ Pas d'accent grave dans ce commentaire : il vit DANS un template
             literal, où un accent grave ferme la chaîne et casse le module. -->
        <div class="imf-row">
            <div class="imf-col">
                <div class="imf-field">
                    <label class="imf-label">${t.studyLevel}<span class="req">*</span></label>
                    <div class="imf-sel-wrap">
                        <select class="imf-select imf-niveau" name="StudyLevel" required>
                            ${studyLevelOptions}
                        </select>
                    </div>
                    <span class="imf-err-msg">${t.errRequired}</span>
                </div>
            </div>
            <div class="imf-col">
                <div class="imf-field">
                    <label class="imf-label">${t.campus}<span class="req">*</span></label>
                    <div class="imf-sel-wrap">
                        <select class="imf-select imf-campus lp-campus-select" name="Campus" required>
                            ${campusOptions}
                        </select>
                    </div>
                    <span class="imf-err-msg">${t.errRequired}</span>
                </div>
            </div>
        </div>

        <!-- Spécialité (règle §6) — seule brique de la cascade hors
             candidature. Masquée au départ ; c'est le socle qui décide. Un champ
             à une seule valeur reste masqué mais renseigné.

             C'est CE champ que « Champs visibles des formulaires.xlsx » appelle
             « Programme souhaité » — trois écoles le portent hors candidature :
             BRASSART, IFA Paris, MoPA.

             Inerte dans le builder, qui n'exécute pas le socle. -->
        <div class="imf-field imf-speciality-field hidden">
            <label class="imf-label">${t.speciality}</label>
            <div class="imf-sel-wrap">
                <select class="imf-select" name="Speciality" data-placeholder="${t.specialityPh}">
                    <option value="">${t.specialityPh}</option>
                </select>
            </div>
        </div>

        <!-- Programme souhaité (conditionnel : niveau + campus + école) -->
        <div class="imf-field imf-programme-field hidden">
            <label class="imf-label">${t.programme}</label>
            <div class="imf-sel-wrap">
                <select class="imf-select imf-programme-select" name="Programme">
                    <option value="">${t.programmePh}</option>
                </select>
            </div>
        </div>

        <!-- ═══════ DATES ET ATELIERS, REMPLIS PAR LE CRM ═══════
             Memes conteneurs que les autres formulaires evenement, memes
             contraintes : ils doivent rester DANS le <form>, puisque le socle y
             cree des <input type="radio" name="InstanceId">.

             TypeEvenement est indispensable : sans lui le socle ne lit
             aucune instance. L'immersion releve de la famille evenement depuis
             l'arbitrage du mapping v4 — inscription Summit, pas de campagne. -->
        <input type="hidden" name="TypeEvenement" value="Immersion">
        <input type="hidden" name="Appointments"  value="">

        <div class="imf-field imf-dates-field">
            <label class="imf-label">${t.dateChoix}<span class="req">*</span></label>
            <div class="imf-dates" data-socle="instances"></div>
        </div>

        <div class="imf-field imf-ateliers-field">
            <label class="imf-label">${t.ateliers}</label>
            <div class="imf-ateliers" data-socle="appointments"></div>
        </div>

        <!-- RGPD -->
        <div class="imf-rgpd">
            <input type="checkbox" name="RGPDConsent" value="true" required>
            <label class="imf-rgpd-label">
                <span data-rgpd-text>${rgpd.text}</span> <a data-rgpd-link href="${rgpd.url}" target="_blank">${rgpd.linkLabel}</a>
            </label>
        </div>

        <div class="imf-submit-wrap">
            <!-- Libellé dans un <span> éditable : sur un <button> focalisé, la
                 touche Espace active le bouton au lieu d'insérer un caractère. -->
            <button type="submit" class="imf-submit"><span class="imf-submit-label" data-gjs-type="text">${t.submit}</span></button>
        </div>
    </form>

</div><!-- /.imf-card -->
${socleReadSnippet({ formType: 'immersion', eventType: 'Immersion' })}
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
        const wrap = field.closest('.imf-field');
        const span = wrap && wrap.querySelector('.imf-err-msg');
        if (span) { if (msg) span.textContent = msg; span.classList.add('show'); }
    }

    function clearFieldErr(field) {
        if (!field) return;
        field.classList.remove('err');
        const wrap = field.closest('.imf-field');
        const span = wrap && wrap.querySelector('.imf-err-msg');
        if (span) span.classList.remove('show');
    }

    function initImfForm(form) {
        if (!form || form.dataset.imfInit) return;
        form.dataset.imfInit = '1';

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

        /* ── Champs cachés (tracking / CRM) ── */
        populateHiddenFields(form, { lang });

        const niveauEl        = form.querySelector('.imf-niveau');
        const campusEl        = form.querySelector('.imf-campus');
        const emailEl         = form.querySelector('.imf-email-input');
        const phoneEl         = form.querySelector('.imf-phone-input');
        const programmeField  = form.querySelector('.imf-programme-field');
        const programmeSelect = form.querySelector('.imf-programme-select');

        const school = (() => {
            try { return (form.ownerDocument.defaultView || window).CURRENT_SCHOOL || null; }
            catch (e) { return null; }
        })();
        const showProgramme = isProgrammeSchool(school);

        /* ── Cascade de reconstitution du programme (règle §6) ────────────
           Quand le socle a publié les programmes, c'est ELLE qui pilote la
           spécialité, et le champ Programme n'a plus lieu d'être. Sinon —
           builder, ou Salesforce muet — on garde l'ancien select Programme.
           Les deux ne coexistent jamais. */
        const cascadeActive = brancherCascadeProgramme(form);

        function refreshProgramme() {
            if (cascadeActive || !programmeField || !programmeSelect) return;
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
        if (cascadeActive && programmeField) programmeField.classList.add('hidden');

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
                const firstErr = form.querySelector('.imf-input.err, .imf-select.err');
                if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            const btn = form.querySelector('.imf-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="imf-spinner"></span>${t.sending}`; }

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
                           ses valeurs, et l'ecran `.imf-success` n'est plus
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
    function tryInitImf() {
        try {
            const doc = editor.Canvas.getDocument();
            if (!doc) return;
            doc.querySelectorAll('.imf-form').forEach(initImfForm);
        } catch (e) { /* canvas pas encore prêt */ }
    }

    editor.on('component:mount', tryInitImf);
    editor.on('load',            () => setTimeout(tryInitImf, 300));

    /* ── Enregistrement des blocs FR + EN ────────────────────────────── */
    ajouterBloc(editor,'form-immersion', {
        label: "Formulaire Demande d'immersion",
        category: categories.FORMS,
        content: buildContent('fr'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    ajouterBloc(editor,'form-immersion-en', {
        label: "Formulaire Demande d'immersion Anglais",
        category: categories.FORMS,
        content: buildContent('en'),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
