const { readSchools, findSchoolById } = require('../lib/schools');
const { supabaseRequest, slugify } = require('../lib/api-shared');

const DEFAULT_ORGANIZATION = {
    name: 'Reetain Holding',
    slug: 'reetain-holding'
};

async function readSchoolsForApi() {
    const baseSchools = readSchools().map(normalizeSchool);
    try {
        const schools = await supabaseRequest('GET', '/Schools?select=*&order=name.asc');
        if (Array.isArray(schools)) {
            const merged = new Map(baseSchools.map(school => [school.id, school]));
            schools.map(normalizeSchool).forEach(school => {
                if (school.deleted) merged.delete(school.id);
                else merged.set(school.id, school);
            });
            return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
        }
    } catch (e) {
        console.warn('Schools DB read failed, falling back to schools.json:', e.message);
    }
    return baseSchools;
}

function normalizeSchool(school = {}) {
    return {
        id: school.id,
        name: school.name || '',
        fullName: school.fullName || school.full_name || school.name || '',
        description: school.description || '',
        contact: school.contact || '',
        baseUrl: school.baseUrl || school.base_url || '',
        color: school.color || '#3b82f6',
        secondaryColor: school.secondaryColor || school.secondary_color || '#1a1a1a',
        colorLight: school.colorLight || school.color_light || '',
        emoji: school.emoji || '🏫',
        deleted: Boolean(school.deleted),
        defaultBlocks: Array.isArray(school.defaultBlocks)
            ? school.defaultBlocks
            : Array.isArray(school.default_blocks)
                ? school.default_blocks
                : []
    };
}

function schoolPayload(input = {}) {
    const school = normalizeSchool(input);
    if (!school.id || !/^[a-z0-9-]+$/.test(school.id)) {
        const err = new Error('School id must contain only lowercase letters, numbers and dashes');
        err.status = 400;
        throw err;
    }
    if (!school.name.trim()) {
        const err = new Error('School name is required');
        err.status = 400;
        throw err;
    }
    return { ...school, deleted: false };
}

function schoolDbPayload(school) {
    return {
        id: school.id,
        name: school.name,
        full_name: school.fullName,
        description: school.description,
        contact: school.contact,
        base_url: school.baseUrl,
        color: school.color,
        secondary_color: school.secondaryColor,
        color_light: school.colorLight,
        emoji: school.emoji,
        default_blocks: school.defaultBlocks,
        deleted: school.deleted
    };
}

async function findOne(table, filters = {}) {
    const params = new URLSearchParams({ select: '*', limit: '1' });
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, `eq.${value}`);
    });
    const result = await supabaseRequest('GET', `/${table}?${params.toString()}`);
    return Array.isArray(result) && result.length ? result[0] : null;
}

async function insert(table, payload) {
    const result = await supabaseRequest('POST', `/${table}`, payload, {
        'Prefer': 'return=representation'
    });
    return Array.isArray(result) ? result[0] : result;
}

async function patchById(table, id, payload) {
    const result = await supabaseRequest('PATCH', `/${table}?id=eq.${encodeURIComponent(id)}`, payload, {
        'Prefer': 'return=representation'
    });
    return Array.isArray(result) ? result[0] : result;
}

async function ensureDefaultOrganization() {
    const existing = await findOne('organizations', { slug: DEFAULT_ORGANIZATION.slug });
    if (existing) return existing;
    return insert('organizations', {
        name: DEFAULT_ORGANIZATION.name,
        slug: DEFAULT_ORGANIZATION.slug,
        metadata: { source: 'school-admin' }
    });
}

function entityPayloadFromSchool(organization, school) {
    return {
        organization_id: organization.id,
        name: school.name || school.id.toUpperCase(),
        slug: slugify(school.id),
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
            legacySchoolId: school.id,
            fullName: school.fullName || '',
            defaultBlocks: school.defaultBlocks || [],
            source: 'school-admin'
        },
        deleted: Boolean(school.deleted)
    };
}

async function ensureSchoolEntity(organization, school) {
    const payload = entityPayloadFromSchool(organization, school);
    const existing = await findOne('entities', {
        organization_id: organization.id,
        slug: payload.slug
    });
    if (existing) return patchById('entities', existing.id, payload);
    return insert('entities', payload);
}

async function ensureDefaultWorkspace(entity) {
    const slug = 'landing-pages';
    const existing = await findOne('workspaces', {
        entity_id: entity.id,
        slug
    });
    if (existing) return existing;
    return insert('workspaces', {
        entity_id: entity.id,
        name: 'Landing Pages',
        slug,
        metadata: { source: 'school-admin' }
    });
}

async function ensureDefaultFolder(entity) {
    const slug = 'landing-pages';
    const existing = await findOne('folders', {
        entity_id: entity.id,
        slug
    });
    if (existing) return existing;
    return insert('folders', {
        entity_id: entity.id,
        parent_id: null,
        name: 'Landing Pages',
        slug,
        sort_order: 0,
        metadata: { source: 'school-admin' }
    });
}

async function bootstrapSchoolStructure(school) {
    const organization = await ensureDefaultOrganization();
    const entity = await ensureSchoolEntity(organization, school);
    const workspace = await ensureDefaultWorkspace(entity);
    const folder = await ensureDefaultFolder(entity);
    return {
        organizationId: organization.id,
        entityId: entity.id,
        workspaceId: workspace.id,
        folderId: folder.id
    };
}

async function bootstrapSchoolsFromCurrentConfig() {
    const schools = await readSchoolsForApi();
    const results = [];

    for (const school of schools) {
        const payload = schoolPayload(school);
        const saved = await supabaseRequest('POST', '/Schools?on_conflict=id', schoolDbPayload(payload), {
            'Prefer': 'resolution=merge-duplicates,return=representation'
        });
        const content = await bootstrapSchoolStructure(payload);
        results.push({
            schoolId: payload.id,
            school: Array.isArray(saved) ? saved[0] : saved,
            content
        });
    }

    return {
        scanned: schools.length,
        bootstrapped: results.length,
        results
    };
}

function renameProjectForSchool(projectName, fromSchoolId, toSchoolId) {
    return String(projectName || '').replace(
        new RegExp(`^school-${fromSchoolId}__`, 'i'),
        `school-${toSchoolId}__`
    );
}

function uniqueTransferredProjectName(baseName, existingNames) {
    if (!existingNames.has(baseName)) return baseName;

    const match = baseName.match(/^(school-[a-z0-9-]+__)(.*?)(__[A-Z]{2})$/i);
    const prefix = match ? match[1] : '';
    const title = match ? match[2] : baseName;
    const suffix = match ? match[3] : '';

    let index = 1;
    let candidate = `${prefix}${title}-transferred${suffix}`;
    while (existingNames.has(candidate)) {
        index += 1;
        candidate = `${prefix}${title}-transferred-${index}${suffix}`;
    }
    return candidate;
}

async function transferSchoolPages(fromSchoolId, toSchoolId) {
    const sourcePrefix = `school-${fromSchoolId}__`;
    const targetPrefix = `school-${toSchoolId}__`;
    const result = await supabaseRequest(
        'GET',
        `/Projects?project_name=like.${encodeURIComponent(sourcePrefix + '*')}&select=*`
    );
    const targetResult = await supabaseRequest(
        'GET',
        `/Projects?project_name=like.${encodeURIComponent(targetPrefix + '*')}&select=project_name`
    );
    const projects = Array.isArray(result) ? result : [];
    const existingNames = new Set((Array.isArray(targetResult) ? targetResult : []).map(p => p.project_name));
    const transferred = [];

    for (const project of projects) {
        const baseName = renameProjectForSchool(project.project_name, fromSchoolId, toSchoolId);
        const newName = uniqueTransferredProjectName(baseName, existingNames);
        const currentProperties = project.properties && typeof project.properties === 'object'
            ? project.properties
            : {};
        const transferMetadata = {
            ...(currentProperties.lifecycle || {}),
            transferredFromSchoolId: fromSchoolId,
            transferredToSchoolId: toSchoolId,
            transferredAt: new Date().toISOString(),
            previousProjectName: project.project_name
        };
        const filter = project.id !== undefined && project.id !== null
            ? `id=eq.${encodeURIComponent(project.id)}`
            : `project_name=eq.${encodeURIComponent(project.project_name)}`;

        await supabaseRequest('PATCH', `/Projects?${filter}`, {
            project_name: newName,
            properties: {
                ...currentProperties,
                lifecycle: transferMetadata
            }
        });
        existingNames.add(newName);
        transferred.push({
            id: project.id || null,
            previousProjectName: project.project_name,
            newProjectName: newName
        });
    }

    return { count: projects.length, pages: transferred };
}

async function transferStructuredSchoolPages(fromSchoolId, toSchool) {
    const organization = await ensureDefaultOrganization();
    const sourceEntity = await findOne('entities', {
        organization_id: organization.id,
        slug: slugify(fromSchoolId)
    });
    if (!sourceEntity) return 0;

    const targetEntity = await ensureSchoolEntity(organization, toSchool);
    const targetFolder = await ensureDefaultFolder(targetEntity);
    const targetPages = await supabaseRequest(
        'GET',
        `/pages?entity_id=eq.${encodeURIComponent(targetEntity.id)}&select=metadata`
    );
    const existingNames = new Set(
        (Array.isArray(targetPages) ? targetPages : [])
            .map(page => page.metadata?.legacyProjectName)
            .filter(Boolean)
    );
    const sourcePages = await supabaseRequest(
        'GET',
        `/pages?entity_id=eq.${encodeURIComponent(sourceEntity.id)}&select=*`
    );
    const pages = Array.isArray(sourcePages) ? sourcePages : [];
    const transferred = [];

    for (const page of pages) {
        const legacyProjectName = page.metadata?.legacyProjectName;
        const baseName = legacyProjectName
            ? renameProjectForSchool(legacyProjectName, fromSchoolId, toSchool.id)
            : null;
        const newLegacyProjectName = baseName ? uniqueTransferredProjectName(baseName, existingNames) : null;
        if (newLegacyProjectName) existingNames.add(newLegacyProjectName);

        await supabaseRequest('PATCH', `/pages?id=eq.${encodeURIComponent(page.id)}`, {
            entity_id: targetEntity.id,
            folder_id: targetFolder.id,
            metadata: {
                ...(page.metadata || {}),
                ...(newLegacyProjectName ? { legacyProjectName: newLegacyProjectName } : {}),
                transferredFromSchoolId: fromSchoolId,
                transferredToSchoolId: toSchool.id,
                transferredAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
        });

        transferred.push({
            id: page.id,
            title: page.title,
            previousLegacyProjectName: legacyProjectName || null,
            newLegacyProjectName
        });
    }

    await patchById('entities', sourceEntity.id, {
        deleted: true,
        metadata: {
            ...(sourceEntity.metadata || {}),
            deletedFromSchoolAdmin: true,
            transferredToSchoolId: toSchool.id,
            deletedAt: new Date().toISOString()
        }
    });

    return { count: pages.length, pages: transferred };
}

async function logSchoolTransfer({ schoolId, targetSchool, legacyTransfer, structuredTransfer }) {
    const transferredAt = new Date().toISOString();
    await insert('activity_logs', {
        action: 'school.deleted_transferred',
        before_state: {
            schoolId
        },
        after_state: {
            deleted: true,
            transferToSchoolId: targetSchool.id
        },
        metadata: {
            source: 'school-admin',
            deletedSchoolId: schoolId,
            transferToSchoolId: targetSchool.id,
            transferToSchoolName: targetSchool.name,
            transferredAt,
            transferredPages: legacyTransfer.count,
            transferredStructuredPages: structuredTransfer.count,
            totalTransferredPages: legacyTransfer.count + structuredTransfer.count,
            legacyProjects: legacyTransfer.pages,
            structuredPages: structuredTransfer.pages
        }
    });
}

async function listSchoolActivity(req, res) {
    const params = new URLSearchParams((req.url || '').split('?')[1] || '');
    const limit = Math.min(Number(req.query?.limit || params.get('limit') || 25), 100);
    const logs = await supabaseRequest(
        'GET',
        `/activity_logs?action=eq.school.deleted_transferred&select=*&order=created_at.desc&limit=${limit}`
    ).catch(() => []);
    const transferredPages = await supabaseRequest(
        'GET',
        '/pages?select=id,title,metadata,updated_at&order=updated_at.desc&limit=200'
    ).catch(() => []);
    const loggedStructuredPageIds = new Set(
        (Array.isArray(logs) ? logs : [])
            .flatMap(log => Array.isArray(log.metadata?.structuredPages) ? log.metadata.structuredPages : [])
            .map(page => page.id)
            .filter(Boolean)
    );

    const derivedLogs = new Map();
    (Array.isArray(transferredPages) ? transferredPages : [])
        .filter(page => page.metadata?.transferredFromSchoolId && page.metadata?.transferredToSchoolId)
        .filter(page => !loggedStructuredPageIds.has(page.id))
        .forEach(page => {
            const metadata = page.metadata || {};
            const key = [
                metadata.transferredFromSchoolId,
                metadata.transferredToSchoolId,
                metadata.transferredAt || page.updated_at
            ].join('|');
            const existing = derivedLogs.get(key) || {
                id: `derived-${key}`,
                action: 'school.deleted_transferred',
                created_at: metadata.transferredAt || page.updated_at,
                metadata: {
                    source: 'page-metadata',
                    deletedSchoolId: metadata.transferredFromSchoolId,
                    transferToSchoolId: metadata.transferredToSchoolId,
                    transferToSchoolName: metadata.transferredToSchoolId,
                    transferredPages: 0,
                    transferredStructuredPages: 0,
                    totalTransferredPages: 0,
                    legacyProjects: [],
                    structuredPages: []
                }
            };
            existing.metadata.structuredPages.push({
                id: page.id,
                title: page.title,
                newLegacyProjectName: metadata.legacyProjectName || null
            });
            existing.metadata.transferredStructuredPages += 1;
            existing.metadata.totalTransferredPages += 1;
            derivedLogs.set(key, existing);
        });

    const merged = [
        ...(Array.isArray(logs) ? logs : []),
        ...[...derivedLogs.values()]
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.status(200).json(merged.slice(0, limit));
}

async function handleSchoolsRoute(req, res, pathname) {
    if (req.method === 'GET' && pathname === '/api/schools/activity') {
        await listSchoolActivity(req, res);
        return true;
    }

    if (req.method === 'GET' && pathname === '/api/schools') {
        res.status(200).json(await readSchoolsForApi());
        return true;
    }

    if (req.method === 'POST' && pathname === '/api/schools/bootstrap') {
        res.status(200).json(await bootstrapSchoolsFromCurrentConfig());
        return true;
    }

    if (req.method === 'POST' && pathname === '/api/schools') {
        const school = schoolPayload(req.body || {});
        const result = await supabaseRequest('POST', '/Schools?on_conflict=id', schoolDbPayload(school), {
            'Prefer': 'resolution=merge-duplicates,return=representation'
        });
        const content = await bootstrapSchoolStructure(school);
        res.status(200).json({ message: 'School saved', school: Array.isArray(result) ? result[0] : result, content });
        return true;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/school/')) {
        const schoolId = pathname.replace('/api/school/', '');
        const schools = await readSchoolsForApi();
        const school = schools.find(item => item.id === schoolId) || findSchoolById(schoolId);
        if (school) res.status(200).json(school);
        else res.status(404).json({ error: 'Not found' });
        return true;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/school/')) {
        const schoolId = pathname.replace('/api/school/', '');
        const school = schoolPayload({ ...(req.body || {}), id: schoolId });
        const result = await supabaseRequest('POST', '/Schools?on_conflict=id', schoolDbPayload(school), {
            'Prefer': 'resolution=merge-duplicates,return=representation'
        });
        const content = await bootstrapSchoolStructure(school);
        res.status(200).json({ message: 'School updated', school: Array.isArray(result) ? result[0] : result, content });
        return true;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/school/')) {
        const schoolId = pathname.replace('/api/school/', '');
        const transferToSchoolId = req.body?.transferToSchoolId;
        if (!transferToSchoolId || transferToSchoolId === schoolId) {
            res.status(400).json({ error: 'A different transferToSchoolId is required' });
            return true;
        }

        const schools = await readSchoolsForApi();
        const targetSchool = schools.find(school => school.id === transferToSchoolId);
        if (!targetSchool) {
            res.status(400).json({ error: 'Transfer target school not found' });
            return true;
        }

        const legacyTransfer = await transferSchoolPages(schoolId, transferToSchoolId);
        const structuredTransfer = await transferStructuredSchoolPages(schoolId, targetSchool);
        await supabaseRequest('POST', '/Schools?on_conflict=id', {
            id: schoolId,
            name: schoolId,
            deleted: true
        });

        await logSchoolTransfer({
            schoolId,
            targetSchool,
            legacyTransfer,
            structuredTransfer
        }).catch(e => {
            console.warn('School transfer activity log failed:', e.message);
        });

        res.status(200).json({
            message: 'School deleted',
            deletedSchoolId: schoolId,
            transferToSchoolId,
            transferredPages: legacyTransfer.count,
            transferredStructuredPages: structuredTransfer.count,
            totalTransferredPages: legacyTransfer.count + structuredTransfer.count
        });
        return true;
    }

    return false;
}

async function schoolsApiModule(req, res) {
    try {
        const pathname = req.query?.path || req.url.split('?')[0];
        const normalizedPath = pathname === '/' || pathname === '' ? '/api/schools' : pathname;
        if (await handleSchoolsRoute(req, res, normalizedPath)) return;
        res.status(404).json({ error: 'Schools API route not found' });
    } catch (e) {
        console.error('Schools API error:', e);
        res.status(e.status || 500).json({
            error: e.message || 'Schools API failed',
            code: e.code || 'SCHOOLS_API_ERROR',
            status: e.status || 500,
            details: e.payload || null
        });
    }
}

schoolsApiModule.handleSchoolsRoute = handleSchoolsRoute;
schoolsApiModule.readSchoolsForApi = readSchoolsForApi;
schoolsApiModule.bootstrapSchoolsFromCurrentConfig = bootstrapSchoolsFromCurrentConfig;

module.exports = schoolsApiModule;
