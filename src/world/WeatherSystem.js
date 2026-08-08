import * as THREE from 'three';

export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene.getScene();
    this.weather = 'clear';
    this.rainParticles = null;
    this.fogDensity = 0;
    this._weatherTimer = 90 + Math.random() * 150; // 90-240 seconds between changes
    this._autoWeatherEnabled = true;
  }

  setWeather(type) {
    if (this.weather === type) return;

    this.weather = type;

    // Sync CSS body class for shader-less overlay effects
    document.body.classList.remove('weather-rain', 'weather-storm', 'weather-fog');
    if (type === 'rain')  document.body.classList.add('weather-rain');
    if (type === 'storm') document.body.classList.add('weather-storm');
    if (type === 'fog')   document.body.classList.add('weather-fog');

    switch (type) {
      case 'clear':
        this.setClear();
        break;
      case 'rain':
        this.setRain();
        break;
      case 'fog':
        this.setFog();
        break;
      case 'storm':
        this.setStorm();
        break;
    }
  }

  setClear() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles = null;
    }
    this.scene.fog = null;
    this._updateWeatherHUD();
  }

  setRain() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
    }

    // Line-segment rain streaks — far more realistic than round points
    const dropCount = 2500;
    const positions = new Float32Array(dropCount * 6); // 2 verts per streak

    for (let i = 0; i < dropCount; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = Math.random() * 100;
      const z = (Math.random() - 0.5) * 200;
      // Top of streak
      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      // Bottom of streak (slightly below + wind offset)
      positions[i * 6 + 3] = x + 0.12;
      positions[i * 6 + 4] = y - 0.65;
      positions[i * 6 + 5] = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xaad4ee,
      opacity: 0.55,
      transparent: true,
    });

    this.rainParticles = new THREE.LineSegments(geometry, material);
    this.rainParticles.position.y = 50;

    if (this.game.player) {
      const pos = this.game.player.getPosition();
      this.rainParticles.position.x = pos.x;
      this.rainParticles.position.z = pos.z;
    }

    this.scene.add(this.rainParticles);

    this.scene.fog = new THREE.Fog(0x889aaa, 80, 420);
    if (this.weather === 'rain') this._updateWeatherHUD();
  }

  setFog() {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles = null;
    }
    this.scene.fog = new THREE.Fog(0xcccccc, 50, 150);
    this._updateWeatherHUD();
  }

  setStorm() {
    this.setRain();
    this.scene.fog = new THREE.Fog(0x445566, 15, 150);
    this._updateWeatherHUD();
  }

  update(deltaTime) {
    if (this._autoWeatherEnabled) {
      this._weatherTimer -= deltaTime;
      if (this._weatherTimer <= 0) {
        // Weighted random: mostly clear, sometimes rain/fog, rarely storm
        const r = Math.random();
        let next;
        if (r < 0.50)      next = 'clear';
        else if (r < 0.75) next = 'rain';
        else if (r < 0.90) next = 'fog';
        else               next = 'storm';
        this.setWeather(next);
        this._weatherTimer = 90 + Math.random() * 150;
      }
    }

    // Weather gameplay effects
    const player = this.game.player;
    if (player && (this.weather === 'rain' || this.weather === 'storm')) {
      // Rain slowly quenches thirst
      if (player.thirst !== undefined) {
        player.thirst = Math.min(player.maxThirst ?? 100, player.thirst + 0.5 * deltaTime);
      }
    }
    if (player && this.weather === 'storm') {
      // Storm slowly drains stamina
      if (player.stamina !== undefined) {
        player.stamina = Math.max(0, player.stamina - 2 * deltaTime);
      }
    }

    if (this.rainParticles) {
      const positions = this.rainParticles.geometry.attributes.position.array;
      const speed   = this.weather === 'storm' ? 38 : 22;
      const windX   = this.weather === 'storm' ? 4.0 : 1.5;

      for (let i = 0; i < positions.length; i += 6) {
        // Move both endpoints of each streak together
        positions[i + 1] -= deltaTime * speed;
        positions[i + 4] -= deltaTime * speed;
        positions[i + 0] += deltaTime * windX;
        positions[i + 3] += deltaTime * windX;

        if (positions[i + 1] < -10) {
          const x = (Math.random() - 0.5) * 200;
          const z = (Math.random() - 0.5) * 200;
          positions[i + 0] = x;
          positions[i + 1] = 100;
          positions[i + 2] = z;
          positions[i + 3] = x + 0.12;
          positions[i + 4] = 99.35;
          positions[i + 5] = z;
        }
      }

      this.rainParticles.geometry.attributes.position.needsUpdate = true;

      if (this.game.player) {
        const pos = this.game.player.getPosition();
        this.rainParticles.position.x = pos.x;
        this.rainParticles.position.z = pos.z;
      }
    }

    // Storm lightning flashes
    if (this.weather === 'storm') {
      this._lightningTimer = (this._lightningTimer ?? 0) - deltaTime;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = 4 + Math.random() * 8;
        this._triggerLightning();
      }
    }

    // Rain fog overlay and ambient light tinting
    const rainIntensity = (this.weather === 'storm') ? 1.0
                        : (this.weather === 'rain')  ? 0.7
                        : 0.0;
    this._updateRainFog(rainIntensity);
    this._updateAmbientForRain(rainIntensity);

    // Lerp storm shader strength
    const targetStorm = this.weather === 'storm' ? 1.0 : 0.0;
    this._stormShaderVal = THREE.MathUtils.lerp(this._stormShaderVal ?? 0, targetStorm, deltaTime * 0.5);
    this.game.scene?.setStormStrength?.(this._stormShaderVal);
  }

  _updateRainFog(intensity) {
    if (!this._fogEl) {
      const el = document.createElement('div');
      el.id = 'weather-fog';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;transition:all 2s;';
      document.body.appendChild(el);
      this._fogEl = el;
    }
    if (intensity > 0.5) {
      this._fogEl.style.background = `rgba(120,140,160,${(intensity-0.5)*0.18})`;
      this._fogEl.style.backdropFilter = `blur(${(intensity-0.5)*2}px)`;
    } else {
      this._fogEl.style.background = 'transparent';
      this._fogEl.style.backdropFilter = 'none';
    }
  }

  _updateAmbientForRain(intensity) {
    // Cache the hemisphere/ambient light reference on first call — avoids O(n) traverse every frame
    if (!this._ambientLight) {
      if (!this.game.scene?.scene) return;
      this.game.scene.scene.traverse(o => {
        if ((o.isHemisphereLight || o.isAmbientLight) && !this._ambientLight) this._ambientLight = o;
      });
      if (!this._ambientLight) return;
    }
    const obj = this._ambientLight;
    if (intensity > 0) {
      const r = THREE.MathUtils.lerp(1.0, 0x70 / 255, intensity * 0.5);
      const g = THREE.MathUtils.lerp(0xf5 / 255, 0x80 / 255, intensity * 0.5);
      const b = THREE.MathUtils.lerp(0xe8 / 255, 0x99 / 255, intensity * 0.3);
      obj.color.setRGB(r, g, b);
    } else {
      obj.color.set(0xfff5e8);
    }
  }

  _triggerLightning() {
    // Screen flash
    if (!this._lightningEl) {
      const el = document.createElement('div');
      el.id = 'lightning-flash';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;background:rgba(200,220,255,0);transition:background 0.04s;';
      document.body.appendChild(el);
      this._lightningEl = el;
    }
    const el = this._lightningEl;
    // Two-flash pattern: bright then dim
    el.style.background = 'rgba(200,220,255,0.55)';
    setTimeout(() => { el.style.background = 'rgba(200,220,255,0)'; }, 50);
    setTimeout(() => {
      el.style.background = 'rgba(200,220,255,0.35)';
      setTimeout(() => { el.style.background = 'rgba(200,220,255,0)'; }, 40);
    }, 120);

    // Boost sunlight briefly to simulate lightning
    const sun = this.game.scene?.sunLight;
    if (sun) {
      const origInt = sun.intensity;
      sun.intensity = 8.0;
      setTimeout(() => { sun.intensity = origInt; }, 60);
    }

    // Play thunder sound after brief delay (sound travels slower than light)
    const delay = 400 + Math.random() * 1200;
    setTimeout(() => { this.game.audioManager?.playThunder?.(); }, delay);
  }

  _updateWeatherHUD() {
    if (!this._weatherDisplayEl) this._weatherDisplayEl = document.getElementById('weather-display');
    const el = this._weatherDisplayEl;
    if (!el) return;
    const icons = { clear: '☀️ Clear', rain: '🌧 Rain', fog: '🌫 Fog', storm: '⛈ Storm' };
    el.textContent = icons[this.weather] ?? '';
  }

  getWeather() {
    return this.weather;
  }
}
