import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Tank extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'tank',
      health: 100,
      damage: 20,
      speed: 1.5,
      attackRange: 2.5,
      aggroRange: 35,
      attackCooldown: 2
    });
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      scale: 1.25,
      bulk: 1.55,
      shirtless: true,
      gore: 6,
      skinColor: 0x6f7a5f,
      bald: true,
      hunch: 0.25
    });

    // Broad trapezius hump — flattened sphere behind the neck
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), refs.skinMat);
    hump.position.set(0, 0.5, -0.1);
    hump.scale.set(1.7, 0.75, 1.05);
    hump.castShadow = true;
    hump.receiveShadow = true;
    refs.torsoGroup.add(hump);

    this.finalizeMesh(group);
  }
}
