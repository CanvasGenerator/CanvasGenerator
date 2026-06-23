/**
 * Form Validators
 * Exports a JS string to be embedded as <script> inside SFMC Cloud Page forms.
 * Handles: email syntax/domain, phone format (E.164), required fields.
 *
 * Usage in a block:
 *   import { VALIDATORS_SCRIPT } from '../shared/form-validators.js';
 *   // then embed inside the block HTML: `<script>${VALIDATORS_SCRIPT}</script>`
 */

export const VALIDATORS_SCRIPT = `
(function() {
    /* ── Email validator ─────────────────────────────────────────────── */
    var INVALID_DOMAINS = [
        'mailinator.com','guerrillamail.com','tempmail.com','throwam.com',
        'sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.info',
        'spam4.me','yopmail.com','trashmail.com','dispostable.com'
    ];

    function validateEmail(value) {
        if (!value) return { valid: false, msg: 'Ce champ est requis.' };
        var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
        if (!re.test(value)) return { valid: false, msg: 'Format d\\'e-mail invalide.' };
        var domain = value.split('@')[1].toLowerCase();
        if (INVALID_DOMAINS.indexOf(domain) !== -1) {
            return { valid: false, msg: 'Veuillez utiliser une adresse e-mail valide.' };
        }
        return { valid: true };
    }

    /* ── Phone validator ─────────────────────────────────────────────── */
    // Supports: +33 6 12 34 56 78 | 0612345678 | +32 4 XX XX XX XX
    function validatePhone(value, countryCode) {
        if (!value) return { valid: false, msg: 'Ce champ est requis.' };
        var digits = value.replace(/[\\s\\-\\.\\(\\)]/g, '');
        // If starts with country code already, keep as-is
        if (!/^\\+/.test(digits)) {
            digits = (countryCode || '+33') + (digits.replace(/^0/, ''));
        }
        // E.164: + followed by 7 to 15 digits
        if (!/^\\+[1-9]\\d{6,14}$/.test(digits)) {
            return { valid: false, msg: 'Numéro de téléphone invalide.' };
        }
        return { valid: true, normalized: digits };
    }

    /* ── Inline error display ────────────────────────────────────────── */
    function showError(input, msg) {
        clearError(input);
        input.classList.add('edh-field-error');
        var err = document.createElement('span');
        err.className = 'edh-error-msg';
        err.textContent = msg;
        input.parentNode.appendChild(err);
    }

    function clearError(input) {
        input.classList.remove('edh-field-error');
        var existing = input.parentNode.querySelector('.edh-error-msg');
        if (existing) existing.remove();
    }

    /* ── Attach live validation to a form ───────────────────────────── */
    function attachValidation(formEl) {
        if (!formEl) return;

        var emailInputs = formEl.querySelectorAll('input[type="email"], input[data-validate="email"]');
        emailInputs.forEach(function(input) {
            input.addEventListener('blur', function() {
                var result = validateEmail(input.value.trim());
                if (!result.valid) showError(input, result.msg);
                else clearError(input);
            });
        });

        var phoneInputs = formEl.querySelectorAll('input[data-validate="phone"]');
        phoneInputs.forEach(function(input) {
            input.addEventListener('blur', function() {
                var prefix = (input.closest('.edh-phone-wrapper') || {}).querySelector
                    ? input.closest('.edh-phone-wrapper').querySelector('.edh-phone-prefix')
                    : null;
                var cc = prefix ? prefix.value : '+33';
                var result = validatePhone(input.value.trim(), cc);
                if (!result.valid) showError(input, result.msg);
                else {
                    clearError(input);
                    // Write normalized value to a hidden field if present
                    var hidden = formEl.querySelector('input[name="' + input.name + '_normalized"]');
                    if (hidden) hidden.value = result.normalized;
                }
            });
        });
    }

    /* ── Form submit validation gate ────────────────────────────────── */
    function validateOnSubmit(formEl) {
        var valid = true;

        // Check required fields
        formEl.querySelectorAll('[required]').forEach(function(field) {
            if (!field.value.trim()) {
                showError(field, 'Ce champ est requis.');
                valid = false;
            }
        });

        // Validate email fields
        formEl.querySelectorAll('input[type="email"], input[data-validate="email"]').forEach(function(input) {
            if (input.value.trim()) {
                var result = validateEmail(input.value.trim());
                if (!result.valid) { showError(input, result.msg); valid = false; }
            }
        });

        // Validate phone fields
        formEl.querySelectorAll('input[data-validate="phone"]').forEach(function(input) {
            if (input.value.trim()) {
                var prefix = input.closest('.edh-phone-wrapper')
                    ? input.closest('.edh-phone-wrapper').querySelector('.edh-phone-prefix')
                    : null;
                var cc = prefix ? prefix.value : '+33';
                var result = validatePhone(input.value.trim(), cc);
                if (!result.valid) { showError(input, result.msg); valid = false; }
            }
        });

        // RGPD: at least one optin required
        var rgpdGroup = formEl.querySelector('.edh-rgpd-group');
        if (rgpdGroup) {
            var anyChecked = rgpdGroup.querySelectorAll('input[type="checkbox"]:checked').length > 0;
            if (!anyChecked) {
                var errEl = rgpdGroup.querySelector('.edh-error-msg');
                if (!errEl) {
                    errEl = document.createElement('span');
                    errEl.className = 'edh-error-msg';
                    rgpdGroup.appendChild(errEl);
                }
                errEl.textContent = 'Veuillez accepter au moins un canal de contact.';
                valid = false;
            } else {
                var existingErr = rgpdGroup.querySelector('.edh-error-msg');
                if (existingErr) existingErr.remove();
            }
        }

        return valid;
    }

    /* ── Public API ─────────────────────────────────────────────────── */
    window.EDH = window.EDH || {};
    window.EDH.validators = { validateEmail, validatePhone, attachValidation, validateOnSubmit, showError, clearError };

    // Auto-attach on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.edh-form').forEach(function(form) {
            attachValidation(form);
            form.addEventListener('submit', function(e) {
                if (!validateOnSubmit(form)) {
                    e.preventDefault();
                    var firstErr = form.querySelector('.edh-field-error');
                    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    });
})();
`;
