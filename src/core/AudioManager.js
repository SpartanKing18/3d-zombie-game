export class AudioManager {
  constructor(game) {
    this.game = game;
    this.audioContext = null;
    this.masterVolume = 0.8;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.6;
    this.sounds = new Map();
    this.musicTracks = new Map();
    this.initialized = false;

    this.initializeAudio();
  }

  initializeAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      console.warn('Web Audio API not supported');
      return;
    }

    try {
      this.audioContext = new AudioContext();
      this.initialized = true;
      this.setupMasterGain();
    } catch (e) {
      console.error('Failed to initialize audio:', e);
    }
  }

  setupMasterGain() {
    if (!this.audioContext) return;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.audioContext.destination);

    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.audioContext.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);
  }

  createSoundEffect(type) {
    if (!this.audioContext || !this.masterGain) return null;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const env = this.audioContext.createGain();

    osc.connect(env);
    env.connect(this.sfxGain);

    switch (type) {
      case 'gunshot':
        osc.frequency.value = 100;
        env.gain.setValueAtTime(0.3, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;

      case 'impact':
        osc.frequency.value = 80;
        env.gain.setValueAtTime(0.2, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;

      case 'footstep':
        osc.frequency.value = 150;
        env.gain.setValueAtTime(0.1, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;

      case 'zombiegroan':
        osc.frequency.value = 60;
        env.gain.setValueAtTime(0.15, now);
        env.gain.exponentialRampToValueAtTime(0.02, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;

      case 'pickup':
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
        env.gain.setValueAtTime(0.15, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;

      case 'reload':
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.08);
        env.gain.setValueAtTime(0.12, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'heartbeat': {
        // Two-thump heartbeat: lub-dub
        const osc2 = this.audioContext.createOscillator();
        const env2 = this.audioContext.createGain();
        osc2.connect(env2);
        env2.connect(this.sfxGain);
        osc.type = 'sine'; osc2.type = 'sine';
        osc.frequency.value = 55; osc2.frequency.value = 50;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.35, now + 0.04);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        env2.gain.setValueAtTime(0, now + 0.25);
        env2.gain.linearRampToValueAtTime(0.2, now + 0.30);
        env2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now); osc.stop(now + 0.22);
        osc2.start(now + 0.25); osc2.stop(now + 0.45);
        break;
      }

      case 'zombiehit':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.18);
        env.gain.setValueAtTime(0.22, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        break;

      case 'scream': {
        // High-pitched rising wail with vibrato
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        lfo.frequency.value = 8;
        lfoGain.gain.value = 40;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(900, now + 0.4);
        osc.frequency.linearRampToValueAtTime(600, now + 0.8);
        env.gain.setValueAtTime(0.3, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
        lfo.start(now); lfo.stop(now + 0.9);
        osc.start(now); osc.stop(now + 0.9);
        break;
      }

      case 'eat':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.08);
        env.gain.setValueAtTime(0.08, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'whistle':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(1600, now + 0.1);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.25);
        osc.frequency.linearRampToValueAtTime(1800, now + 0.35);
        env.gain.setValueAtTime(0.2, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;

      case 'item_use':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        env.gain.setValueAtTime(0.1, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;

      case 'explosion':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
        env.gain.setValueAtTime(0.5, now);
        env.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        osc.start(now);
        osc.stop(now + 0.7);
        break;

      default:
        // Unknown type — clean up without playing
        osc.disconnect();
        env.disconnect();
        return;
    }
  }

  playGunshot() { this.createSoundEffect('gunshot'); }
  playReload()   { this.createSoundEffect('reload');  }
  playFootstep() { this.createSoundEffect('footstep'); }
  playZombieGroan() { this.createSoundEffect('zombiegroan'); }
  playZombieHit()   { this.createSoundEffect('zombiehit');   }
  playImpact()   { this.createSoundEffect('impact');  }
  playPickup()   { this.createSoundEffect('pickup');  }
  playHeartbeat() { this.createSoundEffect('heartbeat'); }
  playScream()   { this.createSoundEffect('scream');  }
  playEat()       { this.createSoundEffect('eat');       }
  playWhistle()   { this.createSoundEffect('whistle');  }
  playItemUse()   { this.createSoundEffect('item_use'); }
  playExplosion() { this.createSoundEffect('explosion');}

  setSFXVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  getSFXVolume() {
    return this.sfxVolume;
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  isInitialized() {
    return this.initialized;
  }

  playMusic(src) {
    if (this._musicEl) {
      this._musicEl.pause();
      this._musicEl.src = '';
    }
    const audio = document.createElement('audio');
    audio.src = src;
    audio.loop = true;
    audio.volume = Math.min(1, this.musicVolume * this.masterVolume);
    // If the track is absent (no music shipped), quietly drop the element
    audio.addEventListener('error', () => {
      if (this._musicEl === audio) this._musicEl = null;
    }, { once: true });
    this._musicEl = audio;

    const tryPlay = () => {
      this.resume();
      audio.play().catch(() => {});
    };
    tryPlay();
    // Browsers block autoplay until a user gesture — retry on first click
    document.addEventListener('click', tryPlay, { once: true });
  }

  stopMusic() {
    if (this._musicEl) {
      this._musicEl.pause();
      this._musicEl.src = '';
      this._musicEl = null;
    }
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    if (this._musicEl) this._musicEl.volume = Math.min(1, this.musicVolume * this.masterVolume);
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    if (this._musicEl) this._musicEl.volume = Math.min(1, this.musicVolume * this.masterVolume);
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
