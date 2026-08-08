import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  // Collision filter groups — keep in sync with ZombieBase, Player, TerrainGenerator
  static GROUP_PLAYER  = 1;
  static GROUP_ZOMBIE  = 2;
  static GROUP_TERRAIN = 4;
  static GROUP_WORLD   = 8; // buildings, static objects

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -20, 0);
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.0;  // no bounce = no jitter
    // SAP is O(n log n) vs NaiveBroadphase O(n²) — essential with many zombie bodies
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.broadphase.axisIndex = 0;
    this.bodies = [];
    this.constraints = [];
    this.timeStep = 1 / 60;
  }

  addBody(body) {
    this.world.addBody(body);
    this.bodies.push(body);
    return body;
  }

  removeBody(body) {
    this.world.removeBody(body);
    const idx = this.bodies.indexOf(body);
    if (idx > -1) this.bodies.splice(idx, 1);
  }

  addConstraint(constraint) {
    this.world.addConstraint(constraint);
    this.constraints.push(constraint);
    return constraint;
  }

  removeConstraint(constraint) {
    this.world.removeConstraint(constraint);
    const idx = this.constraints.indexOf(constraint);
    if (idx > -1) this.constraints.splice(idx, 1);
  }

  step(deltaTime) {
    // Pass deltaTime + max 3 substeps so fast-moving bodies don't tunnel at low framerates.
    // When deltaTime is undefined (legacy callers) cannon-es falls back to one fixed step.
    this.world.step(this.timeStep, deltaTime, 3);
  }

  raycast(from, to, options = {}) {
    const result = new CANNON.RaycastResult();
    this.world.raycastClosest(
      from,
      to,
      {
        skipBackfaces: options.skipBackfaces !== false,
        collisionFilterGroup: options.collisionFilterGroup ?? -1,
        collisionFilterMask: options.collisionFilterMask ?? -1,
      },
      result
    );
    return result.hasHit ? result : null;
  }

  createSphere(mass, radius) {
    const body = new CANNON.Body({ mass, shape: new CANNON.Sphere(radius) });
    return body;
  }

  createBox(mass, width, height, depth) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2))
    });
    return body;
  }

  createCapsule(mass, radius, length) {
    const body = new CANNON.Body({ mass });
    const shape = new CANNON.Sphere(radius);
    body.addShape(shape, new CANNON.Vec3(0, length / 2, 0));
    body.addShape(shape, new CANNON.Vec3(0, -length / 2, 0));
    const midShape = new CANNON.Cylinder(radius, radius, length, 8);
    body.addShape(midShape, new CANNON.Vec3(0, 0, 0));
    return body;
  }

  createCylinder(mass, radius, height) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Cylinder(radius, radius, height, 16)
    });
    return body;
  }

  createHeightfield(data, options = {}) {
    const shape = new CANNON.Heightfield(data, {
      minValue: options.minValue || -100,
      maxValue: options.maxValue || 100
    });
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(shape);
    return body;
  }

  createGround(mass = 0) {
    return new CANNON.Body({ mass, shape: new CANNON.Plane() });
  }

  getWorld() {
    return this.world;
  }
}
