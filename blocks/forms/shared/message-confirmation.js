/**
 * ============================================================================
 *  L'ENCART DE MESSAGE — UN SEUL, TROIS TONS
 * ============================================================================
 *  Retour client du 2026-09-03 : LE FORMULAIRE NE DOIT PLUS DISPARAITRE.
 *
 *  Ce que les six blocs faisaient jusqu'ici, et pourquoi c'etait faux. Sur un
 *  succes, chacun masquait son formulaire, son titre, son sous-titre — et,
 *  pour les formulaires evenement, toute la fratrie de la carte — puis ouvrait
 *  son ecran `.xxx-success` a la place. Le visiteur se retrouvait devant un
 *  message seul : plus de formulaire, plus de valeurs, plus rien a relire ni a
 *  corriger. Le client demande l'inverse — le message S'AJOUTE au-dessus du
 *  formulaire, qui reste affiche tel quel, valeurs comprises.
 *
 *  --- Pourquoi un module partage et non six correctifs -----------------
 *  Le comportement etait deja duplique six fois, a six nuances pres (l'un
 *  masquait `.xxx-form-zone`, l'autre le `<form>` ; l'un balayait la carte,
 *  l'autre nommait ses zones). C'est ce qui a fait que la zone campus est
 *  restee affichee sous la confirmation jusqu'au 31/08 : le correctif n'avait
 *  ete pose qu'a un seul endroit. Le rassembler ici est ce qui evite que le
 *  prochain retour ait, lui aussi, six chances d'etre oublie quelque part.
 *
 *  ⚠ CE MODULE NE TOURNE QUE DANS LE BUILDER. Sur une page publiee, c'est le
 *  socle qui fait le travail (`sfmc-ssjs/socle/picklist-handler.ssjs`, meme
 *  logique, meme couleurs, meme placement) : le JS des blocs n'y est pas
 *  charge. Les deux doivent rester d'accord, sans quoi l'apercu du builder
 *  montrerait autre chose que la page reelle — et c'est l'apercu qu'on
 *  regarde en recette.
 * ============================================================================
 */

/* Les memes valeurs que le socle, au caractere pres. Un ecart ici passerait
   inapercu jusqu'a ce qu'on compare l'apercu et la page en ligne cote a cote. */
export const TONS = {
    succes: { bord: '#12805c', fond: '#ecfdf3', texte: '#05603a' },
    r1:     { bord: '#b54708', fond: '#fffaeb', texte: '#7a2e0e' },
    r2:     { bord: '#b42318', fond: '#fef3f2', texte: '#7a271a' },
    erreur: { bord: '#b42318', fond: '#fef3f2', texte: '#7a271a' },
};

/* La coche qui ouvre une confirmation. Les maquettes portaient un emoji par
   formulaire — enveloppe sur la candidature, coche verte ailleurs ; l'encart
   tranche pour une seule, partout. */
export const COCHE = '✔️';

/* L'enveloppe du bouton, quel que soit le prefixe du bloc. L'encart se pose
   AVANT elle : le visiteur doit lire avant de recliquer. */
const ANCRES = '.cnd-submit-wrap, .brf-submit-wrap, .jpo-submit-wrap, '
             + '.imf-submit-wrap, .wbc-submit-wrap, .pc-submit-wrap';

/** L'encart du formulaire, cree au premier besoin puis reutilise. */
function encartDe(form) {
    const doc = form.ownerDocument || document;
    let zone = form.querySelector('[data-socle="message"]');
    if (zone) return zone;

    zone = doc.createElement('div');
    zone.className = 'socle-message';
    zone.setAttribute('data-socle', 'message');
    /* `alert` et non `status` : qu'il annonce un refus ou une confirmation,
       l'encart est le SEUL retour de la soumission — plus rien ne bouge
       ailleurs dans la page. Un lecteur d'ecran doit l'entendre aussitot. */
    zone.setAttribute('role', 'alert');
    /* En ligne plutot qu'en feuille de style : ces blocs injectent leur CSS
       dans le canvas au chargement, et l'encart nait longtemps apres. */
    Object.assign(zone.style, {
        margin: '16px 0', padding: '14px 16px', borderRadius: '6px',
        borderLeftWidth: '4px', borderLeftStyle: 'solid',
        fontSize: '13px', lineHeight: '1.5', textAlign: 'left',
    });

    const ancre = form.querySelector(ANCRES);
    if (ancre && ancre.parentNode) ancre.parentNode.insertBefore(zone, ancre);
    else form.appendChild(zone);
    return zone;
}

/**
 * Ecrit des lignes dans l'encart, au ton demande.
 *
 * Une ligne est une chaine, ou `{ html }` quand le message porte sa propre
 * mise en forme — la webconf et la pre-candidature recapitulent la date et le
 * campus en gras, et perdre ce gras appauvrirait le message pour rien.
 *
 * La PREMIERE ligne passe en gras des qu'il y en a plusieurs : c'est le titre,
 * et ce qui suit se lit comme son explication.
 */
export function montrerMessage(form, lignes, ton = 'erreur') {
    const doc = form.ownerDocument || document;
    const zone = encartDe(form);
    const couleurs = TONS[ton] || TONS.erreur;

    zone.style.borderLeftColor = couleurs.bord;
    zone.style.background = couleurs.fond;
    zone.style.color = couleurs.texte;

    while (zone.firstChild) zone.removeChild(zone.firstChild);

    lignes.forEach((ligne, i) => {
        /* Une ligne `{cta:{...}}` devient un bouton, pas un paragraphe : c'est
           le « Télécharger la brochure » du retour du 03/09. */
        if (ligne && ligne.cta) { zone.appendChild(boutonCta(doc, ligne.cta)); return; }
        const p = doc.createElement('p');
        if (ligne && ligne.html !== undefined) p.innerHTML = ligne.html;
        else p.textContent = String(ligne == null ? '' : ligne);
        p.style.margin = i === 0 ? '0' : '6px 0 0';
        if (i === 0 && lignes.length > 1) p.style.fontWeight = '700';
        zone.appendChild(p);
    });

    zone.style.display = 'block';
    try { zone.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* hors DOM */ }
}

/**
 * Le bouton d'action de l'encart.
 *
 * Un <a> et non un <button> : c'est une navigation vers un fichier, et un lien
 * reste ouvrable dans un nouvel onglet, copiable, et lisible par un lecteur
 * d'ecran comme ce qu'il est.
 *
 * `target="_blank"` plutot que l'attribut `download` : le PDF est heberge
 * ailleurs que la page, et `download` est IGNORE en cross-origin — il aurait
 * donne un lien qui navigue au lieu de telecharger, sans le dire. Ouvrir un
 * onglet preserve en prime le formulaire et son message.
 *
 * Le style copie celui du bouton de soumission des blocs (noir, majuscules,
 * pleine largeur) : le visiteur doit reconnaitre un bouton de l'ecole, pas un
 * element rapporte. Meme rendu que dans le socle.
 */
function boutonCta(doc, cta) {
    const a = doc.createElement('a');
    a.setAttribute('href', cta.href);
    /* Le nouvel onglet n'est pose que sur une VRAIE URL. Le `#` de l'apercu du
       builder ouvrirait sinon un onglet vide a chaque clic, et donnerait a
       croire que le lien est casse alors qu'il n'existe simplement pas encore.
       Garde utile aussi le jour ou la DE porterait une URL relative. */
    if (/^https?:/i.test(cta.href)) {
        a.setAttribute('target', '_blank');
        /* `noopener` : la page ouverte ne doit pas pouvoir manipuler celle-ci
           par `window.opener`. `noreferrer` en prime, l'URL de la page n'a rien
           a apprendre a l'hebergeur du PDF. */
        a.setAttribute('rel', 'noopener noreferrer');
    }
    a.textContent = cta.libelle;
    Object.assign(a.style, {
        display: 'block', marginTop: '14px', padding: '14px',
        /* Les couleurs de la charte de l'ecole, quand la DE les donne. Le noir
           et blanc du bouton de soumission sinon : un bouton doit rester
           lisible meme si la colonne a ete laissee vide ou mal saisie. */
        background: cta.fond || '#000',
        color: cta.police || '#fff',
        textAlign: 'center',
        textDecoration: 'none', fontSize: '14px', fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: '0.05em',
    });
    return a;
}

/**
 * La confirmation, en vert, AU-DESSUS du formulaire laisse intact.
 *
 * Rien n'est masque, et le formulaire garde ses valeurs : le visiteur relit ce
 * qu'il vient d'envoyer, et peut renvoyer — c'est exactement le meme POST.
 *
 * `cta` est facultatif : `{ libelle, href }` pose un bouton sous le message.
 */
export function montrerSucces(form, titre, texte, cta) {
    const lignes = [COCHE + ' ' + titre];
    if (texte) lignes.push(texte);
    if (cta && cta.href) lignes.push({ cta });
    montrerMessage(form, lignes, 'succes');
}

/**
 * Efface l'encart avant une nouvelle tentative.
 *
 * Quel qu'il ait ete : un blocage porte sur un programme dont le candidat a pu
 * changer, une confirmation porte sur un envoi qui n'est plus celui en cours.
 * Le garder affiche pendant que le nouveau part le ferait mentir.
 */
export function effacerMessage(form) {
    const zone = form.querySelector('[data-socle="message"]');
    if (zone) zone.style.display = 'none';
}
