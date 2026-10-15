"use strict";
const mainSection = document.getElementById("main-section");
const statsMessage = document.getElementById("stats-message");
PCB.ready
  .then(async (player) => {
    if (!player) return;
    if (player.role !== "admin")
      throw new Error("Accès réservé aux administrateurs.");
    const data = await PCB.request("/api/admin/stats/overview" + statsQuery());
    statsMessage.hidden = true;
    mainSection.style.display = "block";
    renderOverview(data);
    loadHardest();
    loadActivity("week");
  })
  .catch((error) => {
    statsMessage.textContent = error.message;
    statsMessage.className = "notice error";
  });
function statsQuery() {
  return (
    "?" +
    new URLSearchParams({
      family: document.getElementById("stats-family").value,
      duration: document.getElementById("stats-duration").value,
      difficulty: document.getElementById("stats-difficulty").value,
    })
  );
}
function adminFetch(url) {
  return fetch(url + (url.includes("?") ? "&" : "?") + statsQuery().slice(1));
}
let latestStats = [];
async function refreshStats() {
  try {
    const data = await PCB.request("/api/admin/stats/overview" + statsQuery());
    renderOverview(data);
    loadHardest();
    loadActivity(document.querySelector(".period-btn.active").dataset.period);
  } catch (error) {
    statsMessage.hidden = false;
    statsMessage.textContent = error.message;
  }
}
for (const id of ["stats-family", "stats-duration", "stats-difficulty"])
  document.getElementById(id).addEventListener("change", () => {
    const timeAttack =
      document.getElementById("stats-family").value === "time_attack";
    document.getElementById("stats-duration").disabled = !timeAttack;
    if (!timeAttack) document.getElementById("stats-duration").value = "";
    refreshStats();
  });
document.getElementById("stats-duration").disabled = true;
document.getElementById("stats-export").addEventListener("click", () => {
  const headers = [
    "Format",
    "Durée",
    "Difficulté",
    "Terminées",
    "Abandons",
    "Consultés",
    "Décisions",
    "Correctes",
    "Erreurs",
    "SOS",
    "Expirations",
    "Score moyen",
  ];
  const rows = latestStats.map((r) => [
    r.family,
    r.duration ?? "",
    r.difficulty,
    r.completed,
    r.abandoned,
    r.viewed,
    r.decisions,
    r.correct,
    r.errors,
    r.assisted,
    r.timeouts,
    r.avg_score ?? "",
  ]);
  const csv =
    "\uFEFF" +
    [headers, ...rows]
      .map((row) =>
        row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(";"),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "statistiques-par-format.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function renderOverview(data) {
  latestStats = data.formats;
  document.getElementById("stats-counts").textContent =
    data.viewedEmails +
    " mails consultés · " +
    data.evaluatedAnswers +
    " décisions humaines · " +
    data.correctAnswers +
    " correctes · " +
    data.wrongAnswers +
    " erreurs · " +
    data.assistedAnswers +
    " SOS · " +
    data.timeouts +
    " expirations";
  document.getElementById("stat-players").textContent = data.totalPlayers;
  document.getElementById("stat-success").textContent = data.successRate + "%";
  document.getElementById("stat-answers").textContent =
    data.totalAnswers.toLocaleString("fr-FR");

  const tbody = document.getElementById("diff-tbody");
  const diffLabels = {
    easy: "🔰 Facile",
    normal: "⚠️ Normal",
    hardcore: "💀 Difficile",
  };
  tbody.innerHTML = data.byDifficulty
    .map(
      (d) => `
        <tr>
            <td>${{ classic_training: "Classique · entraînement", battle: "Battle", time_attack: "Contre-la-montre", discovery: "Découverte" }[d.family]}${d.duration ? " · " + d.duration / 60 + " min" : ""} · ${diffLabels[d.difficulty] || d.difficulty}</td>
            <td>${d.games} / ${d.abandoned}</td><td>${d.viewed}</td><td>${d.decisions}</td><td>${d.correct} / ${d.errors}</td><td>${d.assisted} / ${d.timeouts}</td>
            <td>${d.avgScore ?? "—"}</td>
        </tr>
    `,
    )
    .join("");
}

async function loadHardest() {
  try {
    const res = await adminFetch("/api/admin/stats/hardest-emails");
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById("hardest-tbody");
    tbody.innerHTML = data.emails
      .map(
        (e) => `
            <tr>
                <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(e.subject)}">${escHtml(e.subject)}</td>
                <td><span style="color:${e.type === "phishing" ? "#d13438" : "#107c10"}">${e.type}</span></td>
                <td>${e.attempts}</td>
                <td>
                    <span class="error-bar" style="width:${e.errorRate}px"></span>
                    ${e.errorRate}%
                </td>
            </tr>
        `,
      )
      .join("");
  } catch {
    /* ignore */
  }
}

async function loadActivity(period) {
  try {
    const res = await adminFetch(`/api/admin/stats/activity?period=${period}`);
    if (!res.ok) return;
    const data = await res.json();
    const chart = document.getElementById("activity-chart");
    const maxGames = Math.max(1, ...data.days.map((d) => d.games));
    chart.innerHTML = data.days
      .map((d) => {
        const pct = (d.games / maxGames) * 100;
        const day = new Date(d.day).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        });
        return `<div class="activity-bar" style="height:${Math.max(4, pct)}%" data-tooltip="${day}: ${d.games} parties, ${d.players} joueurs"></div>`;
      })
      .join("");
  } catch {
    /* ignore */
  }
}

document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".period-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadActivity(btn.dataset.period);
  });
});

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
