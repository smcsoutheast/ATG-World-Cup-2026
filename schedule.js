rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /competitions/worldcup2026 {
      allow read, write: if true;
    }
  }
}
