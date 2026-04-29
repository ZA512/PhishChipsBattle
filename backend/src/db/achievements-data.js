'use strict';

/**
 * Achievement definitions for PhishChipsBattle.
 * Each achievement can exist in up to 3 difficulty variants (easy/normal/hardcore).
 * Universal achievements have difficulty = null.
 */

const DIFFICULTIES = ['easy', 'normal', 'hardcore'];
const STREAK_TIERS = [5, 10, 15, 20, 25, 30];

// Generate tiered achievements for each difficulty
function tiered(category, baseName, emoji, descFn, tiers = STREAK_TIERS) {
  const result = [];
  for (const diff of DIFFICULTIES) {
    for (let i = 0; i < tiers.length; i++) {
      const tier = i + 1;
      const threshold = tiers[i];
      result.push({
        key: `${category}_${diff}_t${tier}`,
        name: `${baseName} lvl ${tier}`,
        description: descFn(threshold, diff),
        emoji,
        category,
        difficulty: diff,
        tier,
        threshold,
      });
    }
  }
  return result;
}

// Universal achievements (no difficulty variant)
function universal(key, name, emoji, description, category, threshold = 0) {
  return { key, name, description, emoji, category, difficulty: null, tier: 1, threshold };
}

// Per-difficulty single achievements
function perDifficulty(baseKey, name, emoji, description, category, threshold = 0) {
  return DIFFICULTIES.map((diff) => ({
    key: `${baseKey}_${diff}`,
    name,
    description: `${description} (${diff})`,
    emoji,
    category,
    difficulty: diff,
    tier: 1,
    threshold,
  }));
}

const ACHIEVEMENTS = [
  // --- Maître du hasard: streak sans erreur ---
  ...tiered('streak', 'Maître du hasard', '🎯',
    (n, d) => `Série de ${n} bonnes réponses sans erreur en ${d}`),

  // --- Épileptique: fast correct streak ---
  ...tiered('speed', 'Épileptique', '⚡',
    (n, d) => `${n} bonnes réponses consécutives en moins de 5s chacune (${d})`),

  // --- Bouclier: streak sans joker ---
  ...tiered('shield', 'Bouclier', '🛡️',
    (n, d) => `Série de ${n} bonnes réponses sans utiliser de joker (${d})`),

  // --- Endurance ---
  ...perDifficulty('titan', 'Titan', '🏔️', 'Dépasser 100 mails corrects en une partie', 'endurance', 100),
  ...perDifficulty('nolife', 'No Life', '💀', 'Dépasser 200 mails corrects en une partie', 'endurance', 200),

  // --- Fidélité ---
  universal('veteran', 'Vétéran', '🏆', '10 parties terminées (tous modes)', 'loyalty', 10),
  universal('general', 'Général', '🎖️', '50 parties terminées (tous modes)', 'loyalty', 50),
  universal('tentaculaire', 'Tentaculaire', '🐙', '1 partie complétée dans chaque difficulté', 'loyalty', 3),
  universal('touriste', 'Touriste', '🎪', 'Jouer dans 3 services différents', 'loyalty', 3),

  // --- Classement mensuel ---
  ...perDifficulty('top3', 'Le loser', '🤡', 'Apparaître dans le top 3 mensuel', 'ranking'),
  ...perDifficulty('top2', "J'étais pas loin", '😅', 'Apparaître dans le top 2 mensuel', 'ranking'),
  ...perDifficulty('top1', 'Les autres sont vraiment nuls', '🙄', 'Apparaître dans le top 1 mensuel', 'ranking'),

  // --- Fun / Délire ---
  universal('pile_ou_face', 'Pile ou face', '🎰', 'Exactement 50% de bonnes réponses sur une partie complète (min 10 mails)', 'fun'),
  universal('tortue', 'La tortue', '🐢', 'Temps moyen > 25s par mail sur une partie complète (min 10 mails, toutes bonnes réponses)', 'fun'),
  universal('debut_carriere', 'Début de carrière', '🤯', 'Se tromper sur les 3 premiers emails', 'fun'),
  universal('devin', 'Le devin', '🔮', '10 premiers emails corrects en moins de 3s chacun', 'fun'),
  universal('stagiaire', 'Le stagiaire', '🫠', 'Terminer une partie avec un score de 0', 'fun'),
  universal('aimant_phishing', "L'aimant à phishing", '🧲', 'Se tromper uniquement sur des emails safe (min 2 erreurs)', 'fun'),
  universal('trop_confiant', 'Trop confiant', '🙈', 'Se tromper uniquement sur des emails phishing (min 2 erreurs)', 'fun'),
  universal('chanceux', 'Le chanceux', '🍀', 'Score de 30+ sur sa première partie jamais jouée', 'fun'),
  universal('insomniaque', "L'insomniaque", '🦉', 'Jouer une partie entre minuit et 5h du matin', 'fun'),
  universal('bourreau_travail', 'Bourreau de travail', '💼', 'Jouer 5 parties dans la même journée', 'fun'),
  universal('perfectionniste', 'Le perfectionniste', '✨', 'Atteindre un score de 50 sans erreur ni joker', 'fun'),
  universal('survivant', 'Le survivant', '🩹', 'Terminer une partie avec exactement 2 erreurs et un score > 50', 'fun'),
];

module.exports = ACHIEVEMENTS;
