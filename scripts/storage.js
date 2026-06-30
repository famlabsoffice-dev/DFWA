import { UIManager } from './ui-manager.js';

export const StorageManager = {
  async getSignature(data, secret) {
    if (!secret) {
      throw new Error('SYSTEM_SECRET not provided for StorageManager');
    }
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
      return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      console.error('Signature generation failed:', e);
      throw new Error('CRYPTO_ERROR');
    }
  },

  async saveSecure(key, value, secret) {
    try {
      localStorage.setItem(key, value);
      const sig = await this.getSignature(value.toString(), secret);
      localStorage.setItem(`${key}_sig`, sig);
    } catch (e) {
      console.error(`Failed to save secure data for ${key}:`, e);
      UIManager.showModal(
        'Storage Error',
        'Could not save game data securely. Your progress might be lost.',
        'var(--error)'
      );
    }
  },

  async validateIntegrity(keys, secret, onFail) {
    for (const key of keys) {
      try {
        const val = localStorage.getItem(key);
        const sig = localStorage.getItem(`${key}_sig`);
        if (val && sig) {
          const expected = await this.getSignature(val.toString(), secret);
          if (sig !== expected) {
            console.warn(`INTEGRITY_FAILURE: ${key} tampered. Resetting.`);
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}_sig`);
            onFail(key);
            UIManager.showModal(
              'Security Alert',
              `Data integrity check failed for ${key}. Local data has been reset.`,
              'var(--warning)'
            );
          }
        }
      } catch (e) {
        console.error(`Integrity check failed for ${key}:`, e);
      }
    }
  },
};
