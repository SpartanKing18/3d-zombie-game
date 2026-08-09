import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class MutantGiant extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'mutant_giant',
      health: 500,
      maxHealth: 500,
      damage: 50,
      speed: 0.8,
      attackRange: 3.5,
      aggroRange: 45,
      attackCooldown: 4.0
    });
    this._enraged = false;
    this._stompCooldown = 6.0; // first stomp available after 6s
    this._tremorTimer = 0;
    this._shockwave = null;
    this._shockwaveActive = false;
    this._shockwaveScale = 0;
    this._alerted = false;

    // Grab state
    this._grabbing = false;
    this._grabTimer = 0;
    this._justAttacked = false;
  }

  createMesh() {
    // Towering mutated giant. Old mesh was ~5m tall (1.8x group scale on an oversized
    // body); scale 2.7 on the 1.8m humanoid gives ~4.9m. Physics body is the unchanged
    // base cylinder (center 0.9 above ground), so default footY keeps the soles planted,
    // and buildHumanoid sets headshotY / _healthBarHeight for the scaled height.
    const { group, refs } = this.buildHumanoid({
      scale: 2.7,
      bulk: 1.5,
      shirtless: true,
      skinColor: 0x6a7258,
      bald: true,
      gore: 10,
      hunch: 0.28,
      eyeColor: 0xffaa00,
      eyeEmissive: 0.8
    });

    // Mutation: grotesquely oversized right arm
    refs.armR.shoulder.scale.setScalar(1.4);
    refs.armR.shoulder.position.x += 0.04;

    // Bone spikes erupting from shoulders and spine
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.55, metalness: 0 });
    const spikes = [
      // [x, y, z, rotX, rotZ, height] — on torsoGroup
      [-0.3,  0.56,  0.0, -0.15,  0.7,  0.3 ],
      [ 0.34, 0.58,  0.0, -0.15, -0.75, 0.34],
      [-0.24, 0.5,  -0.1, -0.5,   0.5,  0.24],
      [ 0.26, 0.52, -0.1, -0.5,  -0.5,  0.26],
      [ 0.0,  0.5,  -0.2, -0.9,   0.0,  0.3 ],
      [ 0.0,  0.3,  -0.24, -1.1,  0.1,  0.26],
      [ 0.0,  0.1,  -0.24, -1.25, -0.1, 0.22],
    ];
    for (const [x, y, z, rx, rz, h] of spikes) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, h, 6), boneMat);
      spike.position.set(x, y, z);
      spike.rotation.set(rx, 0, rz);
      spike.castShadow = true;
      spike.receiveShadow = true;
      refs.torsoGroup.add(spike);
    }

    // Exposed rib gore patch on the chest
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), refs.goreMat);
    patch.position.set(0.05, 0.36, 0.15);
    patch.scale.set(1.5, 1.2, 0.35);
    patch.castShadow = false;
    patch.receiveShadow = true;
    refs.torsoGroup.add(patch);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.26 - i * 0.03, 0.022, 0.03), boneMat);
      rib.position.set(0.05, 0.46 - i * 0.065, 0.19);
      rib.rotation.z = (i % 2 ? -1 : 1) * 0.08;
      rib.castShadow = false;
      rib.receiveShadow = true;
      refs.torsoGroup.add(rib);
    }

    // Collect glowing eye materials so enrage can tint them red
    this._glowMats = [];
    refs.headGroup.traverse(c => {
      if (c.isMesh && c.material?.emissive && c.material.emissive.getHex() !== 0 &&
          !this._glowMats.includes(c.material)) {
        this._glowMats.push(c.material);
      }
    });

    this.finalizeMesh(group);

    // Shockwave ring (starts invisible, activated on stomp)
    const shockGeo = new THREE.TorusGeometry(1.0, 0.12, 6, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0x88ff44,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    this._shockwave = new THREE.Mesh(shockGeo, shockMat);
    this._shockwave.rotation.x = Math.PI / 2;
    this._shockwave.position.y = 0.15;
    this.game.scene.scene.add(this._shockwave);
  }

  _triggerEnrage() {
    if (this._enraged) return;
    this._enraged = true;
    this.speed = 1.6;
    this.damage = 70;
    this._stompCooldown = 0; // stomp immediately on enrage

    // Eyes turn blazing red
    for (const mat of this._glowMats ?? []) {
      mat.color.set(0xff2200);
      mat.emissive.set(0xff1100);
      mat.emissiveIntensity = 1.4;
    }

    this.game.audioManager?.playZombieGroan?.();

    if (this.game.particleSystem) {
      const pos = this.position.clone();
      pos.y += 3.0;
      this.game.particleSystem.createBlood(pos, 20);
    }
  }

  _doGroundStomp() {
    const player = this.game.player;
    const stompRadius = 6;

    // Animate shockwave ring outward
    if (this._shockwave) {
      this._shockwave.position.set(this.position.x, this.position.y + 0.15, this.position.z);
      this._shockwaveScale = 0.1;
      this._shockwaveActive = true;
      this._shockwave.material.opacity = 0.75;
      this._shockwave.scale.setScalar(this._shockwaveScale);
    }

    // Screen shake
    if (player) {
      player._shakeTime = 0.8;
    }

    // AoE damage — player
    if (player) {
      const distToPlayer = this.position.distanceTo(player.getPosition());
      if (distToPlayer <= stompRadius) {
        const stompDmg = Math.round(this.damage * 0.8);
        if (player.health - stompDmg <= 0 && player.setDeathCause) {
          player.setDeathCause('Crushed by a Mutant Giant');
        }
        player.takeDamage(stompDmg);

        // Violent knockback
        if (player.body) {
          const dx = player.getPosition().x - this.position.x;
          const dz = player.getPosition().z - this.position.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          player.body.velocity.x += (dx / d) * 14;
          player.body.velocity.z += (dz / d) * 14;
          player.body.velocity.y = Math.max(player.body.velocity.y, 6.0);
        }
      }
    }

    // AoE damage — nearby zombies (friendly fire from shockwave)
    const zombies = this.game.zombieManager?.getZombies?.() ?? [];
    for (const z of zombies) {
      if (z === this || z._dead) continue;
      const dist = this.position.distanceTo(z.position);
      if (dist <= stompRadius) {
        z.takeDamage(this.damage * 0.3);
        // Knock them back
        if (z.body) {
          const dx = z.position.x - this.position.x;
          const dz = z.position.z - this.position.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          z.body.velocity.x += (dx / d) * 8;
          z.body.velocity.z += (dz / d) * 8;
          z.body.velocity.y = Math.max(z.body.velocity.y, 3.0);
        }
      }
    }

    // Stomp particles
    if (this.game.particleSystem) {
      const pos = this.position.clone();
      pos.y += 0.2;
      this.game.particleSystem.createBlood(pos, 25);
    }

    this.game.audioManager?.playZombieGroan?.();

    // Emit noise event for tremor — Game.update expires events by ttl;
    // without one, `undefined - dt` is NaN and the event is dropped the same frame
    if (!this.game._noiseEvents) this.game._noiseEvents = [];
    this.game._noiseEvents.push({ x: this.position.x, z: this.position.z, radius: 15, ttl: 0.3 });
  }

  _doGrabAttack(player) {
    if (this._grabbing) return;
    if (Math.random() > 0.3) return; // 30% chance

    this._grabbing = true;
    player._grabTimer = 2.0; // freeze player for 2s on player's side

    // Deal damage over time via a simple interval
    const grabDps = this.damage * 0.4;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.25;
      // player.health check: Player never sets a _dead flag, so guard on actual HP
      // to stop the DoT ticking on a dead/respawned player
      if (player && player.health > 0 && !this._dead && elapsed < 2.0) {
        if (player.setDeathCause && player.health - grabDps * 0.25 <= 0) player.setDeathCause('Grabbed by a Mutant Giant');
        player.takeDamage(grabDps * 0.25);
      } else {
        clearInterval(interval);
        this._grabbing = false;
      }
    }, 250);
  }

  checkAttack(player, distToPlayer) {
    const prevTime = this.lastAttackTime;
    super.checkAttack(player, distToPlayer);
    if (prevTime !== this.lastAttackTime) this._justAttacked = true;
  }

  _updateShockwave(deltaTime) {
    if (!this._shockwaveActive || !this._shockwave) return;

    // Expand from scale 0.1 up to ~stompRadius/1.8 units (world scale adjusted for group scale 1.8)
    const maxScale = 3.5;
    this._shockwaveScale += deltaTime * (maxScale / 0.8); // covers full radius in ~0.8s
    this._shockwave.scale.setScalar(this._shockwaveScale);

    // Fade opacity as it expands
    const progress = this._shockwaveScale / maxScale;
    this._shockwave.material.opacity = 0.75 * (1.0 - progress);

    if (this._shockwaveScale >= maxScale) {
      this._shockwaveActive = false;
      this._shockwave.material.opacity = 0;
      this._shockwaveScale = 0;
    }
  }

  update(deltaTime) {
    super.update(deltaTime);

    if (this._dead) return;

    // First-aggro roar
    if (!this._alerted && this.state === 'chasing') {
      this._alerted = true;
      this.game.audioManager?.playZombieGroan?.();
      if (this.game.particleSystem) {
        const pos = this.position.clone();
        pos.y += 3.5;
        this.game.particleSystem.createBlood(pos, 15);
      }
    }

    // Enrage at 25% HP
    if (!this._enraged && this.health <= this.maxHealth * 0.25 && !this._dead) {
      this._triggerEnrage();
    }

    // Ground stomp cooldown
    this._stompCooldown -= deltaTime;
    if (this._stompCooldown <= 0 && this.state !== 'idle') {
      this._stompCooldown = 6.0;
      this._doGroundStomp();
    }

    // Update shockwave animation
    this._updateShockwave(deltaTime);

    // Tremor noise every 2s while walking
    this._tremorTimer -= deltaTime;
    if (this._tremorTimer <= 0 && this.state === 'chasing') {
      this._tremorTimer = 2.0;
      if (!this.game._noiseEvents) this.game._noiseEvents = [];
      const ev = { x: this.position.x, z: this.position.z, radius: 15 };
      this.game._noiseEvents.push(ev);
      setTimeout(() => {
        if (this.game._noiseEvents) {
          const idx = this.game._noiseEvents.indexOf(ev);
          if (idx !== -1) this.game._noiseEvents.splice(idx, 1);
        }
      }, 300);

      // Minor camera shake for player if nearby
      const player = this.game.player;
      if (player) {
        const dist = this.position.distanceTo(player.getPosition());
        if (dist <= 15) {
          const intensity = (1 - dist / 15) * 0.25;
          player._shakeTime = Math.max(player._shakeTime ?? 0, intensity);
        }
      }
    }

    // Grab on each melee hit — uses flag set in checkAttack override
    const player = this.game.player;
    if (this._justAttacked && !this._grabbing && player) {
      this._justAttacked = false;
      const distToPlayer = this.position.distanceTo(player.getPosition());
      if (distToPlayer <= this.attackRange) this._doGrabAttack(player);
    }

    // Count down player grab freeze timer
    if (player && player._grabTimer > 0) {
      player._grabTimer -= deltaTime;
      if (player._grabTimer <= 0) {
        player._grabTimer = 0;
      }
      // While grabbed, dampen player movement
      if (player.body && player._grabTimer > 0) {
        player.body.velocity.x *= 0.1;
        player.body.velocity.z *= 0.1;
      }
    }
  }

  takeDamage(amount, isHeadshot = false) {
    // 30% damage mitigation — heavy mutant
    const reduced = amount * 0.7;

    if (this.game.particleSystem && !this._dead) {
      const pos = this.position.clone();
      pos.y += 1.0;
      const ps = this.game.particleSystem;
      if (ps.createSpark) ps.createSpark(pos); else ps.createBlood(pos, 2);
    }

    super.takeDamage(reduced, isHeadshot);

    if (!this._enraged && this.health <= this.maxHealth * 0.25 && !this._dead) {
      this._triggerEnrage();
    }
  }

  die() {
    if (this._dead) return;

    // Final massive explosion of particles
    if (this.game.particleSystem) {
      const pos = this.position.clone();
      pos.y += 1.5;
      this.game.particleSystem.createBlood(pos, 40);
    }

    // Clean up shockwave mesh
    if (this._shockwave) {
      this.game.scene.scene.remove(this._shockwave);
      this._shockwave.geometry.dispose();
      this._shockwave.material.dispose();
      this._shockwave = null;
    }

    // Remove player grab if active
    const player = this.game.player;
    if (player && player._grabTimer > 0) {
      player._grabTimer = 0;
    }

    super.die();
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Boss-tier loot
    wi.spawnItem('weapon_rifle_found', px, py, pz, 1);
    wi.spawnItem('armor_vest', px + 0.5, py, pz, 1);
    wi.spawnItem('medical_kit', px - 0.5, py, pz, 1);
    wi.spawnItem('medical_kit', px, py, pz + 0.5, 1);

    // Heavy ammo
    wi.spawnItem('ammo_308', px - 0.4, py, pz + 0.2, 20);
    wi.spawnItem('ammo_556', px + 0.4, py, pz + 0.2, 30);
    wi.spawnItem('ammo_762', px, py, pz - 0.5, 15);

    // Rare extras
    if (Math.random() < 0.75) wi.spawnItem('med_morphine', px + 0.3, py, pz - 0.3, 2);
    if (Math.random() < 0.65) wi.spawnItem('med_antibiotics', px - 0.3, py, pz - 0.3, 2);
    if (Math.random() < 0.55) wi.spawnItem('mat_battery', px + 0.5, py, pz - 0.5, 3);
    if (Math.random() < 0.40) wi.spawnItem('weapon_smg_found', px - 0.5, py, pz - 0.5, 1);
    if (Math.random() < 0.30) wi.spawnItem('mat_super_glue', px, py, pz - 0.3, 2);
  }
}
