import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('error', err => console.error('PAGE ERROR:', err));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  console.log('\n=== INITIAL STATE ===');
  const startBtn = await page.$('#start-btn');
  console.log('Start button exists:', !!startBtn);
  
  const categoryBtn = await page.$('#category-modal-btn');
  console.log('Category button exists:', !!categoryBtn);
  
  const addPlayerBtn = await page.$('#add-player-btn');
  console.log('Add player button exists:', !!addPlayerBtn);
  
  console.log('\n=== TESTING ADD PLAYER ===');
  await page.type('#player-name', 'TestPlayer');
  console.log('Typed player name');
  
  await page.click('#add-player-btn');
  console.log('Clicked add player button');
  
  await page.waitForTimeout(500);
  
  const playerList = await page.$('#player-list-container');
  const playerTags = await playerList.$$('.player-tag');
  console.log('Player tags after add:', playerTags.length);
  
  console.log('\n=== TESTING CATEGORY SELECTION ===');
  await page.click('#category-modal-btn');
  console.log('Clicked category button');
  
  await page.waitForTimeout(500);
  
  const modal = await page.$('#modal-overlay');
  const modalDisplay = await page.evaluate(() => document.getElementById('modal-overlay').style.display);
  console.log('Modal display:', modalDisplay);
  
  const categoryList = await page.$('#category-modal-list');
  const categoryBtns = await categoryList.$$('button');
  console.log('Category buttons found:', categoryBtns.length);
  
  if (categoryBtns.length > 0) {
    await page.click('#category-modal-list button:first-child');
    console.log('Clicked first category');
    
    await page.waitForTimeout(500);
    
    const selectedCat = await page.$eval('#current-category-display', el => el.innerText);
    console.log('Selected category:', selectedCat);
  }
  
  console.log('\n=== TESTING START BUTTON STATE ===');
  const startBtnDisabled = await page.$eval('#start-btn', btn => btn.disabled);
  console.log('Start button disabled:', startBtnDisabled);
  
  const startBtnOpacity = await page.$eval('#start-btn', btn => btn.style.opacity);
  console.log('Start button opacity:', startBtnOpacity);
  
  console.log('\n=== SERVICE WORKER CHECK ===');
  const swRegistrations = await page.evaluate(() => {
    return navigator.serviceWorker.getRegistrations().then(regs => regs.map(r => ({ scope: r.scope, active: !!r.active })));
  });
  console.log('SW Registrations:', swRegistrations);
  
  await browser.close();
})();
