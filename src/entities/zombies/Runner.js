import { ZombieBase } from './ZombieBase.js';

export class Runner extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'runner',
      health: 20,
      damage: 12,
      speed: 5.5,
      attackRange: 2,
      aggroRange: 40,
      attackCooldown: 0.8
    });
  }
}
