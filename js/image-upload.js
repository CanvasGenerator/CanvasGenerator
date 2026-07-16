/**
 * Gestion des images uploadées dans le builder.
 *
 * Flux : fichier local → compression si trop lourd → l'image reste dans la page
 * en data URL (base64). C'est au moment de l'envoi du contenu vers SFMC
 * (syncProjectToSfmc côté serveur) que chaque image inline est publiée dans
 * Content Builder et remplacée par son URL publique.
 *
 * Limites :
 *  - SFMC refuse les images > 5 Mo (SFMC_MAX_IMAGE_BYTES).
 *  - L'image transite en base64 dans le HTML sauvegardé (+37 %) : on compresse
 *    dès que le binaire dépasse TARGET_IMAGE_BYTES (3 Mo) pour limiter le poids
 *    de la page avant publication.
 */

const SFMC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 3 * 1024 * 1024;

// Types publiables tels quels dans SFMC (assets image)
const PASSTHROUGH_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Lecture du fichier "${file.name}" impossible`));
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Décodage de l\'image impossible'));
        img.src = dataUrl;
    });
}

// Taille binaire réelle d'un data URL base64
function dataUrlBytes(dataUrl) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Math.floor(base64.length * 3 / 4);
}

function encodeToCanvas(img, scale, mimeType, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (mimeType === 'image/jpeg') {
        // JPEG n'a pas de transparence : aplatir sur fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mimeType, quality);
}

function renameExtension(filename, ext) {
    return String(filename || 'image').replace(/\.[^.]+$/, '') + '.' + ext;
}

/**
 * Retourne { dataUrl, name } prêt à être inséré dans la page.
 * Compresse (ré-encode via canvas) uniquement si nécessaire.
 */
export async function prepareImageForUpload(file) {
    const isPassthrough = PASSTHROUGH_TYPES.includes(file.type);
    if (isPassthrough && file.size <= TARGET_IMAGE_BYTES) {
        return { dataUrl: await fileToDataUrl(file), name: file.name };
    }

    // Un GIF ré-encodé via canvas perd son animation : on refuse plutôt que dégrader
    if (file.type === 'image/gif') {
        throw new Error(`Le GIF "${file.name}" dépasse ${Math.round(TARGET_IMAGE_BYTES / 1024 / 1024)} Mo et ne peut pas être compressé sans perdre l'animation`);
    }

    const img = await loadImage(await fileToDataUrl(file));

    // SVG rasterisé → PNG (transparence conservée), sinon JPEG
    const preferPng = file.type === 'image/svg+xml';
    const attempts = preferPng
        ? [
            { mime: 'image/png', scale: 1 },
            { mime: 'image/png', scale: 0.75 },
            { mime: 'image/jpeg', scale: 1, quality: 0.85 },
            { mime: 'image/jpeg', scale: 0.75, quality: 0.7 },
            { mime: 'image/jpeg', scale: 0.5, quality: 0.6 }
        ]
        : [
            { mime: 'image/jpeg', scale: 1, quality: 0.85 },
            { mime: 'image/jpeg', scale: 1, quality: 0.7 },
            { mime: 'image/jpeg', scale: 0.85, quality: 0.7 },
            { mime: 'image/jpeg', scale: 0.7, quality: 0.6 },
            { mime: 'image/jpeg', scale: 0.5, quality: 0.6 },
            { mime: 'image/jpeg', scale: 0.35, quality: 0.5 }
        ];

    for (const attempt of attempts) {
        const dataUrl = encodeToCanvas(img, attempt.scale, attempt.mime, attempt.quality);
        if (dataUrlBytes(dataUrl) <= TARGET_IMAGE_BYTES) {
            const ext = attempt.mime === 'image/png' ? 'png' : 'jpg';
            return { dataUrl, name: renameExtension(file.name, ext) };
        }
    }

    throw new Error(`Impossible de compresser "${file.name}" sous ${Math.round(SFMC_MAX_IMAGE_BYTES / 1024 / 1024)} Mo`);
}

const DATA_URL_REGEX = /data:image\/(?:png|jpe?g|gif);base64,[A-Za-z0-9+/=]+/g;

/**
 * Publie un data URL comme asset image SFMC (une requête par image, pour
 * rester sous la limite Vercel de 4,5 Mo par requête). Retourne l'URL publiée.
 */
async function uploadDataUrlToSfmc(dataUrl, name, projectName) {
    const response = await fetch('/api/sfmc/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectName, dataUrl })
    });
    let payload = null;
    try { payload = await response.json(); } catch (e) { /* réponse non-JSON */ }
    if (!response.ok) {
        throw new Error((payload && payload.error) || `Upload SFMC échoué (HTTP ${response.status})`);
    }
    if (!payload || !payload.url) {
        throw new Error('SFMC n\'a pas renvoyé d\'URL publiée pour l\'image');
    }
    return payload.url;
}

/**
 * Publie dans SFMC toutes les images inline (base64) contenues dans une chaîne
 * (payload JSON de /api/save, HTML…) et les remplace par leur URL publiée.
 * Retourne { body, mapping } : la chaîne remplacée + la map dataUrl → URL.
 * `assetNames` (optionnel) : map dataUrl → nom de fichier pour nommer les assets.
 */
export async function publishInlineImagesInString(str, projectName, assetNames) {
    const found = [...new Set(String(str || '').match(DATA_URL_REGEX) || [])];
    const mapping = new Map();
    if (found.length === 0) return { body: str, mapping };

    let body = str;
    for (const dataUrl of found) {
        const name = (assetNames && assetNames.get(dataUrl)) || 'image';
        const url = await uploadDataUrlToSfmc(dataUrl, name, projectName);
        mapping.set(dataUrl, url);
        body = body.split(dataUrl).join(url);
    }
    return { body, mapping };
}

/**
 * Map dataUrl → nom de fichier à partir de l'Asset Manager de l'éditeur,
 * pour donner des noms lisibles aux assets SFMC.
 */
export function collectAssetNames(editor) {
    const names = new Map();
    try {
        editor.AssetManager.getAll().forEach(a => {
            const src = a.get('src');
            if (src && src.startsWith('data:')) names.set(src, a.get('name') || 'image');
        });
    } catch (e) { /* asset manager indisponible */ }
    return names;
}

/**
 * Répercute les URLs publiées dans l'éditeur (composants img, styles inline,
 * règles CSS, Asset Manager) pour que les prochaines sauvegardes et
 * l'autosave localStorage ne contiennent plus de base64.
 */
export function applyImageMapToEditor(editor, mapping) {
    if (!mapping || mapping.size === 0) return;
    const replaceValue = (value) => {
        if (typeof value !== 'string' || !value.includes('data:image/')) return value;
        let out = value;
        mapping.forEach((url, dataUrl) => { out = out.split(dataUrl).join(url); });
        return out;
    };
    try {
        editor.getWrapper().onAll(comp => {
            const src = comp.get('src');
            if (typeof src === 'string' && mapping.has(src)) comp.set('src', mapping.get(src));
            const attrs = comp.getAttributes() || {};
            if (typeof attrs.src === 'string' && mapping.has(attrs.src)) {
                comp.addAttributes({ src: mapping.get(attrs.src) });
            }
            const style = comp.getStyle() || {};
            let styleChanged = false;
            for (const key of Object.keys(style)) {
                const next = replaceValue(style[key]);
                if (next !== style[key]) { style[key] = next; styleChanged = true; }
            }
            if (styleChanged) comp.setStyle(style);
        });
        editor.Css.getRules().forEach(rule => {
            const style = rule.getStyle() || {};
            let changed = false;
            for (const key of Object.keys(style)) {
                const next = replaceValue(style[key]);
                if (next !== style[key]) { style[key] = next; changed = true; }
            }
            if (changed) rule.setStyle(style);
        });
        editor.AssetManager.getAll().forEach(asset => {
            const src = asset.get('src');
            if (mapping.has(src)) asset.set('src', mapping.get(src));
        });
    } catch (e) {
        console.warn('applyImageMapToEditor:', e.message);
    }
}

/**
 * Handler GrapesJS `assetManager.uploadFile` : intercepte les fichiers déposés
 * ou sélectionnés, les compresse si besoin et les ajoute à l'Asset Manager en
 * data URL. La publication SFMC a lieu plus tard, à l'envoi de la page.
 */
export function createImageUploadHandler(getEditor) {
    return async (ev) => {
        const files = Array.from((ev.dataTransfer ? ev.dataTransfer.files : ev.target.files) || []);
        const editor = getEditor();

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                alert(`Erreur : "${file.name}" n'est pas une image`);
                continue;
            }
            try {
                const { dataUrl, name } = await prepareImageForUpload(file);
                editor.AssetManager.add({ src: dataUrl, name });
                alert(`Image "${file.name}" ajoutée — elle sera publiée sur SFMC lors de l'envoi de la page`);
            } catch (e) {
                console.error('Ajout image:', e);
                alert(`Erreur image "${file.name}" : ${e.message}`);
            }
        }
    };
}
