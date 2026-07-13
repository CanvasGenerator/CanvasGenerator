/**
 * Bloc « Two Columns » (Essential Blocks).
 *
 * Les puces de la liste (✓) sont désormais PARAMÉTRABLES via le panneau de réglages
 * (Trait Manager) quand on sélectionne le bloc :
 *   • « Couleur des puces »  → sélecteur de couleur (variable CSS --bullet-color)
 *   • « Position des puces » → Gauche / Droite (classe .bullets-right)
 * Nécessite un type de composant custom (addType) pour exposer ces traits.
 */
export default function (editor, categories) {
    const TYPE = 'two-column';

    const CONTENT = `
        <section class="two-col-section">
            <div class="col-container">
                <div class="col-text">
                    <h2 class="col-title">Expertise & Innovation</h2>
                    <p class="col-desc">Nos programmes sont conçus pour répondre aux exigences du marché actuel. Apprenez auprès de professionnels reconnus et forgez votre propre voie dans l'industrie de la création.</p>
                    <ul class="col-list">
                        <li>Apprentissage par projet</li>
                        <li>Stages en entreprises leaders</li>
                        <li>Réseau d'alumni mondial</li>
                    </ul>
                </div>
                <div class="col-image">
                    <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80" alt="Students" class="rounded-img">
                </div>
            </div>
            <style>
                .two-col-section {
                    padding: 80px 0;
                    background: var(--brand-background, #ffffff);
                    font-family: var(--brand-font, 'Inter', sans-serif);
                }
                .col-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 60px;
                    align-items: center;
                    padding: 0 20px;
                }
                .col-title {
                    font-size: 32px;
                    font-weight: 700;
                    margin-bottom: 20px;
                    color: var(--brand-text, #1a1a1a);
                }
                .col-desc {
                    font-size: 18px;
                    line-height: 1.6;
                    color: var(--brand-muted, #6b7280);
                    margin-bottom: 30px;
                }
                .col-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .col-list li {
                    /* Décalage piloté par le trait « Décalage » (défaut 30px) */
                    padding-left: var(--bullet-gap, 30px);
                    padding-right: 0;
                    position: relative;
                    margin-bottom: 12px;
                    font-weight: 500;
                    color: var(--brand-text, #1a1a1a);
                }
                .col-list li::before {
                    content: '✓';
                    position: absolute;
                    left: 0;
                    right: auto;
                    /* Couleur pilotée par le trait « Couleur des puces » (défaut = couleur de marque) */
                    color: var(--bullet-color, var(--brand-primary, #3b82f6));
                    font-weight: bold;
                }
                /* Trait « Symbole » : flèche ou point (via classe, robuste sur toute page publiée) */
                .col-list.bullet-arrow li::before { content: '\\2192'; }
                .col-list.bullet-dot li::before   { content: '\\2022'; }
                /* Trait « Position des puces » = Droite */
                .col-list.bullets-right li {
                    padding-left: 0;
                    padding-right: var(--bullet-gap, 30px);
                    text-align: right;
                }
                .col-list.bullets-right li::before {
                    left: auto;
                    right: 0;
                }
                .rounded-img {
                    width: 100%;
                    border-radius: 12px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                }
                @media (max-width: 768px) {
                    .col-container { grid-template-columns: 1fr; gap: 40px; }
                    .col-text { order: 2; }
                    .col-image { order: 1; }
                }
            </style>
        </section>
    `;

    editor.BlockManager.add(TYPE, {
        label: 'Two Columns',
        category: categories.ESSENTIAL,
        content: CONTENT,
        attributes: { class: 'gjs-fonts gjs-f-b2' }
    });

    // Les réglages des puces sont posés sur la LISTE (.col-list), qui est juste un cran
    // au-dessus des lignes : l'utilisateur clique une ligne puis la flèche ↑ (parent)
    // une seule fois pour tomber sur « Liste » et voir les réglages. Bien plus facile
    // à trouver que si les traits étaient sur toute la section.
    editor.DomComponents.addType('col-list', {
        isComponent: el => el.classList && el.classList.contains('col-list'),
        model: {
            defaults: {
                name: 'Liste (puces)',
                'bullet-color': '',
                'bullet-symbol': 'check',
                'bullet-position': 'left',
                'bullet-gap': '',
                traits: [
                    {
                        type: 'color',
                        name: 'bullet-color',
                        label: 'Couleur des puces',
                        changeProp: 1
                    },
                    {
                        type: 'select',
                        name: 'bullet-symbol',
                        label: 'Symbole',
                        changeProp: 1,
                        options: [
                            { id: 'check', name: 'Coche  ✓' },
                            { id: 'arrow', name: 'Flèche  →' },
                            { id: 'dot',   name: 'Point  •' }
                        ]
                    },
                    {
                        type: 'select',
                        name: 'bullet-position',
                        label: 'Position des puces',
                        changeProp: 1,
                        options: [
                            { id: 'left', name: 'Gauche' },
                            { id: 'right', name: 'Droite' }
                        ]
                    },
                    {
                        type: 'number',
                        name: 'bullet-gap',
                        label: 'Décalage (px)',
                        changeProp: 1,
                        min: 0
                    }
                ]
            },
            init() {
                // Réouverture d'un projet : restaurer les valeurs des traits depuis
                // le style/les classes déjà persistés, pour que le panneau les reflète.
                try {
                    const st = this.getStyle() || {};
                    if (st['--bullet-color']) this.set('bullet-color', st['--bullet-color'], { silent: true });
                    if (st['--bullet-gap']) this.set('bullet-gap', parseInt(st['--bullet-gap'], 10) || '', { silent: true });
                    const classes = (this.getClasses() || []).map(c => c.id || c);
                    if (classes.includes('bullets-right')) this.set('bullet-position', 'right', { silent: true });
                    if (classes.includes('bullet-arrow')) this.set('bullet-symbol', 'arrow', { silent: true });
                    else if (classes.includes('bullet-dot')) this.set('bullet-symbol', 'dot', { silent: true });
                } catch (e) { /* pas bloquant */ }
                this.on('change:bullet-color change:bullet-symbol change:bullet-position change:bullet-gap', this.updateBullets);
            },
            updateBullets() {
                // Couleur
                const color = this.get('bullet-color');
                if (color) this.addStyle({ '--bullet-color': color });
                // Décalage (px)
                const gap = this.get('bullet-gap');
                if (gap !== '' && gap != null) {
                    this.addStyle({ '--bullet-gap': (parseInt(gap, 10) || 0) + 'px' });
                }
                // Position
                const pos = this.get('bullet-position') || 'left';
                if (pos === 'right') this.addClass('bullets-right');
                else this.removeClass('bullets-right');
                // Symbole
                const sym = this.get('bullet-symbol') || 'check';
                this.removeClass('bullet-arrow');
                this.removeClass('bullet-dot');
                if (sym === 'arrow') this.addClass('bullet-arrow');
                else if (sym === 'dot') this.addClass('bullet-dot');
            }
        }
    });
}
