"use strict";
(() => {
  const el = (id) => document.getElementById(id);
  const selected = new Set();
  const states = { draft: "Brouillon", ready: "Prêt", archived: "Archivé" };
  let sets = [];
  const labels = {
    training: "Entraînement",
    battle: "Battle",
    both: "Les deux",
  };
  let page = 1,
    pages = 1,
    ready = false,
    previewKey = null,
    sequence = 0,
    total = 0,
    visibleIds = [];
  function notice(message, error = false) {
    el("message").textContent = message;
    el("message").className = error ? "notice error" : "notice success";
  }
  function updateSelection() {
    el("mail-selection").textContent =
      `${selected.size} mail(s) sélectionné(s), toutes pages et tous filtres confondus`;
    for (const id of ["mail-export-selected", "mail-delete-selected"])
      el(id).disabled = selected.size === 0;
    el("mail-add-to-set").disabled =
      !selected.size || !el("mail-assign-set").value;
    el("mail-change-usage").disabled = !selected.size;
    const currentSet = sets.find(
      (s) => s.id === Number(el("mail-filter-set").value),
    );
    el("mail-detach-set").disabled =
      !selected.size || !currentSet || currentSet.status === "archived";
    el("mail-export-set").disabled = !currentSet || !currentSet.total;
    const toggle = el("mail-list").querySelector("thead input");
    if (toggle) {
      toggle.checked =
        !!visibleIds.length && visibleIds.every((id) => selected.has(id));
      toggle.indeterminate =
        visibleIds.some((id) => selected.has(id)) && !toggle.checked;
    }
  }
  async function load() {
    if (!ready) return;
    const requestId = ++sequence;
    const params = new URLSearchParams({
      page,
      search: el("mail-search").value,
      type: el("mail-type").value,
      usage: el("mail-usage").value,
      setId: el("mail-filter-set").value,
    });
    const data = await PCB.request("/api/admin/emails?" + params);
    if (requestId !== sequence) return;
    pages = data.pages;
    total = data.totals.total;
    visibleIds = data.emails.map((email) => email.id);
    if (page > pages) {
      page = pages;
      return load();
    }
    el("mail-totals").textContent = data.totals.total
      ? `${data.totals.total} mails actifs · ${data.totals.training} disponibles en entraînement · ${data.totals.battle} en battle`
      : "Le buffet est vide. Importez vos scénarios avant de lancer une partie ou de publier une battle.";
    el("mail-export-all").disabled = el("mail-delete-all").disabled =
      !data.totals.total;
    el("mail-page").textContent =
      `Page ${page} / ${pages} · ${data.matched} résultat(s)`;
    el("mail-prev").disabled = page <= 1;
    el("mail-next").disabled = page >= pages;
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    [
      "Sélection",
      "Sujet / expéditeur",
      "Classification",
      "Utilisation",
      "Sets",
      "Actions",
    ].forEach((name, i) => {
      const th = document.createElement("th");
      if (i === 0) {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.setAttribute(
          "aria-label",
          "Sélectionner tous les mails de cette page",
        );
        toggle.checked =
          !!data.emails.length && data.emails.every((e) => selected.has(e.id));
        toggle.indeterminate =
          data.emails.some((e) => selected.has(e.id)) && !toggle.checked;
        toggle.addEventListener("change", () => {
          data.emails.forEach((e) =>
            toggle.checked ? selected.add(e.id) : selected.delete(e.id),
          );
          updateSelection();
          load().catch((e) => notice(e.message, true));
        });
        th.append(toggle);
      } else th.textContent = name;
      head.append(th);
    });
    const tbody = table.createTBody();
    for (const email of data.emails) {
      const row = tbody.insertRow(),
        check = document.createElement("input");
      check.type = "checkbox";
      check.checked = selected.has(email.id);
      check.setAttribute("aria-label", "Sélectionner " + email.subject);
      check.addEventListener("change", () => {
        check.checked ? selected.add(email.id) : selected.delete(email.id);
        updateSelection();
      });
      row.insertCell().append(check);
      const info = row.insertCell(),
        title = document.createElement("strong"),
        sender = document.createElement("small");
      title.textContent = email.subject;
      sender.textContent = email.sender;
      info.append(title, document.createElement("br"), sender);
      row.insertCell().textContent =
        email.type === "safe" ? "Légitime" : "Phishing";
      row.insertCell().textContent = labels[email.usage];
      row.insertCell().textContent =
        email.sets
          .map(
            (s) =>
              s.name + (s.status === "ready" ? "" : ` (${states[s.status]})`),
          )
          .join(" · ") || "Sans set";
      const actions = row.insertCell();
      actions.append(
        button("Voir", async () => {
          const { email: item } = await PCB.request(
            `/api/admin/emails/${email.id}`,
          );
          el("mail-preview-title").textContent = item.subject;
          el("mail-preview-content").textContent =
            `De : ${item.sender}\nEnveloppe SMTP (simulée) : ${item.realSender}\nUtilisation : ${labels[item.usage]}\nClassification : ${item.type}\n\n${item.body}\n\nCorrection :\n${item.clues.join("\n\n") || "Aucun indice renseigné."}`;
          el("mail-preview").showModal();
        }),
        button("Supprimer", () => remove([email.id]), true),
      );
    }
    el("mail-list").replaceChildren(table);
    updateSelection();
  }
  function button(label, work, danger = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = danger ? "btn btn-danger" : "btn btn-secondary";
    b.addEventListener("click", () => run(b, work));
    return b;
  }
  async function run(button, work) {
    button.disabled = true;
    try {
      await work();
    } catch (error) {
      notice(error.message, true);
    } finally {
      button.disabled = false;
      updateSelection();
      el("mail-import").disabled = !previewKey;
      el("mail-prev").disabled = page <= 1;
      el("mail-next").disabled = page >= pages;
      el("mail-export-all").disabled = el("mail-delete-all").disabled = !total;
    }
  }
  async function remove(ids, all = false) {
    if (
      !(await PCB.confirm(
        all
          ? "Supprimer tous les mails du catalogue et de tous les sets ? Les nouvelles parties seront bloquées jusqu’au prochain import. Les séries déjà créées et les résultats restent conservés."
          : `Supprimer ${ids.length} mail(s) du catalogue, dans tous leurs sets ? Pour les retirer seulement d’un set, utilisez l’action dédiée. Les séries déjà créées et les résultats restent conservés.`,
      ))
    )
      return;
    const data = await PCB.request("/api/admin/emails/delete", {
      method: "POST",
      body: JSON.stringify(
        all ? { all: true, confirm: "SUPPRIMER TOUT" } : { ids },
      ),
    });
    if (all) selected.clear();
    else ids.forEach((id) => selected.delete(id));
    await refreshSets(true);
    await load();
    notice(`${data.removed} mail(s) retiré(s) du catalogue.`);
    previewKey = null;
    el("mail-import").disabled = true;
  }
  async function exportEmails(ids, setId) {
    const catalog = await PCB.request("/api/admin/emails/export", {
      method: "POST",
      body: JSON.stringify({
        ...(ids ? { ids } : {}),
        ...(setId ? { setId } : {}),
      }),
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(catalog, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `phishchips-mails-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice(
      `${catalog.emails.length} mail(s) exporté(s). Ce fichier contient les réponses : gardez-le hors du dépôt public.`,
    );
  }
  function payload() {
    const content = el("mail-json").value;
    if (new Blob([content]).size > 10 * 1024 * 1024 - 1024)
      throw new Error("Le JSON dépasse 10 Mo. Importez-le en plusieurs lots.");
    let catalog;
    try {
      catalog = JSON.parse(content);
    } catch {
      throw new Error(
        "JSON invalide : vérifiez les virgules, guillemets et crochets.",
      );
    }
    const assignUsage = (row) =>
      row && typeof row === "object" && !Array.isArray(row)
        ? { ...row, usage: row.usage ?? el("mail-import-usage").value }
        : row;
    if (Array.isArray(catalog)) catalog = catalog.map(assignUsage);
    else if (catalog && Array.isArray(catalog.emails))
      catalog = { ...catalog, emails: catalog.emails.map(assignUsage) };
    const target = el("mail-import-set").value;
    if (target === "new" && !el("mail-new-set-name").value.trim())
      throw new Error("Donnez un nom au nouveau set.");
    const destination =
      target === "new"
        ? {
            newSet: {
              name: el("mail-new-set-name").value,
              description: el("mail-new-set-description").value,
              defaultUsage: el("mail-import-usage").value,
              status: el("mail-new-set-status").value,
            },
          }
        : { setId: Number(target) };
    const input = {
      catalog,
      replace: el("mail-replace").checked,
      ...destination,
    };
    if (new Blob([JSON.stringify(input)]).size > 10 * 1024 * 1024 - 64)
      throw new Error("L’import dépasse 10 Mo. Divisez-le en plusieurs lots.");
    return input;
  }
  function invalidate() {
    previewKey = null;
    el("mail-import").disabled = true;
    el("mail-import-summary").textContent =
      "Vérifiez le JSON avant de l’importer.";
  }
  el("mail-json").addEventListener("input", invalidate);
  el("mail-replace").addEventListener("change", invalidate);
  el("mail-import-usage").addEventListener("change", invalidate);
  for (const id of ["mail-new-set-name", "mail-new-set-description"])
    el(id).addEventListener("input", invalidate);
  el("mail-new-set-status").addEventListener("change", invalidate);
  el("mail-import-set").addEventListener("change", () => {
    updateImportTarget();
    invalidate();
  });
  el("mail-file").addEventListener("change", async () => {
    invalidate();
    const file = el("mail-file").files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 - 1024)
      return notice("Le fichier dépasse 10 Mo.", true);
    try {
      el("mail-json").value = await file.text();
      try {
        const metadata = JSON.parse(el("mail-json").value).set;
        if (metadata && el("mail-import-set").value === "new") {
          el("mail-new-set-name").value = metadata.name || "";
          el("mail-new-set-description").value = metadata.description || "";
          if (labels[metadata.defaultUsage])
            el("mail-import-usage").value = metadata.defaultUsage;
        }
      } catch {
        /* JSON validity is checked explicitly by the preview action. */
      }
    } catch {
      notice("Lecture du fichier impossible.", true);
    }
  });
  el("mail-check").addEventListener("click", (e) =>
    run(e.currentTarget, async () => {
      invalidate();
      const input = payload(),
        key = JSON.stringify(input);
      const result = await PCB.request("/api/admin/emails/import", {
        method: "POST",
        body: JSON.stringify({ ...input, preview: true }),
      });
      if (key !== JSON.stringify(payload())) return;
      previewKey = key;
      el("mail-import").disabled = false;
      el("mail-import-summary").textContent =
        `Set « ${result.set.name} » (${states[result.set.status]}) : ${result.added} nouveaux mails, ${result.linked} nouveaux rattachements, ${result.duplicates} doublons ignorés, ${result.detached} retirés de ce set. Après import : ${result.setTotal} mails dans le set. Lot : ${result.safe} légitimes / ${result.phishing} phishing. ${result.usageConflicts ? `${result.usageConflicts} mails existent avec une autre disponibilité : leur disponibilité actuelle sera conservée, modifiable avec les actions sur la sélection. ` : ""}Aucune modification effectuée.`;
    }),
  );
  el("mail-import").addEventListener("click", (e) =>
    run(e.currentTarget, async () => {
      const input = payload();
      if (previewKey !== JSON.stringify(input))
        throw new Error("Vérifiez ce JSON avant de l’importer.");
      if (
        input.replace &&
        !(await PCB.confirm(
          "Remplacer le contenu de ce set ? Les autres sets et les séries des parties et battles existantes seront conservés.",
        ))
      )
        return;
      if (previewKey !== JSON.stringify(payload()))
        throw new Error("Le JSON a changé. Vérifiez-le à nouveau.");
      const r = await PCB.request("/api/admin/emails/import", {
        method: "POST",
        body: JSON.stringify(input),
      });
      selected.clear();
      page = 1;
      invalidate();
      await refreshSets(true);
      el("mail-import-set").value = String(r.set.id);
      updateImportTarget();
      await load();
      notice(
        `Set « ${r.set.name} » : ${r.added} nouveaux mails, ${r.linked} rattachements, ${r.duplicates} doublons ignorés, ${r.detached} retirés de ce set. ${states[r.set.status]} : ${r.set.status === "draft" ? "passez le set à Prêt après relecture pour le rendre jouable." : "les nouvelles parties peuvent utiliser ce set."}`,
      );
    }),
  );
  for (const [id, work] of [
    ["mail-export-all", () => exportEmails()],
    ["mail-export-selected", () => exportEmails([...selected])],
    ["mail-delete-selected", () => remove([...selected])],
    ["mail-delete-all", () => remove([], true)],
    [
      "mail-export-set",
      () => exportEmails(undefined, Number(el("mail-filter-set").value)),
    ],
    [
      "mail-prev",
      async () => {
        page--;
        await load();
      },
    ],
    [
      "mail-next",
      async () => {
        page++;
        await load();
      },
    ],
  ])
    el(id).addEventListener("click", (e) => run(e.currentTarget, work));
  for (const id of ["mail-type", "mail-usage", "mail-filter-set"])
    el(id).addEventListener("change", () => {
      page = 1;
      load().catch((e) => notice(e.message, true));
      updateSelection();
    });
  let debounce;
  el("mail-search").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      page = 1;
      load().catch((e) => notice(e.message, true));
    }, 250);
  });
  el("mail-preview-close").addEventListener("click", () =>
    el("mail-preview").close(),
  );
  el("set-history-close").addEventListener("click", () =>
    el("set-history").close(),
  );
  window.addEventListener("battles-updated", () => {
    if (ready) refreshSets().catch((e) => notice(e.message, true));
  });
  el("mail-assign-set").addEventListener("change", updateSelection);
  function options(id, entries) {
    const previous = el(id).value;
    el(id).replaceChildren(
      ...entries.map(([value, label]) => new Option(label, String(value))),
    );
    if (entries.some(([value]) => String(value) === previous))
      el(id).value = previous;
  }
  function updateImportTarget() {
    const isNew = el("mail-import-set").value === "new";
    el("mail-new-set").hidden = !isNew;
    const set = sets.find((s) => s.id === Number(el("mail-import-set").value));
    if (set) el("mail-import-usage").value = set.default_usage;
  }
  function resetSet() {
    el("set-form").reset();
    el("set-id").value = "";
    el("set-name").focus();
  }
  const when = (value) =>
    value ? new Date(value).toLocaleString("fr-FR") : "—";
  async function refreshSets(changed = false) {
    sets = (await PCB.request("/api/admin/mail-sets")).sets;
    const active = sets.filter((s) => s.status !== "archived");
    options("mail-import-set", [
      ["new", "Créer un nouveau set"],
      ...active.map((s) => [s.id, `${s.name} · ${states[s.status]}`]),
    ]);
    options("mail-assign-set", [
      ["", "Choisir un set"],
      ...active.map((s) => [s.id, s.name]),
    ]);
    options("mail-filter-set", [
      ["", "Tous les sets"],
      [0, "Mails sans set"],
      ...sets.map((s) => [s.id, `${s.name} · ${states[s.status]}`]),
    ]);
    const table = document.createElement("table"),
      head = table.createTHead().insertRow(),
      body = table.createTBody();
    for (const label of [
      "Set / état",
      "Mails / disponibilité",
      "Dates",
      "Battles",
      "Actions",
    ]) {
      const th = document.createElement("th");
      th.textContent = label;
      head.append(th);
    }
    for (const set of sets) {
      const row = body.insertRow();
      row.insertCell().textContent = `${set.name} · ${states[set.status]}${set.description ? "\n" + set.description : ""}`;
      row.insertCell().textContent = `${set.total} mails : ${set.safe} légitimes / ${set.phishing} phishing\n${set.training} entraînement · ${set.battle} battle`;
      row.insertCell().textContent = `Créé : ${when(set.created_at)}\nDernier import : ${when(set.last_imported_at)}`;
      row.insertCell().textContent = set.battles_used;
      const actions = row.insertCell();
      actions.append(
        button("Voir les mails", async () => {
          el("mail-filter-set").value = String(set.id);
          page = 1;
          await load();
        }),
        button("Modifier le set", async () => {
          el("set-id").value = set.id;
          el("set-name").value = set.name;
          el("set-description").value = set.description;
          el("set-default-usage").value = set.default_usage;
          el("set-status").value = set.status;
          el("set-editor").open = true;
          el("set-name").focus();
        }),
        button("Historique", () => history(set.id)),
      );
      if (set.status !== "archived")
        actions.append(
          button("Archiver", async () => {
            if (
              !(await PCB.confirm(
                `Archiver « ${set.name} » ? Il ne sera plus proposé aux nouvelles parties. Les mails et les battles publiées sont conservés.`,
              ))
            )
              return;
            await PCB.request(`/api/admin/mail-sets/${set.id}`, {
              method: "PUT",
              body: JSON.stringify({
                name: set.name,
                description: set.description,
                defaultUsage: set.default_usage,
                status: "archived",
              }),
            });
            await refreshSets(true);
            await load();
            notice("Set archivé.");
          }),
        );
    }
    el("mail-sets").replaceChildren(table);
    updateSelection();
    if (changed) window.dispatchEvent(new Event("mailsets-updated"));
  }
  async function history(id) {
    const data = await PCB.request(`/api/admin/mail-sets/${id}/history`);
    el("set-history-title").textContent = `Historique · ${data.set.name}`;
    const content = el("set-history-content");
    content.replaceChildren();
    const operations = {
      import: "Import",
      replace: "Remplacement",
      set: "Modification du set",
      attach: "Ajout au set",
      detach: "Retrait du set",
      usage: "Disponibilité",
    };
    for (const event of data.events) {
      const p = document.createElement("p");
      p.textContent = `${when(event.created_at)} · ${event.actor || "Compte supprimé"} · ${operations[event.operation] || event.operation}`;
      if (["import", "replace"].includes(event.operation))
        p.textContent += ` : ${event.added} nouveaux mails, ${event.details.linked || 0} rattachements, ${event.details.detached || 0} retraits du set`;
      else if (event.operation === "set")
        p.textContent += ` · ${states[event.details.after.status]}`;
      else p.textContent += ` · ${event.details.count || 0} mails`;
      content.append(p);
    }
    if (!data.events.length) {
      const p = document.createElement("p");
      p.textContent =
        "Aucune opération journalisée pour ce set. Les imports antérieurs à la migration ne sont pas reconstitués.";
      content.append(p);
    }
    const title = document.createElement("h3");
    title.textContent = "Battles utilisant ce set";
    content.append(title);
    for (const battle of data.battles) {
      const p = document.createElement("p");
      p.textContent = `${battle.name} · ${when(battle.starts_at)} · ${battle.status === "closed" ? "Clôturée" : "Publiée"}`;
      content.append(p);
    }
    if (!data.battles.length) {
      const p = document.createElement("p");
      p.textContent = "Aucune battle publiée avec ce set.";
      content.append(p);
    }
    el("set-history").showModal();
  }
  el("set-new").addEventListener("click", resetSet);
  el("set-form").addEventListener("submit", (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      const id = el("set-id").value;
      await PCB.request("/api/admin/mail-sets" + (id ? "/" + id : ""), {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({
          name: el("set-name").value,
          description: el("set-description").value,
          defaultUsage: el("set-default-usage").value,
          status: el("set-status").value,
        }),
      });
      resetSet();
      el("set-editor").open = false;
      await refreshSets(true);
      await load();
      invalidate();
      notice("Set enregistré.");
    });
  });
  for (const [id, action] of [
    ["mail-add-to-set", "add"],
    ["mail-detach-set", "remove"],
  ])
    el(id).addEventListener("click", (e) =>
      run(e.currentTarget, async () => {
        const setId = Number(
          el(action === "add" ? "mail-assign-set" : "mail-filter-set").value,
        );
        if (
          !(await PCB.confirm(
            `${action === "add" ? "Ajouter" : "Retirer"} ${selected.size} mails ${action === "add" ? "dans" : "de"} ce set ? Les autres sets sont conservés.`,
          ))
        )
          return;
        const result = await PCB.request("/api/admin/emails/sets", {
          method: "POST",
          body: JSON.stringify({ setId, ids: [...selected], action }),
        });
        selected.clear();
        await refreshSets(true);
        await load();
        invalidate();
        notice(`${result.changed} rattachements modifiés.`);
      }),
    );
  el("mail-change-usage").addEventListener("click", (e) =>
    run(e.currentTarget, async () => {
      const usage = el("mail-bulk-usage").value;
      if (
        !(await PCB.confirm(
          `Rendre ${selected.size} mails disponibles pour « ${labels[usage]} » dans tous leurs sets ? Les séries déjà créées restent figées.`,
        ))
      )
        return;
      const result = await PCB.request("/api/admin/emails/usage", {
        method: "POST",
        body: JSON.stringify({ ids: [...selected], usage }),
      });
      selected.clear();
      await refreshSets(true);
      await load();
      invalidate();
      notice(`${result.changed} disponibilités modifiées.`);
    }),
  );
  PCB.ready
    .then(async (player) => {
      if (player?.role === "admin") {
        ready = true;
        await refreshSets();
        await load();
      }
    })
    .catch((e) => notice(e.message, true));
})();
