/**
 * Bloc « Comment intégrer l'EFAP ? » — onglets d'admission.
 *
 * - Barre d'onglets (2 onglets) : cliquer un onglet affiche son panneau.
 * - Chaque panneau : 3 étapes (icône SVG + label « Étape N » + texte éditable).
 * - Lien « ÉPREUVES ∨ » qui déplie/replie un détail.
 *
 * Type custom (DomComponents.addType) : la logique d'onglets + toggle vit dans le
 * `script` (exporté avec la page). Tout est scopé sur `this` via des CLASSES et
 * `data-tab`/`data-panel` (pas d'id) → plusieurs blocs possibles sans conflit.
 * Le texte s'édite en double-cliquant dessus.
 */
export default function (editor, categories) {
    const TYPE = 'admission-tabs';

    // Icônes SVG réutilisées (étape 1 = doc, étape 2 = badge, étape 3 = avion papier)
    const ICO_DOC = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:40px;stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><rect x="6" y="8" width="26" height="30" rx="2"/><line x1="6" y1="42" x2="32" y2="42"/><line x1="19" y1="38" x2="19" y2="42"/><line x1="11" y1="15" x2="14" y2="15"/><line x1="17" y1="15" x2="27" y2="15"/><line x1="11" y1="22" x2="14" y2="22"/><line x1="17" y1="22" x2="27" y2="22"/><line x1="11" y1="29" x2="14" y2="29"/><line x1="17" y1="29" x2="27" y2="29"/><circle cx="38" cy="16" r="2"/><circle cx="42" cy="26" r="2"/><circle cx="37" cy="34" r="2"/><line x1="32" y1="15" x2="36" y2="16"/><line x1="40" y1="17" x2="41" y2="24"/><line x1="41" y1="28" x2="38" y2="32"/></svg>`;
    const ICO_BADGE = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:40px;stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><path d="M24 6 l3 4 5 -1 1 5 5 1 -1 5 4 3 -4 3 1 5 -5 1 -1 5 -5 -1 -3 4 -3 -4 -5 1 -1 -5 -5 -1 1 -5 -4 -3 4 -3 -1 -5 5 -1 1 -5 5 1 z"/><path d="M20 24 a4.5 4.5 0 1 1 8 3 c-1 1 -1.5 2 -1.5 3.5 h-5 c0 -1.5 -.5 -2.5 -1.5 -3.5 a4.5 4.5 0 0 1 0 -3 z" transform="translate(0,-2)"/><line x1="21.5" y1="31" x2="26.5" y2="31"/></svg>`;
    const ICO_PLANE = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:40px;stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><polygon points="6,26 42,8 32,42 22,32"/><line x1="42" y1="8" x2="22" y2="32"/><line x1="22" y1="32" x2="20" y2="41"/></svg>`;

    const CONTENT = `
    <section class="integration">
      <h2 class="section-title">Comment intégrer l&rsquo;EFAP&nbsp;?</h2>
      <div class="onglets">
        <div class="onglets-nav">
          <button type="button" class="onglet-btn actif" data-tab="1"><strong>1re, 2e et 3e année</strong></button>
          <button type="button" class="onglet-btn" data-tab="2">4e année</button>
        </div>

        <div class="onglet-panneau actif" data-panel="1">
          <h3>Admissions 1re, 2e et 3e année</h3>
          <p class="sous-titre">Concours (épreuve 100% digitalisées)</p>
          <div class="etapes-grille">
            <div class="etape">
              <div class="etape-icone">${ICO_DOC}</div>
              <div>
                <span class="etape-label">Étape <strong>1</strong></span>
                <p class="etape-texte"><strong>Inscription en ligne au concours</strong><br>à la date de ton choix</p>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_BADGE}</div>
              <div>
                <span class="etape-label">Étape <strong>2</strong></span>
                <p class="etape-texte"><strong>Passage des <span class="lien-epreuves">ÉPREUVES &or;</span></strong><br>du concours</p>
                <div class="epreuves-detail">
                  <p>Détail des épreuves à personnaliser (culture générale, entretien de motivation, épreuve créative...).</p>
                </div>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_PLANE}</div>
              <div>
                <span class="etape-label">Étape <strong>3</strong></span>
                <p class="etape-texte"><strong>Réception des résultats</strong><br>par email</p>
              </div>
            </div>
          </div>
        </div>

        <div class="onglet-panneau" data-panel="2">
          <h3>Admissions 4e année</h3>
          <p class="sous-titre">Contenu à personnaliser</p>
          <div class="etapes-grille">
            <div class="etape">
              <div class="etape-icone">${ICO_DOC}</div>
              <div>
                <span class="etape-label">Étape <strong>1</strong></span>
                <p class="etape-texte"><strong>Étape à personnaliser</strong></p>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_BADGE}</div>
              <div>
                <span class="etape-label">Étape <strong>2</strong></span>
                <p class="etape-texte"><strong>Étape à personnaliser</strong></p>
              </div>
            </div>
            <div class="etape">
              <div class="etape-icone">${ICO_PLANE}</div>
              <div>
                <span class="etape-label">Étape <strong>3</strong></span>
                <p class="etape-texte"><strong>Étape à personnaliser</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .integration{background:#a6a7ce;padding:56px 24px 64px;font-family:var(--brand-font,'Montserrat',Arial,sans-serif);color:#1a1a1a;}
        .integration .section-title{font-size:28px;font-weight:800;text-transform:uppercase;letter-spacing:1px;text-align:center;margin-bottom:44px;}
        .integration .onglets{max-width:960px;margin:0 auto;}
        .integration .onglets-nav{display:flex;}
        .integration .onglet-btn{font-family:inherit;font-size:13.5px;font-weight:400;padding:14px 26px;border:none;background:#f1ede9;color:#000;cursor:pointer;}
        .integration .onglet-btn.actif{font-weight:700;background:#fff;}
        .integration .onglet-panneau{display:none;background:#fff;border:1px solid rgba(0,0,0,.18);box-shadow:0 1px 6px rgba(0,0,0,.08);padding:36px 44px 44px;}
        .integration .onglet-panneau.actif{display:block;}
        .integration .onglet-panneau h3{font-size:14.5px;font-weight:700;color:#000;}
        .integration .onglet-panneau .sous-titre{font-size:13px;color:#898989;margin-top:2px;margin-bottom:34px;}
        .integration .etapes-grille{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;}
        .integration .etape{display:flex;gap:16px;align-items:flex-start;}
        .integration .etape-icone{flex:0 0 44px;height:44px;display:flex;align-items:center;justify-content:center;}
        .integration .etape-label{display:inline-block;background:#ecbaae;font-size:12.5px;font-weight:600;padding:2px 8px;margin-bottom:6px;}
        .integration .etape-label strong{margin-left:4px;}
        .integration .etape-texte{font-size:13px;color:#939393;}
        .integration .etape-texte strong{color:#000;}
        .integration .etape-texte .lien-epreuves{font-weight:700;text-decoration:underline;cursor:pointer;}
        .integration .epreuves-detail{max-height:0;overflow:hidden;transition:max-height .3s ease;font-size:12.5px;color:#444;}
        .integration .epreuves-detail.ouvert{max-height:200px;margin-top:8px;}
        @media (max-width:768px){.integration .etapes-grille{grid-template-columns:1fr;gap:24px;}.integration .onglet-panneau{padding:28px 24px;}}
      </style>
    </section>`;

    editor.BlockManager.add(TYPE, {
        label: 'Onglets Admission',
        category: categories.MASTER,
        content: { type: TYPE },
        attributes: { class: 'fa fa-folder-open' }
    });

    editor.DomComponents.addType(TYPE, {
        isComponent: el => el.classList && el.classList.contains('integration'),
        model: {
            defaults: {
                name: 'Onglets Admission',
                components: CONTENT,
                script: function () {
                    var root = this;
                    var btns = root.querySelectorAll('.onglet-btn');
                    var panels = root.querySelectorAll('.onglet-panneau');
                    btns.forEach(function (btn) {
                        btn.onclick = function () {
                            btns.forEach(function (b) { b.classList.remove('actif'); });
                            panels.forEach(function (p) { p.classList.remove('actif'); });
                            btn.classList.add('actif');
                            var tab = btn.getAttribute('data-tab');
                            var target = root.querySelector('.onglet-panneau[data-panel="' + tab + '"]');
                            if (target) target.classList.add('actif');
                        };
                    });
                    root.querySelectorAll('.lien-epreuves').forEach(function (lien) {
                        lien.onclick = function () {
                            var etape = lien.closest('.etape');
                            var detail = etape && etape.querySelector('.epreuves-detail');
                            if (detail) detail.classList.toggle('ouvert');
                        };
                    });
                }
            }
        }
    });
}
