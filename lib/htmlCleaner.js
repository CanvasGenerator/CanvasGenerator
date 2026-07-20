const cheerio = require('cheerio');

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
        .replace(/((?:src|srcset|href)\s*=\s*["'])\.?\/?assets\//gi, `$1${base}/assets/`)
        .replace(/url\((\s*['"]?)\.?\/?assets\//gi, `url($1${base}/assets/`);
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
            + 'html{background:#e9e9ec;}'
            + 'body{max-width:1280px;margin-left:auto;margin-right:auto;background:#ffffff;}'
            + '[class*="-phone-prefix-wrap"]{width:92px!important;flex-shrink:0!important;}'
            + '.jpo-flag{display:none!important;}'
            + '@media(max-width:768px){.mh-logo img,.mh-logo svg,.hdr-logo-img,.dh-logo-img,#logo img,#logo svg{max-height:40px!important;height:auto!important;width:auto!important;}'
            + '[class*="header-efap"] .hdr-logo-img,[class*="dh-efap"] .dh-logo-img,[class*="header-brassart"] .hdr-logo-img,[class*="dh-brassart"] .dh-logo-img,[class*="header-ifa"] .hdr-logo-img,[class*="dh-ifa"] .dh-logo-img{max-height:30px!important;}}'
            + '</style>'
        );
    }

    // 4. Minifier le HTML
    let finalHtml = $.html();
    
    // Supprimer les whitespaces superflus entre les balises HTML
    finalHtml = finalHtml.replace(/>\s+</g, '><').trim();

    // Chemins d'assets ABSOLUS pour SFMC : les logos header/footer utilisent des chemins
    // relatifs ("assets/…") qui cassent dans une CloudPage → on préfixe avec l'URL du site.
    finalHtml = absolutizeAssetUrls(finalHtml, getSiteUrl());

    return finalHtml;
}

module.exports = { cleanHtmlForSfmc, absolutizeAssetUrls, getSiteUrl };
