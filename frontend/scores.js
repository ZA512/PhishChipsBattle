// ============================================================
//  scores.js – Classements PhishChipsBattle
// ============================================================

// --- Difficulty state (global, applies to all tabs) ---
let activeDifficulty = ''; // '' = tous niveaux

// --- Month helpers ---
function nowYYYYMM() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function prevMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// --- Medal helper ---
function medal(i) {
    if (i === 0) return '<span class="medal-1">🥇</span>';
    if (i === 1) return '<span class="medal-2">🥈</span>';
    if (i === 2) return '<span class="medal-3">🥉</span>';
    return `<span class="rank-num">${i + 1}</span>`;
}

// --- Streak badge ---
function streakBadge(streak) {
    if (!streak || streak < 2) return '';
    return `<span class="streak" title="${streak} mois consécutifs dans le top 10">🔥${streak}</span>`;
}

// --- Players table ---
function renderPlayersTable(rows, showStreak = false) {
    if (!rows || rows.length === 0) {
        return '<p class="empty-state">Aucune partie terminée pour cette période.</p>';
    }
    return `<table>
        <thead><tr>
            <th>#</th><th>Pseudo</th><th>Service</th><th>Meilleur score</th><th>Parties</th>
        </tr></thead>
        <tbody>
        ${rows.map((r, i) => `<tr>
            <td>${medal(i)}</td>
            <td>${escHtml(r.name)}${showStreak ? streakBadge(r.streak) : ''}</td>
            <td>${r.service_name ? escHtml(r.service_name) : '<span style="color:#aaa">—</span>'}</td>
            <td><span class="score-val">${r.best_score}</span></td>
            <td>${r.games_played}</td>
        </tr>`).join('')}
        </tbody>
    </table>`;
}

// --- Services table ---
function renderServicesTable(rows, showStreak = false) {
    if (!rows || rows.length === 0) {
        return '<p class="empty-state">Aucun service avec des parties terminées pour cette période.</p>';
    }
    return `<table>
        <thead><tr>
            <th>#</th><th>Service</th><th>Code</th><th>Score moyen*</th><th>Participants</th>
        </tr></thead>
        <tbody>
        ${rows.map((r, i) => `<tr class="clickable-row" data-svcid="${r.id}" data-svcname="${escHtml(r.name)}">
            <td>${medal(i)}</td>
            <td class="service-name">${escHtml(r.name)}${showStreak ? streakBadge(r.streak) : ''}</td>
            <td><code>${escHtml(r.code)}</code></td>
            <td><span class="score-val">${r.avg_best_score}</span></td>
            <td>${r.player_count}</td>
        </tr>`).join('')}
        </tbody>
    </table>`;
}

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Build query string ---
function buildQuery(month, difficulty) {
    const parts = [];
    if (month) parts.push(`month=${encodeURIComponent(month)}`);
    if (difficulty) parts.push(`difficulty=${encodeURIComponent(difficulty)}`);
    return parts.length ? '?' + parts.join('&') : '';
}

// --- Fetch helpers ---
async function fetchPlayers(month, difficulty) {
    const res = await fetch(`/api/scores/players${buildQuery(month, difficulty)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function fetchServices(month, difficulty) {
    const res = await fetch(`/api/scores/services${buildQuery(month, difficulty)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function fetchServiceDetail(id, month, difficulty) {
    const res = await fetch(`/api/scores/services/${id}${buildQuery(month, difficulty)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// --- Tab state ---
let activeTab = 'players-global';
const pmMonth = { current: nowYYYYMM() };
const smMonth = { current: nowYYYYMM() };
let currentModalSvcId = null;
let currentModalMonth = null;

// --- Load per tab ---
async function loadTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));

    if (tab === 'players-global') {
        const el = document.getElementById('players-global-content');
        el.innerHTML = '<p class="loading">Chargement…</p>';
        try {
            const data = await fetchPlayers(null, activeDifficulty);
            el.innerHTML = renderPlayersTable(data.scores, false);
        } catch { el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>'; }
    }
    if (tab === 'players-monthly') {
        renderMonthLabel('pm', pmMonth.current);
        await loadPlayersMonthly();
    }
    if (tab === 'services-global') {
        const el = document.getElementById('services-global-content');
        el.innerHTML = '<p class="loading">Chargement…</p>';
        try {
            const data = await fetchServices(null, activeDifficulty);
            el.innerHTML = renderServicesTable(data.scores, false);
            attachServiceClicks(el, null);
        } catch { el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>'; }
    }
    if (tab === 'services-monthly') {
        renderMonthLabel('sm', smMonth.current);
        await loadServicesMonthly();
    }
}

async function loadPlayersMonthly() {
    const el = document.getElementById('players-monthly-content');
    el.innerHTML = '<p class="loading">Chargement…</p>';
    try {
        const data = await fetchPlayers(pmMonth.current, activeDifficulty);
        el.innerHTML = renderPlayersTable(data.scores, true);
    } catch { el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>'; }
}

async function loadServicesMonthly() {
    const el = document.getElementById('services-monthly-content');
    el.innerHTML = '<p class="loading">Chargement…</p>';
    try {
        const data = await fetchServices(smMonth.current, activeDifficulty);
        el.innerHTML = renderServicesTable(data.scores, true);
        attachServiceClicks(el, smMonth.current);
    } catch { el.innerHTML = '<p class="empty-state">Erreur de chargement.</p>'; }
}

function renderMonthLabel(prefix, ym) {
    document.getElementById(`${prefix}-label`).textContent = formatMonth(ym);
}

function attachServiceClicks(container, month) {
    container.querySelectorAll('.clickable-row[data-svcid]').forEach((row) => {
        row.addEventListener('click', () => openServiceModal(row.dataset.svcid, row.dataset.svcname, month));
    });
}

// --- Service detail modal ---
async function openServiceModal(svcId, svcName, month) {
    currentModalSvcId = svcId;
    currentModalMonth = month;
    document.getElementById('modal-service-name').textContent = svcName;
    document.getElementById('modal-service-stats').textContent = 'Chargement…';
    document.getElementById('modal-top10').innerHTML = '';
    document.getElementById('modal-others').innerHTML = '';
    document.getElementById('modal-others-section').style.display = 'none';
    document.getElementById('service-modal').classList.add('open');

    try {
        const data = await fetchServiceDetail(svcId, month, activeDifficulty);
        const topN = data.topN || 10;
        document.getElementById('modal-service-stats').innerHTML =
            `Score moyen (top&nbsp;${topN}) : <strong>${data.avgBestScore}</strong> ` +
            `| ${data.playerCount} participant(s)` +
            `${month ? ' – ' + formatMonth(month) : ' – tous temps'}` +
            `${data.difficulty ? ' – ' + diffLabel(data.difficulty) : ''}`;

        document.getElementById('modal-top10').innerHTML = renderPlayersTable(data.top10, !!month);

        if (data.others && data.others.length > 0) {
            document.getElementById('modal-others-section').style.display = 'block';
            document.getElementById('modal-others').innerHTML = renderPlayersTable(data.others, false);
        }
    } catch {
        document.getElementById('modal-service-stats').textContent = 'Erreur de chargement.';
    }
}

function diffLabel(d) {
    const map = { easy: '🔰 Facile', normal: '⚠️ Normal', hardcore: '💀 Hardcore' };
    return map[d] || d;
}

// --- Difficulty buttons ---
document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        activeDifficulty = btn.dataset.diff;
        document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('active', b === btn));
        // Reload active tab with new difficulty
        loadTab(activeTab);
        // If modal is open, reload it too
        if (document.getElementById('service-modal').classList.contains('open') && currentModalSvcId) {
            openServiceModal(currentModalSvcId, document.getElementById('modal-service-name').textContent, currentModalMonth);
        }
    });
});

// --- Init ---
document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadTab(btn.dataset.tab));
});

// Month nav – Players monthly
document.getElementById('pm-prev').addEventListener('click', async () => {
    pmMonth.current = prevMonth(pmMonth.current);
    renderMonthLabel('pm', pmMonth.current);
    await loadPlayersMonthly();
});
document.getElementById('pm-next').addEventListener('click', async () => {
    pmMonth.current = nextMonth(pmMonth.current);
    renderMonthLabel('pm', pmMonth.current);
    await loadPlayersMonthly();
});

// Month nav – Services monthly
document.getElementById('sm-prev').addEventListener('click', async () => {
    smMonth.current = prevMonth(smMonth.current);
    renderMonthLabel('sm', smMonth.current);
    await loadServicesMonthly();
});
document.getElementById('sm-next').addEventListener('click', async () => {
    smMonth.current = nextMonth(smMonth.current);
    renderMonthLabel('sm', smMonth.current);
    await loadServicesMonthly();
});

// Modal close
document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('service-modal').classList.remove('open');
});
document.getElementById('service-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// Load default tab
loadTab('players-global');
