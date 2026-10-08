const cheerio = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');

/**
 * URL publique du site servant les assets statiques (logos header/footer, images…).
 * Utilisée pour transformer les chemins RELATIFS ("assets/…") en URLs ABSOLUES avant
 * publication SFMC : dans une CloudPage, la page n'est plus servie depuis la racine du
 * builder, donc "assets/…" se résout contre l'URL CloudPage (inexistante → logos cassés).
 * Priorité : SITE_URL, puis PUBLIC_APP_URL / VERCEL_URL (déjà utilisés ailleurs).
 */
function getSiteUrl() {
    const raw = process.env.SITE_URL
        || process.env.PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    return String(raw || '').trim().replace(/\/+$/, ''); // sans slash final
}

/**
 * Préfixe les chemins d'assets RELATIFS ("assets/…", "./assets/…", "/assets/…") avec
 * l'URL du site pour obtenir des URLs ABSOLUES. Idempotent : les URLs déjà en http(s)
 * ne sont pas touchées (le motif exige que "assets/" suive immédiatement le guillemet).
 * Sans SITE_URL configurée, le HTML est renvoyé inchangé.
 */
function absolutizeAssetUrls(html, baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return String(html || '');
    return String(html || '')
        .replace(/((?:src|srcset|href)\s*=\s*["'])(?:\.\.\/)*\.?\/?assets\//gi, `$1${base}/assets/`)
        .replace(/url\((\s*['"]?)(?:\.\.\/)*\.?\/?assets\//gi, `url($1${base}/assets/`);
}

/**
 * Incorpore css/fonts.css dans la page publiée.
 *
 * Le builder pose `<link rel="stylesheet" href="/css/fonts.css">` : chemin relatif
 * à la racine, juste dans l'éditeur et en preview, faux dans une CloudPage où il
 * se résout contre le domaine SFMC (404, polices système à la place de Gotham).
 * On remplace le lien par la feuille elle-même en <style>, ses url() rendues
 * absolues vers le builder : une requête de moins, aucune dépendance au chemin
 * de la feuille, et seuls les fichiers de police (4,8 Mo, impossibles à
 * inliner) restent servis par le builder — publiquement et avec CORS, vérifié
 * le 07/10/2026. Sans SITE_URL on ne sait pas absolutiser : le lien est
 * laissé tel quel, comme pour les autres assets.
 */
const FONTS_CSS_PATH = path.join(__dirname, '..', 'css', 'fonts.css');
function inlineFontsCss(html, baseUrl) {
    const base = String(baseUrl || '').trim().replace(/\/+$/, '');
    const s = String(html || '');
    const lien = /<link\b[^>]*href\s*=\s*["'][^"']*css\/fonts\.css["'][^>]*>/i;
    if (!base || !lien.test(s)) return s;
    let css;
    try { css = fs.readFileSync(FONTS_CSS_PATH, 'utf8'); } catch (e) { return s; }
    css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
    css = absolutizeAssetUrls(css, base);
    return s.replace(lien, `<style id="sfmc-fonts">${css}</style>`);
}

/**
 * Sélecteurs dont les éléments N'EXISTENT PAS dans le HTML publié : c'est le
 * socle qui les crée dans le navigateur, à la réponse du CRM.
 *
 * POURQUOI CETTE LISTE EXISTE. `removeOrphanedCss` part d'une prémisse juste
 * pour du HTML statique — « aucun élément ne porte ce sélecteur, la règle est
 * morte » — et fausse pour du DOM construit à l'exécution. Les conteneurs
 * partent VIDES à la publication (`<div class="jpo-dates" data-socle="instances">`),
 * donc toutes les règles visant leur contenu étaient jugées orphelines et
 * supprimées. Résultat : les dates et le programme des formulaires événement
 * s'affichaient correctement dans le builder — qui ne nettoie rien — et
 * perdaient toute mise en forme une fois la page publiée : ni bordure, ni
 * colonnes, ni tailles. Le symptôme se lisait comme un écart de design, alors
 * que le CSS était bon et simplement supprimé.
 *
 * ⚠ À TENIR À JOUR avec les `className` posés dans
 * `sfmc-ssjs/socle/picklist-handler.ssjs`. Un préfixe oublié ici ne casse
 * rien visiblement : il enlève juste, en silence, la mise en forme de ce
 * qu'il désigne.
 */
const SELECTEURS_RUNTIME = [
    'socle-',        // socle-instance*, socle-appointment, socle-message
    'jpo-dates',     // les <label> de dates, créés au rendu
    'jpo-ateliers',
    'imf-dates',     // mêmes conteneurs sur le formulaire d'immersion
    'imf-ateliers',
    'data-socle',    // ciblage par attribut du conteneur lui-même
];

/** Ce sélecteur désigne-t-il un élément créé à l'exécution par le socle ? */
function estSelecteurRuntime(selecteur) {
    return SELECTEURS_RUNTIME.some((indice) => selecteur.includes(indice));
}

function removeOrphanedCss(css, $) {
    let cleaned = '';
    let buffer = '';
    let depth = 0;
    let currentSelector = '';
    
    for (let i = 0; i < css.length; i++) {
        let char = css[i];
        if (char === '{') {
            if (depth === 0) {
                currentSelector = buffer.trim();
                buffer = '';
            } else {
                buffer += char;
            }
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                let body = buffer.trim();
                buffer = '';
                
                if (currentSelector.startsWith('@')) {
                    if (currentSelector.startsWith('@font-face') || currentSelector.startsWith('@keyframes')) {
                        cleaned += currentSelector + '{' + body + '}';
                    } else {
                        let cleanedBody = removeOrphanedCss(body, $);
                        if (cleanedBody.trim()) {
                            cleaned += currentSelector + '{' + cleanedBody + '}';
                        }
                    }
                } else {
                    let selectors = currentSelector.split(',').map(s => s.trim());
                    let validSelectors = selectors.filter(sel => {
                        /* Testé sur le sélecteur ENTIER, pas sur sa base : la
                           mise en forme de l'état choisi s'écrit
                           `.jpo-dates label:has(input:checked)`, et c'est bien
                           `jpo-dates` qu'il faut y reconnaître. */
                        if (estSelecteurRuntime(sel)) return true;

                        let baseSel = sel.split(':')[0].trim();
                        if (!baseSel || baseSel === 'body' || baseSel === 'html' || baseSel === '*') return true;

                        try {
                            return $(baseSel).length > 0;
                        } catch (e) {
                            return true;
                        }
                    });
                    
                    if (validSelectors.length > 0) {
                        cleaned += validSelectors.join(',') + '{' + body + '}';
                    }
                }
            } else {
                buffer += char;
            }
        } else {
            buffer += char;
        }
    }
    cleaned += buffer;
    return cleaned;
}

/**
 * FAQ (.ma-section) → accordéon HTML natif <details>/<summary>.
 * SFMC supprime TOUS les <script> client à l'enregistrement de l'asset : le +/-
 * piloté par le script GrapesJS du composant ne peut donc pas fonctionner dans une
 * CloudPage. <details> s'ouvre/se ferme sans JavaScript. Les classes ma-* sont
 * conservées (le CSS du bloc et les réglages du Style Manager s'appliquent toujours).
 * Renvoie true si au moins une FAQ a été convertie.
 */
function convertFaqToDetails($) {
    const sections = $('.ma-section');
    if (!sections.length) return false;

    const ids = [];
    sections.each((i, sec) => {
        if (sec.attribs && sec.attribs.id) ids.push(sec.attribs.id);
        $(sec).find('.ma-item').each((j, item) => {
            const $item = $(item);
            const $q = $item.children('.ma-q').first();
            if (!$q.length) return;
            // Bouton → span : un élément interactif dans <summary> bloquerait le clic.
            $q.find('button.ma-toggle').each((k, btn) => {
                const attrs = { ...btn.attribs };
                delete attrs.type;
                attrs['aria-hidden'] = 'true';
                btn.tagName = btn.name = 'span';
                btn.attribs = attrs;
            });
            $q.find('.ma-toggle').empty(); // symbole +/− fourni par le CSS selon [open]
            $q[0].tagName = $q[0].name = 'summary';
            // Réponse : l'état initial était posé en style inline par le script.
            $item.children('.ma-a').each((k, a) => {
                const style = ($(a).attr('style') || '').replace(/(^|;)\s*display\s*:[^;]*/gi, '$1').replace(/^[\s;]+|[\s;]+$/g, '');
                if (style) $(a).attr('style', style); else $(a).removeAttr('style');
            });
            const wasOpen = $item.hasClass('ma-open');
            $item.removeClass('ma-open');
            item.tagName = item.name = 'details';
            if (wasOpen) $item.attr('open', '');
        });
    });

    // Script d'accordéon du composant : inutile (et contradictoire avec <details>).
    $('script').each((i, s) => {
        const js = $(s).html() || '';
        if (/ma-toggle/.test(js) && ids.some(id => js.includes(`#${id}`))) $(s).remove();
    });
    return true;
}

const FAQ_DETAILS_CSS =
    'summary.ma-q{list-style:none;}'
    + 'summary.ma-q::-webkit-details-marker{display:none;}'
    + 'summary.ma-q::marker{content:"";}'
    // Le bouton devenu <span> ne doit pas hériter de « .ma-q span { flex:1 } » (texte).
    + 'summary.ma-q>.ma-toggle{flex:0 0 32px!important;box-sizing:border-box;}'
    + '.ma-item .ma-toggle::before{content:"+";}'
    + '.ma-item[open] .ma-toggle::before{content:"\\2212";}'
    // L'éditeur a pu figer un #id{display:none} sur une réponse : fermée, <details>
    // la masque déjà nativement ; ouverte, on la force visible.
    + 'details.ma-item[open]>.ma-a{display:block!important;}'
    + '.ma-item[open] .ma-toggle{border-color:var(--brand-primary,#1f2937);color:var(--brand-primary,#1f2937);}';

/**
 * Règles CSS à plat : [{ media, selector, body }] (un niveau d'@media suffit
 * pour le CSS GrapesJS). Sert à dériver des règles à partir de celles du bloc.
 */
function collectCssRules(css, media = '') {
    const rules = [];
    let buffer = '', depth = 0, selector = '';
    for (const ch of String(css || '')) {
        if (ch === '{') {
            if (depth === 0) { selector = buffer.trim(); buffer = ''; } else buffer += ch;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                if (selector.startsWith('@media')) rules.push(...collectCssRules(buffer, selector));
                else if (!selector.startsWith('@')) rules.push({ media, selector, body: buffer.trim() });
                buffer = '';
            } else buffer += ch;
        } else buffer += ch;
    }
    return rules;
}

/** Découpe une liste de sélecteurs sur les virgules de PREMIER niveau
 *  (`:where(a,b)` ou `:is(a,b)` ne doivent pas être coupés en deux). */
function splitSelectors(list) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of String(list || '')) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

function wrapMedia(media, rule) {
    return media ? `${media}{${rule}}` : rule;
}

/**
 * Onglets Admission (.mta-wrapper) → onglets SANS JavaScript.
 *
 * Même raison que la FAQ : SFMC supprime les <script>, or c'est le script du
 * bloc qui changeait d'onglet, générait les onglets mobiles, réglait les
 * colonnes et dépliait les étapes. En CloudPage le bloc restait figé (clics
 * sans effet, barre à 3 colonnes même avec 5 onglets).
 *
 * Mécanique : un <input type="radio"> caché par onglet en tête du wrapper ;
 * chaque en-tête devient un <label for> ; le panneau, l'en-tête et l'onglet
 * mobile actifs sont désignés par `#radio:checked ~ …`. Les règles « actif »
 * sont DÉRIVÉES de celles de la page (`.mta-tab-hd.mta-active`, etc.), donc
 * les réglages du Style Manager suivent. `:where()` garde la spécificité de
 * la règle d'origine : un style posé sur un en-tête (#id) prime toujours,
 * exactement comme côté LP. Le détail des étapes passe en <details>.
 *
 * Renvoie le CSS à ajouter ('' si aucun bloc).
 */
function convertAdmissionTabs($) {
    const wrappers = $('.mta-wrapper');
    if (!wrappers.length) return '';

    const rules = collectCssRules($('style').map((i, el) => $(el).html() || '').get().join('\n'));
    let css = '.mta-radio{position:absolute;opacity:0;width:0;height:0;margin:0;pointer-events:none;}'
        + 'details.mta-step-dd>summary{list-style:none;cursor:pointer;}'
        + 'details.mta-step-dd>summary::-webkit-details-marker{display:none;}'
        + 'details.mta-step-dd>summary::marker{content:"";}'
        + 'details.mta-step-dd[open]>.mta-step-details{display:block!important;}';

    wrappers.each((w, wr) => {
        const $wr = $(wr);
        const key = `mtar${w}`;
        const $bar = $wr.children('.mta-headers').first();
        const $hds = $bar.children('.mta-tab-hd');
        $wr.children('.mta-mob-tab').remove();   // régénérés depuis les en-têtes

        const idxs = [];
        const headerIds = [];
        $hds.each((k, h) => {
            const i = $(h).attr('data-tab');
            const $pane = $wr.children(`.mta-pane[data-pane="${i}"]`).first();
            if (!$pane.length) return;
            idxs.push(i);
            const rid = `${key}-${i}`;
            h.tagName = h.name = 'label';
            $(h).attr('for', rid);
            const $mob = $('<label class="mta-mob-tab"></label>').attr('for', rid).attr('data-tab', i).html($(h).html());
            $mob.find('[id]').removeAttr('id');
            const hid = $(h).attr('id');
            if (hid) { $mob.attr('id', `${hid}-mob`); headerIds.push(hid); }
            $pane.before($mob);
        });
        if (!idxs.length) return;

        // Un onglet sans en-tête n'est jamais affichable : on le retire.
        $wr.children('.mta-pane').each((k, p) => {
            if (!idxs.includes($(p).attr('data-pane'))) $(p).remove();
        });

        $wr.prepend(idxs.map((i, n) =>
            `<input type="radio" class="mta-radio" name="${key}" id="${key}-${i}"${n === 0 ? ' checked' : ''} aria-hidden="true" tabindex="-1">`
        ).join(''));
        $wr.find('.mta-active').removeClass('mta-active');
        $wr.find('.mta-pane-active').removeClass('mta-pane-active');

        // Autant de colonnes que d'onglets (le script le faisait côté LP).
        const style = ($bar.attr('style') || '').replace(/(^|;)\s*grid-template-columns\s*:[^;]*/gi, '$1');
        $bar.attr('style', `${style ? style.replace(/;?\s*$/, ';') : ''}grid-template-columns:repeat(${idxs.length},minmax(0,1fr))`);

        idxs.forEach(i => {
            const R = `#${key}-${i}:checked`;
            css += `:where(${R}) ~ .mta-pane[data-pane="${i}"]{display:block;}`;
            rules.forEach(r => {
                const out = [];
                splitSelectors(r.selector).forEach(s => {
                    if (s.includes('.mta-tab-hd.mta-active')) out.push(s.replace('.mta-tab-hd.mta-active', `:where(${R} ~ .mta-headers) .mta-tab-hd[data-tab="${i}"]`));
                    else if (s.includes('.mta-mob-tab.mta-active')) out.push(s.replace('.mta-mob-tab.mta-active', `:where(${R}) ~ .mta-mob-tab[data-tab="${i}"]`));
                    else if (s.includes('.mta-pane.mta-pane-active')) out.push(s.replace('.mta-pane.mta-pane-active', `:where(${R}) ~ .mta-pane[data-pane="${i}"]`));
                });
                if (out.length) css += wrapMedia(r.media, `${out.join(',')}{${r.body}}`);
            });
        });

        // Onglets mobiles : mêmes réglages que leur en-tête desktop (#id → #id-mob).
        headerIds.forEach(hid => {
            const re = new RegExp(`^#${hid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
            rules.forEach(r => {
                const out = splitSelectors(r.selector).filter(s => re.test(s)).map(s => s.replace(re, `#${hid}-mob`));
                if (out.length) css += wrapMedia(r.media, `${out.join(',')}{${r.body}}`);
            });
        });

        // Détail des étapes : <details>/<summary> natifs.
        $wr.find('.mta-step-body').each((k, b) => {
            const $lbl = $(b).children('.mta-step-label[data-expandable="true"]').first();
            const $ul = $(b).children('.mta-step-details').first();
            if (!$lbl.length || !$ul.length) return;
            const open = $ul.hasClass('mta-open');
            $ul.removeClass('mta-open');
            const $det = $(`<details class="mta-step-dd"${open ? ' open' : ''}></details>`);
            $lbl.before($det);
            $det.append($lbl).append($ul);
            $lbl[0].tagName = $lbl[0].name = 'summary';
        });
    });

    // Script du bloc : inutile et contradictoire avec les radios.
    $('script').each((i, s) => { if (/mta-wrapper/.test($(s).html() || '')) $(s).remove(); });
    return css;
}

/**
 * Carrousel (.carrous-track) sans JavaScript. Le script plaçait les cartes et
 * centrait un carrousel incomplet (2 cartes pour 3 places) ; sans lui, les
 * cartes restaient collées à gauche. Ici : centrage par marges auto (sûres en
 * débordement, contrairement à justify-content:center) et défilement natif au
 * doigt / à la molette quand il y a plus de cartes que de places. Les flèches,
 * inertes sans script, sont masquées.
 */
function convertCarousels($) {
    const tracks = $('.carrous-track');
    if (!tracks.length) return '';
    tracks.each((i, t) => {
        const n = $(t).children('.carrous-card').length;
        if (n && n < 3) $(t).addClass('carrous-track--few');
    });
    return '.carrous-container{overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}'
        + '.carrous-track{transform:none!important;}'
        + '.carrous-card{scroll-snap-align:start;}'
        + '.carrous-track--few>.carrous-card:first-child{margin-left:auto;}'
        + '.carrous-track--few>.carrous-card:last-child{margin-right:auto;}'
        + '.carrous-nav{display:none!important;}';
}

function cleanHtmlForSfmc(html) {
    const $ = cheerio.load(html, { decodeEntities: false }); // keep entities intact

    // 1. Supprimer les attributs GrapesJS
    $('*').each((i, el) => {
        if (el.attribs) {
            const attrsToRemove = [];
            for (const attr in el.attribs) {
                if (
                    attr.startsWith('data-gjs-') ||
                    attr === 'data-highlightable' ||
                    attr === 'data-selectable' ||
                    attr === 'data-hoverable'
                ) {
                    attrsToRemove.push(attr);
                }
            }
            attrsToRemove.forEach(attr => $(el).removeAttr(attr));
        }
    });

    // 2. Supprimer les commentaires HTML
    $('*').contents().filter(function() {
        return this.type === 'comment';
    }).remove();
    $.root().contents().filter(function() {
        return this.type === 'comment';
    }).remove();

    // 2bis. FAQ en <details>/<summary> (avant le nettoyage CSS, qui ne garde que les
    // sélecteurs présents dans le DOM converti).
    const hasFaq = convertFaqToDetails($);
    // Idem pour les onglets admission et le carrousel (CSS lu AVANT nettoyage).
    const noJsCss = convertAdmissionTabs($) + convertCarousels($);

    // 3 & 5. Nettoyer et minifier le CSS
    $('style').each((i, el) => {
        let cssText = $(el).html() || '';
        
        cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
        
        let cleanedCss = removeOrphanedCss(cssText, $);
        
        cleanedCss = cleanedCss
            .replace(/\s+/g, ' ')
            .replace(/\s*{\s*/g, '{')
            .replace(/\s*}\s*/g, '}')
            .replace(/\s*:\s*/g, ':')
            .replace(/\s*;\s*/g, ';')
            .replace(/;}/g, '}')
            .trim();
            
        $(el).html(cleanedCss);
    });

    // 3bis. Rendu à la taille de l'éditeur / de la page (1280px centré) → la CloudPage
    // SFMC rend comme l'éditeur et la preview. Ajouté APRÈS le nettoyage CSS.
    // PAS de !important sur logos / code pays : on respecte les tailles réglées via
    // le panneau Style (valeurs par défaut dans le CSS des blocs).
    if ($('head').length && !$('#sfmc-viewport').length) {
        $('head').append(
            '<style id="sfmc-viewport">'
            + 'html{background:#e9e9ec;scroll-behavior:smooth;scroll-padding-top:100px;scroll-padding-bottom:120px;}'
            + 'body{max-width:1280px;margin-left:auto;margin-right:auto;background:#ffffff;}'
            + '[id^="form-"]{scroll-margin-top:100px;scroll-margin-bottom:120px;}'
            + '[class*="-phone-prefix-wrap"]{width:92px!important;flex-shrink:0!important;}'
            + '.jpo-flag{display:none!important;}'
            + '@media(max-width:768px){.mh-logo img,.mh-logo svg,.hdr-logo-img,.dh-logo-img,#logo img,#logo svg{max-height:40px!important;height:auto!important;width:auto!important;}'
            + '[class*="header-efap"] .hdr-logo-img,[class*="dh-efap"] .dh-logo-img,[class*="header-brassart"] .hdr-logo-img,[class*="dh-brassart"] .dh-logo-img,[class*="header-ifa"] .hdr-logo-img,[class*="dh-ifa"] .dh-logo-img{max-height:30px!important;}}'
            + '</style>'
        );
    }

    if (hasFaq && !$('#sfmc-faq').length) {
        const faqStyle = `<style id="sfmc-faq">${FAQ_DETAILS_CSS}</style>`;
        if ($('head').length) $('head').append(faqStyle); else $.root().prepend(faqStyle);
    }

    // Ajouté APRÈS le nettoyage (sélecteurs :where(#radio:checked) non vérifiables)
    // et en dernier dans le <head> : à spécificité égale, ces règles « actif »
    // doivent passer après celles du bloc, comme dans la page d'origine.
    if (noJsCss && !$('#sfmc-nojs').length) {
        const s = `<style id="sfmc-nojs">${noJsCss}</style>`;
        if ($('head').length) $('head').append(s); else $.root().prepend(s);
    }

    // 4. Minifier le HTML
    let finalHtml = $.html();
    
    // Supprimer les whitespaces superflus entre les balises HTML
    finalHtml = finalHtml.replace(/>\s+</g, '><').trim();

    // Chemins d'assets ABSOLUS pour SFMC : les logos header/footer utilisent des chemins
    // relatifs ("assets/…") qui cassent dans une CloudPage → on préfixe avec l'URL du site.
    finalHtml = inlineFontsCss(finalHtml, getSiteUrl());
    finalHtml = absolutizeAssetUrls(finalHtml, getSiteUrl());

    return finalHtml;
}

module.exports = { cleanHtmlForSfmc, absolutizeAssetUrls, inlineFontsCss, getSiteUrl };
