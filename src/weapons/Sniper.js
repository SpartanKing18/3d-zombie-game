import { WeaponBase } from './WeaponBase.js';

export class Sniper extends WeaponBase {
  constructor() {
    super('Sniper Rifle', {
      fireMode: 'bolt',
      fireRate: 2,
      damage: 75,
      spread: 0.002,
      recoil: 1,
      magSize: 5,
      reserveAmmo: 50,
      reloadTime: 3.5,
      range: 2000,
      pellets: 1
    });
  }
}
