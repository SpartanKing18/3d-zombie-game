import { Pistol } from './Pistol.js';
import { Shotgun } from './Shotgun.js';
import { Rifle } from './Rifle.js';
import { SMG } from './SMG.js';
import { Sniper } from './Sniper.js';
import { Melee } from './Melee.js';
import { Revolver } from './Revolver.js';
import { SawedOffShotgun } from './SawedOffShotgun.js';

export class WeaponManager {
  constructor(game) {
    this.game = game;
    this.weapons = [];
    this.currentWeaponIndex = 0;
    this.setupStartingWeapons();
  }

  setupStartingWeapons() {
    this.weapons.push(new Melee('knife'));
    this.currentWeaponIndex = 0;
  }

  addWeapon(weaponClass) {
    const existingIndex = this.weapons.findIndex(w => w.name === weaponClass.name);
    if (existingIndex > -1) {
      this.weapons[existingIndex].addAmmo(weaponClass.reserveAmmo);
    } else {
      this.weapons.push(weaponClass);
    }
  }

  getCurrentWeapon() {
    return this.weapons[this.currentWeaponIndex] || null;
  }

  switchWeapon(index) {
    if (index >= 0 && index < this.weapons.length) {
      this.currentWeaponIndex = index;
      return true;
    }
    return false;
  }

  switchToNextWeapon() {
    this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
  }

  switchToPreviousWeapon() {
    this.currentWeaponIndex = (this.currentWeaponIndex - 1 + this.weapons.length) % this.weapons.length;
  }

  fireCurrentWeapon(position, direction) {
    const weapon = this.getCurrentWeapon();
    if (weapon) {
      return weapon.fire(position, direction, this.game);
    }
    return false;
  }

  reloadCurrentWeapon() {
    const weapon = this.getCurrentWeapon();
    if (weapon) {
      return weapon.reload(this.game);
    }
    return false;
  }

  update(deltaTime) {
    this.weapons.forEach(weapon => weapon.update(deltaTime));
    this.updateAmmoDisplay();
    this.updateWeaponHUD();

    // Auto-reload when magazine is empty (skip melee)
    const weapon = this.getCurrentWeapon();
    if (weapon && weapon.magSize > 0 && weapon.ammoInMag === 0 && !weapon.isReloading && weapon.reserveAmmo > 0) {
      weapon.reload(this.game);
    }
  }

  updateAmmoDisplay() {
    const weapon = this.getCurrentWeapon();
    if (!this._ammoDisplayEl)    this._ammoDisplayEl    = document.getElementById('ammo-display');
    if (!this._ammoCounterEl)    this._ammoCounterEl    = document.getElementById('ammo-counter');
    if (!this._weaponNameEl)     this._weaponNameEl     = document.getElementById('weapon-name-display');
    if (!this._reloadContEl)     this._reloadContEl     = document.getElementById('reload-bar-container');
    if (!this._reloadBarEl)      this._reloadBarEl      = document.getElementById('reload-bar');
    const ammoDisplay      = this._ammoDisplayEl;
    const ammoCounter      = this._ammoCounterEl;
    const weaponNameEl     = this._weaponNameEl;
    const reloadContainer  = this._reloadContEl;
    const reloadBar        = this._reloadBarEl;

    if (!ammoDisplay || !weapon) return;

    if (weaponNameEl) weaponNameEl.textContent = weapon.name;

    const isMelee = weapon.magSize <= 0;

    if (isMelee) {
      ammoDisplay.classList.remove('active');
      ammoDisplay.style.opacity = '0';
      if (reloadContainer) reloadContainer.style.display = 'none';
    } else {
      const magAmmo = weapon.ammoInMag || 0;
      const reserveAmmo = weapon.reserveAmmo || 0;
      if (ammoCounter) {
        ammoCounter.textContent = `${magAmmo} / ${reserveAmmo}`;
        const magSize = weapon.magSize || 1;
        const magPct  = magAmmo / magSize;
        ammoCounter.classList.toggle('low-ammo',      magPct <= 0.30 && magPct > 0.10);
        ammoCounter.classList.toggle('critical-ammo', magPct <= 0.10);
      }
      ammoDisplay.classList.add('active');
      ammoDisplay.style.opacity = '1';

      if (reloadContainer && reloadBar) {
        if (weapon.isReloading) {
          reloadContainer.style.display = 'block';
          reloadBar.style.width = `${(weapon.reloadProgress || 0) * 100}%`;
        } else {
          reloadContainer.style.display = 'none';
        }
      }
    }
  }

  // Feed reserve ammo to the matching weapon(s) when ammo is picked up
  feedAmmoFromPickup(ammoItemType, qty) {
    const ammoMap = {
      ammo_9mm:          ['Pistol', 'SMG'],
      ammo_45acp:        ['Pistol', 'Revolver'],
      ammo_357:          ['Revolver'],
      ammo_556:          ['Assault Rifle'],
      ammo_762:          ['Assault Rifle'],
      ammo_308:          ['Sniper Rifle'],
      ammo_50cal:        ['Sniper Rifle'],
      ammo_12gauge_buck: ['Shotgun', 'Sawed-Off'],
      ammo_12gauge_slug: ['Shotgun', 'Sawed-Off'],
      ammo_pistol:       ['Pistol'],
      ammo_rifle:        ['Assault Rifle'],
    };
    const targets = ammoMap[ammoItemType];
    if (!targets) return false;
    let fed = false;
    for (const weapon of this.weapons) {
      if (targets.includes(weapon.name)) {
        weapon.addAmmo(qty);
        fed = true;
      }
    }
    return fed;
  }

  // Grant the matching weapon when a weapon world-item is picked up
  grantWeaponFromPickup(itemType) {
    const map = {
      weapon_pistol_found:  () => new Pistol(),
      weapon_rifle_found:   () => new Rifle(),
      weapon_shotgun_found: () => new Shotgun(),
      weapon_smg_found:     () => new SMG(),
      weapon_sniper_found:  () => new Sniper(),
      weapon_baseball_bat:  () => new Melee('bat'),
      weapon_crowbar:       () => new Melee('crowbar'),
      weapon_machete:       () => new Melee('machete'),
      weapon_axe:           () => new Melee('axe'),
      weapon_kitchen_knife: () => new Melee('kitchen_knife'),
      weapon_fire_poker:    () => new Melee('fire_poker'),
      weapon_pipe:          () => new Melee('pipe'),
      weapon_crossbow:      () => new Melee('crossbow'),
      weapon_golf_club:       () => new Melee('golf_club'),
      weapon_sledgehammer:    () => new Melee('sledgehammer'),
      weapon_meat_cleaver:    () => new Melee('meat_cleaver'),
      weapon_flare_gun:       () => new Pistol(),
      weapon_nail_bat:        () => new Melee('nail_bat'),
      weapon_slingshot:       () => new Melee('slingshot'),
      weapon_electric_baton:  () => new Melee('electric_baton'),
      weapon_compound_bow:    () => new Melee('compound_bow'),
      elec_stun_baton:        () => new Melee('stun_baton'),
      weapon_revolver:        () => new Revolver(),
      weapon_sawed_off:       () => new SawedOffShotgun(),
    };
    const factory = map[itemType];
    if (!factory) return false;
    this.addWeapon(factory());
    // Notify player
    if (!this._notifEl) this._notifEl = document.getElementById('loot-notification');
    const notif = this._notifEl;
    if (notif) {
      const names = {
        weapon_pistol_found:'🔫 Pistol equipped!', weapon_rifle_found:'🔫 Rifle equipped!',
        weapon_shotgun_found:'🔫 Shotgun equipped!', weapon_smg_found:'🔫 SMG equipped!',
        weapon_sniper_found:'🔫 Sniper equipped!', weapon_baseball_bat:'🏏 Baseball Bat equipped!',
        weapon_crowbar:'🔧 Crowbar equipped!', weapon_machete:'⚔️ Machete equipped!',
        weapon_axe:'🪓 Axe equipped!', weapon_kitchen_knife:'🔪 Knife equipped!',
        weapon_fire_poker:'🔥 Fire Poker equipped!', weapon_pipe:'⚫ Pipe equipped!',
        weapon_crossbow:'🏹 Crossbow equipped!', weapon_golf_club:'⛳ Golf Club equipped!',
        weapon_sledgehammer:'🔨 Sledgehammer equipped!', weapon_meat_cleaver:'🔪 Cleaver equipped!',
        weapon_flare_gun:'🚨 Flare Gun equipped!', weapon_nail_bat:'🏏 Spiked Bat equipped!',
        weapon_slingshot:'🪃 Slingshot equipped!', weapon_electric_baton:'⚡ Electric Baton equipped!',
        weapon_compound_bow:'🏹 Compound Bow equipped!', elec_stun_baton:'⚡ Stun Baton equipped!',
        weapon_revolver:'🔫 Revolver equipped!', weapon_sawed_off:'🔫 Sawed-Off equipped!',
      };
      notif.textContent = names[itemType] ?? '⚔️ Weapon equipped!';
      notif.style.color = '#4499ff';
      notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
    }
    // Pulse the weapon name display
    if (!this._weaponNameEl) this._weaponNameEl = document.getElementById('weapon-name-display');
    if (this._weaponNameEl) {
      this._weaponNameEl.classList.remove('equip-flash');
      void this._weaponNameEl.offsetWidth;
      this._weaponNameEl.classList.add('equip-flash');
      setTimeout(() => this._weaponNameEl?.classList.remove('equip-flash'), 650);
    }
    return true;
  }

  updateWeaponHUD() {
    if (!this._weaponHudEl) this._weaponHudEl = document.getElementById('weapon-hud');
    const container = this._weaponHudEl;
    if (!container) return;

    // Throttle full rebuild to ~10 Hz so ammo counters stay fresh without DOM spam
    const now = performance.now();
    if (this._hudLastRebuild && now - this._hudLastRebuild < 100) return;
    this._hudLastRebuild = now;

    container.innerHTML = '';
    // The weapon HUD is the 9-slot hotbar: weapons fill from slot 1, the rest
    // render as empty hotbar slots so it always reads as a full bar.
    const SLOTS = 9;
    for (let i = 0; i < SLOTS; i++) {
      const w = this.weapons[i];
      const slot = document.createElement('div');
      slot.className = 'weapon-hud-slot'
        + (w && i === this.currentWeaponIndex ? ' active' : '')
        + (w ? '' : ' empty');

      const keyLabel = document.createElement('div');
      keyLabel.className = 'whs-key';
      keyLabel.textContent = i + 1;
      slot.appendChild(keyLabel);

      if (w) {
        const isMelee = w.magSize <= 0;
        const icon = document.createElement('div');
        icon.textContent = isMelee ? '⚔️' : '🔫';
        slot.appendChild(icon);

        const name = document.createElement('div');
        name.className = 'whs-name';
        name.textContent = w.name;
        slot.appendChild(name);

        if (!isMelee) {
          const ammoEl = document.createElement('div');
          ammoEl.className = 'whs-ammo';
          ammoEl.textContent = `${w.ammoInMag}/${w.reserveAmmo}`;
          slot.appendChild(ammoEl);
        }
        slot.addEventListener('click', () => this.switchWeapon(i));
      }

      container.appendChild(slot);
    }
  }

  getWeapons() {
    return this.weapons;
  }

  getWeaponCount() {
    return this.weapons.length;
  }
}
