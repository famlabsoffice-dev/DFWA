import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SYSTEM_SECRET = process.env.SYSTEM_SECRET || 'DFWA_SECRET_ACK_2026';

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 100 // Limit pro IP
});
app.use('/api/', limiter);
app.use(express.static(join(__dirname, '..')));

// Database setup
const dbPath = join(__dirname, 'leaderboard.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to SQLite database.');
});

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playerId TEXT UNIQUE,
            playerName TEXT,
            score INTEGER,
            wins INTEGER,
            losses INTEGER,
            variant TEXT,
            accuracy INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        // Migration: Spalten hinzufügen falls sie fehlen
        db.run(`ALTER TABLE leaderboard ADD COLUMN variant TEXT`, (err) => {});
        db.run(`ALTER TABLE leaderboard ADD COLUMN accuracy INTEGER`, (err) => {});
    });

// Routes
app.get('/config/secret', (req, res) => {
    res.json({ secret: SYSTEM_SECRET });
});

app.get('/api/leaderboard', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    db.all(`SELECT playerName, score, wins, losses FROM leaderboard ORDER BY score DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows);
        }
    });
});

app.post('/api/leaderboard', (req, res) => {
    const { playerId, playerName, score, wins, losses, variant, accuracy, auth } = req.body;
    
    // Einfache Integritätsprüfung (Secret-basiert)
    if (auth !== SYSTEM_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (!playerId || !playerName) {
        return res.status(400).json({ error: 'Missing playerId or playerName' });
    }

    const query = `
        INSERT INTO leaderboard (playerId, playerName, score, wins, losses, variant, accuracy, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(playerId) DO UPDATE SET
            playerName = excluded.playerName,
            score = MAX(leaderboard.score, excluded.score),
            wins = excluded.wins,
            losses = excluded.losses,
            variant = excluded.variant,
            accuracy = excluded.accuracy,
            timestamp = CURRENT_TIMESTAMP
    `;

    db.run(query, [playerId, playerName, score, wins, losses, variant, accuracy], function(err) {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to update leaderboard' });
        } else {
            res.json({ success: true });
        }
    });
});

app.get('/api/analytics', (req, res) => {
    db.all(`
        SELECT variant, COUNT(*) as count, ROUND(AVG(accuracy), 2) as avg_accuracy
        FROM leaderboard
        WHERE variant IS NOT NULL
        GROUP BY variant
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows || []);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Leaderboard server running on port ${PORT}`);
});
