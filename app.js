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
  let activeBracketRound = 'All';
  let activeInsightRegion = REGIONS[0].id;
  let selectedStage = 'All Stages';
  let selectedDate = '';
  let db = null;
  let docRef = null;
  let firebaseReady = false;
  let applyingRemote = false;
  let countdownTimer = null;

  function defaultState(){ return { picks:{}, pickMeta:{}, scores:{}, advancers:{}, teams:{}, lockOverrides:{}, audit:[], scoreHistory:[], previousRanks:null, backups:{}, updatedAt:null }; }

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
        state.advancers = data.advancers || {};
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
      advancers: state.advancers || {},
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
    if(isKnockout(m.stage)){
      const advancer = state.advancers?.[m.id];
      if(advancer === 'HOME' || advancer === 'AWAY') return advancer;
    }
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

  function groupFormIcons(form){
    const items = Array.isArray(form) ? form.slice(-3) : String(form || '').split(/\s+/).filter(Boolean).slice(-3);
    if(!items.length) return '<span class="form-empty">-</span>';
    return `<span class="form-icons group-form-icons">${items.map(x => {
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
      if(h > a){ home.w++; away.l++; home.pts += 3; home.form.push('W'); away.form.push('L'); }
      else if(a > h){ away.w++; home.l++; away.pts += 3; away.form.push('W'); home.form.push('L'); }
      else { home.d++; away.d++; home.pts++; away.pts++; home.form.push('D'); away.form.push('D'); }
      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });
    Object.values(groups).forEach(group => group.rankings = rankGroup(Object.values(group.teams), group.matches));
    return groups;
  }

  function baseTeam(team){ return { team, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0, form:[], h2hPts:0, h2hGd:0, h2hGf:0 }; }

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
    const groupKey = String(group).toUpperCase();
    const tableRows = rows.map((r,i) => `<tr class="${groupRowClass(i, groupKey, advancingThirdGroups)}"><td>${i+1}. ${flagFor(r.team)} ${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${formatGoalDiff(r.gd)}</td><td>${r.pts}</td><td>${groupFormIcons(r.form)}</td><td>${qualificationStatus(i, groupKey, advancingThirdGroups)}</td></tr>`).join('');
    return `<div class="group-card simple-group-card">
      <h3>Group ${esc(groupKey)}</h3>
      <div class="group-table-wrap"><table class="group-table simple-group-table"><thead><tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th><th>Knockout</th></tr></thead><tbody>${tableRows}</tbody></table></div>
      ${groupSummaryCards(groupKey, rows, advancingThirdGroups)}
      <details class="tie-break-details"><summary>FIFA tie-break order</summary><p>Head-to-head points, head-to-head goal difference, head-to-head goals scored, overall goal difference, then overall goals scored.</p></details>
    </div>`;
  }

  function formatGoalDiff(value){
    const n = Number(value || 0);
    return n > 0 ? `+${n}` : String(n);
  }

  function groupSummaryCards(group, rows, advancingThirdGroups){
    const winner = rows[0];
    const runner = rows[1];
    const third = rows[2];
    const thirdAdvances = advancingThirdGroups && advancingThirdGroups.has(String(group).toUpperCase());
    const cards = [
      { label:'Group Winner', value:winner ? `${flagFor(winner.team)} ${esc(winner.team)}` : 'Pending', cls:'qualified' },
      { label:'Runner-up', value:runner ? `${flagFor(runner.team)} ${esc(runner.team)}` : 'Pending', cls:'qualified' },
      { label:'Third Place Status', value:third ? `${flagFor(third.team)} ${esc(third.team)} · ${thirdAdvances ? 'Wildcard' : 'Eliminated'}` : 'Pending', cls: thirdAdvances ? 'wildcard' : 'eliminated' }
    ];
    return `<div class="group-summary-cards">${cards.map(c => `<div class="group-summary-card ${c.cls}"><span>${c.label}</span><strong>${c.value}</strong></div>`).join('')}</div>`;
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
  function shortStageLabel(stage){
    return ({
      'All Stages':'All',
      'Group Stage':'Group',
      'Round of 32':'R32',
      'Round of 16':'R16',
      'Quarter-finals':'QF',
      'Semi-finals':'SF',
      'Third Place':'Third',
      'Final':'Final'
    })[stage] || stage;
  }
  function uniqueMatchDates(){
    return [...new Set(matches().map(m => m.date).filter(Boolean).sort())];
  }
  function isoToday(offsetDays){
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.toISOString().slice(0,10);
  }
  function nextMatchDate(fromDate){
    const dates = uniqueMatchDates();
    return dates.find(d => d >= fromDate) || dates[0] || 'All Dates';
  }
  function defaultMatchDate(){
    return nextMatchDate(isoToday(0));
  }
  function resolveQuickDate(value){
    if(value === 'TODAY') return nextMatchDate(isoToday(0));
    if(value === 'TOMORROW') return nextMatchDate(isoToday(1));
    if(value === 'NEXT') return nextMatchDate(isoToday(0));
    return value;
  }
  function renderFilters(){
    const dates = uniqueMatchDates();
    if(!selectedDate) selectedDate = defaultMatchDate();
    if(!dates.includes(selectedDate) && selectedDate !== 'All Dates') selectedDate = defaultMatchDate();
    $('stageFilterButtons').innerHTML = STAGES.map(stage => `<button type="button" class="filter-chip ${selectedStage === stage ? 'active' : ''}" data-stage="${esc(stage)}" title="${esc(stage)}">${esc(shortStageLabel(stage))}</button>`).join('');
    const quick = [
      { value:'All Dates', label:'All Days' },
      { value:'TODAY', label:'Today' },
      { value:'TOMORROW', label:'Tomorrow' },
      { value:'NEXT', label:'Next Matchday' }
    ];
    const quickHtml = quick.map(item => {
      const resolved = resolveQuickDate(item.value);
      const active = item.value === 'All Dates' ? selectedDate === 'All Dates' : selectedDate === resolved;
      return `<button type="button" class="filter-chip ${active ? 'active' : ''}" data-date="${esc(item.value)}">${esc(item.label)}</button>`;
    }).join('');
    const dateHtml = dates.map(d => `<button type="button" class="filter-chip date-filter-chip ${selectedDate === d ? 'active' : ''}" data-date="${esc(d)}">${esc(prettyShortDate(d))}</button>`).join('');
    $('dateFilterButtons').innerHTML = quickHtml + dateHtml;
  }
  function filteredMatches(){
    const stage = selectedStage || 'All Stages';
    const date = selectedDate || defaultMatchDate();
    return matches().filter(m => {
      const stageOk = stage === 'All Stages' || m.stage === stage;
      const dateOk = date === 'All Dates' || m.date === date;
      return stageOk && dateOk;
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
    const scoreHtml = res ? `<div class="simple-score">${matchCardScoreText(m)}<span>${esc(resultName(m,res))}</span></div>` : '';
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

  function matchCardScoreText(m){
    const s = scoreFor(m);
    if(!s || s.homeScore === null || s.awayScore === null || s.homeScore === undefined || s.awayScore === undefined) return '';
    return `${esc(s.homeScore)} - ${esc(s.awayScore)}`;
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
    const all = matches().sort((a,b) => Number(a.id) - Number(b.id));
    const now = Date.now();
    const todayKey = new Date().toISOString().slice(0,10);
    const needingScores = all.filter(m => !hasScore(m) && (m.date === todayKey || kickoffDate(m).getTime() <= now || isPickLocked(m))).slice(0,16);
    const scoreRows = (needingScores.length ? needingScores : all.slice(0,16)).map(adminScoreRow).join('');
    const lockedRows = all.filter(m => isPickLocked(m) && !hasScore(m)).slice(0,10).map(adminLockRow).join('') || '<p class="meta">No locked matches need scores.</p>';
    const completedRows = all.filter(hasScore).slice(-12).reverse().map(adminCompletedRow).join('') || '<p class="meta">No completed matches yet.</p>';
    const lastSync = state.updatedAt ? prettyTimestamp(state.updatedAt) : 'Not synced yet';
    const firebaseText = firebaseReady ? 'Firebase connected' : 'Local mode';
    $('adminTools').innerHTML = `
      <div class="admin-health-grid">
        <div class="admin-health-card"><span>Status</span><strong>${esc(firebaseText)}</strong></div>
        <div class="admin-health-card"><span>Last Sync</span><strong>${esc(lastSync)}</strong></div>
        <div class="admin-health-card"><span>Signed In</span><strong>Super Admin</strong></div>
      </div>
      <div class="admin-section">
        <h3>Scores</h3>
        <p class="meta">Enter scores, clear results, and pick an advancing team if a knockout match is tied.</p>
        <div class="admin-list">${scoreRows}</div>
      </div>
      <div class="admin-section">
        <h3>Locks</h3>
        <p class="meta">Use overrides only for mistakes or emergency changes.</p>
        <div class="admin-list">${lockedRows}</div>
      </div>
      <div class="admin-section">
        <h3>Completed Matches</h3>
        <div class="admin-list">${completedRows}</div>
      </div>
      <div class="admin-section">
        <h3>Maintenance</h3>
        <div class="admin-actions clean-admin-actions">
          <button id="recalcAll" type="button" class="ghost small">Recalculate all</button>
          <button id="reloadFirebase" type="button" class="ghost small">Reload from Firebase</button>
          <button id="undoScore" type="button" class="ghost small">Undo last score</button>
          <button id="resetLocal" type="button" class="ghost small">Reset local data</button>
        </div>
      </div>`;
    $('adminScores').innerHTML = `<div class="audit-box"><h3>Audit Log</h3>${auditHtml()}</div>`;

    const resetBtn = $('resetLocal');
    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem(KEY);
        $('adminStatus').textContent = 'Local data reset. Refresh the page to reload Firebase data.';
      });
    }
    const undoBtn = $('undoScore');
    if(undoBtn) undoBtn.addEventListener('click', undoLastScore);
    const recalcBtn = $('recalcAll');
    if(recalcBtn) recalcBtn.addEventListener('click', () => {
      addAudit('Super Admin recalculated standings, groups, and bracket');
      saveState(); renderAll(); renderAdmin();
      $('adminStatus').textContent = 'Recalculated all competition data.';
    });
    const reloadBtn = $('reloadFirebase');
    if(reloadBtn) reloadBtn.addEventListener('click', reloadFromFirebase);
    document.querySelectorAll('[data-save-score]').forEach(b => b.addEventListener('click', () => saveScore(b.dataset.saveScore)));
    document.querySelectorAll('[data-clear-score]').forEach(b => b.addEventListener('click', () => clearScore(b.dataset.clearScore)));
    document.querySelectorAll('[data-toggle-lock]').forEach(b => b.addEventListener('click', () => toggleLock(b.dataset.toggleLock)));
  }

  function adminScoreRow(m){
    const tied = isKnockout(m.stage) && hasScore(m) && Number(m.homeScore) === Number(m.awayScore);
    const adv = state.advancers?.[m.id] || '';
    return `<div class="admin-row clean-admin-row">
      <div>#${esc(m.id)}</div>
      <div class="game-title">${flagFor(m.homeTeam)} ${esc(m.homeTeam)} vs ${flagFor(m.awayTeam)} ${esc(m.awayTeam)}<br><span class="meta">${prettyDate(m.date)} · ${esc(m.stage)} · ${lockStatusText(m)}</span></div>
      <input data-home="${esc(m.id)}" type="number" min="0" value="${m.homeScore ?? ''}" placeholder="Home">
      <input data-away="${esc(m.id)}" type="number" min="0" value="${m.awayScore ?? ''}" placeholder="Away">
      <select data-advancer="${esc(m.id)}" class="admin-advancer ${isKnockout(m.stage) ? '' : 'hidden'}">
        <option value="">Advancer if tied</option>
        <option value="HOME" ${adv === 'HOME' ? 'selected' : ''}>${esc(m.homeTeam)} advances</option>
        <option value="AWAY" ${adv === 'AWAY' ? 'selected' : ''}>${esc(m.awayTeam)} advances</option>
      </select>
      <button data-save-score="${esc(m.id)}" type="button">Save</button>
      <button data-clear-score="${esc(m.id)}" type="button" class="ghost small">Clear</button>
      ${tied && !adv ? '<small class="admin-warning">Needs winner</small>' : ''}
    </div>`;
  }

  function adminLockRow(m){
    return `<div class="admin-row clean-admin-row lock-only-row">
      <div>#${esc(m.id)}</div>
      <div class="game-title">${esc(m.homeTeam)} vs ${esc(m.awayTeam)}<br><span class="meta">${prettyDate(m.date)} · ${esc(m.stage)} · ${lockStatusText(m)}</span></div>
      <button data-toggle-lock="${esc(m.id)}" type="button" class="ghost small">${lockOverrideLabel(m.id)}</button>
    </div>`;
  }

  function adminCompletedRow(m){
    const score = `${scoreText(m.homeScore)}-${scoreText(m.awayScore)}`;
    const adv = state.advancers?.[m.id] ? ` · ${pickLabel(m, state.advancers[m.id])} advances` : '';
    return `<div class="admin-completed-line"><strong>Match ${esc(m.id)}</strong><span>${esc(m.homeTeam)} ${esc(score)} ${esc(m.awayTeam)}${esc(adv)}</span></div>`;
  }

  function lockStatusText(m){
    const override = state.lockOverrides?.[m.id];
    if(override === 'locked') return 'Locked by admin';
    if(override === 'unlocked') return 'Unlocked by admin';
    return isPickLocked(m) ? 'Locked' : 'Open';
  }

  function saveScore(id){
    const h = document.querySelector(`[data-home="${CSS.escape(id)}"]`).value;
    const a = document.querySelector(`[data-away="${CSS.escape(id)}"]`).value;
    const advSel = document.querySelector(`[data-advancer="${CSS.escape(id)}"]`);
    const advancer = advSel ? advSel.value : '';
    const m = matches().find(match => String(match.id) === String(id));
    if(!m){ $('adminStatus').textContent = 'Match not found.'; return; }
    if(h === '' || a === ''){ $('adminStatus').textContent = 'Enter both scores before saving.'; return; }
    if(Number(h) < 0 || Number(a) < 0){ $('adminStatus').textContent = 'Scores cannot be negative.'; return; }
    if(isKnockout(m.stage) && Number(h) === Number(a) && advancer !== 'HOME' && advancer !== 'AWAY'){
      $('adminStatus').textContent = 'Knockout match is tied. Choose which team advances.';
      return;
    }
    state.previousRanks = rankSnapshot();
    const prior = state.scores[id] ? Object.assign({}, state.scores[id]) : null;
    const priorAdvancer = state.advancers?.[id] || null;
    state.scoreHistory = state.scoreHistory || [];
    state.scoreHistory.push({ id, prior, priorAdvancer, at:new Date().toISOString() });
    state.scoreHistory = state.scoreHistory.slice(-25);
    state.scores[id] = { homeScore: Number(h), awayScore: Number(a) };
    state.advancers = state.advancers || {};
    if(isKnockout(m.stage) && Number(h) === Number(a)) state.advancers[id] = advancer;
    else delete state.advancers[id];
    addAudit(`Super Admin updated Match ${id} score to ${h}-${a}${state.advancers[id] ? `, ${pickLabel(m, state.advancers[id])} advances` : ''}`);
    saveState();
    renderAll();
    renderAdmin();
  }

  function clearScore(id){
    const prior = state.scores[id] ? Object.assign({}, state.scores[id]) : null;
    const priorAdvancer = state.advancers?.[id] || null;
    if(!prior && !priorAdvancer){ $('adminStatus').textContent = 'No score to clear.'; return; }
    state.previousRanks = rankSnapshot();
    state.scoreHistory = state.scoreHistory || [];
    state.scoreHistory.push({ id, prior, priorAdvancer, at:new Date().toISOString() });
    delete state.scores[id];
    if(state.advancers) delete state.advancers[id];
    addAudit(`Super Admin cleared Match ${id} result`);
    saveState(); renderAll(); renderAdmin();
  }

  function reloadFromFirebase(){
    if(!firebaseReady || !docRef){ $('adminStatus').textContent = 'Firebase is not connected.'; return; }
    docRef.get().then(snapshot => {
      if(!snapshot.exists){ $('adminStatus').textContent = 'No Firebase data found.'; return; }
      const data = snapshot.data() || {};
      applyingRemote = true;
      state.picks = data.picks || {};
      state.pickMeta = data.pickMeta || {};
      state.scores = data.scores || {};
      state.advancers = data.advancers || {};
      state.teams = data.teams || {};
      state.lockOverrides = data.lockOverrides || {};
      state.audit = data.audit || [];
      state.scoreHistory = data.scoreHistory || [];
      state.previousRanks = data.previousRanks || null;
      state.backups = data.backups || {};
      state.updatedAt = data.updatedAt || null;
      saveLocal();
      applyingRemote = false;
      renderAll(); renderAdmin();
      $('adminStatus').textContent = 'Reloaded from Firebase.';
    }).catch(err => {
      $('adminStatus').textContent = 'Firebase reload failed.';
      console.error('Firebase reload error:', err);
    });
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
    const detail = $('overallCountdownDetail');
    const status = $('overallCountdownStatus');
    if(!title || !value) return;

    const setClock = (label, timeValue, detailText, statusText, statusClass) => {
      title.textContent = label;
      value.textContent = timeValue;
      if(detail) detail.textContent = detailText || '';
      if(status){
        status.textContent = statusText || '';
        status.className = `clock-status ${statusClass || ''}`.trim();
      }
    };

    const ms = matches().slice().sort((a,b) => kickoffDate(a) - kickoffDate(b));
    if(!ms.length){
      setClock('Tournament Clock', '--', 'No matches loaded', 'No Schedule', 'bad');
      return;
    }

    const now = Date.now();
    const first = ms[0];
    const final = ms.find(m => m.stage === 'Final') || ms[ms.length - 1];
    const firstKick = kickoffDate(first).getTime();
    const finalKick = kickoffDate(final).getTime();
    const next = ms.find(m => kickoffDate(m).getTime() > now);

    if(now < firstKick){
      setClock(
        'World Cup starts in',
        formatDuration(firstKick - now),
        `First kickoff: ${matchClockLabel(first)}`,
        'Pre-Tournament',
        'pre'
      );
      return;
    }

    if(next){
      const isFinalNext = String(next.stage || '').toLowerCase() === 'final';
      setClock(
        isFinalNext ? 'Final kickoff' : 'Next kickoff',
        formatDuration(kickoffDate(next).getTime() - now),
        matchClockLabel(next),
        isFinalNext ? 'Final Day' : 'Live',
        isFinalNext ? 'final' : 'live'
      );
      return;
    }

    const finalResult = final ? resultFor(final) : null;
    if(final && hasScore(final) && finalResult && finalResult !== 'DRAW'){
      const champion = finalResult === 'HOME' ? final.homeTeam : final.awayTeam;
      setClock(
        'Tournament complete',
        'Champion crowned',
        `Champion: ${champion || 'TBD'}`,
        'Complete',
        'complete'
      );
      return;
    }

    if(now >= finalKick){
      setClock(
        'Final kickoff',
        'Awaiting final result',
        final ? matchClockLabel(final) : 'Final match pending',
        'Final Day',
        'final'
      );
      return;
    }

    setClock('Tournament Clock', '--', 'Schedule pending', 'Live', 'live');
  }

  function matchClockLabel(m){
    if(!m) return '';
    const teams = `${m.homeTeam || 'TBD'} vs ${m.awayTeam || 'TBD'}`;
    const dateText = formatClockDate(m);
    return `Match ${m.id}: ${teams}, ${dateText}`;
  }

  function formatClockDate(m){
    if(!m || !m.date) return 'Time TBD';
    const [year, month, day] = String(m.date).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    const dateText = date.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
    const time = normalizeTime(m.timeET || '00:00');
    const [h, min] = time.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${dateText}, ${hour}:${String(min || 0).padStart(2,'0')} ${suffix} ET`;
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
    if(index === 0) return '<span class="q-badge qualified">Q</span> <small>Winner</small>';
    if(index === 1) return '<span class="q-badge qualified">Q</span> <small>Runner-up</small>';
    if(index === 2 && advancingThirdGroups && advancingThirdGroups.has(String(group).toUpperCase())) return '<span class="q-badge wildcard">WC</span> <small>Wildcard</small>';
    return '<span class="q-badge eliminated">E</span> <small>Eliminated</small>';
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
    state.advancers = state.advancers || {};
    if(last.priorAdvancer) state.advancers[last.id] = last.priorAdvancer;
    else delete state.advancers[last.id];
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
    const stageOrder = ['Round of 32','Round of 16','Quarter-finals','Semi-finals','Final','Third Place'];
    const tabLabels = ['All', ...stageOrder];
    const tabs = $('bracketRoundTabs');
    if(tabs){
      tabs.innerHTML = tabLabels.map(label => `<button type="button" class="bracket-tab ${label === activeBracketRound ? 'active' : ''}" data-bracket-round="${esc(label)}">${esc(shortRoundLabel(label))}</button>`).join('');
      tabs.querySelectorAll('[data-bracket-round]').forEach(btn => btn.addEventListener('click', () => {
        activeBracketRound = btn.getAttribute('data-bracket-round') || 'All';
        renderBracket();
      }));
    }

    renderChampionCard();

    const all = matches().filter(m => stageOrder.includes(m.stage)).sort((a,b) => Number(a.id) - Number(b.id));
    const visibleStages = activeBracketRound === 'All' ? stageOrder : [activeBracketRound];
    const advanceMap = knockoutAdvanceMap(all);
    el.classList.toggle('single-round', activeBracketRound !== 'All');
    el.innerHTML = visibleStages.map(stage => {
      const rows = all.filter(m => m.stage === stage);
      if(!rows.length) return '';
      return `<div class="bracket-round"><h3>${esc(stage)}</h3><div class="bracket-round-list">${rows.map(m => bracketMatchCard(m, advanceMap)).join('')}</div></div>`;
    }).join('');
  }

  function shortRoundLabel(label){
    if(label === 'Round of 32') return 'R32';
    if(label === 'Round of 16') return 'R16';
    if(label === 'Quarter-finals') return 'QF';
    if(label === 'Semi-finals') return 'SF';
    if(label === 'Third Place') return '3rd';
    return label;
  }

  function knockoutAdvanceMap(allMatches){
    const map = {};
    allMatches.forEach(next => {
      ['homeTeam','awayTeam'].forEach(slot => {
        const text = String(next[slot] || '');
        const winner = text.match(/^Match (\d+) Winner$/i);
        const loser = text.match(/^Match (\d+) Loser$/i);
        if(winner){
          const id = winner[1];
          map[id] = map[id] || [];
          map[id].push({ type:'Winner', nextId:next.id });
        }
        if(loser){
          const id = loser[1];
          map[id] = map[id] || [];
          map[id].push({ type:'Loser', nextId:next.id });
        }
      });
    });
    return map;
  }

  function bracketMatchCard(m, advanceMap){
    const res = resultFor(m);
    const tied = res === 'DRAW';
    const homeWinner = res === 'HOME';
    const awayWinner = res === 'AWAY';
    const score = hasScore(m) ? `${scoreText(m.homeScore)} - ${scoreText(m.awayScore)}` : 'TBD';
    const advance = advanceText(m, advanceMap);
    const status = !hasScore(m) ? 'TBD' : tied ? 'Needs winner' : 'Final';
    return `<article class="bracket-card ${res && !tied ? 'complete' : ''} ${tied ? 'needs-winner' : ''}">
      <div class="bracket-card-head"><span>Match ${esc(m.id)}</span><small>${esc(m.stage)}</small></div>
      <div class="bracket-team ${homeWinner ? 'winner' : ''}">${flagFor(m.homeTeam)}<strong>${esc(m.homeTeam || 'TBD')}</strong><span>${scoreText(m.homeScore)}</span></div>
      <div class="bracket-team ${awayWinner ? 'winner' : ''}">${flagFor(m.awayTeam)}<strong>${esc(m.awayTeam || 'TBD')}</strong><span>${scoreText(m.awayScore)}</span></div>
      <div class="bracket-footer"><span class="bracket-status">${esc(status)}</span><span>${esc(advance)}</span></div>
    </article>`;
  }

  function hasScore(m){
    return !(m.homeScore === null || m.homeScore === undefined || m.homeScore === '' || m.awayScore === null || m.awayScore === undefined || m.awayScore === '');
  }

  function advanceText(m, advanceMap){
    if(m.stage === 'Final') return 'Champion decided here';
    if(m.stage === 'Third Place') return 'Third place decided here';
    const items = advanceMap[String(m.id)] || [];
    if(!items.length) return 'Advancement TBD';
    return items.map(item => `${item.type} advances to Match ${item.nextId}`).join(' · ');
  }

  function renderChampionCard(){
    const el = $('championCard'); if(!el) return;
    const final = matches().find(m => m.stage === 'Final');
    if(!final || !hasScore(final)){ el.innerHTML = '<div class="champion-placeholder">Champion card appears after the Final score is entered.</div>'; return; }
    const res = resultFor(final);
    if(!res || res === 'DRAW'){ el.innerHTML = '<div class="champion-placeholder">Final needs a winner before a champion is shown.</div>'; return; }
    const champion = res === 'HOME' ? final.homeTeam : final.awayTeam;
    const score = `${scoreText(final.homeScore)} - ${scoreText(final.awayScore)}`;
    el.innerHTML = `<div class="champion-inner"><span>🏆 Champion</span><strong>${flagFor(champion)} ${esc(champion)}</strong><em>Final: ${esc(score)}</em></div>`;
  }
  function renderInsights(){
    const podium = $('podium');
    const profiles = $('regionProfiles');
    if(podium) podium.innerHTML = '';
    if(profiles) profiles.innerHTML = '';
    renderCompetitionInsights();
  }

  function renderCompetitionInsights(){
    const el = $('competitionInsights'); if(!el) return;
    const rows = calcStandings();
    if(!rows.length){ el.innerHTML = '<p class="meta">No standings data yet.</p>'; return; }
    const leader = rows[0];
    const best = bestFormRegion(rows);
    const mover = biggestMoverRegion(rows);
    const race = tightestRace(rows);
    const spotlight = rows.find(r => r.id === activeInsightRegion) || rows[0];
    activeInsightRegion = spotlight.id;
    el.innerHTML = `
      <div class="insight-top-row">
        ${topInsightCard('Leader', leader.region, `${leader.pts} pts · ${leader.accuracy}% acc`)}
        ${topInsightCard('Tightest Race', race.title, race.detail)}
        ${topInsightCard('Best Form', best.region, `${best.form || '-'} · ${best.formScore} form pts`)}
        ${topInsightCard('Biggest Mover', mover.title, mover.detail)}
      </div>
      <div class="simple-insight-layout">
        <section class="insight-panel pick-trends-panel"><h3>Pick Trends</h3>${pickTrendsPanel()}</section>
        <section class="insight-panel region-spotlight-panel"><h3>Region Spotlight</h3>${regionSpotlightPanel(spotlight)}</section>
        <section class="insight-panel awards-race-panel"><h3>Awards Race</h3>${awardsRacePanel(rows)}</section>
        <section class="insight-panel upset-watch-panel"><h3>Upset Watch</h3>${upsetWatchPanel()}</section>
      </div>`;
    el.querySelectorAll('[data-insight-region]').forEach(btn => btn.addEventListener('click', () => {
      activeInsightRegion = btn.dataset.insightRegion;
      renderCompetitionInsights();
    }));
  }

  function topInsightCard(label, value, detail){
    return `<article class="top-insight-card"><span>${esc(label)}</span><strong>${esc(value || '-')}</strong><p>${esc(detail || '')}</p></article>`;
  }

  function formScore(row){
    return String(row.form || '').split(/\s+/).filter(Boolean).reduce((total,x) => total + (x === 'W' ? 3 : x === 'D' ? 1 : 0), 0);
  }

  function bestFormRegion(rows){
    const sorted = rows.slice().map(r => Object.assign({}, r, { formScore:formScore(r) })).sort((a,b) => b.formScore - a.formScore || b.pts - a.pts || b.accuracy - a.accuracy || a.region.localeCompare(b.region));
    return sorted[0] || { region:'-', form:'-', formScore:0 };
  }

  function biggestMoverRegion(rows){
    const prev = state.previousRanks || {};
    let best = null;
    rows.forEach((r,i) => {
      const current = i + 1;
      const previous = prev[r.id] || current;
      const move = previous - current;
      if(!best || move > best.move) best = { region:r.region, move };
    });
    if(!best || best.move <= 0) return { title:'No Movement', detail:'No upward moves yet' };
    return { title:best.region, detail:`▲ +${best.move} places` };
  }

  function tightestRace(rows){
    if(rows.length < 2) return { title:'Need More Teams', detail:'Race appears after standings load' };
    let best = null;
    for(let i=0;i<rows.length-1;i++){
      const gap = Math.abs(rows[i].pts - rows[i+1].pts);
      if(!best || gap < best.gap) best = { a:rows[i], b:rows[i+1], gap };
    }
    return { title:`${best.a.region} / ${best.b.region}`, detail:`${best.gap} point gap` };
  }

  function insightMatch(){
    const ms = matches().slice().sort((a,b) => kickoffDate(a) - kickoffDate(b));
    const now = new Date();
    return ms.find(m => !hasScore(m) && kickoffDate(m) >= now) || ms.find(m => !hasScore(m)) || ms[ms.length - 1] || ms[0];
  }

  function pickTrendsPanel(){
    const m = insightMatch();
    if(!m) return '<p class="meta">No matches loaded.</p>';
    const submitted = REGIONS.filter(r => state.picks[r.id]?.[m.id]).length;
    const title = `Match ${m.id}: ${m.homeTeam} vs ${m.awayTeam}`;
    if(!isPickLocked(m)){
      return `<p class="insight-match-title">${esc(title)}</p><div class="submitted-pill"><strong>${submitted} of ${REGIONS.length}</strong><span>submitted</span></div><p class="meta">Pick distribution appears after lock.</p>`;
    }
    const counts = { HOME:0, DRAW:0, AWAY:0 };
    REGIONS.forEach(r => { const pick = state.picks[r.id]?.[m.id]; if(counts[pick] !== undefined) counts[pick]++; });
    const items = [
      ['HOME', m.homeTeam, counts.HOME],
      ['DRAW', 'Draw', counts.DRAW],
      ['AWAY', m.awayTeam, counts.AWAY]
    ];
    return `<p class="insight-match-title">${esc(title)}</p><div class="trend-bars">${items.map(([key,label,count]) => trendBar(label, count, REGIONS.length)).join('')}</div>`;
  }

  function trendBar(label, count, total){
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `<div class="trend-bar"><div><strong>${esc(label)}</strong><span>${count}</span></div><i style="width:${pct}%"></i></div>`;
  }

  function regionSpotlightPanel(row){
    const tabs = REGIONS.map(r => `<button type="button" class="spotlight-tab ${r.id === row.id ? 'active' : ''}" data-insight-region="${esc(r.id)}">${esc(r.name)}</button>`).join('');
    return `<div class="spotlight-tabs">${tabs}</div>
      <div class="spotlight-card region-${row.id}">
        <strong>${esc(row.region)}</strong>
        <p>${esc(row.members)}</p>
        <div class="spotlight-stats">
          <span>${row.w}-${row.d}-${row.l}<small>Record</small></span>
          <span>${row.accuracy}%<small>Accuracy</small></span>
          <span>${row.gf}<small>GF</small></span>
          <span>${row.ga}<small>GA</small></span>
        </div>
        <div class="spotlight-form">${formIcons(row.form)}<span>${esc(row.streak)}</span></div>
      </div>`;
  }

  function awardsRacePanel(rows){
    const awards = awardLeaders(rows);
    const data = [
      ['Golden Ball', awards.goldenBall[0], r => `${r.accuracy}% acc`],
      ['Golden Boot', awards.goldenBoot[0], r => `${r.gf} GF`],
      ['Golden Glove', awards.goldenGlove[0], r => `${r.ga} GA`],
      ['Hot Streak', awards.hotStreak[0], r => `W${currentWinStreak(r)}`]
    ];
    return `<div class="award-race-list">${data.map(([name,row,detail]) => `<div><span>${esc(name)}</span><strong>${row ? esc(row.region) : '-'}</strong><em>${row ? esc(detail(row)) : '-'}</em></div>`).join('')}</div>`;
  }

  function upsetWatchPanel(){
    const scored = [];
    matches().forEach(m => {
      const res = resultFor(m); if(!res) return;
      const correct = REGIONS.filter(r => state.picks[r.id]?.[m.id] === res);
      if(correct.length > 0 && correct.length <= 2) scored.push(`<p><strong>Match ${esc(m.id)}</strong> ${correct.map(r=>esc(r.name)).join(', ')} called ${esc(resultName(m,res))}</p>`);
    });
    if(scored.length) return scored.slice(-4).join('');
    const upcoming = matches().find(m => !hasScore(m) && isPickLocked(m));
    if(!upcoming) return '<p class="meta">No upset watch yet.</p>';
    const counts = { HOME:[], DRAW:[], AWAY:[] };
    REGIONS.forEach(r => { const pick = state.picks[r.id]?.[upcoming.id]; if(counts[pick]) counts[pick].push(r.name); });
    const rare = Object.entries(counts).filter(([,list]) => list.length > 0 && list.length <= 1);
    if(!rare.length) return '<p class="meta">No rare picks on the current locked match.</p>';
    return rare.map(([pick,list]) => `<p><strong>${esc(resultName(upcoming,pick))}</strong> picked by ${list.map(esc).join(', ')}</p>`).join('');
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
    $('stageFilterButtons').addEventListener('click', e => {
      const btn = e.target.closest('[data-stage]');
      if(!btn) return;
      selectedStage = btn.getAttribute('data-stage');
      renderFilters();
      renderMatches();
    });
    $('dateFilterButtons').addEventListener('click', e => {
      const btn = e.target.closest('[data-date]');
      if(!btn) return;
      selectedDate = resolveQuickDate(btn.getAttribute('data-date'));
      renderFilters();
      renderMatches();
    });
    $('clearFilters').addEventListener('click', () => {
      selectedStage = 'All Stages';
      selectedDate = defaultMatchDate();
      renderFilters();
      renderMatches();
    });
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
  function prettyShortDate(d){
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
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
