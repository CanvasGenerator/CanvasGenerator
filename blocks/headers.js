export default function(editor, categories) {
    const schools = [
        {
            id: 'header-brassart',
            label: 'BRASSART Header',
            category: categories.BRASSART,
            prefix: 'header-brassart',
            logo: 'BRASSART',
            tagline: "L'école des métiers<br>de la création",
            logoColor: '#BE0D5C',
            taglineColor: '#BE0D5C'
        },
        {
            id: 'header-efap',
            label: 'EFAP Header',
            category: categories.EFAP,
            prefix: 'header-efap',
            logo: 'EFAP',
            tagline: "L'école des nouveaux métiers<br>de la communication",
            logoColor: '#C8102E',
            taglineColor: '#C8102E'
        },
        {
            id: 'header-icart',
            label: 'ICART Header',
            category: categories.ICART,
            prefix: 'header-icart',
            logo: 'ICART',
            tagline: "Management culturel<br>& Marché de l'art",
            logoColor: '#E35111',
            taglineColor: '#E35111'
        },
        {
            id: 'header-efj',
            label: 'EFJ Header',
            category: categories.EFJ,
            prefix: 'header-efj',
            logo: 'EFJ',
            tagline: "École française<br>de journalisme",
            logoColor: '#006A71',
            taglineColor: '#006A71'
        },
        {
            id: 'header-mopa',
            label: 'MoPA Header',
            category: categories.MOPA,
            prefix: 'header-mopa',
            logo: 'MoPA',
            tagline: "École de cinéma<br>d'animation 3D",
            logoColor: '#FFEF4A',
            taglineColor: '#FFEF4A'
        },
        {
            id: 'header-cread',
            label: 'CREAD Header',
            category: categories.CREAD,
            prefix: 'header-cread',
            logo: 'CREAD',
            tagline: "Architecture<br>& Décoration intérieure",
            logoColor: '#4D408E',
            taglineColor: '#4D408E'
        },
        {
            id: 'header-esec',
            label: 'ÉSEC Header',
            category: categories.ESEC,
            prefix: 'header-esec',
            logo: 'ÉSEC',
            tagline: "École des métiers<br>du cinéma",
            logoColor: '#E30613',
            taglineColor: '#E30613'
        },
        {
            id: 'header-3wa',
            label: '3W Academy Header',
            category: categories['3WA'],
            prefix: 'header-3wa',
            logo: '3W Academy',
            tagline: "Code, cybersécurité<br>& intelligence artificielle",
            logoColor: '#E30613',
            taglineColor: '#E30613'
        },
        {
            id: 'header-ifa',
            label: 'IFA Paris Header',
            category: categories.IFA,
            prefix: 'header-ifa',
            logo: 'IFA Paris',
            tagline: "Mode & Marketing<br>de la Mode",
            logoColor: '#F10091',
            taglineColor: '#F10091'
        },
        {
            id: 'header-bleue',
            label: 'Ecole Bleue Header',
            category: categories.BLEUE,
            prefix: 'header-bleue',
            logo: 'ECOLE BLEUE',
            tagline: "Architecture intérieure<br>& Design",
            logoColor: '#00003F',
            taglineColor: '#00003F'
        },
        {
            id: 'header-cesine',
            label: 'Cesine Header',
            category: categories.CESINE,
            prefix: 'header-cesine',
            logo: 'CESINE',
            tagline: "Design, Periodismo<br>& Publicidad",
            logoColor: '#547E8A',
            taglineColor: '#547E8A'
        },
        {
            id: 'header-creanavarra',
            label: 'Creanavarra Header',
            category: categories.CREANAVARRA,
            prefix: 'header-creanavarra',
            logo: 'Creanavarra',
            tagline: "Centro Superior de Diseño<br>& Artes Visuales",
            logoColor: '#0000D1',
            taglineColor: '#0000D1'
        },
        {
            id: 'header-miami',
            label: 'Miami Ad School Header',
            category: categories.MIAMI,
            prefix: 'header-miami',
            logo: 'Miami Ad School',
            tagline: "Creative Agency School<br>& Portfolio Program",
            logoColor: '#9D1F72',
            taglineColor: '#9D1F72'
        }
    ];

    schools.forEach(school => {
        editor.BlockManager.add(school.id, {
            label: school.label,
            category: school.category || 'Headers',
            content: `
                <header class="${school.prefix}">
                    <div class="logo-group">
                        <div class="logo-text">${school.logo}</div>
                        <div class="header-tagline">
                            ${school.tagline}
                        </div>
                    </div>
                </header>
                <style>
                    .${school.prefix} {
                        background-color: #ffffff;
                        padding: 20px 0;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        font-family: 'Inter', sans-serif;
                        border-bottom: 1px solid #f0f0f0;
                        width: 100%;
                    }
                    .${school.prefix} .logo-group {
                        display: flex;
                        flex-direction: column;
                        margin-left: 120px;
                    }
                    .${school.prefix} .logo-text {
                        font-family: Arial Black, Arial, Helvetica, sans-serif;
                        font-size: 32px;
                        font-weight: 900;
                        color: ${school.logoColor};
                        line-height: 1;
                        margin-bottom: 5px;
                    }
                    .${school.prefix} .header-tagline {
                        font-size: 11px;
                        line-height: 1.2;
                        color: ${school.taglineColor};
                        font-weight: 500;
                    }
                    @media (max-width: 768px) {
                        .${school.prefix} .logo-group {
                            margin-left: 40px;
                        }
                        .${school.prefix} .logo-text {
                            font-size: 24px;
                        }
                    }
                </style>
            `,
            attributes: { class: 'gjs-fonts gjs-f-b1' }
        });
    });
}
