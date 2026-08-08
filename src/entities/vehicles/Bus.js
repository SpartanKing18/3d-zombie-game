import { VehicleBase } from './VehicleBase.js';

export class Bus extends VehicleBase {
  constructor(x, z, game) {
    super(x, z, game, {
      name: 'Bus',
      type: 'bus',
      width: 2.5,
      length: 9.0,
      height: 2.5,
      mass: 8000,
      maxSpeed: 30,
      acceleration: 20,
      braking: 30,
      turnSpeed: 1.8,
      suspension: 0.6
    });
  }
}
