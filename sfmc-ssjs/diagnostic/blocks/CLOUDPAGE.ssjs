%%[
/* Coller CECI dans la CloudPage, une fois pour toutes.
   Le contenu vit dans des Content Blocks : plus rien a recopier.
   ?contentkey=LPB_TST_Account  choisit le bloc a executer. */
VAR @ck
SET @ck = RequestParameter("contentkey")
IF Empty(@ck) THEN SET @ck = "LPB_Test_Ecriture" ENDIF
]%%
%%=ContentBlockByKey(@ck)=%%
