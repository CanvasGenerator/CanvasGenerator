/**
 * Master Template — « 3 Bonnes Raisons + Vidéo »
 * ───────────────────────────────────────────────────────────────
 * Grille 2 colonnes : bloc vidéo à gauche, 3 raisons avec icônes à droite.
 *
 * ⇒ L'URL de la vidéo se saisit dans le panneau « Réglages » (sidebar,
 *   onglet à côté de « Style »). Cliquez sur la zone vidéo pour la
 *   sélectionner : le réglage « URL de la vidéo » apparaît dans la sidebar.
 *   Dès l'URL renseignée, une miniature + bouton play s'affichent ; la vidéo
 *   ne se charge qu'au clic sur le play.
 *
 * Le champ URL est un TRAIT GrapesJS (`data-video-url`) porté par le
 * sous-composant `mtrv-video`. `script-props` relance le script à chaque
 * modification. CSS scopé sous `.pourquoi`.
 */
export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    const TYPE = 'mtrv-block';

    /* ── Sous-composant vidéo : porte le trait URL + le script ── */
    editor.DomComponents.addType('mtrv-video', {
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

    editor.BlockManager.add('master-trois-raisons-video', {
        label: '3 Bonnes Raisons — Vidéo',
        category: cat,
        content: { type: TYPE },
        attributes: { class: 'fa fa-play-circle' }
    });

    editor.DomComponents.addType(TYPE, {
        model: {
            defaults: {
                name: '3 Bonnes Raisons — Vidéo',
                styles: `
  .pourquoi{background:var(--brand-carousel, #e8a99b);}
  .pourquoi *{box-sizing:border-box;}
  .pourquoi-grille{display:grid;grid-template-columns:1fr 1.2fr;align-items:stretch;font-family: var(--brand-font, 'Inter', sans-serif);color: var(--brand-text, #1a1a1a);line-height:1.5;}

  /* --- Bloc vidéo --- */
  .pourquoi .bloc-video{position:relative;background:#3a2f2c;min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;overflow:hidden;padding:24px;cursor:pointer;}
  .pourquoi .bloc-video video, .pourquoi .bloc-video iframe{width:100%;height:100%;position:absolute;inset:0;border:0;object-fit:cover;background:#000;display:none;}
  .pourquoi .bloc-video video.actif, .pourquoi .bloc-video iframe.actif{display:block;}

  .pourquoi .zone-choix{text-align:center;z-index:2;}
  .pourquoi .zone-choix.cachee{display:none;}
  .pourquoi .play-btn{width:70px;height:48px;background:#ff0000;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
  .pourquoi .play-btn::before{content:"";border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent;}
  .pourquoi .zone-choix .titre{font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;}
  .pourquoi .zone-choix .hint-reglages{font-size:11px;opacity:.7;letter-spacing:.3px;max-width:240px;margin:0 auto;}

  /* --- Aperçu (miniature + bouton play) --- */
  .pourquoi .apercu-video{position:absolute;inset:0;z-index:3;display:none;background:#000;}
  .pourquoi .apercu-video.actif{display:block;}
  .pourquoi .apercu-image{width:100%;height:100%;object-fit:cover;display:block;opacity:.9;}
  .pourquoi .apercu-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:70px;height:48px;background:#ff0000;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);transition:transform .15s ease, background .15s ease;}
  .pourquoi .apercu-play:hover{background:#e60000;transform:translate(-50%,-50%) scale(1.07);}
  .pourquoi .apercu-play::before{content:"";border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent;margin-left:4px;}

  /* --- Colonne raisons --- */
  .raisons{padding:56px 48px;}
  .raisons h2{font-size:26px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
  .tag-expertise{display:inline-block;background:#0a0a0a;color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;margin:18px 0 26px;}
  .raison{display:flex;gap:18px;align-items:flex-start;margin-bottom:26px;}
  .raison:last-child{margin-bottom:0;}
  .raison-icone{flex:0 0 48px;height:48px;display:flex;align-items:center;justify-content:center;}
  .raison-icone svg{width:44px;height:44px;stroke:#1a1a1a;fill:none;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;}
  .raison-titre{font-size:14.5px;font-weight:700;}
  .raison-titre .chip{background:#0a0a0a;color:#fff;padding:1px 7px;}
  .raison-texte{font-size:13px;margin-top:4px;}

  @media (max-width:860px){
    .pourquoi-grille{grid-template-columns:1fr;}
    .raisons{padding:40px 24px;}
  }
`,
                components: `
<section class="pourquoi">
  <div class="pourquoi-grille">

    <div class="bloc-video" data-gjs-type="mtrv-video">
      <video class="video-apercu"></video>
      <iframe class="iframe-apercu" allowfullscreen></iframe>
      <div class="apercu-video">
        <img class="apercu-image" src="" alt="Aperçu de la vidéo">
        <div class="apercu-play"></div>
      </div>
      <div class="zone-choix">
        <div class="play-btn"></div>
        <p class="titre">Vidéo témoignage</p>
        <p class="hint-reglages">Cliquez ici, puis collez l&rsquo;URL de la vidéo dans l&rsquo;onglet «&nbsp;Réglages&nbsp;» de la barre latérale.</p>
      </div>
    </div>

    <div class="raisons">
      <h2>Pourquoi choisir notre école&nbsp;?</h2>
      <span class="tag-expertise">Expertise</span>
      <div class="raison">
        <div class="raison-icone"><svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <polygon points="24,10 44,18 24,26 4,18"/>
          <path d="M12 21.5 V31 c0,3 5.4,5.5 12,5.5 s12,-2.5 12,-5.5 V21.5"/>
          <line x1="44" y1="18" x2="44" y2="30"/>
          <circle cx="44" cy="32" r="1.6"/>
        </svg></div>
        <div>
          <p class="raison-titre">Une reconnaissance <span class="chip">académique</span></p>
          <p class="raison-texte">Certifications RNCP et double-diplômes avec 5 universités internationales</p>
        </div>
      </div>
      <div class="raison">
        <div class="raison-icone"><svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="14" r="4"/>
          <path d="M5 26 c0,-4 3,-6 7,-6 s7,2 7,6"/>
          <circle cx="36" cy="14" r="4"/>
          <path d="M29 26 c0,-4 3,-6 7,-6 s7,2 7,6"/>
          <circle cx="24" cy="32" r="4"/>
          <path d="M17 44 c0,-4 3,-6 7,-6 s7,2 7,6"/>
          <line x1="15" y1="18" x2="21" y2="28"/>
          <line x1="33" y1="18" x2="27" y2="28"/>
        </svg></div>
        <div>
          <p class="raison-titre"><span class="chip">Un réseau</span> de 30&nbsp;000 alumni</p>
          <p class="raison-texte">Puissant réseau d&rsquo;entraide en France et dans le monde entier</p>
        </div>
      </div>
      <div class="raison">
        <div class="raison-icone"><svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="15"/>
          <ellipse cx="24" cy="24" rx="7" ry="15"/>
          <line x1="9" y1="24" x2="39" y2="24"/>
          <path d="M11.5 15.5 c3.5,2.5 21.5,2.5 25,0"/>
          <path d="M11.5 32.5 c3.5,-2.5 21.5,-2.5 25,0"/>
          <circle cx="8" cy="10" r="3.4"/>
          <circle cx="40" cy="38" r="3.4"/>
        </svg></div>
        <div>
          <p class="raison-titre">Une ouverture <span class="chip">internationale</span></p>
          <p class="raison-texte">Cursus internationaux et échanges universitaires avec +100 partenaires</p>
        </div>
      </div>
    </div>

  </div>
</section>
`
            }
        }
    });
}
