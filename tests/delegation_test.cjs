const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    console.log('--- START DELEGATION & UI SYNC TEST ---');
    await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✓ Page loaded');

    // Test Add Player via Delegation
    const testName = 'MANUS_TEST';
    await page.type('#player-name', testName);
    
    // Klick auf das Element (Delegation sollte greifen)
    await page.click('#add-player-btn');
    console.log('✓ Add Player button clicked');
    
    await new Promise(r => setTimeout(r, 1000));

    // Prüfe ob Name im Header aktualisiert wurde (UI-Erzwingung Test)
    const headerName = await page.evaluate(() => {
      const el = document.getElementById('player-display');
      return el ? el.innerText : 'NOT_FOUND';
    });
    console.log(`Header Name: ${headerName}`);

    const statPlayerName = await page.evaluate(() => {
      const el = document.querySelector('#stat-player span');
      return el ? el.innerText : 'NOT_FOUND';
    });
    console.log(`Stat Player Name: ${statPlayerName}`);

    if (headerName === testName && statPlayerName === testName) {
      console.log('✓ SUCCESS: Delegation and UI Sync working!');
    } else {
      console.log('✗ FAILED: UI Sync mismatch');
    }

    console.log('--- TEST COMPLETE ---');
  } catch (err) {
    console.error('✗ TEST ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
