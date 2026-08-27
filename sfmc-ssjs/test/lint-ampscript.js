/**
 * ============================================================================
 *  CONTROLES STATIQUES SUR L'AMPSCRIPT
 * ============================================================================
 *  AMPscript n'a ni compilateur, ni try/catch, et une erreur REMPLACE la page
 *  entiere. Il n'existe donc aucun retour d'erreur exploitable en production :
 *  tout ce qui peut etre attrape avant publication doit l'etre ici.
 *
 *  Chaque regle correspond a un defaut REELLEMENT rencontre sur ce projet.
 *  Ce n'est pas une liste de bonnes pratiques theoriques.
 * ============================================================================
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..');
const CIBLES = [
    'socle/handler-form.ampscript',
    'socle/picklist-handler.ampscript',
    'diagnostic/A-COLLER-cloudpage-ampscript.ssjs',
];

/* Fonctions qui N'EXISTENT PAS en AMPscript mais qu'on suppose souvent.
   `Char` a reellement ete utilise ici et aurait tue la page. */
const INEXISTANTES = ['Char', 'Chr', 'JSON', 'parseInt', 'toString', 'Split', 'Trim2'];

/** Neutralise commentaires et HTML pour ne lire que du code AMPscript. */
function codeSeul(src) {
    const blanc = (m) => m[0].replace(/[^\n]/g, ' ');
    let net = src.replace(/\/\*[\s\S]*?\*\//g, (...a) => blanc(a));
    net = net.replace(/<!--[\s\S]*?-->/g, (...a) => blanc(a));
    return net.match(/%%\[([\s\S]*?)\]%%/g) || [];
}

/** Comme codeSeul, mais rend la source ENTIERE avec les commentaires
    neutralises. Necessaire aux regles qui balaient le fichier au lieu de
    boucler sur les blocs %%[ ]%% : sans ca, un appel simplement CITE dans un
    commentaire est analyse comme du code (faux positif rencontre le
    2026-08-23 sur une note expliquant un echec de ContactPointEmail). */
function sansCommentaires(src) {
    const blanc = (m) => m.replace(/[^\n]/g, ' ');
    return src.replace(/\/\*[\s\S]*?\*\//g, blanc)
              .replace(/<!--[\s\S]*?-->/g, blanc);
}

const echecs = [];
function verifie(nom, ok, detail) {
    if (!ok) echecs.push(`${nom} : ${detail}`);
}

for (const rel of CIBLES) {
    const abs = path.join(DIR, rel);
    if (!fs.existsSync(abs)) { echecs.push(`${rel} : fichier absent`); continue; }
    const src = fs.readFileSync(abs, 'utf8');
    const blocs = codeSeul(src);
    const code = blocs.join('\n');

    /* 1. Blocs %%[ ]%% apparies. Un bloc non ferme fait afficher du code brut
          aux visiteurs. */
    verifie(rel, (src.match(/%%\[/g) || []).length === (src.match(/\]%%/g) || []).length,
        'blocs %%[ ]%% desapparies');

    /* 2. IF/ENDIF et FOR/NEXT equilibres, par pile et non par comptage : un
          comptage egal peut cacher un mauvais imbriquement. */
    const pile = [];
    let orphelin = null;
    let noLigne = 0;
    for (const ligne of src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
        noLigne++;
        for (const t of ligne.match(/\b(IF|ENDIF|FOR|NEXT)\b/g) || []) {
            if (t === 'IF' || t === 'FOR') pile.push(t);
            else if (t === 'ENDIF') { if (pile.pop() !== 'IF') orphelin = orphelin || `ENDIF L${noLigne}`; }
            else if (t === 'NEXT') { if (pile.pop() !== 'FOR') orphelin = orphelin || `NEXT L${noLigne}`; }
        }
    }
    verifie(rel, !orphelin && pile.length === 0,
        orphelin ? `structure orpheline : ${orphelin}` : `${pile.length} bloc(s) non ferme(s)`);

    /* 3. Toute variable utilisee doit etre declaree. AMPscript ne le signale
          pas : une variable oubliee vaut vide, et le champ ne s'ecrit jamais. */
    const decl = new Set();
    for (const m of code.matchAll(/^\s*VAR\s+(.+)$/gm)) {
        for (const v of m[1].split(',')) decl.add(v.trim());
    }
    const utilisees = new Set([...code.matchAll(/@\w+/g)].map((m) => m[0]));
    const manquantes = [...utilisees].filter((v) => !decl.has(v));
    verifie(rel, manquantes.length === 0, `variables non declarees : ${manquantes.join(', ')}`);

    /* 4. Aucune fonction inexistante. */
    for (const f of INEXISTANTES) {
        const re = new RegExp(`\\b${f}\\s*\\(`);
        verifie(rel, !re.test(code), `appelle ${f}(), qui n'existe pas en AMPscript`);
    }

    /* 5. Le champ de type d'evenement. summit__Event_Type__c est VIDE sur les
          55 instances de l'org : le champ alimente est eventType__c. L'erreur
          ne produit aucune exception, seulement un formulaire sans date. */
    verifie(rel, !code.includes('summit__Event_Type__c'),
        'utilise summit__Event_Type__c (vide sur l\'org) au lieu de eventType__c');

    /* 6. Noms d'objets Summit : le package prefixe summit__Summit_Events_*.
          Les formes courtes renvoient INVALID_TYPE et tuent la page. */
    for (const faux of ['summit__Instance__c', 'summit__Registration__c', 'summit__Appointment__c']) {
        verifie(rel, !new RegExp(`"${faux}"`).test(code), `nom d'objet invalide : ${faux}`);
    }

    /* 8. Une seule instruction par ligne. AMPscript tolere `IF x THEN y ENDIF`
          sur une ligne, mais deux SET accoles font echouer la PUBLICATION avec
          « The page content contains errors and cannot be processed » — message
          qui ne designe ni la ligne ni la cause. */
    for (const bm of src.matchAll(/%%\[([\s\S]*?)\]%%/g)) {
        const bloc = bm[1].replace(/\/\*[\s\S]*?\*\//g, '');
        let no = src.slice(0, bm.index).split('\n').length;
        for (const ligne of bloc.split('\n')) {
            no++;
            const l = ligne.trim();
            if (!l) continue;
            const mots = l.match(/\b(SET|VAR|ENDIF|FOR|NEXT|IF|ELSE|ELSEIF)\b/g) || [];
            if (mots.length < 2) continue;
            if (/^IF .+ THEN (SET|BREAK) .+ ENDIF$/.test(l)) continue;   // one-liner legal
            verifie(rel, false, `L${no} : plusieurs instructions sur une ligne — ${l.slice(0, 60)}`);
        }
    }
}

/* 9. Arite de CreateSalesforceObject : le compteur annonce doit correspondre au
      nombre reel de paires champ/valeur. Un ecart tue la page a l'execution,
      sans message. Le comptage ignore les virgules imbriquees (Concat(...)) et
      celles a l'interieur des chaines. */
function argsNiveau1(txt) {
    let n = 1, prof = 0, dansChaine = false;
    for (const c of txt) {
        if (c === '"') dansChaine = !dansChaine;
        else if (!dansChaine) {
            if (c === '(') prof++;
            else if (c === ')') prof--;
            else if (c === ',' && prof === 0) n++;
        }
    }
    return n;
}

for (const rel of CIBLES) {
    const abs = path.join(DIR, rel);
    if (!fs.existsSync(abs)) continue;
    const src = sansCommentaires(fs.readFileSync(abs, 'utf8'));
    const re = /CreateSalesforceObject\(/g;
    let m;
    while ((m = re.exec(src))) {
        let i = m.index + m[0].length, prof = 1, dans = false;
        while (i < src.length && prof) {
            if (src[i] === '"') dans = !dans;
            else if (!dans) { if (src[i] === '(') prof++; else if (src[i] === ')') prof--; }
            i++;
        }
        const appel = src.slice(m.index + m[0].length, i - 1);
        const tete = /^\s*"(\w+)",\s*(\d+)/.exec(appel);
        if (!tete) { verifie(rel, false, 'CreateSalesforceObject sans compteur de champs'); continue; }
        const attendu = 2 + 2 * Number(tete[2]);
        const reel = argsNiveau1(appel);
        verifie(rel, reel === attendu,
            `CreateSalesforceObject("${tete[1]}", ${tete[2]}) : ${reel} arguments au lieu de ${attendu}`);
    }
}

/* 12. La candidature doit restreindre les programmes a ceux ayant un PTAT.
       Sans ca, un candidat peut choisir une combinaison qui mene a une impasse
       (Rentree et Programme vides) : mesure du 2026-08-23, 49 des 172
       programmes EFAP n'ont aucune session ouverte. Le filtrage progressif de
       la cascade ne peut pas rattraper ca — ce n'est pas une condition entre
       champs. */
{
    const ph = fs.readFileSync(path.join(DIR, 'socle/picklist-handler.ampscript'), 'utf8');
    verifie('picklist-handler.ampscript', /@ptatProgIndex/.test(ph),
        'la restriction des programmes aux sessions ouvertes a disparu ' +
        '(@ptatProgIndex absent) — la candidature reexpose des impasses');
    verifie('picklist-handler.ampscript', /@candidature\s*==\s*"true"/.test(ph),
        'la restriction n\'est plus conditionnee a la candidature — la brochure ' +
        'doit continuer a montrer tout le catalogue');
}

/* 11. Le lien vers l'Event ne porte PAS le meme nom sur tous les objets summit.
       Sur `Appointment_Type` c'est `summit__Summit_Events__c`, pas
       `summit__Event__c`. Un nom inexistant tue la page sans message — erreur
       commise le 2026-08-23 dans un bloc de test. */
for (const rel of CIBLES) {
    const abs = path.join(DIR, rel);
    if (!fs.existsSync(abs)) continue;
    const src = sansCommentaires(fs.readFileSync(abs, 'utf8'));
    /* on cherche un Retrieve sur Appointment_Type filtre sur summit__Event__c */
    const re = /RetrieveSalesforceObjects\(\s*"summit__Summit_Events_Appointment_Type__c"[\s\S]{0,400}?\)/g;
    let m;
    while ((m = re.exec(src))) {
        verifie(rel, !/"summit__Event__c"/.test(m[0]),
            'Appointment_Type filtre sur summit__Event__c : ce champ n\'existe pas ' +
            'sur cet objet, utiliser summit__Summit_Events__c');
    }
}

/* 10. AUCUNE balise de script litterale dans un fichier destine a l'API.
       L'API SFMC les SUPPRIME a l'upload — blocs comme pages. Verifie le
       2026-08-23 : `<p>a</p>` + une balise de script + `<p>b</p>` revient sans
       la balise. Les degats sont invisibles : la page s'affiche, le JS a
       simplement disparu, et un JSON emis de cette facon se retrouve en TEXTE
       sur la page.

       La seule voie est d'assembler la balise a l'execution :
           SET @o = Concat("<scr", "ipt>")
           %%=v(@o)=%% ... %%=v(@f)=%%
       Cette regle interdit le retour en arriere. */
for (const rel of CIBLES) {
    const abs = path.join(DIR, rel);
    if (!fs.existsSync(abs)) continue;
    const src = sansCommentaires(fs.readFileSync(abs, 'utf8'));
    const ouvertures = (src.match(/<script(?![^>]*runat=["']server["'])/gi) || []).length;
    verifie(rel, ouvertures === 0,
        `${ouvertures} balise(s) de script litterale(s) — l'API SFMC les supprime. ` +
        `Assembler la balise a l'execution avec Concat("<scr", "ipt>")`);
}

/* 7. Le JS de cascade doit etre present dans le handler AMPscript : c'est lui
      qui consomme window.SOCLE_DATA. Son absence ne casse rien visiblement —
      les listes restent simplement vides. */
const ph = fs.readFileSync(path.join(DIR, 'socle/picklist-handler.ampscript'), 'utf8');
for (const attendu of ['window.SOCLE_DATA', 'rafraichirCascade', 'appliquerOrdre']) {
    verifie('picklist-handler.ampscript', ph.includes(attendu),
        `le JS de cascade est absent (${attendu}) — lancer scripts/sync-cascade-js.js`);
}

if (echecs.length) {
    console.error('✗ lint AMPscript : ' + echecs.length + ' probleme(s)');
    echecs.forEach((e) => console.error('  - ' + e));
    process.exit(1);
}
console.log('✓ lint AMPscript : ' + CIBLES.length + ' fichier(s), 7 familles de controles');
