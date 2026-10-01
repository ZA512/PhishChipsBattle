"use strict";
const message = document.getElementById("message"),
  select = document.getElementById("team-select"),
  save = document.getElementById("save");
let currentTeamId = null,
  selectionRequired = false;
function updateTeamAction() {
  save.disabled =
    !select.value ||
    (!selectionRequired && Number(select.value) === currentTeamId);
  save.textContent = selectionRequired
    ? "Confirmer mon équipe"
    : "Changer d’équipe";
}
async function loadTeam() {
  const data = await PCB.request("/api/teams/me");
  currentTeamId = data.currentTeamId;
  selectionRequired = data.selectionRequired;
  document.getElementById("team-current").textContent =
    data.teams.find((t) => t.id === currentTeamId)?.name ||
    "Votre place reste à choisir.";
  select.replaceChildren(new Option("Choisissez une équipe", ""));
  data.teams.forEach((t) => select.appendChild(new Option(t.name, t.id)));
  select.value = String(data.currentTeamId || data.suggestion.teamId || "");
  document.getElementById("recommendation").textContent =
    data.suggestion.reason;
  message.textContent = !data.teams.length
    ? "Aucune équipe disponible. Demandez à un administrateur de la créer."
    : data.selectionRequired
      ? "Choisissez et confirmez votre équipe avant de jouer."
      : "";
  document.getElementById("history").replaceChildren(
    ...data.history.map((h) => {
      const p = document.createElement("p");
      p.textContent = `${new Date(h.assigned_at).toLocaleDateString("fr-FR")} · ${h.service_name} · ${h.reason}`;
      return p;
    }),
  );
  updateTeamAction();
}
select.addEventListener("change", updateTeamAction);
document.getElementById("team-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  save.disabled = true;
  try {
    await PCB.request("/api/teams/choose", {
      method: "POST",
      body: JSON.stringify({ teamId: Number(select.value) }),
    });
    if (selectionRequired) location.assign("/phishing.html");
    else {
      await loadTeam();
      message.className = "notice success";
      message.textContent =
        "Équipe modifiée. Les battles déjà créées gardent leurs équipes d’origine.";
    }
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
