# Around the Grounds, World Cup 2026

Simple GitHub Pages app with Firebase multi-device sync.

## Files to upload
Upload every file in this ZIP to the root of your GitHub Pages repository.

## Firebase setup
1. Open Firebase Console.
2. Select project `atg-world-cup-26`.
3. Create or open Firestore Database.
4. Go to Firestore Rules.
5. Paste the contents of `firestore.rules`.
6. Publish.

The app stores shared picks and scores in one document:

`competitions/worldcup2026`

## Passcodes
Super admin: `ATG2026ADMIN`

Regions:
- Steve & Josh: `SJ2026`
- Southeast: `SE2026`
- Interns: `IN2026`
- Texas: `TX2026`
- Midwest: `MW2026`
- Mid-Atlantic: `MA2026`

Current regions:
- Steve & Josh: Steve, Josh
- Southeast: Justin, Ashley
- Interns: Drake, Tucker, Vince
- Texas: Zarin, Gabriella
- Midwest: Sean, Andrew, Sam
- Mid-Atlantic: John, Skyler

## Sync notes
If Firebase loads, the status bar says `Firebase sync active.`

If rules are missing, the page still works locally but will show a Firebase error.
