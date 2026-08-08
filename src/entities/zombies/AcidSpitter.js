import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class AcidSpitter extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'acid_spitter',
      health: 50,
      maxHealth: 50,
      damage: 8,
      speed: 2.0,
      attackRange: 18,
      aggroRange: 35,
      attackCooldown: 3.0
    });
    this._projectiles = [];
    this._acidPools = [];
    // Track player slow duration
    this._playerSlowTimer = 0;
    this._playerSlowed = false;
  }

  createMesh() {
    // Bloated sickly humanoid, riddled with acid glands
    const { group, refs } = this.buildHumanoid({
      bulk: 0.95,
      skinColor: 0x6f8a4f,
      shirtColor: 0x3a442c,
      gore: 3
    });

    // Jaw hanging open, dripping
    refs.jaw.scale.setScalar(1.35);
    refs.jaw.rotation.x = 0.85;

    // Bulging throat sac swelling below the jaw
    const sacMat = new THREE.MeshStandardMaterial({
      color: 0xa8c050,
      emissive: 0xa8c050,
      emissiveIntensity: 0.4,
      roughness: 0.45
    });
    const throatSac = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), sacMat);
    throatSac.scale.set(1.05, 0.85, 0.95);
    throatSac.position.set(0, -0.015, 0.05);
    throatSac.castShadow = true;
    throatSac.receiveShadow = true;
    refs.headGroup.add(throatSac);

    // Two acid sacs bulging out of the back
    const backSacMat = new THREE.MeshStandardMaterial({
      color: 0x8fae45,
      emissive: 0x8fae45,
      emissiveIntensity: 0.35,
      roughness: 0.5
    });
    for (const [sx, sy] of [[-0.08, 0.42], [0.09, 0.24]]) {
      const sac = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), backSacMat);
      sac.scale.set(1, 0.9, 0.8);
      sac.position.set(sx, sy, -0.15);
      sac.castShadow = true;
      sac.receiveShadow = true;
      refs.torsoGroup.add(sac);
    }

    // Acid dripping off the hands
    const dripMat = new THREE.MeshStandardMaterial({
      color: 0x9adf3a,
      emissive: 0x9adf3a,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8,
      roughness: 0.3
    });
    for (const arm of [refs.armL, refs.armR]) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), dripMat);
      drip.scale.set(1, 2.8, 1);
      drip.position.set(0.01, -0.06, 0.005);
      drip.castShadow = false;
      arm.hand.add(drip);
    }

    // Acid blobs launch from the mouth — track the head
    this._headRef = refs.headGroup;

    this.finalizeMesh(group);
  }

  checkAttack(player, distToPlayer) {
    if (this.state === 'attacking' && distToPlayer < this.attackRange && this.lastAttackTime >= this.attackCooldown) {
      this._fireAcidBlob(player);
      this.lastAttackTime = 0;
    }
  }

  _fireAcidBlob(player) {
    // Launch from the mouth (head world position)
    const startPos = new THREE.Vector3();
    if (this._headRef) {
      this._headRef.getWorldPosition(startPos);
    } else {
      startPos.copy(this.position);
      startPos.y += 0.55;
    }

    const targetPos = player.getPosition().clone().add(new THREE.Vector3(0, 0.8, 0));
    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();

    // Slight spread — acid blobs are less accurate than spitter
    dir.x += (Math.random() - 0.5) * 0.18;
    dir.z += (Math.random() - 0.5) * 0.18;
    dir.normalize();

    const geo = new THREE.SphereGeometry(0.16, 7, 7);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x44cc11,
      emissive: 0x22880a,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.88
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    this.game.scene.scene.add(mesh);

    this._projectiles.push({
      mesh,
      dir,
      speed: 8,       // slower than Spitter (14)
      life: 3.0,
      damage: this.damage
    });

    this.game.audioManager?.resume?.();
  }

  update(deltaTime) {
    super.update(deltaTime);
    this._updateProjectiles(deltaTime);
    this._updateAcidPools(deltaTime);
    this._updatePlayerSlow(deltaTime);
  }

  _updateProjectiles(dt) {
    const player = this.game.player;
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const proj = this._projectiles[i];
      proj.life -= dt;
      proj.mesh.position.addScaledVector(proj.dir, proj.speed * dt);
      proj.mesh.rotation.x += dt * 4;
      proj.mesh.rotation.z += dt * 3;

      let hit = false;

      // Check player hit
      if (player && proj.mesh.position.distanceTo(player.getPosition()) < 0.9) {
        if (!player.godMode && !player._immunePoison) {
          if (player.health - proj.damage <= 0 && player.setDeathCause) {
            player.setDeathCause('Acid Blob');
          }
          player.takeDamage(proj.damage);
        }
        this._applySlow(player);
        this.game.particleSystem?.createAcid?.(proj.mesh.position.clone(), 10);
        this._spawnAcidPool(proj.mesh.position.clone());
        this._removeProjectile(i);
        continue;
      }

      if (proj.life <= 0) {
        this.game.particleSystem?.createAcid?.(proj.mesh.position.clone(), 5);
        this._spawnAcidPool(proj.mesh.position.clone());
        this._removeProjectile(i);
      }
    }
  }

  _removeProjectile(i) {
    const proj = this._projectiles[i];
    this.game.scene.scene.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    proj.mesh.material.dispose();
    this._projectiles.splice(i, 1);
  }

  _spawnAcidPool(pos) {
    const groundY = (this.game.terrainGenerator?.getHeightAt(pos.x, pos.z) ?? 0) + 0.04;
    const geo = new THREE.CylinderGeometry(0.8, 0.8, 0.06, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x33ee11,
      transparent: true,
      opacity: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, groundY, pos.z);
    this.game.scene.scene.add(mesh);
    this._acidPools.push({ mesh, life: 15.0, maxLife: 15.0, damage: 2 });
  }

  _updateAcidPools(dt) {
    const player = this.game.player;
    for (let i = this._acidPools.length - 1; i >= 0; i--) {
      const pool = this._acidPools[i];
      pool.life -= dt;
      // Fade as lifetime runs out
      pool.mesh.material.opacity = 0.6 * (pool.life / pool.maxLife);

      // Damage player if within 0.8m of pool center
      if (player) {
        const dx = pool.mesh.position.x - player.getPosition().x;
        const dz = pool.mesh.position.z - player.getPosition().z;
        if (dx * dx + dz * dz < 0.8 * 0.8) {
          // Damage at 2 HP/s — gas mask blocks acid
          if (!player.godMode && !player._immunePoison) {
            player.takeDamage(pool.damage * dt);
            if (player.health <= 0 && player.setDeathCause) {
              player.setDeathCause('Acid Pool');
            }
          }
          // Apply slow while standing in pool
          this._applySlow(player);
        }
      }

      if (pool.life <= 0) {
        this.game.scene.scene.remove(pool.mesh);
        pool.mesh.geometry.dispose();
        pool.mesh.material.dispose();
        this._acidPools.splice(i, 1);
      }
    }
  }

  _applySlow(player) {
    // Slow player movement by 20% for 3 seconds
    if (!this._playerSlowed) {
      this._playerSlowed = true;
      if (player._moveSpeedMult === undefined) player._moveSpeedMult = 1.0;
      player._moveSpeedMult = Math.min(player._moveSpeedMult, 0.8);

      const notif = document.getElementById('loot-notification');
      if (notif) {
        notif.textContent = '☣ Acid Splash! Slowed!';
        notif.style.color = '#88ff22';
        notif.classList.remove('show');
        void notif.offsetWidth;
        notif.classList.add('show');
      }
    }
    // Reset slow timer on repeated contact
    this._playerSlowTimer = 3.0;
  }

  _updatePlayerSlow(dt) {
    if (!this._playerSlowed) return;
    this._playerSlowTimer -= dt;
    if (this._playerSlowTimer <= 0) {
      this._playerSlowed = false;
      const player = this.game.player;
      if (player && player._moveSpeedMult !== undefined) {
        player._moveSpeedMult = 1.0;
      }
    }
  }

  _cleanupPools() {
    for (const pool of this._acidPools) {
      this.game.scene.scene.remove(pool.mesh);
      pool.mesh.geometry.dispose();
      pool.mesh.material.dispose();
    }
    this._acidPools = [];
  }

  die() {
    if (this._dead) return;

    // Clean up in-flight projectiles
    for (const proj of this._projectiles) {
      this.game.scene.scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      proj.mesh.material.dispose();
    }
    this._projectiles = [];

    // Restore player speed if we were slowing them
    if (this._playerSlowed) {
      const player = this.game.player;
      if (player && player._moveSpeedMult !== undefined) {
        player._moveSpeedMult = 1.0;
      }
      this._playerSlowed = false;
    }

    // On death: spawn 3 acid pools around corpse
    const px = this.position.x, pz = this.position.z;
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      const dist = 0.8 + Math.random() * 0.8;
      const spawnPos = new THREE.Vector3(
        px + Math.cos(ang) * dist,
        this.position.y,
        pz + Math.sin(ang) * dist
      );
      this._spawnAcidPool(spawnPos);
    }

    // Pools are now orphaned from this instance — transfer ownership to scene
    // They will tick normally until life expires (handled in the pools array
    // but since this zombie is dead, we migrate ticking to a standalone updater)
    this._migratePools();

    super.die();
  }

  // After death, migrate remaining pools to a scene-level anonymous updater
  // so they keep ticking even though this zombie is no longer updated.
  _migratePools() {
    if (this._acidPools.length === 0) return;
    const pools = this._acidPools;
    const player = () => this.game.player;
    const scene = this.game.scene.scene;
    const terrainGen = this.game.terrainGenerator;

    let lastTime = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const p = player();
      for (let i = pools.length - 1; i >= 0; i--) {
        const pool = pools[i];
        pool.life -= dt;
        pool.mesh.material.opacity = 0.6 * Math.max(0, pool.life / pool.maxLife);

        if (p) {
          const dx = pool.mesh.position.x - p.getPosition().x;
          const dz = pool.mesh.position.z - p.getPosition().z;
          if (dx * dx + dz * dz < 0.8 * 0.8 && !p.godMode && !p._immunePoison) {
            p.takeDamage(pool.damage * dt);
            if (p.health <= 0 && p.setDeathCause) p.setDeathCause('Acid Pool');
          }
        }

        if (pool.life <= 0) {
          scene.remove(pool.mesh);
          pool.mesh.geometry.dispose();
          pool.mesh.material.dispose();
          pools.splice(i, 1);
        }
      }

      if (pools.length > 0) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // Detach from instance so die/cleanup don't double-remove
    this._acidPools = [];
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Acid-themed drops
    const roll = Math.random();
    if (roll < 0.30) {
      wi.spawnItem('mat_bleach', px, py, pz, 1);
    } else if (roll < 0.55) {
      wi.spawnItem('med_antibiotics', px, py, pz, 1);
    } else if (roll < 0.72) {
      wi.spawnItem('special_virus_sample', px, py, pz, 1);
    } else if (roll < 0.85) {
      wi.spawnItem('bandage', px, py, pz, 1);
    }
    // 15%: no drop
  }
}
