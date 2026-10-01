"use strict";
let profileAchievements = [],
  activeCategory = "all";
const params = new URLSearchParams(location.search);
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function showError(text) {
  document.getElementById("loading").hidden = true;
  const error = document.getElementById("error");
  error.textContent = text;
  error.hidden = false;
}
function categoryLabel(category) {
  return (
    {
      streak: "🎯 Séries",
      speed: "⚡ Vitesse",
      shield: "🛡 Bouclier",
      endurance: "🏔 Endurance",
      loyalty: "🏆 Fidélité",
      ranking: "🥇 Classement",
      fun: "🎪 Fun",
    }[category] || category
  );
}
function familyName(achievement) {
  return achievement.name.replace(/\s+lvl\s+\d+$/i, "");
}
function achievementFamilies(achievements) {
  const families = new Map();
  for (const achievement of achievements) {
    const name = familyName(achievement),
      key = achievement.category + ":" + name;
    if (!families.has(key))
      families.set(key, {
        name,
        category: achievement.category,
        emoji: achievement.emoji,
        variants: [],
      });
    families.get(key).variants.push(achievement);
  }
  return [...families.values()];
}
function variantTitle(achievement) {
  const difficulty = { easy: "Facile", normal: "Normal", hardcore: "Hardcore" }[
    achievement.difficulty
  ];
  return (
    (difficulty || "Tous modes") +
    (/\blvl\s+\d+/i.test(achievement.name)
      ? " · Palier " + achievement.tier
      : "")
  );
}
function renderAchievements() {
  const state = document.getElementById("badge-state").value;
  let visibleCount = 0;
  const cards = [];
  const families = achievementFamilies(profileAchievements).sort((a, b) => {
    return (
      Number(b.variants.some((v) => v.unlocked)) -
        Number(a.variants.some((v) => v.unlocked)) ||
      a.name.localeCompare(b.name, "fr")
    );
  });
  for (const family of families) {
    if (activeCategory !== "all" && family.category !== activeCategory)
      continue;
    const variants = family.variants.filter(
      (v) =>
        state === "all" || (state === "unlocked" ? v.unlocked : !v.unlocked),
    );
    if (!variants.length) continue;
    visibleCount += variants.length;
    const earned = family.variants.filter((v) => v.unlocked).length;
    const card = node("details", "badge-family" + (earned ? "" : " locked"));
    const summary = node("summary");
    const info = node("span");
    info.append(
      node("span", "achievement-name", family.name),
      node(
        "span",
        "badge-family-count",
        earned + " / " + family.variants.length + " obtenus",
      ),
    );
    info.style.display = "grid";
    summary.append(
      node("span", "achievement-emoji", family.emoji || "🔒"),
      info,
    );
    card.append(summary);
    const list = node("ul", "badge-variants");
    variants.sort(
      (a, b) =>
        ["easy", "normal", "hardcore"].indexOf(a.difficulty) -
          ["easy", "normal", "hardcore"].indexOf(b.difficulty) ||
        a.tier - b.tier,
    );
    for (const variant of variants) {
      const item = node("li", variant.unlocked ? "unlocked" : "locked");
      item.append(
        node(
          "span",
          "badge-variant-title",
          (variant.unlocked ? "✓ " : "○ ") + variantTitle(variant),
        ),
      );
      item.append(node("p", "achievement-desc", variant.description));
      if (variant.unlockedAt)
        item.append(
          node(
            "p",
            "achievement-date",
            "Obtenu le " +
              new Date(variant.unlockedAt).toLocaleDateString("fr-FR"),
          ),
        );
      list.append(item);
    }
    card.append(list);
    cards.push(card);
  }
  document.getElementById("achievements-grid").replaceChildren(...cards);
  document.getElementById("badge-summary").textContent = cards.length
    ? cards.length +
      " familles · " +
      visibleCount +
      " badges correspondant aux filtres"
    : "Aucun badge ici. Le dossier manque encore de pièces à conviction.";
}
function renderProfile(player, stats, achievements) {
  profileAchievements = achievements;
  document.getElementById("loading").hidden = true;
  document.getElementById("content").hidden = false;
  document.getElementById("avatar").textContent = player.name.slice(0, 2);
  document.getElementById("player-name").textContent = player.name;
  document.getElementById("player-since").textContent =
    "Membre depuis le " +
    new Date(player.createdAt).toLocaleDateString("fr-FR");
  document.getElementById("stats-grid").replaceChildren(
    ...[
      [stats.gamesPlayed, "Parties jouées"],
      [stats.bestScore, "Meilleur score"],
      [stats.totalScore, "Score total"],
      [stats.totalErrors, "Erreurs totales"],
    ].map(([value, label]) => {
      const card = node("div", "stat-card");
      card.append(
        node("div", "stat-value", value),
        node("div", "stat-label", label),
      );
      return card;
    }),
  );
  const unlocked = achievements.filter((a) => a.unlocked);
  document.getElementById("unlocked-count").textContent = unlocked.length;
  document.getElementById("total-count").textContent = achievements.length;
  document.getElementById("progress-fill").style.width =
    (achievements.length ? (unlocked.length / achievements.length) * 100 : 0) +
    "%";
  const recent = [...unlocked]
    .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
    .slice(0, 3);
  document.getElementById("recent-section").hidden = !recent.length;
  document.getElementById("recent-badges").replaceChildren(
    ...recent.map((a) => {
      const card = node("div", "achievement-card");
      card.append(
        node("span", "achievement-emoji", a.emoji),
        node(
          "div",
          "achievement-name",
          familyName(a) + " · " + variantTitle(a),
        ),
      );
      return card;
    }),
  );
  document.getElementById("filter-bar").replaceChildren(
    ...["all", ...new Set(achievements.map((a) => a.category))].map(
      (category) => {
        const button = node(
          "button",
          category === "all" ? "active" : "",
          category === "all"
            ? "Toutes les catégories"
            : categoryLabel(category),
        );
        button.type = "button";
        button.dataset.cat = category;
        button.setAttribute("aria-pressed", String(category === "all"));
        return button;
      },
    ),
  );
  renderAchievements();
}
document
  .getElementById("badge-state")
  .addEventListener("change", renderAchievements);
document.getElementById("filter-bar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-cat]");
  if (!button) return;
  activeCategory = button.dataset.cat;
  document.querySelectorAll("[data-cat]").forEach((b) => {
    b.classList.toggle("active", b === button);
    b.setAttribute("aria-pressed", String(b === button));
  });
  renderAchievements();
});
PCB.ready
  .then(async (player) => {
    if (!player) return;
    const id = Number(params.get("id") || player.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error("Joueur invalide");
    const [profile, badges] = await Promise.all([
      PCB.request("/api/players/" + id + "/profile"),
      PCB.request("/api/players/" + id + "/achievements"),
    ]);
    renderProfile(profile.player, profile.stats, badges.achievements);
  })
  .catch((error) => showError(error.message));
