/**
 * Texte de consentement (RGPD) À CÔTÉ de sa case à cocher, quelle que soit sa
 * longueur (retour BRASSART candidature du 09/10).
 *
 * Le bloc case + texte des formulaires est en flex avec retour à la ligne
 * (flex-wrap: wrap) et rien ne donnait au texte la largeur restante : un texte
 * court (EFAP) tenait à côté de la case, un texte long (BRASSART) passait en
 * entier SOUS la case. On lui donne la place restante (flex: 1 1 0) et le
 * droit de rétrécir (min-width: 0) ; le message d'erreur, lui, reste sur sa
 * propre ligne (flex-basis: 100% dans le CSS des blocs).
 *
 * Posé au rendu et à la publication (finaliserPage, cleanHtmlForSfmc) : les
 * pages déjà construites en profitent sans refaire leur formulaire. Même
 * spécificité que le CSS des blocs, qui ne fixe pas `flex` : rien n'est écrasé.
 * Miroir : CSS des blocs (blocks/forms/…) et canvas de l'éditeur (js/app.js).
 */
const CLASSES = ['brf', 'cnd', 'imf', 'pc', 'wbc', 'jpo'];
const CSS_CONSENTEMENT = CLASSES.map(c => `.${c}-rgpd-label`).join(',') + '{flex:1 1 0;min-width:0}';
const RE_BALISE = /<style data-lp-consentement(?:="")?>[\s\S]*?<\/style>/gi;
const RE_PRESENT = new RegExp(`class="[^"]*\\b(${CLASSES.join('|')})-rgpd-label\\b`, 'i');

function ajouterCssConsentement(html) {
    const source = String(html || '').replace(RE_BALISE, '');
    if (!RE_PRESENT.test(source) || !/<\/head>/i.test(source)) return source;
    return source.replace(/<\/head>/i, `<style data-lp-consentement>${CSS_CONSENTEMENT}</style></head>`);
}

module.exports = { ajouterCssConsentement, CSS_CONSENTEMENT };
