// ============================================================
//  PhishChipsBattle – script.js (version Enterprise / API)
//  Les emails sont chargés depuis l'API, jamais dans le HTML.
// ============================================================

// --- DOM Elements ---
const startScreen = document.getElementById("start-screen");
const gameUi = document.getElementById("game-ui");
const gameOverScreen = document.getElementById("game-over-screen");
const secuGuyContainer = document.getElementById("secu-guy-container");

// Start form
const playerNameInput = document.getElementById("player-name-input");
const playerEmailInput = document.getElementById("player-email-input");
const playerServiceSelect = document.getElementById("player-service-select");
const startBtn = document.getElementById("start-btn");
const startError = document.getElementById("start-error");

const restartBtn = document.getElementById("restart-btn");

const emailSenderEl = document.getElementById("email-sender");
const emailSubjectEl = document.getElementById("email-subject");
const emailBodyEl = document.getElementById("email-body");

const timerEl = document.getElementById("timer");
const securityBarEl = document.getElementById("security-bar");
const scoreEl = document.getElementById("score");
const errorsLeftEl = document.getElementById("errors-left");
const autoAnalyzesLeftEl = document.getElementById("auto-analyzes-left");
const autoAnalyzeBtn = document.getElementById("auto-analyze-btn");
const classifySafeBtn = document.getElementById("classify-safe-btn");
const classifyPhishingBtn = document.getElementById("classify-phishing-btn");

const finalScoreEl = document.getElementById("final-score");
const gameOverTitleEl = document.getElementById("game-over-title");
const gameOverMessageEl = document.getElementById("game-over-message");

const feedbackModalEl = document.getElementById("feedback-modal");
const feedbackTitleEl = document.getElementById("feedback-title");
const feedbackExplanationEl = document.getElementById("feedback-explanation");
const feedbackCluesEl = document.getElementById("feedback-clues");
const feedbackContinueBtn = document.getElementById("feedback-continue-btn");

const cursorTooltipEl = document.getElementById("cursor-tooltip");

const safeMailsFoundEl = document.getElementById("safe-mails-found");
const phishingMailsFoundEl = document.getElementById("phishing-mails-found");
const avgDecisionTimeEl = document.getElementById("avg-decision-time");

const abandonBtn = document.getElementById("abandon-btn");

// --- API State ---
let sessionId = null;
let sessionToken = null;
let playerId = null;
let totalEmails = 0;
let jokerLimit = 3;
let emailDeadline = 0;

// --- Game State ---
let score = 0;
let errors = 0;
const maxErrors = 3;
let timeLeft = 0;
let timerInterval = null;
let gameActive = false;
let submittingAnswer = false;
let autoAnalyzesLeft = 3;
let currentEmailData = null; // { emailId, sender, realSender, subject, body }
let playerName = "";
let gameDifficulty = "easy";
const gameParams = new URLSearchParams(location.search);
let gameFormat =
  gameParams.get("format") === "time_attack" ? "time_attack" : "classic";
let gameDuration = Number(gameParams.get("duration") || 300);
let competition = null;
const gameSetId =
  gameFormat === "time_attack" && !gameParams.has("battle")
    ? gameParams.get("setId") || ""
    : "";
let canonicalState = null;
let rulesVersion = 2;
let checkingExpiry = false;
let lastClockSync = 0;
let clockRetryAt = 0;
let recoveryKey = null;

// Timer durations
const initialTimerDuration = 60;
let currentTimerDuration = initialTimerDuration;

// Stats
let safeEmailsFound = 0;
let phishingEmailsFound = 0;
let totalDecisionTime = 0;
let emailsSuccessfullyClassified = 0;
let humanAnswers = 0;

// --- Audio ---
let audioCtx;
function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
}
function playSound(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  try {
    switch (type) {
      case "tick":
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.1,
        );
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
        break;
      case "correct":
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(
          1046.5,
          audioCtx.currentTime + 0.15,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.15,
        );
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
        break;
      case "error":
        osc.type = "square";
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.3,
        );
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
        break;
      case "new_email":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.15,
        );
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
        break;
      case "click":
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.05,
        );
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.05);
        break;
      case "popup_open":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.15,
        );
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
        break;
    }
  } catch (e) {
    /* ignore */
  }
}

// --- Load Services on page load ---
async function loadServices() {
  try {
    const player = await PCB.ready;
    if (!player) return;
    const data = await PCB.request("/api/services");
    data.services.forEach((svc) => {
      const opt = document.createElement("option");
      opt.value = svc.id;
      opt.textContent = svc.name;
      playerServiceSelect.appendChild(opt);
    });
    playerServiceSelect.value = String(player.service_id || "");
    document.getElementById("current-team-name").textContent =
      data.services.find((svc) => svc.id === player.service_id)?.name ||
      "À choisir";
    document.getElementById("result-profile-link").href =
      "/profile.html?id=" + player.id;
    const battleId = new URLSearchParams(location.search).get("battle");
    if (battleId) {
      const battle = (await PCB.request("/api/battles")).battles.find(
        (b) => String(b.id) === battleId,
      );
      if (!battle || !battle.participating)
        throw new Error("Vous ne participez pas à cette battle.");
      competition = battle;
      gameFormat = battle.game_format;
      if (battle.duration_seconds) gameDuration = battle.duration_seconds;
      const note = document.createElement("p");
      note.className = "notice";
      note.textContent = `${battle.name} · ${battle.email_count} emails · ${battle.max_attempts} tentative(s). L’équipe de cette battle reste ${battle.roster_team || "celle fixée à sa création"}.`;
      startBtn.before(note);
      startBtn.textContent = battle.ongoing
        ? "Reprendre la battle"
        : "Démarrer la battle";
      restartBtn.textContent = "Retour aux battles";
      document.querySelectorAll('input[name="difficulty"]').forEach((i) => {
        i.checked = i.value === battle.difficulty;
        i.disabled = true;
      });
      document.getElementById("rule-jokers").textContent =
        `🔍 ${battle.joker_limit} SOS Sécu`;
      rulesVersion = battle.timer_rules.version;
      document.getElementById("training-format-choice").hidden = true;
      document
        .querySelectorAll(".difficulty-toggle small")
        .forEach(
          (label, i) =>
            (label.textContent = PCBRules.timing(
              ["easy", "normal", "hardcore"][i],
              rulesVersion,
            )),
        );
      document.getElementById("rule-timer").textContent = PCBRules.timing(
        battle.difficulty,
        rulesVersion,
      );
    }
    if (gameFormat === "time_attack") {
      document.getElementById("training-format-choice").hidden = true;
      document.getElementById("classic-difficulty-choice").hidden = true;
      document.querySelector("#start-screen h1").textContent =
        "Le chrono a pris la main.";
      document.getElementById("format-description").textContent =
        PCBRules.configuration(gameDuration, gameParams.get("difficulty")) +
        " · +1 par bonne réponse · " +
        (gameParams.get("difficulty") === "hardcore"
          ? "erreurs : −1, −2, −3…"
          : "−1 par erreur");
      document.getElementById("rule-timer").textContent =
        gameDuration / 60 + " minutes globales";
      document.getElementById("rule-errors").textContent = "Erreurs illimitées";
      document.getElementById("rule-jokers").hidden = true;
      if (gameParams.get("autostart") === "1") await startGame();
    }
  } catch (e) {
    startError.textContent = e.message;
    startBtn.disabled = true;
  }
}

// --- Start Game ---
async function startGame() {
  initAudio();
  startError.textContent = "";
  startBtn.disabled = true;
  try {
    const player = await PCB.ready;
    if (!player) return;
    const serviceId = Number(playerServiceSelect.value);
    if (!serviceId) throw new Error("Choisissez votre équipe.");
    if (serviceId !== player.service_id) {
      await PCB.request("/api/teams/choose", {
        method: "POST",
        body: JSON.stringify({ teamId: serviceId }),
      });
      player.service_id = serviceId;
    }
    gameDifficulty =
      document.querySelector('input[name="difficulty"]:checked')?.value ||
      "easy";
    if (gameFormat === "time_attack")
      gameDifficulty =
        competition?.difficulty || gameParams.get("difficulty") || "normal";
    else
      gameFormat = gameParams.has("battle")
        ? "classic"
        : document.getElementById("training-format").value;
    if (gameFormat === "discovery") gameDifficulty = "easy";
    const battle = new URLSearchParams(location.search).get("battle");
    recoveryKey = `pcb-game-${player.id}-${gameFormat}-${gameDifficulty}-${gameFormat === "time_attack" ? gameDuration : ""}-${gameSetId ? "set-" + gameSetId : battle || ""}`;
    const saved = localStorage.getItem(recoveryKey);
    let data;
    if (saved) {
      try {
        data = await PCB.request(
          `/api/sessions/${encodeURIComponent(saved)}/state`,
        );
      } catch (e) {
        if (![404, 410].includes(e.status)) throw e;
        localStorage.removeItem(recoveryKey);
      }
    }
    if (!data)
      data = await PCB.request("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          difficulty: gameDifficulty,
          format: gameFormat,
          ...(gameFormat === "time_attack"
            ? {
                durationSeconds: gameDuration,
                ...(gameSetId ? { setId: gameSetId } : {}),
              }
            : {}),
          ...(battle ? { battleId: battle } : {}),
        }),
      });
    localStorage.setItem(recoveryKey, String(data.sessionId));
    if (gameFormat === "time_attack" && !battle)
      localStorage.setItem(
        "pcb-time-attack-last-" + player.id,
        JSON.stringify({
          duration: gameDuration,
          difficulty: gameDifficulty,
          setId: gameSetId ? Number(gameSetId) : null,
        }),
      );
    sessionId = data.sessionId;
    sessionToken = data.sessionToken;
    totalEmails = data.totalEmails;
    jokerLimit = data.jokerLimit;
    gameDifficulty = data.difficulty;
    playerId = player.id;
    playerName = player.display_name || player.name;
    applyCanonical(data);
    autoAnalyzesLeft = jokerLimit;
    safeEmailsFound = data.stats.safe_found;
    phishingEmailsFound = data.stats.phishing_found;
    totalDecisionTime = data.stats.decision_seconds;
    emailsSuccessfullyClassified = data.stats.answers;
    humanAnswers = data.stats.human_answers;
    currentTimerDuration = initialTimerDuration;
    gameActive = true;
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    feedbackModalEl.classList.remove("visible");
    gameUi.classList.remove("hidden");
    document.body.classList.add("playing");
    updateScoreDisplay();
    updateSecurityBar();
    updateAutoAnalyzeDisplay();
    updateExtendedStatsDisplay();
    classifySafeBtn.disabled = true;
    classifyPhishingBtn.disabled = true;
    if (data.completed) {
      await endGame(false, false, data);
      return;
    }
    await loadNextEmail();
  } catch (e) {
    startError.textContent = e.message || "Erreur de connexion.";
  } finally {
    startBtn.disabled = false;
  }
}

// --- Load next email from API ---
async function loadNextEmail() {
  if (!gameActive) return;
  currentEmailData = null;
  classifySafeBtn.disabled =
    classifyPhishingBtn.disabled =
    autoAnalyzeBtn.disabled =
      true;
  if (gameFormat !== "time_attack") clearInterval(timerInterval);

  try {
    const res = await fetch(`/api/sessions/${sessionId}/next-email`, {
      headers: { "X-Session-Token": sessionToken },
    });

    if (res.status === 410) {
      // All emails done (tilt) or game over from errors
      endGame(errors < maxErrors, false);
      return;
    }
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Impossible de charger l’email");
    }

    const data = await res.json();
    if (data.completed) {
      await endGame(false, false, data);
      return;
    }
    currentEmailData = data;
    applyCanonical(data);
    currentTimerDuration = Math.ceil(data.remainingMs / 1000);
    updateScoreDisplay();
    updateSecurityBar();
    updateAutoAnalyzeDisplay();
    document.getElementById("answer-error")?.remove();

    playSound("new_email");
    hideTooltip();

    emailSenderEl.textContent = data.sender;
    emailSenderEl.setAttribute(
      "data-real-sender",
      data.realSender || data.sender,
    );
    emailSubjectEl.textContent = data.subject;

    renderEmailBody(data.body);
    updateCurrentInbox();

    addInspectionListeners();
    resetTimer();
    startTimer();
    classifySafeBtn.disabled = false;
    classifyPhishingBtn.disabled = false;
  } catch (e) {
    document.getElementById("answer-error")?.remove();
    classifySafeBtn.disabled =
      classifyPhishingBtn.disabled =
      autoAnalyzeBtn.disabled =
        true;
    const box = document.createElement("div");
    box.id = "answer-error";
    box.className = "notice error";
    box.setAttribute("role", "alert");
    const text = document.createElement("p");
    text.textContent = e.message;
    box.appendChild(text);
    const retry = document.createElement("button");
    retry.className = "btn";
    retry.textContent = "Réessayer le chargement";
    retry.addEventListener("click", loadNextEmail);
    box.appendChild(retry);
    gameUi.appendChild(box);
  }
}

function toSafeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeUiText(value, fallback = "") {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, "").trim()
    : fallback;
}

function appendTextWithBreaks(container, text) {
  const chunks = String(text || "").split("\n");
  chunks.forEach((chunk, index) => {
    if (index > 0) {
      container.appendChild(document.createElement("br"));
    }
    if (chunk) {
      container.appendChild(document.createTextNode(chunk));
    }
  });
}

function stripTags(text) {
  return String(text || "").replace(/<[^>]*>/g, "");
}
function applyCanonical(data) {
  canonicalState = data;
  gameFormat = data.format || gameFormat;
  document.body.dataset.gameFormat = gameFormat;
  gameDuration = data.durationSeconds || gameDuration;
  rulesVersion = data.rulesVersion || rulesVersion;
  document.getElementById("game-format-label").textContent =
    gameFormat === "discovery"
      ? "Découverte · sans chrono, sans score"
      : gameFormat === "time_attack"
        ? "Contre-la-montre · " +
          PCBRules.configuration(data.durationSeconds, data.difficulty) +
          " · " +
          (data.battleId ? "Compétition" : data.setName || "Catalogue général")
        : gameParams.has("battle")
          ? "Classique · battle"
          : "Classique · entraînement";
  abandonBtn.textContent =
    gameFormat === "discovery" ? "Terminer la découverte" : "🏳️ Abandonner";
  score = data.score ?? 0;
  errors = data.errors;
  jokerLimit = data.jokerLimit;
  autoAnalyzesLeft = Math.max(0, jokerLimit - data.jokersUsed);
  if (data.remainingMs !== null && data.remainingMs !== undefined)
    emailDeadline = performance.now() + data.remainingMs;
  if (data.stats) {
    safeEmailsFound = data.stats.safe_found;
    phishingEmailsFound = data.stats.phishing_found;
    humanAnswers = data.stats.human_answers;
    emailsSuccessfullyClassified = data.stats.answers;
    totalDecisionTime = data.stats.decision_seconds;
  }
  autoAnalyzeBtn.hidden = gameFormat !== "classic";
  timerEl.closest(".panel-section").hidden = gameFormat === "discovery";
  securityBarEl.closest(".panel-section").hidden = gameFormat !== "classic";
  scoreEl.closest(".panel-section").hidden = gameFormat === "discovery";
  document.getElementById("timer-heading").textContent =
    gameFormat === "time_attack" ? "Temps global restant" : "Temps du mail";
  document.getElementById("game-progress").textContent =
    `${data.viewedEmails || 0} mails consultés · ${data.stats?.answers || 0} traités`;
  document.getElementById("game-accuracy").textContent =
    `${data.stats?.human_correct || 0} bonnes classifications · ${data.errors} erreurs`;
  updateScoreDisplay();
  updateSecurityBar();
  updateAutoAnalyzeDisplay();
  updateExtendedStatsDisplay();
}

function renderEmailBody(body) {
  emailBodyEl.replaceChildren();

  const source = typeof body === "string" ? body : "";
  const linkRegex = /<a\s+([^>]*?)>(.*?)<\/a>/gis;
  let lastIndex = 0;

  for (const match of source.matchAll(linkRegex)) {
    const start = match.index ?? 0;
    appendTextWithBreaks(
      emailBodyEl,
      stripTags(source.slice(lastIndex, start)),
    );

    const attrs = match[1] || "";
    const hrefMatch = /href=(['"])(.*?)\1/i.exec(attrs);
    const realLinkMatch = /data-real-link=(['"])(.*?)\1/i.exec(attrs);
    const link = document.createElement("span");
    link.className = "inspectable link";
    link.dataset.realLink = realLinkMatch?.[2] || hrefMatch?.[2] || "";
    link.textContent = stripTags(match[2]);
    emailBodyEl.appendChild(link);

    lastIndex = start + match[0].length;
  }

  appendTextWithBreaks(emailBodyEl, stripTags(source.slice(lastIndex)));
}

// --- Classify ---
async function classifyEmail(userChoice) {
  if (
    !gameActive ||
    !currentEmailData ||
    submittingAnswer ||
    feedbackModalEl.classList.contains("visible")
  )
    return;
  submittingAnswer = true;
  abandonBtn.disabled = true;
  classifySafeBtn.disabled = true;
  classifyPhishingBtn.disabled = true;
  if (gameFormat !== "time_attack") clearInterval(timerInterval);

  let decisionTime = currentTimerDuration - timeLeft;
  autoAnalyzeBtn.disabled = true;
  document.getElementById("answer-error")?.remove();

  try {
    const res = await fetch(`/api/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify({
        emailId: currentEmailData.emailId,
        choice: userChoice,
        decisionTime,
      }),
    });
    const data = await res.json();
    if (finishing || (!gameActive && canonicalState?.completed)) return;
    if (!res.ok) {
      throw new Error(data.error || "Impossible d’enregistrer cette réponse");
    }

    decisionTime = Number(data.decisionTime) || 0;
    // Update local state from server response (source of truth)
    score = toSafeInteger(data.score);
    errors = toSafeInteger(data.errors);
    autoAnalyzesLeft = Math.max(0, jokerLimit - toSafeInteger(data.jokersUsed));

    applyCanonical(data);
    if (data.timeUp) {
      await endGame(false, false, data);
      return;
    }
    playSound(data.isCorrect ? "correct" : "error");
    updateScoreDisplay();
    updateSecurityBar();
    updateAutoAnalyzeDisplay();
    updateExtendedStatsDisplay();

    // Store clues + type in currentEmailData for the feedback modal
    currentEmailData.clues = data.clues;
    currentEmailData.type = data.correctType;

    showFeedbackPopup(
      data.isCorrect,
      currentEmailData,
      data.isTimeout,
      userChoice === "joker",
    );
    autoAnalyzeBtn.disabled = true;

    if (data.completed) {
      gameActive = false;
      // Store achievements for display in endGame
      window._pendingAchievements = data.newAchievements || [];
    }
  } catch (e) {
    const box = document.createElement("div");
    box.id = "answer-error";
    box.className = "notice error";
    box.setAttribute("role", "alert");
    const msg = document.createElement("p");
    msg.textContent = e.message || "Impossible d’enregistrer la réponse.";
    box.appendChild(msg);
    const retry = document.createElement("button");
    retry.className = "btn";
    retry.textContent = "Réessayer cette réponse";
    retry.onclick = () => classifyEmail(userChoice);
    box.appendChild(retry);
    const reload = document.createElement("button");
    reload.className = "btn btn-secondary";
    reload.textContent = "Recharger la partie";
    reload.onclick = () => loadNextEmail();
    box.appendChild(reload);
    gameUi.appendChild(box);
  } finally {
    submittingAnswer = false;
    abandonBtn.disabled = false;
  }
}

// --- Auto-analyze (Joker) ---
function useAutoAnalyze() {
  if (autoAnalyzesLeft > 0 && gameActive && !autoAnalyzeBtn.disabled) {
    autoAnalyzeBtn.disabled = true;
    classifySafeBtn.disabled = true;
    classifyPhishingBtn.disabled = true;
    clearInterval(timerInterval);
    secuGuyContainer.classList.remove("hidden");
    secuGuyContainer.classList.add("visible");
    setTimeout(() => {
      classifyEmail("joker");
    }, 500);
  }
}

// --- Timer: projection of the server deadline, never a scoring clock. ---
function displayTimer() {
  if (gameFormat === "discovery") return;
  timeLeft = Math.max(0, Math.ceil((emailDeadline - performance.now()) / 1000));
  const text =
    gameFormat === "time_attack"
      ? Math.floor(timeLeft / 60) + ":" + String(timeLeft % 60).padStart(2, "0")
      : String(timeLeft);
  timerEl.textContent = text;
  timerEl.className = timeLeft <= 2 ? "danger" : timeLeft <= 5 ? "warning" : "";
  document.getElementById("feedback-clock").textContent =
    gameFormat === "time_attack"
      ? "Le chrono continue : " + text + " restant."
      : "";
}
function resetTimer() {
  clearInterval(timerInterval);
  displayTimer();
}
async function finishFromClock() {
  if (checkingExpiry || !gameActive || performance.now() < clockRetryAt) return;
  checkingExpiry = true;
  lastClockSync = performance.now();
  try {
    const data = await PCB.request("/api/sessions/" + sessionId + "/state");
    if (!gameActive) return;
    document.getElementById("clock-sync-error")?.remove();
    applyCanonical(data);
    if (data.completed) await endGame(false, false, data);
  } catch (error) {
    timerEl.textContent = "Synchronisation…";
    clockRetryAt = performance.now() + 3000;
    if (!document.getElementById("clock-sync-error")) {
      const message = document.createElement("p");
      message.id = "clock-sync-error";
      message.className = "notice error";
      message.setAttribute("role", "alert");
      message.textContent =
        error.status === 401
          ? "Connexion expirée. Reconnectez-vous pour retrouver le résultat enregistré."
          : "Synchronisation du résultat impossible. Une nouvelle tentative de connexion est en cours.";
      if (error.status === 401) {
        const link = document.createElement("a");
        link.href = "/login.html";
        link.textContent = " Se reconnecter";
        message.append(link);
        gameActive = false;
        clearInterval(timerInterval);
      }
      gameUi.append(message);
    }
  } finally {
    checkingExpiry = false;
  }
}
function startTimer() {
  clearInterval(timerInterval);
  if (!gameActive || gameFormat === "discovery") return;
  displayTimer();
  timerInterval = setInterval(() => {
    if (!gameActive) {
      clearInterval(timerInterval);
      return;
    }
    displayTimer();
    if (
      gameFormat === "time_attack" &&
      performance.now() - lastClockSync > 15000
    )
      finishFromClock();
    if (timeLeft <= 0) {
      if (gameFormat === "time_attack") finishFromClock();
      else {
        clearInterval(timerInterval);
        classifyEmail("timeout");
      }
    }
  }, 250);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && gameFormat === "time_attack" && gameActive)
    finishFromClock();
});

// --- Feedback Popup ---
function showFeedbackPopup(
  isCorrect,
  emailData,
  isTimeout = false,
  assisted = false,
) {
  feedbackTitleEl.textContent =
    assisted && !isTimeout
      ? "SOS Sécu : le collègue qui soupire."
      : isCorrect
        ? "Cette fois, ça passe."
        : "Incident confirmé.";
  feedbackTitleEl.style.color = isCorrect
    ? getCssVariableValue("--safe-color")
    : getCssVariableValue("--phishing-color");
  const verdict =
    emailData.type === "phishing"
      ? "C’était un phishing."
      : "C’était un email légitime.";
  feedbackExplanationEl.textContent =
    (isTimeout
      ? "Le temps est écoulé. "
      : assisted
        ? "Le SOS a fait le travail. " + autoAnalyzesLeft + " SOS restant(s). "
        : isCorrect
          ? "Bonne classification. "
          : "Mauvaise classification. ") + verdict;
  PCBFeedback.render(feedbackCluesEl, emailData.clues);
  feedbackModalEl.classList.toggle("has-assistant", assisted && !isTimeout);
  if (isTimeout) {
    secuGuyContainer.classList.remove("visible");
    secuGuyContainer.classList.add("hidden");
  }
  gameUi.inert = true;
  document.querySelector(".account-nav").inert = true;
  feedbackModalEl.classList.add("visible");
  feedbackContinueBtn.focus();
}
feedbackContinueBtn.addEventListener("click", () => {
  feedbackModalEl.classList.remove("visible");
  secuGuyContainer.classList.remove("visible");
  secuGuyContainer.classList.add("hidden");
  gameUi.inert = false;
  document.querySelector(".account-nav").inert = false;
  playSound("click");
  if (!gameActive) {
    endGame(errors < maxErrors, false);
    return;
  }
  autoAnalyzeBtn.disabled = autoAnalyzesLeft <= 0;
  loadNextEmail().then(() => {
    if (gameActive) classifySafeBtn.focus();
  });
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector(".portal-confirm")) return;
  if (!feedbackModalEl.classList.contains("visible")) return;
  if (e.key === "Enter" && !e.target.closest("summary")) {
    e.preventDefault();
    feedbackContinueBtn.click();
  }
  if (e.key === "Tab") {
    const controls = [
      ...feedbackModalEl.querySelectorAll("summary,button:not(:disabled)"),
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
document
  .getElementById("window-close")
  .addEventListener("click", () => abandonBtn.click());
document.getElementById("window-expand").addEventListener("click", (e) => {
  const expanded = document
    .getElementById("game-container")
    .classList.toggle("window-expanded");
  e.currentTarget.setAttribute("aria-pressed", String(expanded));
  e.currentTarget.setAttribute(
    "aria-label",
    expanded ? "Restaurer la fenêtre" : "Agrandir la fenêtre",
  );
});

// --- Display helpers ---
function updateScoreDisplay() {
  scoreEl.textContent =
    gameFormat === "time_attack" ? PCBRules.signed(score) : score;
}
function updateExtendedStatsDisplay() {
  if (safeMailsFoundEl) safeMailsFoundEl.textContent = safeEmailsFound;
  if (phishingMailsFoundEl)
    phishingMailsFoundEl.textContent = phishingEmailsFound;
  if (avgDecisionTimeEl) {
    if (humanAnswers > 0) {
      avgDecisionTimeEl.textContent =
        (totalDecisionTime / humanAnswers).toFixed(1) + "s";
    } else {
      avgDecisionTimeEl.textContent = "N/A";
    }
  }
}
function getCssVariableValue(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v);
}
function updateSecurityBar() {
  const pct = Math.max(0, ((maxErrors - errors) / maxErrors) * 100);
  securityBarEl.style.width = `${pct}%`;
  errorsLeftEl.textContent = `${maxErrors - errors}`;
  if (pct <= 25)
    securityBarEl.style.backgroundColor =
      getCssVariableValue("--phishing-color");
  else if (pct <= 50)
    securityBarEl.style.backgroundColor =
      getCssVariableValue("--warning-color");
  else
    securityBarEl.style.backgroundColor = getCssVariableValue("--safe-color");
}
function updateAutoAnalyzeDisplay() {
  autoAnalyzesLeftEl.textContent = autoAnalyzesLeft;
  autoAnalyzeBtn.disabled = autoAnalyzesLeft <= 0;
}

// --- Inspection Tooltips ---
function addInspectionListeners() {
  function createDynamicTooltip(e, text, type = "") {
    const safeLeft = Math.max(0, toSafeInteger(e.clientX));
    const safeTop = Math.max(0, toSafeInteger(e.clientY));
    const safeType = type === "danger" || type === "warning" ? type : "";

    cursorTooltipEl.className = safeType
      ? `tooltip-element ${safeType}`
      : "tooltip-element";
    cursorTooltipEl.textContent = sanitizeUiText(text);
    cursorTooltipEl.style.left = `${safeLeft}px`;
    cursorTooltipEl.style.top = `${safeTop}px`;
    cursorTooltipEl.classList.remove("hidden");
    return cursorTooltipEl;
  }
  function track(e, tip) {
    if (tip) {
      tip.style.left = `${Math.max(0, toSafeInteger(e.clientX))}px`;
      tip.style.top = `${Math.max(0, toSafeInteger(e.clientY))}px`;
    }
  }

  let senderTip = null;
  emailSenderEl.onmouseover = (e) => {
    const disp = sanitizeUiText(currentEmailData.sender);
    const real = sanitizeUiText(emailSenderEl.getAttribute("data-real-sender"));
    senderTip = createDynamicTooltip(
      e,
      real && real !== disp
        ? `🎭 Email affiché: ${disp}\n⚠️ Adresse réelle: ${real}`
        : `Expéditeur: ${disp}`,
      real && real !== disp ? "danger" : "",
    );
    emailSenderEl.onmousemove = (e) => track(e, senderTip);
  };
  emailSenderEl.onmouseout = () => {
    if (senderTip) {
      hideTooltip();
      senderTip = null;
    }
    emailSenderEl.onmousemove = null;
  };

  emailBodyEl.querySelectorAll(".inspectable.link").forEach((link) => {
    const realLink = link.dataset.realLink;
    let linkTip = null;
    link.onmouseover = (e) => {
      let type = "";
      try {
        const url = new URL(
          realLink.startsWith("http") ? realLink : "http://" + realLink,
        );
        const senderMatch = currentEmailData.sender.match(/@([^>]+)/);
        const senderDomain = senderMatch ? senderMatch[1] : null;
        if (
          senderDomain &&
          !url.hostname.endsWith(senderDomain) &&
          !isKnownGoodDomain(url.hostname)
        )
          type = "warning";
      } catch {
        type = "danger";
      }
      linkTip = createDynamicTooltip(e, `Lien cible : ${realLink}`, type);
      link.onmousemove = (e) => track(e, linkTip);
    };
    link.onmouseout = () => {
      if (linkTip) {
        hideTooltip();
        linkTip = null;
      }
      link.onmousemove = null;
    };
    link.onclick = (e) => e.preventDefault();
  });
}

function isKnownGoodDomain(hostname) {
  const good = [
    "showroomprive.net",
    "banquefictive-enligne.com",
    "cloud-provider-invoices.com",
    "linkedin.com",
    "meteofrance.fr",
    "vinted.fr",
    "impots.gouv.fr",
    "chronopost.fr",
    "ameli.fr",
    "doctolib.fr",
  ];
  return good.some((d) => hostname === d || hostname.endsWith("." + d));
}

function updateTooltipPosition(e) {
  if (cursorTooltipEl.classList.contains("hidden")) return;
  cursorTooltipEl.style.left = e.clientX + "px";
  cursorTooltipEl.style.top = e.clientY + "px";
}
function hideTooltip() {
  cursorTooltipEl.classList.add("hidden");
  document.removeEventListener("mousemove", updateTooltipPosition);
}

// --- Ranks ---
const RANKS = [
  {
    emoji: "🥇",
    title: "Chuck Norris de la cybersécurité",
    desc: "Il a patché le temps et redémarré l’univers sans interruption. N’a pas rempli le ticket de changement. Travail bâclé.",
    appreciation: "Super méga giga ultra top excellent",
  },
  {
    emoji: "🥈",
    title: "Batman, version cybersécurité",
    desc: "BatSIEM, BatSOC, BatEDR, bunker sécurisé et douze écrans. Tout ça pour découvrir que l’attaque venait de Gérard et de son faux colis Chronopost.",
    appreciation: "Épique en toute circonstance",
  },
  {
    emoji: "🥉",
    title: "Ethan Hunt",
    desc: "Il repère le phishing avant même que le mail arrive. Il décide de faire exploser l’entreprise pour la protéger.",
    appreciation: "Héroïque mais humble",
  },
  {
    emoji: "🧠",
    title: "Mr Robot",
    desc: "Il a copié toutes les données de l’entreprise sur un disque chiffré. Puis il a laissé le disque sur son bureau avec une étiquette « CONFIDENTIEL ».",
    appreciation: "Stylé comme un terminal noir",
  },
  {
    emoji: "🧞‍♂️",
    title: "Tony Stark",
    desc: "Trois millions d’euros d’IA, de SOC et d’automatisation. Le mot de passe du Wi-Fi invité est toujours « Bienvenue2026 ».",
    appreciation: "Solide comme une VM qui redémarre pas",
  },
  {
    emoji: "🕶️",
    title: "Neo",
    desc: "Il voit les paquets réseau défiler dans la Matrice. Il a quand même validé la notification MFA parce qu’il en avait marre qu’elle revienne.",
    appreciation: "Respectable (même en chaussettes)",
  },
  {
    emoji: "💼",
    title: "Fox Mulder",
    desc: "Il soupçonne la NSA, les Russes et les extraterrestres. Mais la vérité est ailleurs...",
    appreciation: "Pas mal du tout, vraiment",
  },
  {
    emoji: "👓",
    title: "Q, de James Bond",
    desc: "Montre laser, voiture invisible, stylo explosif. Pour réinitialiser ton mot de passe, en revanche, il faut créer un ticket et attendre 48 heures.",
    appreciation: "Prometteur à condition d'éviter les cafés renversés",
  },
  {
    emoji: "🎮",
    title: "Lara Croft, archéologue du SI",
    desc: "Elle explore des serveurs oubliés depuis 1998. Le vestige le plus ancien reste le mot de passe de production.",
    appreciation: "On sent le potentiel",
  },
  {
    emoji: "🍕",
    title: "Peter Parker, stagiaire cyber",
    desc: "Un grand pouvoir implique de grandes responsabilités. Il a donc demandé les droits administrateur « au cas où ».",
    appreciation: "Correct mais cliquouille",
  },
  {
    emoji: "🛸",
    title: "Rick Sanchez",
    desc: "Il a automatisé toute la sécurité de l’entreprise. Maintenant, le seul moyen de comprendre comment ça marche serait de remonter dans le temps et de l’empêcher de le faire.",
    appreciation: "Peut mieux faire",
  },
  {
    emoji: "📼",
    title: "MacGyver",
    desc: "Un trombone, deux scripts récupérés sur Internet et une tâche planifiée que personne n’ose supprimer. Le système tient depuis six ans.",
    appreciation: "Un peu mieux que rien",
  },
  {
    emoji: "🧓",
    title: "Obi-Wan Kenobi, en fin d’astreinte",
    desc: "« Ce n’est pas le mail que vous recherchez. »\nDommage, il avait déjà cliqué sur la pièce jointe.",
    appreciation: "Mouais… bof",
  },
  {
    emoji: "💩",
    title: "Jar Jar Binks",
    desc: "Il voulait juste aider. Trois clics plus tard, toute l’entreprise participe à l’incident.",
    appreciation: "Pas fameux",
  },
  {
    emoji: "🕵️",
    title: "Inspecteur Gadget",
    desc: "Il possède douze outils de sécurité. Mais il a oublié de dire : « Go Go Gadget sécurité ! »",
    appreciation: "Assez pathétique",
  },
  {
    emoji: "🧃",
    title: "Le stagiaire promu par erreur",
    desc: "On lui a demandé d’ouvrir un port. Il a ouvert la fenêtre. C’était sa meilleure décision de la journée.",
    appreciation: "Affligeant mais divertissant",
  },
  {
    emoji: "🚽",
    title: "Ron Weasley, sans Hermione",
    desc: "Face à un mail suspect, il a paniqué, cliqué partout et appelé quelqu’un de plus compétent. Dans cet ordre.",
    appreciation: "Presque gênant",
  },
  {
    emoji: "🐌",
    title: "Bob l’Éponge",
    desc: "Il a saisi son mot de passe sur un site qui ressemblait vaguement à Microsoft. Bon, on passe l’éponge pour cette fois.",
    appreciation: "Pathétique tout court",
  },
  {
    emoji: "🥴",
    title: "Homer Simpson, RSSI par accident",
    desc: "Il clique sur tout ce qui bouge. Heureusement, il bouge assez peu.",
    appreciation: "Très pathétique",
  },
];

function getRankDetails(finalScore) {
  let idx;
  if (finalScore === 0) idx = RANKS.length - 1;
  else if (finalScore === 1) idx = RANKS.length - 2;
  else if (finalScore === 2) idx = RANKS.length - 3;
  else if (finalScore <= 4) idx = RANKS.length - 4;
  else if (finalScore >= 150) idx = 0;
  else if (finalScore >= 120) idx = 1;
  else if (finalScore >= 100) idx = 2;
  else if (finalScore >= 80) idx = 3;
  else if (finalScore >= 65) idx = 4;
  else if (finalScore >= 50) idx = 5;
  else if (finalScore >= 40) idx = 6;
  else if (finalScore >= 32) idx = 7;
  else if (finalScore >= 25) idx = 8;
  else if (finalScore >= 20) idx = 9;
  else if (finalScore >= 16) idx = 10;
  else if (finalScore >= 13) idx = 11;
  else if (finalScore >= 10) idx = 12;
  else if (finalScore >= 8) idx = 13;
  else if (finalScore >= 6) idx = 14;
  else if (finalScore >= 5) idx = RANKS.length - 4;
  else idx = RANKS.length - 4;
  return { index: idx, rank: RANKS[idx] };
}

// Eight faces form a cylinder. Only the earned rank and its neighbours remain
// visible after the spin; the ends of the scale never wrap into a false neighbour.
let rankReelController = null;
function renderRankReel(index) {
  rankReelController?.destroy();
  const viewport = document.getElementById("rank-cylinder-fixed");
  const rotor = viewport.querySelector(".rank-reel-rotor");
  const replay = document.getElementById("rank-replay-btn");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const offsets = [0, -1, -2, -3, -4, 3, 2, 1];
  rotor.replaceChildren();
  const faces = offsets.map((offset, slot) => {
    const rankIndex = index + offset;
    const rank = RANKS[(rankIndex + RANKS.length) % RANKS.length];
    const neighbour =
      Math.abs(offset) <= 1 && rankIndex >= 0 && rankIndex < RANKS.length;
    const face = document.createElement("div");
    face.className = `rank-panel ${offset === 0 ? "current-rank" : offset === -1 ? "previous-rank" : offset === 1 ? "next-rank" : "extra-rank"}`;
    face.classList.toggle("rank-in-view", neighbour);
    face.setAttribute("aria-hidden", String(!neighbour));
    face.style.setProperty("--face-angle", `${slot * 45}deg`);
    const context = !neighbour
      ? "Échelle des rangs"
      : offset === 0
        ? "Votre rang"
        : offset < 0
          ? "Niveau supérieur"
          : "Niveau inférieur";
    face.innerHTML = `<div class="rank-face-content"><p class="rank-context">${context}</p><div class="rank-panel-header"><span class="rank-emoji">${rank.emoji}</span><span class="rank-title">${rank.title}</span></div><p class="rank-description">${rank.desc}</p></div>`;
    rotor.appendChild(face);
    return face;
  });
  document.getElementById("rank-position").textContent =
    `Niveau ${RANKS.length - index} sur ${RANKS.length}`;
  let animation = null;
  let radius = 0;
  let lastWidth = 0;
  const settle = () => {
    if (animation) animation.onfinish = null;
    animation?.cancel();
    animation = null;
    viewport.classList.remove("is-spinning");
  };
  const size = () => {
    if (!viewport.clientWidth || viewport.clientWidth === lastWidth) return;
    lastWidth = viewport.clientWidth;
    settle();
    // Measure untransformed content, including wrapped titles and descriptions.
    // Reserving the cylinder's full height keeps it away from the score and badges.
    const height = Math.ceil(
      Math.max(
        130,
        ...faces.map(
          (face) => face.querySelector(".rank-face-content").offsetHeight + 32,
        ),
      ),
    );
    radius = height / (2 * Math.tan(Math.PI / 8));
    viewport.style.setProperty("--rank-face-height", `${height}px`);
    viewport.style.setProperty("--rank-radius", `${radius}px`);
  };
  const spin = () => {
    settle();
    size();
    if (reducedMotion.matches || !radius) return;
    viewport.classList.add("is-spinning");
    const from = index === RANKS.length - 1 ? -765 : -675;
    animation = rotor.animate(
      [
        { transform: `translateZ(${-radius}px) rotateX(${from}deg)` },
        { transform: `translateZ(${-radius}px) rotateX(0deg)` },
      ],
      { duration: 1800, easing: "cubic-bezier(0.12, 0.7, 0.12, 1)" },
    );
    animation.onfinish = settle;
  };
  const motionChanged = () => {
    replay.hidden = reducedMotion.matches;
    if (reducedMotion.matches) settle();
  };
  const observer = new ResizeObserver(size);
  observer.observe(viewport);
  replay.addEventListener("click", spin);
  reducedMotion.addEventListener("change", motionChanged);
  motionChanged();
  const frame = requestAnimationFrame(spin);
  rankReelController = {
    destroy() {
      cancelAnimationFrame(frame);
      settle();
      observer.disconnect();
      replay.removeEventListener("click", spin);
      reducedMotion.removeEventListener("change", motionChanged);
    },
  };
}

// --- Results use the persisted state, including expiry during a correction. ---
let finishing = false;
async function endGame(won, abandoned = false, ending = null) {
  if (finishing) return;
  finishing = true;
  gameActive = false;
  clearInterval(timerInterval);
  try {
    const result = ending?.completed
      ? ending
      : await PCB.request(
          "/api/sessions/" + sessionId + (abandoned ? "/end" : "/state"),
          abandoned
            ? { method: "POST", headers: { "X-Session-Token": sessionToken } }
            : {},
        );
    if (!result.completed) {
      gameActive = true;
      applyCanonical(result);
      startTimer();
      return;
    }
    applyCanonical(result);
    feedbackModalEl.classList.remove("visible");
    gameUi.inert = false;
    document.querySelector(".account-nav").inert = false;
    hideTooltip();
    gameUi.classList.add("hidden");
    document.body.classList.remove("playing");
    document
      .getElementById("game-container")
      .classList.remove("window-expanded");
    document
      .getElementById("window-expand")
      .setAttribute("aria-pressed", "false");
    gameOverScreen.classList.remove("hidden");
    gameOverScreen.scrollTop = 0;
    rankReelController?.destroy();
    document.getElementById("rank-display").hidden = gameFormat !== "classic";
    const reason =
      {
        abandoned: "PARTIE ABANDONNÉE",
        time_up: "TEMPS ÉCOULÉ",
        all_emails: "TOUS LES MAILS TRAITÉS",
        errors: "MISSION ÉCHOUÉE",
        battle_closed: "BATTLE CLÔTURÉE",
      }[result.finishReason] || "PARTIE TERMINÉE";
    gameOverTitleEl.textContent =
      gameFormat === "discovery" ? "DÉCOUVERTE TERMINÉE" : reason;
    gameOverTitleEl.style.color =
      result.finishReason === "errors"
        ? "var(--phishing-color)"
        : "var(--accent-color)";
    gameOverMessageEl.textContent =
      gameFormat === "discovery"
        ? "Vous avez pris le temps de lire. La prochaine pièce jointe n’en sera pas moins sournoise."
        : result.finishReason === "time_up"
          ? "Le chrono est terminé. Il n’accepte pas les demandes de prolongation."
          : result.finishReason === "abandoned"
            ? "Tentative conservée dans votre historique, exclue des nouveaux classements."
            : "Le rapport est enregistré. Les excuses peuvent attendre.";
    if (gameFormat === "classic") {
      const { index, rank } = getRankDetails(score);
      finalScoreEl.innerHTML =
        '<span class="score-diploma">Vous avez atteint le score <strong>' +
        rank.appreciation +
        "</strong> de " +
        score +
        " (" +
        result.stats.answers +
        " emails traités)</span>";
      renderRankReel(index);
    } else {
      finalScoreEl.replaceChildren();
      const summary = document.createElement("strong");
      summary.textContent =
        gameFormat === "time_attack"
          ? "Score : " + PCBRules.signed(result.score)
          : result.viewedEmails + " mails consultés";
      const details = document.createElement("p");
      details.textContent =
        result.stats.human_correct +
        " bonnes classifications · " +
        result.errors +
        " erreurs · " +
        result.stats.answers +
        " mails traités";
      finalScoreEl.append(summary, details);
    }
    document.getElementById("game-mode-message").textContent =
      gameFormat === "time_attack"
        ? PCBRules.configuration(result.durationSeconds, result.difficulty) +
          " · " +
          (result.battleId
            ? "Compétition"
            : result.setName || "Catalogue général")
        : gameFormat === "discovery"
          ? "Sans chrono, sans score, sans classement"
          : PCBRules.timing(result.difficulty, result.timerRules.version);
    const ranking = document.getElementById("result-scores-link");
    ranking.hidden = gameFormat === "discovery";
    ranking.href = result.battleId
      ? "/battles.html?results=" + result.battleId
      : gameFormat === "time_attack"
        ? "/scores.html?" +
          new URLSearchParams({
            format: "time_attack",
            duration: result.durationSeconds,
            difficulty: result.difficulty,
            ...(result.setId ? { setId: result.setId } : {}),
          })
        : "/scores.html";
    ranking.textContent = result.battleId
      ? "Classement de la compétition"
      : "Classements";
    renderNewBadges(
      gameFormat === "classic"
        ? [
            ...(window._pendingAchievements || []),
            ...(result.newAchievements || []),
          ]
        : [],
    );
    window._pendingAchievements = [];
    restartBtn.disabled = false;
  } catch (error) {
    gameActive = true;
    const box = document.createElement("p");
    box.className = "notice error";
    box.textContent =
      error.message + " Réessayez pour récupérer le résultat serveur.";
    const retry = document.createElement("button");
    retry.className = "btn";
    retry.textContent = "Récupérer le résultat";
    retry.onclick = () => {
      box.remove();
      retry.remove();
      endGame(won, abandoned);
    };
    gameUi.append(box, retry);
    if (gameFormat === "time_attack") startTimer();
  } finally {
    finishing = false;
  }
}

function renderNewBadges(badges) {
  document.getElementById("new-badges-popup")?.remove();
  const recap = document.getElementById("recap-link");
  recap.hidden = !sessionId;
  recap.href = "/recap.html?id=" + sessionId;
  document.getElementById("result-profile-link").href =
    "/profile.html?id=" + playerId;
  if (!badges?.length) return;
  const container = document.createElement("div");
  container.id = "new-badges-popup";
  const title = document.createElement("div");
  title.className = "badges-popup-title";
  title.textContent = "🏆 Nouveaux badges débloqués !";
  const list = document.createElement("div");
  list.className = "badges-popup-list";
  badges.forEach((b) => {
    const item = document.createElement("div");
    item.className = "badge-item";
    for (const [className, text] of [
      ["badge-emoji", b.emoji],
      ["badge-name", b.name],
      ["badge-desc", b.description],
    ]) {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = text;
      item.appendChild(span);
    }
    list.appendChild(item);
  });
  container.append(title, list);
  gameOverScreen.appendChild(container);
  requestAnimationFrame(() => container.classList.add("visible"));
}

// --- Event Listeners ---
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  rankReelController?.destroy();
  rankReelController = null;
  if (recoveryKey) localStorage.removeItem(recoveryKey);
  canonicalState = null;
  if (gameFormat === "time_attack") {
    location.assign("/time-attack.html");
    return;
  }
  if (new URLSearchParams(location.search).has("battle")) {
    location.assign("/battles.html");
    return;
  }
  gameOverScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  // Reset UI
  score = 0;
  errors = 0;
  autoAnalyzesLeft = 3;
  updateScoreDisplay();
  updateSecurityBar();
  updateAutoAnalyzeDisplay();
});
classifySafeBtn.addEventListener("click", () => classifyEmail("safe"));
classifyPhishingBtn.addEventListener("click", () => classifyEmail("phishing"));
autoAnalyzeBtn.addEventListener("click", useAutoAnalyze);
abandonBtn.addEventListener("click", async () => {
  if (!gameActive) return;
  if (
    await PCB.confirm(
      gameFormat === "discovery"
        ? "Quitter la découverte ? Vos réponses restent dans le récapitulatif."
        : "Abandonner la partie ? La tentative sera conservée, mais exclue des nouveaux classements.",
    )
  ) {
    endGame(false, true);
  }
});

// Auto-uppercase for name input
playerNameInput.addEventListener("input", () => {
  const pos = playerNameInput.selectionStart;
  playerNameInput.value = playerNameInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  playerNameInput.setSelectionRange(pos, pos);
});

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  hideTooltip();
  loadServices();
  initTheme();
  localStorage.removeItem("pcb-name");
  localStorage.removeItem("pcb-email");
  localStorage.removeItem("pcb-service");

  function updatePreparation() {
    if (gameParams.has("battle") || gameParams.get("format") === "time_attack")
      return;
    const discovery =
      document.getElementById("training-format").value === "discovery";
    document.getElementById("classic-difficulty-choice").hidden = discovery;
    document.getElementById("rule-timer").textContent = discovery
      ? "Sans chrono"
      : PCBRules.timing(
          document.querySelector('input[name="difficulty"]:checked').value,
        );
    document.getElementById("rule-errors").textContent = discovery
      ? "Erreurs illimitées"
      : "3 erreurs maximum";
    document.getElementById("rule-jokers").hidden = discovery;
    document.getElementById("format-description").textContent = discovery
      ? "Lire, inspecter, répondre. Aucun point, aucun classement."
      : "Une bonne classification humaine réduit le temps de 2 s en Normal et Difficile. Les mails longs ajoutent 10 ou 20 s.";
  }
  document
    .getElementById("training-format")
    .addEventListener("change", updatePreparation);
  document
    .querySelectorAll('input[name="difficulty"]')
    .forEach((input) => input.addEventListener("change", updatePreparation));
  updatePreparation();
});

// --- Theme Management ---
function initTheme() {
  const savedTheme =
    localStorage.getItem("pcb-theme") === "classic" ? "classic" : "outlook";
  applyTheme(savedTheme);
  const select = document.getElementById("theme-select");
  select.value = savedTheme;
  select.addEventListener("change", () => {
    applyTheme(select.value);
    localStorage.setItem("pcb-theme", select.value);
  });
}
function applyTheme(theme) {
  document.getElementById("mail-window-title").textContent =
    theme === "outlook"
      ? "Outlook · Boîte de réception"
      : "Messagerie · Boîte de réception";
  document.body.classList.remove("theme-outlook");
  const existing = document.getElementById("theme-css");
  if (existing) existing.remove();
  const existingSidebar = document.getElementById("outlook-sidebar");
  if (existingSidebar) existingSidebar.remove();

  if (theme === "outlook") {
    document.body.classList.add("theme-outlook");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = "theme-css";
    link.href = "theme-outlook.css";
    document.head.insertBefore(
      link,
      document.querySelector('link[href="portal.css"]'),
    );
    injectOutlookSidebar();
    updateCurrentInbox();
  }
}

function injectOutlookSidebar() {
  const gameUi = document.getElementById("game-ui");
  if (!gameUi || document.getElementById("outlook-sidebar")) return;

  const sidebar = document.createElement("div");
  sidebar.id = "outlook-sidebar";
  sidebar.className = "outlook-sidebar";
  sidebar.innerHTML = `
        <div class="sidebar-header">📥 Boîte de réception</div>
        <input class="sidebar-search" type="text" placeholder="🔍 Rechercher dans les mails..." disabled>
        ${FAKE_INBOX_EMAILS.map(
          (e, i) => `
            <div class="fake-email${i < 4 ? " unread" : ""}">
                <span class="fe-sender">${e.sender}</span>
                <span class="fe-time">${e.time}</span>
                <div class="fe-subject">${e.subject}</div>
                <div class="fe-preview">${e.preview}</div>
            </div>
        `,
        ).join("")}
    `;
  const current = document.createElement("div");
  current.id = "current-inbox-mail";
  current.className = "fake-email current-mail";
  current.setAttribute("aria-current", "true");
  for (const [id, className] of [
    ["inbox-sender", "fe-sender"],
    ["inbox-subject", "fe-subject"],
    ["inbox-preview", "fe-preview"],
  ]) {
    const span = document.createElement("div");
    span.id = id;
    span.className = className;
    current.appendChild(span);
  }
  sidebar.querySelector(".sidebar-search").after(current);
  gameUi.insertBefore(sidebar, gameUi.firstChild);
}

function updateCurrentInbox() {
  if (!currentEmailData || !document.getElementById("inbox-sender")) return;
  document.getElementById("inbox-sender").textContent = currentEmailData.sender;
  document.getElementById("inbox-subject").textContent =
    currentEmailData.subject;
  document.getElementById("inbox-preview").textContent = emailBodyEl.textContent
    .trim()
    .replace(/\s+/g, " ");
}
const FAKE_INBOX_EMAILS = [
  {
    sender: "Jean-Michel D.",
    subject: "RE:RE:RE:RE: La machine à café",
    preview: "Bon sérieusement qui a changé les dosettes...",
    time: "9:42",
  },
  {
    sender: "RH - Sophie",
    subject: "URGENT: Entretien annuel à reprogrammer",
    preview: "Suite à votre absence non justifiée du...",
    time: "9:38",
  },
  {
    sender: "Amazon.fr",
    subject: "Votre commande de 3 coques de téléphone",
    preview: "Votre colis sera livré demain entre...",
    time: "9:15",
  },
  {
    sender: "Direction Générale",
    subject: "RE: Résultats trimestriels catastrophiques",
    preview: "Merci de préparer un plan d'action pour...",
    time: "8:55",
  },
  {
    sender: "Parking Entreprise",
    subject: "Infraction stationnement - 3e avertissement",
    preview: "Votre véhicule a de nouveau été garé sur...",
    time: "8:47",
  },
  {
    sender: "Collègue Anonyme",
    subject: "FW: blague du jour 😂😂😂",
    preview: "MDR trop drôle regarde ça !!! C'est toi le...",
    time: "8:30",
  },
  {
    sender: "Formation",
    subject: "Rappel: Excel niveau 1 (obligatoire)",
    preview: "Nous vous rappelons que vous n'avez toujours...",
    time: "Hier",
  },
  {
    sender: "IT Support",
    subject: "RE: Mon PC fait un bruit bizarre",
    preview: "Avez-vous essayé de l'éteindre et de le...",
    time: "Hier",
  },
  {
    sender: "Cantine",
    subject: "Menu semaine: Poisson pané vendredi",
    preview: "Cette semaine au menu : lundi tagliatelles...",
    time: "Hier",
  },
  {
    sender: "Dupont Bernard",
    subject: "RE: Qui a mangé mon yaourt ???",
    preview: "C'est la TROISIÈME fois ce mois-ci. Je vais...",
    time: "Hier",
  },
  {
    sender: "Netflix",
    subject: "Continuez à regarder: The Office S4E12",
    preview: "Vous n'avez pas terminé votre épisode...",
    time: "Mar",
  },
  {
    sender: "Manager",
    subject: "Ton rapport est où ?",
    preview: "Je t'avais demandé ça pour lundi. On est...",
    time: "Mar",
  },
  {
    sender: "Tinder",
    subject: "💕 3 nouveaux likes !",
    preview: "Quelqu'un vous a liké ! Ouvrez l'app pour...",
    time: "Mar",
  },
  {
    sender: "Compta - Marie",
    subject: "Note de frais rejetée (3e fois)",
    preview: "Non, un kebab à 14€ n'est pas un \"déjeuner...",
    time: "Lun",
  },
  {
    sender: "Imprimante 2e étage",
    subject: "Toner épuisé - File d'attente: 47 docs",
    preview: 'Votre impression "CV_perso_v12_final_FINAL" est...',
    time: "Lun",
  },
  {
    sender: "LinkedIn",
    subject: "Jean-Michel a validé vos compétences",
    preview: 'Jean-Michel vous recommande en "Expert Excel"...',
    time: "Lun",
  },
  {
    sender: "Sécurité",
    subject: "Votre badge a été utilisé à 3h du matin",
    preview: "Une utilisation inhabituelle de votre badge...",
    time: "Dim",
  },
  {
    sender: "Leboncoin",
    subject: 'Nouvelle offre: Chaise bureau "empruntée"',
    preview: "Chaise ergonomique, légèrement utilisée...",
    time: "Sam",
  },
];
