import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SYSTEM_SECRET = process.env.SYSTEM_SECRET;
if (!SYSTEM_SECRET) {
  console.warn(
    'WARNING: SYSTEM_SECRET is not set. Using a default secret is insecure. Please set the SYSTEM_SECRET environment variable.'
  );
}

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

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
app.use(express.static(join(__dirname, '..')));

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
  // Migration: Spalten hinzufügen falls sie fehlen
  db.run(`ALTER TABLE leaderboard ADD COLUMN variant TEXT`, (err) => {});
  db.run(`ALTER TABLE leaderboard ADD COLUMN accuracy INTEGER`, (err) => {});
});

// Routes
// app.get("/config/secret", (req, res) => {
//     res.json({ secret: SYSTEM_SECRET });
// }); // Entfernt, da SYSTEM_SECRET nicht an den Client ausgeliefert werden darf.

app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  db.all(
    `SELECT playerName, score, wins, losses FROM leaderboard ORDER BY score DESC LIMIT ?`,
    [limit],
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
  const { playerId, playerName, score, wins, losses, variant, accuracy, auth } = req.body;

  // Kryptografische Validierung des Leaderboard-Uploads
  const msg = JSON.stringify({ playerId, score, wins, losses });
  const expectedAuth = crypto
    .createHmac('sha256', SYSTEM_SECRET)
    .update(msg)
    .digest('hex');

  if (auth !== expectedAuth && auth !== SYSTEM_SECRET) {
    return res.status(403).json({ error: 'INVALID_AUTH_SIGNATURE' });
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

  db.run(query, [playerId, playerName, score, wins, losses, variant, accuracy], function (err) {
    if (err) {
      console.error('Leaderboard update error:', err);
      res.status(500).json({ error: 'Failed to update leaderboard' });
    } else {
      res.json({ success: true });
    }
  });
});

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
  } catch (e) {
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
        text: `🚨 *DFWA Error Alert*\n*Type:* ${errorData.type}\n*Message:* ${errorData.message}\n*IP:* ${errorData.ip}\n*Time:* ${new Date().toISOString()}`
      })
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
    userAgent: userAgent || req.get('User-Agent')
  };

  db.run(
    `INSERT INTO error_logs (type, message, stack, stateSnapshot, ip, userAgent) VALUES (?, ?, ?, ?, ?, ?)`,
    [logData.type, logData.message, logData.stack, logData.stateSnapshot, logData.ip, logData.userAgent],
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

app.listen(PORT, () => {
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
      db.run(`DELETE FROM performance_metrics WHERE timestamp < ?`, [retentionDate.toISOString()], (err) => {
        if (err) console.error('Metrics cleanup error:', err);
      });
    },
    24 * 60 * 60 * 1000
  );
});
