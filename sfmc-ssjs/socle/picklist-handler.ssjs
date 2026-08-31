<script runat="server">
/**
 * ============================================================================
 *  HANDLER DES LISTES DEROULANTES  (Content Block : LPB_Picklist_Handler_AG)
 * ============================================================================
 *  Remplit les <select> du formulaire avec les valeurs du CRM.
 *  LECTURE SEULE — ce bloc ne charge NI l'upsert NI Summit : aucune ecriture
 *  n'est possible depuis ici, meme par accident.
 *
 *  A inclure UNE FOIS dans la page, apres le formulaire (les <select> doivent
 *  exister dans le DOM au moment ou le script s'execute).
 *
 *  --- Principe -------------------------------------------------------------
 *  1. UNE seule passe de lecture Salesforce au chargement de la page.
 *  2. Les donnees sont serialisees dans window.SOCLE_DATA.
 *  3. La cascade (campus -> niveau -> specialite -> rythme -> langue ->
 *     rentree -> programme -> PTAT) se joue ensuite DANS LE NAVIGATEUR :
 *     aucun rechargement de page, aucun aller-retour supplementaire.
 *
 *  Les <select> sont retrouves par leur attribut name[], aligne sur readForm() :
 *      Country · Indicatif · StudyLevel · VousEtes · Campus · Speciality
 *      Rhythm · Language · Rentree · Programme · PTAT_Id (hidden)
 *      InstanceId · Appointments (famille evenement)
 *  Un name[] absent de la page est simplement ignore.
 *
 *  Depend de : LPB_Socle_Config_AG + LPB_Socle_Helpers_AG
 *              + LPB_Socle_Read_AG + LPB_Socle_Resolvers_AG
 * ============================================================================
 */
Platform.Load("Core", "1.1.1");

try {
    Platform.Function.ContentBlockByKey("LPB_Socle_Config_AG");
    Platform.Function.ContentBlockByKey("LPB_Socle_Helpers_AG");
    Platform.Function.ContentBlockByKey("LPB_Socle_Resolvers_AG");
    Platform.Function.ContentBlockByKey("LPB_Socle_Read_AG");

    /* -- Contexte : quelle ecole ? ------------------------------------- */
    function rp(n) { return Platform.Function.RequestParameter(n); }

    var schoolId = rp("SchoolId");
    if (Socle.isBlank(schoolId)) schoolId = rp("Marque");
    // Repli : @school pose en AMPscript par la page (LP mono-ecole).
    if (Socle.isBlank(schoolId)) {
        try { schoolId = Variable.GetValue("@school"); } catch (e) { schoolId = ""; }
    }

    var eventType = rp("TypeEvenement");     // JPO | AD | Stage — famille evenement
    var campusSel = rp("Campus");            // pre-selection eventuelle

    /** Echappement HTML (panneau de diagnostic). */
    function esc(s) {
        s = String(s === null || s === undefined ? "" : s);
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /* -- Serialisation JSON (SSJS n'a pas de JSON.stringify fiable) ----- */
    function jsonStr(s) {
        s = String(s === null || s === undefined ? "" : s);
        s = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        s = s.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
        // neutralise une fermeture de balise dans une valeur CRM
        s = s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
        return '"' + s + '"';
    }

    /** [{value,label,...}] -> tableau JSON, en ne gardant que `cles`. */
    function jsonList(list, cles) {
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var parts = [];
            for (var k = 0; k < cles.length; k++) {
                var c = cles[k];
                var v = list[i][c];
                if (v === true || v === false) parts.push(jsonStr(c) + ":" + (v ? "true" : "false"));
                else parts.push(jsonStr(c) + ":" + jsonStr(v));
            }
            out.push("{" + parts.join(",") + "}");
        }
        return "[" + out.join(",") + "]";
    }

    /** Lignes Program brutes -> objets compacts pour le navigateur. */
    function jsonPrograms(rows) {
        var M = SocleRead.map.PROGRAM, out = [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            out.push("{" +
                '"id":'         + jsonStr(r[M.id])         + "," +
                '"name":'       + jsonStr(r[M.name])       + "," +
                '"campus":'     + jsonStr(r[M.campus])     + "," +
                '"level":'      + jsonStr(r[M.level])      + "," +
                '"speciality":' + jsonStr(r[M.speciality]) + "," +
                '"rhythm":'     + jsonStr(r[M.rhythm])     + "," +
                '"language":'   + jsonStr(r[M.language])   +
            "}");
        }
        return "[" + out.join(",") + "]";
    }

    /* -- 1. Picklists : value set lu directement dans Salesforce --------- */
    var pkCountry = SocleRead.getPicklist("country");
    var pkIndic   = SocleRead.getPicklist("indicatif");
    var pkLevel   = SocleRead.getPicklist("studyLevel");
    var pkQui     = SocleRead.getPicklist("vousEtes");

    /* -- 2. Campus de l'ecole ------------------------------------------- */
    var campus = SocleRead.getBrandsCampuses(schoolId);

    /* -- 3. Cascade programme : programmes + index PTAT + rentrees ------- */
    var programs = SocleRead.getProgramsForSchool(schoolId);
    var ptats    = SocleRead.getPtatIndex(schoolId);

    // libelles des rentrees, une fois pour toutes
    var termIds = [];
    for (var p = 0; p < ptats.length; p++) termIds.push(ptats[p].termId);
    var terms = SocleRead.getTerms(termIds);

    // Repli : si SchoolCampusAssociation__c ne repond pas, on deduit les
    // campus des programmes plutot que de laisser la liste vide.
    if (!campus.length && programs.length) {
        campus = SocleRead.getCampusOptions(programs);
        Socle.log("picklist: campus deduits des programmes (SchoolCampusAssociation vide)");
    }

    /* -- 4. Famille evenement : dates + ateliers ------------------------- */
    var instances = [];
    var appointments = [];
    if (!Socle.isBlank(eventType)) {
        instances = SocleRead.getNextEventDates(campusSel, eventType);
        var instSel = rp("InstanceId");
        if (Socle.isBlank(instSel) && instances.length) instSel = instances[0].value; // 1re date pre-selectionnee
        if (!Socle.isBlank(instSel)) appointments = SocleRead.getAppointmentOptions(instSel);
    }

    /* -- 5. Emission du payload ----------------------------------------- */
    Write('<script>window.SOCLE_DATA={');
    Write('"school":'   + jsonStr(schoolId) + ',');
    Write('"picklists":{');
    Write('"Country":'    + jsonList(pkCountry, ["value", "label"]) + ',');
    Write('"Indicatif":'  + jsonList(pkIndic,   ["value", "label"]) + ',');
    Write('"StudyLevel":' + jsonList(pkLevel,   ["value", "label"]) + ',');
    Write('"VousEtes":'   + jsonList(pkQui,     ["value", "label"]));
    Write('},');
    Write('"campus":'       + jsonList(campus, ["value", "label"]) + ',');
    Write('"programs":'     + jsonPrograms(programs) + ',');
    Write('"ptats":'        + jsonList(ptats, ["ptatId", "programId", "termId"]) + ',');
    Write('"terms":'        + jsonList(terms, ["value", "label"]) + ',');
    Write('"instances":'    + jsonList(instances, ["value", "label", "date", "address"]) + ',');
    Write('"appointments":' + jsonList(appointments, ["value", "label", "required"]));
    Write('};<\/script>');

    // Trace de diagnostic, dans le code source de la page
    Write("<!-- picklist: school=" + schoolId +
          " campus=" + campus.length +
          " programs=" + programs.length +
          " ptats=" + ptats.length +
          " terms=" + terms.length +
          " instances=" + instances.length + " -->");
    Write("<!-- picklist log:\n" + Socle.getLog() + "\n-->");

    /* -- 6. Panneau de diagnostic VISIBLE : ajouter ?socleDebug=1 a l'URL --
       Permet de tester une page publiee sans faire "voir la source".
       N'apparait jamais pour un visiteur normal. */
    if (String(rp("socleDebug")) === "1") {

        function ligne(libelle, n) {
            var couleur = (n > 0) ? "#065f46" : "#991b1b";
            var etat    = (n > 0) ? "OK" : "VIDE";
            return '<tr><td style="padding:4px 10px;border-bottom:1px solid #eee">' + libelle +
                   '</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">' + n +
                   '</td><td style="padding:4px 10px;border-bottom:1px solid #eee;color:' + couleur + ';font-weight:700">' + etat +
                   '</td></tr>';
        }

        var total = campus.length + programs.length + ptats.length +
                    pkCountry.length + pkLevel.length;

        Write('<div style="position:fixed;bottom:0;left:0;right:0;z-index:99999;max-height:52vh;'
            + 'overflow:auto;background:#12123a;color:#fff;font:12px/1.5 Consolas,monospace;padding:16px 20px;'
            + 'box-shadow:0 -4px 20px rgba(0,0,0,.4)">');
        Write('<div style="font:700 14px Segoe UI,Arial;margin-bottom:10px">Diagnostic socle &mdash; ecole : '
            + esc(schoolId || "(aucune)") + '</div>');

        Write('<table style="width:100%;max-width:620px;background:#fff;color:#12123a;border-radius:6px;border-collapse:collapse">');
        Write(ligne("Pays (value set Salesforce)",      pkCountry.length));
        Write(ligne("Indicatif (value set)",            pkIndic.length));
        Write(ligne("Niveau d'etudes (value set)",      pkLevel.length));
        Write(ligne("Vous etes (value set)",            pkQui.length));
        Write(ligne("Campus",                           campus.length));
        Write(ligne("Programmes",                       programs.length));
        Write(ligne("PTAT (programme x rentree)",       ptats.length));
        Write(ligne("Rentrees",                         terms.length));
        Write(ligne("Dates d'evenement",                instances.length));
        Write(ligne("Ateliers",                         appointments.length));
        Write('</table>');

        if (total === 0) {
            Write('<div style="margin-top:12px;padding:10px 14px;background:#7f1d1d;border-radius:6px">'
                + '<b>Tout est vide.</b> Le socle s\'execute mais Salesforce ne repond pas &mdash; '
                + 'typiquement l\'erreur OAuth de Marketing Cloud Connect. '
                + 'Publier <code>sfmc-ssjs/diagnostic/A-COLLER-cloudpage-diagnostic.ssjs</code> '
                + 'pour savoir lequel des deux.</div>');
        }

        var journal = Socle.getLog();
        Write('<div style="margin-top:12px;font-weight:700">Journal d\'execution</div>');
        Write('<pre style="margin:6px 0 0;white-space:pre-wrap;background:#0b0b26;padding:10px;border-radius:6px">'
            + esc(journal || "(aucune erreur remontee)") + '</pre>');
        Write('</div>');
    }

} catch (e) {
    var msg;
    try { msg = Platform.Function.Stringify(e); } catch (e2) { msg = String(e); }
    // Le formulaire reste utilisable avec ses valeurs statiques.
    Write('<script>window.SOCLE_DATA=null;<\/script>');
    Write("<!-- picklist exception: " + msg + " -->");
}
</script>

<script>
/* ============================================================================
 *  CASCADE COTE NAVIGATEUR
 *  Aucune lecture supplementaire : tout est deja dans window.SOCLE_DATA.
 * ========================================================================== */
(function () {
    var D = window.SOCLE_DATA;
    if (!D) return;                       // lecture SF indisponible -> on laisse le HTML statique

    /* ---- ATTENDRE LE DOM ---------------------------------------------------
       Le socle est inclus EN HAUT de la page : quand ce script s'execute, le
       formulaire n'existe pas encore. Sans cette attente, tous les
       querySelector rendent null, la cascade sort en silence et les listes
       restent vides — panne invisible, constatee le 2026-08-23 sur un
       formulaire de test reel. Elle n'avait jamais pu fonctionner.

       On differe donc TOUT le corps jusqu'a DOMContentLoaded. Si le DOM est
       deja pret (socle inclus en bas de page, ou script charge tardivement),
       on execute immediatement. */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', demarrer);
    } else {
        demarrer();
    }
    function demarrer() {

    function champ(name) { return document.querySelector('[name="' + name + '"]'); }

    /**
     * La langue d'AFFICHAGE de la page.
     *
     * Le socle ne la connait pas : un Content Block ne prend pas de parametre.
     * Le formulaire, lui, la porte dans data-lang — c'est le builder qui l'y
     * pose selon la variante du bloc (francaise ou anglaise). On lit donc le
     * DOM, pas une variable AMPscript.
     */
    function langueAffichage() {
        try {
            var f = document.querySelector('[data-lang]');
            return (f && String(f.getAttribute('data-lang') || '').toLowerCase()) || 'fr';
        } catch (e) { return 'fr'; }
    }

    /**
     * Le libelle a AFFICHER pour une option.
     *
     * ⚠ Ne concerne QUE le texte visible. La `value` de l'option n'est jamais
     * touchee : c'est la valeur Salesforce d'origine, celle que le socle
     * d'ecriture attend, et la traduire casserait toutes les ecritures.
     *
     * Les valeurs du CRM sont en francais. En page anglaise, on cherche leur
     * equivalent dans SOCLE_DATA.traductions, alimente depuis la DE
     * LPB_Dico_Traductions. Pas d'entree, ou anglais vide : on garde le
     * francais, ce qui est degrade mais jamais casse.
     */
    function libelleAffiche(option, langue) {
        var brut = option.label || option.value;
        if (langue !== 'en') return brut;
        var dico = D && D.traductions;
        if (!dico) return brut;
        return dico[brut] || brut;
    }

    /**
     * Ordre d'affichage d'une liste.
     *
     * Salesforce rend les valeurs de picklist dans l'ordre du value set, qui
     * n'est ni alphabetique ni numerique : les 201 indicatifs arrivent par
     * exemple en 992, 379, 387, 243... Illisible dans un <select>.
     *
     * Deux tris, parce que deux natures de donnees :
     *   - Indicatif : NUMERIQUE. Un tri alphabetique mettrait 1 avant 212,
     *     mais aussi 33 apres 212 ; on compare donc les nombres.
     *   - le reste  : ALPHABETIQUE, avec localeCompare pour que Egypte passe
     *     avant Emirats et Etats-Unis, ce qu'un tri par code ne fait pas.
     *
     * Les niveaux d'etudes ne sont volontairement PAS tries : leur ordre
     * naturel est pedagogique (College, Seconde, Premiere, Terminale...) et
     * l'alphabet le detruirait. Le socle a deja son propre classement pour
     * eux, via `ordre`.
     */
    function trier(name, options) {
        if (!options || options.length < 2) return options;
        var copie = options.slice();

        if (name === 'Indicatif') {
            copie.sort(function (a, b) {
                var na = parseInt(a.value, 10);
                var nb = parseInt(b.value, 10);
                if (isNaN(na) && isNaN(nb)) return 0;
                if (isNaN(na)) return 1;
                if (isNaN(nb)) return -1;
                return na - nb;
            });
            return copie;
        }

        if (name === 'Country' || name === 'Campus') {
            // Tri sur le libelle AFFICHE, et dans la locale de la page : une
            // liste anglaise triee selon l'alphabet francais serait desordonnee
            // pour le lecteur.
            var lg = langueAffichage();
            var loc = lg === 'en' ? 'en' : 'fr';
            copie.sort(function (a, b) {
                var la = libelleAffiche(a, lg);
                var lb = libelleAffiche(b, lg);
                return String(la).localeCompare(String(lb), loc, { sensitivity: 'base' });
            });
            return copie;
        }

        return options;
    }

    /** Remplit un <select> en conservant sa 1re option (le placeholder). */
    function remplir(name, options, valeurCourante, viderSiVide) {
        var el = champ(name);
        if (!el || el.tagName !== 'SELECT') return null;

        // Salesforce n'a rien renvoye pour cette liste : on NE TOUCHE PAS au
        // <select>. Les options statiques deja presentes (baked par le builder)
        // servent de repli, et un champ obligatoire ne se retrouve jamais vide
        // ni desactive a cause d'un value set introuvable cote org.
        //
        // ⚠ Sauf pour la CASCADE, qui passe viderSiVide : la, une liste vide
        // est un RESULTAT — aucune valeur n'est atteignable a ce niveau — et
        // garder l'ancienne proposait des choix impossibles. Cette garde a
        // masque des heures durant un filtre de niveau qui ne matchait rien :
        // le <select> gardait sa liste precedente, donc rien ne semblait bouger.
        if (!options || !options.length) {
            if (!viderSiVide) return el;
            var vide = el.querySelector('option[value=""]');
            el.innerHTML = '';
            if (vide) el.appendChild(vide);
            el.value = '';
            return el;
        }

        options = trier(name, options);
        var langue = langueAffichage();

        var placeholder = el.querySelector('option[value=""]');
        el.innerHTML = '';
        if (placeholder) el.appendChild(placeholder);

        for (var i = 0; i < options.length; i++) {
            var o = document.createElement('option');
            // La valeur reste celle du CRM ; seul le texte est traduit.
            o.value = options[i].value;
            o.textContent = libelleAffiche(options[i], langue);
            if (valeurCourante && options[i].value === valeurCourante) o.selected = true;
            el.appendChild(o);
        }
        el.disabled = options.length === 0;
        return el;
    }

    /**
     * Valeurs distinctes d'une propriete, sur des programmes deja filtres.
     * Les MULTIPICKLISTS Salesforce arrivent serialises "a;b;c" : on les eclate,
     * sinon "Terminale;Bac obtenu" deviendrait une option unique que personne
     * ne peut choisir, et les deux niveaux reels disparaitraient du menu.
     */
    function distinct(rows, prop) {
        var vus = {}, out = [];
        for (var i = 0; i < rows.length; i++) {
            var brut = rows[i][prop];
            if (!brut) continue;
            var parts = String(brut).split(';');
            for (var j = 0; j < parts.length; j++) {
                var v = parts[j].replace(/^\s+|\s+$/g, '');
                if (!v || vus[v]) continue;
                vus[v] = true;
                out.push({ value: v, label: v });
            }
        }
        return out;
    }

    /** Une cellule multipicklist "a;b;c" contient-elle la valeur attendue ? */
    /**
     * Les deux cotes du CRM n'ecrivent pas les niveaux pareil :
     *   Account.Academic_Level_List__c        BAC+3, BAC+5 et +, BAC obtenu ou Prepa
     *   LearningProgram.Academic_Level_List__c  Bac+3, Bac+5/+,   Bac obtenu
     *
     * Le formulaire envoie le premier, les programmes portent le second. Une
     * comparaison litterale ne matche donc JAMAIS sur un niveau : le filtre
     * rendait 0 programme, `remplir` n'y touchait pas (voir sa garde), et le
     * <select> gardait sa liste precedente. Changer de niveau ne changeait
     * visiblement rien — alors que le seuil, lui, fonctionnait.
     *
     * Meme table que NIVEAU_EQUIV dans blocks/forms/shared/programme-config.js,
     * et que la sonde LPB_TST_Sonde_Niveaux. Trois copies, faute de source
     * commune entre AMPscript, le navigateur et le builder.
     */
    function canonNiveau(v) {
        var c = String(v === null || v === undefined ? '' : v)
                    .replace(/^\s+|\s+$/g, '').toUpperCase();
        if (c === 'BAC+5/+')    return 'BAC+5 ET +';
        if (c === 'BAC OBTENU') return 'BAC OBTENU OU PRÉPA';
        return c;
    }

    function texteBrut(v) { return String(v === null || v === undefined ? '' : v); }

    /**
     * Egalite toleante : un programme « Bac+2;Bac+3 » remonte pour Bac+2 ET
     * pour Bac+3. `norme` rapproche deux referentiels quand il le faut.
     */
    function contient(cellule, attendu, norme) {
        norme = norme || texteBrut;
        var att = norme(attendu);
        if (norme(cellule) === att) return true;
        if (!cellule) return false;
        var parts = String(cellule).split(';');
        for (var i = 0; i < parts.length; i++) {
            if (norme(parts[i].replace(/^\s+|\s+$/g, '')) === att) return true;
        }
        return false;
    }

    /** Filtre les programmes sur les criteres renseignes (un vide = ignore). */
    function filtrer(criteres) {
        return D.programs.filter(function (p) {
            for (var k in criteres) {
                if (!criteres[k]) continue;          // critere non renseigne -> ignore
                // egalite tolerante : un programme "Bac+2;Bac+3" doit remonter
                // pour Bac+2 ET pour Bac+3.
                if (!contient(p[k], criteres[k], k === 'level' ? canonNiveau : null)) return false;
            }
            return true;
        });
    }

    function valeur(name) { var e = champ(name); return e ? e.value : ''; }

    /* -- Matrice des champs conditionnels par ecole -------------------- */
    var CFG = D.config || null;

    /** Ordinal du niveau choisi. 0 si inconnu : aucune regle ne se declenche. */
    function ordreNiveauChoisi() {
        var v = valeur('Niveau') || valeur('Level') || valeur('StudyLevel');
        if (!v || !D.picklists || !D.picklists.StudyLevel) return 0;
        for (var i = 0; i < D.picklists.StudyLevel.length; i++) {
            if (D.picklists.StudyLevel[i].value === v) {
                return Number(D.picklists.StudyLevel[i].ordre) || 0;
            }
        }
        return 0;
    }

    /**
     * Affiche ou masque le porteur visuel d'un champ.
     *
     * On remonte au conteneur plutot que de masquer le <select> seul : masquer
     * l'input laisserait son libelle orphelin a l'ecran. La liste de selecteurs
     * couvre les enveloppes des blocs du builder ; a defaut on retombe sur le
     * parent direct.
     *
     * ⚠ Le champ est masque, PAS vide : le contrat impose qu'une valeur unique
     * soit transmise au CRM meme lorsqu'elle n'est pas proposee au candidat.
     */
    function afficher(name, visible) {
        var el = champ(name);
        if (!el) return;
        /* Les conteneurs de nos formulaires D'ABORD : sans eux la remontee
           s'arretait au `.cnd-sel-wrap`, donc on masquait le <select> en
           laissant son libelle orphelin a l'ecran. */
        var porteur = el.closest
            ? (el.closest('[data-socle-champ]') || el.closest('.cnd-field') ||
               el.closest('.brf-field') || el.closest('.jpo-field') ||
               el.closest('.imf-field') || el.closest('.form-group') ||
               el.closest('.field') || el.closest('label') || el.parentNode)
            : el.parentNode;
        porteur = porteur || el;
        porteur.style.display = visible ? '' : 'none';

        /* `required` SUIT la visibilite. C'est le navigateur qui exige les
           champs affiches — le JS des blocs ne tourne que dans le builder, il
           n'y a donc aucune validation maison sur une page publiee.
           Laisser `required` sur un champ masque bloquerait la soumission sans
           rien montrer : le navigateur refuse de partir et ne peut pas mettre
           le focus sur un champ invisible. */
        if (visible) { el.setAttribute('required', 'required'); }
        else { el.removeAttribute('required'); }
        /* Deux leviers : ces champs naissent avec la classe `hidden`
           (`.cnd-field.hidden { display: none }`), et une valeur inline vide ne
           l'emporte pas sur une regle de classe. */
        if (porteur.classList) porteur.classList.toggle('hidden', !visible);
    }

    /**
     * Un champ conditionnel doit-il etre propose ?
     *   jamais   -> non, quelle que soit la saisie
     *   toujours -> oui
     *   niveau   -> seulement si le niveau choisi atteint le seuil
     * Un ordinal a 0 (niveau non choisi, ou libelle absent du mapping) ne
     * declenche donc PAS l'affichage : on prefere masquer que proposer a tort.
     */
    function autorise(name) {
        if (!CFG || !CFG.champs || !CFG.champs[name]) return true;   // pas de config = ancien comportement
        var regle = CFG.champs[name];
        if (regle.visible === 'jamais') return false;
        if (regle.visible === 'niveau' && ordreNiveauChoisi() < Number(regle.niveauMin || 0)) return false;
        return conditionsRemplies(regle.conditions);
    }

    /**
     * Conditions CROISEES, en plus de l'axe unique de la matrice.
     *
     * « Champ=Valeur;Champ=Valeur », TOUTES vraies pour que le champ soit
     * propose. Les noms sont les attributs name[] du formulaire, les valeurs
     * celles du CRM — pas les libelles affiches, qui changent avec la langue.
     *
     * Ce que la matrice ne savait pas dire : CREAD ne propose la specialite de
     * sa brochure qu'au campus de Lyon, et pour un contact en reconversion. Un
     * seul axe par champ (jamais / toujours / seuil de niveau) ne pouvait pas
     * l'exprimer ; la regle restait donc en commentaire dans la config, et le
     * champ etait simplement desactive.
     *
     * Chaine vide = aucune condition = autorise. Un champ nomme mais ABSENT du
     * formulaire rend la condition fausse : mieux vaut ne pas proposer que
     * proposer sur une condition qu'on ne sait pas verifier.
     */
    function conditionsRemplies(brut) {
        if (!brut) return true;
        var paires = String(brut).split(';');
        for (var i = 0; i < paires.length; i++) {
            var paire = paires[i];
            if (!paire || paire.indexOf('=') === -1) continue;
            var coupe = paire.indexOf('=');
            var nom = paire.slice(0, coupe).replace(/^\s+|\s+$/g, '');
            var attendu = paire.slice(coupe + 1).replace(/^\s+|\s+$/g, '');
            if (!nom) continue;
            var el = champ(nom);
            if (!el || String(el.value) !== attendu) return false;
        }
        return true;
    }

    /** Les champs cites par une condition, tous champs confondus. */
    function champsDesConditions() {
        var noms = {};
        if (CFG && CFG.champs) {
            for (var k in CFG.champs) {
                if (!CFG.champs.hasOwnProperty(k)) continue;
                var brut = CFG.champs[k].conditions;
                if (!brut) continue;
                String(brut).split(';').forEach(function (paire) {
                    var coupe = paire.indexOf('=');
                    if (coupe > 0) noms[paire.slice(0, coupe).replace(/^\s+|\s+$/g, '')] = true;
                });
            }
        }
        return Object.keys(noms);
    }

    /* -- Ordre d'affichage propre a l'ecole ----------------------------------
       `CFG.ordre` vaut par exemple, pour IFA Paris :
           campus,niveau,language,speciality,rhythm,rentree
       soit la LANGUE avant la specialite, alors que l'ordre standard est
       l'inverse. La matrice ne dit donc pas seulement QUELS champs afficher,
       mais dans quel ORDRE — et l'ordre est une regle metier : on ne demande
       pas la specialite avant d'avoir fixe la langue d'enseignement, sinon on
       propose des specialites qui n'existent pas dans la langue choisie.

       On reordonne le DOM une seule fois, pas a chaque rafraichissement de la
       cascade : deplacer des noeuds a chaque `change` ferait perdre le focus du
       champ que l'utilisateur vient de quitter.

       Les noms de la config sont ceux du contrat (`speciality`, `rhythm`...) ;
       les attributs name[] du formulaire sont capitalises. D'ou la table. */
    var NOM_DOM = {
        campus: 'Campus', niveau: 'Niveau', level: 'Niveau',
        speciality: 'Speciality', rhythm: 'Rhythm', language: 'Language',
        rentree: 'Rentree', programme: 'Programme'
    };

    function appliquerOrdre() {
        if (!CFG || !CFG.ordre) return;

        var demande = String(CFG.ordre).split(',');
        var porteurs = [], parent = null;

        for (var i = 0; i < demande.length; i++) {
            var cle = demande[i].replace(/^\s+|\s+$/g, '');
            var el = champ(NOM_DOM[cle] || cle);
            if (!el) continue;

            /* On deplace le PORTEUR visuel, pas le <select> seul : sinon le
               libelle resterait a son ancienne place, dissocie de son champ. */
            var porteur = el.closest
                ? (el.closest('[data-socle-champ]') || el.closest('.form-group') ||
                   el.closest('.field') || el.parentNode)
                : el.parentNode;
            if (!porteur || !porteur.parentNode) continue;

            /* Tous les champs de la cascade doivent partager le meme parent,
               sinon reordonner reviendrait a les deplacer d'une section a une
               autre. On s'aligne sur le parent du premier trouve et on ignore
               les autres — mieux vaut un ordre partiel qu'un formulaire
               demonte. */
            if (!parent) parent = porteur.parentNode;
            if (porteur.parentNode !== parent) continue;

            porteurs.push(porteur);
        }

        if (!parent || porteurs.length < 2) return;

        /* Les champs de la cascade ABSENTS de `ordre` — typiquement Programme,
           qui n'y figure jamais — doivent garder leur place. Les oublier les
           renverrait en tete : tous les champs listes seraient deplaces apres
           eux. C'est ce que faisait la premiere version, et le formulaire
           s'ouvrait sur le champ Programme. */
        var deja = {};
        for (var k = 0; k < porteurs.length; k++) deja[k] = true;
        var restants = [];
        for (var n2 in NOM_DOM) {
            if (!NOM_DOM.hasOwnProperty(n2)) continue;
            var e2 = champ(NOM_DOM[n2]);
            if (!e2) continue;
            var p2 = e2.closest ? (e2.closest('[data-socle-champ]') ||
                     e2.closest('.form-group') || e2.closest('.field') ||
                     e2.parentNode) : e2.parentNode;
            if (!p2 || p2.parentNode !== parent) continue;
            if (porteurs.indexOf(p2) === -1 && restants.indexOf(p2) === -1) restants.push(p2);
        }
        var sequence = porteurs.concat(restants);

        /* On reinsere DANS le bloc d'origine, pas a la fin du parent : celui-ci
           contient aussi le nom, l'email, les consentements. Un appendChild
           renverrait toute la cascade apres eux. On prend donc comme repere
           l'element qui suivait le dernier champ de la cascade. */
        var dernier = sequence[0], idx = -1;
        for (var m = 0; m < parent.childNodes.length; m++) {
            if (sequence.indexOf(parent.childNodes[m]) !== -1) { idx = m; dernier = parent.childNodes[m]; }
        }
        var repere = dernier ? dernier.nextSibling : null;

        for (var j = 0; j < sequence.length; j++) {
            if (repere) parent.insertBefore(sequence[j], repere);
            else parent.appendChild(sequence[j]);
        }
    }

    /* -- 1. Listes independantes ------------------------------------- */
    for (var nom in D.picklists) {
        if (D.picklists.hasOwnProperty(nom)) remplir(nom, D.picklists[nom], valeur(nom));
    }
    remplir('Campus', D.campus, valeur('Campus'));
    preselectionnerCampus();

    /**
     * Pre-selectionne le campus donne dans l'URL : ?campus=lyon
     *
     * Une landing page est souvent declinee par ville — autant que le
     * formulaire arrive deja sur la bonne. Les dates d'evenement en dependent
     * directement : sans campus, on n'en propose aucune.
     *
     * Rapprochement TOLERANT, car personne n'ecrira « EFAP LYON » dans une URL :
     * on accepte la valeur exacte, la meme casse mise a part, puis le nom de
     * ville seul. On ne touche a rien si le champ est deja renseigne — un choix
     * du visiteur prime toujours sur un parametre d'URL.
     */
    function preselectionnerCampus() {
        var el = champ('Campus');
        if (!el || el.value) return;

        var voulu = parametreUrl('campus') || parametreUrl('Campus');
        if (!voulu) return;
        voulu = voulu.replace(/^\s+|\s+$/g, '');
        if (!voulu) return;

        var cible = voulu.toUpperCase();
        var options = el.options || [];
        var exact = null, approches = [];

        for (var i = 0; i < options.length; i++) {
            var v = String(options[i].value || '');
            if (!v) continue;
            var V = v.toUpperCase();
            if (V === cible) { exact = v; break; }
            /* « lyon » retrouve « EFAP LYON » : on cherche le mot entier, pas
               une sous-chaine — « nice » ne doit pas accrocher « VENICE ». */
            if (V.split(' ').indexOf(cible) !== -1) approches.push(v);
        }

        /* AMBIGU = ON NE FAIT RIEN. « campus=efap » designe les dix campus de
           l'ecole : retenir le premier reviendrait a choisir Paris au hasard,
           et le visiteur ne verrait jamais qu'on a decide pour lui. Mieux vaut
           un champ vide, qu'il remplira lui-meme. */
        var retenu = exact || (approches.length === 1 ? approches[0] : null);
        if (!retenu) return;
        el.value = retenu;
        /* Pas d'evenement `change` a emettre ici : aucun ecouteur n'est encore
           pose a ce stade. La cascade et les dates lisent la valeur lors de
           leur PREMIER rendu, plus bas — c'est ce qui rend l'ordre des sections
           important, et pourquoi cet appel doit rester juste apres le
           remplissage du champ. */
    }

    /** Un parametre de la query string, sans dependre de URLSearchParams. */
    function parametreUrl(nom) {
        try {
            var q = String(window.location.search || '');
            var re = new RegExp('[?&]' + nom + '=([^&#]*)');
            var m = re.exec(q);
            return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
        } catch (e) { return ''; }
    }

    /* -- 2. Cascade programme ---------------------------------------- */
    function rafraichirCascade() {
        /* Deux portees, et il faut les distinguer.

           La cascade des CRITERES (niveau -> specialite -> rythme -> langue)
           vaut des qu'un seul de ces champs est present : brochure, JPO,
           atelier, stage et immersion ne portent que la specialite, le contrat
           ne prevoyant rythme, langue et rentree que sur la candidature.

           La resolution du PROGRAMME (rentree -> programme -> PTAT) reste
           reservee aux formulaires qui portent la RENTREE. Sans elle, on ne
           peut pas choisir entre deux programmes, et les formulaires EDH ont
           d'ailleurs leur propre logique sur ce champ : on n'y touche pas.

           Le garde-fou unique d'avant — sortir faute de <select Rentree> —
           confondait les deux et neutralisait la specialite sur les cinq
           formulaires ci-dessus. */
        var aRentree = Boolean(champ('Rentree'));
        if (!aRentree && !champ('Speciality') && !champ('Rhythm') && !champ('Language')) return;

        var sel = {
            campus:     valeur('Campus'),
            /* ⚠ StudyLevel : c'est le nom que portent TOUS les formulaires EDH.
               Seul `form-salesforce-core` utilise `Niveau`. Sans ce troisieme
               repli, sel.level restait vide en permanence et la specialite
               n'etait filtree QUE par le campus : changer de niveau d'etudes ne
               changeait rien a la liste. Le seuil de niveau, lui, marchait —
               ordreNiveauChoisi() connaissait deja les trois noms — ce qui
               rendait la panne d'autant moins visible. */
            level:      valeur('Niveau') || valeur('Level') || valeur('StudyLevel'),
            speciality: valeur('Speciality'),
            rhythm:     valeur('Rhythm'),
            language:   valeur('Language')
        };

        // chaque liste ne propose que ce qui reste possible en amont
        remplir('Niveau',     distinct(filtrer({ campus: sel.campus }), 'level'), sel.level, true);
        remplir('Speciality', distinct(filtrer({ campus: sel.campus, level: sel.level }), 'speciality'), sel.speciality, true);
        remplir('Rhythm',     distinct(filtrer({ campus: sel.campus, level: sel.level, speciality: sel.speciality }), 'rhythm'), sel.rhythm, true);
        remplir('Language',   distinct(filtrer({ campus: sel.campus, level: sel.level, speciality: sel.speciality, rhythm: sel.rhythm }), 'language'), sel.language, true);

        /* -- Application de la matrice ------------------------------------
           Trois raisons de masquer, dans cet ordre de priorite :
             1. la matrice de l'ecole l'interdit (jamais, ou seuil de niveau) ;
             2. le mode PROGRESSIF et le champ precedent n'est pas renseigne ;
             3. une seule valeur possible — le contrat demande de masquer le
                champ tout en transmettant la valeur au CRM, ce que fait deja
                `remplir` en pre-selectionnant.
           Le champ EFAP est le contre-exemple du point 2 : sa configuration
           porte progressif=false, tous les champs sont donc proposes d'emblee. */
        var progressif = !CFG || CFG.progressif !== false;
        var conditionnels = ['Speciality', 'Rhythm', 'Language'];

        for (var c = 0; c < conditionnels.length; c++) {
            var nom = conditionnels[c];
            var el  = champ(nom);
            if (!el) continue;

            /* HORS placeholder. `remplir` conserve l'<option value=""> du
               formulaire : compter `options.length` revenait a voir deux
               choix la ou il n'y en a qu'un, et la regle « une seule valeur »
               ne se declenchait jamais sur une vraie page. */
            var reelles = [];
            if (el.options) {
                for (var k = 0; k < el.options.length; k++) {
                    if (el.options[k].value !== '') reelles.push(el.options[k]);
                }
            }

            var visible = autorise(nom);

            if (visible && progressif) {
                // en mode progressif, le champ n'apparait qu'une fois le niveau pose
                if (!sel.level) visible = false;
            }
            // une seule option reelle : valeur transmise, champ masque
            if (visible && reelles.length <= 1) visible = false;

            /* On ne PROPOSE pas cette valeur unique, on la POSE. Le champ reste
               dans le formulaire, donc elle part au CRM. Sans cela le
               placeholder restait selectionne et le champ partait vide — le
               contraire de ce que demande le contrat. */
            if (reelles.length === 1) el.value = reelles[0].value;

            afficher(nom, visible);
        }

        // Langue par defaut (IFA Paris : francais) si rien n'est encore choisi
        if (CFG && CFG.langueDefaut) {
            var elLang = champ('Language');
            if (elLang && !elLang.value) elLang.value = CFG.langueDefaut;
        }

        if (!aRentree) return;

        // programmes encore valides -> rentrees possibles
        var valides = filtrer(sel);
        var idsValides = {};
        valides.forEach(function (p) { idsValides[p.id] = true; });

        var termesVus = {}, termes = [];
        D.ptats.forEach(function (t) {
            if (!idsValides[t.programId] || termesVus[t.termId]) return;
            termesVus[t.termId] = true;
            var libelle = D.terms.filter(function (x) { return x.value === t.termId; })[0];
            termes.push({ value: t.termId, label: libelle ? libelle.label : t.termId });
        });
        var rentree = valeur('Rentree');
        remplir('Rentree', termes, rentree, true);
        rentree = valeur('Rentree');

        /* ---- LA LISTE DES PROGRAMMES VIENT DES PROGRAMMES ----------------
           Et non des PTAT, comme jusqu'au 30/08. Deux consequences de l'ancien
           montage, toutes deux silencieuses :

             - un programme SANS PTAT n'apparaissait jamais, alors qu'il est
               bien ouvert a ce campus et a ce niveau. Le PTAT est une fenetre
               de candidature, pas la definition du cursus ;
             - la liste restait VIDE tant qu'aucune rentree n'etait choisie, au
               rebours de tous les autres formulaires, ou le programme se deduit
               du campus et du niveau.

           On part donc des programmes retenus par la cascade, et la rentree ne
           fait plus que RESTREINDRE cette liste quand elle est renseignee —
           exactement comme la specialite restreint le rythme. */
        var progs = valides.filter(function (p) {
            if (!rentree) return true;
            return aUnPtat(p.id, rentree);
        }).map(function (p) {
            return { value: p.id, label: p.name || p.id };
        });

        var programme = valeur('Programme');
        remplir('Programme', progs, programme, true);
        programme = valeur('Programme');

        /* ---- LE PTAT, DEDUIT ET NON DEMANDE ------------------------------
           C'est la seule donnee dont le socle d'ecriture a besoin. Une rentree
           choisie la designe exactement ; sinon on prend la premiere du
           programme, faute de quoi un programme a rentree unique — masquee par
           la regle « une seule valeur » — partait sans PTAT. */
        var cible = champ('PTAT_Id');
        if (cible) {
            var trouve = null;
            for (var q = 0; q < D.ptats.length; q++) {
                var t = D.ptats[q];
                if (t.programId !== programme) continue;
                if (rentree && t.termId !== rentree) continue;
                trouve = t;
                break;
            }
            cible.value = trouve ? trouve.ptatId : '';
        }
    }

    /** Ce programme est-il ouvert a cette rentree ? */
    function aUnPtat(programId, termId) {
        for (var i = 0; i < D.ptats.length; i++) {
            if (D.ptats[i].programId === programId && D.ptats[i].termId === termId) return true;
        }
        return false;
    }

    /* Les champs de la cascade, PLUS ceux cites par une condition croisee :
       « Vous etes » ne fait pas partie de la cascade, mais la specialite de la
       brochure CREAD en depend. Sans cet ecouteur, la condition n'etait
       reevaluee qu'au prochain changement de campus ou de niveau. */
    ['Campus', 'Niveau', 'Level', 'StudyLevel', 'Speciality', 'Rhythm', 'Language', 'Rentree', 'Programme']
        .concat(champsDesConditions())
        .forEach(function (n) {
            var el = champ(n);
            if (el) el.addEventListener('change', rafraichirCascade);
        });
    appliquerOrdre();                 // une seule fois : voir le commentaire
    if (D.programs.length) rafraichirCascade();

    /* -- 3. Famille evenement : dates + ateliers ---------------------- */

    /**
     * Les dates proposees pour UN campus.
     *
     * La regle metier : la prochaine date de CE campus, puis tout ce qui tombe
     * dans les 15 jours qui la suivent.
     *
     *   « les prochaines JPO BRASSART Lyon sont le 10 et le 17 octobre : je
     *     peux choisir l'une ou l'autre. A Bordeaux, le 10 octobre et le 10
     *     novembre : je ne peux choisir que le 10 octobre. »
     *
     * La fenetre se calcule donc ICI et non dans le socle : elle depend d'un
     * choix fait apres le rendu. Le socle publie toutes les dates a venir de
     * l'ecole avec leur ecart en jours ; on ne garde que celles du campus.
     *
     * Campus non encore choisi : on rend TOUT, sans fenetre. Masquer les dates
     * avant que le visiteur ait choisi lui laisserait croire qu'il n'y en a
     * aucune.
     */
    function datesPour(campus) {
        var toutes = (D.instances || []).slice();
        /* PAS DE CAMPUS, PAS DE DATES — arbitrage du 30/08. On rendait
           auparavant toutes les dates de l'ecole, tous campus confondus : le
           visiteur voyait des JPO de villes ou il n'ira jamais, et la fenetre
           de 15 jours — qui se calcule PAR CAMPUS — ne s'appliquait pas. */
        if (!campus) return [];

        var duCampus = toutes.filter(function (i) { return i.campus === campus; });
        if (!duCampus.length) return [];

        var plusProche = duCampus.reduce(function (m, i) {
            var j = Number(i.jours);
            return (m === null || j < m) ? j : m;
        }, null);

        return duCampus
            .filter(function (i) {
                var j = Number(i.jours);
                return j >= plusProche && j <= plusProche + 15;
            })
            .sort(parJour);
    }

    function parJour(a, b) { return (Number(a.jours) || 0) - (Number(b.jours) || 0); }

    /**
     * Les ateliers proposes pour UNE instance.
     *
     * `instance` porte l'Id de l'instance a laquelle l'atelier est restreint
     * (le champ Salesforce s'appelle summit__Restrict_To_Instance_Title__c mais
     * contient bien un Id).
     *
     * ⚠ RATTACHEMENT STRICT depuis le 30/08. Un atelier sans instance etait
     * auparavant propose sur TOUTES les dates de l'evenement — les conferences
     * du 10 septembre s'affichaient donc aussi sous le 26. Un atelier se tient
     * a une date, pas a un evenement : sans instance renseignee, on ne sait pas
     * laquelle, et on prefere ne rien proposer a proposer un horaire faux.
     */
    function ateliersDe(instanceId) {
        if (!D.appointments || !D.appointments.length) return [];
        /* Aucune date retenue — campus pas encore choisi, ou aucune date dans
           la fenetre : il n'y a rien a proposer. Sans cette garde, le
           rapprochement strict remontait les ateliers dont l'instance est vide,
           c'est-a-dire exactement ceux qu'on ne sait pas dater. */
        if (!instanceId) return [];
        var inst = (D.instances || []).filter(function (i) { return i.value === instanceId; })[0];
        var evt = inst ? inst.evenement : '';
        return D.appointments.filter(function (a) {
            /* Deux filtres, pas un. L'evenement d'abord : le socle publie
               desormais les ateliers de TOUS les evenements de l'ecole, et ceux
               d'une JPO Lyon n'ont rien a faire sur une date Bordeaux.
               La restriction d'instance ensuite, quand elle est posee. */
            if (evt && a.evenement && a.evenement !== evt) return false;
            return a.instance === instanceId;
        }).sort(function (x, y) {
            /* Par horaire de conference d'abord : c'est l'ordre du deroulé de
               la journee, celui qu'un visiteur attend. `summit__Sort_Order__c`
               ne prend le relais que si les horaires manquent. */
            if (x.debut && y.debut && x.debut !== y.debut) {
                return x.debut < y.debut ? -1 : 1;
            }
            return (Number(x.ordre) || 0) - (Number(y.ordre) || 0);
        });
    }

    /**
     * "2026-08-29T09:30:00.000Z" -> "09:30", "09:30:00.000Z" -> "09:30".
     *
     * Deux formats a absorber : les creneaux de conference sont des DATE-HEURES
     * (summit__Date_Available_Start__c), les horaires d'instance de simples
     * HEURES (summit__Instance_Start_Time__c). On ne garde que heure et minute
     * — la date est deja sur la ligne, et les millisecondes n'apprennent rien.
     *
     * Format inattendu : on rend la valeur telle quelle plutot que de masquer
     * l'information.
     */
    function heureSeule(v) {
        var t = String(v || '');
        var m = t.match(/T(\d{2}:\d{2})/) || t.match(/^(\d{2}:\d{2})/);
        return m ? m[1] : t;
    }

    /** "09:30 - 10:30" quand les deux bornes sont la, sinon ce qu'on a. */
    function plage(debut, fin) {
        var d = debut ? heureSeule(debut) : '';
        var f = fin ? heureSeule(fin) : '';
        if (d && f) return d + ' - ' + f;
        return d || f;
    }

    /** Le texte a afficher pour une date : horaires et adresse compris. */
    var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    var MOIS  = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
                 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

    /**
     * « Samedi 06 juin 2026 » a partir d'un yyyy-MM-dd.
     *
     * Date construite en UTC : `new Date("2026-06-06")` est deja interprete en
     * UTC par le navigateur, et relire avec getDay() local ferait reculer d'un
     * jour a l'ouest de Greenwich. Une JPO annoncee le vendredi pour un samedi,
     * c'est le genre d'erreur qu'on ne voit qu'apres coup.
     */
    function dateLongue(iso) {
        if (!iso) return '';
        var d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
        if (isNaN(d.getTime())) return String(iso);
        var jour = JOURS[d.getUTCDay()];
        var n = d.getUTCDate();
        return jour.charAt(0).toUpperCase() + jour.slice(1) + ' ' +
               (n < 10 ? '0' + n : n) + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    }

    /**
     * La conference mise en avant a droite de la date.
     *
     * On prend le sous-evenement le plus MATINAL de l'instance : c'est celui
     * qui ouvre la journee, et la maquette lui reserve cette place. Choisir par
     * le LIBELLE (« conference », « presentation »...) aurait dependu de la
     * facon dont le CRM nomme ses creneaux — trop fragile pour de l'affichage.
     */
    function conferenceDe(instanceId) {
        var liste = ateliersDe(instanceId).filter(function (a) { return a.debut; });
        if (!liste.length) return null;
        liste.sort(function (a, b) { return String(a.debut).localeCompare(String(b.debut)); });
        return { label: liste[0].label, heure: heureSeule(liste[0].debut) };
    }

    function libelleInstance(inst) {
        var bouts = [];
        if (inst.date)   bouts.push(inst.date);
        var h = plage(inst.heure, inst.heureFin);
        if (h)           bouts.push(h);
        if (inst.campus) bouts.push(inst.campus);
        if (inst.address) bouts.push(inst.address);
        return bouts.length ? bouts.join(' · ') : (inst.label || inst.value);
    }

    /**
     * Rend la liste des ateliers de la date courante.
     *
     * Appelee a chaque changement de date : les conferences d'une JPO du 10
     * septembre ne sont pas celles du 17 octobre, et le socle ne peut pas
     * savoir a l'avance laquelle le visiteur choisira.
     */
    function rendreAteliers(instanceId) {
        var zone = document.querySelector('[data-socle="appointments"]');
        if (!zone) return;
        /* SEULS LES OBLIGATOIRES sont proposes — arbitrage du 29/08. Les
           sous-evenements facultatifs existent cote CRM, mais les afficher
           revenait a demander au visiteur de composer son programme, ce que la
           regle metier ne prevoit pas : il s'inscrit a une date, et ce qu'elle
           comprend d'obligatoire lui est presente. */
        var liste = ateliersDe(instanceId).filter(function (a) {
            return a.required === true || a.required === 'true';
        });
        zone.innerHTML = '';

        /* Rien d'obligatoire a cette date : on masque le bloc entier plutot
           que de laisser un intitule « Au programme » suivi du vide. */
        var porteurAteliers = zone.closest
            ? (zone.closest('.jpo-ateliers-field') || zone.closest('.jpo-field') || zone.parentNode)
            : zone.parentNode;
        if (porteurAteliers) {
            porteurAteliers.style.display = liste.length ? '' : 'none';
            if (porteurAteliers.classList) porteurAteliers.classList.toggle('hidden', !liste.length);
        }

        liste.forEach(function (a) {
            var id = 'appt_' + String(a.value).replace(/[^a-zA-Z0-9_-]/g, '');
            var wrap = document.createElement('label');
            wrap.className = 'socle-appointment';

            var box = document.createElement('input');
            box.type = 'checkbox';
            box.id = id;
            box.value = a.value;
            box.checked = (a.required === true || a.required === 'true');
            box.setAttribute('data-required', String(a.required));

            var txt = document.createElement('span');
            /* Les horaires viennent de summit__Date_Available_Start__c /
               _End__c sur le type : c'est la que le CRM porte les creneaux de
               conference. */
            var h = plage(a.debut, a.fin);
            /* Plus de mention « (obligatoire) » : la liste ne contient plus
               que ceux-la, la repeter sur chaque ligne n'apprend rien. */
            txt.textContent = a.label + (h ? ' — ' + h : '');

            wrap.appendChild(box);
            wrap.appendChild(txt);
            zone.appendChild(wrap);
        });

        /* Regroupe les cases cochees dans le champ cache "Appointments", que le
           socle d'ecriture decoupe sur les virgules.

           A REFAIRE a chaque rendu : les cases sont recreees quand la date
           change, et l'ecouteur pose sur les anciennes disparait avec elles.
           Le champ cache est remis a jour tout de suite, pour que les ateliers
           obligatoires soient comptes meme si le visiteur ne touche a rien. */
        var cible = champ('Appointments');
        if (cible) {
            var maj = function () {
                var coches = zone.querySelectorAll('input[type="checkbox"]:checked');
                var vals = [];
                for (var i = 0; i < coches.length; i++) vals.push(coches[i].value);
                cible.value = vals.join(',');
            };
            zone.addEventListener('change', maj);
            maj();
        }
    }

    /* ====================================================================
       SOUMISSION — envoi sans rechargement, puis confirmation
       ====================================================================
       Le JS des blocs ne tourne QUE dans le builder : sur une page publiee il
       n'y a que ce script-ci. C'est donc ici que vit la soumission.

       Le formulaire garde `method="post"` : si ce script ne s'execute pas, le
       navigateur poste nativement et la page de reponse affiche quand meme la
       confirmation, plus bas. On ameliore, on ne remplace pas.

       La validation, elle, reste au navigateur : `required` suit la visibilite
       des champs, l'evenement `submit` n'est meme pas emis tant qu'il manque
       quelque chose. Aucune validation maison a maintenir.

       ⚠ AMPscript n'a pas de try/catch : une ecriture refusee remplace la page
       entiere, bilan compris. Pas de marqueur = echec, jamais un imprevu. */

    var FORMULAIRES = 'form.jpo-form, form.brf-form, form.cnd-form, form.imf-form';

    /* ====================================================================
       TRACKING — recopier ce que la page a calcule dans les champs caches
       ====================================================================
       La CloudPage d'affichage lit l'URL, en deduit le canal d'acquisition et
       le consentement cookies, et publie le tout dans `window.tracking_params`.
       Mais elle ne remplit PAS les champs caches du formulaire : c'etait le
       role de populateHiddenFields(), cote blocs, qui ne tourne que dans le
       builder.

       Consequence mesuree le 31/08 sur une page publiee : utm_source, gclid,
       fbclid, canal, sous_canal, clientId — tous vides a l'ecriture, alors que
       la page les connaissait. Tout le tracking d'acquisition etait perdu, en
       silence, sur les six formulaires.

       Les noms different de part et d'autre : `client_id` cote page,
       `clientId` cote formulaire. D'ou la table. */
    var TRACKING = {
        utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign',
        utm_content: 'utm_content', utm_term: 'utm_term', utm_id: 'utm_id',
        gclid: 'gclid', fbclid: 'fbclid',
        canal: 'canal', sous_canal: 'sous_canal',
        consent: 'consent', date_consentement_cookies: 'date_consentement_cookies',
        client_id: 'clientId'
    };

    function remplirTracking(form) {
        var p = null;
        try { p = window.tracking_params || null; } catch (e) { p = null; }

        for (var cle in TRACKING) {
            if (!TRACKING.hasOwnProperty(cle)) continue;
            var el = form.querySelector('[name="' + TRACKING[cle] + '"]');
            if (!el) continue;
            /* On n'ECRASE jamais une valeur deja posee : une page peut avoir
               ete construite avec ses propres champs remplis. */
            if (el.value) continue;
            var v = p ? p[cle] : '';
            if (v !== undefined && v !== null && v !== '') el.value = v;
        }

        /* utm_campus n'est pas publie par la page — elle expose `campus`, qui
           est le campus PRE-SELECTIONNE, pas le parametre publicitaire. On le
           relit donc a la source. */
        var camp = form.querySelector('[name="utm_campus"]');
        if (camp && !camp.value) camp.value = parametreUrl('utm_campus');
    }

    /* Un message par famille. Le HTML publie porte des titres VIDES — ils
       etaient remplis par le JS des blocs, absent ici. */
    var MESSAGES = {
        brochure: {
            titre: 'Votre brochure est en route',
            texte: 'Merci ! Vous allez la recevoir par e-mail dans quelques instants. Pensez a verifier vos indesirables.'
        },
        candidature: {
            titre: 'Votre candidature est enregistree',
            texte: 'Consultez votre boite mail : un message vient de vous etre envoye pour activer votre compte et acceder au portail candidature.'
        },
        evenement: {
            titre: 'Votre place est reservee',
            texte: 'Merci ! Vous recevrez un e-mail de confirmation avec la date, l\'horaire et l\'adresse.'
        },
        immersion: {
            titre: 'Votre demande est bien recue',
            texte: 'Merci ! Nous revenons vers vous tres vite pour convenir des modalites de votre immersion.'
        }
    };

    /** La famille du formulaire, lue dans son propre champ cache. */
    function familleDe(form) {
        var el = form.querySelector('[name="TypeFormulaire"]');
        var t = el ? String(el.value || '').toLowerCase() : '';
        if (MESSAGES[t]) return t;
        /* Tolerance : les anciennes pages postaient jpo, atelier ou stage. */
        if (t === 'jpo' || t === 'atelier' || t === 'stage') return 'evenement';
        return 'evenement';
    }

    /** La carte qui entoure le formulaire, quel que soit le prefixe. */
    function carteDe(form) {
        var n = form.parentNode;
        while (n && n.className !== undefined) {
            if (/-card(\s|$)/.test(String(n.className))) return n;
            n = n.parentNode;
        }
        return form.parentNode;
    }

    /**
     * Remplace le formulaire par l'ecran de succes.
     *
     * On REUTILISE le bloc `.xxx-success` deja present : il porte le style de
     * l'ecole. Ses titres sont vides sur une page publiee, on les remplit.
     */
    function montrerSucces(form) {
        var carte = carteDe(form);
        var succes = carte.querySelector('.jpo-success, .brf-success, .cnd-success, .imf-success');
        var msg = MESSAGES[familleDe(form)];

        var zone = carte.querySelector('.jpo-form-zone');
        if (zone) { zone.style.display = 'none'; } else { form.style.display = 'none'; }

        /* Titre et sous-titre du formulaire : ils annoncaient une action qui
           n'a plus lieu d'etre. */
        var entetes = carte.querySelectorAll('.jpo-title, .brf-title, .cnd-title, .imf-title, ' +
                                             '.jpo-subtitle, .brf-subtitle, .cnd-subtitle, .imf-subtitle');
        for (var i = 0; i < entetes.length; i++) entetes[i].style.display = 'none';

        if (!succes) {
            succes = document.createElement('div');
            succes.className = 'socle-succes';
            succes.style.padding = '28px 20px';
            succes.style.textAlign = 'center';
            carte.appendChild(succes);
            succes.innerHTML = '<div style="font-size:36px;margin-bottom:10px">&#10004;</div>';
        }

        var titre = succes.querySelector('.jpo-success-thanks, .brf-success-title, ' +
                                         '.cnd-success-title, .imf-success-title');
        var texte = succes.querySelector('.jpo-success-msg, .brf-success-msg, ' +
                                         '.cnd-success-msg, .imf-success-msg');
        if (titre) { titre.textContent = msg.titre; }
        if (texte) { texte.textContent = msg.texte; }
        if (!titre && !texte) {
            var h = document.createElement('h3');
            h.textContent = msg.titre;
            var p = document.createElement('p');
            p.textContent = msg.texte;
            succes.appendChild(h);
            succes.appendChild(p);
        }

        succes.style.display = 'block';
        if (succes.classList) succes.classList.remove('hidden');
        try { succes.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    }

    /* Le socle d'ECRITURE laisse son marqueur a CHAQUE requete, pas seulement
       apres une soumission — sur un simple affichage, `statut=` est vide. Son
       absence complete signifie donc que le bloc n'est pas inclus dans cette
       page : elle a ete publiee avant qu'il existe, et aucun POST n'y ecrira
       quoi que ce soit. Le diagnostic vaut mieux qu'un « reessayez ». */
    var ECRITURE_PRESENTE = false;
    try {
        ECRITURE_PRESENTE = /<!--\s*socle ecriture:/i.test(
            (document.documentElement && document.documentElement.innerHTML) || '');
    } catch (eDetect) { ECRITURE_PRESENTE = false; }

    /**
     * Le bilan que le socle d'ecriture laisse en COMMENTAIRE dans la reponse.
     *
     * ⚠ Ancre sur `<!--`, et ce n'est pas cosmetique : ce script contient ses
     * propres expressions en clair, et la page les lui renvoie. Sans l'ancre,
     * la recherche de « socle erreur: » trouvait le TEXTE de sa propre regex et
     * rendait « \s*([\s\S]*?)\s* » comme message d'erreur au visiteur.
     * Releve le 31/08 en inspectant une reponse reelle.
     */
    function bilanDe(html) {
        var texte = String(html || '');
        var m = /<!--\s*socle ecriture:\s*statut=(\w+)/i.exec(texte);
        if (!m) return { ok: false, message: '' };
        var e = /<!--\s*socle erreur:\s*([\s\S]*?)\s*-->/i.exec(texte);
        return { ok: m[1] === 'success', message: e ? e[1] : '' };
    }

    /**
     * Que dire quand le socle n'a rien repondu.
     *
     * Deux causes tres differentes, et les confondre fait perdre des heures :
     * la page ne porte pas le socle d'ecriture, ou l'ecriture a ete refusee par
     * le CRM. La premiere se corrige en republiant, la seconde pas.
     */
    function messageEchec() {
        if (!ECRITURE_PRESENTE) {
            return "Cette page ne contient pas le socle d'ecriture : rien n'a ete "
                 + "enregistre. Republier la page depuis le builder.";
        }
        return "L'envoi n'a pas abouti — le CRM a refuse l'ecriture. "
             + "Le detail est dans LPB_Log_Soumissions, derniere ligne du RunId.";
    }

    function brancherSoumission(form) {
        if (form.__socleBranche) return;
        form.__socleBranche = true;

        /* AVANT toute soumission, y compris le POST natif sans JS : les champs
           doivent porter le tracking des l'affichage. */
        remplirTracking(form);

        form.addEventListener('submit', function (ev) {
            /* Le navigateur a deja valide : l'evenement n'arrive pas autrement. */
            if (typeof window.fetch !== 'function') return;   // repli : POST natif
            ev.preventDefault();

            var bouton = form.querySelector('button[type="submit"], input[type="submit"]');
            var libelle = bouton ? bouton.innerHTML : '';
            if (bouton) { bouton.disabled = true; bouton.textContent = 'Envoi en cours...'; }

            var corps = [];
            var vus = {};
            var champs = form.querySelectorAll('input, select, textarea');
            for (var i = 0; i < champs.length; i++) {
                var c = champs[i];
                if (!c.name) continue;
                var type = (c.type || '').toLowerCase();
                if ((type === 'checkbox' || type === 'radio') && !c.checked) continue;
                if (type === 'submit' || type === 'button') continue;
                vus[c.name] = true;
                corps.push(encodeURIComponent(c.name) + '=' + encodeURIComponent(c.value == null ? '' : c.value));
            }

            /* ⚠ UNE SEULE FOIS. Le formulaire porte deja un champ cache
               `submitted` : l'ajouter sans condition le postait DEUX fois, et
               RequestParameter("submitted") ne rendait alors plus "true". Tout
               le bloc d'ecriture etait saute — reponse `statut=` vide, aucune
               ligne de journal, et un message d'erreur qui accusait le CRM.
               Reproduit et corrige le 31/08. */
            if (!vus.submitted) corps.push('submitted=true');

            /* ---- OPT-IN PAR CANAL, DEDUIT DE LA CASE RGPD ----------------
               Le socle d'ecriture attend HasOptedInEmail / SMS / WhatsApp /
               Phone, un par canal. Le formulaire ne porte qu'une case. La
               conversion etait faite par le JS des blocs — absent d'une page
               publiee : aucun consentement n'etait donc jamais enregistre,
               alors que le visiteur avait bien coche. */
            var rgpd = form.querySelector('[name="RGPDConsent"]');
            var accepte = rgpd ? (rgpd.type === 'checkbox' ? rgpd.checked : !!rgpd.value) : false;
            var CANAUX = ['HasOptedInEmail', 'HasOptedInSMS', 'HasOptedInWhatsApp', 'HasOptedInPhone'];
            for (var k = 0; k < CANAUX.length; k++) {
                if (vus[CANAUX[k]]) continue;          // le formulaire l'a deja dit
                corps.push(CANAUX[k] + '=' + (accepte ? '1' : '0'));
            }

            window.fetch(window.location.href, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body: corps.join('&'),
                credentials: 'same-origin'
            }).then(function (r) { return r.text(); })
              .then(function (html) {
                  var bilan = bilanDe(html);
                  if (bilan.ok) { montrerSucces(form); return; }
                  if (bouton) { bouton.disabled = false; bouton.innerHTML = libelle; }
                  /* Le message du socle nomme le champ refuse ; le notre ne
                     dirait rien de plus que « ca n'a pas marche ». */
                  window.alert(bilan.message || messageEchec());
              })
              .catch(function () {
                  if (bouton) { bouton.disabled = false; bouton.innerHTML = libelle; }
                  window.alert("L'envoi n'a pas abouti. Verifiez votre connexion.");
              });
        });
    }

    /* Tout ce bloc est SECONDAIRE : le formulaire poste nativement sans lui.
       Une API absente ne doit donc pas emporter le remplissage des listes, qui
       est la raison d'etre du socle. D'ou le try/catch — et le harnais de test,
       qui n'a pas querySelectorAll, l'a demontre avant la production. */
    try {
        if (document.querySelectorAll) {
            var formulaires = document.querySelectorAll(FORMULAIRES);
            if (formulaires.length && !ECRITURE_PRESENTE && window.console && window.console.warn) {
                window.console.warn('[socle] Cette page ne contient PAS le socle d\'ecriture : '
                    + 'une soumission n\'enregistrera rien. Republier la page depuis le builder.');
            }
            for (var f = 0; f < formulaires.length; f++) brancherSoumission(formulaires[f]);

            /* REPLI SANS JS — la page a ete postee nativement et le socle a
               ecrit. On relit son bilan dans la page rendue plutot qu'une
               variable AMPscript : le bloc d'ecriture est absent des pages
               publiees avant son introduction, et lire une variable jamais
               declaree tue la page. */
            var source = document.documentElement ? (document.documentElement.innerHTML || '') : '';
            if (bilanDe(source).ok) {
                var dejaPoste = document.querySelector(FORMULAIRES);
                if (dejaPoste) montrerSucces(dejaPoste);
            }
        }
    } catch (eSoumission) { /* les listes restent remplies, c'est l'essentiel */ }

    if (D.instances && D.instances.length) {
        var elInst = champ('InstanceId');
        var zoneDates = document.querySelector('[data-socle="instances"]');
        var elCampus = champ('Campus');

        /**
         * Rend les dates du campus courant, puis les ateliers de la premiere.
         *
         * Deux rendus possibles, selon ce que le formulaire pose :
         *   BOUTONS RADIO dans [data-socle="instances"] — ce que demande la
         *   regle metier, la date la plus proche presélectionnée ;
         *   SELECT name="InstanceId" — repli pour les formulaires anciens.
         */
        function rendreDates() {
            var liste = datesPour(elCampus ? elCampus.value : '');

            if (zoneDates) {
                zoneDates.innerHTML = '';
                liste.forEach(function (inst, i) {
                    var id = 'inst_' + String(inst.value).replace(/[^a-zA-Z0-9_-]/g, '');
                    var wrap = document.createElement('label');
                    wrap.className = 'socle-instance';

                    var radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = 'InstanceId';
                    radio.id = id;
                    radio.value = inst.value;
                    if (i === 0) radio.checked = true;
                    /* Un seul `required` suffit pour tout le groupe, et le
                       navigateur s'en charge : choisir une date n'est pas
                       facultatif. */
                    if (i === 0) radio.required = true;

                    /* Deux colonnes, comme la maquette : a gauche le quand et
                       le ou, a droite la conference d'ouverture. Une seule
                       chaine « date · horaires · campus · adresse » ne
                       hierarchisait rien — tout arrivait au meme poids. */
                    var corps = document.createElement('span');
                    corps.className = 'socle-instance-corps';

                    var gauche = document.createElement('span');
                    gauche.className = 'socle-instance-quand';

                    var quand = document.createElement('strong');
                    quand.className = 'socle-instance-date';
                    quand.textContent = dateLongue(inst.date) || inst.label || inst.value;
                    gauche.appendChild(quand);

                    var detail = [];
                    var h = plage(inst.heure, inst.heureFin);
                    if (h) detail.push(h);
                    if (inst.address) detail.push(inst.address);
                    if (detail.length) {
                        var lieu = document.createElement('span');
                        lieu.className = 'socle-instance-lieu';
                        /* L'adresse porte ses propres retours a la ligne cote
                           CRM ; on les respecte plutot que de tout aplatir. */
                        lieu.textContent = detail.join(' - ');
                        gauche.appendChild(lieu);
                    }
                    corps.appendChild(gauche);

                    var conf = conferenceDe(inst.value);
                    if (conf) {
                        var droite = document.createElement('span');
                        droite.className = 'socle-instance-conf';
                        droite.textContent = conf.label + (conf.heure ? ' : ' + conf.heure : '');
                        corps.appendChild(droite);
                    }

                    radio.addEventListener('change', function () {
                        if (radio.checked) rendreAteliers(radio.value);
                    });

                    wrap.appendChild(radio);
                    wrap.appendChild(corps);
                    zoneDates.appendChild(wrap);
                });

            } else if (elInst && elInst.tagName === 'SELECT') {
                remplir('InstanceId', liste, valeur('InstanceId'));
                if (!elInst.value && liste.length) elInst.value = liste[0].value;
            }

            /* Les ateliers suivent la date retenue. Aucune date : on vide, sans
               quoi la liste de la selection precedente resterait a l'ecran. */
            rendreAteliers(liste.length ? liste[0].value : '');
        }

        if (elInst && elInst.tagName === 'SELECT') {
            elInst.addEventListener('change', function () { rendreAteliers(elInst.value); });
        }
        /* Changer de campus rebat les dates : la fenetre de 15 jours se calcule
           sur le campus retenu, pas sur l'ecole entiere. */
        if (elCampus) elCampus.addEventListener('change', rendreDates);
        rendreDates();
    }

    }   /* fin demarrer() */
})();
</script>
