/**
 * Bloc : Formulaire Inscription Stage Découverte (FR + EN)
 * ───────────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx » — onglet « Inscription Stage ».
 * Moteur commun : ../shared/event-form.js.
 * Écoles concernées : BRASSART, CREAD, MOPA, École Bleue.
 * Comme l'Atelier : pas de « Vous êtes », pas de champs enfant.
 */

import { buildEventBlock, attachEventFormLogic } from '../shared/event-form.js';

export default function (editor, categories) {

    attachEventFormLogic(editor);

    editor.BlockManager.add('form-stage', {
        label: 'Formulaire Stage',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'Stage', nomAction: 'Inscription_Stage',
            submitLabel: "Je m'inscris au stage",
            formTitle: 'Inscription au Stage',
            formSubtitle: 'Candidatez pour un stage au sein de notre école.',
            lang: 'fr', showVousEtes: false, showChild: false
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });

    editor.BlockManager.add('form-stage-en', {
        label: 'Formulaire Stage Anglais',
        category: categories.FORMS,
        content: buildEventBlock({
            typeEvenement: 'Stage', nomAction: 'Inscription_Stage',
            submitLabel: 'Apply for the internship',
            formTitle: 'Internship Application',
            formSubtitle: 'Apply for an internship at our school.',
            lang: 'en', showVousEtes: false, showChild: false
        }),
        attributes: { class: 'gjs-fonts gjs-f-form' }
    });
}
