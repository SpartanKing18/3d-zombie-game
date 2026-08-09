import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Juggernaut extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'juggernaut',
      health: 350,
      maxHealth: 350,
      damage: 40,
      speed: 1.0,
      attackRange: 3.0,
      aggroRange: 40,
      attackCooldown: 3.0
    });
    this._enraged = false;
    this._slamCooldown = 0;
    this._alerted = false;
  }

  createMesh() {
    // Hulking brute in crude scrap armor
    // Base physics body (cylinder, center 0.9 above ground) is unchanged, so default footY
    // is correct; buildHumanoid keeps the scaled soles planted and sets headshotY /
    // _healthBarHeight for the 1.4x height automatically.
    const { group, refs } = this.buildHumanoid({
      scale: 1.4,
      bulk: 1.7,
      skinColor: 0x707a64,
      shirtless: true,
      bald: true,
      gore: 5,
      hunch: 0.22,
      eyeColor: 0xff6600,
      eyeEmissive: 0.7
    });

    // Crude welded metal plates strapped to the body
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.55, roughness: 0.5 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x241f1a, roughness: 0.95 });
    const addPlate = (w, h, d, x, y, z, parent) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plateMat);
      p.position.set(x, y, z);
      p.rotation.set(
        (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.16
      );
      p.castShadow = true;
      p.receiveShadow = true;
      parent.add(p);
      return p;
    };

    // Chest + gut plates
    addPlate(0.44, 0.3, 0.06, 0, 0.4, 0.18, refs.torsoGroup);
    addPlate(0.34, 0.22, 0.06, 0.03, 0.14, 0.2, refs.torsoGroup);
    // Straps holding the chest plate on
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.02), strapMat);
      strap.position.set(side * 0.14, 0.44, 0.2);
      strap.rotation.z = side * 0.35;
      strap.castShadow = true;
      strap.receiveShadow = true;
      refs.torsoGroup.add(strap);
    }
    // Shoulder plates (ride the shoulder pivots so they swing with the arms)
    addPlate(0.2, 0.09, 0.2, -0.02, 0.05, 0, refs.armL.shoulder);
    addPlate(0.2, 0.09, 0.2, 0.02, 0.05, 0, refs.armR.shoulder);
    // Forearm plates
    addPlate(0.1, 0.2, 0.05, 0, -0.12, 0.06, refs.armL.elbow);
    addPlate(0.1, 0.2, 0.05, 0, -0.12, 0.06, refs.armR.elbow);

    // Metal faceplate with a narrow glowing eye slit
    const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.045), plateMat);
    facePlate.position.set(0, 0.155, 0.11);
    facePlate.rotation.x = -0.06;
    facePlate.castShadow = true;
    facePlate.receiveShadow = true;
    refs.headGroup.add(facePlate);
    const slitMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
      roughness: 0.4
    });
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.012), slitMat);
    slit.position.set(0, 0.19, 0.135);
    slit.rotation.x = -0.06;
    slit.castShadow = false;
    refs.headGroup.add(slit);

    // Collect glow materials (eyes + slit) so enrage can tint them red
    this._glowMats = [slitMat];
    refs.headGroup.traverse(c => {
      if (c.isMesh && c.material?.emissive && c.material.emissive.getHex() !== 0 &&
          !this._glowMats.includes(c.material)) {
        this._glowMats.push(c.material);
      }
    });

    this.finalizeMesh(group);
  }

  _triggerEnrage() {
    if (this._enraged) return;
    this._enraged = true;
    this.speed = 2.0;
    this._slamCooldown = 0; // slam available immediately on enrage

    // Visual: tint eyes + faceplate slit bright red to signal enrage
    for (const mat of this._glowMats ?? []) {
      mat.color.set(0xff0000);
      mat.emissive.set(0xff0000);
      mat.emissiveIntensity = 1.1;
    }

    // Roar / groan to alert nearby zombies and give audio feedback
    this.game.audioManager?.playZombieGroan?.();

    // Spawn roar particles (reuse blood system with fewer particles)
    if (this.game.particleSystem) {
      const pos = this.position.clone();
      pos.y += 2.0;
      this.game.particleSystem.createBlood(pos, 10);
    }
  }

  _doGroundSlam() {
    const player = this.game.player;
    if (!player) return;

    const distToPlayer = this.position.distanceTo(player.getPosition());
    if (distToPlayer > 5) return;

    // Slam damage (60% of base damage as AoE)
    const slamDamage = Math.round(this.damage * 1.5);
    if (player.health - slamDamage <= 0 && player.setDeathCause) {
      player.setDeathCause('Crushed by Juggernaut ground slam');
    }
    player.takeDamage(slamDamage);

    // Screen shake
    player._shakeTime = 0.5;

    // Knockback away from impact point
    if (player.body) {
      const dx = player.getPosition().x - this.position.x;
      const dz = player.getPosition().z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      player.body.velocity.x += (dx / dist) * 8;
      player.body.velocity.z += (dz / dist) * 8;
      player.body.velocity.y = Math.max(player.body.velocity.y, 4.0);
    }

    // Slam shockwave particles
    if (this.game.particleSystem) {
      const pos = this.position.clone();
      pos.y += 0.2;
      this.game.particleSystem.createBlood(pos, 20);
    }

    this.game.audioManager?.playZombieGroan?.();
  }

  update(deltaTime) {
    super.update(deltaTime);

    // Check enrage threshold (first time health drops to or below 50%)
    if (!this._enraged && this.health <= this.maxHealth * 0.5 && !this._dead) {
      this._triggerEnrage();
    }

    // First-aggro roar (one-time, when first entering chase state)
    if (!this._alerted && this.state === 'chasing') {
      this._alerted = true;
      this.game.audioManager?.playZombieGroan?.();
      if (this.game.particleSystem) {
        const pos = this.position.clone();
        pos.y += 2.2;
        this.game.particleSystem.createBlood(pos, 8);
      }
    }

    // Ground slam tick (only in enrage)
    if (this._enraged && !this._dead) {
      this._slamCooldown -= deltaTime;
      if (this._slamCooldown <= 0) {
        this._slamCooldown = 8.0;
        this._doGroundSlam();
      }
    }

    // Screen shake on regular attack: fires once per attack cycle via flag
    if (this._justAttacked) {
      this._justAttacked = false;
      const player = this.game.player;
      if (player) player._shakeTime = 0.3;
    }
  }

  checkAttack(player, distToPlayer) {
    const prevTime = this.lastAttackTime;
    super.checkAttack(player, distToPlayer);
    // Detect attack firing: lastAttackTime reset to 0 means attack just landed
    if (prevTime !== this.lastAttackTime && this.lastAttackTime === 0) {
      this._justAttacked = true;
    }
  }

  takeDamage(amount, isHeadshot = false) {
    // 50% damage reduction from all sources (heavily armored)
    const reduced = amount * 0.5;

    // Spark visual on body hits
    if (this.game.particleSystem && !this._dead) {
      const pos = this.position.clone();
      pos.y += 0.8;
      const ps = this.game.particleSystem;
      if (ps.createSpark) ps.createSpark(pos); else ps.createBlood(pos, 2);
    }

    super.takeDamage(reduced, isHeadshot);

    // Check enrage after damage applied
    if (!this._enraged && this.health <= this.maxHealth * 0.5 && !this._dead) {
      this._triggerEnrage();
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Legendary loot — always drops a weapon and heavy medical/gear
    wi.spawnItem('weapon_rifle_found', px, py, pz, 1);
    wi.spawnItem('armor_vest', px + 0.4, py, pz, 1);
    wi.spawnItem('medical_kit', px, py, pz + 0.4, 1);

    // Generous ammo
    wi.spawnItem('ammo_556', px - 0.4, py, pz, 30);
    wi.spawnItem('ammo_308', px, py, pz - 0.4, 15);

    // Rare crafting bonus
    if (Math.random() < 0.65) wi.spawnItem('mat_battery', px + 0.3, py, pz + 0.3, 2);
    if (Math.random() < 0.50) wi.spawnItem('med_morphine', px - 0.3, py, pz + 0.3, 1);
    if (Math.random() < 0.40) wi.spawnItem('med_antibiotics', px + 0.3, py, pz - 0.3, 2);
  }
}
