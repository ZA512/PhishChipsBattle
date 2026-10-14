"use strict";
(() => {
  const el = (id) => document.getElementById(id);
  let verified = null,
    sets = [],
    sequence = 0;
  function notice(text, error = false) {
    el("battle-mail-summary").textContent = text;
    el("battle-mail-summary").className = error ? "notice error" : "notice";
  }
  function invalidate() {
    verified = null;
    const total = Number(el("battle-count").value),
      safe = Number(el("battle-safe-count").value);
    el("battle-safe-count").max = total;
    el("battle-phishing-count").textContent =
      `${total - safe} phishing · ${total} mails au total`;
    notice("Vérifiez cette composition avant de publier la battle.");
  }
  function input() {
    return {
      emailCount: Number(el("battle-count").value),
      safeCount: Number(el("battle-safe-count").value),
      excludeTraining: el("battle-exclude-training").checked,
      sets: [...el("battle-mail-sets").querySelectorAll("label")]
        .filter((row) => row.querySelector('input[type="checkbox"]').checked)
        .map((row) => ({
          setId: Number(row.dataset.setId),
          count: Number(row.querySelector('input[type="number"]').value),
        })),
    };
  }
  function recount() {
    const total = input().sets.reduce((n, s) => n + s.count, 0);
    el("battle-count").value = total;
    el("battle-safe-count").value = Math.floor(total / 2);
    el("battle-count").dispatchEvent(new Event("input", { bubbles: true }));
    invalidate();
  }
  async function load() {
    const request = ++sequence,
      previous = new Map(input().sets.map((s) => [s.setId, s.count]));
    const result = await PCB.request("/api/battles/mail-sets");
    if (request !== sequence) return;
    sets = result.sets;
    el("battle-mail-sets").replaceChildren();
    for (const set of sets) {
      const exclusive = el("battle-exclude-training").checked;
      const available = exclusive ? set.battle_only : set.battle;
      const row = document.createElement("label"),
        check = document.createElement("input"),
        label = document.createElement("span"),
        meta = document.createElement("small"),
        count = document.createElement("input");
      row.dataset.setId = set.id;
      check.type = "checkbox";
      check.disabled = !available;
      check.checked = previous.has(set.id) && !!available;
      label.textContent = set.name;
      meta.textContent = `${available} disponibles · ${exclusive ? set.battle_only_safe : set.battle_safe} légitimes / ${exclusive ? set.battle_only_phishing : set.battle_phishing} phishing${set.shared && !exclusive ? ` · ${set.shared} accessibles en entraînement` : ""}`;
      label.append(meta);
      count.type = "number";
      count.min = 1;
      count.max = available;
      count.value = Math.min(previous.get(set.id) || 20, available);
      count.disabled = !check.checked;
      count.setAttribute("aria-label", "Quantité pour " + set.name);
      check.addEventListener("change", () => {
        count.disabled = !check.checked;
        recount();
      });
      count.addEventListener("input", recount);
      row.append(check, label, count);
      el("battle-mail-sets").append(row);
    }
    if (!sets.length) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent =
        "Aucun set prêt. Un administrateur doit importer et préparer les mails.";
      el("battle-mail-sets").append(p);
    }
    recount();
  }
  PCB.battleCatalog = {
    fields() {
      const fields = input();
      if (verified !== JSON.stringify(fields))
        throw new Error(
          "Choisissez les sets et vérifiez la composition avant publication.",
        );
      return fields;
    },
  };
  el("battle-safe-count").addEventListener("input", invalidate);
  el("battle-count").addEventListener("input", invalidate);
  el("battle-exclude-training").addEventListener("change", () =>
    load().catch((e) => notice(e.message, true)),
  );
  el("battle-check-mails").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    verified = null;
    try {
      const fields = input(),
        key = JSON.stringify(fields);
      const { composition } = await PCB.request("/api/battles/mail-preview", {
        method: "POST",
        body: key,
      });
      if (key !== JSON.stringify(input())) return;
      verified = key;
      const lines = composition.sets
        .map((s) => `${s.name} : ${s.count} mails`)
        .join(" · ");
      notice(
        `${composition.total} mails uniques : ${composition.safe} légitimes et ${composition.phishing} phishing. ${lines}. ${composition.sharedAvailable ? "Attention : certains mails disponibles peuvent avoir été vus en entraînement." : "Mails réservés aux battles."}`,
      );
    } catch (error) {
      notice(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  window.addEventListener("mailsets-updated", () =>
    load().catch((e) => notice(e.message, true)),
  );
  PCB.ready
    .then((player) => {
      if (player && ["admin", "organizer"].includes(player.role)) return load();
    })
    .catch((e) => notice(e.message, true));
})();
