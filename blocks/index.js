import basics from './basics/index.js';
import { registerMasterComponents } from '../MasterTemplate/Components/index.js';
import headerEfap from './header-efap/index.js';
import footerEfap from './footer-efap/index.js';
import headerBrassart from './header-brassart/index.js';
import footerBrassart from './footer-brassart/index.js';
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

export function registerBlocks(editor) {
    const bm = editor.BlockManager;

    // Brand Groups
    const categories = {
        EFAP: 'EFAP Components',
        BRASSART: 'BRASSART Components',
        ICART: 'ICART Components',
        ESSENTIAL: 'Essential Blocks'
    };

    // Load all blocks
    [
        headerEfap, footerEfap, icartBlocks,
        headerBrassart, footerBrassart,
        hero, twoColumn, richText, ctaButton, imageCaption, spacer,
        horizontalMenu, bandeRose, programmeList, programmeEditorial,
        troisRaisons, formSfmc, chiffresCles,
        carousel, CarrouselTemoignages,
        icartBlocks, formSalesforceCore
        
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
