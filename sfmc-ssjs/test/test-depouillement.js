'use strict';
/* Depouillement du socle a la publication : le texte publie doit rester le
   meme programme, en plus petit. On verifie les regles, puis on rejoue la
   cascade navigateur (test-cascade.js) sur le socle depouille. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { depouiller } = require('../../lib/socle-depouillement');

let ok = 0; const echecs = [];
function egal(a, b, msg) { if (a === b) ok++; else echecs.push(`${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(String(a).slice(0, 120))}`); }
function test(nom, fn) { try { fn(); } catch (e) { echecs.push(`${nom} : ${e.message}`); } }

test('regles', () => {
    const src = [
        '/* ==CACHE_LECTURE_LIRE==',
        '   explication longue */',
        '    SET @a = "x"   ',
        '',
        '    /* bloc',
        '       sur deux lignes */',
        '    var u = "http://exemple.fr/chemin"; // fin de ligne gardee',
        '    // ligne de commentaire JS',
        'SET @b = Concat("a", "b") /* commentaire en fin de ligne garde */',
        '%%[ SET @c = "/* pas un commentaire, une chaine" ]%%',
    ].join('\n');
    const out = depouiller(src);
    egal(out, [
        '/* ==CACHE_LECTURE_LIRE== */',
        'SET @a = "x"',
        'var u = "http://exemple.fr/chemin"; // fin de ligne gardee',
        'SET @b = Concat("a", "b") /* commentaire en fin de ligne garde */',
        '%%[ SET @c = "/* pas un commentaire, une chaine" ]%%',
    ].join('\n') + '\n', 'commentaires en tete retires, marqueur garde, reste intact');
    egal(depouiller(out), out, 'idempotent');
    /* Dans un bloc SSJS serveur, les commentaires restent (bug de l'analyseur
       SFMC, 25/09) ; l'indentation et les lignes // partent quand meme. */
    egal(depouiller('<script runat="server">\n    /* garde */\n    var a = 1; // fin\n    // partie\n</script>\n/* retire */\nSET @b = 2\n'),
        '<script runat="server">\n/* garde */\nvar a = 1; // fin\n</script>\nSET @b = 2\n', 'commentaires gardes dans les blocs SSJS serveur');
    /* Un commentaire ferme sur une ligne de code ne doit pas entrainer le code
       qui suit jusqu'au commentaire d'apres (bug du 25/09). */
    egal(depouiller('/* c */ SET @a = 1\nSET @b = 2\n/* d */\nSET @c = 3\n'), '/* c */ SET @a = 1\nSET @b = 2\nSET @c = 3\n', 'commentaire ferme sur une ligne de code : rien d avale');
});

/* Le code, commentaires exclus, doit etre EXACTEMENT le meme avant et apres :
   on retire tous les commentaires blocs des deux cotes (meme grammaire, y
   compris ceux en fin de ligne), puis on compare ligne a ligne. */
function code(t) {
    return String(t).replace(/\/\*(?:[^*]|\*(?!\/))*\*\//g, '').split(/\r?\n/)
        .map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
}
test('socle reel : meme code avant et apres, commentaires exclus', () => {
    for (const f of ['picklist-handler.ampscript', 'handler-form.ampscript', 'picklist-handler.ssjs']) {
        const src = fs.readFileSync(path.join(__dirname, '..', 'socle', f), 'utf8');
        const a = code(src), b = code(depouiller(src));
        let premiere = -1;
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { premiere = i; break; }
        egal(premiere, -1, `${f} : premiere divergence ligne ${premiere} : source « ${(a[premiere] || '').slice(0, 60)} » / depouille « ${(b[premiere] || '').slice(0, 60)} »`);
        egal(a.length, b.length, `${f} : nombre de lignes de code`);
    }
});

test('socle reel : plus petit, marqueurs et code conserves', () => {
    for (const f of ['picklist-handler.ampscript', 'handler-form.ampscript', 'picklist-handler.ssjs']) {
        const src = fs.readFileSync(path.join(__dirname, '..', 'socle', f), 'utf8');
        const out = depouiller(src);
        egal(out.length < src.length * 0.7, true, `${f} : au moins 30 % de moins (${Math.round(100 * out.length / src.length)} %)`);
        for (const m of src.match(/==[A-Z_]+==/g) || []) egal(out.includes(m), true, `${f} : marqueur ${m} conserve`);
        /* Rien d'invente : chaque ligne publiee est une ligne de la source, sans
           son indentation ; et la structure (delimiteurs AMPscript, balises
           script) est la meme. */
        const lignesSrc = new Set(src.split(/\r?\n/).map((l) => l.trim()));
        let inventees = 0;
        for (const l of out.split('\n')) if (l && !lignesSrc.has(l) && !/^\/\* ==[A-Z_]+== \*\/$/.test(l)) inventees++;
        egal(inventees, 0, `${f} : lignes inventees`);
        const compte = (t, re) => (t.match(re) || []).length;
        egal(compte(out, /%%\[/g), compte(src, /%%\[/g), `${f} : ouvertures %%[`);
        egal(compte(out, /\]%%/g), compte(src, /\]%%/g), `${f} : fermetures ]%%`);
        /* Balises en debut de ligne seulement : une mention dans un commentaire
           de la source n'est pas une balise. */
        egal(compte(out, /^<script[ >]/gm), compte(src, /^[ \t]*<script[ >]/gm), `${f} : balises script`);
        egal(compte(out, /^<\/script>/gm), compte(src, /^[ \t]*<\/script>/gm), `${f} : fermetures script`);
    }
});

test('cascade navigateur sur le socle depouille', () => {
    const r = execFileSync(process.execPath, [path.join(__dirname, 'test-cascade.js')],
        { env: Object.assign({}, process.env, { SOCLE_DEPOUILLE_TEST: '1' }), encoding: 'utf8' });
    const m = /(\d+) test\(s\) passe\(s\), (\d+) echec\(s\)/.exec(r);
    egal(!!m && Number(m[2]) === 0 && Number(m[1]) > 50, true, 'test-cascade sur socle depouille : ' + (m ? m[0] : r.slice(-200)));
});

console.log(`  ${ok} test(s) passe(s), ${echecs.length} echec(s)`);
for (const e of echecs) console.log('    ✗ ' + e);
if (echecs.length) process.exit(1);
