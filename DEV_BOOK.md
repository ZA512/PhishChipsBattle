# 📋 PhishChipsBattle – Dev Book

> Audit complet réalisé le 29 avril 2026.
> Ce document recense tous les bugs, problèmes de sécurité et améliorations techniques à effectuer.

---

## 🔴 Bugs critiques

### BUG-1 : `scores.js` — Fonctions dupliquées (écrasement)

**Fichier :** `frontend/scores.js`
**Gravité :** 🔴 Critique — Les fonctionnalités filtrage par difficulté et streaks sont cassées en production.

**Description :**
Le fichier contient **deux jeux de définitions** des mêmes fonctions :
- **Lignes ~1-295** : version complète avec support du filtre `difficulty` et des `streak` badges.
- **Lignes ~300+** : ancienne version sans ces features.

En JavaScript, la seconde définition **écrase** silencieusement la première. Résultat :
- `renderPlayersTable(rows)` ignore le paramètre `showStreak`
- `renderServicesTable(rows)` ignore le paramètre `showStreak`
- `fetchPlayers(month)` ignore le paramètre `difficulty`
- `fetchServices(month)` ignore le paramètre `difficulty`
- `fetchServiceDetail(id, month)` ignore le paramètre `difficulty`
- `nowYYYYMM`, `prevMonth`, `nextMonth`, `formatMonth`, `medal`, `escHtml` sont redéfinis inutilement
- `loadTab` est redéfini sans support de `activeDifficulty`

**Correction :**
Supprimer tout le bloc dupliqué à partir de la ligne ~288 (deuxième définition de `nowYYYYMM`). Ne garder que les premières définitions (lignes 1-287 environ) qui supportent `difficulty` et `showStreak`.

**Test :**
1. Aller sur la page scores
2. Sélectionner un filtre de difficulté → les scores doivent se filtrer
3. Aller en vue mensuelle → les badges 🔥streak doivent apparaître

---

### BUG-2 : `constantTimeEqual` fuite la longueur du mot de passe

**Fichier :** `backend/src/middleware/adminAuth.js` (ligne 27)
**Gravité :** 🔴 Sécurité

**Description :**
```javascript
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;  // ← fuite par timing
  // ...
}
```
Le `return false` immédiat quand les longueurs diffèrent permet une attaque par timing pour deviner la longueur du mot de passe admin.

**Correction :**
Remplacer par `crypto.timingSafeEqual` de Node.js :
```javascript
const crypto = require('crypto');

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Compare quand même pour éviter le timing leak
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
```

---

### BUG-3 : `players.js` — Race condition sans transaction

**Fichier :** `backend/src/routes/players.js`, route `POST /`
**Gravité :** 🟠 Élevé

**Description :**
Le code fait `SELECT` puis `INSERT` sans `BEGIN/COMMIT`. Deux requêtes simultanées avec le même pseudo/email peuvent passer le check et l'une échouera avec une erreur Postgres non attrapée (`23505` unique violation) qui n'est pas gérée dans le catch.

**Correction :**
1. Entourer les requêtes de `BEGIN` / `COMMIT` / `ROLLBACK`
2. Ajouter un `catch` sur l'INSERT pour gérer l'erreur `23505` (conflit d'unicité) proprement
3. Ou utiliser `INSERT ... ON CONFLICT` pour une solution sans transaction

---

### BUG-4 : `sessionId` NaN passé en SQL

**Fichier :** `backend/src/routes/sessions.js`
**Routes :** `GET /:id/next-email`, `POST /:id/answer`, `POST /:id/end`
**Gravité :** 🟠 Élevé

**Description :**
`parseInt(req.params.id, 10)` n'est pas vérifié pour `NaN` avant utilisation dans les requêtes SQL. Un appel avec `/api/sessions/abc/next-email` provoquera une erreur SQL.

**Correction :**
Ajouter après chaque `parseInt` :
```javascript
const sessionId = parseInt(req.params.id, 10);
if (isNaN(sessionId)) return res.status(400).json({ error: 'ID de session invalide' });
```

---

### BUG-5 : `JWT_SECRET` non validé au démarrage

**Fichier :** `backend/src/app.js` et `backend/src/routes/sessions.js`
**Gravité :** 🟠 Élevé

**Description :**
`JWT_SECRET` est lu depuis `process.env` mais jamais validé. Si absent, `jwt.sign()` crashera avec une erreur cryptique.

**Correction :**
Dans `app.js`, dans la fonction `start()`, avant `migrate()` :
```javascript
if (!process.env.JWT_SECRET) {
  console.error('[api] JWT_SECRET is required');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error('[api] ADMIN_PASSWORD is required');
  process.exit(1);
}
```

---

### BUG-6 : `serviceId` non validé dans `players.js`

**Fichier :** `backend/src/routes/players.js`
**Gravité :** 🟡 Moyen

**Description :**
Le `serviceId` du body est passé directement à la requête SQL sans `parseInt()` ni vérification de type. Un `serviceId: "abc"` causera une erreur Postgres.

**Correction :**
```javascript
const svcId = serviceId ? parseInt(serviceId, 10) : null;
if (serviceId && isNaN(svcId)) {
  return res.status(400).json({ error: 'serviceId invalide' });
}
```

---

## 🟠 Problèmes de sécurité

### SEC-1 : CORS `*` par défaut

**Fichier :** `backend/src/app.js` (ligne 24)

```javascript
origin: process.env.CORS_ORIGIN || '*',
```

En production, si `CORS_ORIGIN` n'est pas défini, toute origine peut appeler l'API.

**Correction :**
1. Ajouter `CORS_ORIGIN` dans `.env.example` avec une valeur par défaut sûre
2. En prod sans variable, refuser (pas de wildcard) :
```javascript
origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : '*'),
```

---

### SEC-2 : Headers de sécurité manquants dans Nginx

**Fichier :** `frontend/nginx.conf`

**Manquant :**
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

### SEC-3 : Pas de healthcheck API dans `docker-compose.yml`

**Fichier :** `docker-compose.yml`

Le service `frontend` dépend de `api` avec un simple `depends_on: - api` (sans condition `service_healthy`). Nginx peut démarrer avant que l'API soit prête.

**Correction :**
Ajouter un healthcheck au service `api` :
```yaml
api:
  # ...
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
    interval: 5s
    timeout: 5s
    retries: 10

frontend:
  depends_on:
    api:
      condition: service_healthy
```

---

### SEC-4 : Cache Nginx sur `index.html` / `phishing.html`

**Fichier :** `frontend/nginx.conf`

Les fichiers HTML sont servis sans header `Cache-Control`. Après un déploiement, les utilisateurs peuvent avoir une version périmée.

**Correction :**
```nginx
location ~* \.html$ {
    add_header Cache-Control "no-cache, must-revalidate";
}
```

---

## 🟡 Qualité de code

### QC-1 : Doublons de fichiers racine / frontend

Les fichiers suivants existent à la **racine** ET dans `frontend/` :
- `script.js`, `style.css`, `phishing.html`, `help.html`, `emails.js`

Seuls les fichiers `frontend/` sont utilisés par Docker. Les fichiers racine sont l'ancienne version standalone.

**Action :** Décider si la version standalone (racine) doit être maintenue. Si oui, documenter. Si non, supprimer les doublons de la racine ou les déplacer dans `OnePageVersion/`.

---

### QC-2 : `runSqlFile` inutilisée

**Fichier :** `backend/src/db/migrate.js` (ligne 10)

La fonction `runSqlFile()` est définie mais jamais appelée (le code inline fait la même chose dans `migrate()`).

**Action :** Supprimer la fonction morte.

---

### QC-3 : Pas de validation `res.ok` dans `scores.js`

**Fichier :** `frontend/scores.js`

Les fonctions `fetchPlayers`, `fetchServices`, `fetchServiceDetail` ne vérifient pas `res.ok` avant d'appeler `.json()`. Une erreur serveur retournera du JSON d'erreur qui sera traité comme des données valides.

**Correction :**
```javascript
async function fetchPlayers(month, difficulty) {
    const res = await fetch(`/api/scores/players${buildQuery(month, difficulty)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
```

---

### QC-4 : Pas de logging structuré

Tout le backend utilise `console.log('[tag]', ...)` et `console.error('[tag]', ...)`.

**Action future :** Migrer vers `pino` ou `winston` avec JSON logging pour faciliter le monitoring.

---

### QC-5 : Seed emails à chaque démarrage

**Fichier :** `backend/src/db/migrate.js`

`seedEmails()` vérifie `COUNT(*) FROM emails` à chaque démarrage. Si on supprime un email manuellement, il ne sera pas re-seeded (count > 0). Et si on veut mettre à jour le contenu des emails, il faut vider la table manuellement.

**Action future :** Ajouter un mécanisme de versioning des emails ou un endpoint admin pour importer/mettre à jour.

---

## ✅ Checklist d'exécution

```
[x] BUG-1 : Supprimer les doublons dans scores.js
[x] BUG-2 : Remplacer constantTimeEqual par crypto.timingSafeEqual
[x] BUG-3 : Ajouter transaction dans POST /api/players
[x] BUG-4 : Valider sessionId (isNaN) dans sessions.js
[x] BUG-5 : Valider JWT_SECRET et ADMIN_PASSWORD au démarrage
[x] BUG-6 : Valider serviceId dans players.js
[x] SEC-1 : Corriger CORS wildcard en prod
[x] SEC-2 : Ajouter headers de sécurité dans nginx.conf
[x] SEC-3 : Ajouter healthcheck API dans docker-compose.yml
[x] SEC-4 : Ajouter Cache-Control pour fichiers HTML
[ ] QC-1  : Décider du sort des fichiers racine dupliqués
[x] QC-2  : Supprimer runSqlFile() morte
[x] QC-3  : Ajouter validation res.ok dans scores.js
```

---

## 🚀 Features ajoutées (Phase 0–4)

```
[x] Phase 0 : Suppression limite 30 mails + bouton abandon
[x] Phase 1 : Dark mode + Outlook theme + faux inbox sidebar
[x] Phase 2 : Export CSV par onglet leaderboard
[x] Phase 3 : Dashboard admin stats (endpoints + page)
[x] Phase 4 : Système de badges/achievements complet
    - Migration 002_achievements.sql (tables achievements + player_achievements)
    - Définitions (achievements-data.js) : 72 badges (tiered/per-difficulty/universal)
    - Seed upsert dans migrate.js
    - Moteur d'évaluation (services/achievements.js)
    - Intégration dans sessions.js (évaluation à la fin de partie)
    - API : GET /api/players/:id/profile, GET /api/players/:id/achievements, GET /api/achievements
    - Page profil (profile.html + profile.js) : stats + grille de badges + filtre catégorie
    - Popup badges débloqués en game-over + lien vers profil
    - Liens cliquables vers profil depuis le leaderboard
```
