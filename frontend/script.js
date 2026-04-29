// ============================================================
//  PhishChipsBattle – script.js (version Enterprise / API)
//  Les emails sont chargés depuis l'API, jamais dans le HTML.
// ============================================================

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const gameUi = document.getElementById('game-ui');
const gameOverScreen = document.getElementById('game-over-screen');
const secuGuyContainer = document.getElementById('secu-guy-container');

// Start form
const playerNameInput = document.getElementById('player-name-input');
const playerEmailInput = document.getElementById('player-email-input');
const playerServiceSelect = document.getElementById('player-service-select');
const startBtn = document.getElementById('start-btn');
const startError = document.getElementById('start-error');

const restartBtn = document.getElementById('restart-btn');

const emailSenderEl = document.getElementById('email-sender');
const emailSubjectEl = document.getElementById('email-subject');
const emailBodyEl = document.getElementById('email-body');

const timerEl = document.getElementById('timer');
const securityBarEl = document.getElementById('security-bar');
const scoreEl = document.getElementById('score');
const errorsLeftEl = document.getElementById('errors-left');
const autoAnalyzesLeftEl = document.getElementById('auto-analyzes-left');
const autoAnalyzeBtn = document.getElementById('auto-analyze-btn');
const classifySafeBtn = document.getElementById('classify-safe-btn');
const classifyPhishingBtn = document.getElementById('classify-phishing-btn');

const finalScoreEl = document.getElementById('final-score');
const gameOverTitleEl = document.getElementById('game-over-title');
const gameOverMessageEl = document.getElementById('game-over-message');

const feedbackModalEl = document.getElementById('feedback-modal');
const feedbackTitleEl = document.getElementById('feedback-title');
const feedbackExplanationEl = document.getElementById('feedback-explanation');
const feedbackCluesEl = document.getElementById('feedback-clues');
const feedbackContinueBtn = document.getElementById('feedback-continue-btn');

const cursorTooltipEl = document.getElementById('cursor-tooltip');

const safeMailsFoundEl = document.getElementById('safe-mails-found');
const phishingMailsFoundEl = document.getElementById('phishing-mails-found');
const avgDecisionTimeEl = document.getElementById('avg-decision-time');

// --- API State ---
let sessionId = null;
let sessionToken = null;
let playerId = null;
let totalEmails = 0;

// --- Game State ---
let score = 0;
let errors = 0;
const maxErrors = 3;
let timeLeft = 0;
let timerInterval = null;
let gameActive = false;
let autoAnalyzesLeft = 3;
let currentEmailData = null;   // { emailId, sender, realSender, subject, body }
let playerName = '';
let gameDifficulty = 'easy';

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

// --- Audio ---
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
}
function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    try {
        switch (type) {
            case 'tick': osc.type='sine'; osc.frequency.setValueAtTime(880,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.1); break;
            case 'correct': osc.type='sine'; osc.frequency.setValueAtTime(523.25,audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(1046.50,audioCtx.currentTime+0.15); gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.15); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.15); break;
            case 'error': osc.type='square'; osc.frequency.setValueAtTime(150,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.3); break;
            case 'new_email': osc.type='triangle'; osc.frequency.setValueAtTime(440,audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(880,audioCtx.currentTime+0.1); gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.15); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.15); break;
            case 'click': osc.type='sine'; osc.frequency.setValueAtTime(1200,audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.05); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.05); break;
            case 'popup_open': osc.type='sawtooth'; osc.frequency.setValueAtTime(300,audioCtx.currentTime); osc.frequency.linearRampToValueAtTime(600,audioCtx.currentTime+0.1); gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.15); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.15); break;
        }
    } catch (e) { /* ignore */ }
}

// --- Load Services on page load ---
async function loadServices() {
    try {
        const res = await fetch('/api/services');
        if (!res.ok) return;
        const data = await res.json();
        data.services.forEach((svc) => {
            const opt = document.createElement('option');
            opt.value = svc.id;
            opt.textContent = `${svc.name} (${svc.code})`;
            playerServiceSelect.appendChild(opt);
        });
    } catch (e) {
        console.warn('Impossible de charger les services:', e);
    }
}

// --- Start Game ---
async function startGame() {
    initAudio();
    startError.textContent = '';
    startBtn.disabled = true;

    const rawName = playerNameInput.value.trim().toUpperCase();
    const email = playerEmailInput.value.trim().toLowerCase();
    const serviceId = playerServiceSelect.value ? parseInt(playerServiceSelect.value, 10) : null;

    // Validation
    if (rawName.length < 2) {
        startError.textContent = 'Le pseudo doit contenir entre 2 et 4 lettres.';
        startBtn.disabled = false;
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        startError.textContent = 'Email invalide.';
        startBtn.disabled = false;
        return;
    }

    const difficultyOptions = document.getElementsByName('difficulty');
    difficultyOptions.forEach((opt) => { if (opt.checked) gameDifficulty = opt.value; });

    try {
        // 1. Identify / create player
        const pRes = await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: rawName, email, serviceId }),
        });
        const pData = await pRes.json();
        if (!pRes.ok) {
            startError.textContent = pData.error || 'Erreur de création du joueur.';
            startBtn.disabled = false;
            return;
        }
        playerId = pData.player.id;
        playerName = typeof pData.player?.name === 'string' ? pData.player.name : '';

        // 2. Create session
        const sRes = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, difficulty: gameDifficulty }),
        });
        const sData = await sRes.json();
        if (!sRes.ok) {
            startError.textContent = sData.error || 'Erreur de création de session.';
            startBtn.disabled = false;
            return;
        }
        sessionId = sData.sessionId;
        sessionToken = sData.sessionToken;
        totalEmails = sData.totalEmails;

        // Reset local state
        score = 0; errors = 0; autoAnalyzesLeft = 3;
        safeEmailsFound = 0; phishingEmailsFound = 0;
        totalDecisionTime = 0; emailsSuccessfullyClassified = 0;
        currentTimerDuration = initialTimerDuration;
        gameActive = true;

        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        feedbackModalEl.classList.remove('visible');
        gameUi.classList.remove('hidden');

        updateScoreDisplay(); updateSecurityBar(); updateAutoAnalyzeDisplay(); updateExtendedStatsDisplay();
        classifySafeBtn.disabled = true; classifyPhishingBtn.disabled = true;

        await loadNextEmail();
    } catch (e) {
        startError.textContent = 'Erreur de connexion au serveur. Réessaie.';
        console.error(e);
    }
    startBtn.disabled = false;
}

// --- Load next email from API ---
async function loadNextEmail() {
    if (!gameActive) return;
    clearInterval(timerInterval);

    try {
        const res = await fetch(`/api/sessions/${sessionId}/next-email`, {
            headers: { 'X-Session-Token': sessionToken },
        });

        if (res.status === 410) {
            // All emails done or game over
            endGame(errors < maxErrors);
            return;
        }
        if (!res.ok) {
            console.error('Erreur next-email:', res.status);
            endGame(false);
            return;
        }

        const data = await res.json();
        currentEmailData = data;

        playSound('new_email');
        hideTooltip();

        emailSenderEl.textContent = data.sender;
        emailSenderEl.setAttribute('data-real-sender', data.realSender || data.sender);
        emailSubjectEl.textContent = data.subject;

        renderEmailBody(data.body);

        addInspectionListeners();
        resetTimer();
        startTimer();
        classifySafeBtn.disabled = false;
        classifyPhishingBtn.disabled = false;
    } catch (e) {
        console.error('loadNextEmail error:', e);
        endGame(false);
    }
}

function toSafeInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeUiText(value, fallback = '') {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim() : fallback;
}

function appendTextWithBreaks(container, text) {
    const chunks = String(text || '').split('\n');
    chunks.forEach((chunk, index) => {
        if (index > 0) {
            container.appendChild(document.createElement('br'));
        }
        if (chunk) {
            container.appendChild(document.createTextNode(chunk));
        }
    });
}

function stripTags(text) {
    return String(text || '').replace(/<[^>]*>/g, '');
}

function renderEmailBody(body) {
    emailBodyEl.replaceChildren();

    const source = typeof body === 'string' ? body : '';
    const linkRegex = /<a\s+([^>]*?)>(.*?)<\/a>/gis;
    let lastIndex = 0;

    for (const match of source.matchAll(linkRegex)) {
        const start = match.index ?? 0;
        appendTextWithBreaks(emailBodyEl, source.slice(lastIndex, start));

        const attrs = match[1] || '';
        const hrefMatch = /href=(['"])(.*?)\1/i.exec(attrs);
        const realLinkMatch = /data-real-link=(['"])(.*?)\1/i.exec(attrs);
        const link = document.createElement('span');
        link.className = 'inspectable link';
        link.dataset.realLink = realLinkMatch?.[2] || hrefMatch?.[2] || '';
        link.textContent = stripTags(match[2]);
        emailBodyEl.appendChild(link);

        lastIndex = start + match[0].length;
    }

    appendTextWithBreaks(emailBodyEl, source.slice(lastIndex));
}

// --- Classify ---
async function classifyEmail(userChoice) {
    if (!gameActive || !currentEmailData) return;
    classifySafeBtn.disabled = true;
    classifyPhishingBtn.disabled = true;
    clearInterval(timerInterval);

    const decisionTime = currentTimerDuration - timeLeft;

    try {
        const res = await fetch(`/api/sessions/${sessionId}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken,
            },
            body: JSON.stringify({
                emailId: currentEmailData.emailId,
                choice: userChoice,
                decisionTime,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error('Answer error:', data);
            return;
        }

        // Update local state from server response (source of truth)
        score = toSafeInteger(data.score);
        errors = toSafeInteger(data.errors);
        autoAnalyzesLeft = Math.max(0, 3 - toSafeInteger(data.jokersUsed));

        // Stats
        totalDecisionTime += decisionTime;
        emailsSuccessfullyClassified++;
        if (data.correctType === 'safe' && data.isCorrect) safeEmailsFound++;
        if (data.correctType === 'phishing' && data.isCorrect) phishingEmailsFound++;

        // Adjust timer duration (client-side UI only, server doesn't care)
        if (data.isCorrect) {
            if (gameDifficulty === 'easy') currentTimerDuration = initialTimerDuration;
            else if (gameDifficulty === 'normal') currentTimerDuration = Math.max(normalModeMinTime, currentTimerDuration - 1);
            else if (gameDifficulty === 'hardcore') currentTimerDuration = Math.max(hardcoreModeMinTime, currentTimerDuration - 1);
        }

        playSound(data.isCorrect ? 'correct' : 'error');
        updateScoreDisplay(); updateSecurityBar(); updateAutoAnalyzeDisplay(); updateExtendedStatsDisplay();

        // Store clues + type in currentEmailData for the feedback modal
        currentEmailData.clues = data.clues;
        currentEmailData.type = data.correctType;

        showFeedbackPopup(data.isCorrect, currentEmailData);

        if (data.completed) {
            gameActive = false;
        }
    } catch (e) {
        console.error('classifyEmail error:', e);
    }
}

// --- Auto-analyze (Joker) ---
function useAutoAnalyze() {
    if (autoAnalyzesLeft > 0 && gameActive) {
        clearInterval(timerInterval);
        secuGuyContainer.classList.remove('hidden');
        secuGuyContainer.classList.add('visible');
        setTimeout(() => {
            classifyEmail('joker');
        }, 500);
    }
}

// --- Timer ---
function resetTimer() {
    clearInterval(timerInterval);
    timeLeft = currentTimerDuration;
    timerEl.textContent = timeLeft;
    timerEl.className = '';
}
function startTimer() {
    if (!gameActive) return;
    timerInterval = setInterval(() => {
        if (!gameActive) { clearInterval(timerInterval); return; }
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 5 && timeLeft > 2) { timerEl.className = 'warning'; }
        else if (timeLeft <= 2 && timeLeft > 0) { timerEl.className = 'danger'; playSound('tick'); }
        else if (timeLeft <= 0) {
            timerEl.className = 'danger';
            clearInterval(timerInterval);
            // Timeout always counts as error (server handles it)
            classifyEmail('timeout');
        } else { timerEl.className = ''; }
    }, 1000);
}

// --- Feedback Popup ---
function showFeedbackPopup(isCorrect, emailData, isTimeout = false) {
    feedbackTitleEl.textContent = isCorrect ? 'Correct !' : 'Erreur !';
    feedbackTitleEl.style.color = isCorrect ? getCssVariableValue('--safe-color') : getCssVariableValue('--phishing-color');

    feedbackExplanationEl.textContent = isTimeout
        ? 'Vous avez mis trop de temps à analyser cet email.'
        : isCorrect
            ? 'Vous avez correctement identifié cet email.'
            : 'Vous n\'avez pas correctement identifié cet email.';

    feedbackCluesEl.innerHTML = '';
    const list = document.createElement('ul');
    (emailData.clues || []).forEach((clue) => {
        const li = document.createElement('li');
        if (clue.includes(':')) {
            const [tech, expl] = clue.split(':', 2);
            const t = document.createElement('span'); t.textContent = tech + ' :'; t.className = 'clue-technique';
            const e = document.createElement('span'); e.textContent = expl; e.className = 'clue-explanation';
            li.appendChild(t); li.appendChild(e);
        } else {
            li.textContent = clue;
        }
        list.appendChild(li);
    });
    feedbackCluesEl.appendChild(list);

    feedbackModalEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;';
    setTimeout(() => feedbackModalEl.classList.add('visible'), 0);
}

feedbackContinueBtn.addEventListener('click', () => {
    feedbackModalEl.classList.remove('visible');
    secuGuyContainer.classList.remove('visible');
    secuGuyContainer.classList.add('hidden');
    playSound('click');

    if (!gameActive) {
        endGame(errors < maxErrors);
        return;
    }
    autoAnalyzeBtn.disabled = false;
    loadNextEmail();
});

document.addEventListener('keydown', (e) => {
    if (feedbackModalEl.classList.contains('visible') && e.key === 'Enter') {
        e.preventDefault();
        feedbackContinueBtn.click();
    }
});

// --- Display helpers ---
function updateScoreDisplay() { scoreEl.textContent = score; }
function updateExtendedStatsDisplay() {
    if (safeMailsFoundEl) safeMailsFoundEl.textContent = safeEmailsFound;
    if (phishingMailsFoundEl) phishingMailsFoundEl.textContent = phishingEmailsFound;
    if (avgDecisionTimeEl) {
        if (emailsSuccessfullyClassified > 0) {
            avgDecisionTimeEl.textContent = (totalDecisionTime / emailsSuccessfullyClassified).toFixed(1) + 's';
        } else {
            avgDecisionTimeEl.textContent = 'N/A';
        }
    }
}
function getCssVariableValue(v) { return getComputedStyle(document.documentElement).getPropertyValue(v); }
function updateSecurityBar() {
    const pct = Math.max(0, ((maxErrors - errors) / maxErrors) * 100);
    securityBarEl.style.width = `${pct}%`;
    errorsLeftEl.textContent = `${maxErrors - errors}`;
    if (pct <= 25) securityBarEl.style.backgroundColor = getCssVariableValue('--phishing-color');
    else if (pct <= 50) securityBarEl.style.backgroundColor = getCssVariableValue('--warning-color');
    else securityBarEl.style.backgroundColor = getCssVariableValue('--safe-color');
}
function updateAutoAnalyzeDisplay() {
    autoAnalyzesLeftEl.textContent = autoAnalyzesLeft;
    autoAnalyzeBtn.disabled = autoAnalyzesLeft <= 0;
}

// --- Inspection Tooltips ---
function addInspectionListeners() {
    function createDynamicTooltip(e, text, type = '') {
        const safeLeft = Math.max(0, toSafeInteger(e.clientX));
        const safeTop = Math.max(0, toSafeInteger(e.clientY));
        const safeType = type === 'danger' || type === 'warning' ? type : '';

        cursorTooltipEl.className = safeType ? `tooltip-element ${safeType}` : 'tooltip-element';
        cursorTooltipEl.textContent = sanitizeUiText(text);
        cursorTooltipEl.style.left = `${safeLeft}px`;
        cursorTooltipEl.style.top = `${safeTop}px`;
        cursorTooltipEl.classList.remove('hidden');
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
        const real = sanitizeUiText(emailSenderEl.getAttribute('data-real-sender'));
        senderTip = createDynamicTooltip(e,
            real && real !== disp ? `🎭 Email affiché: ${disp}\n⚠️ Adresse réelle: ${real}` : `Expéditeur: ${disp}`,
            real && real !== disp ? 'danger' : '');
        emailSenderEl.onmousemove = (e) => track(e, senderTip);
    };
    emailSenderEl.onmouseout = () => {
        if (senderTip) { hideTooltip(); senderTip = null; }
        emailSenderEl.onmousemove = null;
    };

    emailBodyEl.querySelectorAll('.inspectable.link').forEach((link) => {
        const realLink = link.dataset.realLink;
        let linkTip = null;
        link.onmouseover = (e) => {
            let type = '';
            try {
                const url = new URL(realLink.startsWith('http') ? realLink : 'http://' + realLink);
                const senderMatch = currentEmailData.sender.match(/@([^>]+)/);
                const senderDomain = senderMatch ? senderMatch[1] : null;
                if (senderDomain && !url.hostname.endsWith(senderDomain) && !isKnownGoodDomain(url.hostname)) type = 'warning';
            } catch { type = 'danger'; }
            linkTip = createDynamicTooltip(e, `Lien cible : ${realLink}`, type);
            link.onmousemove = (e) => track(e, linkTip);
        };
        link.onmouseout = () => {
            if (linkTip) { hideTooltip(); linkTip = null; }
            link.onmousemove = null;
        };
        link.onclick = (e) => e.preventDefault();
    });
}

function isKnownGoodDomain(hostname) {
    const good = ['showroomprive.net','banquefictive-enligne.com','cloud-provider-invoices.com','linkedin.com','meteofrance.fr','vinted.fr','impots.gouv.fr','chronopost.fr','ameli.fr','doctolib.fr'];
    return good.some((d) => hostname.endsWith(d));
}

function updateTooltipPosition(e) {
    if (cursorTooltipEl.classList.contains('hidden')) return;
    cursorTooltipEl.style.left = e.clientX + 'px';
    cursorTooltipEl.style.top = e.clientY + 'px';
}
function hideTooltip() {
    cursorTooltipEl.classList.add('hidden');
    document.removeEventListener('mousemove', updateTooltipPosition);
}

// --- Ranks ---
const RANKS = [
    { emoji:'🥇', title:'Chuck Norris de la Cybersécurité', desc:'Il a trouvé une faille dans le temps, l\'a patchée, et redémarré l\'univers sans downtime.', appreciation:'Super méga giga ultra top excellent' },
    { emoji:'🥈', title:'Batman (version cybersécurité)', desc:'N\'a aucun pouvoir mais des scripts pour tout. Il a un BatSIEM.', appreciation:'Épique en toute circonstance' },
    { emoji:'🥉', title:'Edward Snowden', desc:'Il sait tout, voit tout, sauf ton historique YouTube... trop dark.', appreciation:'Héroïque mais humble' },
    { emoji:'🧠', title:'Mr Robot (Elliot Alderson)', desc:'Il code dans sa tête et déploie dans tes rêves.', appreciation:'Stylé comme un terminal noir' },
    { emoji:'🧞‍♂️', title:'Tony Stark (mais sans l\'armure)', desc:'Trop occupé à parler pour patcher, mais il te vendrait un ransomware comme un produit Apple.', appreciation:'Solide comme une VM qui redémarre pas' },
    { emoji:'🕶️', title:'Neo (de Matrix)', desc:'A vu les paquets réseau tomber au ralenti. "There is no firewall".', appreciation:'Respectable (même en chaussettes)' },
    { emoji:'💼', title:'Fox Mulder', desc:'Il croit que le phishing est fait par les extraterrestres. Il n\'a pas tort.', appreciation:'Pas mal du tout, vraiment' },
    { emoji:'👓', title:'Q (de James Bond)', desc:'Inventeur de gadgets inutiles mais stylés, genre le stylo USB qui clignote quand tu te fais hacker.', appreciation:'Prometteur à condition d\'éviter les cafés renversés' },
    { emoji:'🎮', title:'Lara Croft (spécialiste des ruines numériques)', desc:'Elle récupère des backups dans des serveurs oubliés de tous depuis 1998.', appreciation:'On sent le potentiel' },
    { emoji:'🍕', title:'Peter Parker (stagiaire en cybersécu)', desc:'Il est rapide… sauf pour répondre aux tickets.', appreciation:'Correct mais cliquouille' },
    { emoji:'🛸', title:'Rick Sanchez', desc:'Il a créé un malware intelligent par accident. Depuis, il lui parle parfois.', appreciation:'Peut mieux faire' },
    { emoji:'📼', title:'MacGyver', desc:'A redémarré un datacenter avec un trombone, une pile et un vieux modem 56k.', appreciation:'Un peu mieux que rien' },
    { emoji:'🧓', title:'Obi-Wan Kenobi', desc:'"Le mot de passe que tu cherches n\'est plus là, jeune padawan."', appreciation:'Mouais… bof' },
    { emoji:'💩', title:'Jar Jar Binks', desc:'Tente d\'aider... déclenche une fuite de données.', appreciation:'Pas fameux' },
    { emoji:'🛴', title:'Steve Urkel (version admin réseau)', desc:'"C\'est pas moi qui ai crashé le serveur ? Oups."', appreciation:'Assez pathétique' },
    { emoji:'🧃', title:'Kevin, 3e stagiaire non payé', desc:'Il confond phishing et pêche à la ligne.', appreciation:'Affligeant mais divertissant' },
    { emoji:'🚽', title:'Ron Weasley (sans baguette)', desc:'Fait disparaître les tickets... sans les résoudre.', appreciation:'Presque gênant' },
    { emoji:'🐌', title:'Bob l\'Éponge', desc:'Toujours connecté. Mais à quoi ? On ne sait pas.', appreciation:'Pathétique tout court' },
    { emoji:'🥴', title:'Homer Simpson (RSSI par accident)', desc:'Il a cliqué sur "Mettre à jour plus tard" 126 fois. Le SI tient encore.', appreciation:'Très pathétique' },
];

function getRankDetails(finalScore) {
    const total = totalEmails || 30;
    let idx;
    if (finalScore === 0) idx = RANKS.length - 1;
    else if (finalScore === 1) idx = RANKS.length - 2;
    else if (finalScore === 2) idx = RANKS.length - 3;
    else if (finalScore <= 4) idx = RANKS.length - 4;
    else {
        const pct = (finalScore / total) * 100;
        if (pct >= 80) idx = 0;
        else if (pct >= 70) idx = 1;
        else if (pct >= 60) idx = 2;
        else if (pct >= 50) idx = 3;
        else if (pct >= 45) idx = 4;
        else if (pct >= 40) idx = 5;
        else if (pct >= 35) idx = 6;
        else if (pct >= 30) idx = 7;
        else if (pct >= 25) idx = 8;
        else if (pct >= 20) idx = 9;
        else if (pct >= 18) idx = 10;
        else if (pct >= 15) idx = 11;
        else if (pct >= 12) idx = 12;
        else if (pct >= 10) idx = 13;
        else if (pct >= 8) idx = 14;
        else if (pct >= 6) idx = RANKS.length - 4;
        else if (pct >= 4) idx = RANKS.length - 3;
        else if (pct >= 2) idx = RANKS.length - 2;
        else idx = RANKS.length - 1;
    }
    return { index: idx, rank: RANKS[idx] };
}

// --- End Game ---
function endGame(won) {
    gameActive = false;
    clearInterval(timerInterval);
    feedbackModalEl.classList.remove('visible');
    hideTooltip();
    gameUi.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    const { index: curIdx, rank: curRank } = getRankDetails(score);
    const pct = totalEmails > 0 ? ((score / totalEmails) * 100).toFixed(0) : 0;
    finalScoreEl.innerHTML = `<span class="score-diploma">Vous avez atteint le score <strong>${curRank.appreciation}</strong> de ${score} sur ${totalEmails} (${pct}%)</span>`;

    const prev = document.querySelector('.previous-rank');
    const curr = document.querySelector('.current-rank');
    const next = document.querySelector('.next-rank');

    const gen = (r) => `<div class="rank-panel-header"><span class="rank-emoji">${r.emoji}</span><span class="rank-title ${r.title.length > 30 ? 'long-title' : ''}">${r.title}</span></div><p class="rank-description">${r.desc}</p>`;

    if (prev && curr && next) {
        prev.innerHTML = gen(RANKS[Math.max(0, curIdx - 1)]);
        curr.innerHTML = gen(curRank);
        next.innerHTML = gen(RANKS[Math.min(RANKS.length - 1, curIdx + 1)]);
        if (curIdx === 0) prev.style.visibility = 'hidden';
        else if (curIdx === RANKS.length - 1) next.style.visibility = 'hidden';
    }

    if (won) {
        gameOverTitleEl.textContent = 'MISSION ACCOMPLIE';
        gameOverTitleEl.style.color = getCssVariableValue('--safe-color');
        gameOverMessageEl.textContent = `Félicitations ${playerName} ! Vous avez protégé l'entreprise.`;
    } else {
        gameOverTitleEl.textContent = 'MISSION ÉCHOUÉE';
        gameOverTitleEl.style.color = getCssVariableValue('--phishing-color');
        gameOverMessageEl.textContent = `Dommage ${playerName}. L'entreprise a été compromise.`;
    }

    const modes = { easy: ['🔰','FACILE','30 secondes fixes'], normal: ['⚠️','NORMAL','temps réduit jusqu\'à 15s'], hardcore: ['💀','HARDCORE','temps réduit jusqu\'à 5s'] };
    const [em, nm, desc] = modes[gameDifficulty] || modes.easy;
    document.getElementById('game-mode-message').innerHTML = `<div class="game-mode-info"><strong>${em} Mode ${nm}</strong><br>${desc}</div>`;

    // Notify server session is ended (best-effort)
    if (sessionId) {
        fetch(`/api/sessions/${sessionId}/end`, {
            method: 'POST',
            headers: { 'X-Session-Token': sessionToken },
        }).catch(() => {});
    }
}

// --- Event Listeners ---
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    // Reset UI
    score = 0; errors = 0; autoAnalyzesLeft = 3;
    updateScoreDisplay(); updateSecurityBar(); updateAutoAnalyzeDisplay();
});
classifySafeBtn.addEventListener('click', () => classifyEmail('safe'));
classifyPhishingBtn.addEventListener('click', () => classifyEmail('phishing'));
autoAnalyzeBtn.addEventListener('click', useAutoAnalyze);

// Auto-uppercase for name input
playerNameInput.addEventListener('input', () => {
    const pos = playerNameInput.selectionStart;
    playerNameInput.value = playerNameInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    playerNameInput.setSelectionRange(pos, pos);
});

// Difficulty visual feedback
document.querySelectorAll('.difficulty-option').forEach((opt) => {
    opt.addEventListener('click', function () {
        const radio = this.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    });
});

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    hideTooltip();
    loadServices();
    const checked = document.querySelector('.difficulty-option input[type="radio"]:checked');
    if (checked) {
        const parent = checked.closest('.difficulty-option');
        if (parent) parent.style.borderColor = 'var(--accent-color)';
    }
});
