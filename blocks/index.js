import basics from './basics/index.js';
import { registerMasterComponents } from '../MasterTemplate/Components/index.js';
// Header + Footer dédiés par école (10 écoles) — moteur commun : ./school-brand
import headerEfap from './header-efap/index.js';
import footerEfap from './footer-efap/index.js';
import headerBrassart from './header-brassart/index.js';
import footerBrassart from './footer-brassart/index.js';
import headerIcart from './header-icart/index.js';
import footerIcart from './footer-icart/index.js';
import headerCread from './header-cread/index.js';
import footerCread from './footer-cread/index.js';
import headerEsec from './header-esec/index.js';
import footerEsec from './footer-esec/index.js';
import headerIfaParis from './header-ifa-paris/index.js';
import footerIfaParis from './footer-ifa-paris/index.js';
import headerMopa from './header-mopa/index.js';
import footerMopa from './footer-mopa/index.js';
import headerEcoleBleue from './header-ecole-bleue/index.js';
import footerEcoleBleue from './footer-ecole-bleue/index.js';
import headerEfj from './header-efj/index.js';
import footerEfj from './footer-efj/index.js';
import header3wa from './header-3wa/index.js';
import footer3wa from './footer-3wa/index.js';
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
        ESSENTIAL: 'Essential Blocks',
        FORMS: 'Form Blocks'
    };

    // Load all blocks
    [
        headerEfap, footerEfap, headerBrassart, footerBrassart,
        headerIcart, footerIcart, headerCread, footerCread,
        headerEsec, footerEsec, headerIfaParis, footerIfaParis,
        headerMopa, footerMopa, headerEcoleBleue, footerEcoleBleue,
        headerEfj, footerEfj, header3wa, footer3wa,
        icartBlocks,
        hero, twoColumn, richText, ctaButton, imageCaption, spacer,
        horizontalMenu, bandeRose, programmeList, programmeEditorial,
        troisRaisons, formSfmc, chiffresCles,
        carousel, CarrouselTemoignages,
        icartBlocks, formSalesforceCore,
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
