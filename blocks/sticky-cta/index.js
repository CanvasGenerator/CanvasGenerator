/**
 * CTA Sticky — barre d'appel à l'action pleine largeur, fixée en bas de l'écran.
 *
 * - Barre noire fixe (position:fixed; bottom:0) qui reste visible pendant tout le scroll.
 * - Texte blanc centré, éditable en double-clic.
 * - Au clic, défile en douceur vers le formulaire de la page.
 * - Option sidebar (Trait Manager) : « Formulaire cible » (1er formulaire par défaut).
 *
 * Type de composant custom : nécessaire pour le trait sidebar. Le `script` est exporté
 * avec la page (getHtml), donc le défilement fonctionne aussi sur la page publiée.
 */
export default function (editor, categories) {
    const TYPE = 'sticky-cta';

    // Sélecteur CSS → uniquement les formulaires réellement disponibles dans le projet.
    // "form" = 1er formulaire de la page (marche dans tous les cas).
    const FORM_OPTIONS = [
        { id: 'form',                name: 'Premier formulaire de la page' },
        { id: '.form-section',       name: 'Formulaire SFMC' },
        { id: '.form-core-section',  name: 'Formulaire Salesforce Core' },
        { id: '.mf2-section',        name: 'Formulaire Inscription (Master)' },
        { id: '.jpo-section',        name: 'Formulaire JPO / Atelier / Stage' },
        { id: '.brf-section',        name: 'Formulaire Brochure' },
        { id: '.imf-section',        name: "Formulaire Demande d'immersion" },
        { id: '.cnd-section',        name: 'Formulaire Candidature' }
    ];

    editor.BlockManager.add(TYPE, {
        label: 'CTA Sticky',
        category: categories.MASTER,
        content: { type: TYPE },
        attributes: { class: 'fa fa-hand-pointer' }
    });

    editor.DomComponents.addType(TYPE, {
        isComponent: el => el.classList && el.classList.contains('sticky-cta'),
        model: {
            defaults: {
                name: 'CTA Sticky',
                droppable: false,
                attributes: {
                    class: 'sticky-cta',
                    'data-target-form': 'form'
                },
                traits: [
                    {
                        type: 'select',
                        name: 'data-target-form',
                        label: 'Formulaire cible',
                        options: FORM_OPTIONS
                    }
                ],
                components: `
                    <a href="#" class="sticky-cta-link">S&rsquo;inscrire aux portes ouvertes</a>
                    <style>
                        .sticky-cta{position:fixed;left:0;right:0;bottom:0;background:#000000;text-align:center;padding:20px 16px;z-index:90;}
                        .sticky-cta .sticky-cta-link{color:#ffffff;font-family:var(--brand-font,'Montserrat',Arial,sans-serif);font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;display:block;cursor:pointer;}
                        .sticky-cta .sticky-cta-link:hover{opacity:.85;}
                        body{padding-bottom:62px;} /* espace réservé pour la barre sticky */
                    </style>
                `,
                'script-props': ['data-target-form'],
                script: function () {
                    var el = this;
                    var selector = el.getAttribute('data-target-form') || 'form';
                    var link = el.querySelector('.sticky-cta-link');
                    if (!link) return;
                    // onclick (pas addEventListener) → pas d'empilement si le script re-tourne.
                    link.onclick = function (e) {
                        e.preventDefault();
                        var doc = el.ownerDocument;
                        var target = doc.querySelector(selector) || doc.querySelector('form');
                        if (target && target.scrollIntoView) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    };
                }
            }
        }
    });
}
