# Livraison · formats de jeu et chronos

## Comportement livré

- Classique : Facile 60 s fixes ; Normal 60 → 35 s ; Difficile 45 → 25 s. La baisse de 2 s dépend uniquement des bonnes classifications humaines. Bonus de lecture 0/10/20 s selon 0–50 / 51–70 / 71+ mots du corps visible. Score, quota SOS et limite de trois erreurs préservés.
- Découverte : aucune échéance, aucun score ou classement, erreurs illimitées, réponses et statistiques pédagogiques distinctes.
- Contre-la-montre : 300/600 secondes globales, deux pénalités, erreurs illimitées, aucun SOS, scores négatifs. Le temps continue pendant les corrections, les transitions et la fermeture du navigateur. Reprise sans délai supplémentaire ; clôture automatique côté serveur.
- Hall of Fame, périodes, exports et profils distincts par format et combinaison. Moyenne d’équipe limitée aux dix meilleurs joueurs de la même configuration. Meilleurs scores négatifs conservés. Les noms des compétitions du dossier personnel sont visibles uniquement par le propriétaire du profil.
- Modération tracée : scores négatifs seulement en Contre-la-montre, bornes dépendant du format ; aucune attribution involontaire de badge ou rang classique.

## Décisions techniques et migration

Le moteur reste unique dans les routes de sessions existantes. La migration 006 ajoute les champs de format, les règles de chrono versionnées, les échéances globales et les compteurs humains, sans supprimer les données.

Une session ou battle existante garde la version 1 et son délai commencé. Les nouvelles utilisent la version 2. Les historiques vérifiés v1 restent éligibles selon leurs règles d’origine, y compris leurs règles historiques d’abandon ; les nouveaux abandons n’entrent pas dans les records. La version 0 ne devient pas fiable rétroactivement.

Les réponses sont protégées par authentification, jeton de partie, verrou de session et cache idempotent. Le score et le délai proviennent du serveur. Les sessions Contre-la-montre sont clôturées par un worker et lors de leur consultation, même sans action du joueur à l’instant zéro. Un redémarrage n’accorde pas de temps supplémentaire.

Le stockage local du navigateur ne contient qu’un identifiant de reprise ; il est vérifié contre le compte connecté. Les quatre configurations ont chacune leur propre reprise. Le client synchronise aussi l’horloge globale pendant la partie et au retour de visibilité ; une expiration de connexion invite à se reconnecter sans effacer la tentative.

Le client entreprise est frontend/, servi avec l’API backend/. Les anciennes démonstrations autonomes (racine, OnePageVersion et docs/index.html) restent des archives et ne deviennent pas un second moteur du nouveau module.

## Vérification

Commandes exécutées sur bases jetables dédiées, sans modification des données de l’application utilisateur :

- Dans backend : npm run check — syntaxe de l’API et de l’interface valide.
- Dans backend, TEST_DATABASE_URL vers phishchips_test sur 127.0.0.1:15433 : npm test — **33 tests réussis, zéro échec**.
- Images construites : docker build -t phishchipsbattle-formats-api:ci-local ./backend et docker build -t phishchipsbattle-formats-frontend:ci-local ./frontend.
- À la racine, IMAGE_PREFIX=phishchipsbattle-formats et IMAGE_TAG=ci-local : node scripts/smoke-images.mjs — assets, CSP, proxy Nginx/API, migrations et contrôles de santé validés sur une nouvelle base.

Les tests couvrent notamment : seuils de longueur, baisse et planchers, SOS, troisième erreur classique, migration et délai historique conservés, Découverte sans points, quatre configurations, pénalités cumulées, scores négatifs, réponses concurrentes, reprise, expiration sans interaction, absence de classement sans mail traité, départage, moyenne du top 10 négatif, modération signée, profils séparés et génération CSV.

Parcours navigateur vérifiés : préparation et démarrage, changement de durée et difficulté avec exemple et Hall of Fame correspondants, absence de SOS en Contre-la-montre, correction avec chrono actif, reprise avec temps restant, résultat expiré après reconnexion, accès au dernier résultat depuis la préparation, Découverte sans chrono/score et fin pédagogique. Le dossier personnel sépare les compétitions, les quatre configurations Contre-la-montre et la Découverte ; le filtre administratif 10 min / Difficile affiche correctement sa moyenne négative. Le CSV est vérifié en exécutant la vraie fonction d’export dans les tests, avec score et moyenne négatifs et neutralisation des formules dans les noms.

## Périmètre

Aucun bloc fonctionnel du PRD n’est reporté. Restent volontairement hors périmètre : battles événementielles Contre-la-montre, nouveaux badges dédiés, modification des prompts ou du JSON des mails, limitation des réessais, pénalités en secondes et obligation d’attendre la clôture pour voir les corrections.

Les changements sont préparés sur main ; aucun commit ou push n’est effectué dans cette livraison.

## Fichiers

- DEV_BOOK.md
- README.md
- backend/src/app.js
- backend/src/db/migrations/006_game_formats.sql
- backend/src/lib/http.js
- backend/src/routes/admin.js
- backend/src/routes/adminEnterprise.js
- backend/src/routes/battles.js
- backend/src/routes/players.js
- backend/src/routes/scores.js
- backend/src/routes/sessions.js
- backend/src/services/achievements.js
- backend/src/services/battles.js
- backend/src/services/gameRules.js
- backend/src/services/gameStats.js
- backend/src/services/timeAttackRankings.js
- backend/tests/enterprise.test.js
- backend/tests/game-rules.test.js
- backend/tests/migration.test.js
- backend/tests/score-csv.test.js
- docs/IMPLEMENTATION_MODES_CHRONOS.md
- frontend/account.js
- frontend/admin-stats.html
- frontend/admin-stats.js
- frontend/battles.html
- frontend/battles.js
- frontend/enterprise-admin.html
- frontend/enterprise-admin.js
- frontend/game-rules.js
- frontend/help.html
- frontend/phishing.html
- frontend/portal.css
- frontend/profile.html
- frontend/profile.js
- frontend/recap.js
- frontend/scores.html
- frontend/scores.js
- frontend/script.js
- frontend/time-attack.html
- frontend/time-attack.js
- scripts/smoke-images.mjs
