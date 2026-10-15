"use strict";
(() => {
  const form = document.getElementById("time-attack-form"),
    notice = document.getElementById("time-attack-resume");
  let player = null,
    sequence = 0,
    lastState = null;
  function key() {
    const data = new FormData(form);
    return `pcb-game-${player.id}-time_attack-${data.get("penalty")}-${data.get("duration")}-`;
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
      });
    document.getElementById("time-attack-rule").textContent =
      data.get("penalty") === "hardcore"
        ? "Bonne réponse : +1. Les erreurs coûtent −1, −2, −3… même après une bonne réponse. Avec 6 bonnes et 2 erreurs : +3 points."
        : "Bonne réponse : +1. Chaque erreur : −1. Avec 6 bonnes et 2 erreurs : +4 points.";
    notice.hidden = true;
    document.getElementById("time-attack-start").textContent =
      "Démarrer le chrono";
    if (!player) return;
    document.getElementById("time-attack-start").disabled = false;
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
      notice.hidden = false;
      notice.textContent = error.message;
    } finally {
      if (request === sequence)
        document.getElementById("time-attack-start").disabled = false;
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
  PCB.ready.then((p) => {
    if (!p) return;
    player = p;
    try {
      const previous = JSON.parse(
        localStorage.getItem("pcb-time-attack-last-" + p.id) || "null",
      );
      if (
        previous &&
        [300, 600].includes(previous.duration) &&
        ["normal", "hardcore"].includes(previous.difficulty)
      ) {
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
