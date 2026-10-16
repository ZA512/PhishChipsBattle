// ============================================================
//  scores.js – Classements PhishChipsBattle
// ============================================================

// --- Difficulty state (global, applies to all tabs) ---
const scoreParams = new URLSearchParams(location.search);
let scoreSetId = scoreParams.get("setId") || "";
let scoreFormat =
  scoreParams.get("format") === "time_attack" ? "time_attack" : "classic";
let scoreDuration = [300, 600].includes(Number(scoreParams.get("duration")))
  ? Number(scoreParams.get("duration"))
  : 300;
let activeDifficulty =
  scoreFormat === "time_attack"
    ? scoreParams.get("difficulty") === "hardcore"
      ? "hardcore"
      : "normal"
    : ""; // '' = tous niveaux

// --- Last fetched data for CSV export ---
const lastData = {
  "players-global": null,
  "players-monthly": null,
  "services-global": null,
  "services-monthly": null,
};

// --- Month helpers ---
function nowYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

// --- Medal helper ---
function medal(i) {
  if (i === 0) return '<span class="medal-1">🥇</span>';
  if (i === 1) return '<span class="medal-2">🥈</span>';
  if (i === 2) return '<span class="medal-3">🥉</span>';
  return `<span class="rank-num">${i + 1}</span>`;
}

// --- Streak badge ---
function streakBadge(streak) {
  if (!streak || streak < 2) return "";
  return `<span class="streak" title="${streak} mois consécutifs dans le top 10">🔥${streak}</span>`;
}

// --- Players table ---
function renderPlayersTable(rows, showStreak = false) {
  if (!rows || rows.length === 0) {
    return '<p class="empty-state">Aucune partie terminée pour cette période.</p>';
  }
  return `<table>
        <thead><tr>
            <th>#</th><th>Pseudo</th><th>Équipe</th><th>Meilleur score</th>${scoreFormat === "time_attack" ? "<th>Bonnes réponses</th><th>Erreurs</th>" : ""}<th>Parties</th>
        </tr></thead>
        <tbody>
        ${rows
          .map(
            (
              r,
              i,
            ) => `<tr class="${Number(r.id) === PCB.player?.id ? "self-row" : ""}">
            <td>${medal(i)}</td>
            <td><a href="profile.html?id=${r.id}" class="player-link">${escHtml(r.name)}</a>${showStreak ? streakBadge(r.streak) : ""}</td>
            <td>${r.service_name ? escHtml(r.service_name) : '<span style="color:#aaa">—</span>'}</td>
            <td><span class="score-val">${r.best_score}</span></td>
            ${scoreFormat === "time_attack" ? "<td>" + r.good_answers + "</td><td>" + r.errors + "</td>" : ""}<td>${r.games_played}</td>
        </tr>`,
          )
          .join("")}
        </tbody>
    </table>`;
}

// --- Services table ---
function renderServicesTable(rows, showStreak = false) {
  if (!rows || rows.length === 0) {
    return '<p class="empty-state">Aucune équipe avec des parties terminées pour cette période.</p>';
  }
  return `<table>
        <thead><tr>
            <th>#</th><th>Équipe</th><th>Code</th><th>Score moyen*</th><th>Participants</th>
        </tr></thead>
        <tbody>
        ${rows
          .map(
            (
              r,
              i,
            ) => `<tr class="clickable-row" data-svcid="${r.id}" data-svcname="${escHtml(r.name)}">
            <td>${medal(i)}</td>
            <td class="service-name">${escHtml(r.name)}${showStreak ? streakBadge(r.streak) : ""}</td>
            <td><code>${escHtml(r.code)}</code></td>
            <td><span class="score-val">${r.avg_best_score}</span></td>
            <td>${r.player_count}</td>
        </tr>`,
          )
          .join("")}
        </tbody>
    </table>`;
}

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Build query string ---
function buildQuery(month, difficulty) {
  const parts = [];
  if (month) parts.push(`month=${encodeURIComponent(month)}`);
  if (difficulty) parts.push(`difficulty=${encodeURIComponent(difficulty)}`);
  if (scoreFormat === "time_attack") {
    parts.push(`duration=${scoreDuration}`);
    if (scoreSetId) parts.push(`setId=${encodeURIComponent(scoreSetId)}`);
  }
  return parts.length ? "?" + parts.join("&") : "";
}

// --- Fetch helpers ---
async function fetchPlayers(month, difficulty) {
  const res = await fetch(
    `/api/scores/${scoreFormat === "time_attack" ? "time-attack/" : ""}players${buildQuery(month, difficulty)}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function fetchServices(month, difficulty) {
  const res = await fetch(
    `/api/scores/${scoreFormat === "time_attack" ? "time-attack/" : ""}services${buildQuery(month, difficulty)}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function fetchServiceDetail(id, month, difficulty) {
  const res = await fetch(
    `/api/scores/${scoreFormat === "time_attack" ? "time-attack/" : ""}services/${id}${scoreFormat === "time_attack" ? "/detail" : ""}${buildQuery(month, difficulty)}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function scoreKey() {
  return JSON.stringify([
    scoreFormat,
    scoreDuration,
    scoreSetId,
    activeDifficulty,
    activeTab,
    pmMonth.current,
    smMonth.current,
  ]);
}
// --- Tab state ---
let activeTab = "players-global";
const pmMonth = { current: nowYYYYMM() };
const smMonth = { current: nowYYYYMM() };
let currentModalSvcId = null;
let currentModalMonth = null;
let modalReturnFocus = null;

// --- Load per tab ---
async function loadTab(tab) {
  activeTab = tab;
  const requestKey = scoreKey();
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));

  if (tab === "players-global") {
    const el = document.getElementById("players-global-content");
    el.innerHTML = '<p class="loading">Chargement…</p>';
    try {
      const data = await fetchPlayers(null, activeDifficulty);
      if (requestKey !== scoreKey()) return;
      lastData["players-global"] = data.scores;
      el.innerHTML = renderPlayersTable(data.scores, false);
    } catch {
      el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    }
  }
  if (tab === "players-monthly") {
    renderMonthLabel("pm", pmMonth.current);
    await loadPlayersMonthly();
  }
  if (tab === "services-global") {
    const el = document.getElementById("services-global-content");
    el.innerHTML = '<p class="loading">Chargement…</p>';
    try {
      const data = await fetchServices(null, activeDifficulty);
      if (requestKey !== scoreKey()) return;
      lastData["services-global"] = data.scores;
      el.innerHTML = renderServicesTable(data.scores, false);
      attachServiceClicks(el, null);
    } catch {
      el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
    }
  }
  if (tab === "services-monthly") {
    renderMonthLabel("sm", smMonth.current);
    await loadServicesMonthly();
  }
}

async function loadPlayersMonthly() {
  const requestKey = scoreKey();
  const el = document.getElementById("players-monthly-content");
  el.innerHTML = '<p class="loading">Chargement…</p>';
  try {
    const data = await fetchPlayers(pmMonth.current, activeDifficulty);
    if (requestKey !== scoreKey()) return;
    lastData["players-monthly"] = data.scores;
    el.innerHTML = renderPlayersTable(data.scores, true);
  } catch {
    el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
  }
}

async function loadServicesMonthly() {
  const requestKey = scoreKey();
  const el = document.getElementById("services-monthly-content");
  el.innerHTML = '<p class="loading">Chargement…</p>';
  try {
    const data = await fetchServices(smMonth.current, activeDifficulty);
    if (requestKey !== scoreKey()) return;
    lastData["services-monthly"] = data.scores;
    el.innerHTML = renderServicesTable(data.scores, true);
    attachServiceClicks(el, smMonth.current);
  } catch {
    el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>';
  }
}

function renderMonthLabel(prefix, ym) {
  document.getElementById(`${prefix}-label`).textContent = formatMonth(ym);
}

function attachServiceClicks(container, month) {
  container.querySelectorAll(".clickable-row[data-svcid]").forEach((row) => {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", "Voir l’équipe " + row.dataset.svcname);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        row.click();
      }
    });
    row.addEventListener("click", () =>
      openServiceModal(row.dataset.svcid, row.dataset.svcname, month),
    );
  });
}

// --- Service detail modal ---
async function openServiceModal(svcId, svcName, month) {
  if (!document.getElementById("service-modal").classList.contains("open"))
    modalReturnFocus = document.activeElement;
  document.querySelector(".scores-container").inert = true;
  document.querySelector(".account-nav").inert = true;
  currentModalSvcId = svcId;
  currentModalMonth = month;
  document.getElementById("modal-service-name").textContent = svcName;
  document.getElementById("modal-service-stats").textContent = "Chargement…";
  document.getElementById("modal-top10").innerHTML = "";
  document.getElementById("modal-others").innerHTML = "";
  document.getElementById("modal-others-section").style.display = "none";
  document.getElementById("service-modal").classList.add("open");
  document.getElementById("modal-close").focus();

  try {
    const data = await fetchServiceDetail(svcId, month, activeDifficulty);
    const topN = data.topN || 10;
    document.getElementById("modal-service-stats").innerHTML =
      `Score moyen (top&nbsp;${topN}) : <strong>${data.avgBestScore}</strong> ` +
      `| ${data.playerCount} participant(s)` +
      `${month ? " – " + formatMonth(month) : " – tous temps"}` +
      `${data.difficulty ? " – " + diffLabel(data.difficulty) : ""}`;

    document.getElementById("modal-top10").innerHTML = renderPlayersTable(
      data.top10,
      !!month,
    );

    if (data.others && data.others.length > 0) {
      document.getElementById("modal-others-section").style.display = "block";
      document.getElementById("modal-others").innerHTML = renderPlayersTable(
        data.others,
        false,
      );
    }
  } catch {
    document.getElementById("modal-service-stats").textContent =
      "Erreur de chargement.";
  }
}

function diffLabel(d) {
  const map = {
    easy: "🔰 Facile",
    normal: "⚠️ Normal",
    hardcore: "💀 Difficile",
  };
  return map[d] || d;
}

// --- Difficulty buttons ---
document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    Object.keys(lastData).forEach((key) => (lastData[key] = null));
    activeDifficulty = btn.dataset.diff;
    synchronizeFormat();
    document.querySelectorAll(".diff-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", String(b === btn));
    });
    // Reload active tab with new difficulty
    loadTab(activeTab);
    // If modal is open, reload it too
    if (
      document.getElementById("service-modal").classList.contains("open") &&
      currentModalSvcId
    ) {
      openServiceModal(
        currentModalSvcId,
        document.getElementById("modal-service-name").textContent,
        currentModalMonth,
      );
    }
  });
});

// --- Init ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => loadTab(btn.dataset.tab));
});

// Month nav – Players monthly
document.getElementById("pm-prev").addEventListener("click", async () => {
  pmMonth.current = prevMonth(pmMonth.current);
  renderMonthLabel("pm", pmMonth.current);
  await loadPlayersMonthly();
});
document.getElementById("pm-next").addEventListener("click", async () => {
  pmMonth.current = nextMonth(pmMonth.current);
  renderMonthLabel("pm", pmMonth.current);
  await loadPlayersMonthly();
});

// Month nav – Services monthly
document.getElementById("sm-prev").addEventListener("click", async () => {
  smMonth.current = prevMonth(smMonth.current);
  renderMonthLabel("sm", smMonth.current);
  await loadServicesMonthly();
});
document.getElementById("sm-next").addEventListener("click", async () => {
  smMonth.current = nextMonth(smMonth.current);
  renderMonthLabel("sm", smMonth.current);
  await loadServicesMonthly();
});

function closeServiceModal() {
  document.getElementById("service-modal").classList.remove("open");
  document.querySelector(".scores-container").inert = false;
  if (document.querySelector(".account-nav"))
    document.querySelector(".account-nav").inert = false;
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
}
document
  .getElementById("modal-close")
  .addEventListener("click", closeServiceModal);
document.getElementById("service-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeServiceModal();
});

document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("service-modal");
  if (!modal.classList.contains("open")) return;
  if (e.key === "Escape") document.getElementById("modal-close").click();
  if (e.key === "Tab") {
    const controls = [
      ...modal.querySelectorAll("button,a[href],[tabindex='0']"),
    ];
    const next =
      (controls.indexOf(document.activeElement) +
        (e.shiftKey ? -1 : 1) +
        controls.length) %
      controls.length;
    e.preventDefault();
    controls[next]?.focus();
  }
});
function synchronizeFormat() {
  document.getElementById("score-format").value = scoreFormat;
  document.getElementById("score-duration").value = String(scoreDuration);
  document.getElementById("score-duration-label").hidden =
    scoreFormat !== "time_attack";
  document.getElementById("score-set-label").hidden =
    scoreFormat !== "time_attack";
  document.querySelectorAll(".diff-btn").forEach((button) => {
    button.hidden =
      scoreFormat === "time_attack" &&
      ["", "easy"].includes(button.dataset.diff);
    button.classList.toggle("active", button.dataset.diff === activeDifficulty);
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.diff === activeDifficulty),
    );
  });
  Object.keys(lastData).forEach((key) => (lastData[key] = null));
  document.querySelector(".scores-container .eyebrow").textContent =
    scoreFormat === "time_attack"
      ? "Contre-la-montre · " +
        scoreDuration / 60 +
        " min · " +
        diffLabel(activeDifficulty)
      : "Classique · entraînement";
  document.getElementById("modal-close").click();
}
for (const id of ["score-format", "score-duration", "score-set"])
  document.getElementById(id).addEventListener("change", () => {
    scoreFormat = document.getElementById("score-format").value;
    scoreDuration = Number(document.getElementById("score-duration").value);
    scoreSetId = document.getElementById("score-set").value;
    if (
      scoreFormat === "time_attack" &&
      !["normal", "hardcore"].includes(activeDifficulty)
    )
      activeDifficulty = "normal";
    synchronizeFormat();
    updateScoreSelection();
  });
synchronizeFormat();
// Load default tab
function updateScoreSelection() {
  loadTab(
    document.getElementById("score-audience").value +
      "-" +
      document.getElementById("score-period").value,
  );
}
document
  .getElementById("score-audience")
  .addEventListener("change", updateScoreSelection);
document
  .getElementById("score-period")
  .addEventListener("change", updateScoreSelection);
PCB.ready.then(async (player) => {
  if (!player) return;
  const select = document.getElementById("score-set");
  try {
    const catalog = await PCB.request("/api/sessions/mail-sets");
    for (const set of catalog.sets) {
      const option = document.createElement("option");
      option.value = String(set.id);
      option.textContent = "Set : " + set.name;
      select.append(option);
    }
    if (
      scoreSetId &&
      ![...select.options].some((o) => o.value === scoreSetId)
    ) {
      const option = document.createElement("option");
      option.value = scoreSetId;
      option.textContent = "Set #" + scoreSetId + " · historique";
      select.append(option);
    }
    select.value = scoreSetId;
    select.disabled = false;
  } catch {
    if (scoreSetId) {
      const option = document.createElement("option");
      option.value = scoreSetId;
      option.textContent = "Set #" + scoreSetId;
      select.append(option);
      select.value = scoreSetId;
    }
  }
  updateScoreSelection();
});

// --- CSV Export ---
function exportCsv(type) {
  const rows = lastData[type];
  if (!rows || rows.length === 0) return alert("Aucune donnée à exporter.");

  let headers, mapRow;
  if (type.startsWith("players")) {
    headers = [
      "Rang",
      "Pseudo",
      "Équipe",
      "Meilleur score",
      ...(scoreFormat === "time_attack" ? ["Bonnes réponses", "Erreurs"] : []),
      "Parties",
    ];
    mapRow = (r, i) => [
      i + 1,
      r.name,
      r.service_name || "",
      r.best_score,
      ...(scoreFormat === "time_attack" ? [r.good_answers, r.errors] : []),
      r.games_played,
    ];
  } else {
    headers = ["Rang", "Équipe", "Code", "Score moyen", "Participants"];
    mapRow = (r, i) => [
      i + 1,
      r.name,
      r.code,
      r.avg_best_score,
      r.player_count,
    ];
  }

  if (scoreFormat === "time_attack") {
    const baseMap = mapRow;
    headers = ["Format", "Durée (minutes)", "Difficulté", "Source", ...headers];
    mapRow = (row, index) => [
      "Contre-la-montre",
      scoreDuration / 60,
      activeDifficulty === "hardcore" ? "Difficile" : "Normal",
      document.getElementById("score-set").selectedOptions[0].textContent,
      ...baseMap(row, index),
    ];
  }
  const BOM = "\uFEFF";
  const csv =
    BOM +
    [headers.join(";")]
      .concat(
        rows.map((r, i) =>
          mapRow(r, i)
            .map((v) => {
              const value = String(v),
                safe =
                  typeof v === "string" && /^\s*[=+@-]/.test(value)
                    ? "'" + value
                    : value;
              return `"${safe.replace(/"/g, '""')}"`;
            })
            .join(";"),
        ),
      )
      .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `classement-${scoreFormat}-${scoreFormat === "time_attack" ? scoreDuration + "-" + activeDifficulty + "-" + (scoreSetId ? "set-" + scoreSetId : "general") + "-" : ""}${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll(".csv-export-btn").forEach((btn) => {
  btn.addEventListener("click", () => exportCsv(btn.dataset.export));
});
