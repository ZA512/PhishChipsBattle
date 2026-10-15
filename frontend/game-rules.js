"use strict";
window.PCBRules = {
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
