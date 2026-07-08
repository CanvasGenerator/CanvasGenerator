/**
 * Bloc : Formulaire Inscription Atelier Découverte (FR + EN)
 * ───────────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — onglet « Inscription AD ».
 * Moteur commun : ../shared/event-form.js.
 * Différence vs JPO : pas de champs enfant, bouton « RÉSERVER MA PLACE ».
 */

import { buildEventBlock, attachEventFormLogic } from '../shared/event-form.js';

export default function (editor, categories) {

    attachEventFormLogic(editor);

    editor.BlockManager.add('form-atelier', {
        label: 'Formulaire Atelier Découverte',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'Atelier_Decouverte', nomAction: 'Inscription_Atelier',
            submitLabel: 'RÉSERVER MA PLACE',
            formTitle: "Inscription à l'Atelier Découverte",
            formSubtitle: 'Participez à notre atelier et explorez nos programmes.',
            lang: 'fr', showVousEtes: true, showChild: true
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-atelier-en', {
        label: 'Formulaire Atelier Découverte Anglais',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'Atelier_Decouverte', nomAction: 'Inscription_Atelier',
            submitLabel: 'BOOK MY SPOT',
            formTitle: 'Discovery Workshop Registration',
            formSubtitle: 'Join our workshop and explore our programmes.',
            lang: 'en', showVousEtes: true, showChild: true
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
