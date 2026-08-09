import * as THREE from 'three';

export class WeaponBase {
  constructor(name, config = {}) {
    this.name = name;
    this.fireMode = config.fireMode || 'semi'; // semi, full, bolt
    this.fireRate = config.fireRate || 0.5;
    this.damage = config.damage || 10;
    this.spread = config.spread || 0.01;
    this.recoil = config.recoil || 0.1;
    this.magSize = config.magSize || 30;
    this.ammoInMag = this.magSize;
    this.reserveAmmo = config.reserveAmmo || 300;
    this.reloadTime = config.reloadTime || 2;
    this.range = config.range || 1000;
    this.pellets = config.pellets || 1;

    this.isReloading = false;
    this.reloadProgress = 0;
    this.canFire = true;
    this.fireCooldown = 0;
    this.durability = 100;

    // Cached bullet-hole geometry + material — created once per weapon instance
    this._holeGeo = new THREE.CircleGeometry(0.05, 10); // flat decal, not a floating ball
    this._holeMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    // Reuse raycaster across all shots — avoids per-shot allocation
    this._raycaster = new THREE.Raycaster();
    this._raycaster.near = 0;
    this._raycaster.far  = this.range;
  }

  update(deltaTime) {
    if (this.fireCooldown > 0) {
      this.fireCooldown -= deltaTime;
      this.canFire = this.fireCooldown <= 0;
    }

    if (this.isReloading) {
      this.reloadProgress += deltaTime / this.reloadTime;
      if (this.reloadProgress >= 1) {
        this.completeReload();
      }
    }
  }

  fire(position, direction, game) {
    if (!this.canFire || this.isReloading) return false;
    // Skip ammo check for melee weapons (magSize <= 0 means infinite/melee)
    if (this.magSize > 0 && this.ammoInMag <= 0) return false;
    // A broken weapon fires nothing — must be checked BEFORE the raycast/damage loop
    // (otherwise a 0-durability weapon still deals full damage every click).
    if (this.durability <= 0) {
      if (!this._notifEl) this._notifEl = document.getElementById('loot-notification');
      if (this._notifEl) { this._notifEl.textContent = `⚠ ${this.name || 'Weapon'} is broken! Needs mat_duct_tape to repair.`; this._notifEl.style.color='#ff8833'; this._notifEl.classList.remove('show'); void this._notifEl.offsetWidth; this._notifEl.classList.add('show'); }
      return false;
    }

    // Reuse a single ray direction vector per fire() call.
    // Aiming down sights tightens the spread for more precise fire.
    if (!this._rayDir) this._rayDir = new THREE.Vector3();
    if (game) game._fireHitZombie = false; // set true by raycast if this shot connects
    const spread = this.spread * (game?._adsActive ? 0.35 : 1);
    for (let i = 0; i < this.pellets; i++) {
      this._rayDir.copy(direction);
      this._rayDir.x += (Math.random() - 0.5) * spread;
      this._rayDir.y += (Math.random() - 0.5) * spread;
      this._rayDir.z += (Math.random() - 0.5) * spread;
      this._rayDir.normalize();
      this.raycast(position, this._rayDir, game);
    }

    if (this.magSize > 0) this.ammoInMag--;
    this.canFire = false;
    this.fireCooldown = this.fireRate;

    // Weapon durability — cache notification element per-weapon
    if (!this._notifEl) this._notifEl = document.getElementById('loot-notification');
    this.durability = Math.max(0, this.durability - 0.8);
    if (this.durability <= 0) {
      if (this._notifEl) { this._notifEl.textContent = `⚠ ${this.name || 'Weapon'} is broken! Needs mat_duct_tape to repair.`; this._notifEl.style.color='#ff8833'; this._notifEl.classList.remove('show'); void this._notifEl.offsetWidth; this._notifEl.classList.add('show'); }
      return false;
    }
    // Show low-durability warning at integer multiples of 5 (using floor diff to avoid float jitter)
    const prevFloor5 = Math.ceil((this.durability + 0.8) / 5);
    const currFloor5 = Math.ceil(this.durability / 5);
    if (this.durability < 20 && currFloor5 < prevFloor5) {
      if (this._notifEl) { this._notifEl.textContent = `⚠ ${this.name || 'Weapon'} durability: ${Math.floor(this.durability)}%`; this._notifEl.style.color='#ffcc44'; this._notifEl.classList.remove('show'); void this._notifEl.offsetWidth; this._notifEl.classList.add('show'); }
    }

    game?.audioManager?.resume?.();
    game?.audioManager?.playGunshot?.();

    // Camera recoil: kick pitch up, recover smoothly in Player.update()
    if (game?.player) {
      const kick = this.recoil * 0.07;
      game.player.pitch = Math.max(-game.player.maxPitch, game.player.pitch - kick);
      game.player._recoilRecovery = (game.player._recoilRecovery || 0) + kick * 0.75;
    }

    // First-person viewmodel recoil + muzzle flash
    game?.weaponViewModel?.triggerRecoil?.(this.recoil);

    return true;
  }

  raycast(position, direction, game) {
    const raycaster = this._raycaster;
    raycaster.set(position, direction);
    raycaster.far = this.range;
    const terrainScene = game.scene.getScene();

    // Rebuild targets cache every 2 seconds rather than every shot
    // (ZombieManager.spawn invalidates it so fresh zombies are hittable immediately)
    const now = performance.now();
    if (!game._raycastTargets || now - (game._raycastTargetTime ?? 0) > 2000) {
      const targets = [];
      terrainScene.traverseVisible(obj => { if (obj.geometry && !obj.userData.noHit) targets.push(obj); });
      game._raycastTargets = targets;
      game._raycastTargetTime = now;
    }

    const intersects = raycaster.intersectObjects(game._raycastTargets);

    // First valid hit: skip particles/health bars (noHit) and dead zombies' corpses,
    // which linger in the scene (and cache) but must not absorb bullets
    let hit = null;
    for (const cand of intersects) {
      const ud = cand.object.userData;
      if (ud.noHit) continue;
      if (ud.zombie && !ud.zombie.isAlive()) continue;
      hit = cand;
      break;
    }

    if (hit) {
      const zombie = hit.object.userData.zombie;

      if (zombie) {
        // Hit a zombie
        if (game) game._fireHitZombie = true;
        // Detect headshot: hitpoint above the zombie's neck line (per-type height)
        const hitY = hit.point?.y ?? 0;
        const zombieY = zombie.position?.y ?? 0;
        const isHeadshot = hitY > (zombieY + (zombie.headshotY ?? 0.9));
        const critMult = this._rollCrit?.() ?? 1.0;
        const finalDmg = this.damage * critMult;
        zombie.takeDamage(finalDmg, isHeadshot);
        if (isHeadshot) { game._headshotCount = (game._headshotCount ?? 0) + 1; }
        if (critMult > 1.0) {
          // Crit hit: orange hitmarker + extra blood
          if (game.triggerHitmarker) { game.triggerHitmarker(); }
          if (!game._hitmarkerEl) game._hitmarkerEl = document.getElementById('hitmarker');
          if (game._hitmarkerEl) { game._hitmarkerEl.style.color = '#ff8800'; setTimeout(() => { if (game._hitmarkerEl) game._hitmarkerEl.style.color = ''; }, 250); }
          if (game.particleSystem?.createBlood) game.particleSystem.createBlood(hit.point, 12);
        } else if (!isHeadshot && game.triggerHitmarker) {
          game.triggerHitmarker();
        }
        if (game.particleSystem) {
          const isElec = this.type === 'stun_baton' || this.type === 'electric_baton';
          if (isElec) {
            game.particleSystem.createLightning(hit.point);
            zombie.stunned = true;
            zombie.stunTimer = Math.max(zombie.stunTimer ?? 0, 1.5);
          } else {
            game.particleSystem.createBlood(hit.point, 6);
          }
        }
      } else {
        // Hit terrain/building - only create bullet hole if not sky/far object
        if (hit.distance < 500) {
          this.createBulletHole(hit.point, game, direction);
          game?.particleSystem?.createBulletImpact?.(hit.point);
        }
      }
    }
  }

  createBulletHole(position, game, rayDir) {
    const hole = new THREE.Mesh(this._holeGeo, this._holeMat);
    hole.userData.noHit = true;
    hole.position.copy(position);
    // Lie flat on the hit surface, facing the shooter (rather than a half-buried ball)
    if (rayDir) {
      hole.position.addScaledVector(rayDir, -0.02);
      hole.lookAt(hole.position.x - rayDir.x, hole.position.y - rayDir.y, hole.position.z - rayDir.z);
    }
    game.scene.addObject(hole);
    // Invalidate raycast cache so the hole doesn't get added to targets
    game._raycastTargetTime = 0;
    setTimeout(() => { game.scene.removeObject(hole); }, 6000);
  }

  reload(game) {
    if (this.isReloading || this.ammoInMag === this.magSize) {
      return false;
    }

    if (this.reserveAmmo <= 0) {
      return false;
    }

    this.isReloading = true;
    this.reloadProgress = 0;
    game?.audioManager?.resume?.();
    game?.audioManager?.playReload?.();
    return true;
  }

  completeReload() {
    const ammoNeeded = this.magSize - this.ammoInMag;
    const ammoLoaded = Math.min(ammoNeeded, this.reserveAmmo);

    this.ammoInMag += ammoLoaded;
    this.reserveAmmo -= ammoLoaded;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  addAmmo(amount) {
    this.reserveAmmo += amount;
  }

  getAmmoStatus() {
    return {
      inMag: this.ammoInMag,
      reserve: this.reserveAmmo,
      total: this.ammoInMag + this.reserveAmmo
    };
  }

  getReloadProgress() {
    return this.reloadProgress;
  }

  getName() {
    return this.name;
  }

  canReload() {
    return !this.isReloading && this.ammoInMag < this.magSize && this.reserveAmmo > 0;
  }
}
