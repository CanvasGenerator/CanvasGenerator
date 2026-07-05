/**
 * Bloc : Formulaire Inscription Atelier Découverte (FR + EN)
 * ───────────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — onglet « Inscription AD ».
 * Moteur commun : ../shared/event-form.js.
 * Différence vs JPO : pas de « Vous êtes », pas de champs enfant.
 */

import { buildEventBlock, attachEventFormLogic } from '../shared/event-form.js';

export default function (editor, categories) {

    attachEventFormLogic(editor);

    editor.BlockManager.add('form-atelier', {
        label: 'Formulaire Atelier Découverte',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'Atelier_Decouverte', nomAction: 'Inscription_Atelier',
            submitLabel: "Je m'inscris à l'atelier",
            formTitle: "Inscription à l'Atelier Découverte",
            formSubtitle: 'Participez à notre atelier et explorez nos programmes.',
            lang: 'fr', showVousEtes: false, showChild: false
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-atelier-en', {
        label: 'Formulaire Atelier Découverte Anglais',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'Atelier_Decouverte', nomAction: 'Inscription_Atelier',
            submitLabel: 'Register for the workshop',
            formTitle: 'Discovery Workshop Registration',
            formSubtitle: 'Join our workshop and explore our programmes.',
            lang: 'en', showVousEtes: false, showChild: false
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
