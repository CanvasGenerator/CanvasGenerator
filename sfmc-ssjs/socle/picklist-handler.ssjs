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
            copie.sort(function (a, b) {
                var la = a.label || a.value;
                var lb = b.label || b.value;
                return String(la).localeCompare(String(lb), 'fr', { sensitivity: 'base' });
            });
            return copie;
        }

        return options;
    }

    /** Remplit un <select> en conservant sa 1re option (le placeholder). */
    function remplir(name, options, valeurCourante) {
        var el = champ(name);
        if (!el || el.tagName !== 'SELECT') return null;

        // Salesforce n'a rien renvoye pour cette liste : on NE TOUCHE PAS au
        // <select>. Les options statiques deja presentes (baked par le builder)
        // servent de repli, et un champ obligatoire ne se retrouve jamais vide
        // ni desactive a cause d'un value set introuvable cote org.
        if (!options || !options.length) return el;

        options = trier(name, options);

        var placeholder = el.querySelector('option[value=""]');
        el.innerHTML = '';
        if (placeholder) el.appendChild(placeholder);

        for (var i = 0; i < options.length; i++) {
            var o = document.createElement('option');
            o.value = options[i].value;
            o.textContent = options[i].label || options[i].value;
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
    function contient(cellule, attendu) {
        if (cellule === attendu) return true;
        if (!cellule) return false;
        var parts = String(cellule).split(';');
        for (var i = 0; i < parts.length; i++) {
            if (parts[i].replace(/^\s+|\s+$/g, '') === attendu) return true;
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
                if (!contient(p[k], criteres[k])) return false;
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
        var porteur = el.closest
            ? (el.closest('[data-socle-champ]') || el.closest('.form-group') ||
               el.closest('.field') || el.closest('label') || el.parentNode)
            : el.parentNode;
        (porteur || el).style.display = visible ? '' : 'none';
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
        if (regle.visible === 'niveau') return ordreNiveauChoisi() >= Number(regle.niveauMin || 0);
        return true;
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

    /* -- 2. Cascade programme ---------------------------------------- */
    function rafraichirCascade() {
        // Cascade complete (niveau -> specialite -> ... -> rentree -> programme
        // -> PTAT) : reservee aux formulaires qui portent la RENTREE, comme
        // form-salesforce-core. Les formulaires EDH (brochure, JPO, immersion,
        // candidature...) n'ont pas de <select name="Rentree"> : leur champ
        // Programme suit une logique propre, on n'y touche donc pas.
        if (!champ('Rentree')) return;

        var sel = {
            campus:     valeur('Campus'),
            level:      valeur('Niveau') || valeur('Level'),
            speciality: valeur('Speciality'),
            rhythm:     valeur('Rhythm'),
            language:   valeur('Language')
        };

        // chaque liste ne propose que ce qui reste possible en amont
        remplir('Niveau',     distinct(filtrer({ campus: sel.campus }), 'level'), sel.level);
        remplir('Speciality', distinct(filtrer({ campus: sel.campus, level: sel.level }), 'speciality'), sel.speciality);
        remplir('Rhythm',     distinct(filtrer({ campus: sel.campus, level: sel.level, speciality: sel.speciality }), 'rhythm'), sel.rhythm);
        remplir('Language',   distinct(filtrer({ campus: sel.campus, level: sel.level, speciality: sel.speciality, rhythm: sel.rhythm }), 'language'), sel.language);

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

            var nbOptions = el.options ? el.options.length : 0;
            var visible = autorise(nom);

            if (visible && progressif) {
                // en mode progressif, le champ n'apparait qu'une fois le niveau pose
                if (!sel.level) visible = false;
            }
            // une seule option reelle (hors placeholder) : valeur transmise, champ masque
            if (visible && nbOptions <= 1) visible = false;

            afficher(nom, visible);
        }

        // Langue par defaut (IFA Paris : francais) si rien n'est encore choisi
        if (CFG && CFG.langueDefaut) {
            var elLang = champ('Language');
            if (elLang && !elLang.value) elLang.value = CFG.langueDefaut;
        }

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
        remplir('Rentree', termes, rentree);
        rentree = valeur('Rentree');

        // programmes ouverts a la rentree choisie
        var progs = [];
        if (rentree) {
            var vus = {};
            D.ptats.forEach(function (t) {
                if (t.termId !== rentree || !idsValides[t.programId] || vus[t.programId]) return;
                vus[t.programId] = true;
                var p = valides.filter(function (x) { return x.id === t.programId; })[0];
                progs.push({ value: t.programId, label: p ? p.name : t.programId });
            });
        }
        var programme = valeur('Programme');
        remplir('Programme', progs, programme);
        programme = valeur('Programme');

        // resolution du PTAT final -> champ cache transmis a l'ecriture
        var cible = champ('PTAT_Id');
        if (cible) {
            var trouve = D.ptats.filter(function (t) {
                return t.programId === programme && t.termId === rentree;
            })[0];
            cible.value = trouve ? trouve.ptatId : '';
        }
    }

    ['Campus', 'Niveau', 'Level', 'Speciality', 'Rhythm', 'Language', 'Rentree', 'Programme']
        .forEach(function (n) {
            var el = champ(n);
            if (el) el.addEventListener('change', rafraichirCascade);
        });
    appliquerOrdre();                 // une seule fois : voir le commentaire
    if (D.programs.length) rafraichirCascade();

    /* -- 3. Famille evenement : dates + ateliers ---------------------- */
    if (D.instances.length) {
        var elInst = champ('InstanceId');
        if (elInst && elInst.tagName === 'SELECT') {
            remplir('InstanceId', D.instances, valeur('InstanceId'));
            // 1re date pre-selectionnee si l'utilisateur n'a rien choisi
            if (!elInst.value && D.instances.length) elInst.value = D.instances[0].value;
        }
    }

    var zone = document.querySelector('[data-socle="appointments"]');
    if (zone && D.appointments.length) {
        zone.innerHTML = '';
        D.appointments.forEach(function (a) {
            var id = 'appt_' + a.value.replace(/[^a-zA-Z0-9_-]/g, '');
            var wrap = document.createElement('label');
            wrap.className = 'socle-appointment';

            var box = document.createElement('input');
            box.type = 'checkbox';
            box.id = id;
            box.value = a.value;
            box.checked = (a.required === true || a.required === 'true');
            box.setAttribute('data-required', String(a.required));

            var txt = document.createElement('span');
            txt.textContent = a.label + (box.checked ? ' (obligatoire)' : '');

            wrap.appendChild(box);
            wrap.appendChild(txt);
            zone.appendChild(wrap);
        });

        // regroupe les cases cochees dans le champ cache "Appointments"
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
    }   /* fin demarrer() */
})();
</script>
