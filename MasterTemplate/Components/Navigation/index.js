export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    editor.BlockManager.add('master-navigation', {
        label: 'Menu Horizontal (ancres)',
        category: cat,
        content: `
<nav class="mn-nav" id="mn-nav">
  <div class="mn-inner">
    <ul class="mn-list">
      <li><a class="mn-link mn-active" href="#pourquoi">Pourquoi nous ?</a></li>
      <li><a class="mn-link" href="#programmes">Programmes</a></li>
      <li><a class="mn-link" href="#metiers">Métiers</a></li>
      <li><a class="mn-link" href="#insertion">Insertion professionnelle</a></li>
      <li><a class="mn-link" href="#pedagogie">Pédagogie</a></li>
      <li><a class="mn-link" href="#evenements">Événements</a></li>
      <li><a class="mn-link" href="#campus">Campus</a></li>
      <li><a class="mn-link" href="#admission">Admission</a></li>
      <li><a class="mn-link" href="#faq">Foire aux questions</a></li>
    </ul>
  </div>
</nav>
<style>
  .mn-nav {
    background: var(--brand-background, #ffffff);
    border-bottom: 3px solid var(--bande-color, #1f2937);
    position: sticky;
    top: 0;
    z-index: 200;
    font-family: var(--brand-font, 'Inter', sans-serif);
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .mn-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 16px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .mn-inner::-webkit-scrollbar { display: none; }
  .mn-list {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    white-space: nowrap;
  }
  .mn-link {
    display: block;
    padding: 14px 16px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #444;
    text-decoration: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -3px;
    transition: color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }
  .mn-link:hover, .mn-link.mn-active {
    color: var(--bande-color, #1f2937);
    border-bottom-color: var(--bande-color, #1f2937);
  }
  @media (max-width: 768px) {
    .mn-link { font-size: 11px; padding: 12px 10px; }
  }
</style>
<script>
(function() {
  var nav = document.getElementById('mn-nav');
  if (!nav) return;
  var links = nav.querySelectorAll('.mn-link');
  links.forEach(function(link) {
    link.addEventListener('click', function() {
      links.forEach(function(l) { l.classList.remove('mn-active'); });
      link.classList.add('mn-active');
    });
  });
  window.addEventListener('scroll', function() {
    var current = '';
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href || href[0] !== '#') return;
      var section = document.querySelector(href);
      if (section && window.scrollY >= section.offsetTop - 80) {
        current = href;
      }
    });
    links.forEach(function(link) {
      link.classList.toggle('mn-active', link.getAttribute('href') === current);
    });
  });
})();
</script>`,
        attributes: { class: 'fa fa-bars' }
    });
}
