import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class ChildZombie extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'child_zombie',
      health: 15,
      maxHealth: 15,
      damage: 6,
      speed: 5.2,
      attackRange: 1.4,
      aggroRange: 42,
      attackCooldown: 0.6
    });
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      scale: 0.58,
      bulk: 0.9,
      hunch: 0.15,
      armPose: 'reach',
      gore: 2,
      shirtColor: 0x6a3a4a // colorful, stained
    });

    // Children have a proportionally bigger head
    refs.headGroup.scale.setScalar(1.25);

    // Faint bioluminescent chest dot (kept from old design; no PointLight — perf)
    const bioMat = new THREE.MeshStandardMaterial({
      color: 0xffee44, emissive: 0xffee44, emissiveIntensity: 0.8, roughness: 0.4
    });
    const bioDot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), bioMat);
    bioDot.position.set(0.04, 0.34, 0.14);
    bioDot.castShadow = false;
    refs.torsoGroup.add(bioDot);
    this._bioDot = bioDot;
    this._bioLight = null;

    this.finalizeMesh(group);
  }

  takeDamage(amount, isHeadshot = false) {
    super.takeDamage(amount, isHeadshot);
    if (!this._dead) {
      // Scream that attracts nearby child zombies
      if (this.game._emitNoise) {
        this.game._emitNoise(this.position.x, this.position.z, 20);
      }
    }
  }

  die() {
    if (this._dead) return;
    // Death scream — larger radius to call the pack
    if (this.game._emitNoise) {
      this.game._emitNoise(this.position.x, this.position.z, 30);
    }
    super.die();
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Flicker bioluminescence
    if (this._bioLight) {
      const flicker = 0.25 + Math.sin(Date.now() * 0.007 + this.position.x) * 0.12;
      this._bioLight.intensity = flicker;
    }
    if (this._bioDot?.material) {
      this._bioDot.material.emissiveIntensity = 0.6 + Math.sin(Date.now() * 0.007 + this.position.x) * 0.3;
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    if (Math.random() < 0.4) {
      const snack = Math.random() < 0.5 ? 'food_chips' : 'food_crackers';
      wi.spawnItem(snack, px, py, pz, 1);
    }
  }
}
