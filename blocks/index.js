import basics from './basics/index.js';
import { registerMasterComponents } from '../MasterTemplate/Components/index.js';
// Headers & footers des 10 écoles centralisés (reproduction fidèle des maquettes).
// Remplace les anciens fichiers dédiés header-efap/footer-efap/header-brassart/footer-brassart
// et les blocs header-icart/footer-icart de icart/index.js.
import headers from './headers.js';
import brassartHeaders from './brassart-headers/index.js';
import efapHeaders from './efap-headers/index.js';
import wa3Headers from './3wa-headers/index.js';
import moreSchoolHeaders from './more-school-headers/index.js';
import footers from './footers.js';
import hero from './hero/index.js';
import twoColumn from './two-column/index.js';
import richText from './rich-text/index.js';
import ctaButton from './cta-button/index.js';
import imageCaption from './image-caption/index.js';
import spacer from './spacer/index.js';
import horizontalMenu from './horizontal-menu/index.js';
import bandeRose from './bande-rose/index.js';
import programmeList from './programme-list/index.js';
import programmeEditorial from './programme-editorial/index.js';
import troisRaisons from './trois-raisons/index.js';
import formSfmc from './form-sfmc/index.js';
import carousel from './carousel/index.js';
import CarrouselTemoignages from './carrousel-temoignages/index.js';
import chiffresCles from './chiffres-cles/index.js';
import icartBlocks from './icart/index.js';
import formSalesforceCore from './form-salesforce-core/index.js';
// Formulaires EDH (besoins EDH/One Point)
import formBrochure from './forms/form-brochure/index.js';
import formJpo from './forms/form-jpo/index.js';
import formAtelier from './forms/form-atelier/index.js';
import formStage from './forms/form-stage/index.js';
import formImmersion from './forms/form-immersion/index.js';
import formCandidature from './forms/form-candidature/index.js';

export function registerBlocks(editor) {
    const bm = editor.BlockManager;

    // Brand Groups
    const categories = {
        EFAP: 'EFAP Components',
        BRASSART: 'BRASSART Components',
        ICART: 'ICART Components',
        EFJ: 'EFJ Components',
        MOPA: 'MOPA Components',
        CREAD: 'CREAD Components',
        ESEC: 'ÉSEC Components',
        '3WA': '3W ACADEMY Components',
        IFA: 'IFA PARIS Components',
        BLEUE: 'ÉCOLE BLEUE Components',
        ESSENTIAL: 'Essential Blocks',
        FORMS: 'Form Blocks'
    };

    // Load all blocks
    [
        headers, brassartHeaders, efapHeaders, wa3Headers, moreSchoolHeaders, footers, icartBlocks,
        hero, twoColumn, richText, ctaButton, imageCaption, spacer,
        horizontalMenu, bandeRose, programmeList, programmeEditorial,
        troisRaisons, formSfmc, chiffresCles,
        carousel, CarrouselTemoignages,
        formSalesforceCore,
        // Formulaires EDH (6 formulaires : Brochure, JPO, Atelier, Stage, Immersion, Candidature)
        formBrochure, formJpo, formAtelier, formStage, formImmersion, formCandidature

    ].forEach(blockInit => {
        if (typeof blockInit === 'function') {
            blockInit(editor, categories);
        } else {
            console.warn('Block skipped: The block is missing an export default function()');
        }
    });

    // Register Master Template Components
    registerMasterComponents(editor);
}
