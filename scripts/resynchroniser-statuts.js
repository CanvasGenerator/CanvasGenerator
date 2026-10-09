#!/usr/bin/env node
/**
 * Resynchronise le statut de publication des pages avec la RÉALITÉ SFMC.
 *
 * Contexte (09/10/2026) : la publication n'écrivait le statut que dans
 * Projects.properties, et chaque enregistrement le remettait à « draft » ;
 * le tableau de bord, lui, lit pages.status. Résultat : les pages en ligne
 * s'affichaient « Brouillon ». Le code est corrigé (lib/statut-page.js) ; ce
 * script rattrape les pages EXISTANTES, une fois.
 *
 * Règle, page par page (pages hors corbeille) :
 *   • asset présent dans SFMC (clé exacte)          → published (Publiée)
 *   • absent, mais déjà marquée publiée/dépubliée   → unpublished (Dépubliée)
 *   • sinon                                         → draft (Brouillon)
 *
 * Par défaut : SIMULATION, rien n'est écrit (rapport seulement).
 *   node scripts/resynchroniser-statuts.js
 *   node scripts/resynchroniser-statuts.js --appliquer     ← écrit en base
 *
 * Lecture seule côté SFMC (aucun asset créé, modifié ni supprimé).
 */
require('dotenv').config({ quiet: true });
const { supabaseRequest } = require('../lib/supabase');
const { findAssetIdByCustomerKey, isSfmcConfigured } = require('../lib/sfmc');
const { resolveSfmcNaming, legacySfmcKey } = require('../lib/lp-naming');

const APPLIQUER = process.argv.includes('--appliquer');

async function main() {
    if (!isSfmcConfigured()) {
        console.error('SFMC non configuré : impossible de vérifier les pages en ligne.');
        process.exit(1);
    }
    const projets = await supabaseRequest('GET', '/Projects?select=project_name,properties') || [];
    const pages = await supabaseRequest('GET', '/pages?select=id,status,metadata&status=neq.deleted') || [];
    // Nom EXACT : « Candidature__FR » et « candidature__FR » sont deux pages.
    const pageParNom = new Map(pages
        .filter(p => p.metadata && p.metadata.legacyProjectName)
        .map(p => [p.metadata.legacyProjectName, p]));

    const lignes = [];
    for (const projet of projets) {
        const nom = projet.project_name;
        const props = projet.properties || {};
        if (props.status === 'deleted' || props.status === 'archived') continue;
        const page = pageParNom.get(nom);
        if (!page) continue;   // à la corbeille côté structuré, ou jamais migrée

        const naming = await resolveSfmcNaming(nom, props);
        let enLigne = naming.customerKey ? await findAssetIdByCustomerKey(naming.customerKey) : null;
        const legacy = legacySfmcKey(nom);
        if (!enLigne && legacy && legacy !== naming.customerKey) enLigne = await findAssetIdByCustomerKey(legacy);

        const avant = page.status || 'draft';
        const dejaPubliee = props.status === 'published' || props.status === 'unpublished' || avant === 'published' || avant === 'unpublished';
        const apres = enLigne ? 'published' : (dejaPubliee ? 'unpublished' : 'draft');
        lignes.push({ nom, cle: naming.customerKey, avant, avantProjects: props.status || 'draft', apres, enLigne: !!enLigne, pageId: page.id, props });
    }

    const changes = lignes.filter(l => l.avant !== l.apres || l.avantProjects !== l.apres);
    const compte = s => lignes.filter(l => l.apres === s).length;
    console.log(`Pages vérifiées : ${lignes.length}`);
    console.log(`  → Publiées : ${compte('published')} | Dépubliées : ${compte('unpublished')} | Brouillons : ${compte('draft')}`);
    console.log(`Statuts à corriger : ${changes.length}`);
    changes.forEach(l => console.log(`  ${l.nom.padEnd(52)} tableau de bord : ${l.avant.padEnd(11)} → ${l.apres}${l.enLigne ? '   (en ligne : ' + l.cle + ')' : ''}`));

    if (!APPLIQUER) {
        console.log('\nSIMULATION : rien n\'a été écrit. Relancer avec --appliquer pour corriger.');
        return;
    }
    let ok = 0;
    for (const l of changes) {
        // Relire juste avant d'écrire : ne pas écraser un enregistrement récent.
        const frais = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(l.nom)}&select=properties&limit=1`);
        const props = { ...((frais && frais[0] && frais[0].properties) || l.props), status: l.apres };
        await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(l.nom)}`, { properties: props });
        await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(l.pageId)}`, { status: l.apres });
        ok++;
    }
    console.log(`\n${ok} statut(s) corrigé(s).`);
}

main().catch(e => { console.error('Échec :', e.message); process.exit(1); });
