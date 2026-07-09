/**
 * Master Template — « Carrousel Cursus »
 * ───────────────────────────────────────────────────────────────
 * Carrousel horizontal de cartes « cursus par année » (entête colorée,
 * description, tags) avec pagination ← → et compteur « n / total ».
 * Textes éditables. CSS scopé sous `.cursus`, script scopé sur `this`.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    const TYPE = 'mccur-block';

    /* ── Helper : carte cursus éditable ── */
    function makeCarte(anneeHtml, titreHtml, descHtml, tags) {
        return {
            tagName: 'article',
            classes: ['cursus-carte'],
            components: [
                {
                    tagName: 'div',
                    classes: ['cursus-entete'],
                    components: [
                        { type: 'text', tagName: 'div', classes: ['cursus-annee'], editable: true, selectable: true, components: anneeHtml },
                        { type: 'text', tagName: 'h3', editable: true, selectable: true, components: titreHtml }
                    ]
                },
                {
                    tagName: 'div',
                    classes: ['cursus-corps'],
                    components: [
                        { type: 'text', tagName: 'p', editable: true, selectable: true, components: descHtml },
                        {
                            tagName: 'div',
                            classes: ['cursus-tags'],
                            components: tags.map(t => ({ type: 'text', tagName: 'span', classes: ['cursus-tag'], editable: true, selectable: true, components: t }))
                        }
                    ]
                }
            ]
        };
    }

    editor.BlockManager.add('master-carousel-cursus', {
        label: 'Carrousel Cursus',
        category: cat,
        content: { type: TYPE },
        attributes: { class: 'fa fa-graduation-cap' }
    });

    editor.DomComponents.addType(TYPE, {
        model: {
            defaults: {
                name: 'Carrousel Cursus',
                'script-props': [],
                styles: `
  .cursus, .cursus * { box-sizing: border-box; }
  .cursus { background:#c3c8e6; padding:56px 24px 48px; font-family:'Montserrat',Arial,Helvetica,sans-serif; color:#1a1a1a; line-height:1.5; }
  .cursus .section-title { font-size:28px; font-weight:800; text-transform:uppercase; letter-spacing:1px; text-align:center; }
  .cursus .container { max-width:1140px; margin:0 auto; padding:0 24px; }

  .cursus .cursus-carrousel { display:flex; gap:22px; margin-top:40px; overflow-x:auto; scroll-behavior:smooth; scrollbar-width:none; }
  .cursus .cursus-carrousel::-webkit-scrollbar { display:none; }

  .cursus-carte { background:#fff; flex:0 0 330px; display:flex; flex-direction:column; }
  .cursus-entete { background:#453a90; color:#fff; padding:18px 24px; }
  .cursus-annee { font-size:12px; font-weight:600; }
  .cursus-entete h3 { font-size:15px; font-weight:800; text-transform:uppercase; line-height:1.3; margin-top:4px; }
  .cursus-corps { padding:22px 24px 26px; display:flex; flex-direction:column; gap:16px; flex:1; }
  .cursus-corps p { font-size:12.5px; color:#7c7c7c; line-height:1.6; flex:1; }
  .cursus-tags { display:flex; flex-direction:column; gap:10px; align-items:flex-start; }
  .cursus-tag { font-size:11.5px; color:#5b51a8; border:1px solid #b6b0d3; border-radius:2px; padding:6px 12px; }

  .cursus .cursus-pagination { display:flex; justify-content:center; align-items:center; gap:16px; margin-top:32px; font-size:13px; font-weight:600; color:#575966; }
  .cursus .cursus-pagination button { background:none; border:none; font-size:20px; cursor:pointer; color:#575966; }

  @media (max-width:860px){ .cursus-carte { flex-basis:280px; } }
`,
                components: [{
                    tagName: 'section',
                    classes: ['cursus'],
                    components: [
                        { type: 'text', tagName: 'h2', classes: ['section-title'], editable: true, selectable: true, components: 'Quel cursus est proposé&nbsp;?' },
                        {
                            tagName: 'div',
                            classes: ['container'],
                            components: [
                                {
                                    tagName: 'div',
                                    classes: ['cursus-carrousel'],
                                    components: [
                                        makeCarte('1<sup>re</sup> année', 'Découverte<br>&amp; Fondamentaux', 'La 1<sup>re</sup> année pose les bases techniques, créatives et culturelles de l&rsquo;architecture intérieure, en développant les bons réflexes et une méthode de travail solide.', ['1<sup>er</sup> projet de rénovation d&rsquo;un appartement', 'Stage de 1 mois']),
                                        makeCarte('2<sup>e</sup> année', 'Techniques<br>&amp; Outils', 'La 2<sup>e</sup> année renforce les compétences techniques et créatives en architecture résidentielle, en préparant les étudiants à concevoir et traiter une grande variété de projets, de la rénovation à la construction neuve.', ['Projet complet de rénovation de villa', 'Stage de 2 mois']),
                                        makeCarte('3<sup>e</sup> année', 'Architecture<br>Commerciale', 'La 3<sup>e</sup> année initie les étudiants à l&rsquo;architecture commerciale et aux lieux recevant du public, en intégrant les notions de marketing, d&rsquo;usages et d&rsquo;identité de marque pour concevoir des espaces cohérents et ciblés.', ['Projet d&rsquo;architecture commerciale (hôtel, boutique, restaurant...)', 'Stage de 2 mois'])
                                    ]
                                },
                                {
                                    tagName: 'div',
                                    classes: ['cursus-pagination'],
                                    components: [
                                        { tagName: 'button', classes: ['cursus-prev'], selectable: true, attributes: { type: 'button', 'aria-label': 'Précédent' }, components: '&larr;' },
                                        { tagName: 'span', classes: ['cursus-compteur'], components: '1&nbsp;/&nbsp;3' },
                                        { tagName: 'button', classes: ['cursus-next'], selectable: true, attributes: { type: 'button', 'aria-label': 'Suivant' }, components: '&rarr;' }
                                    ]
                                }
                            ]
                        }
                    ]
                }],
                script: function() {
                    var el = this;
                    var carr = el.querySelector('.cursus-carrousel');
                    var compteur = el.querySelector('.cursus-compteur');
                    var prev = el.querySelector('.cursus-prev');
                    var next = el.querySelector('.cursus-next');
                    if (!carr) return;
                    var STEP = 352; /* 330 (carte) + 22 (gap) */

                    function maj() {
                        if (!compteur) return;
                        var total = carr.children.length;
                        var index = Math.round(carr.scrollLeft / STEP) + 1;
                        if (index < 1) index = 1;
                        if (index > total) index = total;
                        compteur.innerHTML = index + '&nbsp;/&nbsp;' + total;
                    }
                    if (prev) prev.addEventListener('click', function() { carr.scrollBy({ left: -STEP, behavior: 'smooth' }); });
                    if (next) next.addEventListener('click', function() { carr.scrollBy({ left: STEP, behavior: 'smooth' }); });
                    carr.addEventListener('scroll', function() { setTimeout(maj, 350); });
                    maj();
                }
            }
        }
    });
}
