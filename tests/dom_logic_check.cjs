/**
 * Dieser Test validiert die DOM-Logik und Event-Listener-Registrierung
 * ohne einen laufenden Browser-Server, indem er die app.js Logik simuliert.
 */

const fs = require('fs');
const path = require('path');

console.log('--- DOM LOGIC & EVENT LISTENER CHECK ---');

const appJsPath = path.join(__dirname, '../app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// 1. Prüfe auf kritische DOM-IDs
const requiredIds = [
  'start-btn',
  'add-player-btn',
  'player-name',
  'category-modal-btn',
  'timer-bar',
  'question-text'
];

console.log('Checking for required DOM IDs in app.js logic:');
requiredIds.forEach(id => {
  const exists = appJsContent.includes(`document.getElementById('${id}')`) || 
                 appJsContent.includes(`getElementById("${id}")`);
  console.log(`${exists ? '✓' : '✗'} ID: ${id}`);
});

// 2. Prüfe auf Event-Listener Registrierung
const listeners = [
  { name: 'Start Button Listener', pattern: /startBtn\.addEventListener\(['"](pointerdown|click)['"]/ },
  { name: 'Add Player Listener', pattern: /addPlayerBtn\.addEventListener\(['"](pointerdown|click)['"]/ },
  { name: 'Category Modal Listener', pattern: /categoryModalBtn\.addEventListener\(['"](pointerdown|click)['"]/ }
];

console.log('\nChecking for Event Listener registrations:');
listeners.forEach(l => {
  const exists = l.pattern.test(appJsContent);
  console.log(`${exists ? '✓' : '✗'} ${l.name}`);
});

// 3. Prüfe auf PWA Update Logik in registerSW.js
const regSwPath = path.join(__dirname, '../registerSW.js');
const regSwContent = fs.readFileSync(regSwPath, 'utf8');

console.log('\nChecking PWA Update Logic in registerSW.js:');
const updateLogic = [
  { name: 'reg.update() call', pattern: /reg\.update\(\)/ },
  { name: 'Update Banner ID', pattern: /pwa-update-banner/ },
  { name: 'Interval Check', pattern: /setInterval/ }
];

updateLogic.forEach(l => {
  const exists = l.pattern.test(regSwContent);
  console.log(`${exists ? '✓' : '✗'} ${l.name}`);
});

console.log('\n--- CHECK COMPLETE ---');
