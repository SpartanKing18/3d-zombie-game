import { VehicleBase } from './VehicleBase.js';

export class Sedan extends VehicleBase {
  constructor(x, z, game) {
    super(x, z, game, {
      name: 'Sedan',
      type: 'sedan',
      width: 1.8,
      length: 4.5,
      height: 1.6,
      mass: 1200,
      maxSpeed: 50,
      acceleration: 40,
      braking: 50,
      turnSpeed: 2.5,
      suspension: 0.3
    });
  }
}
