'use strict';

const API = '/api';

// Get playerId from URL param
const params = new URLSearchParams(window.location.search);
const playerId = parseInt(params.get('id'), 10);

if (!playerId || isNaN(playerId)) {
  showError('Aucun joueur spécifié. Ajoutez ?id=… dans l'URL.');
} else {
  loadProfile();
}

async function loadProfile() {
  try {
    const [profileRes, achievementsRes] = await Promise.all([
      fetch(`${API}/players/${playerId}/profile`),
      fetch(`${API}/players/${playerId}/achievements`),
    ]);

    if (!profileRes.ok) throw new Error('Joueur introuvable');
    if (!achievementsRes.ok) throw new Error('Erreur lors du chargement des badges');

    const { player, stats } = await profileRes.json();
    const { achievements } = await achievementsRes.json();

    renderProfile(player, stats, achievements);
  } catch (err) {
    showError(err.message);
  }
}

function showError(msg) {
  document.getElementById('loading').style.display = 'none';
  const errorEl = document.getElementById('error');
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

function renderProfile(player, stats, achievements) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';

  // Header
  document.getElementById('avatar').textContent = player.name.slice(0, 2);
  document.getElementById('player-name').textContent = player.name;
  document.getElementById('player-since').textContent =
    `Membre depuis le ${new Date(player.createdAt).toLocaleDateString('fr-FR')}`;

  // Stats
  const statsGrid = document.getElementById('stats-grid');
  const statsData = [
    { value: stats.gamesPlayed, label: 'Parties jouées' },
    { value: stats.bestScore, label: 'Meilleur score' },
    { value: stats.totalScore, label: 'Score total' },
    { value: stats.totalErrors, label: 'Erreurs totales' },
  ];
  statsGrid.innerHTML = statsData.map((s) =>
    `<div class="stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
  ).join('');

  // Achievements
  const unlocked = achievements.filter((a) => a.unlocked);
  document.getElementById('unlocked-count').textContent = unlocked.length;
  document.getElementById('total-count').textContent = achievements.length;
  const pct = achievements.length > 0 ? (unlocked.length / achievements.length * 100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;

  // Category filter
  const categories = [...new Set(achievements.map((a) => a.category))];
  const filterBar = document.getElementById('filter-bar');
  filterBar.innerHTML = `<button class="active" data-cat="all">Tous</button>` +
    categories.map((c) => `<button data-cat="${c}">${categoryLabel(c)}</button>`).join('');

  filterBar.addEventListener('click', (e) => {
    if (!e.target.matches('button')) return;
    filterBar.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    renderAchievements(achievements, e.target.dataset.cat);
  });

  renderAchievements(achievements, 'all');
}

function renderAchievements(achievements, category) {
  const filtered = category === 'all' ? achievements : achievements.filter((a) => a.category === category);
  // Sort: unlocked first, then by tier
  filtered.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return (a.tier || 0) - (b.tier || 0);
  });

  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = filtered.map((a) => {
    const lockedClass = a.unlocked ? '' : ' locked';
    const dateStr = a.unlockedAt
      ? `<div class="achievement-date">Obtenu le ${new Date(a.unlockedAt).toLocaleDateString('fr-FR')}</div>`
      : '';
    return `<div class="achievement-card${lockedClass}">
      <div class="achievement-emoji">${a.emoji || '🔒'}</div>
      <div class="achievement-info">
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.description}</div>
        ${dateStr}
      </div>
    </div>`;
  }).join('');
}

function categoryLabel(cat) {
  const labels = {
    streak: '🎯 Séries',
    speed: '⚡ Vitesse',
    shield: '🛡️ Bouclier',
    endurance: '🏔️ Endurance',
    loyalty: '🏆 Fidélité',
    ranking: '🥇 Classement',
    fun: '🎪 Fun',
  };
  return labels[cat] || cat;
}
