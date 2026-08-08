import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class NPC {
  constructor(name, type, x, z, game) {
    this.game = game;
    this.name = name;
    this.type = type;
    this.id = name.toLowerCase().replace(' ', '_');
    this.position = new THREE.Vector3(x, game.terrainGenerator.getHeightAt(x, z) + 1, z);
    this.velocity = new THREE.Vector3();

    this.health = 100;
    this.maxHealth = 100;
    this.isRecruited = false;
    this.dialogues = [];
    this.currentDialogIndex = 0;
    this.distanceToPlayer = 0;

    this.mesh = null;
    this.body = null;
    this.setupPhysics();
    this.createMesh();
  }

  setupPhysics() {
    const shape = new CANNON.Cylinder(0.4, 0.4, 1.8, 8);
    // mass: 0 = kinematic — removed from dynamics solver, no physics pileup
    this.body = new CANNON.Body({ mass: 0 });
    this.body.addShape(shape);
    this.body.position.copy(this.position);
    this.body.fixedRotation = true;
    this.game.physicsWorld.addBody(this.body);
  }

  createMesh() {
    const group = new THREE.Group();

    const colors = {
      mayor: 0x4444ff,
      merchant: 0xff8800,
      soldier: 0x444444,
      scientist: 0x00ff44
    };

    const bodyColor = colors[this.type] || 0x8888ff;

    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    group.position.copy(this.position);
    this.game.scene.addObject(group);
    this.mesh = group;
  }

  createNameTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#00ff00';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, 45);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  setupDialogues(dialogues) {
    this.dialogues = dialogues;
  }

  startDialog() {
    this.currentDialogIndex = 0;
  }

  update(deltaTime) {
    if (!this.body || !this.mesh) return;

    // Snap kinematic body to terrain
    const groundY = this.game.terrainGenerator?.getHeightAt(this.body.position.x, this.body.position.z) ?? 0;
    if (isFinite(groundY)) this.body.position.y = groundY + 0.9;

    this.position.copy(this.body.position);
    this.mesh.position.copy(this.position);
  }

  getPosition() {
    return this.position.clone();
  }

  speak(text) {
    console.log(`${this.name}: ${text}`);
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    if (this.mesh) {
      this.game.scene.removeObject(this.mesh);
    }
    if (this.body) {
      this.game.physicsWorld.removeBody(this.body);
    }
  }

  isAlive() {
    return this.health > 0;
  }

  recruit() {
    this.isRecruited = true;
  }
}
