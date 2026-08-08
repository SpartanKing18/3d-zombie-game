export class Cutscene {
  constructor(game) {
    this.game = game;
    this.duration = 0;
    this.elapsed = 0;
    this.skipRequested = false;
  }

  async play() {
    throw new Error('play() must be implemented in subclass');
  }

  skip() {
    this.skipRequested = true;
  }

  async wait(ms) {
    return new Promise(resolve => {
      const startTime = Date.now();
      const checkTime = () => {
        if (this.skipRequested || Date.now() - startTime >= ms) {
          resolve();
        } else {
          requestAnimationFrame(checkTime);
        }
      };
      checkTime();
    });
  }

  async fadeToBlack(duration = 500) {
    const overlay = document.getElementById('cutscene-overlay') || this.createOverlay();
    overlay.style.display = 'block';
    overlay.style.opacity = '0';

    const startTime = Date.now();
    return new Promise(resolve => {
      const fade = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        overlay.style.opacity = progress;

        if (progress < 1 && !this.skipRequested) {
          requestAnimationFrame(fade);
        } else {
          resolve();
        }
      };
      fade();
    });
  }

  async fadeFromBlack(duration = 500) {
    const overlay = document.getElementById('cutscene-overlay') || this.createOverlay();
    overlay.style.opacity = '1';

    const startTime = Date.now();
    return new Promise(resolve => {
      const fade = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        overlay.style.opacity = 1 - progress;

        if (progress < 1 && !this.skipRequested) {
          requestAnimationFrame(fade);
        } else {
          overlay.style.display = 'none';
          resolve();
        }
      };
      fade();
    });
  }

  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'cutscene-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = '#000';
    overlay.style.opacity = '0';
    overlay.style.zIndex = '5000';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);
    return overlay;
  }

  showSubtitle(text, duration = 3000) {
    const subtitleEl = document.getElementById('cutscene-subtitle') || this.createSubtitleElement();
    subtitleEl.textContent = text;
    subtitleEl.style.display = 'block';
    subtitleEl.style.opacity = '1';

    if (this.subtitleTimeout) clearTimeout(this.subtitleTimeout);
    this.subtitleTimeout = setTimeout(() => {
      subtitleEl.style.opacity = '0';
      setTimeout(() => {
        subtitleEl.style.display = 'none';
      }, 300);
    }, duration);
  }

  createSubtitleElement() {
    const subtitle = document.createElement('div');
    subtitle.id = 'cutscene-subtitle';
    subtitle.style.position = 'fixed';
    subtitle.style.bottom = '40px';
    subtitle.style.left = '50%';
    subtitle.style.transform = 'translateX(-50%)';
    subtitle.style.color = '#fff';
    subtitle.style.fontSize = '18px';
    subtitle.style.fontFamily = 'Arial, sans-serif';
    subtitle.style.maxWidth = '80%';
    subtitle.style.textAlign = 'center';
    subtitle.style.zIndex = '5001';
    subtitle.style.textShadow = '0 2px 6px rgba(0,0,0,0.9)';
    subtitle.style.fontWeight = 'bold';
    subtitle.style.transition = 'opacity 0.3s';
    subtitle.style.display = 'none';
    document.body.appendChild(subtitle);
    return subtitle;
  }
}
