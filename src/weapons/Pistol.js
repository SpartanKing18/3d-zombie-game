import { WeaponBase } from './WeaponBase.js';

export class Pistol extends WeaponBase {
  constructor() {
    super('Pistol', {
      fireMode: 'semi',
      fireRate: 0.1,
      damage: 12,
      spread: 0.008,
      recoil: 0.15,
      magSize: 17,
      reserveAmmo: 200,
      reloadTime: 2,
      range: 500,
      pellets: 1
    });
  }
}
