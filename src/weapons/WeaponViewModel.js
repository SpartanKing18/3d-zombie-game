import * as THREE from 'three';

// First-person weapon viewmodel: a procedural gun/melee model parented to the
// camera, with idle sway, walk bob, and recoil kick. Renders on top of the world
// (depthTest off) so it never clips into walls. Purely cosmetic.
export class WeaponViewModel {
  constructor(camera, scene) {
    this.camera = camera;
    // The camera must be in the scene graph for its children to render.
    if (scene && camera.parent !== scene) scene.add(camera);

    this.root = new THREE.Group();
    this.root.position.set(0.24, -0.22, -0.55); // bottom-right of view
    this.camera.add(this.root);

    this.model = null;
    this.currentKey = null;
    this._t = 0;
    this._recoil = 0;          // 0..1 recoil amount, decays
    this._muzzle = null;
    this._muzzleTimer = 0;
    this._bob = 0;

    this._mkMat = (color, metalness = 0.65, roughness = 0.42) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness, depthTest: false, depthWrite: false });
  }

  _box(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.renderOrder = 999;
    m.castShadow = false; m.receiveShadow = false;
    return m;
  }

  _cyl(r1, r2, h, mat, x = 0, y = 0, z = 0, rotX = Math.PI / 2) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 10), mat);
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    m.renderOrder = 999;
    return m;
  }

  // Classify a weapon into a viewmodel category. Guns leave weapon.type undefined
  // and melee sets it to the sub-type (knife/bat/…); melee reliably has magSize -1.
  _category(weapon) {
    const nm = (weapon.name || '').toLowerCase();
    const meleeNames = /knife|bat|machete|axe|crowbar|pipe|cleaver|katana|hatchet|sledge|club|baton|bow|slingshot|poker|nail|golf|shovel|wrench/;
    if (weapon.magSize === -1 || meleeNames.test(nm) || meleeNames.test(weapon.type || '')) return 'melee';
    if (/revolver/.test(nm)) return 'revolver';
    if (/sawed|shotgun/.test(nm)) return 'shotgun';
    if (/sniper|bolt|marksman/.test(nm)) return 'sniper';
    if (/smg|uzi|mac|submachine|mp\d/.test(nm)) return 'smg';
    if (/pistol|flare|glock|deagle|handgun/.test(nm)) return 'pistol';
    return 'rifle';
  }

  // (Re)build the model for the given weapon.
  setWeapon(weapon) {
    const cat = weapon ? this._category(weapon) : null;
    const key = weapon ? (cat + ':' + (weapon.name || '')) : null;
    if (key === this.currentKey) return;
    this.currentKey = key;
    this._cat = cat;

    if (this.model) { this.root.remove(this.model); this._disposeModel(this.model); this.model = null; this._muzzle = null; }
    if (!weapon) return;

    const g = new THREE.Group();
    const metal = this._mkMat(0x3a4048, 0.7, 0.4);
    const dark  = this._mkMat(0x1b1e23, 0.5, 0.5);
    const grip  = this._mkMat(0x24262b, 0.2, 0.8);
    const wood  = this._mkMat(0x6a4a30, 0.1, 0.85);

    const nm = (weapon.name || '').toLowerCase();
    let muzzleZ = -0.5;

    if (cat === 'melee') {
      const isBlade = /knife|machete|cleaver|katana|sword|hatchet|axe/.test(nm);
      g.add(this._box(0.035, 0.1, 0.14, grip, 0, -0.02, 0.02)); // handle
      if (isBlade) g.add(this._box(0.015, 0.05, 0.34, this._mkMat(0xcfd6dd, 0.9, 0.2), 0, 0.02, -0.22));
      else g.add(this._cyl(0.03, 0.045, 0.42, wood, 0, 0.02, -0.2)); // bat/club
      this.root.position.set(0.19, -0.19, -0.46);
    } else if (cat === 'pistol' || cat === 'revolver') {
      g.add(this._box(0.055, 0.1, 0.05, grip, 0, -0.07, 0.04)); // grip
      g.add(this._box(0.06, 0.06, 0.2, metal, 0, 0.0, -0.05)); // slide
      g.add(this._cyl(0.016, 0.016, 0.1, dark, 0, 0.01, -0.16)); // barrel
      muzzleZ = -0.21;
      this.root.position.set(0.17, -0.16, -0.4);
    } else if (cat === 'shotgun') {
      g.add(this._box(0.05, 0.1, 0.14, wood, 0, -0.04, 0.14)); // stock
      g.add(this._box(0.06, 0.07, 0.42, metal, 0, 0, -0.06)); // body
      g.add(this._cyl(0.017, 0.017, 0.44, dark, 0.016, 0.005, -0.14)); // barrel 1
      g.add(this._cyl(0.017, 0.017, 0.44, dark, -0.016, 0.005, -0.14)); // barrel 2
      g.add(this._box(0.05, 0.035, 0.12, grip, 0, -0.05, -0.12)); // pump
      muzzleZ = -0.38;
      this.root.position.set(0.19, -0.18, -0.48);
    } else if (cat === 'sniper') {
      g.add(this._box(0.05, 0.1, 0.18, wood, 0, -0.04, 0.18)); // stock
      g.add(this._box(0.06, 0.07, 0.5, metal, 0, 0, 0)); // body
      g.add(this._cyl(0.014, 0.014, 0.46, dark, 0, 0.01, -0.3)); // long barrel
      g.add(this._cyl(0.026, 0.026, 0.16, dark, 0, 0.08, -0.02)); // scope
      muzzleZ = -0.52;
      this.root.position.set(0.17, -0.17, -0.52);
    } else {
      const smg = cat === 'smg';
      const len = smg ? 0.3 : 0.42;
      g.add(this._box(0.05, 0.1, 0.14, grip, 0, -0.06, 0.11)); // grip/stock
      g.add(this._box(0.06, 0.08, len, metal, 0, 0, -0.07)); // receiver
      g.add(this._cyl(0.014, 0.014, smg ? 0.14 : 0.26, dark, 0, 0.01, -0.07 - len / 2)); // barrel
      g.add(this._box(0.04, 0.1, 0.05, dark, 0, -0.09, -0.1)); // magazine
      g.add(this._box(0.018, 0.026, 0.07, dark, 0, 0.055, -0.02)); // sight
      muzzleZ = -0.07 - len / 2 - (smg ? 0.08 : 0.14);
      this.root.position.set(0.19, -0.18, smg ? -0.44 : -0.48);
    }
    this.root.scale.setScalar(0.85);

    // Muzzle flash (hidden until fired)
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffdd66, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const flash = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), flashMat);
    flash.rotation.x = -Math.PI / 2;
    flash.position.set(0, 0.01, muzzleZ);
    flash.renderOrder = 1000;
    flash.visible = false;
    g.add(flash);
    this._muzzle = flash;
    this._muzzleZ = muzzleZ;

    g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
    this.model = g;
    this.root.add(g);
  }

  triggerRecoil(amount = 0.1) {
    this._recoil = Math.min(1, this._recoil + 0.5 + amount * 2);
    if (this._muzzle && this._cat !== 'melee') {
      this._muzzleTimer = 0.05;
    }
  }

  update(dt, player, weapon) {
    this.setWeapon(weapon);
    if (!this.model) return;
    this._t += dt;

    // Walk bob: scale with horizontal speed
    const vx = player?.body?.velocity?.x ?? 0;
    const vz = player?.body?.velocity?.z ?? 0;
    const speed = Math.min(1, Math.hypot(vx, vz) / 6);
    this._bob += dt * (6 + speed * 8);
    const bobY = Math.sin(this._bob * 2) * 0.006 * speed;
    const bobX = Math.cos(this._bob) * 0.006 * speed;

    // Idle sway (breathing)
    const swayY = Math.sin(this._t * 1.3) * 0.004;
    const swayX = Math.cos(this._t * 0.9) * 0.004;

    // Recoil kick: push back (+Z) and tilt up, decay via spring
    this._recoil = Math.max(0, this._recoil - dt * 6);
    const rk = this._recoil * this._recoil;

    this.model.position.set(bobX + swayX, bobY + swayY, rk * 0.06);
    this.model.rotation.set(-rk * 0.35, swayX * 0.5, 0);

    // Muzzle flash decay + random flicker
    if (this._muzzleTimer > 0) {
      this._muzzleTimer -= dt;
      if (this._muzzle) {
        this._muzzle.visible = true;
        this._muzzle.material.opacity = Math.max(0, this._muzzleTimer / 0.05) * (0.7 + Math.random() * 0.3);
        this._muzzle.rotation.z = Math.random() * Math.PI;
        const s = 0.8 + Math.random() * 0.6;
        this._muzzle.scale.set(s, s, s);
      }
    } else if (this._muzzle && this._muzzle.visible) {
      this._muzzle.visible = false;
    }
  }

  _disposeModel(g) {
    g.traverse(o => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m?.dispose?.());
      }
    });
  }
}
