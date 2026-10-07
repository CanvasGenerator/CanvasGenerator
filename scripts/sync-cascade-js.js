/**
 * ============================================================================
 *  SYNCHRONISE LE JS DE CASCADE : picklist-handler.ssjs -> .ampscript
 * ============================================================================
 *  Le handler AMPscript emet `window.SOCLE_DATA` mais ne contient pas le code
 *  qui le consomme. Ce code — remplissage des <select>, cascade, ordre des
 *  champs, resolution du PTAT — vit dans le dernier bloc <script> de
 *  `picklist-handler.ssjs`, ou il est testable en Node.
 *
 *  Pourquoi une recopie et non une inclusion : AMPscript n'a aucun mecanisme
 *  d'include. Recopier a la main garantissait la derive ; ce script la rend
 *  impossible.
 *
 *  ⚠ POURQUOI LA BALISE EST ASSEMBLEE PAR AMPSCRIPT (2026-08-23)
 *  L'API SFMC SUPPRIME tout <script> a l'upload, sur les blocs comme sur les
 *  pages. Verifie sur un cas trivial : <p>a</p><script>var x=1;</script><p>b</p>
 *  revient sans le script. Le JS de cascade partait donc a la poubelle en
 *  silence — 46 Ko envoyes, 27 Ko stockes, `rafraichirCascade` absent — et rien
 *  ne cassait visiblement : les listes restaient juste vides.
 *
 *  On emet donc la balise A L'EXECUTION, par concatenation : l'API ne voit
 *  jamais la chaine "<script>", le navigateur recoit une vraie balise.
 *  Verifie de bout en bout : la page affiche « JS EXECUTE ».
 *
 *  Ne JAMAIS remettre un <script> litteral dans un fichier destine a l'API.
 *  La regle de lint 10 le refuse.
 *
 *  A relancer apres toute modification du JS de cascade :
 *
 *      node scripts/sync-cascade-js.js          verifie et corrige
 *      node scripts/sync-cascade-js.js --check  echoue si desynchronise (CI)
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'sfmc-ssjs', 'socle');
const SRC = path.join(DIR, 'picklist-handler.ssjs');
const DST = path.join(DIR, 'picklist-handler.ampscript');
const DEBUT = '<!-- ===== JS DE CASCADE — genere par scripts/sync-cascade-js.js ===== -->';
const FIN   = '<!-- ===== fin JS DE CASCADE ===== -->';

const blocs = [...fs.readFileSync(SRC, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!blocs.length) {
    console.error('✗ Aucun bloc <script> navigateur trouve dans picklist-handler.ssjs');
    process.exit(1);
}
const cascade = blocs[blocs.length - 1][1];

for (const attendu of ['rafraichirCascade', 'appliquerOrdre', 'window.SOCLE_DATA']) {
    if (!cascade.includes(attendu)) {
        console.error(`✗ Le bloc extrait ne contient pas "${attendu}" — mauvais bloc ?`);
        process.exit(1);
    }
}

let dst = fs.readFileSync(DST, 'utf8');

/* ---- LA FIN DE LIGNE EST CELLE DU FICHIER, PAS CELLE DU SCRIPT ---------
   Sans ceci, `--check` echouait EN PERMANENCE sur un poste Windows, et pour
   une raison entierement fausse. Le depot est en LF (`git ls-files --eol` :
   `i/lf`), git le detend en CRLF dans la copie de travail (`w/crlf`), et ce
   script reconstruisait son enrobage en \n : six lignes d'ecart sur 165 Ko
   rigoureusement identiques par ailleurs.

   Le cout n'etait pas seulement un test rouge. `npm test` s'ouvrait sur un
   « picklist-handler.ampscript est DESYNCHRONISE » qui accusait le JS de
   cascade, et lancer la correction proposee reecrivait 165 Ko pour six
   retours-chariot — un diff illisible, et le vrai contenu noye dedans.

   Verifie le 2026-09-04 : bloc extrait et bloc en place identiques au
   caractere pres (164 836 des deux cotes), seul l'enrobage differait. */
const EOL = dst.includes('\r\n') ? '\r\n' : '\n';

/* La balise est construite a l'execution. Les morceaux "<scr" / "ipt>" sont
   volontairement coupes : c'est ce qui rend le filtre de l'API aveugle. */
const bloc = [
    DEBUT,
    '%%[',
    'VAR @cascadeOuvre, @cascadeFerme',
    'SET @cascadeOuvre = Concat("<scr", "ipt>")',
    'SET @cascadeFerme = Concat("</scr", "ipt>")',
    ']%%',
    `%%=v(@cascadeOuvre)=%%${cascade}%%=v(@cascadeFerme)=%%`,
    FIN,
    '',
].join(EOL);

/* ---- `\r?\n` ET NON `\n` -----------------------------------------------
   Le `\n?` d'origine ne pouvait PAS consommer la fin de ligne d'un fichier
   CRLF : apres le marqueur de fin vient `\r`, que le motif ne prevoyait
   pas. Le bloc relu s'arretait donc au marqueur, celui qu'on regenere
   portait sa fin de ligne, et la comparaison echouait toujours — de deux
   octets exactement. Pire, chaque execution AJOUTAIT ces deux octets :
   le fichier grossissait d'une ligne vide a chaque passage, et la synchro
   ne pouvait par construction jamais se declarer a jour.
   Diagnostique le 2026-09-04 en comparant les deux blocs caractere par
   caractere : premier ecart a l'index 165 129 sur 165 131. */
const re = new RegExp(DEBUT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + FIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\r?\\n)?');

const sortie = re.test(dst) ? dst.replace(re, bloc) : dst.replace(/\s*$/, EOL + EOL + bloc);

if (sortie === dst) { console.log('✓ JS de cascade deja synchronise'); process.exit(0); }
if (process.argv.includes('--check')) {
    console.error('✗ picklist-handler.ampscript est DESYNCHRONISE. Lancer : node scripts/sync-cascade-js.js');
    process.exit(1);
}
fs.writeFileSync(DST, sortie);
console.log(`✓ JS de cascade recopie (${Math.round(cascade.length / 1024)} Ko)`);
