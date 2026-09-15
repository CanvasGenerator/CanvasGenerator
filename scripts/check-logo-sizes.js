#!/usr/bin/env node
/**
 * Vérifie que chaque logo ANGLAIS a exactement les mêmes dimensions que son
 * équivalent FRANÇAIS.
 *
 * Pourquoi c'est important : le header des pages déclinées n'affiche pas le logo
 * en entier, il le CADRE. Le conteneur fait 54 px de haut avec overflow:hidden,
 * l'image est rendue à `imgH` px puis remontée de `mt` px (lib/school-blocks.js).
 * Ces deux valeurs sont réglées au pixel sur l'image FRANÇAISE. Si le fichier
 * anglais n'a pas le même cadre, le même réglage produit un logo d'une autre
 * largeur, cadré sur une autre portion de l'illustration — constaté jusqu'à 23 %
 * d'écart à l'écran.
 *
 * La bascule FR/EN se fait sur le nom de fichier (`baseline-x.png` →
 * `baseline-x-en.png`), voir applyLogoLanguage() dans js/app.js et
 * swapBaselineLogosToEn() dans lib/translate.js.
 *
 * Aucune écriture, aucune dépendance : la taille est lue dans l'entête PNG.
 *
 * Usage : node scripts/check-logo-sizes.js
 * Sortie : code 0 si toutes les paires concordent, 1 sinon.
 */
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');

/** Dimensions d'un PNG, lues dans le chunk IHDR (13 premiers octets utiles). */
function pngSize(file) {
    const buf = Buffer.alloc(32);
    const fd = fs.openSync(file, 'r');
    try {
        fs.readSync(fd, buf, 0, 32, 0);
    } finally {
        fs.closeSync(fd);
    }
    if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const pairs = [];
for (const school of fs.readdirSync(ASSETS)) {
    const dir = path.join(ASSETS, school);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
        // Seuls les logos « baseline » ont une variante anglaise : les « nobaseline »
        // n'ont pas de signature à traduire.
        if (!/^baseline-.*\.png$/i.test(file) || /-en\.png$/i.test(file)) continue;
        const en = file.replace(/\.png$/i, '-en.png');
        pairs.push({
            school,
            fr: file,
            en,
            frSize: pngSize(path.join(dir, file)),
            enSize: fs.existsSync(path.join(dir, en)) ? pngSize(path.join(dir, en)) : null
        });
    }
}

const fmt = s => (s ? `${s.w}x${s.h}` : 'ABSENT');
const bad = [];

console.log('\nécole         fichier français              attendu (FR)   actuel (EN)    état');
console.log('─'.repeat(88));

for (const p of pairs) {
    const same = p.enSize && p.frSize
        && p.enSize.w === p.frSize.w && p.enSize.h === p.frSize.h;
    if (!same) bad.push(p);
    console.log(
        p.school.padEnd(13) +
        p.fr.padEnd(30) +
        fmt(p.frSize).padEnd(15) +
        fmt(p.enSize).padEnd(15) +
        (same ? 'OK' : (p.enSize ? 'A REPRENDRE' : 'MANQUANT'))
    );
}

console.log('');
if (!bad.length) {
    console.log(`Toutes les paires concordent (${pairs.length} logos).`);
    process.exit(0);
}

console.log(`${bad.length} logo(s) anglais sur ${pairs.length} à réexporter :\n`);
for (const p of bad) {
    const target = p.frSize ? `${p.frSize.w} x ${p.frSize.h} px` : '(source illisible)';
    const actual = p.enSize ? `${p.enSize.w} x ${p.enSize.h} px` : 'fichier absent';
    console.log(`  assets/${p.school}/${p.en}`);
    console.log(`      cible  : ${target}   (identique à ${p.fr})`);
    console.log(`      actuel : ${actual}`);
}
console.log('\nLe cadre doit être identique, pas seulement le logo : même largeur,');
console.log('même hauteur, et la signature placée au même endroit dans l\'image.');
process.exit(1);
