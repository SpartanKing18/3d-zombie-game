import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Screamer extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'screamer',
      health: 35,
      damage: 10,
      speed: 3,
      attackRange: 2,
      aggroRange: 45,
      attackCooldown: 1
    });
    this.lastScreamTime = 0;
    this.screamCooldown = 5;
    this.screamRange = 50;
  }

  createMesh() {
    // Emaciated figure frozen mid-scream, tattered dress, hands clawing at its head
    const { group, refs } = this.buildHumanoid({
      bulk: 0.75,
      skinColor: 0xa0a090,
      shirtColor: 0x5a4a52,
      bald: false,
      armPose: 'none',
      hunch: 0.16,
      gore: 2
    });

    // Guaranteed long unkempt black hair: matted cap + strands down the back
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), hairMat);
    cap.scale.set(0.95, 0.8, 1.0);
    cap.position.set(0, 0.215, -0.02);
    cap.castShadow = true;
    cap.receiveShadow = true;
    refs.headGroup.add(cap);
    const longHair = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    longHair.scale.set(0.9, 2.6, 0.45);
    longHair.position.set(0, 0.0, -0.1);
    longHair.castShadow = true;
    longHair.receiveShadow = true;
    refs.headGroup.add(longHair);

    // Head thrown back, jaw wrenched wide open mid-scream
    refs.headGroup.rotation.x = -0.22;
    refs.jaw.scale.set(1.3, 1.3, 1.3);
    refs.jaw.rotation.x = 1.1;
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mouthMat);
    mouth.scale.set(1.1, 1.2, 0.8);
    mouth.position.set(0, 0.065, 0.055);
    mouth.castShadow = false;
    refs.headGroup.add(mouth);

    // Arms curled upward, hands clutching toward the head
    for (const [arm, side] of [[refs.armL, -1], [refs.armR, 1]]) {
      arm.shoulder.rotation.x = -2.35;
      arm.shoulder.rotation.z = side * 0.55;
      arm.elbow.rotation.x = -1.6;
      arm.shoulder.userData.baseRotX = arm.shoulder.rotation.x;
    }

    this.finalizeMesh(group);
  }

  update(deltaTime) {
    super.update(deltaTime);

    this.lastScreamTime += deltaTime;

    if (this.state === 'chasing' && this.lastScreamTime >= this.screamCooldown) {
      this.scream();
      this.lastScreamTime = 0;
    }
  }

  scream() {
    if (!this.game.zombieManager) return;

    this.game.audioManager?.playScream?.();

    // Visual scream ring
    this.game.particleSystem?.createScreamRing?.(this.position.clone());

    const allZombies = this.game.zombieManager.getZombies();
    allZombies.forEach(zombie => {
      const dist = this.position.distanceTo(zombie.getPosition());
      if (dist < this.screamRange && zombie !== this) {
        zombie.state = 'chasing';
        zombie.pathRecalcTimer = 0;
        // Brief speed boost to alerted zombies.
        // Guard with a flag so a second scream within the 4s window doesn't capture
        // the already-boosted speed as the "base" (which would make it permanent).
        if (!zombie._screamBoosted && zombie.speed < 6) {
          zombie._screamBaseSpeed = zombie.speed;
          zombie.speed *= 1.4;
          zombie._screamBoosted = true;
          setTimeout(() => {
            if (zombie._screamBaseSpeed !== undefined) zombie.speed = zombie._screamBaseSpeed;
            zombie._screamBoosted = false;
          }, 4000);
        }
      }
    });

    // Screen shake if player is close
    const player = this.game.player;
    if (player) {
      const d = this.position.distanceTo(player.getPosition());
      if (d < 20 && player._shakeTime !== undefined) {
        player._shakeTime = Math.min(0.5, (20 - d) / 20 * 0.5);
      }
    }
  }
}
