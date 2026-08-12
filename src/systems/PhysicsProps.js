import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ─────────────────────────────────────────────────────────────────────────────
//  PhysicsProps — ragdoll corpses driven by real physics
// ─────────────────────────────────────────────────────────────────────────────
// Each corpse is an 11-part cannon-es ragdoll (legs, pelvis, torso, head, arms)
// jointed with ConeTwist constraints. It collapses and settles under gravity, and
// you can walk into it or blow it up and the limbs flop realistically.
//
// Perf: constrained ragdolls are expensive to solve every step, so once a corpse
// has come to rest it is FROZEN (bodies -> STATIC, dropped from the solver). It
// wakes back to DYNAMIC only when the player comes close or a blast hits it — so a
// yard full of bodies costs almost nothing until you disturb one.
// ─────────────────────────────────────────────────────────────────────────────
const WAKE_DIST = 2.4;         // player within this (m) wakes a frozen corpse
const SETTLE_WINDOW = 0.4;     // seconds per settle-measurement window
const SETTLE_DRIFT2 = 0.1 * 0.1; // if the pelvis drifts less than this over a window,
                               // the corpse has settled. Net drift (not instantaneous
                               // velocity) ignores the constant micro-jitter a
                               // constraint solver leaves on a resting body.
const MAX_ACTIVE_AGE = 8;      // hard cap: freeze any corpse still awake this long

export class PhysicsProps {
  constructor(game) {
    this.game = game;
    this.ragdolls = [];
    this._tmp = new CANNON.Vec3();
  }

  update(dt = 0.016) {
    const pp = this.game.player?.getPosition?.();
    // Backward iteration so a corrupted ragdoll can be disposed mid-loop safely.
    for (let ri = this.ragdolls.length - 1; ri >= 0; ri--) {
      const rd = this.ragdolls[ri];
      // NaN guard: a blown-up constraint can fling a body to a non-finite position;
      // if that body then touches the player, the contact solver corrupts the PLAYER
      // body too (NaN camera → black screen). Drop the bad ragdoll before that.
      const bp0 = rd.parts[4].body.position;
      if (!Number.isFinite(bp0.x) || !Number.isFinite(bp0.y) || !Number.isFinite(bp0.z)) {
        this._disposeRagdoll(rd);
        continue;
      }
      if (rd.frozen) {
        // Wake if the player wanders close enough to shove it.
        if (pp) {
          for (const p of rd.parts) {
            const dx = p.body.position.x - pp.x, dz = p.body.position.z - pp.z;
            if (dx * dx + dz * dz < WAKE_DIST * WAKE_DIST) { this._wake(rd); break; }
          }
        }
        continue; // frozen bodies don't move — nothing to sync
      }
      // Live: drive meshes from bodies.
      for (const p of rd.parts) {
        p.mesh.position.copy(p.body.position);
        p.mesh.quaternion.copy(p.body.quaternion);
      }
      // Settle detection: measure net pelvis drift over a time window. Tiny per-
      // frame jitter cancels out, so a corpse that's visibly still reliably freezes.
      const pel = rd.parts[4].body.position;   // pelvis
      rd.winTime += dt;
      rd.age += dt;
      if (!rd.winPos) rd.winPos = { x: pel.x, y: pel.y, z: pel.z };
      if (rd.winTime >= SETTLE_WINDOW) {
        const dx = pel.x - rd.winPos.x, dy = pel.y - rd.winPos.y, dz = pel.z - rd.winPos.z;
        // Freeze once it stops drifting, or unconditionally after a few seconds — a
        // dead body shouldn't creep around forever, and this caps the physics cost.
        if (dx * dx + dy * dy + dz * dz < SETTLE_DRIFT2 || rd.age > MAX_ACTIVE_AGE) this._freeze(rd);
        rd.winPos.x = pel.x; rd.winPos.y = pel.y; rd.winPos.z = pel.z;
        rd.winTime = 0;
      }
    }
  }

  // Radial impulse from an explosion / hard hit.
  applyBlast(pos, radius = 6, strength = 30) {
    const r2 = radius * radius;
    for (const rd of this.ragdolls) {
      let near = false;
      for (const p of rd.parts) {
        const dx = p.body.position.x - pos.x, dy = p.body.position.y - pos.y, dz = p.body.position.z - pos.z;
        if (dx * dx + dy * dy + dz * dz < r2) { near = true; break; }
      }
      if (!near) continue;
      if (rd.frozen) this._wake(rd);
      for (const p of rd.parts) {
        const bp = p.body.position;
        const dx = bp.x - pos.x, dy = bp.y - pos.y, dz = bp.z - pos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        if (d > radius) continue;
        const f = strength * (1 - d / radius);
        this._tmp.set((dx / d) * f, Math.abs(f) * 0.55 + 2.5, (dz / d) * f);
        p.body.applyImpulse(this._tmp);
      }
    }
  }

  _freeze(rd) {
    for (const p of rd.parts) {
      p.body.velocity.setZero();
      p.body.angularVelocity.setZero();
      p.body.type = CANNON.Body.STATIC;
      p.body.mass = 0;
      p.body.updateMassProperties();
      p.mesh.position.copy(p.body.position);
      p.mesh.quaternion.copy(p.body.quaternion);
    }
    rd.frozen = true;
  }

  _wake(rd) {
    for (const p of rd.parts) {
      p.body.type = CANNON.Body.DYNAMIC;
      p.body.mass = p.mass;
      p.body.updateMassProperties();
      p.body.wakeUp();
    }
    rd.frozen = false;
    rd.winTime = 0;
    rd.winPos = null;
  }

  _groundY(x, z) {
    const h = this.game.terrainGenerator?.getHeightAt?.(x, z);
    return isFinite(h) ? h : 0;
  }

  // Build an 11-part ragdoll standing at (x,z); it collapses on spawn.
  addCorpse(x, z, opts = {}) {
    const gy = (opts.y ?? this._groundY(x, z));
    const s = opts.scale ?? 0.65;
    const world = this.game.physicsWorld;

    // Proportions (scaled from the canonical cannon ragdoll).
    const shouldersDistance = 0.5 * s, upperArmLength = 0.4 * s, lowerArmLength = 0.4 * s,
      upperArmSize = 0.2 * s, lowerArmSize = 0.2 * s, neckLength = 0.1 * s, headRadius = 0.25 * s,
      upperBodyLength = 0.6 * s, pelvisLength = 0.4 * s, upperLegLength = 0.5 * s,
      upperLegSize = 0.2 * s, lowerLegSize = 0.2 * s, lowerLegLength = 0.5 * s;
    const mass = opts.mass ?? 1.4;

    // Materials (per corpse, a couple of variations). Zombie death-ragdolls get
    // rotten greenish skin + tattered dark clothes.
    const i3 = Math.floor((x * 3 + z) % 3 + 3) % 3, i4 = Math.floor((x + z * 2) % 4 + 4) % 4;
    const skinCol  = opts.zombie ? [0x6b7a4a, 0x5a6a3e, 0x76824f][i3] : [0xb99a7d, 0xa88a6b, 0xc7a888][i3];
    const shirtCol = opts.zombie ? [0x3a3f36, 0x4a3f36, 0x33402f, 0x2f342c][i4] : [0x3a4a5a, 0x5a3a34, 0x4a4a44, 0x2f3a2c][i4];
    const pantsCol = opts.zombie ? [0x2c2f28, 0x33352c, 0x252a24][i3] : [0x2a2c33, 0x3a352c, 0x24303a][i3];
    const skinM  = new THREE.MeshStandardMaterial({ color: skinCol,  roughness: 0.85 });
    const shirtM = new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.9 });
    const pantsM = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.9 });

    const parts = [];
    const bodyAt = (px, py, pz, he, mat) => {
      const body = new CANNON.Body({ mass, linearDamping: 0.6, angularDamping: 0.88 });
      body.addShape(he.isSphere
        ? new CANNON.Sphere(he.r)
        : new CANNON.Box(new CANNON.Vec3(he.x, he.y, he.z)));
      body.position.set(x + px, gy + py, z + pz);
      world.addBody(body);

      const geo = he.isSphere
        ? new THREE.SphereGeometry(he.r, 10, 8)
        : new THREE.BoxGeometry(he.x * 2, he.y * 2, he.z * 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.noHit = true;
      this.game.scene.addObject(mesh);

      const part = { body, mesh, mass };
      parts.push(part);
      return body;
    };

    const legHe  = { x: lowerLegSize / 2, y: lowerLegLength / 2, z: lowerLegSize / 2 };
    const uLegHe = { x: upperLegSize / 2, y: upperLegLength / 2, z: upperLegSize / 2 };
    const pelHe  = { x: shouldersDistance / 2, y: pelvisLength / 2, z: lowerLegSize / 2 };
    const bodyHe = { x: shouldersDistance / 2, y: upperBodyLength / 2, z: lowerLegSize / 2 };
    const armHe  = { x: upperArmLength / 2, y: upperArmSize / 2, z: upperArmSize / 2 };

    const yLL = lowerLegLength / 2;
    const yUL = yLL + lowerLegLength / 2 + upperLegLength / 2;
    const yPel = yUL + upperLegLength / 2 + pelvisLength / 2;
    const yBody = yPel + pelvisLength / 2 + upperBodyLength / 2;
    const yHead = yBody + upperBodyLength / 2 + headRadius + neckLength;
    const yArm = yBody + upperBodyLength / 2;
    const hs = shouldersDistance / 2;

    const lowerLeftLeg  = bodyAt(-hs, yLL, 0, legHe, pantsM);
    const lowerRightLeg = bodyAt( hs, yLL, 0, legHe, pantsM);
    const upperLeftLeg  = bodyAt(-hs, yUL, 0, uLegHe, pantsM);
    const upperRightLeg = bodyAt( hs, yUL, 0, uLegHe, pantsM);
    const pelvis    = bodyAt(0, yPel, 0, pelHe, pantsM);
    const upperBody = bodyAt(0, yBody, 0, bodyHe, shirtM);
    const head      = bodyAt(0, yHead, 0, { isSphere: true, r: headRadius }, skinM);
    const uLArm = bodyAt(-hs - upperArmLength / 2, yArm, 0, armHe, shirtM);
    const uRArm = bodyAt( hs + upperArmLength / 2, yArm, 0, armHe, shirtM);
    const lLArm = bodyAt(-hs - upperArmLength - lowerArmLength / 2, yArm, 0, armHe, shirtM);
    const lRArm = bodyAt( hs + upperArmLength + lowerArmLength / 2, yArm, 0, armHe, shirtM);

    // Pre-placed corpses (opts.lying !== false) are tipped onto their back BEFORE
    // jointing so they spawn already lying flat. Death ragdolls stay upright and get
    // thrown by an impulse below, so they collapse/fly from the killing blow.
    if (opts.lying !== false) {
      const pivot = new CANNON.Vec3(x, gy, z);
      const tip = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2 + (Math.sin(x * 3.1) * 0.25));
      const yaw = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), x * 1.3 + z * 0.7);
      const q = tip.mult(yaw);
      const rel = new CANNON.Vec3(), rot = new CANNON.Vec3(), nq = new CANNON.Quaternion();
      for (const p of parts) {
        p.body.position.vsub(pivot, rel);
        q.vmult(rel, rot);
        pivot.vadd(rot, p.body.position);
        p.body.position.y += 0.14;               // rest just above the ground
        q.mult(p.body.quaternion, nq);
        p.body.quaternion.copy(nq);
      }
    }

    const constraints = [];
    const V = (a, b, c) => new CANNON.Vec3(a, b, c);
    const cone = (A, B, pa, pb, axisA, axisB, angle) => {
      const c = new CANNON.ConeTwistConstraint(A, B, {
        pivotA: pa, pivotB: pb, axisA, axisB, angle, twistAngle: Math.PI / 8, collideConnected: false,
      });
      world.addConstraint(c); constraints.push(c);
    };
    const Y = CANNON.Vec3.UNIT_Y, X = CANNON.Vec3.UNIT_X;
    const aA = Math.PI / 3, aB = Math.PI / 2;   // looser joints → flatter, floppier sprawl
    const hl = lowerLegLength / 2, ul = upperLegLength / 2, pl = pelvisLength / 2, bl = upperBodyLength / 2, al = upperArmLength / 2;

    // knees
    cone(lowerLeftLeg,  upperLeftLeg,  V(0, hl, 0), V(0, -ul, 0), Y, Y, aA);
    cone(lowerRightLeg, upperRightLeg, V(0, hl, 0), V(0, -ul, 0), Y, Y, aA);
    // hips
    cone(upperLeftLeg,  pelvis, V(0, ul, 0), V(-hs, -pl, 0), Y, Y, aB);
    cone(upperRightLeg, pelvis, V(0, ul, 0), V( hs, -pl, 0), Y, Y, aB);
    // spine
    cone(pelvis, upperBody, V(0, pl, 0), V(0, -bl, 0), Y, Y, aA);
    // neck
    cone(upperBody, head, V(0, bl, 0), V(0, -headRadius - neckLength, 0), Y, Y, aA);
    // shoulders
    cone(upperBody, uLArm, V(-hs, bl, 0), V(al, 0, 0), X, X, aB);
    cone(upperBody, uRArm, V( hs, bl, 0), V(-al, 0, 0), X, X, aB);
    // elbows
    cone(uLArm, lLArm, V(-al, 0, 0), V(al, 0, 0), X, X, aA);
    cone(uRArm, lRArm, V( al, 0, 0), V(-al, 0, 0), X, X, aA);

    const rd = { parts, constraints, frozen: false, winTime: 0, winPos: null, age: 0, death: !!opts.death };
    this.ragdolls.push(rd);

    // Throw the whole body with the killing blow's impulse (COD-style ragdoll death).
    if (opts.impulse) {
      const imp = new CANNON.Vec3(opts.impulse.x, opts.impulse.y, opts.impulse.z);
      for (const p of parts) p.body.applyImpulse(imp);
    }

    if (opts.death) this._capDeathRagdolls();
    return rd;
  }

  // Keep only the most recent death ragdolls so kills can't grow the body count
  // without bound. Pre-placed corpses (death=false) are never culled.
  _capDeathRagdolls() {
    const MAX = 10;
    const deaths = this.ragdolls.filter(r => r.death);
    if (deaths.length <= MAX) return;
    const cull = deaths.slice(0, deaths.length - MAX);
    for (const rd of cull) this._disposeRagdoll(rd);
  }

  _disposeRagdoll(rd) {
    const world = this.game.physicsWorld;
    for (const c of rd.constraints) world.removeConstraint(c);
    for (const p of rd.parts) {
      world.removeBody(p.body);
      this.game.scene.removeObject?.(p.mesh);
      p.mesh.geometry?.dispose?.();
      const m = p.mesh.material; (Array.isArray(m) ? m : [m]).forEach(x => x?.dispose?.());
    }
    const i = this.ragdolls.indexOf(rd);
    if (i >= 0) this.ragdolls.splice(i, 1);
  }

  dispose() {
    const world = this.game.physicsWorld;
    for (const rd of this.ragdolls) {
      for (const c of rd.constraints) world.removeConstraint(c);
      for (const p of rd.parts) {
        world.removeBody(p.body);
        this.game.scene.removeObject?.(p.mesh);
        p.mesh.geometry?.dispose?.();
        const m = p.mesh.material; (Array.isArray(m) ? m : [m]).forEach(x => x?.dispose?.());
      }
    }
    this.ragdolls.length = 0;
  }
}
