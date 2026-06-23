export function initExport(editor) {
    const exportHtml = document.getElementById('export-html');
    const exportJson = document.getElementById('export-json');
    const exportZip = document.getElementById('export-zip');

    exportHtml.onclick = (e) => {
        e.preventDefault();
        const html = editor.getHtml();
        const css = editor.getCss();
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
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

        zip.file("index.html", `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head><body>${html}</body></html>`);
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
