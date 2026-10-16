"use strict";
(() => {
  const form = document.getElementById("time-attack-form"),
    notice = document.getElementById("time-attack-resume"),
    source = document.getElementById("time-attack-set"),
    start = document.getElementById("time-attack-start"),
    next = document.getElementById("chrono-next"),
    back = document.getElementById("chrono-back"),
    steps = [...form.querySelectorAll(".chrono-step")];
  let player = null,
    sequence = 0,
    lastState = null,
    step = 0,
    checking = false;
  const values = () => new FormData(form);
  const available = () =>
    Number(source.selectedOptions[0]?.dataset.total || 0) > 0;
  function key() {
    const data = values();
    return `pcb-game-${player.id}-time_attack-${data.get("penalty")}-${data.get("duration")}-${data.get("setId") ? "set-" + data.get("setId") : ""}`;
  }
  function showStep(index, focus = true) {
    step = index;
    document
      .querySelector("main")
      .classList.toggle("chrono-in-progress", step > 0);
    steps.forEach((section, i) => {
      section.hidden = i !== step;
    });
    document.querySelectorAll(".chrono-progress li").forEach((item, i) => {
      if (i === step) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
      item.classList.toggle("is-done", i < step);
    });
    back.hidden = step === 0;
    next.hidden = step === 2;
    start.hidden = step !== 2;
    next.textContent =
      step === 0 ? "Choisir la durée →" : "Choisir la difficulté →";
    if (focus) steps[step].querySelector("h2").focus();
  }
  function buttons() {
    next.disabled = !player || !available();
    start.disabled =
      !player ||
      checking ||
      (!available() && (!lastState || lastState.completed));
  }
  async function update() {
    const data = values(),
      request = ++sequence;
    lastState = null;
    checking = false;
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
        ? "Avec 6 bonnes réponses et 2 erreurs : +3 points. Une bonne réponse ne remet pas les pénalités à zéro."
        : "Avec 6 bonnes réponses et 2 erreurs : +4 points.";
    const sourceName =
      source.selectedOptions[0]?.textContent.split(" · ")[0] || "Sets express";
    document.getElementById("chrono-selection").textContent =
      step === 0
        ? ""
        : sourceName +
          (step === 2
            ? " · " + Number(data.get("duration")) / 60 + " minutes"
            : "");
    document.getElementById("time-attack-source").textContent = available()
      ? `${source.selectedOptions[0].dataset.total} mails express. Ordre aléatoire, sans répétition pendant la tentative.`
      : "Aucun mail express disponible. Demandez à l’administrateur de préparer un set express prêt à jouer.";
    notice.hidden = true;
    start.textContent = "Démarrer le chrono";
    buttons();
    if (!player) return;
    const savedKey = key(),
      saved = localStorage.getItem(savedKey);
    if (!saved) return;
    checking = true;
    buttons();
    try {
      const state = await PCB.request(
        "/api/sessions/" + encodeURIComponent(saved) + "/state",
      );
      if (request !== sequence) return;
      lastState = state;
      notice.hidden = false;
      notice.textContent = state.completed
        ? "Dernière tentative : " +
          (state.score >= 0 ? "+" : "") +
          state.score +
          " points. Prêt à remettre ça ?"
        : "Une tentative est en cours. La reprise conserve le temps restant.";
      start.textContent = state.completed
        ? "Nouvelle tentative"
        : "Reprendre la tentative";
      document.getElementById("time-attack-last-result").hidden =
        !state.completed;
    } catch (error) {
      if (request !== sequence) return;
      if ([404, 410].includes(error.status)) localStorage.removeItem(savedKey);
      else {
        notice.hidden = false;
        notice.textContent = error.message;
      }
    } finally {
      if (request === sequence) {
        checking = false;
        buttons();
      }
    }
  }
  next.addEventListener("click", () => {
    if (!available()) return;
    showStep(Math.min(2, step + 1));
    update();
  });
  back.addEventListener("click", () => {
    showStep(Math.max(0, step - 1));
    update();
  });
  form.addEventListener("change", update);
  function destination(resultId) {
    const data = values();
    return (
      "/phishing.html?" +
      new URLSearchParams({
        format: "time_attack",
        duration: data.get("duration"),
        difficulty: data.get("penalty"),
        autostart: "1",
        ...(data.get("setId") ? { setId: data.get("setId") } : {}),
        ...(resultId ? { result: resultId } : {}),
      })
    );
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (step < 2) {
      if (!next.disabled) next.click();
      return;
    }
    if (start.disabled) return;
    start.disabled = true;
    if (lastState?.completed) localStorage.removeItem(key());
    location.assign(destination());
  });
  document
    .getElementById("time-attack-last-result")
    .addEventListener("click", () => {
      if (lastState?.completed)
        location.assign(destination(lastState.sessionId));
    });
  showStep(0, false);
  PCB.ready.then(async (p) => {
    if (!p) return;
    player = p;
    try {
      const catalog = await PCB.request("/api/sessions/mail-sets");
      source.options[0].textContent = `Tous les sets express · ${catalog.total} mails`;
      source.options[0].dataset.total = catalog.total;
      for (const set of catalog.sets) {
        const option = document.createElement("option");
        option.value = String(set.id);
        option.textContent = `${set.name} · ${set.total} mails`;
        option.dataset.total = set.total;
        source.append(option);
      }
      source.disabled = !catalog.total;
    } catch (error) {
      document.getElementById("time-attack-source").textContent = error.message;
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
        // Former training/battle sources never reappear as Express choices.
        if (
          [...source.options].some(
            (option) => option.value === String(previous.setId),
          )
        )
          source.value = String(previous.setId);
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
