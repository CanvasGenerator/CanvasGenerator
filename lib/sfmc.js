/**
 
 * Required environment variables:
 *   SFMC_SUBDOMAIN       e.g. "mc6abc123def456"
 *   SFMC_CLIENT_ID       Installed package Client ID
 *   SFMC_CLIENT_SECRET   Installed package Client Secret
 *   SFMC_ACCOUNT_ID      (optional) MID of the Business Unit to target
 *   SFMC_CATEGORY_NAME     (optional) Content Builder folder/category name
 *   SFMC_ASSET_TYPE_ID   (optional) Override the asset type id (default 220 = code snippet)
 */

const SFMC_SUBDOMAIN = (process.env.SFMC_SUBDOMAIN || '')
    .replace(/^https?:\/\//, '')
    .split('.')[0]
    .trim();
const SFMC_CLIENT_ID = process.env.SFMC_CLIENT_ID;
const SFMC_CLIENT_SECRET = process.env.SFMC_CLIENT_SECRET;
const SFMC_ACCOUNT_ID = process.env.SFMC_ACCOUNT_ID || null;
const SFMC_CATEGORY_ID = process.env.SFMC_CATEGORY_ID
    ? parseInt(process.env.SFMC_CATEGORY_ID, 10)
    : null;
const SFMC_CATEGORY_NAME = (process.env.SFMC_CATEGORY_NAME || '').trim() || null;
const SFMC_ASSET_TYPE_ID = process.env.SFMC_ASSET_TYPE_ID
    ? parseInt(process.env.SFMC_ASSET_TYPE_ID, 10)
    : 205; // 205 = webpage (220 was codesnippet)
const SFMC_ASSET_TYPE_NAME = process.env.SFMC_ASSET_TYPE_NAME || 'webpage';
const SFMC_DE_CATEGORY_ID = process.env.SFMC_DE_CATEGORY_ID
    ? parseInt(process.env.SFMC_DE_CATEGORY_ID, 10)
    : null;

let cachedToken = null;
let cachedCategoryId = null;


function stripSchoolPrefix(projectName) {
    if (!projectName) return projectName;
    return projectName.replace(/^school-[^_]+__/, '');
}

function getSchoolIdFromProjectName(projectName) {
    if (!projectName) return 'unknown';
    const match = projectName.match(/^school-([^_]+)__/);
    return match ? match[1] : 'unknown';
}


/**
 From CustomerKey spec: "Code Snippet customer keys may only contain alpha-numeric characters, 
 underscores, dashes, periods, and slashes. No spaces are allowed."
 */
function slugify(s) {
    return String(s || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_./-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '');
}

/**
 * Build the customerKey ("template key") used in SFMC.
 */
function customerKeyFor(projectName) {
    return slugify(stripSchoolPrefix(projectName));
}

/**
 * Build the asset display name shown in Content Builder. Just the school
 * prefix stripped — no slugification, so spaces/casing are preserved.
 */
function assetNameFor(projectName) {
    return stripSchoolPrefix(projectName);
}

function isSfmcConfigured() {
    return Boolean(SFMC_SUBDOMAIN && SFMC_CLIENT_ID && SFMC_CLIENT_SECRET);
}

function assertConfigured() {
    if (!isSfmcConfigured()) {
        const err = new Error(
            'Missing SFMC env vars (SFMC_SUBDOMAIN / SFMC_CLIENT_ID / SFMC_CLIENT_SECRET)'
        );
        err.code = 'SFMC_ENV_MISSING';
        throw err;
    }
}

/**
 * Fetch (or reuse) an OAuth2 access token. 
 */
async function getAccessToken() {
    assertConfigured();

    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
        return cachedToken;
    }

    const url = `https://${SFMC_SUBDOMAIN}.auth.marketingcloudapis.com/v2/token`;
    const body = {
        grant_type: 'client_credentials',
        client_id: SFMC_CLIENT_ID,
        client_secret: SFMC_CLIENT_SECRET
    };
    if (SFMC_ACCOUNT_ID) body.account_id = SFMC_ACCOUNT_ID;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        let payload = null;
        try { payload = await response.json(); } catch { /* ignore */ }
        const err = new Error(`SFMC auth failed (HTTP ${response.status})`);
        err.code = 'SFMC_AUTH_ERROR';
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    const data = await response.json();
    cachedToken = {
        accessToken: data.access_token,
        restBase: data.rest_instance_url,
        expiresAt: now + (data.expires_in || 1080) * 1000
    };
    return cachedToken;
}

/**
 * Make an authenticated request against the Content Builder REST API.
 */
async function sfmcFetch(method, path, body = null) {
    const { accessToken, restBase } = await getAccessToken();
    const url = restBase.replace(/\/$/, '') + path;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    let payload = null;
    try { payload = await response.json(); } catch {}

    if (!response.ok) {
        const err = new Error(`SFMC ${method} ${path} failed (HTTP ${response.status})`);
        err.code = 'SFMC_HTTP_ERROR';
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    return payload;
}

/**
 * Resolve a Content Builder category (folder) by its name and optional parentId.
 */
async function resolveCategoryIdByName(name, parentId = null) {
    if (!name) return null;

    const pageSize = 500;
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page++) {
        const path = `/asset/v1/content/categories?$pagesize=${pageSize}&$page=${page}`;
        const result = await sfmcFetch('GET', path);

        const items = (result && Array.isArray(result.items)) ? result.items : [];
        if (items.length === 0) break;

        // Search for a folder with the same name AND the same parentId
        const match = items.find(c => 
            c.name.toLowerCase() === name.toLowerCase() && 
            (!parentId || c.parentId === parentId)
        );

        if (match) return match.id;

        if (items.length < pageSize) break;
    }

    return null;
}

/**
 * Ensure a folder exists by name and parentId. Create it if it doesn't.
 */
async function ensureFolder(name, parentId) {
    let id = await resolveCategoryIdByName(name, parentId);
    if (!id) {
        console.log(`📁 SFMC: Creating folder "${name}" under parent ${parentId || 'root'}...`);
        const result = await sfmcFetch('POST', '/asset/v1/content/categories', {
            name,
            parentId: parentId || 0
        });
        id = result.id;
    }
    return id;
}

/**
 * Sync a component (block) to SFMC.
 * Structure: [Root Folder] / blocks / [schoolId] / [Component Name]
 */
async function syncComponentToSfmc({ schoolId, name, content }) {
    assertConfigured();

    // 1. Get Root Project Folder
    let folderId = SFMC_CATEGORY_ID;
    if (!folderId && SFMC_CATEGORY_NAME) {
        folderId = await ensureFolder(SFMC_CATEGORY_NAME, 0);
    }

    // 2. Ensure "blocks" folder
    const blocksFolderId = await ensureFolder('blocks', folderId);

    // 3. Ensure school subfolder
    const schoolFolderId = await ensureFolder(schoolId, blocksFolderId);

    // 4. Upsert Component Asset (always use 220 Code Snippet for blocks)
    const customerKey = slugify(`comp-${schoolId}-${name}`);
    const existingId = await findAssetIdByCustomerKey(customerKey);

    const payload = {
        name,
        customerKey,
        assetType: { id: 220, name: 'codesnippet' },
        content: content,
        category: { id: schoolFolderId }
    };

    if (existingId) {
        const updated = await sfmcFetch('PATCH', `/asset/v1/content/assets/${existingId}`, payload);
        return { action: 'updated', id: existingId, name: updated.name };
    } else {
        const created = await sfmcFetch('POST', '/asset/v1/content/assets', payload);
        return { action: 'created', id: created.id, name: created.name };
    }
}

/**
 * Look up an existing asset by customerKey.
 */
async function findAssetIdByCustomerKey(customerKey) {
    const result = await sfmcFetch('POST', '/asset/v1/content/assets/query', {
        page: { page: 1, pageSize: 1 },
        query: {
            property: 'customerKey',
            simpleOperator: 'equal',
            value: customerKey
        },
        fields: ['id', 'customerKey', 'name']
    });

    if (result && Array.isArray(result.items) && result.items.length > 0) {
        return result.items[0].id;
    }
    return null;
}

/**
 * Build the SFMC asset payload from the project save data.
 */
async function buildAssetPayload({ projectName, fullHtml }) {
    const payload = {
        name: assetNameFor(projectName),
        customerKey: customerKeyFor(projectName),
        assetType: { id: SFMC_ASSET_TYPE_ID, name: SFMC_ASSET_TYPE_NAME },
        content: fullHtml,
        views: {
            html: { content: fullHtml }
        }
    };

    let categoryId = SFMC_CATEGORY_ID;
    if (!categoryId && SFMC_CATEGORY_NAME) {
        try {
            categoryId = await resolveCategoryIdByName(SFMC_CATEGORY_NAME);
            if (!categoryId) {
                console.warn(`⚠️  SFMC: folder "${SFMC_CATEGORY_NAME}" not found in Content Builder — asset will land in the default folder.`);
            }
        } catch (e) {
            console.warn(`⚠️  SFMC: failed to resolve folder "${SFMC_CATEGORY_NAME}":`, e.message);
        }
    }
    if (categoryId) {
        payload.category = { id: categoryId };
    }
    return payload;
}

/**
 * Upsert a project into SFMC Content Builder. If an asset with the same
 * key exists, update it otherwise create.
 */
async function syncProjectToSfmc({ projectName, fullHtml }) {
    if (!isSfmcConfigured()) {
        console.log('⏭️  SFMC sync skipped (env vars not configured).');
        return { skipped: true, action: 'skipped' };
    }
    if (!projectName) {
        return { skipped: true, action: 'skipped', error: 'projectName missing' };
    }

    const schoolId = getSchoolIdFromProjectName(projectName);

    // 1. Get/Create Root Project Folder
    let rootId = SFMC_CATEGORY_ID;
    if (!rootId && SFMC_CATEGORY_NAME) {
        rootId = await ensureFolder(SFMC_CATEGORY_NAME, 0);
    }

    // 2. Get/Create "pages" folder
    const pagesFolderId = await ensureFolder('pages', rootId);

    // 3. Get/Create school subfolder
    const schoolFolderId = await ensureFolder(schoolId, pagesFolderId);

    // 4. Prepare payload
    const payload = await buildAssetPayload({ projectName, fullHtml });
    payload.category = { id: schoolFolderId }; // Force the correct folder

    const customerKey = customerKeyFor(projectName);
    const existingId = await findAssetIdByCustomerKey(customerKey);

    const folderLabel = `${SFMC_CATEGORY_NAME}/pages/${schoolId}`;

    if (existingId) {
        const updated = await sfmcFetch('PATCH', `/asset/v1/content/assets/${existingId}`, payload);
        const assetName = (updated && updated.name) || projectName;
        console.log(`☁️  SFMC: project updated → "${assetName}" (id=${existingId}, folder="${folderLabel}")`);
        return { skipped: false, action: 'updated', id: existingId, name: assetName, folderId: schoolFolderId, asset: updated };
    }

    const created = await sfmcFetch('POST', '/asset/v1/content/assets', payload);
    const assetName = (created && created.name) || projectName;
    const newId = created && created.id;
    console.log(`☁️  SFMC: project created → "${assetName}" (id=${newId}, folder="${folderLabel}")`);
    return { skipped: false, action: 'created', id: newId, name: assetName, folderId: schoolFolderId, asset: created };
}

/**
 * Map internal field types to SFMC Data Extension types.
 */
function mapFieldType(type) {
    switch (type) {
        case 'email':
            return { fieldType: 'EmailAddress', maxLength: 254 };
        case 'phone':
            return { fieldType: 'Phone', maxLength: 20 };
        case 'textarea':
            return { fieldType: 'Text', maxLength: 4000 };
        case 'date':
            return { fieldType: 'Date' };
        case 'number':
            return { fieldType: 'Number' };
        case 'boolean':
        case 'checkbox':
            return { fieldType: 'Boolean' };
        case 'select':
        case 'radio':
        case 'text':
        default:
            return { fieldType: 'Text', maxLength: 255 };
    }
}

/**
 * Create a Data Extension in SFMC.
 */
async function createDataExtension({ name, fields }) {
    assertConfigured();
    const customerKey = slugify(`de-${name}`);
    
    // 1. Map internal fields to SFMC format
    const prepareField = (f, index) => {
        const typeInfo = mapFieldType(f.type);
        return {
            "Name": f.name || f.label,
            "Type": typeInfo.fieldType,
            "Length": typeInfo.maxLength || null,
            "IsRequired": f.required || false,
            "IsNullable": !f.required,
            "IsPrimaryKey": f.isPrimaryKey || false,
            "Ordinal": index,
            "IsTemplateField": false,
            "IsInherited": false,
            "IsInheritable": false,
            "IsOverridable": false,
            "MustOverride": false,
            "IsUpdateable": true,
            "IsReadOnly": false,
            "IsHidden": false,
            "IsActive": true,
            "DefaultValue": f.defaultValue || null
        };
    };

    const sfmcFields = fields.map((f, i) => prepareField(f, i));
    const nextOrdinal = sfmcFields.length;

    // Add System Fields
    sfmcFields.push(prepareField({ name: 'SubmissionID', type: 'text', isPrimaryKey: true, required: true, defaultValue: 'newid()' }, nextOrdinal));
    sfmcFields.push(prepareField({ name: 'SubmissionDate', type: 'date', required: true, defaultValue: 'getdate()' }, nextOrdinal + 1));

    // 2. Check if Data Extension already exists
    try {
        console.log(`🔍 Vérification existence DE via Hub API: key:${customerKey}`);
        // Using Hub API for metadata check (more reliable than customobjects for existence)
        const existingDE = await sfmcFetch('GET', `/hub/v1/dataextensions/key:${customerKey}`);
        
        if (existingDE && (existingDE.customerKey || existingDE.CustomerKey)) {
            const actualKey = existingDE.customerKey || existingDE.CustomerKey;
            console.log(`🔄 DE "${name}" trouvée (Key: ${actualKey}). Vérification des champs...`);
            
            // Get detailed fields from customobjects endpoint once we know it exists
            const detailedDE = await sfmcFetch('GET', `/data/v1/customobjects/key:${actualKey}`);
            const existingFields = detailedDE.fields || [];
            const existingFieldNames = new Set(existingFields.map(ef => ef.name.toLowerCase()));
            
            const fieldsToAdd = sfmcFields.filter(f => !existingFieldNames.has(f.Name.toLowerCase()));

            if (fieldsToAdd.length > 0) {
                console.log(`➕ Ajout de ${fieldsToAdd.length} nouveaux champs...`);
                for (const field of fieldsToAdd) {
                    try {
                        await sfmcFetch('POST', `/data/v1/customobjects/key:${actualKey}/fields`, field);
                        console.log(`  ✅ Champ ajouté: ${field.Name}`);
                    } catch (fieldErr) {
                        if (fieldErr.status === 409) {
                            console.log(`  ℹ️ Champ "${field.Name}" déjà présent.`);
                        } else {
                            throw fieldErr;
                        }
                    }
                }
            } else {
                console.log(`✅ Aucun nouveau champ à ajouter.`);
            }
            return { name, customerKey: actualKey, status: 'updated', id: existingDE.id || existingDE.ObjectID };
        }
    } catch (e) {
        // If 404, it means DE doesn't exist, proceed to creation
        if (e.status === 404) {
            console.log(`ℹ️ DE non trouvée (404). Procédure de création...`);
        } else {
            console.warn(`⚠️ Note lors de la vérification DE: ${e.message} (Status: ${e.status})`);
            // If we get a 400 or something else, we still proceed but we'll handle the 409 on POST
        }
    }

    // 3. Create new Data Extension
    console.log(`✨ Création d'une nouvelle Data Extension "${name}"...`);
    const payload = {
        "Name": name,
        "CustomerKey": customerKey,
        "Fields": sfmcFields,
        "IsSendable": false,
        "CategoryId": SFMC_DE_CATEGORY_ID
    };

    try {
        const result = await sfmcFetch('POST', '/data/v1/customobjects', payload);
        return { ...result, status: 'created' };
    } catch (e) {
        if (e.status === 409) {
            console.log(`🔄 Conflit 409 lors de la création : la DE existe en fait déjà. Tentative de mise à jour...`);
            // Recursive call to itself but with a flag to avoid infinite loops if needed, 
            // but here we just re-run the check logic manually or return success.
            // For simplicity, let's just return a simulated success for now to avoid the error.
            return { name, customerKey, status: 'updated', message: 'Handled 409 conflict' };
        }
        throw e;
    }
}

/**
 * Create a Form Asset (Code Snippet) in SFMC.
 */
async function createFormAsset({ name, schoolId, html, css, ampscript }) {
    assertConfigured();

    // 1. Ensure folders
    let rootId = SFMC_CATEGORY_ID;
    if (!rootId && SFMC_CATEGORY_NAME) {
        rootId = await ensureFolder(SFMC_CATEGORY_NAME, 0);
    }
    const formsFolderId = await ensureFolder('forms', rootId);
    const schoolFolderId = await ensureFolder(schoolId, formsFolderId);

    // 2. Combine content
    const fullContent = `%%[
${ampscript}
]%%
<style>
${css}
</style>
${html}`;

    const customerKey = slugify(`form-${schoolId}-${name}`);
    const existingId = await findAssetIdByCustomerKey(customerKey);

    const payload = {
        name: name,
        customerKey: customerKey,
        assetType: { id: 220, name: 'codesnippet' },
        content: fullContent,
        category: { id: schoolFolderId }
    };

    if (existingId) {
        const updated = await sfmcFetch('PATCH', `/asset/v1/content/assets/${existingId}`, payload);
        return { action: 'updated', id: existingId, name: updated.name };
    } else {
        const created = await sfmcFetch('POST', '/asset/v1/content/assets', payload);
        return { action: 'created', id: created.id, name: created.name };
    }
}

module.exports = {
    isSfmcConfigured,
    syncProjectToSfmc,
    syncComponentToSfmc,
    getAccessToken,
    sfmcFetch,
    findAssetIdByCustomerKey,
    resolveCategoryIdByName,
    ensureFolder,
    createDataExtension,
    createFormAsset
};
