/**
 * Registre central des fonts du projet + helpers de branding (couleurs/fonts).
 *
 * Fichier UNIVERSEL : utilisable côté Node (api/schools.js, server.js via
 * `require('../js/fonts')`) ET côté navigateur (via `<script src="js/fonts.js">`
 * qui expose `window.ReetainFonts`).
 *
 * Source unique de vérité : ne jamais dupliquer la liste des fonts ni la
 * dérivation des couleurs ailleurs.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;            // Node (CommonJS)
    }
    if (typeof window !== 'undefined') {
        window.ReetainFonts = api;       // Navigateur
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ── Fonts disponibles dans le projet (auto-hébergées, voir css/fonts.css) ──
    const PROJECT_FONTS = [
        { id: 'gotham',        name: 'Gotham',        stack: "'Gotham', Arial, sans-serif" },
        { id: 'space-grotesk', name: 'Space Grotesk', stack: "'Space Grotesk', 'Segoe UI', sans-serif" }
    ];

    // ── Fonts Google additionnelles (chargées dynamiquement dans l'éditeur) ──
    const GOOGLE_FONTS = [
        { id: 'roboto',     name: 'Roboto',     stack: "'Roboto', sans-serif" },
        { id: 'open-sans',  name: 'Open Sans',  stack: "'Open Sans', sans-serif" },
        { id: 'montserrat', name: 'Montserrat', stack: "'Montserrat', sans-serif" },
        { id: 'lato',       name: 'Lato',       stack: "'Lato', sans-serif" },
        { id: 'poppins',    name: 'Poppins',    stack: "'Poppins', sans-serif" },
        { id: 'inter',      name: 'Inter',      stack: "'Inter', sans-serif" },
        { id: 'oswald',     name: 'Oswald',     stack: "'Oswald', sans-serif" },
        { id: 'raleway',    name: 'Raleway',    stack: "'Raleway', sans-serif" }
    ];

    // Font appliquée par défaut si l'école n'a rien configuré.
    const DEFAULT_FONT_ID = 'gotham';

    // ── Les 16 rôles de couleurs (ordre = ordre d'affichage dans le formulaire) ─
    const COLOR_ROLES = [
        { key: 'primary',          label: 'Primary' },
        { key: 'secondary',        label: 'Secondary' },
        { key: 'accent',           label: 'Accent' },
        { key: 'background',       label: 'Background' },
        { key: 'surface',          label: 'Surface' },
        { key: 'text',             label: 'Text' },
        { key: 'mutedText',        label: 'Muted Text' },
        { key: 'border',           label: 'Border' },
        { key: 'buttonBackground', label: 'Button Background' },
        { key: 'buttonHover',      label: 'Button Hover' },
        { key: 'buttonText',       label: 'Button Text' },
        { key: 'link',             label: 'Link' },
        { key: 'linkHover',        label: 'Link Hover' },
        { key: 'success',          label: 'Success' },
        { key: 'warning',          label: 'Warning' },
        { key: 'error',            label: 'Error' }
    ];

    // Réseaux sociaux gérés par école (ordre = ordre d'affichage des icônes footer).
    const SOCIAL_ROLES = [
        { key: 'instagram', label: 'Instagram' },
        { key: 'facebook',  label: 'Facebook' },
        { key: 'tiktok',    label: 'TikTok' },
        { key: 'linkedin',  label: 'LinkedIn' },
        { key: 'youtube',   label: 'YouTube' }
    ];
    const SOCIAL_KEYS = SOCIAL_ROLES.map(r => r.key);

    function fontById(id) {
        return PROJECT_FONTS.find(f => f.id === id) || null;
    }

    function fontStackById(id) {
        const f = fontById(id);
        return f ? f.stack : PROJECT_FONTS[0].stack;
    }

    // ── Helpers couleur ──────────────────────────────────────────────────────
    function normalizeHex(color, fallback) {
        if (typeof color !== 'string') return fallback;
        let c = color.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(c)) {
            return c[0] === '#' ? c.toLowerCase() : '#' + c.toLowerCase();
        }
        if (/^#?[0-9a-fA-F]{3}$/.test(c)) {
            c = c.replace('#', '');
            return '#' + c.split('').map(x => x + x).join('').toLowerCase();
        }
        // rgba(...) ou toute autre valeur : on garde tel quel si non vide.
        return c || fallback;
    }

    // Assombrit une couleur hex d'un pourcentage (pour les états :hover).
    function darken(hex, amount) {
        const h = normalizeHex(hex, '#000000');
        if (!/^#[0-9a-f]{6}$/i.test(h)) return h; // pas un hex simple → inchangé
        const f = 1 - (amount == null ? 0.12 : amount);
        const num = parseInt(h.slice(1), 16);
        const r = Math.max(0, Math.min(255, Math.round(((num >> 16) & 255) * f)));
        const g = Math.max(0, Math.min(255, Math.round(((num >> 8) & 255) * f)));
        const b = Math.max(0, Math.min(255, Math.round((num & 255) * f)));
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Construit une palette de 16 couleurs par défaut à partir des couleurs
     * historiques de l'école (color / secondaryColor). Neutres = défauts sensés.
     */
    function buildDefaultColors(school) {
        school = school || {};
        const primary = normalizeHex(school.color, '#3b82f6');
        const secondary = normalizeHex(school.secondaryColor || school.secondary_color, '#1a1a1a');
        return {
            primary:          primary,
            secondary:        secondary,
            accent:           secondary,
            background:       '#ffffff',
            surface:          '#f5f5f5',   // gris Reetain (#F5F5F5)
            text:             '#1a1a1a',
            mutedText:        '#6b7280',
            border:           '#e5e7eb',
            buttonBackground: primary,
            buttonHover:      darken(primary, 0.12),
            buttonText:       '#ffffff',
            link:             primary,
            linkHover:        darken(primary, 0.12),
            success:          '#16a34a',
            warning:          '#f59e0b',
            error:            '#dc2626'
        };
    }

    function buildDefaultBranding(school) {
        return {
            defaultFont: DEFAULT_FONT_ID,
            availableFonts: [DEFAULT_FONT_ID],
            colors: buildDefaultColors(school)
        };
    }

    /**
     * Fusionne un branding fourni (form / DB) avec les défauts dérivés de
     * l'école. Toujours renvoyer un objet complet et valide.
     */
    function normalizeBranding(branding, school) {
        const defaults = buildDefaultBranding(school);
        branding = (branding && typeof branding === 'object') ? branding : {};

        // defaultFont : doit exister dans le registre, sinon fallback.
        let defaultFont = fontById(branding.defaultFont) ? branding.defaultFont : defaults.defaultFont;

        // availableFonts : filtrer sur les fonts connues, garantir la présence
        // de la font par défaut.
        let available = Array.isArray(branding.availableFonts)
            ? branding.availableFonts.filter(id => fontById(id))
            : [];
        if (!available.includes(defaultFont)) available = [defaultFont, ...available];
        // Déduplication en conservant l'ordre.
        available = available.filter((id, i) => available.indexOf(id) === i);

        // colors : compléter chaque rôle manquant par le défaut dérivé.
        const inColors = (branding.colors && typeof branding.colors === 'object') ? branding.colors : {};
        const colors = {};
        COLOR_ROLES.forEach(({ key }) => {
            colors[key] = normalizeHex(inColors[key], defaults.colors[key]);
        });

        // social : URLs des réseaux sociaux de l'école (5 réseaux fixes). Chaque
        // valeur est une URL (chaîne) ou '' si non renseignée. Utilisées pour
        // pré-remplir automatiquement les icônes RS des footers.
        const inSocial = (branding.social && typeof branding.social === 'object') ? branding.social : {};
        const social = {};
        SOCIAL_KEYS.forEach(key => {
            social[key] = typeof inSocial[key] === 'string' ? inSocial[key].trim() : '';
        });

        return { defaultFont, availableFonts: available, colors, social };
    }

    return {
        PROJECT_FONTS,
        GOOGLE_FONTS,
        DEFAULT_FONT_ID,
        COLOR_ROLES,
        SOCIAL_ROLES,
        SOCIAL_KEYS,
        fontById,
        fontStackById,
        buildDefaultColors,
        buildDefaultBranding,
        normalizeBranding,
        darken
    };
});
