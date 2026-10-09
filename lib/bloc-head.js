/**
 * Bloc « head » d'une landing page publiée dans SFMC.
 *
 * POURQUOI. La CloudPage écrit le Content Block de la page dans son <body> :
 * le <head> de la LP (titre, meta SEO, CSS, polices…) s'y retrouve, et le
 * navigateur ignore alors <title> et les meta. Plutôt que de les extraire dans
 * la CloudPage, la publication pousse DEUX blocs :
 *   • <clé>        la page complète, comme avant (repli si la CloudPage n'est
 *                  pas à jour ou si le bloc head manque) ;
 *   • <clé>_head   le contenu du <head> de la page, que la CloudPage écrit
 *                  dans SON <head>, puis elle retire ce même head de la page
 *                  avant de l'écrire dans le <body>.
 *
 * VERSION. Les deux blocs portent la même version, posée entre deux meta
 * repères. La CloudPage n'utilise le bloc head que si sa version est celle de
 * la page : si l'un des deux blocs n'a pas été mis à jour (échec réseau entre
 * les deux envois), elle retombe sur le rendu actuel, sans mélanger un head
 * et un body de publications différentes.
 *
 * Aucune clé de page ne finit par « _head » : elles finissent toutes par
 * « _<langue> » (2 lettres) — voir lib/lp-naming.js.
 */
const crypto = require('crypto');

const SUFFIXE_HEAD = '_head';
const RE_HEAD_OUVRANT = /<head(?:\s[^>]*)?>/i;
const RE_HEAD_FERMANT = /<\/head>/i;

function cleBlocHead(customerKey) {
    return String(customerKey || '') + SUFFIXE_HEAD;
}

function repereDebut(version) { return `<meta name="lpb-version" content="${version}">`; }
function repereFin(version)   { return `<meta name="lpb-head-fin" content="${version}">`; }

/** Bornes du contenu du premier <head> de la page, ou null s'il n'y en a pas. */
function bornesHead(html) {
    const ouvrant = RE_HEAD_OUVRANT.exec(html);
    if (!ouvrant) return null;
    const debut = ouvrant.index + ouvrant[0].length;
    const reste = html.slice(debut);
    const fermant = RE_HEAD_FERMANT.exec(reste);
    if (!fermant) return null;
    return { debut, fin: debut + fermant.index };
}

/**
 * Encadre le contenu du <head> de la page par les deux repères de version.
 * Renvoie { html, version } ; version = null si la page n'a pas de <head>
 * (elle est alors publiée telle quelle, sans bloc head). Idempotent.
 */
function marquerHead(html) {
    let source = String(html || '')
        .replace(/<meta name="lpb-version" content="[^"]*">/g, '')
        .replace(/<meta name="lpb-head-fin" content="[^"]*">/g, '');
    const b = bornesHead(source);
    if (!b) return { html: source, version: null };
    const version = crypto.createHash('sha1').update(source).digest('hex').slice(0, 12);
    const contenu = source.slice(b.debut, b.fin);
    return {
        html: source.slice(0, b.debut) + repereDebut(version) + contenu + repereFin(version) + source.slice(b.fin),
        version
    };
}

/**
 * Contenu du bloc head à publier : le head de la page marquée, repères
 * compris. Le charset et le viewport sont retirés (la CloudPage les écrit
 * déjà). '' si la page n'a pas été marquée.
 */
function extraireBlocHead(htmlMarque, version) {
    if (!version) return '';
    const html = String(htmlMarque || '');
    const debut = html.indexOf(repereDebut(version));
    const finRepere = repereFin(version);
    const fin = html.indexOf(finRepere);
    if (debut < 0 || fin < debut) return '';
    return html.slice(debut, fin + finRepere.length)
        .replace(/<meta\s+charset\s*=[^>]*>/gi, '')
        .replace(/<meta\s+name\s*=\s*["']viewport["'][^>]*>/gi, '');
}

module.exports = { SUFFIXE_HEAD, cleBlocHead, marquerHead, extraireBlocHead, repereDebut, repereFin };
