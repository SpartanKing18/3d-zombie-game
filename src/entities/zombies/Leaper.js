import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Leaper extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'leaper',
      health: 35,
      maxHealth: 35,
      damage: 18,
      speed: 3.0,
      attackRange: 2.2,
      aggroRange: 38,
      attackCooldown: 2.5
    });
    this._leapCooldown = 0;
    this._isLeaping = false;
    this._leapTimer = 0;
    this._leapDamageDealt = false;
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      bulk: 0.9,
      hunch: 0.85,
      armPose: 'none',
      skinColor: 0x7d8468,
      shirtless: true,
      gore: 4,
      bald: true
    });

    // Crouched predator: drop the whole body so the deeply bent legs stay planted
    refs.root.position.y -= 0.28;

    // Legs: hips rotated far forward, knees folded under
    for (const leg of [refs.legL, refs.legR]) {
      leg.rotation.x = -0.9;
      leg.userData.baseRotX = -0.9;
      const knee = leg.children.find(c => !c.isMesh); // knee pivot group inside the hip
      if (knee) knee.rotation.x = 1.35;
    }

    // Long arms reaching down/forward, fingers splayed into claws
    for (const arm of [refs.armL, refs.armR]) {
      arm.shoulder.rotation.x = -0.7;
      arm.shoulder.userData.baseRotX = -0.7;
      arm.elbow.rotation.x = -0.25;
      for (let f = -1; f <= 1; f++) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.08, 0.014), refs.skinMat);
        finger.position.set(f * 0.024, -0.35, 0.02);
        finger.rotation.z = f * 0.4;
        finger.rotation.x = 0.35;
        finger.castShadow = true;
        arm.elbow.add(finger);
      }
    }

    // Head tilted up so the crouched hunter still faces its prey
    refs.headGroup.rotation.x = -0.35;

    // Bony spine ridge along the hunched back
    const boneMat = new THREE.MeshStandardMaterial({ color: 0x8a8f6a, roughness: 0.75 });
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 5), boneMat);
      spike.position.set(0, 0.12 + i * 0.11, -0.13);
      spike.rotation.x = -0.6;
      spike.castShadow = true;
      refs.torsoGroup.add(spike);
    }

    // Crouched body is much lower than a standing humanoid
    this._healthBarHeight = 1.1;
    this.headshotY = 0.35;

    this.finalizeMesh(group);
  }

  _triggerLeap(player) {
    this._isLeaping = true;
    this._leapTimer = 1.2;
    this._leapDamageDealt = false;
    this._leapCooldown = 8.0;

    const dx = player.getPosition().x - this.position.x;
    const dz = player.getPosition().z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    // Launch body at player
    if (this.body) {
      this.body.velocity.x = (dx / dist) * 12;
      this.body.velocity.z = (dz / dist) * 12;
      this.body.velocity.y = 8;
    }

    // Arms spread wide during leap (baseRotX so the walk swing centers on the pose)
    if (this._leftArm)  { this._leftArm.rotation.z = -0.9;  this._leftArm.userData.baseRotX = -0.6;  this._leftArm.rotation.x = -0.6; }
    if (this._rightArm) { this._rightArm.rotation.z = 0.9;  this._rightArm.userData.baseRotX = -0.6; this._rightArm.rotation.x = -0.6; }

    // Screech
    this.game.audioManager?.playZombieGroan?.();
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Decrement leap cooldown
    if (this._leapCooldown > 0) this._leapCooldown -= deltaTime;

    if (this._isLeaping) {
      this._leapTimer -= deltaTime;

      // Check for impact damage on player during leap
      if (!this._leapDamageDealt) {
        const player = this.game.player;
        if (player) {
          const d = this.position.distanceTo(player.getPosition());
          if (d < 2.0) {
            this._leapDamageDealt = true;
            // Bonus damage on landing
            const bonusDmg = this.damage + 10;
            if (player.health - bonusDmg <= 0 && player.setDeathCause) {
              player.setDeathCause('Pounced on by a Leaper');
            }
            if (!player.godMode) player.takeDamage(bonusDmg);
            // Knock player down hard
            if (player.body) {
              const dx = player.getPosition().x - this.position.x;
              const dz = player.getPosition().z - this.position.z;
              const dist = Math.sqrt(dx * dx + dz * dz) || 1;
              player.body.velocity.x += (dx / dist) * 8;
              player.body.velocity.z += (dz / dist) * 8;
              player.body.velocity.y = Math.max(player.body.velocity.y, 5);
            }
            // Blood splatter
            if (this.game.particleSystem?.createBlood) {
              this.game.particleSystem.createBlood(this.position.clone(), 12);
            }
          }
        }
      }

      if (this._leapTimer <= 0) {
        this._isLeaping = false;
        // Reset arm positions to crouched reach pose
        if (this._leftArm)  { this._leftArm.rotation.z = 0;  this._leftArm.userData.baseRotX = -0.7;  this._leftArm.rotation.x = -0.7; }
        if (this._rightArm) { this._rightArm.rotation.z = 0; this._rightArm.userData.baseRotX = -0.7; this._rightArm.rotation.x = -0.7; }
      }
    } else {
      // Check leap conditions: chasing, player 5-15m away, cooldown ready
      if (this.state === 'chasing' && this._leapCooldown <= 0) {
        const player = this.game.player;
        if (player) {
          const d = this.position.distanceTo(player.getPosition());
          if (d >= 5 && d <= 15) {
            this._triggerLeap(player);
          }
        }
      }
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    wi.spawnItem('mat_spring', px, py, pz, 1);
    if (Math.random() < 0.3) wi.spawnItem('bandage', px + 0.3, py, pz, 1);
  }
}
