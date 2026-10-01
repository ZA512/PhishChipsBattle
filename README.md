# PhishChipsBattle

Jeu de sensibilisation au phishing pour l’entreprise : entraînement individuel, équipes choisies par les collaborateurs et battles organisées. API Node.js 24 / Express 5, PostgreSQL 16 et interface servie par Nginx.

La version Docker utilise exclusivement `frontend/` et `backend/`. Les fichiers de jeu à la racine proviennent de l’ancienne version standalone de [PhishChips](https://github.com/ZA512/PhishChips). Son catalogue public a été retiré ; les autres fichiers restent des références historiques.

## Déployer les images publiées — Unraid ou autre serveur

Le Compose principal télécharge deux images depuis **GitHub Container Registry** :

- ghcr.io/za512/phishchipsbattle-api
- ghcr.io/za512/phishchipsbattle-frontend (interface et configuration Nginx incluses)

Il ne contient aucun build ni montage des sources. Sur le NAS, seuls docker-compose.yml et .env sont nécessaires. PostgreSQL reste dans le volume db_data.

1. Attendre une publication réussie du workflow GitHub Actions sur la branche principale. Après la première publication, rendre les **deux packages publics** dans leurs paramètres GitHub pour permettre le téléchargement sans authentification. Sinon, connecter le NAS à GHCR avec un jeton disposant de read:packages.
2. Copier docker-compose.yml et créer .env à partir de .env.example, avec des secrets aléatoires propres au serveur. Ne pas copier des mots de passe d’exemple.
3. Pour une démo locale accessible sur le réseau, renseigner AUTH_MODE=local, FRONTEND_BIND_IP=0.0.0.0, FRONTEND_PORT et APP_URL avec l’adresse exacte du NAS (par exemple http://192.168.1.50:8080). Pour Entra, utiliser le domaine HTTPS du reverse proxy et la configuration décrite plus bas.
4. Dans Compose Manager, démarrer la stack, ou dans un terminal depuis son dossier :

```bash
docker compose pull
docker compose up -d --no-build --wait
```

Pour mettre à jour, reprendre ces deux commandes. Conserver le nom de la stack et le volume PostgreSQL existants. Ne pas supprimer le volume pour une mise à jour.

IMAGE_TAG=latest suit la dernière publication de la branche principale. Une version publiée via un tag Git tel que v1.2.3 peut être choisie avec IMAGE_TAG=v1.2.3 ; les builds par commit utilisent sha- suivi du SHA Git complet. Le même tag est utilisé pour les deux images. IMAGE_PREFIX permet d’utiliser les images d’un fork.

Le workflow effectue les tests API, construit les deux images, puis démarre le **Compose de déploiement sans build ni sources** pour vérifier les fichiers statiques, les en-têtes, le proxy API et la base. Après réussite, il publie linux/amd64 et linux/arm64. Les pull requests et les branches secondaires sont vérifiées sans publier. Un lancement manuel sur la branche principale est également disponible. Les alias latest/version sont promus après la construction réussie des deux images ; un ancien commit ne remplace pas latest si la branche a avancé.

Références : [publication GHCR avec GITHUB_TOKEN](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [visibilité et authentification GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Développer et essayer les sources localement

Docker doit être démarré. Depuis la racine, sous PowerShell :

```powershell
./scripts/setup-local.ps1
# Si .env existe déjà, cette commande le conserve et demande de le modifier explicitement.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

Ouvrir **http://localhost:8080/login.html**, avec la même origine que `APP_URL`. Le port reste accessible uniquement depuis la machine locale.

Pour le premier administrateur, remplir email, mot de passe personnel (12 à 128 caractères) et pseudo, puis ouvrir « Créer le premier administrateur local ». Le secret d’amorçage est la valeur `ADMIN_PASSWORD` du fichier `.env`. Cette création n’est possible qu’une fois. Le mot de passe personnel permet ensuite la connexion normale ; le secret d’amorçage n’est pas un accès aux API d’administration.

Depuis « Administration », créer les équipes et importer les scénarios dans l’onglet **Mails**. Une installation neuve ne contient aucun mail. Le premier administrateur peut accéder à cette page avant de choisir une équipe. Les comptes locaux servent à la démonstration et aux tests ; le déploiement entreprise utilise Entra.

Pour arrêter sans perdre les données : `docker compose -f docker-compose.yml -f docker-compose.dev.yml down`. Le volume PostgreSQL conserve les comptes et résultats. Ne pas ajouter `-v` si les données doivent être conservées.

## Catalogue privé de mails

L’onglet **Administration → Mails** permet de rechercher, consulter, sélectionner sur plusieurs pages, exporter et supprimer les scénarios, ou d’importer un fichier JSON / du JSON collé. Seuls les administrateurs peuvent lire le catalogue et ses corrections ; le rôle organisateur ne le permet pas.

Format : un tableau d’objets, ou `{ "schemaVersion": 1, "emails": [...] }` comme les exports. Champs requis : `sender`, `realSender`, `subject`, `body`, `type` (`safe` ou `phishing`), `clues` (tableau de textes). `usage` vaut `training`, `battle` ou `both` ; sans ce champ, le mail est réservé à l’entraînement. Les éventuels `id` externes sont ignorés : le serveur attribue ses identifiants. Le format des liens du prompt existant (`<a href='…' data-real-link='…'>…</a>`) reste compatible. Le corps est du texte avec ces liens simulés ; les balises HTML générales, images et fichiers ne sont pas exécutés ni chargés. Les liens ne naviguent pas vers Internet.

Limites : 5 000 mails actifs, 5 000 par import, 10 Mio par requête, 6 000 caractères par corps, 8 indices de 500 caractères maximum. Un phishing exige au moins un indice. Les noms, adresses et sujets sont limités à 300 caractères. Les lots volumineux doivent être divisés ; l’export d’une sélection permet de faire des lots. Le contrôle préalable vérifie la structure et annonce les ajouts, doublons et retraits ; il ne juge pas la véracité pédagogique des corrections.

**Remplacer tout le catalogue** retire les scénarios actifs et insère le lot dans une même transaction. Un import invalide ne modifie rien. Les doublons exacts d’un même import sont ignorés ; en mode ajout, les doublons exacts déjà actifs sont aussi ignorés. Changer le contenu, les indices ou l’utilisation crée un nouveau scénario : aucun mail historique n’est modifié en place.

**Supprimer** retire les mails des nouvelles sélections. Les copies en base restent archivées pour les parties déjà démarrées, les battles publiées et leurs récapitulatifs. Ce n’est pas une purge des données historiques. Les suppressions et imports sont journalisés avec leur auteur et leurs volumes. Un redémarrage ne remet jamais l’ancien catalogue. La migration conserve les mails d’une installation existante avec l’utilisation « Les deux » ; pour remplacer l’ancien catalogue public, utiliser l’import avec remplacement. Aucun effacement automatique des données existantes n’est effectué.

Pour une compétition, importer des mails **Battle** différents de ceux d’entraînement. Les corrections sont encore retournées après chaque réponse en battle : cette séparation empêche de les collecter en entraînement, mais n’empêche pas leur partage entre participants pendant la compétition. Le report des corrections à la clôture reste une évolution distincte. Les nouvelles parties d’entraînement prennent au maximum 162 mails aléatoires ; les battles restent limitées à 162, pour conserver l’échelle des rangs.

Ne pas versionner les fichiers d’import/export privés. Les anciens scénarios restent consultables dans l’historique Git et les anciennes images : leur suppression du code ne les rend pas secrets. Les fixtures dans `backend/tests/mail-fixtures.js` sont synthétiques, ne sont pas embarquées dans l’image API et ne sont jamais utilisées en production.

L’[analyse pédagogique du catalogue](docs/ANALYSE_MAILS_2026-10-01.md) décrit les techniques couvertes, les limites et les évolutions proposées. Aucun nouveau lot de mails pédagogiques n’est livré à cette étape.

Le [prompt français](prompt.txt) et sa [version anglaise](prompt-en.txt) demandent par défaut 20 mails équilibrés, des familles variées et des pièges décelables avec les éléments visibles ou inspectables dans le jeu. Format standard : 35 à 80 mots, avec quelques mails plus courts ; demander un lot « express » pour les lectures rapides. Le prompt exclut les compromissions invisibles, les verdicts ambigus et les mécaniques pas encore prises en charge (QR, pièces jointes réelles, étapes après clic).

Les nouveaux lots utilisent exactement deux textes dans `clues` : **« À repérer : … »** pour un phishing ou **« Ce qui concorde : … »** pour un légitime, puis **« Le bon réflexe : … »**. L’explication cite un fait accessible et propose une action, sans catégorie technique imposée. Le jeu et le récapitulatif affichent ces deux blocs. Les anciennes catégories restent compatibles, avec des intitulés courants et les noms techniques repliés ; le texte des corrections historiques n’est pas réécrit automatiquement. La vérification d’import valide la structure, pas l’équilibre, la longueur en mots ou la qualité pédagogique : relire chaque lot avant une compétition.

## Équipes et nouveaux arrivants

Les équipes vivent **en base**, avec un nom et un code unique, et sont gérées dans l’administration. Il n’y a pas de liste à maintenir dans `.env`.

À la connexion, une personne sans équipe reçoit une proposition :

1. L’équipe la plus représentée parmi les collègues actifs ayant le même manager.
2. En cas d’absence de collègues affectés ou d’égalité, l’équipe du manager actif.
3. Sinon, aucune préconisation : la personne choisit dans la liste.

La personne confirme son choix et peut le modifier librement depuis « Équipes ». L’organigramme, les intitulés de poste et les remplacements de managers ne déplacent jamais une affectation déjà choisie. Sans annuaire importé ou synchronisé, le choix reste disponible sans recommandation.

La suppression d’une équipe l’archive, retire les affectations actuelles et demande un nouveau choix à la prochaine ouverture d’une page de jeu, y compris avec une session de connexion existante. Les anciennes parties et les battles conservent leurs équipes enregistrées. Le code d’une équipe archivée reste réservé pour préserver son identité historique ; une nouvelle équipe reçoit un nouveau code.

## Battles

L’administrateur ou l’organisateur publie une compétition : individuelle avec des participants sélectionnés, individuelle dans une équipe, ou entre plusieurs équipes. Il fixe début, fin, difficulté, nombre d’emails, tentatives (1 à 5) et jokers (0 à 3).

**La publication fige les joueurs déjà inscrits et leurs équipes**, même si le début est ultérieur. Les nouveaux arrivants participeront aux prochaines battles. Chaque participant reçoit la même sélection et le même ordre d’emails. Reprendre une tentative en cours renouvelle son accès sans consommer une tentative supplémentaire ni remettre le chrono à zéro.

Le classement individuel retient le meilleur score valide, puis le temps de décision cumulé, l’heure de fin et l’identifiant en cas d’égalité. Une battle entre équipes utilise la moyenne du meilleur score de **tous les inscrits** ; un absent ou un participant disqualifié compte pour zéro. Le taux de participation est affiché. Ces classements sont séparés du classement d’entraînement (top 10 par équipe).

À l’échéance, les nouvelles réponses sont refusées. La consultation des résultats clôture et enregistre le classement ; l’organisateur peut aussi clôturer plus tôt. Les essais en cours sont alors terminés avec leurs points acquis. Une correction administrative ultérieure peut mettre à jour ces résultats, avec un historique.

Le chrono, le nombre de jokers, l’identité et les points sont contrôlés par le serveur. Ces contrôles n’empêchent pas le partage de réponses ou la mémorisation des emails d’entraînement.

## Administration et scores

- **Joueur** : jouer, choisir son équipe, consulter classements et profils internes.
- **Organisateur** : publier et clôturer des battles.
- **Administrateur** : gérer les équipes et l’annuaire, consulter les statistiques, corriger ou disqualifier une partie terminée.

Une correction exige un motif, conserve acteur/date/ancien et nouveau score, et refuse une modification fondée sur une version périmée. Une disqualification exclut la partie des classements et des statistiques. Les réponses restent conservées pour le récapitulatif pédagogique. Les badges déjà obtenus ne sont pas révoqués automatiquement par une correction.

Le taux de réussite et le temps de décision pédagogique distinguent les réponses humaines des jokers. Les 85 badges du catalogue comprennent désormais des seuils atteignables ; les badges de classement signalent une place atteinte à la fin d’une partie, pas une victoire définitivement attribuée en fin de mois.

## Configurer Microsoft Entra ID

1. Créer une inscription d’application **mono-tenant**, plateforme Web, avec l’URI de redirection exacte `https://votre-domaine/api/auth/entra/callback` (ou `http://localhost:8080/api/auth/entra/callback` en développement).
2. Renseigner `.env` : `AUTH_MODE=entra`, `APP_URL`, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` et `ENTRA_CLIENT_SECRET`. Conserver un `JWT_SECRET` aléatoire. Entra exige HTTPS hors localhost.
3. Définir les rôles d’application `PhishChips.Admin` et `PhishChips.Organizer` et les attribuer aux personnes ou groupes concernés. Sans rôle, un compte obtient les droits joueur. Restreindre les utilisateurs autorisés depuis l’application d’entreprise Entra.
4. Pour la synchronisation d’annuaire, ajouter la permission **applicative** Microsoft Graph `User.Read.All` avec consentement administrateur. Vérifier dans le tenant la récupération des managers via la requête `/users?$expand=manager($select=id)` utilisée par le projet. L’import JSON complet reste disponible si cette lecture n’est pas accordée ou compatible.
5. Relancer `docker compose up -d --no-build --wait`, puis tester un joueur, un organisateur et un administrateur réels. En développement, utiliser aussi le fichier docker-compose.dev.yml et --build.

Le SSO utilise le flux code avec PKCE, état lié au navigateur, nonce et validation de signature, audience, émetteur et tenant. L’identité est liée à l’identifiant Entra `oid`, jamais à un email saisi. Le SSO et Graph sont implémentés ; **la validation avec un tenant réel reste à effectuer**.

Pour un déploiement derrière un proxy HTTPS, garder interface et API sur une seule origine, adapter le proxy et `TRUST_PROXY`, et vérifier les adresses clientes. Le Nginx fourni remplace l’en-tête d’adresse transmis par son client direct ; derrière un autre proxy, configurer explicitement la chaîne de confiance et la restitution de l’IP réelle. Prévoir sauvegardes PostgreSQL et rotation du secret Entra selon vos procédures.

Références officielles : [flux code Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [rôles d’application](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps), [liste des utilisateurs Graph](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0), [lecture du manager](https://learn.microsoft.com/en-us/graph/api/user-list-manager?view=graph-rest-1.0).

## Reprendre une ancienne base

La migration `003_enterprise.sql` est automatique et transactionnelle. Elle conserve les données, rend les pseudos uniques sans perdre les comptes, et ajoute comptes authentifiés, affectations historiques, battles et modération.

Les anciennes parties portent `rules_version=0` : leurs scores restent en base mais sont exclus des nouveaux classements vérifiés. L’ancien logiciel ne mémorisait pas l’équipe au moment d’une partie ; la migration reprend donc l’équipe présente au moment de la migration, sans prétendre reconstruire les changements antérieurs. Un ancien compte créé avec un simple pseudo/email n’est jamais revendiqué automatiquement par un compte Entra ou une inscription locale.

Faire une sauvegarde avant la migration d’une base utilisée. Le rapprochement d’anciens comptes avec des identités vérifiées reste à développer. L’import/remplacement administratif retire les mails du catalogue sans supprimer les références nécessaires aux réponses passées.

## Vérifications

La suite utilise une base **jetable et dédiée**, dont le nom finit par `_test`. Depuis la racine :

```powershell
docker compose -p phishchips-reprise-test -f backend/tests/compose.yml up -d --wait
cd backend
npm ci
npm run check
$env:TEST_DATABASE_URL='postgres://pcb_test:pcb_test_only@127.0.0.1:15432/phishchips_test'
npm test
npm audit --omit=dev
cd ..
docker compose -p phishchips-reprise-test -f backend/tests/compose.yml down
```

La base de test est en mémoire et doit être neuve pour chaque exécution complète (premier administrateur et classement global). Elle disparaît à l’arrêt de son conteneur. La suite teste authentification, permissions, concurrence, recommandations, choix libre, archivage, chrono, reprise et réponses idempotentes, battles, corrections, classements, badges et migration historique. Un workflow GitHub Actions reproduit ces contrôles avec Node 24 et PostgreSQL 16 ; il sera exécuté après publication sur GitHub.

Pour reproduire le contrôle des images avant publication, depuis la racine :

```bash
docker build -t ghcr.io/za512/phishchipsbattle-api:ci-smoke ./backend
docker build -t ghcr.io/za512/phishchipsbattle-frontend:ci-smoke ./frontend
node scripts/smoke-images.mjs
```

Le script utilise des secrets de test, un port disponible et un nom de stack aléatoire. Il supprime uniquement sa stack et son volume dédiés, même en cas d’échec. Il ne lit pas le .env de l’application. Ces constructions locales servent au développement ; le NAS télécharge les images publiées.

## Documents

- [Dev book actualisé](DEV_BOOK.md) : état, décisions et travaux restants.
- [Audit avant corrections du 28 septembre 2026](ETAT_PROJET_2026-09-28.md).
- [Dev book historique](docs/archives/DEV_BOOK_2026-04-29.md) et [README historique](docs/archives/README_HISTORIQUE.md).

Licence GPLv3. Projet original : Matthieu Girard / ZA512.

## Interface

Le portail possède son propre thème Phish & Chips, avec une apparence claire ou sombre commune à toutes les pages. La simulation de messagerie garde ses apparences Outlook et Classique dans une fausse fenêtre. Les équipes se gèrent dans l’administration, pas dans les préférences graphiques.

La connexion locale sépare connexion et création de compte ; l’amorçage du premier administrateur disparaît dès qu’un admin existe. En mode Entra, le bouton Microsoft est le seul parcours de connexion proposé.

La [note de refonte](docs/UI_REFONTE_2026-10-01.md) décrit les écrans, les vérifications et les limites restantes.
