# Around the Grounds - FIFA World Cup 2026 Edition

A static GitHub Pages app for the SMC staff FIFA World Cup 2026 prediction competition.

## Files

- `index.html`, page structure
- `styles.css`, full responsive styling with light and dark mode
- `data.js`, regions, passcodes, Firebase config, and fallback match list
- `app.js`, picks, standings, scoring, admin tools, Firebase sync, import and export

## GitHub Pages setup

1. Create a new GitHub repository.
2. Upload all files from this folder to the repository root.
3. Go to Settings, Pages.
4. Set source to `Deploy from a branch`.
5. Select `main` and `/root`.
6. Save.

## Firebase setup

The app uses Cloud Firestore when Firebase is enabled. Firestore supports document writes with `setDoc()` and live document listeners with `onSnapshot()`, which lets the public page update when picks, games, or scores change.

1. Create a Firebase project.
2. Add a Web App inside the Firebase console.
3. Copy the Firebase web config.
4. Open `data.js`.
5. Replace the placeholder values inside `firebase.config`.
6. Change `enabled: false` to `enabled: true`.
7. In Firebase, create a Cloud Firestore database.
8. Start in test mode for setup, then replace rules before public use.

Suggested starter rules for this passcode-only app:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /around-the-grounds/world-cup-2026 {
      allow read, write: if true;
    }
  }
}
```

This keeps setup simple, but it is not strict security. The app uses passcodes in front-end code. Anyone with code access could find them. For stronger security, add Firebase Authentication and user-based Firestore rules.

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

## Manual game import

Super admin can import games from the admin panel.

Paste a JSON array with these fields:

```json
[
  {
    "id": "m001",
    "date": "2026-06-11",
    "time": "15:00",
    "stage": "group",
    "group": "Group A",
    "home": "Mexico",
    "away": "South Africa",
    "venue": "Estadio Azteca, Mexico City"
  }
]
```

Required fields:

- `id` or `matchId`
- `date`, format `YYYY-MM-DD`
- `time`, format `HH:MM` eastern
- `home`
- `away`
- `venue`

Optional fields:

- `stage`, use `group` or `knockout`
- `group`, use group name or round name

When Firebase is enabled, imported games sync to all users.

## Scoring

- Correct non-draw pick: 3 points
- Correct draw pick: 1 point
- Incorrect pick: 0 points
- Goals for and goals against come from the team selected
- Draw picks earn 0 goals for and 0 goals against
- Tiebreakers: points, goal difference, goals scored

## Data storage

When Firebase is enabled, picks, results, and imported games save to this Firestore document:

`around-the-grounds/world-cup-2026`

When Firebase is disabled or unavailable, the app falls back to browser `localStorage`.
