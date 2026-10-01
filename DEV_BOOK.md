# PhishChipsBattle — Dev book

État actualisé le **1er octobre 2026**, après audit du code, vérification sur PostgreSQL et refonte de l’interface. Le précédent dev-book reste disponible dans [l’archive du 29 avril](docs/archives/DEV_BOOK_2026-04-29.md). L’[audit avant corrections](ETAT_PROJET_2026-09-28.md) conserve les constats et preuves initiaux.

## Direction retenue

L’application entreprise repose sur une identité authentifiée, un choix explicite d’équipe et des compétitions dont les règles et participants sont fixés à la publication.

- Les équipes sont créées, renommées et supprimées dans l’administration, avec stockage en base.
- L’organigramme sert uniquement à proposer une équipe à une personne : collègues actifs sous le même manager en priorité, puis manager actif, puis choix sans préconisation. Une égalité entre les collègues utilise le repli manager.
- La personne confirme son équipe et peut en changer librement. Aucune affectation ne suit automatiquement un manager, un poste ou un intitulé.
- Une suppression archive l’équipe et impose un nouveau choix aux membres. Les parties et battles antérieures conservent leurs affectations.
- Une battle fige les joueurs déjà inscrits et leurs équipes à sa publication. Les arrivées ultérieures et changements d’équipe concernent les compétitions suivantes.

L’administration constitue donc le bon endroit pour gérer les équipes ; `.env` contient la configuration technique et les secrets.

## État de l’ancien dev-book

| Point | État réel après reprise |
| --- | --- |
| BUG-1 · Fonctions dupliquées dans les classements | Déjà corrigé dans le code audité ; filtres conservés. |
| BUG-2 · Comparaison du secret admin | Ancien accès par en-tête supprimé. Administration par compte/rôle. Le secret local d’amorçage est comparé via des empreintes de taille fixe. |
| BUG-3 · Concurrence et transactions joueurs | Repris : identité liée au compte, pseudos uniques en base, rollback et libération des connexions, ordre des verrous. |
| BUG-4 · Identifiants SQL invalides | Validation entière stricte sur joueurs, équipes, parties et battles ; Express 5 intercepte les erreurs asynchrones. |
| BUG-5 · Secrets au démarrage | Validation JWT et configuration Entra/local ; les exemples `changeme` sont refusés. |
| BUG-6 · Équipe invalide | Choix authentifié, validation de l’identifiant et de l’état actif de l’équipe. |
| SEC-1 · CORS | Application sur une origine unique ; aucun wildcard par défaut. Contrôle d’origine des mutations. |
| SEC-2 · En-têtes Nginx | Réappliqués dans les locations HTML/JS/CSS ; CSP et protection d’intégration incluses. |
| SEC-3 · Healthcheck | Présent pour API et base ; le healthcheck API vérifie PostgreSQL. |
| SEC-4 · Cache HTML | HTML, JS et CSS revalidés afin de recevoir un déploiement cohérent. |
| QC-1 · Racine/standalone | Docker ne sert que `frontend/`. Catalogue historique retiré des sources actuelles, encore présent dans l’historique Git. |
| QC-2 · Fonction SQL morte | Déjà supprimée dans la version auditée. |
| QC-3 · `res.ok` des classements | Déjà présent ; erreur de réponse du jeu désormais récupérable depuis l’interface. |
| QC-4 · Logs | Démarrage et erreurs de requêtes/succès structurés ; migration/seed encore en logs texte. Centralisation et journal d’exploitation à prévoir. |
| QC-5 · Catalogue d’emails versionné | Import/export JSON v1 administrateur, validation préalable, retrait sélectif/global et remplacement atomique. Pas de seed de mails. Contenus immuables et archivés pour les anciennes séries. Usage entraînement/battle distinct ; journal des imports/retraits. Édition en place et publication éditoriale par lot restent à définir. |

## Corrections supplémentaires

L’audit a révélé des défauts absents du précédent document :

- Suppression de l’identité fondée sur un simple pseudo/email et de la création de parties pour un `playerId` arbitraire.
- Chrono calculé côté serveur, date limite persistée et non réinitialisée par une relecture ; horloge réelle contrôlée après attente d’un verrou.
- Jokers limités côté serveur, sérialisation des réponses et résultat idempotent par email. Un double clic ne compte pas deux fois.
- Reprise d’une partie en cours, y compris une battle à tentative unique ; les points, statistiques et échéance restent conservés.
- Affectation d’équipe enregistrée dans chaque partie et dans le roster de battle.
- Top 10 exactement borné, même moyenne dans le classement et son détail, départage déterministe, streaks mensuels fonctionnels.
- Séparation des classements d’entraînement et de battle ; exclusion des anciennes parties non vérifiées et des parties disqualifiées.
- Statistiques pédagogiques excluant les jokers des réponses humaines et des temps moyens.
- Catalogue de **85 badges** (le chiffre 72 de l’ancien document était erroné), seuil No Life atteignable, pile ou face atteignable, historique des équipes pour Touriste, podium évalué et badges lors de l’abandon.
- Syntaxe du profil corrigée, liens de feedback avec deux-points conservés, traitement des domaines plus précis et export CSV protégeant les cellules interprétables comme des formules.
- Node 24, Express 5 et dépendances mises à jour ; suite de tests et workflow CI ajoutés.

## Fonctions entreprise livrées

| Fonction | Livré | Limite / validation restante |
| --- | --- | --- |
| Connexion locale | Mots de passe scrypt, sessions opaques HttpOnly, déconnexion, premier admin protégé | Démonstration locale ; pas de récupération de mot de passe. |
| SSO Entra | Code + PKCE, état/nonce, contrôle signature/émetteur/audience/tenant, identité `oid`, rôles | Connexion réelle, consentements et politiques du tenant à tester. |
| Annuaire | Import complet transactionnel, désactivation des absents, synchronisation Graph paginée | Retour des managers et permissions applicatives Graph à confirmer dans le tenant réel. Pas de planification automatique. |
| Équipes | CRUD avec archivage, recommandation sans affectation, choix libre, historique | Rapprochement des anciens comptes non authentifiés à développer. |
| Battles | Individuel, intra-équipe, inter-équipes ; règles/roster figés, même séquence, reprise, tentatives limitées | Participants déjà inscrits uniquement. Aucun éditeur de draft après publication. |
| Résultats | Provisoires puis conservés à clôture ; absents à zéro pour la moyenne des équipes | Clôture à la consultation après échéance ou manuelle ; pas de tâche planifiée dédiée. |
| Modération | Motif obligatoire, acteur/date/avant-après, disqualification et contrôle de version | Les badges déjà obtenus ne sont pas automatiquement révoqués. |
| Interface | Identité Phish & Chips commune, clair/sombre partagé, connexion/inscription séparées, administration par rubriques, badges regroupés, messagerie simulée dans sa fenêtre | Voir [la refonte et ses vérifications](docs/UI_REFONTE_2026-10-01.md). SSO réel toujours à valider dans le tenant. |
| Déploiement | Compose sans build ni sources, images API et interface publiées sur GHCR après tests et démarrage de la stack packagée ; amd64/arm64, tags de version et de commit ; Compose de développement séparé | Première publication distante à exécuter après push sur la branche principale. Visibilité des packages GHCR à configurer. |
| Vérifications | Tests Node + PostgreSQL, migration ancienne base, identités OIDC signées, parcours navigateur et Docker | Le workflow GitHub n’a pas été exécuté à distance tant que les changements ne sont pas publiés. |

## Règles de résultats

En entraînement, classement individuel au meilleur score valide ; équipe à la moyenne des dix meilleurs joueurs ayant joué pour cette équipe. Les parties mémorisent l’équipe au démarrage : changer d’équipe ne transfère pas les scores précédents.

En battle, meilleur essai valide par inscrit. Le classement individuel départage ensuite au temps cumulé, à l’heure de fin puis à l’identifiant. Le classement inter-équipes moyenne **tous les inscrits**, absents compris à zéro, puis départage à la participation et à l’identifiant. Cette formule est affichée aux participants.

Une correction ne réécrit pas les réponses pédagogiques. Elle modifie le score/disqualification, l’historique de modération et les résultats d’une battle déjà clôturée. Les badges de podium constatent une place atteinte à la fin d’une partie ; ils ne promettent pas une attribution en fin de mois.

## Migration et données historiques

La migration 003 conserve les comptes, emails, réponses et résultats. Elle distingue les anciennes parties par `rules_version=0` et les nouvelles règles contrôlées par `rules_version=1`. Les scores historiques ne peuvent pas être déclarés fiables rétroactivement.

L’équipe des anciennes parties est reprise depuis l’affectation présente à la migration, car le logiciel précédent ne stockait pas ce lien. Les changements antérieurs ne sont pas reconstructibles. Les anciens pseudos dupliqués reçoivent un suffixe unique ; les anciens comptes ne sont pas revendiqués sur la seule correspondance d’un email.

Une migration d’une base utilisée demande une sauvegarde préalable. La version historique standalone à la racine est conservée et ne bénéficie pas des contrôles du serveur entreprise.

## Vérification et prochaines étapes

Les commandes reproductibles figurent dans le [README](README.md). Les tests utilisent une base `_test` neuve et jetable, séparée du volume de démonstration. Les résultats détaillés sont conservés dans `docs/audits/2026-09-28/`.

Priorités avant usage entreprise :

1. Valider la connexion et les trois rôles sur le tenant réel ; vérifier la désactivation des comptes et le retour des managers Graph.
2. Valider les règles de participation et de moyenne avec un petit groupe pilote.
3. Mettre en place HTTPS, adresses clientes du proxy, sauvegarde/restauration, rotation des secrets et règles de conservation des données.
4. Prévoir le rapprochement contrôlé des anciens comptes si leurs données doivent être réutilisées.

Évolutions suivantes : validation éditoriale des lots de mails et report des corrections de battle à la clôture, rafraîchissement planifié de l’annuaire et clôture des battles, révocation/recalcul des badges après modération, pagination et recherche avancée de l’historique administratif. Ces points restent ouverts et ne sont pas présentés comme livrés.

## Refonte de l’interface · octobre 2026

- Portail bleu nuit, papier clair et ambre, navigation commune avec page active ; apparence claire/sombre conservée entre les pages.
- Connexion et inscription dans des formulaires distincts. Le formulaire du premier administrateur local apparaît seulement si aucun admin n’existe ; le serveur conserve son contrôle transactionnel. Entra n’affiche que la connexion Microsoft.
- Entraînement : équipe actuelle avec lien pour la changer, difficultés avec leurs règles, fausse fenêtre de messagerie avec agrandissement/restauration et confirmation de sortie.
- Le mail courant est marqué dans la boîte de réception ; ses actions occupent une ligne séparée des champs De/Sujet. La lecture conserve ses propres couleurs de messagerie.
- Feedback : nouveaux lots en deux blocs courts (« À repérer » / « Ce qui concorde », puis « Le bon réflexe »), affichage commun au jeu et au récapitulatif ; anciennes catégories affichées en langage courant, noms techniques repliés. Prompts français/anglais revus : équilibre 50/50, diversité, seuls indices accessibles au joueur, longueur standard/express. Relecture éditoriale requise ; les corrections historiques ne sont pas réécrites automatiquement. Illustration SOS contenue dans la composition. Actions de fin de partie accessibles avant le cylindre, débrief indépendant des badges.
- Profil : 85 badges conservés et regroupés en 24 familles, filtres par état et catégorie, paliers consultables sans une longue liste de variantes.
- Administration : équipes, battles, modération, annuaire et statistiques dans des rubriques distinctes. Participants recherchables avec cases à cocher ; aperçu du roster et de la correction avant/après.
- Classements d’entraînement : filtres séparés joueurs/équipes, période et difficulté, ligne du joueur repérée, détails d’équipe au clavier. Les résultats des battles restent dans leur propre page.

Les 19 noms, phrases et seuils de rang approuvés sont intégrés ; les appréciations existantes et les règles de score restent conservées.
