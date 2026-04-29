// --- DOM Elements ---
const gameContainer = document.getElementById('game-container');
const startScreen = document.getElementById('start-screen');
const gameUi = document.getElementById('game-ui');
const gameOverScreen = document.getElementById('game-over-screen');
const secuGuyContainer = document.getElementById('secu-guy-container');
const playerNameInput = document.getElementById('player-name-input');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const emailSenderEl = document.getElementById('email-sender');
const emailSubjectEl = document.getElementById('email-subject');
const emailBodyEl = document.getElementById('email-body');
const emailViewerEl = document.getElementById('email-viewer');

const timerEl = document.getElementById('timer');
const securityBarEl = document.getElementById('security-bar');
const scoreEl = document.getElementById('score');
const errorsLeftEl = document.getElementById('errors-left');
const autoAnalyzesLeftEl = document.getElementById('auto-analyzes-left');
const autoAnalyzeBtn = document.getElementById('auto-analyze-btn');
const classifySafeBtn = document.getElementById('classify-safe-btn');
const classifyPhishingBtn = document.getElementById('classify-phishing-btn');

const finalScoreEl = document.getElementById('final-score');
const finalRankEl = document.getElementById('final-rank');
const gameOverTitleEl = document.getElementById('game-over-title');
const gameOverMessageEl = document.getElementById('game-over-message');
// Variable certificationMessageEl supprimée

// Feedback Modal Elements
const feedbackModalEl = document.getElementById('feedback-modal');
const feedbackTitleEl = document.getElementById('feedback-title');
const feedbackExplanationEl = document.getElementById('feedback-explanation');
const feedbackCluesEl = document.getElementById('feedback-clues');
const feedbackContinueBtn = document.getElementById('feedback-continue-btn');

// Tooltip Element
const cursorTooltipEl = document.getElementById('cursor-tooltip');

// --- NEW: Analysis Panel Stats Elements ---
const safeMailsFoundEl = document.getElementById('safe-mails-found');
const phishingMailsFoundEl = document.getElementById('phishing-mails-found');
const avgDecisionTimeEl = document.getElementById('avg-decision-time');

// --- Game State ---
let currentEmailIndex = 0;
let score = 0;
let errors = 0;
const maxErrors = 3;
let timeLeft = 0; // Added
let timerInterval = null;
let gameActive = false;
let autoAnalyzesLeft = 3;
let currentEmailData = null;
let shuffledEmails = [];
let playerName = "";

// --- NEW: Statistics Variables ---
let safeEmailsFound = 0; // Added
let phishingEmailsFound = 0; // Added
let totalDecisionTime = 0; // Added
let emailsSuccessfullyClassified = 0; // Added

// --- NEW: Difficulty Mode Variables ---
let gameDifficulty = "easy"; // Default: easy, normal, hardcore

// --- NEW: Timer Duration Variables ---
const initialTimerDuration = 30; // Start time for all modes
const normalModeMinTime = 15;    // Minimum time for NORMAL mode
const hardcoreModeMinTime = 5;   // Minimum time for HARDCORE mode
let currentTimerDuration = initialTimerDuration; // Current duration for the next email

// --- Audio Context ---
let audioCtx;
// Initialise le contexte audio pour les effets sonores
function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { console.warn("Web Audio API not supported"); audioCtx = null; } } }

// Joue différents effets sonores selon le type d'action
function playSound(type) {
     if (!audioCtx) return;
     const oscillator = audioCtx.createOscillator();
     const gainNode = audioCtx.createGain();
     oscillator.connect(gainNode);
     gainNode.connect(audioCtx.destination);
     gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
     try {
          switch (type) {
              case 'tick': oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.1); break;
              case 'correct': oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); oscillator.frequency.linearRampToValueAtTime(1046.50, audioCtx.currentTime + 0.15); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.15); break;
              case 'error': oscillator.type = 'square'; oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.3); // gameContainer.classList.add('glitch'); setTimeout(() => gameContainer.classList.remove('glitch'), 300); break;
               case 'new_email': oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); oscillator.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.1); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.15); break;
               case 'click': oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.05); break;
               case 'popup_open': oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(300, audioCtx.currentTime); oscillator.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.1); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15); oscillator.start(audioCtx.currentTime); oscillator.stop(audioCtx.currentTime + 0.15); break; // New sound for popup
          }
     } catch (err) { console.error("Audio playback error:", err); }
}

 // --- Game Logic ---

 // Mélange aléatoirement les éléments d'un tableau (algorithme de Fisher-Yates)
function shuffleArray(array) {
     for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array;
 }

// Initialise et démarre une nouvelle partie
function startGame() {
    initAudio();
    playerName = playerNameInput.value.trim() || "Agent X";
    score = 0; errors = 0; currentEmailIndex = 0; autoAnalyzesLeft = 3; gameActive = true;
    shuffledEmails = shuffleArray([...emails]);
    
    // Get selected difficulty mode
    const difficultyOptions = document.getElementsByName('difficulty');
    difficultyOptions.forEach(option => {
        if (option.checked) {
            gameDifficulty = option.value;
        }
    });
    
    // Reset timer duration to initial value
    currentTimerDuration = initialTimerDuration;

    // --- NEW: Reset Statistics ---
    safeEmailsFound = 0;
    phishingEmailsFound = 0;
    totalDecisionTime = 0;
    emailsSuccessfullyClassified = 0;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    feedbackModalEl.classList.remove('visible'); // Ensure popup is hidden
    gameUi.classList.remove('hidden');

    updateScoreDisplay(); updateSecurityBar(); updateAutoAnalyzeDisplay();
    autoAnalyzeBtn.disabled = false;
    classifySafeBtn.disabled = true; classifyPhishingBtn.disabled = true;

    // --- NEW: Update extended stats display on start ---
    updateExtendedStatsDisplay();

    loadEmail(shuffledEmails[currentEmailIndex]);
}

// Charge un email dans l'interface et initialise les interactions
function loadEmail(emailData) {
    if (!gameActive) return;
    if (!emailData) { endGame(true); return; }

    currentEmailData = emailData;
    playSound('new_email');

    // Masquer le tooltip au chargement d'un nouvel email
    hideTooltip();

    emailSenderEl.textContent = emailData.sender;
    emailSenderEl.setAttribute('data-real-sender', emailData.realSender || emailData.sender);
    emailSubjectEl.textContent = emailData.subject;

    emailBodyEl.innerHTML = '';
    let sanitizedBody = emailData.body.replace(/</g, "<").replace(/>/g, ">");
    const linkRegex = /<a\s+(?:[^&]*?\s+)?href=(["'])(.*?)\1(?:\s+data-real-link=(["'])(.*?)\3)?(?:[^&]*?)>(.*?)<\/a>/gi;
    sanitizedBody = sanitizedBody.replace(linkRegex, (match, q1, href, q2, realLink, text) => {
        const actualLink = escapeHtml(realLink || href);
        return `<span class="inspectable link" data-real-link="${actualLink}">${escapeHtml(text)}</span>`;
    });
    emailBodyEl.innerHTML = sanitizedBody.replace(/\n/g, '<br>');

    addInspectionListeners();
    resetTimer(); // This will now use currentTimerDuration
    startTimer();

    classifySafeBtn.disabled = false; classifyPhishingBtn.disabled = false;
}

// Sécurise le contenu HTML en échappant les caractères spéciaux
function escapeHtml(unsafe) {
    if (!unsafe) return ""; return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
 }

// Configure les écouteurs d'événements pour l'inspection des éléments de l'email
function addInspectionListeners() {
    // Fonction pour créer un tooltip dynamique
    function createDynamicTooltip(e, text, type = '') {
        // Supprimer tout tooltip existant
        const existingTooltips = document.querySelectorAll('.tooltip-element');
        existingTooltips.forEach(tooltip => document.body.removeChild(tooltip));
        
        // Créer un nouvel élément tooltip
        const tooltipElement = document.createElement('div');
        tooltipElement.className = `tooltip-element ${type}`;
        tooltipElement.textContent = text;
        tooltipElement.style.position = 'fixed';
        tooltipElement.style.left = e.clientX + 'px';
        tooltipElement.style.top = e.clientY + 'px';
        tooltipElement.style.zIndex = '9999';
        tooltipElement.style.pointerEvents = 'none';
        document.body.appendChild(tooltipElement);
        
        // Retourner l'élément pour pouvoir le supprimer plus tard
        return tooltipElement;
    }
    
    // Fonction pour suivre le mouvement de la souris
    function trackMouseMovement(e, tooltipElement) {
        if (!tooltipElement) return;
        tooltipElement.style.left = e.clientX + 'px';
        tooltipElement.style.top = e.clientY + 'px';
    }
    
    // Gestion de l'expéditeur
    let senderTooltip = null;
    
    emailSenderEl.onmouseover = (e) => {
        const disp = currentEmailData.sender;
        const real = emailSenderEl.getAttribute('data-real-sender');
        
        // Mettre à jour l'affichage d'inspection existant
        if (real && real !== disp) {
            // Créer un tooltip dynamique
            senderTooltip = createDynamicTooltip(e, `🎭 Email affiché: ${disp}\n⚠️ Adresse réelle: ${real}`, 'danger');
        } else {
            // Créer un tooltip dynamique
            senderTooltip = createDynamicTooltip(e, `Expéditeur: ${disp}`);
        }
        
        // Ajouter un écouteur pour suivre le mouvement de la souris
        emailSenderEl.onmousemove = (e) => trackMouseMovement(e, senderTooltip);
    };
    
    emailSenderEl.onmouseout = () => {
        // Supprimer le tooltip lorsque la souris quitte l'élément
        if (senderTooltip) {
            document.body.removeChild(senderTooltip);
            senderTooltip = null;
        }
        
        // Supprimer l'écouteur de mouvement
        emailSenderEl.onmousemove = null;
    };
    
    // Gestion des liens
    const links = emailBodyEl.querySelectorAll('.inspectable.link');
    links.forEach(link => {
        const realLink = link.dataset.realLink;
        let linkTooltip = null;
        
        link.onmouseover = (e) => {
            // Mettre à jour l'affichage d'inspection existant
            
            let tooltipType = '';
            let tooltipText = `Lien cible : ${realLink}`;

            try {
                const url = new URL(realLink.startsWith('http') ? realLink : 'http://' + realLink);
                const senderDomainMatch = currentEmailData.sender.match(/@([^>]+)/);
                const senderDomain = senderDomainMatch ? senderDomainMatch[1] : null;
                
                if (senderDomain && !url.hostname.endsWith(senderDomain) && !isKnownGoodDomain(url.hostname)) {
                    tooltipType = 'warning';
                } else {
                }
            } catch (err) {
                tooltipType = 'danger';
            }
            
            // Créer un tooltip dynamique
            linkTooltip = createDynamicTooltip(e, tooltipText, tooltipType);
            
            // Ajouter un écouteur pour suivre le mouvement de la souris
            link.onmousemove = (e) => trackMouseMovement(e, linkTooltip);
        };
        
        link.onmouseout = () => {
            // Supprimer le tooltip lorsque la souris quitte l'élément
            if (linkTooltip) {
                document.body.removeChild(linkTooltip);
                linkTooltip = null;
            }
            
            // Supprimer l'écouteur de mouvement
            link.onmousemove = null;
        };
        
        link.onclick = (e) => e.preventDefault();
    });
}

 // Vérifie si un nom de domaine est dans la liste des domaines de confiance
function isKnownGoodDomain(hostname) {
    const goodDomains = ['showroomprive.net', 'banquefictive-enligne.com', 'cloud-provider-invoices.com', 'linkedin.com', 'meteofrance.fr', 'vinted.fr', 'impots.gouv.fr', 'chronopost.fr', 'ameli.fr', 'doctolib.fr']; return goodDomains.some(domain => hostname.endsWith(domain));
 }

// Met à jour la position du tooltip en fonction du mouvement de la souris
function updateTooltipPosition(e) {
    if (cursorTooltipEl.classList.contains('hidden')) return;
    
    // Positionner directement le tooltip à la position exacte du curseur
    // Utiliser une position fixe par rapport au curseur
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Positionner le tooltip directement au niveau du curseur
    cursorTooltipEl.style.left = mouseX + 'px';
    cursorTooltipEl.style.top = mouseY + 'px';
}

// Affiche un tooltip avec le texte et le type spécifiés
function showTooltip(text, type = 'normal') {
    cursorTooltipEl.textContent = text;
    cursorTooltipEl.classList.remove('hidden', 'warning', 'danger');
    
    if (type === 'warning') {
        cursorTooltipEl.classList.add('warning');
    } else if (type === 'danger') {
        cursorTooltipEl.classList.add('danger');
    }
    
    // Ajouter un écouteur d'événements pour suivre le curseur
    document.addEventListener('mousemove', updateTooltipPosition);
}

// Masque le tooltip et supprime l'écouteur d'événement de mouvement de souris
function hideTooltip() {
    cursorTooltipEl.classList.add('hidden');
    document.removeEventListener('mousemove', updateTooltipPosition);
}

// Réinitialise le timer avec la durée actuelle configurée
function resetTimer() {
    clearInterval(timerInterval);
    timeLeft = currentTimerDuration; // Use the dynamic duration
    timerEl.textContent = timeLeft;
    timerEl.className = '';
}

// Démarre le timer et gère les événements de temps (avertissements, temps écoulé)
function startTimer() {
     if (!gameActive) return;
     timerInterval = setInterval(() => {
          if (!gameActive) { clearInterval(timerInterval); return; }
         timeLeft--; timerEl.textContent = timeLeft;
         // Adjust warning/danger thresholds based on the current duration, or keep fixed?
         // Let's keep fixed thresholds for simplicity for now (5 and 2 seconds)
         if (timeLeft <= 5 && timeLeft > 2) { timerEl.className = 'warning'; }
         else if (timeLeft <= 2 && timeLeft > 0) { timerEl.className = 'danger'; playSound('tick'); }
         else if (timeLeft <= 0) {
              timerEl.className = 'danger'; clearInterval(timerInterval);
              // Time out counts as error, show feedback popup for it
               handleError("Temps écoulé !");
               showFeedbackPopup(false, currentEmailData, true); // Pass 'true' for timeout scenario
               // Note: Progression to next email now happens via the popup's continue button
         } else { timerEl.className = ''; }
     }, 1000);
}

// Gère la classification d'un email par l'utilisateur et affiche le feedback approprié
function classifyEmail(userChoice) {
    if (!gameActive || !currentEmailData) return;
    
    // Disable buttons during animation
    classifySafeBtn.disabled = true;
    classifyPhishingBtn.disabled = true;
    
    // --- NEW: Record decision time ---
    const decisionTime = currentTimerDuration - timeLeft;
    totalDecisionTime += decisionTime;
    emailsSuccessfullyClassified++;
    
    // Check if the user's choice matches the email type
    const isCorrect = userChoice === currentEmailData.type;
    
    // Play sound based on correctness
    playSound(isCorrect ? 'correct' : 'error');
    
    // Handle correct/incorrect classification
    if (isCorrect) {
        handleCorrect();
        // --- NEW: Update stats for correct classification ---
        if (currentEmailData.type === 'safe') {
            safeEmailsFound++;
        } else if (currentEmailData.type === 'phishing') {
            phishingEmailsFound++;
        }
    } else {
        handleError('wrong_classification');
    }
    
    // --- NEW: Update extended stats display ---
    updateExtendedStatsDisplay();

    // --- NEW: Stop timer before showing feedback popup ---
    clearInterval(timerInterval);

    // Show feedback popup
    showFeedbackPopup(isCorrect, currentEmailData);
}

// Gère les actions suite à une classification correcte (score, son, réduction du timer selon difficulté)
function handleCorrect() {
    score++;
    updateScoreDisplay();
    playSound('correct');

    // Ajuster le timer en fonction du mode de difficulté
    if (gameDifficulty === "easy") {
        // FACILE : Temps fixe de 30 secondes (pas de réduction)
        currentTimerDuration = initialTimerDuration;
    } else if (gameDifficulty === "normal") {
        // NORMAL : Réduction jusqu'à 15 secondes minimum
        currentTimerDuration = Math.max(normalModeMinTime, currentTimerDuration - 1);
    } else if (gameDifficulty === "hardcore") {
        // HARDCORE : Réduction jusqu'à 5 secondes minimum
        currentTimerDuration = Math.max(hardcoreModeMinTime, currentTimerDuration - 1);
    }
}

// Gère les actions suite à une erreur (compteur d'erreurs, barre de sécurité, fin de partie)
function handleError(reason) {
    errors++;
    updateSecurityBar(); 
    // playSound('error'); // Redundant, already called in classifyEmail
    
    // Update errors display
    errorsLeftEl.textContent = `${maxErrors - errors}`; 

    if (errors < maxErrors) {

    } else {
        playSound('game_over_error');
        endGame(false); // Game over, too many errors
        return; // Important: stop further execution in classifyEmail if game ends
    }
}

// Affiche la popup de feedback avec les informations appropriées selon la classification
function showFeedbackPopup(isCorrect, emailData, isTimeout = false) {
    // Set the title and color based on correct/incorrect
    if (isCorrect) {
        feedbackTitleEl.textContent = "Correct !";
        feedbackTitleEl.style.color = getCssVariableValue('--safe-color');
    } else {
        feedbackTitleEl.textContent = "Erreur !";
        feedbackTitleEl.style.color = getCssVariableValue('--phishing-color');
    }
    
    // Set explanation text
    if (isTimeout) {
        feedbackExplanationEl.textContent = "Vous avez mis trop de temps à analyser cet email.";
    } else {
        feedbackExplanationEl.textContent = isCorrect ? 
            "Vous avez correctement identifié cet email." : 
            "Vous n'avez pas correctement identifié cet email.";
    }
    
    // Add clues/explanation about the email
    feedbackCluesEl.innerHTML = "";
    const cluesList = document.createElement('ul');
    
    emailData.clues.forEach(clue => {
        const clueItem = document.createElement('li');
        
        // Diviser l'indice en deux parties : technique et explication
        if (clue.includes(':')) {
            const [technique, explanation] = clue.split(':', 2);
            
            // Créer l'élément pour la technique (avant les deux points)
            const techniqueSpan = document.createElement('span');
            techniqueSpan.textContent = technique + ' :';
            techniqueSpan.className = 'clue-technique';
            
            // Créer l'élément pour l'explication (après les deux points)
            const explanationSpan = document.createElement('span');
            explanationSpan.textContent = explanation;
            explanationSpan.className = 'clue-explanation';
            
            // Ajouter les deux parties à l'élément de liste
            clueItem.appendChild(techniqueSpan);
            clueItem.appendChild(explanationSpan);
        } else {
            // Si pas de deux points, afficher tel quel
            clueItem.textContent = clue;
        }
        
        cluesList.appendChild(clueItem);
    });
    
    feedbackCluesEl.appendChild(cluesList);
    
    // Force critical styles before making visible, to combat flicker
    feedbackModalEl.style.position = 'fixed';
    feedbackModalEl.style.top = '0px';
    feedbackModalEl.style.left = '0px';
    feedbackModalEl.style.width = '100%'; // Use 100% instead of vw/vh for robustness here
    feedbackModalEl.style.height = '100%';
    feedbackModalEl.style.display = 'flex';
    feedbackModalEl.style.justifyContent = 'center';
    feedbackModalEl.style.alignItems = 'center';
    // Opacity and visibility are handled by CSS classes

    // Delay adding 'visible' to allow browser to process styles
    setTimeout(() => {
        feedbackModalEl.classList.add('visible');
    }, 0);
}

 // --- Event Listener for the Popup Continue Button ---
 feedbackContinueBtn.addEventListener('click', () => {
     feedbackModalEl.classList.remove('visible');
     secuGuyContainer.classList.remove('visible');
     secuGuyContainer.classList.add('hidden');
     playSound('click'); // Sound for button click
     
     // Check if game over
     if (errors >= maxErrors) {
         endGame(false);
         return;
     }
     
     // Move to next email
     currentEmailIndex++;
     if (currentEmailIndex >= shuffledEmails.length) {
         endGame(true); // Win if we've gone through all emails
     } else {
         // Enable auto-analyze for next email
         autoAnalyzeBtn.disabled = false;
         
         // Load next email
         loadEmail(shuffledEmails[currentEmailIndex]);
     }
 });

function updateScoreDisplay() { scoreEl.textContent = score; }

// --- NEW: Function to update extended statistics display ---
function updateExtendedStatsDisplay() {
    if (safeMailsFoundEl) safeMailsFoundEl.textContent = safeEmailsFound;
    if (phishingMailsFoundEl) phishingMailsFoundEl.textContent = phishingEmailsFound;
    if (avgDecisionTimeEl) {
        if (emailsSuccessfullyClassified > 0) {
            const avgTime = (totalDecisionTime / emailsSuccessfullyClassified).toFixed(1);
            avgDecisionTimeEl.textContent = `${avgTime}s`;
        } else {
            avgDecisionTimeEl.textContent = "N/A";
        }
    }
}

function getCssVariableValue(variableName) { return getComputedStyle(document.documentElement).getPropertyValue(variableName); }

function updateSecurityBar() {
    const percentage = Math.max(0, ((maxErrors - errors) / maxErrors) * 100);
    securityBarEl.style.width = `${percentage}%`; 
    errorsLeftEl.textContent = `${maxErrors - errors}`; 
    if (percentage <= 25) {
        securityBarEl.style.backgroundColor = getCssVariableValue('--phishing-color');
    } else if (percentage <= 50) {
        securityBarEl.style.backgroundColor = getCssVariableValue('--warning-color');
    } else {
        securityBarEl.style.backgroundColor = getCssVariableValue('--safe-color');
    }
}

function useAutoAnalyze() { 
    if (autoAnalyzesLeft > 0 && gameActive) { 
        // Diminuer le nombre d'analyses auto disponibles
        autoAnalyzesLeft--; 
        updateAutoAnalyzeDisplay(); 
        
        // Arrêter le décompte du temps
        clearInterval(timerInterval);
        
        // Afficher l'image du gars de la sécurité
        secuGuyContainer.classList.remove('hidden');
        secuGuyContainer.classList.add('visible');
        
        // Afficher la popup de feedback avec un délai pour voir l'image
        setTimeout(() => {
            // Classifier l'email automatiquement
            classifyEmail(currentEmailData.type);
        }, 500);
    } 
}

function updateAutoAnalyzeDisplay() { autoAnalyzesLeftEl.textContent = autoAnalyzesLeft; autoAnalyzeBtn.disabled = autoAnalyzesLeft <= 0; }

// Tableau de rangs global pour être utilisé par plusieurs fonctions
const RANKS = [
    { emoji: "🥇", title: "Chuck Norris de la Cybersécurité", desc: "Il a trouvé une faille dans le temps, l'a patchée, et redémarré l'univers sans downtime.", appreciation: "Super méga giga ultra top excellent" },
    { emoji: "🥈", title: "Batman (version cybersécurité)", desc: "N'a aucun pouvoir mais des scripts pour tout. Il a un BatSIEM.", appreciation: "Épique en toute circonstance" },
    { emoji: "🥉", title: "Edward Snowden", desc: "Il sait tout, voit tout, sauf ton historique YouTube... trop dark.", appreciation: "Héroïque mais humble" },
    { emoji: "🧠", title: "Mr Robot (Elliot Alderson)", desc: "Il code dans sa tête et déploie dans tes rêves.", appreciation: "Stylé comme un terminal noir" },
    { emoji: "🧞‍♂️", title: "Tony Stark (mais sans l'armure)", desc: "Trop occupé à parler pour patcher, mais il te vendrait un ransomware comme un produit Apple.", appreciation: "Solide comme une VM qui redémarre pas" },
    { emoji: "🕶️", title: "Neo (de Matrix)", desc: "A vu les paquets réseau tomber au ralenti. \"There is no firewall\".", appreciation: "Respectable (même en chaussettes)" },
    { emoji: "💼", title: "Fox Mulder", desc: "Il croit que le phishing est fait par les extraterrestres. Il n'a pas tort.", appreciation: "Pas mal du tout, vraiment" },
    { emoji: "👓", title: "Q (de James Bond)", desc: "Inventeur de gadgets inutiles mais stylés, genre le stylo USB qui clignote quand tu te fais hacker.", appreciation: "Prometteur à condition d'éviter les cafés renversés" },
    { emoji: "🎮", title: "Lara Croft (spécialiste des ruines numériques)", desc: "Elle récupère des backups dans des serveurs oubliés de tous depuis 1998.", appreciation: "On sent le potentiel" },
    { emoji: "🍕", title: "Peter Parker (stagiaire en cybersécu)", desc: "Il est rapide… sauf pour répondre aux tickets. Il préfère les toiles aux câbles réseau.", appreciation: "Correct mais cliquouille" },
    { emoji: "🛸", title: "Rick Sanchez", desc: "Il a créé un malware intelligent par accident. Depuis, il lui parle parfois.", appreciation: "Peut mieux faire" },
    { emoji: "📼", title: "MacGyver", desc: "A redémarré un datacenter avec un trombone, une pile et un vieux modem 56k.", appreciation: "Un peu mieux que rien" },
    { emoji: "🧓", title: "Obi-Wan Kenobi", desc: "\"Le mot de passe que tu cherches n'est plus là, jeune padawan.\"", appreciation: "Mouais… bof" },
    { emoji: "💩", title: "Jar Jar Binks", desc: "Tente d'aider... déclenche une fuite de données.", appreciation: "Pas fameux" },
    { emoji: "🛴", title: "Steve Urkel (version admin réseau)", desc: "\"C'est pas moi qui ai crashé le serveur ? Oups.\"", appreciation: "Assez pathétique" },
    { emoji: "🧃", title: "Kevin, 3e stagiaire non payé", desc: "Il confond phishing et pêche à la ligne. Mais il a de la bonne volonté.", appreciation: "Affligeant mais divertissant" },
    { emoji: "🚽", title: "Ron Weasley (sans baguette)", desc: "Fait disparaître les tickets... sans les résoudre.", appreciation: "Presque gênant" },
    { emoji: "🐌", title: "Bob l'Éponge", desc: "Toujours connecté. Mais à quoi ? On ne sait pas.", appreciation: "Pathétique tout court" },
    { emoji: "🥴", title: "Homer Simpson (RSSI par accident)", desc: "Il a cliqué sur \"Mettre à jour plus tard\" 126 fois. Le SI tient encore. On ne sait pas pourquoi.", appreciation: "Très pathétique" }
];

// Helper function to get rank details (index and object)
function getRankDetails(finalScore) {
    const totalEmails = emails.length;
    let rankIndex;

    if (finalScore === 0) rankIndex = RANKS.length - 1; // Homer
    else if (finalScore === 1) rankIndex = RANKS.length - 2; // Bob l'Éponge
    else if (finalScore === 2) rankIndex = RANKS.length - 3; // Ron Weasley
    else if (finalScore <= 4) rankIndex = RANKS.length - 4; // Kevin, 3e stagiaire
    else {
        const scorePercentage = totalEmails > 0 ? (finalScore / totalEmails) * 100 : 0;
        if (scorePercentage >= 80) rankIndex = 0; // Chuck Norris
        else if (scorePercentage >= 70) rankIndex = 1; // Batman
        else if (scorePercentage >= 60) rankIndex = 2; // Edward Snowden
        else if (scorePercentage >= 50) rankIndex = 3; // Mr Robot
        else if (scorePercentage >= 45) rankIndex = 4; // Tony Stark
        else if (scorePercentage >= 40) rankIndex = 5; // Neo
        else if (scorePercentage >= 35) rankIndex = 6; // Fox Mulder
        else if (scorePercentage >= 30) rankIndex = 7; // Q
        else if (scorePercentage >= 25) rankIndex = 8; // Lara Croft
        else if (scorePercentage >= 20) rankIndex = 9; // Peter Parker
        else if (scorePercentage >= 18) rankIndex = 10; // Rick Sanchez
        else if (scorePercentage >= 15) rankIndex = 11; // MacGyver
        else if (scorePercentage >= 12) rankIndex = 12; // Obi-Wan Kenobi
        else if (scorePercentage >= 10) rankIndex = 13; // Jar Jar Binks
        else if (scorePercentage >= 8) rankIndex = 14; // Steve Urkel
        else if (scorePercentage >= 6) rankIndex = RANKS.length - 4; // Kevin, 3e stagiaire (matches fixed score)
        else if (scorePercentage >= 4) rankIndex = RANKS.length - 3; // Ron Weasley (matches fixed score)
        else if (scorePercentage >= 2) rankIndex = RANKS.length - 2; // Bob l'Éponge (matches fixed score)
        else rankIndex = RANKS.length - 1; // Homer (default for very low percentages if score > 4)
    }
    return { index: rankIndex, rank: RANKS[rankIndex] };
}

// Fonction pour obtenir le rang en fonction du score (titre formaté avec emoji)
function getRank(finalScore) {
    const { rank } = getRankDetails(finalScore);
    return `${rank.emoji} ${rank.title}`;
}

// Fonction pour obtenir l'appréciation correspondant au rang
function getAppreciation(finalScore) {
    const { rank } = getRankDetails(finalScore);
    return rank.appreciation;
}

// Fonction pour obtenir la description du rang
function getRankDescription(finalScore) {
    const { rank } = getRankDetails(finalScore);
    return rank.desc;
}

// --- MODIFIED: Ensures feedback modal is hidden ---
function endGame(won) {
    gameActive = false;
    clearInterval(timerInterval);
    
    // Ensure the feedback modal is hidden
    feedbackModalEl.classList.remove('visible');
    
    // Hide tooltip at end of game
    hideTooltip();
    
    // Hide game UI
    gameUi.classList.add('hidden');
    
    // Show game over screen
    gameOverScreen.classList.remove('hidden');
    
    // Obtenir les détails du rang actuel
    const { index: currentIndex, rank: currentRank } = getRankDetails(score);
    const appreciation = currentRank.appreciation; // Utilisé pour le message de score

    // Calculer le pourcentage de réussite
    const percentageScore = emails.length > 0 ? ((score / emails.length) * 100).toFixed(0) : 0;
    
    // Set final score with appreciation and percentage
    finalScoreEl.innerHTML = `<span class="score-diploma">Vous avez atteint le score <strong>${appreciation}</strong> de ${score} sur ${emails.length} (${percentageScore}%)</span>`;
    
    // --- Nouvelle logique pour le cylindre fixe avec rangs précédent, actuel et suivant ---
    const previousRankPanel = document.querySelector('.previous-rank');
    const currentRankPanel = document.querySelector('.current-rank');
    const nextRankPanel = document.querySelector('.next-rank');
    
    if (previousRankPanel && currentRankPanel && nextRankPanel) {
        // Déterminer les indices des rangs précédent et suivant
        const previousIndex = Math.max(0, currentIndex - 1);
        const nextIndex = Math.min(RANKS.length - 1, currentIndex + 1);
        
        // Obtenir les rangs
        const previousRank = RANKS[previousIndex];
        const currentRank = RANKS[currentIndex];
        const nextRank = RANKS[nextIndex];
        
        // Fonction pour générer le contenu HTML d'un panneau
        // Ajout d'une classe pour les titres longs (plus de 30 caractères)
        const generatePanelHTML = (rank) => {
            const titleClass = rank.title.length > 30 ? 'long-title' : '';
            return `
                <div class="rank-panel-header">
                    <span class="rank-emoji">${rank.emoji}</span>
                    <span class="rank-title ${titleClass}">${rank.title}</span>
                </div>
                <p class="rank-description">${rank.desc}</p>
            `;
        };
        
        // Afficher les rangs dans leurs panneaux respectifs
        previousRankPanel.innerHTML = generatePanelHTML(previousRank);
        currentRankPanel.innerHTML = generatePanelHTML(currentRank);
        nextRankPanel.innerHTML = generatePanelHTML(nextRank);
        
        // Si le rang actuel est le premier ou le dernier, ajuster l'affichage
        if (currentIndex === 0) {
            // Premier rang, masquer le panneau précédent
            previousRankPanel.style.visibility = 'hidden';
        } else if (currentIndex === RANKS.length - 1) {
            // Dernier rang, masquer le panneau suivant
            nextRankPanel.style.visibility = 'hidden';
        }
    } else {
        console.error("Un ou plusieurs éléments du cylindre fixe n'ont pas été trouvés !");
    }
    // L'ancien finalRankEl.innerHTML n'est plus nécessaire.
    
    // Set title and message based on win/loss
    if (won) {
        gameOverTitleEl.textContent = "MISSION ACCOMPLIE";
        gameOverTitleEl.style.color = getCssVariableValue('--safe-color');
        gameOverMessageEl.textContent = `Félicitations ${playerName} ! Vous avez protégé l'entreprise.`;
        
        // Code de certification supprimé pour alléger l'interface
    } else {
        gameOverTitleEl.textContent = "MISSION ÉCHOUÉE";
        gameOverTitleEl.style.color = getCssVariableValue('--phishing-color');
        gameOverMessageEl.textContent = `Dommage ${playerName}. L'entreprise a été compromise.`;
    }
    
    // Afficher le mode de jeu utilisé (pour tous les cas)
    let difficultyEmoji = "🔰";
    let difficultyName = "FACILE";
    let difficultyDesc = "Mode stagiaire (30 secondes fixes)";
    
    if (gameDifficulty === "normal") {
        difficultyEmoji = "⚠️";
        difficultyName = "NORMAL";
        difficultyDesc = "Mode pro (temps réduit jusqu'à 15 secondes)";
    } else if (gameDifficulty === "hardcore") {
        difficultyEmoji = "💀";
        difficultyName = "HARDCORE";
        difficultyDesc = "Mode cyberlégendaire (temps réduit jusqu'à 5 secondes)";
    }
    
    const gameModeMsgEl = document.getElementById('game-mode-message');
    gameModeMsgEl.innerHTML = `<div class="game-mode-info">
        <strong>${difficultyEmoji} Mode ${difficultyName}</strong><br>
        ${difficultyDesc}
    </div>`;
}

// --- Event Listener for Enter key on Feedback Popup ---
document.addEventListener('keydown', function(event) {
    // Check if the feedback modal is visible and the Enter key was pressed
    if (feedbackModalEl.classList.contains('visible') && event.key === 'Enter') {
        // Prevent default action of Enter key (e.g., submitting a form if any)
        event.preventDefault();
        // Simulate a click on the continue button
        feedbackContinueBtn.click();
        // Optionnel : jouer un son de clic si vous le souhaitez
        // playSound('click'); 
    }
});

// --- Event Listeners ---
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

classifySafeBtn.addEventListener('click', () => classifyEmail('safe'));
classifyPhishingBtn.addEventListener('click', () => classifyEmail('phishing'));
autoAnalyzeBtn.addEventListener('click', useAutoAnalyze);

// Gestionnaires d'événements pour les options de difficulté
document.querySelectorAll('.difficulty-option').forEach(option => {
    option.addEventListener('click', function() {
        // Sélectionner le bouton radio à l'intérieur de cette option
        const radio = this.querySelector('input[type="radio"]');
        if (radio) {
            radio.checked = true;
            // Effet visuel pour montrer la sélection
            document.querySelectorAll('.difficulty-option').forEach(opt => {
                opt.style.borderColor = 'var(--border-color)';
            });
            this.style.borderColor = 'var(--accent-color)';
        }
    });
});

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    // Comportement normal au chargement
    hideTooltip();
        
    // Initialiser l'affichage des options de difficulté
    const checkedOption = document.querySelector('.difficulty-option input[type="radio"]:checked');
        if (checkedOption) {
            const parentOption = checkedOption.closest('.difficulty-option');
            if (parentOption) {
                parentOption.style.borderColor = 'var(--accent-color)';
            }
        }
    }
);
