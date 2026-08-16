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
                + 'Publier <code>test-connexion-minimal.ssjs</code> pour confirmer.</div>');
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

    function champ(name) { return document.querySelector('[name="' + name + '"]'); }

    /** Remplit un <select> en conservant sa 1re option (le placeholder). */
    function remplir(name, options, valeurCourante) {
        var el = champ(name);
        if (!el || el.tagName !== 'SELECT') return null;

        // Salesforce n'a rien renvoye pour cette liste : on NE TOUCHE PAS au
        // <select>. Les options statiques deja presentes (baked par le builder)
        // servent de repli, et un champ obligatoire ne se retrouve jamais vide
        // ni desactive a cause d'un value set introuvable cote org.
        if (!options || !options.length) return el;

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

    /** Valeurs distinctes d'une propriete, sur des programmes deja filtres. */
    function distinct(rows, prop) {
        var vus = {}, out = [];
        for (var i = 0; i < rows.length; i++) {
            var v = rows[i][prop];
            if (!v || vus[v]) continue;
            vus[v] = true;
            out.push({ value: v, label: v });
        }
        return out;
    }

    /** Filtre les programmes sur les criteres renseignes (un vide = ignore). */
    function filtrer(criteres) {
        return D.programs.filter(function (p) {
            for (var k in criteres) {
                if (!criteres[k]) continue;          // critere non renseigne -> ignore
                if (p[k] !== criteres[k]) return false;
            }
            return true;
        });
    }

    function valeur(name) { var e = champ(name); return e ? e.value : ''; }

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
})();
</script>
