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
    express: "Express · contre-la-montre",
  };
  let page = 1,
    pages = 1,
    ready = false,
    previewKey = null,
    sequence = 0,
    total = 0,
    matched = 0,
    visibleIds = [];
  function notice(message, error = false) {
    for (const id of ["catalog-message", "set-message"]) {
      el(id).textContent = id === "set-message" && !error ? "" : message;
      el(id).className = error ? "notice error" : "notice success";
    }
    if (error && !el("catalog-import-view").hidden)
      el("mail-import-summary").textContent = message;
  }
  function updateSelection() {
    el("mail-select-matched").disabled = !matched;
    el("mail-select-matched").hidden = matched > 0 && selected.size === matched;
    el("mail-select-matched").textContent =
      `Sélectionner les ${matched} résultats`;
    el("mail-selection").textContent =
      `${selected.size} mail${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""} · toutes pages`;
    el("mail-selection-tools").hidden = !selected.size;
    el("mail-selection-help").hidden = !!selected.size;
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
    el("mail-move-to-set").disabled =
      !selected.size ||
      !currentSet ||
      currentSet.status === "archived" ||
      !el("mail-assign-set").value ||
      currentSet.id === Number(el("mail-assign-set").value);
    el("mail-transfer-help").textContent = currentSet
      ? `Déplacer retire les mails de « ${currentSet.name} ». Ajouter aussi conserve leurs sets actuels.`
      : "Pour déplacer, ouvrez d’abord le set d’origine. Ajouter aussi conserve les sets actuels.";
    el("mail-export-set").disabled = !currentSet || !currentSet.total;
    el("mail-context-title").textContent =
      currentSet?.name ||
      (el("mail-filter-set").value === "0"
        ? "Mails sans set"
        : "Tous les mails");
    el("mail-context-description").textContent = currentSet
      ? `${states[currentSet.status]} · ${currentSet.total} mails${currentSet.description ? " · " + currentSet.description : ""}`
      : "Sélectionnez les mails à ranger dans un set. Changer de filtre efface la sélection.";
    el("mail-list")
      .querySelectorAll("tbody tr")
      .forEach((row) =>
        row.classList.toggle(
          "is-selected",
          selected.has(Number(row.dataset.id)),
        ),
      );
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
      pageSize: el("mail-page-size").value,
    });
    const data = await PCB.request("/api/admin/emails?" + params);
    if (requestId !== sequence) return;
    pages = data.pages;
    matched = data.matched;
    total = data.totals.total;
    visibleIds = data.emails.map((email) => email.id);
    if (page > pages) {
      page = pages;
      return load();
    }
    el("mail-totals").textContent = data.totals.total
      ? `${data.totals.total} mails actifs · ${data.totals.training} disponibles en entraînement · ${data.totals.battle} en battle · ${data.totals.express} express`
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
      "Classification / usage",
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
      row.dataset.id = email.id;
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
      const classification = row.insertCell(),
        badge = document.createElement("span"),
        usage = document.createElement("small");
      badge.className = "catalog-badge " + email.type;
      badge.textContent = email.type === "safe" ? "Légitime" : "Phishing";
      usage.textContent = labels[email.usage];
      classification.append(badge, document.createElement("br"), usage);
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
      );
    }
    el("mail-list").replaceChildren(table);
    if (!data.emails.length) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent =
        "Aucun mail ici. Ajoutez un lot ou modifiez les filtres : le phishing ne va pas se ranger tout seul.";
      el("mail-list").append(empty);
    }
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
    el("catalog-message").textContent = el("set-message").textContent = "";
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
        `Après import, « ${result.set.name} » contiendra ${result.setTotal} mails : ${result.linked} ajoutés au set${result.detached ? `, ${result.detached} retirés` : ""}. Le lot contient ${result.safe} légitimes et ${result.phishing} phishing. ${result.duplicates ? `${result.duplicates} doublons ignorés. ` : ""}${result.usageConflicts ? `${result.usageConflicts} mails existent avec une autre disponibilité : celle-ci sera conservée. Vous pourrez la modifier après l’import. ` : ""}Aucune modification effectuée pour le moment.`;
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
      el("mail-filter-set").value = String(r.set.id);
      updateImportTarget();
      await load();
      showView("mails");
      notice(
        `Import terminé : « ${r.set.name} » contient ${r.setTotal} mails (${r.linked} ajoutés${r.detached ? `, ${r.detached} retirés` : ""}). ${r.set.status === "draft" ? "Il est en brouillon : passez-le à Prêt après relecture pour le rendre jouable." : "Le set est prêt."}`,
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
  for (const id of [
    "mail-type",
    "mail-usage",
    "mail-filter-set",
    "mail-page-size",
  ])
    el(id).addEventListener("change", () => {
      if (id !== "mail-page-size") selected.clear();
      page = 1;
      load().catch((e) => notice(e.message, true));
      updateSelection();
    });
  let debounce;
  el("mail-search").addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      selected.clear();
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
  }
  function showView(view) {
    for (const name of ["sets", "mails", "import"])
      el(`catalog-${name}-view`).hidden = name !== view;
    el("catalog-show-sets").setAttribute(
      "aria-pressed",
      String(view === "sets"),
    );
    el("catalog-show-mails").setAttribute(
      "aria-pressed",
      String(view === "mails"),
    );
    el("mail-open-import").hidden = view === "import";
  }
  function selectionFilters() {
    return new URLSearchParams({
      search: el("mail-search").value,
      type: el("mail-type").value,
      usage: el("mail-usage").value,
      setId: el("mail-filter-set").value,
    }).toString();
  }
  el("mail-select-matched").addEventListener("click", (e) =>
    run(e.currentTarget, async () => {
      const filters = selectionFilters();
      const data = await PCB.request("/api/admin/emails/selection?" + filters);
      if (filters !== selectionFilters()) return;
      selected.clear();
      data.ids.forEach((id) => selected.add(id));
      updateSelection();
      el("mail-list")
        .querySelectorAll("tbody tr")
        .forEach(
          (row) =>
            (row.querySelector("input").checked = selected.has(
              Number(row.dataset.id),
            )),
        );
    }),
  );
  async function openSet(id = "") {
    selected.clear();
    page = 1;
    el("mail-search").value = "";
    el("mail-type").value = el("mail-usage").value = "";
    el("mail-filter-set").value = String(id);
    showView("mails");
    await load();
  }
  function editSet(set) {
    resetSet();
    el("set-message").textContent = "";
    el("set-editor-title").textContent = set
      ? "Modifier le set"
      : "Créer un set";
    if (set) {
      el("set-id").value = set.id;
      el("set-name").value = set.name;
      el("set-description").value = set.description;
      el("set-default-usage").value = set.default_usage;
      el("set-status").value = set.status;
    }
    el("set-editor").showModal();
    el("set-name").focus();
  }
  function openImport(id = "new") {
    el("mail-import-set").value = String(id);
    updateImportTarget();
    invalidate();
    showView("import");
    el("mail-import-set").focus();
  }
  el("catalog-show-sets").addEventListener("click", () => showView("sets"));
  el("catalog-show-mails").addEventListener("click", (e) =>
    run(e.currentTarget, () => openSet()),
  );
  el("mail-open-import").addEventListener("click", () => openImport());
  el("mail-import-back").addEventListener("click", () => showView("sets"));
  el("set-create").addEventListener("click", () => editSet());
  for (const id of ["set-new", "set-close"])
    el(id).addEventListener("click", () => el("set-editor").close());
  el("mail-clear-selection").addEventListener("click", () => {
    selected.clear();
    updateSelection();
    el("mail-list")
      .querySelectorAll("tbody input")
      .forEach((input) => (input.checked = false));
  });
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
    const cards = sets.map((set) => {
      const card = document.createElement("article");
      card.className = "catalog-set-card";
      card.dataset.status = set.status;
      card.hidden =
        set.status === "archived" && !el("mail-show-archived").checked;
      const heading = document.createElement("div"),
        name = document.createElement("h4"),
        state = document.createElement("span");
      heading.className = "catalog-heading";
      name.textContent = set.name;
      state.className = "catalog-badge " + set.status;
      state.textContent = states[set.status];
      heading.append(name, state);
      const description = document.createElement("p");
      description.className = "meta";
      description.textContent =
        set.description ||
        "Une collection de mails, pas encore de casier judiciaire.";
      const stats = document.createElement("p");
      stats.className = "catalog-set-count";
      stats.textContent = set.total + " mails";
      const breakdown = document.createElement("p");
      breakdown.className = "meta";
      breakdown.textContent =
        set.safe + " légitimes · " + set.phishing + " phishing";
      const usage = document.createElement("p");
      usage.className = "meta";
      usage.textContent =
        set.training +
        " entraînement · " +
        set.battle +
        " battle · " +
        set.express +
        " express";
      const actions = document.createElement("div");
      actions.className = "form-actions";
      const open = button("Ouvrir les mails", () => openSet(set.id));
      open.className = "btn";
      actions.append(
        open,
        button("Modifier", () => editSet(set)),
      );
      if (set.status !== "archived")
        actions.append(button("Importer ici", async () => openImport(set.id)));
      const extras = document.createElement("details"),
        summary = document.createElement("summary"),
        dates = document.createElement("p"),
        extraActions = document.createElement("div");
      extras.className = "catalog-extra";
      summary.textContent = "Historique et archivage";
      dates.className = "meta";
      dates.textContent =
        "Créé le " +
        when(set.created_at) +
        " · Dernier import : " +
        when(set.last_imported_at) +
        " · " +
        set.battles_used +
        " battle(s)";
      extraActions.className = "form-actions";
      extraActions.append(button("Historique", () => history(set.id)));
      if (set.status !== "archived")
        extraActions.append(
          button("Archiver le set", async () => {
            if (
              !(await PCB.confirm(
                "Archiver « " +
                  set.name +
                  " » ? Ses mails et les battles publiées sont conservés. Il sort des nouvelles sélections.",
              ))
            )
              return;
            await PCB.request("/api/admin/mail-sets/" + set.id, {
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
            notice("Set archivé. Ses mails sont conservés.");
          }),
        );
      extras.append(summary, dates, extraActions);
      card.append(
        heading,
        description,
        stats,
        breakdown,
        usage,
        actions,
        extras,
      );
      return card;
    });
    el("mail-sets").replaceChildren(...cards);
    if (!sets.length) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent =
        "Créez votre premier set ou importez un lot de mails pour remplir le buffet.";
      el("mail-sets").append(empty);
    }
    updateSelection();
    if (changed) window.dispatchEvent(new Event("mailsets-updated"));
  }
  el("mail-show-archived").addEventListener("change", () => {
    el("mail-sets")
      .querySelectorAll(".catalog-set-card")
      .forEach((card) => {
        card.hidden =
          card.dataset.status === "archived" &&
          !el("mail-show-archived").checked;
      });
  });
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
        p.textContent += ` : ${event.added} nouveaux mails dans le catalogue, ${event.details.linked || 0} ajouts au set, ${event.details.detached || 0} retraits du set`;
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
      el("set-editor").close();
      resetSet();
      await refreshSets(true);
      await load();
      invalidate();
      notice("Set enregistré.");
    });
  });
  for (const [id, action] of [
    ["mail-add-to-set", "add"],
    ["mail-detach-set", "remove"],
    ["mail-move-to-set", "move"],
  ])
    el(id).addEventListener("click", (e) =>
      run(e.currentTarget, async () => {
        const setId = Number(
          el(action !== "remove" ? "mail-assign-set" : "mail-filter-set").value,
        );
        const sourceSetId = Number(el("mail-filter-set").value);
        const destination = sets.find((s) => s.id === setId);
        const source = sets.find((s) => s.id === sourceSetId);
        if (
          action === "move" &&
          (!source || source.status === "archived" || sourceSetId === setId)
        )
          throw new Error(
            "Ouvrez un set d’origine actif et choisissez un autre set de destination.",
          );
        if (
          !(await PCB.confirm(
            action === "move"
              ? `Déplacer ${selected.size} mails de « ${source.name} » vers « ${destination.name} » ? Leurs autres sets et les anciennes battles sont conservés.`
              : `${action === "add" ? "Ajouter aussi" : "Retirer"} ${selected.size} mails ${action === "add" ? "dans" : "de"} « ${destination.name} » ? Les autres sets sont conservés.`,
          ))
        )
          return;
        const result = await PCB.request("/api/admin/emails/sets", {
          method: "POST",
          body: JSON.stringify({
            setId,
            ids: [...selected],
            action,
            ...(action === "move" ? { sourceSetId } : {}),
          }),
        });
        selected.clear();
        await refreshSets(true);
        await load();
        invalidate();
        notice(
          action === "move"
            ? `${result.changed} mails déplacés vers « ${destination.name} ».`
            : `${result.changed} mails ${action === "add" ? "ajoutés à" : "retirés de"} « ${destination.name} ».`,
        );
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
