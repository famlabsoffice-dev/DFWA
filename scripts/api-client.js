export const APIClient = {
    async fetchSecret(baseUrl) {
        try {
            const res = await fetch(`${baseUrl}/config/secret`);
            if (res.ok) {
                const data = await res.json();
                return data.secret;
            }
        } catch (e) {}
        return 'LOCAL_ONLY_UNTRUSTED';
    },

    async updateLeaderboard(baseUrl, payload) {
        try {
            await fetch(`${baseUrl}/api/leaderboard`, {
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
            const res = await fetch(`${baseUrl}/api/leaderboard?limit=${limit}`);
            if (res.ok) return await res.json();
        } catch (e) {}
        throw new Error('SERVER_UNAVAILABLE');
    }
};
