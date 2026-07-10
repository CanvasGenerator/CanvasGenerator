const { supabaseRequest } = require('../lib/api-shared');
const { syncProjectToSfmc, isSfmcConfigured } = require('../lib/sfmc');
const { cleanHtmlForSfmc } = require('../lib/htmlCleaner');
const { syncLegacyProjectToContent } = require('./content');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Fetch pending jobs (process max 5 at a time to avoid timeout)
        const jobs = await supabaseRequest(
            'GET',
            '/integration_jobs?status=eq.pending&target=eq.sfmc&limit=5&order=created_at.asc'
        );

        if (!jobs || jobs.length === 0) {
            return res.status(200).json({ message: 'No pending jobs found.', results: [] });
        }

        const results = [];

        for (const job of jobs) {
            try {
                // ── 1. Marquer comme "en cours" ──────────────────────────────────
                await supabaseRequest('PATCH', `/integration_jobs?id=eq.${job.id}`, {
                    status:     'processing',
                    updated_at: new Date().toISOString()
                });

                if (job.action === 'sync_project') {
                    // ── 2. Récupérer le projet depuis la BD ───────────────────────
                    const projectName = job.payload?.projectName;
                    if (!projectName) throw new Error('Missing projectName in payload');

                    // Toujours charger le projet pour css/project_data/properties
                    const projectRes = await supabaseRequest(
                        'GET',
                        `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=*&limit=1`
                    );
                    const project = projectRes && projectRes[0];
                    if (!project) throw new Error(`Project ${projectName} not found`);

                    // Utiliser le HTML embarqué dans le payload en priorité (évite que la re-lecture
                    // depuis la BD retourne une version périmée si le PATCH n'est pas encore visible)
                    const htmlSource = job.payload?.html ? 'payload' : 'db';
                    const rawHtml = job.payload?.html || project.html || '';

                    // ── 3. Nettoyage lourd du HTML pour SFMC (Cheerio) ────────────
                    console.log(`\n🧹 [CRON] Nettoyage HTML pour "${projectName}" (source: ${htmlSource})...`);
                    const cleanedHtml = cleanHtmlForSfmc(rawHtml);
                    console.log(`✅ [CRON] Nettoyage terminé (${rawHtml.length} → ${cleanedHtml.length} octets)`);

                    // ── 4. Mettre à jour html_sfmc dans la table Projects ─────────
                    await supabaseRequest(
                        'PATCH',
                        `/Projects?project_name=eq.${encodeURIComponent(projectName)}`,
                        { html_sfmc: cleanedHtml }
                    );

                    // ── 5. Synchroniser vers les tables structurées (pages/versions) ──
                    console.log(`📦 [CRON] Synchronisation vers les tables structurées...`);
                    await syncLegacyProjectToContent({
                        projectName,
                        html:        rawHtml,
                        html_sfmc:   cleanedHtml,
                        css:         project.css || '',
                        projectData: project.project_data,
                        properties:  project.properties || {}
                    });

                    // ── 6. Envoi vers Salesforce Marketing Cloud ──────────────────
                    if (isSfmcConfigured()) {
                        console.log(`☁️  [CRON] Envoi vers SFMC...`);
                        await syncProjectToSfmc({ projectName, fullHtml: cleanedHtml });
                    } else {
                        console.log(`⏭️  [CRON] SFMC non configuré, envoi ignoré.`);
                    }

                } else if (job.action === 'publish_page') {
                    // ── Action "publish_page" : synchronisation d'une page publiée ──
                    const { pageId, versionId } = job.payload || {};
                    const versionRes = await supabaseRequest(
                        'GET',
                        // Ne pas sélectionner html_sfmc : la colonne n'existe pas dans page_versions
                        `/page_versions?id=eq.${versionId}&select=html&limit=1`
                    );
                    const version = versionRes && versionRes[0];
                    if (!version) throw new Error(`Version ${versionId} not found`);

                    // Toujours nettoyer depuis le html brut
                    const htmlToSend = version.html
                        ? cleanHtmlForSfmc(version.html)
                        : '';
                    console.log(`\n🧹 [CRON] Nettoyage HTML pour la version publiée (page: ${pageId})`);

                    const legacyProjectName = job.metadata?.legacyProjectName;
                    const name = legacyProjectName || `page-${pageId}`;

                    if (isSfmcConfigured()) {
                        console.log(`☁️  [CRON] Publication SFMC pour "${name}"...`);
                        await syncProjectToSfmc({ projectName: name, fullHtml: htmlToSend });
                    }
                }

                // ── 7. Marquer le job comme terminé ──────────────────────────────
                await supabaseRequest('PATCH', `/integration_jobs?id=eq.${job.id}`, {
                    status:     'completed',
                    updated_at: new Date().toISOString()
                });

                results.push({ id: job.id, action: job.action, status: 'completed' });
                console.log(`✅ [CRON] Job ${job.id} (${job.action}) traité avec succès.`);

            } catch (err) {
                console.error(`❌ [CRON] Échec du job ${job.id}:`, err.message, err.payload || '');
                await supabaseRequest('PATCH', `/integration_jobs?id=eq.${job.id}`, {
                    status:     'failed',
                    metadata:   { ...(job.metadata || {}), error: err.message, errorDetail: err.payload || null },
                    updated_at: new Date().toISOString()
                });
                results.push({ id: job.id, action: job.action, status: 'failed', error: err.message });
            }
        }

        return res.status(200).json({ message: 'Processed jobs', results });

    } catch (e) {
        console.error('❌ [CRON] Erreur générale:', e);
        return res.status(500).json({ error: e.message });
    }
};
