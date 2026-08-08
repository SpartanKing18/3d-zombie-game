import { WeaponBase } from './WeaponBase.js';

const MELEE_DEFS = {
  knife:         { name: 'Knife',          damage: 30, fireRate: 0.45, range: 4 },
  kitchen_knife: { name: 'Kitchen Knife',  damage: 22, fireRate: 0.40, range: 4 },
  bat:           { name: 'Baseball Bat',   damage: 28, fireRate: 0.70, range: 5 },
  crowbar:       { name: 'Crowbar',        damage: 30, fireRate: 0.75, range: 5 },
  machete:       { name: 'Machete',        damage: 40, fireRate: 0.55, range: 5 },
  axe:           { name: 'Axe',            damage: 55, fireRate: 1.00, range: 5 },
  fire_poker:    { name: 'Fire Poker',     damage: 20, fireRate: 0.60, range: 5 },
  pipe:          { name: 'Pipe',           damage: 20, fireRate: 0.65, range: 5 },
  crossbow:      { name: 'Crossbow',       damage: 45, fireRate: 1.20, range: 6 },
  golf_club:     { name: 'Golf Club',      damage: 25, fireRate: 0.70, range: 6 },
  sledgehammer:  { name: 'Sledgehammer',   damage: 65, fireRate: 1.50, range: 5 },
  meat_cleaver:  { name: 'Meat Cleaver',   damage: 38, fireRate: 0.55, range: 4 },
  nail_bat:      { name: 'Nail Bat',       damage: 35, fireRate: 0.70, range: 5 },
  slingshot:     { name: 'Slingshot',      damage: 12, fireRate: 0.60, range: 8 },
  electric_baton:{ name: 'Electric Baton', damage: 30, fireRate: 0.60, range: 5 },
  stun_baton:    { name: 'Stun Baton',     damage: 25, fireRate: 0.55, range: 5 },
  compound_bow:  { name: 'Compound Bow',   damage: 60, fireRate: 1.00, range: 8 },
};

export class Melee extends WeaponBase {
  constructor(type = 'knife') {
    const def = MELEE_DEFS[type] ?? MELEE_DEFS.knife;
    super(def.name, {
      fireMode: 'semi',
      fireRate: def.fireRate,
      damage: def.damage,
      spread: 0,
      recoil: 0,
      magSize: -1,
      reserveAmmo: -1,
      reloadTime: 0,
      range: def.range ?? 5,
      pellets: 1,
    });
    this.type = type;
    this.critChance = 0.15;
  }

  _rollCrit() {
    if (Math.random() < this.critChance) return 2.0;
    return 1.0;
  }

  reload() { return false; }
  canReload() { return false; }
}
