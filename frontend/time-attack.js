"use strict";
(() => {
  const form = document.getElementById("time-attack-form"),
    notice = document.getElementById("time-attack-resume");
  let player = null,
    sequence = 0,
    lastState = null;
  const source = document.getElementById("time-attack-set");
  function key() {
    const data = new FormData(form);
    return `pcb-game-${player.id}-time_attack-${data.get("penalty")}-${data.get("duration")}-${data.get("setId") ? "set-" + data.get("setId") : ""}`;
  }
  async function update() {
    const data = new FormData(form),
      request = ++sequence;
    lastState = null;
    document.getElementById("time-attack-last-result").hidden = true;
    document.getElementById("time-attack-hof").href =
      "/scores.html?" +
      new URLSearchParams({
        format: "time_attack",
        duration: data.get("duration"),
        difficulty: data.get("penalty"),
        ...(data.get("setId") ? { setId: data.get("setId") } : {}),
      });
    document.getElementById("time-attack-rule").textContent =
      data.get("penalty") === "hardcore"
        ? "Bonne réponse : +1. Les erreurs coûtent −1, −2, −3… même après une bonne réponse. Avec 6 bonnes et 2 erreurs : +3 points."
        : "Bonne réponse : +1. Chaque erreur : −1. Avec 6 bonnes et 2 erreurs : +4 points.";
    notice.hidden = true;
    const available = Number(source.selectedOptions[0]?.dataset.total || 0) > 0;
    document.getElementById("time-attack-source").textContent = available
      ? `${source.selectedOptions[0].dataset.total} mails disponibles. La série est figée au démarrage ; un même mail ne revient pas dans la tentative. Les mails réservés aux battles restent exclus.`
      : "Aucun mail disponible dans cette source. Choisissez un autre set ou demandez un import à l’administrateur.";
    document.getElementById("time-attack-start").textContent =
      "Démarrer le chrono";
    if (!player) return;
    document.getElementById("time-attack-start").disabled = !available;
    const saved = localStorage.getItem(key());
    if (!saved) return;
    document.getElementById("time-attack-start").disabled = true;
    try {
      const state = await PCB.request(
        "/api/sessions/" + encodeURIComponent(saved) + "/state",
      );
      if (request !== sequence) return;
      lastState = state;
      notice.hidden = false;
      notice.textContent = state.completed
        ? "Dernière tentative terminée : " +
          (state.score >= 0 ? "+" : "") +
          state.score +
          " points. Vous pouvez consulter son résultat ou recommencer."
        : "Une tentative vous attend. Le chrono ne sera pas remis à zéro.";
      document.getElementById("time-attack-start").textContent = state.completed
        ? "Nouvelle tentative"
        : "Reprendre la tentative";
      document.getElementById("time-attack-last-result").hidden =
        !state.completed;
    } catch (error) {
      if (request !== sequence) return;
      if ([404, 410].includes(error.status)) {
        localStorage.removeItem(key());
        notice.hidden = true;
      } else {
        notice.hidden = false;
        notice.textContent = error.message;
      }
    } finally {
      if (request === sequence)
        document.getElementById("time-attack-start").disabled =
          !available && (!lastState || lastState.completed);
    }
  }
  form.addEventListener("change", () => update());
  function destination() {
    const data = new FormData(form);
    return (
      "/phishing.html?" +
      new URLSearchParams({
        format: "time_attack",
        duration: data.get("duration"),
        difficulty: data.get("penalty"),
        autostart: "1",
        ...(data.get("setId") ? { setId: data.get("setId") } : {}),
      })
    );
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!player) return;
    if (lastState?.completed) localStorage.removeItem(key());
    location.assign(destination());
  });
  document
    .getElementById("time-attack-last-result")
    .addEventListener("click", () => location.assign(destination()));
  PCB.ready.then(async (p) => {
    if (!p) return;
    player = p;
    try {
      const catalog = await PCB.request("/api/sessions/mail-sets");
      const general = source.options[0];
      general.textContent = `Catalogue général · tous les sets · ${catalog.total} mails`;
      general.dataset.total = catalog.total;
      for (const set of catalog.sets) {
        const option = document.createElement("option");
        option.value = String(set.id);
        option.textContent = `Set : ${set.name} · ${set.total} mails`;
        option.dataset.total = set.total;
        source.append(option);
      }
      source.disabled = false;
    } catch (error) {
      notice.hidden = false;
      notice.textContent = error.message;
      return;
    }
    try {
      const previous = JSON.parse(
        localStorage.getItem("pcb-time-attack-last-" + p.id) || "null",
      );
      if (
        previous &&
        [300, 600].includes(previous.duration) &&
        ["normal", "hardcore"].includes(previous.difficulty)
      ) {
        if (Number.isSafeInteger(previous.setId) && previous.setId > 0) {
          if (
            ![...source.options].some((o) => o.value === String(previous.setId))
          ) {
            const option = document.createElement("option");
            option.value = String(previous.setId);
            option.textContent = `Set #${previous.setId} indisponible · ancienne tentative`;
            source.append(option);
          }
          source.value = String(previous.setId);
        }
        form.querySelector(
          `[name="duration"][value="${previous.duration}"]`,
        ).checked = true;
        form.querySelector(
          `[name="penalty"][value="${previous.difficulty}"]`,
        ).checked = true;
      }
    } catch {}
    update();
  });
})();
