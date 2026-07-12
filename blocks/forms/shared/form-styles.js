/**
 * Shared EDH Form Styles
 * Common CSS for all EDH forms. Uses CSS variables for school-level theming.
 * Embed as: `<style>${EDH_FORM_STYLES}</style>`
 */

export const EDH_FORM_STYLES = `
/* ── EDH Form Base ──────────────────────────────────────────────────── */
.edh-form-section {
    padding: 40px 20px;
    background: var(--edh-form-bg, #f8f9fa);
    font-family: var(--brand-font, 'Inter', sans-serif);
}
.edh-form-container {
    max-width: var(--edh-form-max-width, 620px);
    margin: 0 auto;
    background: #fff;
    padding: 40px;
    border-radius: var(--edh-radius, 10px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
}
.edh-form-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--edh-color-title, #111);
    margin: 0 0 6px;
}
.edh-form-subtitle {
    font-size: 14px;
    color: #666;
    margin: 0 0 28px;
}

/* ── Field Wrappers ─────────────────────────────────────────────────── */
.edh-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.edh-field-wrapper {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 18px;
}
.edh-field-wrapper.full-width {
    grid-column: 1 / -1;
}
.edh-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--edh-label-color, #333);
}
.edh-req {
    color: #e11d48;
    margin-left: 2px;
}

/* ── Inputs ─────────────────────────────────────────────────────────── */
.edh-input,
.edh-select {
    width: 100%;
    padding: 11px 14px;
    border: 1px solid #dde1e7;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    background: #fafafa;
    color: #111;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s;
    appearance: none;
    -webkit-appearance: none;
}
.edh-input:focus,
.edh-select:focus {
    outline: none;
    border-color: var(--edh-accent, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--edh-accent, #3b82f6) 15%, transparent);
    background: #fff;
}
.edh-field-error {
    border-color: #e11d48 !important;
}
.edh-error-msg {
    font-size: 11px;
    color: #e11d48;
    margin-top: 2px;
}

/* ── Phone wrapper ──────────────────────────────────────────────────── */
.edh-phone-wrapper {
    display: flex;
    gap: 8px;
}
.edh-phone-prefix {
    width: 90px;
    flex-shrink: 0;
    padding: 11px 8px;
    border: 1px solid #dde1e7;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    background: #fafafa;
    box-sizing: border-box;
}
.edh-phone-prefix:focus { outline: none; border-color: var(--edh-accent, #3b82f6); }

/* ── Select chevron ─────────────────────────────────────────────────── */
.edh-select-wrapper {
    position: relative;
}
.edh-select-wrapper::after {
    content: '';
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #888;
    pointer-events: none;
}

/* ── Conditional event info card ────────────────────────────────────── */
.edh-event-info {
    background: var(--edh-event-bg, #fdf2e9);
    border-left: 4px solid var(--edh-accent, #e8824a);
    border-radius: 6px;
    padding: 14px 18px;
    margin-bottom: 20px;
    font-size: 13px;
    line-height: 1.6;
    display: none; /* shown via JS when campus is selected */
}
.edh-event-info.visible { display: flex; gap: 20px; }
.edh-event-date { font-weight: 700; color: #111; }
.edh-event-detail { color: #555; }

/* ── RGPD section ───────────────────────────────────────────────────── */
.edh-rgpd-wrapper {
    border-top: 1px solid #f0f0f0;
    padding-top: 18px;
    margin-top: 8px;
}
.edh-rgpd-intro {
    font-size: 12px;
    color: #555;
    margin: 0 0 12px;
    line-height: 1.6;
}
.edh-rgpd-intro a { color: var(--edh-accent, #3b82f6); }
.edh-rgpd-group {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}
.edh-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
    user-select: none;
}
.edh-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--edh-accent, #3b82f6);
    cursor: pointer;
    flex-shrink: 0;
}

/* ── Submit button ──────────────────────────────────────────────────── */
.edh-submit-btn {
    width: 100%;
    margin-top: 24px;
    padding: 14px;
    background: var(--edh-btn-color, #111);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: filter 0.2s, transform 0.15s;
}
.edh-submit-btn:hover {
    filter: brightness(0.88);
    transform: translateY(-1px);
}
.edh-submit-btn:active { transform: translateY(0); }

/* ── Hidden SFMC snippets ───────────────────────────────────────────── */
.edh-sfmc-logic { display: none !important; }

/* ── Confirmation / Success state ───────────────────────────────────── */
.edh-msg-success {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 18px 20px;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 8px;
    color: #166534;
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 20px;
}
.edh-msg-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 18px 20px;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    color: #991b1b;
    font-size: 14px;
    margin-bottom: 20px;
}

/* ── Responsive ─────────────────────────────────────────────────────── */
@media (max-width: 580px) {
    .edh-form-container { padding: 24px 18px; }
    .edh-form-row { grid-template-columns: 1fr; }
    .edh-event-info.visible { flex-direction: column; gap: 8px; }
}
`;
