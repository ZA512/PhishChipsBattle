# 💡 PhishChipsBattle – Idées d'évolution

> Propositions classées par effort et impact. Rédigé le 29 avril 2026.

---

## 🟢 Court terme (quick wins, 1-3 jours chacun)

### 1. Mode sombre 🌙

Les CSS variables (`--primary-color`, `--text-color`, `--border-color`, etc.) sont déjà en place dans `style.css`. Il suffit d'ajouter :
- Un bouton toggle dans le header
- Une classe `body.dark` avec les variables inversées
- Persistance du choix via `localStorage`

**Effort :** ~2h | **Impact :** UX

---

### 2. Export CSV des classements

Ajouter un bouton "📥 Exporter" sur la page `scores.html` qui génère un CSV côté client à partir des données déjà chargées.

```javascript
function exportCsv(rows) {
  const csv = ['Rang,Pseudo,Service,Score,Parties']
    .concat(rows.map((r, i) => `${i+1},${r.name},${r.service_name||''},${r.best_score},${r.games_played}`))
    .join('\n');
  // Télécharger...
}
```

**Effort :** ~2h | **Impact :** Utile pour les RSSI

---

### 3. Dashboard statistiques admin

Nouvelle page `admin-stats.html` accessible depuis l'admin avec :
- Taux de réussite global (% bonnes réponses)
- Top 5 emails les plus ratés (avec id et sujet)
- Temps moyen de décision par difficulté
- Nombre de joueurs et parties par jour/semaine

Les données peuvent venir de nouveaux endpoints admin :
```
GET /api/admin/stats/overview
GET /api/admin/stats/hardest-emails
GET /api/admin/stats/activity?period=week
```

**Effort :** 1-2 jours | **Impact :** Très utile pour piloter la sensibilisation

---

### 4. CRUD admin pour les emails

Étendre la page admin pour gérer les emails du jeu :
- Lister les emails existants (sender, subject, type, nb d'indices)
- Créer/modifier/supprimer un email avec ses indices
- Importer un lot d'emails depuis un fichier JSON
- Prévisualiser un email tel qu'il apparaît dans le jeu

**Effort :** 2-3 jours | **Impact :** Autonomie pour mettre à jour le contenu sans toucher la DB

---

### 5. Recap détaillé post-partie

Après le game over, afficher un récapitulatif complet :
- Liste de chaque email joué avec le choix du joueur, le résultat, et le temps
- Mise en évidence des erreurs avec les indices
- Conseils ciblés selon le type de phishing raté (spear-phishing, typosquatting, urgence sociale, etc.)

Les données d'`email_answers` sont déjà en base — il suffit d'un endpoint :
```
GET /api/sessions/:id/recap
```

**Effort :** 1-2 jours | **Impact :** Pédagogique, c'est le cœur de la sensibilisation

---

## 🟡 Moyen terme (1-2 semaines chacun)

### 6. Système d'achievements / badges

Exemples de badges :
| Badge | Condition |
|-------|-----------|
| 🎯 Sans faute | Terminer une partie avec 0 erreur |
| 🔥 Série de 5 | 5 bonnes réponses consécutives |
| ⚡ Speed Demon | Temps moyen < 5s par email |
| 🏆 Vétéran | 10 parties terminées |
| 🛡️ Bouclier | Aucun joker utilisé sur une partie complète |
| 🌟 Top 3 | Apparaître dans le top 3 mensuel |
| 🎪 Tous les services | Jouer dans 3 services différents |

**Schema :**
```sql
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    key VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    emoji VARCHAR(10),
    criteria JSONB  -- conditions machine-readable
);

CREATE TABLE player_achievements (
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id),
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (player_id, achievement_id)
);
```

**Effort :** 1 semaine | **Impact :** Engagement et rétention

---

### 7. Campagnes mensuelles thématiques

Permettre de taguer les emails par thème et de créer des "campagnes" :
- 🎄 Spécial fêtes (faux colis, fausses promos)
- 💰 Spécial impôts (phishing fiscal)
- 🏢 Spécial RH (faux emails internes, arnaque au président)
- 🛒 Spécial Black Friday

Les sessions piocheraient dans le pool de la campagne active en priorité.

```sql
ALTER TABLE emails ADD COLUMN campaign VARCHAR(50);
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT FALSE,
    start_date DATE,
    end_date DATE
);
```

**Effort :** 1 semaine | **Impact :** Renouvellement du contenu, pertinence saisonnière

---

### 8. Mode challenge inter-services

Un service peut "défier" un autre service. Pendant la période du défi, on compare les scores moyens des deux services. Visible sur un tableau dédié.

Interface :
- Page `challenges.html` avec la liste des défis en cours
- L'admin crée un défi via la page admin (service A vs service B, date début/fin)

**Effort :** 1-2 semaines | **Impact :** Stimule la compétition inter-équipes

---

### 9. PWA (Progressive Web App)

Le jeu est déjà full client-side pendant une session (les emails sont chargés un par un). Ajouter :
- `manifest.json` (icône, nom, couleurs)
- Service worker pour le cache des assets statiques
- Possibilité d'installer l'app sur mobile

```json
{
  "name": "Phish & Chips Battle",
  "short_name": "PhishChips",
  "start_url": "/phishing.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0078d4"
}
```

**Effort :** 3-5 jours | **Impact :** Accessibilité mobile, expérience app native

---

### 10. Notifications / rappels

Envoyer un email récapitulatif aux joueurs (opt-in) :
- Rappel mensuel : "Le classement du mois est ouvert !"
- Alerte quand un joueur du même service bat ton score
- Résumé mensuel du RSSI : taux de participation, progression

Peut utiliser un simple cron + Nodemailer ou un service tiers (SendGrid, Mailjet).

**Effort :** 1 semaine | **Impact :** Rétention, engagement

---

## 🔵 Long terme (semaines/mois)

### 11. Mode multijoueur temps réel

Battle synchrone entre 2 joueurs via WebSocket :
- Même série d'emails pour les deux
- Écran splitté ou side-by-side
- Le plus rapide à classifier correctement marque un bonus
- Score final comparé en temps réel

**Stack :** `socket.io` côté backend, nouvelle page `battle.html`.

**Effort :** 2-3 semaines | **Impact :** Viralité, fun

---

### 12. Difficulté progressive intelligente

Au lieu de 3 niveaux fixes, adapter la difficulté en temps réel :
- Commencer avec des emails faciles (indices évidents)
- Augmenter la subtilité au fur et à mesure des bonnes réponses
- Ajuster le timer dynamiquement
- Tagger les emails par niveau de subtilité (`easy`, `medium`, `hard`, `expert`)

```sql
ALTER TABLE emails ADD COLUMN difficulty_score INTEGER DEFAULT 50; -- 0-100
```

Le serveur pioche les emails en montant progressivement dans le `difficulty_score`.

**Effort :** 2 semaines | **Impact :** Meilleure courbe d'apprentissage

---

### 13. Génération d'emails par IA

Utiliser un LLM (Azure OpenAI) pour :
- Générer de nouveaux scénarios de phishing réalistes
- Varier les formulations à chaque partie (même structure, wording différent)
- Adapter le contenu au secteur d'activité de l'entreprise
- Créer automatiquement les indices pédagogiques

Flow :
1. Un admin décrit un scénario (ex : "phishing bancaire avec typosquatting")
2. Le LLM génère l'email + les indices
3. L'admin valide / ajuste avant publication

**Effort :** 2-3 semaines | **Impact :** Contenu illimité, réalisme accru

---

### 14. API de reporting pour RSSI

Endpoints protégés pour extraire les métriques de sensibilisation :
```
GET /api/admin/reports/participation?from=2026-01&to=2026-04
GET /api/admin/reports/success-rate?service=DSI&period=monthly
GET /api/admin/reports/risk-profile?service=COMPTA
GET /api/admin/reports/progress?player=42
```

Sortie JSON + option `?format=csv` pour import Excel.

Métriques clés :
- Taux de participation par service
- Évolution du taux de réussite dans le temps
- Types de phishing les plus ratés par population
- Score moyen par ancienneté (nombre de parties jouées)

**Effort :** 2 semaines | **Impact :** Justification ROI de la sensibilisation

---

### 15. Intégration SSO / annuaire d'entreprise

Remplacer le système pseudo+email par une authentification SSO :
- SAML 2.0 / OpenID Connect via le fournisseur d'identité de l'entreprise
- Auto-remplissage du service depuis l'annuaire
- Possibilité de restreindre l'accès au jeu (groupes AD)

Alternative intermédiaire : OAuth2 avec Microsoft Entra ID (Azure AD).

**Effort :** 2-3 semaines | **Impact :** Sécurité, facilité d'utilisation, données fiables

---

## 📊 Matrice effort / impact

```
                       Impact élevé
                           │
         ┌─────────────────┼─────────────────┐
         │    5. Recap      │  6. Achievements │
         │    3. Dashboard  │  7. Campagnes    │
         │    4. CRUD emails│ 14. API RSSI     │
Effort   │    2. Export CSV │ 12. Difficulté   │
faible ──┼─────────────────┼─────────────────── Effort
         │    1. Mode sombre│ 11. Multijoueur  │  élevé
         │                  │ 13. IA emails    │
         │                  │ 15. SSO          │
         │    9. PWA        │  8. Challenges   │
         │   10. Notifs     │                  │
         └─────────────────┼─────────────────┘
                           │
                      Impact faible
```

**Ordre recommandé :** 1 → 5 → 3 → 4 → 2 → 6 → 7 → 14 → 12 → 9 → 8 → 13 → 11 → 15
