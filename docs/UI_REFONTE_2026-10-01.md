# Refonte de l’interface — 1er octobre 2026

## Direction graphique

Le portail utilise une identité Phish & Chips : bleu nuit, papier clair, ambre et titres décalés. Navigation, boutons, formulaires et cartes utilisent la même couche de présentation. Le mode sombre conserve la préférence existante et reste commun aux pages.

La messagerie est contenue dans sa propre fenêtre pendant la partie. Elle conserve Outlook et l’alternative Classique, indépendamment des couleurs du portail. Les commandes agrandissent/restaurent le jeu ou ouvrent une confirmation de sortie. La réception marque le vrai mail en cours au-dessus des mails de décor.

## Disposition des pages

| Page | Changements |
| --- | --- |
| Connexion | Présentation et formulaire séparés. Connexion et inscription dans deux formulaires distincts. Premier admin proposé seulement si aucun administrateur n’existe ; Microsoft seul en mode Entra. |
| Entraînement | Carte compacte, équipe actuelle et lien de changement, difficultés avec leurs durées. |
| Mail | Actions sur leur propre ligne, De/Sujet sur toute la largeur du lecteur, compteur et sécurité compacts sur mobile. Statistiques détaillées dans le panneau sur ordinateur. |
| Feedback | Verdict explicite, explications en premier, intitulés techniques repliables, SOS restant et illustration contenue à côté du texte ou en portrait sur mobile. |
| Résultat | Score et mode regroupés ; recommencer et débrief accessibles avant le cylindre. Profil et classements indépendants des nouveaux badges. |
| Battles | Filtre en cours/à venir/terminées, règles lisibles, dates sans secondes, tentatives restantes. |
| Équipes | Affectation actuelle, changement validé seulement lorsque le choix diffère, historique consultable. Recommandations et choix libre conservés. |
| Classements | Joueurs/équipes et période séparés, difficulté commune, ligne du joueur repérée, détail d’équipe au clavier, CSV conservé. |
| Profil | 85 badges regroupés en 24 familles. Paliers ouverts à la demande, filtres obtenus/à débloquer et catégories, dernières acquisitions. Conditions inchangées. |
| Administration | Rubriques équipes/battles/modération/annuaire/statistiques. Listes avant les formulaires de création, participants recherchables avec cases à cocher, aperçu de sélection et correction avant/après. |
| Statistiques | Compte commun, suppression de l’ancien formulaire à secret admin, couleurs du portail et tableaux conservés. |
| Débrief | Décisions traduites, expéditeur visible et état vide explicite. |

Les noms, phrases et seuils des 19 rangs approuvés sont conservés. Le ton sarcastique reste présent. Règles de session, affectations historiques, formules de classement et permissions serveur restent inchangées.

## Vérifications effectuées

- Syntaxe JavaScript : API et interface vérifiées.
- Suite Node/PostgreSQL : **13 tests réussis**. Vérification ajoutée de l’amorçage disponible avant création de l’admin puis indisponible après.
- Navigateur sur Docker jetable avec deux comptes fictifs : connexion, filtres de badges et paliers, participants et publication de battle, filtre d’état, équipe et bouton de changement, filtres de classements et détail au clavier, correction auditée fictive, statistiques, démarrage/fin de partie et SOS.
- Rendu examiné à **360 × 800**, **1057 × 748** et **1794 × 889**, en clair/sombre et Outlook/Classique. Contrôle de la lecture, des champs longs, du cylindre et des confirmations.
- Profil : **85 variantes présentes dans 24 familles**, sans suppression des badges verrouillés.
- Captures des fixtures de test : [jeu ordinateur](audits/2026-09-30/jeu-desktop.png), [jeu mobile](audits/2026-09-30/jeu-mobile.png), [SOS ordinateur](audits/2026-09-30/sos-desktop.png).

Les données de la démonstration utilisateur n’ont pas servi de fixtures et n’ont pas été modifiées. L’API Docker locale a été reconstruite pour exposer le nouvel indicateur d’amorçage.

## Organisation du code et limites

- portal.css porte les couleurs et composants communs, ainsi que l’intégration du jeu hérité.
- appearance.js gère la préférence claire/sombre ; account.js construit la navigation et les confirmations.
- L’ancien lien admin.html redirige vers la rubrique Équipes.
- GET /api/auth/config expose bootstrapAvailable ; la création du premier admin reste contrôlée par le serveur.

Microsoft Entra/Graph doit toujours être validé dans le tenant réel. Le mode local reste sans récupération de mot de passe. La validation navigateur ne remplace pas cette vérification d’intégration.
