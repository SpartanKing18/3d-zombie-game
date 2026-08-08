import { VehicleBase } from './VehicleBase.js';

export class MilitaryJeep extends VehicleBase {
  constructor(x, z, game) {
    super(x, z, game, {
      name: 'Military Jeep',
      type: 'military_jeep',
      width: 1.9,
      length: 4.2,
      height: 1.7,
      mass: 1500,
      maxSpeed: 55,
      acceleration: 50,
      braking: 55,
      turnSpeed: 2.8,
      suspension: 0.5
    });
  }
}
