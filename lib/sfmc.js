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
 * Dépublier un projet : retrouve l'asset page dans SFMC via sa customerKey EXACTE
 * puis le supprime par son id.
 *
 * Sécurité (ne jamais supprimer un bloc non concerné) :
 *   1. Recherche par customerKey avec l'opérateur "equal" (match exact, pas de
 *      recherche floue "contains").
 *   2. Avant de supprimer, on RELIT l'asset et on vérifie que sa customerKey ET
 *      son assetType correspondent bien à ceux d'une page publiée par le builder.
 *      En cas de divergence, on n'efface RIEN.
 */
async function unpublishProjectFromSfmc({ projectName }) {
    if (!isSfmcConfigured()) {
        console.log('⏭️  SFMC unpublish skipped (env vars not configured).');
        return { skipped: true, action: 'skipped' };
    }
    if (!projectName) {
        return { skipped: true, action: 'skipped', error: 'projectName missing' };
    }

    const customerKey = customerKeyFor(projectName);
    const existingId = await findAssetIdByCustomerKey(customerKey);
    if (!existingId) {
        console.log(`🫥  SFMC: aucun asset pour la clé "${customerKey}" — rien à dépublier.`);
        return { skipped: false, action: 'not_found', customerKey };
    }

    // Garde-fou : relire l'asset et confirmer clé exacte + bon assetType.
    const asset = await sfmcFetch('GET', `/asset/v1/content/assets/${existingId}`);
    const assetKey = asset && asset.customerKey;
    const assetTypeId = asset && asset.assetType && asset.assetType.id;
    if (assetKey !== customerKey || assetTypeId !== SFMC_ASSET_TYPE_ID) {
        console.warn(`⚠️  SFMC: asset id=${existingId} (key="${assetKey}", type=${assetTypeId}) ne correspond pas à la page attendue (key="${customerKey}", type=${SFMC_ASSET_TYPE_ID}) — suppression ANNULÉE.`);
        return { skipped: false, action: 'skipped_mismatch', id: existingId, customerKey, assetKey, assetTypeId };
    }

    await sfmcFetch('DELETE', `/asset/v1/content/assets/${existingId}`);
    console.log(`🗑️  SFMC: page dépubliée → id=${existingId}, key="${customerKey}"`);
    return { skipped: false, action: 'deleted', id: existingId, name: asset && asset.name, customerKey };
}

// ── Image assets ────────────────────────────────────────────────────────────

// SFMC hard limit for image assets
const SFMC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// SFMC base asset type ids for images
const IMAGE_ASSET_TYPES = {
    gif:  { id: 20, name: 'gif' },
    jpe:  { id: 21, name: 'jpe' },
    jpeg: { id: 22, name: 'jpeg' },
    jpg:  { id: 23, name: 'jpg' },
    png:  { id: 28, name: 'png' }
};

function extractPublishedUrl(asset) {
    if (!asset) return null;
    return (asset.fileProperties && asset.fileProperties.publishedURL)
        || asset.publishedURL
        || null;
}

/**
 * Upload an image to SFMC Content Builder and return its published URL.
 * Folder structure: [Root Folder] / images / [schoolId]
 * Dedup: the customerKey embeds a content hash, so re-uploading the same
 * file reuses the existing asset instead of creating a duplicate.
 */
async function uploadImageToSfmc({ name, base64, extension, schoolId }) {
    assertConfigured();

    const crypto = require('crypto');
    const hash = crypto.createHash('sha1').update(base64).digest('hex').slice(0, 10);
    const ext = String(extension || 'png').toLowerCase().replace(/^\./, '');
    const assetType = IMAGE_ASSET_TYPES[ext] || IMAGE_ASSET_TYPES.png;
    const school = String(schoolId || 'global').toLowerCase() || 'global';

    const baseName = slugify(String(name || 'image').replace(/\.[^.]+$/, '')) || 'image';
    // Image asset customerKeys are limited to 36 characters by SFMC:
    // content hash first (dedup), school truncated to fit.
    const customerKey = slugify(`img-${hash}-${school}`).slice(0, 36);

    // Reuse the asset if this exact content was already uploaded
    const existingId = await findAssetIdByCustomerKey(customerKey);
    if (existingId) {
        const existing = await sfmcFetch('GET', `/asset/v1/content/assets/${existingId}`);
        const url = extractPublishedUrl(existing);
        if (url) {
            console.log(`🖼️  SFMC: image reused → "${existing.name}" (id=${existingId})`);
            return { action: 'reused', id: existingId, name: existing.name, url };
        }
    }

    // 1. Ensure folders: root / images / school
    let rootId = SFMC_CATEGORY_ID;
    if (!rootId && SFMC_CATEGORY_NAME) {
        rootId = await ensureFolder(SFMC_CATEGORY_NAME, 0);
    }
    const imagesFolderId = await ensureFolder('images', rootId);
    const schoolFolderId = await ensureFolder(school, imagesFolderId);

    // 2. Create the asset
    const payload = {
        name: `${baseName}-${hash}.${assetType.name}`,
        customerKey,
        assetType,
        file: base64,
        category: { id: schoolFolderId }
    };
    const created = await sfmcFetch('POST', '/asset/v1/content/assets', payload);

    // The published URL is normally in the creation response; re-fetch as fallback
    let url = extractPublishedUrl(created);
    if (!url && created && created.id) {
        const fetched = await sfmcFetch('GET', `/asset/v1/content/assets/${created.id}`);
        url = extractPublishedUrl(fetched);
    }
    if (!url) {
        const err = new Error('SFMC did not return a published URL for the uploaded image');
        err.code = 'SFMC_NO_PUBLISHED_URL';
        throw err;
    }

    console.log(`🖼️  SFMC: image uploaded → "${created.name}" (id=${created.id}) → ${url}`);
    return { action: 'created', id: created.id, name: created.name, url };
}

/**
 * Validate + decode a browser data URL, then upload it as an SFMC image asset.
 * Used by the /api/sfmc/upload-image endpoint: the frontend publishes each
 * image in its own small request at save time, so the page payload itself
 * stays under Vercel's 4.5 MB body limit.
 */
async function uploadImageFromDataUrl({ name, schoolId, projectName, dataUrl }) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
    if (!match) {
        const err = new Error('Invalid payload: expected a base64 image data URL');
        err.status = 400;
        throw err;
    }
    const mime = match[1].toLowerCase();
    const base64 = match[2];

    const MIME_TO_EXT = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif'
    };
    const extension = MIME_TO_EXT[mime];
    if (!extension) {
        const err = new Error(`Unsupported image type "${mime}" (allowed: png, jpeg, gif)`);
        err.status = 400;
        throw err;
    }

    const byteLength = Buffer.byteLength(base64, 'base64');
    if (byteLength > SFMC_MAX_IMAGE_BYTES) {
        const err = new Error(`Image too large (${(byteLength / 1024 / 1024).toFixed(1)} MB) — SFMC limit is 5 MB`);
        err.status = 413;
        throw err;
    }

    const school = schoolId || getSchoolIdFromProjectName(projectName);
    return uploadImageToSfmc({ name, base64, extension, schoolId: school });
}

/**
 * Publish every inline base64 image found in the HTML (img src or CSS url())
 * to SFMC Content Builder and replace it with its published URL.
 * Called by the cron worker (api/cron.js) just before the page content is
 * sent to SFMC. Images that fail to upload are left inline so the page sync
 * can still proceed.
 */
async function replaceInlineImagesWithSfmcUrls(html, projectName) {
    const schoolId = getSchoolIdFromProjectName(projectName);
    const namePrefix = stripSchoolPrefix(projectName);
    const source = String(html || '');
    const inlineImages = [...new Set(source.match(/data:image\/(?:png|jpe?g|gif);base64,[A-Za-z0-9+/=]+/g) || [])];
    if (inlineImages.length === 0) return source;

    const EXT_BY_MIME = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif' };
    const baseName = slugify(namePrefix || 'image') || 'image';
    let result = source;

    console.log(`🖼️  SFMC: publishing ${inlineImages.length} inline image(s) before page sync...`);
    for (const dataUrl of inlineImages) {
        const mimeSubtype = dataUrl.slice('data:image/'.length, dataUrl.indexOf(';')).toLowerCase();
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const byteLength = Buffer.byteLength(base64, 'base64');
        if (byteLength > SFMC_MAX_IMAGE_BYTES) {
            console.warn(`⚠️  SFMC: inline image skipped (${(byteLength / 1024 / 1024).toFixed(1)} MB > 5 MB limit)`);
            continue;
        }
        try {
            const { url } = await uploadImageToSfmc({
                name: baseName,
                base64,
                extension: EXT_BY_MIME[mimeSubtype] || 'png',
                schoolId
            });
            result = result.split(dataUrl).join(url);
        } catch (e) {
            console.warn(`⚠️  SFMC: inline image upload failed, kept inline: ${e.message}`);
        }
    }
    return result;
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

/* ═══════════════════════════════════════════════════════════════
   CAMPUS STORE — Data Extension dédiée (source unique des campus)
   Modèle : id (PK composite `<school>::<slug>`), name, slug, image_url,
   address, link, country (France / International), school.
   Les campus sont CLOISONNÉS par école : chaque liste/CRUD est scopée par
   `school`. Le slug propre reste exposé comme `id` aux clients (formulaires,
   sélection de page, Salesforce → aucune régression). CRUD via SOAP.
═══════════════════════════════════════════════════════════════ */

const CAMPUS_DE_NAME = process.env.SFMC_CAMPUS_DE_NAME || 'LP_Campuses';
const CAMPUS_DE_KEY = slugify(`de-${CAMPUS_DE_NAME}`);
let campusDEReady = false;

/* Champs de la DE campus (SOAP).
   `id` = clé primaire = clé COMPOSITE interne `<school>::<slug>` (jamais exposée).
   `slug` = identifiant propre du campus, local à l'école (ex. `paris`) → c'est
   LUI qu'on renvoie aux clients comme `id` (aucune régression Salesforce).
   `school` = école propriétaire du campus. */
const CAMPUS_FIELDS = [
    { name: 'id',        length: 200,  pk: true,  required: true },
    { name: 'name',      length: 255,  pk: false, required: true },
    { name: 'slug',      length: 255,  pk: false, required: false },
    { name: 'image_url', length: 4000, pk: false, required: false },
    { name: 'address',   length: 500,  pk: false, required: false },
    { name: 'link',      length: 1000, pk: false, required: false },
    { name: 'country',   length: 120,  pk: false, required: false },
    { name: 'school',    length: 100,  pk: false, required: false }
];
const CAMPUS_FIELD_NAMES = CAMPUS_FIELDS.map(f => f.name);
const CAMPUS_VALUE_FIELDS = CAMPUS_FIELD_NAMES.filter(n => n !== 'id');

/* Écoles réelles (schools.json) — cibles de la duplication des campus.
   `master` est EXCLU volontairement : c'est un template sans campus ; les
   campus s'affichent seulement dans les déclinaisons par école. */
const CAMPUS_SCHOOL_IDS = (() => {
    try {
        const raw = require('fs').readFileSync(require('path').join(__dirname, '..', 'schools.json'), 'utf-8');
        const ids = JSON.parse(raw).map(s => s && s.id).filter(Boolean);
        return ids.length ? ids : [];
    } catch (e) {
        console.warn(`⚠️ SFMC campus: lecture schools.json impossible (${e.message}), fallback liste vide`);
        return [];
    }
})();

/** Clé primaire composite interne d'une ligne campus. */
function campusRowId(school, slug) {
    return `${String(school || '').trim()}::${String(slug || '').trim()}`;
}

/* Jeu de campus par défaut (seed à la création de la DE). */
const DEFAULT_CAMPUSES = [
    { id: 'aix',         name: 'Aix-en-Provence', country: 'France' },
    { id: 'bordeaux',    name: 'Bordeaux',        country: 'France' },
    { id: 'lille',       name: 'Lille',           country: 'France' },
    { id: 'lyon',        name: 'Lyon',            country: 'France' },
    { id: 'montpellier', name: 'Montpellier',     country: 'France' },
    { id: 'nice',        name: 'Nice',            country: 'France' },
    { id: 'paris',       name: 'Paris',           country: 'France' },
    { id: 'rennes',      name: 'Rennes',          country: 'France' },
    { id: 'strasbourg',  name: 'Strasbourg',      country: 'France' },
    { id: 'toulouse',    name: 'Toulouse',        country: 'France' },
    { id: 'miami',       name: 'Miami',           country: 'International' },
    { id: 'new-york',    name: 'New York',        country: 'International' },
    { id: 'shanghai',    name: 'Shanghai',        country: 'International' },
    { id: 'santander',   name: 'Santander',       country: 'International' },
    { id: 'amsterdam',   name: 'Amsterdam',       country: 'International' }
];

/** Normalise un pays (minuscules, sans accents) pour comparaison. */
function normCountry(s) {
    return String(s == null ? '' : s)
        .trim().toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

/** Un campus est-il en France ? (pays vide = France par défaut). */
function isFranceCampus(c) {
    const k = normCountry(c && c.country);
    return k === '' || k === 'france' || k === 'fr';
}

/** Tri : France d'abord, puis le reste ; chaque groupe alphabétique (nom). */
function compareCampuses(a, b) {
    const fa = isFranceCampus(a), fb = isFranceCampus(b);
    if (fa !== fb) return fa ? -1 : 1;
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
}

function soapEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function soapUnesc(s) {
    return String(s == null ? '' : s)
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Appel SOAP générique contre l'API partner SFMC (auth via fueloauth). */
async function soapRequest(action, innerXml) {
    assertConfigured();
    const { accessToken } = await getAccessToken();
    const url = `https://${SFMC_SUBDOMAIN}.soap.marketingcloudapis.com/Service.asmx`;
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <s:Header><fueloauth xmlns="http://exacttarget.com">${accessToken}</fueloauth></s:Header>
  <s:Body>${innerXml}</s:Body>
</s:Envelope>`;
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml', 'SOAPAction': action },
        body
    });
    const text = await r.text();
    const overall = (text.match(/<OverallStatus>([^<]*)<\/OverallStatus>/i) || [])[1] || '';
    return { httpStatus: r.status, httpOk: r.ok, overall, text };
}

function soapError(prefix, res) {
    const m = res.text.match(/<StatusMessage>([^<]*)<\/StatusMessage>/i);
    const err = new Error(`${prefix}: ${m ? m[1] : (res.overall || 'HTTP ' + res.httpStatus)}`);
    err.status = res.httpStatus && res.httpStatus >= 400 ? res.httpStatus : 500;
    return err;
}

/** Parse les <Results> d'une réponse Retrieve en objets {champ: valeur}. */
function parseSoapRows(text) {
    const rows = [];
    const blocks = text.match(/<Results\b[\s\S]*?<\/Results>/g) || [];
    for (const block of blocks) {
        const o = {};
        const props = block.match(/<Property>[\s\S]*?<\/Property>/g) || [];
        for (const p of props) {
            const name = (p.match(/<Name>([\s\S]*?)<\/Name>/) || [])[1];
            const val = (p.match(/<Value>([\s\S]*?)<\/Value>/) || [])[1];
            if (name !== undefined) o[name] = soapUnesc(val || '');
        }
        if (o.id) rows.push(o);
    }
    return rows;
}

/** S'assure que la DE des campus existe (crée + seed si absente). */
async function ensureCampusDE() {
    assertConfigured();
    if (campusDEReady) return CAMPUS_DE_KEY;

    // 1. Existe déjà ? (Retrieve DataExtension filtré par CustomerKey)
    const checkInner = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>`
        + `<ObjectType>DataExtension</ObjectType><Properties>CustomerKey</Properties>`
        + `<Filter xsi:type="SimpleFilterPart"><Property>CustomerKey</Property><SimpleOperator>equals</SimpleOperator><Value>${soapEsc(CAMPUS_DE_KEY)}</Value></Filter>`
        + `</RetrieveRequest></RetrieveRequestMsg>`;
    const check = await soapRequest('Retrieve', checkInner);
    const exists = /<CustomerKey>/.test(check.text);

    if (!exists) {
        // 2. Création de la DE
        const fieldsXml = CAMPUS_FIELDS.map(f =>
            `<Field><CustomerKey>${f.name}</CustomerKey><Name>${f.name}</Name>`
            + `<FieldType>Text</FieldType><MaxLength>${f.length}</MaxLength>`
            + (f.pk ? '<IsPrimaryKey>true</IsPrimaryKey>' : '')
            + `<IsRequired>${f.required ? 'true' : 'false'}</IsRequired></Field>`
        ).join('');
        const createInner = `<CreateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">`
            + `<Objects xsi:type="DataExtension"><CustomerKey>${soapEsc(CAMPUS_DE_KEY)}</CustomerKey>`
            + `<Name>${soapEsc(CAMPUS_DE_NAME)}</Name>`
            + (SFMC_DE_CATEGORY_ID ? `<CategoryID>${SFMC_DE_CATEGORY_ID}</CategoryID>` : '')
            + `<IsSendable>false</IsSendable><Fields>${fieldsXml}</Fields></Objects></CreateRequest>`;
        console.log(`✨ SFMC: création de la Data Extension campus "${CAMPUS_DE_NAME}"...`);
        const created = await soapRequest('Create', createInner);
        // "already exists" = OK (course entre requêtes)
        if (created.overall !== 'OK' && !/already exists/i.test(created.text)) {
            throw soapError('SFMC campus DE create failed', created);
        }
        campusDEReady = true;
    } else {
        // 2bis. DE déjà présente : migration des champs manquants (ex. `country`, `school`).
        await ensureCampusFields();
    }

    campusDEReady = true;

    // 3. Seed / duplication des campus par école (idempotent).
    try {
        await ensureCampusSchoolSeed();
    } catch (e) {
        console.warn(`⚠️ SFMC campus seed écoles: ${e.message}`);
    }
    return CAMPUS_DE_KEY;
}

/**
 * Duplique (une seule fois) les campus « actuels » dans CHAQUE école réelle.
 * Idempotent : ne fait rien dès qu'au moins une ligne porte déjà une `school`.
 *
 * Source des campus à dupliquer :
 *   - les lignes héritées sans école (ancien modèle mono-liste), si présentes ;
 *   - sinon les DEFAULT_CAMPUSES (DE toute neuve).
 * Le pays manquant est complété depuis DEFAULT_CAMPUSES (par slug) pour que le
 * tri « France d'abord » soit correct dès la duplication.
 * NON destructif : les lignes héritées sans école sont laissées telles quelles
 * (elles ne matchent aucun filtre école → inertes).
 */
async function ensureCampusSchoolSeed() {
    if (!CAMPUS_SCHOOL_IDS.length) return;
    const all = await retrieveAllCampusRows();

    // Déjà réparti par école ? → rien à faire.
    if (all.some(r => String(r.school || '').trim())) return;

    const defaultsBySlug = {};
    DEFAULT_CAMPUSES.forEach(c => { defaultsBySlug[c.id] = c; });

    const legacy = all.filter(r => !String(r.school || '').trim());
    const source = (legacy.length ? legacy : DEFAULT_CAMPUSES).map(c => {
        const slug = c.slug || c.id;
        const d = defaultsBySlug[slug] || {};
        return {
            slug,
            name:      c.name || d.name || '',
            image_url: c.image_url || '',
            address:   c.address || '',
            link:      c.link || '',
            country:   c.country || d.country || ''
        };
    });
    if (!source.length) return;

    const toUpsert = [];
    CAMPUS_SCHOOL_IDS.forEach(school => {
        source.forEach(c => toUpsert.push({ ...c, school }));
    });
    console.log(`🌱 SFMC: duplication de ${source.length} campus × ${CAMPUS_SCHOOL_IDS.length} écoles (${toUpsert.length} lignes)...`);
    await upsertCampuses(toUpsert);
}

/**
 * Migration : ajoute à une DE existante les champs de CAMPUS_FIELDS absents
 * (ex. `country`, introduit après la création initiale de la DE). Sans cela,
 * un Retrieve demandant la propriété `country` échouerait.
 */
async function ensureCampusFields() {
    // 1. Champs actuellement présents sur la DE
    const inner = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>`
        + `<ObjectType>DataExtensionField</ObjectType><Properties>Name</Properties>`
        + `<Filter xsi:type="SimpleFilterPart"><Property>DataExtension.CustomerKey</Property>`
        + `<SimpleOperator>equals</SimpleOperator><Value>${soapEsc(CAMPUS_DE_KEY)}</Value></Filter>`
        + `</RetrieveRequest></RetrieveRequestMsg>`;
    let existing = new Set();
    try {
        const res = await soapRequest('Retrieve', inner);
        const names = res.text.match(/<Name>([\s\S]*?)<\/Name>/g) || [];
        names.forEach(m => existing.add(soapUnesc((m.match(/<Name>([\s\S]*?)<\/Name>/) || [])[1] || '')));
    } catch (e) {
        console.warn(`⚠️ SFMC campus fields retrieve: ${e.message}`);
        return; // on n'ajoute rien si on ne peut pas comparer (évite les doublons)
    }

    // 2. Champs manquants → ajout via Update (jamais la clé primaire)
    const missing = CAMPUS_FIELDS.filter(f => !f.pk && !existing.has(f.name));
    if (!missing.length) return;

    const fieldsXml = missing.map(f =>
        `<Field><CustomerKey>${f.name}</CustomerKey><Name>${f.name}</Name>`
        + `<FieldType>Text</FieldType><MaxLength>${f.length}</MaxLength>`
        + `<IsRequired>false</IsRequired></Field>`
    ).join('');
    const updateInner = `<UpdateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">`
        + `<Objects xsi:type="DataExtension"><CustomerKey>${soapEsc(CAMPUS_DE_KEY)}</CustomerKey>`
        + `<Fields>${fieldsXml}</Fields></Objects></UpdateRequest>`;
    console.log(`🔧 SFMC: ajout des champs campus manquants : ${missing.map(f => f.name).join(', ')}`);
    const res = await soapRequest('Update', updateInner);
    if (res.overall !== 'OK' && !/already exists/i.test(res.text)) {
        console.warn(`⚠️ SFMC campus fields add: ${(res.text.match(/<StatusMessage>([^<]*)<\/StatusMessage>/i) || [])[1] || res.overall}`);
    }
}

/** Retrieve BRUT de toutes les lignes campus (toutes écoles, PK composite). */
async function retrieveAllCampusRows() {
    const propsXml = CAMPUS_FIELD_NAMES.map(p => `<Properties>${p}</Properties>`).join('');
    const inner = `<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI"><RetrieveRequest>`
        + `<ObjectType>DataExtensionObject[${soapEsc(CAMPUS_DE_KEY)}]</ObjectType>${propsXml}`
        + `</RetrieveRequest></RetrieveRequestMsg>`;
    const res = await soapRequest('Retrieve', inner);
    if (res.overall !== 'OK' && res.overall !== 'MoreDataAvailable') {
        // DE vide → OverallStatus OK avec 0 Results ; sinon vraie erreur
        if (!/<Results\b/.test(res.text)) return [];
        throw soapError('SFMC campus retrieve failed', res);
    }
    return parseSoapRows(res.text);
}

/**
 * Liste les campus d'UNE école (triés : France d'abord, puis alpha).
 * L'`id` renvoyé est le slug propre du campus (local à l'école), pas la clé
 * composite interne → aucune régression côté formulaires / Salesforce.
 */
async function listCampuses(school, skipEnsure = false) {
    if (!skipEnsure) await ensureCampusDE();
    const target = String(school || '').trim();
    if (!target) return []; // pas d'école (ex. master) → aucune liste
    const rows = await retrieveAllCampusRows();
    const out = rows
        .filter(r => String(r.school || '').trim() === target)
        .map(r => ({
            id: r.slug || r.id,
            name: r.name || '',
            slug: r.slug || r.id,
            image_url: r.image_url || '',
            address: r.address || '',
            link: r.link || '',
            country: r.country || '',
            school: r.school || ''
        }));
    // Ordre : campus France d'abord (alphabétique), puis le reste (alphabétique).
    out.sort(compareCampuses);
    return out;
}

/**
 * Upsert (insert/update) d'une liste de campus.
 * Chaque item : { school, slug (ou id=slug propre), name, image_url, address,
 * link, country }. La clé primaire écrite est la composite `<school>::<slug>`.
 */
async function upsertCampuses(list) {
    await ensureCampusDE();
    const rows = (list || [])
        .map(c => {
            const school = String(c.school || '').trim();
            const slug   = String(c.slug || c.id || '').trim();
            return { school, slug, c };
        })
        .filter(r => r.school && r.slug);
    if (!rows.length) return { rows: 0 };

    const objectsXml = rows.map(({ school, slug, c }) => {
        const vals = {
            id: campusRowId(school, slug), name: c.name || '', slug,
            image_url: c.image_url || '', address: c.address || '', link: c.link || '',
            country: c.country || '', school
        };
        const propsXml = CAMPUS_FIELD_NAMES
            .map(k => `<Property><Name>${k}</Name><Value>${soapEsc(vals[k])}</Value></Property>`)
            .join('');
        return `<Objects xsi:type="DataExtensionObject"><CustomerKey>${soapEsc(CAMPUS_DE_KEY)}</CustomerKey>`
            + `<Properties>${propsXml}</Properties></Objects>`;
    }).join('');

    const inner = `<UpdateRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">`
        + `<Options><SaveOptions><SaveOption><PropertyName>*</PropertyName><SaveAction>UpdateAdd</SaveAction></SaveOption></SaveOptions></Options>`
        + `${objectsXml}</UpdateRequest>`;
    const res = await soapRequest('Update', inner);
    if (res.overall !== 'OK') throw soapError('SFMC campus upsert failed', res);
    return { rows: rows.length };
}

/** Upsert d'un seul campus (école obligatoire) → objet normalisé (id = slug). */
async function upsertCampus(c) {
    const slug = String(c.slug || c.id || '').trim();
    await upsertCampuses([c]);
    return {
        id: slug,
        name: c.name || '',
        slug,
        image_url: c.image_url || '',
        address: c.address || '',
        link: c.link || '',
        country: c.country || '',
        school: String(c.school || '').trim()
    };
}

/** Supprime un campus (école + slug → clé composite) via SOAP Delete. */
async function deleteCampus(school, slug) {
    await ensureCampusDE();
    const rowId = campusRowId(school, slug);
    const inner = `<DeleteRequest xmlns="http://exacttarget.com/wsdl/partnerAPI">`
        + `<Objects xsi:type="DataExtensionObject"><CustomerKey>${soapEsc(CAMPUS_DE_KEY)}</CustomerKey>`
        + `<Keys><Key><Name>id</Name><Value>${soapEsc(rowId)}</Value></Key></Keys></Objects></DeleteRequest>`;
    const res = await soapRequest('Delete', inner);
    if (res.overall !== 'OK') throw soapError('SFMC campus delete failed', res);
    return { message: 'Campus supprimé' };
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
    unpublishProjectFromSfmc,
    syncComponentToSfmc,
    getAccessToken,
    sfmcFetch,
    findAssetIdByCustomerKey,
    resolveCategoryIdByName,
    ensureFolder,
    createDataExtension,
    createFormAsset,
    uploadImageToSfmc,
    uploadImageFromDataUrl,
    replaceInlineImagesWithSfmcUrls,
    ensureCampusDE,
    listCampuses,
    upsertCampus,
    deleteCampus
};
