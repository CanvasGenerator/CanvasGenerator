# 🚀 Nouveautés et Fonctionnalités du Landing Page Generator

Ce document détaille les dernières fonctionnalités majeures ajoutées à l'application. L'objectif de ces mises à jour est de transformer un simple éditeur de pages en un outil complet, autonome et intelligent, parfaitement intégré à l'écosystème Salesforce Marketing Cloud (SFMC).

---

## 1. 🏗️ Sauvegarde de Composants Personnalisés (Custom Components)

**Le concept :** 
L'éditeur permettait déjà d'utiliser des blocs standards (titres, images, colonnes) et des blocs spécifiques par école. Désormais, l'utilisateur a la possibilité de créer et de sauvegarder ses propres composants sur mesure pour les réutiliser plus tard.

**Comment ça marche (Le Flux) :**
1. L'utilisateur assemble plusieurs éléments sur le canevas (ex: une section témoignage avec une image, un texte et une bordure spécifique) et applique ses styles.
2. Il clique sur le bouton **"Save Component"** (Sauvegarder le composant) situé dans la barre de navigation.
3. Une fenêtre lui demande le nom qu'il souhaite donner à ce bloc.
4. Le composant (HTML + CSS) est envoyé et sauvegardé de manière persistante dans la base de données **Supabase**.
5. Il apparaît alors instantanément dans le panneau de gauche (Block Manager), sous une catégorie dédiée (ex: *EFAP Components*). L'utilisateur peut dès lors le glisser-déposer sur n'importe quelle autre page !

---

## 2. 📝 Form Builder Intégré & Synchronisation SFMC

**Le concept :** 
Auparavant, la création de formulaires nécessitait des allers-retours complexes avec Salesforce Marketing Cloud. Nous avons intégré un constructeur de formulaire natif qui automatise toute la configuration backend.

**Comment ça marche (Le Flux) :**
1. L'utilisateur clique sur le bouton **"Forms"** pour ouvrir le panneau latéral dédié.
2. Il peut créer un nouveau formulaire en définissant les champs requis (Prénom, Nom, Email, Téléphone, etc.).
3. Lorsqu'il clique sur **Sauvegarder et Synchroniser**, l'application effectue deux actions majeures en arrière-plan via l'API :
   - **Création de la Data Extension :** Une table est automatiquement créée dans Salesforce Marketing Cloud pour recueillir les futures réponses des visiteurs.
   - **Génération de l'Asset :** Un bout de code (Code Snippet / Content Block) est généré et stocké dans le Content Builder de SFMC.
4. L'utilisateur n'a plus qu'à utiliser ce formulaire sur sa Landing Page, il est déjà branché et prêt à récolter de la donnée !

---

## 3. 🤖 Assistant Virtuel (Bot IA Intégré)

**Le concept :** 
L'intégration de l'intelligence artificielle (Gemini 2.5) directement dans l'interface pour assister le consultant marketing dans la création de son contenu.

**Comment ça marche (Le Flux) :**
1. Un bouton flottant **"IA"** est disponible en bas à droite de l'écran en permanence.
2. Au clic, une fenêtre de chat s'ouvre, à la manière de ChatGPT.
3. Le Bot est "contextualisé" : il sait automatiquement sur quelle école l'utilisateur est en train de travailler (ex: EFAP) et quel est son domaine (ex: Communication).
4. L'utilisateur peut lui demander de l'aide pour rédiger un paragraphe accrocheur, reformuler un texte, trouver une idée de Call-to-Action, ou même des conseils de structure de page, sans jamais avoir à quitter l'éditeur.

---

## 4. 🌍 Traduction Automatique Intégrée (Multilingue)

**Le concept :** 
Générer des déclinaisons multilingues d'une même page prenait un temps fou. L'application intègre désormais une fonctionnalité de traduction automatique qui préserve la mise en page.

**Comment ça marche (Le Flux) :**
- **Option A : Duplication d'un projet existant**
  1. Depuis le tableau de bord, l'utilisateur clique sur **Dupliquer** sur un projet existant.
  2. Il choisit l'option **"Traduire automatiquement (IA)"** et sélectionne la langue cible (ex: Anglais - EN).
  3. L'IA analyse le code de la page source, traduit tout le texte visible, mais conserve intactes les balises HTML, les classes CSS et les images.
  4. La nouvelle page est sauvegardée en tant que nouveau projet distinct (avec le suffixe de la langue).
  
- **Option B : Traduction à la volée d'un nouveau projet**
  1. L'utilisateur crée une page vierge et glisse des composants (souvent en français par défaut).
  2. Au moment de cliquer sur **Save Project**, il choisit "Espagnol (ES)" comme langue cible.
  3. L'application détecte que la langue souhaitée n'est pas le français, lance l'écran de chargement, traduit automatiquement l'intégralité du canevas en espagnol, met à jour l'affichage, et sauvegarde le projet.

---

## 5. ⚡ Refonte Complète de l'Expérience Utilisateur (UX)

**Le concept :** 
Rendre l'outil plus "SaaS", plus fluide et moins frustrant au quotidien.

**Comment ça marche (Le Flux) :**
- **Dashboard d'ouverture :** Fini la simple petite alerte. À l'ouverture, un véritable tableau de bord s'affiche avec la liste des projets récents, leur langue (via un badge visuel) et des boutons d'actions rapides (Modifier, Dupliquer).
- **Écrans de chargement non-bloquants :** Lors d'actions longues (comme la traduction par IA), l'interface affiche un *spinner* moderne qui empêche les clics parasites tout en informant l'utilisateur.
- **Workflow intelligent :** Si un utilisateur oublie de remplir un champ ou annule une action, le système le ramène proprement à l'écran précédent sans faire disparaître l'interface. À la fin d'une traduction, il a le choix immédiat entre *"Ouvrir la page traduite"* pour travailler dessus ou *"Fermer"* pour rester sur sa liste de projets.
