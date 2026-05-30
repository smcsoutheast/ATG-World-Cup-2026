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
  const WILDCARD_ADVANCEMENTS = ['A/B/C/D/F','C/D/F/G/H','C/E/F/H/I','E/H/I/J/K','B/E/F/I/J','A/E/H/I/J','E/F/G/I/J','D/E/I/J/L'];
  const COUNTRY_CODES = {
    'Algeria':'DZ','Argentina':'AR','Australia':'AU','Austria':'AT','Belgium':'BE','Bosnia and Herzegovina':'BA','Brazil':'BR','Cabo Verde':'CV','Canada':'CA','Colombia':'CO','Congo DR':'CD','Croatia':'HR','Curaçao':'CW','Czechia':'CZ','Côte d’Ivoire':'CI','Ecuador':'EC','Egypt':'EG','England':'GB-ENG','France':'FR','Germany':'DE','Ghana':'GH','Haiti':'HT','Iran':'IR','Iraq':'IQ','Japan':'JP','Jordan':'JO','Korea Republic':'KR','Mexico':'MX','Morocco':'MA','Netherlands':'NL','New Zealand':'NZ','Norway':'NO','Panama':'PA','Paraguay':'PY','Portugal':'PT','Qatar':'QA','Saudi Arabia':'SA','Scotland':'GB-SCT','Senegal':'SN','South Africa':'ZA','Spain':'ES','Sweden':'SE','Switzerland':'CH','Tunisia':'TN','Türkiye':'TR','United States':'US','Uruguay':'UY','Uzbekistan':'UZ'
  };

  const $ = id => document.getElementById(id);
  const state = loadState();
  let activeRegion = null;
  let adminUnlocked = false;
  let activeGroup = null;
  let db = null;
  let docRef = null;
  let firebaseReady = false;
  let applyingRemote = false;
  let countdownTimer = null;

  function defaultState(){ return { picks:{}, pickMeta:{}, scores:{}, teams:{}, lockOverrides:{}, audit:[], scoreHistory:[], previousRanks:null, backups:{}, updatedAt:null }; }

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
        state.pickMeta = data.pickMeta || {};
        state.scores = data.scores || {};
        state.teams = data.teams || {};
        state.lockOverrides = data.lockOverrides || {};
        state.audit = data.audit || [];
        state.scoreHistory = data.scoreHistory || [];
        state.previousRanks = data.previousRanks || null;
        state.backups = data.backups || {};
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
    makeDailyBackup();
    saveLocal();
    if(!applyingRemote) saveRemote();
  }

  function saveRemote(){
    if(!firebaseReady || !docRef) return;
    docRef.set({
      picks: state.picks || {},
      pickMeta: state.pickMeta || {},
      scores: state.scores || {},
      teams: state.teams || {},
      lockOverrides: state.lockOverrides || {},
      audit: (state.audit || []).slice(-120),
      scoreHistory: (state.scoreHistory || []).slice(-25),
      previousRanks: state.previousRanks || null,
      backups: state.backups || {},
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


  function rankThirdPlaceTeams(thirds){
    return (thirds || [])
      .filter(t => t && t.team && t.group)
      .sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team))
      .map((t,i) => Object.assign({}, t, { thirdRank:i + 1 }));
  }

  function normalizeWildcardKey(value){
    return String(value || '').replace(/\s+/g,'').toUpperCase();
  }

  function assignWildcardAdvancements(rankedThirds){
    const keys = WILDCARD_ADVANCEMENTS.map(normalizeWildcardKey);
    const options = keys.map(key => {
      const allowed = key.split('/');
      return rankedThirds.filter(t => allowed.includes(String(t.group).toUpperCase()));
    });
    const order = keys.map((key,index) => ({ key, index, count: options[index].length })).sort((a,b) => a.count - b.count);
    let best = null;
    let bestScore = Infinity;

    function search(pos, usedGroups, current){
      if(pos === order.length){
        const assignment = {};
        let score = 0;
        current.forEach(item => {
          assignment[keys[item.index]] = item.team;
          score += item.team.thirdRank || 99;
        });
        if(score < bestScore){ bestScore = score; best = assignment; }
        return true;
      }
      const item = order[pos];
      const candidates = options[item.index].filter(t => !usedGroups.has(String(t.group).toUpperCase()));
      if(!candidates.length) return false;
      for(const team of candidates){
        const group = String(team.group).toUpperCase();
        usedGroups.add(group);
        current.push({ index:item.index, team });
        search(pos + 1, usedGroups, current);
        current.pop();
        usedGroups.delete(group);
      }
      return !!best;
    }
    search(0, new Set(), []);
    if(best) return best;

    const fallback = {};
    const used = new Set();
    keys.forEach((key,index) => {
      const pick = options[index].find(t => !used.has(String(t.group).toUpperCase())) || options[index][0];
      if(pick){ used.add(String(pick.group).toUpperCase()); fallback[key] = pick; }
    });
    return fallback;
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
    const rankedThirds = rankThirdPlaceTeams(thirds);
    const wildcardAssignments = assignWildcardAdvancements(rankedThirds);

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
      m = text.match(/^(?:Group |Highest )(?:3rd Place )?([A-L\/]+)(?: 3rd Place)?$/i);
      if(m && text.toLowerCase().includes('3rd place')){
        const key = normalizeWildcardKey(m[1]);
        const pick = wildcardAssignments[key];
        return pick?.team || text;
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
    if(!res) return null;
    if(!pick) return isPickLocked(m) ? 0 : null;
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
      const row = { id:r.id, region:r.name, members:r.members, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0, form:[], correct:0, accuracy:0, streak:'-' };
      ms.forEach(m => {
        const pick = state.picks[r.id]?.[m.id];
        const pts = pointsFor(m,pick);
        if(pts === null) return;
        row.p += 1;
        if(pts === 3){ row.w += 1; row.correct += 1; }
        else if(pts === 1){ row.d += 1; row.correct += 1; }
        else row.l += 1;
        row.pts += pts;
        const g = goalsFor(m,pick);
        row.gf += g.gf;
        row.ga += g.ga;
        row.form.push(pts === 3 ? 'W' : pts === 1 ? 'D' : 'L');
      });
      row.gd = row.gf - row.ga;
      row.accuracy = row.p ? Math.round((row.correct / row.p) * 100) : 0;
      row.streak = streakText(row.form);
      row.form = row.form.slice(-5).join(' ');
      return row;
    }).sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.region.localeCompare(b.region));
  }
  function formIcons(form){
    const items = String(form || '').split(/\s+/).filter(Boolean).slice(-5);
    if(!items.length) return '<span class="form-empty">-</span>';
    return `<span class="form-icons">${items.map(x => {
      const key = x === 'W' ? 'win' : x === 'D' ? 'draw' : 'loss';
      return `<span class="form-icon ${key}">${esc(x)}</span>`;
    }).join('')}</span>`;
  }

  function renderStandings(){
    const tbody = document.querySelector('#standingsTable tbody');
    const prev = state.previousRanks || {};
    const rows = calcStandings();
    tbody.innerHTML = rows.map((r,i) => {
      const move = prev[r.id] ? prev[r.id] - (i+1) : 0;
      const moveText = move > 0 ? `▲ +${move}` : move < 0 ? `▼ ${move}` : '▬';
      return `<tr class="region-row region-${r.id}"><td class="hide-sm move-cell">${moveText}</td><td>${i+1}. ${esc(r.region)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="hide-sm">${r.gf}</td><td class="hide-sm">${r.ga}</td><td>${r.gd}</td><td>${r.pts}</td><td class="hide-sm">${formIcons(r.form)}</td><td>${r.accuracy}%</td></tr>`;
    }).join('');
    renderAwardCards(rows);
  }

  function awardLeaders(rows){
    const playedRows = rows.filter(r => r.p > 0);
    const source = playedRows.length ? playedRows : rows;
    const goldenBall = source.slice().sort((a,b) => b.accuracy - a.accuracy || b.correct - a.correct || b.pts - a.pts || b.gd - a.gd || a.region.localeCompare(b.region));
    const goldenBoot = source.slice().sort((a,b) => b.gf - a.gf || b.pts - a.pts || b.accuracy - a.accuracy || a.region.localeCompare(b.region));
    const goldenGlove = source.slice().sort((a,b) => a.ga - b.ga || b.pts - a.pts || b.accuracy - a.accuracy || a.region.localeCompare(b.region));
    const hotStreak = source.slice().sort((a,b) => currentWinStreak(b) - currentWinStreak(a) || b.accuracy - a.accuracy || b.pts - a.pts || a.region.localeCompare(b.region));
    return { goldenBall, goldenBoot, goldenGlove, hotStreak };
  }

  function currentWinStreak(row){
    const parts = String(row.form || '').trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for(let i = parts.length - 1; i >= 0; i--){
      if(parts[i] === 'W') count++;
      else break;
    }
    return count;
  }

  function awardIcon(type){
    const title = esc(type);
    const common = 'width="54" height="54" viewBox="0 0 64 64" role="img" aria-label="' + title + '"';
    if(type === 'ball'){
      return `<svg class="award-svg" ${common}><circle cx="32" cy="32" r="27" fill="#f4c95d"/><path d="M32 14l11 8-4 13H25l-4-13 11-8z" fill="none" stroke="#5a4300" stroke-width="3" stroke-linejoin="round"/><path d="M21 22l-10 5M43 22l10 5M25 35l-8 12M39 35l8 12M32 14V5M17 47l-6 5M47 47l6 5" stroke="#5a4300" stroke-width="3" stroke-linecap="round"/></svg>`;
    }
    if(type === 'boot'){
      return `<svg class="award-svg" ${common}><path d="M10 41c12 3 22 1 32-6l7 9c3 4 1 9-4 9H19c-7 0-11-4-9-12z" fill="#f4c95d" stroke="#5a4300" stroke-width="3" stroke-linejoin="round"/><path d="M20 20h17c4 0 7 4 6 8l-1 7c-8 6-18 8-29 6l4-17c.4-2.2 1.6-4 3-4z" fill="#ffd86b" stroke="#5a4300" stroke-width="3"/><path d="M22 28h16M21 34h14M20 53v6M30 53v6M40 53v6" stroke="#5a4300" stroke-width="3" stroke-linecap="round"/></svg>`;
    }
    if(type === 'glove'){
      return `<svg class="award-svg" ${common}><path d="M18 32V13c0-3 2-5 5-5s5 2 5 5v16M28 29V10c0-3 2-5 5-5s5 2 5 5v20M38 31V14c0-3 2-5 5-5s5 2 5 5v25M18 32l-6-8c-2-3-6-2-7 1-1 2 0 5 2 8l12 20c3 5 8 8 15 8h7c8 0 13-5 13-13v-9" fill="#f4c95d" stroke="#5a4300" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 42h18M26 50h14" stroke="#5a4300" stroke-width="3" stroke-linecap="round"/></svg>`;
    }
    return `<span class="award-emoji">🔥</span>`;
  }

  function awardCard(title, leader, detail, iconType, multi){
    const extraClass = multi ? ' multi-award' : '';
    if(!leader) return `<div class="award-card${extraClass}"><div class="award-icon">${awardIcon(iconType)}</div><h3>${esc(title)}</h3><p>No results yet</p></div>`;
    return `<div class="award-card region-${leader.id}${extraClass}"><div class="award-icon">${awardIcon(iconType)}</div><h3>${esc(title)}</h3><strong>${esc(leader.region)}</strong><p>${detail(leader)}</p></div>`;
  }

  function renderAwardCards(rows){
    const el = $('awardCards'); if(!el) return;
    const leaders = awardLeaders(rows);
    const awardRows = [
      ['Golden Ball', leaders.goldenBall[0], r => `${r.accuracy}% accuracy`, 'ball'],
      ['Golden Boot', leaders.goldenBoot[0], r => `${r.gf} goals scored`, 'boot'],
      ['Golden Glove', leaders.goldenGlove[0], r => `${r.ga} goals against`, 'glove'],
      ['Hot Streak', leaders.hotStreak[0], r => `${currentWinStreak(r)} active wins`, 'flame']
    ];
    const counts = {};
    awardRows.forEach(item => { if(item[1]) counts[item[1].id] = (counts[item[1].id] || 0) + 1; });
    el.innerHTML = awardRows.map(([title, leader, detail, iconType]) => awardCard(title, leader, detail, iconType, leader && counts[leader.id] > 1)).join('');
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
    const tabs = $('groupTabs');
    const wrap = $('groupStandings');
    const summary = $('qualifierSummary');
    if(!wrap || !summary) return;
    const groups = calcGroupStandings();
    const keys = Object.keys(groups).sort();
    if(!keys.length){
      wrap.innerHTML = '<p class="meta">No group data loaded.</p>';
      if(tabs) tabs.innerHTML = '';
      summary.innerHTML = '';
      return;
    }
    if(!activeGroup || !groups[activeGroup]) activeGroup = keys[0];

    const thirds = rankThirdPlaceTeams(keys.map(g => Object.assign({ group:g }, groups[g].rankings[2])).filter(t => t && t.team));
    const assignments = assignWildcardAdvancements(thirds);
    const advancingThirdGroups = new Set(Object.values(assignments || {}).filter(Boolean).map(t => String(t.group).toUpperCase()));

    if(tabs){
      tabs.innerHTML = keys.map(g => `<button type="button" class="group-tab ${g === activeGroup ? 'active' : ''}" data-group-tab="${esc(g)}">Group ${esc(g)}</button>`).join('');
      tabs.querySelectorAll('[data-group-tab]').forEach(btn => btn.addEventListener('click', () => {
        activeGroup = btn.dataset.groupTab;
        renderGroups();
      }));
    }
    wrap.innerHTML = groupTableHtml(activeGroup, groups[activeGroup].rankings, advancingThirdGroups);
    summary.innerHTML = wildcardAdvancementCards(assignments, thirds);
  }

  function groupTableHtml(group, rows, advancingThirdGroups){
    return `<div class="group-card"><h3>Group ${esc(group)}</h3><div class="group-table-wrap"><table class="group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th><th>GD</th><th>Status</th></tr></thead><tbody>${rows.map((r,i) => `<tr class="${groupRowClass(i, group, advancingThirdGroups)}"><td>${i+1}. ${flagFor(r.team)} ${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.pts}</td><td>${r.gd}</td><td>${qualificationStatus(i, group, advancingThirdGroups)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function groupRowClass(index, group, advancingThirdGroups){
    if(index < 2) return 'qualified';
    if(index === 2 && advancingThirdGroups && advancingThirdGroups.has(String(group).toUpperCase())) return 'third-place wildcard';
    return 'eliminated';
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
    const grouped = ms.reduce((acc, m) => {
      const key = m.date || 'TBD';
      acc[key] = acc[key] || [];
      acc[key].push(m);
      return acc;
    }, {});
    matchesEl.innerHTML = Object.keys(grouped).sort().map(date => {
      return `<section class="match-day-group"><h3>${date === 'TBD' ? 'Date TBD' : prettyLongDate(date)}</h3><div class="match-day-list">${grouped[date].map(cardHtml).join('')}</div></section>`;
    }).join('');
    document.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', onPick));
  }

  function cardHtml(m){
    const res = resultFor(m);
    const locked = isPickLocked(m);
    const current = activeRegion ? state.picks[activeRegion]?.[m.id] : null;
    const submitted = REGIONS.filter(r => !!state.picks[r.id]?.[m.id]).length;
    const remaining = REGIONS.length - submitted;
    const status = matchStatus(m, locked, res);
    const options = isKnockout(m.stage) ? ['HOME','AWAY'] : ['HOME','DRAW','AWAY'];
    const buttons = activeRegion
      ? `<div class="pick-buttons ${isKnockout(m.stage) ? 'knockout' : ''}">${options.map(o => `<button class="pick-btn ${current===o?'active':''}" data-pick="${o}" data-match="${m.id}" ${locked ? 'disabled' : ''}>${esc(pickLabel(m,o))}</button>`).join('')}</div><p class="meta">${locked ? 'Picks locked for this match.' : 'Only your region pick is visible before lock.'}</p>`
      : '<p class="meta">Unlock your region to submit picks. Public picks stay hidden until lock.</p>';
    const scoreHtml = res ? `<div class="simple-score">${scoreText(m)}<span>${esc(resultName(m,res))}</span></div>` : '';
    const pickArea = locked ? `<div class="pick-chip-grid">${pickChipsHtml(m)}</div>${pickSummaryHtml(m, true)}` : `<div class="simple-submit-row"><strong>Submitted: ${submitted} of ${REGIONS.length}</strong><span>${remaining} remaining</span><span>Picks reveal at lock</span></div>`;
    return `<article class="simple-match-card ${res ? 'is-final' : ''}">
      <div class="simple-match-head">
        <span class="match-number">Match ${esc(m.id)}</span>
        <span class="stage-badge ${stageClass(m.stage)}">${esc(m.stage)}</span>
        <span class="status-pill ${status.cls}">${status.label}</span>
      </div>
      <div class="simple-teams">
        ${simpleTeamHtml(m.homeTeam)}
        <div class="simple-vs">VS</div>
        ${simpleTeamHtml(m.awayTeam)}
      </div>
      ${scoreHtml}
      <div class="simple-details">
        <span>${prettyLongDate(m.date)}</span>
        <span>${esc(m.timeET)} ET</span>
        <span>${esc(m.venue)}${m.city ? ` · ${esc(m.city)}` : ''}</span>
      </div>
      ${lockNoticeHtml(m)}
      <div class="simple-reveal">${locked ? 'Regional selections are visible.' : 'Regional selections will be revealed at lock time.'}</div>
      <div class="pick-panel">${buttons}</div>
      <div class="picks simple-picks">${pickArea}</div>
    </article>`;
  }

  function simpleTeamHtml(team){
    return `<div class="simple-team">${flagFor(team)}<strong>${esc(team)}</strong></div>`;
  }

  function scoreText(m){
    const s = scoreFor(m);
    if(!s || s.homeScore === null || s.awayScore === null || s.homeScore === undefined || s.awayScore === undefined) return '';
    return `${s.homeScore} - ${s.awayScore}`;
  }

  function matchStatus(m, locked, res){
    if(res) return { label:'Final', cls:'final' };
    if(locked) return { label:'Locked', cls:'locked' };
    const lock = lockDate(m).getTime();
    const now = Date.now();
    if(lock - now <= 24 * 60 * 60 * 1000) return { label:'Locks Soon', cls:'soon' };
    return { label:'Open', cls:'open' };
  }

  function pickChipsHtml(m){
    return REGIONS.map(r => {
      const pick = state.picks[r.id]?.[m.id];
      const pts = pointsFor(m,pick);
      const cls = pts === 3 || pts === 1 ? 'correct' : pts === 0 ? 'wrong' : pick === 'DRAW' ? 'draw' : '';
      const label = pick ? pickLabel(m,pick) : (isPickLocked(m) ? 'No Pick' : 'No pick');
      return `<div class="pick-chip ${cls}"><span>${esc(r.name)}</span><strong>${esc(label)}</strong></div>`;
    }).join('');
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
    state.pickMeta[activeRegion] = state.pickMeta[activeRegion] || {};
    state.pickMeta[activeRegion][matchId] = { at:new Date().toISOString() };
    addAudit(`${regionName(activeRegion)} submitted a pick for Match ${matchId}`);
    saveState();
    renderAll();
  }
  function renderAdmin(){
    if(!adminUnlocked){ $('adminTools').innerHTML = ''; $('adminScores').innerHTML = ''; return; }
    $('adminTools').innerHTML = `<div class="admin-actions"><button id="resetLocal" type="button" class="ghost small">Reset local data</button><button id="undoScore" type="button" class="ghost small">Undo last score</button><span class="meta">Knockout teams update automatically from group standings and knockout results.</span></div>`;
    $('adminScores').innerHTML = matches().map(m => {
      return `<div class="admin-row"><div>#${esc(m.id)}</div><div class="game-title">${esc(m.homeTeam)} vs ${esc(m.awayTeam)}<br><span class="meta">${prettyDate(m.date)} · ${esc(m.stage)}</span></div><input data-home="${esc(m.id)}" type="number" min="0" value="${m.homeScore ?? ''}" placeholder="Home"><input data-away="${esc(m.id)}" type="number" min="0" value="${m.awayScore ?? ''}" placeholder="Away"><button data-save-score="${esc(m.id)}" type="button">Score</button><button data-toggle-lock="${esc(m.id)}" type="button" class="ghost small">${lockOverrideLabel(m.id)}</button></div>`;
    }).join('');
    $('adminScores').insertAdjacentHTML('beforeend', `<div class="audit-box"><h3>Audit Log</h3>${auditHtml()}</div>`);
    const resetBtn = $('resetLocal');
    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem(KEY);
        $('adminStatus').textContent = 'Local data reset. Refresh the page to reload Firebase data.';
      });
    }
    const undoBtn = $('undoScore');
    if(undoBtn) undoBtn.addEventListener('click', undoLastScore);
    document.querySelectorAll('[data-save-score]').forEach(b => b.addEventListener('click', () => saveScore(b.dataset.saveScore)));
    document.querySelectorAll('[data-toggle-lock]').forEach(b => b.addEventListener('click', () => toggleLock(b.dataset.toggleLock)));
  }

  function saveScore(id){
    const h = document.querySelector(`[data-home="${CSS.escape(id)}"]`).value;
    const a = document.querySelector(`[data-away="${CSS.escape(id)}"]`).value;
    state.previousRanks = rankSnapshot();
    const prior = state.scores[id] ? Object.assign({}, state.scores[id]) : null;
    state.scoreHistory = state.scoreHistory || [];
    state.scoreHistory.push({ id, prior, at:new Date().toISOString() });
    state.scoreHistory = state.scoreHistory.slice(-25);
    state.scores[id] = { homeScore: h === '' ? null : Number(h), awayScore: a === '' ? null : Number(a) };
    addAudit(`Super Admin updated Match ${id} score to ${h || 0}-${a || 0}`);
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
    if(state.lockOverrides && state.lockOverrides[m.id] === 'unlocked') return false;
    if(state.lockOverrides && state.lockOverrides[m.id] === 'locked') return true;
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


  function regionName(id){ return (REGIONS.find(r => r.id === id) || {}).name || id; }
  function addAudit(message){
    state.audit = state.audit || [];
    state.audit.push({ at:new Date().toISOString(), message });
    state.audit = state.audit.slice(-120);
  }
  function auditHtml(){
    const rows = (state.audit || []).slice(-20).reverse();
    if(!rows.length) return '<p class="meta">No changes logged yet.</p>';
    return rows.map(a => `<div class="audit-line"><span>${prettyTimestamp(a.at)}</span><strong>${esc(a.message)}</strong></div>`).join('');
  }
  function rankSnapshot(){
    const snap = {};
    calcStandings().forEach((r,i) => snap[r.id] = i + 1);
    return snap;
  }
  function streakText(form){
    if(!form.length) return '-';
    const last = form[form.length - 1];
    let count = 0;
    for(let i = form.length - 1; i >= 0; i--){ if(form[i] === last) count++; else break; }
    return `${last}${count}`;
  }
  function qualificationStatus(index, group, advancingThirdGroups){
    if(index < 2) return '<span class="q-badge qualified">Q</span>';
    if(index === 2 && advancingThirdGroups && advancingThirdGroups.has(String(group).toUpperCase())) return '<span class="q-badge wildcard">WC</span>';
    return '<span class="q-badge eliminated">E</span>';
  }
  function wildcardTable(rows){
    if(!rows.length) return '<p class="meta">No third-place teams yet.</p>';
    return `<table class="mini-table"><thead><tr><th>Rank</th><th>Team</th><th>Group</th><th>Pts</th><th>GD</th></tr></thead><tbody>${rows.map((r,i) => `<tr><td>${i+1}</td><td>${flagFor(r.team)} ${esc(r.team)}</td><td>${esc(r.group)}</td><td>${r.pts}</td><td>${r.gd}</td></tr>`).join('')}</tbody></table>`;
  }
  function wildcardAdvancementCards(assignments, rankedThirds){
    const byGroup = Object.fromEntries((rankedThirds || []).map(t => [String(t.group).toUpperCase(), t]));
    const assignedGroups = new Set(Object.values(assignments || {}).filter(Boolean).map(t => String(t.group).toUpperCase()));
    const advancingCards = WILDCARD_ADVANCEMENTS.map((set, index) => {
      const key = normalizeWildcardKey(set);
      const pick = assignments[key];
      const available = key.split('/').map(g => byGroup[g]).filter(Boolean);
      const status = pick ? `${flagFor(pick.team)} ${esc(pick.team)} <span>Group ${esc(pick.group)} · 3rd Place Rank ${pick.thirdRank || '-'}</span>` : 'Pending';
      const options = available.map(t => `<li class="${pick && t.group === pick.group ? 'selected' : assignedGroups.has(String(t.group).toUpperCase()) ? 'used' : ''}">${esc(t.group)}: ${flagFor(t.team)} ${esc(t.team)} <small>#${t.thirdRank || '-'} · ${t.pts} pts · GD ${t.gd}</small></li>`).join('');
      return `<div class="wildcard-advance-card"><div class="wildcard-seed">Wildcard ${index + 1}</div><h4>${esc(set)}</h4><strong>${status}</strong><ul>${options || '<li>Waiting on group results</li>'}</ul></div>`;
    }).join('');
    const notAdvancing = (rankedThirds || []).filter(t => !assignedGroups.has(String(t.group).toUpperCase()));
    const notAdvancingList = notAdvancing.length
      ? notAdvancing.map(t => `<li>${esc(t.group)}: ${flagFor(t.team)} ${esc(t.team)} <small>#${t.thirdRank || '-'} · ${t.pts} pts · GD ${t.gd}</small></li>`).join('')
      : '<li>Pending final group standings</li>';
    const eliminatedCard = `<div class="wildcard-advance-card not-advancing-card"><div class="wildcard-seed">Not Advancing</div><h4>3rd Place Teams Out</h4><strong>Remaining 3rd-place teams</strong><ul>${notAdvancingList}</ul></div>`;
    return `<div class="wildcard-card-grid">${advancingCards}${eliminatedCard}</div>`;
  }
  function stageClass(stage){ return 'stage-' + String(stage || '').toLowerCase().replace(/[^a-z0-9]+/g,'-'); }
  function pickSummaryHtml(m, locked){
    if(!locked) return '';
    const counts = { HOME:0, DRAW:0, AWAY:0, NONE:0 };
    REGIONS.forEach(r => { const p = state.picks[r.id]?.[m.id] || 'NONE'; counts[p] = (counts[p] || 0) + 1; });
    const parts = [`${esc(m.homeTeam)}: ${counts.HOME}`];
    if(!isKnockout(m.stage)) parts.push(`Draw: ${counts.DRAW}`);
    parts.push(`${esc(m.awayTeam)}: ${counts.AWAY}`, `No Pick: ${counts.NONE}`);
    return `<div class="pick-distribution"><strong>Pick Distribution</strong><span>${parts.join(' · ')}</span></div>`;
  }
  function lockOverrideLabel(id){
    const v = state.lockOverrides?.[id];
    if(v === 'locked') return 'Unlock Override';
    if(v === 'unlocked') return 'Lock Override';
    return 'Lock Override';
  }
  function toggleLock(id){
    state.lockOverrides = state.lockOverrides || {};
    const cur = state.lockOverrides[id];
    state.lockOverrides[id] = cur === 'locked' ? 'unlocked' : 'locked';
    addAudit(`Super Admin set Match ${id} to ${state.lockOverrides[id]}`);
    saveState(); renderAll(); renderAdmin();
  }
  function undoLastScore(){
    const last = (state.scoreHistory || []).pop();
    if(!last){ $('adminStatus').textContent = 'No score change to undo.'; return; }
    if(last.prior) state.scores[last.id] = last.prior;
    else delete state.scores[last.id];
    addAudit(`Super Admin undid score update for Match ${last.id}`);
    saveState(); renderAll(); renderAdmin();
  }
  function makeDailyBackup(){
    const day = new Date().toISOString().slice(0,10);
    state.backups = state.backups || {};
    if(state.backups[day]) return;
    state.backups[day] = { at:new Date().toISOString(), picks:Object.keys(state.picks || {}).length, scores:Object.keys(state.scores || {}).length };
    const keys = Object.keys(state.backups).sort();
    while(keys.length > 14){ delete state.backups[keys.shift()]; }
  }
  function renderBracket(){
    const el = $('bracketGrid'); if(!el) return;
    const stageOrder = ['Round of 32','Round of 16','Quarter-finals','Semi-finals','Third Place','Final'];
    const ms = matches().filter(m => stageOrder.includes(m.stage)).sort((a,b) => Number(a.id) - Number(b.id));
    el.innerHTML = stageOrder.map(stage => {
      const rows = ms.filter(m => m.stage === stage);
      if(!rows.length) return '';
      return `<div class="bracket-stage"><h3>${esc(stage)}</h3>${rows.map(m => `<div class="bracket-match"><span>#${esc(m.id)}</span><strong>${flagFor(m.homeTeam)} ${esc(m.homeTeam)}</strong><em>${scoreText(m.homeScore)} - ${scoreText(m.awayScore)}</em><strong>${flagFor(m.awayTeam)} ${esc(m.awayTeam)}</strong></div>`).join('')}</div>`;
    }).join('');
  }
  function renderInsights(){
    renderPodium(); renderProfiles(); renderCompetitionInsights();
  }
  function renderPodium(){
    const el = $('podium'); if(!el) return;
    const rows = calcStandings().slice(0,3);
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = rows.map((r,i) => `<div class="podium-card region-${r.id}"><div>${medals[i]}</div><strong>${esc(r.region)}</strong><span>${r.pts} pts · ${r.gd} GD</span></div>`).join('');
  }
  function renderProfiles(){
    const el = $('regionProfiles'); if(!el) return;
    const rows = calcStandings();
    el.innerHTML = rows.map(r => `<div class="profile-card region-${r.id}"><h3>${esc(r.region)}</h3><p>${esc(r.members)}</p><strong>${r.w}-${r.l}-${r.d}</strong><span>Form: ${esc(r.form || '-')} · Accuracy: ${r.accuracy}% · Streak: ${esc(r.streak)}</span></div>`).join('');
  }
  function renderCompetitionInsights(){
    const el = $('competitionInsights'); if(!el) return;
    const rows = calcStandings();
    const awards = awardLeaders(rows);
    const gf = awards.goldenBoot.slice(0,3);
    const acc = awards.goldenBall.slice(0,3);
    const glove = awards.goldenGlove.slice(0,3);
    const streaks = rows.slice().sort((a,b) => currentWinStreak(b) - currentWinStreak(a) || b.accuracy - a.accuracy || b.pts - a.pts).slice(0,3);
    const upset = upsetTracker();
    const mod = matchOfDay();
    el.innerHTML = `
      <div class="insight-card"><h3>Golden Ball</h3>${acc.map((r,i)=>`<p>${i+1}. ${esc(r.region)} · ${r.accuracy}% accuracy</p>`).join('')}</div>
      <div class="insight-card"><h3>Golden Boot</h3>${gf.map((r,i)=>`<p>${i+1}. ${esc(r.region)} · ${r.gf} GF</p>`).join('')}</div>
      <div class="insight-card"><h3>Golden Glove</h3>${glove.map((r,i)=>`<p>${i+1}. ${esc(r.region)} · ${r.ga} GA</p>`).join('')}</div>
      <div class="insight-card"><h3>Longest Current Win Streaks</h3>${streaks.map(r=>`<p>${esc(r.region)} · W${currentWinStreak(r)}</p>`).join('')}</div>
      <div class="insight-card"><h3>Match of the Day</h3><p>${mod}</p></div>
      <div class="insight-card"><h3>Upset Tracker</h3>${upset}</div>
      <div class="insight-card"><h3>Rivalry Table</h3>${rivalryTable()}</div>
      <div class="insight-card"><h3>Backup Status</h3><p>Local daily backup active. Firebase stores shared live data.</p></div>`;
  }
  function matchOfDay(){
    const ms = matches();
    if(!ms.length) return 'No matches loaded.';
    const sorted = ms.slice().sort((a,b) => {
      const as = Object.values(state.picks || {}).filter(p => p && p[a.id]).length;
      const bs = Object.values(state.picks || {}).filter(p => p && p[b.id]).length;
      return bs - as || Number(a.id) - Number(b.id);
    });
    const m = sorted[0];
    const count = Object.values(state.picks || {}).filter(p => p && p[m.id]).length;
    return `Match ${m.id}: ${esc(m.homeTeam)} vs ${esc(m.awayTeam)} · ${count} submitted`;
  }
  function upsetTracker(){
    const items = [];
    matches().forEach(m => {
      const res = resultFor(m); if(!res) return;
      const correct = REGIONS.filter(r => state.picks[r.id]?.[m.id] === res);
      if(correct.length > 0 && correct.length <= 2){ items.push(`<p>Match ${esc(m.id)}: ${correct.map(r=>esc(r.name)).join(', ')} called ${esc(resultName(m,res))}</p>`); }
    });
    return items.slice(-5).join('') || '<p>No upsets recorded yet.</p>';
  }
  function rivalryTable(){
    const rows = calcStandings();
    if(rows.length < 2) return '<p>Need two regions.</p>';
    const top = rows[0], chase = rows[1];
    return `<p>${esc(top.region)} ${top.pts}</p><p>${esc(chase.region)} ${chase.pts}</p><p class="meta">Top two comparison by points.</p>`;
  }
  function toggleTheme(){
    document.body.classList.toggle('light-theme');
    localStorage.setItem('atg_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
  }
  function prettyTimestamp(v){
    try { return new Date(v).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }
    catch(e){ return v || ''; }
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
    $('tabBracket').addEventListener('click', () => setTab('bracket'));
    $('tabInsights').addEventListener('click', () => setTab('insights'));
    const themeBtn = $('themeToggle');
    if(themeBtn) themeBtn.addEventListener('click', toggleTheme);
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
  function renderAll(){ renderStandings(); renderGroups(); renderBracket(); renderInsights(); renderMatches(); updateCountdowns(); }
  function setTab(tab){
    const panels = { atg:'atgTabPanel', groups:'groupsTabPanel', bracket:'bracketTabPanel', insights:'insightsTabPanel' };
    const buttons = { atg:'tabAtg', groups:'tabGroups', bracket:'tabBracket', insights:'tabInsights' };
    Object.keys(panels).forEach(key => {
      $(buttons[key]).classList.toggle('active', key === tab);
      $(panels[key]).classList.toggle('hidden', key !== tab);
    });
    if(tab === 'groups') renderGroups();
    if(tab === 'bracket') renderBracket();
    if(tab === 'insights') renderInsights();
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

  if(localStorage.getItem('atg_theme') === 'light') document.body.classList.add('light-theme');
  bind();
  renderFilters();
  renderAll();
  if(countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdowns, 1000);
  setInterval(renderMatches, 60000);
  initFirebase();
})();
