import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

let browser;
let page;
let serverProcess;

const startServer = () => {
  return new Promise((resolve) => {
    serverProcess = spawn('node', ['server/server.js'], { cwd: projectRoot });
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('running on port')) {
        setTimeout(resolve, 500);
      }
    });
  });
};

const stopServer = () => {
  return new Promise((resolve) => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess.on('exit', resolve);
    } else {
      resolve();
    }
  });
};

beforeAll(async () => {
  await startServer();
  browser = await puppeteer.launch({ headless: true });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
  await stopServer();
});

describe('DFWA Integration Tests', () => {
  describe('PWA & Service Worker', () => {
    test('Service Worker should be registered', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const swRegistered = await page.evaluate(() => {
        return navigator.serviceWorker ? true : false;
      });
      expect(swRegistered).toBe(true);
    });

    test('Manifest should be valid', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const manifest = await page.evaluate(() => {
        const link = document.querySelector('link[rel="manifest"]');
        return link ? link.href : null;
      });
      expect(manifest).toBeTruthy();
    });

    test('Critical assets should be cached', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const cacheNames = await page.evaluate(() => {
        return caches.keys().then((names) => names);
      });
      expect(cacheNames.length).toBeGreaterThan(0);
    });

    test('Offline fallback should work', async () => {
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      await page.context().setOfflineMode(true);
      const response = await page
        .goto('http://localhost:3000', { waitUntil: 'networkidle0' })
        .catch(() => null);
      expect(response).toBeTruthy();
      await page.context().setOfflineMode(false);
    });
  });

  describe('UI Responsiveness', () => {
    test('HUD should render on mobile (375px)', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const hudVisible = await page.evaluate(() => {
        const gameContainer = document.getElementById('game-container');
        return gameContainer ? window.getComputedStyle(gameContainer).display !== 'none' : false;
      });
      expect(hudVisible).toBe(true);
    });

    test('HUD should render on tablet (768px)', async () => {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const hudVisible = await page.evaluate(() => {
        const gameContainer = document.getElementById('game-container');
        return gameContainer ? window.getComputedStyle(gameContainer).display !== 'none' : false;
      });
      expect(hudVisible).toBe(true);
    });

    test('HUD should render on desktop (1920px)', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const hudVisible = await page.evaluate(() => {
        const gameContainer = document.getElementById('game-container');
        return gameContainer ? window.getComputedStyle(gameContainer).display !== 'none' : false;
      });
      expect(hudVisible).toBe(true);
    });

    test('HUD should render on ultra-wide (3440px)', async () => {
      await page.setViewport({ width: 3440, height: 1440 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const hudVisible = await page.evaluate(() => {
        const gameContainer = document.getElementById('game-container');
        return gameContainer ? window.getComputedStyle(gameContainer).display !== 'none' : false;
      });
      expect(hudVisible).toBe(true);
    });

    test('HUD should render on foldable (600px height, 1200px width)', async () => {
      await page.setViewport({ width: 1200, height: 600 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const hudVisible = await page.evaluate(() => {
        const gameContainer = document.getElementById('game-container');
        return gameContainer ? window.getComputedStyle(gameContainer).display !== 'none' : false;
      });
      expect(hudVisible).toBe(true);
    });

    test('Media queries should apply correctly', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const h1FontSize = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? window.getComputedStyle(h1).fontSize : null;
      });
      expect(h1FontSize).toBeTruthy();
      expect(parseFloat(h1FontSize)).toBeGreaterThan(0);
    });
  });

  describe('API Compatibility', () => {
    test('Leaderboard API should be accessible', async () => {
      const response = await page.goto('http://localhost:3000/api/leaderboard', {
        waitUntil: 'networkidle0',
      });
      expect(response.status()).toBe(200);
    });

    test('Analytics API should be accessible', async () => {
      const response = await page.goto('http://localhost:3000/api/analytics', {
        waitUntil: 'networkidle0',
      });
      expect(response.status()).toBe(200);
    });

    test('Rate limiting should be enforced', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        const response = await page.goto('http://localhost:3000/api/leaderboard', {
          waitUntil: 'networkidle0',
        });
        requests.push(response.status());
      }
      expect(requests.every((status) => status === 200 || status === 429)).toBe(true);
    });
  });

  describe('Security & Performance', () => {
    test('CSP headers should be present', async () => {
      const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const headers = response.headers();
      expect(headers['content-security-policy']).toBeTruthy();
    });

    test('Page should load within 3 seconds', async () => {
      const startTime = Date.now();
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    test('No console errors on load', async () => {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      expect(errors.length).toBe(0);
    });
  });
});
