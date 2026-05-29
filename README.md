# Around the Grounds, FIFA World Cup 2026 Edition

Static GitHub Pages project for the SMC staff prediction competition.

## What is included

- Full 104-match schedule from the uploaded CSV
- Firebase Firestore live sync
- Regional passcode entry
- Super admin score entry
- Super admin CSV import
- One-click bundled 104-match schedule reload
- Standings with P, W, D, L, GF, GA, GD, Pts, and Form
- Daily match cards with correct-pick highlighting
- CSV export and print/PDF option
- Firestore security rules file

## Upload to GitHub Pages

Upload these files to the repository root:

- index.html
- styles.css
- app.js
- data.js
- firestore.rules
- world-cup-2026-schedule.csv
- README.md

## Firebase setup

1. Open Firebase Console.
2. Select project: atg-world-cup-26.
3. Create Firestore Database if it does not exist.
4. Open Firestore Database, Rules.
5. Paste the contents of firestore.rules.
6. Publish.
7. Open the GitHub Pages site and hard refresh.

## Important Firebase note

If your Firestore database already has old match data, the site will load the saved Firebase data first.

To load the full 104-match schedule:

1. Open Admin.
2. Enter super admin passcode.
3. Open Import tab.
4. Click Load 104 Match Schedule.
5. Confirm it saves to Firebase.
6. Refresh on a second device.

## Passcodes

Super Admin:
ATG2026ADMIN

Regions:

- Steve & Josh: SJ2026
- Southeast: SE2026
- Texas: TX2026
- Midwest: MW2026
- Mid-Atlantic: MA2026

## CSV field support

The importer supports:

- match_number or matchId
- date
- time_et or timeET
- team_a or homeTeam
- team_b or awayTeam
- venue
- city
- country
- stage
- group
- status

