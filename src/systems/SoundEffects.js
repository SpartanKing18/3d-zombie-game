export class SoundEffects {
  constructor() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = Ctx ? new Ctx() : null;
    } catch (e) {
      this.audioContext = null;
    }
    if (this.audioContext) {
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.3;
    }
  }

  _ctx() { return this.audioContext; }
  _gain() { return this.masterGain; }

  playWindowBreak() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    // High pitched crash sound
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const env = this.audioContext.createGain();

    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.3);

    env.gain.setValueAtTime(0.5, now);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc1.connect(env);
    osc2.connect(env);
    env.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  playFootstep() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const env = this.audioContext.createGain();

    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.1);

    env.gain.setValueAtTime(0.3, now);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playAmbientHum() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const env = this.audioContext.createGain();

    osc.frequency.setValueAtTime(50, now);
    env.gain.setValueAtTime(0.1, now);
    env.gain.linearRampToValueAtTime(0.2, now + 2);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 3);
  }

  playZombieGroan() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const env = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);

    env.gain.setValueAtTime(0.2, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.5);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playDoorOpen() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const env = this.audioContext.createGain();

    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(250, now + 0.3);

    env.gain.setValueAtTime(0.2, now);
    env.gain.linearRampToValueAtTime(0.01, now + 0.3);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  setMasterVolume(value) {
    this.masterGain.gain.value = Math.max(0, Math.min(1, value));
  }
}
