import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class HordeMaster extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'horde_master',
      health: 120,
      maxHealth: 120,
      damage: 15,
      speed: 2.0,
      attackRange: 2.5,
      aggroRange: 45,
      attackCooldown: 2.0
    });
    this._auraTimer = 0;
    this._summonTimer = 0;
    // createMesh() already ran inside super() — don't clobber the ring refs it set
    this._auraRing = this._auraRing ?? null;
    this._ringPhase = 0;
    // Track which zombies we have boosted so we can restore them on death
    this._boostedZombies = new Set();
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      scale: 1.15,
      bulk: 1.05,
      hunch: 0.1,
      armPose: 'hang',
      eyeColor: 0xff6a3a,
      eyeEmissive: 1.0
    });

    // Grab the shared eye material so update() can pulse the glow
    this._eyeMat = null;
    refs.headGroup.traverse(c => {
      if (c.isMesh && c.material?.emissive?.getHex() === 0xff6a3a) this._eyeMat = c.material;
    });

    // Ragged long coat: open cone skirt from waist to shins
    const coatMat = new THREE.MeshStandardMaterial({
      color: 0x2a2224, roughness: 0.95, metalness: 0, side: THREE.DoubleSide
    });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.78, 10, 1, true), coatMat);
    skirt.position.y = -0.34;
    skirt.castShadow = true; skirt.receiveShadow = true;
    refs.torsoGroup.add(skirt);
    // Torn coat hem strips
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1 + Math.random() * 0.08, 0.02), coatMat);
      const ang = (i / 4) * Math.PI * 2 + 0.4;
      strip.position.set(Math.cos(ang) * 0.31, -0.76, Math.sin(ang) * 0.31);
      strip.rotation.y = -ang;
      strip.rotation.x = (Math.random() - 0.5) * 0.3;
      strip.castShadow = true;
      refs.torsoGroup.add(strip);
    }

    // High coat collar wrapping behind the neck
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 12, Math.PI), coatMat);
    collar.position.set(0, 0.58, -0.03);
    collar.rotation.x = -1.25; // arc rises behind the neck
    collar.castShadow = true;
    refs.torsoGroup.add(collar);

    // Command staff, restyled: gnarled dark wood held in the hanging right hand
    const staffMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.5, 7), staffMat);
    staff.position.set(0.05, -0.05, 0.05);
    staff.rotation.z = 0.08;
    staff.castShadow = true;
    refs.armR.elbow.add(staff);
    // Dull amber orb lashed to the top
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xcc7722, emissiveIntensity: 0.9, roughness: 0.4 })
    );
    orb.position.set(0.11, 0.68, 0.05);
    orb.castShadow = false;
    refs.armR.elbow.add(orb);

    // Pulsing gold aura torus ring at ground level (unscaled outer group)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xffaa00,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.75,
      roughness: 0.5
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.88; // ground level relative to body center
    group.add(ring);
    this._auraRing = ring;
    this._auraRingMat = ringMat;

    this.finalizeMesh(group);
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._dead) return;

    // Aura: every 1 second, boost all nearby zombies
    this._auraTimer += deltaTime;
    if (this._auraTimer >= 1.0) {
      this._auraTimer = 0;
      this._applyAura();
    }

    // Summon: every 20 seconds, spawn 3 walker/runner zombies
    this._summonTimer += deltaTime;
    if (this._summonTimer >= 20.0) {
      this._summonTimer = 0;
      this._summonMinions();
    }

    // Pulse aura ring: expand, fade and reset
    if (this._auraRing) {
      this._ringPhase += deltaTime * 1.8;
      if (this._ringPhase > 1.0) this._ringPhase -= 1.0;

      // Scale from 1 to 2.5 and back
      const s = 1.0 + this._ringPhase * 1.5;
      this._auraRing.scale.set(s, s, 1);
      // Fade out as it expands
      this._auraRingMat.opacity = 0.8 * (1.0 - this._ringPhase);
    }

    // Pulse eye glow
    if (this._eyeMat) {
      this._eyeMat.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.004) * 0.5;
    }
  }

  _applyAura() {
    const zombies = this.game.zombieManager?.getZombies() ?? [];
    const newBoosted = new Set();

    for (const z of zombies) {
      if (z === this || z._dead) continue;
      const dx = z.position.x - this.position.x;
      const dz = z.position.z - this.position.z;
      if (dx * dx + dz * dz <= 15 * 15) {
        // Use the shared canonical original speed (captured once, before any aura
        // boost) so we never record a Screamer-inflated value as the "base" and
        // leave it permanently fast.
        if (z._origSpeed === undefined) z._origSpeed = z.speed;
        // Apply boost
        z.speed = z._origSpeed * 1.35;
        z._hmBoost = true;
        z._dmgReduction = 0.25;
        newBoosted.add(z);
      }
    }

    // Any zombie no longer in range: restore speed
    for (const z of this._boostedZombies) {
      if (!newBoosted.has(z) && !z._dead) {
        if (z._origSpeed !== undefined) z.speed = z._origSpeed;
        z._hmBoost = false;
        z._dmgReduction = 0;
      }
    }

    this._boostedZombies = newBoosted;
  }

  _restoreAllBoosted() {
    for (const z of this._boostedZombies) {
      if (!z._dead) {
        if (z._origSpeed !== undefined) z.speed = z._origSpeed;
        z._hmBoost = false;
        z._dmgReduction = 0;
      }
    }
    this._boostedZombies.clear();
  }

  _summonMinions() {
    const kills = this.game.zombieKills ?? 0;
    let types;
    if (kills < 20)      types = ['walker', 'runner'];
    else if (kills < 50) types = ['runner', 'crawler', 'leaper'];
    else                 types = ['berserker', 'runner', 'leaper', 'bloater'];
    const count = 3 + Math.floor(Math.min(kills / 30, 3));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 5;
      const sx = this.position.x + Math.cos(ang) * dist;
      const sz = this.position.z + Math.sin(ang) * dist;
      const type = types[Math.floor(Math.random() * types.length)];
      try {
        this.game.zombieManager?.spawn(type, sx, sz);
      } catch (e) {}
    }

    // Notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '👑 Horde Master summons minions!';
      notif.style.color = '#cc88ff';
      notif.classList.remove('show');
      void notif.offsetWidth;
      notif.classList.add('show');
    }
  }

  die() {
    if (this._dead) return;
    // Restore all boosted zombies before calling super
    this._restoreAllBoosted();

    // Scream: play groan audio 3 times
    const groan = () => this.game.audioManager?.playZombieGroan?.();
    groan();
    setTimeout(groan, 300);
    setTimeout(groan, 600);

    // Death notification
    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '💀 Horde Master defeated! Minions weakened!';
      notif.style.color = '#ffcc00';
      notif.classList.remove('show');
      void notif.offsetWidth;
      notif.classList.add('show');
    }

    // Remove aura ring visuals
    if (this._auraRing && this.mesh) {
      this.mesh.remove(this._auraRing);
      this._auraRing = null;
    }

    super.die();
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Always drops something valuable
    const roll = Math.random();
    if (roll < 0.35) {
      const weapons = ['weapon_pistol_found', 'weapon_smg_found', 'weapon_rifle_found'];
      wi.spawnItem(weapons[Math.floor(Math.random() * weapons.length)], px, py, pz, 1);
    } else if (roll < 0.65) {
      wi.spawnItem('medical_kit', px, py, pz, 1);
      wi.spawnItem('med_antibiotics', px + 0.3, py, pz, 1);
    } else {
      const ammoTypes = ['ammo_556', 'ammo_762', 'ammo_9mm'];
      const pick = ammoTypes[Math.floor(Math.random() * ammoTypes.length)];
      wi.spawnItem(pick, px, py, pz, 20);
    }
    // Bonus rare mat
    if (Math.random() < 0.5) wi.spawnItem('mat_battery', px + 0.4, py, pz + 0.2, 2);
  }
}
