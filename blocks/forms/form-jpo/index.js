/**
 * Bloc : Formulaire Inscription JPO (FR + EN)
 * ───────────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — onglet « Inscription JPO ».
 * Le moteur commun (HTML + logique) vit dans ../shared/event-form.js.
 * Ce fichier ne fait qu'enregistrer les 2 variantes du bloc JPO.
 */

import { buildEventBlock, attachEventFormLogic } from '../shared/event-form.js';

export default function (editor, categories) {

    attachEventFormLogic(editor);

    editor.BlockManager.add('form-jpo', {
        label: 'Formulaire JPO',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'JPO', nomAction: 'Inscription_JPO',
            submitLabel: 'Réserver ma place',
            formTitle: "S'inscrire aux portes ouvertes",
            formSubtitle: 'Admission hors Parcoursup – places limitées',
            lang: 'fr', showVousEtes: true, showChild: true
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-jpo-en', {
        label: 'Formulaire JPO Anglais',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'JPO', nomAction: 'Inscription_JPO',
            submitLabel: 'Register',
            formTitle: 'Open Day Registration',
            formSubtitle: 'Come and discover our programmes and meet our teams.',
            lang: 'en', showVousEtes: true, showChild: true
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
