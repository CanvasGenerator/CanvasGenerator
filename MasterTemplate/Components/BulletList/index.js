/**
 * Master Component « Liste à puces ».
 *
 * Liste autonome dont les PUCES sont entièrement paramétrables via le panneau de
 * réglages (Trait Manager) quand on sélectionne la liste :
 *   • « Type de puce »   → disque •, cercle ◦, carré ▪, tiret –, flèche →, coche ✓, étoile ★, aucune
 *   • « Couleur »        → sélecteur de couleur (variable CSS --bl-color)
 *   • « Position »       → Gauche / Droite
 *   • « Décalage (px) »  → espace puce/texte (variable CSS --bl-gap)
 *
 * Les puces sont rendues via li::before (list-style:none), avec le glyphe piloté par
 * une CLASSE (bl-disc, bl-arrow, …) → robuste sur la page publiée / l'aperçu / SFMC,
 * et la couleur/décalage via variables CSS inline → rendu identique partout.
 */
export default function (editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    const BULLET_TYPES = ['disc', 'circle', 'square', 'dash', 'arrow', 'check', 'star', 'none'];

    const CONTENT = `
<section class="mc-bl-section">
  <ul class="mc-bl bl-disc">
    <li>Premier élément de la liste</li>
    <li>Deuxième élément de la liste</li>
    <li>Troisième élément de la liste</li>
  </ul>
  <style>
    .mc-bl-section { padding: 32px 24px; background: var(--brand-background, #ffffff); font-family: var(--brand-font, 'Inter', sans-serif); }
    .mc-bl { list-style: none; margin: 0 auto; padding: 0; max-width: 800px; }
    .mc-bl li {
      position: relative;
      padding-left: var(--bl-gap, 28px);
      padding-right: 0;
      margin-bottom: 12px;
      font-size: 16px;
      line-height: 1.5;
      color: var(--brand-text, #1a1a1a);
    }
    .mc-bl li::before {
      content: '\\2022';
      position: absolute;
      left: 0; right: auto;
      color: var(--bl-color, var(--brand-primary, #3b82f6));
      font-weight: 700;
    }
    /* Type de puce (piloté par une classe → robuste sur toute page publiée) */
    .mc-bl.bl-disc   li::before { content: '\\2022'; } /* • */
    .mc-bl.bl-circle li::before { content: '\\25E6'; } /* ◦ */
    .mc-bl.bl-square li::before { content: '\\25AA'; } /* ▪ */
    .mc-bl.bl-dash   li::before { content: '\\2013'; } /* – */
    .mc-bl.bl-arrow  li::before { content: '\\2192'; } /* → */
    .mc-bl.bl-check  li::before { content: '\\2713'; } /* ✓ */
    .mc-bl.bl-star   li::before { content: '\\2605'; } /* ★ */
    .mc-bl.bl-none   li::before { content: ''; }
    .mc-bl.bl-none   li { padding-left: 0; }
    /* Position des puces = Droite */
    .mc-bl.bl-right li { padding-left: 0; padding-right: var(--bl-gap, 28px); text-align: right; }
    .mc-bl.bl-right li::before { left: auto; right: 0; }
  </style>
</section>`;

    editor.BlockManager.add('master-bullet-list', {
        label: 'Liste à puces',
        category: cat,
        content: CONTENT,
        attributes: { class: 'fa fa-list-ul' }
    });

    // Traits posés sur la LISTE (.mc-bl) : cliquer une ligne puis la flèche ↑ (parent)
    // une fois amène sur « Liste à puces » et affiche les réglages.
    editor.DomComponents.addType('mc-bl', {
        isComponent: el => el.classList && el.classList.contains('mc-bl'),
        model: {
            defaults: {
                name: 'Liste à puces',
                'bl-type': 'disc',
                'bl-color': '',
                'bl-position': 'left',
                'bl-gap': '',
                traits: [
                    {
                        type: 'select',
                        name: 'bl-type',
                        label: 'Type de puce',
                        changeProp: 1,
                        options: [
                            { id: 'disc',   name: 'Disque  •' },
                            { id: 'circle', name: 'Cercle  ◦' },
                            { id: 'square', name: 'Carré  ▪' },
                            { id: 'dash',   name: 'Tiret  –' },
                            { id: 'arrow',  name: 'Flèche  →' },
                            { id: 'check',  name: 'Coche  ✓' },
                            { id: 'star',   name: 'Étoile  ★' },
                            { id: 'none',   name: 'Aucune' }
                        ]
                    },
                    { type: 'color',  name: 'bl-color',    label: 'Couleur des puces', changeProp: 1 },
                    {
                        type: 'select',
                        name: 'bl-position',
                        label: 'Position',
                        changeProp: 1,
                        options: [
                            { id: 'left',  name: 'Gauche' },
                            { id: 'right', name: 'Droite' }
                        ]
                    },
                    { type: 'number', name: 'bl-gap', label: 'Décalage (px)', changeProp: 1, min: 0 }
                ]
            },
            init() {
                // Réouverture d'un projet : restaurer les valeurs des traits depuis le
                // style/les classes déjà persistés, pour que le panneau les reflète.
                try {
                    const st = this.getStyle() || {};
                    if (st['--bl-color']) this.set('bl-color', st['--bl-color'], { silent: true });
                    if (st['--bl-gap']) this.set('bl-gap', parseInt(st['--bl-gap'], 10) || '', { silent: true });
                    const classes = (this.getClasses() || []).map(c => c.id || c);
                    BULLET_TYPES.forEach(t => { if (classes.includes('bl-' + t)) this.set('bl-type', t, { silent: true }); });
                    if (classes.includes('bl-right')) this.set('bl-position', 'right', { silent: true });
                } catch (e) { /* pas bloquant */ }
                this.on('change:bl-type change:bl-color change:bl-position change:bl-gap', this.updateBullets);
            },
            updateBullets() {
                // Couleur
                const color = this.get('bl-color');
                if (color) this.addStyle({ '--bl-color': color });
                // Décalage (px)
                const gap = this.get('bl-gap');
                if (gap !== '' && gap != null) this.addStyle({ '--bl-gap': (parseInt(gap, 10) || 0) + 'px' });
                // Type de puce (classe)
                BULLET_TYPES.forEach(t => this.removeClass('bl-' + t));
                this.addClass('bl-' + (this.get('bl-type') || 'disc'));
                // Position
                if ((this.get('bl-position') || 'left') === 'right') this.addClass('bl-right');
                else this.removeClass('bl-right');
            }
        }
    });
}
