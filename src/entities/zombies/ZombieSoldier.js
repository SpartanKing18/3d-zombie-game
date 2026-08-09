import * as THREE from 'three';
import { ZombieBase } from './ZombieBase.js';

export class ZombieSoldier extends ZombieBase {
  constructor(x, z, game) {
    super(x, z, game, {
      type: 'zombie_soldier',
      health: 60,
      maxHealth: 60,
      damage: 15,
      speed: 2.5,
      attackRange: 18,
      aggroRange: 40,
      attackCooldown: 0.8
    });
    this._shotsLeft = 6;
    this._reloading = false;
    this._reloadTimer = 0;
    this._strafeDirTimer = 0;
    this._strafeDir = 1;
    this._grenadeCooldown = 18 + Math.random() * 10; // first grenade after 18-28s
    // Cached raycaster + scratch vectors — avoids per-shot allocation
    this._soldierRay = new THREE.Raycaster();
    this._soldierRay.near = 0;
    this._shotOrigin = new THREE.Vector3();
    this._shotDir    = new THREE.Vector3();
  }

  createMesh() {
    const { group, refs } = this.buildHumanoid({
      shirtColor: 0x4a5138, // olive uniform
      pantsColor: 0x3d4432,
      hunch: 0.12,
      armPose: 'hang',
      bald: true,
      gore: 3
    });

    // Combat boots: darken and beef up the stock shoes
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x15150f, roughness: 0.85 });
    for (const leg of [refs.legL, refs.legR]) {
      leg.traverse(c => {
        if (c.isMesh && c.geometry.type === 'BoxGeometry') {
          c.material = bootMat;
          c.scale.set(1.15, 1.3, 1.05);
        }
      });
    }

    // Tactical vest: chest + back panels with pouches
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x33382c, roughness: 0.9 });
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.09), vestMat);
    front.position.set(0, 0.36, 0.12);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.08), vestMat);
    back.position.set(0, 0.36, -0.12);
    for (const m of [front, back]) {
      m.castShadow = true; m.receiveShadow = true;
      refs.torsoGroup.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), vestMat);
      pouch.position.set(-0.1 + i * 0.1, 0.23, 0.17);
      pouch.castShadow = true;
      refs.torsoGroup.add(pouch);
    }

    // Dogtags on a short chain over the vest
    const tagMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.35 });
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.04, 0.006), tagMat);
    tag.position.set(0.015, 0.5, 0.15);
    tag.rotation.z = 0.15;
    refs.torsoGroup.add(tag);

    // Helmet: cap over the skull + rim
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3a4034, roughness: 0.6 });
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.128, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      helmetMat
    );
    helmet.position.set(0, 0.18, 0.005);
    helmet.scale.set(1.0, 1.15, 1.05);
    helmet.castShadow = true;
    refs.headGroup.add(helmet);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.02, 12), helmetMat);
    brim.position.set(0, 0.155, 0.01);
    brim.castShadow = true;
    refs.headGroup.add(brim);

    // Right arm raised, aiming the sidearm forward
    refs.armR.shoulder.rotation.x = -1.25;
    refs.armR.shoulder.userData.baseRotX = -1.25;
    refs.armR.elbow.rotation.x = -0.15;

    // Pistol in the right hand (built along the forearm axis: elbow-local -Y)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.45, metalness: 0.55 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.05), gunMat);
    slide.position.set(0, -0.37, 0.02);
    slide.castShadow = true;
    refs.armR.elbow.add(slide);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.08, 8), gunMat);
    barrel.position.set(0, -0.49, 0.02);
    barrel.castShadow = true;
    refs.armR.elbow.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.07), gunMat);
    grip.position.set(0, -0.3, 0.05);
    grip.rotation.x = -0.25;
    grip.castShadow = true;
    refs.armR.elbow.add(grip);
    this._pistolMesh = slide; // muzzle-flash target

    this.finalizeMesh(group);
  }

  update(deltaTime) {
    // Handle reload timer independently of base update
    if (this._reloading) {
      this._reloadTimer -= deltaTime;
      if (this._reloadTimer <= 0) {
        this._reloading = false;
        this._shotsLeft = 6;
      }
      // During reload: freeze in place but still sync mesh
      if (this.body) {
        this.body.velocity.x = 0;
        this.body.velocity.z = 0;
      }
      this.updateMeshPosition();
      return;
    }

    // Strafe direction flips every 1.2–2.0s
    this._strafeDirTimer -= deltaTime;
    if (this._strafeDirTimer <= 0) {
      this._strafeDir = Math.random() < 0.5 ? 1 : -1;
      this._strafeDirTimer = 1.2 + Math.random() * 0.8;
    }

    if (this._grenadeCooldown > 0) this._grenadeCooldown -= deltaTime;

    super.update(deltaTime);
  }

  updateMovement(deltaTime, player, distToPlayer) {
    // Always sync position from physics
    this.position.copy(this.body.position);

    // Keep zombie grounded
    if (!this.game.inFriendHouse) {
      const groundY = this.game.terrainGenerator?.getHeightAt(this.body.position.x, this.body.position.z);
      if (isFinite(groundY) && this.body.position.y < groundY + 0.9) {
        this.body.position.y = groundY + 0.9;
        if (this.body.velocity.y < 0) this.body.velocity.y = 0;
      }
    }

    if (this.state === 'idle') {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      return;
    }

    const playerPos = player.getPosition();
    const dirX = playerPos.x - this.position.x;
    const dirZ = playerPos.z - this.position.z;
    const dist = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const normX = dirX / dist;
    const normZ = dirZ / dist;

    // Within gun range but not too close: strafe while keeping distance
    if (distToPlayer >= 3 && distToPlayer <= this.attackRange) {
      // Perpendicular (strafe) vector: rotate direction 90°
      const strafeX = -normZ * this._strafeDir;
      const strafeZ =  normX * this._strafeDir;

      // Slight approach/retreat to maintain roughly 8–12m
      let approachScale = 0;
      if (distToPlayer > 14) approachScale = 0.6;
      else if (distToPlayer < 7) approachScale = -0.5;

      this.body.velocity.x = (strafeX + normX * approachScale) * this.speed;
      this.body.velocity.z = (strafeZ + normZ * approachScale) * this.speed;
    } else if (distToPlayer < 3) {
      // Very close: try to back away a bit (melee range — keep pressing)
      this.body.velocity.x = normX * this.speed * 0.4;
      this.body.velocity.z = normZ * this.speed * 0.4;
    } else {
      // Outside gun range: chase normally (skip A* outdoors — direct movement suffices)
      if (this.game.inFriendHouse && this.pathRecalcTimer <= 0) {
        this.currentPath = this.pathfinder.findPath(
          this.position.x, this.position.z,
          playerPos.x, playerPos.z,
          this.game.terrainGenerator
        );
        this.pathIndex = 0;
        this.pathRecalcTimer = this.pathRecalcInterval;
      } else if (!this.game.inFriendHouse) {
        this.currentPath = [];
      }

      if (this.currentPath.length > 0) {
        const node = this.currentPath[Math.min(this.pathIndex, this.currentPath.length - 1)];
        const nx = node[0] - this.position.x;
        const nz = node[1] - this.position.z;
        const nd = Math.sqrt(nx * nx + nz * nz);
        if (nd < 2) this.pathIndex++;
        if (nd > 0) {
          this.body.velocity.x = (nx / nd) * this.speed;
          this.body.velocity.z = (nz / nd) * this.speed;
        }
      } else {
        this.body.velocity.x = normX * this.speed;
        this.body.velocity.z = normZ * this.speed;
      }
    }
  }

  checkAttack(player, distToPlayer) {
    if (this._reloading) return;
    if (this.lastAttackTime < this.attackCooldown) return;

    // Melee grab at very close range
    if (distToPlayer < 3) {
      this._doMeleeGrab(player);
      this.lastAttackTime = 0;
      return;
    }

    // Grenade throw at medium range — higher priority than pistol
    if (distToPlayer > 7 && distToPlayer < 20 && this._grenadeCooldown <= 0 && this.state !== 'idle') {
      this._throwGrenade(player);
      this._grenadeCooldown = 20 + Math.random() * 10;
      this.lastAttackTime = 0;
      return;
    }

    // Ranged pistol shot when within gun range
    if (distToPlayer <= this.attackRange && this.state !== 'idle') {
      this._firePistol(player, distToPlayer);
      this.lastAttackTime = 0;
    }
  }

  _throwGrenade(player) {
    const playerPos = player.getPosition();
    // Predict landing: aim slightly ahead of player movement
    const lx = playerPos.x + (Math.random() - 0.5) * 3;
    const lz = playerPos.z + (Math.random() - 0.5) * 3;
    const landPos = new THREE.Vector3(lx, 0.05, lz);

    // Visual — brief flash at soldier's position
    this.game.particleSystem?.createMuzzleFlash?.(this.position.clone());

    // Danger zone ring: pulsing red circle on the ground where grenade will land
    const ringGeo = new THREE.RingGeometry(4.5, 5.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2200, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(landPos);
    this.game.scene.addObject(ring);
    let elapsed = 0;
    const pulseInterval = setInterval(() => {
      elapsed += 0.1;
      ring.material.opacity = 0.4 + 0.4 * Math.sin(elapsed * Math.PI * 4);
      ring.scale.setScalar(0.9 + 0.15 * Math.sin(elapsed * Math.PI * 3));
    }, 100);
    setTimeout(() => { clearInterval(pulseInterval); this.game.scene.removeObject(ring); ringGeo.dispose(); ringMat.dispose(); }, 900);

    // Delayed explosion at landing spot
    setTimeout(() => {
      if (this._dead) return;
      this.game.particleSystem?.createExplosion?.(landPos.clone());
      this.game._emitNoise?.(landPos.x, landPos.z, 20);
      // AoE damage to player
      const dx = player.getPosition().x - landPos.x;
      const dz = player.getPosition().z - landPos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 5 && !player.godMode) {
        const dmg = 35 * (1 - dist / 5);
        player.takeDamage(Math.round(dmg));
      }
      const notif = document.getElementById('loot-notification');
      if (notif && dist < 8) {
        notif.textContent = '💣 Grenade!'; notif.style.color = '#ffaa44';
        notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
      }
    }, 900);
  }

  _firePistol(player, distToPlayer) {
    // 5% miss chance
    if (Math.random() < 0.05) {
      this._shotsLeft = Math.max(0, this._shotsLeft - 1);
      this._checkReload();
      this.game.audioManager?.resume?.();
      return;
    }

    // Instant hit via raycaster — reuse cached origin/dir/raycaster
    this._shotOrigin.copy(this.position);
    this._shotOrigin.y += 0.9;

    const playerPos = player.getPosition();
    this._shotDir.set(playerPos.x, playerPos.y + 0.8, playerPos.z)
      .sub(this._shotOrigin).normalize();

    this._soldierRay.set(this._shotOrigin, this._shotDir);
    this._soldierRay.far = this.attackRange + 2;

    // Reuse game-level cached raycast targets (refreshed every 2s by WeaponBase)
    const now = performance.now();
    if (!this.game._raycastTargets || now - (this.game._raycastTargetTime ?? 0) > 2000) {
      const targets = [];
      this.game.scene.scene.traverseVisible(o => { if (o.geometry) targets.push(o); });
      this.game._raycastTargets = targets;
      this.game._raycastTargetTime = now;
    }
    const hits = this._soldierRay.intersectObjects(this.game._raycastTargets, true);

    // The player has no scene mesh to hit directly, so treat the shot as a
    // line-of-sight test: find the nearest obstruction that isn't this soldier's
    // own body; the bullet reaches the player only if nothing blocks it first.
    let blockDist = Infinity;
    for (const h of hits) {
      let obj = h.object, isSelf = false;
      while (obj) { if (obj === this.mesh) { isSelf = true; break; } obj = obj.parent; }
      if (isSelf) continue;
      blockDist = h.distance;
      break;
    }
    const hitPlayer = distToPlayer <= this.attackRange && blockDist >= distToPlayer - 0.5;

    if (hitPlayer) {
      if (player.health - this.damage <= 0 && player.setDeathCause) {
        player.setDeathCause('Shot by Zombie Soldier');
      }
      player.takeDamage(this.damage);
      this.game.audioManager?.resume?.();

      // Slight knockback from bullet impact
      if (player.body) {
        const dx = playerPos.x - this._shotOrigin.x;
        const dz = playerPos.z - this._shotOrigin.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        player.body.velocity.x += (dx / d) * 1.5;
        player.body.velocity.z += (dz / d) * 1.5;
      }

      // Muzzle flash: brief bright spot at pistol mesh
      this._muzzleFlash();
    }

    this._shotsLeft = Math.max(0, this._shotsLeft - 1);
    this._checkReload();
  }

  _doMeleeGrab(player) {
    const grabDamage = 30;
    if (player.health - grabDamage <= 0 && player.setDeathCause) {
      player.setDeathCause(`Grabbed by Zombie Soldier`);
    }
    player.takeDamage(grabDamage);
    this.game.audioManager?.resume?.();
    this.game.audioManager?.playZombieHit?.();

    // Knockback
    if (player.body) {
      const dx = player.getPosition().x - this.position.x;
      const dz = player.getPosition().z - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      player.body.velocity.x += (dx / dist) * 5;
      player.body.velocity.z += (dz / dist) * 5;
      player.body.velocity.y = Math.max(player.body.velocity.y, 3);
    }
  }

  _muzzleFlash() {
    if (!this._pistolMesh) return;
    const origColor = 0x1a1a1a;
    this._pistolMesh.material.emissive = new THREE.Color(0xffcc44);
    this._pistolMesh.material.emissiveIntensity = 1.5;
    setTimeout(() => {
      if (this._pistolMesh && this._pistolMesh.material) {
        this._pistolMesh.material.emissive.set(0x000000);
        this._pistolMesh.material.emissiveIntensity = 0;
      }
    }, 60);
  }

  _checkReload() {
    if (this._shotsLeft <= 0) {
      this._reloading = true;
      this._reloadTimer = 2.0;
    }
  }

  dropLoot() {
    const wi = this.game.worldItemSystem;
    if (!wi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;

    // Always drops a pistol and some ammo
    wi.spawnItem('weapon_pistol_found', px, py, pz, 1);
    wi.spawnItem('ammo_9mm', px + 0.3, py, pz, 6 + Math.floor(Math.random() * 8));

    // Bonus drops
    if (Math.random() < 0.45) wi.spawnItem('ammo_9mm', px - 0.3, py, pz, 4 + Math.floor(Math.random() * 6));
    if (Math.random() < 0.25) wi.spawnItem('bandage', px, py, pz + 0.3, 1);
    if (Math.random() < 0.15) wi.spawnItem('mat_wire', px + 0.2, py, pz + 0.2, 1);
  }
}
