import * as THREE from 'three';

// Scratch vector for velocity — reused across all create* calls to avoid per-particle allocation
const _v = new THREE.Vector3();

// Shared geometry cache
const GEO = {
  tiny:   new THREE.SphereGeometry(0.05, 4, 4),
  small:  new THREE.SphereGeometry(0.08, 4, 4),
  medium: new THREE.SphereGeometry(0.15, 5, 5),
  large:  new THREE.SphereGeometry(0.25, 5, 5),
  smoke:  new THREE.SphereGeometry(0.35, 6, 6),
  spark:  new THREE.BoxGeometry(0.04, 0.04, 0.18),
  debris: new THREE.BoxGeometry(0.09, 0.05, 0.09),
  decal:  new THREE.CircleGeometry(1, 16),
};
const _halfScale = new THREE.Vector3(0.5, 0.5, 0.5);
const _zeroScale = new THREE.Vector3(0.01, 0.01, 0.01);

// Material pool — reuse by hex color key
const _matPool = new Map();
function poolMat(color, transparent = false, opacity = 1) {
  const key = `${color}_${transparent}_${Math.round(opacity * 100)}`;
  if (!_matPool.has(key)) {
    _matPool.set(key, new THREE.MeshBasicMaterial({
      color, transparent, opacity,
      depthWrite: !transparent, // transparent particles skip depth write — no z-fighting
    }));
  }
  return _matPool.get(key);
}

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  _spawn(geo, color, pos, vel, life, gravity = 0, transparent = false, opacity = 1, scaleDown = true) {
    // Transparent particles fade their material per-frame, so they need their own
    // clone — mutating the pooled material makes every particle of that color flicker
    const pooled = poolMat(color, transparent, opacity);
    const mat = transparent ? pooled.clone() : pooled;
    const p = new THREE.Mesh(geo, mat);
    p._ownMat = transparent;
    p.userData.noHit = true; // never absorb weapon raycasts
    p.position.copy(pos);
    p.velocity       = vel.clone();
    p.life           = life;
    p.maxLife        = life;
    p.gravity        = gravity;
    p.baseOpacity    = opacity;
    p.transparent    = transparent;
    p.scaleDown      = scaleDown;
    this.scene.add(p);
    this.particles.push(p);
    return p;
  }

  createMuzzleFlash(position) {
    for (let i = 0; i < 5; i++) {
      this._spawn(GEO.small, 0xffaa00, position,
        _v.set((Math.random()-0.5)*5, (Math.random()-0.5)*5, Math.random()*10),
        0.08, 0, false, 1, true);
    }
    this._spawn(GEO.medium, 0xffffff, position, _v.set(0,0,0), 0.06, 0, true, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, spd = 4 + Math.random() * 8;
      this._spawn(GEO.spark, 0xffdd44, position,
        _v.set(Math.cos(a)*spd, (Math.random()-0.3)*4, Math.sin(a)*spd + 6),
        0.12, -18, false, 1, false);
    }
  }

  createBlood(position, count = 6) {
    for (let i = 0; i < count; i++) {
      const red = Math.random() < 0.3 ? 0xcc0000 : (Math.random() < 0.5 ? 0x880000 : 0xaa0000);
      this._spawn(Math.random() < 0.4 ? GEO.medium : GEO.small, red, position,
        _v.set((Math.random()-0.5)*5, 2 + Math.random()*4, (Math.random()-0.5)*5),
        0.8 + Math.random()*0.8, -14, false, 1, true);
    }
    for (let i = 0; i < 3; i++) {
      this._spawn(GEO.tiny, 0xdd0000, position,
        _v.set((Math.random()-0.5)*8, 3 + Math.random()*3, (Math.random()-0.5)*8),
        0.4, -9, true, 0.7, true);
    }
  }

  createSmoke(position, count = 4) {
    for (let i = 0; i < count; i++) {
      const grey = 0x777777 + Math.floor(Math.random() * 0x222222);
      const p = this._spawn(GEO.smoke, grey, position,
        _v.set((Math.random()-0.5)*1.5, 1 + Math.random()*1.5, (Math.random()-0.5)*1.5),
        2.5, 0, true, 0.5, false);
      p.scale.set(0.4, 0.4, 0.4);
      p._growing = true;
    }
  }

  createExplosion(position) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random()*Math.PI*2, el = Math.random()*Math.PI, spd = 30 + Math.random()*40;
      const col = [0xff4400, 0xff8800, 0xffcc00][Math.floor(Math.random()*3)];
      this._spawn(GEO.medium, col, position,
        _v.set(Math.sin(el)*Math.cos(a)*spd, Math.abs(Math.cos(el))*spd*0.8, Math.sin(el)*Math.sin(a)*spd),
        0.4, -20, false, 1, true);
    }
    for (let i = 0; i < 8; i++) {
      const p = this._spawn(GEO.smoke, 0x555555, position,
        _v.set((Math.random()-0.5)*8, 4 + Math.random()*6, (Math.random()-0.5)*8),
        3, 0, true, 0.6, false);
      p.scale.set(0.3, 0.3, 0.3);
      p._growing = true;
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random()*Math.PI*2, spd = 15 + Math.random()*20;
      this._spawn(GEO.debris, 0x554433, position,
        _v.set(Math.cos(a)*spd, 8 + Math.random()*12, Math.sin(a)*spd),
        1.2, -18, false, 1, false);
    }
  }

  createAcid(position, count = 10) {
    for (let i = 0; i < count; i++) {
      this._spawn(GEO.small, Math.random() < 0.5 ? 0x44ff44 : 0x88ff22, position,
        _v.set((Math.random()-0.5)*4, 1 + Math.random()*3, (Math.random()-0.5)*4),
        1.5, -9.8, true, 0.85, true);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2;
      this._spawn(GEO.tiny, 0x22ff22, position,
        _v.set(Math.cos(a)*5, 0.5, Math.sin(a)*5),
        0.5, 0, true, 0.7, true);
    }
  }

  createScreamRing(position) {
    for (let i = 0; i < 16; i++) {
      const a = (i/16)*Math.PI*2;
      const p = this._spawn(GEO.small, 0xff6600, position,
        _v.set(Math.cos(a)*7, 0.3, Math.sin(a)*7),
        0.7, 0, true, 0.85, true);
      p.scale.set(0.5, 0.5, 0.5);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2 + Math.PI/8;
      this._spawn(GEO.tiny, 0xffaa00, position,
        _v.set(Math.cos(a)*4, 0.2, Math.sin(a)*4),
        0.5, 0, true, 0.6, true);
    }
  }

  createBulletImpact(position) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random()*Math.PI*2, spd = 3 + Math.random()*5;
      this._spawn(GEO.spark, 0xffcc44, position,
        _v.set(Math.cos(a)*spd, 1 + Math.random()*2, Math.sin(a)*spd),
        0.25, -16, false, 1, false);
    }
    const p = this._spawn(GEO.smoke, 0xaaaaaa, position,
      _v.set((Math.random()-0.5)*2, 1, (Math.random()-0.5)*2),
      0.5, 0, true, 0.35, false);
    p.scale.set(0.15, 0.15, 0.15);
    p._growing = true;
  }

  createFireEffect(position) {
    for (let i = 0; i < 8; i++) {
      const col = [0xff2200, 0xff8800, 0xffcc00][Math.floor(Math.random()*3)];
      this._spawn(GEO.medium, col, position,
        _v.set((Math.random()-0.5)*2, 2 + Math.random()*3, (Math.random()-0.5)*2),
        0.6 + Math.random()*0.4, 0, true, 0.8, true);
    }
  }

  createLightning(position, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random()*Math.PI*2, spd = 2 + Math.random()*4;
      this._spawn(GEO.spark, 0x88ccff, position,
        _v.set(Math.cos(a)*spd, 1 + Math.random()*3, Math.sin(a)*spd),
        0.3, -8, true, 0.9, false);
    }
    // Blue core flash
    this._spawn(GEO.medium, 0xaaddff, position, _v.set(0,0,0), 0.1, 0, true, 0.8);
  }

  createHeal(position) {
    for (let i = 0; i < 10; i++) {
      const a = (i/10)*Math.PI*2;
      this._spawn(GEO.tiny, 0x44ff88, position,
        _v.set(Math.cos(a)*1.5, 1.5 + Math.random()*1.5, Math.sin(a)*1.5),
        0.8, 0, true, 0.9, true);
    }
  }

  // Persistent blood pool laid flat on the ground. `position.y` should be ground
  // height. Pool is capped and the oldest recycled so decals never accumulate.
  createBloodDecal(position, radius = 0.75) {
    if (!this._decals) this._decals = [];
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() < 0.5 ? 0x5a0c0c : 0x470a0a,
      transparent: true, opacity: 0.74, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4
    });
    const d = new THREE.Mesh(GEO.decal, mat);
    d.rotation.x = -Math.PI / 2;           // lay flat, facing up
    d.rotation.z = Math.random() * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.7);
    d.scale.set(r, r * (0.75 + Math.random() * 0.4), 1); // slightly irregular splat
    d.position.set(position.x, position.y + 0.035 + Math.random() * 0.02, position.z);
    d.renderOrder = -1;
    d.userData.noHit = true;
    d._decalAge = 0;
    d._decalLife = 32 + Math.random() * 24; // seconds before it fully fades
    d._decalBase = 0.74;
    this.scene.add(d);
    this._decals.push(d);

    const MAX_DECALS = 48;
    while (this._decals.length > MAX_DECALS) {
      const old = this._decals.shift();
      this.scene.remove(old);
      old.material.dispose();
    }
    return d;
  }

  _updateDecals(deltaTime) {
    const decals = this._decals;
    if (!decals) return;
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i];
      d._decalAge += deltaTime;
      const t = d._decalAge / d._decalLife;
      if (t >= 1) {
        this.scene.remove(d);
        d.material.dispose();
        decals.splice(i, 1);
        continue;
      }
      // Hold full opacity, then dry/fade over the final third of its life
      if (t > 0.66) d.material.opacity = d._decalBase * (1 - (t - 0.66) / 0.34);
    }
  }

  update(deltaTime) {
    this._updateDecals(deltaTime);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;

      if (p.life <= 0) {
        this.scene.remove(p);
        if (p._ownMat) p.material.dispose(); // cloned per-particle material
        // Swap-and-pop: O(1) removal vs O(n) splice; safe with backwards iteration
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }

      if (p.gravity) p.velocity.y += p.gravity * deltaTime;
      p.position.addScaledVector(p.velocity, deltaTime);

      const progress = p.life / p.maxLife; // 1→0

      // Fade transparency particles
      if (p.transparent) {
        p.material.opacity = p.baseOpacity * progress;
      }

      // Grow smoke particles
      if (p._growing) {
        const grow = 1 + (1 - progress) * 3.5;
        p.scale.setScalar(grow * 0.35);
      } else if (p.scaleDown) {
        // Frame-rate-independent scale shrink from 1→0 over particle lifetime
        p.scale.setScalar(Math.max(0.01, progress));
      }

      // Spin debris
      if (p.geometry === GEO.debris) {
        p.rotation.x += deltaTime * 4;
        p.rotation.z += deltaTime * 3;
      }
    }
  }
}
