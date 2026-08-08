import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Regenerator extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'regenerator',
      health: 80,
      maxHealth: 80,
      damage: 12,
      speed: 2.2,
      attackRange: 2.0,
      aggroRange: 30,
      attackCooldown: 1.8
    });
    this._regenTimer = 0;
    this._lastDamageTime = 0;
    this._healFlash = 0;
  }

  createMesh() {
    // Raw exposed flesh: shirtless, pinkish-red skinned body covered in wounds
    // with lighter "regrowing" tissue patches.
    const { group, refs } = this.buildHumanoid({
      shirtless: true,
      skinColor: 0x9a5a4a,
      gore: 8,
      armPose: 'reach'
    });

    // Give the raw flesh a faint reddish base emissive so the heal flash
    // (which drives emissiveIntensity in update()) can brighten it.
    refs.skinMat.emissive = new THREE.Color(0x3a1510);
    refs.skinMat.emissiveIntensity = 0.15;

    // Regrowing tissue: lighter pink flattened spheres on torso and limbs
    const patchMat = new THREE.MeshStandardMaterial({
      color: 0xc98a78,
      roughness: 0.75,
      metalness: 0,
      emissive: 0x8a4538,
      emissiveIntensity: 0.15
    });
    const patchSpots = [
      [refs.torsoGroup, 0.1, 0.42, 0.16, 0.06],
      [refs.torsoGroup, -0.12, 0.2, 0.14, 0.075],
      [refs.torsoGroup, 0.05, 0.05, -0.14, 0.065], // back
      [refs.armL.shoulder, 0.02, -0.16, 0.05, 0.045],
      [refs.armR.elbow, -0.01, -0.1, 0.045, 0.04],
      [refs.legL, 0.03, -0.25, 0.08, 0.055]
    ];
    let firstPatch = null;
    for (const [parent, px, py, pz, r] of patchSpots) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), patchMat);
      patch.position.set(px, py, pz);
      patch.scale.z = 0.45;
      patch.castShadow = false;
      parent.add(patch);
      if (!firstPatch) firstPatch = patch;
    }

    // Glow ring (torus) around torso — pulses green when healing
    const glowRingMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    this._glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24), glowRingMat);
    this._glowRing.position.y = 0.2;
    this._glowRing.rotation.x = Math.PI / 2;
    this._glowRing.castShadow = false;
    group.add(this._glowRing);

    // Flash targets: skinMat is shared across the whole shirtless body, so one
    // skin mesh + one patch mesh cover every flesh material.
    this._flashMeshes = firstPatch ? [refs.chest, firstPatch] : [refs.chest];

    this.finalizeMesh(group);
  }

  takeDamage(amount, isHeadshot = false) {
    this._lastDamageTime = Date.now();
    super.takeDamage(amount, isHeadshot);
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Regen timer
    this._regenTimer += deltaTime;

    // Heal flash fade
    if (this._healFlash > 0) {
      this._healFlash -= deltaTime * 2.5;
      if (this._healFlash < 0) this._healFlash = 0;
      // Animate glow ring intensity
      if (this._glowRing) {
        this._glowRing.material.emissiveIntensity = this._healFlash * 1.4;
        this._glowRing.material.opacity = 0.3 + this._healFlash * 0.5;
      }
      // Fade emissive on flesh meshes back down
      if (this._flashMeshes) {
        for (const m of this._flashMeshes) {
          if (m.material) m.material.emissiveIntensity = 0.2 + this._healFlash * 0.6;
        }
      }
    } else {
      // Idle subtle pulse on glow ring
      if (this._glowRing) {
        const idlePulse = 0.08 + Math.sin(Date.now() * 0.003) * 0.06;
        this._glowRing.material.emissiveIntensity = idlePulse;
        this._glowRing.material.opacity = 0.2 + idlePulse * 0.5;
      }
    }

    // Regen: every 2 seconds if no damage taken in that window
    if (this._regenTimer >= 2.0) {
      this._regenTimer = 0;
      const msSinceDamage = Date.now() - this._lastDamageTime;
      if (msSinceDamage >= 2000 && this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 8);
        // Trigger heal flash
        this._healFlash = 1.0;
        if (this._glowRing) {
          this._glowRing.material.emissiveIntensity = 1.4;
          this._glowRing.material.opacity = 0.85;
        }
        if (this._flashMeshes) {
          for (const m of this._flashMeshes) {
            if (m.material) m.material.emissiveIntensity = 0.8;
          }
        }
        // Spawn heal particles
        if (this.game.particleSystem?.createHeal) {
          this.game.particleSystem.createHeal(this.position.clone());
        }
      }
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    wi.spawnItem('med_blood_bag', px, py, pz, 1);
    if (Math.random() < 0.5) wi.spawnItem('med_suture_kit', px + 0.3, py, pz, 1);
  }
}
