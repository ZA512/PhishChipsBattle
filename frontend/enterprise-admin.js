"use strict";
const byId = (id) => document.getElementById(id),
  message = byId("message");
let admin = false,
  sessions = [],
  teams = [],
  players = [];
function notify(text, error = false) {
  message.textContent = text;
  message.className = error ? "notice error" : "notice success";
}
async function perform(button, work) {
  button.disabled = true;
  try {
    await work();
  } catch (e) {
    notify(e.message, true);
  } finally {
    button.disabled = false;
  }
}
function dataTable(headers, rows) {
  const table = document.createElement("table"),
    head = table.createTHead().insertRow(),
    body = table.createTBody();
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  });
  rows.forEach((row) => {
    const tr = body.insertRow();
    row.forEach((value) => {
      const td = tr.insertCell();
      if (value instanceof Node) td.appendChild(value);
      else td.textContent = String(value ?? "—");
    });
  });
  return table;
}
function action(label, callback, danger = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = danger ? "btn btn-danger" : "btn btn-secondary";
  b.textContent = label;
  b.addEventListener("click", () => perform(b, callback));
  return b;
}
function selectedIds(kind) {
  return [...byId("battle-" + kind).querySelectorAll("input:checked")].map(
    (i) => Number(i.value),
  );
}
function normalized(text) {
  return text
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();
}
function renderPicker(kind, rows, name, extra) {
  const selected = new Set(selectedIds(kind));
  byId("battle-" + kind).replaceChildren(
    ...rows.map((row) => {
      const label = document.createElement("label"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.value = row.id;
      input.checked = selected.has(row.id);
      const text = document.createElement("span"),
        detail = document.createElement("small");
      text.textContent = name(row);
      detail.textContent = extra(row);
      label.dataset.search = normalized(
        text.textContent + " " + detail.textContent,
      );
      label.append(input, text, detail);
      input.addEventListener("change", updatePickerCounts);
      return label;
    }),
  );
  filterPicker(kind);
  updatePickerCounts();
}
function filterPicker(kind) {
  const query = normalized(
    byId(kind === "players" ? "player-search" : "team-search").value,
  );
  byId("battle-" + kind)
    .querySelectorAll("label")
    .forEach((l) => (l.hidden = !l.dataset.search.includes(query)));
}
function updatePickerCounts() {
  byId("players-selected").textContent =
    selectedIds("players").length + " joueur(s) sélectionné(s)";
  byId("teams-selected").textContent =
    selectedIds("teams").length + " équipe(s) sélectionnée(s)";
  updateBattlePreview();
}
function updateBattlePreview() {
  const mode = byId("battle-mode").value;
  const count =
    mode === "individual"
      ? selectedIds("players").length
      : players.filter((p) => selectedIds("teams").includes(p.service_id))
          .length;
  byId("battle-preview").textContent =
    count +
    " participant(s) · " +
    byId("battle-count").value +
    " emails · " +
    byId("battle-attempts").value +
    " tentative(s) · " +
    byId("battle-jokers").value +
    " SOS par tentative. Participants, équipes et règles seront figés à la publication.";
}
function updateCorrectionPreview() {
  const s = sessions.find((s) => s.id === Number(byId("session-select").value));
  if (!s) return;
  byId("correction-summary").textContent =
    s.player_name +
    " · Avant : " +
    s.score +
    " points" +
    (s.disqualified ? " (disqualifiée)" : "") +
    " → Après : " +
    (byId("disqualified").checked
      ? "disqualifiée"
      : byId("corrected-score").value + " points") +
    ". Le motif et les deux valeurs resteront dans l’historique.";
}
function formatDate(value) {
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function selectAdminSection(name) {
  const allowed = admin
    ? ["teams", "battles", "moderation", "directory", "stats"]
    : ["battles"];
  if (!allowed.includes(name)) name = allowed[0];
  document.querySelectorAll("[data-panel]").forEach((p) => {
    p.classList.toggle("hidden", p.dataset.panel !== name);
    p.setAttribute("role", "tabpanel");
    p.setAttribute("aria-labelledby", "tab-" + p.dataset.panel);
  });
  document.querySelectorAll("[data-admin-tab]").forEach((b) => {
    const active = b.dataset.adminTab === name;
    b.id = "tab-" + b.dataset.adminTab;
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
  });
  history.replaceState(null, "", "#" + name);
  notify("");
}
document.querySelectorAll("[data-admin-tab]").forEach((b) => {
  b.addEventListener("click", () => selectAdminSection(b.dataset.adminTab));
  b.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...document.querySelectorAll("[data-admin-tab]")].filter(
      (t) => !t.classList.contains("hidden"),
    );
    const index =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (tabs.indexOf(b) +
              (e.key === "ArrowRight" ? 1 : -1) +
              tabs.length) %
            tabs.length;
    tabs[index].click();
    tabs[index].focus();
  });
});
byId("player-search").addEventListener("input", () => filterPicker("players"));
byId("team-search").addEventListener("input", () => filterPicker("teams"));
byId("battle-form").addEventListener("input", updateBattlePreview);
byId("corrected-score").addEventListener("input", updateCorrectionPreview);
byId("disqualified").addEventListener("change", updateCorrectionPreview);

async function loadLists() {
  const data = await PCB.request("/api/battles/participants");
  players = data.players;
  teams = data.teams;
  renderPicker(
    "players",
    players,
    (p) => p.display_name,
    (p) => teams.find((t) => t.id === p.service_id)?.name || "Sans équipe",
  );
  renderPicker(
    "teams",
    teams,
    (t) => t.name,
    (t) => players.filter((p) => p.service_id === t.id).length + " membre(s)",
  );
  if (admin) {
    const all = (await PCB.request("/api/admin/services")).services;
    byId("teams").replaceChildren(
      dataTable(
        ["Nom", "Code", "Actions"],
        all.map((t) => {
          const actions = document.createElement("div");
          actions.append(
            action("Modifier", async () => {
              byId("team-id").value = t.id;
              byId("team-name").value = t.name;
              byId("team-code").value = t.code;
              byId("team-editor").open = true;
              byId("team-editor").querySelector("summary").textContent =
                "Modifier une équipe";
              byId("team-name").focus();
            }),
            action(
              "Supprimer",
              async () => {
                if (
                  !(await PCB.confirm(
                    `Supprimer « ${t.name} » ? Ses membres devront choisir une autre équipe.`,
                  ))
                )
                  return;
                await PCB.request(`/api/admin/services/${t.id}`, {
                  method: "DELETE",
                });
                await loadLists();
                notify(
                  "Équipe supprimée. Les résultats passés sont conservés.",
                );
              },
              true,
            ),
          );
          return [t.name, t.code, actions];
        }),
      ),
    );
  }
}
function resetTeam() {
  byId("team-id").value = "";
  byId("team-name").value = "";
  byId("team-code").value = "";
  byId("team-editor").open = false;
  byId("team-editor").querySelector("summary").textContent =
    "Ajouter une équipe";
}
byId("team-reset").addEventListener("click", resetTeam);
byId("team-form").addEventListener("submit", (e) => {
  e.preventDefault();
  perform(e.submitter, async () => {
    const id = byId("team-id").value;
    await PCB.request(`/api/admin/services${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({
        name: byId("team-name").value,
        code: byId("team-code").value,
      }),
    });
    resetTeam();
    await loadLists();
    notify("Équipe enregistrée.");
  });
});
byId("battle-mode").addEventListener("change", () => {
  const individual = byId("battle-mode").value === "individual";
  byId("player-picker").classList.toggle("hidden", !individual);
  byId("team-picker").classList.toggle("hidden", individual);
  updateBattlePreview();
});
byId("select-all").addEventListener("click", () => {
  byId("battle-players")
    .querySelectorAll("input")
    .forEach((input) => (input.checked = true));
  updatePickerCounts();
});
byId("battle-form").addEventListener("submit", (e) => {
  e.preventDefault();
  perform(e.submitter, async () => {
    const body = {
      name: byId("battle-name").value,
      mode: byId("battle-mode").value,
      difficulty: byId("battle-difficulty").value,
      startsAt: new Date(byId("battle-start").value).toISOString(),
      endsAt: new Date(byId("battle-end").value).toISOString(),
      emailCount: Number(byId("battle-count").value),
      maxAttempts: Number(byId("battle-attempts").value),
      jokerLimit: Number(byId("battle-jokers").value),
      playerIds: selectedIds("players"),
      teamIds: selectedIds("teams"),
    };
    if (body.endsAt <= body.startsAt)
      throw new Error("La fin doit suivre le début.");
    if (body.mode === "individual" && !body.playerIds.length)
      throw new Error("Sélectionnez au moins un joueur.");
    if (body.mode === "internal" && body.teamIds.length !== 1)
      throw new Error("Sélectionnez une seule équipe pour ce format.");
    if (body.mode === "teams" && body.teamIds.length < 2)
      throw new Error("Sélectionnez au moins deux équipes.");
    const data = await PCB.request("/api/battles", {
      method: "POST",
      body: JSON.stringify(body),
    });
    notify(`Battle publiée avec ${data.participants} participant(s).`);
    byId("battle-editor").open = false;
    await loadBattles();
  });
});
async function loadBattles() {
  const { battles } = await PCB.request("/api/battles");
  byId("battles").replaceChildren(
    dataTable(
      ["Battle", "Début", "Fin", "État", "Actions"],
      battles.map((b) => [
        b.name,
        formatDate(b.starts_at),
        formatDate(b.ends_at),
        b.status === "closed"
          ? "Clôturée"
          : Date.now() < Date.parse(b.starts_at)
            ? "À venir"
            : Date.now() >= Date.parse(b.ends_at)
              ? "Échéance atteinte"
              : "En cours",
        b.status === "closed"
          ? "Clôturée"
          : action(
              "Clôturer",
              async () => {
                if (
                  !(await PCB.confirm(
                    "Clôturer cette battle maintenant ? Les tentatives en cours seront terminées.",
                  ))
                )
                  return;
                await PCB.request(`/api/battles/${b.id}/close`, {
                  method: "POST",
                });
                await loadBattles();
                notify("Battle clôturée.");
              },
              true,
            ),
      ]),
    ),
  );
}
function selectSession() {
  const s = sessions.find((s) => s.id === Number(byId("session-select").value));
  byId("correction-form").querySelector("[type=submit]").disabled = !s;
  if (!s) {
    byId("correction-summary").textContent =
      "Aucune partie terminée à corriger.";
    return;
  }
  byId("corrected-score").value = s.score;
  byId("disqualified").checked = s.disqualified;
  updateCorrectionPreview();
}
async function loadScores() {
  sessions = (await PCB.request("/api/admin/sessions")).sessions.filter(
    (s) => s.completed && s.rules_version === 1,
  );
  byId("session-select").replaceChildren(
    ...sessions.map(
      (s) =>
        new Option(
          `#${s.id} · ${s.player_name} · ${s.score} points${s.disqualified ? " · disqualifiée" : ""}`,
          s.id,
        ),
    ),
  );
  selectSession();
  const { adjustments } = await PCB.request("/api/admin/score-adjustments");
  byId("corrections").replaceChildren(
    dataTable(
      ["Date", "Partie", "Avant", "Après", "Motif"],
      adjustments.map((a) => [
        new Date(a.created_at).toLocaleString("fr-FR"),
        a.session_id,
        a.old_score,
        a.new_disqualified ? "Disqualifiée" : a.new_score,
        a.reason,
      ]),
    ),
  );
}
byId("session-select").addEventListener("change", selectSession);
byId("refresh-scores").addEventListener("click", (e) =>
  perform(e.currentTarget, loadScores),
);
byId("correction-form").addEventListener("submit", (e) => {
  e.preventDefault();
  perform(e.submitter, async () => {
    const s = sessions.find(
      (s) => s.id === Number(byId("session-select").value),
    );
    if (!s) throw new Error("Aucune partie sélectionnée");
    await PCB.request(`/api/admin/sessions/${s.id}/correction`, {
      method: "POST",
      body: JSON.stringify({
        score: Number(byId("corrected-score").value),
        disqualified: byId("disqualified").checked,
        revision: s.score_revision,
        reason: byId("correction-reason").value,
      }),
    });
    byId("correction-reason").value = "";
    await loadScores();
    notify("Correction enregistrée dans l’historique.");
  });
});
byId("sync-directory").addEventListener("click", (e) =>
  perform(e.currentTarget, async () => {
    const r = await PCB.request("/api/admin/directory/sync", {
      method: "POST",
    });
    notify(
      `${r.imported} collaborateurs synchronisés. Les équipes choisies sont conservées.`,
    );
  }),
);
byId("import-directory").addEventListener("click", (e) =>
  perform(e.currentTarget, async () => {
    if (!byId("directory-full").checked)
      throw new Error("Confirmez que l’annuaire est complet");
    const employees = JSON.parse(byId("directory-json").value);
    const r = await PCB.request("/api/admin/directory/import", {
      method: "POST",
      body: JSON.stringify({ employees, fullSnapshot: true }),
    });
    notify(`${r.imported} collaborateurs importés.`);
  }),
);
function localInputDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
byId("battle-start").value = localInputDate(new Date(Date.now() + 60000));
byId("battle-end").value = localInputDate(new Date(Date.now() + 86400000));
PCB.ready
  .then(async (player) => {
    if (!player) return;
    if (!["admin", "organizer"].includes(player.role))
      throw new Error("Accès administrateur ou organisateur requis");
    admin = player.role === "admin";
    document
      .querySelectorAll("[data-admin]")
      .forEach((e) => e.classList.toggle("hidden", !admin));
    selectAdminSection(location.hash.slice(1));
    await loadLists();
    await loadBattles();
    if (admin) await loadScores();
    notify("");
  })
  .catch((e) => notify(e.message, true));
