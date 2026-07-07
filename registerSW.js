if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      console.log('SYSTEM: SERVICE_WORKER_REGISTERED');
      
      // Automatische Prüfung auf Updates beim Start
      reg.update();

      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        if (!installingWorker) return;
        
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('SYSTEM: NEW_UPDATE_FOUND');
              showUpdateNotification();
            }
          }
        };
      };
    });
  });

  // Periodische Prüfung alle 60 Minuten
  setInterval(() => {
    navigator.serviceWorker.ready.then(reg => reg.update());
  }, 60 * 60 * 1000);
}

function showUpdateNotification() {
  // Verhindere mehrfache Notifications
  if (document.getElementById('pwa-update-banner')) return;

  const notification = document.createElement('div');
  notification.id = 'pwa-update-banner';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: rgba(0, 20, 0, 0.95);
    border: 2px solid #39ff14;
    color: #39ff14;
    padding: 20px;
    border-radius: 8px;
    z-index: 10000;
    text-align: center;
    font-family: monospace;
    box-shadow: 0 0 20px rgba(57, 255, 20, 0.4);
  `;
  
  const title = document.createElement('div');
  title.textContent = 'SYSTEM_UPDATE_READY';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '10px';
  
  const message = document.createElement('div');
  message.textContent = 'Neue Protokolle verfügbar. System-Reload erforderlich.';
  message.style.fontSize = '12px';
  message.style.marginBottom = '15px';
  
  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '10px';
  btnContainer.style.justifyContent = 'center';

  const updateBtn = document.createElement('button');
  updateBtn.textContent = 'RELOAD';
  updateBtn.style.cssText = `
    background: #39ff14;
    color: #000;
    border: none;
    padding: 8px 16px;
    font-weight: bold;
    cursor: pointer;
    font-family: monospace;
  `;
  updateBtn.onclick = () => {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });
  };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'LATER';
  closeBtn.style.cssText = `
    background: transparent;
    color: #39ff14;
    border: 1px solid #39ff14;
    padding: 8px 16px;
    cursor: pointer;
    font-family: monospace;
  `;
  closeBtn.onclick = () => notification.remove();

  btnContainer.appendChild(updateBtn);
  btnContainer.appendChild(closeBtn);
  notification.appendChild(title);
  notification.appendChild(message);
  notification.appendChild(btnContainer);
  document.body.appendChild(notification);
}
