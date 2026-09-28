# PhishChipsBattle

Jeu de sensibilisation au phishing pour l’entreprise : entraînement individuel, équipes choisies par les collaborateurs et battles organisées. API Node.js 24 / Express 5, PostgreSQL 16 et interface servie par Nginx.

La version Docker utilise exclusivement `frontend/` et `backend/`. Les fichiers de jeu à la racine sont l’ancienne version standalone de [PhishChips](https://github.com/ZA512/PhishChips). Ils sont conservés pour référence ; leur contenu ne constitue pas la version entreprise.

## Essayer localement

Docker doit être démarré. Depuis la racine, sous PowerShell :

```powershell
./scripts/setup-local.ps1
# Si .env existe déjà, cette commande le conserve et demande de le modifier explicitement.
docker compose up -d --build --wait
```

Ouvrir **http://localhost:8080/login.html**, avec la même origine que `APP_URL`. Le port reste accessible uniquement depuis la machine locale.

Pour le premier administrateur, remplir email, mot de passe personnel (12 à 128 caractères) et pseudo, puis ouvrir « Créer le premier administrateur local ». Le secret d’amorçage est la valeur `ADMIN_PASSWORD` du fichier `.env`. Cette création n’est possible qu’une fois. Le mot de passe personnel permet ensuite la connexion normale ; le secret d’amorçage n’est pas un accès aux API d’administration.

Depuis « Administration », créer les équipes. Le premier administrateur peut accéder à cette page avant de choisir une équipe. Les comptes locaux servent à la démonstration et aux tests ; le déploiement entreprise utilise Entra.

Pour arrêter sans perdre les données : `docker compose down`. Le volume PostgreSQL conserve les comptes et résultats. Ne pas ajouter `-v` si les données doivent être conservées.

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
5. Relancer `docker compose up -d --build --wait`, puis tester un joueur, un organisateur et un administrateur réels.

Le SSO utilise le flux code avec PKCE, état lié au navigateur, nonce et validation de signature, audience, émetteur et tenant. L’identité est liée à l’identifiant Entra `oid`, jamais à un email saisi. Le SSO et Graph sont implémentés ; **la validation avec un tenant réel reste à effectuer**.

Pour un déploiement derrière un proxy HTTPS, garder interface et API sur une seule origine, adapter le proxy et `TRUST_PROXY`, et vérifier les adresses clientes. Le Nginx fourni remplace l’en-tête d’adresse transmis par son client direct ; derrière un autre proxy, configurer explicitement la chaîne de confiance et la restitution de l’IP réelle. Prévoir sauvegardes PostgreSQL et rotation du secret Entra selon vos procédures.

Références officielles : [flux code Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [rôles d’application](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps), [liste des utilisateurs Graph](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0), [lecture du manager](https://learn.microsoft.com/en-us/graph/api/user-list-manager?view=graph-rest-1.0).

## Reprendre une ancienne base

La migration `003_enterprise.sql` est automatique et transactionnelle. Elle conserve les données, rend les pseudos uniques sans perdre les comptes, et ajoute comptes authentifiés, affectations historiques, battles et modération.

Les anciennes parties portent `rules_version=0` : leurs scores restent en base mais sont exclus des nouveaux classements vérifiés. L’ancien logiciel ne mémorisait pas l’équipe au moment d’une partie ; la migration reprend donc l’équipe présente au moment de la migration, sans prétendre reconstruire les changements antérieurs. Un ancien compte créé avec un simple pseudo/email n’est jamais revendiqué automatiquement par un compte Entra ou une inscription locale.

Faire une sauvegarde avant la migration d’une base utilisée. Le rapprochement d’anciens comptes avec des identités vérifiées et l’import versionné des emails restent à développer. Ne pas vider le catalogue pour le mettre à jour : les réponses passées référencent ses emails.

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

## Documents

- [Dev book actualisé](DEV_BOOK.md) : état, décisions et travaux restants.
- [Audit avant corrections du 28 septembre 2026](ETAT_PROJET_2026-09-28.md).
- [Dev book historique](docs/archives/DEV_BOOK_2026-04-29.md) et [README historique](docs/archives/README_HISTORIQUE.md).

Licence GPLv3. Projet original : Matthieu Girard / ZA512.