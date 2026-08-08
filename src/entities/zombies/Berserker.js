import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Berserker extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'berserker',
      health: 65,
      maxHealth: 65,
      damage: 14,
      speed: 2.8,
      attackRange: 2.2,
      aggroRange: 32,
      attackCooldown: 1.0
    });
    this._enraged = false;
    this._rageParticleTimer = 0;
  }

  createMesh() {
    // Enraged bruiser: shirtless, heavy build, reddish decayed skin, charging
    // forward with reaching arms and heavy gore.
    const { group, refs } = this.buildHumanoid({
      shirtless: true,
      bulk: 1.3,
      gore: 6,
      skinColor: 0x8a6a58,
      armPose: 'reach',
      hunch: 0.4,
      eyeColor: 0xcc2200,
      eyeEmissive: 0.7
    });

    // Oversized clenched fists
    refs.armL.hand.scale.set(1.9, 1.5, 2.0);
    refs.armR.hand.scale.set(1.9, 1.5, 2.0);

    // Blood flecks spattered across chest and forearms
    const fleckSpots = [
      [refs.torsoGroup, 0.26, 0.32, 0.2],
      [refs.armL.elbow, 0.06, -0.12, 0.05],
      [refs.armR.elbow, 0.06, -0.12, 0.05]
    ];
    for (const [parent, spreadX, cy, cz] of fleckSpots) {
      for (let i = 0; i < 3; i++) {
        const fleck = new THREE.Mesh(new THREE.SphereGeometry(0.02 + Math.random() * 0.02, 6, 5), refs.goreMat);
        fleck.position.set((Math.random() - 0.5) * spreadX, cy + (Math.random() - 0.5) * 0.18, cz);
        fleck.scale.z = 0.3;
        fleck.castShadow = false;
        parent.add(fleck);
      }
    }

    // Rage aura — invisible until triggered (red emissive shell around body)
    const auraMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff1111,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.0,
      side: THREE.BackSide,
      depthWrite: false
    });
    this._rageAura = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), auraMat);
    this._rageAura.position.y = 0.1;
    this._rageAura.castShadow = false;
    this._rageAura.receiveShadow = false;
    group.add(this._rageAura);

    // Rage tint targets: skin + pants materials are shared across all body
    // parts, so one mesh per unique material covers the whole body.
    this._bodyMeshes = [refs.chest, refs.pelvis];

    // Eyes share one material inside the head group — grab one mesh so the
    // rage white-hot eye effect still works.
    let eyeMesh = null;
    refs.headGroup.traverse(c => {
      if (!eyeMesh && c.isMesh && (c.material?.emissiveIntensity ?? 0) >= 0.4) eyeMesh = c;
    });
    this._leftEye = eyeMesh;
    this._rightEye = eyeMesh;

    this.finalizeMesh(group);
  }

  _triggerRage() {
    if (this._enraged) return;
    this._enraged = true;

    // Update stats
    this.speed = 5.5;
    this.damage = 22;
    this.attackCooldown = 0.4;

    // Turn body bright red
    if (this._bodyMeshes) {
      for (const m of this._bodyMeshes) {
        if (m.material) {
          m.material.color.setHex(0xdd1111);
          m.material.emissive = new THREE.Color(0x880000);
          m.material.emissiveIntensity = 0.55;
        }
      }
    }
    // Eyes go white-hot
    if (this._leftEye?.material) { this._leftEye.material.color.setHex(0xffffff); this._leftEye.material.emissive.setHex(0xffffff); this._leftEye.material.emissiveIntensity = 1.5; }
    if (this._rightEye?.material) { this._rightEye.material.color.setHex(0xffffff); this._rightEye.material.emissive.setHex(0xffffff); this._rightEye.material.emissiveIntensity = 1.5; }

    // Rage aura becomes visible
    if (this._rageAura?.material) {
      this._rageAura.material.opacity = 0.18;
      this._rageAura.material.emissiveIntensity = 1.2;
    }

    // Blood burst particles
    if (this.game.particleSystem?.createBlood) {
      this.game.particleSystem.createBlood(this.position.clone(), 25);
    }

    // Emit noise roar — wakes nearby zombies too
    if (this.game._emitNoise) {
      this.game._emitNoise(this.position.x, this.position.z, 30);
    }
    this.game.audioManager?.playZombieGroan?.();

    // Knockback nearby player
    const player = this.game.player;
    if (player) {
      const d = this.position.distanceTo(player.getPosition());
      if (d < 8 && player.body) {
        const dx = player.getPosition().x - this.position.x;
        const dz = player.getPosition().z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        const force = Math.max(4, 10 * (1 - d / 8));
        player.body.velocity.x += (dx / dist) * force;
        player.body.velocity.z += (dz / dist) * force;
        player.body.velocity.y = Math.max(player.body.velocity.y, 3.5);
      }
    }

    // Rage notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '⚠ Berserker ENRAGED!';
      notif.style.color = '#ff4422';
      notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
    }
  }

  takeDamage(amount, isHeadshot = false) {
    super.takeDamage(amount, isHeadshot);
    // Check rage threshold after damage
    if (!this._enraged && this.health <= this.maxHealth * 0.5 && !this._dead) {
      this._triggerRage();
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Pulsing rage aura
    if (this._enraged) {
      this._rageParticleTimer += deltaTime;
      if (this._rageAura?.material) {
        this._rageAura.material.opacity = 0.12 + Math.sin(Date.now() * 0.008) * 0.06;
        this._rageAura.material.emissiveIntensity = 1.0 + Math.sin(Date.now() * 0.01) * 0.4;
      }
      // Periodic rage particles
      if (this._rageParticleTimer >= 1.2) {
        this._rageParticleTimer = 0;
        if (this.game.particleSystem?.createBlood) {
          const pos = this.position.clone();
          pos.x += (Math.random() - 0.5) * 0.5;
          pos.z += (Math.random() - 0.5) * 0.5;
          this.game.particleSystem.createBlood(pos, 4);
        }
      }
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    wi.spawnItem('food_cooked_meat', px, py, pz, 1);
    if (Math.random() < 0.4) {
      const weapon = Math.random() < 0.5 ? 'weapon_crowbar' : 'weapon_axe';
      wi.spawnItem(weapon, px + 0.3, py, pz, 1);
    }
  }
}
