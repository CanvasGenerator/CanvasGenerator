/**
 * Master Template — « Alternance » (vidéo à gauche + texte à droite)
 * ───────────────────────────────────────────────────────────────
 * Grille 2 colonnes : bloc vidéo + colonne texte éditable.
 *
 * ⇒ L'URL de la vidéo se saisit dans le panneau « Réglages » (sidebar,
 *   onglet à côté de « Style »). Il suffit de cliquer sur la zone vidéo
 *   pour la sélectionner : son réglage « URL de la vidéo » apparaît alors
 *   dans la sidebar. Dès que l'URL est renseignée, une miniature + bouton
 *   play s'affichent ; la vidéo ne se charge qu'au clic sur le play.
 *
 * Le champ URL est un TRAIT GrapesJS (`data-video-url`) porté par le
 * sous-composant `malt-video-alt`. Grâce à `script-props`, le script se
 * relance à chaque modification de l'URL. Tout le CSS est scopé sous
 * `.alternance` pour rester autonome.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    const TYPE = 'malt-block-alternance';

    /* ── Sous-composant vidéo : porte le trait URL + le script ── */
    editor.DomComponents.addType('malt-video-alt', {
        model: {
            defaults: {
                name: 'Vidéo (renseigner l\'URL dans Réglages)',
                droppable: false,
                traits: [
                    {
                        type: 'text',
                        name: 'data-video-url',
                        label: 'URL de la vidéo (YouTube / Vimeo / .mp4)',
                        placeholder: 'https://www.youtube.com/watch?v=...'
                    }
                ],
                'script-props': ['data-video-url'],
                script: function() {
                    var bloc = this;
                    var video = bloc.querySelector('.video-apercu');
                    var iframe = bloc.querySelector('.iframe-apercu');
                    var zoneChoix = bloc.querySelector('.zone-choix');
                    var apercuVideo = bloc.querySelector('.apercu-video');
                    var apercuImage = bloc.querySelector('.apercu-image');
                    var apercuPlay = bloc.querySelector('.apercu-play');
                    if (!video || !iframe || !zoneChoix || !apercuVideo || !apercuImage || !apercuPlay) return;

                    /* Réinitialisation (le script se relance à chaque changement d'URL) */
                    video.classList.remove('actif'); video.removeAttribute('src'); video.controls = false;
                    iframe.classList.remove('actif'); iframe.removeAttribute('src');
                    apercuVideo.classList.remove('actif'); apercuImage.removeAttribute('src');
                    apercuPlay.onclick = null;

                    var url = (bloc.getAttribute('data-video-url') || '').trim();
                    if (!url) { zoneChoix.classList.remove('cachee'); return; }

                    zoneChoix.classList.add('cachee');
                    var embed = convertirEmbed(url);
                    apercuVideo.classList.add('actif');
                    apercuImage.src = embed.thumb || '';

                    if (embed.type === 'video') {
                        video.src = embed.src;
                        video.preload = 'metadata';
                        video.classList.add('actif');
                        apercuPlay.onclick = function() {
                            apercuVideo.classList.remove('actif');
                            video.controls = true;
                            video.play();
                        };
                    } else {
                        apercuPlay.onclick = function() {
                            apercuVideo.classList.remove('actif');
                            var sep = embed.src.indexOf('?') > -1 ? '&' : '?';
                            iframe.src = embed.src + sep + 'autoplay=1';
                            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                            iframe.classList.add('actif');
                        };
                        if (embed.needThumbFetch) {
                            fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(url))
                                .then(function(r) { return r.json(); })
                                .then(function(data) { if (data && data.thumbnail_url) apercuImage.src = data.thumbnail_url; })
                                .catch(function() {});
                        }
                    }

                    function convertirEmbed(u) {
                        var m;
                        m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
                        if (m) return { type: 'iframe', src: 'https://www.youtube.com/embed/' + m[1], thumb: 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg' };
                        m = u.match(/vimeo\.com\/(\d+)/);
                        if (m) return { type: 'iframe', src: 'https://player.vimeo.com/video/' + m[1], needThumbFetch: true };
                        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { type: 'video', src: u };
                        return { type: 'iframe', src: u };
                    }
                }
            }
        }
    });

    editor.BlockManager.add('master-alternance', {
        label: 'Alternance (vidéo + texte)',
        category: cat,
        content: { type: TYPE },
        attributes: { class: 'fa fa-briefcase' }
    });

    editor.DomComponents.addType(TYPE, {
        model: {
            defaults: {
                name: 'Alternance (vidéo + texte)',
                styles: `
  .alternance, .alternance * { box-sizing: border-box; }
  .alternance { background:#a6a7cf; padding:56px 24px; font-family: var(--brand-font, 'Inter', sans-serif); color: var(--brand-text, #1a1a1a); line-height:1.5; }
  .alternance .container { max-width:1140px; margin:0 auto; padding:0 24px; }
  .alternance-grille { display:grid; grid-template-columns:1fr 1fr; gap:44px; align-items:start; }

  /* --- Bloc vidéo --- */
  .alternance .bloc-video { position:relative; background:#2b2b2b; border-radius:6px; min-height:420px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; overflow:hidden; padding:24px; cursor:pointer; }
  .alternance .bloc-video video, .alternance .bloc-video iframe { width:100%; height:100%; position:absolute; inset:0; border:0; object-fit:cover; background:#000; display:none; }
  .alternance .bloc-video video.actif, .alternance .bloc-video iframe.actif { display:block; }

  .alternance .zone-choix { text-align:center; z-index:2; }
  .alternance .zone-choix.cachee { display:none; }
  .alternance .play-btn { width:70px; height:48px; background:#ff0000; border-radius:12px; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .alternance .play-btn::before { content:""; border-left:18px solid #fff; border-top:11px solid transparent; border-bottom:11px solid transparent; }
  .alternance .zone-choix .titre { font-size:13px; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px; }
  .alternance .zone-choix .hint-reglages { font-size:11px; opacity:.7; letter-spacing:.3px; max-width:240px; margin:0 auto; }

  /* --- Aperçu (miniature + bouton play) affiché après saisie de l'URL --- */
  .alternance .apercu-video { position:absolute; inset:0; z-index:3; display:none; background:#000; }
  .alternance .apercu-video.actif { display:block; }
  .alternance .apercu-image { width:100%; height:100%; object-fit:cover; display:block; opacity:.9; }
  .alternance .apercu-play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:70px; height:48px; background:#ff0000; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,.4); transition:transform .15s ease, background .15s ease; }
  .alternance .apercu-play:hover { background:#e60000; transform:translate(-50%,-50%) scale(1.07); }
  .alternance .apercu-play::before { content:""; border-left:18px solid #fff; border-top:11px solid transparent; border-bottom:11px solid transparent; margin-left:4px; }

  /* --- Colonne texte --- */
  .alternance-texte h2 { font-size:26px; font-weight:800; text-transform:uppercase; color:#000; line-height:1.2; margin-bottom:20px; }
  .alternance-texte p { font-size:13px; color:#45455a; margin-bottom:14px; }
  .alternance-texte strong { color:#000; }
  .alternance-texte h4 { font-size:13.5px; font-weight:700; color:#000; margin:20px 0 10px; }
  .alternance-liste { list-style:disc; padding-left:20px; }
  .alternance-liste li::marker { color:#45455a; }
  .alternance-liste li { font-size:13px; color:#45455a; margin-bottom:10px; }
  .alternance-citation { font-size:12.5px; font-style:italic; color:#6b6c86; border-left:2px solid #56566b; padding-left:14px; margin-top:22px; }

  @media (max-width:860px){ .alternance-grille { grid-template-columns:1fr; } }
`,
                components: `
<section class="alternance">
  <div class="container">
    <div class="alternance-grille">

      <div class="bloc-video" data-gjs-type="malt-video-alt">
        <video class="video-apercu"></video>
        <iframe class="iframe-apercu" allowfullscreen></iframe>
        <div class="apercu-video">
          <img class="apercu-image" src="" alt="Aperçu de la vidéo">
          <div class="apercu-play"></div>
        </div>
        <div class="zone-choix">
          <div class="play-btn"></div>
          <p class="titre">Notre école déploie l&rsquo;alternance&nbsp;!</p>
          <p class="hint-reglages">Cliquez ici, puis collez l&rsquo;URL de la vidéo dans l&rsquo;onglet «&nbsp;Réglages&nbsp;» de la barre latérale.</p>
        </div>
      </div>

      <div class="alternance-texte">
        <h2>L&rsquo;alternance<br>dès la 4<sup>e</sup> année</h2>
        <p>Notre école propose <strong>un parcours en 2 étapes&nbsp;:</strong></p>
        <ul class="alternance-liste">
          <li><strong>Bachelor en communication (3 ans)</strong> pour acquérir tous les fondamentaux de la communication et du marketing</li>
          <li><strong>4<sup>e</sup> année</strong> pour approfondir vos compétences et renforcer votre professionnalisation, avec la possibilité de suivre le cursus en alternance.</li>
          <li><strong>5<sup>e</sup> année</strong>, avec plus de 20 MBA spécialisés (dont 11 en alternance) au choix, pour affiner votre expertise métier et favoriser votre insertion professionnelle.</li>
        </ul>
        <h4>Les atouts de l&rsquo;alternance</h4>
        <ul class="alternance-liste">
          <li><strong>Rythme</strong>&nbsp;: 1 semaine de cours + 3 semaines en entreprise</li>
          <li><strong>Contrat d&rsquo;apprentissage</strong> ou stage alterné</li>
          <li><strong>Financement des études</strong>&nbsp;: Les frais sont pris en charge par l&rsquo;entreprise</li>
          <li><strong>Un contact dédié</strong> pour vous aider à trouver l&rsquo;entreprise et vous accompagner tout au long de votre alternance</li>
          <li><strong>Un réseau de 30&nbsp;000 entreprises</strong> pour bâtir votre réseau professionnel dès vos études</li>
          <li><strong>Des événements de recrutement</strong> pour faciliter vos recherches et vos opportunités d&rsquo;emploi</li>
        </ul>
        <p class="alternance-citation">«&nbsp;Un véritable tremplin professionnel qui permet également le financement total de vos études par l&rsquo;entreprise.&nbsp;»</p>
      </div>

    </div>
  </div>
</section>
`
            }
        }
    });
}
