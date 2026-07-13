/**
 * Mise en file de la synchronisation SFMC, partagée par server.js (local/Docker)
 * et api/router.js (Vercel).
 *
 * Un job est créé dans integration_jobs puis traité par le cron worker
 * (api/cron.js) : c'est là que les images inline sont publiées dans SFMC et
 * remplacées par leur URL publique avant l'envoi de la page.
 *
 * Si la table integration_jobs est absente (environnement sans file), le même
 * traitement est exécuté immédiatement en fallback.
 */
const { supabaseRequest } = require('./api-shared');
const { cleanHtmlForSfmc } = require('./htmlCleaner');
const { syncProjectToSfmc, isSfmcConfigured, replaceInlineImagesWithSfmcUrls } = require('./sfmc');
const { syncLegacyProjectToContent, isMissingContentSchemaError } = require('../api/content');

async function enqueueOrProcessInline({ projectName, fullHtml, css, projectData, properties, source }) {
    try {
        await supabaseRequest('POST', '/integration_jobs', {
            target:       'sfmc',
            action:       'sync_project',
            status:       'pending',
            payload:      { projectName, html: fullHtml },
            metadata:     { source, enqueuedBy: 'sfmc-sync' },
            scheduled_at: new Date().toISOString()
        });
        return { skipped: false, action: 'queued' };
    } catch (e) {
        if (!isMissingContentSchemaError(e)) {
            console.error('Failed to create integration job:', e.message);
            return { skipped: false, action: 'job_failed', error: e.message };
        }
        // ── Fallback local : table absente, mêmes étapes que le cron worker ──
        console.warn('⚠️  [FALLBACK] integration_jobs absente — traitement synchrone en cours...');
        try {
            let cleaned = cleanHtmlForSfmc(fullHtml);
            if (isSfmcConfigured()) {
                cleaned = await replaceInlineImagesWithSfmcUrls(cleaned, projectName);
            }
            await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
                html_sfmc: cleaned
            });
            await syncLegacyProjectToContent({ projectName, html: fullHtml, html_sfmc: cleaned, css, projectData, properties });
            if (isSfmcConfigured()) await syncProjectToSfmc({ projectName, fullHtml: cleaned });
            return { skipped: false, action: 'processed_inline' };
        } catch (syncErr) {
            console.error('Inline processing failed:', syncErr.message);
            return { skipped: false, action: 'inline_failed', error: syncErr.message };
        }
    }
}

module.exports = { enqueueOrProcessInline };
