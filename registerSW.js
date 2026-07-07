if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              showUpdateNotification();
            }
          }
        };
      };
    });
  });
}

function showUpdateNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.95);
    border: 2px solid #39ff14;
    color: #39ff14;
    padding: 20px;
    border-radius: 8px;
    z-index: 99998;
    text-align: center;
    font-family: monospace;
    font-size: 14px;
    max-width: 80vw;
  `;
  
  const title = document.createElement('div');
  title.textContent = 'NEUE VERSION VERFUEGBAR';
  title.style.marginBottom = '15px';
  title.style.fontWeight = 'bold';
  
  const message = document.createElement('div');
  message.textContent = 'Tippe AKTUALISIEREN um die neue Version zu laden.';
  message.style.marginBottom = '20px';
  message.style.fontSize = '12px';
  
  const button = document.createElement('button');
  button.textContent = 'AKTUALISIEREN';
  button.style.cssText = `
    background: #39ff14;
    color: #000;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
  `;
  button.onclick = () => window.location.reload();
  
  notification.appendChild(title);
  notification.appendChild(message);
  notification.appendChild(button);
  document.body.appendChild(notification);
}
