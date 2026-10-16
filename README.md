# Phish & Chips Battle

**Le fast-food de la cybersécurité. Classez les emails avant qu’ils classent votre carrière.**

Phish & Chips Battle est l’évolution entreprise de [PhishChips](https://github.com/ZA512/PhishChips). On inspecte des mails dans une messagerie simulée, on distingue les messages légitimes des pièges, puis on découvre ce qui devait alerter et le bon réflexe. Le service sécurité fournit les explications. Les appréciations, elles, n’ont pas reçu de formation à la bienveillance.

- **Entraînement individuel** : Classique avec trois difficultés et SOS Sécu, ou Découverte sans chrono ni score.
- **Contre-la-montre** : 5 ou 10 minutes globales, deux difficultés de pénalité, erreurs illimitées, aucun SOS et quatre classements distincts.
- **Battles** : compétitions individuelles, dans une équipe ou entre équipes, avec la même série de mails et des règles communes.
- **Équipes choisies** : proposition à partir de l’organigramme, choix libre du collaborateur, sans réaffectation automatique.
- **Classements et profils** : Classique, Battles et Contre-la-montre séparés ; activité pédagogique de Découverte. Les 19 rangs et 85 badges historiques restent propres au Classique.
- **Administration** : équipes, catalogue privé de mails avec import/export JSON, battles, annuaire et corrections de score tracées.
- **Connexion** : comptes locaux pour les essais ou SSO Microsoft Entra ID pour l’entreprise.

**Une installation neuve ne contient aucun mail.** L’administrateur importe ses propres scénarios, avec les [prompts français](prompt.txt) ou [anglais](prompt-en.txt) pour préparer des lots variés. Les mails réservés aux battles peuvent être séparés de ceux d’entraînement.

## Aperçu de l’interface

Le portail possède son propre thème Phish & Chips, avec une apparence claire ou sombre commune aux pages. La simulation de messagerie garde ses apparences Outlook et Classique dans une fausse fenêtre.

**Entraînement — choisir sa difficulté avant de mettre la prod en danger.**

![Écran d’entraînement avec l’équipe actuelle, les trois difficultés et le bouton de démarrage](docs/images/entrainement.png)

<details>
<summary>Connexion — on aimerait savoir à qui envoyer le rapport d’incident</summary>

Connexion et création de compte sont séparées. Cette capture montre le mode local ; en mode Entra, le parcours passe par Microsoft. L’amorçage du premier administrateur n’est proposé que tant qu’aucun admin n’existe.

![Formulaire de connexion locale de Phish & Chips, avec un onglet distinct pour créer un compte](docs/images/connexion.png)

</details>

<details>
<summary>Classements — le tableau des responsabilités</summary>

Comparer les joueurs ou les équipes, filtrer par période et difficulté, puis exporter les résultats en CSV. Les résultats de battle restent dans la compétition concernée.

![Classement d’entraînement avec filtres joueurs ou équipes, période, difficulté et export CSV](docs/images/classements.png)

</details>

<details>
<summary>Mon dossier — les clics passent, les preuves restent</summary>

Statistiques personnelles, derniers badges obtenus et collection regroupée en familles, avec filtres par état et catégorie.

![Profil du joueur avec statistiques, derniers badges et collection de badges regroupée en familles](docs/images/profil-badges.png)

</details>

<details>
<summary>Administration — les clés du bureau</summary>

La rubrique Équipes permet d’ajouter, renommer ou retirer une équipe. Les autres rubriques donnent accès au catalogue de mails, aux battles, à la modération, à l’annuaire et aux statistiques.

![Administration, rubrique Équipes, avec les actions ajouter, modifier et supprimer](docs/images/administration-equipes.png)

</details>

Captures fournies le 1er octobre 2026, en thème clair. La [note de refonte](docs/UI_REFONTE_2026-10-01.md) détaille les écrans et leurs vérifications.

## Installation et utilisation

- [Déployer sur Unraid ou un autre serveur](#déployer-les-images-publiées--unraid-ou-autre-serveur)
- [Essayer les sources localement](#développer-et-essayer-les-sources-localement)
- [Importer et gérer les mails](#catalogue-privé-de-mails)
- [Gérer les équipes](#équipes-et-nouveaux-arrivants) et [organiser des battles](#battles)
- [Administrer et corriger les scores](#administration-et-scores)
- [Configurer Microsoft Entra ID](#configurer-microsoft-entra-id)
- [Reprendre une ancienne base](#reprendre-une-ancienne-base) et [exécuter les vérifications](#vérifications)

API Node.js 24 / Express 5, PostgreSQL 16 et interface servie par Nginx. La version Docker utilise exclusivement `frontend/` et `backend/`. Les fichiers de jeu à la racine proviennent de l’ancienne version standalone ; son catalogue public a été retiré et les autres fichiers restent des références historiques.

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

### Sets de mails

Un **set** est une collection nommée, avec description, disponibilité par défaut des nouveaux mails, dates et historique des imports. Créer par exemple « Typosquatting — réaliste » et « Le bureau a perdu la raison » permet de préparer des compétitions distinctes sans relire tout le catalogue.

- **Brouillon** : préparer et relire le lot ; il n’est pas proposé aux nouvelles parties.
- **Prêt** : ses mails sont disponibles selon leur utilisation individuelle.
- **Archivé** : conserver le set et ses mails, tout en le retirant des nouvelles sélections. Une modification de son état permet de le remettre à disposition.

À l’import, choisir un set existant ou en créer un avec le fichier. Le contrôle préalable ne crée pas le set et ne modifie aucun mail. Le remplacement concerne **uniquement le set choisi** ; compléter un set conserve son contenu actuel. Les imports sont journalisés par opération, avec auteur, date et compteurs. Les dates des imports antérieurs à cette évolution ne sont pas reconstituées.

Un mail peut appartenir à plusieurs sets. Un import reconnaît le contenu identique, y compris lorsque la disponibilité demandée diffère : il réutilise le mail, le rattache au set et **conserve sa disponibilité actuelle**, avec un avertissement dans le contrôle préalable. Modifier la disponibilité d’une sélection agit donc sur le mail dans tous ses sets. La disponibilité par défaut d’un set s’applique aux nouveaux mails sans champ `usage` ; changer cette valeur ne modifie pas les mails déjà importés.

La vue **Vos sets** présente chaque collection sous forme de carte : ouvrir ses mails, modifier son nom ou importer un lot dans ce set. Les sets archivés sont masqués par défaut et restent accessibles avec « Afficher les sets archivés ». **Les mails** ouvre le catalogue complet ; les listes affichent 15 mails par page, réglables à 30 ou 50.

Pour ranger les mails existants : créer le set de destination, ouvrir le set d’origine, cocher les mails et choisir la destination dans la barre de sélection. **Sélectionner les N résultats** sélectionne tous les mails correspondant aux filtres, sur toutes les pages ; la case de l’en-tête sélectionne seulement la page affichée. **Déplacer** ajoute les mails à la destination et les retire du set d’origine dans une même transaction ; leurs autres rattachements restent inchangés. **Ajouter aussi à ce set** conserve le set d’origine. La sélection est conservée entre les pages, puis effacée quand on change de filtre.

Les autres actions sur la sélection permettent l’export, le retrait du set affiché, le changement de disponibilité et la suppression du catalogue. **Retirer d’un set** conserve le mail et ses autres rattachements ; **Supprimer du catalogue** retire le mail de toutes les nouvelles sélections. La suppression complète est regroupée dans **Outils du catalogue complet**. Une question retirée d’un set et sans autre rattachement lors d’un remplacement est archivée ; les références des parties passées restent valides.

Le filtre de set et **Exporter ce set** produisent un JSON contenant ses mails et ses métadonnées. Lors du chargement d’un tel fichier pour créer un nouveau set, le nom et la description sont préremplis. Les exports du catalogue complet ou d’une sélection restent des listes de mails ; ils ne restaurent pas automatiquement tous les rattachements entre sets. Pour sauvegarder l’ensemble des données et des historiques, conserver une sauvegarde PostgreSQL.

La migration `005_mail_sets.sql` regroupe le catalogue actif existant dans **Catalogue général**, déjà prêt, sans modifier les identifiants, disponibilités, réponses ou séries publiées. Sur une installation vide, aucun mail ni set pédagogique n’est ajouté.

Format : un tableau d’objets, ou `{ "schemaVersion": 1, "emails": [...] }` comme les exports. Champs requis : `sender`, `realSender`, `subject`, `body`, `type` (`safe` ou `phishing`), `clues` (tableau de textes). `usage` vaut `training`, `battle`, `both` ou `express` ; sans ce champ, l’import utilise la disponibilité choisie dans le formulaire, initialisée depuis le set. `express` réserve le mail au Contre-la-montre. Le mode libre ne propose que les mails express dans les sets express prêts. `training` et `both` restent disponibles en entraînement classique ou découverte ; `battle` reste réservé aux compétitions organisées. Les organisateurs peuvent composer un Contre-la-montre avec des scénarios réservés aux battles. Les éventuels `id` externes sont ignorés : le serveur attribue ses identifiants. Le format des liens du prompt existant (`<a href='…' data-real-link='…'>…</a>`) reste compatible. Le corps est du texte avec ces liens simulés ; les balises HTML générales, images et fichiers ne sont pas exécutés ni chargés. Les liens ne naviguent pas vers Internet.

Limites : 5 000 mails actifs, 5 000 par import, 10 Mio par requête, 6 000 caractères par corps, 8 indices de 500 caractères maximum. Un phishing exige au moins un indice. Les noms, adresses et sujets sont limités à 300 caractères. Les lots volumineux doivent être divisés ; l’export d’une sélection permet de faire des lots. Le contrôle préalable vérifie la structure et annonce les ajouts, doublons et retraits ; il ne juge pas la véracité pédagogique des corrections.

**Remplacer le contenu du set** remplace ses rattachements dans une même transaction. Un import invalide ne modifie rien. Les doublons exacts sont réutilisés sans créer une deuxième question. Changer le contenu ou les indices crée un nouveau scénario ; la disponibilité et les rattachements restent des métadonnées modifiables sans réécrire les réponses historiques.

**Supprimer** retire les mails des nouvelles sélections. Les copies en base restent archivées pour les parties déjà démarrées, les battles publiées et leurs récapitulatifs. Ce n’est pas une purge des données historiques. Les suppressions et imports sont journalisés avec leur auteur et leurs volumes. Un redémarrage ne remet jamais l’ancien catalogue. La migration conserve les mails d’une installation existante avec l’utilisation « Les deux » ; pour remplacer l’ancien catalogue public, sélectionner son set à l’import et cocher le remplacement. Aucun effacement automatique des données existantes n’est effectué.

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

L’administrateur ou l’organisateur publie une compétition **Classique** ou **Contre-la-montre**, avec classement individuel, dans une équipe ou entre équipes. Il fixe début, difficulté, sets et tentatives (1 à 5). Il n’existe plus de limite de 90 jours : choisir une date de fin quelconque, ou **Sans date de fin** pour une clôture manuelle. Le Contre-la-montre garde une durée de 5 ou 10 minutes par tentative, même si la compétition reste ouverte plusieurs mois ; aucun SOS. Le Classique conserve 0 à 3 jokers.

Pour les mails, sélectionner un ou plusieurs sets prêts et une quantité par set : 162 mails maximum en Classique, 5 000 en Contre-la-montre. Le nombre de mails légitimes est réglable, avec la moitié du total par défaut ; les autres sont des phishing. « Vérifier la composition » contrôle les quotas et les chevauchements : un mail commun à plusieurs sets ne compte qu’une fois. Une composition impossible est refusée sans publication. L’option « Exclure les mails accessibles en entraînement » retient les mails battle en Classique, et battle/express en Contre-la-montre. Sans cette option, les scénarios partagés (et training pour le Contre-la-montre) sont également proposés. Pour des scénarios de compétition absents du mode libre, utiliser `usage: "battle"`, accepté dans les deux types de compétitions organisées.

Choisir le public : **Toute l’entreprise** inclut les comptes actuels et les futurs arrivants dès qu’ils ont choisi une équipe ; **Certaines équipes** permet de cibler la DSI, la comptabilité, etc., avec une option d’inclusion des futurs membres ; **Des personnes précises** garde une liste fixe. La recherche par nom/email/équipe, le filtre d’équipe et l’ajout de tous les résultats affichés évitent de cocher 1 200 noms. Les équipes vides sont autorisées pour un public ouvert aux entrants. Les comptes désactivés et les équipes supprimées ne sont pas inscrits automatiquement.

**L’équipe est figée à l’inscription dans la compétition** : à publication pour les membres présents, à leur admission pour les nouveaux. Un changement ultérieur ne déplace pas leurs résultats et ne les désinscrit pas. Les anciennes battles gardent leur liste figée. Chaque participant reçoit la même sélection, dans un **ordre aléatoire indépendant pour chaque tentative**, en Classique comme en Contre-la-montre. Le mélange est effectué côté serveur avec un tirage cryptographique ; la séquence de réponses d’un collègue n’est donc pas un ordre commun à recopier. Le nom des sets, les quantités et la composition effective sont mémorisés à la publication pour l’organisateur. Modifier, compléter ou archiver ensuite les sets ne modifie pas cette sélection. Reprendre une tentative en cours conserve son ordre, renouvelle son accès sans consommer de tentative et ne remet pas le chrono à zéro. Les sessions déjà commencées ne sont pas remélangées.

En Classique, le classement individuel retient le meilleur score valide, puis le temps de décision cumulé, l’heure de fin et l’identifiant en cas d’égalité. Une battle classique entre équipes utilise la moyenne du meilleur score de **tous les inscrits** ; un absent ou un participant disqualifié compte pour zéro. Le taux de participation est affiché.

En Contre-la-montre organisé, les scores peuvent être négatifs : les absents ne sont pas classés devant eux. Le meilleur résultat valide est départagé par bonnes réponses, erreurs, date et identifiant. Le score d’équipe est la moyenne des dix meilleurs joueurs ayant terminé une tentative valide ; les absents sont exclus de cette moyenne. Les résultats restent propres à chaque compétition et ne remontent pas dans le Hall of Fame du mode libre. Les statistiques distinguent également les compétitions Contre-la-montre du mode libre.

À l’échéance, les nouvelles réponses sont refusées. La consultation des résultats clôture et enregistre le classement ; l’organisateur peut aussi clôturer plus tôt. Les essais en cours sont alors terminés avec leurs points acquis. Une correction administrative ultérieure peut mettre à jour ces résultats, avec un historique.

Le chrono, le nombre de jokers, l’identité et les points sont contrôlés par le serveur. Ces contrôles n’empêchent pas le partage de réponses ou la mémorisation des emails d’entraînement.

## Administration et scores

- **Joueur** : jouer, choisir son équipe, consulter classements et profils internes.
- **Organisateur** : publier et clôturer des battles.
- **Administrateur** : gérer les équipes, le catalogue de mails et l’annuaire, consulter les statistiques, corriger ou disqualifier une partie terminée.

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

## Formats, chronos et scores

### Classique · entraînement et nouvelles battles

L’entraînement propose directement quatre boutons : **Découverte, Facile, Normal et Difficile**. Les règles restent rattachées au choix actif, au-dessus du démarrage. La transition animée respecte la préférence système de réduction des mouvements.

| Difficulté | Départ par mail | Après chaque bonne classification humaine | Plancher |
|---|---:|---|---:|
| Facile | 60 s | Fixe | 60 s |
| Normal | 60 s | −1 s | 35 s |
| Difficile | 45 s | −1 s | 25 s |

Le corps visible du mail ajoute **0 s jusqu’à 50 mots**, **10 s de 51 à 70 mots**, **20 s à partir de 71 mots**. Les attributs techniques des liens ne comptent pas ; leur texte affiché compte. Ce bonus est propre à chaque mail. Une erreur, une expiration ou un SOS n’accélère pas le mail suivant.

Le score reste le nombre de mails trouvés, SOS compris selon la règle historique. Trois erreurs terminent la partie ; les quotas SOS restent inchangés. Les nouvelles tentatives abandonnées sont conservées dans l’activité mais exclues des records ; les règles des anciennes compétitions restent préservées.

La baisse de 1 seconde concerne les nouvelles parties et compétitions. Les sessions en cours et battles déjà publiées conservent leur rythme d’origine, y compris les anciens chronos à −2 secondes.

### Découverte

Choisir **Découverte** dans l’entraînement : sans chrono, sans score, sans limite d’erreurs. Les réponses et explications restent consultables au récapitulatif. Aucune participation aux classements, aux records ou aux badges historiques ; l’activité pédagogique est présentée séparément dans les profils et statistiques.

### Contre-la-montre

Accès depuis la navigation : **5 ou 10 minutes**, difficulté **Normal ou Difficile**. Le serveur démarre le délai au premier mail. Le temps passe pendant les corrections, les changements de mails, les rechargements et les déconnexions. Il n’existe ni chrono par mail, ni SOS, ni limite de trois erreurs, ni pénalité en secondes.

| Configuration | Calcul du score | Avec 6 bonnes et 2 erreurs |
|---|---|---:|
| 5 min · Normal | bonnes − erreurs | +4 |
| 5 min · Difficile | bonnes − erreurs × (erreurs + 1) / 2 | +3 |
| 10 min · Normal | bonnes − erreurs | +4 |
| 10 min · Difficile | bonnes − erreurs × (erreurs + 1) / 2 | +3 |

Le score peut être négatif : 8 bonnes et 8 erreurs donnent **−28** en Difficile. Une bonne réponse ne remet pas à zéro le rang de l’erreur suivante. Le mode libre se prépare en **trois cartes successives : set express → durée → difficulté**, avec retour possible en conservant les choix. Choisir **Tous les sets express** ou un set précis : seuls les sets prêts dont la disponibilité par défaut est `express` et leurs mails `usage: "express"` sont éligibles. Les autres mails ne sont pas proposés, même via un appel direct à l’API. Les mails `battle` restent privés aux compétitions organisées, qui conservent leur sélection réservée. Un mail rattaché à plusieurs sets n’apparaît qu’une fois dans le vivier général. La série, le set et son nom sont figés au démarrage ; renommer ou archiver le set ne casse pas une reprise. Le Contre-la-montre peut parcourir tout ce vivier dans un ordre aléatoire, sans répétition dans une tentative et sans vider les sets ; le plafond de 162 mails reste propre au Classique.

Pour un set court dédié : dans Administration → Mails, créer un set avec disponibilité **Express · contre-la-montre uniquement**, importer les scénarios courts puis le passer à **Prêt**. Les prompts français et anglais produisent `usage: "express"` sur demande de lot express. Pour les mails déjà importés, modifier la disponibilité sur la sélection : changer seulement la disponibilité par défaut du set ne modifie pas ses anciens mails. Les classements individuels, d’équipe et les exports sont séparés par **source × durée × difficulté** ; le filtre Source du Hall of Fame permet de retrouver chaque set. Les anciens résultats sans set restent dans Catalogue général.

Fin au délai global (**time_up**), à l’épuisement du vivier (**all_emails**) ou sur abandon confirmé. Un rechargement pendant le jeu reprend la tentative et son échéance serveur ; une expiration pendant le jeu affiche son résultat. Depuis la préparation, **Nouvelle tentative** démarre une partie neuve et **Voir le dernier résultat** ouvre explicitement la tentative terminée. Une partie abandonnée en cache ne renvoie plus sur le résultat au lancement suivant ; les quotas des battles restent contrôlés côté serveur. La clôture automatique est également assurée sans action du joueur, y compris après redémarrage du service. Les reprises depuis le même navigateur utilisent un identifiant de session local, vérifié contre le compte authentifié ; les jetons de partie restent éphémères.

Le Hall of Fame distingue strictement les **quatre configurations dans chaque source**, avec périodes globale et mensuelle. Il retient le meilleur score de chaque joueur : score décroissant, bonnes réponses décroissantes, erreurs croissantes, puis date et identifiant. Seules les tentatives terminées normalement, non disqualifiées et ayant traité au moins un mail comptent. Les abandons restent dans l’historique. Réessais illimités ; la mémorisation entre tentatives est assumée.

Le classement d’équipe applique la moyenne des meilleurs scores des dix meilleurs joueurs **dans une seule configuration**, avec l’équipe figée au début de chaque tentative. Les exports CSV et corrections administratives acceptent les scores négatifs du Contre-la-montre ; le Classique reste non négatif et la Découverte reste sans points. Les profils et KPI administratifs séparent formats, durées et difficultés, ainsi que mails consultés, décisions humaines, classifications correctes, erreurs, expirations et SOS. Un SOS ou une expiration n’entre pas dans le taux des classifications humaines.

### Migration et API

La migration **006_game_formats.sql** conserve sessions, réponses, équipes, badges et battles existants. Les battles déjà publiées et sessions en cours gardent la version de chrono **1**, leurs délais déjà commencés et leur éligibilité historique. Les nouvelles règles portent la version **2** ; les classements vérifiés acceptent 1 et 2. La version **0** reste historique et ne devient pas fiable rétroactivement. Les nouveaux formats ne déverrouillent aucun badge ou rang classique.

Le moteur reste unique : POST /api/sessions reçoit format (classic, discovery, time_attack), difficulty et, pour le Contre-la-montre libre, durationSeconds (300 ou 600) et éventuellement setId. GET /api/sessions/mail-sets liste les sources disponibles sans exposer les questions ni leurs réponses. Un battleId impose les règles, la durée et la série figées de la compétition ; les paramètres incompatibles sont refusés. Les routes de mail, de réponse, de fin et de récapitulatif restent communes. GET /api/sessions/:id/state retourne l’état canonique du propriétaire, renouvelle son jeton et constate une éventuelle expiration. Les réponses sont sérialisées et idempotentes par mail. Les classements libres sont sous /api/scores/time-attack ; durée et difficulté sont explicites, setId sélectionne un set (son absence sélectionne uniquement les résultats du vivier général). La migration 007 ajoute express aux disponibilités et fige la source de session ; les anciennes parties sans set gardent leur reprise et leur classement général. La migration 008 ajoute les compétitions Contre-la-montre, les publics ouverts et la fin facultative. Les anciennes battles restent classiques, avec leurs dates et inscriptions figées.

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

La base de test est en mémoire et doit être neuve pour chaque exécution complète (premier administrateur et classement global). Elle disparaît à l’arrêt de son conteneur. La suite teste authentification, permissions, concurrence, recommandations, choix libre, archivage, chrono, reprise et réponses idempotentes, battles, corrections, classements, badges, catalogue de mails et migration historique. Un workflow GitHub Actions reproduit ces contrôles avec Node 24 et PostgreSQL 16 à chaque push ou pull request.

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
