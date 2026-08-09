import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class Bomber extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'bomber',
      health: 30,
      maxHealth: 30,
      damage: 0,
      speed: 4.5,
      attackRange: 2.0,
      aggroRange: 35,
      attackCooldown: 999
    });
    this._primed = false;
    this._primeTimer = 0;
    this._flashTimer = 0;
    this._exploded = false;
    // NOTE: _flashMats and _detonatorMat are set in createMesh() (which runs
    // inside super()) — do not reset them here.
  }

  createMesh() {
    // A corpse strapped into a suicide vest
    const { group, refs } = this.buildHumanoid({
      shirtColor: 0x3a3f35,
      gore: 2
    });
    const tg = refs.torsoGroup;

    // Horizontal vest straps across the chest
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x2a2a25, roughness: 0.9 });
    for (const y of [0.28, 0.46]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.055, 0.31), strapMat);
      strap.position.set(0, y, 0);
      strap.castShadow = true;
      strap.receiveShadow = true;
      tg.add(strap);
    }

    // Five explosive canisters strapped vertically to the chest
    const canMat = new THREE.MeshStandardMaterial({ color: 0x7a2020, roughness: 0.55, metalness: 0.3 });
    for (let i = 0; i < 5; i++) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 8), canMat);
      can.position.set(-0.14 + i * 0.07, 0.37, 0.155);
      can.castShadow = true;
      can.receiveShadow = true;
      tg.add(can);
    }

    // Thin wires looping down from the canisters to the detonator
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x501212, roughness: 0.8 });
    const wire1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 5), wireMat);
    wire1.position.set(0.02, 0.26, 0.165);
    wire1.rotation.z = 1.15;
    wire1.castShadow = false;
    tg.add(wire1);
    const wire2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), wireMat);
    wire2.position.set(-0.11, 0.22, 0.16);
    wire2.rotation.z = -0.5;
    wire2.rotation.x = 0.25;
    wire2.castShadow = false;
    tg.add(wire2);

    // Detonator box with blinking red lamp (emissive sphere — no lights)
    const deton = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.06, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    deton.position.set(-0.11, 0.16, 0.15);
    deton.castShadow = true;
    deton.receiveShadow = true;
    tg.add(deton);
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff0000,
      emissiveIntensity: 1.2,
      roughness: 0.4
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), lampMat);
    lamp.position.set(-0.11, 0.2, 0.16);
    lamp.castShadow = false;
    tg.add(lamp);

    // Priming flash tints the body materials; the lamp pulses
    this._flashMats = [refs.skinMat, refs.shirtMat, refs.pantsMat];
    this._detonatorMat = lampMat;

    this.finalizeMesh(group);
  }

  checkAttack(player, distToPlayer) {
    // Bomber never does melee — instead prime when close
    if (!this._primed && !this._exploded && distToPlayer < this.attackRange) {
      this._primed = true;
      this._primeTimer = 1.5;

      const notif = document.getElementById('loot-notification');
      if (notif) {
        notif.textContent = '⚠ BOMBER PRIMED!';
        notif.style.color = '#ff4400';
        notif.classList.remove('show');
        void notif.offsetWidth;
        notif.classList.add('show');
      }
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    if (this._primed && !this._exploded) {
      this._primeTimer -= deltaTime;

      // Flash body red/white alternately while primed
      this._flashTimer += deltaTime;
      if (this._flashMats) {
        const flash = Math.sin(this._flashTimer * 18) > 0;
        for (const m of this._flashMats) {
          m.color.setHex(flash ? 0xff2200 : 0xffffff);
          m.emissive.setHex(flash ? 0xff0000 : 0x000000);
          m.emissiveIntensity = flash ? 1.5 : 0;
        }
      }
      if (this._detonatorMat) {
        this._detonatorMat.emissiveIntensity = 0.9 + Math.sin(this._flashTimer * 22) * 0.5;
      }

      if (this._primeTimer <= 0) {
        this._explode(false);
      }
    }
  }

  _explode(killedBeforePriming) {
    if (this._exploded) return;
    this._exploded = true;

    const fullExplode = !killedBeforePriming;
    const damage = this._primed && !killedBeforePriming ? 60 : 30;
    const radius = this._primed && !killedBeforePriming ? 4.0 : 2.0;

    const pos = this.position.clone();

    // Damage player if in radius
    const player = this.game.player;
    if (player) {
      const d = pos.distanceTo(player.getPosition());
      if (d < radius) {
        const falloff = Math.max(0, 1 - d / radius);
        const finalDmg = Math.round(damage * falloff);
        if (finalDmg > 0 && !player.godMode) {
          if (player.health - finalDmg <= 0 && player.setDeathCause) {
            player.setDeathCause('Bomber Explosion');
          }
          player.takeDamage(finalDmg);
        }
      }
    }

    // Damage nearby zombies in blast radius (friendly fire)
    const zombies = this.game.zombieManager?.getZombies() ?? [];
    for (const z of zombies) {
      if (z === this || z._dead) continue;
      const d = pos.distanceTo(z.position);
      if (d < radius) {
        const falloff = Math.max(0, 1 - d / radius);
        const splashDmg = Math.round(damage * 0.5 * falloff);
        if (splashDmg > 0) z.takeDamage(splashDmg);
      }
    }

    // Particle explosion (createExplosion returns undefined, so the old `?? blood`
    // always ALSO sprayed blood — pick one, don't sequence with ??)
    const ps = this.game.particleSystem;
    if (ps) {
      if (ps.createExplosion) ps.createExplosion(pos); else ps.createBlood(pos, 30);
      // Secondary smaller bursts
      for (let i = 0; i < 3; i++) {
        const offset = pos.clone().addScaledVector(
          new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
          Math.random() * radius * 0.5
        );
        setTimeout(() => {
          const p = this.game.particleSystem;
          if (!p) return;
          if (p.createExplosion) p.createExplosion(offset); else p.createBlood(offset, 12);
        }, 80 + i * 80);
      }
    }

    // Screen shake
    if (this.game.triggerScreenShake) {
      this.game.triggerScreenShake(fullExplode ? 0.6 : 0.3);
    } else if (this.game.camera) {
      // Fallback minimal camera shake
      const cam = this.game.camera;
      const origPos = cam.position.clone();
      const intensity = fullExplode ? 0.4 : 0.2;
      let t = 0;
      const shake = () => {
        t += 0.016;
        cam.position.x = origPos.x + (Math.random() - 0.5) * intensity * Math.max(0, 1 - t / 0.4);
        cam.position.y = origPos.y + (Math.random() - 0.5) * intensity * Math.max(0, 1 - t / 0.4);
        if (t < 0.4) requestAnimationFrame(shake);
        else cam.position.copy(origPos);
      };
      requestAnimationFrame(shake);
    }

    // Notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = fullExplode ? '💥 BOMBER DETONATED!' : '💥 Bomber destroyed!';
      notif.style.color = '#ff6600';
      notif.classList.remove('show');
      void notif.offsetWidth;
      notif.classList.add('show');
    }

    // Now die via base (which handles mesh cleanup, loot, etc.)
    super.die();
  }

  takeDamage(amount, isHeadshot = false) {
    if (this._exploded) return;
    super.takeDamage(amount, isHeadshot);
    // die() is called by super.takeDamage when health <= 0,
    // but we override die() to handle explosion logic
  }

  die() {
    if (this._dead) return;
    // Prevent double explosion: only explode if not already done
    if (!this._exploded) {
      if (this._primed) {
        // Killed while priming — partial explosion (reduced dmg/radius vs a full
        // self-detonation, rewarding the player for shooting it in time).
        this._explode(true);
      } else {
        // Killed before priming — no explosion, just die normally
        this._exploded = true; // mark so _explode is never called
        super.die();
      }
    }
  }

  dropLoot() {
    // Only drops on non-explosion death (before priming)
    if (this._primed) return; // exploded — no loot
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Always: gunpowder
    wi.spawnItem('mat_gunpowder', px, py, pz, 1);
    // 30%: explosive grenade
    if (Math.random() < 0.30) {
      wi.spawnItem('explosive_grenade', px + 0.3, py, pz, 1);
    }
  }
}
