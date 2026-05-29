window.ATG_CONFIG = {
  competitionName: 'Around the Grounds - FIFA World Cup 2026 Edition',
  fifaSourceUrl: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=US&wtw-filter=ALL',
  firebase: {
    enabled: false,
    collection: 'around-the-grounds',
    document: 'world-cup-2026',
    config: {
      apiKey: 'PASTE_FIREBASE_API_KEY',
      authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
      projectId: 'PASTE_PROJECT_ID',
      storageBucket: 'PASTE_PROJECT_ID.firebasestorage.app',
      messagingSenderId: 'PASTE_SENDER_ID',
      appId: 'PASTE_APP_ID'
    }
  },
  passcodes: {
    superAdmin: 'SMC2026ADMIN',
    regions: {
      'steve-josh': 'STEVEJOSH2026',
      southeast: 'SOUTHEAST2026',
      texas: 'TEXAS2026',
      midwest: 'MIDWEST2026',
      'mid-atlantic': 'MIDATLANTIC2026'
    }
  },
  regions: [
    { id: 'steve-josh', name: 'Steve & Josh', members: ['Steve', 'Josh'] },
    { id: 'southeast', name: 'Southeast', members: ['Justin', 'Ashley', 'Drake'] },
    { id: 'texas', name: 'Texas', members: ['Zarin', 'Gabriella'] },
    { id: 'midwest', name: 'Midwest', members: ['Sean', 'Andrew', 'Sam'] },
    { id: 'mid-atlantic', name: 'Mid-Atlantic', members: ['John', 'Skyler'] }
  ],
  matches: [
    { id: 'm001', date: '2026-06-11', time: '15:00', stage: 'group', group: 'Group A', home: 'Mexico', away: 'South Africa', venue: 'Estadio Azteca, Mexico City' },
    { id: 'm002', date: '2026-06-11', time: '21:00', stage: 'group', group: 'Group A', home: 'Canada', away: 'Qatar', venue: 'BMO Field, Toronto' },
    { id: 'm003', date: '2026-06-12', time: '15:00', stage: 'group', group: 'Group D', home: 'United States', away: 'Paraguay', venue: 'SoFi Stadium, Los Angeles' },
    { id: 'm004', date: '2026-06-12', time: '18:00', stage: 'group', group: 'Group B', home: 'Germany', away: 'Côte d’Ivoire', venue: 'MetLife Stadium, New York New Jersey' },
    { id: 'm005', date: '2026-06-13', time: '15:00', stage: 'group', group: 'Group C', home: 'Brazil', away: 'Scotland', venue: 'AT&T Stadium, Dallas' },
    { id: 'm006', date: '2026-06-13', time: '18:00', stage: 'group', group: 'Group C', home: 'Spain', away: 'Uruguay', venue: 'Hard Rock Stadium, Miami' },
    { id: 'm007', date: '2026-06-14', time: '15:00', stage: 'group', group: 'Group E', home: 'England', away: 'Japan', venue: 'Lincoln Financial Field, Philadelphia' },
    { id: 'm008', date: '2026-06-14', time: '18:00', stage: 'group', group: 'Group F', home: 'France', away: 'Senegal', venue: 'Mercedes-Benz Stadium, Atlanta' },
    { id: 'm009', date: '2026-06-15', time: '15:00', stage: 'group', group: 'Group G', home: 'Argentina', away: 'Algeria', venue: 'Arrowhead Stadium, Kansas City' },
    { id: 'm010', date: '2026-06-15', time: '18:00', stage: 'group', group: 'Group H', home: 'Portugal', away: 'South Korea', venue: 'NRG Stadium, Houston' },
    { id: 'm011', date: '2026-06-28', time: '15:00', stage: 'knockout', group: 'Round of 32', home: 'Winner Group A', away: 'Third Place Group C/E/F', venue: 'TBD' },
    { id: 'm012', date: '2026-06-28', time: '18:00', stage: 'knockout', group: 'Round of 32', home: 'Runner-up Group B', away: 'Runner-up Group F', venue: 'TBD' },
    { id: 'm013', date: '2026-07-04', time: '15:00', stage: 'knockout', group: 'Round of 16', home: 'Match 85 Winner', away: 'Match 86 Winner', venue: 'TBD' },
    { id: 'm014', date: '2026-07-09', time: '20:00', stage: 'knockout', group: 'Quarterfinal', home: 'Quarterfinalist 1', away: 'Quarterfinalist 2', venue: 'TBD' },
    { id: 'm015', date: '2026-07-14', time: '20:00', stage: 'knockout', group: 'Semifinal', home: 'Semifinalist 1', away: 'Semifinalist 2', venue: 'TBD' },
    { id: 'm016', date: '2026-07-19', time: '15:00', stage: 'knockout', group: 'Final', home: 'Finalist 1', away: 'Finalist 2', venue: 'MetLife Stadium, New York New Jersey' }
  ]
};
