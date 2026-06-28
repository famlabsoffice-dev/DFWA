import { API_ENDPOINTS } from './constants.js';

export const APIClient = {
    // fetchSecret entfernt, da SYSTEM_SECRET nicht mehr clientseitig verfügbar ist.

    async updateLeaderboard(baseUrl, payload) {
        try {
            await fetch(`${baseUrl}${API_ENDPOINTS.LEADERBOARD}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn('Leaderboard update failed (offline mode)');
        }
    },

    async fetchLeaderboard(baseUrl, limit = 20) {
        try {
            const res = await fetch(`${baseUrl}${API_ENDPOINTS.LEADERBOARD}?limit=${limit}`);
            if (res.ok) return await res.json();
        } catch (e) {}
        throw new Error('SERVER_UNAVAILABLE');
    },

    async verifyChallenge(baseUrl, code) {
        const res = await fetch(`${baseUrl}${API_ENDPOINTS.CHALLENGE_VERIFY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok || !data.valid) throw new Error(data.error || 'INVALID_CODE');
        return data.data;
    },

    async reportError(baseUrl, errorData) {
        try {
            await fetch(`${baseUrl}${API_ENDPOINTS.CLIENT_ERROR}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...errorData,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (e) {}
    }
};
