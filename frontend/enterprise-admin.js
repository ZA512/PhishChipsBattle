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
async function loadLists() {
  const data = await PCB.request("/api/battles/participants");
  players = data.players;
  teams = data.teams;
  byId("battle-players").replaceChildren(
    ...players.map((p) => new Option(p.display_name, p.id)),
  );
  byId("battle-teams").replaceChildren(
    ...teams.map((t) => new Option(t.name, t.id)),
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
            }),
            action(
              "Supprimer",
              async () => {
                if (
                  !confirm(
                    `Supprimer « ${t.name} » ? Ses membres devront choisir une autre équipe.`,
                  )
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
});
byId("select-all").addEventListener("click", () =>
  [...byId("battle-players").options].forEach((o) => (o.selected = true)),
);
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
      playerIds: [...byId("battle-players").selectedOptions].map((o) =>
        Number(o.value),
      ),
      teamIds: [...byId("battle-teams").selectedOptions].map((o) =>
        Number(o.value),
      ),
    };
    const data = await PCB.request("/api/battles", {
      method: "POST",
      body: JSON.stringify(body),
    });
    notify(`Battle publiée avec ${data.participants} participant(s).`);
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
        new Date(b.starts_at).toLocaleString("fr-FR"),
        new Date(b.ends_at).toLocaleString("fr-FR"),
        b.status,
        b.status === "closed"
          ? "Clôturée"
          : action(
              "Clôturer",
              async () => {
                if (
                  !confirm(
                    "Clôturer cette battle maintenant ? Les tentatives en cours seront terminées.",
                  )
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
  if (!s) return;
  byId("corrected-score").value = s.score;
  byId("disqualified").checked = s.disqualified;
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
    await loadLists();
    await loadBattles();
    if (admin) await loadScores();
    notify("Administration prête.");
  })
  .catch((e) => notify(e.message, true));
