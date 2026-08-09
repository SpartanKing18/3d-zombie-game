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

  // Dispose rain GPU buffers before dropping the reference (avoids leaking the
  // 2500-segment geometry + material every time the auto-weather cycle rebuilds).
  _disposeRain() {
    if (!this.rainParticles) return;
    this.scene.remove(this.rainParticles);
    this.rainParticles.geometry?.dispose?.();
    this.rainParticles.material?.dispose?.();
    this.rainParticles = null;
  }

  setClear() {
    this._disposeRain();
    // NOTE: never null or replace scene.fog — DayNightCycle owns the persistent
    // FogExp2 and _applyWeatherFog() modulates it. Nulling it here used to delete
    // the atmospheric fog for the rest of the session.
    this._updateWeatherHUD();
  }

  setRain() {
    this._disposeRain();
    this._weatherFogColorHex = 0x8a9aa8;

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

    if (this.weather === 'rain') this._updateWeatherHUD();
  }

  setFog() {
    this._disposeRain();
    this._weatherFogColorHex = 0x9aa4a8;
    this._updateWeatherHUD();
  }

  setStorm() {
    this.setRain();
    this._weatherFogColorHex = 0x3a4652;
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

    // Modulate the persistent day/night fog for weather (runs AFTER DayNightCycle).
    this._applyWeatherFog(deltaTime);
  }

  // Weather adds thickness on top of DayNightCycle's base FogExp2 rather than
  // replacing the fog object. The added density lerps in/out so transitions to
  // and from clear weather never pop, and the fog is never destroyed.
  _applyWeatherFog(deltaTime) {
    const fog = this.scene.fog;
    if (!fog || !fog.isFogExp2) return;
    const want = this.weather === 'storm' ? 0.024
               : this.weather === 'fog'   ? 0.020
               : this.weather === 'rain'  ? 0.009
               : 0.0;
    this._weatherDens = THREE.MathUtils.lerp(this._weatherDens ?? 0, want, Math.min(1, deltaTime * 0.5));
    if (this._weatherDens < 0.0004) return; // effectively clear — day/night owns fog
    fog.density += this._weatherDens;
    // Tint toward the weather colour, fading with the added density.
    if (this._weatherFogColorHex != null) {
      if (!this._tmpFogCol) this._tmpFogCol = new THREE.Color();
      this._tmpFogCol.setHex(this._weatherFogColorHex);
      fog.color.lerp(this._tmpFogCol, Math.min(0.8, this._weatherDens / 0.02 * 0.8));
    }
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

    // Flash the 3D scene by spiking tone-mapping exposure. Boosting the sun does
    // nothing at night (it's parked below the horizon), and hemisphere intensity
    // is rewritten every frame by DayNightCycle — exposure is the one lever that
    // actually brightens the rendered geometry for the flash and isn't clobbered.
    const renderer = this.game.renderer;
    if (renderer && renderer.toneMappingExposure !== undefined) {
      if (this._origExposure === undefined) this._origExposure = renderer.toneMappingExposure;
      const base = this._origExposure;
      renderer.toneMappingExposure = base * 2.4;
      setTimeout(() => { renderer.toneMappingExposure = base * 1.6; }, 55);
      setTimeout(() => { renderer.toneMappingExposure = base; }, 130);
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
