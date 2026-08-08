import { WeaponBase } from './WeaponBase.js';

export class Shotgun extends WeaponBase {
  constructor() {
    super('Shotgun', {
      fireMode: 'pump',
      fireRate: 1.5,
      damage: 25,
      spread: 0.15,
      recoil: 0.5,
      magSize: 8,
      reserveAmmo: 100,
      reloadTime: 3,
      range: 200,
      pellets: 8
    });
  }
}
