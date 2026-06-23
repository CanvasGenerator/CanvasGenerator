export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-accordion', {
        label: 'Accordéon FAQ',
        category: cat,
        content: `
<section class="ma-section">
  <div class="ma-inner">
    <div class="ma-header-row">
      <h2 class="ma-title">FOIRE AUX QUESTIONS</h2>
    </div>
    <div class="ma-list" id="ma-list">
      <div class="ma-item ma-open">
        <div class="ma-q">
          <span>Peut-on intégrer l'école avec tout type de BAC ?</span>
          <button class="ma-toggle" aria-label="Toggle">&#8722;</button>
        </div>
        <div class="ma-a">
          <p>L'école accueille des candidats actuellement en classe de terminale – Bac général, Bac technologique ou Bac professionnel (toutes options) et des candidats déjà titulaires du baccalauréat (toutes options). Pour les candidats actuellement en classe de terminale, l'inscription définitive en 1ère année sera effective dès l'obtention du diplôme du baccalauréat.</p>
        </div>
      </div>
      <div class="ma-item">
        <div class="ma-q">
          <span>Est-ce qu'il est nécessaire de savoir dessiner pour intégrer l'école ?</span>
          <button class="ma-toggle" aria-label="Toggle">&#43;</button>
        </div>
        <div class="ma-a" style="display:none">
          <p>Non, aucun pré-requis artistique n'est nécessaire. Nous accueillons des profils variés, curieux et motivés.</p>
        </div>
      </div>
      <div class="ma-item">
        <div class="ma-q">
          <span>Est-il préférable de faire une classe préparatoire avant d'intégrer l'école ?</span>
          <button class="ma-toggle" aria-label="Toggle">&#43;</button>
        </div>
        <div class="ma-a" style="display:none">
          <p>La classe préparatoire permet d'explorer différents domaines et de confirmer son orientation avant d'intégrer un programme spécialisé.</p>
        </div>
      </div>
      <div class="ma-item">
        <div class="ma-q">
          <span>Le programme est-il différent dans les différents campus ?</span>
          <button class="ma-toggle" aria-label="Toggle">&#43;</button>
        </div>
        <div class="ma-a" style="display:none">
          <p>Le cœur du programme est identique sur tous les campus. Certains campus proposent des spécialisations ou des options supplémentaires.</p>
        </div>
      </div>
      <div class="ma-item">
        <div class="ma-q">
          <span>Quel est l'objectif des classes préparatoires ?</span>
          <button class="ma-toggle" aria-label="Toggle">&#43;</button>
        </div>
        <div class="ma-a" style="display:none">
          <p>La classe préparatoire a pour objectif d'acquérir les fondamentaux et d'explorer plusieurs disciplines avant de choisir une spécialisation.</p>
        </div>
      </div>
      <div class="ma-item">
        <div class="ma-q">
          <span>Faut-il un matériel spécifique pour suivre les formations ?</span>
          <button class="ma-toggle" aria-label="Toggle">&#43;</button>
        </div>
        <div class="ma-a" style="display:none">
          <p>La liste du matériel recommandé est fournie lors de l'inscription. Un ordinateur portable et certains logiciels créatifs sont généralement requis.</p>
        </div>
      </div>
    </div>
  </div>
</section>
<style>
  .ma-section { padding: 48px 24px; background: #fff; font-family: Arial, sans-serif; }
  .ma-inner { max-width: 900px; margin: 0 auto; }
  .ma-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .ma-title { font-size: 20px; font-weight: 900; color: var(--text-main, #111); letter-spacing: 1px; margin: 0; }
  .ma-item { border-bottom: 1px solid #e0e0e0; }
  .ma-q {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 4px;
    cursor: pointer;
    gap: 16px;
  }
  .ma-q span { font-size: 14px; color: var(--text-main, #222); line-height: 1.4; flex: 1; }
  .ma-toggle {
    width: 32px; height: 32px; border-radius: 50%; border: 2px solid #bbb;
    background: #fff; font-size: 20px; line-height: 1; color: #555;
    cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .ma-item.ma-open .ma-toggle { border-color: var(--brand-primary,#1f2937); color: var(--brand-primary,#1f2937); }
  .ma-a { padding: 0 4px 16px; }
  .ma-a p { margin: 0; font-size: 13.5px; color: #555; line-height: 1.65; }
  @media(max-width:768px) { .ma-section { padding: 32px 16px; } }
</style>
<script>
(function() {
  var list = document.getElementById('ma-list');
  if (!list) return;
  list.querySelectorAll('.ma-q').forEach(function(q) {
    q.addEventListener('click', function() {
      var item = q.parentElement;
      var answer = item.querySelector('.ma-a');
      var btn = item.querySelector('.ma-toggle');
      var isOpen = item.classList.contains('ma-open');
      item.classList.toggle('ma-open', !isOpen);
      answer.style.display = isOpen ? 'none' : 'block';
      btn.innerHTML = isOpen ? '&#43;' : '&#8722;';
    });
  });
})();
</script>`,
        attributes: { class: 'fa fa-list-ul' }
    });
}
