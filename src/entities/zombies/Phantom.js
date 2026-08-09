import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Phantom extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'phantom',
      health: 55,
      maxHealth: 55,
      damage: 22,
      speed: 3.2,
      attackRange: 2.0,
      aggroRange: 50,
      attackCooldown: 1.2
    });
    this._phaseTimer = 0;       // counts up to next phase activation
    this._phaseCooldown = 12;   // seconds between phase activations
    this._phasing = false;      // currently invisible / teleported
    this._phaseDuration = 3.0;  // seconds the phase lasts
    this._phaseActiveTimer = 0; // how long the current phase has been active
  }

  createMesh() {
    // Gaunt ashen humanoid, cold glowing eyes, rendered semi-transparent
    const { group, refs } = this.buildHumanoid({
      bulk: 0.8,
      skinColor: 0xb0b4bc,
      shirtColor: 0x3a4048,
      eyeColor: 0x9ac8ff,
      eyeEmissive: 1.2,
      hunch: 0.2,
      gore: 2
    });

    // Ghostly translucence: collect every unique material and fade it.
    // _allMaterials also drives the phase invisibility fade in _setOpacity().
    this._baseOpacity = 0.55;
    const mats = new Set();
    group.traverse(c => {
      if (c.isMesh && c.material) mats.add(c.material);
    });
    this._allMaterials = [...mats];
    for (const mat of this._allMaterials) {
      mat.transparent = true;
      mat.opacity = this._baseOpacity;
    }
    // A translucent ghost shouldn't throw a solid black shadow
    group.traverse(c => { if (c.isMesh) c.castShadow = false; });

    this.finalizeMesh(group);
    // Floating offset — Phantom hovers slightly above the ground
    this.mesh.position.y += 0.3;
  }

  _setOpacity(opacity) {
    if (!this._allMaterials) return;
    for (const mat of this._allMaterials) {
      mat.opacity = opacity;
      mat.transparent = true;
    }
  }

  _activatePhase() {
    this._phasing = true;
    this._phaseActiveTimer = 0;

    // Go fully invisible
    this._setOpacity(0);

    // Teleport 8m behind the player
    const player = this.game.player;
    if (player && this.body) {
      const playerPos = player.getPosition();
      // "Behind" = opposite of the direction the player faces
      // Approximate from player camera or velocity; fall back to zombie-relative direction
      let behindX, behindZ;
      if (player.body) {
        const pvx = player.body.velocity.x;
        const pvz = player.body.velocity.z;
        const spd = Math.sqrt(pvx * pvx + pvz * pvz);
        if (spd > 0.5) {
          // Behind = against player's movement direction
          behindX = playerPos.x - (pvx / spd) * 8;
          behindZ = playerPos.z - (pvz / spd) * 8;
        } else {
          // Player is still — teleport to the side opposite from zombie
          const dx = playerPos.x - this.position.x;
          const dz = playerPos.z - this.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz) || 1;
          behindX = playerPos.x - (dx / dist) * 8;
          behindZ = playerPos.z - (dz / dist) * 8;
        }
      } else {
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        behindX = playerPos.x - (dx / dist) * 8;
        behindZ = playerPos.z - (dz / dist) * 8;
      }

      const groundY = this.game.terrainGenerator?.getHeightAt(behindX, behindZ) ?? playerPos.y;
      this.body.position.set(behindX, groundY + 1.2, behindZ);
      this.body.velocity.set(0, 0, 0);
      this.position.copy(this.body.position);
      if (this.mesh) {
        this.mesh.position.copy(this.position);
        this.mesh.position.y += 0.3;
      }
    }
  }

  _deactivatePhase() {
    this._phasing = false;
    this._phaseTimer = 0;

    // Restore semi-transparent resting opacity
    this._setOpacity(this._baseOpacity ?? 0.55);
  }

  update(deltaTime) {
    super.update(deltaTime);

    if (this._dead) return;

    // Floating bob effect — gentle sine wave on Y
    if (this.mesh) {
      const bobOffset = Math.sin(Date.now() * 0.002) * 0.08;
      this.mesh.position.y = this.position.y + 0.3 + bobOffset;
    }

    if (this._phasing) {
      // Count down phase duration
      this._phaseActiveTimer += deltaTime;
      if (this._phaseActiveTimer >= this._phaseDuration) {
        this._deactivatePhase();
      }
    } else {
      // Count up to next phase trigger (only when chasing/attacking)
      if (this.state === 'chasing' || this.state === 'attacking') {
        this._phaseTimer += deltaTime;
        if (this._phaseTimer >= this._phaseCooldown) {
          this._activatePhase();
        }
      }
    }
  }

  checkAttack(player, distToPlayer) {
    // Override to handle backstab multiplier while invisible
    if (this.state === 'attacking' && distToPlayer < this.attackRange && this.lastAttackTime >= this.attackCooldown) {
      let attackDamage = this.damage;

      if (this._phasing) {
        // Backstab: 3x damage when invisible
        attackDamage = this.damage * 3;
      }

      if (player.health - attackDamage <= 0 && player.setDeathCause) {
        player.setDeathCause(this._phasing ? 'Backstabbed by a Phantom' : 'Killed by a Phantom');
      }
      player.takeDamage(attackDamage);
      this.game.audioManager?.resume?.();
      this.game.audioManager?.playZombieHit?.();

      // Backstab notification + fear debuff slows player briefly
      if (this._phasing) {
        const notifEl = document.getElementById('loot-notification');
        if (notifEl) {
          notifEl.textContent = '👁 BACKSTAB!';
          notifEl.style.color = '#cc88ff';
          notifEl.classList.remove('show');
          void notifEl.offsetWidth;
          notifEl.classList.add('show');
        }
        // Fear: slow player movement for 3 seconds
        if (!player._fearTimer || player._fearTimer <= 0) {
          const origSpeed = player.moveSpeed ?? 5;
          player.moveSpeed = origSpeed * 0.55;
          player._fearTimer = 3.0;
          // HUD notification for fear
          setTimeout(() => { player.moveSpeed = origSpeed; }, 3000);
        }
      }

      // Knockback
      if (player.body) {
        const dx = player.getPosition().x - this.position.x;
        const dz = player.getPosition().z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        player.body.velocity.x += (dx / dist) * 4;
        player.body.velocity.z += (dz / dist) * 4;
        player.body.velocity.y = Math.max(player.body.velocity.y, 2.5);
      }

      // Status effects (same chance as base)
      const notifEl = document.getElementById('loot-notification');
      if (Math.random() < 0.15 && !player._infected && !player._immuneInfect) {
        player._infected = true;
        player._infectTimer = 0;
        if (notifEl && !this._phasing) { notifEl.textContent = '⚠ Infected!'; notifEl.style.color = '#44ff44'; notifEl.classList.remove('show'); void notifEl.offsetWidth; notifEl.classList.add('show'); }
      } else if (Math.random() < 0.20 && !player._bleeding) {
        player._bleeding = true;
        player._bleedTimer = 12;
        if (notifEl && !this._phasing) { notifEl.textContent = '🩸 Bleeding!'; notifEl.style.color = '#ff3333'; notifEl.classList.remove('show'); void notifEl.offsetWidth; notifEl.classList.add('show'); }
      }

      this.lastAttackTime = 0;
    }
  }

  takeDamage(amount, isHeadshot = false) {
    // 25% damage reduction while phasing/invisible
    const reduced = this._phasing ? amount * 0.75 : amount;
    super.takeDamage(reduced, isHeadshot);
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    if (Math.random() < 0.55) wi.spawnItem('mat_duct_tape', px, py, pz, 1);
    if (Math.random() < 0.40) wi.spawnItem('bandage', px + 0.3, py, pz, 1);
    if (Math.random() < 0.25) wi.spawnItem('med_vitamins', px, py, pz + 0.3, 1);
  }
}
