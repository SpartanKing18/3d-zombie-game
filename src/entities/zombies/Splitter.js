import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';
import { Crawler } from './Crawler.js';

export class Splitter extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'splitter',
      health: 80,
      maxHealth: 80,
      damage: 16,
      speed: 1.8,
      attackRange: 2.2,
      aggroRange: 28,
      attackCooldown: 2.2
    });
    this._acidDripTimer = 0;
    this._pulseTimer = 0;
    // References to the blob spheres so we can animate them.
    // createMesh() runs inside super() and already fills _bileDrops — don't wipe it.
    this._bileDrops = this._bileDrops ?? [];
    this._acidMarks = [];
  }

  createMesh() {
    // Runs inside super()'s constructor, before Splitter's own field init
    this._bileDrops = [];

    // Bloated, sickly yellow-green body straining at the middle
    const { group, refs } = this.buildHumanoid({
      shirtless: true,
      skinColor: 0x8f9a5a,
      bulk: 1.15,
      belly: 0.85,
      gore: 4,
      armPose: 'reach',
      hunch: 0.32,
      bald: true,
      eyeColor: 0xd8d84a,
      eyeEmissive: 0.5
    });

    // Vertical tear seam down the middle of chest, belly, and skull —
    // slightly protruding flattened goreMat boxes suggesting it splits in half.
    const mkSeam = (parent, w, h, x, y, z, rx = 0) => {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), refs.goreMat);
      seam.position.set(x, y, z);
      seam.rotation.x = rx;
      seam.scale.z = 0.5;
      seam.castShadow = false;
      parent.add(seam);
      return seam;
    };
    mkSeam(refs.torsoGroup, 0.035, 0.34, 0, 0.4, 0.185);        // chest
    mkSeam(refs.torsoGroup, 0.04, 0.3, 0, 0.12, 0.3, 0.1);      // distended belly
    mkSeam(refs.headGroup, 0.02, 0.2, 0, 0.19, 0.096, -0.35);   // skull/brow

    // Bile drops — small glossy spheres clinging to the bloated belly
    const bileMat = new THREE.MeshStandardMaterial({
      color: 0x88bb44,
      emissive: 0x447722,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.85,
      roughness: 0.4,
      metalness: 0
    });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 6, 5), bileMat);
      drop.position.set(Math.cos(ang) * 0.24, 0.06 + Math.random() * 0.25, Math.sin(ang) * 0.26);
      drop.castShadow = false;
      refs.torsoGroup.add(drop);
      this._bileDrops.push(drop);
    }

    // Pulsing gut: animate the abdomen around its builder-set base scale
    this._bodyMesh = refs.abdomen;
    this._bodyBaseScale = refs.abdomen.scale.clone();

    this.finalizeMesh(group);
  }

  update(deltaTime) {
    super.update(deltaTime);

    if (this._dead) return;

    // Pulsing gut: scale oscillates around the builder's base scale,
    // giving a breathing/bulging effect
    this._pulseTimer += deltaTime * 1.8;
    const pulse = 1.0 + Math.sin(this._pulseTimer) * 0.04;
    if (this._bodyMesh && this._bodyBaseScale) {
      const b = this._bodyBaseScale;
      this._bodyMesh.scale.set(
        b.x * pulse,
        b.y * (1 + Math.sin(this._pulseTimer * 0.9) * 0.05),
        b.z * pulse
      );
    }

    // Bile drop wobble
    for (let i = 0; i < this._bileDrops.length; i++) {
      const drop = this._bileDrops[i];
      const t = this._pulseTimer + i * 0.7;
      drop.position.y = drop.position.y + Math.sin(t * 1.5) * 0.002;
    }

    // Acid drip mark every 3s while moving
    if (this.state === 'chasing' || this.state === 'attacking') {
      this._acidDripTimer -= deltaTime;
      if (this._acidDripTimer <= 0) {
        this._acidDripTimer = 3.0;
        this._spawnAcidMark();
      }
    }

    // Fade and remove old acid marks
    this._updateAcidMarks(deltaTime);
  }

  _spawnAcidMark() {
    const px = this.position.x + (Math.random() - 0.5) * 0.3;
    const pz = this.position.z + (Math.random() - 0.5) * 0.3;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.03;

    const geo = new THREE.CircleGeometry(0.28 + Math.random() * 0.18, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x55bb22,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const mark = new THREE.Mesh(geo, mat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(px, py, pz);
    this.game.scene.scene.add(mark);
    this._acidMarks.push({ mesh: mark, life: 5.0 });
  }

  _updateAcidMarks(dt) {
    for (let i = this._acidMarks.length - 1; i >= 0; i--) {
      const m = this._acidMarks[i];
      m.life -= dt;
      m.mesh.material.opacity = 0.55 * (m.life / 5.0);
      if (m.life <= 0) {
        this.game.scene.scene.remove(m.mesh);
        m.mesh.geometry.dispose();
        m.mesh.material.dispose();
        this._acidMarks.splice(i, 1);
      }
    }
  }

  die() {
    if (this._dead) return;

    // Spawn 3 mini-splitters (Crawlers scaled down) before calling super.die()
    const spawnOffsets = [
      [-1.0,  0.8],
      [ 1.0,  0.8],
      [ 0.0, -1.1],
    ];

    for (const [ox, oz] of spawnOffsets) {
      const mx = this.position.x + ox;
      const mz = this.position.z + oz;

      try {
        const mini = new Crawler(mx, mz, this.game);
        // Override to mini stats
        mini.health = 20;
        mini.maxHealth = 20;
        mini.damage = 8;
        mini.speed = 4.0;
        mini.type = 'mini_splitter';
        mini.state = 'chasing';

        // Scale the visual body down (keeps it on the ground and fixes
        // headshot height + health bar position for the smaller size)
        mini.setMeshScale?.(0.45);

        // Register with zombie manager (method is addZombie — registerZombie
        // never existed, so minis were silently orphaned: never updated/despawned)
        this.game.zombieManager?.addZombie?.(mini);
      } catch (e) {
        // Spawn failed silently — don't crash parent death sequence
      }
    }

    // Acid burst on death
    if (this.game.particleSystem) {
      const pos = this.position.clone();
      pos.y += 0.5;
      this.game.particleSystem.createBlood?.(pos, 12);
    }

    // Clean up acid marks
    for (const m of this._acidMarks) {
      this.game.scene.scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
    }
    this._acidMarks = [];

    super.die();
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Always drops bleach
    wi.spawnItem('mat_bleach', px, py, pz, 1);

    // Mushrooms — 60%
    if (Math.random() < 0.60) wi.spawnItem('food_mushroom', px + 0.3, py, pz, 1);
    if (Math.random() < 0.60) wi.spawnItem('food_mushroom', px - 0.3, py, pz, 1);

    // Antibiotics — 30%
    if (Math.random() < 0.30) wi.spawnItem('med_antibiotics', px, py, pz + 0.3, 1);
  }
}
