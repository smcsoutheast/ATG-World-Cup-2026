const STORAGE_KEY = 'aroundTheGrounds2026';
const config = window.ATG_CONFIG;
const firebaseSettings = config.firebase || {};

let state = loadState();
let activeRegionId = null;
let isSuperAdmin = false;
let cloud = null;
let cloudReady = false;
let applyingCloudSnapshot = false;

const els = {
  themeToggle: document.getElementById('themeToggle'),
  adminOpen: document.getElementById('adminOpen'),
  adminDialog: document.getElementById('adminDialog'),
  passcodeInput: document.getElementById('passcodeInput'),
  unlockBtn: document.getElementById('unlockBtn'),
  loginError: document.getElementById('loginError'),
  loginPanel: document.getElementById('loginPanel'),
  entryPanel: document.getElementById('entryPanel'),
  activeRole: document.getElementById('activeRole'),
  lockBtn: document.getElementById('lockBtn'),
  regionalEntry: document.getElementById('regionalEntry'),
  superAdmin: document.getElementById('superAdmin'),
  pickFormList: document.getElementById('pickFormList'),
  resultFormList: document.getElementById('resultFormList'),
  savePicksBtn: document.getElementById('savePicksBtn'),
  saveResultsBtn: document.getElementById('saveResultsBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  clearBtn: document.getElementById('clearBtn'),
  importText: document.getElementById('importText'),
  gameImportText: document.getElementById('gameImportText'),
  importGamesBtn: document.getElementById('importGamesBtn'),
  exportGamesBtn: document.getElementById('exportGamesBtn'),
  firebaseStatus: document.getElementById('firebaseStatus'),
  standingsBody: document.querySelector('#standingsTable tbody'),
  matchesGrid: document.getElementById('matchesGrid'),
  dateFilter: document.getElementById('dateFilter'),
  stageFilter: document.getElementById('stageFilter'),
  viewFilter: document.getElementById('viewFilter'),
  resetFilters: document.getElementById('resetFilters'),
  refreshBtn: document.getElementById('refreshBtn'),
  lastUpdated: document.getElementById('lastUpdated')
};

init();

async function init() {
  const savedTheme = localStorage.getItem('atgTheme') || 'light';
  document.body.classList.toggle('dark', savedTheme === 'dark');
  els.themeToggle.textContent = savedTheme === 'dark' ? 'Light Mode' : 'Dark Mode';

  els.dateFilter.value = new Date().toISOString().slice(0, 10);
  bindEvents();
  render();
  await initFirebase();
}

function bindEvents() {
  els.themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('atgTheme', isDark ? 'dark' : 'light');
    els.themeToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  });

  els.adminOpen.addEventListener('click', () => els.adminDialog.showModal());
  els.unlockBtn.addEventListener('click', unlock);
  els.passcodeInput.addEventListener('keydown', event => { if (event.key === 'Enter') unlock(); });
  els.lockBtn.addEventListener('click', lockAdmin);
  els.savePicksBtn.addEventListener('click', saveRegionalPicks);
  els.saveResultsBtn.addEventListener('click', saveResults);
  els.exportBtn.addEventListener('click', exportData);
  els.importBtn.addEventListener('click', importData);
  els.clearBtn.addEventListener('click', clearData);
  els.importGamesBtn.addEventListener('click', importGames);
  els.exportGamesBtn.addEventListener('click', exportGamesTemplate);
  els.resetFilters.addEventListener('click', resetFilters);
  els.refreshBtn.addEventListener('click', render);
  [els.dateFilter, els.stageFilter, els.viewFilter].forEach(el => el.addEventListener('change', render));
}

function defaultState() {
  return { picks: {}, results: {}, matches: config.matches || [], updatedAt: null };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState();
  try {
    const parsed = JSON.parse(saved);
    return {
      picks: parsed.picks || {},
      results: parsed.results || {},
      matches: Array.isArray(parsed.matches) && parsed.matches.length ? parsed.matches : config.matches || [],
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return defaultState();
  }
}

async function initFirebase() {
  updateFirebaseStatus('Local mode');
  if (!firebaseSettings.enabled) return;

  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ]);

    const app = initializeApp(firebaseSettings.config);
    const db = firestore.getFirestore(app);
    const stateRef = firestore.doc(db, firebaseSettings.collection || 'around-the-grounds', firebaseSettings.document || 'world-cup-2026');

    cloud = {
      save: data => firestore.setDoc(stateRef, sanitizeForCloud(data), { merge: true }),
      clear: () => firestore.setDoc(stateRef, defaultState(), { merge: false })
    };

    firestore.onSnapshot(stateRef, snapshot => {
      if (!snapshot.exists()) {
        cloudReady = true;
        cloud.save(state).catch(handleCloudError);
        updateFirebaseStatus('Firebase connected');
        return;
      }

      applyingCloudSnapshot = true;
      const data = snapshot.data();
      state = normalizeCloudState(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyingCloudSnapshot = false;
      cloudReady = true;
      updateFirebaseStatus('Firebase connected');
      render();
    }, error => handleCloudError(error));
  } catch (error) {
    handleCloudError(error);
  }
}

function normalizeCloudState(data) {
  return {
    picks: data?.picks || {},
    results: data?.results || {},
    matches: Array.isArray(data?.matches) && data.matches.length ? data.matches : config.matches || [],
    updatedAt: data?.updatedAt || null
  };
}

function sanitizeForCloud(data) {
  return {
    picks: data.picks || {},
    results: data.results || {},
    matches: Array.isArray(data.matches) ? data.matches : [],
    updatedAt: data.updatedAt || new Date().toISOString()
  };
}

function updateFirebaseStatus(message) {
  if (els.firebaseStatus) els.firebaseStatus.textContent = message;
}

function handleCloudError(error) {
  console.error(error);
  cloudReady = false;
  updateFirebaseStatus('Firebase not connected. Using local mode.');
}

async function persist() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();

  if (cloud && !applyingCloudSnapshot) {
    try {
      updateFirebaseStatus('Saving to Firebase...');
      await cloud.save(state);
      updateFirebaseStatus('Firebase connected');
    } catch (error) {
      handleCloudError(error);
    }
  }
}

function getMatches() {
  return Array.isArray(state.matches) && state.matches.length ? state.matches : config.matches || [];
}

function resetFilters() {
  els.dateFilter.value = new Date().toISOString().slice(0, 10);
  els.stageFilter.value = 'all';
  els.viewFilter.value = 'today';
  render();
}

function unlock() {
  const code = els.passcodeInput.value.trim();
  els.loginError.textContent = '';

  if (code === config.passcodes.superAdmin) {
    isSuperAdmin = true;
    activeRegionId = null;
    showAdminPanels('Super Admin');
    return;
  }

  const region = config.regions.find(item => config.passcodes.regions[item.id] === code);
  if (region) {
    isSuperAdmin = false;
    activeRegionId = region.id;
    showAdminPanels(region.name);
    return;
  }

  els.loginError.textContent = 'Passcode not recognized.';
}

function showAdminPanels(label) {
  els.loginPanel.classList.add('hidden');
  els.entryPanel.classList.remove('hidden');
  els.activeRole.textContent = `Unlocked: ${label}`;
  els.regionalEntry.classList.toggle('hidden', isSuperAdmin);
  els.superAdmin.classList.toggle('hidden', !isSuperAdmin);
  if (isSuperAdmin) renderResultForms();
  if (activeRegionId) renderPickForms(activeRegionId);
}

function lockAdmin() {
  activeRegionId = null;
  isSuperAdmin = false;
  els.passcodeInput.value = '';
  els.loginPanel.classList.remove('hidden');
  els.entryPanel.classList.add('hidden');
  els.regionalEntry.classList.add('hidden');
  els.superAdmin.classList.add('hidden');
}

function render() {
  renderStandings();
  renderMatches();
  els.lastUpdated.textContent = state.updatedAt ? `Updated ${formatDateTime(state.updatedAt)}` : 'No saved picks yet';
  if (isSuperAdmin) renderResultForms();
  if (activeRegionId) renderPickForms(activeRegionId);
}

function getFilteredMatches() {
  const selectedDate = els.dateFilter.value;
  const stage = els.stageFilter.value;
  const view = els.viewFilter.value;
  const today = new Date().toISOString().slice(0, 10);

  return getMatches().filter(match => {
    const result = state.results[match.id];
    const isComplete = result && Number.isFinite(Number(result.homeGoals)) && Number.isFinite(Number(result.awayGoals));
    if (stage !== 'all' && match.stage !== stage) return false;
    if (view === 'today' && match.date !== selectedDate) return false;
    if (view === 'completed' && !isComplete) return false;
    if (view === 'upcoming' && (isComplete || match.date < today)) return false;
    return true;
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function renderStandings() {
  const rows = calculateStandings();
  els.standingsBody.innerHTML = rows.map((row, index) => `
    <tr>
      <td><span class="rank-pill">${index + 1}</span></td>
      <td><strong>${escapeHtml(row.name)}</strong><br><span class="muted">${escapeHtml(row.members.join(', '))}</span></td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.draws}</td>
      <td>${row.losses}</td>
      <td class="wide-only">${row.gf}</td>
      <td class="wide-only">${row.ga}</td>
      <td>${row.gd}</td>
      <td><strong>${row.points}</strong></td>
      <td class="wide-only">${renderForm(row.form)}</td>
    </tr>
  `).join('');
}

function calculateStandings() {
  return config.regions.map(region => {
    const row = { ...region, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, form: [] };

    getMatches().forEach(match => {
      const pick = state.picks[region.id]?.[match.id];
      const result = state.results[match.id];
      if (!pick || !result || result.homeGoals === '' || result.awayGoals === '') return;

      const homeGoals = Number(result.homeGoals);
      const awayGoals = Number(result.awayGoals);
      if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return;

      const outcome = getOutcome(homeGoals, awayGoals);
      row.played += 1;

      if (pick === outcome) {
        if (outcome === 'draw') {
          row.draws += 1;
          row.points += 1;
          row.form.push('D');
        } else {
          row.wins += 1;
          row.points += 3;
          row.form.push('W');
        }
      } else {
        row.losses += 1;
        row.form.push('L');
      }

      if (pick === 'home') {
        row.gf += homeGoals;
        row.ga += awayGoals;
      } else if (pick === 'away') {
        row.gf += awayGoals;
        row.ga += homeGoals;
      }
    });

    row.gd = row.gf - row.ga;
    row.form = row.form.slice(-5);
    return row;
  }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
}

function renderForm(form) {
  const padded = [...form];
  while (padded.length < 5) padded.unshift('-');
  return `<div class="form-row">${padded.map(item => `<span class="form-pill form-${item.toLowerCase() === '-' ? 'na' : item.toLowerCase()}">${item}</span>`).join('')}</div>`;
}

function renderMatches() {
  const matches = getFilteredMatches();
  if (!matches.length) {
    els.matchesGrid.innerHTML = '<p class="muted">No matches found for this view.</p>';
    return;
  }

  els.matchesGrid.innerHTML = matches.map(match => {
    const result = state.results[match.id];
    const hasScore = result && result.homeGoals !== '' && result.awayGoals !== '';
    const outcome = hasScore ? getOutcome(Number(result.homeGoals), Number(result.awayGoals)) : null;
    return `
      <article class="match-card">
        <div class="match-top">
          <span>${formatDate(match.date)} | ${escapeHtml(match.time)} ET</span>
          <span>${escapeHtml(match.group || stageLabel(match.stage))}</span>
        </div>
        <div class="match-teams">
          <span>${escapeHtml(match.home)}</span>
          <span class="score">${hasScore ? `${result.homeGoals} - ${result.awayGoals}` : 'vs'}</span>
          <span>${escapeHtml(match.away)}</span>
        </div>
        <p class="muted">${escapeHtml(match.venue)}</p>
        <div class="pick-row">
          ${config.regions.map(region => renderPickChip(region, match, outcome)).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderPickChip(region, match, outcome) {
  const pick = state.picks[region.id]?.[match.id] || 'none';
  const label = pickLabel(pick, match);
  const correct = outcome && pick === outcome;
  return `
    <div class="pick-chip ${correct ? 'correct' : ''}">
      <span class="pick-label">${escapeHtml(region.name)}</span>
      <span class="outcome">${escapeHtml(label)}${correct ? ' ✓' : ''}</span>
    </div>
  `;
}

function renderPickForms(regionId) {
  const matches = getFilteredMatches();
  els.pickFormList.innerHTML = matches.map(match => {
    const current = state.picks[regionId]?.[match.id] || '';
    return `
      <div class="admin-item">
        <strong>${formatDate(match.date)} | ${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</strong>
        <span class="muted">${escapeHtml(match.group || stageLabel(match.stage))} | ${escapeHtml(match.time)} ET | ${escapeHtml(match.venue)}</span>
        <div class="pick-controls" data-match-id="${escapeHtml(match.id)}">
          ${radio(match.id, 'home', current, match.home)}
          ${match.stage === 'group' ? radio(match.id, 'draw', current, 'Draw') : ''}
          ${radio(match.id, 'away', current, match.away)}
        </div>
      </div>
    `;
  }).join('');
}

function radio(matchId, value, current, label) {
  return `<label><input type="radio" name="pick-${escapeHtml(matchId)}" value="${value}" ${current === value ? 'checked' : ''}> ${escapeHtml(label)}</label>`;
}

function saveRegionalPicks() {
  if (!activeRegionId) return;
  state.picks[activeRegionId] = state.picks[activeRegionId] || {};
  getFilteredMatches().forEach(match => {
    const selected = document.querySelector(`input[name="pick-${cssEscape(match.id)}"]:checked`);
    if (selected) state.picks[activeRegionId][match.id] = selected.value;
  });
  persist();
}

function renderResultForms() {
  const matches = getFilteredMatches();
  els.resultFormList.innerHTML = matches.map(match => {
    const result = state.results[match.id] || { homeGoals: '', awayGoals: '' };
    return `
      <div class="admin-item">
        <strong>${formatDate(match.date)} | ${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</strong>
        <span class="muted">${escapeHtml(match.group || stageLabel(match.stage))} | ${escapeHtml(match.time)} ET | ${escapeHtml(match.venue)}</span>
        <div class="score-controls" data-match-id="${escapeHtml(match.id)}">
          <label>${escapeHtml(match.home)}<input type="number" min="0" inputmode="numeric" data-score="home" value="${escapeHtml(String(result.homeGoals ?? ''))}"></label>
          <label>${escapeHtml(match.away)}<input type="number" min="0" inputmode="numeric" data-score="away" value="${escapeHtml(String(result.awayGoals ?? ''))}"></label>
        </div>
      </div>
    `;
  }).join('');
}

function saveResults() {
  getFilteredMatches().forEach(match => {
    const homeInput = document.querySelector(`[data-match-id="${cssEscape(match.id)}"] input[data-score="home"]`);
    const awayInput = document.querySelector(`[data-match-id="${cssEscape(match.id)}"] input[data-score="away"]`);
    if (!homeInput || !awayInput) return;
    state.results[match.id] = { homeGoals: homeInput.value, awayGoals: awayInput.value };
  });
  persist();
}

function importGames() {
  try {
    const rows = JSON.parse(els.gameImportText.value);
    if (!Array.isArray(rows)) throw new Error('Game import must be an array.');
    const matches = rows.map(normalizeMatch);
    state.matches = matches;
    removeOrphanedData(matches);
    persist();
    alert(`${matches.length} matches imported.`);
  } catch (error) {
    alert(`Game import failed. ${error.message}`);
  }
}

function normalizeMatch(row, index) {
  const match = {
    id: String(row.id || row.matchId || row.match_id || '').trim(),
    date: String(row.date || row.gameDate || row.game_date || '').trim(),
    time: String(row.time || row.gameTime || row.game_time || '').trim(),
    stage: String(row.stage || 'group').trim().toLowerCase(),
    group: String(row.group || row.round || '').trim(),
    home: String(row.home || row.homeTeam || row.home_team || '').trim(),
    away: String(row.away || row.awayTeam || row.away_team || '').trim(),
    venue: String(row.venue || '').trim()
  };

  if (!match.id) match.id = `match-${index + 1}`;
  if (!match.date || !/^\d{4}-\d{2}-\d{2}$/.test(match.date)) throw new Error(`Match ${match.id} needs a date in YYYY-MM-DD format.`);
  if (!match.time || !/^\d{1,2}:\d{2}$/.test(match.time)) throw new Error(`Match ${match.id} needs a time in HH:MM eastern format.`);
  if (!match.home || !match.away) throw new Error(`Match ${match.id} needs home and away teams.`);
  if (!match.venue) throw new Error(`Match ${match.id} needs a venue.`);
  if (!['group', 'knockout'].includes(match.stage)) match.stage = 'group';
  if (!match.group) match.group = match.stage === 'group' ? 'Group Stage' : 'Knockout';
  return match;
}

function removeOrphanedData(matches) {
  const validIds = new Set(matches.map(match => match.id));
  Object.keys(state.results).forEach(matchId => { if (!validIds.has(matchId)) delete state.results[matchId]; });
  Object.values(state.picks).forEach(regionPicks => {
    Object.keys(regionPicks).forEach(matchId => { if (!validIds.has(matchId)) delete regionPicks[matchId]; });
  });
}

function exportGamesTemplate() {
  const data = JSON.stringify(getMatches(), null, 2);
  navigator.clipboard?.writeText(data);
  els.gameImportText.value = data;
}

function exportData() {
  const data = JSON.stringify(state, null, 2);
  navigator.clipboard?.writeText(data);
  els.importText.value = data;
}

function importData() {
  try {
    const data = JSON.parse(els.importText.value);
    state.picks = data.picks || {};
    state.results = data.results || {};
    state.matches = Array.isArray(data.matches) && data.matches.length ? data.matches.map(normalizeMatch) : getMatches();
    persist();
  } catch (error) {
    alert(`Import failed. ${error.message}`);
  }
}

function clearData() {
  if (!confirm('Clear all picks, scores, and imported matches?')) return;
  state = defaultState();
  persist();
}

function getOutcome(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'home';
  if (awayGoals > homeGoals) return 'away';
  return 'draw';
}

function pickLabel(pick, match) {
  if (pick === 'home') return match.home;
  if (pick === 'away') return match.away;
  if (pick === 'draw') return 'Draw';
  return 'No pick';
}

function stageLabel(stage) {
  return stage === 'knockout' ? 'Knockout' : 'Group Stage';
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${dateString}T12:00:00`));
}

function formatDateTime(dateString) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(dateString));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function cssEscape(value) {
  if (window.CSS && CSS.escape) return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
