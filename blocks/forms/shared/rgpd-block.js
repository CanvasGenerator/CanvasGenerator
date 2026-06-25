/**
 * RGPD Block
 * Generates the RGPD consent section for EDH forms.
 * 3 opt-in channels: Email, SMS, WhatsApp.
 * Each maps to a distinct SFMC DE field (HasOptedInEmail, HasOptedInSMS, HasOptedInWhatsApp).
 *
 * @param {Object} opts
 * @param {string} opts.schoolName  - School display name (e.g. "l'EFAP")
 * @param {string} opts.policyUrl   - URL to the school's privacy policy
 * @param {boolean} opts.required   - Whether at least one optin is mandatory
 */
export function buildRgpdBlock({ schoolName = "l'école", policyUrl = '#', required = false } = {}) {
    return `
    <div class="edh-field-wrapper edh-rgpd-wrapper">
        <p class="edh-rgpd-intro">
            Je souhaite être contacté(e) par ${schoolName} pour les finalités décrites dans la
            <a href="${policyUrl}" target="_blank" rel="noopener">politique de confidentialité</a>${required ? '&nbsp;<span class="edh-req">*</span>' : ''}.
        </p>
        <div class="edh-rgpd-group">
            <label class="edh-checkbox-label">
                <input type="checkbox" name="HasOptedInEmail" value="true" class="edh-checkbox">
                <span>Email</span>
            </label>
            <label class="edh-checkbox-label">
                <input type="checkbox" name="HasOptedInSMS" value="true" class="edh-checkbox">
                <span>SMS</span>
            </label>
            <label class="edh-checkbox-label">
                <input type="checkbox" name="HasOptedInWhatsApp" value="true" class="edh-checkbox">
                <span>WhatsApp</span>
            </label>
        </div>
    </div>`;
}

/**
 * Returns AMPscript lines for reading RGPD optin values on form submission.
 */
export function rgpdAmpscript() {
    return `
SET @HasOptedInEmail    = IIF(RequestParameter("HasOptedInEmail")    == "true", "1", "0")
SET @HasOptedInSMS      = IIF(RequestParameter("HasOptedInSMS")      == "true", "1", "0")
SET @HasOptedInWhatsApp = IIF(RequestParameter("HasOptedInWhatsApp") == "true", "1", "0")`;
}
