import { API_ENDPOINTS } from './constants.js';
import { UIManager } from './ui-manager.js';

export const APIClient = {
  async updateLeaderboard(baseUrl, payload, secret) {
    try {
      const mode = payload.mode || 'classic';
      const ts = Date.now();
      const msg = JSON.stringify({
        playerId: payload.playerId,
        score: payload.score,
        wins: payload.wins,
        losses: payload.losses,
        mode: mode,
        ts: ts,
      });
      const auth = await this.generateHMAC(msg, secret);

      const res = await fetch(`${baseUrl}${API_ENDPOINTS.LEADERBOARD}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ts, auth }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
    } catch (e) {
      console.warn('Leaderboard update failed (offline mode)');
      this.reportError(baseUrl, { context: 'updateLeaderboard', message: e.message });
    }
  },

  async fetchLeaderboard(baseUrl, limit = 20, mode = 'classic') {
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.LEADERBOARD}?limit=${limit}&mode=${mode}`);
      if (res.ok) return await res.json();
      throw new Error(`HTTP_${res.status}`);
    } catch (e) {
      this.reportError(baseUrl, { context: 'fetchLeaderboard', message: e.message });
      throw new Error('SERVER_UNAVAILABLE');
    }
  },

  async verifyChallenge(baseUrl, code) {
    try {
      const res = await fetch(`${baseUrl}${API_ENDPOINTS.CHALLENGE_VERIFY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) throw new Error(data.error || 'INVALID_CODE');
      return data.data;
    } catch (e) {
      this.reportError(baseUrl, { context: 'verifyChallenge', message: e.message });
      UIManager.showModal(
        'Error',
        'Challenge verification failed. Please check your code or connection.',
        'var(--error)'
      );
      throw e;
    }
  },

  async reportError(baseUrl, errorData) {
    try {
      await fetch(`${baseUrl}${API_ENDPOINTS.CLIENT_ERROR}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...errorData,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('Failed to report error to server:', e);
    }
  },
  async generateHMAC(message, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },

  async reportMetric(baseUrl, metricName, value) {
    try {
      await fetch(`${baseUrl}${API_ENDPOINTS.METRICS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricName, value }),
      });
    } catch (e) {
      console.error('Failed to report metric to server:', e);
    }
  },
};
