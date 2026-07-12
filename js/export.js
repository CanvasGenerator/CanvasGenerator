export function initExport(editor) {
    const exportHtml = document.getElementById('export-html');
    const exportJson = document.getElementById('export-json');
    const exportZip = document.getElementById('export-zip');

    // Récupère le CSS @font-face (Gotham, Space Grotesk) et réécrit les URLs
    // relatives en absolues (origin) pour que les fonts se chargent dans le
    // fichier exporté. Mis en cache après le premier fetch.
    let _fontCssCache = null;
    async function getFontFaceCss() {
        if (_fontCssCache != null) return _fontCssCache;
        try {
            const res = await fetch('css/fonts.css');
            let css = await res.text();
            // url('../assets/fonts/...') → url('https://origin/assets/fonts/...')
            css = css.replace(/url\((['"]?)\.\.\/assets\//g, `url($1${location.origin}/assets/`);
            _fontCssCache = css;
        } catch (e) {
            console.warn('Export : impossible de charger css/fonts.css', e);
            _fontCssCache = '';
        }
        return _fontCssCache;
    }

    exportHtml.onclick = async (e) => {
        e.preventDefault();
        const html = editor.getHtml();
        const css = editor.getCss();
        const fontCss = await getFontFaceCss();
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Lato:wght@400;700;900&family=Montserrat:wght@400;600;800&family=Open+Sans:wght@400;600;800&family=Oswald:wght@400;700&family=Poppins:wght@400;600;800&family=Raleway:wght@400;700&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet">
    <style>${fontCss}</style>
    <style>${css}</style>
</head>
<body>${html}</body>
</html>`;
        downloadFile('project.html', fullHtml, 'text/html');
    };

    exportJson.onclick = (e) => {
        e.preventDefault();
        const json = JSON.stringify(editor.getProjectData(), null, 2);
        downloadFile('project.json', json, 'application/json');
    };

    exportZip.onclick = async (e) => {
        e.preventDefault();
        const zip = new JSZip();
        const html = editor.getHtml();
        const css = editor.getCss();
        const json = JSON.stringify(editor.getProjectData(), null, 2);
        const fontCss = await getFontFaceCss();

        zip.file("index.html", `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Lato:wght@400;700;900&family=Montserrat:wght@400;600;800&family=Open+Sans:wght@400;600;800&family=Oswald:wght@400;700&family=Poppins:wght@400;600;800&family=Raleway:wght@400;700&family=Roboto:wght@400;700;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="fonts.css"><link rel="stylesheet" href="style.css"></head><body>${html}</body></html>`);
        zip.file("fonts.css", fontCss);
        zip.file("style.css", css);
        zip.file("project.json", json);

        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, "production-template.zip");
    };

    function downloadFile(filename, content, type) {
        const blob = new Blob([content], { type });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
}
