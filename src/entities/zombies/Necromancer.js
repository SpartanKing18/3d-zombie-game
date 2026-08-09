import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ZombieBase } from './ZombieBase.js';

export class Necromancer extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'necromancer',
      health: 70,
      maxHealth: 70,
      damage: 10,
      speed: 1.8,
      attackRange: 2.0,
      aggroRange: 40,
      attackCooldown: 2.5
    });

    this._resTimer = 0;
    this._resInterval = 15;

    // Magical shield absorbs first 30 damage before health is touched
    this._shieldHP = 30;
    this._shieldMax = 30;
    // createMesh() already ran inside super() — don't clobber the refs it set
    this._shieldMesh = this._shieldMesh ?? null;
    this._shieldMat = this._shieldMat ?? null;

    // Floating rune rings created in createMesh; store refs for animation
    this._runeRings = this._runeRings ?? [];
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      scale: 1.05,
      armPose: 'none',
      hunch: 0.18,
      bald: true,
      eyeColor: 0x9b40ff,
      eyeEmissive: 1.3
    });

    // Grab the shared eye material so update() can pulse the glow
    this._eyeMat = null;
    refs.headGroup.traverse(c => {
      if (c.isMesh && c.material?.emissive?.getHex() === 0x9b40ff) this._eyeMat = c.material;
    });

    // Arms half-raised in a channeling pose
    for (const [arm, zOut] of [[refs.armL, -0.2], [refs.armR, 0.2]]) {
      arm.shoulder.rotation.x = -0.9;
      arm.shoulder.userData.baseRotX = -0.9;
      arm.shoulder.rotation.z = zOut;
      arm.elbow.rotation.x = -0.45;
    }

    // Dark robe: open skirt from chest to ankles
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x1e1a24, roughness: 0.97, metalness: 0, side: THREE.DoubleSide
    });
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.34, 1.15, 10, 1, true), robeMat);
    robe.position.y = -0.18;
    robe.castShadow = true; robe.receiveShadow = true;
    refs.torsoGroup.add(robe);
    // Ragged hem strips
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + 0.2;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09 + Math.random() * 0.07, 0.018), robeMat);
      strip.position.set(Math.cos(ang) * 0.32, -0.78, Math.sin(ang) * 0.32);
      strip.rotation.y = -ang;
      strip.rotation.x = (Math.random() - 0.5) * 0.3;
      strip.castShadow = true;
      refs.torsoGroup.add(strip);
    }

    // Hood: open shell around the head, pulled forward to shadow the face
    const hoodMat = new THREE.MeshStandardMaterial({
      color: 0x241f2e, roughness: 0.95, metalness: 0, side: THREE.DoubleSide
    });
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hoodMat
    );
    hood.position.set(0, 0.17, -0.01);
    hood.scale.set(1.0, 1.25, 1.08);
    hood.rotation.x = 0.35;
    hood.castShadow = true;
    refs.headGroup.add(hood);

    // Face darkened in the hood's shadow (own material so hands stay skin-toned)
    const faceMat = refs.skinMat.clone();
    faceMat.color.multiplyScalar(0.45);
    refs.skull.material = faceMat;

    // Bone staff held upright in the raised right hand, skull totem on top
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 0.8 });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.6, 7), boneMat);
    staff.position.set(0, -0.27, 0.03);
    staff.rotation.x = 1.2; // roughly vertical in world once the arm pose is applied
    staff.castShadow = true;
    refs.armR.elbow.add(staff);
    this._staff = staff;
    const totem = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), boneMat);
    totem.position.set(0, 0.02, 0.77);
    totem.scale.set(0.85, 1, 0.9);
    totem.castShadow = true;
    refs.armR.elbow.add(totem);
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x9b40ff, emissive: 0x9b40ff, emissiveIntensity: 1.2, roughness: 0.3 })
    );
    gem.position.set(0, 0.09, 0.8);
    gem.castShadow = false;
    refs.armR.elbow.add(gem);

    // Floating rune rings — 3 TorusGeometry rings orbiting the Necromancer
    this._runeRings = [];
    const runeColors = [0xcc44ff, 0x8822cc, 0xff88ff];
    for (let i = 0; i < 3; i++) {
      const runeGeo = new THREE.TorusGeometry(0.24 + i * 0.08, 0.013, 5, 20);
      const runeMat = new THREE.MeshStandardMaterial({
        color: runeColors[i],
        emissive: runeColors[i],
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85,
        roughness: 0.5
      });
      const ring = new THREE.Mesh(runeGeo, runeMat);
      // Each ring at a slightly different height around mid-body (origin = body center)
      ring.position.set(0, -0.15 + i * 0.3, 0);
      ring.rotation.x = Math.PI / 2 + i * (Math.PI / 5);
      ring.rotation.z = i * (Math.PI / 4);
      group.add(ring);
      this._runeRings.push(ring);
    }

    // Magical shield sphere — translucent blue, hidden when broken
    const shieldGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      emissive: 0x2244cc,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 0.05;
    shieldMesh.renderOrder = 1;
    group.add(shieldMesh);
    this._shieldMesh = shieldMesh;
    this._shieldMat = shieldMat;

    this.finalizeMesh(group);
  }

  // Shield absorbs damage before health
  takeDamage(amount, isHeadshot = false) {
    if (this._shieldHP > 0) {
      const absorbed = Math.min(this._shieldHP, isHeadshot ? amount * 2.5 : amount);
      this._shieldHP -= absorbed;

      // Hit flash on shield
      if (this._shieldMesh && this._shieldMat) {
        const origOpacity = this._shieldMat.opacity;
        this._shieldMat.opacity = 0.7;
        setTimeout(() => { if (this._shieldMat) this._shieldMat.opacity = origOpacity; }, 100);
      }

      const remainder = (isHeadshot ? amount * 2.5 : amount) - absorbed;

      if (this._shieldHP <= 0) {
        // Shield broken — hide it
        if (this._shieldMesh) this._shieldMesh.visible = false;

        // Show shield-broken notification
        const notif = document.getElementById('loot-notification');
        if (notif) {
          notif.textContent = '🛡 Necromancer shield broken!';
          notif.style.color = '#88aaff';
          notif.classList.remove('show');
          void notif.offsetWidth;
          notif.classList.add('show');
        }
      }

      // Apply any remainder to health (pass raw remainder, not re-scaled)
      if (remainder > 0) {
        // Call grandparent logic directly to avoid double-scaling
        this._applyHealthDamage(remainder, isHeadshot);
      }
      return;
    }

    // Shield is down — take damage normally
    super.takeDamage(amount, isHeadshot);
  }

  // Apply health damage without shield interception (used after shield breaks mid-hit)
  _applyHealthDamage(finalAmount, isHeadshot = false) {
    this.health -= finalAmount;

    // Guarded hit flash: materials are shared across meshes, so dedupe them and
    // guard with _hitFlashing — otherwise a second hit inside the 80ms window
    // captures the red 0xff2222 as the "original" and the body stays red.
    if (this.mesh && !this._dead && !this._hitFlashing) {
      clearTimeout(this._hitFlashTimer);
      this._hitFlashColors = [];
      const seen = new Set();
      this.mesh.traverse(child => {
        if (child.isMesh && child.material && !seen.has(child.material)) {
          seen.add(child.material);
          this._hitFlashColors.push({ mat: child.material, hex: child.material.color.getHex() });
          child.material.color.set(0xff2222);
        }
      });
      this._hitFlashing = true;
      this._hitFlashTimer = setTimeout(() => {
        this._hitFlashing = false;
        for (const { mat, hex } of (this._hitFlashColors || [])) { if (mat) mat.color.setHex(hex); }
        this._hitFlashColors = [];
      }, 80);
    }

    this._spawnDamageNumber(Math.round(finalAmount), isHeadshot);

    if (this.health <= 0 && !this._dead) {
      this.die();
    }
  }

  // Staff strike: AoE 1.5m knock on melee hit
  checkAttack(player, distToPlayer) {
    if (
      this.state === 'attacking' &&
      distToPlayer < this.attackRange &&
      this.lastAttackTime >= this.attackCooldown
    ) {
      if (player.health - this.damage <= 0 && player.setDeathCause) {
        player.setDeathCause('Struck by Necromancer staff');
      }
      player.takeDamage(this.damage);
      this.game.audioManager?.resume?.();
      this.game.audioManager?.playZombieHit?.();

      // AoE knockback — strong push away
      if (player.body) {
        const dx = player.getPosition().x - this.position.x;
        const dz = player.getPosition().z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        // Staff strike: bigger knockback within 1.5m AoE range
        if (dist <= 1.5) {
          player.body.velocity.x += (dx / dist) * 7;
          player.body.velocity.z += (dz / dist) * 7;
          player.body.velocity.y = Math.max(player.body.velocity.y, 4);
        }
      }

      // Status effects
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
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Resurrection timer
    this._resTimer += deltaTime;
    if (this._resTimer >= this._resInterval) {
      this._resTimer = 0;
      this._tryResurrect();
    }

    // Animate floating rune rings
    const t = Date.now() * 0.001;
    for (let i = 0; i < this._runeRings.length; i++) {
      const ring = this._runeRings[i];
      // Each ring rotates at a slightly different speed and axis
      ring.rotation.y = t * (0.8 + i * 0.35);
      ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.5 + i) * 0.4 + i * (Math.PI / 5);
    }

    // Pulse eye glow
    if (this._eyeMat) {
      this._eyeMat.emissiveIntensity = 0.8 + Math.sin(t * 3.5) * 0.5;
    }

    // Pulse shield if active
    if (this._shieldMesh && this._shieldMesh.visible && this._shieldMat) {
      this._shieldMat.opacity = 0.15 + Math.sin(t * 2.5) * 0.08;
    }
  }

  _tryResurrect() {
    // Ensure the dead-corpse list exists
    if (!this.game._deadZombieCorpses) return;
    const corpses = this.game._deadZombieCorpses;
    if (corpses.length === 0) return;

    // Find corpses in range (20m)
    const inRange = [];
    for (const z of corpses) {
      if (!z || !z._dead) continue;
      const dx = z.position.x - this.position.x;
      const dz = z.position.z - this.position.z;
      if (dx * dx + dz * dz <= 20 * 20) {
        inRange.push(z);
      }
    }

    if (inRange.length === 0) return;

    // Pick a random corpse
    const target = inRange[Math.floor(Math.random() * inRange.length)];
    this._resurrect(target);

    // Remove from corpse list
    const idx = corpses.indexOf(target);
    if (idx !== -1) corpses.splice(idx, 1);
  }

  _resurrect(zombie) {
    // revive() restores the corpse mesh, physics (with correct collision filters),
    // health bar and state; it fails if the corpse already faded away
    if (!zombie?.revive || !zombie.revive(0.5)) return;

    // Re-add to zombie manager's alive list
    try {
      this.game.zombieManager?.addZombie?.(zombie);
    } catch (e) {}

    // Green healing particles at resurrection point
    this._spawnResurrectParticles(zombie.position.clone());

    // Notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '💀 Necromancer raises the dead!';
      notif.style.color = '#44ff88';
      notif.classList.remove('show');
      void notif.offsetWidth;
      notif.classList.add('show');
    }
  }

  _spawnResurrectParticles(pos) {
    // Spawn 12 small green sprites rising upward
    const count = 12;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.textContent = '+';
      el.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:9999',
        'font-size:14px',
        'font-weight:bold',
        'color:#44ff88',
        'text-shadow:0 0 6px #44ff88,0 0 12px #00ff44',
        'transition:transform 1.2s ease-out,opacity 1.2s ease-out',
      ].join(';');

      const camera = this.game.scene.getCamera();
      const w3 = pos.clone();
      w3.y += Math.random() * 1.5;
      w3.project(camera);
      if (w3.z >= 1) continue;

      const sx = (w3.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 40;
      const sy = (-w3.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      el.style.transform = 'translate(-50%, 0)';
      document.body.appendChild(el);

      requestAnimationFrame(() => {
        el.style.transform = `translate(-50%, -${50 + Math.random() * 40}px)`;
        el.style.opacity = '0';
      });

      setTimeout(() => el.remove(), 1250);
    }
  }

  die() {
    if (this._dead) return;

    // Remove shield — dispose its geometry/material, otherwise detaching it from
    // the mesh here means base disposal never reaches it (one sphere leaked/death).
    if (this._shieldMesh) {
      if (this.mesh) this.mesh.remove(this._shieldMesh);
      this._shieldMesh.geometry?.dispose?.();
      this._shieldMesh.material?.dispose?.();
      this._shieldMesh = null;
    }

    // Death notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '💀 Necromancer falls!';
      notif.style.color = '#cc44ff';
      notif.classList.remove('show');
      void notif.offsetWidth;
      notif.classList.add('show');
    }

    super.die();
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Always drops antibiotics
    wi.spawnItem('med_antibiotics', px, py, pz, 1);

    // 50% special virus sample
    if (Math.random() < 0.50) {
      wi.spawnItem('special_virus_sample', px + 0.25, py, pz, 1);
    }

    // 30% gunpowder
    if (Math.random() < 0.30) {
      wi.spawnItem('mat_gunpowder', px + 0.1, py, pz + 0.2, 1);
    }
  }
}
