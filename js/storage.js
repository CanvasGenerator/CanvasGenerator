export function initStorage(editor) {
    console.log('Storage initialized');
    
    // Auto-save logic is handled by GrapesJS core config, 
    // but we can add metadata tracking here.
    editor.on('storage:store', (data) => {
        const metadata = {
            name: 'POC Project',
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('efap-brassart-builder__metadata', JSON.stringify(metadata));
    });
}
