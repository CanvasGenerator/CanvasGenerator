/**
 * Bloc « L'insertion au cœur du projet » — 2 colonnes :
 *   • Gauche : texte éditable (titre, paragraphes, encart incubateur, mini-chiffres, note).
 *   • Droite : ZONE VIDÉO. On clique sur le rectangle sombre → le panneau de droite
 *              affiche un champ « URL vidéo » (YouTube / Vimeo / .mp4). La vidéo s'affiche.
 *
 * Deux types custom :
 *   - 'insertion-video'      → la section (conteneur, texte éditable).
 *   - 'insertion-video-zone' → la zone vidéo (.bloc-video) qui porte le trait + le script.
 *     GrapesJS reconnaît .bloc-video via isComponent et l'upgrade automatiquement,
 *     donc cliquer la zone la sélectionne et ouvre le champ URL dans la sidebar.
 */
export default function (editor, categories) {
    const TYPE = 'insertion-video';
    const ZONE = 'insertion-video-zone';

    const CONTENT = `
    <section class="insertion">
      <div class="insertion-container">
        <div class="insertion-grille">
          <div class="insertion-texte">
            <h2>L&rsquo;insertion au c&oelig;ur<br>du projet</h2>
            <p>Chaque étudiant bénéficie d&rsquo;un accompagnement personnalisé par un <strong>Coach Carrière</strong>, de la recherche de stage ou d&rsquo;alternance jusqu&rsquo;à l&rsquo;obtention de leur premier emploi. Des <strong>sessions de coaching</strong>, des <strong>ateliers CV/LinkedIn</strong>, ainsi que des <strong>simulations d&rsquo;entretien</strong> sont proposés pour maximiser l&rsquo;employabilité de chaque étudiant.</p>
            <p>Nous organisons des événements de recrutement exclusifs chaque année et mettons à disposition une plateforme avec plus de 10&nbsp;000 offres qualifiées, offrant ainsi de nombreuses opportunités professionnelles.</p>
            <div class="encart-incubateur">
              <h3>Incubateur start-up</h3>
              <p>Vous avez une idée innovante&nbsp;? Nous accompagnons les étudiants-entrepreneurs dans la création de leur entreprise dès leurs études, avec un suivi personnalisé et l&rsquo;accès à un réseau d&rsquo;experts.</p>
            </div>
            <div class="mini-chiffres">
              <div class="mini-chiffre"><div class="val">21</div><div class="lab">Mois de stage<br>en 5 ans</div></div>
              <div class="mini-chiffre"><div class="val">10K</div><div class="lab">Offres de stage / an</div></div>
              <div class="mini-chiffre"><div class="val">90%*</div><div class="lab">De diplômés en poste<br>après 6 mois</div></div>
            </div>
            <p class="note-certification">* Certification professionnelle «&nbsp;Manager du marketing et de la transformation digitale&nbsp;»</p>
          </div>
          <div class="bloc-video">
            <div class="placeholder-video">
              <div class="play-btn"></div>
              EFAP | Stages Connect
              <span class="placeholder-hint">Cliquez ici, puis collez l'URL de la vidéo dans le panneau de droite.</span>
            </div>
          </div>
        </div>
      </div>
      <style>
        .insertion{background:#fbdeba;padding:56px 24px;font-family:var(--brand-font,'Montserrat',Arial,sans-serif);color:#1a1a1a;}
        .insertion-container{max-width:1140px;margin:0 auto;padding:0 24px;}
        .insertion-grille{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:start;}
        .insertion-texte h2{font-size:26px;font-weight:800;text-transform:uppercase;color:#000;line-height:1.2;margin-bottom:22px;}
        .insertion-texte p{font-size:13px;color:#5f5447;line-height:1.6;margin-bottom:16px;}
        .insertion-texte p strong{color:#000;}
        .encart-incubateur{background:#f1ede9;padding:26px 28px;margin:22px 0;}
        .encart-incubateur h3{font-size:15px;font-weight:800;text-transform:uppercase;color:#000;margin-bottom:12px;}
        .encart-incubateur p{font-size:12.5px;color:#8a898e;line-height:1.6;margin:0;}
        .mini-chiffres{display:flex;margin-top:26px;}
        .mini-chiffre{flex:1;text-align:center;padding:0 16px;border-right:1px solid #000;}
        .mini-chiffre:last-child{border-right:none;}
        .mini-chiffre .val{font-size:30px;font-weight:800;color:#000;}
        .mini-chiffre .lab{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#000;margin-top:6px;}
        .note-certification{font-size:11px;font-style:italic;margin-top:22px;color:#8a7a66;}
        .bloc-video{position:relative;background:#2b2b2b;min-height:420px;display:flex;align-items:center;justify-content:center;color:#fff;overflow:hidden;}
        .bloc-video .placeholder-video{text-align:center;font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85;padding:20px;}
        .play-btn{width:70px;height:48px;background:#ff0000;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
        .play-btn::before{content:"";border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent;}
        .placeholder-hint{display:block;font-size:11px;text-transform:none;letter-spacing:.3px;margin-top:10px;opacity:.8;}
        .bloc-video iframe,.bloc-video video{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover;background:#000;}
        .bloc-video.a-video .placeholder-video{display:none;}
        @media (max-width:768px){.insertion-grille{grid-template-columns:1fr;gap:28px;}.bloc-video{min-height:260px;}}
      </style>
    </section>`;

    editor.BlockManager.add(TYPE, {
        label: 'Insertion + Vidéo',
        category: categories.MASTER,
        content: { type: TYPE },
        attributes: { class: 'fa fa-video' }
    });

    // Section conteneur (texte éditable). Pas de trait ici.
    editor.DomComponents.addType(TYPE, {
        isComponent: el => el.classList && el.classList.contains('insertion'),
        model: {
            defaults: {
                name: 'Insertion + Vidéo',
                components: CONTENT
            }
        }
    });

    // Zone vidéo : porte le champ « URL vidéo » (sidebar) + insère la vidéo.
    editor.DomComponents.addType(ZONE, {
        isComponent: el => el.classList && el.classList.contains('bloc-video'),
        model: {
            defaults: {
                name: 'Zone vidéo',
                attributes: { 'data-video-url': '' },
                traits: [
                    {
                        type: 'text',
                        name: 'data-video-url',
                        label: 'URL vidéo (YouTube, Vimeo, .mp4)',
                        placeholder: 'https://www.youtube.com/watch?v=...'
                    }
                ],
                'script-props': ['data-video-url'],
                script: function () {
                    var bloc = this;
                    var url = (bloc.getAttribute('data-video-url') || '').trim();

                    var old = bloc.querySelector('iframe, video');
                    if (old) old.remove();

                    if (!url) { bloc.classList.remove('a-video'); return; }

                    var el, src, type = 'iframe', m;
                    if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/))) {
                        src = 'https://www.youtube.com/embed/' + m[1];
                    } else if ((m = url.match(/vimeo\.com\/(\d+)/))) {
                        src = 'https://player.vimeo.com/video/' + m[1];
                    } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
                        type = 'video'; src = url;
                    } else {
                        src = url;
                    }

                    if (type === 'video') {
                        el = document.createElement('video');
                        el.src = src; el.controls = true; el.playsInline = true;
                    } else {
                        el = document.createElement('iframe');
                        el.src = src;
                        el.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                        el.setAttribute('allowfullscreen', 'true');
                    }
                    bloc.appendChild(el);
                    bloc.classList.add('a-video');
                }
            }
        }
    });
}
