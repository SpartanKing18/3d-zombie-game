import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Bloater extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'bloater',
      health: 120,
      maxHealth: 120,
      damage: 18,
      speed: 0.9,
      attackRange: 2.8,
      aggroRange: 22,
      attackCooldown: 2.5
    });
    this._pulseTimer = 0;
  }

  createMesh() {
    // Bloated gas zombie — distended gut straining a stained shirt
    const { group, refs } = this.buildHumanoid({
      bulk: 1.25,
      belly: 1.0,
      shirtColor: 0x4a4a38,
      skinColor: 0x8a9a6a,
      gore: 3,
      hunch: 0.15,
      armPose: 'hang'
    });

    // Pustule clusters bursting through on belly / chest / neck
    const pustuleMat = new THREE.MeshStandardMaterial({
      color: 0xb8c05a,
      emissive: 0x8a9038,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      metalness: 0
    });
    const pustuleSpots = [
      // [x, y, z, radius] on torsoGroup (belly front, chest, up to the neck)
      [ 0.14, 0.08,  0.3,  0.055],
      [-0.1,  0.14,  0.32, 0.07 ],
      [ 0.02, 0.02,  0.34, 0.05 ],
      [-0.2,  0.06,  0.26, 0.045],
      [ 0.2,  0.2,   0.24, 0.05 ],
      [ 0.06, 0.3,   0.2,  0.055],
      [-0.12, 0.38,  0.16, 0.045],
      [ 0.04, 0.5,   0.1,  0.04 ],
      [-0.06, 0.55,  0.08, 0.032],
    ];
    for (const [x, y, z, r] of pustuleSpots) {
      const pustule = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), pustuleMat);
      pustule.position.set(x, y, z);
      pustule.scale.y = 0.85;
      pustule.castShadow = true;
      pustule.receiveShadow = true;
      refs.torsoGroup.add(pustule);
    }

    // Body parts that swell with the breathing pulse (keep their base scales)
    this._pulseParts = [refs.abdomen, refs.chest].map(mesh => ({
      mesh,
      base: mesh.scale.clone()
    }));

    this.finalizeMesh(group);
  }

  update(deltaTime) {
    super.update(deltaTime);
    // Pulse the gut/chest scale to look like it's breathing
    this._pulseTimer += deltaTime;
    if (this.mesh && this._pulseParts) {
      const pulse = 1.0 + Math.sin(this._pulseTimer * 2.5) * 0.04;
      for (const { mesh, base } of this._pulseParts) {
        mesh.scale.set(base.x * pulse, base.y * pulse, base.z * pulse);
      }
    }
  }

  die() {
    if (this._dead) return;
    // Explosion death: damage player and nearby zombies, spawn mini crawlers
    const px = this.position.x, pz = this.position.z;
    const py = this.position.y;
    // Damage player if close
    const player = this.game.player;
    if (player) {
      const d = this.position.distanceTo(player.getPosition());
      if (d < 6) {
        const dmg = Math.max(5, 30 * (1 - d / 6));
        if (!player.godMode) player.takeDamage(dmg);
        if (d < 4 && !player.godMode && !player._immuneInfect) player._infected = true;
        const notif = document.getElementById('loot-notification');
        if (notif && d < 6) { notif.textContent = '☣ Bloater exploded! Watch out!'; notif.style.color = '#88ff44'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      }
    }
    // Toxic gas particle cloud (don't sequence explosion with `?? blood`)
    const ps = this.game.particleSystem;
    if (ps) {
      for (let i = 0; i < 3; i++) {
        const pos = this.position.clone();
        pos.x += (Math.random()-0.5)*2; pos.z += (Math.random()-0.5)*2;
        if (ps.createExplosion) ps.createExplosion(pos); else ps.createBlood(pos, 20);
      }
    }
    // Spawn 2-3 crawlers from the corpse
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      try {
        this.game.zombieManager?.spawn('crawler', px + Math.cos(ang) * 1.5, pz + Math.sin(ang) * 1.5);
      } catch(e) {}
    }
    super.die();
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    wi.spawnItem('med_antibiotics', px, py, pz, 2);
    if (Math.random() < 0.4) wi.spawnItem('mat_bleach', px + 0.3, py, pz, 1);
    if (Math.random() < 0.3) wi.spawnItem('special_virus_sample', px, py, pz + 0.3, 1);
  }
}
