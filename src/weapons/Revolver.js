import { WeaponBase } from './WeaponBase.js';

export class Revolver extends WeaponBase {
  constructor() {
    super('Revolver', {
      fireMode: 'semi',
      fireRate: 0.28,
      damage: 48,
      spread: 0.004,
      recoil: 0.35,
      magSize: 6,
      reserveAmmo: 60,
      reloadTime: 3.5,
      range: 600,
      pellets: 1
    });
  }
}
