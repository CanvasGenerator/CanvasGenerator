/**
 * Page bilingue auto-portée.
 *
 * Objectif : produire UNE seule page HTML qui contient toutes les variantes de langue
 * et bascule le contenu au clic sur le bouton header `.hdr-lang`, SANS serveur ni
 * rechargement. Utilisée pour l'aperçu du dashboard ET l'export SFMC (CloudPage, où le
 * JS s'exécute). Le modèle « structure partagée, seul le texte change » garantit que
 * chaque variante a le même CSS/mise en page → on peut échanger le body sans casser le style.
 *
 * Sécurité vis-à-vis du nettoyeur SFMC (cleanHtmlForSfmc) : la charge utile (le HTML des
 * autres langues) est encodée en base64. Elle ne contient donc AUCUN caractère `<`, `>`,
 * espace, ni `</script>` → ni le minifieur `>\s+<`, ni la fermeture de balise ne peuvent
 * la corrompre. Le décodage gère l'UTF-8 (accents français).
 */
const cheerio = require('cheerio');

/**
 * @param {string} shellFullHtml  HTML complet de la variante affichée par défaut (head+body).
 * @param {Object<string,string>} bodiesByLang  { FR: "<contenu du body>", EN: "..." }.
 * @param {string} currentLang    Langue affichée au chargement (doit correspondre au shell).
 * @returns {string} HTML combiné, ou shell inchangé s'il y a moins de 2 langues.
 */
function combineBilingualHtml(shellFullHtml, bodiesByLang, currentLang) {
    const langs = Object.keys(bodiesByLang || {}).filter(l => bodiesByLang[l]);
    if (langs.length < 2) return shellFullHtml;

    const payload = Buffer.from(JSON.stringify(bodiesByLang), 'utf8').toString('base64');
    const cur = JSON.stringify(String(currentLang || langs[0]).toUpperCase());

    // Script compact, sans séquence `>\s+<`, avec payload base64 (voir en-tête).
    const script = '<script>(function(){try{'
        + 'var D=JSON.parse(decodeURIComponent(escape(atob("' + payload + '"))));'
        + 'var L=' + cur + ';'
        + 'function paint(){var ns=document.querySelectorAll(".hdr-lang");for(var i=0;i<ns.length;i++){ns[i].style.cursor="pointer";}}'
        + 'paint();'
        + 'document.addEventListener("click",function(e){'
        + 'var t=e.target;while(t&&t.nodeType===1&&!(t.classList&&t.classList.contains("hdr-lang"))){t=t.parentNode;}'
        + 'if(!t||t.nodeType!==1){return;}e.preventDefault();e.stopPropagation();'
        + 'var ks=Object.keys(D),n=null;for(var j=0;j<ks.length;j++){if(ks[j]!==L){n=ks[j];break;}}'
        + 'if(!n){return;}var p=document.getElementById("__page");if(!p||!D[n]){return;}'
        + 'p.innerHTML=D[n];L=n;paint();'
        + '},true);'
        + '}catch(err){}})();</script>';

    const $ = cheerio.load(shellFullHtml, { decodeEntities: false }, true);
    const bodyInner = $('body').html() || '';
    $('body').empty();
    $('body').append('<div id="__page">' + bodyInner + '</div>');
    $('body').append(script);
    return $.html();
}

module.exports = { combineBilingualHtml };
