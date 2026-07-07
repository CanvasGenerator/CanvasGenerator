/**
 * Bloc HEADER IFA-PARIS — composant dédié de l'école.
 * Design + couleurs centralisés dans ../school-brand/index.js (moteur commun).
 */
import { registerSchoolHeader } from '../school-brand/index.js';

export default function (editor) {
    registerSchoolHeader(editor, 'ifa-paris');
}
