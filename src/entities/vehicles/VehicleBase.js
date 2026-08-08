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
    const shape = new CANNON.Box(
      new CANNON.Vec3(this.width / 2, this.height / 2, this.length / 2)
    );

    this.body = new CANNON.Body({
      mass: this.mass
    });

    this.body.addShape(shape);
    this.body.position.copy(this.position);
    this.game.physicsWorld.addBody(this.body);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.body,
      wheelInfos: [
        { radius: 0.5, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0), chassisConnectionPointLocal: new CANNON.Vec3(-this.width / 3, -this.height / 2 - 0.5, this.length / 3) },
        { radius: 0.5, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0), chassisConnectionPointLocal: new CANNON.Vec3(this.width / 3, -this.height / 2 - 0.5, this.length / 3) },
        { radius: 0.5, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0), chassisConnectionPointLocal: new CANNON.Vec3(-this.width / 3, -this.height / 2 - 0.5, -this.length / 3) },
        { radius: 0.5, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0), chassisConnectionPointLocal: new CANNON.Vec3(this.width / 3, -this.height / 2 - 0.5, -this.length / 3) }
      ]
    });

    this.vehicle.addToWorld(this.game.physicsWorld.getWorld());

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      const wheel = this.vehicle.wheelBodies[i];
      this.wheels.push(wheel);
    }
  }

  createMesh() {
    const group = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(this.width, this.height, this.length);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cabinGeometry = new THREE.BoxGeometry(this.width * 0.8, this.height * 0.5, this.length * 0.4);
    const cabinMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.y = this.height * 0.5;
    cabin.castShadow = true;
    group.add(cabin);

    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });

    const wheelPositions = [
      [-this.width / 2 - 0.2, -this.height / 2, this.length / 3],
      [this.width / 2 + 0.2, -this.height / 2, this.length / 3],
      [-this.width / 2 - 0.2, -this.height / 2, -this.length / 3],
      [this.width / 2 + 0.2, -this.height / 2, -this.length / 3]
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.castShadow = true;
      group.add(wheel);
    });

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

    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - 0.1 * deltaTime);
    }
  }

  updateVehicle(deltaTime) {
    if (this.isDriving && this.fuel > 0) {
      const maxEngineForce = this.acceleration;
      const maxBrakingForce = this.braking;

      for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        const info = this.vehicle.wheelInfos[i];
        info.engineForce = this.engine * maxEngineForce;

        if (this.engine === 0) {
          info.brakingForce = maxBrakingForce;
        } else {
          info.brakingForce = 0;
        }

        if (i < 2) {
          info.steering = this.steering * this.turnSpeed;
        }
      }
    }

    this.vehicle.update(deltaTime);
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
    if (this.mesh) {
      this.game.scene.removeObject(this.mesh);
    }
    if (this.body) {
      this.game.physicsWorld.removeBody(this.body);
    }
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
