const CONFIG = window.ATG_CONFIG;
const $ = (id) => document.getElementById(id);
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const nowEtMs = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();

const DEFAULT_STATE = {
  matches: CONFIG.matches,
  picks: {},
  results: {},
  overrides: {},
  updatedAt: null,
  updatedBy: 'System'
};

let state = structuredClone(DEFAULT_STATE);
let role = null;
let db = null;
let stateRef = null;
let auditRef = null;
let historyRef = null;
let useFirebase = false;
let unsub = null;
let firebaseApi = null;

function setSyncStatus(text, mode=''){
  const el = $('firebaseStatus');
  if(!el) return;
  el.textContent = text;
  el.classList.remove('win','loss','draw');
  if(mode) el.classList.add(mode);
}

async function initFirebase(){
  try{
    if(!CONFIG.firebase?.enabled) throw new Error('Firebase disabled in data.js');
    if(!CONFIG.firebase.config?.projectId) throw new Error('Missing Firebase projectId in data.js');

    setSyncStatus('Loading Firebase SDK...', 'draw');

    const appModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');

    firebaseApi = {
      initializeApp: appModule.initializeApp,
      getFirestore: firestoreModule.getFirestore,
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      setDoc: firestoreModule.setDoc,
      onSnapshot: firestoreModule.onSnapshot,
      collection: firestoreModule.collection,
      addDoc: firestoreModule.addDoc,
      getDocs: firestoreModule.getDocs,
      serverTimestamp: firestoreModule.serverTimestamp,
      query: firestoreModule.query,
      orderBy: firestoreModule.orderBy,
      limit: firestoreModule.limit
    };

    const app = firebaseApi.initializeApp(CONFIG.firebase.config);
    db = firebaseApi.getFirestore(app);
    stateRef = firebaseApi.doc(db, ...CONFIG.firebase.statePath);
    auditRef = firebaseApi.collection(db, ...CONFIG.firebase.auditCollection);
    historyRef = firebaseApi.collection(db, ...CONFIG.firebase.historyCollection);
    useFirebase = true;
    setSyncStatus('Firebase SDK loaded', 'win');
    return true;
  }catch(err){
    useFirebase = false;
    console.error('Firebase startup failed:', err);
    setSyncStatus('Firebase failed to load', 'loss');
    alert('Firebase failed to load. This is usually caused by blocked Firebase scripts, an incorrect Firebase config, or GitHub Pages serving an older cached file. Open the browser console for the exact error.');
    return false;
  }
}

async function loadState(){
  if(useFirebase){
    try{
      setSyncStatus('Loading Firebase...', 'draw');
      const snap = await firebaseApi.getDoc(stateRef);
      if(snap.exists()) state = normalizeState(snap.data());
      else await saveState('System', 'Initialized competition state');
      unsub = firebaseApi.onSnapshot(stateRef, (docSnap) => {
        if(docSnap.exists()){
          state = normalizeState(docSnap.data());
          setSyncStatus('Live sync active', 'win');
          renderAll();
        }
      }, (err) => {
        console.error('Firebase listener failed:', err);
        setSyncStatus('Firebase read failed', 'loss');
        alert('Firebase read failed. Check Firestore security rules and project settings.');
      });
      await loadAudit();
      await loadHistory();
    }catch(err){
      console.error('Firebase load failed:', err);
      useFirebase = false;
      setSyncStatus('Firebase failed. Local only', 'loss');
      alert('Firebase failed to load. Data will not sync across devices until Firestore rules and config are fixed.');
      const saved = localStorage.getItem('atg-state');
      if(saved) state = normalizeState(JSON.parse(saved));
    }
  }else{
    const saved = localStorage.getItem('atg-state');
    if(saved) state = normalizeState(JSON.parse(saved));
  }
  renderAll();
}

function normalizeState(input){
  return {
    ...DEFAULT_STATE,
    ...input,
    matches: Array.isArray(input.matches) ? input.matches : CONFIG.matches,
    picks: input.picks || {},
    results: input.results || {},
    overrides: input.overrides || {}
  };
}

async function saveState(actor='System', action='Updated data'){
  state.updatedAt = new Date().toISOString();
  state.updatedBy = actor;
  if(useFirebase){
    try{
      setSyncStatus('Saving to Firebase...', 'draw');
      await firebaseApi.setDoc(stateRef, state, { merge: false });
      await addAudit(actor, action);
      await addHistory(actor);
      setSyncStatus('Saved to Firebase', 'win');
    }catch(err){
      console.error('Firebase save failed:', err);
      setSyncStatus('Firebase save failed', 'loss');
      alert('Firebase save failed. The change was not shared to other devices. Check Firestore security rules.');
      throw err;
    }
  }else{
    localStorage.setItem('atg-state', JSON.stringify(state));
    setSyncStatus('Saved locally only', 'draw');
  }
  renderAll();
}

async function addAudit(actor, action){
  if(!useFirebase) return;
  await firebaseApi.addDoc(auditRef, { actor, action, createdAt: firebaseApi.serverTimestamp(), snapshotTime: new Date().toISOString() });
  await loadAudit();
}

async function addHistory(actor){
  if(!useFirebase) return;
  const standings = calculateStandings();
  await firebaseApi.addDoc(historyRef, { actor, createdAt: firebaseApi.serverTimestamp(), snapshotTime: new Date().toISOString(), standings });
  await loadHistory();
}

async function loadAudit(){
  if(!useFirebase) return;
  const q = firebaseApi.query(auditRef, firebaseApi.orderBy('createdAt', 'desc'), firebaseApi.limit(30));
  const snaps = await firebaseApi.getDocs(q);
  $('auditLog').innerHTML = snaps.docs.map(d => {
    const x = d.data();
    return `<div class="audit-entry"><strong>${escapeHtml(x.actor || 'System')}</strong><br>${escapeHtml(x.action || '')}<br><span class="muted">${formatDateTime(x.snapshotTime)}</span></div>`;
  }).join('') || '<p class="muted">No audit entries yet.</p>';
}

async function loadHistory(){
  if(!useFirebase) return;
  const q = firebaseApi.query(historyRef, firebaseApi.orderBy('createdAt', 'desc'), firebaseApi.limit(15));
  const snaps = await firebaseApi.getDocs(q);
  $('historyLog').innerHTML = snaps.docs.map(d => {
    const x = d.data();
    const leader = (x.standings || [])[0];
    return `<div class="audit-entry"><strong>${leader ? escapeHtml(leader.region.name) : 'No leader'}</strong> led with ${leader ? leader.pts : 0} pts<br><span class="muted">${formatDateTime(x.snapshotTime)} by ${escapeHtml(x.actor || 'System')}</span></div>`;
  }).join('') || '<p class="muted">No history yet.</p>';
}

function getResult(match){ return state.results[match.id] || {}; }
function matchStatus(match){
  const r = getResult(match);
  if(r.status) return r.status;
  if(r.homeGoals !== undefined && r.homeGoals !== null && r.awayGoals !== undefined && r.awayGoals !== null) return 'completed';
  return isLocked(match) ? 'locked' : 'scheduled';
}
function kickoffMs(match){ return new Date(`${match.date}T${match.time || match.timeET || '00:00'}:00-04:00`).getTime(); }
function isLocked(match){ return state.overrides?.[match.id]?.unlocked ? false : nowEtMs() >= kickoffMs(match); }
function isCompleted(match){ return matchStatus(match) === 'completed'; }
function outcome(match){
  const r = getResult(match);
  const hg = Number(r.homeGoals), ag = Number(r.awayGoals);
  if(!Number.isFinite(hg) || !Number.isFinite(ag)) return null;
  if(hg > ag) return 'home';
  if(ag > hg) return 'away';
  return 'draw';
}
function pickGoals(match, pick){
  const r = getResult(match);
  const hg = Number(r.homeGoals), ag = Number(r.awayGoals);
  if(!Number.isFinite(hg) || !Number.isFinite(ag) || pick === 'draw' || !pick) return { gf:0, ga:0 };
  return pick === 'home' ? { gf:hg, ga:ag } : { gf:ag, ga:hg };
}

function calculateStandings(){
  const rows = CONFIG.regions.map(region => ({ region, p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,form:[] }));
  const completed = state.matches.filter(isCompleted).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  for(const match of completed){
    const out = outcome(match);
    if(!out) continue;
    for(const row of rows){
      const pick = state.picks[row.region.id]?.[match.id];
      if(!pick) continue;
      row.p++;
      const goals = pickGoals(match, pick);
      row.gf += goals.gf; row.ga += goals.ga;
      if(pick === out){
        if(out === 'draw'){ row.d++; row.pts += 1; row.form.push('D'); }
        else { row.w++; row.pts += 3; row.form.push('W'); }
      }else{ row.l++; row.form.push('L'); }
    }
  }
  rows.forEach(r => r.gd = r.gf - r.ga);
  rows.sort((a,b)=> b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || a.region.name.localeCompare(b.region.name));
  return rows;
}

function renderAll(){ renderStandings(); renderMatches(); renderAdminForms(); renderDashboard(); renderBracket(); }

function renderStandings(){
  const standings = calculateStandings();
  $('standingsTable').querySelector('tbody').innerHTML = standings.map((r,i)=>`
    <tr><td>${i+1}</td><td><strong>${escapeHtml(r.region.name)}</strong><br><span class="muted">${r.region.members.join(', ')}</span></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="wide-only">${r.gf}</td><td class="wide-only">${r.ga}</td><td>${r.gd}</td><td><strong>${r.pts}</strong></td><td class="wide-only">${renderForm(r.form)}</td></tr>`).join('');
  $('lastUpdated').textContent = state.updatedAt ? `Updated ${formatDateTime(state.updatedAt)} by ${state.updatedBy || 'System'}` : '';
}
function renderForm(form){ return form.slice(-5).map(v=>`<span class="form-pill ${v==='W'?'win':v==='D'?'draw':'loss'}">${v}</span>`).join(' ') || '<span class="muted">None</span>'; }

function filteredMatches(){
  const date = $('dateFilter').value;
  const stage = $('stageFilter').value;
  const view = $('viewFilter').value;
  return state.matches.filter(m => {
    if(stage !== 'all' && m.stage !== stage) return false;
    if(date && m.date !== date) return false;
    if(view === 'today' && m.date !== todayIso()) return false;
    if(view === 'completed' && !isCompleted(m)) return false;
    if(view === 'upcoming' && isCompleted(m)) return false;
    return true;
  }).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function renderMatches(){
  const matches = filteredMatches();
  $('matchesGrid').innerHTML = matches.map(match => {
    const r = getResult(match); const out = outcome(match);
    const score = isCompleted(match) ? `<span class="score">${r.homeGoals} - ${r.awayGoals}</span>` : `<span class="status-pill">${matchStatus(match)}</span>`;
    const picks = CONFIG.regions.map(region => {
      const pick = state.picks[region.id]?.[match.id];
      const correct = out && pick === out ? 'correct' : '';
      return `<div class="pick-row ${correct}"><strong>${escapeHtml(region.name)}</strong><span class="pick-pill">${pickLabel(match,pick)}</span></div>`;
    }).join('');
    return `<article class="match-card ${isLocked(match)?'locked':''}"><div class="match-top"><span>Match ${escapeHtml(match.matchNumber || match.id)} | ${formatDate(match.date)} | ${escapeHtml(match.time || match.timeET || '')} ET</span><span>${escapeHtml(match.group || match.stageLabel || match.stage || '')}</span></div><div class="teams"><span>${escapeHtml(match.home)}</span><span class="vs">vs</span><span>${escapeHtml(match.away)}</span></div><div>${score}</div><p class="muted">${escapeHtml(match.venue || 'Venue TBD')}</p><div class="picks-grid">${picks}</div></article>`;
  }).join('') || '<p class="muted">No matches match your filters.</p>';
}
function pickLabel(match,pick){ if(!pick) return 'No pick'; if(pick==='home') return match.home; if(pick==='away') return match.away; return 'Draw'; }

function renderDashboard(){
  const today = todayIso();
  $('dashToday').textContent = state.matches.filter(m=>m.date===today).length;
  $('dashCompleted').textContent = state.matches.filter(isCompleted).length;
  $('dashPicks').textContent = Object.values(state.picks).reduce((n,p)=> n + Object.keys(p||{}).length, 0);
  const leader = calculateStandings()[0];
  $('dashLeader').textContent = leader ? `${leader.region.name} (${leader.pts})` : 'TBD';
}

function renderBracket(){
  const rounds = {};
  state.matches.filter(m=>m.stage==='knockout').forEach(m => { const key = m.group || 'Knockout'; (rounds[key] ||= []).push(m); });
  $('bracketGrid').innerHTML = Object.keys(rounds).length ? Object.entries(rounds).map(([round,matches])=>`<div class="bracket-round"><h3>${escapeHtml(round)}</h3>${matches.map(m=>`<div class="bracket-match"><strong>${escapeHtml(m.home)}</strong><br>vs<br><strong>${escapeHtml(m.away)}</strong><br><span class="muted">${formatDate(m.date)} ${escapeHtml(m.time||'')} ET</span></div>`).join('')}</div>`).join('') : '<p class="muted">Import knockout matches to display the bracket.</p>';
}

function renderAdminForms(){
  if(!role) return;
  if(role.type === 'region') renderPickForm();
  if(role.type === 'admin'){ renderResultForm(); renderOverrideForm(); }
}
function renderPickForm(){
  $('pickFormList').innerHTML = state.matches.sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).map(match => {
    const current = state.picks[role.regionId]?.[match.id] || '';
    const disabled = isLocked(match) ? 'disabled' : '';
    const draw = match.stage === 'group' ? '<option value="draw">Draw</option>' : '';
    return `<div class="admin-item"><h5>${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</h5><p class="muted">${formatDate(match.date)} ${escapeHtml(match.time||'')} ET | ${escapeHtml(match.venue||'')}</p><select data-pick-match="${match.id}" ${disabled}><option value="">No pick</option><option value="home" ${current==='home'?'selected':''}>${escapeHtml(match.home)}</option>${draw}<option value="away" ${current==='away'?'selected':''}>${escapeHtml(match.away)}</option></select>${disabled?'<p class="muted">Locked at kickoff.</p>':''}</div>`;
  }).join('');
}
function renderResultForm(){
  $('resultFormList').innerHTML = state.matches.map(match => {
    const r = getResult(match);
    return `<div class="admin-item"><h5>${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</h5><div class="field-grid"><label>Home Goals<input type="number" min="0" data-result-home="${match.id}" value="${r.homeGoals ?? ''}"></label><label>Away Goals<input type="number" min="0" data-result-away="${match.id}" value="${r.awayGoals ?? ''}"></label><label>Status<select data-result-status="${match.id}"><option value="scheduled" ${matchStatus(match)==='scheduled'?'selected':''}>Scheduled</option><option value="locked" ${matchStatus(match)==='locked'?'selected':''}>Locked</option><option value="completed" ${matchStatus(match)==='completed'?'selected':''}>Completed</option></select></label><label>Stage<select data-stage="${match.id}"><option value="group" ${match.stage==='group'?'selected':''}>Group</option><option value="knockout" ${match.stage==='knockout'?'selected':''}>Knockout</option></select></label></div></div>`;
  }).join('');
}
function renderOverrideForm(){
  $('overrideList').innerHTML = state.matches.map(match => {
    const picks = CONFIG.regions.map(region => {
      const cur = state.picks[region.id]?.[match.id] || '';
      const draw = match.stage === 'group' ? '<option value="draw">Draw</option>' : '';
      return `<label>${escapeHtml(region.name)}<select data-override-pick="${region.id}|${match.id}"><option value="">No pick</option><option value="home" ${cur==='home'?'selected':''}>${escapeHtml(match.home)}</option>${draw}<option value="away" ${cur==='away'?'selected':''}>${escapeHtml(match.away)}</option></select></label>`;
    }).join('');
    const unlocked = state.overrides?.[match.id]?.unlocked;
    return `<div class="admin-item"><h5>${escapeHtml(match.id)} | ${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</h5><div class="field-grid two">${picks}</div><label><input type="checkbox" data-unlock-match="${match.id}" ${unlocked?'checked':''}> Keep entry unlocked after kickoff</label></div>`;
  }).join('');
}

async function unlock(){
  const code = $('passcodeInput').value.trim();
  if(code === CONFIG.passcodes.superAdmin){ role = { type:'admin', name:'Super Admin' }; }
  else{
    const regionId = Object.entries(CONFIG.passcodes.regions).find(([,pass])=>pass===code)?.[0];
    if(regionId) role = { type:'region', regionId, name: CONFIG.regions.find(r=>r.id===regionId).name };
  }
  if(!role){ $('loginError').textContent = 'Invalid passcode.'; return; }
  $('loginPanel').classList.add('hidden'); $('entryPanel').classList.remove('hidden'); $('activeRole').textContent = `Unlocked: ${role.name}`;
  $('regionalEntry').classList.toggle('hidden', role.type !== 'region'); $('superAdmin').classList.toggle('hidden', role.type !== 'admin');
  renderAdminForms();
}

async function savePicks(){
  const picks = { ...(state.picks[role.regionId] || {}) };
  document.querySelectorAll('[data-pick-match]').forEach(sel => { if(!sel.disabled){ const v = sel.value; if(v) picks[sel.dataset.pickMatch] = v; else delete picks[sel.dataset.pickMatch]; } });
  state.picks[role.regionId] = picks;
  await saveState(role.name, `Saved picks for ${role.name}`);
}
async function saveResults(){
  document.querySelectorAll('[data-result-home]').forEach(input => {
    const id = input.dataset.resultHome;
    const home = input.value === '' ? null : Number(input.value);
    const awayInput = document.querySelector(`[data-result-away="${id}"]`);
    const statusSel = document.querySelector(`[data-result-status="${id}"]`);
    const stageSel = document.querySelector(`[data-stage="${id}"]`);
    const away = awayInput.value === '' ? null : Number(awayInput.value);
    state.results[id] = { homeGoals: home, awayGoals: away, status: statusSel.value };
    const match = state.matches.find(m=>m.id===id); if(match) match.stage = stageSel.value;
  });
  await saveState(role.name, 'Saved match results and recalculated standings');
}
async function saveOverrides(){
  document.querySelectorAll('[data-override-pick]').forEach(sel => {
    const [regionId, matchId] = sel.dataset.overridePick.split('|');
    state.picks[regionId] ||= {};
    if(sel.value) state.picks[regionId][matchId] = sel.value; else delete state.picks[regionId][matchId];
  });
  document.querySelectorAll('[data-unlock-match]').forEach(chk => { state.overrides[chk.dataset.unlockMatch] = { unlocked: chk.checked }; });
  await saveState(role.name, 'Saved admin overrides');
}

function parseGames(raw){
  const text = raw.trim();
  if(!text) return [];
  if(text.startsWith('[')) return JSON.parse(text).map(normalizeGame);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(',').map(h=>h.trim().toLowerCase());
  return lines.map(line => {
    const cols = splitCsv(line); const obj = {};
    headers.forEach((h,i)=>obj[h]=cols[i]?.trim());
    return normalizeGame(obj);
  });
}
function splitCsv(line){
  const out = [];
  let cur = '';
  let quoted = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"'){
      if(quoted && line[i+1] === '"'){ cur += '"'; i++; }
      else quoted = !quoted;
    }else if(ch === ',' && !quoted){
      out.push(cur);
      cur = '';
    }else cur += ch;
  }
  out.push(cur);
  return out.map(v=>v.trim());
}
function normalizeGame(g){
  const id = g.matchId || g.matchid || g.match_number || g.matchnumber || g.id || g['match id'] || g['match number'];
  const date = g.date || g.gameDate || g.gamedate || g['game date'];
  const time = g.timeET || g.timeEt || g.time_et || g.time || g['game time eastern'] || g['game time'];
  const home = g.homeTeam || g.hometeam || g.team_a || g.home || g['home team'];
  const away = g.awayTeam || g.awayteam || g.team_b || g.away || g['away team'];
  const venue = [g.venue, g.city, g.country].filter(Boolean).join(', ') || '';
  const rawStage = g.stage || '';
  const stage = String(rawStage).toLowerCase().startsWith('group') ? 'group' : (String(rawStage).toLowerCase() ? 'knockout' : 'group');
  const group = g.group ? (stage === 'group' && !String(g.group).toLowerCase().startsWith('group') ? `Group ${g.group}` : g.group) : '';
  if(!id || !date || !time || !home || !away) throw new Error('Each game needs match id, game date, game time eastern, home team, and away team.');
  return { id:String(id), matchNumber:id, date, time, timeET:time, timeLocal:g.time_local || '', stage, stageLabel:rawStage, group, home, away, venue, city:g.city || '', country:g.country || '', status:g.status || '', source:g.source || '' };
}
async function loadDefaultSchedule(){
  state.matches = structuredClone(CONFIG.matches).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  await saveState(role.name, `Loaded bundled 104-match schedule`);
  $('dateFilter').value = '';
  $('viewFilter').value = 'all';
  renderAll();
}

async function importGames(){
  try{
    const games = parseGames($('gameImportText').value);
    const existing = new Map(state.matches.map(m=>[m.id,m]));
    games.forEach(g=>existing.set(g.id, { ...existing.get(g.id), ...g }));
    state.matches = [...existing.values()].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    await saveState(role.name, `Imported ${games.length} matches`);
    $('dateFilter').value = '';
    $('viewFilter').value = 'all';
    renderAll();
  }catch(err){ alert(err.message); }
}

function exportCurrentGames(){ download('atg-games.csv', toCsv(state.matches.map(m=>({matchId:m.id,date:m.date,timeET:m.time,homeTeam:m.home,awayTeam:m.away,venue:m.venue,stage:m.stage,group:m.group})))); }
function exportStandingsCsv(){ download('atg-standings.csv', toCsv(calculateStandings().map((r,i)=>({Rank:i+1,Region:r.region.name,P:r.p,W:r.w,D:r.d,L:r.l,GF:r.gf,GA:r.ga,GD:r.gd,Pts:r.pts,Form:r.form.slice(-5).join('')})))); }
function toCsv(rows){ if(!rows.length) return ''; const h=Object.keys(rows[0]); return [h.join(','),...rows.map(r=>h.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(','))].join('\n'); }
function download(name, content){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:'text/csv'})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }

function exportSave(){ $('importText').value = JSON.stringify(state,null,2); }
async function importSave(){ try{ state = normalizeState(JSON.parse($('importText').value)); await saveState(role.name, 'Imported full save data'); }catch(err){ alert('Invalid JSON.'); } }
async function clearData(){ if(confirm('Clear all shared data and reset to defaults?')){ state=structuredClone(DEFAULT_STATE); await saveState(role.name, 'Cleared all shared data'); } }

function wireEvents(){
  $('fifaLink').href = CONFIG.fifaSourceUrl;
  if($('scheduleLink')) $('scheduleLink').href = CONFIG.scheduleSourceUrl || 'https://worldcup2026schedules.com/';
  $('themeToggle').onclick = () => { const d=document.documentElement; const dark=d.dataset.theme!=='dark'; d.dataset.theme=dark?'dark':'light'; localStorage.setItem('atg-theme', d.dataset.theme); $('themeToggle').textContent = dark ? 'Light Mode' : 'Dark Mode'; };
  document.documentElement.dataset.theme = localStorage.getItem('atg-theme') || 'light';
  $('themeToggle').textContent = document.documentElement.dataset.theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  $('dateFilter').value = '';
  $('viewFilter').value = 'all';
  ['dateFilter','stageFilter','viewFilter'].forEach(id=>$(id).onchange=renderMatches);
  $('resetFilters').onclick=()=>{ $('dateFilter').value=''; $('stageFilter').value='all'; $('viewFilter').value='all'; renderMatches(); };
  $('refreshBtn').onclick=renderAll; $('adminOpen').onclick=()=>$('adminDialog').showModal(); $('unlockBtn').onclick=unlock; $('lockBtn').onclick=()=>location.reload();
  $('savePicksBtn').onclick=savePicks; $('saveResultsBtn').onclick=saveResults; $('saveOverridesBtn').onclick=saveOverrides;
  $('loadDefaultScheduleBtn').onclick=loadDefaultSchedule; $('importGamesBtn').onclick=importGames; $('exportGamesBtn').onclick=exportCurrentGames; $('exportBtn').onclick=exportSave; $('importBtn').onclick=importSave; $('clearBtn').onclick=clearData;
  $('exportCsvBtn').onclick=exportStandingsCsv; $('printPdfBtn').onclick=()=>window.print();
  $('csvFileInput').onchange = async e => { const file=e.target.files[0]; if(file) $('gameImportText').value = await file.text(); };
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{ document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); $(btn.dataset.tab).classList.add('active'); });
}

function formatDate(d){ return new Date(`${d}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function formatDateTime(d){ if(!d) return ''; return new Date(d).toLocaleString('en-US',{dateStyle:'short',timeStyle:'short'}); }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

wireEvents();
(async () => {
  await initFirebase();
  await loadState();
})();
