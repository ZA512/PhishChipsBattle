"use strict";
const message = document.getElementById("message");
let battleData = [];
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function table(headers, rows) {
  const table = el("table"),
    head = table.createTHead().insertRow(),
    body = table.createTBody();
  headers.forEach((h) => head.append(el("th", "", h)));
  rows.forEach((row) => {
    const tr = body.insertRow();
    row.forEach(
      (value) => (tr.insertCell().textContent = String(value ?? "—")),
    );
  });
  return table;
}
function state(b) {
  if (b.status === "closed" || Date.now() >= Date.parse(b.ends_at))
    return "closed";
  return Date.now() < Date.parse(b.starts_at) ? "upcoming" : "active";
}
const stateNames = {
  closed: "Terminée",
  upcoming: "À venir",
  active: "En cours",
};
const difficultyNames = {
  easy: "Facile",
  normal: "Normal",
  hardcore: "Hardcore",
};
function date(value) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
async function showResults(id) {
  try {
    const data = await PCB.request("/api/battles/" + id + "/results");
    document.getElementById("results").classList.remove("hidden");
    document.getElementById("results-title").textContent = data.battle.name;
    document.getElementById("results-note").textContent =
      (data.battle.status === "closed"
        ? "Résultats définitifs. "
        : "Résultats provisoires. ") +
      (data.battle.mode === "teams"
        ? data.results.teamFormula
        : "Meilleur score, puis temps de décision, puis ordre de fin.");
    const rows =
      data.battle.mode === "teams"
        ? data.results.teams.map((t, i) => [
            i + 1,
            t.name,
            t.score,
            t.played + "/" + t.participants,
          ])
        : data.results.players.map((p, i) => [
            i + 1,
            p.name,
            p.service_name,
            p.score,
            p.played ? p.decision_seconds + "s" : "Non joué",
          ]);
    document
      .getElementById("results-table")
      .replaceChildren(
        table(
          data.battle.mode === "teams"
            ? ["Rang", "Équipe", "Score moyen", "Participation"]
            : ["Rang", "Joueur", "Équipe", "Score", "Temps"],
          rows,
        ),
      );
    document
      .getElementById("results")
      .scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  } catch (error) {
    message.className = "notice error";
    message.textContent = error.message;
  }
}
function renderBattles() {
  const filter = document.getElementById("battle-status").value;
  const selected = battleData.filter(
    (b) => filter === "all" || state(b) === filter,
  );
  message.className = "notice";
  message.textContent = selected.length
    ? ""
    : battleData.length
      ? "Aucune battle dans cette catégorie."
      : "Aucune battle pour le moment. Les collègues ont obtenu un sursis.";
  const cards = selected.map((b) => {
    const card = el("section", "card battle-card"),
      header = el("header");
    header.append(
      el("h2", "", b.name),
      el("span", "pill battle-status " + state(b), stateNames[state(b)]),
    );
    card.append(header);
    const rules = el("div", "battle-rules");
    [
      {
        individual: "Individuelle",
        internal: "Dans une équipe",
        teams: "Entre équipes",
      }[b.mode],
      difficultyNames[b.difficulty],
      b.email_count + " emails",
      b.joker_limit + " SOS",
    ].forEach((text) => rules.append(el("span", "pill", text)));
    card.append(
      rules,
      el("p", "meta", "Du " + date(b.starts_at) + " au " + date(b.ends_at)),
    );
    card.append(
      el(
        "p",
        "",
        Math.max(0, b.max_attempts - Number(b.attempts_used)) +
          " / " +
          b.max_attempts +
          " tentatives restantes" +
          (b.roster_team ? " · Équipe de cette battle : " + b.roster_team : ""),
      ),
    );
    const actions = el("div", "form-actions");
    if (
      b.participating &&
      b.status === "published" &&
      state(b) === "active" &&
      (Number(b.attempts_used) < b.max_attempts || b.ongoing)
    ) {
      const play = el("a", "btn", b.ongoing ? "Reprendre" : "Jouer");
      play.href = "/phishing.html?battle=" + b.id;
      actions.append(play);
    }
    const results = el("button", "btn btn-secondary", "Voir les résultats");
    results.type = "button";
    results.addEventListener("click", () => showResults(b.id));
    actions.append(results);
    card.append(actions);
    return card;
  });
  document.getElementById("battle-list").replaceChildren(...cards);
}
document
  .getElementById("battle-status")
  .addEventListener("change", renderBattles);
PCB.ready
  .then(async (player) => {
    if (!player) return;
    battleData = (await PCB.request("/api/battles")).battles;
    renderBattles();
  })
  .catch((error) => {
    message.className = "notice error";
    message.textContent = error.message;
  });
