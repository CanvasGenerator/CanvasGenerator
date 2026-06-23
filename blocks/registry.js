const BLOCK_REGISTRY = [
    { id: 'header-efap', label: 'Header EFAP', category: 'Navigation', scope: 'school', schools: ['efap'], thumbnail: 'assets/block-thumbnails/header-efap.svg', tags: ['header', 'efap'], enabled: true },
    { id: 'header-brassart', label: 'Header BRASSART', category: 'Navigation', scope: 'school', schools: ['brassart'], thumbnail: 'assets/block-thumbnails/header-brassart.svg', tags: ['header', 'brassart'], enabled: true },
    { id: 'footer-efap', label: 'Footer EFAP', category: 'Navigation', scope: 'school', schools: ['efap'], thumbnail: 'assets/block-thumbnails/footer-efap.svg', tags: ['footer', 'efap'], enabled: true },
    { id: 'footer-brassart', label: 'Footer BRASSART', category: 'Navigation', scope: 'school', schools: ['brassart'], thumbnail: 'assets/block-thumbnails/footer-brassart.svg', tags: ['footer', 'brassart'], enabled: true },
    { id: 'hero', label: 'Hero', category: 'Structure', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/hero.svg', tags: ['landing'], enabled: true, defaultForNewSchools: true },
    { id: 'horizontal-menu', label: 'Menu horizontal', category: 'Navigation', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/horizontal-menu.svg', tags: ['navigation'], enabled: true },
    { id: 'bande-rose', label: 'Bande rose', category: 'BRASSART', scope: 'school', schools: ['brassart'], thumbnail: 'assets/block-thumbnails/bande-rose.svg', tags: ['brassart'], enabled: true },
    { id: 'programme-editorial', label: 'Programme éditorial', category: 'Content', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/programme-editorial.svg', tags: ['programmes'], enabled: true },
    { id: 'programme-list', label: 'Liste programmes', category: 'Content', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/programme-list.svg', tags: ['programmes'], enabled: true, defaultForNewSchools: true },
    { id: 'trois-raisons', label: 'Trois raisons', category: 'Content', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/trois-raisons.svg', tags: ['benefits'], enabled: true },
    { id: 'form-sfmc', label: 'Formulaire SFMC', category: 'Forms', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/form-sfmc.svg', tags: ['form', 'sfmc'], enabled: true, defaultForNewSchools: true },
    { id: 'form-salesforce-core', label: 'Formulaire Salesforce Core', category: 'Forms', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/form-sfmc.svg', tags: ['form', 'salesforce'], enabled: true },
    { id: 'chiffres-cles', label: 'Chiffres clés', category: 'Content', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/chiffres-cles.svg', tags: ['stats'], enabled: true },
    { id: 'cta-button', label: 'CTA bouton', category: 'Conversion', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/cta-button.svg', tags: ['cta'], enabled: true, defaultForNewSchools: true },
    { id: 'rich-text', label: 'Texte riche', category: 'Content', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/rich-text.svg', tags: ['text'], enabled: false },
    { id: 'two-column', label: 'Deux colonnes', category: 'Structure', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/two-column.svg', tags: ['layout'], enabled: false },
    { id: 'image-caption', label: 'Image avec légende', category: 'Media', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/image-caption.svg', tags: ['image'], enabled: true },
    { id: 'spacer', label: 'Espacement', category: 'Structure', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/spacer.svg', tags: ['layout'], enabled: false },
    { id: 'Carrousel', label: 'Carrousel', category: 'Media', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/carrousel.svg', tags: ['carousel'], enabled: true },
    { id: 'CarrouselTemoignages', label: 'Carrousel témoignages', category: 'Social Proof', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/carrousel-temoignages.svg', tags: ['carousel', 'testimonials'], enabled: true },
    { id: 'master-carousel3-campus', label: 'Carrousel campus', category: 'Media', scope: 'global', schools: [], thumbnail: 'assets/block-thumbnails/carrousel-campus.svg', tags: ['carousel', 'campus'], enabled: true }
];

function listBlocks({ schoolId } = {}) {
    const normalizedSchoolId = String(schoolId || '').toLowerCase();
    return BLOCK_REGISTRY
        .filter(block => block.enabled !== false)
        .filter(block => !normalizedSchoolId || block.scope === 'global' || (block.schools || []).includes(normalizedSchoolId))
        .map(block => ({ ...block }));
}

function getDefaultBlockIds() {
    return BLOCK_REGISTRY
        .filter(block => block.enabled !== false && block.defaultForNewSchools)
        .map(block => block.id);
}

module.exports = { BLOCK_REGISTRY, listBlocks, getDefaultBlockIds };
