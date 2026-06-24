const { supabaseRequest, getQueryParam, requireField, slugify } = require('../lib/api-shared');
const { readSchoolsForApi } = require('./schools');

const DEFAULT_ORGANIZATION = {
    name: 'Reetain Holding',
    slug: 'reetain-holding'
};

function selectEndpoint(table, params = {}) {
    const query = new URLSearchParams({ select: '*' });
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    return `/${table}?${query.toString()}`;
}

async function insert(table, payload) {
    const result = await supabaseRequest('POST', `/${table}`, payload, {
        'Prefer': 'return=representation'
    });
    return Array.isArray(result) ? result[0] : result;
}

async function upsert(table, conflictColumn, payload) {
    const result = await supabaseRequest('POST', `/${table}?on_conflict=${conflictColumn}`, payload, {
        'Prefer': 'resolution=merge-duplicates,return=representation'
    });
    return Array.isArray(result) ? result[0] : result;
}

function parseLegacyProjectName(projectName = '') {
    const match = String(projectName).match(/^school-([a-z0-9-]+)__(.+?)(?:__([A-Z]{2}))?$/i);
    if (!match) return null;
    return {
        schoolId: match[1].toLowerCase(),
        title: match[2],
        language: (match[3] || 'FR').toUpperCase()
    };
}

function parseProjectData(value) {
    if (!value) return {};
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); }
    catch {
        return { raw: value };
    }
}

function isMissingContentSchemaError(error) {
    const message = String(error?.message || '');
    return error?.status === 404
        || error?.code === '42P01'
        || /could not find the table|does not exist|schema cache/i.test(message);
}

function isMissingColumnError(error, columnName) {
    const message = [
        error?.payload?.code,
        error?.payload?.message,
        error?.payload?.details,
        error?.message
    ].filter(Boolean).join(' ');

    return error?.status === 400
        && new RegExp(`\\b${columnName}\\b`, 'i').test(message)
        && /column|schema cache|could not find/i.test(message);
}

function isValidRedirectUrl(value = '') {
    if (!value) return true;
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function getPublicationSettings(page = {}) {
    const publication = page.metadata?.publication || {};
    return {
        active: publication.active !== false,
        redirectUrl: publication.redirectUrl || '',
        updatedAt: publication.updatedAt || null,
        note: publication.note || ''
    };
}

function normalizeBaseUrl(value = '') {
    return String(value || '').trim().replace(/\/+$/, '');
}

function buildPublicPagePath({ slug = '', language = 'FR' } = {}) {
    const cleanSlug = slugify(slug) || 'page';
    const lang = String(language || 'FR').toLowerCase();
    return lang && lang !== 'fr' ? `/${lang}/${cleanSlug}` : `/${cleanSlug}`;
}

function buildPublicPageUrl({ baseUrl = '', slug = '', language = 'FR' } = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl) return '';
    return `${normalizedBaseUrl}${buildPublicPagePath({ slug, language })}`;
}

function parsePublicBaseUrl(baseUrl = '') {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) return null;
    try {
        const url = new URL(normalized);
        return {
            host: url.host.toLowerCase(),
            pathPrefix: url.pathname.replace(/\/+$/, '')
        };
    } catch {
        return null;
    }
}

async function findOne(table, filters = {}) {
    const params = new URLSearchParams({ select: '*', limit: '1' });
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, `eq.${value}`);
    });
    const result = await supabaseRequest('GET', `/${table}?${params.toString()}`);
    return Array.isArray(result) && result.length ? result[0] : null;
}

async function ensureDefaultOrganization() {
    const existing = await findOne('organizations', { slug: DEFAULT_ORGANIZATION.slug });
    if (existing) return existing;
    return insert('organizations', {
        name: DEFAULT_ORGANIZATION.name,
        slug: DEFAULT_ORGANIZATION.slug,
        metadata: { source: 'legacy-migration' }
    });
}

async function ensureEntityForSchool(organization, schoolId) {
    const schools = await readSchoolsForApi();
    const school = schools.find(item => item.id === schoolId) || {};
    const slug = slugify(schoolId);
    const existing = await findOne('entities', {
        organization_id: organization.id,
        slug
    });
    if (existing) return existing;

    return insert('entities', {
        organization_id: organization.id,
        name: school.name || schoolId.toUpperCase(),
        slug,
        type: 'school',
        description: school.description || '',
        contact: school.contact || '',
        base_url: school.baseUrl || '',
        brand: {
            color: school.color || '#3b82f6',
            secondaryColor: school.secondaryColor || '#1a1a1a',
            emoji: school.emoji || '🏫'
        },
        metadata: {
            legacySchoolId: schoolId,
            source: 'legacy-migration'
        }
    });
}

async function ensureLegacyFolder(entity) {
    const slug = 'legacy-projects';
    const existing = await findOne('folders', {
        entity_id: entity.id,
        slug
    });
    if (existing) return existing;

    return insert('folders', {
        entity_id: entity.id,
        parent_id: null,
        name: 'Legacy Projects',
        slug,
        sort_order: 0,
        metadata: { source: 'legacy-migration' }
    });
}

async function findPageByLegacyProjectName(projectName) {
    const result = await supabaseRequest(
        'GET',
        `/pages?metadata->>legacyProjectName=eq.${encodeURIComponent(projectName)}&select=*&limit=1`
    );
    return Array.isArray(result) && result.length ? result[0] : null;
}

async function buildUniquePageSlug(entityId, folderId, language, title, projectName) {
    const baseSlug = slugify(title) || 'page';
    const result = await supabaseRequest(
        'GET',
        `/pages?entity_id=eq.${encodeURIComponent(entityId)}&folder_id=eq.${encodeURIComponent(folderId)}&language=eq.${encodeURIComponent(language)}&select=slug`
    );
    const existingSlugs = new Set((Array.isArray(result) ? result : []).map(page => page.slug));
    if (!existingSlugs.has(baseSlug)) return baseSlug;

    const projectSlug = slugify(projectName) || baseSlug;
    let candidate = `${baseSlug}-${projectSlug}`;
    let index = 2;

    while (existingSlugs.has(candidate)) {
        candidate = `${baseSlug}-${projectSlug}-${index}`;
        index += 1;
    }

    return candidate;
}

async function createVersionForPage(page, legacyProject, versionNumber = null) {
    const existing = await supabaseRequest(
        'GET',
        `/page_versions?page_id=eq.${encodeURIComponent(page.id)}&select=version_number&order=version_number.desc&limit=1`
    );
    const nextVersionNumber = versionNumber || ((existing?.[0]?.version_number || 0) + 1);
    const projectData = parseProjectData(legacyProject.project_data);

    const version = await insert('page_versions', {
        page_id: page.id,
        version_number: nextVersionNumber,
        html: legacyProject.html || '',
        html_sfmc: legacyProject.html_sfmc || '',
        css: legacyProject.css || '',
        project_data: projectData,
        change_summary: legacyProject.change_summary || 'Legacy project snapshot',
        metadata: {
            source: 'legacy-projects',
            legacyProjectName: legacyProject.project_name
        }
    });

    await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(page.id)}`, {
        current_version_id: version.id,
        updated_at: new Date().toISOString()
    });

    return version;
}

async function migrateLegacyProject(legacyProject, options = {}) {
    const parsed = parseLegacyProjectName(legacyProject.project_name);
    if (!parsed) return { skipped: true, reason: 'unsupported_project_name', projectName: legacyProject.project_name };

    const organization = await ensureDefaultOrganization();
    const entity = await ensureEntityForSchool(organization, parsed.schoolId);
    const folder = await ensureLegacyFolder(entity);
    let page = await findPageByLegacyProjectName(legacyProject.project_name);
    let createdPage = false;

    if (!page) {
        const title = legacyProject.properties?.title || parsed.title;
        const pageSlug = await buildUniquePageSlug(
            entity.id,
            folder.id,
            parsed.language,
            title,
            legacyProject.project_name
        );

        page = await insert('pages', {
            entity_id: entity.id,
            folder_id: folder.id,
            title,
            slug: pageSlug,
            language: parsed.language,
            status: legacyProject.properties?.status || 'draft',
            seo: {
                title: legacyProject.properties?.seoTitle || '',
                description: legacyProject.properties?.seoDescription || '',
                keywords: legacyProject.properties?.keywords || '',
                canonical: legacyProject.properties?.canonical || '',
                schemaLd: legacyProject.properties?.schemaLd || ''
            },
            metadata: {
                source: 'legacy-projects',
                legacyProjectName: legacyProject.project_name,
                migratedAt: new Date().toISOString()
            }
        });
        createdPage = true;
    } else if (options.updatePageMetadata) {
        await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(page.id)}`, {
            title: legacyProject.properties?.title || page.title,
            seo: {
                ...(page.seo || {}),
                title: legacyProject.properties?.seoTitle || page.seo?.title || '',
                description: legacyProject.properties?.seoDescription || page.seo?.description || ''
            },
            updated_at: new Date().toISOString()
        });
    }

    let version = null;
    if (createdPage || !options.skipExistingVersions) {
        version = await createVersionForPage(page, legacyProject);
    }

    return {
        skipped: false,
        projectName: legacyProject.project_name,
        organizationId: organization.id,
        entityId: entity.id,
        folderId: folder.id,
        pageId: page.id,
        versionId: version?.id || page.current_version_id || null,
        versionSkipped: !version
    };
}

async function syncLegacyProjectToContent({ projectName, html, html_sfmc, css, projectData, properties }) {
    try {
        return await migrateLegacyProject({
            project_name: projectName,
            html,
            html_sfmc,
            css,
            project_data: projectData,
            properties: properties || {},
            change_summary: 'Saved from legacy builder'
        }, { updatePageMetadata: true });
    } catch (e) {
        return {
            skipped: true,
            reason: 'content_sync_failed',
            error: e.message,
            code: e.code,
            status: e.status
        };
    }
}

async function listMigratedDashboardPages() {
    const pages = await supabaseRequest(
        'GET',
        '/pages?select=*&order=updated_at.desc'
    );
    const entities = await supabaseRequest(
        'GET',
        '/entities?select=id,name,slug,base_url,metadata'
    );
    const entityMap = new Map((Array.isArray(entities) ? entities : []).map(entity => [entity.id, entity]));

    return (Array.isArray(pages) ? pages : [])
        .filter(page => page.metadata?.legacyProjectName)
        .map(page => {
            const entity = entityMap.get(page.entity_id) || {};
            const legacyProjectName = page.metadata.legacyProjectName;
            const parsed = parseLegacyProjectName(legacyProjectName);
            const language = page.language || parsed?.language || 'FR';
            const publicPath = buildPublicPagePath({ slug: page.slug, language });
            const publicUrl = buildPublicPageUrl({
                baseUrl: entity.base_url || '',
                slug: page.slug,
                language
            });

            return {
                project_name: legacyProjectName,
                title: page.title || parsed?.title || legacyProjectName,
                school: (entity.metadata?.legacySchoolId || parsed?.schoolId || entity.slug || entity.name || '—').toUpperCase(),
                lang: language,
                seoTitle: page.seo?.title || '',
                updated_at: page.updated_at || page.created_at,
                source: 'content',
                page_id: page.id,
                entity_id: page.entity_id,
                folder_id: page.folder_id,
                slug: page.slug,
                public_path: publicPath,
                public_url: publicUrl,
                base_url: entity.base_url || '',
                status: page.status,
                publication: getPublicationSettings(page)
            };
        });
}

async function getCurrentVersionForLegacyProject(projectName) {
    const page = await findPageByLegacyProjectName(projectName);
    if (!page?.current_version_id) return null;

    const result = await supabaseRequest(
        'GET',
        `/page_versions?id=eq.${encodeURIComponent(page.current_version_id)}&select=*&limit=1`
    );
    const version = Array.isArray(result) && result.length ? result[0] : null;
    if (!version) return null;

    return { page, version };
}

function projectResponseFromStructuredPage(projectName, page, version) {
    const seo = page.seo || {};
    return {
        project_name: projectName,
        html: version.html || '',
        html_sfmc: version.html_sfmc || '',
        css: version.css || '',
        project_data: version.project_data || {},
        properties: {
            title: page.title || '',
            description: page.description || '',
            seoTitle: seo.title || '',
            seoDescription: seo.description || '',
            keywords: seo.keywords || '',
            canonical: seo.canonical || '',
            schemaLd: seo.schemaLd || ''
        },
        page_id: page.id,
        current_version_id: page.current_version_id,
        source: 'content'
    };
}

async function getStructuredProjectForLegacyProject(projectName) {
    const structured = await getCurrentVersionForLegacyProject(projectName);
    if (!structured) return null;
    return projectResponseFromStructuredPage(projectName, structured.page, structured.version);
}

async function getContentSchemaStatus() {
    const checks = [
        ['organizations', '/organizations?select=id&limit=1'],
        ['entities', '/entities?select=id&limit=1'],
        ['folders', '/folders?select=id&limit=1'],
        ['pages', '/pages?select=id&limit=1'],
        ['page_versions', '/page_versions?select=id&limit=1'],
        ['integration_jobs', '/integration_jobs?select=id&limit=1']
    ];
    const tables = {};

    for (const [name, endpoint] of checks) {
        try {
            await supabaseRequest('GET', endpoint);
            tables[name] = { available: true };
        } catch (e) {
            tables[name] = {
                available: false,
                expectedMissing: isMissingContentSchemaError(e),
                error: e.message,
                status: e.status,
                code: e.code
            };
        }
    }

    const installed = Object.values(tables).every(table => table.available);
    return {
        installed,
        mode: installed ? 'structured' : 'legacy-only',
        tables,
        nextStep: installed
            ? 'Run POST /api/content/migrate/legacy to copy legacy Projects into the structured model.'
            : 'Apply database/scalable-schema.sql in Supabase SQL editor, then reload this status endpoint.'
    };
}

async function listOrganizations(req, res) {
    const result = await supabaseRequest('GET', '/organizations?select=*&order=name.asc');
    res.status(200).json(result || []);
}

async function saveOrganization(req, res) {
    const body = req.body || {};
    const name = requireField(body, 'name');
    const payload = {
        id: body.id,
        name,
        slug: body.slug || slugify(name),
        metadata: body.metadata || {}
    };
    const organization = body.id
        ? await upsert('organizations', 'id', payload)
        : await insert('organizations', payload);
    res.status(200).json({ organization });
}

async function listEntities(req, res) {
    const organizationId = getQueryParam(req, 'organizationId');
    const endpoint = selectEndpoint('entities', {
        organization_id: organizationId ? `eq.${organizationId}` : undefined,
        order: 'name.asc'
    });
    const result = await supabaseRequest('GET', endpoint);
    res.status(200).json(result || []);
}

async function saveEntity(req, res) {
    const body = req.body || {};
    const name = requireField(body, 'name');
    const organizationId = requireField(body, 'organization_id');
    const baseUrl = body.base_url || body.baseUrl || '';
    if (baseUrl && !isValidRedirectUrl(baseUrl)) {
        return res.status(400).json({ error: 'Base URL must start with http:// or https://' });
    }
    const payload = {
        id: body.id,
        organization_id: organizationId,
        name,
        slug: body.slug || slugify(name),
        type: body.type || 'entity',
        description: body.description || '',
        contact: body.contact || '',
        base_url: normalizeBaseUrl(baseUrl),
        brand: body.brand || {},
        metadata: body.metadata || {},
        deleted: Boolean(body.deleted)
    };
    const entity = body.id ? await upsert('entities', 'id', payload) : await insert('entities', payload);
    res.status(200).json({ entity });
}

async function listFolders(req, res) {
    const entityId = getQueryParam(req, 'entityId');
    const parentId = getQueryParam(req, 'parentId');
    const endpoint = selectEndpoint('folders', {
        entity_id: entityId ? `eq.${entityId}` : undefined,
        parent_id: parentId ? `eq.${parentId}` : undefined,
        order: 'sort_order.asc,name.asc'
    });
    const result = await supabaseRequest('GET', endpoint);
    res.status(200).json(result || []);
}

async function saveFolder(req, res) {
    const body = req.body || {};
    const name = requireField(body, 'name');
    const entityId = requireField(body, 'entity_id');
    const payload = {
        id: body.id,
        entity_id: entityId,
        parent_id: body.parent_id || null,
        name,
        slug: body.slug || slugify(name),
        sort_order: body.sort_order || 0,
        metadata: body.metadata || {}
    };
    const folder = body.id ? await upsert('folders', 'id', payload) : await insert('folders', payload);
    res.status(200).json({ folder });
}

async function listPages(req, res) {
    const entityId = getQueryParam(req, 'entityId');
    const folderId = getQueryParam(req, 'folderId');
    const status = getQueryParam(req, 'status');
    const endpoint = selectEndpoint('pages', {
        entity_id: entityId ? `eq.${entityId}` : undefined,
        folder_id: folderId ? `eq.${folderId}` : undefined,
        status: status ? `eq.${status}` : undefined,
        order: 'updated_at.desc'
    });
    const result = await supabaseRequest('GET', endpoint);
    res.status(200).json(result || []);
}

async function savePage(req, res) {
    const body = req.body || {};
    const title = requireField(body, 'title');
    const entityId = requireField(body, 'entity_id');
    const payload = {
        id: body.id,
        entity_id: entityId,
        folder_id: body.folder_id || null,
        title,
        slug: body.slug || slugify(title),
        language: body.language || 'FR',
        status: body.status || 'draft',
        seo: body.seo || {},
        metadata: body.metadata || {}
    };
    const page = body.id ? await upsert('pages', 'id', payload) : await insert('pages', payload);
    res.status(200).json({ page });
}

async function movePage(req, res, pageId) {
    const body = req.body || {};
    const folderId = requireField(body, 'folder_id');
    const folderResult = await supabaseRequest(
        'GET',
        `/folders?id=eq.${encodeURIComponent(folderId)}&select=*&limit=1`
    );
    if (!folderResult?.length) return res.status(404).json({ error: 'Folder not found' });

    const folder = folderResult[0];
    const pageResult = await supabaseRequest(
        'GET',
        `/pages?id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!pageResult?.length) return res.status(404).json({ error: 'Page not found' });

    const page = pageResult[0];
    const result = await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(pageId)}`, {
        entity_id: folder.entity_id,
        folder_id: folder.id,
        metadata: {
            ...(page.metadata || {}),
            movedAt: new Date().toISOString(),
            movedFromFolderId: page.folder_id || null,
            movedToFolderId: folder.id
        },
        updated_at: new Date().toISOString()
    }, {
        'Prefer': 'return=representation'
    });

    res.status(200).json({ page: Array.isArray(result) ? result[0] : result });
}

async function updatePageStatus(req, res, pageId) {
    const body = req.body || {};
    const status = requireField(body, 'status');
    const allowedStatuses = new Set(['draft', 'review', 'approved', 'published', 'archived']);
    if (!allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'Unsupported page status' });
    }

    const pageResult = await supabaseRequest(
        'GET',
        `/pages?id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!pageResult?.length) return res.status(404).json({ error: 'Page not found' });

    const page = pageResult[0];
    if (page.status === 'deleted') {
        return res.status(400).json({ error: 'Restore the page before changing its status' });
    }

    const now = new Date().toISOString();
    const metadata = { ...(page.metadata || {}) };
    const workflow = Array.isArray(metadata.workflow) ? metadata.workflow : [];
    workflow.push({
        from: page.status || 'draft',
        to: status,
        at: now,
        note: body.note || '',
        source: 'dashboard'
    });

    const patch = {
        status,
        metadata: {
            ...metadata,
            workflow,
            lastWorkflowTransitionAt: now
        },
        updated_at: now
    };

    if (status === 'published') patch.published_at = now;

    let result;
    try {
        result = await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(pageId)}`, patch, {
            'Prefer': 'return=representation'
        });
    } catch (e) {
        if (!patch.published_at || !isMissingColumnError(e, 'published_at')) throw e;

        const fallbackPatch = { ...patch };
        delete fallbackPatch.published_at;
        fallbackPatch.metadata = {
            ...fallbackPatch.metadata,
            publishedAt: now
        };

        result = await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(pageId)}`, fallbackPatch, {
            'Prefer': 'return=representation'
        });
    }

    if (status === 'published') {
        await createPublishIntegrationJob({
            page: Array.isArray(result) ? result[0] : { ...page, ...patch },
            versionId: page.current_version_id,
            note: body.note || ''
        }).catch(e => {
            console.warn('Publish integration job creation failed:', e.message);
        });
    }

    res.status(200).json({ page: Array.isArray(result) ? result[0] : result });
}

async function updatePageActivation(req, res, pageId) {
    const body = req.body || {};
    if (typeof body.active !== 'boolean') {
        return res.status(400).json({ error: 'active must be a boolean' });
    }
    if (!body.active && !body.redirectUrl) {
        return res.status(400).json({ error: 'Redirect URL is required when deactivating a published page' });
    }
    if (!body.active && !isValidRedirectUrl(body.redirectUrl)) {
        return res.status(400).json({ error: 'Redirect URL must start with http:// or https://' });
    }

    const pageResult = await supabaseRequest(
        'GET',
        `/pages?id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!pageResult?.length) return res.status(404).json({ error: 'Page not found' });

    const page = pageResult[0];
    if (page.status !== 'published') {
        return res.status(400).json({ error: 'Only published pages can be activated or deactivated' });
    }

    const now = new Date().toISOString();
    const metadata = { ...(page.metadata || {}) };
    const publicationHistory = Array.isArray(metadata.publicationHistory) ? metadata.publicationHistory : [];
    const publication = {
        ...(metadata.publication || {}),
        active: body.active,
        redirectUrl: body.active ? '' : (body.redirectUrl || ''),
        note: body.note || '',
        updatedAt: now,
        updatedFrom: 'dashboard'
    };

    if (body.active) {
        publication.activatedAt = now;
        delete publication.deactivatedAt;
    } else {
        publication.deactivatedAt = now;
    }

    publicationHistory.push({
        active: body.active,
        redirectUrl: publication.redirectUrl,
        note: body.note || '',
        at: now,
        source: 'dashboard'
    });

    const result = await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(pageId)}`, {
        metadata: {
            ...metadata,
            publication,
            publicationHistory
        },
        updated_at: now
    }, {
        'Prefer': 'return=representation'
    });

    const updatedPage = Array.isArray(result) ? result[0] : result;
    const legacyProjectName = updatedPage?.metadata?.legacyProjectName || page.metadata?.legacyProjectName;
    if (legacyProjectName) {
        await (async () => {
            const legacyResult = await supabaseRequest(
                'GET',
                `/Projects?project_name=eq.${encodeURIComponent(legacyProjectName)}&select=properties&limit=1`
            );
            const currentProperties = legacyResult?.[0]?.properties || {};
            await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(legacyProjectName)}`, {
                properties: {
                    ...currentProperties,
                    publication,
                    publicationHistory
                }
            });
        })().catch(e => {
            console.warn('Legacy publication sync failed:', e.message);
        });
    }

    res.status(200).json({ page: updatedPage, publication });
}

async function createPublishIntegrationJob({ page, versionId, note = '' }) {
    if (!page?.id || !versionId) return null;

    const versionResult = await supabaseRequest(
        'GET',
        `/page_versions?id=eq.${encodeURIComponent(versionId)}&select=id,version_number,html,metadata&limit=1`
    );
    const version = Array.isArray(versionResult) && versionResult.length ? versionResult[0] : null;
    if (!version) return null;

    return insert('integration_jobs', {
        organization_id: null,
        entity_id: page.entity_id || null,
        page_id: page.id,
        page_version_id: version.id,
        target: 'sfmc',
        action: 'publish_page',
        status: 'pending',
        payload: {
            pageId: page.id,
            versionId: version.id,
            versionNumber: version.version_number,
            title: page.title,
            language: page.language,
            htmlLength: (version.html || '').length
        },
        metadata: {
            source: 'editorial-workflow',
            note,
            legacyProjectName: page.metadata?.legacyProjectName || null
        }
    });
}

async function listIntegrationJobs(req, res) {
    const status = getQueryParam(req, 'status');
    const pageId = getQueryParam(req, 'pageId');
    const endpoint = selectEndpoint('integration_jobs', {
        status: status ? `eq.${status}` : undefined,
        page_id: pageId ? `eq.${pageId}` : undefined,
        order: 'created_at.desc'
    });
    const result = await supabaseRequest('GET', endpoint);
    res.status(200).json(result || []);
}

async function createIntegrationJob(req, res) {
    const body = req.body || {};
    const job = await insert('integration_jobs', {
        organization_id: body.organization_id || null,
        entity_id: body.entity_id || null,
        page_id: body.page_id || null,
        page_version_id: body.page_version_id || null,
        target: requireField(body, 'target'),
        action: requireField(body, 'action'),
        status: body.status || 'pending',
        payload: body.payload || {},
        metadata: body.metadata || {},
        scheduled_at: body.scheduled_at || new Date().toISOString()
    });
    res.status(200).json({ job });
}

async function getPage(req, res, pageId) {
    const result = await supabaseRequest('GET', `/pages?id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`);
    if (!result?.length) return res.status(404).json({ error: 'Page not found' });
    const versions = await supabaseRequest('GET', `/page_versions?page_id=eq.${encodeURIComponent(pageId)}&select=*&order=version_number.desc`);
    const drafts = await supabaseRequest('GET', `/page_drafts?page_id=eq.${encodeURIComponent(pageId)}&select=*&order=updated_at.desc`);
    return res.status(200).json({ page: result[0], versions: versions || [], drafts: drafts || [] });
}

async function resolvePublicPageByHostPath({ host, path = '/' } = {}) {
    if (!host) return null;
    const normalizedHost = String(host).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    const cleanPath = `/${String(path).replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';

    const entities = await supabaseRequest('GET', '/entities?select=id,name,slug,base_url,metadata');
    const entity = (Array.isArray(entities) ? entities : []).find(item => {
        const parsedBaseUrl = parsePublicBaseUrl(item.base_url || '');
        if (!parsedBaseUrl || parsedBaseUrl.host !== normalizedHost) return false;
        return !parsedBaseUrl.pathPrefix || cleanPath === parsedBaseUrl.pathPrefix || cleanPath.startsWith(`${parsedBaseUrl.pathPrefix}/`);
    });
    if (!entity) return null;

    const parsedBaseUrl = parsePublicBaseUrl(entity.base_url || '');
    const pathWithoutBase = parsedBaseUrl?.pathPrefix
        ? cleanPath.replace(new RegExp(`^${parsedBaseUrl.pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '') || '/'
        : cleanPath;
    const segments = pathWithoutBase.split('/').filter(Boolean);
    const language = segments.length > 1 && /^[a-z]{2}$/i.test(segments[0]) ? segments[0].toUpperCase() : 'FR';
    const slug = segments.length > 1 && /^[a-z]{2}$/i.test(segments[0]) ? segments.slice(1).join('-') : segments.join('-');
    if (!slug) return null;

    const pages = await supabaseRequest(
        'GET',
        `/pages?entity_id=eq.${encodeURIComponent(entity.id)}&slug=eq.${encodeURIComponent(slug)}&language=eq.${encodeURIComponent(language)}&select=*&limit=1`
    );
    if (!pages?.length) return null;

    const page = pages[0];
    let version = null;
    if (page.current_version_id) {
        const versionResult = await supabaseRequest(
            'GET',
            `/page_versions?id=eq.${encodeURIComponent(page.current_version_id)}&select=*&limit=1`
        );
        version = Array.isArray(versionResult) && versionResult.length ? versionResult[0] : null;
    }

    return {
        entity,
        page,
        version,
        public_url: buildPublicPageUrl({ baseUrl: entity.base_url, slug: page.slug, language: page.language })
    };
}

async function getPublicPageByPath(req, res) {
    const host = getQueryParam(req, 'host');
    const path = getQueryParam(req, 'path') || '/';
    if (!host) return res.status(400).json({ error: 'host is required' });

    const resolved = await resolvePublicPageByHostPath({ host, path });
    if (!resolved) return res.status(404).json({ error: 'Page not found for this domain and path' });

    res.status(200).json({
        entity: resolved.entity,
        page: resolved.page,
        version: resolved.version,
        public_url: resolved.public_url
    });
}

async function createPageVersion(req, res, pageId) {
    const body = req.body || {};
    const existing = await supabaseRequest('GET', `/page_versions?page_id=eq.${encodeURIComponent(pageId)}&select=version_number&order=version_number.desc&limit=1`);
    const versionNumber = body.version_number || ((existing?.[0]?.version_number || 0) + 1);
    const version = await insert('page_versions', {
        page_id: pageId,
        version_number: versionNumber,
        html: body.html || '',
        css: body.css || '',
        project_data: body.project_data || {},
        created_by: body.created_by || null,
        change_summary: body.change_summary || '',
        metadata: body.metadata || {}
    });

    const pagePatch = {
        current_version_id: version.id,
        status: body.status || 'draft',
        updated_at: new Date().toISOString()
    };
    if (body.page?.title) pagePatch.title = body.page.title;
    if (body.page?.language) pagePatch.language = body.page.language;
    if (body.page?.seo) pagePatch.seo = body.page.seo;
    if (body.page?.metadata) pagePatch.metadata = body.page.metadata;

    await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(pageId)}`, pagePatch);
    res.status(200).json({ version });
}

async function restorePageVersion(req, res, pageId) {
    const body = req.body || {};
    const versionId = requireField(body, 'version_id');
    const pageResult = await supabaseRequest(
        'GET',
        `/pages?id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!pageResult?.length) return res.status(404).json({ error: 'Page not found' });

    const result = await supabaseRequest(
        'GET',
        `/page_versions?id=eq.${encodeURIComponent(versionId)}&page_id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!result?.length) return res.status(404).json({ error: 'Version not found for this page' });

    const page = pageResult[0];
    const version = result[0];
    await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(pageId)}`, {
        current_version_id: version.id,
        updated_at: new Date().toISOString(),
        metadata: {
            ...(page.metadata || {}),
            restoredVersionId: version.id,
            restoredVersionNumber: version.version_number,
            restoredAt: new Date().toISOString()
        }
    });

    res.status(200).json({ message: 'Version restored', version });
}

async function findPageWithCurrentVersionByLegacyProject(projectName) {
    const page = await findPageByLegacyProjectName(projectName);
    if (!page) return null;
    let version = null;
    if (page.current_version_id) {
        const versionResult = await supabaseRequest(
            'GET',
            `/page_versions?id=eq.${encodeURIComponent(page.current_version_id)}&select=*&limit=1`
        );
        version = Array.isArray(versionResult) && versionResult.length ? versionResult[0] : null;
    }
    return { page, version };
}

async function updatePageLifecycleByLegacyProject(projectName, action = 'trash', reason = '') {
    const found = await findPageWithCurrentVersionByLegacyProject(projectName);
    if (!found?.page) return null;

    const page = found.page;
    const now = new Date().toISOString();
    const metadata = { ...(page.metadata || {}) };
    let status = page.status || 'draft';
    let message = 'Page updated';

    if (action === 'restore') {
        status = metadata.previousStatusBeforeDelete || 'draft';
        delete metadata.deletedAt;
        delete metadata.deletedReason;
        delete metadata.deletedFrom;
        delete metadata.archivedAt;
        delete metadata.archivedReason;
        message = 'Page restored';
    } else if (action === 'archive') {
        status = 'archived';
        metadata.archivedAt = now;
        metadata.archivedReason = reason || '';
        metadata.archivedFrom = 'dashboard';
        message = 'Page archived';
    } else {
        status = 'deleted';
        metadata.previousStatusBeforeDelete = page.status || 'draft';
        metadata.deletedAt = now;
        metadata.deletedReason = reason || '';
        metadata.deletedFrom = 'dashboard';
        message = 'Page moved to trash';
    }

    await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(page.id)}`, {
        status,
        metadata,
        updated_at: now
    });

    return { message, pageId: page.id, status };
}

async function updateLegacyProjectLifecycle(projectName, action = 'trash', reason = '') {
    const result = await supabaseRequest(
        'GET',
        `/Projects?project_name=eq.${encodeURIComponent(projectName)}&select=properties&limit=1`
    );
    if (!result?.length) return null;

    const currentProperties = result[0].properties || {};
    const now = new Date().toISOString();
    const lifecycle = { ...(currentProperties.lifecycle || {}) };
    let status = currentProperties.status || 'draft';
    let message = 'Legacy project updated';

    if (action === 'restore') {
        status = lifecycle.previousStatusBeforeDelete || 'draft';
        delete lifecycle.deletedAt;
        delete lifecycle.deletedReason;
        delete lifecycle.deletedFrom;
        message = 'Legacy project restored';
    } else if (action === 'archive') {
        status = 'archived';
        lifecycle.archivedAt = now;
        lifecycle.archivedReason = reason || '';
        lifecycle.archivedFrom = 'dashboard';
        message = 'Legacy project archived';
    } else {
        status = 'deleted';
        lifecycle.previousStatusBeforeDelete = currentProperties.status || 'draft';
        lifecycle.deletedAt = now;
        lifecycle.deletedReason = reason || '';
        lifecycle.deletedFrom = 'dashboard';
        message = 'Legacy project moved to trash';
    }

    await supabaseRequest('PATCH', `/Projects?project_name=eq.${encodeURIComponent(projectName)}`, {
        properties: {
            ...currentProperties,
            status,
            lifecycle
        }
    });

    return { message, status };
}

async function updatePageLifecycle(projectName, action = 'trash', reason = '') {
    const structured = await updatePageLifecycleByLegacyProject(projectName, action, reason);
    const legacy = await updateLegacyProjectLifecycle(projectName, action, reason).catch(() => null);
    return structured || legacy;
}

async function softDeletePageVersion(req, res, pageId, versionId) {
    const pageResult = await supabaseRequest(
        'GET',
        `/pages?id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!pageResult?.length) return res.status(404).json({ error: 'Page not found' });

    const page = pageResult[0];
    if (page.current_version_id === versionId) {
        return res.status(400).json({ error: 'Current version cannot be hidden. Restore another version first.' });
    }

    const result = await supabaseRequest(
        'GET',
        `/page_versions?id=eq.${encodeURIComponent(versionId)}&page_id=eq.${encodeURIComponent(pageId)}&select=*&limit=1`
    );
    if (!result?.length) return res.status(404).json({ error: 'Version not found for this page' });

    const version = result[0];
    await supabaseRequest('PATCH', `/page_versions?id=eq.${encodeURIComponent(versionId)}`, {
        metadata: {
            ...(version.metadata || {}),
            deletedAt: new Date().toISOString(),
            deletedReason: req.body?.reason || '',
            deletedFrom: 'dashboard'
        }
    });

    res.status(200).json({ message: 'Version hidden' });
}

async function savePageDraft(req, res, pageId) {
    const body = req.body || {};
    const userId = requireField(body, 'user_id');
    const draft = await upsert('page_drafts', 'page_id,user_id', {
        page_id: pageId,
        user_id: userId,
        html: body.html || '',
        css: body.css || '',
        project_data: body.project_data || {},
        metadata: body.metadata || {},
        updated_at: new Date().toISOString()
    });
    res.status(200).json({ draft });
}

async function logActivity(req, res) {
    const body = req.body || {};
    const action = requireField(body, 'action');
    const log = await insert('activity_logs', {
        organization_id: body.organization_id || null,
        entity_id: body.entity_id || null,
        page_id: body.page_id || null,
        actor_id: body.actor_id || null,
        action,
        before_state: body.before_state || null,
        after_state: body.after_state || null,
        metadata: body.metadata || {}
    });
    res.status(200).json({ log });
}

async function migrateLegacyProjects(req, res) {
    const limit = Number(getQueryParam(req, 'limit') || req.body?.limit || 500);
    const result = await supabaseRequest(
        'GET',
        `/Projects?select=project_name,html,css,project_data,properties,created_at&order=created_at.asc&limit=${limit}`
    );
    const projects = Array.isArray(result) ? result : [];
    const migrated = [];

    for (const project of projects) {
        try {
            migrated.push(await migrateLegacyProject(project, {
                updatePageMetadata: true,
                skipExistingVersions: true
            }));
        } catch (e) {
            migrated.push({
                skipped: true,
                projectName: project.project_name,
                reason: 'migration_failed',
                error: e.message,
                code: e.code,
                status: e.status
            });
        }
    }

    res.status(200).json({
        scanned: projects.length,
        migrated: migrated.filter(item => !item.skipped).length,
        skipped: migrated.filter(item => item.skipped).length,
        results: migrated
    });
}

async function handleContentRoute(req, res, pathname) {
    if (pathname === '/api/content/status' && req.method === 'GET') {
        const status = await getContentSchemaStatus();
        res.status(200).json(status);
        return true;
    }

    if (pathname === '/api/organizations') {
        if (req.method === 'GET') {
            await listOrganizations(req, res);
            return true;
        }
        if (req.method === 'POST') {
            await saveOrganization(req, res);
            return true;
        }
    }

    if (pathname === '/api/entities') {
        if (req.method === 'GET') {
            await listEntities(req, res);
            return true;
        }
        if (req.method === 'POST') {
            await saveEntity(req, res);
            return true;
        }
    }

    if (pathname === '/api/folders') {
        if (req.method === 'GET') {
            await listFolders(req, res);
            return true;
        }
        if (req.method === 'POST') {
            await saveFolder(req, res);
            return true;
        }
    }

    if (pathname === '/api/integration-jobs') {
        if (req.method === 'GET') {
            await listIntegrationJobs(req, res);
            return true;
        }
        if (req.method === 'POST') {
            await createIntegrationJob(req, res);
            return true;
        }
    }

    if (pathname === '/api/content/pages') {
        if (req.method === 'GET') {
            await listPages(req, res);
            return true;
        }
        if (req.method === 'POST') {
            await savePage(req, res);
            return true;
        }
    }

    const pageMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)$/);
    if (pageMatch && req.method === 'GET') {
        await getPage(req, res, pageMatch[1]);
        return true;
    }

    if (pathname === '/api/content/public-page' && req.method === 'GET') {
        await getPublicPageByPath(req, res);
        return true;
    }

    const moveMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/move$/);
    if (moveMatch && req.method === 'POST') {
        await movePage(req, res, moveMatch[1]);
        return true;
    }

    const statusMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/status$/);
    if (statusMatch && req.method === 'POST') {
        await updatePageStatus(req, res, statusMatch[1]);
        return true;
    }

    const activationMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/activation$/);
    if (activationMatch && req.method === 'POST') {
        await updatePageActivation(req, res, activationMatch[1]);
        return true;
    }

    const versionMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/versions$/);
    if (versionMatch && req.method === 'POST') {
        await createPageVersion(req, res, versionMatch[1]);
        return true;
    }

    const restoreMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/restore$/);
    if (restoreMatch && req.method === 'POST') {
        await restorePageVersion(req, res, restoreMatch[1]);
        return true;
    }

    const deleteVersionMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/versions\/([^/]+)\/delete$/);
    if (deleteVersionMatch && req.method === 'POST') {
        await softDeletePageVersion(req, res, deleteVersionMatch[1], deleteVersionMatch[2]);
        return true;
    }

    const draftMatch = pathname.match(/^\/api\/content\/pages\/([^/]+)\/draft$/);
    if (draftMatch && req.method === 'POST') {
        await savePageDraft(req, res, draftMatch[1]);
        return true;
    }

    if (pathname === '/api/activity' && req.method === 'POST') {
        await logActivity(req, res);
        return true;
    }

    if (pathname === '/api/content/migrate/legacy' && req.method === 'POST') {
        await migrateLegacyProjects(req, res);
        return true;
    }

    return false;
}

async function contentApiModule(req, res) {
    const pathname = req.query?.path || req.url.split('?')[0];
    if (await handleContentRoute(req, res, pathname)) return;
    res.status(404).json({ error: 'Content API route not found' });
}

contentApiModule.handleContentRoute = handleContentRoute;
contentApiModule.syncLegacyProjectToContent = syncLegacyProjectToContent;
contentApiModule.listMigratedDashboardPages = listMigratedDashboardPages;
contentApiModule.getCurrentVersionForLegacyProject = getCurrentVersionForLegacyProject;
contentApiModule.getStructuredProjectForLegacyProject = getStructuredProjectForLegacyProject;
contentApiModule.updatePageLifecycle = updatePageLifecycle;
contentApiModule.getContentSchemaStatus = getContentSchemaStatus;
contentApiModule.isMissingContentSchemaError = isMissingContentSchemaError;
contentApiModule.getPublicationSettings = getPublicationSettings;
contentApiModule.buildPublicPageUrl = buildPublicPageUrl;
contentApiModule.buildPublicPagePath = buildPublicPagePath;
contentApiModule.resolvePublicPageByHostPath = resolvePublicPageByHostPath;

module.exports = contentApiModule;
