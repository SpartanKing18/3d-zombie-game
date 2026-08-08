import { Sedan } from './vehicles/Sedan.js';
import { Pickup } from './vehicles/Pickup.js';
import { Motorcycle } from './vehicles/Motorcycle.js';
import { MilitaryJeep } from './vehicles/MilitaryJeep.js';
import { Bus } from './vehicles/Bus.js';

export class VehicleManager {
  constructor(game) {
    this.game = game;
    this.vehicles = [];
    this.currentVehicle = null;
  }

  spawn(type, x, z) {
    let vehicle = null;

    switch (type.toLowerCase()) {
      case 'sedan':
        vehicle = new Sedan(x, z, this.game);
        break;
      case 'pickup':
        vehicle = new Pickup(x, z, this.game);
        break;
      case 'motorcycle':
        vehicle = new Motorcycle(x, z, this.game);
        break;
      case 'military_jeep':
      case 'jeep':
        vehicle = new MilitaryJeep(x, z, this.game);
        break;
      case 'bus':
        vehicle = new Bus(x, z, this.game);
        break;
      default:
        vehicle = new Sedan(x, z, this.game);
    }

    if (vehicle) {
      this.vehicles.push(vehicle);
    }

    return vehicle;
  }

  getVehicles() {
    return this.vehicles;
  }

  getVehicleCount() {
    return this.vehicles.length;
  }

  getCurrentVehicle() {
    return this.currentVehicle;
  }

  enterVehicle(vehicle, player) {
    if (this.currentVehicle) {
      this.currentVehicle.exit();
    }
    vehicle.enter(player);
    this.currentVehicle = vehicle;
  }

  exitVehicle() {
    if (this.currentVehicle) {
      this.currentVehicle.exit();
      this.currentVehicle = null;
    }
  }

  update(deltaTime) {
    const aliveVehicles = [];

    for (let i = 0; i < this.vehicles.length; i++) {
      const vehicle = this.vehicles[i];
      if (vehicle.isAlive()) {
        vehicle.update(deltaTime);
        aliveVehicles.push(vehicle);
      } else {
        vehicle.explode();
      }
    }

    this.vehicles = aliveVehicles;

    if (this.currentVehicle && !this.currentVehicle.isAlive()) {
      this.currentVehicle = null;
    }
  }
}
