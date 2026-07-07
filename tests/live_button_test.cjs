const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    console.log('--- START LIVE BUTTON TEST ---');
    await page.goto('http://localhost:4173', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('✓ Page loaded');

    // 1. Test Add Player
    await page.type('#player-name', 'TEST_USER');
    await page.click('#add-player-btn');
    await new Promise(r => setTimeout(r, 500));
    const playerExists = await page.evaluate(() => {
      const tags = document.querySelectorAll('.player-tag span');
      return Array.from(tags).some(t => t.textContent === 'TEST_USER');
    });
    console.log(playerExists ? '✓ Add Player: SUCCESS' : '✗ Add Player: FAILED');

    // 2. Test Category Modal
    await page.click('#category-modal-btn');
    await new Promise(r => setTimeout(r, 500));
    const modalVisible = await page.evaluate(() => {
      return document.getElementById('modal-overlay').style.display === 'flex';
    });
    console.log(modalVisible ? '✓ Category Modal: SUCCESS' : '✗ Category Modal: FAILED');

    // 3. Select Category
    await page.evaluate(() => {
      const catBtn = document.querySelector('#category-modal-list .mode-btn');
      if (catBtn) catBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    const categorySelected = await page.evaluate(() => {
      const display = document.getElementById('current-category-display').innerText;
      return display !== 'CLASSIC' && display !== '';
    });
    console.log(categorySelected ? '✓ Category Selection: SUCCESS' : '✗ Category Selection: FAILED');

    // 4. Test Start Button
    const startBtnDisabled = await page.evaluate(() => document.getElementById('start-btn').disabled);
    console.log(!startBtnDisabled ? '✓ Start Button Enabled: SUCCESS' : '✗ Start Button Enabled: FAILED');

    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1000));
    const gameScreenActive = await page.evaluate(() => {
      return document.getElementById('game-screen').classList.contains('active');
    });
    console.log(gameScreenActive ? '✓ Game Start: SUCCESS' : '✗ Game Start: FAILED');

    console.log('--- TEST COMPLETE ---');
  } catch (err) {
    console.error('✗ TEST ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
