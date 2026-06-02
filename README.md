# Around the Grounds, FIFA World Cup 2026 Edition

A static GitHub Pages app for the SMC staff FIFA World Cup 2026 prediction competition.

The app supports regional picks, live standings, World Cup group standings, automatic knockout advancement, hidden picks until lock, Firebase multi-device sync, and a clean Super Admin scoring workflow.

## Current build

Build: `20260602-auto-scores`

This build is intended as the final pre-tournament version. Minor event updates should focus on scores, Firebase data, and small text or style fixes.

## What is included

- `index.html`, main page and app structure
- `styles.css`, site styling
- `app.js`, competition logic
- `schedule.js`, built-in match schedule
- `firebase-config.js`, backup Firebase config
- `firestore.rules`, Firestore rules to publish
- `.nojekyll`, required for clean GitHub Pages hosting
- `assets/`, backup logo and favicon files
- `README.md`, setup and operations guide

## Main features

### Public competition view

- ATG standings
- Match cards grouped by date
- Stage filter buttons
- Day filter buttons
- One clean tournament clock
- Picks hidden until each match locks
- Submitted and remaining counts before lock
- Regional picks revealed after lock
- Correct and incorrect pick highlighting after scores are entered
- Form icons for W, D, and L
- Award cards under standings

### ATG standings

Standings are sorted by:

1. Total points
2. Goal difference
3. Goals for

Standings columns:

- Move
- Region
- P
- W
- D
- L
- GF
- GA
- GD
- Pts
- Form
- Acc

Point system:

- Correct non-draw pick: 3 points
- Correct draw pick: 1 point
- Incorrect pick: 0 points
- No Pick after lock and score entry: 0 points and recorded as a loss

Goals for and goals against:

- If a region picks a winning team, it earns that team’s goals as GF
- The opposing team’s goals count as GA
- Draw picks earn 0 GF and 0 GA

### Award cards

The ATG Standings tab includes four awards:

- Golden Ball, highest accuracy
- Golden Boot, highest goals scored
- Golden Glove, lowest goals against
- Hot Streak, longest active winning streak

Award tie-breakers are handled in app logic.

### Match cards

Match cards are designed for fast scanning.

Each card includes:

- Match number
- Stage
- Status pill
- Team flags
- Home team
- Away team
- Date
- Time ET
- Venue
- Lock countdown when applicable
- Submitted count before lock
- Pick chips after lock
- Score display after result entry

Match status values:

- Open
- Locks Soon
- Locked
- Final

### Pick lock rules

Picks lock 1 hour before kickoff for each match.

Before lock:

- Public users see submitted and remaining counts
- Regional picks are hidden
- A logged-in region sees its own pick
- Other regions’ picks remain hidden

After lock:

- All regional picks are revealed
- Picks cannot be edited
- Pick results are calculated after scores are entered

### Tournament clock

The header has one main tournament clock with seconds.

Clock behavior:

- Before tournament start: countdown to first kickoff
- During tournament: countdown to next kickoff
- Final day: countdown to Final kickoff
- After Final result: tournament complete with champion

### World Cup Groups tab

The Groups tab shows one group at a time.

Each group table includes:

- P, total group matches played
- W, wins
- D, draws
- L, losses
- GF, goals scored
- GA, goals conceded
- GD, goal difference
- Pts, points
- Form, group play form only
- Knockout, current advancement status

Group ranking uses the configured tie-break order:

1. Head-to-head points
2. Head-to-head goal difference
3. Head-to-head goals scored
4. Overall goal difference
5. Overall goals scored

The Groups tab also includes:

- Group winner card
- Runner-up card
- Third-place status card
- Wildcard third-place advancement cards
- Third-place teams out card
- Collapsed tie-break details

### Wildcard third-place cards

The app shows 8 wildcard third-place advancement cards.

Eligible group sets:

- A/B/C/D/F
- C/D/F/G/H
- C/E/F/H/I
- E/H/I/J/K
- B/E/F/I/J
- A/E/H/I/J
- E/F/G/I/J
- D/E/I/J/L

A third-place group can only be assigned to one wildcard card.

Third-place teams not assigned to a wildcard card display as eliminated.

### Knockout bracket tab

The Knockout tab includes a bracket chart.

Behavior:

- Round of 32 fills from group standings
- Round of 16 fills from Round of 32 winners
- Quarter-finals fill from Round of 16 winners
- Semi-finals fill from Quarter-final winners
- Third Place and Final fill from Semi-final results
- Champion card shows after Final score entry

If a knockout score is tied, Super Admin must choose who advances.

### Competition Insights tab

The Insights tab includes:

- Leader card
- Tightest Race card
- Best Form card
- Biggest Mover card
- Pick Trends panel
- Region Spotlight panel
- Awards Race panel
- Upset Watch panel

## Regions and passcodes

| Region | Members | Passcode |
| --- | --- | --- |
| Steve & Josh | Steve, Josh | SJ2026 |
| Southeast | Justin, Ashley | SE2026 |
| Interns | Drake, Tucker, Vince | IN2026 |
| Texas/West | Zarin, Gabriella, Michelle | TX2026 |
| Midwest | Sean, Andrew, Sam | MW2026 |
| Mid-Atlantic | John, Skyler | MA2026 |

## Super Admin

Open Super Admin from the shield icon in the lower right.

Super Admin passcode:

```text
ATG2026ADMIN
```

Super Admin includes:

- Score entry
- Clear result
- Lock controls
- Firebase status
- Last sync time
- Reload from Firebase
- Reset local data
- Recalculate all
- Undo last score
- Audit log
- Knockout tie validation
- Home advances or Away advances selector for tied knockout matches

## Firebase setup

The project uses one Firestore document for shared data:

```text
competitions/worldcup2026
```

Firebase config is embedded in `index.html` and also included in `firebase-config.js` as a backup.

### Required Firebase steps

1. Open Firebase Console.
2. Select project `atg-world-cup-26`.
3. Open Firestore Database.
4. Create the Firestore database if it does not exist.
5. Open Firestore Rules.
6. Paste the contents of `firestore.rules`.
7. Publish the rules.
8. Open the deployed GitHub Pages site.
9. Confirm the Firebase status bar shows connected.

### Included Firestore rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /competitions/worldcup2026 {
      allow read, write: if true;
    }
  }
}
```

These rules are open for the internal competition app. Passcodes are app-level controls, not true authentication. For a private production app, replace passcodes with Firebase Authentication and locked Firestore rules.

## GitHub Pages deployment

Upload every file from the ZIP to the repository root.

Required root files:

- `index.html`
- `styles.css`
- `app.js`
- `schedule.js`
- `firebase-config.js`
- `firestore.rules`
- `.nojekyll`
- `README.md`

Recommended deployment steps:

1. Delete old files from the GitHub repository root.
2. Upload all files from this ZIP.
3. Commit changes.
4. Wait 1 to 3 minutes for GitHub Pages to rebuild.
5. Hard refresh the site.
6. Confirm the footer shows `Build 20260602-auto-scores`.

Hard refresh tips:

- Desktop Chrome: Ctrl + Shift + R
- Mac Chrome: Cmd + Shift + R
- iPhone Safari: close the tab, reopen the GitHub Pages URL

## Event-day workflow

### Before tournament

1. Upload final files to GitHub.
2. Publish Firestore rules.
3. Open site on two devices.
4. Enter a test pick on one device.
5. Confirm it appears on the second device.
6. Use Super Admin to reset local data if needed.
7. Confirm no test score remains in Firebase.

### Before each matchday

1. Open Super Admin.
2. Confirm Firebase connected.
3. Review today’s matches.
4. Confirm picks are open or locked as expected.
5. Confirm match cards show submitted and remaining counts.

### After each match

1. Open Super Admin.
2. Enter home score and away score.
3. For knockout ties, select who advances.
4. Save result.
5. Review ATG standings.
6. Review World Cup group standings or bracket.
7. Confirm audit log entry was created.

### If a score was entered wrong

1. Open Super Admin.
2. Use Undo Last Score, or clear the specific result.
3. Enter the correct score.
4. Recalculate all.
5. Check standings and bracket.

## Local storage and sync

The app uses Firebase for shared data and local storage as backup.

If Firebase fails:

- The page should still load
- Local data may remain on one device only
- Multi-device sync will not work until Firebase reconnects

Use Reset Local Data only from Super Admin.

Reset Local Data clears only the current browser’s local backup. It does not delete Firebase data.

## Troubleshooting

### Site does not update after GitHub upload

Check:

- `index.html` is at repository root
- Footer shows the new build number
- Browser cache was hard refreshed
- GitHub Pages finished rebuilding
- `.nojekyll` exists at root

### Firebase failed to load

Check:

- The browser has internet access
- Firebase scripts are not blocked by browser extensions
- Firestore Database exists
- Firestore rules were published
- The Firebase project ID is `atg-world-cup-26`

### Data does not show on second device

Check:

- Firebase status says connected
- Both devices use the same GitHub Pages URL
- Firestore rules are published
- The first device saved successfully
- The second device was refreshed after the save

### Images do not load

The logo and favicon are embedded directly in `index.html`.

Flags use local PNG files from assets/flags. No flag emojis or external flag image host are used.

The `assets` folder is included as backup.

### Picks are visible too early

Picks should only reveal after the lock time, which is 1 hour before kickoff.

Before lock, public users see only:

- Submitted count
- Remaining count
- Lock countdown

A logged-in region can see only its own pick.

### Knockout bracket does not advance

Check:

- Prior match has a saved score
- Knockout tie has an advancement selection
- Recalculate all was run if needed

## Final check results

Completed before this ZIP was created:

- JavaScript syntax checked for `app.js`
- JavaScript syntax checked for `schedule.js`
- Required root files confirmed
- GitHub Pages `.nojekyll` confirmed
- Build marker updated
- Cache-busting query strings updated
- README rewritten
- Logo and favicon checked as embedded data
- Local PNG flag assets included in assets/flags
- Firestore rules file included

## Recommended minor updates during the event

Keep changes small once the tournament starts.

Safe event updates:

- Score corrections
- Text corrections
- Style tweaks
- Firebase rules review
- Schedule time correction if FIFA changes a kickoff
- Team name correction for knockout placeholder replacement

Avoid major changes during the event:

- Changing scoring logic
- Changing Firestore document structure
- Changing region IDs
- Replacing schedule data format
- Reworking bracket logic

## Notes for future maintenance

The most important files are:

- `schedule.js` for match data
- `app.js` for competition logic
- `styles.css` for visual changes
- `index.html` for page structure and Firebase script loading

If the app breaks after a change, restore the last working ZIP and reapply only the needed update.

## Flag Assets Update

National flags are stored as local PNG files in `assets/flags/`.

These PNG files were converted from the uploaded `svg.zip` source and mapped by each country in `app.js`.

If a flag image fails to load, the app shows the country's three-letter FIFA code as the fallback.


## Region colors

No region uses gold. Gold is reserved for tournament branding, active tabs, awards, and major highlights.

Current region colors:
- Steve & Josh: Blue
- Southeast: Green
- Texas/West: Red
- Midwest: Purple
- Mid-Atlantic: Cyan
- Interns: Pink


## Device local time

Match times are stored from the schedule in Eastern time. The public display converts each kickoff to the viewer's device time zone and uses h:mm AM/PM formatting.

If the viewer is outside the Eastern time zone, the match card also shows the original Eastern kickoff time for reference.


## Final region and time fixes

- Texas/West includes Zarin, Gabriella, and Michelle.
- Region color IDs use stable code keys, so Texas/West styling works on GitHub Pages and Firebase.
- No region uses gold. Gold is reserved for branding, awards, active states, and highlights.
- Match cards display kickoff times in the viewer's device time zone using h:mm AM/PM. When the viewer is outside Eastern time, the original Eastern time also displays.


## Automatic score updates

This build supports a three-phase score workflow.

### Phase 1, Manual scoring remains primary

Super Admin can still enter scores manually. This is the safest source of truth.

### Phase 2, Score suggestions

Super Admin can check a score feed from the Super Admin panel.

Default feed path:

```text
score-feed.json
```

The feed can also point to an approved API endpoint or your own hosted JSON file.

Expected JSON shape:

```json
{
  "scores": [
    {
      "matchId": "1",
      "homeScore": 2,
      "awayScore": 1,
      "status": "final",
      "source": "Approved score source"
    }
  ]
}
```

Knockout penalty shootout example:

```json
{
  "scores": [
    {
      "matchId": "75",
      "homeScore": 1,
      "awayScore": 1,
      "homePens": 4,
      "awayPens": 3,
      "status": "final",
      "source": "Approved score source"
    }
  ]
}
```

### Phase 3, One-click approval

Score suggestions do not update standings automatically. Super Admin must approve each suggestion.

After approval:

- ATG standings update.
- World Cup group standings update.
- Wildcard third-place cards update.
- Knockout bracket advances.
- Firebase sync saves the approved result.
- Audit log records the change.

### Penalty shootout scoring rule

Penalty shootout goals are used only to determine the advancing team.

They do not count toward:

- Goals For
- Goals Against
- Goal Difference

Example:

```text
France 2
England 2
France wins 4-3 on penalties
```

ATG scoring:

- France pick is correct.
- France receives 2 GF and 2 GA.
- Penalty kicks do not add to GF or GA.
