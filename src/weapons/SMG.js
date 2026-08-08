import { WeaponBase } from './WeaponBase.js';

export class SMG extends WeaponBase {
  constructor() {
    super('SMG', {
      fireMode: 'full',
      fireRate: 0.05,
      damage: 8,
      spread: 0.02,
      recoil: 0.1,
      magSize: 35,
      reserveAmmo: 400,
      reloadTime: 2,
      range: 400,
      pellets: 1
    });
  }
}
