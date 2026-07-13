export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-form', {
        label: 'Formulaire Inscription',
        category: cat,
        content: `
<section class="mf2-section">
  <div class="mf2-inner">
    <div class="mf2-campus-box" id="mf2-campus-box">
      <label class="mf2-label" for="mf2-campus">Campus<span class="mf2-req">*</span></label>
      <div class="mf2-select-wrap">
        <select id="mf2-campus" class="mf2-select" onchange="mf2CampusChange(this)">
          <option value="">— Choisir un campus —</option>
          <option value="aix">Aix-en-Provence</option>
          <option value="bordeaux">Bordeaux</option>
          <option value="lille">Lille</option>
          <option value="lyon">Lyon</option>
          <option value="montpellier">Montpellier</option>
          <option value="nice">Nice</option>
          <option value="paris">Paris</option>
        </select>
        <span class="mf2-chevron">&#8964;</span>
      </div>
      <div class="mf2-date-info" id="mf2-date-info" style="display:none">
        <p class="mf2-date-line">&#9679; <strong>Samedi 07 mars 2026</strong> &nbsp;&nbsp; Conférence de présentation : 10h30</p>
        <p class="mf2-date-addr" id="mf2-addr">105, avenue de Genève, 74000 Annecy</p>
      </div>
    </div>
    <div class="mf2-fields">
      <div class="mf2-row mf2-full">
        <label class="mf2-label" for="mf2-profil">Vous êtes<span class="mf2-req">*</span></label>
        <div class="mf2-select-wrap">
          <select id="mf2-profil" class="mf2-select">
            <option value="">— Sélectionner —</option>
            <option>Lycéen(ne) en terminale</option>
            <option>Étudiant(e) en réorientation</option>
            <option>Parent ou accompagnant</option>
            <option>Autre</option>
          </select>
          <span class="mf2-chevron">&#8964;</span>
        </div>
      </div>
      <div class="mf2-row mf2-half">
        <div>
          <label class="mf2-label" for="mf2-nom">Nom<span class="mf2-req">*</span></label>
          <input id="mf2-nom" type="text" class="mf2-input" placeholder="">
        </div>
        <div>
          <label class="mf2-label" for="mf2-prenom">Prénom<span class="mf2-req">*</span></label>
          <input id="mf2-prenom" type="text" class="mf2-input" placeholder="">
        </div>
      </div>
      <div class="mf2-row mf2-half">
        <div>
          <label class="mf2-label" for="mf2-email">Adresse email<span class="mf2-req">*</span></label>
          <input id="mf2-email" type="email" class="mf2-input" placeholder="">
        </div>
        <div>
          <label class="mf2-label" for="mf2-tel">Portable<span class="mf2-req">*</span></label>
          <input id="mf2-tel" type="tel" class="mf2-input" placeholder="">
        </div>
      </div>
      <div class="mf2-row mf2-full">
        <label class="mf2-label" for="mf2-niveau">Niveau d'études<span class="mf2-req">*</span></label>
        <div class="mf2-select-wrap">
          <select id="mf2-niveau" class="mf2-select">
            <option value="">— Sélectionner —</option>
            <option>Classe de Terminale</option>
            <option>Bac+1</option>
            <option>Bac+2</option>
            <option>Bac+3 et plus</option>
          </select>
          <span class="mf2-chevron">&#8964;</span>
        </div>
      </div>
      <div class="mf2-row mf2-full">
        <label class="mf2-checkbox-label">
          <input type="checkbox" class="mf2-checkbox">
          <span>J'accepte d'être contacté(e) par l'école pour les finalités décrites <a href="#" class="mf2-link" onclick="mf2ScrollToLegal(event)">ici</a></span>
        </label>
      </div>
      <div class="mf2-row mf2-full">
        <button type="submit" class="mf2-submit">Je m'inscris</button>
      </div>
    </div>
  </div>
</section>
<style>
  .mf2-section { padding: 48px 24px; background: var(--brand-background, #ffffff); font-family: var(--brand-font, 'Inter', sans-serif); }
  .mf2-inner { max-width: 640px; margin: 0 auto; }
  .mf2-campus-box { background: #e8edf2; padding: 18px 20px; margin-bottom: 24px; border-radius: 2px; position: relative; }
  .mf2-campus-box::after { content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid #e8edf2; }
  .mf2-label { display: block; font-size: 13px; font-weight: 600; color: var(--mf2-label-color, var(--brand-text, #1a1a1a)); margin-bottom: 6px; }
  .mf2-req { color: #c0175e; margin-left: 2px; }
  .mf2-select-wrap { position: relative; }
  .mf2-select { width: 100%; padding: 10px 36px 10px 12px; border: 1px solid var(--brand-border, #e5e7eb); background: var(--brand-background, #ffffff); font-size: 14px; appearance: none; -webkit-appearance: none; border-radius: 2px; color: var(--brand-text, #1a1a1a); }
  .mf2-chevron { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; font-size: 18px; color: var(--brand-muted, #6b7280); }
  .mf2-date-info { margin-top: 14px; }
  .mf2-date-line { margin: 0 0 4px; font-size: 13px; color: var(--brand-text, #1a1a1a); }
  .mf2-date-addr { margin: 0; font-size: 12px; color: var(--brand-muted, #6b7280); }
  .mf2-fields { display: flex; flex-direction: column; gap: 16px; }
  .mf2-row { }
  .mf2-full { }
  .mf2-half { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .mf2-input { width: 100%; padding: 10px 12px; border: 1px solid var(--brand-border, #e5e7eb); font-size: 14px; border-radius: 2px; box-sizing: border-box; }
  .mf2-input:focus, .mf2-select:focus { outline: none; border-color: var(--brand-primary, #1f2937); }
  .mf2-checkbox-label { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--brand-muted, #6b7280); line-height: 1.4; cursor: pointer; }
  .mf2-checkbox { flex-shrink: 0; margin-top: 2px; }
  .mf2-link { color: var(--brand-link, var(--brand-primary, #1f2937)); }
  .mf2-submit { width: 100%; padding: 14px; background: var(--brand-button-bg, var(--brand-primary, #111)); color: var(--brand-button-text, #ffffff); border: none; font-size: 15px; font-weight: 700; cursor: pointer; border-radius: 2px; letter-spacing: 0.5px; transition: opacity 0.2s; }
  .mf2-submit:hover { opacity: 0.85; }
  @media(max-width:768px) { .mf2-half { grid-template-columns: 1fr; } }
</style>
<script>
// Ancre « ici » (RGPD) → défile vers le footer / la politique de confidentialité.
function mf2ScrollToLegal(e) {
  if (e && e.preventDefault) e.preventDefault();
  var doc = document;
  var target = doc.querySelector('footer .ft-legal-link')
            || doc.querySelector('footer')
            || doc.querySelector('[class*="footer"]');
  if (target && target.scrollIntoView) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    window.scrollTo({ top: doc.body.scrollHeight, behavior: 'smooth' });
  }
}
function mf2CampusChange(sel) {
  var dateInfo = document.getElementById('mf2-date-info');
  var addr = document.getElementById('mf2-addr');
  var addresses = {
    aix: '2, bd du Roi René, 13100 Aix-en-Provence',
    bordeaux: '20, rue des Frères Bonie, 33000 Bordeaux',
    lille: '1 bis, rue de Tenremonde, 59000 Lille',
    lyon: '69, rue Vendôme, 69006 Lyon',
    montpellier: '29, rue de la République, 34000 Montpellier',
    nice: '6, rue Assalit, 06000 Nice',
    paris: '84, bd de Courcelles, 75017 Paris'
  };
  if (sel.value && dateInfo) {
    dateInfo.style.display = 'block';
    if (addr && addresses[sel.value]) addr.textContent = addresses[sel.value];
  } else if (dateInfo) {
    dateInfo.style.display = 'none';
  }
}
</script>`,
        attributes: { class: 'fa fa-wpforms' }
    });

    // Réglage « Couleur des labels » : colore TOUS les noms de champs d'un coup
    // (campus inclus), via la variable CSS --mf2-label-color. Fiable, indépendant
    // du double-clic label par label (qui bute sur le label campus dans le bloc gris).
    editor.DomComponents.addType('master-form', {
        isComponent: el => el.classList && el.classList.contains('mf2-section'),
        model: {
            defaults: {
                name: 'Formulaire Inscription',
                'label-color': '',
                traits: [
                    {
                        type: 'color',
                        name: 'label-color',
                        label: 'Couleur des labels',
                        changeProp: 1
                    }
                ]
            },
            init() {
                try {
                    const st = this.getStyle() || {};
                    if (st['--mf2-label-color']) this.set('label-color', st['--mf2-label-color'], { silent: true });
                } catch (e) { /* pas bloquant */ }
                this.on('change:label-color', this.updateLabelColor);
            },
            updateLabelColor() {
                const c = this.get('label-color');
                if (c) this.addStyle({ '--mf2-label-color': c });
            }
        }
    });
}
