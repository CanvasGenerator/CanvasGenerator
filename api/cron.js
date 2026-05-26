const { supabaseRequest } = require('../lib/api-shared');
const { syncProjectToSfmc } = require('../lib/sfmc');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Fetch pending jobs for SFMC (process max 5 at a time to avoid timeout)
        const jobs = await supabaseRequest('GET', '/integration_jobs?status=eq.pending&target=eq.sfmc&limit=5&order=created_at.asc');
        
        if (!jobs || jobs.length === 0) {
            return res.status(200).json({ message: 'No pending jobs found.', results: [] });
        }

        const results = [];

        for (const job of jobs) {
            try {
                // Mark as processing
                await supabaseRequest('PATCH', `/integration_jobs?id=eq.${job.id}`, { 
                    status: 'processing', 
                    updated_at: new Date().toISOString() 
                });
                
                if (job.action === 'sync_project') {
                    const projectName = job.payload?.projectName;
                    if (!projectName) throw new Error('Missing projectName in payload');

                    const projectRes = await supabaseRequest('GET', `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=html_sfmc,html&limit=1`);
                    const project = projectRes && projectRes[0];
                    if (!project) throw new Error(`Project ${projectName} not found`);

                    const fullHtml = project.html_sfmc || project.html || '';
                    await syncProjectToSfmc({ projectName, fullHtml });
                } 
                else if (job.action === 'publish_page') {
                    const { pageId, versionId } = job.payload || {};
                    const versionRes = await supabaseRequest('GET', `/page_versions?id=eq.${versionId}&select=html,html_sfmc&limit=1`);
                    const version = versionRes && versionRes[0];
                    if (!version) throw new Error(`Version ${versionId} not found`);

                    const fullHtml = version.html_sfmc || version.html || '';
                    const legacyProjectName = job.metadata?.legacyProjectName;
                    const name = legacyProjectName || `page-${pageId}`;
                    await syncProjectToSfmc({ projectName: name, fullHtml });
                }

                // Mark as completed
                await supabaseRequest('PATCH', `/integration_jobs?id=eq.${job.id}`, { 
                    status: 'completed', 
                    updated_at: new Date().toISOString() 
                });
                
                results.push({ id: job.id, status: 'completed' });

            } catch (err) {
                console.error(`Failed to process job ${job.id}:`, err.message);
                await supabaseRequest('PATCH', `/integration_jobs?id=eq.${job.id}`, { 
                    status: 'failed', 
                    metadata: { ...(job.metadata || {}), error: err.message },
                    updated_at: new Date().toISOString() 
                });
                results.push({ id: job.id, status: 'failed', error: err.message });
            }
        }

        return res.status(200).json({ message: 'Processed jobs', results });

    } catch (e) {
        console.error('Cron Error:', e);
        return res.status(500).json({ error: e.message });
    }
};
