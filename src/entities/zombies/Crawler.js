import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Crawler extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'crawler',
      health: 25,
      damage: 12,
      speed: 4,
      attackRange: 1.5,
      aggroRange: 30,
      attackCooldown: 1.2
    });
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      legless: true,
      armPose: 'none',
      hunch: 0,
      gore: 4
    });
    this._root = refs.root;

    // Prone pose: pitch the whole body chest-down (model faces +z, so positive
    // rotation.x tips it forward onto its front) and drop it to the ground.
    refs.root.rotation.x = 1.35;
    refs.root.position.y = -0.72;

    // Crane the head back up so the face looks ahead instead of into the dirt
    refs.headGroup.rotation.x = -1.15;

    // Arms reach forward/outward, clawing at the ground. baseRotX matches the
    // pose so the base walk swing animates a dragging claw motion.
    for (const [arm, side] of [[refs.armL, -1], [refs.armR, 1]]) {
      arm.shoulder.rotation.x = -2.3;
      arm.shoulder.rotation.z = side * 0.5;
      arm.shoulder.userData.baseRotX = arm.shoulder.rotation.x;
      arm.elbow.rotation.x = -0.35;
    }

    // Torn stump where the legs were: exposed spine nub + ragged gore
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.2, 8), refs.goreMat);
    stump.position.set(0, -0.16, -0.02);
    stump.rotation.x = 0.25;
    stump.castShadow = true;
    stump.receiveShadow = true;
    refs.root.add(stump);
    for (let i = 0; i < 5; i++) {
      const glob = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.03, 6, 5), refs.goreMat);
      glob.position.set(
        (Math.random() - 0.5) * 0.2,
        -0.08 - Math.random() * 0.1,
        (Math.random() - 0.5) * 0.16
      );
      glob.castShadow = false;
      refs.root.add(glob);
    }

    this.finalizeMesh(group);

    // Prone body: head sits low, health bar hugs the ground
    this.headshotY = -0.1;
    this._healthBarHeight = 0.5;
  }

  // Shrink the visual body while keeping it resting on the ground plane
  // (local y = -0.9). Used by Splitter for its mini spawns.
  setMeshScale(s) {
    const root = this._root;
    if (!root) return;
    root.scale.multiplyScalar(s);
    root.position.y = -0.9 + (root.position.y + 0.9) * s;
    this.headshotY = -0.9 + (this.headshotY + 0.9) * s;
    this._healthBarHeight = -0.9 + (this._healthBarHeight + 0.9) * s;
  }
}
