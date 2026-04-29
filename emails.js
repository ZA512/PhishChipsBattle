const emails = [
    {
        id: 1,
        sender: "Support <support@micr0soft.com>",
        realSender: "scammer@phishdomain.xyz",
        subject: "Action requise : votre compte va être désactivé",
        body: "Bonjour,\n\nUne activité suspecte a été détectée sur votre compte.\nCliquez ici pour vérifier votre identité : <a href='http://micr0soft-login.co/verify?id=123' data-real-link='http://malicious-site.ru/steal'>Vérifier mon compte</a>.\n\nSi vous ne le faites pas sous 24h, votre compte sera fermé.\n\nCordialement,\nL'équipe Sécurité",
        type: "phishing",
        clues: [
        "Email spoofing / Header anomaly : Adresse affichée « support@micr0soft.com » alors que le véritable expéditeur est « scammer@phishdomain.xyz ».",
        "Typosquatting : Domaine « micr0soft.com » avec un “0” à la place du “o”.",
        "URL Obfuscation / Redirect chaining : Lien visible « micr0soft-login.co/verify… » qui redirige vers « malicious-site.ru » (différent au survol).",
        "Domain fraud / Suspicious TLD : Le domaine final est en « .ru », inhabituel pour Microsoft.",
        "Social engineering - Urgency : Menace de fermeture du compte sous 24 h pour forcer une action rapide.",
        "Data harvesting / Credential phishing : Demande de vérification d’identité via un site externe potentiellement malveillant."
        ]
    },
    {
        id: 2,
        sender: "Service Client BanqueFictive <noreply@banquefictive-enligne.com>",
        realSender: "noreply@banquefictive-enligne.com",
        subject: "Votre relevé mensuel est disponible",
        body: "Cher client,\n\nVotre relevé bancaire pour le mois dernier est maintenant disponible dans votre espace client.\nConnectez-vous via notre site officiel : <a href='https://www.banquefictive-enligne.com/login' data-real-link='https://www.banquefictive-enligne.com/login'>Accéder à mon espace</a>.\n\nNous vous remercions de votre confiance.\n\nLe Service Client",
        type: "safe",
        clues: [
        "Legitimate indicator : L'adresse de l'expéditeur correspond au domaine du lien et le site utilise HTTPS.",
        "Legitimate indicator : Contenu informatif standard, aucune demande sensible ni sentiment d'urgence."
        ]
    },
    {
        id: 3,
        sender: "Amazon <commande-update@amazon-livraison.net>",
        realSender: "mailer@cheaphosting.biz",
        subject: "Problème avec la livraison de votre commande AZN123456",
        body: "Bonjour,\n\nNous n'avons pas pu livrer votre colis. Adresse incomplète.\nVeuillez mettre à jour vos informations ici : <a href='http://amazon-livraison.net/update-adress' data-real-link='http://phishersite.com/get-info'>Mettre à jour l'adresse</a>.\nDes frais de re-livraison peuvent s'appliquer.\n\nMerci,\nSupport Amazon",
        type: "phishing",
        clues: [
        "Email spoofing / Header anomaly : Adresse affichée « commande-update@amazon-livraison.net » alors que l'expéditeur réel est « mailer@cheaphosting.biz ».",
        "Domain fraud / Suspicious TLD : « amazon‑livraison.net » n’est pas un domaine officiel d’Amazon et le TLD .net est inhabituel dans ce contexte.",
        "URL Obfuscation / Redirect chaining : Lien visible « amazon-livraison.net/update-adress » qui redirige vers « phishersite.com  ». ",
        "Social engineering - Urgency : Mention de frais de re‑livraison pour inciter à une action rapide.",
        "Data harvesting / Credential phishing : Demande de mise à jour d’informations personnelles via un site externe.",
        "Content anomaly : Faute d’orthographe dans l’URL (« update-adress » au lieu de « update-address »)."
        ]
    },
    {
        id: 4,
        sender: "RH Entreprise <rh@showroomprive.com>",
        realSender: "rh@showroomprive.com",
        subject: "Rappel : Formation Cybersécurité Obligatoire",
        body: "Bonjour à tous,\n\nN'oubliez pas la session de formation sur la cybersécurité demain à 14h en salle B2.\nVotre présence est requise.\n\nPlus d'informations sur l'extranet : <a href='https://extranet.showroomprive.com/rh/formations' data-real-link='https://extranet.showroomprive.com/rh/formations'>Détails Formation</a>\n\nCordialement,\nLe Service RH",
        type: "safe",
        clues: [
        "Legitimate indicator : Expéditeur interne légitime (« @showroomprive.com »).",
        "Legitimate indicator : Lien pointe vers l'extranet sécurisé de l'entreprise.",
        "Legitimate indicator : Contenu professionnel standard (rappel de formation interne)."
        ]
    },
    {
        id: 5,
        sender: "CEO <ceo@showroomprive.com>",
        realSender: "impostor@gmail.com",
        subject: "URGENT - Demande confidentielle",
        body: "J'ai besoin de ton aide pour une transaction urgente et discrète.\nPeux-tu acheter 5 cartes cadeaux Amazon de 100€ et m'envoyer les codes par retour de mail ?\nJe suis en réunion, ne m'appelle pas.\nC'est pour un client important. Je te rembourse dès que possible.\n\nMerci,\nDavid",
        type: "phishing",
        clues: [
        "Email spoofing / Header anomaly : Adresse affichée « ceo@showroomprive.com » mais le véritable expéditeur est « impostor@gmail.com ».",
        "Social engineering - Urgency : Demande d'achat de cartes‑cadeaux « URGENT ».",
        "Social engineering - Fear / Intimidation : Pression hiérarchique (se fait passer pour le CEO) et instruction de ne pas appeler pour vérifier.",
        "Data harvesting / Credential phishing : Exige des codes de cartes‑cadeaux par e‑mail, valeur monétaire transférable."
        ]
    },
    {
        "id": 6,
        "sender": "Paypall <service@paypall-secur.com>",
        "realSender": "notification@phishing-central.org",
        "subject": "Activité inhabituel sur votre compte",
        "body": "Bonjour,\n\nNous avons detecté une connexion inhabituelle sur votre compte Paypall.\nPour votre securité, veuillez confirmer vos informations.\nCliquez ici: <a href='http://paypall-secur.com/login?session=xyz' data-real-link='http://fake-paypal-clone.io/steal'>Confirmer votre compte</a>\n\nIgnorez ce message si ce n'est pas vous.\n\nL'equipe Paypall",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'paypall-secur.com' imite 'paypal.com' avec un 'l' supplémentaire et un mot ajouté.",
          "URL Obfuscation / Redirect chaining: Le lien visible redirige vers un domaine sans lien avec PayPal : 'fake-paypal-clone.io'.",
          "Content anomaly: Plusieurs fautes d’orthographe inhabituelles dans un message censé être professionnel.",
          "Data harvesting / Credential phishing: Le lien incite à fournir des identifiants sous prétexte de vérification."
        ]
    },
    {
        "id": 7,
        "sender": "Google <no-reply@google-support-alerts.com>",
        "realSender": "no-reply@google-support-alerts.com",
        "subject": "Alerte de sécurité critique",
        "body": "Quelqu'un vient d'utiliser votre mot de passe pour tenter de se connecter à votre compte Google depuis un appareil inconnu.\n\nDate et heure : [Date/heure actuelle]\nAppareil : Windows (Inconnu)\n\nGoogle a bloqué cette tentative, mais vous devriez vérifier l'activité récente : <a href='https://myaccount.google.com.security.updates.tk/reviewactivity' data-real-link='http://fake-google-loginpage.tk/stealpass'>Vérifier l'activité</a>\n\nL'équipe Comptes Google",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'google-support-alerts.com' imite Google mais n'est pas officiel.",
          "URL Obfuscation / Redirect chaining: Le lien visible semble sûr mais redirige vers un domaine suspect non lié à Google.",
          "Social engineering - Fear / Intimidation: Message évoquant une tentative d’intrusion pour inciter à agir dans la panique."
        ]
      },
      {
        "id": 8,
        "sender": "Votre Fournisseur Cloud <billing@cloud-provider-invoices.com>",
        "realSender": "billing@cloud-provider-invoices.com",
        "subject": "Facture #INV-56789 due",
        "body": "Bonjour,\n\nCeci est un rappel que votre facture #INV-56789 pour vos services cloud est due le [Date proche].\nMontant : 123.45€\n\nVous pouvez consulter et payer votre facture ici : <a href='https://portal.cloud-provider-invoices.com/billing/inv-56789' data-real-link='https://portal.cloud-provider-invoices.com/billing/inv-56789'>Voir la facture</a>\n\nMerci d'utiliser nos services.\n\nSupport Facturation",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Le domaine de l'expéditeur et celui du lien sont cohérents et bien formés.",
          "Legitimate indicator: Le message est un rappel de facture sans ton alarmiste ni lien suspect."
        ]
      },
      {
        "id": 9,
        "sender": "Showroomprive <service-client@showroomprive.com>",
        "realSender": "service-client@showroomprive.com",
        "subject": "Confirmation de votre commande #SP78542",
        "body": "Bonjour,\n\nNous vous remercions pour votre commande sur Showroomprive.\nVotre commande #SP78542 a été confirmée et est en cours de préparation.\n\nSuivez votre livraison ici : <a href='https://www.showroomprive.com/tracking/SP78542' data-real-link='https://www.showroomprive.com/tracking/SP78542'>Suivi de commande</a>\n\nÀ très bientôt sur Showroomprive!\n\nL'équipe du Service Client",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Le domaine utilisé est bien celui de la société officielle.",
          "Legitimate indicator: Le lien de suivi correspond au domaine de l'expéditeur et au service attendu."
        ]
      },
      {
        "id": 10,
        "sender": "Showroomprive <info@showroomprive-offres.net>",
        "realSender": "spammer@fake-offers.com",
        "subject": "🔥 URGENT: Votre bon d'achat de 500€ expire aujourd'hui !",
        "body": "Félicitations !\n\nVous avez été sélectionné pour recevoir un bon d'achat de 500€ !\nCette offre exclusive expire dans les prochaines heures.\n\nRéclamez votre bon maintenant : <a href='http://showroomprive-offres.net/claim-reward' data-real-link='http://malicious-reward-scam.com/collect-info'>Récupérer mon bon d'achat</a>\n\nAttention : offre limitée aux 50 premiers clients !\n\nL'équipe des offres exceptionnelles",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'showroomprive-offres.net' ressemble à l’original mais n’est pas authentique.",
          "Social engineering - Urgency: Message pousse à agir rapidement avec un délai et une offre limitée.",
          "Social engineering - Curiosity: Appât d’un gain important sans raison évidente pour pousser à cliquer.",
          "URL Obfuscation / Redirect chaining: Lien affiché différent du lien réel, qui pointe vers un domaine douteux.",
          "Email spoofing / Header anomaly: L’expéditeur réel ne correspond pas au domaine affiché dans l’adresse."
        ]
      },
      {
        "id": 11,
        "sender": "Service Technique <it@showroomprive.com>",
        "realSender": "it@showroomprive.com",
        "subject": "Nouvelle politique de sécurité des mots de passe",
        "body": "Chers collègues,\n\nNotre équipe IT a mis à jour la politique de sécurité des mots de passe de l'entreprise.\n\nÀ partir du 1er avril 2025, tous les mots de passe devront :\n- Contenir au moins 12 caractères\n- Inclure majuscules, minuscules, chiffres et symboles\n- Être changés tous les 3 mois\n\nPlus de détails sur l'extranet : <a href='https://extranet.showroomprive.com/security/password-policy' data-real-link='https://extranet.showroomprive.com/security/password-policy'>Consulter la politique complète</a>\n\nMerci de votre coopération,\nService Informatique",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Le lien pointe vers l'extranet officiel de l'entreprise, sans redirection.",
          "Legitimate indicator: Contenu informatif interne sur la sécurité sans incitation à fournir des données."
        ]
      },
      {
        "id": 12,
        "sender": "Showroomprіve <notification@showroomprіve.net>",
        "realSender": "hacker@cyberattack.org",
        "subject": "Problème de paiement sur votre compte",
        "body": "Cher client,\n\nNotre système a détecté un problème avec votre moyen de paiement.\nPour éviter la suspension de votre compte, veuillez confirmer vos informations bancaires :\n<a href='https://showroomprіve.net/update-payment' data-real-link='http://payment-steal.co/card-info'>Mettre à jour mes informations</a>\n\nAttention : si vous ne régularisez pas votre situation sous 24h, votre compte sera bloqué.\n\nService des paiements",
        "type": "phishing",
        "clues": [
          "Typosquatting: Utilisation du caractère 'і' cyrillique imitant le 'i' latin dans le domaine.",
          "Social engineering - Fear / Intimidation: Menace de blocage du compte pour forcer une réaction.",
          "Data harvesting / Credential phishing: Incitation à fournir des informations bancaires sensibles.",
          "URL Obfuscation / Redirect chaining: Le lien réel pointe vers un domaine inconnu et malveillant."
        ]
      },
      {
        "id": 13,
        "sender": "LinkedIn <messages-noreply@linkedin.com>",
        "realSender": "messages-noreply@linkedin.com",
        "subject": "Jean Dupont vous a envoyé un message sur LinkedIn",
        "body": "Bonjour,\n\nVous avez reçu un nouveau message de Jean Dupont sur LinkedIn :\n\n\"Bonjour, j'ai vu votre profil et je souhaiterais échanger sur des opportunités professionnelles dans votre secteur. Pourrions-nous discuter ?\"\n\nPour répondre, connectez-vous à LinkedIn : <a href='https://www.linkedin.com/messaging/' data-real-link='https://www.linkedin.com/messaging/'>Voir le message</a>\n\nL'équipe LinkedIn\n\nPour gérer vos notifications : Paramètres > Communications",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'linkedin.com' utilisé pour l’envoi et les liens.",
          "Legitimate indicator: Format standard d’une notification de message LinkedIn sans éléments suspects."
        ]
      },
      {
        "id": 14,
        "sender": "Service Clients <support@sh0wroomprіve.net>",
        "realSender": "fisher@scam-network.ru",
        "subject": "Remboursement en attente - Action requise",
        "body": "Bonjour,\n\nNous avons essayé de traiter votre remboursement de 149,95€ suite à votre retour, mais votre carte bancaire a été refusée.\n\nPour recevoir votre argent, confirmez vos coordonnées bancaires ici : <a href='http://sh0wroomprіve.net/refund-form' data-real-link='http://banking-steal.ru/collect'>Recevoir mon remboursement</a>\n\nCe lien expire dans 24h.\n\nService Remboursements",
        "type": "phishing",
        "clues": [
          "Typosquatting: Substitution de caractères visuellement proches dans le domaine ('0' pour 'o', 'і' cyrillique).",
          "Social engineering - Urgency: Le message impose un délai de 24h pour inciter à une réaction rapide.",
          "Data harvesting / Credential phishing: Demande explicite de données bancaires pour un faux remboursement.",
          "Domain fraud / Suspicious TLD: Le lien réel dirige vers un domaine russe peu fiable."
        ]
      },
      {
        "id": 15,
        "sender": "Alerte Météo France <no-reply@meteofrance.fr>",
        "realSender": "no-reply@meteofrance.fr",
        "subject": "Alerte Vigilance Orange - Orages violents",
        "body": "ALERTE MÉTÉO - VIGILANCE ORANGE\n\nMétéo France vous informe qu'une vigilance orange pour orages violents a été émise pour votre département.\n\nPrévisions : Orages potentiellement violents avec grêle et rafales dépassant 100 km/h entre 18h et 23h ce soir.\n\nConsultez les consignes de sécurité : <a href='https://vigilance.meteofrance.fr/fr/conseils' data-real-link='https://vigilance.meteofrance.fr/fr/conseils'>Consignes vigilance orange</a>\n\nRestez informés sur notre site officiel : <a href='https://meteofrance.fr' data-real-link='https://meteofrance.fr'>Météo France</a>\n\nService Vigilance Météo France",
        "type": "safe",
        "clues": [
          "Legitimate indicator: L’email provient du domaine officiel de Météo France.",
          "Legitimate indicator: Contenu informatif conforme à un service public sans demande sensible."
        ]
      },
      {
        "id": 16,
        "sender": "Netflix <info@netfl1x-service.com>",
        "realSender": "scammer@fake-streaming.org",
        "subject": "Votre compte va être suspendu - Paiement refusé",
        "body": "Cher abonné,\n\nVotre dernier paiement pour Netflix a échoué.\nSans action de votre part, votre compte sera suspendu dans les 24 heures.\n\nMettez à jour vos informations de paiement ici : <a href='https://netfl1x-service.com/account/payment' data-real-link='http://creditcard-harvester.com/netflix-fake'>Mettre à jour mes informations</a>\n\nNous vous remercions pour votre confiance,\nL'équipe Netflix",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine 'netfl1x-service.com' remplace la lettre 'i' par le chiffre '1', imitant Netflix pour tromper visuellement l’utilisateur inattentif et gagner sa confiance.",
          "Email spoofing / Header anomaly: L’adresse réelle vient de 'fake-streaming.org', différente du domaine affiché, révélant une usurpation d’identité dans l’en‑tête pour berner les filtres et les utilisateurs.",
          "URL Obfuscation / Redirect chaining: Le lien visible semble mener à Netflix mais redirige vers 'creditcard-harvester.com', exploitant une redirection pour masquer le domaine malveillant final.",
          "Social engineering - Urgency: Suspension de compte annoncée sous 24 h afin de pousser l’abonné à agir immédiatement sans prendre le temps de vérifier la légitimité.",
          "Data harvesting / Credential phishing: Le message sollicite la mise à jour des informations de paiement, capturant ainsi les données bancaires saisies sur le faux site."
        ]
      },
      {
        "id": 17,
        "sender": "Vinted <no-reply@vinted.fr>",
        "realSender": "no-reply@vinted.fr",
        "subject": "Nouvelle offre sur votre article 'Veste en cuir'",
        "body": "Bonjour,\n\nBonne nouvelle ! Un membre de Vinted s'intéresse à votre article \"Veste en cuir\".\n\nOffre reçue : 45€ (votre prix : 50€)\n\nPour répondre à cette offre, connectez-vous à votre compte Vinted : <a href='https://www.vinted.fr/messages/12345' data-real-link='https://www.vinted.fr/messages/12345'>Voir l'offre et répondre</a>\n\nÀ bientôt sur Vinted !\n\nL'équipe Vinted\n\nDésabonnement : Paramètres > Notifications",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Le domaine expéditeur 'vinted.fr' est authentique et le lien HTTPS conduit directement au site, sans redirection ni paramètre suspect caché.",
          "Legitimate indicator: Notification d’offre classique, aucune demande de données sensibles ni ton alarmiste, cohérente avec l’activité habituelle de la plateforme Vinted en ligne."
        ]
      },
      {
        "id": 18,
        "sender": "Service Fiscal <impots-remboursement@finances-gouv.info>",
        "realSender": "hacker@tax-scam.net",
        "subject": "Remboursement d'impôt de 847,53€ en attente",
        "body": "DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES\n\nBonjour,\n\nSuite au traitement de votre déclaration fiscale, un remboursement de 847,53€ a été approuvé en votre faveur.\n\nPour recevoir votre remboursement sous 5 jours ouvrés, confirmez vos coordonnées bancaires : <a href='https://impots-remboursement.finances-gouv.info/verification' data-real-link='http://tax-refund-scam.com/banking'>Confirmer mes coordonnées</a>\n\nService des remboursements\nDirection Générale des Finances Publiques",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: L’adresse 'finances-gouv.info' reprend la structure gouvernementale mais utilise le TLD '.info' au lieu de '.gouv.fr', signalant une fraude potentielle grave.",
          "Email spoofing / Header anomaly: L’expéditeur affiché semble officiel, pourtant l’adresse réelle provient de 'tax-scam.net', indiquant une falsification des en‑têtes domaines courriel masqués malveillants.",
          "URL Obfuscation / Redirect chaining: Le lien présenté renvoie à un sous‑domaine pseudo‑fiscal mais redirige finalement vers 'tax-refund-scam.com', masque employé pour pièger l’utilisateur et voler ses données.",
          "Data harvesting / Credential phishing: Le courriel exige la confirmation de coordonnées bancaires, méthode classique pour collecter et détourner des informations financières sensibles utilisateur victime.",
          "Social engineering - Curiosity: Promesse d’un remboursement fiscal précis suscite l’avidité et incite la victime à cliquer sans remettre en question l’authenticité du message."
        ]
      },
      {
        "id": 19,
        "sender": "Showroomprive <evenements@showroomprive.com>",
        "realSender": "evenements@showroomprive.com",
        "subject": "Derniers jours : Vente privée montres de luxe -70%",
        "body": "Bonjour,\n\nNotre vente exceptionnelle de montres de luxe se termine dans 48h.\nDécouvrez notre sélection de grandes marques à prix réduits.\n\nAccéder à la vente : <a href='https://www.showroomprive.com/ventes/montres-luxe' data-real-link='https://www.showroomprive.com/ventes/montres-luxe'>Voir la vente</a>\n\nLivraison offerte avec le code LUXE25\n\nL'équipe Showroomprive",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine expéditeur 'showroomprive.com' officiel, lien HTTPS correspondant sans redirection cachée, cohérence technique vérifiable et certificat valide selon navigateurs modernes standard.",
          "Legitimate indicator: Message promotionnel classique, aucune demande de données sensibles et délai commercial raisonnable sans pression excessive sur l’utilisateur pour acheter immédiatement."
        ]
      },
      {
        "id": 20,
        "sender": "Assistance Impôts <support@impots.gouv.fr>",
        "realSender": "support@impots.gouv.fr",
        "subject": "Confirmation de votre déclaration en ligne",
        "body": "Direction Générale des Finances Publiques\n\nMadame, Monsieur,\n\nNous vous confirmons la bonne réception de votre déclaration de revenus en ligne effectuée le 25/03/2025.\n\nUn accusé de réception est disponible dans votre espace personnel : <a href='https://www.impots.gouv.fr/portail/particulier' data-real-link='https://www.impots.gouv.fr/portail/particulier'>Consulter mon espace</a>\n\nNous vous remercions d'avoir utilisé nos services en ligne.\n\nLa Direction Générale des Finances Publiques",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine gouvernemental 'impots.gouv.fr' authentique, protégé par HTTPS et reconnu publiquement pour les services fiscaux officiels en France depuis des années.",
          "Legitimate indicator: Email de confirmation d’action déjà réalisée, aucune urgence ni demande de coordonnées sensibles, ton purement informatif et conforme aux procédures."
        ]
      },
      {
        "id": 21,
        "sender": "Showroomprivé <ventes-flash@showroomprive-vip.com>",
        "realSender": "scammer@phishing-hub.org",
        "subject": "⚠️ Votre compte sera supprimé dans 24h",
        "body": "IMPORTANT : Action requise\n\nVotre compte Showroomprivé a été signalé pour une activité inhabituelle et sera supprimé dans 24h.\n\nPour conserver votre compte et vos avantages membre, veuillez confirmer votre identité ici : <a href='https://showroomprive-vip.com/verify' data-real-link='http://identity-theft.net/collect'>Vérifier mon compte</a>\n\nService Sécurité",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'showroomprive-vip.com' ajoute 'vip' et n’appartient pas à l’entreprise, signalant une fraude potentielle aux clients peu vigilants souvent dupés.",
          "Email spoofing / Header anomaly: L’adresse réelle vient de 'phishing-hub.org', différente du domaine affiché, montrant une falsification de l’identité d’expéditeur par modification d’en‑tête SMTP frauduleuse.",
          "URL Obfuscation / Redirect chaining: Lien affiché vers 'showroomprive-vip.com' redirige réellement vers 'identity-theft.net', technique classique pour masquer le domaine malveillant final aux utilisateurs non experts.",
          "Social engineering - Fear / Intimidation: Menace de suppression de compte sous 24 h pour faire réagir l’utilisateur sous la peur de perdre l’accès et ses avantages.",
          "Data harvesting / Credential phishing: Invitation à confirmer son identité via un site frauduleux, objectif de collecter identifiants et informations personnelles utiles au piratage futur."
        ]
      },
      {
        "id": 22,
        "sender": "Chronopost <tracking@chronopost.fr>",
        "realSender": "tracking@chronopost.fr",
        "subject": "Votre colis CP154789632 sera livré demain",
        "body": "Bonjour,\n\nVotre colis Chronopost CP154789632 sera livré demain entre 9h et 12h.\n\nSi vous souhaitez modifier ce créneau, connectez-vous sur : <a href='https://www.chronopost.fr/tracking/CP154789632' data-real-link='https://www.chronopost.fr/tracking/CP154789632'>Gérer ma livraison</a>\n\nVous pouvez présenter ce message au livreur pour faciliter la remise.\n\nL'équipe Chronopost",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine expéditeur 'chronopost.fr' officiel, lien HTTPS direct vers le suivi du colis correspondant, aucune redirection externe ni paramètre suspect caché.",
          "Legitimate indicator: Message d’information logistique courant, ne demande pas de données sensibles et propose simplement de modifier la livraison si souhaité facilement."
        ]
      },
      {
        "id": 23,
        "sender": "Sеrvice Client Showroomprivе <securite@showroomprive.nеt>",
        "realSender": "hacker@mail-spoof.com",
        "subject": "Tentative de connexion détectée de Moscou",
        "body": "ALERTE DE SECURITE\n\nNous avons détecté une tentative de connexion suspecte à votre compte depuis Moscou (Russie) le 26/03/2025 à 03:42.\n\nSi ce n'était pas vous, sécurisez immédiatement votre compte : <a href='https://secure-showroomprive.nеt/password-reset' data-real-link='http://credential-stealer.xyz/form'>Changer mon mot de passe</a>\n\nService Sécurité et Conformité",
        "type": "phishing",
        "clues": [
          "Homograph attack (IDN spoofing): Le domaine 'showroomprive.nеt' remplace le 'e' latin par un 'е' cyrillique, rendant l’URL visuellement identique mais différente techniquement pour piéger l’utilisateur.",
          "Email spoofing / Header anomaly: L’adresse réelle 'mail-spoof.com' diffère du domaine affiché, traduisant une falsification de l’expéditeur afin de contourner la vigilance des employés pressés.",
          "URL Obfuscation / Redirect chaining: Bouton de réinitialisation renvoie vers 'credential-stealer.xyz', rien à voir avec Showroomprive, preuve de redirection vers site malveillant collecteur d’identifiants utilisateur.",
          "Social engineering - Fear / Intimidation: Alerte de connexion depuis Moscou crée inquiétude et pousse l’utilisateur à changer rapidement son mot de passe sans vérifier l’origine.",
          "Data harvesting / Credential phishing: Le lien invite à saisir ses identifiants sur un faux portail afin de les récupérer pour des usages malveillants ultérieurs."
        ]
      },
      {
        "id": 24,
        "sender": "Sécu-Info <noreply@ameli.fr>",
        "realSender": "noreply@ameli.fr",
        "subject": "Mise à jour de votre carte Vitale",
        "body": "Caisse Nationale d'Assurance Maladie\n\nMadame, Monsieur,\n\nNous vous informons que le service de mise à jour des cartes Vitale est désormais disponible en ligne.\n\nPour accéder au service, rendez-vous sur votre compte Ameli : <a href='https://www.ameli.fr/compte/' data-real-link='https://www.ameli.fr/compte/'>Mon compte Ameli</a>\n\nCe service est entièrement gratuit.\n\nL'Assurance Maladie",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine 'ameli.fr' reconnu, lien HTTPS direct vers l’espace personnel, certificat valide assurant l’authenticité et l’intégrité du service public en ligne.",
          "Legitimate indicator: Contenu informatif sans demande de paiement ni données sensibles, ton neutre rappelant un service gratuit proposé par l’Assurance Maladie officiel."
        ]
      },
      {
        "id": 25,
        "sender": "Compte Pro <business@showroomрrive.net>",
        "realSender": "spam@phish-factory.ru",
        "subject": "Facture #SRP-58741 - Paiement rejeté",
        "body": "Service Facturation\n\nBonjour,\n\nVotre dernier paiement pour la facture #SRP-58741 (958,40€) a été rejeté par votre banque.\n\nPour éviter la suspension de votre compte professionnel, veuillez mettre à jour vos informations de paiement : <a href='https://billing.showroomрrive.net/update' data-real-link='http://billing-scam.ru/cc-form'>Mettre à jour mon moyen de paiement</a>\n\nDélai de régularisation : 48h\n\nService Comptabilité Clients",
        "type": "phishing",
        "clues": [
          "Homograph attack (IDN spoofing): Le domaine 'showroomрrive.net' utilise la lettre 'р' cyrillique pour imiter le 'p' latin, quasi imperceptible pour l’œil non averti moyen.",
          "Email spoofing / Header anomaly: L’expéditeur réel appartient au domaine 'phish-factory.ru', sans lien avec Showroomprive, indiquant une usurpation d’identité flagrante dans l’en‑tête SMTP modifié frauduleusement.",
          "URL Obfuscation / Redirect chaining: Lien affiché semble interne mais redirige vers 'billing-scam.ru', domaine russe connu pour héberger des pages de collecte de cartes bancaires.",
          "Social engineering - Urgency: Délai de 48 h avant suspension du compte, créant une pression temporelle pour pousser l’utilisateur à agir précipitamment et risquer l’erreur.",
          "Data harvesting / Credential phishing: Demande de mise à jour de moyen de paiement visant à dérober les données bancaires saisies sur le faux formulaire."
        ]
      },
      {
        "id": 26,
        "sender": "Doctolib <no-reply@doctolib.fr>",
        "realSender": "no-reply@doctolib.fr",
        "subject": "Rappel : RDV médical demain à 14h30",
        "body": "Bonjour,\n\nNous vous rappelons votre rendez-vous de demain :\n\nDr Martin - Consultation généraliste\nDate : 28/03/2025 à 14h30\nAdresse : 15 rue des Lilas, 75011 Paris\n\nGérer mon rendez-vous : <a href='https://www.doctolib.fr/account/appointments' data-real-link='https://www.doctolib.fr/account/appointments'>Modifier ou annuler</a>\n\nÀ bientôt sur Doctolib\n\nCet email a été envoyé automatiquement, merci de ne pas y répondre.",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'doctolib.fr' et lien sécurisé vers la gestion du compte, cohérence complète avec le service médical en ligne connu.",
          "Legitimate indicator: Rappel de rendez‑vous, informations précises, absence totale de demande de paiement ou d’identifiants, ton purement informatif et habituel chez Doctolib."
        ]
      },
      {
        "id": 27,
        "sender": "Centre des Impôts <remboursement@impot-gouv.com>",
        "realSender": "scam@tax-return-fraud.net",
        "subject": "Remboursement fiscal de 843.27€ en attente de versement",
        "body": "DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES\n\nBonjour,\n\nSuite à la révision de votre dossier fiscal, nous avons constaté un trop-perçu de 843.27€ en votre faveur.\n\nPour recevoir votre remboursement sous 5 jours ouvrés, confirmez vos coordonnées bancaires : <a href='https://remboursement.impot-gouv.com/verification.php' data-real-link='http://tax-refund-scam.biz/form'>Recevoir mon remboursement</a>\n\nCe lien expire le 03/04/2025.\n\nDirection des Remboursements Fiscaux",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'impot-gouv.com' remplace '.gouv.fr' par '.com' et supprime le 's', imitation flagrante de l’administration fiscale nationale officielle française authentique.",
          "Email spoofing / Header anomaly: Adresse réelle 'tax-return-fraud.net' sans rapport avec le fisc, révélant une usurpation manifeste d’expéditeur via un domaine externe non autorisé publiquement.",
          "URL Obfuscation / Redirect chaining: Le lien affiché semble officiel mais redirige vers 'tax-refund-scam.biz', plateforme utilisée pour capturer des données confidentielles des victimes en.",
          "Data harvesting / Credential phishing: Courriel réclame confirmation de coordonnées bancaires, technique fréquente pour voler et exploiter les informations financières des contribuables potentiels à risque.",
          "Social engineering - Urgency: Lien annoncé comme expirant sous quelques jours, provoquant un sentiment d’urgence qui réduit le temps de réflexion de la victime."
        ]
      },
      {
        "id": 28,
        "sender": "Service Client <support@showroomprive.com>",
        "realSender": "support@showroomprive.com",
        "subject": "Accusé de réception de votre demande #SR-45789",
        "body": "Bonjour,\n\nNous avons bien reçu votre demande concernant votre récent retour de commande.\n\nVotre demande a été enregistrée sous la référence #SR-45789 et sera traitée dans un délai de 48 à 72 heures.\n\nVous pouvez suivre son avancement sur votre espace client : <a href='https://www.showroomprive.com/account/support/tickets' data-real-link='https://www.showroomprive.com/account/support/tickets'>Suivre ma demande</a>\n\nA très bientôt,\n\nL'équipe du Service Client",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine expéditeur 'showroomprive.com' reconnu, lien HTTPS direct vers l’espace client, sans redirections ni domaines tiers intermédiaires cachés potentiellement risqués supplémentaires.",
          "Legitimate indicator: Email d’accusé de réception standard, ton informatif, absence totale de demande de données sensibles ou d’urgence supplémentaire visant l’utilisateur final."
        ]
      },
      {
        "id": 29,
        "sender": "Dupont Jean-Michel <j.dupont@acme-fournitures.com>",
        "realSender": "hacker@business-scam.org",
        "subject": "URGENT : Modification de nos coordonnées bancaires",
        "body": "Madame, Monsieur,\n\nSuite à notre récente fusion avec le groupe Acmé International, nous avons changé de banque.\n\nMerci de bien vouloir mettre à jour nos coordonnées bancaires pour tous vos prochains règlements :\n\nBanque : Crédit Universel\nIBAN : FR76 3000 1234 5678 9012 3456 789\nBIC : CREDFRPP123\n\nVeuillez confirmer la prise en compte de ce changement par retour de mail.\n\nCordialement,\nJean-Michel Dupont\nDirecteur Financier\nAcme Fournitures",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: Adresse réelle 'business-scam.org' sans lien avec l’entreprise, alors que l’en‑tête affiche 'acme-fournitures.com', signe de falsification des en‑têtes SMTP originaux douteuse.",
          "Data harvesting / Credential phishing: Demande de modifier l’IBAN vers un compte inconnu, visant à détourner les prochains paiements et compromettre les finances de l’entreprise.",
          "Social engineering - Urgency: L’objet ‘URGENT’ impose une action rapide, réduisant la vigilance habituelle des destinataires confrontés au changement bancaire inattendu critique supposé immédiat.",
          "Content anomaly: Changement de coordonnées bancaires communiqué par simple email, procédure inhabituelle pour une entreprise, donc suspect et risquée pour la sécurité."
        ]
      },
      {
        "id": 30,
        "sender": "Sophie Martin <s.martin@showroomprive.com>",
        "realSender": "s.martin@showroomprive.com",
        "subject": "RE: Présentation projet Q2",
        "body": "Bonjour à tous,\n\nVous trouverez ci-joint la présentation mise à jour pour la réunion de demain.\n\nJ'ai intégré les remarques de l'équipe commerciale et ajouté les nouvelles prévisions financières.\n\nN'hésitez pas si vous avez des questions.\n\nBonne journée,\n\nSophie Martin\nResponsable Marketing\nTél : 01 23 45 67 89",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Expéditeur interne 'showroomprive.com' cohérent, contenu professionnel sans lien externe ni demande sensible, communication normale entre collègues pour réunion prévue demain.",
          "Legitimate indicator: Objet ‘RE:’ et référence aux commentaires précédents montrent un fil de discussion authentique et attendu par l’équipe projet concernée interne."
        ]
      },
      {
        "id": 31,
        "sender": "Ahmed Benali <ahmed.benali@showroomprive.com>",
        "realSender": "fraudeur76@mail-temp.net",
        "subject": "Urgent - Changement de coordonnées bancaires pour mon salaire",
        "body": "Bonjour Service Paie,\n\nSuite à la fermeture de mon compte bancaire actuel, je vous demande de bien vouloir effectuer mon prochain virement de salaire sur mon nouveau compte :\n\nBanque : Société Générale\nIBAN : FR76 3000 9876 5432 1098 7654 321\n\nC'est très urgent car je dois payer mon loyer la semaine prochaine et je n'ai plus accès à mon ancien compte.\n\nMerci de confirmer la prise en compte avant demain.\n\nCordialement,\nAhmed Benali\nService Logistique",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’expéditeur affiché est un employé mais l’adresse réelle provient d’un domaine externe temporaire.",
          "Data harvesting / Credential phishing: Demande explicite de modification des coordonnées bancaires pour détourner un virement de salaire.",
          "Social engineering - Urgency: Mention du paiement de loyer et demande de confirmation rapide pour éviter toute vérification.",
          "Content anomaly: Absence de numéro de téléphone ou canal officiel pour une demande aussi critique et sensible."
        ]
      },
      {
        "id": 32,
        "sender": "InfoTech Support <support@infotech-services.net>",
        "realSender": "support@infotech-services.net",
        "subject": "Maintenance Planifiée - Actions Requises",
        "body": "Bonjour,\n\nNous vous informons qu'une maintenance de votre système ERP est prévue ce vendredi 28/03/2025 de 23h à 4h du matin.\n\nPour préparer cette intervention :\n- Assurez-vous que tous les utilisateurs sont déconnectés avant 22h45\n- Sauvegardez vos données en cours\n\nUn rapport de maintenance vous sera envoyé à la fin de l'intervention.\n\nCordialement,\nL'équipe Support InfoTech\nTél : 01 23 45 67 90\nsupport@infotech-services.net",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine professionnel valide et lien de contact clair.",
          "Legitimate indicator: Communication technique planifiée sans demande de données personnelles."
        ]
      },
      {
        "id": 33,
        "sender": "Global Office Supplies <contact@globalsupplies.co>",
        "realSender": "scammer@invoice-fraud.com",
        "subject": "URGENT : Facture #GS-7845 impayée depuis 60 jours",
        "body": "À l'attention du Service Comptabilité,\n\nNous constatons qu'après plusieurs relances, votre facture #GS-7845 d'un montant de 3 487,52€ reste impayée depuis plus de 60 jours.\n\nAfin d'éviter une procédure de recouvrement, veuillez effectuer le paiement immédiatement sur notre nouveau compte bancaire :\n\nIBAN : GB29 NWBK 6016 1331 9268 19\n\nVeuillez nous envoyer la preuve de virement à payments@globalsupplies.co\n\nCordialement,\nService Recouvrement\nGlobal Office Supplies",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Utilisation du domaine '.co' au lieu de '.com' pour tromper visuellement sur l’identité de l’entreprise.",
          "Data harvesting / Credential phishing: Demande de virement vers un nouveau compte sans justification officielle.",
          "Social engineering - Fear / Intimidation: Menace de procédure de recouvrement pour inciter à un paiement immédiat."
        ]
      },
      {
        "id": 34,
        "sender": "Département Achats <achats@showroomprive.com>",
        "realSender": "achats@showroomprive.com",
        "subject": "Nouveau processus d'approbation des bons de commande",
        "body": "Chers collègues,\n\nSuite à la dernière réunion du comité de direction, nous mettons en place un nouveau processus d'approbation des bons de commande à partir du 01/04/2025.\n\nLes changements principaux sont :\n- Double validation pour les commandes > 5000€\n- Délégation de signature électronique via notre extranet\n- Nouveaux formulaires disponibles sur l'extranet : <a href='https://extranet.showroomprive.com/achats/formulaires' data-real-link='https://extranet.showroomprive.com/achats/formulaires'>Accéder aux formulaires</a>\n\nUne formation sera organisée la semaine prochaine.\n\nCordialement,\nDépartement Achats",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Message interne provenant d’un domaine authentique.",
          "Legitimate indicator: Informations précises sur un processus métier avec lien extranet sécurisé."
        ]
      },
      {
        "id": 35,
        "sender": "BTP Construction <facturation@btp-construction.fr>",
        "realSender": "hacker@invoice-fraud.net",
        "subject": "Facture en attente - Rappel urgent",
        "body": "Service Comptabilité,\n\nNous vous rappelons que la facture #BTP-2025-089 pour les travaux réalisés en février 2025 n'a toujours pas été réglée malgré l'échéance dépassée.\n\nMontant dû : 28 750,00€ TTC\n\nSuite à des problèmes avec notre banque actuelle, veuillez effectuer le virement sur ce nouveau compte :\n\nIBAN : BE68 5390 0754 7034\nBIC : BBRUBEBB\nTitulaire : BTP Construction SAS\n\nConfirmez le paiement à payments@btpconstruction-groupe.com\n\nAttention : des pénalités de retard seront appliquées sous 48h.\n\nCordialement,\nService Recouvrement",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’expéditeur affiché n’est pas celui qui a réellement envoyé l’email.",
          "Data harvesting / Credential phishing: Tentative de redirection de paiement vers un compte bancaire frauduleux.",
          "Social engineering - Urgency: Pression via menace de pénalités de retard et justification fallacieuse ('problèmes bancaires')."
        ]
      },
      {
        "id": 36,
        "sender": "Caroline Dubois <c.dubois@logistik-transport.com>",
        "realSender": "fraudster@email-spoofer.xyz",
        "subject": "Urgent : Mise à jour du bon de commande #LC-789",
        "body": "Bonjour,\n\nJe suis Caroline Dubois, la nouvelle responsable financière de Logistik Transport.\n\nJe vous contacte concernant votre commande #LC-789.\n\nSuite à une restructuration interne, nous avons dû changer nos coordonnées bancaires. Veuillez utiliser les nouvelles coordonnées ci-dessous pour tous vos règlements :\n\nBanque : Finance Internationale\nIBAN : FR76 1234 9876 3456 7890 1234 567\n\nPar ailleurs, pourriez-vous me renvoyer une copie de la dernière facture que nous vous avons adressée?\n\nMerci de votre compréhension,\nCaroline Dubois\nResponsable Financière\nLogistik Transport",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’adresse réelle ne correspond pas au domaine affiché, signalant une usurpation d’identité.",
          "Social engineering - Curiosity: Prétexte d’un changement hiérarchique ('nouvelle responsable') pour établir la crédibilité du message.",
          "Data harvesting / Credential phishing: Demande de modification des coordonnées bancaires et de copie de facture pour récupérer des données sensibles."
        ]
      },
      {
        "id": 37,
        "sender": "Thomas Lefèvre <t.lefevre@showroomprive.com>",
        "realSender": "t.lefevre@showroomprive.com",
        "subject": "Rapport financier T1 2025",
        "body": "Chers membres du comité de direction,\n\nVeuillez trouver en pièce jointe le rapport financier du premier trimestre 2025.\n\nPoints principaux à noter :\n- Croissance du CA de 7% par rapport au T1 2024\n- Marge opérationnelle en hausse de 2 points\n- Investissements conformes au budget prévisionnel\n\nCe rapport sera présenté lors de notre réunion de jeudi.\n\nBien cordialement,\nThomas Lefèvre\nDirecteur Financier\nTél : 01 23 45 67 93\nt.lefevre@showroomprive.com",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Email professionnel interne avec adresse valide.",
          "Legitimate indicator: Contenu cohérent avec le poste de l’expéditeur et préparatif d’une réunion officielle."
        ]
      },
      {
        "id": 38,
        "sender": "Agence Digitale WebPro <contact@webpro-agency.com>",
        "realSender": "fake@spoof-domain.org",
        "subject": "Facture #2025-03-142 en attente de règlement",
        "body": "Service comptabilité,\n\nNous n'avons toujours pas reçu le règlement de notre facture #2025-03-142 d'un montant de 4 350€ HT pour la refonte de votre site web, échue depuis le 15/03/2025.\n\nNous avons constaté que certains virements n'ont pas été reçus suite à un problème technique chez notre banque.\n\nPar mesure de sécurité, veuillez utiliser ces nouvelles coordonnées bancaires pour votre paiement :\n\nIBAN : LU28 0019 4006 4475 0000\nBIC : BCDMLULL\n\nMerci de nous confirmer le virement par retour de mail.\n\nL'équipe WebPro",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: Domaine réel différent du domaine affiché, signalant une tentative d’usurpation.",
          "Data harvesting / Credential phishing: Fourniture d’un nouvel IBAN suspect pour détourner un paiement.",
          "Social engineering - Urgency: Mention d’un problème bancaire comme prétexte à un changement de procédure."
        ]
      },
      {
        "id": 39,
        "sender": "IT Support <it-support@showroomprive.com>",
        "realSender": "it-support@showroomprive.com",
        "subject": "Interruption VPN planifiée ce dimanche à 23h",
        "body": "Bonjour,\n\nUne maintenance de l’infrastructure VPN est prévue le dimanche 30/03/2025 de 23h00 à 01h00.\nPendant cette période, l’accès distant au réseau sera indisponible.\n\nAucune action n’est requise de votre part.\n\nCordialement,\nÉquipe IT",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Message interne d’un service informatique identifiable avec domaine officiel.",
          "Legitimate indicator: Notification de maintenance planifiée sans demande de données ni actions critiques."
        ]
      },   
      {
        "id": 40,
        "sender": "RH Urgent <rhc@showroomprive.com>",
        "realSender": "stealdata@cybermail.biz",
        "subject": "Mise à jour obligatoire de vos informations personnelles",
        "body": "Bonjour,\n\nDans le cadre du passage à la paie 2025, merci de mettre à jour immédiatement vos coordonnées :\n<a href='https://extranet.showroomprive.com.hr/update' data-real-link='http://steal-my-data.com/form'>Mettre à jour maintenant</a>\n\nSans action sous 12 h, votre salaire pourrait être retardé.\n\nService RH",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’expéditeur réel provient d’un domaine externe alors que l’adresse affichée simule un contact interne avec une faute (‘rhc’).",
          "Domain fraud / Suspicious TLD: Le lien affiché contient 'net.hr', qui n’est pas le domaine officiel de l’entreprise.",
          "URL Obfuscation / Redirect chaining: Le lien redirige vers un domaine suspect 'steal-my-data.com'.",
          "Social engineering - Fear / Intimidation: Menace d’un retard de salaire pour inciter à une action immédiate."
        ]
      },
      {
        "id": 41,
        "sender": "Comité RSE <rse@showroomprive.com>",
        "realSender": "rse@showroomprive.com",
        "subject": "Journée de bénévolat – Inscriptions ouvertes",
        "body": "Bonjour à tous,\n\nLa journée RSE annuelle aura lieu le 17/04/2025.\nChoisissez votre mission solidaire sur l’extranet : <a href='https://extranet.showroomprive.com/rse/2025' data-real-link='https://extranet.showroomprive.com/rse/2025'>S’inscrire</a>\n\nMerci pour votre engagement !\n\nComité RSE",
        "type": "safe",
        "clues": [
          "Legitimate indicator: L’adresse email et le lien pointent vers l’extranet officiel de l’entreprise.",
          "Legitimate indicator: Contenu informatif sans demande sensible, avec un ton bienveillant et non urgent."
        ]
      },
      {
        "id": 42,
        "sender": "Microsoft 365 <no-reply@m1crosoft.com>",
        "realSender": "alert@phish365.co",
        "subject": "Votre licence Office expire dans 4 heures !",
        "body": "Cher utilisateur,\n\nVotre licence Microsoft 365 arrive à expiration.\nRenouvelez-la pour éviter la perte de données :\n<a href='https://m1crosoft.com/renew' data-real-link='http://login-capture.ru/office'>Renouveler maintenant</a>\n\nMerci,\nMicrosoft Accounting",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine 'm1crosoft.com' remplace le 'i' par un '1', imitant Microsoft.",
          "Email spoofing / Header anomaly: L’adresse réelle vient d’un domaine sans lien avec Microsoft.",
          "URL Obfuscation / Redirect chaining: Le lien visible masque une redirection vers 'login-capture.ru', un domaine russe suspect.",
          "Social engineering - Fear / Intimidation: Ultimatum très court (4 heures) avec menace de perte de données."
        ]
      },
      {
        "id": 43,
        "sender": "Amazon <digital-noreply@amazon.fr>",
        "realSender": "digital-noreply@amazon.fr",
        "subject": "Votre reçu – Achat Kindle #D01-456789",
        "body": "Bonjour,\n\nMerci pour votre achat : « Le Signal » – 9,99 €.\nConsultez votre bibliothèque : <a href='https://www.amazon.fr/kindle-library' data-real-link='https://www.amazon.fr/kindle-library'>Ma bibliothèque</a>\n\nBonne lecture !\nAmazon.fr",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse email officielle d’Amazon et lien vers le site sécurisé.",
          "Legitimate indicator: Contenu classique d’un reçu d’achat sans lien ou demande suspecte."
        ]
      },
      {
        "id": 44,
        "sender": "Amazon Prime <prime-service@amaz0n-prime.net>",
        "realSender": "scam@primegiftcards.info",
        "subject": "Remboursement Amazon Prime – Action requise",
        "body": "Cher membre,\n\nVous avez droit à un remboursement de 89,90 €.\nValidez votre IBAN ici :\n<a href='http://amaz0n-prime.net/refund' data-real-link='http://bank-steal.cc/form'>Obtenir mon remboursement</a>\n\nOffre valable 6 h.\nPrime Team",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine 'amaz0n-prime.net' utilise un '0' à la place du 'o'.",
          "Email spoofing / Header anomaly: L’expéditeur réel n’appartient pas à Amazon.",
          "URL Obfuscation / Redirect chaining: Le lien redirige vers 'bank-steal.cc', un site malveillant.",
          "Data harvesting / Credential phishing: Demande de fournir un IBAN sous prétexte de remboursement."
        ]
      },
      {
        "id": 45,
        "sender": "Apple <no-reply@apple.com>",
        "realSender": "no-reply@apple.com",
        "subject": "Votre reçu App Store – 2,99 €",
        "body": "Bonjour,\n\nVous avez acheté : ‘Agenda Pro – Abonnement mensuel’.\nGérer mes abonnements : <a href='https://reportaproblem.apple.com' data-real-link='https://reportaproblem.apple.com'>Apple – Gestion</a>\n\nApple Distribution International",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'apple.com' et lien sécurisé vers un service Apple.",
          "Legitimate indicator: Message typique d’un reçu App Store, sans élément suspect."
        ]
      },
      {
        "id": 46,
        "sender": "Apple ID <security@apple-secure.co>",
        "realSender": "alert@fake-icloud.me",
        "subject": "Votre identifiant Apple a été verrouillé",
        "body": "Cher client,\n\nSuite à plusieurs tentatives infructueuses, votre Apple ID est bloqué.\nDébloquez-le ici :\n<a href='https://apple-secure.co/unlock' data-real-link='http://phishicloud.ru/login'>Débloquer mon compte</a>\n\nApple Support",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'apple-secure.co' n’est pas un domaine officiel d’Apple.",
          "URL Obfuscation / Redirect chaining: Le lien mène vers un site malveillant russe 'phishicloud.ru'.",
          "Social engineering - Fear / Intimidation: Blocage immédiat du compte pour inciter à une réaction rapide.",
          "Email spoofing / Header anomaly: L’adresse réelle est issue d’un domaine sans lien avec Apple."
        ]
      },
      {
        "id": 47,
        "sender": "Orange <facture@orange.com>",
        "realSender": "facture@orange.com",
        "subject": "Votre facture mobile de mars est disponible",
        "body": "Bonjour,\n\nMontant : 29,99 € (prélèvement le 05/04/2025).\nConsulter ma facture : <a href='https://espaceclient.orange.com/factures' data-real-link='https://espaceclient.orange.com/factures'>Mon Espace Client</a>\n\nMerci de votre confiance.\nOrange",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse email et lien sécurisés appartenant au domaine officiel d’Orange.",
          "Legitimate indicator: Facture classique sans incitation urgente ni lien suspect."
        ]
      },
      {
        "id": 48,
        "sender": "EDF <remboursement@edf-france.info>",
        "realSender": "phisher@energyrefund.ru",
        "subject": "Trop-perçu EDF – 135,62 € à récupérer",
        "body": "Madame, Monsieur,\n\nAprès régularisation, un trop-perçu est à votre crédit.\nComplétez ce formulaire pour être remboursé :\n<a href='https://edf-france.info/refund' data-real-link='http://edf-payback.ru/form'>Accéder au formulaire</a>\n\nService Client EDF",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'edf-france.info' imite EDF mais n’est pas officiel.",
          "URL Obfuscation / Redirect chaining: Le lien redirige vers un domaine .ru suspect.",
          "Data harvesting / Credential phishing: Appât financier avec demande d’accès à un formulaire douteux."
        ]
      },
      {
        "id": 49,
        "sender": "Slack <no-reply@slack.com>",
        "realSender": "no-reply@slack.com",
        "subject": "Nouveau message direct de Clara",
        "body": "Clara : « Peux-tu relire le doc avant 15h ? »\nRépondre : <a href='https://app.slack.com/client/T12345678' data-real-link='https://app.slack.com/client/T12345678'>Ouvrir Slack</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine 'slack.com' vérifié et utilisé dans le lien de redirection.",
          "Legitimate indicator: Notification typique sans contenu suspect ni lien externe."
        ]
      },
      {
        "id": 50,
        "sender": "Office 365 <login@0ffice365-security.com>",
        "realSender": "credential@harvest-mail.net",
        "subject": "Action requise : Réinitialisation de mot de passe obligatoire",
        "body": "Cher utilisateur showroomprive,\n\nSuite à un incident, réinitialisez votre mot de passe :\n<a href='https://0ffice365-security.com/reset' data-real-link='http://harvest-mail.net/form'>Réinitialiser maintenant</a>\n\nCordialement,\nSécurité Microsoft",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine '0ffice365-security.com' utilise un '0' à la place du 'o' dans 'office'.",
          "Email spoofing / Header anomaly: L'adresse réelle 'harvest-mail.net' n'est pas liée à Microsoft.",
          "URL Obfuscation / Redirect chaining: Le lien mène à 'harvest-mail.net', un domaine inconnu potentiellement malveillant.",
          "Data harvesting / Credential phishing: Demande urgente de saisie de mot de passe, typique d’un vol d’identifiants."
        ]
      },
      {
        "id": 51,
        "sender": "Service Paie <payroll@showroomprive.com>",
        "realSender": "payroll@showroomprive.com",
        "subject": "Bulletins de salaire disponibles – Mars 2025",
        "body": "Bonjour,\n\nVos bulletins de salaire sont accessibles sur l’extranet :\n<a href='https://extranet.showroomprive.com/paie' data-real-link='https://extranet.showroomprive.com/paie'>Consulter mes bulletins</a>\n\nService Paie",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne officielle et lien vers un extranet sécurisé.",
          "Legitimate indicator: Message informatif sans demande de données ni urgence imposée."
        ]
      },
      {
        "id": 52,
        "sender": "DG <david.dayan@showroomprive.com>",
        "realSender": "fastmoney@cryptochain.im",
        "subject": "Besoin d’un virement express – Projet confidentiel",
        "body": "Bonjour,\n\nMerci d’initier immédiatement un virement de 48 500 € vers EUR-MEGA LTD.\nIBAN : HU87 1204 5678 9900 1122 3344\n\nJe suis en déplacement ; réponds uniquement par email.\n\nDavid",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L'adresse réelle est externe et n'a aucun lien avec showroomprive.com.",
          "Social engineering - Urgency: Demande d’un virement important avec une pression temporelle forte.",
          "Social engineering - Fear / Intimidation: Interdiction implicite de vérification ('réponds uniquement par email').",
          "Data harvesting / Credential phishing: Tentative de détournement financier via une arnaque au président (BEC scam)."
        ]
      },
      {
        "id": 53,
        "sender": "GitHub <noreply@github.com>",
        "realSender": "noreply@github.com",
        "subject": "[showroomprive/checkout] Nouveau pull-request #98",
        "body": "Thomas-Lefevre a ouvert un PR : “Fix taxes calculation”.\nVoir le PR : <a href='https://github.com/showroomprive/checkout/pull/98' data-real-link='https://github.com/showroomprive/checkout/pull/98'>#98</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel github.com utilisé pour la notification.",
          "Legitimate indicator: Message typique de GitHub sans lien suspect ni demande inhabituelle."
        ]
      },
      {
        "id": 54,
        "sender": "Dropbox <alert@dropb0x-storage.com>",
        "realSender": "steal@cloud-rip.net",
        "subject": "Votre espace Dropbox est plein !",
        "body": "Il vous reste 0 Mo.\nAugmentez votre quota :\n<a href='https://dropb0x-storage.com/upgrade' data-real-link='http://cloud-rip.net/login'>Obtenir 2 Go gratuits</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine 'dropb0x-storage.com' utilise un '0' à la place du 'o'.",
          "URL Obfuscation / Redirect chaining: Le lien redirige vers 'cloud-rip.net', un domaine inconnu.",
          "Data harvesting / Credential phishing: Promesse de stockage gratuit pour inciter à saisir ses identifiants Dropbox."
        ]
      },
      {
        "id": 55,
        "sender": "Direction IT <it@showroomprivë.net>",
        "realSender": "malware@payload-drop.ru",
        "subject": "Nouveau client VPN – Installation obligatoire",
        "body": "Bonjour,\n\nTéléchargez le nouveau client VPN :\n<a href='https://it.showroomprivë.net/vpn-client.exe' data-real-link='http://payload-drop.ru/vpn.exe'>Télécharger</a>\n\nInstallez-le avant ce soir.\n\nIT",
        "type": "phishing",
        "clues": [
          "Homograph attack (IDN spoofing): Utilisation du 'ë' pour imiter le 'e' classique dans le domaine.",
          "Malicious attachment: Lien réel pointe vers un exécutable hébergé sur un site douteux (.ru).",
          "Social engineering - Urgency: Demande d’installation rapide sans vérification ni signature numérique."
        ]
      },
      {
        "id": 56,
        "sender": "Zoom <no-reply@zoom.us>",
        "realSender": "no-reply@zoom.us",
        "subject": "Enregistrement disponible – Réunion « Roadmap Q3 »",
        "body": "Bonjour,\n\nLa réunion du 27/03/2025 a été enregistrée.\nAccéder à l’enregistrement : <a href='https://zoom.us/rec/share/abc123' data-real-link='https://zoom.us/rec/share/abc123'>Voir la vidéo</a>\n\nZoom",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'zoom.us' avec lien sécurisé vers l’enregistrement.",
          "Legitimate indicator: Notification standard sans pièce jointe ni demande de données."
        ]
      },
      {
        "id": 57,
        "sender": "TikTok © <copyright@tiktok.com>",
        "realSender": "report@tiktok.com",
        "subject": "Avis de copyright – Vidéo supprimée",
        "body": "Votre vidéo ‘Haul Showroomprivé’ enfreint nos règles.\nContester :\n<a href='https://www.tiktok.com/appeal' data-real-link='https://www.tiktok.com/appeal'>Faire appel</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'tiktok.com' avec lien sécurisé vers le service d’appel.",
          "Legitimate indicator: Processus de notification conforme aux pratiques de la plateforme."
        ]
      },
      {
        "id": 58,
        "sender": "TikTok © <copyright@tikt0k-secure.net>",
        "realSender": "phish@video-claim.ru",
        "subject": "Copyright Strike : Compte suspendu",
        "body": "Votre compte sera supprimé sous 2 h.\nDébloquez-le :\n<a href='https://tikt0k-secure.net/unlock' data-real-link='http://video-claim.ru/login'>Débloquer</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine 'tikt0k-secure.net' remplace le 'o' par un zéro.",
          "URL Obfuscation / Redirect chaining: Le lien réel mène à un domaine russe 'video-claim.ru'.",
          "Social engineering - Fear / Intimidation: Menace de suppression de compte sous 2 heures pour pousser à une action rapide."
        ]
      },
      {
        "id": 59,
        "sender": "La Poste <suivi@laposte.fr>",
        "realSender": "suivi@laposte.fr",
        "subject": "Colis 6A12345678901 – Retrait disponible",
        "body": "Votre colis est arrivé au bureau de poste Paris 11.\nGérer : <a href='https://www.laposte.fr/suivi/6A12345678901' data-real-link='https://www.laposte.fr/suivi/6A12345678901'>Suivre mon colis</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'laposte.fr' et numéro de suivi valide.",
          "Legitimate indicator: Notification classique sans demande d’action sensible ou d’identifiants."
        ]
      },
      {
        "id": 60,
        "sender": "La Poste <notification@laposte-24h.com>",
        "realSender": "scammer@parcel-pay.ru",
        "subject": "Frais de douane impayés – Colis bloqué",
        "body": "Bonjour,\n\nVotre colis est bloqué.\nRéglez 2,99 € de frais :\n<a href='http://laposte-24h.com/pay' data-real-link='http://parcel-pay.ru/cc'>Payer maintenant</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Utilisation du faux domaine 'laposte-24h.com' pour imiter 'laposte.fr'.",
          "URL Obfuscation / Redirect chaining: Le lien affiché mène en réalité vers un site russe suspect 'parcel-pay.ru'.",
          "Social engineering - Curiosity: Montant minime (2,99 €) pour inciter au clic sans éveiller de méfiance."
        ]
      },
      {
        "id": 61,
        "sender": "Service Formation <formation@showroomprive.com>",
        "realSender": "formation@showroomprive.com",
        "subject": "Inscription confirmée – Excel avancé 04/04/2025",
        "body": "Bonjour,\n\nVotre inscription est confirmée.\nDétails : <a href='https://extranet.showroomprive.com/formation/excel' data-real-link='https://extranet.showroomprive.com/formation/excel'>Programme</a>\n\nÀ bientôt.",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine interne valide avec lien vers l’extranet.",
          "Legitimate indicator: Email informatif ne demandant aucune donnée confidentielle."
        ]
      },
      {
        "id": 62,
        "sender": "Impôts <amende@dgfip-gouv.fr>",
        "realSender": "fine@tax-phish.biz",
        "subject": "Amende de 125 € pour retard de paiement",
        "body": "Madame, Monsieur,\n\nUne pénalité a été appliquée.\nRégler sous 24 h :\n<a href='https://dgfip-gouv.fr/pay-fine' data-real-link='http://tax-phish.biz/form'>Payer ma pénalité</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Utilisation du faux domaine 'dgfip-gouv.fr' pour imiter un site officiel.",
          "URL Obfuscation / Redirect chaining: Le lien affiché redirige vers un domaine '.biz', non gouvernemental.",
          "Social engineering - Fear / Intimidation: Pression temporelle (24 h) avec menace de pénalité."
        ]
      },
      {
        "id": 63,
        "sender": "Spotify <receipt@spotify.com>",
        "realSender": "receipt@spotify.com",
        "subject": "Votre reçu Spotify Premium – 9,99 €",
        "body": "Bonjour,\n\nMerci pour votre paiement.\nGérer mon abonnement : <a href='https://www.spotify.com/account' data-real-link='https://www.spotify.com/account'>Compte Spotify</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'spotify.com' utilisé et lien sécurisé.",
          "Legitimate indicator: Message transactionnel standard sans contenu suspect."
        ]
      },
      {
        "id": 64,
        "sender": "Société Générale <alerte@societegenerale.fr>",
        "realSender": "hijack@bank-alert.net",
        "subject": "Accès bloqué – Confirmation identité",
        "body": "Cher client,\n\nVotre compte est restreint.\nConfirmez : <a href='https://societegenerale.fr/login' data-real-link='http://bank-alert.net/id'>Vérifier</a>",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’adresse réelle 'bank-alert.net' n’est pas liée à Société Générale.",
          "URL Obfuscation / Redirect chaining: Le lien apparent est trompeur et cache une redirection vers un site frauduleux.",
          "Social engineering - Fear / Intimidation: Blocage de compte évoqué pour provoquer une réaction rapide."
        ]
      },
      {
        "id": 65,
        "sender": "SNCF <eticket@sncf.com>",
        "realSender": "eticket@sncf.com",
        "subject": "E-billet Paris → Lyon 12/04/2025",
        "body": "Bonjour,\n\nVotre e-billet est en pièce jointe (PDF).\nGérer votre voyage : <a href='https://www.sncf.com/fr/itineraire' data-real-link='https://www.sncf.com/fr/itineraire'>Mon voyage</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'sncf.com' et lien HTTPS vers le site de la SNCF.",
          "Legitimate indicator: Contenu cohérent avec un billet électronique et pièce jointe PDF attendue."
        ]
      },
      {
        "id": 66,
        "sender": "Service Qualité <qualité@showroomprive.com>",
        "realSender": "qualité@showroomprive.com",
        "subject": "Enquête satisfaction interne (5 min)",
        "body": "Bonjour,\n\nDonnez-nous votre avis :\n<a href='https://extranet.showroomprive.com/polls/2025' data-real-link='https://extranet.showroomprive.com/polls/2025'>Répondre au sondage</a>\n\nMerci !",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne de l’entreprise et lien vers l’extranet sécurisé.",
          "Legitimate indicator: Aucun caractère urgent ni collecte de données sensibles."
        ]
      },
      {
        "id": 67,
        "sender": "Google Workspace <alert@goog1e-security.com>",
        "realSender": "stealer@cred-farm.cn",
        "subject": "Nouvelle connexion suspecte à 02 h 14",
        "body": "Nous avons bloqué l’accès.\nVérifier l’activité : <a href='https://security.google.com/alert' data-real-link='http://cred-farm.cn/login'>Analyser</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Le domaine 'goog1e-security.com' utilise un '1' à la place du 'l'.",
          "URL Obfuscation / Redirect chaining: Le lien réel pointe vers un domaine chinois suspect.",
          "Social engineering - Fear / Intimidation: Faux blocage de compte pour inciter à une action immédiate."
        ]
      },
      {
        "id": 68,
        "sender": "ENGIE <facture@engie.com>",
        "realSender": "facture@engie.com",
        "subject": "Votre échéance d’avril – 82,34 €",
        "body": "Bonjour,\n\nVotre prélèvement aura lieu le 10/04/2025.\nConsulter la facture : <a href='https://moncompte.engie.com/factures' data-real-link='https://moncompte.engie.com/factures'>Espace client</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'engie.com' et lien sécurisé vers l’espace client.",
          "Legitimate indicator: Message classique de facturation sans collecte d’informations bancaires."
        ]
      },
      {
        "id": 69,
        "sender": "ENGIE <support@engie-refund.net>",
        "realSender": "phish@bill-adjust.ru",
        "subject": "Remboursement de 48,10 € disponible",
        "body": "Cliquez pour recevoir :\n<a href='https://engie-refund.net/claim' data-real-link='http://bill-adjust.ru/form'>Recevoir</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Utilisation du faux domaine 'engie-refund.net' pour imiter le fournisseur d’énergie.",
          "URL Obfuscation / Redirect chaining: Redirection vers un site russe 'bill-adjust.ru'.",
          "Data harvesting / Credential phishing: Appât financier visant à soutirer des informations personnelles ou bancaires."
        ]
      },
      {
        "id": 70,
        "sender": "LinkedIn Talent <recrutement@linkedin-jobs.com>",
        "realSender": "grabcv@resume-steal.org",
        "subject": "Offre d’emploi exclusive – Répondez vite",
        "body": "Bonjour,\n\nNous avons repéré votre profil.\nTéléchargez la description : <a href='http://linkedin-jobs.com/download' data-real-link='http://resume-steal.org/malware.docm'>Télécharger</a>",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’adresse réelle ne correspond pas à celle de LinkedIn.",
          "Domain fraud / Suspicious TLD: Domaine trompeur 'linkedin-jobs.com' imitant LinkedIn.",
          "Malicious attachment: Téléchargement d’un fichier .docm contenant potentiellement du code malveillant."
        ]
      },
      {
        "id": 71,
        "sender": "Service Achats <achats@showroomprive.com>",
        "realSender": "achats@showroomprive.com",
        "subject": "Bon de commande #PO-5621 validé",
        "body": "Bonjour,\n\nLe bon de commande 5621 vient d’être approuvé.\nTélécharger le PDF : <a href='https://extranet.showroomprive.com/achats/po/5621' data-real-link='https://extranet.showroomprive.com/achats/po/5621'>Voir le document</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse email interne authentique.",
          "Legitimate indicator: Lien extranet sécurisé sans demande sensible."
        ]
      },
      {
        "id": 72,
        "sender": "WhatsApp <support@whatsapp.com>",
        "realSender": "alert@whatsapp.com",
        "subject": "Nouvelle connexion depuis Windows",
        "body": "Une nouvelle session WhatsApp Web a été ouverte.\nSi ce n’est pas vous : <a href='https://www.whatsapp.com/account' data-real-link='https://www.whatsapp.com/account'>Gérer appareils</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'whatsapp.com' avec lien sécurisé.",
          "Legitimate indicator: Notification de sécurité standard sans contenu suspect."
        ]
      },
      {
        "id": 73,
        "sender": "WhatsApp <support@whats4pp-secure.org>",
        "realSender": "steal@session-grab.net",
        "subject": "Votre compte sera supprimé sous 30 min",
        "body": "Évitez la suppression :\n<a href='https://whats4pp-secure.org/renew' data-real-link='http://session-grab.net/login'>Vérifier</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Domaine 'whats4pp-secure.org' utilise un chiffre '4' à la place du 'a'.",
          "URL Obfuscation / Redirect chaining: Le lien réel mène vers un domaine inconnu 'session-grab.net'.",
          "Social engineering - Fear / Intimidation: Menace de suppression de compte en 30 minutes pour inciter à agir vite."
        ]
      },
      {
        "id": 74,
        "sender": "Service Sécurité <security@showroomprive.com>",
        "realSender": "security@showroomprive.com",
        "subject": "Test interne de phishing – Merci de ne pas cliquer",
        "body": "Ceci est un test officiel de sensibilisation.\nAucune action requise.\n\nSécurité IT",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine interne officiel.",
          "Legitimate indicator: Message clair annonçant un test sans lien menaçant ni demande."
        ]
      },
      {
        "id": 75,
        "sender": "PayPal <service@paypa1-confirm.eu>",
        "realSender": "collect@credential-box.la",
        "subject": "Limitation de compte – Étape finale",
        "body": "Votre compte est restreint.\nConfirmez vos données :\n<a href='https://paypa1-confirm.eu/login' data-real-link='http://credential-box.la/form'>Confirmer</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Domaine 'paypa1-confirm.eu' avec chiffre '1' et extension '.eu' au lieu de '.com'.",
          "URL Obfuscation / Redirect chaining: Redirection vers 'credential-box.la', un site inconnu et malveillant.",
          "Social engineering - Fear / Intimidation: Mention de compte restreint pour inciter à une réaction immédiate.",
          "Data harvesting / Credential phishing: Tentative de collecte de données d’accès PayPal."
        ]
      },
      {
        "id": 76,
        "sender": "Airbnb <automated@airbnb.com>",
        "realSender": "automated@airbnb.com",
        "subject": "Votre réservation Bordeaux confirmée – 2-5 mai",
        "body": "Bonjour,\n\nDétails du séjour : <a href='https://www.airbnb.com/trips' data-real-link='https://www.airbnb.com/trips'>Mes voyages</a>\n\nBon séjour !",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'airbnb.com' avec lien sécurisé.",
          "Legitimate indicator: Message classique de confirmation sans action risquée."
        ]
      },
      {
        "id": 77,
        "sender": "Service RH <hr@showroomprive-portal.net>",
        "realSender": "phish@get-data.eu",
        "subject": "Téléchargez vos fiches de paie (archive protégée)",
        "body": "Pour confidentialité, vos bulletins sont dans un fichier zip protégé.\nMot de passe : HR2025\n<a href='http://showroomprive-portal.net/payroll.zip' data-real-link='http://get-data.eu/malware.zip'>Télécharger</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'showroomprive-portal.net' imite le domaine officiel mais ne l'est pas.",
          "Malicious attachment: Fichier zip protégé par mot de passe, souvent utilisé pour cacher des malwares.",
          "Email spoofing / Header anomaly: L'adresse réelle ne correspond pas à un domaine d’entreprise légitime."
        ]
      },
      {
        "id": 78,
        "sender": "GitLab <no-reply@gitlab.com>",
        "realSender": "no-reply@gitlab.com",
        "subject": "Pipeline réussi – project-frontend #1245",
        "body": "Le pipeline 1245 s’est terminé avec succès.\nVoir détails : <a href='https://gitlab.com/showroomprive/frontend/-/pipelines/1245' data-real-link='https://gitlab.com/showroomprive/frontend/-/pipelines/1245'>Pipeline</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'gitlab.com' avec lien sécurisé.",
          "Legitimate indicator: Notification classique de pipeline GitLab sans contenu suspect."
        ]
      },
      {
        "id": 79,
        "sender": "Vodafone <facture@vodafone-alert.com>",
        "realSender": "billing@fraud-net.nz",
        "subject": "Facture impayée – Dernier rappel",
        "body": "Réglez 64,21 € sous 24 h :\n<a href='https://vodafone-alert.com/pay' data-real-link='http://fraud-net.nz/card'>Payer</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'vodafone-alert.com' n’est pas le domaine officiel de Vodafone.",
          "URL Obfuscation / Redirect chaining: Le lien réel pointe vers un domaine '.nz' sans lien avec Vodafone.",
          "Social engineering - Fear / Intimidation: Pression temporelle avec un 'dernier rappel' pour inciter à payer."
        ]
      },
      {
        "id": 80,
        "sender": "Calendly <no-reply@calendly.com>",
        "realSender": "no-reply@calendly.com",
        "subject": "Nouvel événement : entretien candidat – 04/04",
        "body": "Un événement a été planifié.\nVoir : <a href='https://calendly.com/event/IC-123456' data-real-link='https://calendly.com/event/IC-123456'>Ouvrir Calendly</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel calendly.com avec lien direct et sécurisé.",
          "Legitimate indicator: Notification classique sans demande d'action urgente ou sensible."
        ]
      },
      {
        "id": 81,
        "sender": "Service Logistique <logistique@showroomprive.com>",
        "realSender": "logistique@showroomprive.com",
        "subject": "Nouvel horaire quai A – Semaine 14",
        "body": "Bonjour,\n\nLe planning de chargement du quai A a changé.\nConsulter : <a href='https://extranet.showroomprive.com/logistique/quaiA' data-real-link='https://extranet.showroomprive.com/logistique/quaiA'>Planning</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne showroomprive.com authentique.",
          "Legitimate indicator: Lien vers l’extranet sécurisé sans demande d’information."
        ]
      },
      {
        "id": 82,
        "sender": "IT Helpdesk <helpdesk@showroompr1ve.net>",
        "realSender": "keylogger@dark-loader.to",
        "subject": "Ticket #8923 résolu – Télécharger le correctif",
        "body": "Nous avons résolu votre incident.\nTélécharger patch : <a href='https://showroompr1ve.net/patch.exe' data-real-link='http://dark-loader.to/keylogger.exe'>Patch</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Domaine 'showroompr1ve.net' utilise un '1' au lieu de la lettre 'i'.",
          "Malicious attachment: Lien vers un fichier exécutable .exe hébergé sur un domaine malveillant.",
          "Email spoofing / Header anomaly: L'adresse réelle est externe à l’entreprise."
        ]
      },
      {
        "id": 83,
        "sender": "Facebook <security@facebookmail.com>",
        "realSender": "security@facebookmail.com",
        "subject": "Nouvelle connexion approuvée",
        "body": "Une connexion a été effectuée depuis Chrome Android.\nSi ce n’était pas vous : <a href='https://www.facebook.com/settings' data-real-link='https://www.facebook.com/settings'>Sécuriser compte</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'facebookmail.com' utilisé par Facebook pour les alertes.",
          "Legitimate indicator: Lien sécurisé vers le site officiel de gestion des paramètres Facebook."
        ]
      },
      {
        "id": 84,
        "sender": "Facebook <secure@faceb00k-verify.info>",
        "realSender": "steal@cred-dump.in",
        "subject": "Compte désactivé – Dernière chance",
        "body": "Débloquez votre compte :\n<a href='https://faceb00k-verify.info/unlock' data-real-link='http://cred-dump.in/login'>Débloquer</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Domaine 'faceb00k-verify.info' avec deux zéros à la place de 'o'.",
          "URL Obfuscation / Redirect chaining: Lien réel vers un domaine suspect 'cred-dump.in'.",
          "Social engineering - Fear / Intimidation: Mention de 'dernière chance' pour créer une urgence artificielle."
        ]
      },
      {
        "id": 85,
        "sender": "Uber <no-reply@uber.com>",
        "realSender": "no-reply@uber.com",
        "subject": "Votre reçu – Trajet 27/03/2025",
        "body": "Montant : 13,40 €.\nVisualiser le reçu : <a href='https://riders.uber.com/trips' data-real-link='https://riders.uber.com/trips'>Mes trajets</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'uber.com' et lien sécurisé vers l’espace client.",
          "Legitimate indicator: Message de reçu standard sans demande sensible."
        ]
      },
      {
        "id": 86,
        "sender": "Uber Support <claim@uber-refund.net>",
        "realSender": "phish@fare-claim.vn",
        "subject": "Erreur de facturation – 21,75 € à récupérer",
        "body": "Cliquez pour remboursement :\n<a href='https://uber-refund.net/claim' data-real-link='http://fare-claim.vn/form'>Obtenir</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'uber-refund.net' imite Uber mais n’est pas officiel.",
          "URL Obfuscation / Redirect chaining: Redirection vers un domaine '.vn' inconnu et suspect.",
          "Data harvesting / Credential phishing: Appât financier pour soutirer des informations personnelles ou bancaires."
        ]
      },
      {
        "id": 87,
        "sender": "Service Conformité <conformite@showroomprive.com>",
        "realSender": "conformite@showroomprive.com",
        "subject": "Rappel : Politique RGPD – Signature électronique",
        "body": "Bonjour,\n\nMerci de signer la nouvelle politique RGPD :\n<a href='https://extranet.showroomprive.com/compliance/rgpd' data-real-link='https://extranet.showroomprive.com/compliance/rgpd'>Signer</a>\n\nDate limite : 15/04/2025.",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine interne showroomprive.com et lien extranet sécurisé.",
          "Legitimate indicator: Communication conforme aux pratiques de conformité sans élément suspect."
        ]
      },
      {
        "id": 88,
        "sender": "Adobe <no-reply@adobe.com>",
        "realSender": "no-reply@adobe.com",
        "subject": "Partage de fichier via Adobe Cloud",
        "body": "Sophie Martin a partagé « CreativeAssets.zip ».\nAfficher : <a href='https://assets.adobe.com' data-real-link='https://assets.adobe.com'>Ouvrir</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'adobe.com' avec lien sécurisé.",
          "Legitimate indicator: Fonction standard de partage de fichiers Adobe sans élément suspect."
        ]
      },
      {
        "id": 89,
        "sender": "Adobe <no-reply@adobe-secure.store>",
        "realSender": "phisher@asset-grab.io",
        "subject": "Accès urgent requis à vos fichiers",
        "body": "Vos fichiers seront supprimés.\nSauvegarder : <a href='https://adobe-secure.store/login' data-real-link='http://asset-grab.io/login'>Sauvegarder</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'adobe-secure.store' imite Adobe mais n’est pas légitime.",
          "URL Obfuscation / Redirect chaining: Le lien réel mène à un domaine inconnu 'asset-grab.io'.",
          "Social engineering - Fear / Intimidation: Menace de suppression immédiate pour provoquer un clic précipité."
        ]
      },
      {
        "id": 90,
        "sender": "Microsoft Teams <noreply@teams.microsoft.com>",
        "realSender": "noreply@teams.microsoft.com",
        "subject": "Vous avez été ajouté au canal « Design 2025 »",
        "body": "Rejoindre : <a href='https://teams.microsoft.com/l/channel/19%3adesign' data-real-link='https://teams.microsoft.com/l/channel/19%3adesign'>Ouvrir Teams</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel Microsoft avec lien sécurisé vers Teams.",
          "Legitimate indicator: Notification standard sans demande d'information."
        ]
      },
      {
        "id": 91,
        "sender": "Teams <update@micros0ft-secure.app>",
        "realSender": "steal@token-phish.ir",
        "subject": "Mise à jour critique Teams – Télécharger maintenant",
        "body": "Installez la dernière version :\n<a href='https://micros0ft-secure.app/update.exe' data-real-link='http://token-phish.ir/steal.exe'>Télécharger</a>",
        "type": "phishing",
        "clues": [
          "Typosquatting: Domaine 'micros0ft-secure.app' utilise un zéro à la place de la lettre 'o'.",
          "Malicious attachment: Lien vers un exécutable potentiellement dangereux hébergé sur un site inconnu.",
          "URL Obfuscation / Redirect chaining: Le lien réel redirige vers un domaine iranien douteux."
        ]
      },
      {
        "id": 92,
        "sender": "Trésor Public <info@tresor-public.gouv.fr>",
        "realSender": "info@tresor-public.gouv.fr",
        "subject": "Avis d’échéance – Taxe sur les véhicules",
        "body": "Nouvelle échéance disponible.\nConsulter : <a href='https://www.impots.gouv.fr/vehicules' data-real-link='https://www.impots.gouv.fr/vehicules'>Mon espace</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine gouv.fr officiel utilisé par l’administration fiscale.",
          "Legitimate indicator: Lien sécurisé sans demande de données sensibles."
        ]
      },
      {
        "id": 93,
        "sender": "Trésor Public <penalite@tresor-gouv.info>",
        "realSender": "fraud@fine-collect.ru",
        "subject": "Pénalité de 195 € – Dernier avertissement",
        "body": "Payer maintenant :\n<a href='https://tresor-gouv.info/penalite' data-real-link='http://fine-collect.ru/pay'>Régler</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'tresor-gouv.info' imite un site gouvernemental officiel.",
          "URL Obfuscation / Redirect chaining: Le lien réel redirige vers un domaine russe suspect.",
          "Social engineering - Fear / Intimidation: Mention d’un dernier avertissement pour provoquer une réaction rapide."
        ]
      },
      {
        "id": 94,
        "sender": "Service Marketing <marketing@showroomprive.com>",
        "realSender": "marketing@showroomprive.com",
        "subject": "Newsletter interne – Avril 2025",
        "body": "Bonjour,\n\nDécouvrez les succès du mois !\nLire : <a href='https://extranet.showroomprive.com/marketing/newsletter/04-2025' data-real-link='https://extranet.showroomprive.com/marketing/newsletter/04-2025'>Newsletter</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne showroomprive.com et lien vers l'extranet sécurisé.",
          "Legitimate indicator: Email informatif sans demande d'action ou de données."
        ]
      },
      {
        "id": 95,
        "sender": "CEO Office <office@showroomprive.com>",
        "realSender": "office@showroomprive.com",
        "subject": "Invitation – All-hands meeting 08/04/2025",
        "body": "Bonjour à tous,\n\nRendez-vous mardi 08/04 à 10h au Forum.\nAucune inscription requise.\n\nOffice du CEO",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne valide et communication standard de direction.",
          "Legitimate indicator: Pas de demande d’information ni d’urgence."
        ]
      },
      {
        "id": 96,
        "sender": "Visa Secure <alert@visa-verify.com>",
        "realSender": "steal@card-guard.pe",
        "subject": "Transaction suspecte – Vérifiez vos détails",
        "body": "Une dépense de 978 € a été détectée.\nVérifiez : <a href='https://visa-verify.com/security' data-real-link='http://card-guard.pe/login'>Vérifier</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'visa-verify.com' n’est pas associé à Visa.",
          "URL Obfuscation / Redirect chaining: Le lien mène à un domaine péruvien suspect.",
          "Social engineering - Fear / Intimidation: Utilisation d’un montant élevé pour susciter l’inquiétude."
        ]
      },
      {
        "id": 97,
        "sender": "Calendrier RH <conges@showroomprive.com>",
        "realSender": "conges@showroomprive.com",
        "subject": "Validation de votre demande de congés – 15-19/07",
        "body": "Bonjour,\n\nVotre demande a été approuvée.\nVoir le planning : <a href='https://extranet.showroomprive.com/rh/conges' data-real-link='https://extranet.showroomprive.com/rh/conges'>Planning congés</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine interne showroomprive.com et lien extranet sécurisé.",
          "Legitimate indicator: Notification interne standard sans contenu suspect."
        ]
      },
      {
        "id": 98,
        "sender": "Comptabilité Fournisseurs <ap@showroomprive.com>",
        "realSender": "fraude@fake-invoice.de",
        "subject": "RE : Facture en double – Demande de remboursement urgent",
        "body": "Bonjour,\n\nNous avons payé deux fois la facture #F-4589.\nMerci de rembourser 12 450 € sur le compte :\nIBAN : DE89 3704 0044 0532 0130 00\n\nEnvoyez la preuve aujourd’hui.\n\nCordialement,\nJean – Comptabilité",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’adresse réelle diffère du domaine de l’expéditeur affiché.",
          "Social engineering - Urgency: Demande de remboursement immédiat avec forte pression temporelle.",
          "Data harvesting / Credential phishing: Tentative de redirection de fonds vers un compte bancaire externe non vérifié."
        ]
      },
      {
        "id": 99,
        "sender": "Okta <no-reply@okta.com>",
        "realSender": "no-reply@okta.com",
        "subject": "Nouveau facteur d’authentification ajouté",
        "body": "Un nouvel appareil a été enregistré.\nSi ce n’est pas vous : <a href='https://mycompany.okta.com/enduser/settings' data-real-link='https://mycompany.okta.com/enduser/settings'>Sécuriser mon compte</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel okta.com avec lien HTTPS sécurisé.",
          "Legitimate indicator: Notification de sécurité MFA standard sans demande suspecte."
        ]
      },
      {
        "id": 100,
        "sender": "Okta Secure <security@okta-alerts.pro>",
        "realSender": "steal@token-swipe.cc",
        "subject": "Connexion non autorisée – Suspension de compte",
        "body": "Débloquez sous 1 h :\n<a href='https://okta-alerts.pro/unlock' data-real-link='http://token-swipe.cc/login'>Débloquer</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine '.pro' imitant Okta sans lien officiel.",
          "URL Obfuscation / Redirect chaining: Le lien réel pointe vers un site suspect 'token-swipe.cc'.",
          "Social engineering - Urgency: Délai très court pour forcer une réaction impulsive."
        ]
      },
      {
        "id": 139,
        "sender": "SNCF <contact@oui.sncf>",
        "realSender": "contact@oui.sncf",
        "subject": "Confirmation de votre billet Paris-Lyon – 02/05/2025",
        "body": "Bonjour,\n\nVotre billet TGV INOUI Paris Gare de Lyon → Lyon Part-Dieu (Train 6623) du 02/05/2025 à 09 h 58 a bien été émis.\n\nTélécharger votre e-billet : <a href='https://www.oui.sncf/mon-compte/billets' data-real-link='https://www.oui.sncf/mon-compte/billets'>Mes voyages</a>\n\nBon voyage !\n\nL'équipe SNCF Connect",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'oui.sncf' utilisé par la SNCF.",
          "Legitimate indicator: Aucun lien externe ni demande de données sensibles."
        ]
      },
      {
        "id": 140,
        "sender": "Facebook <security@facebookmail.com>",
        "realSender": "alert@fb-security-check.ru",
        "subject": "Alerte : connexion inhabituelle détectée",
        "body": "Bonjour,\n\nVotre compte Facebook a été utilisé pour se connecter depuis :\nAppareil : iPhone 15 – Moscou (RU)\n\nSi ce n'était pas vous, confirmez votre identité ici : <a href='https://facebook.com/security-check' data-real-link='http://fb-login-verify.ru/secure'>Vérifier mon compte</a>\n\nL'équipe Sécurité Facebook",
        "type": "phishing",
        "clues": [
          "URL Obfuscation / Redirect chaining: Le lien réel pointe vers un domaine russe suspect.",
          "Social engineering - Fear / Intimidation: Référence à une connexion en Russie pour semer l’inquiétude.",
          "Email spoofing / Header anomaly: L'adresse réelle ne correspond pas au domaine officiel de Facebook."
        ]
      },
      {
        "id": 141,
        "sender": "EDF <facture@edf.fr>",
        "realSender": "facture@edf.fr",
        "subject": "Votre facture d’électricité – Avril 2025 est disponible",
        "body": "Madame, Monsieur,\n\nVotre facture du 01/04/2025 d’un montant de 74,15 € est en ligne.\n\nConsulter la facture : <a href='https://mon-compte.edf.fr/factures' data-real-link='https://mon-compte.edf.fr/factures'>Espace client</a>\n\nMerci de votre confiance.\n\nEDF – Service Clients",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'edf.fr' utilisé par le fournisseur.",
          "Legitimate indicator: Lien HTTPS vers l’espace client sans contenu trompeur."
        ]
      },
      {
        "id": 142,
        "sender": "Apple ID <no-reply@appleid-lock.com>",
        "realSender": "no-reply@appleid-lock.com",
        "subject": "Votre Apple ID a été verrouillé",
        "body": "Cher(e) client(e),\n\nPour votre sécurité, votre Apple ID a été verrouillé après plusieurs tentatives de connexion.\n\nDéverrouillez votre compte ici : <a href='https://appleid.apple.com/unlock' data-real-link='http://unlock-appleid-secure.net/login'>Déverrouiller</a>\n\nApple Support",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'appleid-lock.com' ressemble à un domaine Apple mais ne l’est pas.",
          "URL Obfuscation / Redirect chaining: Lien réel vers un domaine frauduleux 'unlock-appleid-secure.net'.",
          "Social engineering - Fear / Intimidation: Utilisation d’un compte verrouillé pour forcer l’utilisateur à cliquer."
        ]
      },
      {
        "id": 143,
        "sender": "RH <rh@showroomprive.com>",
        "realSender": "rh@showroomprive.com",
        "subject": "Calendrier des congés d’été – Action requise avant 15/05",
        "body": "Bonjour à tous,\n\nMerci de saisir vos dates de congés estivaux dans l’outil RH avant le 15 mai 2025.\n\nAccès : <a href='https://extranet.showroomprive.com/rh/conges' data-real-link='https://extranet.showroomprive.com/rh/conges'>Portail RH</a>\n\nLe service RH",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Expéditeur interne légitime avec domaine officiel.",
          "Legitimate indicator: Lien extranet sécurisé et contenu conforme à un processus RH."
        ]
      },
      {
        "id": 144,
        "sender": "IT Support <helpdesk@showroomprive.com>",
        "realSender": "tech-update@spoof-mail.xyz",
        "subject": "Mise à jour sécurité webmail – Connexion obligatoire",
        "body": "Chers utilisateurs,\n\nUne mise à jour critique du webmail nécessite une reconnexion immédiate.\n\nVeuillez vous authentifier ici : <a href='https://webmail.showroomprive.com/update' data-real-link='http://webmail-patch.com/login'>Mettre à jour maintenant</a>\n\nService IT",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L’adresse réelle ne correspond pas au domaine showroomprive.com.",
          "URL Obfuscation / Redirect chaining: Le lien réel pointe vers un domaine externe 'webmail-patch.com'.",
          "Social engineering - Urgency: Mention d’une mise à jour critique pour forcer une action immédiate."
        ]
      },
      {
        "id": 145,
        "sender": "Deliveroo <order@deliveroo.fr>",
        "realSender": "order@deliveroo.fr",
        "subject": "Reçu de votre commande n° DR-459312",
        "body": "Bonjour,\n\nMerci ! Votre commande a été livrée.\nTotal TTC : 18,90 €\n\nDétails & facture : <a href='https://deliveroo.fr/orders/DR-459312' data-real-link='https://deliveroo.fr/orders/DR-459312'>Voir ma commande</a>\n\nÀ bientôt,\nDeliveroo",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'deliveroo.fr' et lien cohérent avec la commande.",
          "Legitimate indicator: Aucune sollicitation d’information confidentielle."
        ]
      },
      {
        "id": 146,
        "sender": "La Poste <suivi@laposte-colis.net>",
        "realSender": "scam@customs-fee.ru",
        "subject": "Taxes douanières en attente pour votre colis",
        "body": "Bonjour,\n\nVotre colis n° CB123456789FR nécessite le paiement de 2,95 € de frais avant livraison.\n\nRéglez ici : <a href='https://laposte.fr/paiement-frais' data-real-link='http://pay-customs.ru/form'>Payer maintenant</a>\n\nService Colis La Poste",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'laposte-colis.net' imite le site officiel de La Poste.",
          "URL Obfuscation / Redirect chaining: Lien réel vers un domaine russe inconnu.",
          "Social engineering - Curiosity: Petit montant pour inciter à un paiement rapide sans vérification."
        ]
      },
      {
        "id": 147,
        "sender": "Sécurité IT <securite@showroomprive.com>",
        "realSender": "securite@showroomprive.com",
        "subject": "Déploiement MFA – Activation requise avant 10/05",
        "body": "Bonjour,\n\nLa double authentification sera obligatoire à partir du 10/05/2025.\n\nActivez-la via l’extranet : <a href='https://extranet.showroomprive.com/security/mfa' data-real-link='https://extranet.showroomprive.com/security/mfa'>Activer MFA</a>\n\nMerci,\nÉquipe Sécurité",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne showroomprive.com avec lien extranet.",
          "Legitimate indicator: Communication classique de sécurité sans élément trompeur."
        ]
      },
      {
        "id": 148,
        "sender": "Instagram <alert@instagram.com>",
        "realSender": "copyright@insta-notice.tk",
        "subject": "Avertissement pour violation de droit d’auteur",
        "body": "Bonjour,\n\nNous avons reçu une plainte DMCA concernant une de vos publications.\n\nPour éviter la suppression de votre compte, contestez ici : <a href='https://help.instagram.com/dmca' data-real-link='http://insta-appeal.tk/login'>Faire appel</a>\n\nL’équipe Instagram",
        "type": "phishing",
        "clues": [
          "URL Obfuscation / Redirect chaining: Lien réel vers un domaine trompeur 'insta-appeal.tk'.",
          "Email spoofing / Header anomaly: L'adresse réelle ne provient pas d’un domaine officiel Meta/Instagram.",
          "Social engineering - Fear / Intimidation: Menace de suppression de compte pour déclencher une réaction immédiate."
        ]
      },
      {
        "id": 149,
        "sender": "Spotify <no-reply@spotify.com>",
        "realSender": "no-reply@spotify.com",
        "subject": "Votre reçu – Abonnement Premium Avril 2025",
        "body": "Bonjour,\n\nNous vous confirmons le paiement de 9,99 € pour votre abonnement Spotify Premium.\n\nVoir les détails de votre reçu : <a href='https://www.spotify.com/account/receipt' data-real-link='https://www.spotify.com/account/receipt'>Mon reçu</a>\n\nBonne écoute !\nSpotify",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'spotify.com' et lien sécurisé.",
          "Legitimate indicator: Message de confirmation standard sans demande d’information."
        ]
      },
      {
        "id": 150,
        "sender": "Dropbox <storage@dropbox-storage.com>",
        "realSender": "storage@dropbox-storage.com",
        "subject": "Votre espace est presque plein (97 %)",
        "body": "Bonjour,\n\nVotre stockage Dropbox est presque saturé.\n\nAugmentez votre quota ici : <a href='https://www.dropbox.com/upgrade' data-real-link='http://dropbox-quota.ru/upgrade'>Obtenir +1 To</a>\n\nÉquipe Dropbox",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'dropbox-storage.com' n'appartient pas à Dropbox.",
          "URL Obfuscation / Redirect chaining: Le lien affiché pointe vers dropbox.com mais redirige vers 'dropbox-quota.ru'.",
          "Social engineering - Curiosity: Promesse de 1 To gratuit pour inciter au clic."
        ]
      },
      {
        "id": 151,
        "sender": "IT Operations <it@showroomprive.com>",
        "realSender": "it@showroomprive.com",
        "subject": "Maintenance ERP – 04/05/2025 de 22h à 00h",
        "body": "Bonjour,\n\nUne maintenance planifiée de l’ERP aura lieu le 04/05/2025.\n\nMerci de vous déconnecter avant 21h50.\n\nAucune action supplémentaire requise.\n\nService IT",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne valide sans anomalies.",
          "Legitimate indicator: Message informatif sur une maintenance sans lien ou demande suspecte."
        ]
      },
      {
        "id": 152,
        "sender": "Crédit Agricole <secure@credit-agricole.fr>",
        "realSender": "alert@secure-ca-login.biz",
        "subject": "Message sécurisé – Action immédiate requise",
        "body": "Cher client,\n\nUne activité inhabituelle a été détectée.\n\nConnectez-vous pour vérifier : <a href='https://credit-agricole.fr/secure' data-real-link='http://ca-auth.biz/login'>Accéder au message</a>\n\nCrédit Agricole",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L'adresse réelle n'est pas liée à Crédit Agricole.",
          "URL Obfuscation / Redirect chaining: Lien réel vers un domaine '.biz' non officiel.",
          "Social engineering - Fear / Intimidation: Alerte de sécurité pour inciter à cliquer rapidement."
        ]
      },
      {
        "id": 153,
        "sender": "Air France <info@airfrance.fr>",
        "realSender": "info@airfrance.fr",
        "subject": "Votre réservation AF1684 est confirmée",
        "body": "Madame, Monsieur,\n\nVotre vol AF1684 Paris-Rome du 14/06/2025 est confirmé.\n\nVoir le billet : <a href='https://www.airfrance.fr/manage-booking' data-real-link='https://www.airfrance.fr/manage-booking'>Gérer mon voyage</a>\n\nBon vol,\nAir France",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel airfrance.fr utilisé.",
          "Legitimate indicator: Aucun lien externe ou demande suspecte, contenu conforme à une confirmation de vol."
        ]
      },
      {
        "id": 154,
        "sender": "Microsoft 365 <admin@microsoft-upgrade.com>",
        "realSender": "admin@microsoft-upgrade.com",
        "subject": "Votre licence Microsoft 365 expire aujourd’hui",
        "body": "Bonjour,\n\nRenouvelez votre licence pour éviter la perte d’accès : <a href='https://login.microsoftonline.com/renew' data-real-link='http://ms365-renew.net/cc'>Renouveler maintenant</a>\n\nL’équipe Microsoft",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'microsoft-upgrade.com' trompeur et non affilié à Microsoft.",
          "URL Obfuscation / Redirect chaining: Le lien réel redirige vers un domaine inconnu.",
          "Social engineering - Urgency: Expiration immédiate pour pousser l’utilisateur à agir."
        ]
      },
      {
        "id": 155,
        "sender": "GitHub <noreply@github.com>",
        "realSender": "noreply@github.com",
        "subject": "2FA activée avec succès",
        "body": "Hi,\n\nTwo-factor authentication is now enabled on your GitHub account.\n\nIf this wasn’t you, review security settings: <a href='https://github.com/settings/security' data-real-link='https://github.com/settings/security'>Security settings</a>\n\nThanks,\nGitHub Security",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine github.com officiel utilisé.",
          "Legitimate indicator: Message d'information lié à la sécurité, sans lien vers un domaine externe."
        ]
      },
      {
        "id": 156,
        "sender": "Orange <facture@orange-billing.com>",
        "realSender": "billing@orange-alert.eu",
        "subject": "Dernier rappel : facture impayée",
        "body": "Madame, Monsieur,\n\nVotre facture de 38,47 € reste impayée.\n\nRéglez immédiatement : <a href='https://orange.fr/paiement' data-real-link='http://orange-invoice.eu/pay'>Payer</a>\n\nOrange – Service Recouvrement",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'orange-billing.com' n'est pas affilié à Orange.",
          "URL Obfuscation / Redirect chaining: Lien réel vers un site tiers 'orange-invoice.eu'.",
          "Social engineering - Urgency: Dernier rappel pour créer un sentiment de pression."
        ]
      },
      {
        "id": 157,
        "sender": "CAF <no-reply@caf.fr>",
        "realSender": "no-reply@caf.fr",
        "subject": "Notification de versement – Avril 2025",
        "body": "Madame, Monsieur,\n\nVotre allocation familiale de 214,32 € sera versée le 05/04/2025.\n\nConsulter votre dossier : <a href='https://www.caf.fr/mon-compte' data-real-link='https://www.caf.fr/mon-compte'>Mon compte</a>\n\nCaisse d’Allocations Familiales",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'caf.fr'.",
          "Legitimate indicator: Aucune demande d'information, lien sécurisé vers le compte CAF."
        ]
      },
      {
        "id": 158,
        "sender": "Binance <kyc@binance.com>",
        "realSender": "verify@binance-kyc.co",
        "subject": "Dernier rappel KYC – Compte restreint",
        "body": "Dear user,\n\nComplete KYC to avoid restrictions.\n\nVerify now: <a href='https://binance.com/kyc' data-real-link='http://binance-secure.co/auth'>Start verification</a>\n\nBinance Compliance",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L'adresse réelle 'binance-kyc.co' n'est pas officielle.",
          "URL Obfuscation / Redirect chaining: Lien affiché vers binance.com mais redirige vers 'binance-secure.co'.",
          "Social engineering - Fear / Intimidation: Mention de restriction de compte pour inciter à l'action rapide."
        ]
      },
      {
        "id": 159,
        "sender": "Uber <receipt@uber.com>",
        "realSender": "receipt@uber.com",
        "subject": "Votre reçu de course – 12,36 €",
        "body": "Merci d’avoir voyagé avec Uber.\n\nVoir votre reçu : <a href='https://riders.uber.com/trips' data-real-link='https://riders.uber.com/trips'>Mes trajets</a>\n\nÀ bientôt !",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel 'uber.com'.",
          "Legitimate indicator: Lien légitime vers l'espace client sans incitation suspecte."
        ]
      },
      {
        "id": 160,
        "sender": "Steam <support@steam-account.net>",
        "realSender": "support@steam-account.net",
        "subject": "Votre compte Steam est verrouillé pour activité suspecte",
        "body": "Cher joueur,\n\nPour réactiver votre compte, connectez-vous : <a href='https://store.steampowered.com/login' data-real-link='http://steam-unlock.net/login'>Déverrouiller mon compte</a>\n\nSteam Support",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'steam-account.net' ne correspond pas au domaine officiel de Steam.",
          "URL Obfuscation / Redirect chaining: Le lien affiché est trompeur, le lien réel redirige vers 'steam-unlock.net'.",
          "Social engineering - Fear / Intimidation: Mention de verrouillage de compte pour provoquer une réaction rapide."
        ]
      },
      {
        "id": 161,
        "sender": "Comité RH <events@showroomprive.com>",
        "realSender": "events@showroomprive.com",
        "subject": "Invitation au team-building du 17/06 – Réponse souhaitée",
        "body": "Bonjour,\n\nParticipez à notre team-building annuel le 17 juin (karting & barbecue).\n\nInscription : <a href='https://extranet.showroomprive.com/events/teambuilding' data-real-link='https://extranet.showroomprive.com/events/teambuilding'>Je participe</a>\n\nRH",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne légitime avec lien vers extranet sécurisé.",
          "Legitimate indicator: Aucune demande d'informations sensibles ou pressions."
        ]
      },
      {
        "id": 162,
        "sender": "PayPal <service@paypal.com>",
        "realSender": "invoice@paypal-billing.us",
        "subject": "Nouvelle facture 247,99 € pour Crypto Ltd.",
        "body": "Bonjour,\n\nVous avez reçu une facture. Si vous ne reconnaissez pas ce paiement, annulez dans les 24 h :\n<a href='https://paypal.com/invoice' data-real-link='http://paypal-dispute.us/refund'>Consulter/annuler</a>\n\nService PayPal",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L'adresse réelle ne provient pas de PayPal.",
          "URL Obfuscation / Redirect chaining: Lien affiché légitime mais lien réel pointe vers un domaine frauduleux.",
          "Social engineering - Urgency: Demande d'annulation sous 24h pour inciter à une réaction impulsive."
        ]
      },
      {
        "id": 163,
        "sender": "Apple Store <no-reply@apple.com>",
        "realSender": "no-reply@apple.com",
        "subject": "Votre commande iPad Pro a été expédiée",
        "body": "Bonjour,\n\nVotre iPad Pro arrivera entre le 05/05 et le 07/05.\nSuivre l’expédition : <a href='https://www.apple.com/fr/order-status' data-real-link='https://www.apple.com/fr/order-status'>Suivi commande</a>\n\nMerci pour votre achat.",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine 'apple.com' officiel.",
          "Legitimate indicator: Lien sécurisé vers le suivi de commande Apple sans demande de données sensibles."
        ]
      },
      {
        "id": 164,
        "sender": "DPD <notification@dpd-delivery.net>",
        "realSender": "customs@dpd-pay.ru",
        "subject": "Frais douaniers – Paiement nécessaire",
        "body": "Bonjour,\n\nDes taxes de 1,72 € sont dues pour votre colis. Payer ici : <a href='https://dpd.com/payment' data-real-link='http://dpd-pay.ru/form'>Régler maintenant</a>\n\nDPD",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Domaine 'dpd-delivery.net' non officiel.",
          "URL Obfuscation / Redirect chaining: Lien affiché DPd mais redirige vers un domaine russe.",
          "Social engineering - Curiosity: Montant bas pour réduire la méfiance et inciter au clic rapide."
        ]
      },
      {
        "id": 165,
        "sender": "Île-de-France Mobilités <navigo@idf-mobilites.fr>",
        "realSender": "navigo@idf-mobilites.fr",
        "subject": "Renouvellement réussi de votre passe Navigo",
        "body": "Bonjour,\n\nVotre abonnement annuel Navigo a été renouvelé le 02/04/2025.\n\nTélécharger l’attestation : <a href='https://www.iledefrance-mobilites.fr/attestation' data-real-link='https://www.iledefrance-mobilites.fr/attestation'>Mon espace</a>\n\nMerci.",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel de l'organisme de transport régional.",
          "Legitimate indicator: Lien sécurisé et aucun appel à l'action suspect ou urgent."
        ]
      },
      {
        "id": 166,
        "sender": "Revolut <security@revolut.com>",
        "realSender": "alert@revolut-secure.io",
        "subject": "Compte verrouillé – Vérification nécessaire",
        "body": "Hi,\n\nWe detected unusual activity. Verify identity: <a href='https://revolut.com/verify' data-real-link='http://revolut-restore.io/login'>Verify now</a>\n\nRevolut",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly: L'adresse réelle n'est pas liée au domaine officiel de Revolut.",
          "URL Obfuscation / Redirect chaining: Le lien réel mène vers un domaine inconnu 'revolut-restore.io'.",
          "Social engineering - Fear / Intimidation: Blocage de compte annoncé pour inciter à une action rapide."
        ]
      },
      {
        "id": 167,
        "sender": "Finance <finance@showroomprive.com>",
        "realSender": "finance@showroomprive.com",
        "subject": "Réunion budget prévisionnel Q3 – 08/05/2025",
        "body": "Bonjour,\n\nMerci de préparer vos prévisions avant la réunion.\n\nAgenda : <a href='https://extranet.showroomprive.com/finance/budget' data-real-link='https://extranet.showroomprive.com/finance/budget'>Voir l’ordre du jour</a>\n\nService Finance",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Adresse interne authentique de l'entreprise.",
          "Legitimate indicator: Lien vers un extranet sécurisé, sans demande inhabituelle."
        ]
      },
      {
        "id": 168,
        "sender": "Adobe <billing@adobe-update.com>",
        "realSender": "billing@adobe-update.com",
        "subject": "Échec de paiement – Creative Cloud",
        "body": "Bonjour,\n\nVotre abonnement sera suspendu sous 24 h.\n\nMettez à jour votre carte : <a href='https://account.adobe.com/billing' data-real-link='http://adobe-secure-upd.com/pay'>Mettre à jour</a>\n\nAdobe",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD: Le domaine 'adobe-update.com' ne fait pas partie des domaines officiels d'Adobe.",
          "URL Obfuscation / Redirect chaining: Lien affiché légitime, mais redirige vers un domaine non vérifié.",
          "Social engineering - Urgency: Suspension imminente pour forcer l'utilisateur à cliquer rapidement."
        ]
      },
      {
        "id": 169,
        "sender": "Netflix <news@netflix.com>",
        "realSender": "news@netflix.com",
        "subject": "Nouveautés Mai 2025 – Ce qu’il ne faut pas manquer",
        "body": "Bonjour,\n\nDécouvrez les séries et films qui arrivent ce mois-ci.\n\nVoir le catalogue : <a href='https://www.netflix.com/latest' data-real-link='https://www.netflix.com/latest'>Catalogue</a>\n\nBonne séance !",
        "type": "safe",
        "clues": [
          "Legitimate indicator: Domaine officiel netflix.com utilisé.",
          "Legitimate indicator: Newsletter sans demande de clic suspect ni de collecte de données."
        ]
      },
      {
        "id": 170,
        "sender": "WhatsApp <alert@whatsapp.com>",
        "realSender": "audio@voice-msg.tk",
        "subject": "1 nouveau message vocal",
        "body": "Vous avez reçu un nouveau message vocal (00:24).\n\nÉcouter : <a href='https://www.whatsapp.com/voice' data-real-link='http://voice-msg.tk/play'>Lire le message</a>",
        "type": "phishing",
        "clues": [
          "Email spoofing / Header anomaly : L’expéditeur affiché WhatsApp masque l’adresse réelle voice-msg.tk.",
          "URL Obfuscation / Redirect chaining : Le lien affiché redirige vers un domaine tiers inconnu (voice-msg.tk)."
        ]
      },
      {
        "id": 171,
        "sender": "LinkedIn <jobs-noreply@linkedin.com>",
        "realSender": "jobs-noreply@linkedin.com",
        "subject": "6 nouvelles offres pour ‘Chef de projet e-commerce’",
        "body": "Bonjour,\n\nNous avons trouvé 6 nouvelles offres qui correspondent à votre profil.\n\nVoir les offres : <a href='https://www.linkedin.com/jobs/' data-real-link='https://www.linkedin.com/jobs/'>Parcourir</a>\n\nBonne recherche !",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Le domaine linkedin.com est utilisé de manière cohérente et authentique.",
          "Legitimate indicator : Le contenu correspond au format habituel des alertes LinkedIn."
        ]
      },
      {
        "id": 172,
        "sender": "Tesla <service@tesla-alerts.com>",
        "realSender": "service@tesla-alerts.com",
        "subject": "Rappel de sécurité urgent – Model 3",
        "body": "Madame, Monsieur,\n\nVotre Model 3 doit être inspecté.\n\nPrenez rendez-vous : <a href='https://tesla.com/recall' data-real-link='http://tesla-recall-alert.com/appt'>Réserver</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine tesla-alerts.com imite Tesla mais n'est pas officiel.",
          "URL Obfuscation / Redirect chaining : Le lien affiché cache une redirection vers tesla-recall-alert.com.",
          "Social engineering - Urgency : L’objet évoque une urgence pour inciter à une réaction précipitée."
        ]
      },
      {
        "id": 173,
        "sender": "Fitbit <support@fitbit.com>",
        "realSender": "support@fitbit.com",
        "subject": "Confirmation de garantie – Versa 4",
        "body": "Bonjour,\n\nVotre montre Versa 4 est maintenant enregistrée sous garantie.\n\nConsulter le détail : <a href='https://www.fitbit.com/warranty' data-real-link='https://www.fitbit.com/warranty'>Ma garantie</a>\n\nMerci, Fitbit",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Le domaine fitbit.com est utilisé sans altération.",
          "Legitimate indicator : Il s'agit d'un message de confirmation classique post-achat."
        ]
      },
      {
        "id": 174,
        "sender": "Mondial Relay <info@mondialrelay-exp.net>",
        "realSender": "fees@customs-relay.ru",
        "subject": "Frais d’importation restants : 3,49 €",
        "body": "Bonjour,\n\nRéglez les frais pour débloquer votre colis : <a href='https://mondialrelay.fr/pay' data-real-link='http://customs-relay.ru/form'>Payer</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine mondialrelay-exp.net imite Mondial Relay sans être officiel.",
          "URL Obfuscation / Redirect chaining : Le lien réel mène à un domaine russe tiers (customs-relay.ru).",
          "Social engineering - Urgency : Montant faible + incitation à payer rapidement pour débloquer un colis."
        ]
      },
      {
        "id": 175,
        "sender": "Slack <no-reply@slack.com>",
        "realSender": "no-reply@slack.com",
        "subject": "Votre espace Showroomprive passe au plan Pro",
        "body": "Bonjour,\n\nLes fonctionnalités Pro seront activées le 06/05/2025.\n\nEn savoir plus : <a href='https://slack.com/help/pro' data-real-link='https://slack.com/help/pro'>Détails</a>\n\nL’équipe Slack",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Le domaine slack.com est officiel et utilisé correctement.",
          "Legitimate indicator : Message informatif sans demande d’action urgente ou lien suspect."
        ]
      },
      {
        "id": 176,
        "sender": "N26 <alerts@n26-bank.eu>",
        "realSender": "alerts@n26-bank.eu",
        "subject": "Débit suspect de 799 € – Compte restreint",
        "body": "Bonjour,\n\nUn paiement suspect a été bloqué.\n\nVérifiez immédiatement : <a href='https://n26.com/secure' data-real-link='http://n26-alert-secure.eu/login'>Vérifier</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine n26-bank.eu est une imitation du domaine officiel n26.com.",
          "URL Obfuscation / Redirect chaining : Le lien apparent cache une redirection vers n26-alert-secure.eu.",
          "Social engineering - Fear / Intimidation : Mention d’un débit élevé et blocage du compte pour créer la panique."
        ]
      },
      {
        "id": 177,
        "sender": "Facilities <batiment@showroomprive.com>",
        "realSender": "batiment@showroomprive.com",
        "subject": "Exercice d’évacuation incendie – 07/05 à 10h",
        "body": "Bonjour,\n\nUn exercice aura lieu. Merci de suivre les instructions des guides d’évacuation.\n\nAucune réponse nécessaire.",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Message interne sans lien externe ni demande inhabituelle.",
          "Legitimate indicator : Communication de routine liée à la sécurité des locaux."
        ]
      },
      {
        "id": 178,
        "sender": "CAF <service@caf-alloc.info>",
        "realSender": "update@caf-alloc.info",
        "subject": "Erreur de virement – Mise à jour RIB",
        "body": "Madame, Monsieur,\n\nVotre dernier virement a échoué.\n\nMettez à jour votre RIB : <a href='https://caf.fr/update' data-real-link='http://caf-secure.info/rib'>Mettre à jour</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine caf-alloc.info n'est pas celui de la CAF (caf.fr).",
          "URL Obfuscation / Redirect chaining : Le lien apparent redirige vers un site tiers caf-secure.info.",
          "Data harvesting / Credential phishing : Demande de mise à jour du RIB sous prétexte d’un virement échoué."
        ]
      },
      {
        "id": 179,
        "sender": "Coursera <no-reply@coursera.org>",
        "realSender": "no-reply@coursera.org",
        "subject": "Rappel : cours ‘Data Science’ démarre demain",
        "body": "Hello,\n\nVotre cours commence le 29/04/2025.\n\nPréparez-vous : <a href='https://www.coursera.org/learn/data-science' data-real-link='https://www.coursera.org/learn/data-science'>Accéder</a>\n\nBonne chance !",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Domaine coursera.org authentique avec lien direct vers la plateforme.",
          "Legitimate indicator : Contenu cohérent avec une notification de cours en ligne."
        ]
      },
      {
        "id": 180,
        "sender": "TikTok <support@tiktok.com>",
        "realSender": "verify@tiktok-age.eu",
        "subject": "Vérification d’âge requise pour continuer",
        "body": "Bonjour,\n\nPour respecter la réglementation, confirmez votre âge ici : <a href='https://tiktok.com/verify-age' data-real-link='http://tiktok-age.eu/login'>Vérifier</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine tiktok-age.eu n'est pas affilié officiellement à TikTok.",
          "URL Obfuscation / Redirect chaining : Le lien visible cache une redirection vers un domaine externe (tiktok-age.eu).",
          "Data harvesting / Credential phishing : Le message tente d’obtenir des données personnelles sous couvert de vérification d’âge."
        ]
      },
      {
        "id": 181,
        "sender": "Comité Solidarité <solidarite@showroomprive.com>",
        "realSender": "solidarite@showroomprive.com",
        "subject": "Collecte pour l’association ‘Enfants du Monde’",
        "body": "Bonjour,\n\nNous organisons une collecte de livres pour enfants jusqu’au 20/05.\n\nDétails : <a href='https://extranet.showroomprive.com/solidarite' data-real-link='https://extranet.showroomprive.com/solidarite'>En savoir plus</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Message interne provenant d’un domaine d’entreprise connu.",
          "Legitimate indicator : Lien extranet sécurisé sans collecte d'informations sensibles."
        ]
      },
      {
        "id": 182,
        "sender": "Epic Games <noreply@epicgames.com>",
        "realSender": "free-vbucks@epic-promo.ru",
        "subject": "2000 V-Bucks gratuits pour les joueurs fidèles !",
        "body": "Bonjour Gamer,\n\nRéclamez vos V-Bucks : <a href='https://www.epicgames.com/fortnite' data-real-link='http://epic-promo.ru/free'>Obtenir</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine epic-promo.ru tente d’imiter Epic Games sans être officiel.",
          "URL Obfuscation / Redirect chaining : Le lien réel dirige vers un domaine russe inconnu.",
          "Social engineering - Curiosity : La promesse de récompense gratuite pousse à cliquer sans réfléchir."
        ]
      },
      {
        "id": 183,
        "sender": "Google Calendar <calendar@google.com>",
        "realSender": "calendar@google.com",
        "subject": "Invitation : Sprint Review – 30/04 15h-16h",
        "body": "Vous avez été invité à un événement.\n\nAccepter : <a href='https://calendar.google.com/event' data-real-link='https://calendar.google.com/event'>Voir l’invitation</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Invitation conforme envoyée depuis l’adresse officielle google.com.",
          "Legitimate indicator : Lien vers l’interface sécurisée de Google Calendar."
        ]
      },
      {
        "id": 184,
        "sender": "Crédit Mutuel <alerte@creditmutuel.fr>",
        "realSender": "alerte@creditmutuel-secure.biz",
        "subject": "Débit inconnu de 1 024 €",
        "body": "Bonjour,\n\nValidez ou refusez la transaction : <a href='https://creditmutuel.fr/security' data-real-link='http://creditmutuel-secure.biz/login'>Gérer</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine creditmutuel-secure.biz n’appartient pas à Crédit Mutuel.",
          "URL Obfuscation / Redirect chaining : Le lien réel redirige vers un domaine externe non sécurisé.",
          "Social engineering - Fear / Intimidation : Le montant élevé sert à créer un sentiment d’urgence."
        ]
      },
      {
        "id": 185,
        "sender": "IT Release <release@showroomprive.com>",
        "realSender": "release@showroomprive.com",
        "subject": "Code freeze du 10/05 au 13/05",
        "body": "Bonjour,\n\nAucun déploiement ne sera autorisé durant ce créneau.\n\nMerci de planifier vos mises en production.",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Message interne sur un sujet opérationnel lié à l’IT.",
          "Legitimate indicator : Aucun lien ni demande d'information personnelle."
        ]
      },
      {
        "id": 186,
        "sender": "Hello Bank! <heritage@hellobank-inherit.com>",
        "realSender": "heritage@hellobank-inherit.com",
        "subject": "Vous avez droit à un héritage de 2 100 000 €",
        "body": "Cher(e) bénéficiaire,\n\nContactez-nous pour débloquer les fonds : <a href='https://hellobank.fr/heritage' data-real-link='http://inherit-funds.net/app'>Accéder</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine hellobank-inherit.com imite Hello Bank sans être légitime.",
          "URL Obfuscation / Redirect chaining : Le lien cache une redirection vers inherit-funds.net.",
          "Social engineering - Curiosity : Promesse d’héritage exceptionnel pour inciter à cliquer."
        ]
      },
      {
        "id": 187,
        "sender": "Amazon Prime Video <primevideo@amazon.com>",
        "realSender": "primevideo@amazon.com",
        "subject": "Nouveautés de la semaine",
        "body": "Bonjour,\n\nDécouvrez les sorties : <a href='https://primevideo.com/new' data-real-link='https://primevideo.com/new'>Regarder</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Message officiel en provenance d’Amazon Prime Video.",
          "Legitimate indicator : Aucun contenu suspect ni demande d'informations sensibles."
        ]
      },
      {
        "id": 188,
        "sender": "Darty <sav@darty-garantie.com>",
        "realSender": "support@garantie-darty.ru",
        "subject": "Extension de garantie expirée",
        "body": "Bonjour,\n\nRenouvelez ici : <a href='https://darty.com/warranty' data-real-link='http://garantie-darty.ru/pay'>Renouveler</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine darty-garantie.com usurpe Darty sans autorisation.",
          "URL Obfuscation / Redirect chaining : Redirection vers un domaine russe non fiable (garantie-darty.ru).",
          "Social engineering - Fear / Intimidation : Mention d’une garantie expirée pour inciter à agir rapidement."
        ]
      },
      {
        "id": 189,
        "sender": "Zoom <no-reply@zoom.us>",
        "realSender": "no-reply@zoom.us",
        "subject": "Confirmation d’inscription – Webinar 05/05/2025",
        "body": "Bonjour,\n\nVotre inscription est confirmée.\n\nRejoindre : <a href='https://zoom.us/j/123456789' data-real-link='https://zoom.us/j/123456789'>Lien de réunion</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Message conforme envoyé depuis le domaine zoom.us.",
          "Legitimate indicator : Lien direct vers une réunion Zoom sans redirection externe."
        ]
      },
      {
        "id": 190,
        "sender": "Ubisoft Connect <alert@ubisoftconnect.com>",
        "realSender": "alert@ubisoft-alert.tk",
        "subject": "Tentative de connexion depuis Kiev",
        "body": "Bonjour,\n\nSi ce n’était pas vous, réinitialisez votre mot de passe : <a href='https://ubisoftconnect.com/security' data-real-link='http://ubisoft-alert.tk/reset'>Sécuriser</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine ubisoft-alert.tk n’est pas affilié à Ubisoft.",
          "URL Obfuscation / Redirect chaining : Le lien affiché cache une redirection vers ubisoft-alert.tk.",
          "Social engineering - Fear / Intimidation : Mention d'une connexion suspecte pour pousser à agir immédiatement."
        ]
      },
      {
        "id": 191,
        "sender": "RH Bien-être <bienetre@showroomprive.com>",
        "realSender": "bienetre@showroomprive.com",
        "subject": "Sondage bien-être au travail (5 min)",
        "body": "Bonjour,\n\nPartagez votre avis : <a href='https://extranet.showroomprive.com/survey' data-real-link='https://extranet.showroomprive.com/survey'>Répondre</a>\n\nMerci !",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Envoi interne depuis un domaine d’entreprise connu.",
          "Legitimate indicator : Lien extranet vers un sondage sans collecte de données sensibles."
        ]
      },
      {
        "id": 192,
        "sender": "SFR <service@sfr-facture.net>",
        "realSender": "service@sfr-facture.net",
        "subject": "Dépassement de forfait – Paiement immédiat",
        "body": "Bonjour,\n\nRéglez 12 € de hors-forfait : <a href='https://sfr.fr/pay' data-real-link='http://sfr-billing.ru/pay'>Payer</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : sfr-facture.net n’est pas un domaine officiel de SFR.",
          "URL Obfuscation / Redirect chaining : Lien apparent vers sfr.fr, mais redirection vers sfr-billing.ru.",
          "Social engineering - Urgency : Demande de paiement immédiat pour inciter à une réaction rapide."
        ]
      },
      {
        "id": 193,
        "sender": "SNCF <indemnites@sncf.fr>",
        "realSender": "indemnites@sncf.fr",
        "subject": "Indemnisation retard TGV – 17,50 €",
        "body": "Bonjour,\n\nVotre bon d’achat est disponible : <a href='https://sncf.indemnisation.fr' data-real-link='https://sncf.indemnisation.fr'>Télécharger</a>\n\nCordialement,\nSNCF",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Domaine sncf.fr utilisé correctement pour une communication d’indemnisation.",
          "Legitimate indicator : Montant réaliste et absence de demande d’informations personnelles."
        ]
      },
      {
        "id": 194,
        "sender": "PayPal <refund@paypal-service.com>",
        "realSender": "refund@paypal-service.com",
        "subject": "Vous avez reçu un remboursement de 189,00 €",
        "body": "Bonjour,\n\nConsultez votre solde : <a href='https://paypal.com/refund' data-real-link='http://paypal-refund-now.com/login'>Voir remboursement</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : paypal-service.com n’est pas un domaine officiel de PayPal.",
          "URL Obfuscation / Redirect chaining : Lien affiché pointe vers paypal.com, mais redirige vers un faux domaine.",
          "Social engineering - Curiosity : Appât financier utilisé pour pousser à cliquer sur le lien."
        ]
      },
      {
        "id": 195,
        "sender": "Microsoft Teams <noreply@teams.microsoft.com>",
        "realSender": "noreply@teams.microsoft.com",
        "subject": "Invitation à la réunion ‘Roadmap Q3’",
        "body": "Hi,\n\nJoin the meeting : <a href='https://teams.microsoft.com/l/meetup-join/19%3ameeting' data-real-link='https://teams.microsoft.com/l/meetup-join/19%3ameeting'>Join</a>",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Domaine microsoft.com utilisé de façon cohérente.",
          "Legitimate indicator : Lien direct vers l’interface Teams sans redirection externe."
        ]
      },
      {
        "id": 196,
        "sender": "Coinbase <alert@coinbase.com>",
        "realSender": "auth@coinbase-ledger.biz",
        "subject": "Connectez-vous pour lier votre Ledger",
        "body": "Dear user,\n\nSecure your assets : <a href='https://coinbase.com/ledger' data-real-link='http://coinbase-ledger.biz/login'>Link now</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine coinbase-ledger.biz n’est pas un domaine officiel de Coinbase.",
          "URL Obfuscation / Redirect chaining : Le lien visible masque une redirection vers un faux domaine.",
          "Social engineering - Curiosity : Fausse promesse de sécurisation pour inciter à renseigner des identifiants crypto."
        ]
      },
      {
        "id": 197,
        "sender": "Orange Fibre <info@orange.fr>",
        "realSender": "info@orange.fr",
        "subject": "Maintenance réseau – Nuit du 05/05",
        "body": "Bonjour,\n\nUne coupure de 00h à 04h est prévue.\n\nAucune action de votre part n’est requise.\n\nOrange",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Message informatif envoyé depuis le domaine orange.fr.",
          "Legitimate indicator : Aucun lien ni demande d’action ; communication purement informative."
        ]
      },
      {
        "id": 198,
        "sender": "Colissimo <track@colissimo-exp.net>",
        "realSender": "fees@colis-tax.ru",
        "subject": "Paiement de TVA pour colis CE987654321FR",
        "body": "Bonjour,\n\nRéglez 4,11 € pour la livraison : <a href='https://colissimo.fr/pay' data-real-link='http://colis-tax.ru/form'>Payer</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : colissimo-exp.net et colis-tax.ru imitent Colissimo sans être officiels.",
          "URL Obfuscation / Redirect chaining : Le lien apparent cache une redirection vers un domaine russe suspect.",
          "Social engineering - Urgency : Petit montant + référence colis pour inciter à une action rapide."
        ]
      },
      {
        "id": 199,
        "sender": "Instagram <security@mail.instagram.com>",
        "realSender": "security@mail.instagram.com",
        "subject": "Code de connexion : 542 318",
        "body": "Utilisez ce code pour terminer votre connexion.\n\nCe code expire dans 10 minutes.",
        "type": "safe",
        "clues": [
          "Legitimate indicator : Code d’authentification envoyé depuis l’adresse officielle d’Instagram.",
          "Legitimate indicator : Aucun lien ni collecte d’informations personnelles dans le message."
        ]
      },
      {
        "id": 200,
        "sender": "Binance <no-reply@binance.com>",
        "realSender": "alert@binance-withdrw.ru",
        "subject": "Confirmation de retrait 4 850 USDT",
        "body": "Dear user,\n\nIf this wasn’t you cancel here : <a href='https://binance.com/cancel' data-real-link='http://binance-withdrw.ru/cancel'>Cancel withdrawal</a>",
        "type": "phishing",
        "clues": [
          "Domain fraud / Suspicious TLD : Le domaine binance-withdrw.ru imite Binance sans être légitime.",
          "URL Obfuscation / Redirect chaining : Le lien visible cache une redirection vers un domaine externe non officiel.",
          "Social engineering - Fear / Intimidation : Montant élevé et retrait non autorisé pour susciter une réaction rapide."
        ]
      }

];
