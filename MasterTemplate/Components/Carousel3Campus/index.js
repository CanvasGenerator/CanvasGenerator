export default function(editor, categories) {
    const cat = categories && categories.MASTER ? categories.MASTER : 'Master Template';

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* HTML d'une slide à partir d'un campus (contenu "bake" côté éditeur). */
    function slideHtml(c) {
        const name = escapeHtml(c.name || '');
        const address = escapeHtml(c.address || '');
        const img = escapeHtml(c.image_url || '');
        const link = (c.link || '').trim();
        const imgTag = `<img src="${img}" alt="${name}" class="mc3c-img">`;
        const media = link
            ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener" class="mc3c-media">${imgTag}<span class="mc3c-overlay-label">${name}</span></a>`
            : `<div class="mc3c-media">${imgTag}<span class="mc3c-overlay-label">${name}</span></div>`;
        return `<div class="mc3c-slide"><div class="mc3c-card">`
            + `<div class="mc3c-card-header"><span class="mc3c-badge">${name}</span><hr class="mc3c-line"></div>`
            + `<div class="mc3c-address">${address}</div>${media}</div></div>`;
    }

    function buildTrackHtml(campuses) {
        if (!campuses || !campuses.length) {
            return `<div class="mc3c-slide"><div class="mc3c-card"><div class="mc3c-address" style="text-align:center;padding:40px 0;color:#9ca3af;font-style:italic;">📍 Aucun campus sélectionné. Cliquez sur « Campus » dans la barre d'outils.</div></div></div>`;
        }
        return campuses.map(slideHtml).join('');
    }

    editor.BlockManager.add('master-carousel3-campus', {
        label: 'Carrousel 3 – Campus',
        category: cat,
        attributes: { class: 'fa fa-map-marker' },
        content: {
            type: 'mc3c-component',
            styles: `
                .mc3c-section { padding: 60px 20px; background: var(--brand-carousel, #f5f5f5); font-family: var(--brand-font, 'Inter', sans-serif); }
                .mc3c-container { max-width: 1100px; margin: 0 auto; overflow: hidden; }
                .mc3c-track { display: flex; transition: transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94); }

                .mc3c-slide { flex: 0 0 100%; box-sizing: border-box; }

                .mc3c-card { background: #f0f0f0; padding: 20px 20px 0 20px; }

                .mc3c-card-header { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }

                .mc3c-badge {
                    background-color: var(--brand-accent, var(--brand-primary, #c0175e));
                    color: #fff; font-size: 13px; font-weight: 700;
                    padding: 4px 12px; border-radius: 2px;
                    white-space: nowrap; flex-shrink: 0;
                }

                .mc3c-line { flex: 1; border: none; border-top: 1px solid #999; margin: 0; }

                .mc3c-address { font-size: 13px; color: var(--brand-text, #1a1a1a); margin-bottom: 14px; }

                .mc3c-media { position: relative; width: 100%; height: 280px; overflow: hidden; background: #d1d5db; display: block; }
                .mc3c-img { width: 100%; height: 100%; object-fit: cover; display: block; }

                .mc3c-overlay-label {
                    position: absolute; bottom: 16px; left: 16px;
                    color: #fff; font-size: 28px; font-weight: 700;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
                    pointer-events: none;
                }

                .mc3c-nav { text-align: center; margin-top: 24px; }

                .mc3c-prev, .mc3c-next {
                    width: 44px; height: 44px; border-radius: 50%;
                    border: 2px solid var(--brand-primary, #555); background: var(--brand-background, #ffffff);
                    cursor: pointer; font-size: 22px; margin: 0 5px;
                    color: var(--brand-text, #1a1a1a); display: inline-flex; align-items: center; justify-content: center;
                    transition: background 0.2s, color 0.2s, border-color 0.2s;
                }
                .mc3c-prev:hover, .mc3c-next:hover { background: var(--brand-primary, #333); color: #fff; border-color: var(--brand-primary, #333); }

                @media (max-width: 640px) {
                    .mc3c-container { max-width: 100%; overflow: hidden; }
                    .mc3c-media { height: 200px; }
                    .mc3c-overlay-label { font-size: 22px; }
                    .mc3c-line { display: none; }
                }
            `,
            components: [{
                tagName: 'section', classes: ['mc3c-section'],
                components: [
                    {
                        tagName: 'div', classes: ['mc3c-container'],
                        components: [{
                            tagName: 'div', classes: ['mc3c-track'],
                            components: []  // rempli dynamiquement par la vue
                        }]
                    },
                    {
                        tagName: 'div', classes: ['mc3c-nav'],
                        components: [
                            { tagName: 'button', classes: ['mc3c-prev'], selectable: true, components: '&#8249;' },
                            { tagName: 'button', classes: ['mc3c-next'], selectable: true, components: '&#8250;' }
                        ]
                    }
                ]
            }]
        }
    });

    editor.DomComponents.addType('mc3c-component', {
        isComponent(el) {
            return el.tagName === 'SECTION' && el.classList && el.classList.contains('mc3c-section');
        },
        model: { defaults: { 'script-props': [],
            /* Runtime (page exportée) : navigation + re-synchro progressive. */
            script: function() {
                var el = this;
                var track = el.querySelector('.mc3c-track');
                if (!track) return;

                function esc(s) {
                    return String(s == null ? '' : s)
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                }
                function slide(c) {
                    var name = esc(c.name || ''), address = esc(c.address || ''), img = esc(c.image_url || '');
                    var link = (c.link || '').trim();
                    var imgTag = '<img src="' + img + '" alt="' + name + '" class="mc3c-img">';
                    var media = link
                        ? '<a href="' + esc(link) + '" target="_blank" rel="noopener" class="mc3c-media">' + imgTag + '<span class="mc3c-overlay-label">' + name + '</span></a>'
                        : '<div class="mc3c-media">' + imgTag + '<span class="mc3c-overlay-label">' + name + '</span></div>';
                    return '<div class="mc3c-slide"><div class="mc3c-card"><div class="mc3c-card-header"><span class="mc3c-badge">' + name + '</span><hr class="mc3c-line"></div><div class="mc3c-address">' + address + '</div>' + media + '</div></div>';
                }

                function initNav() {
                    var next = el.querySelector('.mc3c-next');
                    var prev = el.querySelector('.mc3c-prev');
                    var idx = 0;
                    var total = track.children.length;
                    function go(i) {
                        if (!total) return;
                        idx = (i + total) % total;
                        track.style.transform = 'translateX(-' + (idx * 100) + '%)';
                    }
                    if (next) next.onclick = function() { go(idx + 1); };
                    if (prev) prev.onclick = function() { go(idx - 1); };
                }

                var ids = window.__LP_CAMPUS_IDS || [];
                var baseUrl = window.__LP_API_BASE || '';
                var school = window.__LP_SCHOOL || '';
                if (!school) { initNav(); return; } // pas d'école (ex. master) → garde le contenu bake
                fetch(baseUrl + '/api/campuses' + '?school=' + encodeURIComponent(school))
                    .then(function(r) { return r.json(); })
                    .then(function(all) {
                        if (!Array.isArray(all)) return;
                        var campuses = all;
                        if (ids && ids.length) {
                            var byId = {};
                            all.forEach(function(c) { byId[c.id] = c; });
                            campuses = ids.map(function(id) { return byId[id]; }).filter(Boolean);
                        }
                        if (campuses.length) track.innerHTML = campuses.map(slide).join('');
                    })
                    .catch(function() { /* garde le contenu bake */ })
                    .then(initNav, initNav);
            }
        }},

        view: {
            init() {
                this._onCampusChange = () => this.renderCampuses();
                document.addEventListener('lp:campuses-changed', this._onCampusChange);
                setTimeout(() => this.renderCampuses(), 0);
            },
            removed() {
                document.removeEventListener('lp:campuses-changed', this._onCampusChange);
            },
            renderCampuses() {
                const track = this.model.find('.mc3c-track')[0];
                if (!track) return;
                const campuses = (window.LPCampus && window.LPCampus.getResolvedCampuses)
                    ? window.LPCampus.getResolvedCampuses() : [];
                track.components(buildTrackHtml(campuses));
                const lock = (comp) => comp.components().each(child => {
                    child.set({ editable: false, selectable: false, hoverable: false, draggable: false, droppable: false });
                    lock(child);
                });
                lock(track);
            }
        }
    });
}
