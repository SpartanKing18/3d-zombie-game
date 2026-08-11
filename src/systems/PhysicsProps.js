import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ─────────────────────────────────────────────────────────────────────────────
//  PhysicsProps — dynamic, pushable world props (dead bodies, loose debris)
// ─────────────────────────────────────────────────────────────────────────────
// Each prop is a THREE mesh driven by a dynamic cannon-es body: the player can
// walk into a corpse and shove it, a grenade can blow it across the street, and it
// tumbles and settles with real physics. Bodies sleep when at rest, so update() is
// cheap once everything has come to a stop.
// ─────────────────────────────────────────────────────────────────────────────
export class PhysicsProps {
  constructor(game) {
    this.game = game;
    this.props = [];          // { mesh, body }
    this._tmp = new CANNON.Vec3();
  }

  // Sync every prop's mesh to its physics body (call AFTER world.step()).
  update() {
    for (const p of this.props) {
      p.mesh.position.copy(p.body.position);
      p.mesh.quaternion.copy(p.body.quaternion);
    }
  }

  // Apply a radial impulse to nearby props (explosions, hard hits).
  applyBlast(pos, radius = 5, strength = 26) {
    for (const p of this.props) {
      const bp = p.body.position;
      const dx = bp.x - pos.x, dy = bp.y - pos.y, dz = bp.z - pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > radius * radius) continue;
      const d = Math.sqrt(d2) || 0.001;
      const f = strength * (1 - d / radius);
      p.body.wakeUp();
      this._tmp.set((dx / d) * f, Math.abs(f) * 0.6 + 2, (dz / d) * f);
      p.body.applyImpulse(this._tmp, p.body.position);
    }
  }

  // A dead body lying on the ground, shovable and tumble-able.
  addCorpse(x, z, opts = {}) {
    const y = (opts.y ?? this._groundY(x, z)) + 0.3;
    const yaw = opts.yaw ?? Math.random() * Math.PI * 2;

    const mesh = this._buildCorpseMesh(opts);
    mesh.userData.noHit = true;   // dead — bullets pass through
    this.game.scene.addObject(mesh);

    // Single capsule-ish box body: cheap, stable, and pushes/tumbles convincingly.
    const body = new CANNON.Body({
      mass: opts.mass ?? 22,
      linearDamping: 0.5,
      angularDamping: 0.6,
      allowSleep: true,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.85, 0.22, 0.32)));
    body.position.set(x, y, z);
    body.quaternion.setFromEuler(0, yaw, 0);
    body.sleepSpeedLimit = 0.25;
    body.sleepTimeLimit = 0.6;
    this.game.physicsWorld.addBody(body);

    const prop = { mesh, body };
    this.props.push(prop);
    return prop;
  }

  _groundY(x, z) {
    const h = this.game.terrainGenerator?.getHeightAt?.(x, z);
    return isFinite(h) ? h : 0;
  }

  // Low-poly humanoid lying flat along the body's local X axis (head +X, legs -X),
  // built around the origin so it rides the body group directly.
  _buildCorpseMesh() {
    const g = new THREE.Group();
    const skinCol  = [0xb99a7d, 0xa88a6b, 0xc7a888][Math.floor(Math.random() * 3)];
    const shirtCol = [0x3a4a5a, 0x5a3a34, 0x4a4a44, 0x2f3a2c][Math.floor(Math.random() * 4)];
    const pantsCol = [0x2a2c33, 0x3a352c, 0x24303a][Math.floor(Math.random() * 3)];
    const skin  = new THREE.MeshStandardMaterial({ color: skinCol,  roughness: 0.85 });
    const shirt = new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.9 });

    const add = (geo, mat, px, py, pz, rot) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // torso, head, arms (splayed), legs
    add(new THREE.BoxGeometry(0.7, 0.24, 0.46), shirt, 0.08, 0, 0);
    add(new THREE.SphereGeometry(0.14, 10, 8), skin, 0.6, 0.04, 0);
    add(new THREE.BoxGeometry(0.5, 0.11, 0.12), shirt, 0.12, 0, 0.34, [0, 0.5, 0]);
    add(new THREE.BoxGeometry(0.5, 0.11, 0.12), shirt, 0.12, 0, -0.34, [0, -0.5, 0]);
    add(new THREE.BoxGeometry(0.78, 0.15, 0.17), pants, -0.5, 0, 0.12);
    add(new THREE.BoxGeometry(0.82, 0.15, 0.17), pants, -0.52, 0, -0.12, [0, 0.14, 0]);
    // hands + shoes
    add(new THREE.BoxGeometry(0.12, 0.1, 0.11), skin, 0.36, 0, 0.5);
    add(new THREE.BoxGeometry(0.12, 0.1, 0.11), skin, 0.36, 0, -0.5);
    const shoe = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    add(new THREE.BoxGeometry(0.16, 0.13, 0.16), shoe, -0.92, 0.0, 0.12);
    add(new THREE.BoxGeometry(0.16, 0.13, 0.16), shoe, -0.96, 0.0, -0.12);

    return g;
  }

  dispose() {
    for (const p of this.props) {
      this.game.scene.removeObject?.(p.mesh);
      this.game.physicsWorld.removeBody(p.body);
      p.mesh.traverse(o => {
        if (o.isMesh) { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => x?.dispose?.()); }
      });
    }
    this.props.length = 0;
  }
}
