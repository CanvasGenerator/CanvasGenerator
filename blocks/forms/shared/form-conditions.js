/**
 * Form Conditional Logic Engine
 * Declarative show/hide of fields based on other field values.
 *
 * Usage (embed as <script> in form HTML):
 *   - Add data-condition attribute to field wrapper elements:
 *     data-condition='{"field":"vous_etes","operator":"eq","value":"parent"}'
 *   - Engine runs on DOMContentLoaded and on every change event.
 *
 * For picklist-dependent options (e.g. niveau études → spécialités):
 *   - Use data-depends-on="fieldName" on <select> elements.
 *   - Define window.EDH_PICKLIST_DEPS map (see block configs).
 *
 * Export: JS string to embed in block HTML.
 */

export const CONDITIONS_SCRIPT = `
(function() {
    /* ── Core condition evaluator ────────────────────────────────────── */
    function evaluate(condition, formEl) {
        var sourceField = formEl.querySelector('[name="' + condition.field + '"]');
        if (!sourceField) return false;
        var sourceValue = sourceField.value;

        switch (condition.operator) {
            case 'eq':  return sourceValue === condition.value;
            case 'neq': return sourceValue !== condition.value;
            case 'in':  return condition.value.indexOf(sourceValue) !== -1;
            case 'notin': return condition.value.indexOf(sourceValue) === -1;
            case 'empty':  return sourceValue === '';
            case 'notempty': return sourceValue !== '';
            default: return false;
        }
    }

    /* ── Show / hide a wrapper ───────────────────────────────────────── */
    function applyVisibility(wrapperEl, visible) {
        if (visible) {
            wrapperEl.style.display = '';
            wrapperEl.removeAttribute('aria-hidden');
            // Re-enable inputs inside
            wrapperEl.querySelectorAll('input, select, textarea').forEach(function(f) {
                if (wrapperEl.dataset.wasRequired === 'true') f.setAttribute('required', '');
                f.removeAttribute('disabled');
            });
        } else {
            wrapperEl.style.display = 'none';
            wrapperEl.setAttribute('aria-hidden', 'true');
            // Disable inputs so they don't submit / fail required validation
            wrapperEl.querySelectorAll('input, select, textarea').forEach(function(f) {
                if (f.hasAttribute('required')) {
                    wrapperEl.dataset.wasRequired = 'true';
                    f.removeAttribute('required');
                }
                f.setAttribute('disabled', '');
                f.value = '';
            });
        }
    }

    /* ── Re-evaluate all conditional wrappers in a form ─────────────── */
    function refresh(formEl) {
        formEl.querySelectorAll('[data-condition]').forEach(function(wrapper) {
            try {
                var condition = JSON.parse(wrapper.dataset.condition);
                applyVisibility(wrapper, evaluate(condition, formEl));
            } catch(e) {
                console.warn('[EDH Conditions] Invalid data-condition on', wrapper, e);
            }
        });
    }

    /* ── Dependent picklist (e.g. study level → programme options) ───── */
    function refreshDependentPicklists(formEl) {
        var deps = window.EDH_PICKLIST_DEPS;
        if (!deps) return;

        formEl.querySelectorAll('select[data-depends-on]').forEach(function(select) {
            var sourceFieldName = select.dataset.dependsOn;
            var sourceField = formEl.querySelector('[name="' + sourceFieldName + '"]');
            if (!sourceField) return;

            var map = deps[sourceFieldName];
            if (!map) return;

            var currentValue = select.value;
            var options = map[sourceField.value] || map['_default'] || [];

            // Rebuild options
            while (select.firstChild) select.removeChild(select.firstChild);
            var placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Sélectionnez...';
            select.appendChild(placeholder);

            options.forEach(function(opt) {
                var el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.label;
                if (opt.value === currentValue) el.selected = true;
                select.appendChild(el);
            });

            // Hide the select wrapper if no options available
            var wrapper = select.closest('.edh-field-wrapper');
            if (wrapper) applyVisibility(wrapper, options.length > 0);
        });
    }

    /* ── Attach to a form ────────────────────────────────────────────── */
    function attachConditions(formEl) {
        if (!formEl) return;

        // Initial evaluation
        refresh(formEl);
        refreshDependentPicklists(formEl);

        // React to changes
        formEl.addEventListener('change', function(e) {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
                refresh(formEl);
                refreshDependentPicklists(formEl);
            }
        });
    }

    /* ── Public API ─────────────────────────────────────────────────── */
    window.EDH = window.EDH || {};
    window.EDH.conditions = { refresh, attachConditions };

    document.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('.edh-form').forEach(attachConditions);
    });
})();
`;
