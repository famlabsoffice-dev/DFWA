export const AudioManager = {
  isMuted: localStorage.getItem('dfwa_muted') === 'true',
  sounds: {},
  bgMusic: null,
  musicSpeed: 1,

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

    // Background Music (Platzhalter)
    this.bgMusic = new Audio('https://actions.google.com/sounds/v1/science_fiction/glitchy_digital_pulse.ogg');
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.3;
  },

  startMusic() {
    if (this.isMuted || !this.bgMusic) return;
    this.bgMusic.playbackRate = 1;
    this.bgMusic.play().catch(() => {});
  },

  stopMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
  },

  updateMusicSpeed(timer, initialTimer) {
    if (this.isMuted || !this.bgMusic) return;
    
    // Adaptive Geschwindigkeit: Schneller bei < 5s
    if (timer < 5) {
      const speed = 1 + (5 - timer) * 0.1; // Max 1.5x Speed
      this.bgMusic.playbackRate = Math.min(speed, 1.5);
    } else {
      this.bgMusic.playbackRate = 1;
    }
  },

  play(soundKey) {
    if (this.isMuted || !this.sounds[soundKey]) return;
    const sound = this.sounds[soundKey];
    sound.currentTime = 0;
    sound.play().catch(() => {});
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('dfwa_muted', this.isMuted);
    return this.isMuted;
  },
};
