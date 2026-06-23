export default function(editor, categories) {
    editor.BlockManager.add('footer-brassart', {
        label: 'BRASSART Footer',
        category: categories.BRASSART,
        content: `
            <footer class="footer-brassart">
                <div class="brassart-footer-container">
                    <div class="brassart-footer-main-row">
                        <div class="brassart-footer-brand-group">
                            <div class="brassart-logo-footer">BRASSART</div>
                            <div class="brassart-footer-tagline">L'école des métiers<br>de la création</div>
                        </div>
                        <div class="brassart-footer-social-wrapper">
                            <a href="#" class="brassart-social-btn"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.332 3.608 1.308.975.975 1.245 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.063 1.366-.333 2.633-1.308 3.608-.975.975-2.242 1.245-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.063-2.633-.333-3.608-1.308-.975-.975-1.245-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.332-2.633 1.308-3.608.975-.975 2.242-1.245 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.35.061-2.68.327-3.684 1.332C2.364 2.409 2.098 3.739 2.037 5.088 1.979 6.368 1.965 6.776 1.965 10.035s.014 3.667.072 4.947c.061 1.35.327 2.68 1.332 3.684 1.004 1.004 2.335 1.27 3.684 1.332 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.35-.061 2.68-.327 3.684-1.332 1.004-1.004 1.27-2.335 1.332-3.684.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.061-1.35-.327-2.68-1.332-3.684-1.004-1.004-2.335-1.27-3.684-1.332-1.28-.058-1.688-.072-4.947-.072zM12 4.878a5.157 5.157 0 100 10.314 5.157 5.157 0 000-10.314zm0 8.541a3.384 3.384 0 110-6.768 3.384 3.384 0 010 6.768zm7.541-8.541a1.206 1.206 0 11-2.412 0 1.206 1.206 0 012.412 0z"/></svg></a>
                            <a href="#" class="brassart-social-btn"><svg viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg></a>
                            <a href="#" class="brassart-social-btn"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.134l4.713 6.231 5.397-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg></a>
                            <a href="#" class="brassart-social-btn"><svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>
                            <a href="#" class="brassart-social-btn"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505a3.017 3.017 0 00-2.122 2.136C0 8.055 0 12 0 12s0 3.945.501 5.814a3.017 3.017 0 002.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.945 24 12 24 12s0-3.945-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
                            <a href="#" class="brassart-social-btn"><svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.032 2.62-.019 3.93-.006.156 5.225 4.056 5.59 5.535 5.893v3.916c-2.8-.127-5.232-1.416-6.037-3.213-.017 4.77-.031 9.542-.044 14.313-.157 8.164-11.412 8.503-12.32 1.032-.602-4.856 3.349-8.127 7.973-7.188 0 1.5.001 3.001.002 4.502-2.733-.581-5.124.837-4.746 3.227.621 2.358 4.83 2.461 5.427-.493.18-7.76.115-15.525.05-23.287l.23-.7z"/></svg></a>
                        </div>
                    </div>
                    <div class="brassart-footer-legal-row">
                        <p class="brassart-legal-text">
                            BRASSART collecte vos données afin de vous adresser de la documentation. Si vous le souhaitez, nous collectons également vos données afin de vous adresser des emails commerciaux. Pour en savoir plus sur le traitement de vos données et pour exercer vos droits, nous vous invitons à consulter la <a href="#" class="brassart-legal-link">Politique de confidentialité</a>.
                        </p>
                    </div>
                </div>
            </footer>
            <style>
                .footer-brassart {
                    background-color: #ffffff;
                    padding: 60px 40px 40px 40px;
                    font-family: 'Inter', sans-serif;
                    border-top: 1px solid #f0f0f0;
                }
                .brassart-footer-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .brassart-footer-main-row {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    gap: 60px;
                    margin-bottom: 60px;
                }
                .brassart-footer-brand-group {
                    display: flex;
                    flex-direction: column;
                    text-align: left;
                }
                .brassart-logo-footer {
                    font-family: Arial Black, Arial, Helvetica, sans-serif;
                    font-size: 42px;
                    font-weight: 900;
                    color: #A8174F;
                    line-height: 1;
                    margin-bottom: 10px;
                    text-align: left;
                }
                .brassart-footer-tagline {
                    font-size: 13px;
                    color: #A8174F;
                    font-weight: 500;
                    line-height: 1.3;
                    text-align: left;
                }
                .brassart-footer-social-wrapper {
                    display: flex;
                    gap: 15px;
                    margin-top: 2px;
                }
                .brassart-social-btn {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #f5f5f5;
                    border-radius: 50%;
                }
                .brassart-social-btn svg {
                    width: 20px;
                    height: 20px;
                    fill: #A8174F;
                }
                .brassart-footer-legal-row {
                    border-top: 1px solid #f5f5f5;
                    padding-top: 30px;
                    text-align: center;
                }
                .brassart-legal-text {
                    font-size: 11px;
                    line-height: 1.8;
                    color: #999999;
                    max-width: 1000px;
                    margin: 0 auto;
                    text-align: center;
                }
                .brassart-legal-link {
                    color: #A8174F;
                    text-decoration: underline;
                }
                @media (max-width: 768px) {
                    .brassart-footer-main-row {
                        flex-direction: column;
                        align-items: center;
                        gap: 30px;
                        text-align: center;
                    }
                    .brassart-footer-brand-group {
                        text-align: center;
                    }
                    .brassart-logo-footer, .brassart-footer-tagline {
                        text-align: center;
                    }
                    .brassart-footer-social-wrapper {
                        justify-content: center;
                        margin-top: 0;
                    }
                }
            </style>
        `,
        attributes: { class: 'gjs-fonts gjs-f-b1' }
    });
}
