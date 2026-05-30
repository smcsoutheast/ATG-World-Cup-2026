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
  const COUNTRY_CODES = {
    'Algeria':'DZ','Argentina':'AR','Australia':'AU','Austria':'AT','Belgium':'BE','Bosnia and Herzegovina':'BA','Brazil':'BR','Cabo Verde':'CV','Canada':'CA','Colombia':'CO','Congo DR':'CD','Croatia':'HR','Curaçao':'CW','Czechia':'CZ','Côte d’Ivoire':'CI','Ecuador':'EC','Egypt':'EG','England':'GB-ENG','France':'FR','Germany':'DE','Ghana':'GH','Haiti':'HT','Iran':'IR','Iraq':'IQ','Japan':'JP','Jordan':'JO','Korea Republic':'KR','Mexico':'MX','Morocco':'MA','Netherlands':'NL','New Zealand':'NZ','Norway':'NO','Panama':'PA','Paraguay':'PY','Portugal':'PT','Qatar':'QA','Saudi Arabia':'SA','Scotland':'GB-SCT','Senegal':'SN','South Africa':'ZA','Spain':'ES','Sweden':'SE','Switzerland':'CH','Tunisia':'TN','Türkiye':'TR','United States':'US','Uruguay':'UY','Uzbekistan':'UZ'
  };

  const $ = id => document.getElementById(id);
  const state = loadState();
  let activeRegion = null;
  let adminUnlocked = false;
  let db = null;
  let docRef = null;
  let firebaseReady = false;
  let applyingRemote = false;
  let countdownTimer = null;

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

  
  function rawMatches(){ return (window.ATG_SCHEDULE || []).map(m => Object.assign({}, m, state.scores[m.id] || {})); }
  function matches(){
    const base = rawMatches();
    const derived = deriveKnockoutTeams(base);
    return base.map(m => Object.assign({}, m, derived[m.id] || {}));
  }

  function deriveKnockoutTeams(baseMatches){
    const derived = {};
    const byId = {};
    baseMatches.forEach(m => byId[String(m.id)] = Object.assign({}, m));
    const groups = calcGroupStandings(baseMatches);
    const winners = {}, runners = {}, thirds = [];
    Object.keys(groups).forEach(g => {
      const rows = groups[g].rankings || [];
      if(rows[0]) winners[g] = rows[0].team;
      if(rows[1]) runners[g] = rows[1].team;
      if(rows[2]) thirds.push(Object.assign({ group:g }, rows[2]));
    });
    const wildcards = thirds.sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)).slice(0,8);
    const usedThirds = new Set();

    function currentMatch(id){ return Object.assign({}, byId[String(id)] || {}, derived[String(id)] || {}); }
    function matchOutcome(id, want){
      const m = currentMatch(id);
      const res = resultFor(m);
      if(!res || res === 'DRAW') return '';
      if(want === 'Winner') return res === 'HOME' ? m.homeTeam : m.awayTeam;
      if(want === 'Loser') return res === 'HOME' ? m.awayTeam : m.homeTeam;
      return '';
    }
    function resolveSlot(slot){
      const text = String(slot || '');
      let m = text.match(/^Group ([A-L]) Winner$/i);
      if(m) return winners[m[1].toUpperCase()] || text;
      m = text.match(/^Group ([A-L]) Runner-up$/i);
      if(m) return runners[m[1].toUpperCase()] || text;
      m = text.match(/^Group ([A-L\/]+) 3rd Place$/i);
      if(m){
        const allowed = m[1].split('/').map(x => x.trim().toUpperCase());
        const pick = wildcards.find(t => allowed.includes(t.group) && !usedThirds.has(t.group));
        if(pick){ usedThirds.add(pick.group); return pick.team; }
        return text;
      }
      m = text.match(/^Match (\d+) (Winner|Loser)$/i);
      if(m) return matchOutcome(m[1], m[2]) || text;
      return text;
    }

    baseMatches.filter(m => m.stage !== 'Group Stage').sort((a,b) => Number(a.id) - Number(b.id)).forEach(m => {
      const home = resolveSlot(m.homeTeam);
      const away = resolveSlot(m.awayTeam);
      if(home !== m.homeTeam || away !== m.awayTeam){
        derived[String(m.id)] = { homeTeam:home, awayTeam:away };
      }
    });
    return derived;
  }

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

  function calcGroupStandings(sourceMatches){
    const groupMatches = (sourceMatches || rawMatches()).filter(m => m.stage === 'Group Stage' && m.group);
    const groups = {};
    groupMatches.forEach(m => {
      groups[m.group] = groups[m.group] || { teams:{}, matches:[] };
      groups[m.group].matches.push(m);
      [m.homeTeam, m.awayTeam].forEach(team => {
        groups[m.group].teams[team] = groups[m.group].teams[team] || baseTeam(team);
      });
      const res = resultFor(m);
      if(!res) return;
      const h = Number(m.homeScore), a = Number(m.awayScore);
      const home = groups[m.group].teams[m.homeTeam];
      const away = groups[m.group].teams[m.awayTeam];
      home.p++; away.p++;
      home.gf += h; home.ga += a; away.gf += a; away.ga += h;
      if(h > a){ home.w++; away.l++; home.pts += 3; }
      else if(a > h){ away.w++; home.l++; away.pts += 3; }
      else { home.d++; away.d++; home.pts++; away.pts++; }
      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });
    Object.values(groups).forEach(group => group.rankings = rankGroup(Object.values(group.teams), group.matches));
    return groups;
  }

  function baseTeam(team){ return { team, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0, h2hPts:0, h2hGd:0, h2hGf:0 }; }

  function rankGroup(teams, groupMatches){
    const byPoints = {};
    teams.forEach(t => { byPoints[t.pts] = byPoints[t.pts] || []; byPoints[t.pts].push(t); });
    return Object.keys(byPoints).map(Number).sort((a,b) => b-a).flatMap(points => {
      const cluster = byPoints[points];
      if(cluster.length === 1) return cluster;
      const h2h = miniTable(cluster.map(t => t.team), groupMatches);
      return cluster.slice().sort((a,b) => {
        const ha = h2h[a.team] || baseTeam(a.team);
        const hb = h2h[b.team] || baseTeam(b.team);
        return hb.pts - ha.pts || hb.gd - ha.gd || hb.gf - ha.gf || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);
      }).map(t => Object.assign({}, t, { h2hPts:h2h[t.team]?.pts || 0, h2hGd:h2h[t.team]?.gd || 0, h2hGf:h2h[t.team]?.gf || 0 }));
    });
  }

  function miniTable(teamNames, groupMatches){
    const table = {};
    teamNames.forEach(t => table[t] = baseTeam(t));
    groupMatches.forEach(m => {
      if(!teamNames.includes(m.homeTeam) || !teamNames.includes(m.awayTeam)) return;
      const res = resultFor(m);
      if(!res) return;
      const h = Number(m.homeScore), a = Number(m.awayScore);
      const home = table[m.homeTeam];
      const away = table[m.awayTeam];
      home.gf += h; home.ga += a; away.gf += a; away.ga += h;
      if(h > a){ home.pts += 3; }
      else if(a > h){ away.pts += 3; }
      else { home.pts++; away.pts++; }
      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });
    return table;
  }

  function renderGroups(){
    const wrap = $('groupStandings');
    const summary = $('qualifierSummary');
    if(!wrap || !summary) return;
    const groups = calcGroupStandings();
    const keys = Object.keys(groups).sort();
    wrap.innerHTML = keys.map(g => groupTableHtml(g, groups[g].rankings)).join('');
    const winners = keys.map(g => groups[g].rankings[0]).filter(Boolean);
    const runners = keys.map(g => groups[g].rankings[1]).filter(Boolean);
    const thirds = keys.map(g => Object.assign({ group:g }, groups[g].rankings[2])).filter(t => t && t.team).sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team));
    const wildcards = thirds.slice(0,8);
    summary.innerHTML = `<div><h4>Group Winners</h4>${qualifierList(winners)}</div><div><h4>Group Finalists</h4>${qualifierList(runners)}</div><div><h4>Wildcard 3rd Place</h4>${qualifierList(wildcards, true)}</div>`;
  }

  function groupTableHtml(group, rows){
    return `<div class="group-card"><h3>Group ${esc(group)}</h3><div class="group-table-wrap"><table class="group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>GD</th></tr></thead><tbody>${rows.map((r,i) => `<tr class="${i < 2 ? 'qualified' : i === 2 ? 'third-place' : ''}"><td>${i+1}. ${flagFor(r.team)} ${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.pts}</td><td>${r.gd}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function qualifierList(rows, showGroup){
    if(!rows.length) return '<p class="meta">No qualifiers yet.</p>';
    return `<ol>${rows.map(r => `<li>${flagFor(r.team)} ${esc(r.team)}${showGroup ? ` <span class="meta">Group ${esc(r.group)}</span>` : ''}</li>`).join('')}</ol>`;
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
    const locked = isPickLocked(m);
    const lockHtml = lockNoticeHtml(m);
    const buttons = activeRegion
      ? `<div class="pick-buttons ${isKnockout(m.stage) ? 'knockout' : ''}">${options.map(o => `<button class="pick-btn ${current===o?'active':''}" data-pick="${o}" data-match="${m.id}" ${locked ? 'disabled' : ''}>${esc(pickLabel(m,o))}</button>`).join('')}</div>${locked ? '<p class="meta">Picks locked for this match.</p>' : ''}`
      : '<p class="meta">Unlock your region to submit picks.</p>';
    return `<article class="match-card wc-card">
      <div class="wc-card-top">
        <div class="match-pill">Match ${esc(m.id)}</div>
        <div class="date-pill">${prettyLongDate(m.date)} · ${esc(m.timeET)} ET</div>
      </div>
      <div class="wc-match-body">
        ${teamPanelHtml(m.homeTeam, 'Team A', 'home')}
        <div class="vs-column">
          <div class="ball-icon">⚽</div>
          <div class="vs-text">VS</div>
          <div class="group-text">${m.group ? `Group<br>${esc(m.group)}` : esc(m.stage)}</div>
        </div>
        ${teamPanelHtml(m.awayTeam, 'Team B', 'away')}
      </div>
      <div class="match-meta-row">
        <span>${esc(m.stage)}${m.group ? ` · Group ${esc(m.group)}` : ''}</span>
        <span>${esc(m.venue)} · ${esc(m.city)}</span>
        ${res ? `<span class="stage">Result: ${esc(resultName(m,res))}</span>` : ''}
      </div>
      ${lockHtml}
      <div class="pick-panel">${buttons}</div>
      <div class="picks">${picks}</div>
    </article>`;
  }

  function teamPanelHtml(team, label, side){
    const url = flagUrl(team);
    const bg = url ? ` style="background-image:linear-gradient(90deg, rgba(7,19,31,.08), rgba(7,19,31,.08)), url('${esc(url)}')"` : '';
    const placeholder = url ? '' : ' no-flag';
    return `<div class="flag-panel ${side}${placeholder}"${bg}>
      <div class="team-label-card">
        <span>${esc(label)}</span>
        <strong>${esc(team)}</strong>
      </div>
    </div>`;
  }

  function onPick(e){
    if(!activeRegion) return;
    const matchId = e.currentTarget.dataset.match;
    const match = matches().find(m => String(m.id) === String(matchId));
    if(match && isPickLocked(match)){
      $('loginStatus').textContent = 'Picks are locked for this match.';
      return;
    }
    const pick = e.currentTarget.dataset.pick;
    state.picks[activeRegion] = state.picks[activeRegion] || {};
    state.picks[activeRegion][matchId] = pick;
    saveState();
    renderAll();
  }
  function renderAdmin(){
    if(!adminUnlocked){ $('adminTools').innerHTML = ''; $('adminScores').innerHTML = ''; return; }
    $('adminTools').innerHTML = `<div class="admin-actions"><button id="resetLocal" type="button" class="ghost small">Reset local data</button><span class="meta">Knockout teams update automatically from group standings and knockout results.</span></div>`;
    $('adminScores').innerHTML = matches().map(m => {
      return `<div class="admin-row"><div>#${esc(m.id)}</div><div class="game-title">${esc(m.homeTeam)} vs ${esc(m.awayTeam)}<br><span class="meta">${prettyDate(m.date)} · ${esc(m.stage)}</span></div><input data-home="${esc(m.id)}" type="number" min="0" value="${m.homeScore ?? ''}" placeholder="Home"><input data-away="${esc(m.id)}" type="number" min="0" value="${m.awayScore ?? ''}" placeholder="Away"><button data-save-score="${esc(m.id)}" type="button">Score</button></div>`;
    }).join('');
    const resetBtn = $('resetLocal');
    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem(KEY);
        $('adminStatus').textContent = 'Local data reset. Refresh the page to reload Firebase data.';
      });
    }
    document.querySelectorAll('[data-save-score]').forEach(b => b.addEventListener('click', () => saveScore(b.dataset.saveScore)));
  }

  function saveScore(id){
    const h = document.querySelector(`[data-home="${CSS.escape(id)}"]`).value;
    const a = document.querySelector(`[data-away="${CSS.escape(id)}"]`).value;
    state.scores[id] = { homeScore: h === '' ? null : Number(h), awayScore: a === '' ? null : Number(a) };
    saveState();
    renderAll();
    renderAdmin();
  }
  function kickoffDate(m){
    const time = normalizeTime(m.timeET || '00:00');
    return new Date(`${m.date}T${time}:00-04:00`);
  }

  function normalizeTime(time){
    const raw = String(time || '00:00').trim();
    const parts = raw.split(':');
    const h = String(parts[0] || '0').padStart(2,'0');
    const min = String(parts[1] || '0').padStart(2,'0');
    return `${h}:${min}`;
  }

  function lockDate(m){
    return new Date(kickoffDate(m).getTime() - 60 * 60 * 1000);
  }

  function isPickLocked(m){
    return Date.now() >= lockDate(m).getTime();
  }

  function lockNoticeHtml(m){
    const now = Date.now();
    const kick = kickoffDate(m).getTime();
    const lock = lockDate(m).getTime();
    if(now >= lock){
      return `<div class="lock-countdown locked" data-lock-countdown="${esc(m.id)}">Picks locked</div>`;
    }
    if(kick - now <= 24 * 60 * 60 * 1000){
      return `<div class="lock-countdown" data-lock-countdown="${esc(m.id)}">Locks in ${esc(formatDuration(lock - now))}</div>`;
    }
    return '';
  }

  function updateCountdowns(){
    updateOverallCountdown();
    document.querySelectorAll('[data-lock-countdown]').forEach(el => {
      const id = el.getAttribute('data-lock-countdown');
      const m = matches().find(x => String(x.id) === String(id));
      if(!m) return;
      const now = Date.now();
      const kick = kickoffDate(m).getTime();
      const lock = lockDate(m).getTime();
      if(now >= lock){
        el.textContent = 'Picks locked';
        el.classList.add('locked');
      } else if(kick - now <= 24 * 60 * 60 * 1000){
        el.textContent = `Locks in ${formatDuration(lock - now)}`;
        el.classList.remove('locked');
      }
    });
  }

  function updateOverallCountdown(){
    const title = $('overallCountdownTitle');
    const value = $('overallCountdownValue');
    if(!title || !value) return;
    const ms = matches().slice().sort((a,b) => kickoffDate(a) - kickoffDate(b));
    if(!ms.length){ title.textContent = 'No matches loaded'; value.textContent = '--'; return; }
    const now = Date.now();
    const first = ms[0];
    const final = ms.find(m => m.stage === 'Final') || ms[ms.length - 1];
    const firstKick = kickoffDate(first).getTime();
    const finalKick = kickoffDate(final).getTime();
    if(now < firstKick){
      title.textContent = 'Countdown to first kickoff';
      value.textContent = formatDuration(firstKick - now);
    } else if(now < finalKick){
      title.textContent = 'Countdown to final kickoff';
      value.textContent = formatDuration(finalKick - now);
    } else {
      title.textContent = 'Final kickoff has started';
      value.textContent = 'Tournament clock complete';
    }
  }

  function formatDuration(ms){
    if(ms <= 0) return '0d 0h 0m 0s';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
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
    $('tabAtg').addEventListener('click', () => setTab('atg'));
    $('tabGroups').addEventListener('click', () => setTab('groups'));
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
  function renderAll(){ renderStandings(); renderGroups(); renderMatches(); updateCountdowns(); }
  function setTab(tab){
    const groups = tab === 'groups';
    $('tabAtg').classList.toggle('active', !groups);
    $('tabGroups').classList.toggle('active', groups);
    $('atgTabPanel').classList.toggle('hidden', groups);
    $('groupsTabPanel').classList.toggle('hidden', !groups);
    if(groups) renderGroups();
  }

  function flagUrl(team){
    const code = COUNTRY_CODES[team];
    if(!code) return '';
    return `https://flagcdn.com/w320/${code.toLowerCase()}.png`;
  }

  function flagFor(team){
    const url = flagUrl(team);
    if(!url) return '<span class="flag-small flag-empty"></span>';
    return `<img class="flag-small" src="${esc(url)}" alt="${esc(team)} flag" loading="lazy">`;
  }

  function prettyDate(d){
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  }
  function prettyLongDate(d){
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function scoreText(v){ return v === null || v === undefined || v === '' ? '-' : esc(v); }
  function resultName(m,res){ return res === 'HOME' ? m.homeTeam : res === 'AWAY' ? m.awayTeam : 'Draw'; }

  bind();
  renderFilters();
  renderAll();
  if(countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdowns, 1000);
  setInterval(renderMatches, 60000);
  initFirebase();
})();
