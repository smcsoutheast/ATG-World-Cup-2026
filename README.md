# Around the Grounds - FIFA World Cup 2026 Edition

A static GitHub Pages app for the SMC staff FIFA World Cup 2026 prediction competition.

## Files

- `index.html`, page structure
- `styles.css`, full responsive styling with light and dark mode
- `data.js`, regions, passcodes, and editable match list
- `app.js`, picks, standings, scoring, admin tools, import and export

## Setup

1. Create a new GitHub repository.
2. Upload all files from this folder to the repository root.
3. Go to Settings, Pages.
4. Set source to `Deploy from a branch`.
5. Select `main` and `/root`.
6. Save.

## Passcodes

Super admin:

`SMC2026ADMIN`

Regional passcodes:

- Steve & Josh: `STEVEJOSH2026`
- Southeast: `SOUTHEAST2026`
- Texas: `TEXAS2026`
- Midwest: `MIDWEST2026`
- Mid-Atlantic: `MIDATLANTIC2026`

Change passcodes in `data.js` before publishing.

## Scoring

- Correct non-draw pick: 3 points
- Correct draw pick: 1 point
- Incorrect pick: 0 points
- Goals for and goals against come from the team selected
- Draw picks earn 0 goals for and 0 goals against
- Tiebreakers: points, goal difference, goals scored

## Match data

The app links to the official FIFA Scores & Fixtures page. Static GitHub Pages sites cannot reliably pull live data from FIFA because direct browser requests may be blocked by CORS or page scripting.

Use the super admin panel to enter final scores. Edit `data.js` to replace placeholder matches with the final official match list when needed.

## Data storage

This app stores picks and results in the browser with `localStorage`.

Use Super Admin, Export Save Data to copy the full save file. Paste it into Super Admin, Import Save Data on another browser to sync records.

For a true shared live database, connect this front end to Firebase, Supabase, or a GitHub-backed JSON workflow.
