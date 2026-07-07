/**
 * Bloc HEADER 3WA — composant dédié de l'école.
 * Design + couleurs centralisés dans ../school-brand/index.js (moteur commun).
 */
import { registerSchoolHeader } from '../school-brand/index.js';

export default function (editor) {
    registerSchoolHeader(editor, '3wa');
}
