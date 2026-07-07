const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812 });
  
  try {
    console.log('--- START VISUAL PROOF TEST ---');
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // 1. Screenshot VOR der Eingabe
    await page.screenshot({ path: '/home/ubuntu/DFWA/proof_before.png' });
    console.log('✓ Screenshot before taken');

    // 2. Name eingeben und auf + klicken
    await page.type('#player-name', 'MANUS_PROVED');
    await page.click('#add-player-btn');
    console.log('✓ Name entered and button clicked');
    
    // Warte auf UI-Update
    await new Promise(r => setTimeout(r, 2000));

    // 3. Screenshot NACH der Eingabe
    await page.screenshot({ path: '/home/ubuntu/DFWA/proof_after.png' });
    console.log('✓ Screenshot after taken');

    // DOM Check
    const headerName = await page.evaluate(() => document.getElementById('player-display').innerText);
    console.log(`Final Header Name in DOM: ${headerName}`);

    console.log('--- TEST COMPLETE ---');
  } catch (err) {
    console.error('✗ TEST ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
