import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Stalker extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'stalker',
      health: 45,
      maxHealth: 45,
      damage: 20,
      speed: 3.5,
      attackRange: 2.4,
      aggroRange: 35,
      attackCooldown: 0.5
    });
    this._sprintCooldown = 0;
    this._sprinting = false;
    this._sprintTimer = 0;
    this._stealthMode = true;
  }

  createMesh() {
    // Gaunt ambush hunter: wasted frame, deep hunch, arms hanging limp,
    // very pale grey skin under a dark hoodie-like top.
    const { group } = this.buildHumanoid({
      bulk: 0.78,
      hunch: 0.55,
      armPose: 'hang',
      skinColor: 0x9aa095,
      shirtColor: 0x1d2126,
      pantsColor: 0x23262b,
      gore: 1,
      eyeEmissive: 0.5
    });
    this.finalizeMesh(group);
    // Starts hidden (stealth) until it spots the player
    this._setStealthOpacity(0.22);
  }

  // Fade all body materials for stealth. Traverses the mesh (materials are
  // shared between parts, so dedupe) — eyes keep their faint glow visible.
  _setStealthOpacity(opacity) {
    if (!this.mesh) return;
    const seen = new Set();
    this.mesh.traverse(c => {
      if (!c.isMesh || !c.material || seen.has(c.material)) return;
      seen.add(c.material);
      if ((c.material.emissiveIntensity ?? 0) >= 0.4) return; // eye glow stays visible
      c.material.opacity = opacity;
      c.material.transparent = opacity < 1;
    });
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._sprintCooldown > 0) this._sprintCooldown -= deltaTime;
    if (this._sprinting) {
      this._sprintTimer -= deltaTime;
      if (this._sprintTimer <= 0) {
        this._sprinting = false;
        this.speed = 3.5;
      }
    }
    // Stealth: transparent when idle, visible when chasing
    const shouldStealth = this.state === 'idle';
    if (shouldStealth !== this._stealthMode) {
      this._stealthMode = shouldStealth;
      this._setStealthOpacity(shouldStealth ? 0.22 : 1.0);
    }
    // Sprint charge when first spotting player at range
    if (this.state === 'chasing' && !this._sprinting && this._sprintCooldown <= 0) {
      const player = this.game.player;
      if (player) {
        const d = this.position.distanceTo(player.getPosition());
        if (d > 6 && d < 25) {
          this._sprinting = true;
          this._sprintTimer = 1.8;
          this._sprintCooldown = 8;
          this.speed = 9;
          // Screech sound
          this.game.audioManager?.playZombieGroan?.();
        }
      }
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    if (Math.random() < 0.5) wi.spawnItem('mat_leather', px, py, pz, 1);
    if (Math.random() < 0.3) wi.spawnItem('bandage', px + 0.3, py, pz, 1);
  }
}
