export const MobileDebug = {
  logs: [],
  maxLogs: 10,
  
  init() {
    this.createDebugPanel();
    this.logEvent('SYSTEM_INIT', 'Mobile Debug Ready');
    window.addEventListener('error', (e) => this.logEvent('ERROR', e.message));
    window.addEventListener('touchstart', (e) => {
      const target = e.target;
      if (target.tagName === 'BUTTON' || target.id) {
        this.logEvent('TOUCH', `${target.id || target.className}`);
      }
    });
  },
  
  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'mobile-debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 150px;
      background: rgba(0,0,0,0.9);
      color: #39ff14;
      font-family: monospace;
      font-size: 10px;
      overflow-y: auto;
      z-index: 99999;
      padding: 8px;
      border-top: 2px solid #39ff14;
      line-height: 1.2;
    `;
    document.body.appendChild(panel);
    this.panel = panel;
  },
  
  logEvent(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${type}: ${message}`;
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    this.updatePanel();
  },
  
  updatePanel() {
    if (this.panel) {
      this.panel.innerHTML = this.logs.map(log => 
        `<div>${log}</div>`
      ).join('');
      this.panel.scrollTop = this.panel.scrollHeight;
    }
  },
  
  clear() {
    this.logs = [];
    this.updatePanel();
  }
};
