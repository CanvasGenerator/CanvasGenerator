const cheerio = require('cheerio');

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

    // 4. Minifier le HTML
    let finalHtml = $.html();
    
    // Supprimer les whitespaces superflus entre les balises HTML
    finalHtml = finalHtml.replace(/>\s+</g, '><').trim();

    return finalHtml;
}

module.exports = { cleanHtmlForSfmc };
