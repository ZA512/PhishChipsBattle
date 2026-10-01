"use strict";
(() => {
  const el = (id) => document.getElementById(id);
  const selected = new Set();
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
      `${selected.size} mail(s) sélectionné(s), toutes pages confondues`;
    for (const id of ["mail-export-selected", "mail-delete-selected"])
      el(id).disabled = selected.size === 0;
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
          ? "Supprimer tous les mails du catalogue ? Les nouvelles parties seront bloquées jusqu’au prochain import. Les séries déjà créées et les résultats restent conservés."
          : `Supprimer ${ids.length} mail(s) du catalogue ? Les séries déjà créées et les résultats restent conservés.`,
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
    await load();
    notice(`${data.removed} mail(s) retiré(s) du catalogue.`);
    previewKey = null;
    el("mail-import").disabled = true;
  }
  async function exportEmails(ids) {
    const catalog = await PCB.request("/api/admin/emails/export", {
      method: "POST",
      body: JSON.stringify(ids ? { ids } : {}),
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
    const input = { catalog, replace: el("mail-replace").checked };
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
  el("mail-file").addEventListener("change", async () => {
    invalidate();
    const file = el("mail-file").files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 - 1024)
      return notice("Le fichier dépasse 10 Mo.", true);
    try {
      el("mail-json").value = await file.text();
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
        `${result.added} ajout(s), ${result.duplicates} doublon(s) ignoré(s), ${result.removed} retrait(s). Catalogue après import : ${result.total} mails. Aucune modification effectuée.`;
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
          "Remplacer tout le catalogue ? Les mails actuels seront retirés des nouvelles parties. Les séries et corrections existantes restent conservées.",
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
      await load();
      notice(
        `${r.added} mail(s) importé(s), ${r.duplicates} doublon(s) ignoré(s), ${r.removed} retiré(s).`,
      );
    }),
  );
  for (const [id, work] of [
    ["mail-export-all", () => exportEmails()],
    ["mail-export-selected", () => exportEmails([...selected])],
    ["mail-delete-selected", () => remove([...selected])],
    ["mail-delete-all", () => remove([], true)],
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
  for (const id of ["mail-type", "mail-usage"])
    el(id).addEventListener("change", () => {
      page = 1;
      load().catch((e) => notice(e.message, true));
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
  PCB.ready
    .then(async (player) => {
      if (player?.role === "admin") {
        ready = true;
        await load();
      }
    })
    .catch((e) => notice(e.message, true));
})();
