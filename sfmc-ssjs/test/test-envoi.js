/**
 * ============================================================================
 *  TESTS DE L'ENVOI AU SOCLE D'ECRITURE
 * ============================================================================
 *  Le socle ne renvoie pas de JSON : il laisse son bilan en commentaire HTML
 *  dans la page. C'est le SEUL signal disponible, et l'interpreter de travers
 *  ferait annoncer un succes sur une soumission perdue.
 *
 *  Le cas qui compte le plus est le dernier : AMPscript n'a pas de try/catch,
 *  une ecriture refusee remplace la page ENTIERE, commentaire compris.
 *  L'absence de marqueur est donc un echec, jamais un imprevu.
 * ============================================================================
 */
'use strict';
const path = require('node:path');

let ok = 0; const echecs = [];
function test(nom, fn) { try { fn(); ok++; } catch (e) { echecs.push(`${nom}\n      ${e.message}`); } }
function egal(a, b, quoi) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        throw new Error(`${quoi}\n      obtenu  : ${JSON.stringify(a)}\n      attendu : ${JSON.stringify(b)}`);
    }
}
function vrai(c, msg) { if (!c) throw new Error(msg); }

const SRC = path.join(__dirname, '..', '..', 'blocks', 'forms', 'shared', 'envoi-socle.js');

(async () => {
    const { lireBilan, socleEstPresent, soumettre, envoyerAuSocle } = await import('file://' + SRC);

    test('Un bilan de succes est reconnu', () => {
        const html = '<p>merci</p><!-- socle ecriture: statut=success pa=001AW0001 nouveau=true '
                   + 'journal= CP:email-cree CPC:Email CM:cree -->';
        const b = lireBilan(html);
        vrai(b.ok, 'succes non reconnu');
        egal(b.statut, 'success', 'statut');
        egal(b.journal, 'CP:email-cree CPC:Email CM:cree', 'journal');
    });

    test('Un bilan d erreur porte le message du socle', () => {
        const html = '<!-- socle ecriture: statut=error pa= nouveau=false journal= -->\n'
                   + "<!-- socle erreur: Prenom obligatoire : l'org refuse la creation -->";
        const b = lireBilan(html);
        vrai(!b.ok, 'erreur prise pour un succes');
        vrai(/Prenom obligatoire/.test(b.message), `message perdu : ${b.message}`);
    });

    test('Page sans marqueur = ECHEC [REGRESSION]', () => {
        /* AMPscript n a pas de try/catch : une ecriture refusee remplace la
           page entiere. C est exactement ce que renvoie SFMC dans ce cas. */
        const b = lireBilan('The page content contains errors and cannot be processed.');
        vrai(!b.ok, 'page morte prise pour un succes');
        egal(b.statut, 'inconnu', 'statut');
        vrai(b.message.length > 0, 'aucun message pour l utilisateur');
    });

    test('Reponse vide = echec', () => {
        vrai(!lireBilan('').ok, 'reponse vide prise pour un succes');
        vrai(!lireBilan(null).ok, 'reponse nulle prise pour un succes');
    });

    test('Sans socle sur la page, on simule — le builder doit rester utilisable', () => {
        vrai(socleEstPresent({ defaultView: {} }) === false, 'socle detecte a tort');
        vrai(socleEstPresent({ defaultView: { SOCLE_DATA: {} } }) === true, 'socle non detecte');
    });

    await (async () => {
        const nom = 'La simulation ne poste rien';
        try {
            let poste = false;
            const doc = { defaultView: { fetch: () => { poste = true; }, location: { href: 'http://builder' } } };
            const res = await soumettre({ EmailAddress: 'a@b.c' }, doc, { delaiSimulation: 0 });
            vrai(res.ok, 'simulation en echec');
            egal(res.statut, 'simule', 'statut de simulation');
            vrai(!poste, 'le builder a poste pour de vrai');
            ok++;
        } catch (e) { echecs.push(`${nom}\n      ${e.message}`); }
    })();

    await (async () => {
        const nom = 'Le POST part sur la page courante, avec submitted=true';
        try {
            let vu = null;
            const doc = {
                defaultView: {
                    SOCLE_DATA: {},
                    location: { href: 'https://cloud.example/landingpage?id=X&campus=lyon' },
                    fetch: (url, opts) => {
                        vu = { url, opts };
                        return Promise.resolve({
                            ok: true, status: 200,
                            text: () => Promise.resolve('<!-- socle ecriture: statut=success pa=001 nouveau=true journal= CM:cree -->'),
                        });
                    },
                },
            };
            const res = await envoyerAuSocle({ EmailAddress: 'a@b.c', LastName: 'Dupont & Fils' }, doc);
            vrai(res.ok, 'succes non remonte');
            egal(vu.url, 'https://cloud.example/landingpage?id=X&campus=lyon',
                 'la query string doit survivre : le socle de lecture la relit');
            egal(vu.opts.method, 'POST', 'methode');
            vrai(/(^|&)submitted=true(&|$)/.test(vu.opts.body), `submitted absent : ${vu.opts.body}`);
            vrai(/LastName=Dupont%20%26%20Fils/.test(vu.opts.body),
                 `valeur mal encodee : ${vu.opts.body}`);
            ok++;
        } catch (e) { echecs.push(`${nom}\n      ${e.message}`); }
    })();

    await (async () => {
        const nom = 'Un fetch qui echoue ne passe pas pour un succes';
        try {
            const doc = {
                defaultView: {
                    SOCLE_DATA: {}, location: { href: 'https://cloud.example/p' },
                    fetch: () => Promise.reject(new Error('reseau coupe')),
                },
            };
            const res = await envoyerAuSocle({}, doc);
            vrai(!res.ok, 'echec reseau pris pour un succes');
            vrai(/reseau coupe/.test(res.message), `message perdu : ${res.message}`);
            ok++;
        } catch (e) { echecs.push(`${nom}\n      ${e.message}`); }
    })();

    console.log(`\n  ${ok} test(s) passe(s), ${echecs.length} echec(s)\n`);
    if (echecs.length) { echecs.forEach((e) => console.error('  ✗ ' + e + '\n')); process.exit(1); }
})();
