import header from './Header/index.js';
import footer from './Footer/index.js';
import hero from './Hero/index.js';
import navigation from './Navigation/index.js';
import programme from './Programme/index.js';
import chiffresCles from './ChiffresCles/index.js';
import troisRaisons from './TroisRaisons/index.js';
import carousel from './Carousel/index.js';
import carouselVariantA from './CarouselVariantA/index.js';
import carouselVariantB from './CarouselVariantB/index.js';
import carouselVariantC from './CarouselVariantC/index.js';
import carouselVariantD from './CarouselVariantD/index.js';
import carouselVariantE from './CarouselVariantE/index.js';
import card from './Card/index.js';
import contentSection from './ContentSection/index.js';
import form from './Form/index.js';
import cta from './CTA/index.js';
import tabs from './Tabs/index.js';
import accordion from './Accordion/index.js';
import modal from './Modal/index.js';
import carousel2A from './Carousel2A/index.js';
import carousel2B from './Carousel2B/index.js';
import carousel2C from './Carousel2C/index.js';
import carousel3Campus from './Carousel3Campus/index.js';
import blocsTexte3Col from './BlocsTexte3Col/index.js';
import chiffresCles2 from './ChiffresCles2/index.js';

export function registerMasterComponents(editor) {
    const categories = {
        MASTER: 'Master Template'
    };

    [
        header,
        footer,
        hero,
        navigation,
        programme,
        chiffresCles,
        troisRaisons,
        carousel,
        carouselVariantA,
        carouselVariantB,
        carouselVariantC,
        carouselVariantD,
        carouselVariantE,
        card,
        contentSection,
        form,
        cta,
        tabs,
        accordion,
        modal,
        carousel2A,
        carousel2B,
        carousel2C,
        carousel3Campus,
        blocsTexte3Col,
        chiffresCles2
    ].forEach(blockInit => {
        if (typeof blockInit === 'function') {
            blockInit(editor, categories);
        } else {
            console.warn('Master block skipped: missing export default function');
        }
    });
}
