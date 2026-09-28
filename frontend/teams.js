"use strict";
const message = document.getElementById("message"),
  select = document.getElementById("team-select"),
  save = document.getElementById("save");
async function loadTeam() {
  const data = await PCB.request("/api/teams/me");
  select.replaceChildren(new Option("Choisissez une équipe", ""));
  data.teams.forEach((t) => select.appendChild(new Option(t.name, t.id)));
  select.value = String(data.currentTeamId || data.suggestion.teamId || "");
  document.getElementById("recommendation").textContent =
    data.suggestion.reason;
  message.textContent = !data.teams.length
    ? "Aucune équipe disponible. Demandez à un administrateur de la créer."
    : data.selectionRequired
      ? "Choisissez et confirmez votre équipe avant de jouer."
      : "Votre équipe actuelle est sélectionnée.";
  document.getElementById("history").replaceChildren(
    ...data.history.map((h) => {
      const p = document.createElement("p");
      p.textContent = `${new Date(h.assigned_at).toLocaleDateString("fr-FR")} · ${h.service_name} · ${h.reason}`;
      return p;
    }),
  );
  save.disabled = !data.teams.length;
}
document.getElementById("team-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  save.disabled = true;
  try {
    await PCB.request("/api/teams/choose", {
      method: "POST",
      body: JSON.stringify({ teamId: Number(select.value) }),
    });
    location.assign("/phishing.html");
  } catch (err) {
    message.className = "notice error";
    message.textContent = err.message;
    save.disabled = false;
  }
});
PCB.ready
  .then((player) => player && loadTeam())
  .catch((err) => {
    message.className = "notice error";
    message.textContent = err.message;
  });
