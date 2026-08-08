import { ZombieBase } from './ZombieBase.js';

export class Walker extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'walker',
      health: 30,
      damage: 8,
      speed: 2,
      attackRange: 2,
      aggroRange: 25,
      attackCooldown: 1.5
    });
  }
}
