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

    /* ---- STYLE DES ELEMENTS QUE CE SCRIPT CREE ----------------------------
       POURQUOI ICI ET PAS DANS LE GABARIT. Le CSS d'un bloc est recopie dans
       la page au glisser-deposer, puis filtre. Deux consequences, verifiees
       sur la page EFAP-Portes-Ouvertes du 03/09 : aucune regle
       `.socle-instance-*` n'y figurait, et une retouche faite au bloc
       n'atteint JAMAIS une page deja construite — il faudrait re-deposer le
       formulaire sur chacune.

       Le socle, lui, est re-injecte a CHAQUE publication (SOCLE_INLINE).
       Poser le style ici, c'est donc le seul moyen que le design des dates
       suive une simple republication, sur toutes les pages a la fois. C'est
       aussi coherent : ces elements n'existent que parce que ce script les
       cree, leur mise en forme lui appartient.

       Conception issue de la carte du builder (capture du 03/09) : deux
       colonnes, le QUAND a gauche sous une icone calendrier, le OU a droite
       sous une icone epingle, separees par un trait vertical.

       Les icones sont des data-URI : le mot-cle currentColor n'y existe pas,
       la couleur est donc celle de .jpo-event-ico, #333.

       On n'ecrit PAS de balise <style> litterale — l'API SFMC filtre le
       balisage a l'upload ; un noeud cree en JS lui echappe, comme le <script>
       de cascade lui-meme. Pose une seule fois. */
    function poserStyleSocle() {
        try {
            if (!document.head || document.getElementById('socle-style')) return;
            var s = document.createElement('style');
            s.id = 'socle-style';
            s.textContent = [
                '.socle-instance-corps{display:flex;flex:1;gap:18px;',
                'justify-content:space-between;align-items:flex-start;flex-wrap:wrap}',
                '.socle-instance-quand,.socle-instance-ou{display:grid;',
                'grid-template-columns:20px 1fr;column-gap:10px;row-gap:2px;',
                'align-items:start;flex:1;min-width:0}',
                '.socle-instance-quand>*,.socle-instance-ou>*{grid-column:2}',
                '.socle-instance-quand::before,.socle-instance-ou::before{content:"";',
                'width:20px;height:20px;margin-top:1px;background-repeat:no-repeat;',
                'background-position:center;background-size:contain}',
                /* L'icone tient la colonne 1 sur toute la hauteur : elle reste
                   en regard de la date quand des lignes s'ajoutent dessous. */
                '.socle-instance-quand::before{grid-row:1/-1;background-image:url(',
                '"data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' ',
                'viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23333\' stroke-width=\'1.7\'%3E',
                '%3Crect x=\'3\' y=\'4.5\' width=\'18\' height=\'16.5\' rx=\'2\'/%3E',
                '%3Cpath d=\'M3 9.5h18M8 2.5v4M16 2.5v4\' stroke-linecap=\'round\'/%3E%3C/svg%3E")}',
                '.socle-instance-ou{border-left:1px solid #e0dad2;padding-left:18px}',
                '.socle-instance-ou::before{background-image:url(',
                '"data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' ',
                'viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23333\' stroke-width=\'1.7\'%3E',
                '%3Cpath d=\'M12 21.5s7-6.5 7-11.5a7 7 0 1 0-14 0c0 5 7 11.5 7 11.5z\' ',
                'stroke-linejoin=\'round\'/%3E%3Ccircle cx=\'12\' cy=\'10\' r=\'2.6\'/%3E%3C/svg%3E")}',
                '.socle-instance-date{font-weight:700;font-size:13px;color:#000}',
                '.socle-instance-lieu{font-size:12px;color:#555;line-height:1.5;',
                'white-space:pre-line}',
                /* Meme habillage que la carte du builder pour la ligne entiere.
                   ENFANTS DIRECTS uniquement : depuis que le bloc des ateliers
                   se deplace SOUS sa date, il vit dans .jpo-dates, et un
                   selecteur descendant donnerait aux cases a cocher l'allure
                   d'une carte de date. */
                '.jpo-dates>label,.imf-dates>label{border-color:#e6e1da;',
                'background:transparent;padding:16px 18px;font-size:12px}',
                /* Le bloc des ateliers, decale sous sa date : le retrait dit
                   qu'il en depend, la ou un bloc a fleur de bord se lirait
                   comme une question independante. */
                '.jpo-dates>.jpo-ateliers-field,.imf-dates>.imf-ateliers-field',
                '{padding-left:18px}',
                /* Sous 560px les colonnes s'empilent : le trait vertical
                   devient un filet horizontal. */
                '@media(max-width:560px){.socle-instance-ou{border-left:0;',
                'padding-left:0;border-top:1px solid #e0dad2;padding-top:10px}}'
            ].join('');
            document.head.appendChild(s);
        } catch (e) { /* sans style la page reste lisible, juste moins mise en forme */ }
    }
    poserStyleSocle();

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

    /* ========================================================================
     *  REGLES D'AFFICHAGE DES VALEURS DE PICKLIST
     *  Retours client « Toutes les ecoles » du 2026-09-02.
     * ------------------------------------------------------------------------
     *  Trois regles, et toutes les trois PUREMENT VISUELLES. Aucune ne cree,
     *  ne renomme ni ne reordonne quoi que ce soit cote CRM :
     *
     *    - le value set Salesforce reste la SEULE source des valeurs. Aucune
     *      option n'est ajoutee ici ; une regle qui ne retrouve pas sa valeur
     *      dans ce que le CRM a renvoye ne fait simplement rien.
     *    - la `value` postee au socle d'ecriture n'est JAMAIS touchee, pas plus
     *      que par le dictionnaire de traduction (meme raison : une valeur hors
     *      picklist est rejetee par l'org sans message).
     *
     *  1. MASQUE — valeurs que le formulaire ne propose plus.
     *  2. RANG   — ordre d'affichage demande, la ou celui du value set (ordre
     *              de creation cote org) n'a aucun sens pour un candidat.
     *  3. MARQUE — libelle qui nomme l'ecole de la page.
     * ====================================================================== */

    /**
     * Cle de comparaison d'une valeur CRM : majuscules, accents otes, espaces
     * normalises.
     *
     * Necessaire, parce que les deux cotes du CRM n'ecrivent pas les memes
     * valeurs pareil — `Collège` / `COLLÈGE`, `BAC obtenu ou Prépa` /
     * `Bac obtenu` (cf. canonNiveau plus bas, meme constat). Une egalite
     * litterale raterait la moitie des valeurs, et la panne serait DOUCE : la
     * liste s'afficherait simplement dans le mauvais ordre, sans erreur.
     */
    function cle(v) {
        var s = String(v === null || v === undefined ? '' : v)
                    .replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ').toUpperCase();
        var avec = 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ';
        var sans = 'AAAAAACEEEEIIIINOOOOOUUUUY';
        var out = '';
        for (var i = 0; i < s.length; i++) {
            var p = avec.indexOf(s.charAt(i));
            out += (p === -1) ? s.charAt(i) : sans.charAt(p);
        }
        return out;
    }

    /* -- 1. Valeurs masquees, par champ -------------------------------------
       « Jury » existe dans PersonAccountType__c et sert cote CRM : on ne la
       retire donc pas du value set, on cesse seulement de la PROPOSER sur les
       landing pages. Un membre de jury n'est pas un prospect. */
    var MASQUE = {
        VousEtes: ['JURY']
    };

    /* Valeurs masquees UNIQUEMENT sur le formulaire de candidature (.cnd-form).
       Retour candidature : « Niveau d'etudes » ne doit plus proposer Seconde,
       Premiere ni Autres — une candidature dans le superieur ne se depose pas
       avant le bac, et « Autres » n'y veut rien dire. Meme nature que MASQUE
       ci-dessus : PUREMENT VISUEL. La valeur reste dans le value set du CRM, on
       cesse seulement de la proposer ici ; rien n'est retire cote org, et la
       value postee au socle d'ecriture n'est pas touchee. Les autres
       formulaires (brochure...) gardent la liste complete.
       « AUTRE » et « AUTRES » sont tous deux listes : selon l'org le value set
       ecrit l'un ou l'autre, et `masquee` compare a l'identique. */
    var MASQUE_CANDIDATURE = {
        StudyLevel: ['SECONDE', 'PREMIERE', 'AUTRE', 'AUTRES']
    };

    /** La liste des valeurs a masquer pour ce champ, selon le formulaire porteur.
        `el` est le <select> concerne : on ne cumule les masques candidature que
        s'il vit dans un .cnd-form, pour ne pas amputer la brochure. */
    function listeMasque(name, el) {
        var base = MASQUE[name] || [];
        if (el && el.closest && el.closest('.cnd-form') && MASQUE_CANDIDATURE[name]) {
            return base.concat(MASQUE_CANDIDATURE[name]);
        }
        return base;
    }

    function masquee(liste, option) {
        if (!liste || !liste.length) return false;
        // Value ET label : selon les orgs, la valeur est l'un, l'autre, ou les deux.
        var kv = cle(option.value), kl = cle(option.label);
        for (var i = 0; i < liste.length; i++) {
            if (liste[i] === kv || liste[i] === kl) return true;
        }
        return false;
    }

    /** Ote d'une liste les valeurs que ce champ ne doit plus proposer. */
    function exclure(name, options, el) {
        var liste = listeMasque(name, el);
        if (!options || !liste.length) return options;
        var out = [];
        for (var i = 0; i < options.length; i++) {
            if (!masquee(liste, options[i])) out.push(options[i]);
        }
        return out;
    }

    /* -- 2. Ordre d'affichage demande, champ par champ ----------------------
       Une entree = [cle de valeur CRM, rang]. La cle est comparee d'abord a
       l'IDENTIQUE sur toute la table, puis en PREFIXE : c'est ce qui fait
       tenir `BAC+5`, `BAC+5 et +` et `BAC+5/+` sur une seule ligne, et
       `Autre` avec `Autres`, sans enumerer les variantes des deux
       referentiels.

       Rangs espaces de 10 : intercaler une valeur que le CRM ajouterait
       demain ne demande pas de renumeroter la table.

       Une valeur absente de la table prend RANG_INCONNU : elle reste
       AFFICHEE, apres les valeurs classees et avant « Autre », dans l'ordre
       du value set. Une nouvelle valeur CRM apparait donc toujours — mal
       placee au pire, jamais perdue. C'est le contraire d'une liste en dur,
       qui l'aurait fait disparaitre en silence. */
    var RANG_INCONNU = 500;

    var RANG = {
        /* « Vous etes » : Etudiant, Etudiant <marque>, Parent, Reconversion.
           `EDH Student` est le « Etudiant dans une ecole du groupe » du CRM,
           celui que la regle 3 renomme en « Etudiant <marque> ». */
        VousEtes: [
            ['STUDENT',       10],
            ['EDH STUDENT',   20],
            ['PARENT',        30],
            ['CAREER CHANGE', 40]
        ],

        /* Niveau d'etudes : l'ordre PEDAGOGIQUE, celui d'un parcours scolaire.
           Le value set, lui, sort dans l'ordre de creation cote org, et
           l'alphabet serait pire encore — il mettrait Bac+1 avant College et
           Seconde apres Premiere.

           ⚠ Ce rang est INDEPENDANT de `option.ordre` (DE
           LPB_Mapping_Niveaux), lu par ordreNiveauChoisi() : celui-la est un
           SEUIL metier (« specialite a partir de bac+3 »), sur une echelle qui
           ne couvre que 6 niveaux. S'en servir pour l'affichage renverrait
           College, Seconde, Premiere, Bac obtenu et Autres a egalite sur 0.

           CAP et BEP ne sont pas dans le value set aujourd'hui. Leur rang est
           pose pour qu'ils tombent au bon endroit le jour ou le CRM les
           ajoute ; tant qu'il ne les renvoie pas, ces deux lignes n'affichent
           rien du tout. */
        StudyLevel: [
            ['COLLEGE',    10],
            ['SECONDE',    20],
            ['PREMIERE',   30],
            ['TERMINALE',  40],
            ['BAC OBTENU', 50],
            ['BAC+1',      60],
            ['BAC+2',      70],
            ['BAC+3',      80],
            ['BAC+4',      90],
            ['BAC+5',     100],
            ['CAP',       110],
            ['BEP',       120],
            ['AUTRE',     900]
        ]
    };

    /* Le niveau d'etudes porte TROIS noms de champ selon le formulaire —
       `StudyLevel` sur les six formulaires EDH, `Niveau` sur
       form-salesforce-core, `Level` en repli. Meme trio que dans
       ordreNiveauChoisi() et dans la table de la cascade. Sans ces deux
       alias, un formulaire garderait l'ordre du value set alors que le
       retour client dit « toutes les ecoles » — et la liste de la CASCADE,
       remplie sous le nom `Niveau`, ne serait jamais triee. */
    RANG.Niveau = RANG.StudyLevel;
    RANG.Level  = RANG.StudyLevel;

    function rang(name, option) {
        var table = RANG[name];
        if (!table) return RANG_INCONNU;
        var k = cle(option.value), i;
        // Passe 1 : egalite exacte, sur TOUTE la table avant d'essayer les
        // prefixes — sinon `BAC+5` capterait une eventuelle valeur `BAC+5 ans`
        // avant que sa propre ligne ait ete vue.
        for (i = 0; i < table.length; i++) if (table[i][0] === k) return table[i][1];
        for (i = 0; i < table.length; i++) if (k.indexOf(table[i][0]) === 0) return table[i][1];
        return RANG_INCONNU;
    }

    /* -- 3. Libelles qui nomment la marque de la page -----------------------
       Retour client : « Etudiant dans une ecole du groupe » ne parle a
       personne sur une page EFAP ; on veut y lire « Etudiant EFAP ».

       Un gabarit par langue, `{marque}` remplace par SOCLE_DATA.marque —
       colonne `Libelle` de LPB_Mapping_Ecoles, cote serveur. Marque inconnue
       (page hors mapping, ecole absente du HTML) : on garde le libelle
       Salesforce. Le « si possible » du retour client tient donc tout seul. */
    var MARQUE = {
        VousEtes: {
            'EDH STUDENT': { fr: 'Étudiant {marque}', en: '{marque} student' }
        }
    };

    function libelleMarque(name, option, langue) {
        var parChamp = MARQUE[name];
        if (!parChamp) return '';
        var gabarit = parChamp[cle(option.value)];
        if (!gabarit) return '';
        var m = (D && D.marque) ? String(D.marque).replace(/^\s+|\s+$/g, '') : '';
        if (!m) return '';
        return String(gabarit[langue] || gabarit.fr).replace('{marque}', m);
    }

    /* ═══════════════════════════════════════════════════════════════════
       CASSE DES LIBELLES — retour client du 02/09
       « Ne rien ecrire en lettres majuscules (ex : les campus doivent etre
       en minuscule). »

       Le CRM stocke ses valeurs en CAPITALES : "EFAP PARIS", "BRASSART
       AIX-EN-PROVENCE", "COLLEGE", "BAC+5 et +". Elles arrivaient telles
       quelles dans les listes deroulantes.

       ⚠ Seul le TEXTE AFFICHE change. La `value` de l'option reste la valeur
       Salesforce d'origine : c'est elle qui repart au socle d'ecriture, et la
       reecrire casserait toutes les ecritures. Meme raison que pour la
       traduction, juste en dessous.

       Deux natures de libelles, donc deux casses — la meme coupure que dans
       `trier` plus bas :
         - NOMS PROPRES (campus, pays, indicatifs) : chaque mot prend sa
           majuscule, « EFAP PARIS » → « Efap Paris » ;
         - PHRASES (niveau d'etudes, « vous etes », programmes, ateliers) :
           seule la premiere lettre, « BAC OBTENU OU PREPA » → « Bac obtenu
           ou prepa ». Une majuscule par mot y ferait un titre anglais.

       Trois garde-fous, parce qu'une regle appliquee betement abime autant
       qu'elle repare :
         - un mot qui porte DEJA une minuscule n'est pas touche : « Bac
           obtenu », « Aix-en-Provence » ont ete ecrits a la main, on ne va
           pas les redresser ;
         - les sigles de diplomes restent en capitales — « BEP », « MBA »
           n'ont pas de premiere lettre a mettre en majuscule, et une ou deux
           lettres sont un code, jamais un mot : « Lille A1 » reste tel quel ;
         - les particules redescendent en minuscules quand elles ne
           commencent pas le libelle : « Aix-en-Provence », et non
           « Aix-En-Provence ».
    */
    var SIGLES = {
        BEP: 1, CAP: 1, BTS: 1, BUT: 1, DUT: 1, IUT: 1, MBA: 1, BBA: 1, MSC: 1,
        CPGE: 1, MANAA: 1, DNMADE: 1, DNA: 1, DNSEP: 1, DCG: 1, DSCG: 1,
        PASS: 1, LAS: 1
    };
    var PARTICULES = {
        DE: 1, DU: 1, DES: 1, LE: 1, LA: 1, LES: 1, EN: 1, ET: 1, OU: 1,
        SUR: 1, SOUS: 1, AU: 1, AUX: 1, D: 1, L: 1, LEZ: 1
    };

    /* Un « mot » garde ses chiffres et son `+` : « BAC+5 » ne doit pas se
       couper en « BAC » et « 5 », sinon le `+5` ferait perdre la majuscule. */
    var RE_MOT     = /[0-9A-Za-zÀ-ÿ+]+/g;
    var RE_MAJUSC  = /[A-ZÀ-ÖØ-Þ]/;
    var RE_MINUSC  = /[a-zß-öø-ÿ]/;
    var RE_LETTRE  = /[A-Za-zÀ-ÿ]/;

    /** Un mot ecrit tout en capitales — le seul cas qu'on se permet de refaire. */
    function toutEnCapitales(mot) {
        return RE_MAJUSC.test(mot) && !RE_MINUSC.test(mot);
    }

    /**
     * Une ou deux lettres en capitales : un CODE, pas un mot.
     *
     * « Lille A1 » nomme un vrai programme du CRM, et le passer a la casse des
     * phrases donnait « Lille a1 » — un identifiant abime. La regle vaut aussi
     * pour « MS », « RH », « ES » : aucun d'eux n'a de premiere lettre a mettre
     * en majuscule. Les chiffres ne comptent pas, sinon « BAC+5 » (3 lettres)
     * passerait pour un code.
     */
    function estCode(mot) {
        return mot.replace(/[^A-Za-zÀ-ÿ]/g, '').length <= 2;
    }

    /**
     * Le libelle, remis dans une casse lisible.
     * `nomPropre` : une majuscule par mot (campus, pays) plutot que la seule
     * premiere lettre (niveaux, phrases).
     */
    function casseLisible(texte, nomPropre) {
        var brut = String(texte === null || texte === undefined ? '' : texte);
        var premier = true;

        var sortie = brut.replace(RE_MOT, function (mot) {
            var debut = premier;
            premier = false;
            if (!toutEnCapitales(mot)) return mot;
            var bas = mot.toLowerCase();
            /* Les particules PASSENT AVANT les codes : « en », « d », « ou »
               tiennent en deux lettres et seraient prises pour des sigles,
               laissant « Aix-EN-Provence » et « Bac obtenu OU prepa ». */
            if (!debut && PARTICULES[mot]) return bas;
            if (SIGLES[mot] || estCode(mot)) return mot;
            if (!nomPropre) return bas;
            return bas.charAt(0).toUpperCase() + bas.substring(1);
        });

        if (nomPropre) return sortie;

        /* Phrase : la premiere lettre du libelle, ou qu'elle soit — « +33 » et
           « 3e » commencent par un chiffre, la majuscule tombe sur la lettre
           qui suit. Deja capitale (sigle en tete) : on n'y touche pas. */
        var i = sortie.search(RE_LETTRE);
        if (i === -1) return sortie;
        return sortie.substring(0, i) + sortie.charAt(i).toUpperCase() + sortie.substring(i + 1);
    }

    /** Les listes dont les valeurs sont des noms propres, pas des phrases. */
    function estNomPropre(name) {
        return name === 'Campus' || name === 'Country' || name === 'Indicatif';
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
     *
     * Le gabarit de marque passe AVANT le dictionnaire : « Etudiant EFAP » est
     * deja dans la langue de la page, et le faire traduire ensuite chercherait
     * une entree de dico qui n'existe pas — pour rien, la marque etant un nom
     * propre.
     */
    /* « Langue d'enseignement » : le CRM porte « FR »/« EN » sur les programmes,
       et la cascade les affichait tels quels. Retour candidature : on veut lire
       « Francais »/« Anglais » (et « French »/« English » en page anglaise).
       PUREMENT VISUEL — la value de l'option reste « FR »/« EN », c'est elle qui
       repart au socle d'ecriture ; la traduire casserait le rattachement du
       programme, comme pour tous les autres libelles ci-dessus. Une valeur hors
       table (autre langue ajoutee un jour au CRM) s'affiche telle quelle.
       Ce champ n'existe que sur la candidature, l'effet y est donc naturellement
       limite — aucun autre formulaire ne porte de <select name="Language">. */
    var LANGUE_LIBELLE = {
        FR: { fr: 'Français', en: 'French'  },
        EN: { fr: 'Anglais',  en: 'English' }
    };

    function libelleLangue(option, langue) {
        var g = LANGUE_LIBELLE[cle(option.value)] || LANGUE_LIBELLE[cle(option.label)];
        if (!g) return '';
        return g[langue] || g.fr;
    }

    function libelleAffiche(option, langue, name) {
        var surMesure = libelleMarque(name, option, langue);
        if (surMesure) return surMesure;

        if (name === 'Language') {
            var langLib = libelleLangue(option, langue);
            if (langLib) return langLib;
        }

        var brut = option.label || option.value;
        var propre = estNomPropre(name);
        /* La casse s'applique APRES le dictionnaire : celui-ci est indexe sur
           le libelle BRUT du CRM, chercher « Paris » quand la DE connait
           « PARIS » ne trouverait plus rien. */
        if (langue !== 'en') return casseLisible(brut, propre);
        var dico = D && D.traductions;
        if (!dico) return casseLisible(brut, propre);
        return casseLisible(dico[brut] || brut, propre);
    }

    /**
     * Le texte sur lequel une option est CLASSEE — pas toujours celui qu'elle
     * affiche.
     *
     * Les indicatifs s'affichent `+34 (Espagne)`, `+596 (Martinique)`. Trier ce
     * libelle tel quel classerait par le CHIFFRE, puisqu'il est en tete : +1,
     * +212, +33... c'est-a-dire l'ancien tri numerique sous un autre nom, et
     * pas du tout ce que demande le retour client du 02/09 (« par ordre
     * alphabetique »). On classe donc sur le nom de PAYS, entre parentheses.
     *
     * Sans parentheses — libelle d'une autre forme, ou value set modifie — on
     * retombe sur le libelle entier. Mal classe au pire, jamais perdu.
     */
    function cleDeTri(name, option, langue) {
        var texte = libelleAffiche(option, langue, name);
        if (name !== 'Indicatif') return texte;

        var ouvre = String(texte).indexOf('(');
        var ferme = String(texte).lastIndexOf(')');
        if (ouvre === -1 || ferme <= ouvre + 1) return texte;
        return String(texte).substring(ouvre + 1, ferme);
    }

    /**
     * Ordre d'affichage d'une liste.
     *
     * Salesforce rend les valeurs de picklist dans l'ordre du value set, qui
     * n'est ni alphabetique ni numerique : les 201 indicatifs arrivent par
     * exemple en 992, 379, 387, 243... Illisible dans un <select>.
     *
     * Deux tris, parce que deux natures de donnees :
     *   - Pays, campus et INDICATIFS : ALPHABETIQUE sur ce que le visiteur
     *     lit, avec localeCompare pour qu'Egypte passe avant Emirats et
     *     Etats-Unis, ce qu'un tri par code ne fait pas.
     *   - « Vous etes » et niveau d'etudes : ORDRE METIER, ni alphabetique ni
     *     numerique (cf. la table RANG plus haut). L'alphabet detruirait le
     *     parcours scolaire, et le value set n'a jamais eu d'ordre a proposer.
     *
     * Les listes de la CASCADE (Niveau, Speciality, Rhythm...) ne sont pas
     * triees ici : elles sortent des programmes, pas d'un value set.
     */
    function trier(name, options) {
        if (!options || options.length < 2) return options;
        var copie = options.slice();

        if (RANG[name]) {
            /* Tri STABLE : deux valeurs de meme rang — deux inconnues de la
               table — gardent leur ordre de value set. `Array.sort` n'est
               garanti stable que depuis ES2019 ; on decore avec l'index
               d'origine plutot que de parier sur le moteur du visiteur. */
            var dec = [];
            for (var i = 0; i < copie.length; i++) {
                dec.push({ o: copie[i], i: i, r: rang(name, copie[i]) });
            }
            dec.sort(function (a, b) { return (a.r - b.r) || (a.i - b.i); });
            var ordonnees = [];
            for (var j = 0; j < dec.length; j++) ordonnees.push(dec[j].o);
            return ordonnees;
        }

        if (name === 'Country' || name === 'Campus' || name === 'Indicatif') {
            // Tri sur le libelle AFFICHE, et dans la locale de la page : une
            // liste anglaise triee selon l'alphabet francais serait desordonnee
            // pour le lecteur.
            var lg = langueAffichage();
            var loc = lg === 'en' ? 'en' : 'fr';
            copie.sort(function (a, b) {
                var la = cleDeTri(name, a, lg);
                var lb = cleDeTri(name, b, lg);
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

        /* Masquage AVANT la garde de liste vide : si le CRM ne renvoyait que
           des valeurs masquees, la liste devient vide ici et la garde
           ci-dessous laisse en place les options statiques du builder — le
           champ obligatoire n'est jamais vide. */
        options = exclure(name, options, el);

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
            o.textContent = libelleAffiche(options[i], langue, name);
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
               el.closest('.imf-field') ||
               /* Le campus des formulaires evenement ne vit PAS dans un
                  `.jpo-field` : il a sa propre zone, avec le rappel de date et
                  d'adresse. Sans cette ligne la remontee s'arretait sur
                  `.jpo-campus-select-wrap` et on masquait la liste en laissant
                  son libelle — et l'encart — a l'ecran. Place APRES
                  `.jpo-field` : les autres champs ne la voient jamais. */
               el.closest('.jpo-campus-zone') || el.closest('.form-group') ||
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

    /** Les options d'un <select>, PLACEHOLDER EXCLU. */
    function optionsReelles(el) {
        var out = [];
        if (el && el.options) {
            for (var i = 0; i < el.options.length; i++) {
                if (el.options[i].value !== '') out.push(el.options[i]);
            }
        }
        return out;
    }

    /**
     * Tous les champs qui PRECEDENT celui-ci dans l'ordre de l'ecole
     * sont-ils renseignes ?
     *
     * C'est la regle du mode progressif, et elle etait FAUSSE : le code ne
     * testait que `sel.level`. La langue s'affichait donc alors que la
     * specialite, qui la precede et la restreint, etait encore vide — on
     * proposait des langues qui n'existaient pour aucune specialite atteignable.
     * Constate sur les six formulaires.
     *
     * L'ordre de reference est celui de l'ecole (`CFG.ordre`), pas un ordre
     * grave ici : IFA Paris demande la langue AVANT la specialite, et le
     * « precedent » n'y designe donc pas les memes champs qu'ailleurs.
     *
     * Deux cas ne bloquent JAMAIS, sans quoi le formulaire serait sans issue :
     *   - un champ que la matrice masque (`visible: jamais`, seuil de niveau
     *     non atteint) : il ne sera jamais rempli, il ne peut pas etre exige ;
     *   - une liste sans aucune option reelle : plus rien n'est atteignable a
     *     ce niveau, exiger un choix impossible fermerait la porte.
     * Un champ masque parce qu'il n'a QU'UNE valeur ne pose pas de probleme :
     * cette valeur lui est posee d'office, il compte donc pour rempli.
     */
    function precedentsRemplis(nomDom) {
        if (!CFG || !CFG.ordre) return true;
        var ordre = String(CFG.ordre).split(',');
        for (var i = 0; i < ordre.length; i++) {
            var nom = nomDomDeCle(String(ordre[i]).replace(/^\s+|\s+$/g, ''));
            if (!nom) continue;
            if (nom === nomDom) return true;         // on a atteint le champ lui-meme
            if (!autorise(nom)) continue;
            var el = champ(nom);
            if (el.tagName === 'SELECT' && !optionsReelles(el).length) continue;
            if (!el.value) return false;
        }
        return true;
    }

    /** Des noms DOM tries selon l'ordre de l'ecole. */
    function ordonner(noms) {
        if (!CFG || !CFG.ordre) return noms;
        var rang = {}, ordre = String(CFG.ordre).split(',');
        for (var i = 0; i < ordre.length; i++) {
            var nom = nomDomDeCle(String(ordre[i]).replace(/^\s+|\s+$/g, ''));
            if (nom) rang[nom] = i;
        }
        return noms.slice().sort(function (a, b) {
            var ra = rang[a] === undefined ? 99 : rang[a];
            var rb = rang[b] === undefined ? 99 : rang[b];
            return ra - rb;
        });
    }

    /**
     * Les trois regles d'affichage d'un champ de cascade, au meme endroit pour
     * tout le monde : la matrice, le mode progressif, la valeur unique.
     * Rend la visibilite decidee.
     */
    function reglesAffichage(nom, progressif, poserSiUnique) {
        var el = champ(nom);
        if (!el) return false;
        var reelles = optionsReelles(el);
        var visible = autorise(nom);
        if (visible && progressif && !precedentsRemplis(nom)) visible = false;
        if (visible && reelles.length <= 1) visible = false;
        /* On ne PROPOSE pas cette valeur unique, on la POSE. Le champ reste
           dans le formulaire, donc elle part au CRM. Sans cela le placeholder
           restait selectionne et le champ partait vide.

           `poserSiUnique` a false INTERDIT cette pose. Le rythme et la langue
           s'en passent — personne n'a jamais choisi autre chose — mais la
           rentree et le programme, si : quand un choix explicite du candidat
           vient d'etre invalide par la cascade, lui en substituer un autre
           d'office reviendrait a le candidater sur un programme qu'il n'a pas
           demande. On laisse vide, le champ reste affiche, il rechoisit. */
        if (reelles.length === 1 && poserSiUnique !== false) el.value = reelles[0].value;
        afficher(nom, visible);
        return visible;
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
        campus: ['Campus'],
        /* ⚠ TROIS noms pour le niveau. Tous les formulaires EDH postent
           `StudyLevel` ; seul form-salesforce-core dit `Niveau`. La table n'en
           connaissait que deux, donc le niveau n'etait JAMAIS retrouve ici : il
           restait hors du reordonnancement et remontait en tete du formulaire,
           devant le campus. Meme oubli que celui deja corrige dans `sel.level`. */
        niveau: ['Niveau', 'Level', 'StudyLevel'],
        level:  ['Niveau', 'Level', 'StudyLevel'],
        speciality: ['Speciality'], rhythm: ['Rhythm'], language: ['Language'],
        rentree: ['Rentree'], programme: ['Programme']
    };

    /** Le nom DOM d'une cle de configuration, ou null si le formulaire ne
        porte pas ce champ. On passe par la table plutot que par
        `el.getAttribute('name')` : nos <select> portent une PROPRIETE name,
        pas forcement un ATTRIBUT name, et `autorise(null)` autorisait tout. */
    function nomDomDeCle(cle) {
        var noms = NOM_DOM[cle] || [cle];
        for (var i = 0; i < noms.length; i++) {
            if (champ(noms[i])) return noms[i];
        }
        return null;
    }

    /** Le champ d'une cle de configuration, quel que soit son nom DOM. */
    function champDeCle(cle) {
        var noms = NOM_DOM[cle] || [cle];
        for (var i = 0; i < noms.length; i++) {
            var el = champ(noms[i]);
            if (el) return el;
        }
        return null;
    }

    /** Le porteur visuel d'un champ : le conteneur, pas le <select> seul. */
    function porteurDe(el) {
        return el.closest
            ? (el.closest('[data-socle-champ]') || el.closest('.cnd-field') ||
               el.closest('.brf-field') || el.closest('.jpo-field') ||
               el.closest('.imf-field') || el.closest('.form-group') ||
               el.closest('.field') || el.parentNode)
            : el.parentNode;
    }

    /**
     * Applique `OrdreChamps` — l'ordre d'affichage propre a l'ecole.
     *
     * ⚠ ON REORDONNE PAR SECTION, pas globalement. La version precedente
     * exigeait que TOUS les champs de la cascade partagent le meme parent DOM,
     * et s'alignait sur le parent du premier trouve. Or sur la candidature le
     * campus et le niveau vivent dans un `.cnd-row` a deux colonnes, tandis que
     * specialite, rythme, langue et rentree sont enfants directs du `<form>` :
     * les quatre derniers etaient donc ecartes, il ne restait qu'un porteur, et
     * la fonction sortait sans rien faire. `OrdreChamps` n'avait aucun effet sur
     * un vrai formulaire — seulement sur un gabarit ou tout est frere.
     *
     * On groupe donc les porteurs PAR PARENT et on reordonne chaque groupe
     * separement. Un champ ne traverse jamais une section — ce que la garde
     * d'origine cherchait a eviter, et qui reste vrai — mais l'ordre relatif
     * demande est respecte partout ou il a un sens.
     *
     * Cas reel : IFA Paris demande la langue AVANT la specialite. Les deux sont
     * dans la meme section, l'echange a donc bien lieu.
     */
    function appliquerOrdre() {
        if (!CFG || !CFG.ordre) return;

        var demande = String(CFG.ordre).split(',');
        var groupes = [];          // [{ parent, porteurs: [] }]

        function groupeDe(parent) {
            for (var g = 0; g < groupes.length; g++) {
                if (groupes[g].parent === parent) return groupes[g];
            }
            var neuf = { parent: parent, porteurs: [] };
            groupes.push(neuf);
            return neuf;
        }

        for (var i = 0; i < demande.length; i++) {
            var cle = demande[i].replace(/^\s+|\s+$/g, '');
            var el = champDeCle(cle);
            if (!el) continue;
            var porteur = porteurDe(el);
            if (!porteur || !porteur.parentNode) continue;
            var grp = groupeDe(porteur.parentNode);
            if (grp.porteurs.indexOf(porteur) === -1) grp.porteurs.push(porteur);
        }

        for (var n = 0; n < groupes.length; n++) reordonner(groupes[n]);
    }

    /**
     * Reordonne les porteurs d'UNE section, sans toucher a ce qui les entoure.
     *
     * Les champs de la cascade ABSENTS de `ordre` — typiquement Programme, qui
     * n'y figure jamais — gardent leur place a la suite. Les oublier les
     * renverrait en tete : tous les champs listes seraient deplaces apres eux.
     * C'est ce que faisait la premiere version, et le formulaire s'ouvrait sur
     * le champ Programme.
     */
    function reordonner(groupe) {
        var parent = groupe.parent;
        var porteurs = groupe.porteurs;
        if (!parent || porteurs.length < 2) return;

        var restants = [];
        for (var n2 in NOM_DOM) {
            if (!NOM_DOM.hasOwnProperty(n2)) continue;
            var e2 = champDeCle(n2);
            if (!e2) continue;
            var p2 = porteurDe(e2);
            if (!p2 || p2.parentNode !== parent) continue;
            if (porteurs.indexOf(p2) === -1 && restants.indexOf(p2) === -1) restants.push(p2);
        }
        var sequence = porteurs.concat(restants);

        /* On reinsere DANS le bloc d'origine, pas a la fin du parent : celui-ci
           contient aussi le nom, l'email, les consentements. Un appendChild
           renverrait toute la cascade apres eux. On prend donc comme repere
           l'element qui suivait le dernier champ de la cascade. */
        var dernier = sequence[0];
        for (var m = 0; m < parent.childNodes.length; m++) {
            if (sequence.indexOf(parent.childNodes[m]) !== -1) dernier = parent.childNodes[m];
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
    /* APRES le remplissage : le champ de recherche se construit a partir des
       <option> reellement presentes. Le faire avant ne verrait que les 7
       options statiques du builder. */
    brancherRechercheIndicatif();
    remplir('Campus', D.campus, valeur('Campus'));
    preselectionnerCampus();
    appliquerCampus();

    /**
     * Le campus est-il propose par cette ecole ?
     *
     * « Champs visibles des formulaires.xlsx » (31/08) : IFA Paris, Ecole
     * Bleue, MoPA et 3WA n'ont pas de campus a faire choisir, sur AUCUN des six
     * formulaires. L'axe vit dans LPB_Config_Champs_Ecole, publie par le socle
     * sous CFG.champs.Campus.
     *
     * ⚠ Masquer ne suffit pas : sur un formulaire evenement, les dates sont
     * filtrees par campus et « sans campus choisi, aucune date ». Un champ
     * simplement masque donnerait donc un formulaire sans creneau — une impasse
     * muette. Quand une SEULE valeur reste, on la POSE, comme le contrat
     * l'impose deja pour les champs de la cascade.
     *
     * Plusieurs valeurs et un axe `jamais` sont contradictoires : on n'en
     * choisit aucune au hasard, et on le dit en console plutot que de laisser
     * un formulaire vide sans explication.
     */
    function appliquerCampus() {
        if (!CFG || !CFG.champs || !CFG.champs.Campus) return;
        if (autorise('Campus')) return;

        var el = champ('Campus');
        if (!el) return;

        var reelles = [];
        if (el.options) {
            for (var i = 0; i < el.options.length; i++) {
                if (el.options[i].value !== '') reelles.push(el.options[i].value);
            }
        }
        if (!el.value && reelles.length === 1) el.value = reelles[0];
        if (!el.value && reelles.length > 1 && window.console && window.console.warn) {
            window.console.warn('[socle] Campus masque pour cette ecole, mais '
                + reelles.length + ' campus disponibles : aucun ne peut etre '
                + 'pose sans choisir a la place du visiteur.');
        }
        afficher('Campus', false);
    }

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

        /* Traites DANS L'ORDRE DE L'ECOLE, et non dans un ordre grave ici.
           `reglesAffichage` pose la valeur des champs a option unique ; si on
           evaluait la specialite avant la langue chez IFA Paris — qui demande
           la langue d'abord — le « precedent » de la specialite n'aurait pas
           encore recu sa valeur d'office, et la specialite resterait masquee
           un tour de trop. */
        var conditionnels = ordonner(['Speciality', 'Rhythm', 'Language']);
        for (var c = 0; c < conditionnels.length; c++) {
            reglesAffichage(conditionnels[c], progressif);
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
        var rentreeChoisie = rentree;
        remplir('Rentree', termes, rentree, true);
        /* Memes regles que les autres champs de la cascade — la rentree y
           echappait, et le programme aussi. Deux consequences, vues sur une
           vraie candidature du 31/08 : ils s'affichaient avant leurs
           precedents, et surtout une rentree UNIQUE n'etait jamais posee. Elle
           restait sur le placeholder, donc le PTAT ne se resolvait pas. */
        reglesAffichage('Rentree', progressif, !rentreeChoisie);
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
        /* ---- LE PROGRAMME NE SE DEMANDE JAMAIS ---------------------------
           « Programme souhaite » n'est PAS un champ a remplir : c'est le
           resultat de la cascade. On le masque donc toujours, meme quand il
           reste plusieurs valeurs — regle du 31/08. Le <select> demeure dans le
           formulaire, sa valeur part au CRM et sert a deduire le PTAT.

           Mesure faite avant d'ecrire ceci, sur les donnees reelles d'EFAP :
           sur 133 combinaisons completes (campus x niveau x specialite x
           rythme x langue x rentree), UNE SEULE laisse plusieurs programmes —
           et c'est un trou de donnees, trois programmes Bac+4 sans
           `Speciality__c`. Masquer ne coute donc rien : le cursus est deduit
           132 fois sur 133.

           Pas de garde « ne pas remplacer un choix explicite » ici, contrairement
           a la rentree : un champ que personne ne voit ne porte aucun choix
           humain. S'y abstenir de poser la valeur unique parce qu'une valeur
           precedente vient d'etre invalidee ferait perdre le PTAT en silence. */
        var elProg = champ('Programme');
        if (elProg) {
            var reellesProg = optionsReelles(elProg);
            if (reellesProg.length === 1) elProg.value = reellesProg[0].value;
            afficher('Programme', false);
        }
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
     * "2026-08-29T09:30:00.000Z" -> "9h30", "09:30:00.000Z" -> "9h30".
     *
     * Deux formats a absorber : les creneaux de conference sont des DATE-HEURES
     * (summit__Date_Available_Start__c), les horaires d'instance de simples
     * HEURES (summit__Instance_Start_Time__c). On ne garde que heure et minute
     * — la date est deja sur la ligne, et les millisecondes n'apprennent rien.
     *
     * NOTATION FRANCAISE — retour client du 03/09 : « 9h30 au lieu de 09:30 ».
     * Le zero de tete tombe, le deux-points devient un h, et les MINUTES
     * RONDES disparaissent : "10:00" donne "10h" et non "10h00". C'est la
     * notation de la carte du builder, que la capture du 03/09 designe comme
     * la reference — elle y ecrit « 10h - 13h ».
     *
     * Format inattendu : on rend la valeur telle quelle plutot que de masquer
     * l'information.
     */
    function heureSeule(v) {
        var t = String(v || '');
        var m = t.match(/T(\d{2}):(\d{2})/) || t.match(/^(\d{2}):(\d{2})/);
        if (!m) return t;
        return String(Number(m[1])) + 'h' + (m[2] === '00' ? '' : m[2]);
    }

    /** "9h30 - 10h30" quand les deux bornes sont la, sinon ce qu'on a. */
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

        /* SOUS LEUR DATE, ET NON TOUS EN BAS — retour client du 03/09.
           Le bloc vivait a la fin du formulaire, loin de la date a laquelle ses
           creneaux se rattachent : le visiteur cochait une date en haut, puis
           trouvait « Je souhaite participer a » plusieurs champs plus loin,
           sans rien qui les relie.

           On DEPLACE le bloc juste apres la ligne de la date retenue. Un
           deplacement, pas une copie : le champ cache Appointments, son
           ecouteur et les cases restent les memes objets — rien a
           resynchroniser.

           `insertBefore` avec un noeud deja place le retire de sa position
           precedente, c'est donc aussi ce qui le ramene a la bonne date quand
           le visiteur change d'avis. */
        try {
            var zoneD = document.querySelector('[data-socle="instances"]');
            var coche = zoneD && zoneD.querySelector
                ? zoneD.querySelector('input[name="InstanceId"]:checked')
                : null;
            var ligne = coche && coche.parentNode;
            if (porteurAteliers && ligne && ligne.parentNode &&
                ligne.parentNode.insertBefore) {
                ligne.parentNode.insertBefore(porteurAteliers, ligne.nextSibling);
            }
        } catch (eDeplacement) {
            /* Le bloc reste ou il est : moins bien place, jamais perdu. */
        }

        liste.forEach(function (a) {
            var id = 'appt_' + String(a.value).replace(/[^a-zA-Z0-9_-]/g, '');
            var wrap = document.createElement('label');
            wrap.className = 'socle-appointment';

            var box = document.createElement('input');
            box.type = 'checkbox';
            box.id = id;
            box.value = a.value;
            /* DECOCHEES PAR DEFAUT — retour client du 03/09, « places
               limitees ». Elles etaient pre-cochees parce que le CRM les
               marque obligatoires ; mais pre-cocher inscrit d'office chaque
               visiteur a des sessions a capacite limitee, y compris ceux qui
               n'y viendront pas, et remplit les places avec des absents.

               Le visiteur choisit desormais, ce que le nouvel intitule dit
               deja : « Je souhaite participer a ». `Appointments` part donc
               vide tant qu'il n'a rien coche — aucune validation n'exige le
               contraire, `data-required` n'etant lu nulle part. */
            box.checked = false;
            box.setAttribute('data-required', String(a.required));

            var txt = document.createElement('span');
            /* Les horaires viennent de summit__Date_Available_Start__c /
               _End__c sur le type : c'est la que le CRM porte les creneaux de
               conference. */
            var h = plage(a.debut, a.fin);
            /* Plus de mention « (obligatoire) » : la liste ne contient plus
               que ceux-la, la repeter sur chaque ligne n'apprend rien. */
            txt.textContent = casseLisible(a.label, false) + (h ? ' — ' + h : '');

            wrap.appendChild(box);
            wrap.appendChild(txt);
            zone.appendChild(wrap);
        });

        /* Regroupe les cases cochees dans le champ cache "Appointments", que le
           socle d'ecriture decoupe sur les virgules.

           A REFAIRE a chaque rendu : les cases sont recreees quand la date
           change, et l'ecouteur pose sur les anciennes disparait avec elles.
           Le champ cache est remis a jour tout de suite — depuis que les cases
           naissent DECOCHEES, c'est ce qui le VIDE quand on change de date :
           sans cet appel, les choix faits sur la date precedente resteraient
           postes alors que leurs cases ont disparu. */
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

    /* ---- LE MESSAGE DE CONFIRMATION, REDUIT A UNE LIGNE ----------------
       Demande du 2026-09-02 : une coche, un titre, rien d'autre.

         candidature   « Candidature envoyee »
         tout le reste « Demande envoyee »

       Le HTML publie porte des titres VIDES — ils etaient remplis par le JS
       des blocs, absent d'une page publiee. C'est donc ici que le texte vit.

       Ce qui DISPARAIT, et pourquoi le socle doit s'en charger plutot que le
       builder seul : le sous-titre explicatif et la liste de brochures
       « (PDF) » sont dans le HTML des pages DEJA PUBLIEES. Les retirer du
       bloc ne touche aucune page en ligne — cf. le piege SOCLE_INLINE. Le
       socle les efface donc a l'execution, et l'effet est immediat. */
    var MESSAGES = {
        brochure:    { titre: 'Demande envoy\u00e9e' },
        candidature: { titre: 'Candidature envoy\u00e9e' },
        evenement:   { titre: 'Demande envoy\u00e9e' },
        immersion:   { titre: 'Demande envoy\u00e9e' }
    };

    /* La coche, normalisee. Le HTML publie porte un emoji different selon le
       formulaire \u2014 enveloppe sur la candidature, coche verte ailleurs \u2014 pose
       dans un <div> sans classe, premier enfant de l'ecran de succes. Les
       deux conditions (pas de classe, texte tres court) evitent de repeindre
       un bloc qu'une ecole aurait ajoute la. */
    var COCHE = '\u2714\ufe0f';

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
            succes.innerHTML = '<div style="font-size:36px;margin-bottom:10px">&#10004;&#65039;</div>';
        }

        /* ---- TOUT LE RESTE DE LA CARTE DISPARAIT ----------------------
           On ENUMERE les enfants de la carte au lieu de nommer les zones a
           masquer. Le code precedent ne connaissait que `.jpo-form-zone` et
           les titres : sur un formulaire evenement, `.jpo-campus-zone` — la
           liste des campus et le rappel de date/adresse — est SOEUR de la zone
           de formulaire, et restait donc affichee sous le message de
           confirmation, avec sa liste toujours cliquable. Ajouter un selecteur
           de plus n'aurait fait que reculer le probleme au bloc suivant.

           Deux prudences : on ne masque jamais un element qui CONTIENT
           l'ecran de succes, et on ne balaie que si `carteDe` a reellement
           trouve une carte — son repli est le parent du formulaire, qui
           pourrait etre un conteneur bien plus large que la carte. */
        if (/-card(\s|$)/.test(String(carte.className || '')) && carte.children) {
            for (var e = 0; e < carte.children.length; e++) {
                var enfant = carte.children[e];
                if (!enfant || enfant === succes) continue;
                if (enfant.contains && enfant.contains(succes)) continue;
                if (enfant.style) enfant.style.display = 'none';
            }
        }

        var titre = succes.querySelector('.jpo-success-thanks, .brf-success-title, ' +
                                         '.cnd-success-title, .imf-success-title');
        var texte = succes.querySelector('.jpo-success-msg, .brf-success-msg, ' +
                                         '.cnd-success-msg, .imf-success-msg');
        if (titre) { titre.textContent = msg.titre; }

        /* Le sous-titre n'a plus de contenu. On le VIDE et on le MASQUE : le
           vider seul lui laisserait sa marge basse, et l'ecran gagnerait un
           blanc que rien ne justifie. */
        if (texte) {
            texte.textContent = '';
            texte.style.display = 'none';
        }

        /* Les blocs annexes de l'ecran de succes disparaissent — aujourd'hui
           la seule liste de brochures, dont les liens « (PDF) » ne menaient
           nulle part (`onclick="return false"`) et dont la liste restait vide
           sur une page publiee, faute du JS des blocs pour la remplir. */
        var annexes = succes.querySelectorAll ? succes.querySelectorAll('.brf-brochure-list') : [];
        for (var an = 0; an < annexes.length; an++) {
            if (annexes[an].style) annexes[an].style.display = 'none';
        }

        var icone = succes.children ? succes.children[0] : null;
        if (icone && icone.tagName === 'DIV' && !icone.className
            && String(icone.textContent || '').length <= 4) {
            icone.textContent = COCHE;
        }

        if (!titre) {
            var h = document.createElement('h3');
            h.textContent = msg.titre;
            succes.appendChild(h);
        }

        succes.style.display = 'block';
        if (succes.classList) succes.classList.remove('hidden');
        try { succes.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    }

    /* ====================================================================
       CANDIDATURE BLOQUEE — regle 8 du cadrage
       ====================================================================
       Le socle d'ecriture connait deux refus, et n'ecrit rien dans les deux
       cas (ni compte, ni consentement, ni campagne) :

         r1  une candidature est deja en cours pour ce couple personne x PTAT
             (unicite e-mail x programme, Jira 1070 / 463) ;
         r2  une decision defavorable a deja ete rendue sur ce programme
             (FinalDecision__c = Rejected, Jira 464).

       Un dossier « Withdrawn / Abandoned » ne bloque pas : le candidat a
       renonce, il a le droit de revenir. C'est le socle d'ecriture qui en
       decide, pas cet ecran.

       Ce que ce bloc corrige : jusqu'ici la reponse portait `statut=blocked`
       et aucun message. Le front tombait donc sur sa branche d'echec et
       affichait, dans une `alert()`, « le CRM a refuse l'ecriture — le detail
       est dans LPB_Log_Soumissions ». A un candidat.

       --- Pourquoi le formulaire RESTE affiche -------------------------
       Le blocage porte sur UN programme, pas sur la personne : changer de
       campus, de specialite ou de rentree designe un autre PTAT, sur lequel
       rien n'interdit de candidater. Remplacer le formulaire par le message,
       comme le fait la confirmation, fermerait cette porte. On pose donc un
       encart au-dessus du bouton, et on rend le bouton.

       --- Pourquoi les accents sont echappes ---------------------------
       Le texte est celui du cadrage, au mot pres. Ce fichier est recopie dans
       `picklist-handler.ampscript` puis televerse par l'API SFMC : les
       sequences \u sont du pur ASCII a la source et rendent l'accent a
       l'execution, quoi que fasse l'encodage en chemin. */
    var MESSAGES_BLOCAGE = {
        r1: [
            'Vous avez d\u00e9j\u00e0 une candidature en cours pour ce programme.',
            'Nous vous invitons \u00e0 contacter le service des admissions du '
                + 'campus auquel vous souhaitez candidater.'
        ],
        r2: [
            'Votre pr\u00e9c\u00e9dente candidature \u00e0 ce programme a fait '
                + 'l\'objet d\'une d\u00e9cision d\u00e9favorable. Une nouvelle '
                + 'candidature au m\u00eame programme n\'est pas possible avant '
                + 'l\'ann\u00e9e prochaine. Pour toute question, veuillez '
                + 'contacter le service des admissions.'
        ]
    };

    /** L'encart de blocage du formulaire, cree au premier besoin. */
    function encartBlocage(form) {
        var zone = form.querySelector('[data-socle="blocage"]');
        if (zone) return zone;

        zone = document.createElement('div');
        zone.className = 'socle-blocage';
        if (zone.setAttribute) {
            zone.setAttribute('data-socle', 'blocage');
            /* `alert` et non `status` : le message annonce que la soumission
               n'a pas abouti, un lecteur d'ecran doit l'entendre aussitot. */
            zone.setAttribute('role', 'alert');
        }
        zone.style.margin = '16px 0';
        zone.style.padding = '14px 16px';
        zone.style.borderRadius = '6px';
        zone.style.borderLeft = '4px solid #b42318';
        zone.style.background = '#fef3f2';
        zone.style.color = '#7a271a';
        zone.style.fontSize = '13px';
        zone.style.lineHeight = '1.5';
        zone.style.textAlign = 'left';

        /* Au-dessus du bouton plutot qu'a la fin du formulaire : le candidat
           doit lire avant de recliquer. Repli par ajout si la maquette de
           l'ecole ne porte pas la meme enveloppe de bouton. */
        var ancre = form.querySelector('.cnd-submit-wrap, .brf-submit-wrap, '
                                     + '.jpo-submit-wrap, .imf-submit-wrap');
        if (ancre && ancre.parentNode && ancre.parentNode.insertBefore) {
            ancre.parentNode.insertBefore(zone, ancre);
        } else {
            form.appendChild(zone);
        }
        return zone;
    }

    /** Affiche le message du cadrage correspondant au motif renvoye. */
    function montrerBlocage(form, motif) {
        /* Motif absent : une page publiee avant que le socle d'ecriture ne
           l'emette. R1 est le cas de loin le plus frequent, et son message ne
           prejuge d'aucune decision de jury — c'est le defaut le moins faux. */
        montrerMessage(form, MESSAGES_BLOCAGE[motif] || MESSAGES_BLOCAGE.r1);
    }

    /**
     * Affiche des lignes libres dans le meme encart.
     *
     * Extrait de `montrerBlocage` pour servir aussi aux refus de SAISIE — un
     * numero de telephone au mauvais format, par exemple. Meme encart a dessein
     * : le candidat a un seul endroit a lire, et il est deja style, place
     * au-dessus du bouton et annonce aux lecteurs d'ecran.
     */
    function montrerMessage(form, lignes) {
        var zone = encartBlocage(form);

        while (zone.firstChild) zone.removeChild(zone.firstChild);

        for (var i = 0; i < lignes.length; i++) {
            var p = document.createElement('p');
            p.textContent = lignes[i];
            p.style.margin = i === 0 ? '0' : '6px 0 0';
            zone.appendChild(p);
        }

        zone.style.display = 'block';
        try { zone.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    }

    /** Efface l'encart avant une nouvelle tentative : le programme a pu changer. */
    function effacerBlocage(form) {
        var zone = form.querySelector('[data-socle="blocage"]');
        if (zone) zone.style.display = 'none';
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
        if (!m) return { ok: false, bloque: false, motif: '', message: '' };
        var e = /<!--\s*socle erreur:\s*([\s\S]*?)\s*-->/i.exec(texte);
        /* Meme ancrage sur `<!--` que ci-dessus, et pour la meme raison. */
        var b = /<!--\s*socle blocage:\s*motif=(\w+)/i.exec(texte);
        return {
            ok: m[1] === 'success',
            bloque: m[1] === 'blocked',
            motif: b ? b[1].toLowerCase() : '',
            message: e ? e[1] : ''
        };
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

    /* ========================================================================
     *  RECHERCHE DANS LA LISTE DES INDICATIFS
     * ------------------------------------------------------------------------
     *  Retour client du 02/09 : « permettre a l'utilisateur de trouver le bon
     *  indicatif en tapant un chiffre (ex : +34) ou en tapant des lettres
     *  (ex : ES) ».
     *
     *  Un <select> natif ne sait pas faire : le navigateur ne compare qu'au
     *  DEBUT du texte de l'option, et nos libelles commencent par le chiffre —
     *  taper « ES » ne trouve donc jamais « +34 (Espagne) ». Avec 201 pays, la
     *  liste deroulante seule est inutilisable.
     *
     *  --- Ce qui est ajoute, et ce qui ne change pas ------------------------
     *  On AJOUTE un champ de saisie par-dessus. Le <select> reste dans le
     *  formulaire, garde son `name` et reste la seule source de la valeur
     *  postee : `IndicatifPick__c` continue de recevoir « 33 », et le socle
     *  d'ecriture ne voit aucune difference. Choisir dans la liste filtree ne
     *  fait qu'ecrire dans le <select>, puis emettre `change` pour que tout ce
     *  qui l'ecoute — le controle de longueur du telephone — reagisse.
     *
     *  ⚠ Le <select> est masque VISUELLEMENT, pas retire du flux ni mis en
     *  `display:none`. Il reste focusable : si un jour `required` lui est pose,
     *  le navigateur pourra y mettre le focus. Un `display:none` sur un champ
     *  requis fait echouer la soumission avec « an invalid form control is not
     *  focusable », sans rien montrer au visiteur.
     * ====================================================================== */

    /** Cle de recherche : majuscules, sans accent, sans espaces parasites. */
    function cleRecherche(v) {
        var s = String(v === null || v === undefined ? '' : v)
                    .replace(/^\s+|\s+$/g, '').toUpperCase();
        var avec = 'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ';
        var sans = 'AAAAAACEEEEIIIINOOOOOUUUUY';
        var out = '';
        for (var i = 0; i < s.length; i++) {
            var p = avec.indexOf(s.charAt(i));
            out += (p === -1) ? s.charAt(i) : sans.charAt(p);
        }
        return out;
    }

    /**
     * Le nom de pays d'un libelle `+34 (Espagne)`. Vide si la forme differe.
     * Meme extraction que cleDeTri, pour que la recherche porte exactement sur
     * ce qui a servi a trier — sinon l'ordre des resultats serait incoherent.
     */
    function paysDuLibelle(texte) {
        var o = String(texte).indexOf('(');
        var f = String(texte).lastIndexOf(')');
        if (o === -1 || f <= o + 1) return '';
        return String(texte).substring(o + 1, f);
    }

    /**
     * Score de correspondance : plus petit = plus pertinent, -1 = exclu.
     *
     *   0  le CODE est EXACTEMENT la saisie    « 1 »  -> +1 (Canada / USA)
     *   1  le CODE commence par la saisie      « 34 » -> +34 · « 1 » -> +1876
     *   2  le PAYS commence par la saisie      « ES » -> Espagne
     *   3  le PAYS contient la saisie          « pagn » -> Espagne
     *
     * ⚠ L'EXACT doit primer sur le PREFIXE, sinon taper « 1 » enterre
     * « +1 (Canada / USA) » sous les treize indicatifs caribeens en +1xxx —
     * mesure faite sur les 201 valeurs de l'org, la Jamaique sortait premiere.
     * Meme piege avec « 33 » face a « +33x » s'il en apparaissait un.
     *
     * Les chiffres ne cherchent QUE dans le code, et les lettres QUE dans le
     * pays : « 1 » ne doit pas remonter les pays contenant un « 1 » nulle part,
     * et « ES » ne doit pas remonter un code.
     *
     * ⚠ « ES » trouve Espagne parce que le PAYS commence par ES, PAS parce que
     * c'est le code ISO — ces codes ne figurent nulle part dans les donnees de
     * l'org. « DE » ne trouvera donc jamais l'Allemagne. Y remedier demanderait
     * une colonne ISO dans LPB_Mapping_Indicatifs.
     */
    function scoreIndicatif(saisie, code, pays) {
        if (!saisie) return 4;                       // saisie vide : tout s'affiche
        var q = cleRecherche(saisie).replace(/^\+/, '').replace(/\s+/g, '');
        if (!q) return 4;

        if (/^[0-9]+$/.test(q)) {
            var c = String(code);
            if (c === q) return 0;
            return c.indexOf(q) === 0 ? 1 : -1;
        }

        var p = cleRecherche(pays);
        if (!p) return -1;
        if (p.indexOf(q) === 0) return 2;

        /* « CONTIENT » seulement a partir de 3 lettres. Sur deux lettres la
           recherche est presque toujours une abreviation, et le « contient »
           n'apporte que du bruit : « DE » remontait 11 pays — Bangladesh,
           Barbade, Finlande, Grenade... — dont aucun n'etait l'Allemagne.
           Mesure sur les 201 valeurs de l'org. */
        if (q.length >= 3 && p.indexOf(q) !== -1) return 3;
        return -1;
    }

    /** Construit le champ de recherche par-dessus le <select> des indicatifs. */
    function brancherRechercheIndicatif() {
        var select = document.querySelector('select[name="Indicatif"]');
        if (!select || select.__socleCombo) return;

        /* Sous ~20 pays, la liste deroulante native suffit et reste plus
           familiere — surtout sur mobile, ou elle ouvre le selecteur du
           systeme. On n'ajoute donc le champ de recherche que quand la liste
           devient reellement difficile a parcourir. C'est aussi ce qui evite
           de degrader l'apercu du builder, qui n'a que 7 options statiques. */
        var options = select.options || [];
        if (options.length < 20) return;

        select.__socleCombo = true;

        /* -- Inventaire, une fois : on ne relit pas le DOM a chaque frappe. */
        var entrees = [];
        for (var i = 0; i < options.length; i++) {
            var o = options[i];
            if (!o.value) continue;                  // placeholder eventuel
            entrees.push({
                value: o.value,
                texte: o.textContent || o.value,
                pays: paysDuLibelle(o.textContent || ''),
                i: entrees.length
            });
        }
        if (!entrees.length) return;

        /* ⚠ ON N'AJOUTE AUCUN CONTENEUR. Premiere version : un <div> insere
           entre `.xxx-phone-prefix-wrap` et le <select>. Le conteneur est un
           FLEX de 112px de large, et le <select> son enfant `flex:1` — glisser
           un div au milieu lui retirait sa taille : bloc blanc a cote du champ
           et libelle tronque (« +34 (Espagn »). Constate sur capture le 02/09.

           On met donc la saisie A LA PLACE du <select>, dans le meme flex et
           avec les MEMES classes : elle herite de la hauteur, du fond, de la
           police et du chevron `::after` deja dessines par l'ecole. Rien n'est
           restyle ici — chaque ecole a sa maquette, une bordure ecrite dans le
           socle jurerait sur les dix. */
        var hote = select.closest
            ? (select.closest('.jpo-phone-prefix-wrap') || select.closest('.brf-phone-prefix-wrap')
               || select.closest('.cnd-phone-prefix-wrap') || select.closest('.imf-phone-prefix-wrap')
               || select.closest('.pc-phone-prefix-wrap') || select.closest('.wbc-phone-prefix-wrap')
               || select.parentNode)
            : select.parentNode;
        hote = hote || select.parentNode;

        /* Les six conteneurs du builder sont deja `position:relative` ; ce
           filet ne sert qu'a un gabarit d'ecole qui ne le serait pas — sans
           lui la liste se positionnerait par rapport a la page. */
        try {
            var calc = window.getComputedStyle ? window.getComputedStyle(hote) : null;
            if (calc && calc.position === 'static') hote.style.position = 'relative';
        } catch (eStyle) {}

        var saisie = document.createElement('input');
        saisie.type = 'text';
        saisie.setAttribute('autocomplete', 'off');
        saisie.setAttribute('role', 'combobox');
        saisie.setAttribute('aria-expanded', 'false');
        saisie.setAttribute('aria-autocomplete', 'list');
        saisie.setAttribute('aria-label', select.getAttribute('aria-label') || 'Indicatif pays');
        saisie.placeholder = langueAffichage() === 'en' ? 'Code or country' : 'Indicatif ou pays';
        /* Le champ HERITE de l'apparence du <select> : chaque ecole a sa
           maquette, et une bordure ecrite ici jurerait sur les dix. On recopie
           donc les classes du select plutot que d'inventer un style. */
        /* Les memes classes que le <select>, PUIS son rendu calcule. */
        saisie.className = select.className;
        saisie.setAttribute('data-socle', 'combo-indicatif');

        var liste = document.createElement('ul');
        liste.setAttribute('role', 'listbox');
        /* `right:auto` et une largeur propre : le conteneur ne fait que 112px,
           s'y aligner rendrait « +1268 (Antigua-et-Barbuda) » illisible. */
        liste.style.cssText = 'position:absolute;z-index:9999;left:0;right:auto;top:100%;'
            + 'margin:2px 0 0;padding:4px 0;list-style:none;max-height:260px;overflow-y:auto;'
            + 'background:#fff;border:1px solid #cfcfe0;border-radius:6px;'
            + 'box-shadow:0 6px 18px rgba(0,0,0,.14);display:none;'
            + 'font-size:13px;line-height:1.4;color:#12123a;text-align:left;'
            + 'min-width:250px;white-space:nowrap';

        /* La saisie prend la PLACE du <select> dans le flex ; la liste se
           rattache au conteneur, deja positionne. */
        select.parentNode.insertBefore(saisie, select);
        hote.appendChild(liste);

        /* ---- LA SEULE CHOSE A NEUTRALISER : LA LARGEUR INTRINSEQUE -------
           ⚠ AUCUNE COULEUR, AUCUNE BORDURE, AUCUNE POLICE N'EST ECRITE ICI.
           La classe du <select> porte tout le style de l'ecole et de la
           variante — JPO en champs blancs sur carte beige, `stage` en
           indicatif transparent, brochure avec son propre jeu. Le socle n'a
           rien a en dire : une valeur ecrite ici jurerait forcement sur l'une
           des dix maquettes.

           DEUX TENTATIVES RATEES, gardees ici pour qu'on ne les refasse pas :

             1. La classe seule. Insuffisant, mais pas pour une raison de
                couleur : un <input> a une LARGEUR INTRINSEQUE (celle de son
                attribut `size`, 20 caracteres par defaut) la ou un <select>
                n'en a pas. Le conteneur flex etant en `min-width: auto`, il
                s'elargit pour contenir cette largeur — l'indicatif mangeait
                la place du numero.

             2. Recopier le style CALCULE du <select>. Pire : cela reposait
                aussi `height`, `padding` et `box-sizing` en dur, donc cela
                MODIFIAIT la mise en page au lieu de la respecter. Constate le
                02/09 — l'indicatif prenait les deux tiers de la ligne.

           La cause etait donc unique et purement dimensionnelle. `size = 1`
           ramene la largeur intrinseque a presque rien, et le champ se
           comporte enfin comme le <select> qu'il remplace. */
        saisie.size = 1;
        saisie.style.flex = '1';
        saisie.style.minWidth = '0';
        saisie.style.width = '100%';
        /* `border-box` parce que la classe pose un `padding` horizontal : en
           `content-box`, `width:100%` plus ce padding deborderait du
           conteneur. Ce n'est pas un choix d'apparence, c'est ce qui fait
           tenir la boite dans la place du <select>. */
        saisie.style.boxSizing = 'border-box';
        /* Le libelle le plus long — « +1268 (Antigua-et-Barbuda) » — depasse
           la largeur du conteneur. Le <select> le tronquait deja sans le dire ;
           on le tronque proprement, et l'infobulle donne le nom entier. */
        saisie.style.textOverflow = 'ellipsis';

        /* Masque VISUELLEMENT, toujours focusable — voir l'avertissement plus
           haut. `pointer-events:none` pour qu'un clic traverse vers la saisie.
           ⚠ Pas de `display:none` : le navigateur ne peut pas mettre le focus
           sur un champ ainsi masque, et si `required` lui etait pose un jour la
           soumission echouerait sans rien afficher. */
        select.style.cssText = 'position:absolute;opacity:0;pointer-events:none;'
            + 'width:1px;height:1px;padding:0;margin:0;border:0;overflow:hidden;left:0;top:0';

        var actif = -1;      // index dans la liste RENDUE, pas dans `entrees`
        var rendues = [];

        function libelleDe(v) {
            for (var k = 0; k < entrees.length; k++) if (entrees[k].value === v) return entrees[k].texte;
            return '';
        }

        function refleterSelection() {
            var texte = libelleDe(select.value);
            saisie.value = texte;
            /* Le conteneur ne fait que 112px : l'infobulle donne le libelle
               entier quand il est tronque a l'ecran. */
            if (texte) saisie.title = texte; else saisie.removeAttribute('title');
        }

        function fermer() {
            liste.style.display = 'none';
            saisie.setAttribute('aria-expanded', 'false');
            actif = -1;
        }

        function choisir(entree) {
            select.value = entree.value;
            refleterSelection();
            fermer();
            /* `change` et non une fonction appelee en direct : le controle de
               longueur du telephone, et tout futur ecouteur, se branchent sur
               l'evenement. Emettre l'evenement les sert tous. */
            try {
                var ev = document.createEvent('HTMLEvents');
                ev.initEvent('change', true, false);
                select.dispatchEvent(ev);
            } catch (e) {}
        }

        function marquerActif() {
            var enfants = liste.childNodes;
            for (var k = 0; k < enfants.length; k++) {
                var estActif = (k === actif);
                enfants[k].style.background = estActif ? '#eef0ff' : '';
                if (enfants[k].setAttribute) enfants[k].setAttribute('aria-selected', String(estActif));
            }
            if (actif >= 0 && enfants[actif] && enfants[actif].scrollIntoView) {
                try { enfants[actif].scrollIntoView({ block: 'nearest' }); } catch (e) {}
            }
        }

        function rendre(q) {
            var trouvees = [];
            for (var k = 0; k < entrees.length; k++) {
                var s = scoreIndicatif(q, entrees[k].value, entrees[k].pays);
                if (s !== -1) trouvees.push({ e: entrees[k], s: s });
            }
            /* Tri STABLE par pertinence : a score egal, on garde l'ordre
               alphabetique du <select>, deja etabli par `trier`. */
            trouvees.sort(function (a, b) { return (a.s - b.s) || (a.e.i - b.e.i); });

            while (liste.firstChild) liste.removeChild(liste.firstChild);
            rendues = [];

            if (!trouvees.length) {
                var vide = document.createElement('li');
                vide.textContent = langueAffichage() === 'en' ? 'No match' : 'Aucun résultat';
                vide.style.cssText = 'padding:8px 12px;color:#777';
                liste.appendChild(vide);
                liste.style.display = 'block';
                saisie.setAttribute('aria-expanded', 'true');
                actif = -1;
                return;
            }

            /* Plafond d'affichage : 201 <li> a chaque frappe rament sur mobile,
               et personne ne lit au-dela. La recherche, elle, porte bien sur
               les 201. */
            var max = Math.min(trouvees.length, 60);
            for (var j = 0; j < max; j++) {
                var e = trouvees[j].e;
                var li = document.createElement('li');
                li.textContent = e.texte;
                li.setAttribute('role', 'option');
                li.style.cssText = 'padding:7px 12px;cursor:pointer;white-space:nowrap';
                (function (entree, el) {
                    /* `mousedown` et non `click` : le `blur` de la saisie part
                       avant le click et fermerait la liste, si bien qu'un clic
                       ne selectionnait jamais rien. */
                    el.addEventListener('mousedown', function (ev) {
                        ev.preventDefault();
                        choisir(entree);
                    });
                    el.addEventListener('mouseenter', function () {
                        actif = rendues.indexOf(entree);
                        marquerActif();
                    });
                })(e, li);
                liste.appendChild(li);
                rendues.push(e);
            }
            liste.style.display = 'block';
            saisie.setAttribute('aria-expanded', 'true');
            actif = 0;
            marquerActif();
        }

        /* ---- LA SAISIE NE VAUT QUE POUR FILTRER -------------------------
           Exigence du 02/09 : « il tape juste pour filtrer », et « aucune
           saisie n'est enregistree dans le champ indicatif ».

           Deux garanties, et la premiere suffirait :

           1. STRUCTURELLE. Cette saisie n'a PAS d'attribut `name`, et la
              soumission ignore tout champ qui n'en a pas (`if (!c.name)
              continue;`). Ce qui est tape ne peut donc PAS partir au CRM. La
              valeur postee vient du <select>, qui ne peut contenir qu'une
              valeur du value set — un <select> ne se saisit pas.

           2. VISUELLE, celle qui manquait. Sans elle, taper « abcdef » apres
              avoir choisi Maroc laissait « abcdef » a l'ecran : le candidat
              croyait avoir saisi un indicatif, alors que « 212 » restait
              retenu. La donnee etait juste, l'affichage mentait.

           On reaffiche donc TOUJOURS la selection reelle des que le champ
           n'est plus en train d'etre filtre : sortie du champ, Entree, Echap.
           Aucun texte libre ne survit a la perte du focus. */
        saisie.addEventListener('input', function () { rendre(saisie.value); });

        /* Au focus : on garde le pays choisi affiche ET on le presELECTIONNE,
           donc la premiere frappe le remplace. Le candidat voit son choix
           courant, et filtrer reste immediat — pas besoin de vider le champ. */
        saisie.addEventListener('focus', function () {
            refleterSelection();
            try { saisie.select(); } catch (eSel) {}
            rendre('');
        });

        saisie.addEventListener('blur', function () {
            /* Differe : le `blur` part AVANT le clic sur un <li>, et fermer
               tout de suite empecherait toute selection a la souris. */
            setTimeout(function () { fermer(); refleterSelection(); }, 120);
        });

        saisie.addEventListener('keydown', function (ev) {
            var k = ev.keyCode || ev.which;
            if (k === 40 || k === 38) {              // bas / haut
                ev.preventDefault();
                if (liste.style.display === 'none') { rendre(saisie.value); return; }
                if (!rendues.length) return;
                actif = (k === 40)
                    ? (actif + 1) % rendues.length
                    : (actif <= 0 ? rendues.length - 1 : actif - 1);
                marquerActif();
            } else if (k === 13) {                   // entree
                ev.preventDefault();                 // ne jamais soumettre depuis ce champ
                if (liste.style.display !== 'none' && actif >= 0 && rendues[actif]) {
                    choisir(rendues[actif]);
                } else {
                    /* Entree sans resultat retenu : on ne garde pas la saisie
                       a l'ecran, on revient au choix en vigueur. */
                    fermer();
                    refleterSelection();
                }
            } else if (k === 27) {                   // echap
                fermer();
                refleterSelection();
            }
        });

        /* Le <select> peut encore etre change par ailleurs — un repli, ou une
           prochaine regle. La saisie doit alors suivre, sans quoi les deux
           afficheraient des pays differents. */
        select.addEventListener('change', refleterSelection);

        refleterSelection();
    }

    /* ========================================================================
     *  LONGUEUR DU NUMERO ATTENDUE SELON L'INDICATIF
     * ------------------------------------------------------------------------
     *  Retour client du 02/09 : « en fonction de l'indicatif renseigne, le
     *  nombre de chiffres attendus n'est pas bloque (ce qui peut favoriser des
     *  erreurs de saisie) ».
     *
     *  ⚠ POURQUOI ICI, ET PAS DANS LES BLOCS. Les six formulaires portent deja
     *  une `validatePhone` — mais elle est INERTE en page publiee : le JS de
     *  `blocks/forms/**` s'attache via `component:mount`, donc dans le builder
     *  seulement (cf. PASSATION-FORMULAIRES.md §1.1). Le seul JS qui tourne en
     *  production est celui du socle. Corriger les six copies n'aurait ameliore
     *  que l'apercu du builder.
     *
     *  La longueur vient de `SOCLE_DATA.longueursTel`, publie depuis la DE
     *  `LPB_Mapping_Indicatifs` : rien en dur ici, et le metier corrige une
     *  longueur fausse sans redeploiement.
     * ====================================================================== */

    /**
     * L'indicatif choisi POUR CE CHAMP.
     *
     * On cherche dans l'enveloppe telephone du champ, pas dans la page : les
     * formulaires evenement portent DEUX numeros — celui du parent et celui de
     * l'enfant — et prendre le premier `[name="Indicatif"]` venu validerait le
     * numero de l'enfant contre le pays du parent.
     */
    function indicatifDe(input) {
        var portee = null;
        if (input && input.closest) {
            portee = input.closest('.jpo-phone-wrap') || input.closest('.brf-phone-wrap')
                  || input.closest('.cnd-phone-wrap') || input.closest('.imf-phone-wrap')
                  || input.closest('.pc-phone-wrap')  || input.closest('.wbc-phone-wrap');
        }
        var sel = (portee || document).querySelector('[name="Indicatif"]');
        return sel ? String(sel.value || '').replace(/^\+/, '') : '';
    }

    /**
     * Message d'erreur pour un champ telephone, ou '' s'il est acceptable.
     *
     * Ne bloque JAMAIS quand on ne sait pas : indicatif absent de la DE, socle
     * sans table, ligne incomplete. C'est la doctrine deja ecrite dans le
     * handler d'ecriture — « un candidat legitime bloque par erreur est un lead
     * perdu, sans trace et sans recours ». Ignorer la longueur d'un pays ne
     * doit pas fermer la porte a ses candidats.
     */
    /* Bornes du SOCLE MINIMAL, appliquees a TOUS les pays.
       15 est le maximum d'un numero E.164, indicatif compris. Le plancher a 5
       laisse passer les plans de numerotation les plus courts sans laisser
       passer une saisie manifestement incomplete. Ces bornes ne remplacent
       pas la regle par pays : elles la precedent. */
    var TEL_MIN_CHIFFRES = 5;
    var TEL_MAX_CHIFFRES = 15;

    function erreurLongueurTel(input) {
        if (!input) return '';
        var brut = String(input.value == null ? '' : input.value);
        if (!brut) return '';                    // champ vide : c'est `required` qui parle

        var lgBase = langueAffichage();

        /* ---- SOCLE MINIMAL, quel que soit le pays -----------------------
           ⚠ CORRECTIF DU 02/09. Je croyais ce filet deja pose : les six
           formulaires portent bien un controle `/^[0-9]{7,14}$/`... mais dans
           `blocks/forms/**`, donc INERTE en page publiee (§1.1). En
           production il n'existait AUCUNE validation du telephone : des
           LETTRES passaient et le formulaire partait. Constate par la recette
           sur un pays absent de la DE.

           Ce n'est donc pas un ajout de confort, c'est le comblement d'un
           trou : sans lui, tout indicatif absent de la DE — 188 sur 201 —
           n'est controle par rien du tout. */
        var sansPlus = brut.replace(/^\s*\+/, '');
        if (/[^0-9\s.\-()]/.test(sansPlus)) {
            return lgBase === 'en'
                ? 'The phone number may contain digits only.'
                : 'Le numéro de téléphone ne doit contenir que des chiffres.';
        }

        var tousChiffres = brut.replace(/[^0-9]/g, '');
        if (tousChiffres.length < TEL_MIN_CHIFFRES || tousChiffres.length > TEL_MAX_CHIFFRES) {
            return lgBase === 'en'
                ? 'The phone number must have between ' + TEL_MIN_CHIFFRES + ' and '
                    + TEL_MAX_CHIFFRES + ' digits.'
                : 'Le numéro de téléphone doit comporter entre ' + TEL_MIN_CHIFFRES
                    + ' et ' + TEL_MAX_CHIFFRES + ' chiffres.';
        }

        /* ---- REGLE PAR PAYS, si la DE la connait ------------------------ */
        var table = D && D.longueursTel;
        if (!table) return '';

        var ind = indicatifDe(input);
        if (!ind || !Object.prototype.hasOwnProperty.call(table, ind)) return '';

        var regle = table[ind];
        var min = Number(regle && regle.min), max = Number(regle && regle.max);
        if (!min || !max) return '';

        /* Le 0 de tete est un prefixe NATIONAL : « 06 12 34 56 78 » et
           « 6 12 34 56 78 » sont le meme numero. On le retire avant de compter,
           sinon un numero francais saisi de la facon la plus courante ferait 10
           chiffres au lieu de 9 et serait refuse — le controle rejetterait
           precisement la saisie normale.

           On retire aussi l'indicatif si le visiteur l'a retape dans le champ
           (« +33 6 12... ») : le socle d'ecriture le fait deja avant d'envoyer,
           refuser ici serait incoherent avec ce qu'il accepte. */
        var chiffres = brut.replace(/[^0-9]/g, '');
        if (chiffres.length > ind.length && chiffres.indexOf(ind) === 0) {
            chiffres = chiffres.substring(ind.length);
        }
        chiffres = chiffres.replace(/^0/, '');

        if (chiffres.length >= min && chiffres.length <= max) return '';

        var lg = langueAffichage();
        var pays = (regle && regle.pays) ? ' (' + regle.pays + ')' : '';
        if (lg === 'en') {
            return 'For +' + ind + pays + ', the phone number must have '
                 + (min === max ? min : min + ' to ' + max) + ' digits.';
        }
        return 'Pour +' + ind + pays + ', le numéro de téléphone doit comporter '
             + (min === max ? min : min + ' à ' + max) + ' chiffres.';
    }

    /**
     * Verifie TOUS les champs telephone du formulaire.
     *
     * Un champ MASQUE n'est pas verifie : le telephone de l'enfant n'apparait
     * que sur certains formulaires evenement, et exiger un format sur un champ
     * invisible fermerait la porte sans rien montrer.
     */
    function erreursTelephone(form) {
        var out = [];
        var tels = form.querySelectorAll('input[name="MobilePhone"], input[name="ChildPhone"]');
        for (var i = 0; i < tels.length; i++) {
            if (!estVisible(tels[i])) continue;
            var msg = erreurLongueurTel(tels[i]);
            if (msg) out.push({ champ: tels[i], message: msg });
        }
        return out;
    }

    /** Visible A L'ECRAN, pas seulement present dans le DOM. */
    function estVisible(el) {
        var n = el;
        while (n && n.nodeType === 1) {
            if (n.classList && n.classList.contains('hidden')) return false;
            if (n.style && n.style.display === 'none') return false;
            n = n.parentNode;
        }
        return true;
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

            /* ---- LONGUEUR DU NUMERO ---------------------------------------
               Avant TOUT le reste : c'est une erreur de saisie, on la corrige
               sur place plutot que de creer un prospect avec un numero
               injoignable. Place avant la desactivation du bouton, sinon le
               candidat se retrouverait devant un bouton mort. */
            var mauvaisTels = erreursTelephone(form);
            if (mauvaisTels.length) {
                var lignes = [];
                for (var t = 0; t < mauvaisTels.length; t++) lignes.push(mauvaisTels[t].message);
                montrerMessage(form, lignes);
                try { mauvaisTels[0].champ.focus(); } catch (eFocus) {}
                return;
            }

            var bouton = form.querySelector('button[type="submit"], input[type="submit"]');
            var libelle = bouton ? bouton.innerHTML : '';
            if (bouton) { bouton.disabled = true; bouton.textContent = 'Envoi en cours...'; }

            /* Le blocage porte sur un PROGRAMME : le candidat a pu en changer
               depuis la tentative precedente. Garder l'ancien encart affiche
               le ferait mentir. */
            effacerBlocage(form);

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
                  /* Une candidature bloquee N'EST PAS une panne : le socle a
                     refuse d'ecrire, exactement comme le cadrage le demande.
                     Elle se dit sur le formulaire, pas dans une alert(), et
                     surtout pas avec le message d'echec technique. */
                  if (bilan.bloque) { montrerBlocage(form, bilan.motif); return; }
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
            var bilanPage = bilanDe(source);
            if (bilanPage.ok) {
                var dejaPoste = document.querySelector(FORMULAIRES);
                if (dejaPoste) montrerSucces(dejaPoste);
            } else if (bilanPage.bloque) {
                /* Meme repli pour le blocage : sans fetch, la page revient du
                   POST natif avec le bilan dedans. Sans cette branche, un
                   navigateur sans fetch reaffichait le formulaire vierge, sans
                   la moindre explication. */
                var dejaBloque = document.querySelector(FORMULAIRES);
                if (dejaBloque) montrerBlocage(dejaBloque, bilanPage.motif);
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
                    /* AUCUNE DATE PRESELECTIONNEE — retour client du 03/09,
                       meme raison que les ateliers : les places sont limitees.
                       La date la plus proche etait cochee d'office, ce qui
                       inscrivait a un creneau tout visiteur qui ne descendait
                       pas jusqu'ici, et remplissait ce creneau d'absents.

                       `required` reste, et c'est ce qui rend le retrait sans
                       danger : le socle d'ecriture REFUSE une soumission sans
                       InstanceId. Sans presélection et sans `required`, le
                       visiteur se heurterait a un refus muet cote serveur ;
                       avec `required`, le navigateur le lui dit avant l'envoi. */
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
                    quand.textContent = dateLongue(inst.date)
                        || casseLisible(inst.label || inst.value, false);
                    gauche.appendChild(quand);

                    /* COLONNE DE GAUCHE, l'icone calendrier : le QUAND.
                       Date, horaires, puis la conference — chacun sur sa
                       ligne, comme la carte du builder (capture du 03/09). */
                    var h = plage(inst.heure, inst.heureFin);
                    if (h) {
                        var horaire = document.createElement('span');
                        horaire.className = 'socle-instance-lieu';
                        horaire.textContent = h;
                        gauche.appendChild(horaire);
                    }

                    /* « Conference a : 9h30 » — retour client du 03/09.
                       Le LIBELLE du sous-evenement n'est plus affiche : le CRM
                       le nomme « Presentation de l'ecole », wording que le
                       client ne veut pas lire. On garde l'HEURE, qui est la
                       seule information utile, et l'intitule est fixe.

                       DANS LA COLONNE DU QUAND : une heure de conference est
                       une information de temps, pas de lieu. C'est la place que
                       lui donne la carte du builder.

                       Sans heure, on n'affiche rien : « Conference a : » seul
                       ne dirait rien au visiteur. */
                    var conf = conferenceDe(inst.value);
                    if (conf && conf.heure) {
                        var laConf = document.createElement('span');
                        laConf.className = 'socle-instance-lieu';
                        laConf.textContent = 'Conférence à : ' + conf.heure;
                        gauche.appendChild(laConf);
                    }

                    corps.appendChild(gauche);

                    /* COLONNE DE DROITE, l'icone epingle : le OU.
                       Nom du campus puis adresse postale, chacun sur sa ligne.

                       L'adresse etait dans la colonne de gauche, sous les
                       horaires : le calendrier annoncait donc une adresse, et
                       l'epingle ne servait a rien. Les deux icones disent
                       maintenant ce qu'elles designent.

                       Colonne omise entierement si le CRM ne donne ni campus ni
                       adresse : un trait vertical suivi du vide se lit comme un
                       defaut d'affichage. */
                    if (inst.campus || inst.address) {
                        var ou = document.createElement('span');
                        ou.className = 'socle-instance-ou';

                        if (inst.campus) {
                            var leCampus = document.createElement('span');
                            leCampus.className = 'socle-instance-lieu';
                            leCampus.textContent = casseLisible(inst.campus, true);
                            ou.appendChild(leCampus);
                        }
                        if (inst.address) {
                            var adresse = document.createElement('span');
                            adresse.className = 'socle-instance-lieu';
                            /* L'adresse porte ses propres retours a la ligne
                               cote CRM ; white-space: pre-line les respecte. */
                            adresse.textContent = inst.address;
                            ou.appendChild(adresse);
                        }
                        corps.appendChild(ou);
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

            /* Les ateliers suivent la date CHOISIE, et plus la premiere de la
               liste : depuis que rien n'est preselectionne, afficher le
               programme d'une date que le visiteur n'a pas retenue lui
               presenterait des creneaux qui ne sont pas les siens. On vide
               donc, et `radio.addEventListener('change')` les remplit des
               qu'une date est cochee.

               Vider est aussi ce qui evite qu'une selection faite sur la date
               precedente reste a l'ecran apres un changement de campus. */
            var choisie = '';
            if (zoneDates) {
                /* Rendu par boutons radio : plus rien n'est coche au depart,
                   donc rien a montrer tant que le visiteur n'a pas tranche. */
                var coche = zoneDates.querySelector('input[name="InstanceId"]:checked');
                choisie = coche ? coche.value : '';
            } else {
                /* Repli par <select> des formulaires anciens : celui-la EST
                   positionne sur la premiere date juste au-dessus. Une date est
                   donc bel et bien retenue, et masquer son programme serait
                   faux — c'est le seul cas ou la premiere de la liste vaut
                   choix. */
                choisie = (elInst && elInst.value) || (liste.length ? liste[0].value : '');
            }
            rendreAteliers(choisie);
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
