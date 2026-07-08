/**
 * @jest-environment node
 */
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const express = require('express');

const projectRoot = path.join(__dirname, '..');

let browser;
let page;
let apiServer;
let frontendServer;

const findFreePort = () => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
};

const startApiServer = (port) => {
  return new Promise((resolve, reject) => {
    apiServer = spawn('node', ['server/server.js'], { 
      cwd: projectRoot,
      env: { ...process.env, PORT: port, NODE_ENV: 'test' }
    });
    apiServer.stdout.on('data', (data) => {
      if (data.toString().includes('running on port')) {
        resolve();
      }
    });
    setTimeout(() => reject(new Error('API Server timeout')), 15000);
  });
};

const startFrontendServer = (port) => {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.static(path.join(projectRoot, 'dist')));
    frontendServer = app.listen(port, () => {
      resolve();
    });
  });
};

const stopServers = async () => {
  if (apiServer) {
    apiServer.kill('SIGKILL');
    await new Promise(resolve => apiServer.on('exit', resolve));
  }
  if (frontendServer) {
    await new Promise(resolve => frontendServer.close(resolve));
  }
};

jest.setTimeout(120000);

let URL;

beforeAll(async () => {
  try {
    const apiPort = await findFreePort();
    const frontendPort = await findFreePort();
    URL = `http://localhost:${frontendPort}`;

    await startApiServer(apiPort);
    await startFrontendServer(frontendPort);
    
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  } catch (err) {
    console.error('Setup failed:', err);
    stopServers();
    throw err;
  }
});

afterAll(async () => {
  if (browser) await browser.close();
  await stopServers();
});

describe('DFWA Integration Tests', () => {
  describe('PWA & Service Worker', () => {
    test('Page should load', async () => {
      const response = await page.goto(URL, { waitUntil: 'networkidle2' });
      expect(response.status()).toBe(200);
    });

    test('Manifest should be linked', async () => {
      await page.goto(URL, { waitUntil: 'networkidle2' });
      const manifest = await page.evaluate(() => {
        const link = document.querySelector('link[rel="manifest"]');
        return link ? link.getAttribute('href') : null;
      });
      expect(manifest).toBeTruthy();
    });
  });
});
