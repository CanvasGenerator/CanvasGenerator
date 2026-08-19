%%[
/* ============================================================================
   SONDE AMPSCRIPT — lecture Salesforce depuis une CloudPage
   ============================================================================
   Etabli le 2026-08-16 sur cette org :
     - AMPscript LIT Salesforce depuis une CloudPage publiee ;
     - le SSJS (Platform.Function.RetrieveSalesforceObjects) echoue sur
       « Unable to retrieve security descriptor for this frame », quelle que
       soit la signature d'appel. Ne pas re-diagnostiquer : c'est acquis.
     - EntityParticle et PicklistValueInfo repondent -> les 4 value sets sont
       lisibles depuis la page, sans Data Extension de synchronisation.

   ⚠ AMPscript n'a PAS de try/catch, et une erreur REMPLACE toute la page :
     les resultats deja affiches sont perdus. Deux consequences de conception :

       1. La partie « objets confirmes » ne contient QUE des noms d'API deja
          valides. On n'y ajoute un objet qu'une fois prouve.
       2. Tout nom INCERTAIN se teste isolement via la barre d'adresse, pour
          qu'un echec ne coute que lui-meme.

   --- MODES (parametres d'URL) ---------------------------------------------
     (aucun)                  -> objets confirmes + comptages
     ?ls=summit               -> liste les objets Salesforce commencant par
                                 « summit » (via EntityDefinition)
     ?champs=LearningProgram  -> liste les champs de cet objet (EntityParticle)
     ?obj=Xxx__c&cols=Id,Name -> teste UN nom d'objet, isolement
     ?rows=Xxx&cols=a,b,c     -> echantillon de VALEURS (8 lignes)
        + &w=champ&op==&val=x -> filtre. Indispensable : sans lui l'echantillon
                                 prend le debut de table, qui sur cette sandbox
                                 ne contient que des enregistrements de test.
                                 Le compteur affiche = compte des lignes filtrees.

   LECTURE SEULE.
   ============================================================================ */
VAR @rows, @n, @i, @c, @max, @row, @durable, @v, @l
VAR @ls, @champs, @obj, @cols, @rowsobj, @cn, @cname, @ncols, @w, @op, @val
SET @durable = ""
SET @ls      = RequestParameter("ls")
SET @champs  = RequestParameter("champs")
SET @obj     = RequestParameter("obj")
SET @rowsobj = RequestParameter("rows")
SET @cols    = RequestParameter("cols")
SET @w       = RequestParameter("w")
SET @op      = RequestParameter("op")
SET @val     = RequestParameter("val")
IF Empty(@cols) THEN SET @cols = "Id,Name" ENDIF
SET @ncols = RowCount(BuildRowsetFromString(@cols, ","))
]%%

<h2>Sonde AMPscript &mdash; lecture Salesforce</h2>

%%[ IF NOT Empty(@ls) THEN ]%%
    <h3>Objets dont le nom d'API commence par &laquo; %%=v(@ls)=%% &raquo;</h3>
    %%[
    SET @rows = RetrieveSalesforceObjects("EntityDefinition", "QualifiedApiName,Label",
        "QualifiedApiName", "like", Concat(@ls, "%"))
    SET @n = RowCount(@rows)
    ]%%
    <p>%%=v(@n)=%% objet(s)</p>
    <ul>
    %%[ FOR @i = 1 TO @n DO
        SET @row = Row(@rows, @i)
        SET @v = Field(@row, "QualifiedApiName")
        SET @l = Field(@row, "Label")
    ]%%
        <li><code>%%=v(@v)=%%</code> &mdash; %%=v(@l)=%%</li>
    %%[ NEXT @i ]%%
    </ul>

%%[ ELSEIF NOT Empty(@champs) THEN ]%%
    <h3>Champs de <code>%%=v(@champs)=%%</code></h3>
    %%[
    SET @rows = RetrieveSalesforceObjects("EntityParticle", "QualifiedApiName,Label,DataType",
        "EntityDefinitionId", "=", @champs)
    SET @n = RowCount(@rows)
    ]%%
    <p>%%=v(@n)=%% champ(s)</p>
    <ul>
    %%[ FOR @i = 1 TO @n DO
        SET @row = Row(@rows, @i)
        SET @v = Field(@row, "QualifiedApiName")
        SET @l = Field(@row, "DataType")
    ]%%
        <li><code>%%=v(@v)=%%</code> &mdash; %%=v(@l)=%%</li>
    %%[ NEXT @i ]%%
    </ul>

%%[ ELSEIF NOT Empty(@obj) THEN ]%%
    <h3>Test isole : <code>%%=v(@obj)=%%</code></h3>
    %%[
    SET @rows = RetrieveSalesforceObjects(@obj, @cols, "Id", "!=", "")
    SET @n = RowCount(@rows)
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b> &mdash; le nom d'API est valide.</p>

%%[ ELSEIF NOT Empty(@rowsobj) THEN ]%%
    <h3>&Eacute;chantillon de <code>%%=v(@rowsobj)=%%</code></h3>
    %%[
    /* Connaitre le NOM d'un champ ne suffit pas : il faut voir ce qu'il
       CONTIENT. `SchoolId__c` porte-t-il "efap" ou un Id a 18 caracteres ?
       `campusNameFor__c` porte-t-il "Paris" ou "EFAP Paris" ? Sans la reponse,
       tout filtre ecrit dessus est une supposition — et une supposition qui
       rend 0 ligne sans erreur, donc indetectable. */
    /* Filtre optionnel : ?w=champ&op==&val=xxx (op par defaut : "!=").
       Sans lui, l'echantillon prend le DEBUT de la table — qui, sur cette
       sandbox, ne contient que des enregistrements de test ([DEMO], TEST...).
       Conclure de ces 8 lignes que les champs metier sont vides serait une
       erreur de lecture, pas un constat. Le filtre sert a atteindre les vraies
       donnees, et le compteur affiche devient le COMPTE des lignes filtrees —
       ce qui repond aussi aux questions du type « combien de PTAT publies ? ». */
    IF Empty(@w) THEN
        SET @w = "Id"
        SET @op = "!="
        SET @val = ""
    ENDIF
    IF Empty(@op) THEN SET @op = "!=" ENDIF

    SET @rows = RetrieveSalesforceObjects(@rowsobj, @cols, @w, @op, @val)
    SET @n = RowCount(@rows)
    IF @n > 8 THEN SET @max = 8 ELSE SET @max = @n ENDIF
    ]%%
    <p><b>%%=v(@n)=%%</b> ligne(s) o&ugrave; <code>%%=v(@w)=%% %%=v(@op)=%% "%%=v(@val)=%%"</code>,
       %%=v(@max)=%% affich&eacute;e(s) &mdash; colonnes : <code>%%=v(@cols)=%%</code></p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;font:13px monospace">
    %%[ FOR @i = 1 TO @max DO
        SET @row = Row(@rows, @i)
    ]%%
        <tr>
        %%[ FOR @c = 1 TO @ncols DO
            SET @cn = BuildRowsetFromString(@cols, ",")
            SET @cname = Field(Row(@cn, @c), 1)
        ]%%
            <td><b>%%=v(@cname)=%%</b><br>%%=v(Field(@row, @cname))=%%</td>
        %%[ NEXT @c ]%%
        </tr>
    %%[ NEXT @i ]%%
    </table>

%%[ ELSE ]%%

    <p style="color:#666">Objets confirm&eacute;s le 2026-08-16. Pour un nom incertain,
    utiliser <code>?obj=</code> plut&ocirc;t que de l'ajouter ici.</p>

    <h3>1 &middot; EntityParticle &mdash; DurableId de Account.LivingCountry__c</h3>
    %%[
    /* Deux triplets champ/operateur/valeur = combinaison ET. */
    SET @rows = RetrieveSalesforceObjects("EntityParticle", "DurableId,QualifiedApiName",
        "EntityDefinitionId", "=", "Account",
        "QualifiedApiName",   "=", "LivingCountry__c")
    SET @n = RowCount(@rows)
    IF @n > 0 THEN
        SET @durable = Field(Row(@rows, 1), "DurableId")
    ENDIF
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b> &mdash; DurableId : <code>%%=v(@durable)=%%</code></p>

    <h3>2 &middot; PicklistValueInfo &mdash; valeurs du value set</h3>
    %%[
    IF Length(@durable) > 0 THEN
        SET @rows = RetrieveSalesforceObjects("PicklistValueInfo", "Value,Label,IsActive",
            "EntityParticleId", "=", @durable)
        SET @n = RowCount(@rows)
    ELSE
        SET @n = 0
    ENDIF
    /* Plafond d'affichage : la liste des pays depasse la centaine de valeurs. */
    IF @n > 10 THEN SET @max = 10 ELSE SET @max = @n ENDIF
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b> (10 premi&egrave;res)</p>
    <ul>
    %%[ FOR @i = 1 TO @max DO
        SET @row = Row(@rows, @i)
        SET @v = Field(@row, "Value")
        SET @l = Field(@row, "Label")
    ]%%
        <li>%%=v(@v)=%% &mdash; %%=v(@l)=%%</li>
    %%[ NEXT @i ]%%
    </ul>

    <h3>3 &middot; LearningProgram</h3>
    %%[
    SET @rows = RetrieveSalesforceObjects("LearningProgram", "Id,Name", "Id", "!=", "")
    SET @n = RowCount(@rows)
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b></p>

    <h3>4 &middot; ProgramTermApplnTimeline</h3>
    %%[
    SET @rows = RetrieveSalesforceObjects("ProgramTermApplnTimeline", "Id", "Id", "!=", "")
    SET @n = RowCount(@rows)
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b></p>

    <h3>5 &middot; AcademicTerm</h3>
    %%[
    SET @rows = RetrieveSalesforceObjects("AcademicTerm", "Id,Name", "Id", "!=", "")
    SET @n = RowCount(@rows)
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b></p>

    <h3>6 &middot; SchoolCampusAssociation__c</h3>
    %%[
    SET @rows = RetrieveSalesforceObjects("SchoolCampusAssociation__c", "Id,Name", "Id", "!=", "")
    SET @n = RowCount(@rows)
    ]%%
    <p>lignes : <b>%%=v(@n)=%%</b></p>

    <h2 style="color:#065f46">FIN &mdash; toutes les sondes ont abouti</h2>

    <hr>
    <p><b>Objets &eacute;v&eacute;nement (Summit).</b>
    <code>summit__Instance__c</code> renvoie <code>INVALID_TYPE</code>.
    Le vrai pr&eacute;fixe, relev&eacute; dans l'Object Manager de l'org, est
    <code>summit__Summit_Events_*__c</code>.</p>

    <p>&Agrave; tester un par un &mdash; ne PAS les ajouter ici avant confirmation,
    un seul nom faux effacerait toute cette page :</p>
    <ul>
        <li><code>?obj=summit__Summit_Events_Instance__c</code> &mdash; relev&eacute; dans core</li>
        <li><code>?obj=summit__Summit_Events_Registration__c</code> &mdash; candidat</li>
        <li><code>?obj=summit__Summit_Events_Appointments__c</code> &mdash; candidat</li>
    </ul>

    <p>Une fois l'Instance confirm&eacute;e, <code>?champs=summit__Summit_Events_Instance__c</code>
    liste ses champs : les lookups qu'elle porte nomment les objets li&eacute;s, ce qui
    &eacute;vite de deviner les deux autres.</p>

    <p style="color:#666"><b>Note.</b> <code>?ls=summit</code> renvoie une liste vide alors
    que l'objet existe : <code>RetrieveSalesforceObjects</code> ne semble pas honorer
    l'op&eacute;rateur <code>like</code> sur <code>EntityDefinition</code> &mdash; il rend 0 ligne
    au lieu d'une erreur. Ne pas conclure d'un <code>?ls=</code> vide qu'un objet n'existe pas.
    Utiliser <code>?champs=</code> ou <code>?obj=</code>, qui filtrent sur l'&eacute;galit&eacute;.</p>

%%[ ENDIF ]%%
