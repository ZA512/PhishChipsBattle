"use strict";
const message = document.getElementById("message");
function table(headers, rows) {
  const table = document.createElement("table"),
    thead = table.createTHead(),
    head = thead.insertRow();
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  });
  const tbody = table.createTBody();
  rows.forEach((row) => {
    const tr = tbody.insertRow();
    row.forEach(
      (value) => (tr.insertCell().textContent = String(value ?? "—")),
    );
  });
  return table;
}
async function showResults(id) {
  try {
    const data = await PCB.request(`/api/battles/${id}/results`);
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
            `${t.played}/${t.participants}`,
          ])
        : data.results.players.map((p, i) => [
            i + 1,
            p.name,
            p.service_name,
            p.score,
            p.played ? `${p.decision_seconds}s` : "Non joué",
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
  } catch (e) {
    message.className = "notice error";
    message.textContent = e.message;
  }
}
async function loadBattles() {
  const data = await PCB.request("/api/battles");
  message.textContent = data.battles.length
    ? "Vos compétitions."
    : "Aucune battle pour le moment.";
  const container = document.getElementById("battle-list");
  container.replaceChildren();
  for (const b of data.battles) {
    const card = document.createElement("section");
    card.className = "card";
    const title = document.createElement("h2");
    title.textContent = b.name;
    card.appendChild(title);
    const info = document.createElement("p");
    info.className = "meta";
    info.textContent = `${{ individual: "Individuelle", internal: "Dans une équipe", teams: "Entre équipes" }[b.mode]} · ${b.difficulty} · ${b.email_count} emails · ${b.joker_limit} jokers`;
    card.appendChild(info);
    const dates = document.createElement("p");
    dates.textContent = `Du ${new Date(b.starts_at).toLocaleString("fr-FR")} au ${new Date(b.ends_at).toLocaleString("fr-FR")}`;
    card.appendChild(dates);
    const tries = document.createElement("p");
    tries.textContent = `Tentatives : ${b.attempts_used}/${b.max_attempts}${b.roster_team ? " · Équipe de cette battle : " + b.roster_team : ""}`;
    card.appendChild(tries);
    if (
      b.participating &&
      b.status === "published" &&
      Date.now() >= Date.parse(b.starts_at) &&
      Date.now() < Date.parse(b.ends_at) &&
      (Number(b.attempts_used) < b.max_attempts || b.ongoing)
    ) {
      const play = document.createElement("a");
      play.href = `/phishing.html?battle=${b.id}`;
      play.className = "btn";
      play.textContent = b.ongoing ? "Reprendre" : "Jouer";
      card.appendChild(play);
    }
    const results = document.createElement("button");
    results.className = "btn btn-secondary";
    results.textContent = "Voir les résultats";
    results.addEventListener("click", () => showResults(b.id));
    card.appendChild(results);
    container.appendChild(card);
  }
}
PCB.ready
  .then((player) => player && loadBattles())
  .catch((e) => {
    message.className = "notice error";
    message.textContent = e.message;
  });
