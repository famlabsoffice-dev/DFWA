import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import { sendFriendRequest, acceptFriendRequest, listFriends, validateFriendAuth } from './social/friends.js';
import crypto from 'crypto';
import { calculateNewRating, getLeagueFromRating } from './social/leagues.js';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { setupBattleSync } from './social/battleSync.js';
import { generateShareCard } from './social/sharing.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const SYSTEM_SECRET = process.env.SYSTEM_SECRET || 'LOCAL_ONLY_UNTRUSTED';

// Security: Prevent production startup without a real secret
if (process.env.NODE_ENV === 'production' && SYSTEM_SECRET === 'LOCAL_ONLY_UNTRUSTED') {
  console.error(
    'FATAL: SYSTEM_SECRET is not set in production. Server will not start. Please set the SYSTEM_SECRET environment variable.'
  );
  process.exit(1);
}

if (SYSTEM_SECRET === 'LOCAL_ONLY_UNTRUSTED') {
  console.warn(
    'WARNING: SYSTEM_SECRET is not set. Using a default secret is insecure. Please set the SYSTEM_SECRET environment variable.'
  );
}

// Security: Trust proxy for correct IP resolution in rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

console.error('SERVER_STARTING_UP');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Limit pro IP
  handler: (req, res, next, options) => {
    const logEntry = {
      ip: req.ip,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
    };
    db.run(
      `INSERT INTO ratelimit_logs (ip, path, timestamp, userAgent) VALUES (?, ?, ?, ?)`,
      [logEntry.ip, logEntry.path, logEntry.timestamp, logEntry.userAgent],
      (err) => {
        if (err) console.error('Rate limit log error:', err);
      }
    );
    res.status(options.statusCode).send(options.message);
  },
});
app.use('/api/', limiter);

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 10, // Max. 10 Anfragen pro Stunde pro IP für Admin-Endpunkte
  message: 'Too many requests from this IP, please try again after an hour',
  handler: (req, res, next, options) => {
    const logEntry = {
      ip: req.ip,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
    };
    db.run(
      `INSERT INTO ratelimit_logs (ip, path, timestamp, userAgent) VALUES (?, ?, ?, ?)`,
      [logEntry.ip, logEntry.path, logEntry.timestamp, logEntry.userAgent],
      (err) => {
        if (err) console.error('Admin rate limit log error:', err);
      }
    );
    res.status(options.statusCode).send(options.message);
  },
});
app.use('/api/admin/', adminLimiter);
// Statische Dateien aus dem Vite-Build-Output (dist/) servieren
// Fallback auf Root-Verzeichnis falls dist/ nicht existiert (Entwicklung)
// const distPath = join(__dirname, '..', 'dist');
// const staticPath = existsSync(distPath) ? distPath : join(__dirname, '..');
  // app.use(express.static(staticPath));

// Database setup
const dbPath = join(__dirname, 'leaderboard.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err);
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
          mode TEXT DEFAULT 'classic',
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
  db.run(`CREATE TABLE IF NOT EXISTS ratelimit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip TEXT,
          path TEXT,
          timestamp DATETIME,
          userAgent TEXT
      )`);
  db.run(`CREATE TABLE IF NOT EXISTS error_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT, -- 'CLIENT' oder 'SERVER'
            message TEXT,
            stack TEXT,
            stateSnapshot TEXT, -- JSON-Snapshot des Client-States
            ip TEXT,
            userAgent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
  db.run(`CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metricName TEXT,
          value REAL,
          ip TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
  db.run(`ALTER TABLE leaderboard ADD COLUMN variant TEXT`, () => {});
  db.run(`ALTER TABLE leaderboard ADD COLUMN accuracy INTEGER`, () => {});
  db.run(`ALTER TABLE leaderboard ADD COLUMN mode TEXT DEFAULT 'classic'`, () => {});
  db.run(`ALTER TABLE leaderboard ADD COLUMN elo INTEGER DEFAULT 1000`, () => {});
  db.run(`ALTER TABLE leaderboard ADD COLUMN league TEXT DEFAULT 'BRONZE'`, () => {});
  db.run(`ALTER TABLE leaderboard ADD COLUMN season_points INTEGER DEFAULT 0`, () => {});
  db.run(`CREATE TABLE IF NOT EXISTS season_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          last_reset_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
          season_number INTEGER DEFAULT 1
      )`, () => {
        // Initialize if empty
        db.get(`SELECT COUNT(*) as count FROM season_metadata`, (err, row) => {
          if (!err && row.count === 0) {
            db.run(`INSERT INTO season_metadata (season_number) VALUES (1)`);
          }
        });
      });
});

// Routes
// app.get("/config/secret", (req, res) => {
//     res.json({ secret: SYSTEM_SECRET });
// }); // Entfernt, da SYSTEM_SECRET nicht an den Client ausgeliefert werden darf.

app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const mode = req.query.mode || 'classic';
  db.all(
    `SELECT playerName, score, wins, losses, elo, league FROM leaderboard WHERE mode = ? ORDER BY score DESC LIMIT ?`,
    [mode, limit],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
      } else {
        res.json(rows);
      }
    }
  );
});

app.post('/api/leaderboard', (req, res) => {
  const { playerId, playerName, score, wins, losses, variant, accuracy, mode, ts, auth } = req.body;
  const modeVal = mode || 'classic';

  // Ensure types are consistent for HMAC calculation
  const scoreNum = Number(score);
  const winsNum = Number(wins);
  const lossesNum = Number(losses);
  const tsNum = Number(ts);

  // 1. Replay Protection: Validate timestamp (max 30s old)
  const now = Date.now();
  if (!tsNum || Math.abs(now - tsNum) > 30000) {
    return res.status(403).json({ error: 'TIMESTAMP_EXPIRED_OR_INVALID' });
  }

  // 2. Integrity: Validate HMAC signature including timestamp
  const msg = JSON.stringify({
    playerId,
    score: scoreNum,
    wins: winsNum,
    losses: lossesNum,
    mode: modeVal,
    ts: tsNum,
  });
  const expectedAuth = crypto.createHmac('sha256', SYSTEM_SECRET).update(msg).digest('hex');

  if (auth !== expectedAuth && auth !== SYSTEM_SECRET) {
    return res.status(403).json({ error: 'INVALID_AUTH_SIGNATURE' });
  }

  if (!playerId || !playerName) {
    return res.status(400).json({ error: 'Missing playerId or playerName' });
  }

  const validModes = ['classic', 'timeAttack', 'hardcore'];
  if (!validModes.includes(modeVal)) {
    return res.status(400).json({ error: 'INVALID_MODE' });
  }

  const query = `
        INSERT INTO leaderboard (playerId, playerName, score, wins, losses, variant, accuracy, mode, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(playerId) DO UPDATE SET
            playerName = excluded.playerName,
            score = MAX(leaderboard.score, excluded.score),
            wins = excluded.wins,
            losses = excluded.losses,
            variant = excluded.variant,
            accuracy = excluded.accuracy,
            mode = excluded.mode,
            timestamp = CURRENT_TIMESTAMP
    `;

  // 3. League Logic: Update Elo and League
  db.get(`SELECT elo FROM leaderboard WHERE playerId = ?`, [playerId], (err, row) => {
    let currentElo = row ? row.elo : 1000;
    // For now, we assume a win if score is submitted, in a real scenario we'd need opponent data
    // This is a simplified integration for Phase 5.1
    const newElo = calculateNewRating(currentElo, 1000, 1); 
    const newLeague = getLeagueFromRating(newElo);

    const query = `
          INSERT INTO leaderboard (playerId, playerName, score, wins, losses, variant, accuracy, mode, elo, league, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(playerId) DO UPDATE SET
              playerName = excluded.playerName,
              score = MAX(leaderboard.score, excluded.score),
              wins = excluded.wins,
              losses = excluded.losses,
              variant = excluded.variant,
              accuracy = excluded.accuracy,
              mode = excluded.mode,
              elo = excluded.elo,
              league = excluded.league,
              timestamp = CURRENT_TIMESTAMP
      `;

    db.run(
      query,
      [playerId, playerName, score, wins, losses, variant, accuracy, modeVal, newElo, newLeague],
      function (err) {
        if (err) {
          console.error('Leaderboard update error:', err);
          res.status(500).json({ error: 'Database error' });
        } else {
          res.json({ success: true, newElo, newLeague });
        }
      }
    );
  });
});

// Statische Dateien und SPA-Fallback erst NACH den API-Routen
const distPathForStatic = join(__dirname, '..', 'dist');
const staticPathForStatic = existsSync(distPathForStatic)
  ? distPathForStatic
  : join(__dirname, '..');
app.use(express.static(staticPathForStatic));

app.post('/api/challenge/verify', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const data = JSON.parse(Buffer.from(code, 'base64').toString());
    const { seed, score, ts, sig } = data;

    const msg = JSON.stringify({ seed, score, ts });
    const expectedSig = crypto
      .createHmac('sha256', SYSTEM_SECRET)
      .update(msg)
      .digest('hex')
      .slice(0, 16);

    if (sig !== expectedSig) {
      return res.status(403).json({ valid: false, error: 'INVALID_SIGNATURE' });
    }

    if (Date.now() - ts > 86400000) {
      return res.status(403).json({ valid: false, error: 'EXPIRED' });
    }

    res.json({ valid: true, data: { seed, score } });
  } catch {
    res.status(400).json({ valid: false, error: 'MALFORMED_CODE' });
  }
});

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!SYSTEM_SECRET || !authHeader || authHeader !== `Bearer ${SYSTEM_SECRET}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/api/admin/ratelimit-logs', adminAuth, (req, res) => {
  db.all(`SELECT * FROM ratelimit_logs ORDER BY timestamp DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/metrics', (req, res) => {
  const { metricName, value } = req.body;
  db.run(
    `INSERT INTO performance_metrics (metricName, value, ip) VALUES (?, ?, ?)`,
    [metricName, value, req.ip],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to log metric' });
      res.json({ success: true });
    }
  );
});

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL;

async function sendAlert(errorData) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *DFWA Error Alert*\n*Type:* ${errorData.type}\n*Message:* ${errorData.message}\n*IP:* ${errorData.ip}\n*Time:* ${new Date().toISOString()}`,
      }),
    });
  } catch (e) {
    console.error('Failed to send alert webhook:', e);
  }
}

app.post('/api/errors/client', (req, res) => {
  const { message, stack, userAgent, stateSnapshot } = req.body;
  const logData = {
    type: 'CLIENT',
    message,
    stack,
    stateSnapshot: stateSnapshot ? JSON.stringify(stateSnapshot) : null,
    ip: req.ip,
    userAgent: userAgent || req.get('User-Agent'),
  };

  db.run(
    `INSERT INTO error_logs (type, message, stack, stateSnapshot, ip, userAgent) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      logData.type,
      logData.message,
      logData.stack,
      logData.stateSnapshot,
      logData.ip,
      logData.userAgent,
    ],
    async (err) => {
      if (err) return res.status(500).json({ error: 'Failed to log error' });
      await sendAlert(logData);
      res.json({ success: true });
    }
  );
});

app.get('/api/admin/error-logs', adminAuth, (req, res) => {
  db.all(`SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.get('/api/analytics', (req, res) => {
  db.all(
    `
        SELECT variant, COUNT(*) as count, ROUND(AVG(accuracy), 2) as avg_accuracy
        FROM leaderboard
        WHERE variant IS NOT NULL
        GROUP BY variant
    `,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
      } else {
        res.json(rows || []);
      }
    }
  );
});

app.post('/api/social/share-card', async (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'Missing playerId' });

  db.get(
    `SELECT playerName, score, league FROM leaderboard WHERE playerId = ?`,
    [playerId],
    async (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Player not found' });
      
      try {
        const buffer = await generateShareCard({
          playerName: row.playerName,
          score: row.score,
          league: row.league,
          achievements: ['First Win', 'Top 10'] // Mock für Phase 5.4
        });
        
        res.set('Content-Type', 'image/png');
        res.send(buffer);
      } catch (e) {
        res.status(500).json({ error: 'Failed to generate card' });
      }
    }
  );
});

// --- Friend System API ---
app.post('/api/social/friend-request', async (req, res) => {
  const { senderId, receiverId, auth } = req.body;
  if (!validateFriendAuth({ senderId, receiverId }, auth, SYSTEM_SECRET)) {
    return res.status(403).json({ error: 'INVALID_AUTH' });
  }
  try {
    const result = await sendFriendRequest(db, senderId, receiverId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/social/friend-accept', async (req, res) => {
  const { requestId, receiverId, auth } = req.body;
  if (!validateFriendAuth({ requestId, receiverId }, auth, SYSTEM_SECRET)) {
    return res.status(403).json({ error: 'INVALID_AUTH' });
  }
  try {
    const result = await acceptFriendRequest(db, requestId, receiverId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/social/friends/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const friends = await listFriends(db, userId);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// SPA-Fallback: Alle nicht-API-Routen auf index.html weiterleiten
app.get(/^\/(?!api).*/, (req, res) => {
  const indexPath = join(staticPathForStatic, 'index.html');
  res.sendFile(indexPath);
});

setupBattleSync(io, db);

httpServer.listen(PORT, () => {
  console.log(`Leaderboard server running on port ${PORT}`);

  // Automatisierte Log-Bereinigung alle 24 Stunden
  setInterval(
    () => {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - 7); // Behalte Logs für 7 Tage
      db.run(
        `DELETE FROM ratelimit_logs WHERE timestamp < ?`,
        [retentionDate.toISOString()],
        (err) => {
          if (err) console.error('Rate limit log cleanup error:', err);
        }
      );
      db.run(`DELETE FROM error_logs WHERE timestamp < ?`, [retentionDate.toISOString()], (err) => {
        if (err) console.error('Error log cleanup error:', err);
      });
      db.run(
        `DELETE FROM performance_metrics WHERE timestamp < ?`,
        [retentionDate.toISOString()],
        (err) => {
          if (err) console.error('Metrics cleanup error:', err);
        }
      );
    },
    24 * 60 * 60 * 1000
  );
});
