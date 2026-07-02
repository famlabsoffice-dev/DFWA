const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../server/leaderboard.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('Starting migration...');

  // 1. Leaderboard Columns
  const columns = [
    { name: 'elo', type: 'INTEGER DEFAULT 1000' },
    { name: 'league', type: 'TEXT DEFAULT "BRONZE"' },
    { name: 'season_points', type: 'INTEGER DEFAULT 0' }
  ];

  columns.forEach(col => {
    db.run(`ALTER TABLE leaderboard ADD COLUMN ${col.name} ${col.type}`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`Column ${col.name} already exists.`);
        } else {
          console.error(`Error adding ${col.name}:`, err.message);
        }
      } else {
        console.log(`Column ${col.name} added.`);
      }
    });
  });

  // 2. Season Metadata Table
  db.run(`CREATE TABLE IF NOT EXISTS season_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    last_reset_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    season_number INTEGER DEFAULT 1
  )`, (err) => {
    if (err) console.error('Error creating season_metadata:', err.message);
    else {
      console.log('Table season_metadata ready.');
      db.get(`SELECT COUNT(*) as count FROM season_metadata`, (err, row) => {
        if (!err && row.count === 0) {
          db.run(`INSERT INTO season_metadata (season_number) VALUES (1)`, () => {
            console.log('Initial season metadata inserted.');
          });
        }
      });
    }
  });
});

setTimeout(() => {
  db.close();
  console.log('Migration finished.');
}, 2000);
