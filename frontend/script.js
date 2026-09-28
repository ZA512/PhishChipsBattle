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

// Timer durations
const initialTimerDuration = 30;
const normalModeMinTime = 15;
const hardcoreModeMinTime = 5;
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
      opt.textContent = `${svc.name} (${svc.code})`;
      playerServiceSelect.appendChild(opt);
    });
    playerServiceSelect.value = String(player.service_id || "");
    const battleId = new URLSearchParams(location.search).get("battle");
    if (battleId) {
      const battle = (await PCB.request("/api/battles")).battles.find(
        (b) => String(b.id) === battleId,
      );
      if (!battle || !battle.participating)
        throw new Error("Vous ne participez pas à cette battle.");
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
      document.getElementById("rule-timer").textContent = {
        easy: "⏱ 30s fixes",
        normal: "⏱ 30s → 15s",
        hardcore: "⏱ 30s → 5s",
      }[battle.difficulty];
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
    const battle = new URLSearchParams(location.search).get("battle");
    const data = await PCB.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        difficulty: gameDifficulty,
        ...(battle ? { battleId: battle } : {}),
      }),
    });
    sessionId = data.sessionId;
    sessionToken = data.sessionToken;
    totalEmails = data.totalEmails;
    jokerLimit = data.jokerLimit;
    gameDifficulty = data.difficulty;
    playerId = player.id;
    playerName = player.display_name || player.name;
    score = 0;
    errors = 0;
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
    updateScoreDisplay();
    updateSecurityBar();
    updateAutoAnalyzeDisplay();
    updateExtendedStatsDisplay();
    classifySafeBtn.disabled = true;
    classifyPhishingBtn.disabled = true;
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
  clearInterval(timerInterval);

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
    currentEmailData = data;
    score = data.score;
    errors = data.errors;
    jokerLimit = data.jokerLimit;
    autoAnalyzesLeft = Math.max(0, jokerLimit - data.jokersUsed);
    emailDeadline = performance.now() + data.remainingMs;
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

function renderEmailBody(body) {
  emailBodyEl.replaceChildren();

  const source = typeof body === "string" ? body : "";
  const linkRegex = /<a\s+([^>]*?)>(.*?)<\/a>/gis;
  let lastIndex = 0;

  for (const match of source.matchAll(linkRegex)) {
    const start = match.index ?? 0;
    appendTextWithBreaks(emailBodyEl, source.slice(lastIndex, start));

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

  appendTextWithBreaks(emailBodyEl, source.slice(lastIndex));
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
  clearInterval(timerInterval);

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
    if (!res.ok) {
      throw new Error(data.error || "Impossible d’enregistrer cette réponse");
    }

    decisionTime = Number(data.decisionTime) || 0;
    // Update local state from server response (source of truth)
    score = toSafeInteger(data.score);
    errors = toSafeInteger(data.errors);
    autoAnalyzesLeft = Math.max(0, jokerLimit - toSafeInteger(data.jokersUsed));

    // Stats
    emailsSuccessfullyClassified++;
    if (userChoice !== "joker" || data.isTimeout) {
      totalDecisionTime += decisionTime;
      humanAnswers++;
    }
    if (userChoice !== "joker" && data.correctType === "safe" && data.isCorrect)
      safeEmailsFound++;
    if (
      userChoice !== "joker" &&
      data.correctType === "phishing" &&
      data.isCorrect
    )
      phishingEmailsFound++;

    // Adjust timer duration (client-side UI only, server doesn't care)
    if (data.isCorrect) {
      if (gameDifficulty === "easy")
        currentTimerDuration = initialTimerDuration;
      else if (gameDifficulty === "normal")
        currentTimerDuration = Math.max(
          normalModeMinTime,
          currentTimerDuration - 1,
        );
      else if (gameDifficulty === "hardcore")
        currentTimerDuration = Math.max(
          hardcoreModeMinTime,
          currentTimerDuration - 1,
        );
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

// --- Timer ---
function resetTimer() {
  clearInterval(timerInterval);
  timeLeft = Math.max(0, Math.ceil((emailDeadline - performance.now()) / 1000));
  timerEl.textContent = timeLeft;
  timerEl.className = "";
}
function startTimer() {
  if (!gameActive) return;
  timerInterval = setInterval(() => {
    if (!gameActive) {
      clearInterval(timerInterval);
      return;
    }
    timeLeft = Math.max(
      0,
      Math.ceil((emailDeadline - performance.now()) / 1000),
    );
    timerEl.textContent = timeLeft;
    if (timeLeft <= 5 && timeLeft > 2) {
      timerEl.className = "warning";
    } else if (timeLeft <= 2 && timeLeft > 0) {
      timerEl.className = "danger";
      playSound("tick");
    } else if (timeLeft <= 0) {
      timerEl.className = "danger";
      clearInterval(timerInterval);
      // Timeout always counts as error (server handles it)
      classifyEmail("timeout");
    } else {
      timerEl.className = "";
    }
  }, 1000);
}

// --- Feedback Popup ---
function showFeedbackPopup(
  isCorrect,
  emailData,
  isTimeout = false,
  assisted = false,
) {
  feedbackTitleEl.textContent =
    assisted && !isTimeout ? "SOS Sécu" : isCorrect ? "Correct !" : "Erreur !";
  feedbackTitleEl.style.color = isCorrect
    ? getCssVariableValue("--safe-color")
    : getCssVariableValue("--phishing-color");

  feedbackExplanationEl.textContent = isTimeout
    ? "Vous avez mis trop de temps à analyser cet email."
    : assisted
      ? "SOS Sécu a identifié cet email. Retrouvez les indices ci-dessous."
      : isCorrect
        ? "Vous avez correctement identifié cet email."
        : "Vous n'avez pas correctement identifié cet email.";

  feedbackCluesEl.innerHTML = "";
  const list = document.createElement("ul");
  (emailData.clues || []).forEach((clue) => {
    const li = document.createElement("li");
    if (clue.includes(":")) {
      const cut = clue.indexOf(":");
      const tech = clue.slice(0, cut),
        expl = clue.slice(cut + 1);
      const t = document.createElement("span");
      t.textContent = tech + " :";
      t.className = "clue-technique";
      const e = document.createElement("span");
      e.textContent = expl;
      e.className = "clue-explanation";
      li.appendChild(t);
      li.appendChild(e);
    } else {
      li.textContent = clue;
    }
    list.appendChild(li);
  });
  feedbackCluesEl.appendChild(list);

  feedbackModalEl.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;";
  setTimeout(() => feedbackModalEl.classList.add("visible"), 0);
}

feedbackContinueBtn.addEventListener("click", () => {
  feedbackModalEl.classList.remove("visible");
  secuGuyContainer.classList.remove("visible");
  secuGuyContainer.classList.add("hidden");
  playSound("click");

  if (!gameActive) {
    endGame(errors < maxErrors, false);
    return;
  }
  autoAnalyzeBtn.disabled = autoAnalyzesLeft <= 0;
  loadNextEmail();
});

document.addEventListener("keydown", (e) => {
  if (feedbackModalEl.classList.contains("visible") && e.key === "Enter") {
    e.preventDefault();
    feedbackContinueBtn.click();
  }
});

// --- Display helpers ---
function updateScoreDisplay() {
  scoreEl.textContent = score;
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
    title: "Chuck Norris de la Cybersécurité",
    desc: "Il a trouvé une faille dans le temps, l'a patchée, et redémarré l'univers sans downtime.",
    appreciation: "Super méga giga ultra top excellent",
  },
  {
    emoji: "🥈",
    title: "Batman (version cybersécurité)",
    desc: "N'a aucun pouvoir mais des scripts pour tout. Il a un BatSIEM.",
    appreciation: "Épique en toute circonstance",
  },
  {
    emoji: "🥉",
    title: "Edward Snowden",
    desc: "Il sait tout, voit tout, sauf ton historique YouTube... trop dark.",
    appreciation: "Héroïque mais humble",
  },
  {
    emoji: "🧠",
    title: "Mr Robot (Elliot Alderson)",
    desc: "Il code dans sa tête et déploie dans tes rêves.",
    appreciation: "Stylé comme un terminal noir",
  },
  {
    emoji: "🧞‍♂️",
    title: "Tony Stark (mais sans l'armure)",
    desc: "Trop occupé à parler pour patcher, mais il te vendrait un ransomware comme un produit Apple.",
    appreciation: "Solide comme une VM qui redémarre pas",
  },
  {
    emoji: "🕶️",
    title: "Neo (de Matrix)",
    desc: 'A vu les paquets réseau tomber au ralenti. "There is no firewall".',
    appreciation: "Respectable (même en chaussettes)",
  },
  {
    emoji: "💼",
    title: "Fox Mulder",
    desc: "Il croit que le phishing est fait par les extraterrestres. Il n'a pas tort.",
    appreciation: "Pas mal du tout, vraiment",
  },
  {
    emoji: "👓",
    title: "Q (de James Bond)",
    desc: "Inventeur de gadgets inutiles mais stylés, genre le stylo USB qui clignote quand tu te fais hacker.",
    appreciation: "Prometteur à condition d'éviter les cafés renversés",
  },
  {
    emoji: "🎮",
    title: "Lara Croft (spécialiste des ruines numériques)",
    desc: "Elle récupère des backups dans des serveurs oubliés de tous depuis 1998.",
    appreciation: "On sent le potentiel",
  },
  {
    emoji: "🍕",
    title: "Peter Parker (stagiaire en cybersécu)",
    desc: "Il est rapide… sauf pour répondre aux tickets.",
    appreciation: "Correct mais cliquouille",
  },
  {
    emoji: "🛸",
    title: "Rick Sanchez",
    desc: "Il a créé un malware intelligent par accident. Depuis, il lui parle parfois.",
    appreciation: "Peut mieux faire",
  },
  {
    emoji: "📼",
    title: "MacGyver",
    desc: "A redémarré un datacenter avec un trombone, une pile et un vieux modem 56k.",
    appreciation: "Un peu mieux que rien",
  },
  {
    emoji: "🧓",
    title: "Obi-Wan Kenobi",
    desc: '"Le mot de passe que tu cherches n\'est plus là, jeune padawan."',
    appreciation: "Mouais… bof",
  },
  {
    emoji: "💩",
    title: "Jar Jar Binks",
    desc: "Tente d'aider... déclenche une fuite de données.",
    appreciation: "Pas fameux",
  },
  {
    emoji: "🛴",
    title: "Steve Urkel (version admin réseau)",
    desc: '"C\'est pas moi qui ai crashé le serveur ? Oups."',
    appreciation: "Assez pathétique",
  },
  {
    emoji: "🧃",
    title: "Kevin, 3e stagiaire non payé",
    desc: "Il confond phishing et pêche à la ligne.",
    appreciation: "Affligeant mais divertissant",
  },
  {
    emoji: "🚽",
    title: "Ron Weasley (sans baguette)",
    desc: "Fait disparaître les tickets... sans les résoudre.",
    appreciation: "Presque gênant",
  },
  {
    emoji: "🐌",
    title: "Bob l'Éponge",
    desc: "Toujours connecté. Mais à quoi ? On ne sait pas.",
    appreciation: "Pathétique tout court",
  },
  {
    emoji: "🥴",
    title: "Homer Simpson (RSSI par accident)",
    desc: 'Il a cliqué sur "Mettre à jour plus tard" 126 fois. Le SI tient encore.',
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

// --- End Game ---
async function endGame(won, abandoned = false) {
  gameActive = false;
  clearInterval(timerInterval);
  feedbackModalEl.classList.remove("visible");
  hideTooltip();
  gameUi.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");

  const { index: curIdx, rank: curRank } = getRankDetails(score);
  const emailsPlayed = emailsSuccessfullyClassified;
  finalScoreEl.innerHTML = `<span class="score-diploma">Vous avez atteint le score <strong>${curRank.appreciation}</strong> de ${score} (${emailsPlayed} emails traités)</span>`;

  const prev = document.querySelector(".previous-rank");
  const curr = document.querySelector(".current-rank");
  const next = document.querySelector(".next-rank");

  const gen = (r) =>
    `<div class="rank-panel-header"><span class="rank-emoji">${r.emoji}</span><span class="rank-title ${r.title.length > 30 ? "long-title" : ""}">${r.title}</span></div><p class="rank-description">${r.desc}</p>`;

  if (prev && curr && next) {
    prev.innerHTML = gen(RANKS[Math.max(0, curIdx - 1)]);
    curr.innerHTML = gen(curRank);
    next.innerHTML = gen(RANKS[Math.min(RANKS.length - 1, curIdx + 1)]);
    prev.style.visibility = curIdx === 0 ? "hidden" : "";
    next.style.visibility = curIdx === RANKS.length - 1 ? "hidden" : "";
  }

  if (abandoned) {
    gameOverTitleEl.textContent = "ABANDON";
    gameOverTitleEl.style.color = getCssVariableValue("--warning-color");
    gameOverMessageEl.textContent = `${playerName}, vous avez quitté la mission. Score conservé !`;
  } else if (won) {
    gameOverTitleEl.textContent = "TILT ! TOUS LES MAILS TRAITÉS";
    gameOverTitleEl.style.color = getCssVariableValue("--safe-color");
    gameOverMessageEl.textContent = `Incroyable ${playerName} ! Vous avez traité tous les emails disponibles !`;
  } else {
    gameOverTitleEl.textContent = "MISSION ÉCHOUÉE";
    gameOverTitleEl.style.color = getCssVariableValue("--phishing-color");
    gameOverMessageEl.textContent = `Dommage ${playerName}. L'entreprise a été compromise.`;
  }

  const modes = {
    easy: ["🔰", "FACILE", "30 secondes fixes"],
    normal: ["⚠️", "NORMAL", "temps réduit jusqu'à 15s"],
    hardcore: ["💀", "HARDCORE", "temps réduit jusqu'à 5s"],
  };
  const [em, nm, desc] = modes[gameDifficulty] || modes.easy;
  document.getElementById("game-mode-message").innerHTML =
    `<div class="game-mode-info"><strong>${em} Mode ${nm}</strong><br>${desc}</div>`;

  restartBtn.disabled = true;
  // Await the persisted end so abandonment badges and recap are available immediately.
  if (sessionId) {
    try {
      const result = await PCB.request(`/api/sessions/${sessionId}/end`, {
        method: "POST",
        headers: { "X-Session-Token": sessionToken },
      });
      window._pendingAchievements = [
        ...(window._pendingAchievements || []),
        ...(result.newAchievements || []),
      ];
    } catch (error) {
      gameOverMessageEl.textContent += ` ${error.message} Réessayez la clôture avant de consulter le récapitulatif.`;
      const retry = document.createElement("button");
      retry.className = "btn";
      retry.textContent = "Enregistrer la fin de partie";
      retry.addEventListener("click", () => {
        retry.remove();
        endGame(won, abandoned);
      });
      gameOverScreen.appendChild(retry);
    }
  }

  // Show newly unlocked achievements
  const badges = window._pendingAchievements || [];
  window._pendingAchievements = [];
  renderNewBadges(badges);
  restartBtn.disabled = false;
}

function renderNewBadges(badges) {
  // Remove previous badge popup if any
  const old = document.getElementById("new-badges-popup");
  if (old) old.remove();

  const container = document.createElement("div");
  container.id = "new-badges-popup";

  const badgesHtml =
    badges && badges.length > 0
      ? `<div class="badges-popup-title">🏆 Nouveaux badges débloqués !</div>
         <div class="badges-popup-list">
           ${badges.map((b) => `<div class="badge-item"><span class="badge-emoji">${b.emoji}</span><span class="badge-name">${b.name}</span><span class="badge-desc">${b.description}</span></div>`).join("")}
         </div>`
      : "";

  const profileLink = playerId
    ? `<a href="profile.html?id=${playerId}" class="profile-link-btn">👤 Voir mon profil & tous mes badges</a>`
    : "";

  container.innerHTML = badgesHtml + profileLink;
  if (sessionId) {
    const recap = document.createElement("a");
    recap.href = "/recap.html?id=" + sessionId;
    recap.className = "profile-link-btn";
    recap.textContent = "Voir les emails et mes réponses";
    container.appendChild(recap);
  }
  gameOverScreen.appendChild(container);

  // Animate in
  requestAnimationFrame(() => container.classList.add("visible"));
}

// --- Event Listeners ---
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
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
abandonBtn.addEventListener("click", () => {
  if (!gameActive) return;
  if (confirm("Abandonner la partie ? Votre score sera conservé.")) {
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

  // Dynamic rules mini-footer
  const ruleTimer = document.getElementById("rule-timer");
  const timerLabels = {
    easy: "⏱ 30s fixes",
    normal: "⏱ 30s → 15s",
    hardcore: "⏱ 30s → 5s",
  };
  // Read value from label's 'for' attr — avoids race with :checked state
  document.querySelectorAll(".difficulty-toggle label").forEach((lbl) => {
    lbl.addEventListener("click", () => {
      const input = document.getElementById(lbl.getAttribute("for"));
      if (ruleTimer && input)
        ruleTimer.textContent = timerLabels[input.value] || timerLabels.easy;
    });
  });
  // Init with the default checked value
  const checkedInit = document.querySelector(
    'input[name="difficulty"]:checked',
  );
  if (ruleTimer && checkedInit)
    ruleTimer.textContent = timerLabels[checkedInit.value] || timerLabels.easy;
});

// --- Theme Management ---
function initTheme() {
  const savedDark = localStorage.getItem("pcb-dark") === "true";
  const savedTheme = localStorage.getItem("pcb-theme") || "outlook";
  if (savedDark) document.body.classList.add("dark");
  applyTheme(savedTheme);
  updateDarkToggleIcon();

  const darkToggle = document.getElementById("dark-toggle");
  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) themeSelect.value = savedTheme;

  if (darkToggle)
    darkToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem(
        "pcb-dark",
        document.body.classList.contains("dark"),
      );
      updateDarkToggleIcon();
    });
  if (themeSelect)
    themeSelect.addEventListener("change", () => {
      applyTheme(themeSelect.value);
      localStorage.setItem("pcb-theme", themeSelect.value);
    });
}
function updateDarkToggleIcon() {
  const btn = document.getElementById("dark-toggle");
  if (btn)
    btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}
function applyTheme(theme) {
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
    document.head.appendChild(link);
    injectOutlookSidebar();
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
  gameUi.insertBefore(sidebar, gameUi.firstChild);
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
