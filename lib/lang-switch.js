/**
 * Sélecteur de langue du header : transforme `.hdr-lang` en VRAI lien.
 *
 * Modèle « une page par langue » : chaque langue est une page autonome, avec sa
 * propre URL `/<lang>/<slug>`. Le bouton de langue du header ne bascule donc plus
 * le contenu dans la page (voir lib/bilingual.js, conservé pour les anciennes
 * pages à variantes) : il REDIRIGE vers la page sœur de l'autre langue.
 *
 * ⚠️ L'injection se fait au moment de SERVIR la page, jamais à l'enregistrement.
 * À l'enregistrement de la page FR, la page EN n'existe pas encore (le lien serait
 * vide), et un lien gravé deviendrait faux dès qu'un slug change. Calculé au
 * service, il est toujours juste et ne nécessite aucun ré-enregistrement.
 *
 * Le style ne peut pas bouger : on conserve l'élément, sa classe et ses attributs.
 * Un `<div class="hdr-lang">` devient un `<a class="hdr-lang">` — le CSS des blocs
 * cible la classe, donc il continue de matcher à l'identique. Seul le soulignement
 * par défaut des liens est neutralisé en inline (blocks/headers.js ne déclare pas
 * `text-decoration`, contrairement à blocks/school-brand).
 */
const cheerio = require('cheerio');

/**
 * Le bouton de langue existe sous DEUX formes selon l'origine du header :
 *   • `.hdr-lang` — blocs header d'école (blocks/headers.js, school-brand…)
 *   • `.dh-lang`  — header des pages issues d'une MASTER TEMPLATE déclinée
 *                   (lib/school-blocks.js → renderSchoolHeaderHtml)
 * Ne cibler que le premier laissait le bouton inerte sur toutes les pages
 * déclinées, qui sont pourtant le cas d'usage principal.
 */
const LANG_TOGGLE = '.hdr-lang, .dh-lang';

const LANG_LABELS = {
    FR: 'Français', EN: 'English', ES: 'Español',
    DE: 'Deutsch', IT: 'Italiano', PT: 'Português'
};

function normLang(lang) {
    return String(lang || 'FR').trim().toUpperCase();
}

/** Adresse utilisable d'un lien : l'URL absolue si connue, sinon le chemin. */
function hrefOf(link) {
    return link && (link.url || link.path) ? (link.url || link.path) : '';
}

/**
 * @param {string} html            HTML complet de la page servie.
 * @param {Object} options
 * @param {Array}  options.links   [{ language, isCurrent, isOriginal, path, url }]
 * @param {string} options.currentLanguage Langue de la page servie.
 * @returns {string} HTML avec le sélecteur câblé (inchangé s'il n'y a pas de page sœur).
 */
function injectLanguageSwitch(html, { links = [], currentLanguage = 'FR' } = {}) {
    const source = String(html || '');
    if (!source) return source;

    const current = normLang(currentLanguage);
    const others = (links || []).filter(l => normLang(l.language) !== current && hrefOf(l));
    // Aucune page sœur publiée → on ne touche à rien : le bouton reste inerte,
    // ce qui vaut mieux qu'un lien mort dans le header.
    if (!others.length) return source;

    const target = others[0];
    const targetLang = normLang(target.language);
    const targetHref = hrefOf(target);
    const targetLabel = LANG_LABELS[targetLang] || targetLang;

    const $ = cheerio.load(source, { decodeEntities: false }, true);

    let switched = 0;
    $(LANG_TOGGLE).each((_, el) => {
        const node = $(el);
        // Un libellé personnalisé (autre qu'un code langue) est respecté ; on ne
        // réécrit que les libellés courts du type « FR » / « EN ».
        const label = (node.text() || '').trim();
        if (!label || label.length <= 3) node.text(targetLang);

        node.attr('href', targetHref);
        node.attr('hreflang', targetLang.toLowerCase());
        node.attr('title', `Voir cette page en ${targetLabel}`);
        node.attr('data-lang-target', targetLang);
        // `<div>` → `<a>` : les classes (donc le CSS) sont conservées à l'identique.
        if (el.tagName && el.tagName.toLowerCase() !== 'a') el.tagName = 'a';
        const style = (node.attr('style') || '').trim();
        if (!/text-decoration/i.test(style)) {
            node.attr('style', (style ? style.replace(/;?$/, ';') : '') + 'text-decoration:none;');
        }
        switched += 1;
    });

    // Balises hreflang : uniquement avec des URLs absolues (Google les exige).
    // Idempotent — les balises d'une injection précédente sont retirées d'abord.
    const head = $('head');
    if (head.length) {
        $('link[data-lp-hreflang]').remove();
        const absolute = (links || []).filter(l => l.url);
        if (absolute.length > 1) {
            absolute.forEach(l => {
                head.append(`<link rel="alternate" data-lp-hreflang hreflang="${normLang(l.language).toLowerCase()}" href="${l.url}">`);
            });
            const fallback = absolute.find(l => l.isOriginal) || absolute[0];
            head.append(`<link rel="alternate" data-lp-hreflang hreflang="x-default" href="${fallback.url}">`);
        }
    }

    return switched || head.length ? $.html() : source;
}

module.exports = { injectLanguageSwitch };
