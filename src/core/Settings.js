export class Settings {
  constructor() {
    this.defaults = {
      graphics: {
        quality: 'high',
        fov: 75,
        renderDistance: 1000,
        shadowQuality: 'medium',
        antialiasing: true,
        showFPS: false,
        showCoords: false
      },
      controls: {
        mouseSensitivity: 1,
        invertY: false,
        keyBindings: {
          forward: 'w',
          backward: 's',
          left: 'a',
          right: 'd',
          jump: ' ',
          crouch: 'c',
          sprint: 'shift',
          interact: 'e',
          fire: 'mouse1',
          aimDownSights: 'mouse2'
        }
      },
      audio: {
        masterVolume: 0.8,
        sfxVolume: 0.8,
        musicVolume: 0.6
      },
      gameplay: {
        hudOpacity: 0.8,
        minimapSize: 200,
        crosshairStyle: 'default',
        bloodEffects: true,
        difficulty: 'normal'
      }
    };

    this.settings = this.load();
  }

  load() {
    const saved = localStorage.getItem('zombieShooterSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load settings:', e);
        return JSON.parse(JSON.stringify(this.defaults));
      }
    }
    return JSON.parse(JSON.stringify(this.defaults));
  }

  save() {
    localStorage.setItem('zombieShooterSettings', JSON.stringify(this.settings));
  }

  get(path) {
    const parts = path.split('.');
    let value = this.settings;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  set(path, value) {
    const parts = path.split('.');
    let obj = this.settings;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in obj) || typeof obj[part] !== 'object') {
        obj[part] = {};
      }
      obj = obj[part];
    }

    obj[parts[parts.length - 1]] = value;
    this.save();
  }

  reset() {
    this.settings = JSON.parse(JSON.stringify(this.defaults));
    this.save();
  }

  getAll() {
    return JSON.parse(JSON.stringify(this.settings));
  }

  setAll(settings) {
    this.settings = settings;
    this.save();
  }
}
