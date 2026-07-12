/**
 * Upload d'images vers SFMC depuis le builder.
 *
 * Flux : fichier local → compression si trop lourd → POST /api/sfmc/upload-image
 * → l'image est publiée dans Content Builder et son URL publique remplace
 * le fichier local dans le HTML de la page.
 *
 * Limites :
 *  - SFMC refuse les images > 5 Mo (SFMC_MAX_IMAGE_BYTES).
 *  - Le corps de requête est limité à ~4,5 Mo sur Vercel ; comme l'image
 *    transite en base64 (+37 %), on compresse dès que le binaire dépasse
 *    TARGET_IMAGE_BYTES (3 Mo) pour rester sous les deux plafonds.
 */

const SFMC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 3 * 1024 * 1024;

// Types acceptés tels quels par le backend (assets image SFMC)
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
 * Retourne { dataUrl, name } prêt à envoyer au backend.
 * Compresse (ré-encode via canvas) uniquement si nécessaire.
 */
async function prepareImageForUpload(file) {
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

/**
 * Compresse si besoin puis publie l'image dans SFMC Content Builder.
 * Retourne { url, id, name, action } — url est l'URL publique SFMC.
 */
export async function uploadImageAsset(file, schoolId) {
    const { dataUrl, name } = await prepareImageForUpload(file);

    const response = await fetch('/api/sfmc/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schoolId, dataUrl })
    });

    let payload = null;
    try { payload = await response.json(); } catch (e) { /* réponse non-JSON */ }

    if (!response.ok) {
        throw new Error((payload && payload.error) || `Upload SFMC échoué (HTTP ${response.status})`);
    }
    if (!payload || !payload.url) {
        throw new Error('SFMC n\'a pas renvoyé d\'URL publiée pour l\'image');
    }
    return payload;
}

/**
 * Handler GrapesJS `assetManager.uploadFile` : intercepte les fichiers déposés
 * ou sélectionnés, les publie dans SFMC et ajoute l'URL publiée à l'Asset Manager.
 */
export function createSfmcUploadHandler(getEditor, schoolId) {
    return async (ev) => {
        const files = Array.from((ev.dataTransfer ? ev.dataTransfer.files : ev.target.files) || []);
        const editor = getEditor();

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                alert(`Erreur : "${file.name}" n'est pas une image`);
                continue;
            }
            try {
                alert(`Upload de "${file.name}" vers SFMC…`);
                const { url } = await uploadImageAsset(file, schoolId);
                editor.AssetManager.add({ src: url, name: file.name });
                alert(`Image "${file.name}" publiée sur SFMC`);
            } catch (e) {
                console.error('Upload image SFMC:', e);
                alert(`Erreur upload "${file.name}" : ${e.message}`);
            }
        }
    };
}
