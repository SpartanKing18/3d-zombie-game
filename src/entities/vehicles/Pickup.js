import { VehicleBase } from './VehicleBase.js';

export class Pickup extends VehicleBase {
  constructor(x, z, game) {
    super(x, z, game, {
      name: 'Pickup Truck',
      type: 'pickup',
      width: 2.0,
      length: 5.0,
      height: 1.8,
      mass: 1800,
      maxSpeed: 40,
      acceleration: 35,
      braking: 40,
      turnSpeed: 2.2,
      suspension: 0.4
    });
  }
}
