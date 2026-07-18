/**
 * Lien cliquable derrière les images.
 *
 * Étend le type `image` natif de GrapesJS pour ajouter, à côté du champ « Alt »
 * déjà présent, un champ « Lien » (+ case « nouvel onglet ») dans le panneau
 * Réglages (traits). Quand un lien est saisi, l'<img> est enveloppée dans un
 * <a href> AU MOMENT DE L'EXPORT (editor.getHtml()). Comme la page finale,
 * l'aperçu, l'export bilingue et la synchro SFMC lisent tous ce même HTML, le
 * lien fonctionne partout — sans aucun JavaScript côté page (compatible email).
 *
 * On étend le type `image` GLOBAL : TOUS les blocs qui contiennent une image
 * (carrousels, hero, deux colonnes, image & caption, trois raisons…) héritent
 * automatiquement du champ lien, y compris les projets déjà enregistrés.
 *
 * Dans l'éditeur, l'image n'est PAS enveloppée : un clic la sélectionne toujours
 * normalement pour l'éditer. La redirection n'a lieu que sur la page publiée.
 */
export default function (editor) {
    const domc = editor.DomComponents;
    const imageType = domc.getType('image');
    if (!imageType) return;
    const BaseModel = imageType.model;

    // Échappe une valeur destinée à un attribut HTML entre guillemets doubles.
    const escapeAttr = (v) => String(v)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    domc.addType('image', {
        model: {
            defaults: {
                // 'alt' = trait natif conservé ; on ajoute le lien juste en dessous.
                traits: [
                    'alt',
                    {
                        type: 'text',
                        name: 'data-href',
                        label: 'Lien (clic sur l’image)',
                        placeholder: 'https://exemple.com'
                    },
                    {
                        type: 'select',
                        name: 'data-link-target',
                        label: 'Ouverture du lien',
                        default: '',
                        options: [
                            { id: '', name: 'Même fenêtre' },
                            { id: '_blank', name: 'Nouvelle fenêtre' }
                        ]
                    }
                ]
            },

            /**
             * Enveloppe l'<img> dans un <a href> quand un lien est renseigné.
             * Les attributs techniques (data-href / data-link-target) sont retirés
             * du <img> exporté pour garder un markup propre.
             */
            toHTML() {
                // Blindé : le rendu HTML des images ne doit JAMAIS échouer, sinon
                // getHtml() casse (sauvegarde, traduction, aperçu, synchro SFMC).
                // En cas de souci, on retombe sur le rendu image natif.
                const html = BaseModel.prototype.toHTML.apply(this, arguments);
                try {
                    const attrs = this.getAttributes() || {};
                    const href = String(attrs['data-href'] || '').trim();
                    if (!href) return html;
                    const cleanImg = html
                        .replace(/\s*data-href="[^"]*"/i, '')
                        .replace(/\s*data-link-target="[^"]*"/i, '');
                    const target = attrs['data-link-target'] === '_blank'
                        ? ' target="_blank" rel="noopener noreferrer"'
                        : '';
                    return `<a href="${escapeAttr(href)}"${target}>${cleanImg}</a>`;
                } catch (e) {
                    return html;
                }
            }
        }
    });
}
