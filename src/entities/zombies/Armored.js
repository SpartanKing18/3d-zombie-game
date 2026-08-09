import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Armored extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'armored',
      health: 180,
      maxHealth: 180,
      damage: 25,
      speed: 1.6,
      attackRange: 2.2,
      aggroRange: 28,
      attackCooldown: 2.2
    });
    this._armorIntact = true;
  }

  createMesh() {
    // Dead riot cop: dark navy uniform under salvaged riot gear
    const { group, refs } = this.buildHumanoid({
      shirtColor: 0x23272e,
      pantsColor: 0x1d2025,
      bald: true, // helmet covers the skull
      gore: 2,
      hunch: 0.18
    });

    const gearMat = new THREE.MeshStandardMaterial({ color: 0x181b1f, metalness: 0.35, roughness: 0.6 });
    const helmMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.35, roughness: 0.55 });
    const addGear = (mesh, parent) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      this._armorMeshes.push(mesh);
      return mesh;
    };
    this._armorMeshes = [];

    // Chest plate over the sternum
    const plate = addGear(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.1), gearMat), refs.torsoGroup);
    plate.position.set(0, 0.34, 0.12);
    // Back plate
    const backPlate = addGear(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.08), gearMat), refs.torsoGroup);
    backPlate.position.set(0, 0.36, -0.13);

    // Shoulder pads — flattened spheres riding the shoulder pivots (swing with the arms)
    for (const arm of [refs.armL, refs.armR]) {
      const pad = addGear(new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), gearMat), arm.shoulder);
      pad.position.set(0, 0.02, 0);
      pad.scale.set(1.3, 0.75, 1.15);
    }

    // Shin guards — on the hip pivots so they swing with each step
    for (const leg of [refs.legL, refs.legR]) {
      if (!leg) continue;
      const guard = addGear(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.06), gearMat), leg);
      guard.position.set(0, -0.64, 0.09);
      guard.rotation.x = 0.12; // follow the shin's natural bend
    }

    // Helmet — sphere cap over the skull
    const helm = addGear(new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8), helmMat), refs.headGroup);
    helm.position.set(0, 0.19, -0.005);
    helm.scale.set(1.0, 0.92, 1.05);
    // Translucent visor over the face
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, transparent: true, opacity: 0.35,
      metalness: 0.2, roughness: 0.25
    });
    const visor = addGear(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.025), visorMat), refs.headGroup);
    visor.position.set(0, 0.17, 0.115);
    visor.rotation.x = -0.1;
    visor.castShadow = false;

    this.finalizeMesh(group);
  }

  takeDamage(amount, isHeadshot = false) {
    // Armor reduces bullet damage 70% unless headshot
    const reduced = isHeadshot ? amount : amount * 0.3;
    if (!isHeadshot && this._armorIntact) {
      // Spark flash on armor hit (metal shouldn't "bleed")
      const ps = this.game.particleSystem;
      if (ps) {
        const pos = this.position.clone();
        pos.y += 0.7;
        if (ps.createSpark) ps.createSpark(pos); else ps.createBlood(pos, 3);
      }
    }
    // Forward isHeadshot so headshots still get the 2.5x multiplier + hitmarker
    super.takeDamage(reduced, isHeadshot);
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    wi.spawnItem('armor_vest', px, py, pz, 1);
    wi.spawnItem('armor_helmet', px + 0.3, py, pz, 1);
    if (Math.random() < 0.5) wi.spawnItem('ammo_556', px, py, pz + 0.3, 15);
    if (Math.random() < 0.35) wi.spawnItem('weapon_rifle_found', px - 0.3, py, pz, 1);
  }
}
