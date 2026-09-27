'use strict';
/* ============================================================================
 *  SOUMISSION ASYNCHRONE — le second passage vise la page de traitement dediee
 * ============================================================================
 *  Les fonctions REELLES du socle navigateur (bilanDe, urlTraitement,
 *  lancerTraitement), extraites et executees avec un navigateur factice.
 * ========================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'socle', 'picklist-handler.ssjs'), 'utf8');
function fonction(nom) {
    const i = src.indexOf('function ' + nom + '(');
    if (i < 0) throw new Error('fonction introuvable : ' + nom);
    let prof = 0, j = src.indexOf('{', i);
    for (; j < src.length; j++) {
        if (src[j] === '{') prof++;
        else if (src[j] === '}') { prof--; if (prof === 0) break; }
    }
    return src.substring(i, j + 1);
}
const code = [fonction('bilanDe'), fonction('urlTraitement'), fonction('lancerTraitement')].join('\n');

function navigateur(href) {
    const envois = [];
    const ctx = {
        window: { location: { href }, fetch: undefined },
        navigator: { sendBeacon: (url, blob) => { envois.push({ url, blob }); return true; } },
        Blob: function (parts, opts) { this.texte = parts.join(''); this.type = opts && opts.type; },
        encodeURIComponent, envois, resultat: null,
    };
    return ctx;
}

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(nom + '\n      ' + e.message); } }
function egal(a, b, m) { if (a !== b) throw new Error((m || '') + ' — attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }

const RECU = '<!-- socle ecriture: statut=success pa= nouveau=false run=abc123 async=reception traitement=Interne_TRAITEMENT_V0 journal= ASYNC:recue -->';
const RECU_SANS = '<!-- socle ecriture: statut=success pa= nouveau=false run=abc123 async=reception traitement= journal= ASYNC:recue -->';
const ANCIEN = '<!-- socle ecriture: statut=success pa= nouveau=false run=abc123 async=reception journal= ASYNC:recue -->';

test('bilanDe lit la page de traitement annoncee', () => {
    const ctx = navigateur('https://cloud.groupe-edh.net/landingpage?id=Interne_CAND_EFAP_V0&utm_source=google');
    vm.runInNewContext(code + '\nresultat = bilanDe(RECU);', Object.assign(ctx, { RECU }));
    egal(ctx.resultat.run, 'abc123'); egal(ctx.resultat.async, 'reception'); egal(ctx.resultat.traitement, 'Interne_TRAITEMENT_V0');
    vm.runInNewContext(code + '\nresultat = bilanDe(ANCIEN);', Object.assign(ctx, { ANCIEN }));
    egal(ctx.resultat.traitement, '', 'marqueur d avant : pas de page dediee');
});
test('Le beacon part vers la page dediee, sans les parametres du visiteur', () => {
    const ctx = navigateur('https://cloud.groupe-edh.net/landingpage?id=Interne_CAND_EFAP_V0&utm_source=google&utm_medium=cpc#haut');
    vm.runInNewContext(code + '\nresultat = lancerTraitement(["EmailAddress=a%40b.c", "submitted=true"], bilanDe(RECU));', Object.assign(ctx, { RECU }));
    egal(ctx.resultat, true, 'beacon envoye');
    egal(ctx.envois.length, 1);
    egal(ctx.envois[0].url, 'https://cloud.groupe-edh.net/landingpage?id=Interne_TRAITEMENT_V0');
    egal(ctx.envois[0].blob.texte, 'EmailAddress=a%40b.c&submitted=true&socle_traitement=1&socle_run=abc123');
    egal(ctx.envois[0].blob.type, 'application/x-www-form-urlencoded; charset=UTF-8');
});
test('Sans page dediee : la page courante, query string comprise (comportement d avant)', () => {
    for (const marqueur of [RECU_SANS, ANCIEN]) {
        const ctx = navigateur('https://cloud.groupe-edh.net/landingpage?id=Interne_CAND_EFAP_V0&campus=lyon');
        vm.runInNewContext(code + '\nresultat = lancerTraitement(["a=1"], bilanDe(M));', Object.assign(ctx, { M: marqueur }));
        egal(ctx.envois[0].url, 'https://cloud.groupe-edh.net/landingpage?id=Interne_CAND_EFAP_V0&campus=lyon');
    }
});
test('Pas de second passage sans reception asynchrone reussie', () => {
    const ctx = navigateur('https://x/p?id=A');
    vm.runInNewContext(code + '\nresultat = lancerTraitement(["a=1"], bilanDe("<!-- socle ecriture: statut=success pa=001 nouveau=true run=r1 async=traitement traitement=Interne_TRAITEMENT_V0 journal= -->"));', ctx);
    egal(ctx.resultat, false); egal(ctx.envois.length, 0);
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
for (const e of echecs) console.log('    ✗ ' + e);
if (echecs.length) process.exit(1);
