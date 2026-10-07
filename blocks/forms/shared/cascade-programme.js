/**
 * ============================================================================
 *  CASCADE DE RECONSTITUTION DU PROGRAMME
 * ============================================================================
 *  Règle métier §6 : « pour fluidifier le parcours étudiant, le champ programme
 *  va être scindé en plusieurs champs conditionnels qui permettront de
 *  reconstituer le programme ».
 *
 *      campus → niveau d'études → spécialité → rythme → langue → rentrée
 *
 *  Chaque champ ne propose que ce qui reste atteignable compte tenu des choix
 *  précédents. Au bout, un seul programme subsiste : on en déduit son PTAT,
 *  seule donnée dont le CRM a réellement besoin.
 *
 *  Trois comportements dictés par la règle, et qu'il ne faut pas confondre :
 *
 *    • PROGRESSIF — les champs après niveau n'apparaissent qu'une fois le
 *      précédent renseigné. EFAP y échappe (`progressif: false` dans
 *      LPB_Config_Formulaires) : tout s'affiche d'emblée.
 *
 *    • UNE SEULE VALEUR — « on ne l'affiche pas mais on envoie la valeur par
 *      défaut au CRM ». Le champ est donc masqué ET renseigné, jamais vidé :
 *      poser la question n'apporterait rien, mais la réponse compte.
 *
 *    • ORDRE PAR ÉCOLE — IFA Paris demande la langue avant la spécialité.
 *      L'ordre vient de la config, pas du code.
 *
 *  Sans `window.SOCLE_DATA`, la fonction ne fait rien : dans le builder, les
 *  champs restent masqués et le formulaire fonctionne comme avant.
 * ============================================================================
 */

import { canonNiveau, niveauxDuProgramme } from './programme-config.js';

/* Les clés de `config.ordre` vers les attributs `name` du formulaire. */
const NOM_DOM = {
    campus:     'Campus',
    niveau:     'StudyLevel',
    speciality: 'Speciality',
    rhythm:     'Rhythm',
    language:   'Language',
    rentree:    'Rentree'
};

/* Les deux premiers sont toujours affichés (règle : « campus et niveau d'études
   seront toujours affichés »). Les quatre autres sont conditionnels. */
const TOUJOURS = ['campus', 'niveau'];

const ORDRE_DEFAUT = 'campus,niveau,speciality,rhythm,language,rentree';

/* Sentinelle pour « ce programme n'a pas ce critère ». Une valeur vide ne
   conviendrait pas : elle se confondrait avec « pas encore choisi ». */
const AUCUNE = '__aucune__';
const LIBELLE_AUCUNE = 'Sans spécialité';

/**
 * Branche la cascade sur un formulaire.
 *
 * @param {HTMLFormElement} form
 * @returns {boolean} false si le socle n'a rien publié (rien n'a été branché).
 */
export function brancherCascadeProgramme(form) {
    const D = (typeof window !== 'undefined' && window.SOCLE_DATA) || null;
    if (!form || !D || !D.programs || !D.programs.length) return false;

    const CFG        = D.config || {};
    const ordre      = String(CFG.ordre || ORDRE_DEFAUT).split(',').map(s => s.trim()).filter(Boolean);
    const progressif = CFG.progressif !== false;
    const regles     = CFG.champs || {};

    const champ = (cle) => form.querySelector(`[name="${NOM_DOM[cle]}"]`);

    /* On remonte au conteneur : masquer le <select> seul laisserait son libellé
       orphelin à l'écran. */
    function porteur(el) {
        return (el.closest && (el.closest('.cnd-field') || el.closest('.jpo-field') ||
                el.closest('.brf-field') || el.closest('.imf-field') ||
                el.closest('[data-socle-champ]') || el.closest('.form-group'))) || el.parentNode;
    }

    /* Deux leviers, parce que les formulaires en utilisent deux : les champs
       de la cascade naissent avec la classe `hidden` (`.cnd-field.hidden {
       display: none }`), et lever le seul `style.display` ne les revele pas —
       la regle de classe l'emporte sur une valeur inline vide. Le harnais de
       test, qui n'a pas de CSS, ne pouvait pas le montrer. */
    function afficher(el, visible) {
        const p = porteur(el);
        if (!p) return;
        p.style.display = visible ? '' : 'none';
        if (p.classList) p.classList.toggle('hidden', !visible);
    }

    /** Ordinal du niveau choisi. 0 si inconnu : aucune règle de seuil ne joue. */
    function ordreNiveau() {
        const el = champ('niveau');
        const v = el ? el.value : '';
        const liste = (D.picklists && D.picklists.StudyLevel) || [];
        for (let i = 0; i < liste.length; i++) {
            if (liste[i].value === v) return Number(liste[i].ordre) || 0;
        }
        return 0;
    }

    /**
     * Le champ est-il autorisé pour cette école ?
     *   jamais   → non
     *   niveau   → seulement si le niveau atteint le seuil
     *   toujours → oui
     * Pas de règle = autorisé, pour ne pas masquer un champ par défaut.
     */
    function autorise(cle) {
        const r = regles[NOM_DOM[cle]];
        if (!r) return true;
        if (r.visible === 'jamais') return false;
        if (r.visible === 'niveau') return ordreNiveau() >= Number(r.niveauMin || 0);
        return true;
    }

    /** Les programmes compatibles avec les choix faits jusqu'à `cle` exclue. */
    function candidats(jusqua) {
        return D.programs.filter((p) => {
            for (const cle of ordre) {
                if (cle === jusqua) break;
                if (cle === 'rentree') continue;          // traité par les PTAT
                const el = champ(cle);
                const v = el ? el.value : '';
                if (!v) continue;
                if (cle === 'niveau') {
                    if (niveauxDuProgramme(p).indexOf(canonNiveau(v)) === -1) return false;
                } else if (cle === 'campus') {
                    if (p.campus !== v) return false;
                } else if (v === AUCUNE) {
                    if (String(p[cle] || '').trim()) return false;
                } else if (String(p[cle] || '') !== v) {
                    return false;
                }
            }
            return true;
        });
    }

    /** Les rentrées atteignables, via les PTAT des programmes encore en lice. */
    function rentreesPossibles(progs) {
        const ids = {};
        progs.forEach(p => { ids[p.id] = 1; });
        const termes = {};
        (D.ptats || []).forEach((t) => { if (ids[t.programId]) termes[t.termId] = 1; });
        return (D.terms || []).filter(t => termes[t.value]);
    }

    /**
     * Valeurs distinctes d'un critère parmi une liste de programmes.
     *
     * ⚠ Un critère VIDE est une alternative, pas une absence de donnée. À EFAP
     * PARIS niveau Bac+3, quatre programmes cohabitent : trois sans spécialité
     * (« Année 4 FR », « Année 4 FR Alternance », « Année 4 EN ») et un avec
     * (« Digital Marketing & Business »). Ne compter que les spécialités
     * nommées donnait UNE valeur, la règle « une seule valeur » la posait
     * d'office, et les trois autres programmes disparaissaient.
     *
     * On expose donc un choix explicite pour « aucune », plutôt que de laisser
     * le placeholder faire double emploi avec « pas encore choisi ».
     */
    function valeursDe(cle, progs) {
        const vus = {};
        const out = [];
        let avecVide = false;
        progs.forEach((p) => {
            const v = String(p[cle] || '').trim();
            if (!v) { avecVide = true; return; }
            if (vus[v]) return;
            vus[v] = 1;
            out.push({ value: v, label: v });
        });
        out.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
        if (avecVide && out.length) out.push({ value: AUCUNE, label: LIBELLE_AUCUNE });
        return out;
    }

    function remplir(el, options, placeholder) {
        const courant = el.value;
        el.innerHTML = '';
        if (placeholder !== null) {
            const vide = document.createElement('option');
            vide.value = '';
            vide.textContent = placeholder || '';
            el.appendChild(vide);
        }
        options.forEach((o) => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            if (o.value === courant) opt.selected = true;
            el.appendChild(opt);
        });
        if (!options.some(o => o.value === courant)) el.value = '';
    }

    function rafraichir() {
        /* La chaîne est ouverte tant que tous les champs qui précèdent sont
           renseignés. Une fois rompue elle le reste : en mode progressif, un
           champ ne s'ouvre jamais avant celui qui le précède.

           ⚠ Un champ auto-rempli (une seule valeur) ne rouvre PAS une chaîne
           déjà rompue. Sans cette précaution, la langue d'IFA Paris — une seule
           valeur, donc posée d'office — faisait apparaître la spécialité alors
           que le campus n'était même pas choisi. */
        let chaineOuverte = true;

        ordre.forEach((cle) => {
            if (TOUJOURS.indexOf(cle) !== -1) {
                const el = champ(cle);
                if (el && !el.value) chaineOuverte = false;
                return;
            }

            const el = champ(cle);
            if (!el) return;

            if (!autorise(cle)) {
                el.value = '';
                afficher(el, false);
                return;
            }

            const progs   = candidats(cle);
            const options = cle === 'rentree' ? rentreesPossibles(progs) : valeursDe(cle, progs);

            const placeholder = el.getAttribute('data-placeholder') || '';
            remplir(el, options, placeholder);

            if (options.length === 0) {
                el.value = '';
                afficher(el, false);
                chaineOuverte = false;
                return;
            }

            if (options.length === 1) {
                /* Une seule valeur : on ne la propose pas, on la pose. Le champ
                   reste dans le formulaire, donc la valeur part au CRM. */
                el.value = options[0].value;
                afficher(el, false);
                return;
            }

            /* Au moins deux valeurs : on affiche, sous réserve du progressif. */
            afficher(el, progressif ? chaineOuverte : true);
            if (!el.value) chaineOuverte = false;
        });

        resoudreProgramme();
    }

    /**
     * Le programme et son PTAT, une fois la cascade parcourue.
     *
     * On ne pose PTAT_Id que si UN SEUL programme subsiste : deux programmes
     * encore en lice signifient que le candidat n'a pas fini de choisir, et
     * poser un PTAT au hasard rattacherait sa candidature au mauvais cursus.
     */
    function resoudreProgramme() {
        const elProg = form.querySelector('[name="Programme"]');
        const elPtat = form.querySelector('[name="PTAT_Id"]');

        const progs = candidats(null);
        const unSeul = progs.length === 1 ? progs[0] : null;

        if (elProg) elProg.value = unSeul ? unSeul.id : '';

        if (!elPtat) return;
        if (!unSeul) { elPtat.value = ''; return; }

        const elRentree = champ('rentree');
        const terme = elRentree ? elRentree.value : '';
        const ptats = (D.ptats || []).filter(t => t.programId === unSeul.id &&
                                                  (!terme || t.termId === terme));
        elPtat.value = ptats.length ? ptats[0].ptatId : '';
    }

    ordre.forEach((cle) => {
        const el = champ(cle);
        if (el) el.addEventListener('change', rafraichir);
    });
    rafraichir();
    return true;
}
