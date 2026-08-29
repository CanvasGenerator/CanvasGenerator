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

    const duCrm = programmesDuSocle(level, campus);
    if (duCrm) return duCrm;

    const byCampus = (PROGRAMMES_BY_CAMPUS[lang] || {})[campus];
    if (byCampus && byCampus[level]) return byCampus[level];
    const def = PROGRAMMES_DEFAULT[lang] || PROGRAMMES_DEFAULT.fr;
    return def[level] || [];
}

/**
 * Les VRAIS programmes, lus dans window.SOCLE_DATA que la CloudPage publie.
 *
 * Pourquoi cette source d'abord : les données statiques ci-dessus sont des
 * données de TEST, et leurs clés sont en minuscules ('bac+3'). En page
 * publiée, le socle remplace les options de StudyLevel par le value set du
 * CRM, qui écrit 'BAC+3'. La correspondance échouait donc toujours, et le
 * champ « Programme souhaité » restait masqué : dynamique dans le builder,
 * jamais en production.
 *
 * Ici les deux côtés viennent du même value set Salesforce
 * (Account.Academic_Level_List__c d'un côté, LearningProgram de l'autre),
 * donc la comparaison est exacte. Idem pour le campus, où le socle et
 * `campusNameFor__c` disent tous deux « EFAP PARIS ».
 *
 * Le socle a déjà filtré la liste : programmes de l'école courante, et pour
 * le formulaire de candidature uniquement ceux qui ont une session de
 * candidature ouverte (PTAT). Rien à refaire de ce côté.
 *
 * @returns {Array|null} null quand le socle n'a rien publié — l'appelant
 *          retombe alors sur les données statiques.
 */
function programmesDuSocle(level, campus) {
    const D = typeof window !== 'undefined' ? window.SOCLE_DATA : null;
    if (!D || !D.programs || !D.programs.length) return null;

    const cible = canonNiveau(level);

    const liste = D.programs
        .filter(p => (!campus || p.campus === campus) && niveauxDuProgramme(p).indexOf(cible) !== -1)
        .map(p => ({ value: p.id, label: p.name }));

    // Un niveau sans programme est une réponse valide du CRM, pas une absence
    // de réponse : on rend [] et le champ se masque, sans repli sur le test.
    return liste;
}

/**
 * Les niveaux d'un programme, sous forme canonique.
 *
 * `LearningProgram.Academic_Level_List__c` est MULTI-SELECT : une seule chaîne
 * porte plusieurs niveaux séparés par des points-virgules, par exemple
 * « Collège;Seconde;Première;Terminale;Bac obtenu;Bac+1;CAP;BEP;Autres ».
 * Comparer la chaîne entière au niveau choisi ne matcherait jamais.
 */
function niveauxDuProgramme(p) {
    return String(p.level || '').split(';').map(canonNiveau);
}

/**
 * Correspondance des deux référentiels de niveau.
 *
 * Les deux côtés du CRM n'écrivent pas les niveaux pareil :
 *   Account.Academic_Level_List__c   -> BAC+3, BAC+5 et +, BAC obtenu ou Prépa
 *   LearningProgram.Academic_Level_List__c -> Bac+3, Bac+5/+, Bac obtenu
 *
 * C'est l'écart n°9 du suivi du responsable data. Les majuscules règlent 11
 * des 13 valeurs ; les deux dernières demandent une correspondance explicite.
 * Relevé le 27/08/2026 sur BRASSART, EFAP et ICART : 13 valeurs de part et
 * d'autre, correspondance un pour un.
 *
 * ⚠ Cette table est NOTRE lecture, pas une décision du CRM. Elle reste à faire
 * valider : c'est exactement la « table de correspondance officielle » que le
 * responsable data attend. Si le CRM normalise les deux référentiels, ces deux
 * lignes disparaissent et `canonNiveau` se réduit à un simple toUpperCase.
 */
const NIVEAU_EQUIV = {
    'BAC+5/+':    'BAC+5 ET +',
    'BAC OBTENU': 'BAC OBTENU OU PRÉPA'
};

function canonNiveau(v) {
    const c = String(v || '').trim().toUpperCase();
    return NIVEAU_EQUIV[c] || c;
}

/**
 * Le PTAT (fenêtre de candidature) du programme choisi.
 *
 * Le socle expose window.SOCLE_DATA.ptats, déjà restreint à l'école courante.
 * Un programme ouvert à plusieurs rentrées a plusieurs PTAT ; faute de champ
 * « rentrée » dans les formulaires EDH, on prend le premier. Le socle en a
 * besoin pour écrire PTAT_Id__c et pour armer les règles de blocage : un
 * PTAT_Id vide les désactive entièrement, donc le premier vaut mieux que rien.
 *
 * @returns {string} l'Id du PTAT, ou '' si introuvable.
 */
/* Exportees pour la cascade de reconstitution du programme
   (cascade-programme.js) : elle doit comparer les niveaux exactement comme
   ici, multi-select et divergences de referentiel comprises. */
export { canonNiveau, niveauxDuProgramme };

export function getPtatForProgramme(programId) {
    const D = typeof window !== 'undefined' ? window.SOCLE_DATA : null;
    if (!D || !D.ptats || !programId) return '';
    for (let i = 0; i < D.ptats.length; i++) {
        if (D.ptats[i].programId === programId) return D.ptats[i].ptatId;
    }
    return '';
}
