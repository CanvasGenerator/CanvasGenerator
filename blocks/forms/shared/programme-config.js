/**
 * Configuration du champ « Programme souhaité »
 * ───────────────────────────────────────────────────────────────
 * Source : « Formulaires pour les 10 écoles.xlsx ».
 *
 * Règles :
 *   • Champ affiché uniquement pour certaines écoles :
 *     BRASSART, IFA Paris, MOPA, CREAD pro, EFAP (MBA).
 *   • Valeurs conditionnelles au NIVEAU D'ÉTUDES + CAMPUS sélectionnés.
 *
 * En MODE TEST (pas d'école courante), le champ s'affiche dès qu'un
 * niveau sélectionné propose des programmes → démontrable dans le builder.
 */

/* Écoles pour lesquelles le champ « Programme souhaité » est affiché. */
export const PROGRAMME_SCHOOLS = ['brassart', 'ifa-paris', 'ifaparis', 'mopa', 'cread', 'efap'];

/**
 * Données de test : programmes par niveau d'études (défaut, tous campus).
 * Les surcharges par campus vivent dans PROGRAMMES_BY_CAMPUS.
 */
const PROGRAMMES_DEFAULT = {
    fr: {
        'bac':       [{ value: 'bachelor1',  label: 'Bachelor 1re année' }],
        'bac+1':     [{ value: 'bachelor1',  label: 'Bachelor 1re année' }],
        'bac+2':     [
            { value: 'bachelor2', label: 'Bachelor 2e année' },
            { value: 'bts_com',   label: 'BTS Communication' }
        ],
        'bac+3':     [
            { value: 'bachelor3',   label: 'Bachelor 3e année' },
            { value: 'bachelor3_alt', label: 'Bachelor 3e année (alternance)' }
        ],
        'bac+4':     [
            { value: 'master1',     label: 'Master 1' },
            { value: 'mba1',        label: 'MBA 1re année' }
        ],
        'bac+5':     [
            { value: 'master2',     label: 'Master 2' },
            { value: 'mba2',        label: 'MBA 2e année (alternance)' },
            { value: 'mastere_spe', label: 'Mastère Spécialisé' }
        ]
    },
    en: {
        'bac':       [{ value: 'bachelor1',  label: '1st Year Bachelor' }],
        'bac+1':     [{ value: 'bachelor1',  label: '1st Year Bachelor' }],
        'bac+2':     [
            { value: 'bachelor2', label: '2nd Year Bachelor' },
            { value: 'bts_com',   label: 'Communication Studies' }
        ],
        'bac+3':     [
            { value: 'bachelor3',    label: '3rd Year Bachelor' },
            { value: 'bachelor3_alt', label: '3rd Year Bachelor (work-study)' }
        ],
        'bac+4':     [
            { value: 'master1',      label: 'Master 1' },
            { value: 'mba1',         label: '1st Year MBA' }
        ],
        'bac+5':     [
            { value: 'master2',      label: 'Master 2' },
            { value: 'mba2',         label: '2nd Year MBA (work-study)' },
            { value: 'mastere_spe',  label: 'Specialised Master' }
        ]
    }
};

/**
 * Surcharges éventuelles par campus (clé = value du campus).
 * Vide par défaut : on retombe sur PROGRAMMES_DEFAULT.
 */
const PROGRAMMES_BY_CAMPUS = {
    fr: {},
    en: {}
};

/**
 * Détermine si le champ « Programme souhaité » doit être affiché
 * pour l'école courante. En l'absence d'école (mode test), retourne true.
 *
 * @param {Object} [school] - window.CURRENT_SCHOOL
 * @returns {boolean}
 */
export function isProgrammeSchool(school) {
    if (!school || !school.id) return true; // mode test / builder : on affiche
    return PROGRAMME_SCHOOLS.indexOf(String(school.id).toLowerCase()) !== -1;
}

/**
 * Retourne la liste des programmes pour un niveau + campus + langue donnés.
 *
 * @param {string} level  - value du niveau d'études (ex: 'bac+3')
 * @param {string} campus - value du campus (ex: 'paris')
 * @param {string} lang   - 'fr' | 'en'
 * @returns {Array<{value:string,label:string}>}
 */
export function getProgrammes(level, campus, lang = 'fr') {
    if (!level) return [];
    const byCampus = (PROGRAMMES_BY_CAMPUS[lang] || {})[campus];
    if (byCampus && byCampus[level]) return byCampus[level];
    const def = PROGRAMMES_DEFAULT[lang] || PROGRAMMES_DEFAULT.fr;
    return def[level] || [];
}
