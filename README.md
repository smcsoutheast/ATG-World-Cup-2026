# Around the Grounds, FIFA World Cup 2026 Edition

Static GitHub Pages app for the SMC staff FIFA World Cup 2026 prediction competition.

## Files

- `index.html`, app layout
- `styles.css`, mobile-first light and dark theme
- `data.js`, competition settings, Firebase config, regions, passcodes, starter matches
- `app.js`, Firebase sync, scoring, picks, imports, exports, audit, history, bracket view

## Firebase

The supplied Firebase config is already installed in `data.js` and Firebase is enabled.

Firestore document used by the app:

```text
competitions/worldcup2026
```

Subcollections used by the app:

```text
competitions/worldcup2026/audit
competitions/worldcup2026/history
```

## Passcodes

Super admin:

```text
ATG2026ADMIN
```

Regional passcodes:

```text
Steve & Josh: SJ2026
Southeast: SE2026
Texas: TX2026
Midwest: MW2026
Mid-Atlantic: MA2026
```

## Manual game import

Super admin can paste JSON or CSV.

Required fields:

```text
match id, game date, game time eastern, home team, away team, venue
```

Recommended CSV headers:

```csv
matchId,date,timeET,homeTeam,awayTeam,venue,stage,group
m001,2026-06-11,15:00,Mexico,South Africa,Estadio Azteca,group,Group A
```

JSON format:

```json
[
  {
    "matchId": "m001",
    "date": "2026-06-11",
    "timeET": "15:00",
    "homeTeam": "Mexico",
    "awayTeam": "South Africa",
    "venue": "Estadio Azteca",
    "stage": "group",
    "group": "Group A"
  }
]
```

## Added features

- Firebase live sync
- Local fallback if Firebase fails
- Manual game import by JSON or CSV
- CSV file uploader
- Match lockout at kickoff time, Eastern Time
- Super admin unlock override by match
- Admin override for any regional pick
- Results entry and automatic standings recalculation
- Audit log for Firebase changes
- Leaderboard history snapshots
- Daily match dashboard
- Public standings and match pick view
- Correct pick highlighting
- Dark and light theme
- CSV export for Excel
- Browser print workflow for PDF
- Knockout bracket visualization

## Firestore rules for internal testing

These rules allow public reads and writes. Use them only for a private internal contest.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /competitions/{competitionId} {
      allow read, write: if true;
    }
    match /competitions/{competitionId}/{subcollection}/{documentId} {
      allow read, write: if true;
    }
  }
}
```

For production, use Firebase Authentication and protect admin writes with custom claims.

## GitHub Pages deploy

1. Upload all files to a GitHub repository.
2. Open Settings.
3. Open Pages.
4. Set source to the main branch and root folder.
5. Save.
