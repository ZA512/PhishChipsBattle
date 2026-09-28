# PhishChipsBattle — état réel du projet au 28 septembre 2026

Audit du commit `73510df`, dernier commit local du 30 avril 2026. Le dépôt était propre au début de l'examen. Aucun code applicatif n'a été modifié pendant cet audit.

## Verdict

Le projet est un **prototype de jeu solo persistant, avec classements individuels et par service**. La stack Docker démarre et plusieurs parcours fonctionnent. C'est une base réutilisable pour le jeu, mais **pas encore une application permettant d'organiser des battles en entreprise**.

Les trois fondations de l'objectif décrit — authentification Entra, constitution d'équipes depuis l'organigramme, organisation de battles — sont absentes du code et du schéma de données. L'administration actuelle gère une liste de services, auxquels les joueurs se rattachent eux-mêmes.

Les cases cochées du dev-book ne constituent pas une recette validée : certaines corrections fonctionnent, d'autres restent incomplètes, et des défauts importants ne sont pas recensés. Le problème principal est la fiabilité de l'identité, des règles et des résultats, avant les améliorations visuelles.

## Ce qui existe réellement

| Capacité | État vérifié |
|---|---|
| Déploiement Nginx / Express / PostgreSQL | Construction et démarrage Docker réussis, API et base saines au démarrage |
| Contenu pédagogique | 162 emails, dont 80 phishing et 82 légitimes, avec indices |
| Partie solo | Création, récupération des emails, réponses, score, arrêt après trois erreurs et fin de partie fonctionnent |
| Réponses masquées avant classification | L'API de l'email courant ne renvoie ni le type ni les indices ; bonne base |
| Difficultés | Trois modes présents ; leur différence de chronométrage est imposée uniquement dans le navigateur |
| Services | CRUD administrateur implémenté ; création et liste vérifiées, affectation déclarative du joueur à un service |
| Classements | Quatre vues, filtres de difficulté et de mois, détail par service ; défauts de calcul détaillés plus bas |
| CSV | Export des lignes déjà chargées dans chaque onglet, donc du top 10 ; pas un export complet des résultats |
| Thèmes | Mode sombre, thème Outlook et fausse boîte de réception implémentés |
| Statistiques administrateur | Trois endpoints fonctionnels et page qui charge ses données ; métriques à corriger |
| Badges | 85 définitions et stockage des déblocages ; deux badges obtenus lors d'une fin normale testée |
| Profil joueur | API fonctionnelle, mais page inutilisable à cause d'une erreur de syntaxe JavaScript |
| SSO Entra / restrictions d'accès / rôles | Absents ; le JWT existant protège une partie et n'authentifie pas une personne |
| Organigramme / managers / synchronisation Graph | Absents |
| Équipes issues d'un manager, règles et exceptions | Absentes |
| Battles solo, internes à une équipe ou entre équipes | Absentes : aucun défi, calendrier, participant, règlement ou résultat de battle |

## Écart avec le dev-book

`DEV_BOOK.md` est un compte rendu de corrections techniques daté du 29 avril 2026. Les ambitions futures sont plutôt dans `IDEAS.md`, où le SSO est placé en dernier. Aucun des deux documents ne définit précisément le besoin d'équipes construites à partir d'un sous-arbre de l'organigramme.

### Corrections annoncées

| Point | État réel | Conclusion |
|---|---|---|
| BUG-1 — doublons dans `scores.js` | Corrigé | Un seul jeu de fonctions, difficulté transmise, vues de classements chargées dans un DOM de test |
| BUG-2 — comparaison du mot de passe | Modification présente, garantie exagérée | `timingSafeEqual` utilisé, mais branche selon la longueur et comparaison du tampon avec lui-même ; cela ne démontre pas un temps indépendant de la longueur |
| BUG-3 — concurrence lors de la création d'un joueur | **Incomplet et régressif** | Deux créations concurrentes du même pseudo ont reçu `201` ; les réponses de conflit laissent aussi une transaction ouverte |
| BUG-4 — identifiants de session invalides | Partiellement corrigé | Le cas `NaN` est rejeté dans les trois routes indiquées. `parseInt` accepte encore des formes comme `12abc` et ne garantit pas un entier positif valide |
| BUG-5 — secrets manquants au démarrage | Corrigé pour leur présence | Contrôle de présence de `JWT_SECRET` et `ADMIN_PASSWORD`, sans contrôle de longueur ni rejet des valeurs d'exemple |
| BUG-6 — `serviceId` invalide | Partiellement corrigé | `NaN` rejeté ; absence de validation stricte et de réponse maîtrisée pour un service inexistant |
| SEC-1 — CORS wildcard en production | Corrigé dans le code | Défaut fermé en production. CORS ne remplace pas l'authentification ; `CORS_ORIGIN` n'est ni documenté dans le modèle `.env`, ni transmis par Compose |
| SEC-2 — en-têtes Nginx | **Incomplet** | Directives présentes, mais aucun des quatre en-têtes annoncés sur `/phishing.html` et `/script.js` lors du test HTTP |
| SEC-3 — healthcheck API / dépendance frontend | Corrigé | Démarrage réel dans l'ordre PostgreSQL → API → frontend vérifié |
| SEC-4 — cache HTML | Corrigé | `Cache-Control: no-cache, must-revalidate` observé sur la page du jeu |
| QC-1 — fichiers historiques et frontend | Toujours ouvert | Ancien jeu à la racine, versions one-page et copie sous `docs/`, en plus du frontend entreprise |
| QC-2 — fonction `runSqlFile` morte | Corrigé | Fonction supprimée |
| QC-3 — vérification `res.ok` des classements | Corrigé | Vérifications présentes dans les trois fonctions de chargement |
| QC-4 — logs structurés | Non réalisé | Logs console uniquement |
| QC-5 — gestion/versionnement des emails | Non réalisé | Import seulement lorsque la table est vide ; pas d'interface d'édition/import ni de version du contenu |

### Phases et idées d'évolution

| Engagement | État réel |
|---|---|
| Phase 0 — suppression de la limite de 30 mails / abandon | Implémenté ; plafond réel de 162 mails, abandon enregistré comme une partie terminée |
| Phase 1 — sombre / Outlook / sidebar | Implémenté ; pas de recette visuelle multi-navigateur pendant cet audit |
| Phase 2 — CSV | Implémenté sur les données affichées |
| Phase 3 — dashboard admin | Implémenté ; ne fournit pas le temps moyen de décision envisagé dans `IDEAS.md` |
| Phase 4 — « achievements complet » | **Partiel** : profil cassé, badges impossibles ou non évalués, abandon sans évaluation |
| IDEAS 1 / 2 / 3 / 6 | Sombre et CSV présents ; dashboard et badges partiels |
| IDEAS 4 / 5 | CRUD emails et récapitulatif détaillé absents |
| IDEAS 7 / 8 / 11 | Campagnes, défis inter-services et multijoueur temps réel absents |
| IDEAS 9 / 10 | PWA et notifications absentes |
| IDEAS 12 / 13 / 14 | Difficulté adaptative, génération IA intégrée et reporting RSSI dédié absents |
| IDEAS 15 | SSO / annuaire absent |

## Défauts à traiter avant une compétition crédible

Les priorités ci-dessous sont des priorités de reprise du produit, pas des scores normalisés de vulnérabilité. Les tests utilisent exclusivement des données fictives dans une stack d'audit distincte.

### 1. Une entrée invalide fait tomber toute l'API — priorité 1

**Preuve Docker :** `POST /api/sessions` avec `playerId: "abc"` et une difficulté valide a renvoyé `502` via Nginx. Le compteur de redémarrages du conteneur API est passé de 0 à 1. Les logs montrent l'erreur PostgreSQL `22P02` à `sessions.js:53`, suivie de la sortie du processus Node.

Les routes sont des fonctions `async` sur Express 4, sans enveloppe transmettant leurs rejets à `next`. Le gestionnaire global de `app.js` ne capture donc pas ces erreurs asynchrones. Plusieurs autres routes ont le même défaut ; les routes de scores, qui attrapent leurs erreurs et renvoient elles-mêmes une réponse, évitent cette sortie du processus.

**À faire :** validation stricte de toutes les entrées, propagation cohérente des erreurs asynchrones, réponses 400/404/409 maîtrisées et test vérifiant que l'API survit à une requête invalide.

Références : `backend/src/routes/sessions.js:41`, `backend/src/routes/players.js:90`, `backend/src/routes/admin.js:47`, `backend/src/app.js:59`.

### 2. L'identité du joueur n'est pas authentifiée — priorité 1

**Preuve Docker :** création d'une partie pour un `playerId` existant, sans aucune authentification, réponse `201` avec émission d'un token de session. Les identifiants sont exposés dans les classements.

Une personne peut jouer au nom d'une autre en envoyant cet identifiant. Connaître ou obtenir le pseudo et l'email permet aussi de se reconnecter et de changer le service de cette personne. Le README affirme à tort que l'email protège le pseudo : aucune possession de la boîte email n'est vérifiée.

**À faire :** identité issue du SSO, joueur déduit de la session authentifiée côté serveur, contrôle de propriété des parties et rôles d'administration. Le pseudo peut rester un élément d'affichage.

Références : `backend/src/routes/players.js:47`, `backend/src/routes/sessions.js:41`, `README.md:46`.

### 3. Les règles de partie peuvent être contournées — priorité 1

**Preuve Docker :** quatre jokers consécutifs ont été acceptés ; la quatrième réponse a renvoyé `200`, `jokersUsed: 4` et `score: 4`, malgré la limite annoncée de trois. La vérification de disponibilité du joker existe uniquement dans l'interface.

Le délai et `decisionTime` sont également déclarés par le navigateur. Il n'existe pas d'heure serveur d'émission de l'email ni d'échéance appliquée à la réponse. Les modes Normal et Hardcore ne disposent donc pas de leur contrainte de temps côté serveur. La preuve d'une réponse tardive figure dans les résultats joints.

Masquer les réponses à l'avance est bien implémenté, mais ne suffit pas à rendre les scores fiables. Les jokers comptent aussi comme bonnes réponses dans les statistiques globales.

**À faire :** serveur responsable des trois jokers, du chronométrage, des transitions de partie et de la distinction entre bonne réponse humaine et réponse assistée. Les scores de battle doivent venir de ce moteur.

Références : `backend/src/routes/sessions.js:200`, `backend/src/routes/sessions.js:208`, `backend/src/routes/sessions.js:236`, `frontend/script.js:342`, `backend/src/routes/admin.js:122`.

### 4. La correction de concurrence des joueurs est incomplète — priorité 1

**Preuve Docker :** deux requêtes concurrentes pour le pseudo `R000`, avec deux emails différents, ont créé deux joueurs distincts (`201` et `201`). Le pseudo n'a aucune contrainte `UNIQUE` dans le schéma. Une transaction classique autour du `SELECT` puis `INSERT` ne rend pas ce contrôle exclusif.

**Deuxième preuve Docker :** une tentative de connexion avec un email existant et un autre pseudo a renvoyé `409`, puis `pg_stat_activity` a montré une connexion `idle in transaction`. Les deux retours anticipés de conflit sortent après `BEGIN`, sans `COMMIT` ni `ROLLBACK`, avant de rendre la connexion au pool. La connexion peut ensuite être réutilisée avec cette transaction toujours ouverte.

**À faire :** garantir les invariants en base et fermer toute transaction sur chaque chemin. Si le pseudo devient un simple nom d'affichage avec le SSO, décider explicitement s'il doit encore être unique.

Références : `backend/src/routes/players.js:44`, `backend/src/routes/players.js:55`, `backend/src/routes/players.js:78`, `backend/src/routes/players.js:98`, `backend/src/db/migrations/001_schema.sql:16`.

### 5. Les limites de requêtes sont partagées derrière Nginx — priorité 1

Express conserve `trust proxy: false` alors que Nginx transmet `X-Forwarded-For`. L'API identifie le proxy comme origine des requêtes. La limite de 10 réponses en 5 secondes et la limite globale de 120 requêtes par minute sont ainsi partagées entre utilisateurs de cette instance derrière le proxy.

**Preuve Docker :** six requêtes avec une adresse d'origine, puis cinq avec une autre, ont consommé le même quota ; la onzième a reçu `429`. Les logs confirment `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

**À faire :** configurer la confiance pour le proxy réellement déployé, puis prévoir un quota par utilisateur authentifié ou partie, avec une protection IP complémentaire adaptée au réseau d'entreprise.

Références : `backend/src/middleware/rateLimiter.js:6`, `backend/src/middleware/rateLimiter.js:20`, `frontend/nginx.conf:23`, `backend/src/app.js`.

### 6. Changer de service réattribue tous les scores passés — priorité 1 pour les battles

Les classements rattachent les parties au `service_id` actuel du joueur. La partie ne mémorise pas son service au moment où elle a été jouée.

**Preuve Docker :** une partie terminée apparaissait dans « Audit Alpha ». Après changement de service via `/api/players`, elle apparaissait dans « Audit Beta », sans modification de la partie. Le même défaut affecte les historiques mensuels. Une synchronisation future de l'organigramme déplacerait donc les résultats historiques.

**À faire :** enregistrer l'appartenance pertinente au moment de la compétition et figer les participants ainsi que leurs équipes pour chaque battle.

Références : `backend/src/routes/players.js:63`, `backend/src/routes/scores.js:180`, `backend/src/routes/scores.js:225`, `backend/src/db/migrations/001_schema.sql:41`.

### 7. Les classements ont des incohérences reproductibles — priorité 2

- **Top 10 des services :** `RANK() <= 10` inclut toutes les égalités à la frontière. Avec neuf scores de 100 et trois scores de 10, le classement a compté douze personnes et affiché **77,50**, alors que la fiche du service, limitée à dix lignes, affichait **91**.
- **Streaks mensuels :** PostgreSQL renvoie les dates via `pg` sous forme d'objets `Date`. `String(date).slice(0, 7)` ne produit pas `YYYY-MM`. Un joueur classé en août et septembre est affiché avec une séquence de **1 au lieu de 2**. Défaut présent pour joueurs et services.
- **Mois invalides :** le format `YYYY-MM` est vérifié sans vérifier que le mois existe ; `2026-99` arrive au SQL. Reproduit en environnement isolé : réponse 500 au lieu de 400.

**À faire :** une définition unique et déterministe du classement, une gestion explicite des égalités, des dates et des périodes de compétition.

Références : `backend/src/routes/scores.js:23`, `backend/src/routes/scores.js:72`, `backend/src/routes/scores.js:141`, `backend/src/routes/scores.js:227`, `backend/src/routes/scores.js:287`.

### 8. Profils et badges ne sont pas terminés — priorité 2

- `frontend/profile.js:10` contient une apostrophe non échappée dans `l'URL`. **Le fichier entier ne se parse pas**, y compris lorsqu'un identifiant valide est fourni. Les 17 autres fichiers JavaScript applicatifs contrôlés passent la vérification syntaxique.
- Le catalogue contient **85 badges**, contre 72 annoncés dans le dev-book.
- Les **9 badges de classement** sont explicitement ignorés par le moteur ; aucun traitement complémentaire n'existe.
- Les **3 variantes « No Life » à 200 réponses** sont impossibles avec 162 emails maximum par partie.
- « Touriste » exige trois services, mais le calcul ne lit que le service actuel du joueur : son compte reste au maximum à un.
- « Pile ou face » exige au moins dix réponses et 50 % de bonnes réponses, alors qu'une partie s'arrête à la troisième erreur. Avec dix réponses ou plus, cette proportion ne peut pas être atteinte dans le fonctionnement actuel.
- L'abandon termine la session sans appeler l'évaluation des badges. Les stats de profil mélangent aussi des scores de parties terminées et inachevées.

**À faire :** corriger la page, définir quels badges sont voulus, supprimer ou adapter les critères impossibles, utiliser une fin de partie commune et fiabiliser les métriques. La preuve d'un déblocage de deux badges par fin normale confirme que le moteur n'est pas entièrement cassé.

Références : `frontend/profile.js:10`, `backend/src/services/achievements.js:57`, `backend/src/services/achievements.js:171`, `backend/src/services/achievements.js:179`, `backend/src/db/achievements-data.js:68`, `backend/src/routes/sessions.js:283`, `backend/src/routes/players.js:118`.

### 9. Une erreur de réponse bloque l'interface — priorité 2

`classifyEmail` désactive les deux boutons et arrête le chronomètre avant l'envoi. Sur erreur HTTP ou réseau, la fonction sort sans réactiver les contrôles ni proposer de reprise.

**Preuve dans un DOM isolé avec réponse 429 :** les deux boutons restent désactivés, aucune fenêtre de feedback et aucun message utilisateur, alors que la partie reste active. La configuration du rate limiter rend ce cas particulièrement pertinent.

**À faire :** afficher l'erreur et permettre une reprise cohérente avec l'état serveur ; définir l'idempotence d'une réponse si la réponse HTTP a été perdue après son enregistrement.

Référence : `frontend/script.js:307`.

Un défaut similaire existe dans le formulaire d'administration : sur une réponse HTTP d'erreur lors d'une création/modification, le retour anticipé laisse le bouton Enregistrer désactivé (`frontend/admin.js:132`). Constat par lecture du code ; pas de reproduction HTTP de ce formulaire pendant cet audit.

### 10. Les garanties de déploiement restent insuffisantes — priorité 2

Les `add_header` des blocs HTML et ressources statiques annulent l'héritage des en-têtes définis au niveau `server` dans la version de Nginx utilisée. Leur absence sur les pages a été mesurée. Ce comportement est décrit dans la [documentation officielle Nginx](https://nginx.org/en/docs/http/ngx_http_headers_module.html).

Le Compose expose seulement HTTP. Ajouter une directive HSTS ne fournit pas TLS : il faut documenter et tester la terminaison HTTPS attendue, notamment avant de transmettre le mot de passe administrateur dans son en-tête actuel.

Le Dockerfile utilise Node 20, désormais indiqué EOL par le [calendrier officiel Node.js](https://nodejs.org/en/about/previous-releases). La reprise doit sélectionner une LTS maintenue et remettre à niveau les images. `npm audit` signale deux paquets transitifs concernés, `body-parser` et `qs`, avec une gravité agrégée modérée. Ce résultat est une alerte de dépendances, pas une preuve que tous les scénarios décrits sont exploitables dans cette application.

Le dépôt ne contient ni suite de tests automatisés, ni commande de test, ni pipeline CI versionné. Les migrations et seeds fonctionnent lors du démarrage et du redémarrage testés, mais pas de procédure de restauration, de sauvegarde ou de recette de mise en production documentée.

Références : `frontend/nginx.conf:30`, `frontend/nginx.conf:35`, `backend/Dockerfile:1`, `docker-compose.yml:44`, `backend/package.json:6`.

## Reprise recommandée pour l'objectif entreprise

### Étape A — stabiliser et rendre l'identité fiable

Conserver la base du jeu et la séparation frontend/API/base. Corriger les sorties de processus, les transactions et les règles de partie, puis intégrer Entra **avant** de continuer à enrichir les badges.

Pour une première installation dans une entreprise, je recommande de commencer avec un tenant explicitement autorisé. Conserver le pseudo pour l'affichage, et rattacher le compte à l'identité Entra stable `tid` / `oid`. L'email et le nom peuvent évoluer : la [documentation Microsoft des claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference) les distingue des identifiants stables. Utiliser OpenID Connect avec une bibliothèque maintenue et des rôles joueur / organisateur / administrateur. Le [protocole Entra OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc) fournit le cadre de connexion.

L'authentification et la lecture de l'organigramme sont deux fonctionnalités distinctes. Les droits nécessaires à la synchronisation Graph ne doivent pas être confondus avec ceux nécessaires pour se connecter.

**Recette minimale :** une personne ne crée une partie que pour elle-même ; seules les personnes autorisées organisent ou administrent ; une requête invalide ne fait pas tomber l'API ; temps et jokers sont appliqués par le serveur.

### Étape B — équipes définies par une règle, avec prévisualisation

Ton idée « à partir de cette personne, tout son sous-arbre appartient à l'équipe X » est une bonne règle de base. Il n'est pas nécessaire de reproduire un organigramme graphique complet pour la première version.

Proposition de fonctionnement :

1. L'administrateur crée une équipe et sélectionne une personne racine.
2. Il choisit l'inclusion de cette personne et la profondeur, directe ou récursive.
3. L'application montre la liste résolue, les exclusions et les éventuels chevauchements.
4. Des ajouts/exclusions manuels permettent de gérer les exceptions.
5. La synchronisation conserve un état connu et affiche les changements avant de les appliquer aux équipes utilisées pour de nouvelles battles.

Microsoft Graph expose [`/users/{id}/directReports`](https://learn.microsoft.com/en-us/graph/api/user-list-directreports?view=graph-rest-1.0). L'endpoint renvoie les personnes directement rattachées ; **il ne renvoie pas toute la chaîne descendante en une seule requête**. L'application doit parcourir la hiérarchie et gérer pagination, doublons et données manquantes. Pour une synchronisation sans utilisateur connecté, la permission applicative minimale documentée pour cet endpoint est `User.Read.All`.

La difficulté métier est la qualité des relations manager, puis le traitement des équipes imbriquées : si deux responsables racines se trouvent dans le même sous-arbre, décider qui appartient à quelle équipe. Je recommande une règle explicite donnant priorité à la racine la plus proche, avec exceptions visibles, et un mode manuel pour les collaborateurs sans manager renseigné. Ce sont des choix de produit à valider, pas des capacités existantes.

**Données manquantes à ajouter :** identité annuaire, relation manager, règles d'équipe, membres résolus, exceptions, date et état de synchronisation. Les participants d'une battle doivent être figés au lancement pour que les réorganisations ne modifient pas son résultat.

### Étape C — battles asynchrones en premier

Je recommande de commencer par des compétitions sur une période, qui couvrent déjà ton besoin de battles solo et d'équipe. Le temps réel peut venir ensuite si le besoin le justifie.

Une battle doit définir : organisateur, dates, participants ou équipes, série d'emails ou règle de sélection, difficulté, tentatives autorisées, règles de joker, score et départage. Prévoir trois portées : individuel, classement individuel dans une équipe, classement entre équipes. Séparer entraînement libre et partie comptant pour une battle.

**Données manquantes à ajouter :** battles, participants, équipes figées, parties rattachées à la battle et résultat final. Aujourd'hui, les scores mensuels sont des meilleurs scores libres, sans notion d'inscription ou de conditions communes de compétition.

La moyenne des dix meilleurs n'est pas automatiquement la bonne mesure pour toutes les battles : elle mesure la performance des meilleurs participants, et non la participation ou la progression de tout le service. Choisir la formule selon le but, la publier et la conserver avec la battle.

### Étape D — exploitation et pédagogie

Ajouter ensuite la gestion du contenu, le récapitulatif de partie, les métriques de participation et de progression, les règles de visibilité des profils, la durée de conservation et la suppression des données, les sauvegardes et une procédure de déploiement testée. Revoir les intitulés et appréciations du jeu selon le public de l'entreprise ; certains badges et formulations actuels nécessitent un choix éditorial.

## Ce que je conserverais et ce que je reprendrais

**À conserver :** le contenu pédagogique comme point de départ, les interactions d'inspection des emails, le backend découpé en routes, PostgreSQL et les migrations, les réponses corrigées côté serveur, le verrou `FOR UPDATE` lors d'une réponse et la stack Compose pour le développement.

**À reprendre en profondeur :** identité et autorisations, moteur de règles et chronométrage, modèle d'équipes et historique des appartenances, modèle de battle et définition des scores. Ajouter des tests ciblés sur ces invariants et les parcours d'erreur.

Le frontend JavaScript simple est encore gérable à cette taille. Une migration de framework ou de langage peut aider à mesure que les écrans d'organisation arrivent, mais elle n'est pas le premier blocage. Une réécriture complète du jeu ne s'impose pas à partir des preuves réunies.

## Vérifications et limites de l'audit

- Lecture du dev-book, README, idées, migrations et de l'ensemble des fichiers JavaScript applicatifs de `backend/src` et `frontend` ; consultation de l'ancien dépôt indiqué en référence.
- Vérification syntaxique de **18 fichiers JavaScript** : **17 passent, 1 échoue** (`profile.js`).
- Installation reproductible via `npm ci --ignore-scripts`, contrôle des versions effectivement verrouillées et `npm audit`. Le lockfile n'a pas été modifié.
- Première reproduction en PostgreSQL embarqué PGlite avec les handlers originaux, puis confirmation des principaux constats en **stack Docker réelle avec PostgreSQL 16**, Express 4.22.1 et Node 20.20.2.
- Stack séparée `phishchips-audit-20260928`, port local `18080`, secrets et personnes fictifs, volume neuf ; aucun environnement métier utilisé.
- Les conteneurs, le réseau et le volume de cette stack d'audit ont été supprimés après les vérifications.
- Parcours HTTP vérifiés : administration protégée, création de joueurs et parties, emails masqués, réponses, fin normale, badges, APIs profil et statistiques, classements, conflits, concurrence, quotas et redémarrage sur erreur.
- Exécution du JavaScript des pages classements et statistiques dans un DOM relié à l'API réelle ; reproduction du blocage de l'interface avec un 429 simulé.
- Résultats structurés : [`docs/audits/2026-09-28/results.json`](docs/audits/2026-09-28/results.json).

Cet audit établit le fonctionnement et les défauts mentionnés ; il ne constitue pas une recette visuelle exhaustive, un test de charge, un audit exhaustif de sécurité ou une validation dans un tenant Entra. La qualité de l'organigramme de l'entreprise reste inconnue. Aucun correctif ni fonctionnalité nouvelle n'a été appliqué.
