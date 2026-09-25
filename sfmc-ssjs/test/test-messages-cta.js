'use strict';
/* ============================================================================
 *  MESSAGES ANGLAIS ET CTA DE BROCHURE PAR LANGUE / PAYS — retour du 25/09
 * ============================================================================
 *  Les fonctions REELLES du socle, extraites du fichier et executees : le CTA
 *  (DE CTA_demande_documentation, colonnes language et pays) et les messages
 *  de confirmation / de blocage selon la langue de la page.
 * ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs'), 'utf8');

function bloc(debut, ouvrant, fermant) {
    let prof = 0, j = src.indexOf(ouvrant, debut);
    for (; j < src.length; j++) {
        if (src[j] === ouvrant) prof++;
        else if (src[j] === fermant) { prof--; if (prof === 0) break; }
    }
    return j + 1;
}
function fonction(nom) {
    const i = src.indexOf('function ' + nom + '(');
    if (i < 0) throw new Error('fonction introuvable : ' + nom);
    return src.substring(i, bloc(i, '{', '}'));
}
function variable(nom) {
    const i = src.indexOf('var ' + nom + ' = ');
    if (i < 0) throw new Error('variable introuvable : ' + nom);
    const o = src.indexOf('=', i) + 1;
    const car = src.slice(o).trimStart()[0];
    const fin = bloc(o, car, car === '{' ? '}' : ']');
    return src.substring(i, fin) + ';';
}

const code = [
    variable('NIVEAU_DOC_EQUIV'), variable('CRITERES_DOC'),
    variable('MESSAGES'), variable('MESSAGES_EN'),
    variable('MESSAGES_BLOCAGE'), variable('MESSAGES_BLOCAGE_EN'),
    fonction('cle'), fonction('texteBrut'), fonction('contient'), fonction('canonNiveauDoc'), fonction('canonDoc'),
    fonction('valeurChamp'), fonction('critereDocSatisfait'), fonction('ctaDocumentation'), fonction('messageSucces'),
].join('\n');

function formulaire(champs) {
    return { querySelector: (q) => {
        const m = /\[name="([^"]+)"\]/.exec(q);
        return m && champs[m[1]] !== undefined ? { value: champs[m[1]] } : null;
    } };
}
function cta(lignes, champs, langue) {
    const ctx = { D: { ctaDoc: lignes }, langueAffichage: () => langue, familleDe: () => 'brochure', resultat: null,
                  form: formulaire(champs) };
    vm.runInNewContext(code + '\nresultat = ctaDocumentation(form);', ctx);
    return ctx.resultat && ctx.resultat.href;
}
function succes(famille, langue) {
    const ctx = { langueAffichage: () => langue, resultat: null };
    vm.runInNewContext(code + '\nresultat = messageSucces("' + famille + '");', ctx);
    return ctx.resultat;
}

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + '\n      ' + e.message); } }
function egal(a, b, m) { if (a !== b) throw new Error((m || '') + ' — attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }

const L = (url, langue, pays, niveau) => ({ niveau: niveau || '', cursus: '', titre: 'Telecharger', fond: '', police: '', langue, pays, url: 'https://x/' + url });
const DE = [L('fr-france', 'FR', 'France'), L('fr-inter', 'FR', 'International'), L('en', 'EN', '')];

test('Formulaire anglais : la ligne language = EN, quel que soit le pays', () => {
    egal(cta(DE, { Country: 'France', StudyLevel: 'BAC+3' }, 'en'), 'https://x/en');
    egal(cta(DE, { Country: 'Spain', StudyLevel: 'BAC+3' }, 'en'), 'https://x/en');
});
test('Formulaire francais, residence France : language = FR et pays = France', () => {
    egal(cta(DE, { Country: 'France', StudyLevel: 'BAC+3' }, 'fr'), 'https://x/fr-france');
});
test('Formulaire francais, residence hors France : language = FR et pays = International', () => {
    egal(cta(DE, { Country: 'Morocco', StudyLevel: 'BAC+3' }, 'fr'), 'https://x/fr-inter');
});
test('Formulaire anglais sans ligne EN : pas de brochure francaise', () => {
    egal(cta([L('fr-france', 'FR', 'France')], { Country: 'France' }, 'en'), null);
});
test('Colonnes vides (etat au 25/09) : le bouton d aujourd hui reste', () => {
    egal(cta([L('actuel', '', '')], { Country: 'France' }, 'fr'), 'https://x/actuel');
    egal(cta([L('actuel', '', '')], { Country: 'France' }, 'en'), 'https://x/actuel');
});
test('Une ligne renseignee l emporte sur une ligne vide', () => {
    egal(cta([L('actuel', '', ''), L('en', 'EN', '')], { Country: 'France' }, 'en'), 'https://x/en');
    egal(cta([L('actuel', '', ''), L('fr-inter', 'FR', 'International')], { Country: 'Italy' }, 'fr'), 'https://x/fr-inter');
});
test('Casse et accents indifferents dans la DE', () => {
    egal(cta([L('en', 'en', ''), L('fr', 'fr', 'france')], { Country: 'France' }, 'fr'), 'https://x/fr');
});
test('Les criteres existants (niveau) tiennent toujours', () => {
    egal(cta([L('b3', 'FR', 'France', 'BAC+3'), L('b5', 'FR', 'France', 'BAC+5 et +')], { Country: 'France', StudyLevel: 'BAC+5 et +' }, 'fr'), 'https://x/b5');
});

test('Messages anglais : brochure et candidature, au mot pres', () => {
    const b = succes('brochure', 'en');
    egal(b.titre, 'Your brochure is ready!');
    egal(b.texte[0], 'You can download it now. We’ve also sent a copy to your email address. Don’t forget to check your spam folder.');
    egal(b.texte[1], 'We remain at your disposal for any further information.');
    const c = succes('candidature', 'en');
    egal(c.titre, 'We’ve received your application request.');
    egal(c.texte, 'To complete and submit your application, please create your applicant account using the link sent to your email address (please make sure to check your spam folder).');
});
test('Messages francais inchanges, et repli francais pour les familles sans anglais', () => {
    egal(succes('brochure', 'fr').titre, 'Votre brochure est prête !');
    egal(succes('evenement', 'en').titre, 'Votre inscription est confirmée !');
});
test('Blocage anglais R1, au mot pres', () => {
    const ctx = {}; vm.runInNewContext(code + '\nr1 = MESSAGES_BLOCAGE_EN.r1.join(" ");', ctx);
    egal(ctx.r1, 'Your application request has already been submitted. We have already received an application request associated with your details. Therefore, you do not need to resubmit this form. Please check the email previously sent to you to access your applicant account and continue with your process.');
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
for (const e of echecs) console.log('    ✗ ' + e);
if (echecs.length) process.exit(1);
