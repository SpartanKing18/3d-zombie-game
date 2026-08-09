import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Spitter extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'spitter',
      health: 40,
      damage: 15,
      speed: 2.5,
      attackRange: 15,
      aggroRange: 50,
      attackCooldown: 2.5
    });
    this._projectiles = [];
    this._acidPuddles = [];
  }

  createMesh() {
    // Gaunt, sickly humanoid with acid-stained clothes
    const { group, refs } = this.buildHumanoid({
      bulk: 0.85,
      skinColor: 0x7a8f5a,
      shirtColor: 0x3d4432,
      gore: 3
    });

    // Distended jaw hanging wide open
    refs.jaw.scale.setScalar(1.6);
    refs.jaw.rotation.x = 0.9;

    // Acid drool strands hanging from the jaw
    const droolMat = new THREE.MeshStandardMaterial({
      color: 0x9adf3a,
      emissive: 0x9adf3a,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.8,
      roughness: 0.3
    });
    for (let i = 0; i < 3; i++) {
      const drool = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), droolMat);
      drool.scale.set(1, 3 + Math.random() * 2, 1);
      drool.position.set((i - 1) * 0.028, -0.01 - Math.random() * 0.03, 0.095);
      drool.castShadow = false;
      refs.headGroup.add(drool);
    }

    // Acid-burn patches eaten into the shirt
    const burnMat = new THREE.MeshStandardMaterial({ color: 0x6a7a3a, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 6), burnMat);
      patch.scale.z = 0.3;
      patch.position.set((Math.random() - 0.5) * 0.2, 0.12 + Math.random() * 0.32, 0.115);
      patch.castShadow = false;
      refs.torsoGroup.add(patch);
    }

    // Projectiles spit from the mouth — track the head
    this._headRef = refs.headGroup;

    this.finalizeMesh(group);
  }

  checkAttack(player, distToPlayer) {
    if (this.state === 'attacking' && distToPlayer < this.attackRange && this.lastAttackTime >= this.attackCooldown) {
      this._fireProjectile(player);
      this.lastAttackTime = 0;
    }
  }

  _fireProjectile(player) {
    // Spit from the mouth (head world position)
    const startPos = new THREE.Vector3();
    if (this._headRef) {
      this._headRef.getWorldPosition(startPos);
    } else {
      startPos.copy(this.position);
      startPos.y += 0.55;
    }

    const dir = new THREE.Vector3()
      .subVectors(player.getPosition().add(new THREE.Vector3(0, 0.8, 0)), startPos)
      .normalize();

    // Add slight spread
    dir.x += (Math.random() - 0.5) * 0.25;
    dir.z += (Math.random() - 0.5) * 0.25;
    dir.normalize();

    const geo  = new THREE.SphereGeometry(0.14, 6, 6);
    const mat  = new THREE.MeshPhongMaterial({
      color: 0x44ff22, emissive: 0x22aa00, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    this.game.scene.scene.add(mesh);

    this._projectiles.push({ mesh, dir, speed: 14, life: 2.0, damage: this.damage });
    this.game.audioManager?.resume?.();
  }

  update(deltaTime) {
    super.update(deltaTime);
    this._updateProjectiles(deltaTime);
    this._updateAcidPuddles(deltaTime);
  }

  _updateProjectiles(dt) {
    const player = this.game.player;
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const proj = this._projectiles[i];
      proj.life -= dt;
      proj.mesh.position.addScaledVector(proj.dir, proj.speed * dt);
      proj.mesh.rotation.x += dt * 5;

      // Check player hit
      if (player && proj.mesh.position.distanceTo(player.getPosition()) < 0.9) {
        player.takeDamage(proj.damage * 0.7);
        player._deathCause = 'Acid Spit';
        this.game.particleSystem?.createAcid?.(proj.mesh.position.clone(), 8);
        this._spawnAcidPuddle(proj.mesh.position.clone());
        this._removeProjectile(i);
        continue;
      }

      if (proj.life <= 0) {
        this.game.particleSystem?.createAcid?.(proj.mesh.position.clone(), 4);
        this._spawnAcidPuddle(proj.mesh.position.clone());
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

  _spawnAcidPuddle(pos) {
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.08, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0x33ff22, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y = (this.game.terrainGenerator?.getHeightAt(pos.x, pos.z) ?? 0.5) + 0.05;
    this.game.scene.scene.add(mesh);
    this._acidPuddles.push({ mesh, life: 6.0, damage: 4 });
  }

  _updateAcidPuddles(dt) {
    const player = this.game.player;
    for (let i = this._acidPuddles.length - 1; i >= 0; i--) {
      const p = this._acidPuddles[i];
      p.life -= dt;
      p.mesh.material.opacity = 0.55 * (p.life / 6.0);

      if (player) {
        const dx = p.mesh.position.x - player.getPosition().x;
        const dz = p.mesh.position.z - player.getPosition().z;
        if (dx*dx + dz*dz < 0.7*0.7) {
          player.takeDamage(p.damage * dt);
          player._deathCause = 'Acid Puddle';
        }
      }

      if (p.life <= 0) {
        this.game.scene.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this._acidPuddles.splice(i, 1);
      }
    }
  }

  die() {
    // Clean up projectiles and puddles on death
    this._projectiles.forEach(p => {
      this.game.scene.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this._projectiles = [];
    // Puddles were leaking: once the Spitter is removed its update() never runs
    // again, so _updateAcidPuddles never disposes them.
    if (this._acidPuddles) {
      this._acidPuddles.forEach(p => {
        this.game.scene.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
      this._acidPuddles = [];
    }
    super.die();
  }
}
