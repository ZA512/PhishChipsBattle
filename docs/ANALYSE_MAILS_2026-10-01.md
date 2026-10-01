# Catalogue de mails : bilan pédagogique et évolution proposée

Analyse du 1er octobre 2026. Le catalogue étudié est celui du commit `ddd4037d9362da26a6158c9cf1306dcd14954e29`, avant son retrait du code de production. Aucun nouveau scénario pédagogique n’est généré ici. Les recommandations n’ajoutent pas encore de mécanismes de QR code, pièces jointes, en-têtes complets ou navigation après un clic.

## Verdict

Le catalogue constitue une bonne base pour un jeu rapide : scènes professionnelles et personnelles variées, expéditeurs inspectables, liens simulés, exemples légitimes et correction après la réponse. Son principal défaut est un déséquilibre des indices : beaucoup de pièges se gagnent en comparant deux adresses ou en repérant un domaine caricatural. Il prépare moins bien aux messages parfaitement rédigés, aux comptes légitimes compromis et aux demandes dangereuses sans lien.

Le ton piquant des rangs et appréciations peut rester intact. Les corrections, elles, doivent être factuelles : on peut se moquer du joueur sans lui apprendre une fausse règle de sécurité.

## Mesures sur les 162 mails existants

- 80 phishing, 82 légitimes : bon équilibre global. Les identifiants d’origine ne sont pas consécutifs ; ils ne sont pas un nombre de questions.
- 69 des 80 phishing présentent une différence entre l’adresse affichée entre chevrons et `realSender`. Dans les 11 autres, l’adresse reste un domaine d’imitation, pas l’adresse officielle d’un compte compromis. Cela rend le contrôle de l’expéditeur excessivement prédictif.
- 66 indices « URL Obfuscation / Redirect chaining », 47 « Domain fraud / Suspicious TLD », 34 « Email spoofing / Header anomaly », 33 « Fear / Intimidation », 29 « Data harvesting / Credential phishing », 25 « Urgency », 15 « Typosquatting », 11 « Curiosity », 5 « Malicious attachment », 4 « Content anomaly », 3 « Homograph attack ». Ces nombres comptent les **indices**, pas des mails distincts ; un mail cumule plusieurs catégories.
- 165 indices « Legitimate indicator » répartis sur les mails légitimes. Certains utilisent le domaine, HTTPS ou l’absence d’urgence comme justification trop forte.
- Des demandes de changement d’IBAN, remboursement et achat de cartes cadeaux existent déjà : la fraude financière n’est pas absente. La catégorie « Credential phishing » les décrit cependant mal.
- Les 5 exemples « pièce jointe malveillante » sont des liens de téléchargement ; le jeu n’affiche pas de véritable carte de pièce jointe.
- Deux corps contiennent encore des placeholders de dates. Le catalogue mélange français et anglais, plusieurs styles et des indices parfois très longs.
- Longueur du corps après retrait des balises et découpage sur les espaces : médiane de 16 mots, de 4 à 84 mots ; 123 des 162 mails ont moins de 35 mots. Ils ne sont donc pas trop longs en général. Le prochain lot peut apporter davantage de contexte, sans rallonger artificiellement les pièges triviaux.
- Absence de scénario explicite de QR code, demande de validation d’un code d’appareil, consentement OAuth ou faux CAPTCHA demandant d’exécuter une commande. Pas de chaîne de compromission complète simulée.

## Couverture et intérêt des ajouts

| Technique / réflexe | Couverture actuelle | Décision proposée |
| --- | --- | --- |
| Nom affiché usurpé, adresse réelle incohérente | Très présente | Conserver, mais réduire sa fréquence. Un nom ou une adresse affichée n’est pas une preuve d’identité. |
| Domaine ressemblant, faux sous-domaine, lien dont le texte masque la destination | Bien couverte ; sous-domaines présents même sans catégorie dédiée | Conserver. Faire reconnaître le domaine qui contrôle l’adresse, sans traiter `.co`, `.ru`, un tiret ou HTTP comme verdict automatique. |
| Urgence, peur, curiosité, récompense | Bien couverte | Conserver. Ajouter des mails légitimes urgents et des attaques calmes, sans fautes. |
| Vol de mots de passe et fausse connexion | Présent, souvent évident | Conserver avec des liens moins caricaturaux. Expliquer le réflexe d’ouvrir soi-même le service connu. |
| Fraude au président / fournisseur / salaire, changement de RIB | Présente, souvent trahie par l’adresse réelle | Priorité forte : adresse apparente correcte, demande inhabituelle, secret, contournement de procédure. Vérifier sur un canal déjà connu. |
| Adresse officielle usurpée ou compte légitime compromis | Non représenté de manière convaincante | Priorité forte. Faisable sans nouvelle mécanique : `sender` et `realSender` peuvent rester identiques et plausibles ; le piège doit être discernable dans la demande ou le lien. |
| Réponse à un fil connu détourné | Peu représenté | Utile : court historique visible et demande de paiement/document différente. Ne pas exiger que le joueur connaisse un contexte qui n’est pas affiché. |
| Notification légitime de partage de document utilisée comme appât | Des notifications existent, pas ce contraste explicite | Utile. La marque du service ne garantit pas le contenu partagé ; ne pas déclarer frauduleux un mail à partir d’une destination finale cachée au joueur. |
| Code MFA / code d’appareil / autorisation d’application | MFA évoquée dans un mail légitime, pas d’apprentissage du détournement | Priorité forte. Un site officiel peut servir à autoriser une connexion ou une application de l’attaquant. Le joueur doit voir la demande suspecte : donner un code, valider sans connexion initiée, accorder des permissions inhabituelles. |
| Pièce jointe, macros, archive chiffrée, faux correctif | 5 indices, avec des liens de téléchargement | Utile, mais une carte de pièce jointe simulée serait nécessaire pour représenter certains cas correctement. Aucune exécution réelle. |
| QR code / passage sur téléphone | Absent | Intéressant ensuite, avec aperçu local de la destination. Pas de scan réel ni de lien externe. Un QR code seul ne permet pas de conclure. |
| ClickFix / faux CAPTCHA ou erreur invitant à exécuter une commande | Absent | Un ou deux exemples suffisent. On peut montrer la demande dans le mail ; reproduire tout le faux site est facultatif. Ne pas fournir une commande dangereuse fonctionnelle. |
| AiTM, vol de session, CAPTCHA d’évasion, HTML smuggling | Non simulés | Ne pas transformer le jeu en laboratoire. Expliquer les risques dans le débrief ; apprendre le réflexe de connexion initiée par soi-même. Les mécanismes internes ne sont généralement pas identifiables dans le mail seul. |
| Appel à un faux support (callback phishing) | Absent ou marginal | Utile plus tard : ne pas appeler le numéro reçu pour vérifier le même message. Utiliser l’annuaire / le site déjà connu. |

Les attaques BEC peuvent employer un compte légitime compromis, pas seulement une adresse d’imitation : [Microsoft, Business Email Compromise](https://news.microsoft.com/on-the-issues/2020/07/23/business-email-compromise-cybercrime-phishing/). Les demandes de code d’appareil sont documentées dans [Storm-2372](https://www.microsoft.com/en-us/security/blog/2025/02/13/storm-2372-conducts-device-code-phishing-campaign/), et les autorisations d’application dans [Microsoft Entra, consent phishing](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/protect-against-consent-phishing). Leur intégration au jeu reste une recommandation pédagogique, pas une fonctionnalité déjà livrée.

## DMARC : ce que le joueur peut et ne peut pas savoir

Une adresse `From` peut être usurpée. Une absence de DMARC, une politique de surveillance seule ou une mauvaise configuration peuvent réduire la protection contre cette usurpation. Cela ne garantit pas que le message arrivera dans la boîte : SPF, DKIM, la passerelle et les autres contrôles interviennent aussi. Microsoft décrit des cas récents de messages apparaissant internes à cause du routage et de protections mal configurées, avec des conditions précises ; ce n’est pas un défaut universel d’Exchange : [analyse Microsoft du 6 janvier 2026](https://www.microsoft.com/en-us/security/blog/2026/01/06/phishing-actors-exploit-complex-routing-and-misconfigurations-to-spoof-domains/).

DMARC contrôle l’authentification et l’alignement du domaine, pas l’honnêteté du contenu. Un compte réellement compromis peut émettre du phishing authentifié. Un domaine d’imitation peut également authentifier correctement ses propres messages. Une différence entre `From` et l’enveloppe SMTP n’est pas automatiquement une attaque : prestataires d’envoi et listes de diffusion peuvent aussi l’expliquer. `realSender` reste une donnée simulée et ne doit pas être présentée comme une vérité absolue sur l’identité de la personne.

**Oui, intégrer quelques mails frauduleux avec une adresse apparemment correcte est utile.** Un lien hors domaine peut aider, mais il n’est ni obligatoire ni une preuve suffisante à lui seul : un virement ou l’achat de cartes cadeaux peut être demandé sans aucun lien. Le réflexe à enseigner est de vérifier une action sensible par un canal indépendant déjà connu, en respectant la procédure de l’entreprise. La recommandation est cohérente avec [Microsoft, protection contre le phishing](https://learn.microsoft.com/en-us/defender-endpoint/malware/phishing).

Je ne recommande pas d’ajouter des résultats SPF/DKIM/DMARC à déchiffrer dans le mode standard. Cela alourdirait le jeu et donnerait une fausse assurance si « PASS » devenait synonyme de « sûr ». Une vue technique facultative pourra être envisagée séparément.

## Règles pour le prochain lot, sans produire les mails maintenant

1. Maintenir environ autant de mails légitimes que de phishing, mais varier leur ordre. Une série de battle doit avoir une composition vérifiée ; le mélange aléatoire actuel ne garantit pas automatiquement cet équilibre.
2. Mettre régulièrement des attaques dont l’adresse semble correcte, des attaques sans lien et des attaques sans fautes. La proportion précise sera décidée avec le lot ; les familles peuvent se recouper.
3. Les mails légitimes peuvent être urgents, contenir un lien, venir d’un prestataire connu et avoir un style imparfait. Aucune de ces caractéristiques ne prouve à elle seule la fraude.
4. Un scénario doit donner assez de contexte visible pour un verdict défendable. Si un mail réel serait indécidable sans appel au fournisseur, enseigner la vérification ; ne pas inventer un indice caché dans la correction. Le bouton « Signaler phishing » reste un raccourci ludique pour un message qui mérite une vérification, pas un diagnostic forensic certain.
5. Chaque correction explique le **fait visible**, son **risque**, puis le **bon geste**. Deux ou trois indices courts valent mieux que cinq catégories techniques. Les formulations peuvent rester mordantes, sans devenir fausses.
6. Séparer « fraude au paiement », « divulgation de données », « vol d’identifiants », « code de connexion / validation MFA » et « autorisation d’application ». Ce sont des gestes différents à éviter.
7. Ne pas appeler « chaîne de redirection » un simple texte de lien différent de sa cible. Le moteur montre une destination **simulée** : dans une vraie boîte mail, le survol ne révèle pas nécessairement la destination finale d’une chaîne de redirection.
8. Éviter les placeholders, les chemins baptisés `stealpassword` ou `malware`, et les noms de domaine qui donnent la réponse. Décrire les extensions de fichiers sans associer automatiquement un PDF à « sûr ».
9. Garder les pièces jointes et QR codes hors du premier lot tant que le moteur ne permet pas d’inspecter leurs indices de façon équitable. Décrire une demande de scan sans montrer sa destination ne suffit pas.
10. Ne pas imposer une limite de 5 secondes pour comprendre une fraude financière longue : raccourcir les scénarios standard, et réserver les cas longs à une future formule pédagogique adaptée. La mécanique actuelle mesure aussi la vitesse de lecture.

ClickFix consiste à pousser la victime à exécuter elle-même une instruction sous prétexte de réparer ou vérifier quelque chose : [Microsoft, Think before you Click(Fix)](https://www.microsoft.com/en-us/security/blog/2025/08/21/think-before-you-clickfix-analyzing-the-clickfix-social-engineering-technique/). Il suffit ici d’apprendre « je n’exécute pas une commande reçue pour ouvrir un document » ; la chaîne technique complète n’est pas nécessaire au jeu.

## Gestion du catalogue livrée à cette étape

Installation neuve vide, import/export JSON par administrateur, contrôle préalable, retrait individuel/multiple/global, remplacement transactionnel, recherche/pagination, journal d’opérations et usages `training`/`battle`/`both`. Les questions restent immuables ; un retrait conserve les données nécessaires aux parties et battles déjà créées.

Après retour du propriétaire du projet, les prompts français et anglais ont été réécrits : pièges repérables avec les seules données accessibles, 20 mails équilibrés et répartis par familles, corps de 35 à 80 mots en standard avec quelques messages courts, variante express, correction en deux blocs (« À repérer » / « Ce qui concorde », puis « Le bon réflexe »). Aucune nouvelle mécanique de jeu ni aucun lot pédagogique n’est ajouté. Le jeu et le récapitulatif partagent le même affichage simple ; les anciennes catégories restent disponibles en détail replié. Les corrections historiques ne sont pas réécrites automatiquement. Ces règles sont des consignes de génération et de relecture, pas des garanties du validateur JSON.

Les anciens mails restent publics dans l’historique Git et les anciennes images. Ils ne deviennent pas secrets en les retirant. Le remplacement doit utiliser un lot réellement nouveau et conservé hors du dépôt. Les corrections de battle sont encore retournées immédiatement après la réponse et dans le récapitulatif de fin de tentative : elles peuvent être partagées pendant une compétition. Reporter ce débrief à la clôture reste à réaliser. Aucun mécanisme ne garantit qu’une IA ne puisse classifier le contenu comme un joueur.
