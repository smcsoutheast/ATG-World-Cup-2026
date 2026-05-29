# Around the Grounds, FIFA World Cup 2026 Edition

Static GitHub Pages app for the SMC staff prediction competition.

## Upload to GitHub

Upload these files to the repository root:

- index.html
- styles.css
- app.js
- data.js
- firestore.rules
- .nojekyll

The full match schedule is built into data.js. No schedule import is needed.

## Firebase

1. Open Firebase Console.
2. Open project atg-world-cup-26.
3. Create or open Firestore Database.
4. Paste firestore.rules into Firestore Rules.
5. Publish rules.

## Admin

Super admin passcode: ATG2026ADMIN

Regional passcodes:

- Steve & Josh: SJ2026
- Southeast: SE2026
- Texas: TX2026
- Midwest: MW2026
- Mid-Atlantic: MA2026

## Changes in this build

- Removed public Excel CSV export.
- Removed public PDF print button.
- Removed super admin import and export tools.
- Added the full schedule directly through data.js.
- Kept score entry, override tools, audit log, and live Firebase sync.
