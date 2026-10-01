"use strict";
const mainSection = document.getElementById("main-section");
const statsMessage = document.getElementById("stats-message");
PCB.ready
  .then(async (player) => {
    if (!player) return;
    if (player.role !== "admin")
      throw new Error("Accès réservé aux administrateurs.");
    const data = await PCB.request("/api/admin/stats/overview");
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
function adminFetch(url) {
  return fetch(url);
}

function renderOverview(data) {
  document.getElementById("stat-players").textContent = data.totalPlayers;
  document.getElementById("stat-success").textContent = data.successRate + "%";
  document.getElementById("stat-answers").textContent =
    data.totalAnswers.toLocaleString("fr-FR");

  const tbody = document.getElementById("diff-tbody");
  const diffLabels = {
    easy: "🔰 Facile",
    normal: "⚠️ Normal",
    hardcore: "💀 Hardcore",
  };
  tbody.innerHTML = data.byDifficulty
    .map(
      (d) => `
        <tr>
            <td>${diffLabels[d.difficulty] || d.difficulty}</td>
            <td>${d.games}</td>
            <td>${d.avgScore}</td>
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
