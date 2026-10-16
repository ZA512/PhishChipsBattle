"use strict";
window.PCBRules = {
  progression(difficulty, rules = { version: 2, decrementSeconds: 1 }) {
    if (difficulty === "easy")
      return "Le chrono reste fixe. Pour une fois, la pression vient d’ailleurs.";
    if (rules.version === 1)
      return "−1 s par point, jusqu’au minimum. Règles historiques.";
    return `−${rules.decrementSeconds ?? 2} s par bonne réponse, jusqu’à ${difficulty === "hardcore" ? 25 : 35} s minimum. Les SOS Sécu n’accélèrent pas le chrono.`;
  },
  timing(difficulty, version = 2) {
    return (
      (version === 1
        ? { easy: "30 s fixes", normal: "30 → 15 s", hardcore: "30 → 5 s" }
        : { easy: "60 s fixes", normal: "60 → 35 s", hardcore: "45 → 25 s" })[
        difficulty
      ] +
      (version === 1
        ? " · règles historiques"
        : " · +10/20 s pour les mails longs")
    );
  },
  configuration(duration, difficulty) {
    return (
      duration / 60 +
      " min · " +
      (difficulty === "hardcore" ? "Difficile" : "Normal")
    );
  },
  signed(score) {
    return score >= 0 ? "+" + score : String(score);
  },
};
