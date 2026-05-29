window.ATG_CONFIG = {
  competitionName: 'Around the Grounds - FIFA World Cup 2026 Edition',
  fifaSourceUrl: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures?country=US&wtw-filter=ALL',
  firebase: {
    enabled: true,
    statePath: ['competitions', 'worldcup2026'],
    auditCollection: ['competitions', 'worldcup2026', 'audit'],
    historyCollection: ['competitions', 'worldcup2026', 'history'],
    config: {
      apiKey: 'AIzaSyBzQRQIQ7gqRuFV_64oUMbApIQSRcnjcnk',
      authDomain: 'atg-world-cup-26.firebaseapp.com',
      projectId: 'atg-world-cup-26',
      storageBucket: 'atg-world-cup-26.firebasestorage.app',
      messagingSenderId: '506347323919',
      appId: '1:506347323919:web:e92bdd07905073797c597a'
    }
  },
  passcodes: {
    superAdmin: 'ATG2026ADMIN',
    regions: {
      'steve-josh': 'SJ2026',
      southeast: 'SE2026',
      texas: 'TX2026',
      midwest: 'MW2026',
      'mid-atlantic': 'MA2026'
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
    { id: 'm003', date: '2026-06-12', time: '15:00', stage: 'group', group: 'Group D', home: 'United States', away: 'Paraguay', venue: 'SoFi Stadium, Los Angeles' }
  ]
};
