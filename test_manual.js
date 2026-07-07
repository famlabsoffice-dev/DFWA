import fetch from 'node-fetch';

const baseUrl = 'http://localhost:5173';

async function test() {
  console.log('=== TESTING BUTTON FUNCTIONALITY ===\n');
  
  const html = await fetch(baseUrl).then(r => r.text());
  
  const hasStartBtn = html.includes('id="start-btn"');
  const hasCategoryBtn = html.includes('id="category-modal-btn"');
  const hasAddPlayerBtn = html.includes('id="add-player-btn"');
  const hasModalList = html.includes('id="category-modal-list"');
  
  console.log('HTML Elements:');
  console.log('- start-btn:', hasStartBtn);
  console.log('- category-modal-btn:', hasCategoryBtn);
  console.log('- add-player-btn:', hasAddPlayerBtn);
  console.log('- category-modal-list:', hasModalList);
  
  const hasRegisterSW = html.includes('registerSW.js');
  const hasSW = html.includes('sw.js');
  
  console.log('\nPWA Elements:');
  console.log('- registerSW.js script:', hasRegisterSW);
  console.log('- manifest:', html.includes('manifest.webmanifest'));
  
  const appJs = await fetch(`${baseUrl}/app.js`).then(r => r.text()).catch(() => 'NOT_FOUND');
  const hasEventListeners = appJs.includes('addEventListener');
  const hasShowCategoryModal = appJs.includes('showCategoryModal');
  const hasHandleAddPlayer = appJs.includes('handleAddPlayer');
  
  console.log('\nApp.js Functions:');
  console.log('- addEventListener:', hasEventListeners);
  console.log('- showCategoryModal:', hasShowCategoryModal);
  console.log('- handleAddPlayer:', hasHandleAddPlayer);
  
  console.log('\n=== ANALYSIS ===');
  if (hasStartBtn && hasCategoryBtn && hasAddPlayerBtn && hasEventListeners) {
    console.log('✓ All buttons and event listeners present');
  } else {
    console.log('✗ Missing buttons or event listeners');
  }
}

test().catch(console.error);
