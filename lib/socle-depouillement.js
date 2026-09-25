'use strict';
/**
 * Depouillement du socle a la publication : commentaires, indentation et
 * lignes vides retires du texte inline dans chaque page.
 *
 * Pourquoi : le socle inline pese ~470 Ko dont 53 % de commentaires, et SFMC
 * le parse a CHAQUE affichage. Mesure du 25/09 : 3,5 a 4,5 s par page avant
 * la moindre lecture CRM (socle saute par ?socle_fetch=1 : 4 a 5,7 s de GET
 * pour 0 ms d'execution). Le texte publie n'est pas le texte lu par les
 * humains : les sources restent commentees, seule la copie publiee maigrit.
 *
 * Regles, volontairement conservatrices (aucune analyse syntaxique) :
 *   - un commentaire bloc qui OUVRE une ligne (`  /* ... *\/`) est retire,
 *     meme sur plusieurs lignes ; un commentaire en fin de ligne de code est
 *     garde (il peut suivre une chaine, on ne prend pas le risque) ;
 *   - un commentaire bloc portant un marqueur `==NOM==` est reduit a son
 *     marqueur : scripts/verif-socle-deploye.js et les tests s'en servent
 *     pour reconnaitre le code deploye ;
 *   - un commentaire bloc DANS un <script runat="server"> est garde : leur
 *     retrait declenche un bug de l'analyseur SFMC (voir reglesEnv) ;
 *   - une ligne qui commence par `//` est retiree (JS) ; en AMPscript une
 *     telle ligne n'existe pas ;
 *   - l'indentation et les lignes vides sont retirees.
 * Ce que ca suppose : aucune chaine litterale ne s'etale sur plusieurs lignes
 * et aucune ligne de chaine ne commence par un `/*` ou `//` — vrai dans le
 * socle (ES5 pour Jint, pas de gabarits). Les tests (test-depouillement.js)
 * rejouent la cascade navigateur sur le texte depouille.
 */

/* Grammaire d'un commentaire bloc : tout sauf « *\/ » (et non un `[\s\S]*?`
   non gourmand, qui, devant un commentaire ferme sur une ligne de code,
   continuait jusqu'au commentaire SUIVANT et avalait le code entre les deux —
   constate le 25/09, pages mortes). */
const RE_BLOC_EN_TETE = /^[ \t]*\/\*(?:[^*]|\*(?!\/))*\*\/[ \t]*(?:\r?\n|$)/gm;
const RE_MARQUEUR = /==[A-Z_]+==/;

function depouiller(texte, regles) {
    /* `regles` : sous-ensemble { blocs, lignes, blancs, horsSsjs } — tout par
       defaut (SFMC_SOCLE_DEPOUILLE_REGLES=blocs,lignes,blancs pour n'en
       garder qu'une partie, diagnostic). */
    const r = regles || reglesEnv();
    let t = String(texte == null ? '' : texte);
    if (r.blocs && r.horsSsjs) {
        /* Commentaires retires seulement HORS des blocs SSJS serveur. */
        t = t.split(/(<script[^>]*runat=["']server["'][^>]*>[\s\S]*?<\/script>)/i)
            .map((seg, i) => (i % 2 === 1 ? seg : depouiller(seg, { blocs: true, lignes: false, blancs: false })))
            .join('');
    } else if (r.blocs) {
        t = t.replace(RE_BLOC_EN_TETE, (bloc) => {
            const m = RE_MARQUEUR.exec(bloc);
            return m ? `/* ${m[0]} */\n` : '';
        });
    }
    const lignes = [];
    for (const brute of t.split(/\r?\n/)) {
        const l = r.blancs ? brute.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '') : brute;
        if (r.blancs && !l) continue;
        if (r.lignes && l.replace(/^[ \t]+/, '').startsWith('//')) continue;
        lignes.push(l);
    }
    return lignes.join('\n') + '\n';
}

function reglesEnv() {
    const v = String(process.env.SFMC_SOCLE_DEPOUILLE_REGLES || '').trim();
    /* Les commentaires ne sont retires QUE hors des blocs SSJS serveur. Les
       retirer aussi dans ces blocs declenche un bug de l'analyseur SFMC au
       chargement de la page (« An error occurred when attempting to parse
       HtmlEmailBody content » / System.ArgumentOutOfRangeException : Index
       and length must refer to a location within the string), reproduit le
       25/09 sur Interne_CAND_EFAP_V0 avec une combinaison de trois
       commentaires d'une ligne, sans logique visible (ni nombre de lignes, ni
       apostrophes). Hors SSJS, tout passe : 470 Ko → 178 Ko.
       SFMC_SOCLE_DEPOUILLE_HORS_SSJS=false pour retenter un jour. */
    const horsSsjs = String(process.env.SFMC_SOCLE_DEPOUILLE_HORS_SSJS || 'true').trim().toLowerCase() !== 'false';
    if (!v) return { blocs: true, lignes: true, blancs: true, horsSsjs };
    const set = new Set(v.split(',').map((x) => x.trim()));
    return { blocs: set.has('blocs'), lignes: set.has('lignes'), blancs: set.has('blancs'), horsSsjs };
}

/** Actif a la publication (scripts/generer-lp.mjs le pose), jamais dans les tests par defaut. */
function depouillementActif() {
    return String(process.env.SFMC_SOCLE_DEPOUILLE || '').trim().toLowerCase() === 'true';
}

module.exports = { depouiller, depouillementActif };
