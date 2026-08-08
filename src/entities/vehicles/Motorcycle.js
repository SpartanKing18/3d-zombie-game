import { VehicleBase } from './VehicleBase.js';

export class Motorcycle extends VehicleBase {
  constructor(x, z, game) {
    super(x, z, game, {
      name: 'Motorcycle',
      type: 'motorcycle',
      width: 0.8,
      length: 2.0,
      height: 1.2,
      mass: 300,
      maxSpeed: 70,
      acceleration: 60,
      braking: 70,
      turnSpeed: 3.5,
      suspension: 0.2
    });
  }
}
