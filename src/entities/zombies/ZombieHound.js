import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ZombieBase } from './ZombieBase.js';

export class ZombieHound extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'zombie_hound',
      health: 20,
      maxHealth: 20,
      damage: 14,
      speed: 6.5,
      attackRange: 1.8,
      aggroRange: 50,
      attackCooldown: 0.7
    });
  }

  setupPhysics() {
    // Shorter, flatter cylinder — hard to hit, stays low
    const shape = new CANNON.Cylinder(0.35, 0.35, 0.7, 8);
    this.body = new CANNON.Body({ mass: 1 });
    this.body.addShape(shape);
    this.body.position.copy(this.position);
    this.body.linearDamping = 0.3;
    this.body.angularDamping = 1;
    this.body.fixedRotation = true;
    this.game.physicsWorld.addBody(this.body);
  }

  createMesh() {
    // Fully custom quadruped. The physics body center rides 0.9m above the
    // ground (base grounding clamp), so the dog is built low: it stands on
    // local y = -0.9, shoulder ~0.65m above ground (local ~ -0.25).
    const group = new THREE.Group();

    const skinMat  = new THREE.MeshStandardMaterial({ color: 0x6a5f4e, roughness: 0.95 }); // mangy brown-grey
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x51483a, roughness: 0.95 });
    const goreMat  = new THREE.MeshStandardMaterial({ color: 0x5a1010, roughness: 0.85 });
    const boneMat  = new THREE.MeshStandardMaterial({ color: 0xc9bda4, roughness: 0.7 });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8d2be, roughness: 0.5 });

    const M = (geo, mat, x, y, z, parent = group) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // Horizontal body: deeper chest capsule + narrower rear, ~1.1m nose to tail base
    const chest = M(new THREE.CapsuleGeometry(0.14, 0.3, 4, 10), skinMat, 0, -0.35, 0.12);
    chest.rotation.x = Math.PI / 2;
    const rear = M(new THREE.CapsuleGeometry(0.11, 0.26, 4, 10), skinMat, 0, -0.38, -0.26);
    rear.rotation.x = Math.PI / 2;

    // Rib gore patch on the right flank with exposed rib arcs
    const wound = M(new THREE.SphereGeometry(0.1, 8, 6), goreMat, 0.115, -0.34, 0.1);
    wound.scale.set(0.35, 0.75, 1.1);
    wound.castShadow = false;
    for (let i = 0; i < 3; i++) {
      const rib = M(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 5), boneMat, 0.14, -0.34, 0.02 + i * 0.07);
      rib.rotation.z = 0.3;
      rib.castShadow = false;
    }

    // Mange: bald darker patches along the back
    for (const [px, py, pz] of [[-0.07, -0.22, -0.12], [0.05, -0.21, 0.18], [-0.09, -0.3, -0.34]]) {
      const patch = M(new THREE.SphereGeometry(0.055, 6, 5), darkMat, px, py, pz);
      patch.scale.y = 0.35;
      patch.castShadow = false;
    }

    // Legs: upper pivot group at the body, thin capsules with paw boxes
    const mkLeg = (x, z) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, -0.36, z);
      pivot.userData.baseRotX = 0;
      group.add(pivot);
      M(new THREE.CapsuleGeometry(0.038, 0.2, 4, 8), skinMat, 0, -0.14, 0, pivot);
      M(new THREE.CapsuleGeometry(0.028, 0.18, 4, 8), darkMat, 0, -0.38, 0.01, pivot);
      M(new THREE.BoxGeometry(0.065, 0.05, 0.1), darkMat, 0, -0.51, 0.03, pivot);
      return pivot;
    };
    // Diagonal trot for free: base update() gives arms and legs opposite phases
    this._leftArm  = mkLeg(-0.11,  0.3);  // front-left
    this._rightArm = mkLeg( 0.11,  0.3);  // front-right
    this._leftLeg  = mkLeg(-0.11, -0.38); // hind-left
    this._rightLeg = mkLeg( 0.11, -0.38); // hind-right

    // Neck angled up-forward to the head
    const neck = M(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), skinMat, 0, -0.31, 0.33);
    neck.rotation.x = 1.1;

    // Dog head, held low in a prowl (~0.62m above ground)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, -0.28, 0.45);
    group.add(headGroup);
    M(new THREE.BoxGeometry(0.15, 0.12, 0.15), skinMat, 0, 0, 0, headGroup);
    M(new THREE.BoxGeometry(0.085, 0.075, 0.16), skinMat, 0, -0.025, 0.14, headGroup); // snout
    const nose = M(new THREE.SphereGeometry(0.028, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4 }), 0, -0.005, 0.225, headGroup);
    nose.castShadow = false;
    // Ears
    for (const side of [-1, 1]) {
      const ear = M(new THREE.ConeGeometry(0.03, 0.08, 5), darkMat, side * 0.05, 0.09, -0.02, headGroup);
      ear.rotation.x = -0.25;
      ear.rotation.z = side * -0.2;
    }
    // Open mouth: hanging lower jaw, gore-filled, with teeth
    const jaw = M(new THREE.BoxGeometry(0.07, 0.028, 0.14), skinMat, 0, -0.09, 0.11, headGroup);
    jaw.rotation.x = 0.45;
    const mouthGore = M(new THREE.BoxGeometry(0.06, 0.045, 0.11), goreMat, 0, -0.06, 0.13, headGroup);
    mouthGore.castShadow = false;
    for (let i = 0; i < 4; i++) {
      const tooth = M(new THREE.BoxGeometry(0.012, 0.024, 0.012), toothMat, -0.027 + i * 0.018, -0.048, 0.2, headGroup);
      tooth.castShadow = false;
    }
    // Sickly glowing eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xd8c94a, emissive: 0xd8c94a, emissiveIntensity: 1.0, roughness: 0.35
    });
    this._eyeMat = eyeMat;
    for (const side of [-1, 1]) {
      const eye = M(new THREE.SphereGeometry(0.022, 6, 5), eyeMat, side * 0.05, 0.03, 0.078, headGroup);
      eye.castShadow = false;
    }

    // Thin tail, tapered and angled up-back
    const tail = M(new THREE.CylinderGeometry(0.008, 0.022, 0.38, 6), darkMat, 0, -0.28, -0.5);
    tail.rotation.x = -1.0;

    // Head sits below the physics-body center; low bar for the short dog
    this.headshotY = 0.1;
    this._healthBarHeight = 0.55;

    this.finalizeMesh(group);
  }

  // Hound is always chasing — skip idle, aggroRange handles it
  updateState(distToPlayer) {
    const player = this.game.player;

    // Wake up from noise events (inherited logic)
    if (this.state === 'idle' && this.game._noiseEvents) {
      for (const evt of this.game._noiseEvents) {
        const dx = evt.x - this.position.x;
        const dz = evt.z - this.position.z;
        if (dx * dx + dz * dz < evt.radius * evt.radius) {
          this.state = 'chasing';
          break;
        }
      }
    }

    // Always transition out of idle — hounds are perpetually alert
    if (this.state === 'idle') {
      if (distToPlayer <= this.aggroRange) {
        this.state = 'chasing';
        this.pathRecalcTimer = 0;
      }
      return;
    }

    switch (this.state) {
      case 'chasing':
        // Never give up the chase — only stop at aggro * 1.5
        if (distToPlayer > this.aggroRange * 1.5) {
          this.state = 'idle';
          this.currentPath = [];
        } else if (distToPlayer < this.attackRange) {
          this.state = 'attacking';
        }
        break;

      case 'attacking':
        if (distToPlayer > this.attackRange * 1.8) {
          this.state = 'chasing';
          this.pathRecalcTimer = 0;
        }
        break;
    }
  }

  // Override: 70% damage from weapons; headshots still multiplied by base 2.5x then reduced
  takeDamage(amount, isHeadshot = false) {
    super.takeDamage(amount * 0.7, isHeadshot);
  }

  // Override: pack attack callout on bite
  checkAttack(player, distToPlayer) {
    if (
      this.state === 'attacking' &&
      distToPlayer < this.attackRange &&
      this.lastAttackTime >= this.attackCooldown
    ) {
      if (player.health - this.damage <= 0 && player.setDeathCause) {
        player.setDeathCause('Mauled by Zombie Hound');
      }
      player.takeDamage(this.damage);
      this.game.audioManager?.resume?.();
      this.game.audioManager?.playZombieHit?.();

      // Knockback
      if (player.body) {
        const dx = player.getPosition().x - this.position.x;
        const dz = player.getPosition().z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        player.body.velocity.x += (dx / dist) * 3.5;
        player.body.velocity.z += (dz / dist) * 3.5;
        player.body.velocity.y = Math.max(player.body.velocity.y, 2.0);
      }

      // Status effects (inherited rates)
      const notifEl = document.getElementById('loot-notification');
      if (Math.random() < 0.15 && !player._infected) {
        player._infected = true;
        player._infectTimer = 0;
        if (notifEl) { notifEl.textContent = '⚠ Infected!'; notifEl.style.color = '#44ff44'; notifEl.classList.remove('show'); void notifEl.offsetWidth; notifEl.classList.add('show'); }
      } else if (Math.random() < 0.20 && !player._bleeding) {
        player._bleeding = true;
        player._bleedTimer = 12;
        if (notifEl) { notifEl.textContent = '🩸 Bleeding!'; notifEl.style.color = '#ff3333'; notifEl.classList.remove('show'); void notifEl.offsetWidth; notifEl.classList.add('show'); }
      }

      this.lastAttackTime = 0;

      // Pack attack: 40% chance to rally nearby hounds
      if (Math.random() < 0.4) {
        this._callPackAttack();
      }
    }
  }

  _callPackAttack() {
    const zombies = this.game.zombieManager?.getZombies() ?? [];
    for (const z of zombies) {
      if (z === this || z._dead) continue;
      if (z.type !== 'zombie_hound') continue;
      const dx = z.position.x - this.position.x;
      const dz = z.position.z - this.position.z;
      if (dx * dx + dz * dz <= 20 * 20) {
        // Wake the hound and force it to chase immediately
        z.state = 'chasing';
        z.pathRecalcTimer = 0;
      }
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Leg animation: handled by the base walk swing — the front pivots are
    // registered as _leftArm/_rightArm, so diagonal pairs trot automatically.

    // Pulse eyes
    if (this._eyeMat) {
      this._eyeMat.emissiveIntensity = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // 30% cooked meat
    if (Math.random() < 0.30) {
      wi.spawnItem('food_cooked_meat', px, py, pz, 1);
    }
    // 20% leather (independent roll)
    if (Math.random() < 0.20) {
      wi.spawnItem('mat_leather', px + 0.2, py, pz, 1);
    }
  }
}
