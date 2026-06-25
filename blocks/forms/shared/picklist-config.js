/**
 * EDC Picklist Configuration
 * Source of truth for all picklist values used in EDH forms.
 * Values (value) = Salesforce Education Cloud API names.
 * Labels (label) = display text FR | (labelEn) = display text EN.
 */

export const EDC_PICKLISTS = {

    contactType: [
        { value: 'student',          label: 'Étudiant(e)',                       labelEn: 'Student' },
        { value: 'student_enrolled', label: 'Étudiant(e) déjà dans cette école', labelEn: 'Currently enrolled student' },
        { value: 'parent',           label: 'Parent',                            labelEn: 'Parent' },
        { value: 'professional',     label: 'Professionnel(le)',                  labelEn: 'Professional' }
    ],

    studyLevel: [
        { value: 'seconde',   label: 'Seconde',                    labelEn: 'Year 10' },
        { value: 'premiere',  label: 'Première',                   labelEn: 'Year 11' },
        { value: 'terminale', label: 'Terminale',                  labelEn: 'Year 12 / A-Levels' },
        { value: 'bac',       label: 'Bac',                        labelEn: 'High School Graduate' },
        { value: 'bac+1',     label: 'Bac+1',                      labelEn: '1st Year University' },
        { value: 'bac+2',     label: 'Bac+2',                      labelEn: '2nd Year University' },
        { value: 'bac+3',     label: 'Bac+3 (Licence / Bachelor)', labelEn: "Bachelor's Degree" },
        { value: 'bac+4',     label: 'Bac+4 (Master 1)',           labelEn: "Master's 1st Year" },
        { value: 'bac+5',     label: 'Bac+5 et +',                labelEn: "Master's Degree +" }
    ],

    campus: [
        { value: 'paris',       label: 'Paris',            labelEn: 'Paris' },
        { value: 'lille',       label: 'Lille',            labelEn: 'Lille' },
        { value: 'bordeaux',    label: 'Bordeaux',         labelEn: 'Bordeaux' },
        { value: 'lyon',        label: 'Lyon',             labelEn: 'Lyon' },
        { value: 'montpellier', label: 'Montpellier',      labelEn: 'Montpellier' },
        { value: 'nice',        label: 'Nice',             labelEn: 'Nice' },
        { value: 'aix',         label: 'Aix-en-Provence',  labelEn: 'Aix-en-Provence' },
        { value: 'nantes',      label: 'Nantes',           labelEn: 'Nantes' },
        { value: 'toulouse',    label: 'Toulouse',         labelEn: 'Toulouse' },
        { value: 'rennes',      label: 'Rennes',           labelEn: 'Rennes' }
    ],

    countries: [
        { value: 'FR',    label: 'France',         labelEn: 'France' },
        { value: 'BE',    label: 'Belgique',       labelEn: 'Belgium' },
        { value: 'CH',    label: 'Suisse',         labelEn: 'Switzerland' },
        { value: 'LU',    label: 'Luxembourg',     labelEn: 'Luxembourg' },
        { value: 'MC',    label: 'Monaco',         labelEn: 'Monaco' },
        { value: 'DE',    label: 'Allemagne',      labelEn: 'Germany' },
        { value: 'ES',    label: 'Espagne',        labelEn: 'Spain' },
        { value: 'IT',    label: 'Italie',         labelEn: 'Italy' },
        { value: 'GB',    label: 'Royaume-Uni',    labelEn: 'United Kingdom' },
        { value: 'US',    label: 'États-Unis',     labelEn: 'United States' },
        { value: 'CA',    label: 'Canada',         labelEn: 'Canada' },
        { value: 'MA',    label: 'Maroc',          labelEn: 'Morocco' },
        { value: 'TN',    label: 'Tunisie',        labelEn: 'Tunisia' },
        { value: 'DZ',    label: 'Algérie',        labelEn: 'Algeria' },
        { value: 'SN',    label: 'Sénégal',        labelEn: 'Senegal' },
        { value: 'CI',    label: "Côte d'Ivoire",  labelEn: "Ivory Coast" },
        { value: 'CM',    label: 'Cameroun',       labelEn: 'Cameroon' },
        { value: 'OTHER', label: 'Autre',          labelEn: 'Other' }
    ]
};

/**
 * Build <option> tags — French labels.
 */
export function buildOptions(options, placeholder = 'Sélectionnez...') {
    const empty = `<option value="">${placeholder}</option>`;
    return empty + options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

/**
 * Build <option> tags — English labels (falls back to .label if .labelEn absent).
 */
export function buildOptionsEn(options, placeholder = 'Select...') {
    const empty = `<option value="">${placeholder}</option>`;
    return empty + options.map(o => `<option value="${o.value}">${o.labelEn || o.label}</option>`).join('');
}

/**
 * Filter + optionally relabel a picklist for a specific form.
 */
export function filterPicklist(list, allowedValues = [], labelOverrides = {}) {
    const filtered = allowedValues.length
        ? list.filter(o => allowedValues.includes(o.value))
        : list;
    return filtered.map(o => ({
        value: o.value,
        label: labelOverrides[o.value] || o.label
    }));
}
