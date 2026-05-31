# Around the Grounds, FIFA World Cup 2026 Edition

Static GitHub Pages app for SMC staff World Cup picks.

## Features
- Firebase multi-device sync with local backup.
- Staff region passcodes.
- Picks lock 1 hour before kickoff.
- Match countdowns with seconds.
- Public standings.
- World Cup group standings with one group per tab.
- Round of 32 teams populate from group standings after group scores are entered.
- Later knockout rounds populate from prior knockout results.
- Super admin scoring only.
- Country flag match cards.
- ATG award cards: Golden Ball, Golden Boot, Golden Glove, and Hot Streak.

## Super Admin
Open the shield icon in the lower right.

Passcode: ATG2026ADMIN

Use the scoring fields to enter match scores. Knockout teams update automatically.

## Firebase
Upload all files to GitHub Pages.
Then publish `firestore.rules` in Firebase Firestore Rules.


Wildcard third-place slots

Round of 32 third-place placeholders now display as Highest 3rd Place from the listed eligible groups. The app resolves each slot from qualified wildcard third-place teams after group standings are complete.

Eligible group sets:
A/B/C/D/F
C/D/F/G/H
C/E/F/H/I
E/H/I/J/K
B/E/F/I/J
A/E/H/I/J
E/F/G/I/J
D/E/I/J/L


Build: 20260531-group-standings-full

GitHub Pages update checklist:
1. Upload every file from the ZIP to the repository root.
2. Confirm index.html is at the root, not inside a folder.
3. Wait 1 to 3 minutes for Pages to rebuild.
4. Hard refresh the site. On iPhone or iPad, close Safari tab and reopen the GitHub Pages URL.
5. Confirm the footer shows Build 20260531-group-standings-full.


Knockout bracket chart update:
- Added full bracket chart view on desktop.
- Added round filter tabs for mobile and focused viewing.
- Added champion card after Final score entry.
- Bracket uses automatic advancement from group and knockout results.


Update 20260531-group-standings-full:
- World Cup Groups table now shows P, W, D, L, GF, GA, GD, Pts, Form, and Knockout status.
- Group form uses W, D, L circle icons from group play only.
