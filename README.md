# Around the Grounds, FIFA World Cup 2026 Edition

Static GitHub Pages app for SMC staff World Cup picks.

## Features
- Firebase multi-device sync with local backup.
- Staff region passcodes.
- Picks lock 1 hour before kickoff.
- Match countdowns with seconds.
- Public standings.
- World Cup group standings.
- Round of 32 teams populate from group standings after group scores are entered.
- Later knockout rounds populate from prior knockout results.
- Super admin scoring only.
- Country flag match cards.

## Super Admin
Open the shield icon in the lower right.

Passcode: ATG2026ADMIN

Use the scoring fields to enter match scores. Knockout teams update automatically.

## Firebase
Upload all files to GitHub Pages.
Then publish `firestore.rules` in Firebase Firestore Rules.
