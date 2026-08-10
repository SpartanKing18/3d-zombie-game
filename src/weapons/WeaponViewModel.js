import * as THREE from 'three';

// First-person weapon viewmodel: a procedural gun/melee model parented to the
// camera, with idle sway, walk bob, and recoil kick. Renders on top of the world
// (depthTest off) so it never clips into walls. Purely cosmetic.
export class WeaponViewModel {
  constructor(camera, scene, game = null) {
    this.camera = camera;
    this.game = game;   // for the item model registry (real held-weapon models)
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
    this._swing = 0;           // melee swing timer
    this._adsT = 0;            // 0 hip .. 1 aimed
    this._aiming = false;
    this._sniperAim = false;
    this._hipPos = new THREE.Vector3();
    this._aimPos = new THREE.Vector3();

    // One reusable point light pulsed on each shot so gunfire actually lights
    // nearby zombies/walls at night (the billboard flash alone emits no light).
    this._muzzleLight = new THREE.PointLight(0xffaa55, 0, 12, 2.0);
    this._muzzleLight.castShadow = false;
    this._muzzleLight.visible = false;
    this.root.add(this._muzzleLight);

    // Slight emissive keeps the weapon readable even in dark scenes
    this._mkMat = (color, metalness = 0.6, roughness = 0.45) =>
      new THREE.MeshStandardMaterial({
        color, metalness, roughness, emissive: 0x0b0c0e, emissiveIntensity: 1,
        depthTest: false, depthWrite: false
      });
  }

  _box(w, h, d, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.renderOrder = 999;
    m.castShadow = false; m.receiveShadow = false;
    return m;
  }

  _cyl(r1, r2, h, mat, x = 0, y = 0, z = 0, rotX = Math.PI / 2) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 24), mat);
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
  // Which item model to hold for this weapon (melee blades only for now — the
  // procedural guns already read fine, and gun models need per-model muzzle work).
  _heldModelKey(cat, nm) {
    if (cat !== 'melee') return null;
    if (/machete/.test(nm))       return 'weapon_machete';
    if (/katana|sword/.test(nm))  return 'weapon_katana';
    if (/cleaver/.test(nm))       return 'weapon_meat_cleaver';
    if (/hatchet/.test(nm))       return 'weapon_hatchet';
    if (/axe/.test(nm))           return 'weapon_axe';
    if (/golf/.test(nm))          return 'weapon_golf_club';
    if (/sledge/.test(nm))        return 'weapon_sledgehammer';
    if (/knife/.test(nm))         return 'weapon_kitchen_knife';
    return null; // bats/clubs/pipes etc → procedural
  }

  // Fit a ground model into the hand: scale to a held length, lay it forward
  // (blade points -Z), centre it, and render it over the world (no depth clip).
  _addHeldModel(g, model) {
    const targetLen = 0.4;
    model.updateMatrixWorld(true);
    let bb = new THREE.Box3().setFromObject(model);
    const sz = new THREE.Vector3(); bb.getSize(sz);
    const longest = Math.max(sz.x, sz.y, sz.z) || 1;
    model.scale.multiplyScalar(targetLen / longest);
    // Ground models stand up (blade along +Y); rotate so the length points -Z.
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    bb = new THREE.Box3().setFromObject(model);
    const c = new THREE.Vector3(); bb.getCenter(c);
    model.position.sub(c);                 // centre in the hand
    model.traverse(o => {
      if (!o.isMesh) return;
      o.renderOrder = 999;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { m.depthTest = false; m.depthWrite = false; });
    });
    g.add(model);
  }

  setWeapon(weapon) {
    const cat = weapon ? this._category(weapon) : null;
    const key = weapon ? (cat + ':' + (weapon.name || '')) : null;
    if (key === this.currentKey) return;
    this.currentKey = key;
    this._cat = cat;

    if (this.model) { this.root.remove(this.model); this._disposeModel(this.model); this.model = null; this._muzzle = null; }
    if (!weapon) return;

    const g = new THREE.Group();
    const metal = this._mkMat(0x4b535d, 0.7, 0.38);
    const dark  = this._mkMat(0x24272d, 0.5, 0.5);
    const grip  = this._mkMat(0x2d3036, 0.2, 0.8);
    const wood  = this._mkMat(0x7a5738, 0.1, 0.85);

    const nm = (weapon.name || '').toLowerCase();
    let muzzleZ = -0.5;

    // Use the real weapon model in first person when we have one (melee blades),
    // so the held weapon isn't a procedural box. Falls back to procedural below.
    const heldKey = this._heldModelKey(cat, nm);
    const held = heldKey && this.game?.itemModelLoader?.createModel?.(heldKey);
    // If we wanted a model but the loader wasn't ready yet, remember to rebuild
    // once it is (update() invalidates currentKey so setWeapon re-runs).
    this._builtWithoutModel = !!(heldKey && !held && !this.game?.itemModelLoader?.ready);
    if (held) {
      this._addHeldModel(g, held);
      this.root.position.set(0.2, -0.2, -0.5);
    } else if (cat === 'melee') {
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
    // Remember the hip pose and derive an aim pose that pulls the gun toward centre
    this._hipPos.copy(this.root.position);
    this._aimPos.set(0.002, this._hipPos.y + 0.06, this._hipPos.z + 0.08);

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

  setADS(active, isSniper) {
    this._aiming = !!active;
    this._sniperAim = !!(active && isSniper);
  }

  triggerRecoil(amount = 0.1) {
    if (this._cat === 'melee') {
      this._swing = 0.28; // play a swing arc instead of recoil
      return;
    }
    this._recoil = Math.min(1, this._recoil + 0.5 + amount * 2);
    if (this._muzzle) this._muzzleTimer = 0.05;
  }

  update(dt, player, weapon) {
    // The current weapon was built before its model loaded — rebuild now it's ready.
    if (this._builtWithoutModel && this.game?.itemModelLoader?.ready) {
      this.currentKey = null;
      this._builtWithoutModel = false;
    }
    this.setWeapon(weapon);
    if (!this.model) return;
    this._t += dt;

    // Blend hip <-> aim pose
    const aimTarget = this._aiming ? 1 : 0;
    this._adsT += (aimTarget - this._adsT) * Math.min(1, dt * 14);
    this.root.position.lerpVectors(this._hipPos, this._aimPos, this._adsT);
    // Sniper hides its viewmodel while scoped (the scope overlay fills the screen)
    this.model.visible = !(this._sniperAim && this._adsT > 0.6);
    const steady = 1 - this._adsT * 0.8; // steadier hands while aiming

    // Walk bob: scale with horizontal speed
    const vx = player?.body?.velocity?.x ?? 0;
    const vz = player?.body?.velocity?.z ?? 0;
    const speed = Math.min(1, Math.hypot(vx, vz) / 6);
    this._bob += dt * (6 + speed * 8);
    const bobY = Math.sin(this._bob * 2) * 0.006 * speed * steady;
    const bobX = Math.cos(this._bob) * 0.006 * speed * steady;

    // Idle sway (breathing)
    const swayY = Math.sin(this._t * 1.3) * 0.004 * steady;
    const swayX = Math.cos(this._t * 0.9) * 0.004 * steady;

    // Recoil kick: push back (+Z) and tilt up, decay via spring
    this._recoil = Math.max(0, this._recoil - dt * 6);
    const rk = this._recoil * this._recoil;

    // Melee swing arc: quick down-and-across chop
    let swX = 0, swY = 0, swZ = 0, swRotX = 0, swRotZ = 0;
    if (this._swing > 0) {
      this._swing = Math.max(0, this._swing - dt);
      const p = 1 - this._swing / 0.28;         // 0..1 through the swing
      const arc = Math.sin(p * Math.PI);        // rise and fall
      swRotZ = -arc * 1.2;
      swRotX = arc * 0.7;
      swX = -arc * 0.12; swZ = -arc * 0.1;
    }

    this.model.position.set(bobX + swayX + swX, bobY + swayY + swY, rk * 0.06 + swZ);
    this.model.rotation.set(-rk * 0.35 + swRotX, swayX * 0.5, swRotZ);

    // Muzzle flash decay + random flicker
    if (this._muzzleTimer > 0) {
      this._muzzleTimer -= dt;
      const frac = Math.max(0, this._muzzleTimer / 0.05);
      if (this._muzzle) {
        this._muzzle.visible = true;
        this._muzzle.material.opacity = frac * (0.7 + Math.random() * 0.3);
        this._muzzle.rotation.z = Math.random() * Math.PI;
        const s = 0.8 + Math.random() * 0.6;
        this._muzzle.scale.set(s, s, s);
      }
      if (this._muzzleLight) {
        this._muzzleLight.visible = true;
        this._muzzleLight.position.set(0.1, 0.01, (this._muzzleZ ?? -0.3) - 0.15);
        this._muzzleLight.intensity = frac * 5.5 * (0.7 + Math.random() * 0.4);
      }
    } else {
      if (this._muzzle && this._muzzle.visible) this._muzzle.visible = false;
      if (this._muzzleLight && this._muzzleLight.visible) {
        this._muzzleLight.visible = false;
        this._muzzleLight.intensity = 0;
      }
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
