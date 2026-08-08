import { WeaponBase } from './WeaponBase.js';

export class Rifle extends WeaponBase {
  constructor() {
    super('Assault Rifle', {
      fireMode: 'full',
      fireRate: 0.08,
      damage: 18,
      spread: 0.012,
      recoil: 0.25,
      magSize: 30,
      reserveAmmo: 300,
      reloadTime: 2.5,
      range: 800,
      pellets: 1
    });
  }
}
