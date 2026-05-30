(function(){
  const REGIONS = [
    { id:'SteveJosh', name:'Steve & Josh', code:'SJ2026', members:'Steve, Josh' },
    { id:'Southeast', name:'Southeast', code:'SE2026', members:'Justin, Ashley' },
    { id:'Interns', name:'Interns', code:'IN2026', members:'Drake, Tucker, Vince' },
    { id:'Texas', name:'Texas', code:'TX2026', members:'Zarin, Gabriella' },
    { id:'Midwest', name:'Midwest', code:'MW2026', members:'Sean, Andrew, Sam' },
    { id:'MidAtlantic', name:'Mid-Atlantic', code:'MA2026', members:'John, Skyler' }
  ];

  const ADMIN_CODE = 'ATG2026ADMIN';
  const KEY = 'atg_wc26_simple_firebase_v1';
  const DOC_PATH = 'competitions/worldcup2026';
  const STAGES = ['All Stages','Group Stage','Round of 32','Round of 16','Quarter-finals','Semi-finals','Third Place','Final'];

  const $ = id => document.getElementById(id);
  const state = loadState();
  let activeRegion = null;
  let adminUnlocked = false;
  let db = null;
  let docRef = null;
  let firebaseReady = false;
  let applyingRemote = false;

  function defaultState(){ return { picks:{}, scores:{}, teams:{}, updatedAt:null }; }

  function loadState(){
    try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch(e) { return defaultState(); }
  }

  function saveLocal(){ localStorage.setItem(KEY, JSON.stringify(state)); }

  function setSyncStatus(message, isBad){
    let el = $('syncStatus');
    if(!el){
      el = document.createElement('div');
      el.id = 'syncStatus';
      el.className = 'sync-status';
      document.querySelector('main').prepend(el);
    }
    el.textContent = message;
    el.classList.toggle('bad', !!isBad);
  }

  function initFirebase(){
    if(!window.ATG_FIREBASE_CONFIG){ setSyncStatus('Firebase config missing. Upload index.html from this ZIP and hard refresh.', true); return; }
    if(!window.firebase || !firebase.firestore){ setSyncStatus('Firebase scripts did not load. Check internet access or script blocking.', true); return; }
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.ATG_FIREBASE_CONFIG);
      db = firebase.firestore();
      docRef = db.doc(DOC_PATH);
      firebaseReady = true;
      setSyncStatus('Firebase sync active.');
      docRef.onSnapshot(snapshot => {
        if(!snapshot.exists){
          saveRemote();
          return;
        }
        const data = snapshot.data() || {};
        applyingRemote = true;
        state.picks = data.picks || {};
        state.scores = data.scores || {};
        state.teams = data.teams || {};
        state.updatedAt = data.updatedAt || null;
        saveLocal();
        applyingRemote = false;
        renderAll();
        renderAdmin();
        setSyncStatus('Firebase sync active.');
      }, err => {
        firebaseReady = false;
        setSyncStatus('Firebase read blocked. Check Firestore rules.', true);
        console.error('Firestore read error:', err);
      });
    } catch(err){
      firebaseReady = false;
      setSyncStatus('Local mode. Firebase failed to initialize.', true);
      console.error('Firebase init error:', err);
    }
  }

  function saveState(){
    state.updatedAt = new Date().toISOString();
    saveLocal();
    if(!applyingRemote) saveRemote();
  }

  function saveRemote(){
    if(!firebaseReady || !docRef) return;
    docRef.set({
      picks: state.picks || {},
      scores: state.scores || {},
      teams: state.teams || {},
      updatedAt: state.updatedAt || new Date().toISOString()
    }, { merge:true }).then(() => {
      setSyncStatus('Saved to Firebase.');
    }).catch(err => {
      setSyncStatus('Saved locally only. Firebase write blocked.', true);
      console.error('Firestore write error:', err);
    });
  }

  function matches(){ return (window.ATG_SCHEDULE || []).map(m => Object.assign({}, m, state.teams[m.id] || {}, state.scores[m.id] || {})); }
  function isKnockout(stage){ return stage !== 'Group Stage'; }
  function resultFor(m){
    if(m.homeScore === null || m.homeScore === undefined || m.awayScore === null || m.awayScore === undefined || m.homeScore === '' || m.awayScore === '') return null;
    const h = Number(m.homeScore), a = Number(m.awayScore);
    if(h > a) return 'HOME';
    if(a > h) return 'AWAY';
    return 'DRAW';
  }
  function pickLabel(m,pick){
    if(!pick) return 'No pick';
    if(pick === 'HOME') return m.homeTeam;
    if(pick === 'AWAY') return m.awayTeam;
    return 'Draw';
  }
  function pointsFor(m,pick){
    const res = resultFor(m);
    if(!res || !pick) return null;
    if(pick === res) return pick === 'DRAW' ? 1 : 3;
    return 0;
  }
  function goalsFor(m,pick){
    const res = resultFor(m);
    if(!res || !pick || pick === 'DRAW') return { gf:0, ga:0 };
    const h = Number(m.homeScore), a = Number(m.awayScore);
    return pick === 'HOME' ? { gf:h, ga:a } : { gf:a, ga:h };
  }
  function calcStandings(){
    const ms = matches();
    return REGIONS.map(r => {
      const row = { region:r.name, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0, form:[] };
      ms.forEach(m => {
        const pick = state.picks[r.id]?.[m.id];
        const pts = pointsFor(m,pick);
        if(pts === null) return;
        row.p += 1;
        if(pts === 3) row.w += 1;
        else if(pts === 1) row.d += 1;
        else row.l += 1;
        row.pts += pts;
        const g = goalsFor(m,pick);
        row.gf += g.gf;
        row.ga += g.ga;
        row.form.push(pts === 3 ? 'W' : pts === 1 ? 'D' : 'L');
      });
      row.gd = row.gf - row.ga;
      row.form = row.form.slice(-5).join(' ');
      return row;
    }).sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.region.localeCompare(b.region));
  }
  function renderStandings(){
    const tbody = document.querySelector('#standingsTable tbody');
    tbody.innerHTML = calcStandings().map((r,i) => `<tr><td>${i+1}. ${esc(r.region)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="hide-sm">${r.gf}</td><td class="hide-sm">${r.ga}</td><td>${r.gd}</td><td>${r.pts}</td><td class="hide-sm">${esc(r.form)}</td></tr>`).join('');
  }
  function renderFilters(){
    $('stageFilter').innerHTML = STAGES.map(s => `<option>${esc(s)}</option>`).join('');
    const dates = ['All Dates', ...new Set(matches().map(m => m.date).sort())];
    $('dateFilter').innerHTML = dates.map(d => `<option value="${esc(d)}">${d === 'All Dates' ? d : prettyDate(d)}</option>`).join('');
  }
  function filteredMatches(){
    const stage = $('stageFilter').value;
    const date = $('dateFilter').value;
    const q = $('searchBox').value.trim().toLowerCase();
    return matches().filter(m => {
      const stageOk = stage === 'All Stages' || m.stage === stage;
      const dateOk = date === 'All Dates' || m.date === date;
      const hay = `${m.homeTeam} ${m.awayTeam} ${m.venue} ${m.city} ${m.country} ${m.stage}`.toLowerCase();
      return stageOk && dateOk && (!q || hay.includes(q));
    });
  }
  function renderMatches(){
    const matchesEl = $('matches');
    const ms = filteredMatches();
    if(!ms.length){ matchesEl.innerHTML = '<div class="panel">No matches found.</div>'; return; }
    matchesEl.innerHTML = ms.map(cardHtml).join('');
    document.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', onPick));
  }
  function cardHtml(m){
    const res = resultFor(m);
    const picks = REGIONS.map(r => {
      const pick = state.picks[r.id]?.[m.id];
      const pts = pointsFor(m,pick);
      const cls = pts === 3 || pts === 1 ? 'correct' : pts === 0 ? 'wrong' : pick === 'DRAW' ? 'draw' : '';
      return `<div class="pick-line"><span>${esc(r.name)}</span><span class="${cls}">${esc(pickLabel(m,pick))}</span></div>`;
    }).join('');
    const current = activeRegion ? state.picks[activeRegion]?.[m.id] : null;
    const options = isKnockout(m.stage) ? ['HOME','AWAY'] : ['HOME','DRAW','AWAY'];
    const buttons = activeRegion ? `<div class="pick-buttons ${isKnockout(m.stage) ? 'knockout' : ''}">${options.map(o => `<button class="pick-btn ${current===o?'active':''}" data-pick="${o}" data-match="${m.id}">${esc(pickLabel(m,o))}</button>`).join('')}</div>` : '<p class="meta">Unlock your region to submit picks.</p>';
    return `<article class="card">
      <div class="card-head"><div><div class="stage">${esc(m.stage)}${m.group ? ' · Group ' + esc(m.group) : ''}</div><div class="meta">Match ${esc(m.id)} · ${prettyDate(m.date)} · ${esc(m.timeET)} ET</div></div><div class="meta">${esc(m.country)}</div></div>
      <div class="teams"><div class="team-row"><span>${esc(m.homeTeam)}</span><span class="score">${scoreText(m.homeScore)}</span></div><div class="team-row"><span>${esc(m.awayTeam)}</span><span class="score">${scoreText(m.awayScore)}</span></div><div class="venue">${esc(m.venue)} · ${esc(m.city)}</div>${res ? `<div class="stage">Result: ${esc(resultName(m,res))}</div>` : ''}</div>
      <div class="pick-panel">${buttons}</div><div class="picks">${picks}</div>
    </article>`;
  }
  function onPick(e){
    if(!activeRegion) return;
    const matchId = e.currentTarget.dataset.match;
    const pick = e.currentTarget.dataset.pick;
    state.picks[activeRegion] = state.picks[activeRegion] || {};
    state.picks[activeRegion][matchId] = pick;
    saveState();
    renderAll();
  }
  function renderAdmin(){
    if(!adminUnlocked){ $('adminTools').innerHTML = ''; $('adminScores').innerHTML = ''; return; }
    $('adminTools').innerHTML = `<div class="admin-actions"><button id="resetLocal" type="button" class="ghost small">Reset local data</button></div>`;
    $('adminScores').innerHTML = matches().map(m => {
      const knockoutFields = isKnockout(m.stage) ? `<input data-home-team="${esc(m.id)}" value="${esc(m.homeTeam)}" placeholder="Home team"><input data-away-team="${esc(m.id)}" value="${esc(m.awayTeam)}" placeholder="Away team"><button data-save-team="${esc(m.id)}" type="button">Teams</button>` : '';
      return `<div class="admin-row"><div>#${esc(m.id)}</div><div class="game-title">${esc(m.homeTeam)} vs ${esc(m.awayTeam)}<br><span class="meta">${prettyDate(m.date)} · ${esc(m.stage)}</span></div>${knockoutFields}<input data-home="${esc(m.id)}" type="number" min="0" value="${m.homeScore ?? ''}" placeholder="Home"><input data-away="${esc(m.id)}" type="number" min="0" value="${m.awayScore ?? ''}" placeholder="Away"><button data-save-score="${esc(m.id)}" type="button">Score</button></div>`;
    }).join('');
    document.querySelectorAll('[data-save-score]').forEach(b => b.addEventListener('click', () => saveScore(b.dataset.saveScore)));
    document.querySelectorAll('[data-save-team]').forEach(b => b.addEventListener('click', () => saveTeams(b.dataset.saveTeam)));
  }

  function saveScore(id){
    const h = document.querySelector(`[data-home="${CSS.escape(id)}"]`).value;
    const a = document.querySelector(`[data-away="${CSS.escape(id)}"]`).value;
    state.scores[id] = { homeScore: h === '' ? null : Number(h), awayScore: a === '' ? null : Number(a) };
    saveState();
    renderAll();
    renderAdmin();
  }
  function saveTeams(id){
    const hEl = document.querySelector(`[data-home-team="${CSS.escape(id)}"]`);
    const aEl = document.querySelector(`[data-away-team="${CSS.escape(id)}"]`);
    if(!hEl || !aEl) return;
    state.teams[id] = { homeTeam: hEl.value.trim() || 'TBD', awayTeam: aEl.value.trim() || 'TBD' };
    saveState();
    renderAll();
    renderAdmin();
  }
  function bind(){
    $('regionSelect').innerHTML = REGIONS.map(r => `<option value="${r.id}">${esc(r.name)} · ${esc(r.members)}</option>`).join('');
    $('regionUnlock').addEventListener('click', () => {
      const r = REGIONS.find(x => x.id === $('regionSelect').value);
      if(r && $('regionCode').value.trim() === r.code){ activeRegion = r.id; $('loginStatus').textContent = `${r.name} unlocked`; }
      else { $('loginStatus').textContent = 'Wrong passcode'; }
      renderMatches();
    });
    $('regionCode').addEventListener('keydown', e => { if(e.key === 'Enter') $('regionUnlock').click(); });
    ['stageFilter','dateFilter','searchBox'].forEach(id => $(id).addEventListener('input', renderMatches));
    $('adminOpen').addEventListener('click', () => {
      if(typeof $('adminDialog').showModal === 'function') $('adminDialog').showModal();
      else $('adminDialog').setAttribute('open','open');
    });
    $('adminUnlock').addEventListener('click', () => {
      adminUnlocked = $('adminCode').value.trim() === ADMIN_CODE;
      $('adminStatus').textContent = adminUnlocked ? 'Admin unlocked' : 'Wrong passcode';
      renderAdmin();
    });
    $('adminCode').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); $('adminUnlock').click(); }});
  }
  function renderAll(){ renderStandings(); renderMatches(); }
  function prettyDate(d){
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function scoreText(v){ return v === null || v === undefined || v === '' ? '-' : esc(v); }
  function resultName(m,res){ return res === 'HOME' ? m.homeTeam : res === 'AWAY' ? m.awayTeam : 'Draw'; }

  bind();
  renderFilters();
  renderAll();
  initFirebase();
})();
