const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCHEDULE_FILE = path.join(ROOT, "schedule.js");
const FEED_FILE = path.join(ROOT, "score-feed.json");

const provider = (process.env.SCORE_API_PROVIDER || "manual").toLowerCase();
const apiKey = process.env.SCORE_API_KEY || "";
const baseUrl = process.env.SCORE_API_BASE_URL || "";
const competitionId = process.env.SCORE_API_COMPETITION_ID || "";
const season = process.env.SCORE_API_SEASON || "2026";

function readSchedule() {
  const text = fs.readFileSync(SCHEDULE_FILE, "utf8");
  const match = text.match(/window\.ATG_SCHEDULE\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error("Could not find window.ATG_SCHEDULE in schedule.js");
  return Function(`"use strict"; return (${match[1]});`)();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameTeam(a, b) {
  return normalizeName(a) === normalizeName(b);
}

function findScheduleMatch(apiMatch, schedule) {
  const apiDate = String(apiMatch.date || apiMatch.utcDate || apiMatch.matchDate || "").slice(0, 10);
  const home = apiMatch.homeTeam || apiMatch.home || apiMatch.home_name || "";
  const away = apiMatch.awayTeam || apiMatch.away || apiMatch.away_name || "";
  return schedule.find(match => {
    const dateMatch = !apiDate || String(match.date || "").slice(0, 10) === apiDate;
    return dateMatch && sameTeam(match.homeTeam, home) && sameTeam(match.awayTeam, away);
  });
}

function scoreEntry(matchId, homeScore, awayScore, extras = {}) {
  return {
    matchId: String(matchId),
    homeScore: Number(homeScore),
    awayScore: Number(awayScore),
    homePens: extras.homePens ?? "",
    awayPens: extras.awayPens ?? "",
    status: extras.status || "final",
    source: extras.source || provider || "score-feed",
    updatedAt: new Date().toISOString()
  };
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });

  if (response.status === 404) {
    console.warn(`API endpoint not available yet: ${url}`);
    return { __notAvailable: true, matches: [], response: [], scores: [] };
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function loadFootballDataScores(schedule) {
  if (!apiKey) throw new Error("Missing SCORE_API_KEY");
  const comp = competitionId || "WC";
  const apiRoot = baseUrl || "https://api.football-data.org/v4";
  const urls = [
    `${apiRoot}/competitions/${encodeURIComponent(comp)}/matches?season=${encodeURIComponent(season)}`,
    `${apiRoot}/competitions/${encodeURIComponent(comp)}/matches`
  ];

  let data = { matches: [] };
  for (const url of urls) {
    data = await fetchJson(url, { "X-Auth-Token": apiKey });
    if (Array.isArray(data.matches) && data.matches.length) break;
  }

  const matches = Array.isArray(data.matches) ? data.matches : [];

  return matches
    .filter(m => ["FINISHED", "IN_PLAY", "PAUSED"].includes(String(m.status || "").toUpperCase()))
    .map(m => {
      const scheduled = findScheduleMatch({
        date: m.utcDate,
        homeTeam: m.homeTeam && m.homeTeam.name,
        awayTeam: m.awayTeam && m.awayTeam.name
      }, schedule);
      if (!scheduled) return null;
      const full = (m.score && m.score.fullTime) || {};
      const pens = (m.score && m.score.penalties) || {};
      if (full.home === null || full.home === undefined || full.away === null || full.away === undefined) return null;
      return scoreEntry(scheduled.id, full.home, full.away, {
        homePens: pens.home ?? "",
        awayPens: pens.away ?? "",
        status: String(m.status || "").toLowerCase(),
        source: "football-data.org"
      });
    })
    .filter(Boolean);
}

async function loadApiFootballScores(schedule) {
  if (!apiKey) throw new Error("Missing SCORE_API_KEY");
  const url = `${baseUrl || "https://v3.football.api-sports.io"}/fixtures?league=${encodeURIComponent(competitionId)}&season=${encodeURIComponent(season)}`;
  const data = await fetchJson(url, { "x-apisports-key": apiKey });
  const fixtures = Array.isArray(data.response) ? data.response : [];

  return fixtures
    .filter(item => ["FT", "AET", "PEN", "LIVE", "HT"].includes(String(item.fixture && item.fixture.status && item.fixture.status.short || "").toUpperCase()))
    .map(item => {
      const scheduled = findScheduleMatch({
        date: item.fixture && item.fixture.date,
        homeTeam: item.teams && item.teams.home && item.teams.home.name,
        awayTeam: item.teams && item.teams.away && item.teams.away.name
      }, schedule);
      if (!scheduled) return null;
      const goals = item.goals || {};
      const penalty = (item.score && item.score.penalty) || {};
      if (goals.home === null || goals.home === undefined || goals.away === null || goals.away === undefined) return null;
      return scoreEntry(scheduled.id, goals.home, goals.away, {
        homePens: penalty.home ?? "",
        awayPens: penalty.away ?? "",
        status: String(item.fixture && item.fixture.status && item.fixture.status.short || "").toLowerCase(),
        source: "api-football"
      });
    })
    .filter(Boolean);
}

async function loadCustomScores(schedule) {
  if (!baseUrl) return [];
  const data = await fetchJson(baseUrl, apiKey ? { Authorization: `Bearer ${apiKey}` } : {});
  const rows = Array.isArray(data) ? data : Array.isArray(data.scores) ? data.scores : Array.isArray(data.matches) ? data.matches : [];

  return rows.map(row => {
    const scheduled = row.matchId ? { id: row.matchId } : findScheduleMatch(row, schedule);
    if (!scheduled) return null;
    const homeScore = row.homeScore ?? row.home_goals ?? row.homeGoals ?? row.home;
    const awayScore = row.awayScore ?? row.away_goals ?? row.awayGoals ?? row.away;
    if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) return null;
    return scoreEntry(scheduled.id, homeScore, awayScore, {
      homePens: row.homePens ?? row.home_penalties ?? "",
      awayPens: row.awayPens ?? row.away_penalties ?? "",
      status: row.status || "final",
      source: row.source || "custom-score-feed"
    });
  }).filter(Boolean);
}

async function main() {
  const schedule = readSchedule();
  let scores = [];
  if (provider === "football-data") scores = await loadFootballDataScores(schedule);
  else if (provider === "api-football") scores = await loadApiFootballScores(schedule);
  else if (provider === "custom") scores = await loadCustomScores(schedule);

  const feed = {
    updatedAt: new Date().toISOString(),
    provider,
    mode: "suggestions_only",
    note: "Super Admin must approve these suggestions before standings update.",
    scores
  };

  fs.writeFileSync(FEED_FILE, JSON.stringify(feed, null, 2) + "\\n");
  console.log(`Wrote ${scores.length} score suggestion(s) to score-feed.json`);
  if (!scores.length) {
    console.log("No score suggestions found. This is OK before the API publishes matching World Cup 2026 fixtures or finished scores.");
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
