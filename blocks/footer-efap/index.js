export default function(editor, categories) {
    editor.BlockManager.add('footer-efap', {
        label: 'EFAP Footer',
        category: categories.EFAP,
        content: `
            <footer class="footer-efap">
                <div class="efap-footer-container">
                    <div class="efap-footer-left-side">
                        <div class="efap-brand-top-row">
                            <div class="efap-logo-f">E|F|A|P</div>
                            <div class="efap-tagline-f">L'école des nouveaux métiers<br>de la communication</div>
                        </div>
                        <div class="efap-social-bottom-row">
                            <a href="#" class="efap-social-item"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.366-.333 2.633-1.308 3.608-.975.975-2.242 1.245-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.063-2.633-.333-3.608-1.308-.975-.975-1.245-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.35.061-2.68.327-3.684 1.332C2.364 2.409 2.098 3.739 2.037 5.088 1.979 6.368 1.965 6.776 1.965 10.035s.014 3.667.072 4.947c.061 1.35.327 2.68 1.332 3.684 1.004 1.004 2.335 1.27 3.684 1.332 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.35-.061 2.68-.327 3.684-1.332 1.004-1.004 1.27-2.335 1.332-3.684.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.061-1.35-.327-2.68-1.332-3.684-1.004-1.004-2.335-1.27-3.684-1.332-1.28-.058-1.688-.072-4.947-.072zM12 4.878a5.157 5.157 0 100 10.314 5.157 5.157 0 000-10.314zm0 8.541a3.384 3.384 0 110-6.768 3.384 3.384 0 010 6.768zm7.541-8.541a1.206 1.206 0 11-2.412 0 1.206 1.206 0 012.412 0z"/></svg></a>
                            <a href="#" class="efap-social-item"><svg viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg></a>
                            <a href="#" class="efap-social-item"><svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>
                            <a href="#" class="efap-social-item"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505a3.017 3.017 0 00-2.122 2.136C0 8.055 0 12 0 12s0 3.945.501 5.814a3.017 3.017 0 002.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.945 24 12 24 12s0-3.945-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
                            <a href="#" class="efap-social-item"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.032 2.62-.019 3.93-.006.156 5.225 4.056 5.59 5.535 5.893v3.916c-2.8-.127-5.232-1.416-6.037-3.213-.017 4.77-.031 9.542-.044 14.313-.157 8.164-11.412 8.503-12.32 1.032-.602-4.856 3.349-8.127 7.973-7.188 0 1.5.001 3.001.002 4.502-2.733-.581-5.124.837-4.746 3.227.621 2.358 4.83 2.461 5.427-.493.18-7.76.115-15.525.05-23.287l.23-.7z"/></svg></a>
                        </div>
                    </div>
                    <div class="efap-footer-right-side">
                        <p class="efap-legal-t">
                            L'EFAP collecte vos données afin de vous adresser de la documentation. Si vous le souhaitez, nous collectons également vos données afin de vous adresser des emails commerciaux. Pour en savoir plus sur le traitement de vos données et pour exercer vos droits, nous vous invitons à consulter la <a href="#" class="efap-legal-l">Politique de confidentialité</a>.
                        </p>
                    </div>
                </div>
                <div class="efap-back-to-top-container">
                    <button class="efap-btt-btn"><svg viewBox="0 0 24 24" width="24" height="24" fill="black"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg></button>
                </div>
            </footer>
            <style>
                .footer-efap {
                    background-color: #1a1a1a;
                    padding: 50px 40px;
                    color: #ffffff;
                    font-family: 'Georgia', serif;
                    position: relative;
                }
                .efap-footer-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    max-width: 1200px;
                    margin: 0 auto;
                    gap: 60px;
                }
                .efap-footer-left-side {
                    display: flex;
                    flex-direction: column;
                }
                .efap-brand-top-row {
                    display: flex;
                    align-items: center;
                    gap: 25px;
                    margin-bottom: 25px;
                }
                .efap-logo-f {
                    font-size: 26px;
                    letter-spacing: 10px;
                    font-weight: 400;
                    white-space: nowrap;
                }
                .efap-tagline-f {
                    font-size: 11px;
                    line-height: 1.4;
                    opacity: 0.9;
                }
                .efap-social-bottom-row {
                    display: flex;
                    gap: 12px;
                }
                .efap-social-item {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: #e2e8f0; /* Bleu-gris clair */
                    border-radius: 50%;
                }
                .efap-social-item svg {
                    width: 18px;
                    height: 18px;
                    fill: #1a1a1a; /* Icônes noires */
                }
                .efap-footer-right-side {
                    flex: 1;
                    max-width: 480px;
                }
                .efap-legal-t {
                    font-size: 10px;
                    line-height: 1.8;
                    color: rgba(255,255,255,0.7);
                    text-align: right;
                }
                .efap-legal-l {
                    color: #ffffff;
                    text-decoration: underline;
                }
                .efap-back-to-top-container {
                    display: none;
                    position: absolute;
                    bottom: 30px;
                    right: 30px;
                    z-index: 10;
                }
                .efap-btt-btn {
                    width: 44px;
                    height: 44px;
                    background-color: #ffffff;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                }
                @media (max-width: 768px) {
                    .efap-footer-container {
                        flex-direction: column;
                        gap: 40px;
                    }
                    .efap-footer-left-side { order: 2; }
                    .efap-footer-right-side { order: 1; }
                    .efap-brand-top-row {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 15px;
                    }
                    .efap-legal-t {
                        text-align: left;
                    }
                    .efap-back-to-top-container {
                        display: block;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b3' }
    });
}
