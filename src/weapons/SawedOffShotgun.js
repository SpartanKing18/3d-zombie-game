import { WeaponBase } from './WeaponBase.js';

export class SawedOffShotgun extends WeaponBase {
  constructor() {
    super('Sawed-Off', {
      fireMode: 'semi',
      fireRate: 0.9,
      damage: 55,
      spread: 0.14,
      recoil: 0.8,
      magSize: 2,
      reserveAmmo: 24,
      reloadTime: 2.8,
      range: 10,
      pellets: 8
    });
  }
}
