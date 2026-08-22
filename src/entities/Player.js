import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Player {
  constructor(game) {
    this.game = game;
    let spawnHeight = 100;
    try {
      if (game.terrainGenerator) {
        const terrainHeight = game.terrainGenerator.getHeightAt(0, 0);
        spawnHeight = Math.max(terrainHeight + 5, 100);
      }
    } catch (e) {
      console.warn('Could not calculate spawn height from terrain:', e);
      spawnHeight = 100;
    }
    this.position = new THREE.Vector3(0, spawnHeight, 0);
    this.velocity = new THREE.Vector3();
    // Reused scratch vectors — avoids per-frame GC pressure in updatePhysics/updateNoclip
    this._right       = new THREE.Vector3();
    this._forward     = new THREE.Vector3();
    this._moveVel     = new THREE.Vector3();
    this._up          = new THREE.Vector3(0, 1, 0);
    this._flashFwd    = new THREE.Vector3();
    this._flashOffset = new THREE.Vector3(0, -0.05, 0);

    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.hunger = 100;
    this.maxHunger = 100;
    this.staminaRegenRate = 25;
    this.staminaDrainRate = 40;
    this.hungerDrainRate = 1 / 45;   // units per second (full → 0 in 75 min)

    // Thirst system
    this.thirst = 100;
    this.maxThirst = 100;
    this.thirstDrainRate = 1 / 60;   // units per second (full → 0 in 100 min)

    this.temperature = 37.0;  // body temp in Celsius
    this._tempTimer = 0;

    this.moveSpeed = 5;
    this.sprintSpeed = 8;
    this.crouchSpeed = 2.5;
    this.isSprinting = false;
    this.isCrouching = false;
    this.isGrounded = false;
    this.canJump = true;

    this.jumpForce = 6;
    this.jumpCooldown = 0;

    this.godMode = false;
    this.noclip = false;
    this.spawnProtectionTime = 3;

    this.camera = game.scene.getCamera();
    this.inputManager = game.inputManager;
    this.physicsWorld = game.physicsWorld;

    this.yaw = 0;
    this.pitch = 0;
    this.maxPitch = Math.PI / 2 - 0.05;  // avoid gimbal lock at exactly ±90°

    this.eyeHeight = 0.75;
    this.crouchEyeHeight = 0.4;

    // Camera head bob
    this._bobTime = 0;
    this._dt = 0.016;

    // Screen shake on damage
    this._shakeTime = 0;

    // Temporary buffs
    this._speedBoostTimer = 0;
    this._speedBoostMult  = 1.0;
    this._adrenalineActive = false;
    this._morphineTimer   = 0;

    // Damage vignette
    this._damageFlash = 0;

    // Death cause tracking
    this._deathCause = 'Starvation';

    // Distance tracking
    this._lastStatsPos = null;

    // Init game stats
    if (!this.game.survivalStartTime) this.game.survivalStartTime = Date.now();
    this.game.zombieKills = this.game.zombieKills || 0;
    this.game.distanceTraveled = this.game.distanceTraveled || 0;

    // XP / Leveling
    this.xp = 0;
    this.level = 1;
    this._xpEl = null;
    this._levelEl = null;
    this._lootNotifEl = null;  // cached loot-notification element

    // Kill streak
    this._killStreak      = 0;
    this._killStreakTimer  = 0;
    this._lastKillTime    = 0;

    // Bhop
    this._jumpBuffer  = 0;
    this._bhopChain   = 0;
    this._bhopMult    = 1.0;

    // Weapon recoil recovery
    this._recoilRecovery = 0;

    // Audio timers
    this._footstepTimer  = 0;
    this._heartbeatTimer = 0;

    // Falling damage
    this._prevYVel    = 0;

    // Status effects
    this._bleeding      = false;
    this._bleedTimer    = 0;
    this._infected      = false;
    this._infectTimer   = 0;
    this.poisoned       = false;
    this.blurredVision  = false;
    this.burned         = false;
    this.toothPain      = false;
    this._drunkTimer    = 0;
    this._immunePoison  = false;
    this._immuneInfect  = false;
    this._adrenalinePerk= false;
    this._berserkerPerk = false;
    this.nightVisionOn  = false;
    this._sleeping      = false;
    this._legInjury     = false;

    this.setupPhysics();
    this.setupHUD();
  }

  setupPhysics() {
    const shape = new CANNON.Cylinder(0.4, 0.4, 1.8, 8);
    this.body = new CANNON.Body({ mass: 1 });
    this.body.addShape(shape);
    this.body.position.copy(this.position);
    this.body.linearDamping = 0.3;
    this.body.angularDamping = 1;
    this.body.fixedRotation = true;
    this.body.collisionFilterGroup = 1; // GROUP_PLAYER
    this.body.collisionFilterMask  = -1; // collide with all groups (including default house bodies)

    this.physicsWorld.addBody(this.body);
  }

  setupHUD() {
    this.healthBar = document.getElementById('health-bar');
    this.healthText = document.getElementById('health-text');
    this.staminaBar = document.getElementById('stamina-bar');
    this.hungerBar = document.getElementById('hunger-bar');
    this.thirstBar = document.getElementById('thirst-bar');
    this.ammoCounterEl = document.getElementById('ammo-counter');
    this.updateHUD();

    // Flashlight spotlight
    const fl = new THREE.SpotLight(0xffeecc, 0, 45, Math.PI * 0.1, 0.3, 1.5);
    fl.castShadow = false;
    this._flashlightTarget = new THREE.Object3D();
    this.game.scene.scene.add(fl);
    this.game.scene.scene.add(this._flashlightTarget);
    fl.target = this._flashlightTarget;
    this._flashlight = fl;
    // Default ON: at night the world would otherwise read as a black screen to a
    // player who hasn't discovered the [L] toggle. The beam is near-invisible in
    // daylight and essential after dusk, so on-by-default is the safe choice.
    this.flashlightOn = true;

    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'l' && !this.game.commandSystem?.isOpen && !this.game.inventorySystem?.isOpen) {
        this.flashlightOn = !this.flashlightOn;
      }
    });
  }

  update(deltaTime) {
    this._dt = deltaTime;

    // NaN safety net: if a physics blow-up (e.g. a contact with a corrupted body)
    // ever sends the player body to a non-finite position, the camera matrix goes
    // NaN and the screen renders black. Snap back to the last good spot instead.
    const bp = this.body?.position;
    if (bp) {
      if (!Number.isFinite(bp.x) || !Number.isFinite(bp.y) || !Number.isFinite(bp.z)) {
        const g = this._lastGoodPos || { x: 0, y: 3, z: 0 };
        bp.set(g.x, g.y, g.z);
        this.body.velocity.set(0, 0, 0);
      } else {
        (this._lastGoodPos ||= { x: 0, y: 0, z: 0 });
        this._lastGoodPos.x = bp.x; this._lastGoodPos.y = bp.y; this._lastGoodPos.z = bp.z;
      }
    }

    // Temporary buff timers
    if (this._speedBoostTimer > 0) {
      this._speedBoostTimer -= deltaTime;
      if (this._speedBoostTimer <= 0) { this._speedBoostMult = 1.0; this._adrenalineActive = false; }
    }
    if (this._morphineTimer > 0) this._morphineTimer -= deltaTime;

    if (this.spawnProtectionTime > 0) {
      this.spawnProtectionTime -= deltaTime;
    }

    // While driving, the car's chase camera and physics take over — skip the
    // player's own movement and camera (WASD steers the car instead).
    const driving = !!this.game.drivingVehicle;

    if (!driving) {
      if (this.noclip) {
        this.updateNoclip(deltaTime);
      } else {
        this.updatePhysics(deltaTime);
      }
    }

    // Distance tracking — run after position is updated from physics
    if (this._lastStatsPos) {
      const dx = this.position.x - this._lastStatsPos.x;
      const dz = this.position.z - this._lastStatsPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 3) this.game.distanceTraveled = (this.game.distanceTraveled || 0) + d;
    }
    this._lastStatsPos = this.position.clone();

    this.updateStamina(deltaTime);
    if (!driving) this.updateCamera();
    this.updateHUD();

    // Damage vignette countdown — ease-out (squared) so it snaps in and falls off
    // faster than a flat linear fade, giving the hit more punch.
    if (this._damageFlash > 0) {
      this._damageFlash -= deltaTime;
      if (!this._dmgVignetteEl) this._dmgVignetteEl = document.getElementById('damage-vignette');
      if (this._dmgVignetteEl) {
        const f = Math.max(0, this._damageFlash / 0.5);
        this._dmgVignetteEl.style.opacity = (f * f).toFixed(3);
      }
    }

    // Status effects
    if (this._bleeding && this._bleedTimer > 0) {
      this._bleedTimer -= deltaTime;
      if (!this.godMode) {
        this.health = Math.max(0, this.health - 2 * deltaTime);
        this._deathCause = 'Bled out';
        if (this.health <= 0) this.die();
      }
      if (this._bleedTimer <= 0) this._bleeding = false;
    }

    if (this._infected && !this.game.inFriendHouse && !this._immuneInfect) {
      this._infectTimer += deltaTime;
      if (this._infectTimer > 60 && !this.godMode) {
        this.health = Math.max(0, this.health - 0.4 * deltaTime);
        this._deathCause = 'Zombie Infection';
        if (this.health <= 0) this.die();
      }
    }

    // Temperature: outdoor night is cold, indoor/fire is warm
    this._tempTimer = (this._tempTimer ?? 0) + deltaTime;
    if (this._tempTimer > 5) {
      this._tempTimer = 0;
      if (!this.game.inFriendHouse) {
        const hour = this.game.dayNightCycle?.time ?? 12;
        const isNight = hour < 6 || hour > 20;
        const isCold = isNight && !this._nearFire;
        const target = isCold ? 34.5 : 37.0;
        this.temperature += (target - this.temperature) * 0.3;
        if (this.temperature < 35.5 && !this.godMode && this.spawnProtectionTime <= 0) {
          this.health = Math.max(0, this.health - 0.8);
          this._deathCause = 'Hypothermia';
          if (this.health <= 0) this.die();
        }
      } else {
        this.temperature = Math.min(37.0, this.temperature + 0.5);
      }
    }

    // ── Screen status visual effects ─────────────────────────────────────────
    if (!this._statusOverlay) {
      const ov = document.createElement('div');
      ov.id = 'status-overlay';
      ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;transition:all 0.4s;';
      document.body.appendChild(ov);
      this._statusOverlay = ov;
    }
    // Infected: green tint vignette
    if (this._infected && this._infectTimer > 30) {
      const strength = Math.min((this._infectTimer - 30) / 30, 1);
      this._statusOverlay.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(20,${Math.floor(80+strength*60)},20,${(strength*0.35).toFixed(2)}) 100%)`;
      this._statusOverlay.style.boxShadow = `inset 0 0 ${40+strength*60}px rgba(30,180,30,${(strength*0.3).toFixed(2)})`;
    } else if (this.burned) {
      const pulse = Math.sin(Date.now()/300)*0.5+0.5;
      this._statusOverlay.style.background = `radial-gradient(ellipse at center, transparent 30%, rgba(200,60,0,${(pulse*0.25).toFixed(2)}) 100%)`;
      this._statusOverlay.style.boxShadow = '';
    } else if (this._bleeding && this._bleedTimer > 0) {
      const pulse = Math.sin(Date.now()/200)*0.5+0.5;
      this._statusOverlay.style.background = `radial-gradient(ellipse at center, transparent 50%, rgba(180,0,0,${(0.1+pulse*0.2).toFixed(2)}) 100%)`;
      this._statusOverlay.style.boxShadow = `inset 0 0 60px rgba(220,0,0,${(pulse*0.3).toFixed(2)})`;
    } else {
      this._statusOverlay.style.background = 'none';
      this._statusOverlay.style.boxShadow = 'none';
    }
    // Drunk timer tick (sway is applied in updateCamera via this._drunkTimer)
    if (this._drunkTimer > 0) {
      this._drunkTimer -= deltaTime;
    }

    // Phantom "fear" debuff timer — must tick down so a later backstab can re-apply
    // it. The slow is applied as _moveSpeedMult (game-time), so when it expires we
    // clear the multiplier here rather than via a real-time setTimeout that would
    // desync on pause and survive death/respawn.
    if (this._fearTimer > 0) {
      this._fearTimer -= deltaTime;
      if (this._fearTimer <= 0) {
        this._fearTimer = 0;
        if (this._fearActive) { this.clearSpeedDebuff('fear'); this._fearActive = false; }
      }
    }

    if (this.jumpCooldown > 0) {
      this.jumpCooldown -= deltaTime;
    }

    // Passive health regen: slowly heal when well-fed and hydrated
    if (!this.game.inFriendHouse && this.hunger > 60 && this.thirst > 60 && this.health < this.maxHealth && !this.godMode) {
      this.health = Math.min(this.maxHealth, this.health + 0.4 * deltaTime);
    }

    // Kill streak timer — streak resets after 5s with no kill
    if (this._killStreak > 0) {
      this._killStreakTimer += deltaTime;
      if (this._killStreakTimer > 5) {
        this._killStreak = 0;
        this._killStreakTimer = 0;
        const el = document.getElementById('kill-streak');
        if (el) el.style.opacity = '0';
      }
    }

    // Smooth recoil pitch recovery — clamp after applying to prevent flip
    if (this._recoilRecovery > 0) {
      const recover = Math.min(this._recoilRecovery, 0.9 * deltaTime);
      this.pitch += recover;
      this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
      this._recoilRecovery -= recover;
      if (this._recoilRecovery < 0.0005) this._recoilRecovery = 0;
    }
  }

  updateNoclip(deltaTime) {
    const direction = this.inputManager.getMovementDirection();
    const baseSprint = this.inputManager.isKeyPressed('shift');
    const speed = baseSprint ? this.sprintSpeed * 2 : this.moveSpeed;

    const right   = this._right;
    const forward = this._forward;

    this.camera.getWorldDirection(forward);
    right.crossVectors(forward, this._up).normalize();
    forward.y = 0;
    forward.normalize();

    const velocity = this._moveVel.set(0, 0, 0);
    velocity.addScaledVector(right, direction.x * speed);
    velocity.addScaledVector(forward, direction.z * speed);

    if (this.inputManager.isKeyPressed(' ')) {
      velocity.y = speed;
    } else if (this.inputManager.isKeyPressed('c')) {
      velocity.y = -speed;
    }

    this.position.addScaledVector(velocity, deltaTime);
    this.body.position.copy(this.position);
  }

  updatePhysics(deltaTime) {
    const direction = this.inputManager.getMovementDirection();
    const isSprinting = this.inputManager.isKeyPressed('shift') && this.stamina > 5;
    const isCrouching = this.inputManager.isKeyPressed('c');

    this.isSprinting = isSprinting && this.isGrounded;
    this.isCrouching = isCrouching;

    let speed = this.moveSpeed;
    if (this.isSprinting)       speed = this.sprintSpeed;
    else if (this.isCrouching)  speed = this.crouchSpeed;

    // Adrenaline perk: trigger speed boost when HP < 30%
    if (this._adrenalinePerk && this.health < this.maxHealth * 0.3 && !this._adrenalineActive && this._speedBoostTimer <= 0) {
      this._speedBoostTimer = 6;
      this._speedBoostMult = 1.35;
      // Must flag it as adrenaline: this both enables the no-stamina-drain effect
      // (updateStamina) and, since the trigger guards on !_adrenalineActive, stops
      // it re-firing every 6s while HP stays below 30%. Cleared on timer expiry.
      this._adrenalineActive = true;
    }

    const right   = this._right;
    const forward = this._forward;
    this.camera.getWorldDirection(forward);
    right.crossVectors(forward, this._up).normalize();
    forward.y = 0;
    forward.normalize();

    const moveVelocity = this._moveVel.set(0, 0, 0);
    moveVelocity.addScaledVector(right,   direction.x * speed);
    moveVelocity.addScaledVector(forward, direction.z * speed);

    // Apply bhop speed multiplier (and encumbrance from inventory weight)
    const legMult = this._legInjury ? 0.5 : 1.0;
    const totalMult = this._bhopMult * (this._speedBoostMult ?? 1.0) * (this._encumbrance ?? 1.0) * legMult * (this._moveSpeedMult ?? 1.0);
    this.body.velocity.x = moveVelocity.x * totalMult;
    this.body.velocity.z = moveVelocity.z * totalMult;

    // Track Y velocity BEFORE grounded check (for falling damage)
    const yVelBefore = this.body.velocity.y;

    const wasGrounded = this.isGrounded;
    this.checkGrounded();
    const justLanded = this.isGrounded && !wasGrounded;

    // Falling damage: if just landed with high downward velocity
    if (justLanded && yVelBefore < -12) {
      const excess = Math.abs(yVelBefore) - 12;
      this.takeDamage(excess * 4);
      this._deathCause = 'Fall damage';
    }

    // Jump buffer: pressing space while airborne buffers a jump
    if (this.inputManager.isKeyPressed(' ') && !this.isGrounded) {
      this._jumpBuffer = 0.2; // 200 ms window
    }
    if (this._jumpBuffer > 0) this._jumpBuffer -= deltaTime;

    if (this.isGrounded) {
      if (this._jumpBuffer > 0 && this.jumpCooldown <= 0) {
        // ─── BHOP: timed jump on landing ──────────────────────────────────────
        this.body.velocity.y = this.jumpForce;
        this._bhopChain = Math.min(this._bhopChain + 1, 8);
        this._bhopMult  = Math.min(1.0 + this._bhopChain * 0.1, 1.8);
        this._jumpBuffer = 0;
        this.isGrounded  = false;
        this.jumpCooldown = 0.06;
        this.canJump = false;
      } else if (this.inputManager.isKeyPressed(' ') && this.jumpCooldown <= 0) {
        // ─── Normal jump ───────────────────────────────────────────────────────
        this.body.velocity.y = this.jumpForce;
        this._bhopChain = 0;
        this._bhopMult  = 1.0;
        this.isGrounded  = false;
        this.jumpCooldown = 0.3;
        this.canJump = false;
      } else if (justLanded && this._jumpBuffer <= 0) {
        // Landed without timing a bhop — reset chain
        this._bhopChain = 0;
        this._bhopMult  = 1.0;
      }
    }

    this.position.copy(this.body.position);

    // Footstep sounds
    if (this.isGrounded && this.isMoving()) {
      const interval = this.isSprinting ? 0.32 : 0.5;
      this._footstepTimer -= this._dt || 0.016;
      if (this._footstepTimer <= 0) {
        this.game.audioManager?.resume?.();
        this.game.audioManager?.playFootstep?.();
        this._footstepTimer = interval;
      }
    } else {
      this._footstepTimer = 0;
    }

    // Emit noise when sprinting (every 0.5s)
    if (this.isSprinting && this.isGrounded) {
      this._sprintNoiseTimer = (this._sprintNoiseTimer ?? 0) - deltaTime;
      if (this._sprintNoiseTimer <= 0) {
        this._sprintNoiseTimer = 0.5;
        this.game._emitNoise?.(this.position.x, this.position.z, 12);
      }
    }
  }

  checkGrounded() {
    if (this.game.inFriendHouse) {
      // Inside house: use a simple low-velocity check against y position
      const houseFloor = 1.4; // FH(0.5) + half capsule height (0.9)
      this.isGrounded = this.position.y <= houseFloor + 0.15 && this.body.velocity.y <= 0.1;
      if (this.isGrounded && !this.canJump) this.canJump = true;
      return;
    }

    let terrainHeight = 0;
    try {
      terrainHeight = this.game.terrainGenerator.getHeightAt(this.position.x, this.position.z);
      if (!isFinite(terrainHeight)) terrainHeight = 0;
    } catch (e) { terrainHeight = 0; }

    const groundLevel = terrainHeight + 0.9;

    // Hard clamp: physics body can never go below terrain surface
    if (this.body.position.y < groundLevel) {
      this.body.position.y = groundLevel;
      if (this.body.velocity.y < 0) this.body.velocity.y = 0;
      this.isGrounded = true;
      this.canJump = true;
      return;
    }

    this.isGrounded = this.position.y <= groundLevel + 0.25 && this.body.velocity.y <= 0.05;
    if (this.isGrounded && !this.canJump) this.canJump = true;

    if (this.spawnProtectionTime <= 0 && this.position.y < terrainHeight - 15) {
      this._deathCause = 'Fell out of the world';
      this.die();
    }
  }

  updateStamina(deltaTime) {
    if (this.isSprinting) {
      const drainRate = this._adrenalineActive ? 0 : this.staminaDrainRate;
      this.stamina = Math.max(0, this.stamina - drainRate * deltaTime);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * deltaTime);
    }

    // Don't lose hunger or thirst in friend's house
    if (!this.game.inFriendHouse) {
      this.hunger = Math.max(0, this.hunger - this.hungerDrainRate * deltaTime);

      if (this.hunger <= 0) {
        this._deathCause = 'Starvation';
        this.takeDamage(1 * deltaTime);
      }

      this.thirst = Math.max(0, this.thirst - this.thirstDrainRate * deltaTime);

      if (this.thirst <= 0) {
        this._deathCause = 'Dehydration';
        this.takeDamage(0.8 * deltaTime);
      }
    }
  }

  updateCamera() {
    if (this.inputManager.isPointerLocked()) {
      const sensitivity = this.game.settings.get('controls.mouseSensitivity') || 1;
      const invertY = this.game.settings.get('controls.invertY') || false;

      this.yaw -= this.inputManager.mouse.deltaX * sensitivity * 0.005;
      this.pitch -= this.inputManager.mouse.deltaY * sensitivity * 0.005 * (invertY ? -1 : 1);

      this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));

      // Drunk sway: safe roll applied inside YXZ euler so it never corrupts the quaternion
      const drunkRoll = this._drunkTimer > 0
        ? Math.sin(Date.now() / 500) * Math.min(this._drunkTimer / 30, 1) * (3 * Math.PI / 180)
        : 0;
      const euler = new THREE.Euler(this.pitch, this.yaw, drunkRoll, 'YXZ');
      this.camera.quaternion.setFromEuler(euler);
    }

    const targetEH = this.isCrouching ? this.crouchEyeHeight : this.eyeHeight;
    if (this._currentEyeH === undefined) this._currentEyeH = targetEH;
    this._currentEyeH += (targetEH - this._currentEyeH) * 0.2;
    const headOffset = new THREE.Vector3(0, this._currentEyeH, 0);

    // Camera head bob
    if (this.isGrounded && this.isMoving()) {
      const bobSpeed = this.isSprinting ? 14 : 9;
      const bobAmt   = this.isSprinting ? 0.055 : 0.03;
      this._bobTime += (this._dt || 0.016) * bobSpeed;
      headOffset.y += Math.sin(this._bobTime) * bobAmt;
      headOffset.x += Math.cos(this._bobTime * 0.5) * bobAmt * 0.4;
    } else {
      this._bobTime *= 0.85;
    }

    this.camera.position.copy(this.position).add(headOffset);

    // Dynamic crosshair spread
    const isMoving = this.isMoving();
    const baseGap = 6;
    const moveGap  = isMoving ? (this.isSprinting ? 16 : 10) : baseGap;
    const recoilGap = this._recoilRecovery > 0 ? Math.min(this._recoilRecovery * 60, 14) : 0;
    const gap = Math.round(moveGap + recoilGap);
    document.documentElement.style.setProperty('--xhair-gap', gap + 'px');

    // Screen shake on damage
    if (this._shakeTime > 0) {
      this._shakeTime -= this._dt || 0.016;
      this.camera.position.x += (Math.random() - 0.5) * 0.06;
      this.camera.position.y += (Math.random() - 0.5) * 0.04;
    }

    // Update flashlight to follow camera
    if (this._flashlight) {
      this._flashlight.intensity = this.flashlightOn ? 6.0 : 0; // brighter for the dark, foggy nights
      if (this.flashlightOn) {
        this.camera.getWorldDirection(this._flashFwd);
        this._flashlight.position.copy(this.camera.position).addScaledVector(this._flashOffset, 1);
        this._flashlightTarget.position.copy(this.camera.position).addScaledVector(this._flashFwd, 12);
      }
    }

    this.inputManager.resetMouseDelta();
  }

  updateHUD() {
    // Low-health pulse runs every frame for smooth visuals; everything else throttled
    const lowEl = this._lowHealthEl ?? (this._lowHealthEl = document.getElementById('low-health-overlay'));
    if (lowEl) {
      if (this.health < 30) {
        const speed = 1.5 + (30 - this.health) / 30 * 3.5;
        const pulse = 0.15 + 0.7 * (Math.sin(Date.now() / 1000 * speed * Math.PI) * 0.5 + 0.5);
        lowEl.style.opacity = pulse.toFixed(3);
      } else {
        lowEl.style.opacity = '0';
      }
    }

    // Throttle remaining DOM writes to ~80ms intervals
    this._hudThrottle = (this._hudThrottle ?? 0) + (this._dt ?? 0.016);
    if (this._hudThrottle < 0.08) return;
    this._hudThrottle = 0;

    this._updateXPBar();
    const healthPercent = Math.max(0, Math.min(100, (this.health / this.maxHealth) * 100));
    if (this.healthBar) {
      this.healthBar.style.width = healthPercent + '%';
      this.healthBar.classList.toggle('critical', this.health < 25);
    }
    if (this.healthText) this.healthText.textContent = Math.floor(this.health);

    // Berserker indicator
    if (!this._berserkerEl) this._berserkerEl = document.getElementById('berserker-indicator');
    if (this._berserkerEl) {
      const ber = this._berserkerPerk && this.health < this.maxHealth * 0.3;
      this._berserkerEl.classList.toggle('active', ber);
      document.body.classList.toggle('berserker-active', ber);
    }

    const staminaPercent = Math.max(0, Math.min(100, (this.stamina / this.maxStamina) * 100));
    if (this.staminaBar) this.staminaBar.style.width = staminaPercent + '%';

    // Cache container / value elements once
    if (!this._hungerCont)  this._hungerCont  = document.getElementById('hunger-bar-container');
    if (!this._thirstCont)  this._thirstCont  = document.getElementById('thirst-bar-container');
    if (!this._boostEl)     this._boostEl     = document.getElementById('speed-boost-indicator');
    if (!this._staminaVal)  this._staminaVal  = document.getElementById('stamina-val');
    if (!this._hungerVal)   this._hungerVal   = document.getElementById('hunger-val');
    if (!this._thirstVal)   this._thirstVal   = document.getElementById('thirst-val');
    if (!this._tempDisp)    this._tempDisp    = document.getElementById('temperature-display');
    if (this._staminaVal) this._staminaVal.textContent = Math.floor(this.stamina);

    const hungerPercent = Math.max(0, Math.min(100, (this.hunger / this.maxHunger) * 100));
    if (this.hungerBar) {
      this.hungerBar.style.width = hungerPercent + '%';
      if (this._hungerVal) this._hungerVal.textContent = Math.floor(this.hunger);
      if (this._hungerCont) {
        this._hungerCont.style.boxShadow = this.hunger < 15
          ? `0 0 12px rgba(255,80,0,0.6)` : '';
      }
    }

    const thirstPercent = Math.max(0, Math.min(100, (this.thirst / this.maxThirst) * 100));
    if (this.thirstBar) {
      this.thirstBar.style.width = thirstPercent + '%';
      if (this._thirstVal) this._thirstVal.textContent = Math.floor(this.thirst);
      if (this._thirstCont) {
        this._thirstCont.style.boxShadow = this.thirst < 15
          ? `0 0 12px rgba(0,120,255,0.6)` : '';
      }
    }

    // Temperature display
    if (this._tempDisp) {
      const temp = this.temperature ?? 37.0;
      this._tempDisp.textContent = `🌡 ${temp.toFixed(1)}°C`;
      this._tempDisp.className = temp < 35.5 ? 'cold' : temp > 38 ? 'hot' : 'warm';
    }

    const boostEl = this._boostEl;
    if (boostEl) {
      if (this._speedBoostTimer > 0) {
        boostEl.textContent = this._adrenalineActive ? `💉 ${Math.ceil(this._speedBoostTimer)}s` : `☕ ${Math.ceil(this._speedBoostTimer)}s`;
        boostEl.style.opacity = '1';
      } else {
        boostEl.style.opacity = '0';
      }
    }

    // Status effect icons (cached)
    if (!this._bleedEl)     this._bleedEl     = document.getElementById('status-bleeding');
    if (!this._infectEl)   this._infectEl    = document.getElementById('status-infected');
    if (!this._killHudEl)  this._killHudEl   = document.getElementById('hud-kills');
    if (!this._timeHudEl)  this._timeHudEl   = document.getElementById('hud-time');
    if (!this._zHudEl)     this._zHudEl      = document.getElementById('hud-zombies');
    if (!this._streakEl)   this._streakEl    = document.getElementById('kill-streak');
    if (!this._bhopEl)     this._bhopEl      = document.getElementById('bhop-chain');
    if (!this._compassEl)  this._compassEl   = document.getElementById('compass-display');
    if (!this._compassCardEl) this._compassCardEl = document.getElementById('compass-cardinal');
    if (!this._compassDegEl)  this._compassDegEl  = document.getElementById('compass-degrees');
    const bleedEl = this._bleedEl;
    const infectEl = this._infectEl;
    if (bleedEl)  bleedEl.style.display  = this._bleeding  ? 'flex' : 'none';
    if (infectEl) {
      infectEl.style.display = this._infected ? 'flex' : 'none';
      if (this._infected) {
        const remaining = Math.max(0, 60 - (this._infectTimer ?? 0));
        infectEl.textContent = remaining > 0 ? `☣ Infected (${Math.ceil(remaining)}s)` : '☣ Infected';
      }
    }

    // Live kill counter + survival timer + zombie count
    if (this._killHudEl) this._killHudEl.textContent = this.game.zombieKills || 0;
    if (this._timeHudEl && this.game.survivalStartTime) {
      const s = Math.floor((Date.now() - this.game.survivalStartTime) / 1000);
      this._timeHudEl.textContent = String(Math.floor(s / 60)).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
    }
    if (this._zHudEl) this._zHudEl.textContent = this.game.zombieManager?.getZombieCount?.() ?? 0;

    // Heartbeat audio when health is critically low
    if (this.health < 25 && !this.godMode) {
      const beatInterval = 0.5 + (this.health / 25) * 0.8; // faster as health drops
      this._heartbeatTimer -= this._dt || 0.016;
      if (this._heartbeatTimer <= 0) {
        this.game.audioManager?.resume?.();
        this.game.audioManager?.playHeartbeat?.();
        this._heartbeatTimer = beatInterval;
      }
    } else {
      this._heartbeatTimer = 0;
    }

    // Kill streak indicator
    if (this._streakEl) {
      if (this._killStreak >= 3) {
        const labels = ['','','','🔥 Triple Kill!','🔥🔥 Rampage!','💀 Killing Spree!','💀💀 Unstoppable!','⚡ GODLIKE!','⚡⚡ LEGENDARY!'];
        this._streakEl.textContent = labels[Math.min(this._killStreak, labels.length - 1)] ?? `⚡ ×${this._killStreak} Streak!`;
        this._streakEl.style.opacity = '1';
      } else {
        this._streakEl.style.opacity = '0';
      }
    }

    // Bhop chain indicator
    if (this._bhopEl) {
      if (this._bhopChain > 0) {
        this._bhopEl.textContent = `⚡ ×${this._bhopChain}`;
        this._bhopEl.style.opacity = '1';
      } else {
        this._bhopEl.style.opacity = '0';
      }
    }

    // Compass live update — only when compass display is visible
    if (this._compassEl && this._compassEl.style.display !== 'none') {
      const deg = (((-this.yaw * 180 / Math.PI) % 360) + 360) % 360;
      const cardinals = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
      if (this._compassCardEl) this._compassCardEl.textContent = cardinals[Math.round(deg / 22.5) % 16];
      if (this._compassDegEl)  this._compassDegEl.textContent  = Math.round(deg) + '°';
    }

    // ── Active buff / debuff strip ────────────────────────────────────────────
    if (!this._buffBar) {
      // Reuse the #buff-bar from index.html — creating a second element with the
      // same id left two overlapping strips fighting over the same statuses
      let el = document.getElementById('buff-bar');
      if (!el) {
        el = document.createElement('div');
        el.id = 'buff-bar';
        document.body.appendChild(el);
      }
      el.style.cssText = 'position:fixed;bottom:78px;left:50%;transform:translateX(-50%);display:flex;gap:6px;pointer-events:none;z-index:800;';
      this._buffBar = el;
    }
    const buffs = [];
    if (this._adrenalineActive)          buffs.push({ icon:'⚡', label:'Adrenaline',  color:'#ff8833' });
    if (this._immune)                    buffs.push({ icon:'🛡', label:'Immune',      color:'#88ccff' });
    if (this.game?._trackerActive && this.game._trackerTimer > 0) buffs.push({ icon:'📡', label:'Tracker', color:'#ffcc44' });
    if (this._morphineTimer > 0)         buffs.push({ icon:'💉', label:'Morphine',    color:'#aaccff' });
    if (this._speedBoostTimer > 0 && !this._adrenalineActive) buffs.push({ icon:'🏃', label:'Speed',  color:'#88ff88' });
    if (this._sleeping)                  buffs.push({ icon:'😴', label:'Resting',     color:'#88ffaa' });
    if (this._bleeding)                  buffs.push({ icon:'🩸', label:'Bleeding',    color:'#ff3333' });
    if (this._infected)                  buffs.push({ icon:'☣', label:'Infected',    color:'#44ff44' });
    if (this.burned)                     buffs.push({ icon:'🔥', label:'Burned',      color:'#ff6600' });
    if (this.poisoned)                   buffs.push({ icon:'☠', label:'Poisoned',    color:'#88ff44' });
    if (this.blurredVision)              buffs.push({ icon:'👁', label:'Blurred',     color:'#aaaaff' });
    if (this.flashlightOn)               buffs.push({ icon:'🔦', label:'Flashlight',  color:'#ffffaa' });
    if (this.nightVisionOn)              buffs.push({ icon:'🌙', label:'NightVis',    color:'#44ff88' });
    if ((this.hunger ?? 100) < 25)       buffs.push({ icon:'🍖', label:'Starving',    color:'#ff6633' });
    if ((this.thirst ?? 100) < 25)       buffs.push({ icon:'💧', label:'Dehydrated', color:'#6699ff' });
    this._buffBar.innerHTML = buffs.map(b =>
      `<div style="background:rgba(0,0,0,0.7);border:1px solid ${b.color};border-radius:4px;padding:3px 7px;font-size:11px;color:${b.color};font-family:monospace;">${b.icon} ${b.label}</div>`
    ).join('');

    // (temperature display handled by #temperature-display above via this._tempDisp)
  }

  gainXP(amount, reason = '') {
    this.xp += amount;
    // Loop so a single large award (stealth + streak kill, quest reward, etc.) can
    // grant multiple levels instead of stranding XP above the next threshold with
    // the bar clamped at 100%. Capped defensively so it can never spin forever.
    let guard = 0;
    while (this.xp >= this.level * 120 && guard++ < 50) {
      this.xp -= this.level * 120;
      this.level++;
      this._applyLevelPerks(this.level);
      this.maxHealth = Math.min(200, this.maxHealth + 5);
      this.maxStamina = Math.min(150, this.maxStamina + 3);
      // Level-up notification
      if (!this._lootNotifEl) this._lootNotifEl = document.getElementById('loot-notification');
      const notif = this._lootNotifEl;
      if (notif) {
        notif.textContent = `⬆ LEVEL UP! You are now Level ${this.level}  (+5 MaxHP, +3 MaxStamina)`;
        notif.style.color = '#ffdd44';
        notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
      }
      // Screen flash
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,220,0,0.18);pointer-events:none;z-index:9998;';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 400);
    }
    this._updateXPBar();
    if (amount >= 8) this._spawnXPFloat(amount);
  }

  _applyLevelPerks(level) {
    const perks = {
      2:  { name: 'Tough Skin',       desc: '+10 max health',            fn: p => { p.maxHealth += 10; p.health = Math.min(p.health + 10, p.maxHealth); } },
      3:  { name: 'Iron Stomach',     desc: 'Dirty water 50% less harmful', fn: p => { p._ironStomach = true; } },
      4:  { name: 'Sprinter',         desc: '+1 sprint speed',           fn: p => { p.sprintSpeed += 1; } },
      5:  { name: 'Combat Medic',     desc: '+15 max health',            fn: p => { p.maxHealth += 15; p.health = Math.min(p.health + 15, p.maxHealth); } },
      6:  { name: 'Scavenger',        desc: 'Rare items give 2x XP',     fn: p => { p._scavengerPerk = true; } },
      7:  { name: 'Quick Reload',     desc: 'Reload 25% faster',         fn: p => { p._quickReload = true; } },
      8:  { name: 'Armored',          desc: '+8% innate damage reduction', fn: p => { p._innateArmor = (p._innateArmor ?? 0) + 0.08; } },
      9:  { name: 'Adrenaline Rush',  desc: 'Low HP triggers speed burst', fn: p => { p._adrenalinePerk = true; } },
      10: { name: 'Berserker Mode',   desc: 'Below 30% HP: +25% damage dealt', fn: p => { p._berserkerPerk = true; } },
    };
    const perk = perks[level];
    if (!perk) return;
    perk.fn(this);
    // Show perk notification
    if (!this._lootNotifEl) this._lootNotifEl = document.getElementById('loot-notification');
    const notif = this._lootNotifEl;
    if (notif) {
      notif.textContent = `✨ PERK: ${perk.name} — ${perk.desc}`;
      notif.style.color = '#ffaa44';
      notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
    }
    // Large visual flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,170,0,0.15);pointer-events:none;z-index:9998;transition:opacity 0.8s;';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 200);
    setTimeout(() => flash.remove(), 1000);
  }

  _spawnXPFloat(amount) {
    const el = document.createElement('div');
    el.textContent = `+${amount} XP`;
    el.style.cssText = `position:fixed;left:50%;top:${35 + Math.random()*5}%;transform:translateX(-50%);color:#aaddff;font-size:13px;font-weight:bold;font-family:monospace;pointer-events:none;z-index:9999;text-shadow:0 0 6px #4488ff;transition:all 1.2s ease-out;`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = `${25 + Math.random()*5}%`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1300);
  }

  _updateXPBar() {
    if (!this._xpBar) {
      this._xpBar = document.getElementById('xp-bar-container');
      if (!this._xpBar) {
        const wrap = document.createElement('div');
        wrap.id = 'xp-bar-container';
        const label = document.createElement('div');
        label.id = 'xp-label';
        const track = document.createElement('div');
        track.id = 'xp-track';
        const fill = document.createElement('div');
        fill.id = 'xp-bar';
        track.appendChild(fill);
        wrap.appendChild(label);
        wrap.appendChild(track);
        document.body.appendChild(wrap);
        this._xpBar = wrap;
      }
      this._xpFill  = document.getElementById('xp-bar');
      this._xpLabel = document.getElementById('xp-label');
    }
    const pct = Math.min(100, (this.xp / (this.level * 120)) * 100);
    if (this._xpFill)  this._xpFill.style.width = pct + '%';
    if (this._xpLabel) this._xpLabel.textContent = `LVL ${this.level}  ${Math.floor(this.xp)} / ${this.level * 120} XP`;
  }

  // ── Move-speed debuffs (stacking-safe) ────────────────────────────────────
  // Several slow sources (each acid pool, phantom fear) register by a unique id;
  // the strongest (lowest) multiplier wins. Clearing one source no longer cancels
  // another that is still active — the old single-scalar approach let the first
  // acid pool to expire restore full speed while you stood in a second one.
  applySpeedDebuff(id, mult) {
    if (!this._speedDebuffs) this._speedDebuffs = {};
    this._speedDebuffs[id] = mult;
    this._recomputeMoveMult();
  }
  clearSpeedDebuff(id) {
    if (this._speedDebuffs && id in this._speedDebuffs) {
      delete this._speedDebuffs[id];
      this._recomputeMoveMult();
    }
  }
  clearAllSpeedDebuffs() {
    this._speedDebuffs = {};
    this._moveSpeedMult = 1.0;
  }
  _recomputeMoveMult() {
    let m = 1.0;
    if (this._speedDebuffs) for (const v of Object.values(this._speedDebuffs)) if (v < m) m = v;
    this._moveSpeedMult = m;
  }

  takeDamage(amount, sourcePosition) {
    if (this.godMode) return;
    if (this.spawnProtectionTime > 0) return; // brief invulnerability after (re)spawn
    if (sourcePosition) this._showHitDirection(sourcePosition);

    // Morphine suppresses screen shake
    if (this._morphineTimer > 0) {
      // no shake
    } else {
      this._shakeTime = Math.min(0.25, amount * 0.008);
      this._damageFlash = 0.5;
    }

    // Apply armor reduction from equipped vest
    let reduced = amount;
    if (this.game.inventorySystem) {
      const hasVest    = this.game.inventorySystem.slots.some(s => s?.type === 'armor_vest');
      const hasHelmet  = this.game.inventorySystem.slots.some(s => s?.type === 'armor_helmet');
      const hasJacket  = this.game.inventorySystem.slots.some(s => s?.type === 'cloth_military_jacket' || s?.type === 'cloth_jacket');
      let armorPct = 0;
      if (hasVest)   armorPct += 0.35;
      if (hasHelmet) armorPct += 0.15;
      if (hasJacket) armorPct += 0.10;
      armorPct += (this._innateArmor ?? 0);
      reduced = amount * (1 - Math.min(0.75, armorPct));
    }

    this.health = Math.max(0, this.health - reduced);
    if (this.health <= 0) this.die();
  }

  _showHitDirection(sourcePos) {
    const cam = this.camera;
    if (!cam) return;
    // Get 2D screen angle from camera forward to attacker direction
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const toSrc = new THREE.Vector3(
      sourcePos.x - this.position.x, 0,
      sourcePos.z - this.position.z
    ).normalize();
    // Signed angle: positive = right, negative = left
    const cross = forward.x * toSrc.z - forward.z * toSrc.x;
    const dot   = forward.dot(toSrc);
    const angle = Math.atan2(cross, dot) * (180 / Math.PI);
    // Map angle to screen edge arrow
    const cx = window.innerWidth  / 2;
    const cy = window.innerHeight / 2;
    const rad = Math.atan2(cross, dot);
    const dist = Math.min(cx, cy) * 0.72;
    const sx = cx + Math.sin(rad) * dist;
    const sy = cy - Math.cos(rad) * dist;
    const el = document.createElement('div');
    el.className = 'hit-dir-arrow';
    el.textContent = '▼';
    el.style.left = sx + 'px';
    el.style.top  = sy + 'px';
    el.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  restoreStamina(amount) {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
  }

  setDeathCause(cause) {
    this._deathCause = cause;
  }

  die() {
    // Guard against multiple death causes firing in the same frame (bleed +
    // infection + starvation can all call die() in one update()) — the first one
    // wins, so the death-cause shown matches what actually killed you and pause()
    // isn't hammered.
    if (this._dead) return;
    this._dead = true;
    const deathScreen = document.getElementById('death-screen');
    if (!deathScreen) return;
    deathScreen.style.display = 'flex';

    const causeEl = document.getElementById('death-cause');
    if (causeEl) causeEl.textContent = this._deathCause;

    // Death screen stats
    const kills = this.game.zombieKills || 0;
    const elapsed = Math.floor((Date.now() - (this.game.survivalStartTime || Date.now())) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    const dist = Math.floor(this.game.distanceTraveled || 0);
    const killEl = document.getElementById('stat-kills');
    const timeEl = document.getElementById('stat-time');
    const distEl = document.getElementById('stat-distance');
    if (killEl) killEl.textContent = kills;
    if (timeEl) timeEl.textContent = mm + ':' + ss;
    if (distEl) distEl.textContent = dist;

    this.game.pause();
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.body.position.copy(this.position);
  }

  getPosition() {
    return this.position.clone();
  }

  getBody() {
    return this.body;
  }

  registerKill() {
    const wasStealth = this._pendingStealthKill;
    this._pendingStealthKill = false;

    this._killStreak++;
    this._killStreakTimer = 0;
    this.gainXP(25 + this._killStreak * 5, 'kill');
    // Streak bonuses
    if (this._killStreak === 5) {
      this._speedBoostTimer = 8;
      this._speedBoostMult  = 1.25;
    } else if (this._killStreak === 10) {
      this.health = Math.min(this.maxHealth, this.health + 20);
      this._speedBoostTimer = 12;
      this._speedBoostMult  = 1.4;
    }
    if (wasStealth) {
      this._stealthKillCount = (this._stealthKillCount ?? 0) + 1;
      this.gainXP(80, 'stealth_kill');
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '🗡 STEALTH KILL! +80 XP'; notif.style.color='#88ffcc'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
    }
  }

  isMoving() {
    return this.inputManager.isMoving();
  }
}
