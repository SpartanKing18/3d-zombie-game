import * as THREE from 'three';

export class DayNightCycle {
  constructor(game) {
    this.game = game;
    this.time = 12;
    this.timeSpeed = 0.05;
    this.scene = game.scene.getScene();
    this.sceneManager = game.scene;
    this.directionalLight = game.scene.sunLight || game.scene.directionalLight;
    this.timeDisplay = document.getElementById('time-text');
    // Cached Color instances — avoids per-frame allocation
    this._colDay   = new THREE.Color(0xfffaee);
    this._colDusk  = new THREE.Color(0xffcc88);
    this._colNight = new THREE.Color(0x102030);
    this._colTmp   = new THREE.Color();

    // Moon light for nights
    this._moonLight = new THREE.DirectionalLight(0x334466, 0);
    this._moonLight.position.set(-50, 80, -60);
    this.scene.add(this._moonLight);
  }

  update(deltaTime) {
    const prevHour = this.time;
    this.time += deltaTime * this.timeSpeed;
    if (this.time >= 24) this.time -= 24;
    const currHour = this.time;

    this.updateLighting();
    this.updateSkyShader(deltaTime);
    this.updateTimeDisplay();

    // Horde event: at dusk (hour crosses 20) spawn a zombie wave
    if (prevHour < 20 && currHour >= 20 && !this.game.inFriendHouse) {
      this._triggerNightHorde();
    }
    // Dawn clear: at 6am reduce spawns
    if (prevHour < 6 && currHour >= 6 && !this.game.inFriendHouse) {
      this._triggerDawnSafety();
    }
  }

  // t in [0,1]: 0=midnight, 0.25=6am, 0.5=noon, 0.75=6pm
  get normalizedTime() {
    return this.time / 24;
  }

  updateLighting() {
    const nt = this.normalizedTime;
    const sunAngle = nt * Math.PI * 2 - Math.PI / 2;
    const sunElevation = Math.sin(sunAngle); // -1 midnight, +1 noon

    // Anchor the sun (and its shadow frustum) to the player so cast shadows don't
    // vanish once the player roams past the fixed ±120 box around the world origin.
    const p = this.game.player?.getPosition?.();
    const px = p?.x ?? 0, pz = p?.z ?? 0;

    if (this.directionalLight) {
      const dist = 300;
      this.directionalLight.position.x = px + Math.cos(sunAngle) * dist;
      this.directionalLight.position.y = sunElevation * dist + 30;
      this.directionalLight.position.z = pz + Math.sin(sunAngle * 0.7) * dist * 0.5;
      const tgt = this.directionalLight.target;
      if (tgt) { tgt.position.set(px, 0, pz); tgt.updateMatrixWorld(); }

      // Sun intensity: smooth, no abrupt jump at horizon
      const sunIntensity = Math.max(0, Math.pow(sunElevation, 0.6)) * 2.0 + 0.04;
      this.directionalLight.intensity = sunIntensity;

      // Color: warm golden at sunrise/set, white-blue at noon, deep blue at night
      if (sunElevation > 0.35) {
        this.directionalLight.color.copy(this._colDay);
      } else if (sunElevation > -0.1) {
        const t = (sunElevation + 0.1) / 0.45;
        if (t > 0.5) this._colTmp.copy(this._colDusk).lerp(this._colDay, (t - 0.5) * 2);
        else this._colTmp.copy(this._colNight).lerp(this._colDusk, t * 2);
        this.directionalLight.color.copy(this._colTmp);
      } else {
        this.directionalLight.color.copy(this._colNight);
      }
    }

    // Dim the image-based lighting (scene.environment) and the sky fill at night,
    // so bright-coloured surfaces (trees, houses) actually go dark after dusk
    // instead of staying fully lit by constant ambient.
    const dayF = Math.min(1, Math.max(0, (sunElevation + 0.15) / 0.5));
    if (this.scene) this.scene.environmentIntensity = 0.16 + dayF * 0.84;
    if (this.sceneManager?.fillLight) this.sceneManager.fillLight.intensity = 0.04 + dayF * 0.36;
    if (this.sceneManager?.hemiLight) this.sceneManager.hemiLight.intensity = 0.08 + dayF * 0.42;

    // Moon: opposite direction, cool blue-white, strongest at midnight (also player-anchored)
    if (this._moonLight) {
      this._moonLight.position.x = px - Math.cos(sunAngle) * 300;
      this._moonLight.position.y = Math.max(30, -sunElevation * 280 + 30);
      this._moonLight.position.z = pz - Math.sin(sunAngle * 0.7) * 150;
      this._moonLight.intensity = Math.max(0, -sunElevation) * 0.4;
    }

    // Fog: heavy, dread-inducing haze — moderate by day, thick and near-black at
    // night so visibility is limited and things loom out of the murk.
    if (this.scene.fog) {
      const dayFog   = 0.005;
      const nightFog = 0.0105;
      const fogT = Math.max(0, -sunElevation);  // 0 at day, 1 at midnight
      this.scene.fog.density = dayFog + (nightFog - dayFog) * fogT;
      // Fog color: desaturated grey-teal, going nearly black at night
      if (sunElevation > 0.1) {
        this.scene.fog.color.set(0x545e5a);
      } else if (sunElevation > -0.1) {
        const t = (sunElevation + 0.1) / 0.2;
        this.scene.fog.color.setHex(t > 0.5 ? 0x3a3630 : 0x121a1c);
      } else {
        this.scene.fog.color.set(0x060a0b);
      }
    }

    // Make zombies faster at night — stored as a separate multiplier consumed at
    // movement time, so it never clobbers per-zombie speed abilities (Berserker
    // rage, Stalker sprint, HordeMaster aura, Screamer alert all set this.speed).
    if (this.game.zombieManager) {
      const mult = this.getNightMultiplier();
      this.game.zombieManager.getZombies?.()?.forEach(z => { z._nightMult = mult; });
    }
  }

  updateSkyShader(deltaTime) {
    if (this.sceneManager?.setSkyTime) {
      this.sceneManager.setSkyTime(this.normalizedTime);
    }
    if (this.sceneManager?.updateStars) {
      this.sceneManager.updateStars(deltaTime);
    }
  }

  updateTimeDisplay() {
    const hour = Math.floor(this.time);
    const minute = Math.floor((this.time - hour) * 60);
    if (this.timeDisplay) {
      this.timeDisplay.textContent =
        String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    }
  }

  setTime(hour) {
    this.time = Math.max(0, Math.min(23.99, hour));
  }

  getTime() { return this.time; }
  setTimeSpeed(speed) { this.timeSpeed = speed; }

  getNightMultiplier() {
    const nt = this.normalizedTime;
    if (nt < 0.22 || nt > 0.78) return 1.55;  // full night: 55% faster
    if (nt < 0.32 || nt > 0.68) return 1.25;  // dusk/dawn: 25% faster
    return 1.0;
  }

  _triggerNightHorde() {
    const player = this.game.player;
    if (!player) return;
    const pos = player.getPosition();
    // Spawn a large wave of mixed zombies
    this.game.zombieManager?.spawnWave(12, pos.x + 50, pos.z, 35);
    setTimeout(() => this.game.zombieManager?.spawnWave(8, pos.x - 40, pos.z + 30, 25), 8000);
    // Night warning notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '🌙 NIGHTFALL — Horde incoming!';
      notif.style.color = '#ff4444';
      notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
    }
    // Fog thickens at night
    if (this.scene.fog) this.scene.fog.density = 0.004;
  }

  _triggerDawnSafety() {
    // Dawn: reduce fog, notify player
    this.game._nightsSurvived = (this.game._nightsSurvived ?? 0) + 1;
    if (this.scene.fog) this.scene.fog.density = 0.0008;
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '🌅 DAWN — Zombies retreating…';
      notif.style.color = '#ffaa44';
      notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
    }
  }
}
