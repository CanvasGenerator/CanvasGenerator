/**
 * ============================================================================
 *  REGLES DE BLOCAGE CANDIDATURE — LA DECISION, PAS L'AFFICHAGE
 * ============================================================================
 *  Ce fichier existe a cause d'un trou de couverture qui a coute un aller-retour
 *  client complet, le 2026-09-04.
 *
 *  `test-confirmation.js` verrouille les trois tons (vert / orange / rouge) et
 *  le texte des deux messages. Mais il FABRIQUE la reponse du socle :
 *
 *      const BLOQUE_R1 = '<!-- socle ecriture: statut=blocked ... motif=r1 -->';
 *
 *  Il prouve donc une seule chose — SI le socle dit `motif=r1`, l'encart
 *  s'ouvre en orange. Il ne dit rien de la question qui compte : le socle
 *  decide-t-il ? La reponse etait non, et 43 tests verts l'ont couverte : un
 *  candidat deja inscrit sur le meme campus et la meme specialite recevait le
 *  message VERT.
 *
 *  Ces tests-ci lisent donc le socle d'ECRITURE lui-meme. Ils ne peuvent pas
 *  l'executer — AMPscript ne tourne que dans SFMC — alors ils verrouillent ce
 *  qu'un fichier texte permet de verrouiller : la forme de la regle, l'ordre
 *  de ses branches, sa position avant les ecritures, et l'egalite AU CARACTERE
 *  PRES entre les messages qu'elle emet et ceux que le front affiche.
 *
 *  ⚠ Ce que ces tests NE prouvent PAS, et qu'aucun test local ne prouvera :
 *  que l'org repond ce qu'on croit. Les noms d'objet et de champ ont ete
 *  confrontes a l'org le 2026-08-23 ; leur validite ne se verifie que la-bas,
 *  et un nom faux ne renvoie pas d'erreur en AMPscript — il REMPLACE la page.
 * ========================================================================== */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOCLE = path.join(__dirname, '..', 'socle');
const ECRITURE = fs.readFileSync(path.join(SOCLE, 'handler-form.ampscript'), 'utf8');
const LECTURE = fs.readFileSync(path.join(SOCLE, 'picklist-handler.ssjs'), 'utf8');

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(`${nom}\n      ${e.message}`); } }
function vrai(c, msg) { if (!c) throw new Error(msg); }
function egal(a, b, quoi) {
    if (a !== b) throw new Error(`${quoi}\n      obtenu  : ${JSON.stringify(a)}\n      attendu : ${JSON.stringify(b)}`);
}

/* La regle vit entre son garde d'entree et le garde-fou d'ecriture. Tout ce
   qui suit ce dernier est ecriture, donc hors sujet ici. */
const DEBUT_REGLE = ECRITURE.indexOf('IF @REGLES_ACTIVES == "true" AND @formType == "candidature" THEN');
const GARDE_ECRITURE = ECRITURE.indexOf('IF @sfStatus != "blocked" THEN');
const REGLE = ECRITURE.slice(DEBUT_REGLE, GARDE_ECRITURE);

/* ---- Position et armement ---------------------------------------------- */

test('La regle est evaluee AVANT toute ecriture [REGRESSION]', () => {
    /* Un blocage doit tout arreter : ni compte, ni consentement, ni campagne.
       Si la regle passait apres, un candidat bloque laisserait quand meme des
       traces dans le CRM — un doublon que le blocage etait cense eviter. */
    vrai(DEBUT_REGLE > 0, 'garde de la regle introuvable dans handler-form.ampscript');
    vrai(GARDE_ECRITURE > 0, 'garde-fou d ecriture introuvable');
    vrai(DEBUT_REGLE < GARDE_ECRITURE, 'la regle de blocage est passee APRES le garde-fou d ecriture');
});

test('La regle reste armee : @REGLES_ACTIVES vaut "true" [REGRESSION]', () => {
    /* Le bloc a ete livre desactive, le temps de confronter les noms de champs
       a l'org. Un retour a "false" desarmerait R1 et R2 en silence, sans
       qu'aucun autre test ne le voie. */
    vrai(/SET @REGLES_ACTIVES\s*=\s*"true"/.test(ECRITURE),
        '@REGLES_ACTIVES n est plus a "true" : R1 et R2 sont desarmees');
});

test('Un PTAT vide ne desarme PLUS la regle [REGRESSION]', () => {
    /* ⚠ LE BUG DU 2026-09-04, retourne.

       Le garde exigeait `NOT Empty(@ptatId)`. Or `PTAT_Id` est rempli par le
       NAVIGATEUR au terme de la cascade, et reste vide dans deux etats que
       celle-ci tient pour normaux — plusieurs programmes en lice, ou programme
       sans PTAT pour la rentree choisie (test-cascade.js les consacre tous les
       deux). R1 et R2 etaient donc sautees EN ENTIER, la candidature
       s'ecrivait, et le visiteur lisait le VERT sans que rien n'ait ete
       verifie. C'est de la que venait « tout est vert ».

       Deux choses a garder, et la seconde compte autant : le terme a disparu
       du garde, ET il n'existe plus de branche de repli qui se contenterait de
       journaliser en laissant passer. */
    vrai(!REGLE.includes('NOT Empty(@ptatId)'),
        'le garde exige a nouveau un PTAT non vide : un PTAT absent redesarme R1 et R2');
    vrai(!ECRITURE.includes('REGLES:non-armees'),
        'la branche qui laissait passer sans rien verifier est revenue');
});

test('Sans PTAT, la regle se replie sur un controle par PERSONNE [REGRESSION]', () => {
    /* Ne rien verifier n'etait pas une option, et filtrer sur un PTAT vide
       n'en est pas une non plus : AMPscript chercherait « le PTAT vide »,
       trouverait zero ligne, et rendrait exactement le faux vert qu'on repare.

       Il faut donc DEUX requetes, choisies par la portee. Celle de repli est
       plus severe — une candidature sur n'importe quel programme bloque — mais
       elle ne s'applique que la ou le programme est inconnu. */
    vrai(/SET @candPortee = "personne"/.test(REGLE) && /SET @candPortee = "ptat"/.test(REGLE),
        'la regle n a plus de portee explicite : on ne sait plus ce qu elle a verifie');
    const parPtat = REGLE.indexOf('@F_APP_PTAT,   "=", @ptatId)');
    vrai(parPtat > 0, 'la requete filtree par PTAT a disparu : le blocage n est plus propre a UN programme');
    const requetes = (REGLE.match(/RetrieveSalesforceObjects\(@OBJ_APPLICATION/g) || []).length;
    egal(requetes, 2, 'il faut UNE requete par portee : par PTAT, et par personne');
});

test('Changer de programme reste permis quand le PTAT est connu [REGRESSION]', () => {
    /* L'identite d'une candidature est e-mail x PROGRAMME, et le lien entre
       les deux est le PTAT. Elargir le filtre a la personne quand le PTAT est
       la fermerait la porte a un candidat qui postule ailleurs — ce que le
       cadrage autorise explicitement.

       Le PTAT porte deja l'annee scolaire : il n'y a AUCUN critere « meme
       annee » a ajouter, il serait redondant. */
    const branche = REGLE.slice(REGLE.indexOf('IF @candPortee == "ptat" THEN'),
                                REGLE.indexOf('SET @nCand = RowCount(@candRows)'));
    vrai(branche.includes('@F_APP_PTAT'),
        'la portee `ptat` ne filtre plus sur le PTAT : le blocage deborde sur les autres programmes');
    vrai(!/AcademicYear|@F_APP_ANNEE|annee/i.test(branche),
        'un critere d annee est revenu : le PTAT le porte deja, il serait redondant');
});

test('Les issues qui LAISSENT PASSER laissent chacune leur trace [REGRESSION]', () => {
    /* Trois facons de ressortir en vert sans blocage, et elles ne se corrigent
       pas de la meme maniere : reparer la lecture de l e-mail, constater que le
       CRM n a effectivement rien, ou s apercevoir que la portee etait la plus
       large. Les confondre est ce qui a fait perdre le diagnostic.

       ⚠ Le journal HTML ne suffit pas : personne ne le conserve. Les deux
       issues vertes doivent aussi laisser leur ligne dans LPB_Log_Soumissions,
       comme le blocage le fait depuis le 01/09 — c est la seule trace qui
       survit a la fermeture de l onglet. */
    [
        ['REGLES:email-inconnu', 'e-mail absent de Account.PersonEmail'],
        ['REGLES:aucune-candidature(ptat=', 'aucune candidature trouvee'],
        ['portee=', 'la portee employee'],
    ].forEach(([marqueur, cas]) => {
        vrai(REGLE.includes(marqueur), `le cas « ${cas} » ne laisse aucune trace (${marqueur})`);
    });
    vrai(REGLE.includes('21 - candidature libre'),
        'une candidature qui passe ne laisse aucune ligne dans LPB_Log_Soumissions');
    vrai(REGLE.includes('21 - aucun compte'),
        'un e-mail inconnu ne laisse aucune ligne dans LPB_Log_Soumissions');
});

test('Un blocage laisse sa trace au journal ET dans LPB_Log_Soumissions', () => {
    /* Tout ce qui suit vit dans le garde-fou d ecriture : sans ces deux lignes,
       une candidature legitimement bloquee etait indiscernable d une page morte
       entre l etape 20 et l etape 25. Constate le 01/09. */
    vrai(REGLE.includes('BLOQUE:'), 'marqueur BLOQUE: absent du journal');
    vrai(REGLE.includes('21 - candidature bloquee'), 'etape 21 absente du journal de soumissions');
    /* La portee fait partie de la trace : un blocage par PERSONNE et un
       blocage par PTAT ne se relisent pas de la meme facon, et le second est
       le seul qui prouve quelque chose sur le programme demande. */
    const ligneBloque = (REGLE.match(/^.*BLOQUE:.*$/m) || [''])[0];
    vrai(ligneBloque.includes('portee='), 'le blocage ne dit pas dans quelle portee il a ete prononce');
});

/* ---- Le verdict, par cas ----------------------------------------------- */

test('R2 est evaluee AVANT R1 : un refus doit primer [REGRESSION]', () => {
    /* Plusieurs candidatures sur le meme PTAT : un refus l emporte sur un
       dossier en cours. Les deux messages ne disent pas la meme chose — l un
       oriente vers les admissions, l autre annonce d attendre l annee
       prochaine — et servir R1 a quelqu un de refuse serait pire que se taire. */
    const iR2 = REGLE.indexOf('SET @sfBlockRule = "r2"');
    const iR1 = REGLE.indexOf('SET @sfBlockRule = "r1"');
    vrai(iR2 > 0 && iR1 > 0, 'les deux motifs ne sont plus poses par la regle');
    vrai(iR2 < iR1, 'R1 est evaluee avant R2 : un candidat refuse recevrait le message « en cours »');
});

test('R1 ne peut pas ECRASER un R2 deja pose [REGRESSION]', () => {
    /* La branche R1 est gardee par `Empty(@sfBlockMsg)`. Sans cette garde, une
       seconde ligne de candidature en cours effacerait le refus pose par la
       premiere — et la boucle rend alors un verdict qui depend de l ORDRE des
       lignes renvoyees par le CRM, c est-a-dire de rien. */
    vrai(/ELSEIF Empty\(@sfBlockMsg\) THEN/.test(REGLE),
        'la branche R1 n est plus gardee par Empty(@sfBlockMsg)');
});

test('« Rejected » est cherche dans LES DEUX champs [REGRESSION]', () => {
    /* Tranche par le metier le 2026-09-01, apres deux versions fausses. Une
       lecture ne peut pas casser la page, contrairement a une ecriture : le
       seul cout d un champ vide est qu il ne dit rien. En echange la regle ne
       peut plus devenir muette selon le champ que le CRM alimente — et le
       projet en a deja fait les frais, R2 s etant appuyee sur un champ que
       l on croyait rempli. */
    vrai(/SET @VAL_REFUSE\s*=\s*"rejected"/i.test(ECRITURE), '@VAL_REFUSE n est plus "rejected"');
    vrai(REGLE.includes('@candDecision == @VAL_REFUSE OR @candStatut == @VAL_REFUSE'),
        'le refus n est plus cherche dans FinalDecision__c ET dans Status');
});

test('Le statut choisit le MESSAGE, jamais le blocage [REGRESSION]', () => {
    /* Toute candidature deja posee sur le couple personne x PTAT bloque la
       suivante, `Withdrawn / Abandoned` compris — le metier a tranche l inverse
       de l exception initiale le 2026-09-01. Concretement : la branche R1 est
       un ELSEIF sans condition de statut, donc le defaut de tout statut connu
       ou vide. Si quelqu un y ajoutait un test de statut, un abandon
       repasserait. */
    const branche = REGLE.slice(REGLE.indexOf('ELSEIF Empty(@sfBlockMsg) THEN'),
                                REGLE.indexOf('SET @sfBlockRule = "r1"'));
    vrai(!/@candStatut|@candDecision/.test(branche),
        'la branche R1 s est remise a filtrer sur le statut : un dossier abandonne repasserait');
});

test('Toute candidature existante bloque : seul Rejected change le message', () => {
    /* ⚠ LE CONSTAT QUI TRANCHE, mesure sur les 321 candidatures de la
       recette : `FinalDecision__c` est VIDE sur 304 d entre elles. « Statut
       vide » ne veut donc pas dire « pas de candidature », et une regle qui
       n aurait bloque que sur une decision connue serait restee muette sur
       95 % des dossiers reels.

       Le metier a tranche : des qu une candidature EXISTE, on bloque. Trois
       sorties, et trois seulement :
         aucune ligne          -> vert, la soumission s ecrit
         >= 1 ligne            -> orange (r1), statut vide compris
         >= 1 ligne Rejected   -> rouge  (r2)

       Concretement : le blocage est decide par `@nCand > 0`, jamais par la
       valeur d un statut. Si quelqu un ramenait un test de statut dans la
       condition d entree, les 304 dossiers a decision vide repasseraient. */
    const entree = REGLE.slice(REGLE.indexOf('SET @nCand = RowCount(@candRows)'),
                               REGLE.indexOf('FOR @i = 1 TO @nCand DO'));
    vrai(/IF @nCand > 0 THEN/.test(entree),
        'le blocage ne depend plus du seul NOMBRE de candidatures trouvees');
    vrai(!/@candStatut|@candDecision|@VAL_REFUSE/.test(entree),
        'un test de statut est remonte dans la condition d entree : les dossiers a decision vide repasseraient');
});

/* ---- Structure : AMPscript n'a pas de try/catch ------------------------ */

test('Les IF de la regle sont equilibres', () => {
    /* Un ENDIF manquant ne se voit pas a la lecture et n est pas rattrapable a
       l execution : la page entiere est remplacee par « The page content
       contains errors ». Aucun `node --check` ne couvre ce fichier. */
    const compte = (motif) => (REGLE.match(motif) || []).length;
    const ouverts = compte(/^\s*IF .*THEN\s*$/gm);
    const fermes = compte(/^\s*ENDIF\s*$/gm);
    egal(fermes, ouverts, `IF/ENDIF desequilibres dans la regle de blocage`);
    egal(compte(/^\s*FOR .*DO\s*$/gm), compte(/^\s*NEXT @i\s*$/gm), 'FOR/NEXT desequilibres');
});

/* ---- Les messages : une seule verite, trois copies -------------------- */

/**
 * Les deux messages tels que le socle d'ECRITURE les emet.
 * C'est la source : c'est cette chaine qui part dans `socle erreur:`.
 */
function messagesEcriture() {
    const trouves = {};
    const re = /SET @sfBlockRule = "(r[12])"\s*[\r\n]+\s*SET @sfBlockMsg = "([^"]+)"/g;
    let m;
    while ((m = re.exec(REGLE)) !== null) trouves[m[1]] = m[2];
    return trouves;
}

/**
 * Les deux messages tels que le socle de LECTURE les affiche.
 *
 * Le litteral est evalue tel quel : c'est de la donnee pure (des chaines et
 * des concatenations), et l'evaluer est le seul moyen de rendre les sequences
 * d'echappement (\u00XX) en accents. Elles sont ecrites en ASCII a la source
 * pour survivre a l'upload par l'API SFMC, quoi que fasse l'encodage en
 * chemin ; c'est donc apres evaluation, et seulement la, que les deux copies
 * du message deviennent comparables.
 */
function messagesLecture() {
    const i = LECTURE.indexOf('var MESSAGES_BLOCAGE = {');
    if (i < 0) throw new Error('MESSAGES_BLOCAGE introuvable dans picklist-handler.ssjs');
    const j = LECTURE.indexOf('\n    };', i);
    const litteral = LECTURE.slice(i + 'var MESSAGES_BLOCAGE = '.length, j + '\n    }'.length);
    return vm.runInNewContext('(' + litteral + ')');
}

test('Le message R1 est le MEME a l ecriture et a l affichage [REGRESSION]', () => {
    /* Le texte vit en TROIS copies — handler-form.ampscript, la table
       MESSAGES_BLOCAGE de picklist-handler.ssjs, et test-confirmation.js — et
       rien ne les rapprochait. Une derive n aurait ete vue que par un
       candidat, et seulement s il la signalait : les deux socles se declenchent
       dans des situations differentes (`socle erreur:` sert de repli quand le
       motif manque). C est ce test qui les tient ensemble. */
    egal(messagesLecture().r1.join(' '), messagesEcriture().r1, 'R1 a derive entre les deux socles');
});

test('Le message R2 est le MEME a l ecriture et a l affichage [REGRESSION]', () => {
    egal(messagesLecture().r2.join(' '), messagesEcriture().r2, 'R2 a derive entre les deux socles');
});

test('Les deux messages orientent vers les admissions, sans promesse d e-mail', () => {
    /* Retour du 2026-09-03 : R1 annoncait « consultez l email qui vous avait
       ete envoye » — une promesse que rien ne garantit, et aucune porte de
       sortie. Le metier lui a substitue une orientation. Ce test garde
       l INTENTION, la ou les tests de texte gardent la lettre. */
    const m = messagesEcriture();
    ['r1', 'r2'].forEach((cle) => {
        vrai(/admissions/i.test(m[cle]), `${cle} n oriente plus vers les admissions`);
        vrai(!/e-?mail/i.test(m[cle]), `${cle} promet a nouveau un e-mail`);
    });
});

console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
echecs.forEach((e) => console.log(`  ✗ ${e}\n`));
process.exit(echecs.length ? 1 : 0);
