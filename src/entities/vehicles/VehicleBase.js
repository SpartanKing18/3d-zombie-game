import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class VehicleBase {
  constructor(x, z, game, config = {}) {
    this.game = game;
    this.position = new THREE.Vector3(x, game.terrainGenerator.getHeightAt(x, z) + 1, z);

    this.name = config.name || 'Vehicle';
    this.type = config.type || 'sedan';
    this.width = config.width || 2;
    this.length = config.length || 4;
    this.height = config.height || 1.5;
    this.mass = config.mass || 1000;
    this.maxSpeed = config.maxSpeed || 50;
    this.acceleration = config.acceleration || 50;
    this.braking = config.braking || 60;
    this.turnSpeed = config.turnSpeed || 3;
    this.suspension = config.suspension || 0.3;

    this.isPlayer = false;
    this.isDriving = false;
    this.engine = 0;
    this.steering = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.fuel = 100;
    this.maxFuel = 100;

    this.mesh = null;
    this.body = null;
    this.vehicle = null;
    this.wheels = [];

    this.setupPhysics();
    this.createMesh();
  }

  setupPhysics() {
    const shape = new CANNON.Box(new CANNON.Vec3(this.width / 2, this.height / 2, this.length / 2));
    this.body = new CANNON.Body({ mass: this.mass });
    this.body.addShape(shape);
    this.body.angularDamping = 0.5;   // resist tipping/spin
    this.body.position.copy(this.position);
    this.game.physicsWorld.addBody(this.body);

    // cannon-es RaycastVehicle needs addWheel() calls — constructor wheelInfos are
    // ignored. Forward is +Z (index 2), right +X (0), up +Y (1).
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.body, indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2,
    });
    const wheelBase = {
      radius: this.wheelRadius || 0.5,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 34,
      suspensionRestLength: 0.35,
      frictionSlip: 2.2,
      dampingRelaxation: 2.4,
      dampingCompression: 4.4,
      maxSuspensionForce: 1e5,
      rollInfluence: 0.03,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      maxSuspensionTravel: 0.4,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    const hw = this.width / 2 - 0.05;
    const cz = this.length / 2 - 0.65;
    const cy = -this.height / 2 + 0.15;
    const pts = [[-hw, cy, cz], [hw, cy, cz], [-hw, cy, -cz], [hw, cy, -cz]]; // front(0,1) rear(2,3)
    for (const [x, y, z] of pts) {
      this.vehicle.addWheel({ ...wheelBase, chassisConnectionPointLocal: new CANNON.Vec3(x, y, z) });
    }
    this.vehicle.addToWorld(this.game.physicsWorld.getWorld());
  }

  createMesh() {
    const group = new THREE.Group();

    // Real car model (Quaternius Cars, CC0 — sleek, realistically proportioned).
    // Falls back to a box if the loader isn't ready (rare — cars spawn well after load).
    const reg = this.game.vehicleModelLoader;
    let model = null;
    if (reg?.ready) {
      const keys = ['normalcar1', 'normalcar2', 'sportscar', 'sportscar2', 'suv2', 'taxi2', 'cop'];
      const key = this.modelKey || keys[(Math.random() * keys.length) | 0];
      model = reg.createModel(key);
    }

    if (model) {
      // Face the model +Z (chassis front): the front-wheel nodes tell us which end
      // is the front, so we flip only if they sit at -Z.
      const wpz = new THREE.Vector3();
      let frontZ = 0, nf = 0;
      model.updateMatrixWorld(true);
      model.traverse(o => {
        const n = (o.name || '').toLowerCase();
        if (n.includes('wheel') && n.includes('front')) { o.getWorldPosition(wpz); frontZ += wpz.z; nf++; }
      });
      model.rotation.y = (nf && frontZ / nf < 0) ? Math.PI : 0;

      model.updateMatrixWorld(true);
      let bb = new THREE.Box3().setFromObject(model);
      const sz = new THREE.Vector3(); bb.getSize(sz);
      const s = this.length / (sz.z || 1);          // scale so model length = chassis length
      model.scale.setScalar(s);
      model.updateMatrixWorld(true);
      bb = new THREE.Box3().setFromObject(model);
      const c = new THREE.Vector3(); bb.getCenter(c);
      model.position.x -= c.x; model.position.z -= c.z;   // centre on the chassis
      model.position.y -= bb.min.y - (-this.height / 2 - 1.0);   // wheels on the contact line

      // Per-material treatment by name: glossy paint on the body, dark reflective
      // glass, emissive head/tail lights, matte trim/tyres.
      model.traverse(o => {
        if (!o.isMesh || !o.material) return;
        o.castShadow = true; o.receiveShadow = true;
        let isWheel = false;
        for (let par = o; par; par = par.parent) {
          if (par.name && par.name.toLowerCase().includes('wheel')) { isWheel = true; break; }
        }
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        const nm = (m.name || '').toLowerCase();
        if (nm.includes('window') || nm.includes('glass')) {
          o.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0x0a0e12), metalness: 0.1, roughness: 0.06, clearcoat: 1, envMapIntensity: 2.4 });
        } else if (nm.includes('headlight')) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xfff4cc, emissive: 0xfff0b0, emissiveIntensity: 0.7, roughness: 0.3 });
        } else if (nm.includes('taillight')) {
          o.material = new THREE.MeshStandardMaterial({ color: 0x7a1818, emissive: 0xff2222, emissiveIntensity: 0.7, roughness: 0.3 });
        } else if (isWheel || nm.includes('black') || nm.includes('grey') || nm.includes('gray') || nm.includes('tire') || nm.includes('rim') || nm.includes('metal')) {
          m.metalness = 0.45; m.roughness = 0.6; m.envMapIntensity = 0.9;
        } else {
          o.material = new THREE.MeshPhysicalMaterial({ color: m.color ? m.color.clone() : new THREE.Color(0xffffff), metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.6 });
        }
      });
      group.add(model);

      // Collect wheel nodes for spin/steer. These models put every wheel node's origin
      // at the car centre (0,0,0), so rotating the node would swing the wheel around the
      // whole car. Re-pivot each wheel: drop a pivot Group at the wheel's geometric
      // centre and reparent the wheel into it, so rotation happens about the wheel axle.
      group.updateMatrixWorld(true);
      this._wheels = [];
      const wheelNodes = [];
      model.traverse(o => {
        const n = (o.name || '').toLowerCase();
        if (!n.includes('wheel')) return;
        if (o.parent && (o.parent.name || '').toLowerCase().includes('wheel')) return;
        wheelNodes.push({ node: o, steer: n.includes('front') });
      });
      const _c = new THREE.Vector3();
      for (const w of wheelNodes) {
        const node = w.node, parent = node.parent;
        new THREE.Box3().setFromObject(node).getCenter(_c);
        const centerLocal = parent.worldToLocal(_c.clone());
        const pivot = new THREE.Group();
        pivot.position.copy(centerLocal);
        pivot.rotation.order = 'YXZ';
        parent.add(pivot);
        node.position.sub(centerLocal);   // keep the wheel geometry where it was
        pivot.add(node);
        this._wheels.push({ node: pivot, steer: w.steer });
      }
      if (this._wheels[0]) {
        const ws = new THREE.Vector3();
        new THREE.Box3().setFromObject(this._wheels[0].node).getSize(ws);
        this._visWheelRadius = Math.max(0.15, ws.y / 2);
      }
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(this.width, this.height, this.length),
        new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.6, metalness: 0.3 }));
      body.castShadow = true; body.receiveShadow = true; group.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(this.width * 0.8, this.height * 0.5, this.length * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.4 }));
      cabin.position.y = this.height * 0.5; cabin.castShadow = true; group.add(cabin);
    }

    group.position.copy(this.position);
    this.game.scene.addObject(group);
    this.mesh = group;
  }

  update(deltaTime) {
    if (!this.isDriving) {
      this.engine = 0;
      this.steering = 0;
    }

    this.updateVehicle(deltaTime);
    this.updateMeshPosition();
    this.updateWheels(deltaTime);

    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - 0.1 * deltaTime);
    }
  }

  // Spin every wheel by the distance rolled and steer the front pair.
  updateWheels(deltaTime) {
    if (!this._wheels || !this._wheels.length) return;
    const r = this._visWheelRadius || 0.4;
    this._wheelSpin = (this._wheelSpin || 0) + (this.getSpeed() * deltaTime) / r;
    const steerAngle = this.steering * this.turnSpeed;   // matches the physics steer
    for (const w of this._wheels) {
      w.node.rotation.y = w.steer ? steerAngle : 0;       // yaw (steer) — front only
      w.node.rotation.x = this._wheelSpin;                // roll (spin) — all wheels
    }
  }

  updateVehicle(deltaTime) {
    // The cannon RaycastVehicle applies these on the world's preStep (registered by
    // addToWorld), so we only SET the per-wheel forces via its API here — never call
    // vehicle.update() (it doesn't exist and the wheels auto-update on world.step).
    if (!this.vehicle) return;
    const n = this.vehicle.wheelInfos.length;
    const steer = this.steering * this.turnSpeed;

    if (this.isDriving && this.fuel > 0) {
      // Negated so +engine drives toward the chassis' +Z (getForwardDir) — cannon
      // applies applyEngineForce along its own forward, which is -Z here.
      const force = -this.engine * this.acceleration;
      for (let i = 0; i < n; i++) {
        this.vehicle.applyEngineForce(force, i);
        this.vehicle.setBrake(this.engine === 0 ? this.braking : 0, i);
      }
    } else {
      // Parked / no fuel: gentle brake so it doesn't creep, no drive.
      for (let i = 0; i < n; i++) { this.vehicle.applyEngineForce(0, i); this.vehicle.setBrake(this.braking * 0.5, i); }
    }
    // Steer the front axle (wheels 0,1).
    this.vehicle.setSteeringValue(steer, 0);
    this.vehicle.setSteeringValue(steer, 1);

    this.position.copy(this.body.position);
  }

  updateMeshPosition() {
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.quaternion.copy(this.body.quaternion);
    }
  }

  enter(player) {
    this.isDriving = true;
    this.isPlayer = true;
  }

  exit() {
    this.isDriving = false;
    this.isPlayer = false;
    this.engine = 0;
    this.steering = 0;
  }

  accelerate() {
    this.engine = Math.min(1, this.engine + 0.1);
  }

  brake() {
    this.engine = Math.max(-0.5, this.engine - 0.1);
  }

  steerLeft() {
    this.steering = Math.max(-1, this.steering - 0.1);
  }

  steerRight() {
    this.steering = Math.min(1, this.steering + 0.1);
  }

  resetSteering() {
    this.steering *= 0.9;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.explode();
    }
  }

  explode() {
    if (this._exploded) return; // guard: takeDamage() and VehicleManager both call this
    this._exploded = true;

    this.game.particleSystem?.createExplosion?.(this.position.clone());

    if (this.mesh) {
      this.game.scene.removeObject(this.mesh);
      // Dispose the chassis/cabin/wheel meshes' GPU resources.
      this.mesh.traverse(o => {
        if (!o.isMesh) return;
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material?.dispose?.();
      });
      this.mesh = null;
    }
    // Remove the RaycastVehicle (chassis body + preStep listener + constraints),
    // then also drop the chassis body added directly in setupPhysics.
    if (this.vehicle) {
      try { this.vehicle.removeFromWorld(this.game.physicsWorld.getWorld()); } catch (e) { /* already removed */ }
      this.vehicle = null;
    }
    if (this.body) {
      this.game.physicsWorld.removeBody(this.body);
      this.body = null;
    }
  }

  // Chassis forward (+Z local) in world space, flattened to the ground plane.
  getForwardDir() {
    const f = new THREE.Vector3(0, 0, 1);
    if (this.body) f.applyQuaternion(this.body.quaternion);
    f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, 1);
    return f.normalize();
  }

  // Forward ground speed in m/s (signed: negative when reversing).
  getSpeed() {
    if (!this.body) return 0;
    const v = this.body.velocity;
    const f = this.getForwardDir();
    return v.x * f.x + v.z * f.z;
  }

  getPosition() {
    return this.position.clone();
  }

  getName() {
    return this.name;
  }

  isAlive() {
    return this.health > 0;
  }

  refuel(amount) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }
}
