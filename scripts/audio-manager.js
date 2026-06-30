export const AudioManager = {
  isMuted: localStorage.getItem('dfwa_muted') === 'true',
  sounds: {},

  init() {
    // Platzhalter für Sound-URLs (werden später durch reale Assets ersetzt)
    const soundFiles = {
      click: 'https://actions.google.com/sounds/v1/foley/button_click.ogg',
      correct: 'https://actions.google.com/sounds/v1/foley/electronic_chime.ogg',
      error: 'https://actions.google.com/sounds/v1/foley/drip_echo.ogg',
      achievement: 'https://actions.google.com/sounds/v1/foley/wind_chime.ogg',
    };

    for (const [key, url] of Object.entries(soundFiles)) {
      this.sounds[key] = new Audio(url);
      this.sounds[key].preload = 'auto';
    }
  },

  play(soundKey) {
    if (this.isMuted || !this.sounds[soundKey]) return;
    const sound = this.sounds[soundKey].cloneNode();
    sound.play().catch(() => {}); // Browser Autoplay Policy Schutz
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('dfwa_muted', this.isMuted);
    return this.isMuted;
  },
};
