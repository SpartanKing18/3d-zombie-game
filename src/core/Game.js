import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Scene } from './Scene.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { InputManager } from './InputManager.js';
import { CommandSystem } from './CommandSystem.js';
import { Settings } from './Settings.js';
import { AudioManager } from './AudioManager.js';
import { Player } from '../entities/Player.js';
import { ZombieManager } from '../entities/ZombieManager.js';
import { zombieDisplayName } from '../entities/zombies/ZombieBase.js';
import { VehicleManager } from '../entities/VehicleManager.js';
import { TerrainGenerator } from '../world/TerrainGenerator.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { BuildingGenerator } from '../world/BuildingGenerator.js';
import { FurnitureGenerator } from '../world/FurnitureGenerator.js';
import { TreeGenerator } from '../world/TreeGenerator.js';
import { DayNightCycle } from '../world/DayNightCycle.js';
import { WeatherSystem } from '../world/WeatherSystem.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { WeaponViewModel } from '../weapons/WeaponViewModel.js';
import { SettingsMenu } from '../ui/SettingsMenu.js';
import { InventorySystem } from '../ui/InventorySystem.js';
import { CraftingSystem } from '../ui/CraftingSystem.js';
import { NPCManager } from '../entities/NPCManager.js';
import { PlayerActions } from '../entities/PlayerActions.js';
import { InteractionSystem } from '../ui/InteractionSystem.js';
import { MinimapRenderer } from '../ui/MinimapRenderer.js';
import { CutsceneManager } from '../cutscenes/CutsceneManager.js';
import { OpeningCutscene } from '../cutscenes/OpeningCutscene.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { FriendsHouse } from '../environments/FriendsHouse.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { WorldItemSystem } from '../systems/WorldItemSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';

export class Game {
  constructor() {
    this.scene = new Scene();
    this.physicsWorld = new PhysicsWorld();
    this.inputManager = new InputManager();
    this.settings = new Settings();
    this.audioManager = new AudioManager(this);
    this.commandSystem = new CommandSystem(this);
    this.cutsceneManager = new CutsceneManager(this);
    this.dialogueSystem = new DialogueSystem(this);
    this.missionSystem = new MissionSystem(this);
    this.friendsHouse = new FriendsHouse(this);
    this.inFriendHouse = false;

    this.player = null;
    this.camera = this.scene.getCamera();
    this.renderer = this.scene.getRenderer();

    this.lastTime = performance.now();
    this.currentTime = performance.now();
    this.deltaTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = 0;

    this.isRunning = true;
    this.isPaused = false;
    this.inCutscene = false;
    this.cutsceneScene = null;
    this.cutsceneCamera = null;

    this.zombieManager = null;
    this.vehicleManager = null;
    this.weaponManager = null;
    this.particleSystem = null;

    this.initializeSystems();
    this.setupResizeListener();
  }

  initializeSystems() {
    this.terrainGenerator = new TerrainGenerator(this);
    this.furnitureGenerator = new FurnitureGenerator(this);
    this.buildingGenerator = new BuildingGenerator(this, this.terrainGenerator, this.furnitureGenerator);
    this.treeGenerator = new TreeGenerator(this);
    this.chunkManager = new ChunkManager(this, this.terrainGenerator);

    this.player = new Player(this);
    this.zombieManager = new ZombieManager(this);
    this.vehicleManager = new VehicleManager(this);
    this.weaponManager = new WeaponManager(this);
    this.weaponViewModel = new WeaponViewModel(this.scene.getCamera(), this.scene.scene);
    this.dayNightCycle = new DayNightCycle(this);
    this.weatherSystem = new WeatherSystem(this);
    this.settingsMenu = new SettingsMenu(this);
    this.inventorySystem = new InventorySystem(this);
    this.craftingSystem = new CraftingSystem(this, this.inventorySystem);
    this.npcManager = new NPCManager(this);
    this.playerActions = new PlayerActions(this);
    this.interactionSystem = new InteractionSystem(this);
    this.minimapRenderer = new MinimapRenderer(this);
    this.particleSystem = new ParticleSystem(this.scene.scene);
    this.worldItemSystem = new WorldItemSystem(this);
    this.achievementSystem = new AchievementSystem(this);
    this.setupSettingsKey();
    this.setupDeathScreenHandlers();
    this.setupCutscenes();
  }

  setupCutscenes() {
    this.cutsceneManager.registerCutscene('opening', OpeningCutscene);
  }

  setupDeathScreenHandlers() {
    const respawnBtn = document.getElementById('respawn-btn');
    const quitBtn = document.getElementById('quit-btn');

    if (respawnBtn) {
      respawnBtn.onclick = () => this.respawn();
    }

    if (quitBtn) {
      quitBtn.onclick = () => this.quitToMenu();
    }
  }

  onZombieKilled(zombie) {
    this.zombieKills = (this.zombieKills || 0) + 1;
    this._headshotCount = this._headshotCount ?? 0;
    this.missionSystem?.trackZombieKill?.();
    this.player?.registerKill?.();

    // Boss event at 50 kills
    if (this.zombieKills === 50 && !this.inFriendHouse) {
      this._triggerBossEvent();
    }

    // Kill feed (primary UI) — replaces the per-kill toast
    if (!this._killFeedInit) { this._initKillFeed(); this._killFeedInit = true; }
    const typeName = zombie.type ? zombieDisplayName(zombie.type) : 'Zombie';
    this._addKillFeedEntry(typeName, this.zombieKills, zombie.type);
  }

  // Hold right-mouse to aim down sights: smooth per-weapon FOV zoom, sniper scope
  // overlay, viewmodel pulled to centre, and tighter spread (applied in WeaponBase).
  _updateADS(dt) {
    const cam = this.scene.getCamera();
    if (!cam) return;
    const weapon = this.weaponManager?.getCurrentWeapon?.();
    const isGun = !!weapon && weapon.magSize !== -1;
    const held = !!this.inputManager?.mouse?.rightClick;
    const canAim = isGun && this.isRunning && !this.isPaused
      && !this.inventorySystem?.isOpen && this.inputManager?.isPointerLocked?.();
    const want = canAim && held;

    if (want !== this._adsActive) {
      this._adsActive = want;
      const nm = (weapon?.name || '').toLowerCase();
      const isSniper = /sniper/.test(nm) || weapon?.type === 'sniper';
      const scopeEl = document.getElementById('scope-overlay');
      if (scopeEl) scopeEl.style.display = (want && isSniper) ? 'block' : 'none';
      this.weaponViewModel?.setADS?.(want, isSniper);
      this._adsManaging = true; // take control of fov until we settle back to base
    }

    if (!this._adsManaging) return;
    const base = 75;
    let target = base;
    if (this._adsActive && weapon) {
      const nm = (weapon.name || '').toLowerCase();
      target = /sniper/.test(nm) ? 14
             : /shotgun|sawed/.test(nm) ? 58
             : /pistol|revolver|flare/.test(nm) ? 52
             : 44; // rifle / smg
    }
    cam.fov += (target - cam.fov) * Math.min(1, dt * 14);
    if (!this._adsActive && Math.abs(cam.fov - base) < 0.2) {
      cam.fov = base;
      this._adsManaging = false; // settled — release fov so other effects can use it
    }
    cam.updateProjectionMatrix();
  }

  _initKillFeed() {
    // #kill-feed is already in HTML; this is a no-op fallback
    if (document.getElementById('kill-feed')) return;
    const el = document.createElement('div');
    el.id = 'kill-feed';
    document.body.appendChild(el);
  }

  _addKillFeedEntry(typeName, killCount, typeId) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const colors = {
      walker:'#88ff88', runner:'#44ff44', tank:'#ff8800', spitter:'#88ff44',
      screamer:'#ff44ff', crawler:'#ffcc44', armored:'#aaffff', bloater:'#88ff00',
      stalker:'#00ffff', regenerator:'#00ff88', berserker:'#ff4444', leaper:'#ff8844',
      child_zombie:'#ffff44', juggernaut:'#ff0000', phantom:'#cc88ff',
      horde_master:'#ffdd00', bomber:'#ff6600', acid_spitter:'#88ff00',
      zombie_hound:'#ffaa44', necromancer:'#cc44ff',
      zombie_soldier:'#aaddff', mutant_giant:'#ff6622',
      splitter:'#ccff44', mini_splitter:'#aaee22',
    };
    const col = colors[typeId] ?? colors[typeName.toLowerCase().replaceAll(' ', '_')] ?? '#ffffff';
    const entry = document.createElement('div');
    entry.className = 'kill-feed-entry';
    entry.style.setProperty('--kf-color', col);
    entry.textContent = `💀 ${typeName}  ×${killCount}`;
    feed.insertBefore(entry, feed.firstChild);
    // Keep max 8 entries
    while (feed.children.length > 8) feed.removeChild(feed.lastChild);
    // Fade out after 4s
    setTimeout(() => { entry.style.opacity = '0'; entry.style.transform = 'translateX(12px)'; }, 4000);
    setTimeout(() => { if (entry.parentNode) entry.remove(); }, 4700);
  }

  _updateComboHUD(combo, mult) {
    if (!this._comboEl) {
      this._comboEl = document.getElementById('melee-combo');
      if (!this._comboEl) {
        const el = document.createElement('div');
        el.id = 'melee-combo';
        document.body.appendChild(el);
        this._comboEl = el;
      }
    }
    if (combo < 2) { this._comboEl.style.opacity = '0'; return; }
    const size = Math.min(28, 14 + combo * 2);
    const col = combo >= 8 ? '#ff0000' : combo >= 5 ? '#ff8800' : combo >= 3 ? '#ffdd00' : '#ffffff';
    this._comboEl.style.cssText = `position:fixed;top:45%;left:70%;transform:translate(-50%,-50%) scale(${0.9+combo*0.05});pointer-events:none;z-index:900;font-family:monospace;text-align:center;opacity:1;transition:opacity 0.2s;text-shadow:0 0 10px ${col};`;
    this._comboEl.innerHTML = `<div style="font-size:${size}px;color:${col};">×${combo} COMBO!</div><div style="font-size:11px;color:#aaaaaa;">${mult.toFixed(1)}× damage</div>`;
  }

  _updateDifficultyHUD() {
    if (this.inFriendHouse) return;
    if (!this._diffEl) {
      this._diffEl = document.getElementById('difficulty-hud');
      if (!this._diffEl) {
        const el = document.createElement('div');
        el.id = 'difficulty-hud';
        document.body.appendChild(el);
        this._diffEl = el;
      }
    }
    const elapsed = this.survivalStartTime ? (Date.now() - this.survivalStartTime) / 1000 : 0;
    const wave = Math.floor(elapsed / 60) + 1;
    const diffMult = Math.min(3, 1 + elapsed / 180);
    const zombCount = this.zombieManager?.getZombieCount() ?? 0;
    const threatCol = diffMult > 2.5 ? '#ff0000' : diffMult > 2 ? '#ff8800' : diffMult > 1.5 ? '#ffdd00' : '#44ff88';
    this._diffEl.innerHTML = `
      <div style="color:${threatCol};font-size:11px;">WAVE ${wave}</div>
      <div style="color:#666;font-size:9px;">${zombCount} alive</div>
      <div style="color:#444;font-size:9px;">${diffMult.toFixed(1)}× threat</div>`;
  }

  triggerHitmarker() {
    const el = document.getElementById('hitmarker');
    if (!el) return;
    el.style.opacity = '1';
    clearTimeout(this._hitmarkerTimer);
    this._hitmarkerTimer = setTimeout(() => { el.style.opacity = '0'; }, 120);
  }

  respawn() {
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) deathScreen.style.display = 'none';
    this.player.health = this.player.maxHealth;
    this.player.stamina = this.player.maxStamina;
    this.player.hunger = this.player.maxHunger;
    if (this.player.thirst !== undefined) this.player.thirst = this.player.maxThirst;
    this.player.spawnProtectionTime = 5;
    // Death must not carry status effects into the new life
    this.player._bleeding = false;
    this.player._bleedTimer = 0;
    this.player._infected = false;
    this.player._infectTimer = 0;
    this.player.burned = false;
    this.player.poisoned = false;
    this.player._drunkTimer = 0;
    this.player._killStreak = 0;
    this.player._damageFlash = 0;
    this.player.body.velocity.set(0, 0, 0);
    this.zombieKills = 0;
    this.distanceTraveled = 0;
    this.survivalStartTime = Date.now();

    if (this.inFriendHouse) {
      // Respawn on the house floor rather than dropping from 100m in the open world
      this.player.setPosition(-5, 1.45, 6);
    } else {
      const terH = this.terrainGenerator?.getHeightAt?.(0, 0) ?? 0;
      this.player.setPosition(0, (isFinite(terH) ? terH : 0) + 0.9, 0);
    }
    this.resume();
  }

  quitToMenu() {
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) deathScreen.style.display = 'none';
    this.stop();
    document.getElementById('main-menu').style.display = 'flex';
    window.location.reload();
  }

  setupSettingsKey() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.commandSystem.isOpen && this.settingsMenu.isOpen === false) {
        this.settingsMenu.open();
        e.preventDefault();
      }

      if (e.key.toLowerCase() === 'm' && !this.commandSystem.isOpen && !this.settingsMenu.isOpen) {
        const minimap = document.getElementById('minimap-container');
        if (minimap) {
          minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
        }
        e.preventDefault();
      }

      if (e.key === 'Tab' && !this.commandSystem.isOpen) {
        e.preventDefault();
        if (this.minimapRenderer._fullMapEl) {
          this.minimapRenderer.hideFullMap();
        } else {
          this.minimapRenderer.showFullMap();
        }
      }

      if (e.key === 'F5') { e.preventDefault(); this.saveGame(); }
      if (e.key === 'F9') { e.preventDefault(); this.loadGame(); }

      if (e.key.toLowerCase() === 'p' && !this.commandSystem.isOpen) {
        e.preventDefault();
        this._togglePerkTree();
      }

      if (e.key.toLowerCase() === 'k' && !this.commandSystem.isOpen) {
        e.preventDefault();
        this._toggleStatsScreen();
      }
    });
  }

  setupResizeListener() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start() {
    try {
      console.log('Starting game...');
      this.isRunning = true;
      this.isPaused = false;
      this.survivalStartTime = Date.now();
      this._sessionStartTime = Date.now();
      this.gameLoop();
      this.inFriendHouse = true;
      this.friendsHouse.buildHouse();
      // Theme music — loops back-to-back automatically
      this.audioManager?.playMusic('/music/the-driest-beast.mp3');
      // Pre-load outdoor terrain in the background so walking outside is seamless
      setTimeout(() => this.friendsHouse.preloadOutdoorTerrain(), 5000);
      // Spawn player in the living room (x:-14 to +6, z:0 to +10)
      this.player.setPosition(-5, 1.45, 6);
      this.player.body.velocity.set(0, 0, 0);
      this.player.spawnProtectionTime = 5;
      // Populate the house with world items
      this._spawnHouseItems();
      this._initKillFeed();
      this._killFeedInit = true;
      // Click: lock pointer first, then subsequent clicks pick up items
      const canvas = document.getElementById('game-canvas');
      canvas.addEventListener('click', () => this.inputManager.requestPointerLock());
      this._setupClickPickup();

      // ADS is hold-to-aim now (see _updateADS, driven from the update loop).
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      // Step physics to settle player
      for (let i = 0; i < 20; i++) {
        this.physicsWorld.step();
        this.player.update(0.016);
      }
    } catch (e) {
      console.error('Failed to start game:', e);
      throw e;
    }
  }

  startGameAfterCutscene() {
    // Don't generate terrain if transitioning to friend's house
    if (this.inFriendHouse) {
      console.log('Entered friend\'s house. Skipping terrain generation.');
      return;
    }

    try {
      console.log('Starting terrain generation...');
      const chunks = [
        [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [-1, -1], [1, -1], [-1, 1]
      ];

      for (const [x, z] of chunks) {
        try {
          this.terrainGenerator.generateChunk(x, z);
          this.buildingGenerator.generateBuildingsForChunk(x, z, 64, 16);
          this.treeGenerator.generateTreesForChunk(x, z, 64, this.terrainGenerator);
        } catch (chunkError) {
          console.error(`Error generating chunk [${x}, ${z}]:`, chunkError);
        }
      }

      console.log('Terrain generation complete. Spawning zombies...');
      const playerStartPos = this.player.getPosition();
      this.zombieManager.spawnWave(5, playerStartPos.x + 60, playerStartPos.z, 40);

      console.log('Game started! Terrain, buildings, trees, and zombies generated.');
    } catch (e) {
      console.error('Failed to start game:', e);
      throw e;
    }
  }

  gameLoop = () => {
    requestAnimationFrame(this.gameLoop);

    const now = performance.now();
    this.currentTime = now;
    this.deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.frameCount++;
    this.fpsTimer += this.deltaTime;

    if (this.fpsTimer >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
      this.updateFPSDisplay();
    }

    if (!this.isPaused && this.isRunning && !this.inCutscene) {
      this.update();
      this.physicsWorld.step(Math.min(this.deltaTime, 0.05));
    }

    if (this.inCutscene && this.cutsceneScene && this.cutsceneCamera) {
      this.renderer.render(this.cutsceneScene, this.cutsceneCamera);
    } else {
      this.scene.render();
    }
  };

  update() {
    const dt = Math.min(this.deltaTime, 0.05); // clamp large deltas (tab switch, etc.)

    try { if (this.player) this.player.update(dt); } catch (e) { console.error('[Player]', e); }

    if (this.inFriendHouse) {
      try { this.friendsHouse.update(dt); } catch (e) { console.error('[FriendsHouse]', e); }
      try { this.handleDoorInteraction(); } catch (e) { console.error('[DoorInteract]', e); }
      // Exit house if player walks through a door to the outside
      try {
        const px = this.player?.body?.position?.x ?? 0;
        const pz = this.player?.body?.position?.z ?? 0;
        if (pz > 11.5 || px > 15.5) {
          this.friendsHouse.exitHouse();
        }
      } catch (e) { /* silent */ }
    }

    try {
      if (this.weaponManager) { this.weaponManager.update(dt); this.handleWeaponInput(); }
      this._updateADS(dt);
      this.weaponViewModel?.update(dt, this.player, this.weaponManager?.getCurrentWeapon?.());
    } catch (e) { console.error('[WeaponManager]', e); }

    try {
      if (!this.inFriendHouse && this.zombieManager) this.zombieManager.update(dt);
    } catch (e) { console.error('[ZombieManager]', e); }

    try { if (this.npcManager) this.npcManager.update(dt); } catch (e) { /* silent */ }

    try {
      if (!this.inFriendHouse && this.chunkManager && this.player)
        this.chunkManager.update(this.player.getPosition());
    } catch (e) { console.error('[ChunkManager]', e); }

    try { if (this.dayNightCycle) this.dayNightCycle.update(dt); } catch (e) { /* silent */ }
    try { this.scene.updateClouds(dt); } catch (e) { /* silent */ }
    try { if (this.weatherSystem) this.weatherSystem.update(dt); } catch (e) { /* silent */ }
    try { if (this.minimapRenderer) this.minimapRenderer.update(); } catch (e) { /* silent */ }
    try { if (this.particleSystem) this.particleSystem.update(dt); } catch (e) { /* silent */ }
    try { if (this.worldItemSystem) this.worldItemSystem.update(dt); } catch (e) { /* silent */ }
    try { if (this.achievementSystem) this.achievementSystem.update(dt); } catch(e) { /* silent */ }
    try { this._updateCampfires(dt); } catch (e) { /* silent */ }
    try { this._updateElectroTraps(dt); } catch(e) { /* silent */ }
    try { this._updatePlacedTraps(dt); } catch(e) { /* silent */ }
    try { this._updateAirdropTimer(dt); } catch(e) { /* silent */ }
    try { if (this.interactionSystem) this.interactionSystem.update(); } catch (e) { /* silent */ }

    // Tick down noise events
    if (this._noiseEvents?.length) {
      const dt2 = Math.min(this.deltaTime, 0.05);
      this._noiseEvents = this._noiseEvents.filter(e => {
        e.ttl -= dt2;
        return e.ttl > 0;
      });
    }

    this.updateCoordinates();
    try { this._updateDifficultyHUD(); } catch (e) { /* silent */ }
    try { this._updateCompass(); } catch (e) { /* silent */ }
  }

  _updateCompass() {
    if (!this._compassEl) {
      this._compassEl = document.getElementById('compass');
      if (!this._compassEl) return;
    }
    const cam = this.scene.getCamera();
    if (!cam) return;
    if (!this._camDir) this._camDir = new THREE.Vector3();
    cam.getWorldDirection(this._camDir);
    const yaw = Math.atan2(this._camDir.x, this._camDir.z);
    const deg = ((yaw * 180 / Math.PI) + 360) % 360;
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    const dir = dirs[Math.round(deg / 45) % 8];
    const isNorth = dir === 'N';
    this._compassEl.innerHTML = `<span class="${isNorth ? 'north' : ''}">${dir}</span> ${Math.round(deg)}°`;
  }

  handleDoorInteraction() {
    if (!this._interactPromptEl) this._interactPromptEl = document.getElementById('interact-prompt');
    if (!this._interactLabelEl)  this._interactLabelEl  = document.getElementById('interact-label');
    const prompt = this._interactPromptEl;
    const label  = this._interactLabelEl;
    const fNow   = this.inputManager.isKeyPressed('f');

    if (!this.player?.body) { if (prompt) prompt.style.display = 'none'; return; }
    const px = this.player.body.position.x;
    const py = this.player.body.position.y;
    const pz = this.player.body.position.z;

    // 1. Doors only — items are picked up by clicking directly on them
    const nearDoor = this.friendsHouse?.getNearbyDoor(px, pz, 2.5);
    if (nearDoor) {
      const isOpen = nearDoor.userData.isOpen;
      if (prompt) { prompt.style.display = 'flex'; if (label) label.textContent = isOpen ? '[F] Close Door' : '[F] Open Door'; }
      if (fNow && !this._fWasDown) {
        this._fWasDown = true;
        this.friendsHouse.toggleDoor(nearDoor.userData.id);
      } else if (!fNow) { this._fWasDown = false; }
      return;
    }

    // 2. Safe interaction
    if (this._safeObjects?.length) {
      const safes = this._safeObjects;
      for (const safe of safes) {
        if (safe.opened) continue;
        const dx = px - safe.x, dz = pz - safe.z;
        if (dx*dx + dz*dz < 2.5) {
          if (prompt) { prompt.style.display = 'flex'; if (label) label.textContent = '[F] Open Safe (needs key_safe)'; }
          if (fNow && !this._fWasDown) {
            this._fWasDown = true;
            // Check for key_safe in inventory
            const hasKey = this.inventorySystem?.slots?.some(s => s?.type === 'key_safe');
            if (hasKey) {
              safe.opened = true;
              // Remove key from inventory
              const idx = this.inventorySystem.slots.findIndex(s => s?.type === 'key_safe');
              if (idx !== -1) this.inventorySystem.removeItem(idx, 1);
              // Spawn loot
              const wi = this.worldItemSystem;
              if (wi) {
                wi.spawnItem('ammo_9mm',       safe.x, safe.y + 0.5, safe.z, 20);
                wi.spawnItem('ammo_556',        safe.x + 0.3, safe.y + 0.5, safe.z, 15);
                wi.spawnItem('weapon_pistol_found', safe.x - 0.3, safe.y + 0.5, safe.z, 1);
                wi.spawnItem('keycard_red',     safe.x, safe.y + 0.5, safe.z + 0.3, 1);
                wi.spawnItem('special_virus_sample', safe.x, safe.y + 0.8, safe.z, 1);
              }
              const notif = document.getElementById('loot-notification');
              if (notif) { notif.textContent = '🔓 Safe opened!'; notif.style.color = '#ffdd44'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
            } else {
              const notif = document.getElementById('loot-notification');
              if (notif) { notif.textContent = '🔒 Locked — need key_safe'; notif.style.color = '#ff6666'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
            }
          } else if (!fNow) { this._fWasDown = false; }
          return;
        }
      }
    }

    // 3. Stove cooking — near the kitchen stove (x≈9, z≈9.1)
    if (this.inFriendHouse) {
      const stoveX = 9, stoveZ = 9.1;
      const sdx = px - stoveX, sdz = pz - stoveZ;
      if (sdx*sdx + sdz*sdz < 4) {
        const rawItems = [
          { raw: 'food_mushroom', cooked: 'food_cooked_meat', name: 'Mushroom' },
          { raw: 'food_canned_beans', cooked: 'food_canned_soup', name: 'Beans→Soup' },
        ];
        const cookable = rawItems.find(c => this.inventorySystem?.slots?.some(s => s?.type === c.raw));
        if (cookable) {
          if (prompt) { prompt.style.display = 'flex'; if (label) label.textContent = `[F] Cook ${cookable.name} on stove`; }
          if (fNow && !this._fWasDown) {
            this._fWasDown = true;
            // Remove raw, add cooked
            const idx = this.inventorySystem.slots.findIndex(s => s?.type === cookable.raw);
            if (idx !== -1) {
              this.inventorySystem.removeItem(idx, 1);
              this.inventorySystem.addItem(cookable.cooked, 1);
              this.player?.gainXP?.(5, 'cook');
              const notif = document.getElementById('loot-notification');
              if (notif) { notif.textContent = `🍳 Cooked ${cookable.name}!`; notif.style.color='#ff9944'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
            }
          } else if (!fNow) { this._fWasDown = false; }
          return;
        }
      }
    }

    // 4. Campfire cooking
    for (const cf of (this._campfires ?? [])) {
      const cdx = px - cf.x, cdz = pz - cf.z;
      if (cdx*cdx + cdz*cdz < 6.25) { // 2.5m
        const hasMushroom = this.inventorySystem?.slots?.some(s => s?.type === 'food_mushroom');
        const hasMeat = this.inventorySystem?.slots?.some(s => s?.type === 'food_beef_jerky' || s?.type === 'food_spam');
        if (hasMushroom || hasMeat) {
          if (prompt) { prompt.style.display = 'flex'; if (label) label.textContent = '[F] Cook over campfire'; }
          if (fNow && !this._fWasDown) {
            this._fWasDown = true;
            const rawType = hasMushroom ? 'food_mushroom' : (hasMeat ? (this.inventorySystem.slots.find(s=>s?.type==='food_beef_jerky'||s?.type==='food_spam')?.type) : null);
            if (rawType) {
              const idx = this.inventorySystem.slots.findIndex(s => s?.type === rawType);
              if (idx !== -1) {
                this.inventorySystem.removeItem(idx, 1);
                this.inventorySystem.addItem('food_cooked_meat', 1);
                this.player?.gainXP?.(8, 'cook');
                const notif = document.getElementById('loot-notification');
                if (notif) { notif.textContent = '🔥 Cooked Meat ready!'; notif.style.color='#ff8833'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
              }
            }
          } else if (!fNow) { this._fWasDown = false; }
          return;
        }
      }
    }

    // 5. Radio interaction
    for (const radio of (this._radioObjects ?? [])) {
      const rdx = px - radio.x, rdz = pz - radio.z;
      if (rdx*rdx + rdz*rdz < 3) {
        if (prompt) { prompt.style.display = 'flex'; if (label) label.textContent = '[F] Listen to radio'; }
        if (fNow && !this._fWasDown) {
          this._fWasDown = true;
          radio._msgIdx = ((radio._msgIdx ?? -1) + 1) % 6;
          const msgs = [
            '"…emergency broadcast… all civilians must…" [STATIC]',
            '"Day 14. This is Dr. Chen from CDC. The pathogen replicates in 6 hours. Do NOT—" [STATIC]',
            '"If anyone can hear this, there\'s a supply depot north of the highway. Coordinates: 47-N, 12-W. We have food."',
            '"They\'re EVERYWHERE. We sealed the school but they broke through the gym wall. God help us."',
            '"The military has declared sector 7 a total loss. Evacuation route via Route 9 is compromised."',
            '"…I don\'t know if anyone is left out there. If you find this recording… keep going. Don\'t give up."',
          ];
          this.inventorySystem?._showReadable?.('Radio Broadcast', msgs[radio._msgIdx]);
        } else if (!fNow) { this._fWasDown = false; }
        return;
      }
    }

    // 6. Item pickup via F key when no door is nearby
    const nearItem = this.worldItemSystem?.getNearbyItem(px, py, pz, 2.0);
    if (nearItem) {
      const def = this.inventorySystem?.itemTypes?.[nearItem.type];
      const itemName = def?.name ?? nearItem.type;
      if (prompt) {
        prompt.style.display = 'flex';
        if (label) label.textContent = `[F] Pick Up ${itemName}`;
      }
      if (fNow && !this._fWasDown) {
        this._fWasDown = true;
        this.worldItemSystem.tryPickup(px, py, pz, 2.0);
      } else if (!fNow) { this._fWasDown = false; }
      return;
    }

    if (prompt) prompt.style.display = 'none';
    if (!fNow) this._fWasDown = false;
  }

  // Called once from start() — click anywhere in the world to pick up the item under the cursor
  _setupClickPickup() {
    const canvas   = document.getElementById('game-canvas');
    const raycaster = new THREE.Raycaster();
    const center    = new THREE.Vector2(0, 0); // always cast from screen centre (crosshair)

    canvas.addEventListener('click', () => {
      if (!this.isRunning || this.isPaused) return;
      if (!this.player?.body) return;
      // Only fire when pointer is locked (first-person mode)
      if (document.pointerLockElement !== canvas) return;

      const camera = this.scene.getCamera();
      raycaster.setFromCamera(center, camera);

      // Collect all meshes belonging to world items
      const itemMeshes = [];
      for (const item of (this.worldItemSystem?.items ?? [])) {
        item.mesh.traverse(o => { if (o.isMesh) itemMeshes.push(o); });
      }

      const hits = raycaster.intersectObjects(itemMeshes, false);
      if (!hits.length) return;

      // Find which item owns the closest hit mesh
      const hitObject = hits[0].object;
      const clickedItem = this.worldItemSystem.items.find(item => {
        let found = false;
        item.mesh.traverse(o => { if (o === hitObject) found = true; });
        return found;
      });
      if (!clickedItem) return;

      // Only pick up if within reach (3 units)
      const px = this.player.body.position.x;
      const pz = this.player.body.position.z;
      const dx = clickedItem.mesh.position.x - px;
      const dz = clickedItem.mesh.position.z - pz;
      if (dx * dx + dz * dz > 9) return; // 3^2

      this.worldItemSystem.tryPickup(px, this.player.body.position.y, pz, 3);
    });
  }

  _spawnHouseItems() {
    const wi = this.worldItemSystem;
    if (!wi) return;

    // y = actual world surface top + 0.02 gap (items rest on surfaces, no floating)
    const H   = 0.02;

    // FLOOR_Y = 0.5 (top of floor slab)
    // Each value = absolute world Y of that surface's top face
    const Y = {
      floor:        0.50  + H,   // floor surface
      coffeeTable:  0.91  + H,   // oval cylinder top: FLOOR_Y+0.38+0.0275 ≈ 0.91
      sideTable:    1.08  + H,   // round top cylinder: FLOOR_Y+0.56+0.02 = 1.08
      tvStand:      0.95  + H,   // TV stand box: FLOOR_Y+0.225+0.225 = 0.95
      counter:      1.44  + H,   // kitchen countertop: FLOOR_Y+0.92+0.02 = 1.44
      island:       1.45  + H,   // island top: FLOOR_Y+0.925+0.025 = 1.45
      kitchenTable: 1.25  + H,   // round pedestal table: FLOOR_Y+0.72+0.025 = 1.245
      bedside:      1.05  + H,   // bedside box: FLOOR_Y+0.275+0.275 = 1.05
      dresser:      1.60  + H,   // dresser body: FLOOR_Y+0.55+0.55 = 1.60
      desk:         1.25  + H,   // desk top: FLOOR_Y+0.72+0.025 = 1.245
      sinkCabinet:  1.42  + H,   // sink countertop: FLOOR_Y+0.885+0.0175 = 1.40
      toiletTank:   1.29  + H,   // tank lid: FLOOR_Y+0.775+0.0125 ≈ 1.29
    };

    function pick(pool) {
      let total = pool.reduce((s, i) => s + i.w, 0);
      let r = Math.random() * total;
      for (const item of pool) { r -= item.w; if (r <= 0) return item; }
      return pool[pool.length - 1];
    }

    // Spawn count items from pool scattered on a surface.
    // cx/cz = center, hw/hd = half-extents to scatter within
    const spawnOn = (pool, cx, surfY, cz, hw, hd, count) => {
      for (let i = 0; i < count; i++) {
        const entry = pick(pool);
        const x = cx + (Math.random() - 0.5) * hw * 2;
        const z = cz + (Math.random() - 0.5) * hd * 2;
        const qty = entry.qty
          ? entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1))
          : 1;
        wi.spawnItem(entry.type, x, surfY, z, qty);
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // LIVING ROOM  (x:-14→+6, z:0→+10)
    // ─────────────────────────────────────────────────────────────────────────

    // Coffee table  (x=-5, z=5.5 — now oval)
    spawnOn([
      { type:'food_chips',         w:4 }, { type:'food_crackers',       w:3 },
      { type:'food_chocolate_bar', w:3 }, { type:'drink_soda',          w:4 },
      { type:'drink_beer',         w:3 }, { type:'drink_wine',          w:2 },
      { type:'drink_energy_drink', w:3 }, { type:'food_apple',          w:2 },
      { type:'food_orange',        w:2 }, { type:'food_cookies',        w:2 },
      { type:'mat_candles',        w:1 },
    ], -5, Y.coffeeTable, 5.5, 0.45, 0.25, 4);

    // Side table next to armchair  (x=-8, z=7.2, 0.5×0.5)
    spawnOn([
      { type:'elec_phone',         w:3 }, { type:'drink_energy_drink',  w:3 },
      { type:'med_sleeping_pills', w:2 }, { type:'gear_compass',        w:1 },
      { type:'tool_flashlight',    w:2 },
    ], -8, Y.sideTable, 7.2, 0.18, 0.18, 2);

    // TV stand top  (x=-5, z=2, 1.5×0.45)
    spawnOn([
      { type:'elec_radio',         w:3 }, { type:'elec_phone',          w:2 },
      { type:'mat_duct_tape',      w:2 }, { type:'key_house',           w:1 },
    ], -5, Y.tvStand, 2, 0.55, 0.15, 2);

    // Bookshelf floor area  (x=-13, z=5) — items fallen/stacked at base
    spawnOn([
      { type:'special_journal_page',  w:3 }, { type:'special_survivor_note', w:3 },
      { type:'special_map_fragment',  w:2 }, { type:'gear_map',              w:2 },
    ], -13, Y.floor, 5, 0.3, 0.5, 2);

    // Sofa area floor — melee weapons left leaning/dropped
    spawnOn([
      { type:'weapon_baseball_bat', w:3 }, { type:'weapon_crowbar',     w:2 },
      { type:'weapon_fire_poker',   w:2 }, { type:'rope',               w:2 },
      { type:'mat_duct_tape',       w:2 }, { type:'bandage',            w:2 },
    ], -5, Y.floor, 7.5, 1.5, 0.6, 3);

    // Near front door  (x=0, z=9.2)
    spawnOn([
      { type:'gear_fire_starter',  w:3 }, { type:'tool_flashlight',    w:2 },
      { type:'ammo_9mm',           w:2, qty:[6,12] }, { type:'gear_whistle',w:1 },
      { type:'cloth_backpack',     w:1 }, { type:'gear_sleeping_bag',  w:1 },
      { type:'tool_lighter',       w:3 }, { type:'gear_headlamp',      w:1 },
      { type:'tool_matches',       w:2 }, { type:'special_family_photo',w:1 },
    ], 0, Y.floor, 9.2, 0.8, 0.3, 4);

    // ─────────────────────────────────────────────────────────────────────────
    // KITCHEN  (x:+6→+14, z:0→+10)
    // ─────────────────────────────────────────────────────────────────────────

    const COUNTER_FOOD = [
      { type:'food_canned_beans',   w:5 }, { type:'food_canned_soup',    w:5 },
      { type:'food_canned_tuna',    w:4 }, { type:'food_canned_corn',    w:4 },
      { type:'food_bread',          w:4 }, { type:'food_pasta',          w:3 },
      { type:'food_rice',           w:3 }, { type:'food_peanut_butter',  w:3 },
      { type:'food_jam',            w:3 }, { type:'food_spam',           w:3 },
      { type:'food_sardines',       w:3 }, { type:'food_cereal',         w:3 },
      { type:'drink_milk',          w:3 }, { type:'drink_juice',         w:3 },
      { type:'drink_coffee',        w:3 }, { type:'drink_purified_water',w:3 },
      { type:'food_oatmeal',        w:3 }, { type:'food_soup_bowl',      w:3 },
      { type:'food_canned_peaches', w:2 }, { type:'food_dried_fruit',    w:2 },
      { type:'mat_salt',            w:2 }, { type:'mat_sugar',           w:2 },
      { type:'mat_coffee_grounds',  w:2 }, { type:'drink_tea',           w:2 },
    ];

    // East counter strip  (z=9.1 face, spread x=7.5→13)
    spawnOn(COUNTER_FOOD, 8,    Y.counter, 9.1, 0.5,  0.2, 3);
    spawnOn(COUNTER_FOOD, 10.5, Y.counter, 9.1, 0.8,  0.2, 3);
    spawnOn([
      { type:'tool_wrench',        w:3 }, { type:'weapon_kitchen_knife',w:4 },
      { type:'mat_zip_ties',       w:2 }, { type:'mat_super_glue',      w:2 },
      { type:'bandage',            w:2 }, { type:'med_vitamins',        w:2 },
    ], 12.5, Y.counter, 9.1, 0.7, 0.2, 2);

    // Kitchen island  (x=10, z=5, 2.25×1.25)
    spawnOn(COUNTER_FOOD, 10, Y.island, 5, 0.8, 0.45, 3);

    // Kitchen table  (x=9.5, z=2.5, 1×0.7)
    spawnOn([
      { type:'food_bread',         w:4 }, { type:'food_peanut_butter',  w:3 },
      { type:'drink_milk',         w:3 }, { type:'drink_juice',         w:3 },
      { type:'food_cereal',        w:3 }, { type:'food_crackers',       w:2 },
    ], 9.5, Y.kitchenTable, 2.5, 0.35, 0.25, 3);

    // Floor near fridge  (x=7.5, z=3) — dropped/fallen items
    spawnOn([
      { type:'food_canned_beans',  w:4 }, { type:'food_canned_soup',    w:4 },
      { type:'drink_dirty_water',  w:3 }, { type:'food_instant_noodles',w:3 },
      { type:'food_frozen_pizza',  w:2 }, { type:'drink_whiskey',       w:2 },
      { type:'special_recipe_book',w:1 },
    ], 7.5, Y.floor, 3.5, 0.5, 0.6, 3);

    // ─────────────────────────────────────────────────────────────────────────
    // MASTER BEDROOM  (x:-14→-2, z:-10→0)
    // ─────────────────────────────────────────────────────────────────────────

    // Left bedside table  (x=-10.3, z=-5)
    spawnOn([
      { type:'med_sleeping_pills', w:3 }, { type:'med_morphine',        w:2 },
      { type:'drink_purified_water',w:3}, { type:'bandage',             w:2 },
      { type:'elec_phone',         w:2 }, { type:'special_diary',       w:1 },
      { type:'mat_candles',        w:2 },
    ], -10.3, Y.bedside, -5, 0.15, 0.15, 2);

    // Right bedside table  (x=-7.7, z=-5)
    spawnOn([
      { type:'med_antibiotics',    w:3 }, { type:'med_caffeine_pills',  w:3 },
      { type:'drink_energy_drink', w:2 }, { type:'tool_flashlight',     w:2 },
      { type:'gear_walkie_talkie', w:1 }, { type:'med_aspirin',         w:2 },
      { type:'med_ibuprofen',      w:2 },
    ], -7.7, Y.bedside, -5, 0.15, 0.15, 2);

    // Dresser top  (x=-9, z=-9.5, 1.2×0.55)
    spawnOn([
      { type:'ammo_9mm',           w:3, qty:[10,20] },
      { type:'ammo_556',           w:2, qty:[15,25] },
      { type:'keycard_red',        w:2 }, { type:'key_safe',            w:2 },
      { type:'armor_vest',         w:1 }, { type:'armor_helmet',        w:1 },
      { type:'cloth_jacket',       w:2 }, { type:'elec_usb_drive',      w:2 },
    ], -9, Y.dresser, -9.5, 0.45, 0.2, 3);

    // Master bedroom desk  (x=-4.5, z=-7.5, 1.4×0.65)
    spawnOn([
      { type:'weapon_pistol_found',w:2 }, { type:'weapon_rifle_found',  w:1 },
      { type:'ammo_9mm',           w:3, qty:[8,16] }, { type:'ammo_556', w:2, qty:[10,20] },
      { type:'elec_usb_drive',     w:3 }, { type:'special_journal_page',w:2 },
      { type:'gear_binoculars',    w:1 }, { type:'gear_night_vision',   w:1 },
      { type:'tool_multitool',     w:2 }, { type:'explosive_grenade',   w:1 },
      { type:'elec_tracker',       w:1 }, { type:'elec_emp_grenade',    w:1 },
      { type:'special_military_id',w:1 }, { type:'mat_circuit_board',   w:2 },
    ], -4.5, Y.desk, -7.5, 0.5, 0.25, 4);

    // Floor near wardrobe  (x=-13.3, z=-3)
    spawnOn([
      { type:'cloth_jacket',       w:3 }, { type:'cloth_boots',         w:2 },
      { type:'armor_vest',         w:1 }, { type:'weapon_machete',      w:1 },
      { type:'weapon_axe',         w:1 }, { type:'mat_duct_tape',       w:2 },
    ], -13, Y.floor, -3, 0.6, 0.8, 3);

    // ─────────────────────────────────────────────────────────────────────────
    // BEDROOM 2  (x:-2→+6, z:-10→0)
    // ─────────────────────────────────────────────────────────────────────────

    // Study desk  (x=1, z=-9.3, 1.4×0.65)
    spawnOn([
      { type:'elec_laptop',        w:2 }, { type:'elec_phone',          w:3 },
      { type:'elec_usb_drive',     w:3 }, { type:'elec_camera',         w:1 },
      { type:'drink_energy_drink', w:3 }, { type:'med_caffeine_pills',  w:3 },
      { type:'ammo_9mm',           w:2, qty:[5,12] }, { type:'gear_gps',w:1 },
      { type:'weapon_smg_found',   w:1 }, { type:'ammo_9mm',            w:2, qty:[15,30] },
      { type:'food_military_ration',w:1 },
    ], 1, Y.desk, -9.3, 0.5, 0.25, 5);

    // Bookshelf base  (x=-1.5, z=-5)
    spawnOn([
      { type:'special_journal_page', w:3 }, { type:'special_map_fragment',w:3 },
      { type:'gear_map',             w:2 }, { type:'gear_compass',        w:2 },
      { type:'special_survivor_note',w:2 },
    ], -1.5, Y.floor, -5, 0.35, 0.5, 2);

    // Dresser top  (x=5, z=-9, rotY=PI/2 so 0.55 wide in X, 1.2 in Z)
    spawnOn([
      { type:'cloth_gloves',       w:3 }, { type:'cloth_boots',         w:2 },
      { type:'ammo_crossbow_bolt', w:3, qty:[10,20] },
      { type:'ammo_arrow',         w:2, qty:[8,14] },
    ], 5, Y.dresser, -9, 0.2, 0.45, 2);

    // Floor near bed  (x=2, z=-6.5) — weapon leaning, scattered ammo
    spawnOn([
      { type:'weapon_crossbow',    w:2 }, { type:'weapon_baseball_bat', w:2 },
      { type:'weapon_pipe',        w:2 }, { type:'ammo_crossbow_bolt',  w:3, qty:[8,15] },
      { type:'tool_flashlight',    w:2 }, { type:'mat_duct_tape',       w:2 },
    ], 2, Y.floor, -5.5, 1.0, 0.6, 3);

    // ─────────────────────────────────────────────────────────────────────────
    // BATHROOM  (x:+6→+14, z:-10→0)
    // ─────────────────────────────────────────────────────────────────────────

    // Sink cabinet top  (x=7.5, z=-5, 0.7×0.55)
    spawnOn([
      { type:'bandage',            w:5 }, { type:'med_gauze',           w:4 },
      { type:'med_burn_cream',     w:3 }, { type:'med_eyedrops',        w:3 },
      { type:'mat_alcohol_isopropyl',w:3},{ type:'med_vitamins',        w:2 },
    ], 7.5, Y.sinkCabinet, -5, 0.25, 0.2, 3);

    // Medicine cabinet floor area  (x=7.5, z=-9.5) — spilled/dropped meds
    spawnOn([
      { type:'med_antibiotics',    w:4 }, { type:'med_morphine',        w:2 },
      { type:'med_tourniquet',     w:3 }, { type:'med_antivenom',       w:2 },
      { type:'medical_kit',        w:2 }, { type:'med_sleeping_pills',  w:2 },
      { type:'bandage',            w:3 }, { type:'med_epipen',          w:1 },
      { type:'med_suture_kit',     w:2 }, { type:'med_splint',          w:2 },
      { type:'med_defibrillator',  w:1 }, { type:'med_blood_bag',       w:1 },
    ], 7.5, Y.floor, -9.5, 0.5, 0.4, 3);

    // Bathtub ledge/floor  (x=9, z=-9.2)
    spawnOn([
      { type:'mat_bleach',         w:3 }, { type:'mat_alcohol_isopropyl',w:3},
      { type:'drink_purified_water',w:2}, { type:'med_burn_cream',      w:2 },
    ], 9.5, Y.floor, -9, 0.8, 0.5, 2);

    // Toilet tank top  (x=13, z=-8.78)
    spawnOn([
      { type:'med_caffeine_pills', w:3 }, { type:'bandage',             w:3 },
      { type:'mat_super_glue',     w:2 }, { type:'med_aspirin',         w:2 },
    ], 13, Y.toiletTank, -8.78, 0.12, 0.07, 1);

    // Master bedroom floor (near ottoman / foot of bed)
    spawnOn([
      { type:'cloth_boots',        w:3 }, { type:'cloth_gloves',        w:2 },
      { type:'gear_sleeping_bag',  w:1 }, { type:'special_family_photo',w:2 },
      { type:'gear_paracord',      w:2 }, { type:'tool_canteen',        w:1 },
    ], -9, Y.floor, -4.5, 1.0, 0.5, 2);

    // Living room near bookshelf (floor)
    spawnOn([
      { type:'drink_wine',         w:3 }, { type:'drink_whiskey',       w:2 },
      { type:'drink_rum',          w:1 }, { type:'food_cookies',        w:2 },
      { type:'special_house_plan', w:1 }, { type:'special_recipe_book', w:1 },
    ], -12.5, Y.floor, 3.5, 0.5, 0.8, 3);

    // Kitchen near island stools
    spawnOn([
      { type:'food_granola_bar',   w:3 }, { type:'food_oatmeal',        w:2 },
      { type:'drink_tea',          w:3 }, { type:'drink_hot_cocoa',     w:2 },
      { type:'mat_coffee_grounds', w:2 }, { type:'tool_knife_swiss',    w:1 },
      { type:'food_hardtack',      w:2 }, { type:'food_pemmican',       w:1 },
      { type:'drink_coconut_water',w:2 }, { type:'drink_rain_water',    w:2 },
    ], 10, Y.kitchenTable, 3.5, 0.5, 0.3, 3);

    // Study desk bedroom 2 — special rare loot
    spawnOn([
      { type:'special_cdc_keycard',  w:1 }, { type:'special_vaccine_dose', w:1 },
      { type:'mat_gunpowder',        w:2, qty:[2,4] },
      { type:'mat_saltpeter',        w:2, qty:[2,4] },
      { type:'mat_charcoal',         w:2, qty:[2,4] },
      { type:'mat_kevlar_shred',     w:2 }, { type:'mat_circuit_board',    w:2 },
      { type:'elec_radio_transceiver',w:1 }, { type:'tool_wire_cutter',    w:1 },
      { type:'tool_bolt_cutter',     w:1 },
    ], 1, Y.desk, -9.3, 0.5, 0.25, 2);

    // Kitchen counter — new food items
    spawnOn([
      { type:'food_roasted_meat',  w:2 }, { type:'food_jerky',          w:3 },
      { type:'food_hardtack',      w:3 }, { type:'food_pemmican',       w:2 },
    ], 13, Y.counter, 5, 0.5, 0.2, 2);
  }

  handleWeaponInput() {
    if (this.inventorySystem?.isOpen) return;

    if (this.inputManager.mouse.leftClick && this.inputManager.isPointerLocked()) {
      // Ray must start at the eye, not the body center — otherwise shots land
      // ~0.75m below the crosshair at close range
      const position = new THREE.Vector3();
      this.camera.getWorldPosition(position);
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);

      // Stealth kill check: crouching + behind zombie + melee weapon
      const weapon = this.weaponManager?.getCurrentWeapon?.();
      const isMelee = weapon?.type === 'melee' || weapon?.name?.toLowerCase().includes('knife') || weapon?.name?.toLowerCase().includes('bat') || weapon?.name?.toLowerCase().includes('sword');
      let stealthKillApplied = false;
      if (isMelee && this.player?.isCrouching) {
        const pPos = position;
        const pDir = new THREE.Vector3();
        this.camera.getWorldDirection(pDir);
        const zombies = this.zombieManager?.getZombies() ?? [];
        for (const z of zombies) {
          const dx = z.position.x - pPos.x, dz = z.position.z - pPos.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          if (dist < 2.2 && z.isAlive?.()) {
            const zombieFacing = new THREE.Vector3(Math.sin(z.mesh?.rotation.y ?? 0), 0, Math.cos(z.mesh?.rotation.y ?? 0));
            const isBehind = pDir.dot(zombieFacing) > 0.5;
            if (isBehind) {
              z.health = 0;
              stealthKillApplied = true;
              break;
            }
          }
        }
      }
      if (stealthKillApplied) this.player._pendingStealthKill = true;

      // Berserker perk: +25% damage below 30% HP
      const berserkerActive = this.player?._berserkerPerk && this.player.health < this.player.maxHealth * 0.3;
      if (berserkerActive && weapon) {
        weapon._berserkerOrig = weapon._berserkerOrig ?? weapon.damage;
        weapon.damage = weapon._berserkerOrig * 1.25;
      } else if (weapon?._berserkerOrig) {
        weapon.damage = weapon._berserkerOrig;
        delete weapon._berserkerOrig;
      }

      this.weaponManager.fireCurrentWeapon(position, direction);
      // Gunshots emit a loud noise event that wakes nearby zombies
      this._emitNoise(position.x, position.z, 40);

      // Melee combo system
      const isMeleeWeapon = weapon?.type === 'melee' || ['knife','bat','sword','axe','machete','crowbar','pipe','poker','cleaver','katana','hatchet'].some(k => weapon?.name?.toLowerCase().includes(k));
      if (isMeleeWeapon) {
        // Extend combo window
        clearTimeout(this._meleeComboReset);
        this._meleeComboTimer = Date.now();
        this._meleeCombo = (this._meleeCombo ?? 0) + 1;
        this._meleeComboReset = setTimeout(() => {
          this._meleeCombo = 0;
          const el = document.getElementById('melee-combo');
          if (el) { el.style.opacity = '0'; }
        }, 1500); // 1.5s window between hits to maintain combo
        // Combo damage multiplier
        const comboMult = Math.min(3.0, 1.0 + (this._meleeCombo - 1) * 0.25);
        // Apply multiplier to current weapon damage temporarily
        if (weapon && this._meleeCombo > 1) {
          // Base damage must exclude the berserker boost, or the boosted value gets
          // captured as "original" and sticks forever
          const origDmg = weapon._origDamage ?? weapon._berserkerOrig ?? weapon.damage;
          weapon._origDamage = origDmg;
          weapon.damage = origDmg * comboMult * (berserkerActive ? 1.25 : 1);
          setTimeout(() => {
            if (weapon._origDamage) { weapon.damage = weapon._origDamage; delete weapon._origDamage; }
          }, 100);
        }
        // Update combo HUD
        this._updateComboHUD(this._meleeCombo, comboMult);
      }
    }

    if (this.inputManager.isKeyPressed('r')) {
      this.weaponManager.reloadCurrentWeapon();
    }

    // T = throw rock (distraction, needs no item)
    if (this.inputManager.isKeyPressed('t') && !this._tWasDown) {
      this._tWasDown = true;
      this._throwRock();
    } else if (!this.inputManager.isKeyPressed('t')) { this._tWasDown = false; }

    // G = place campfire (needs fire_starter or lighter)
    if (this.inputManager.isKeyPressed('g') && !this._gWasDown) {
      this._gWasDown = true;
      const hasFire = this.inventorySystem?.slots?.some(
        s => s && (s.type === 'gear_fire_starter' || s.type === 'tool_lighter' || s.type === 'tool_matches')
      );
      if (hasFire) {
        const pos = this.player.getPosition();
        const terrainY = this.inFriendHouse
          ? 0.5
          : (this.terrainGenerator?.getHeightAt(pos.x, pos.z) ?? 0);
        this._placeCampfire(pos.x, terrainY, pos.z);
        // Consume one lighter/match
        const idx = this.inventorySystem.slots.findIndex(
          s => s && (s.type === 'tool_lighter' || s.type === 'tool_matches')
        );
        if (idx !== -1) this.inventorySystem.removeItem(idx, 1);
      } else {
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🔥 Need fire_starter, lighter, or matches'; notif.style.color = '#ff6666'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      }
    } else if (!this.inputManager.isKeyPressed('g')) { this._gWasDown = false; }

    // B = place barricade (needs wood)
    if (this.inputManager.isKeyPressed('b') && !this._bWasDown) {
      this._bWasDown = true;
      this._placeBarricade();
    } else if (!this.inputManager.isKeyPressed('b')) { this._bWasDown = false; }

    // N = sandbag wall (needs mat_cloth + mat_sand)
    if (this.inputManager.isKeyPressed('n') && !this._nWasDown) {
      this._nWasDown = true;
      this._placeSandbagWall();
    } else if (!this.inputManager.isKeyPressed('n')) { this._nWasDown = false; }

    // Y = place electro trap (needs wire + battery)
    if (this.inputManager.isKeyPressed('y') && !this._yWasDown) {
      this._yWasDown = true;
      this._placeElectroTrap();
    } else if (!this.inputManager.isKeyPressed('y')) { this._yWasDown = false; }

    if (this.inputManager.isKeyPressed('e') && !this._eWasDown) {
      this._eWasDown = true;
      this.weaponManager.switchToNextWeapon();
      if (this._adsActive) {
        this._adsActive = false;
        this.scene.getCamera().fov = 75;
        this.scene.getCamera().updateProjectionMatrix();
        const scopeEl = document.getElementById('scope-overlay');
        if (scopeEl) scopeEl.style.display = 'none';
      }
    } else if (!this.inputManager.isKeyPressed('e')) {
      this._eWasDown = false;
    }

    if (this.inputManager.isKeyPressed('q') && !this._qWasDown) {
      this._qWasDown = true;
      this.weaponManager.switchToPreviousWeapon();
      if (this._adsActive) {
        this._adsActive = false;
        this.scene.getCamera().fov = 75;
        this.scene.getCamera().updateProjectionMatrix();
        const scopeEl = document.getElementById('scope-overlay');
        if (scopeEl) scopeEl.style.display = 'none';
      }
    } else if (!this.inputManager.isKeyPressed('q')) {
      this._qWasDown = false;
    }

    // Scroll wheel weapon switching
    if (this.inputManager.mouse.scrollDelta !== 0) {
      if (this.inputManager.mouse.scrollDelta > 0) {
        this.weaponManager.switchToNextWeapon();
      } else {
        this.weaponManager.switchToPreviousWeapon();
      }
      this.inputManager.mouse.scrollDelta = 0;
      if (this._adsActive) {
        this._adsActive = false;
        this.scene.getCamera().fov = 75;
        this.scene.getCamera().updateProjectionMatrix();
        const scopeEl = document.getElementById('scope-overlay');
        if (scopeEl) scopeEl.style.display = 'none';
      }
    }

    // Number keys 1-9 to directly select weapon slot
    for (let i = 1; i <= 9; i++) {
      if (this.inputManager.isKeyPressed(String(i)) && !this[`_num${i}WasDown`]) {
        this[`_num${i}WasDown`] = true;
        this.weaponManager.switchWeapon(i - 1);
        if (this._adsActive) {
          this._adsActive = false;
          this.scene.getCamera().fov = 75;
          this.scene.getCamera().updateProjectionMatrix();
          const scopeEl = document.getElementById('scope-overlay');
          if (scopeEl) scopeEl.style.display = 'none';
        }
      } else if (!this.inputManager.isKeyPressed(String(i))) {
        this[`_num${i}WasDown`] = false;
      }
    }
  }

  _emitNoise(x, z, radius) {
    if (!this._noiseEvents) this._noiseEvents = [];
    this._noiseEvents.push({ x, z, radius, ttl: 0.3 });
    // Show noise indicator on HUD
    if (!this._noiseEl) {
      const el = document.createElement('div');
      el.id = 'noise-indicator';
      el.style.cssText = 'position:fixed;bottom:120px;right:18px;color:#ffcc44;font-size:11px;font-family:monospace;pointer-events:none;z-index:900;opacity:0;transition:opacity 0.3s;';
      document.body.appendChild(el);
      this._noiseEl = el;
    }
    this._noiseEl.textContent = `🔊 NOISE: ${Math.round(radius)}m`;
    this._noiseEl.style.opacity = '1';
    clearTimeout(this._noiseTimeout);
    this._noiseTimeout = setTimeout(() => { if (this._noiseEl) this._noiseEl.style.opacity = '0'; }, 800);
  }

  _triggerBossEvent() {
    const player = this.player;
    if (!player) return;
    const pos = player.getPosition();
    const notif = document.getElementById('loot-notification');
    if (notif) { notif.textContent = '⚠ Something massive is coming...'; notif.style.color='#ff8833'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
    setTimeout(() => {
      this.zombieManager?.spawn('juggernaut', pos.x + 25, pos.z + 10);
      this.zombieManager?.spawn('juggernaut', pos.x - 20, pos.z + 15);
      this.zombieManager?.spawnWave(8, pos.x + 30, pos.z, 20);
      const notif2 = document.getElementById('loot-notification');
      if (notif2) { notif2.textContent = '☠ BOSS WAVE! Two Juggernauts approach!'; notif2.style.color='#ff0000'; notif2.classList.remove('show'); void notif2.offsetWidth; notif2.classList.add('show'); }
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,0,0,0.25);pointer-events:none;z-index:9998;transition:opacity 1s;';
      document.body.appendChild(flash);
      setTimeout(() => { flash.style.opacity='0'; }, 500);
      setTimeout(() => flash.remove(), 1500);
    }, 3000);
  }

  _togglePerkTree() {
    const existing = document.getElementById('perk-tree-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'perk-tree-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:5001;overflow-y:auto;font-family:monospace;';

    const perks = [
      { lvl:2,  name:'Tough Skin',      desc:'+10 max health',             icon:'💪' },
      { lvl:3,  name:'Iron Stomach',    desc:'Dirty water less harmful',   icon:'🍺' },
      { lvl:4,  name:'Sprinter',        desc:'+1 sprint speed',            icon:'🏃' },
      { lvl:5,  name:'Combat Medic',    desc:'+15 max health',             icon:'🩺' },
      { lvl:6,  name:'Scavenger',       desc:'Rare items give 2× XP',      icon:'🔍' },
      { lvl:7,  name:'Quick Reload',    desc:'Reload 25% faster',          icon:'🔄' },
      { lvl:8,  name:'Armored',         desc:'+8% damage resistance',      icon:'🛡' },
      { lvl:9,  name:'Adrenaline Rush', desc:'Low HP triggers speed burst',icon:'⚡' },
      { lvl:10, name:'Berserker Mode',  desc:'+25% damage at low HP',      icon:'🔥' },
    ];

    const playerLevel = this.player?.level ?? 1;
    const xp = this.player?.xp ?? 0;
    const nextXP = playerLevel * 120;

    overlay.innerHTML = `
      <div style="max-width:600px;margin:40px auto;padding:20px;">
        <div style="color:#ffdd44;font-size:18px;margin-bottom:4px;letter-spacing:2px;">✨ PERK TREE</div>
        <div style="color:#aaaaaa;font-size:12px;margin-bottom:20px;">Level ${playerLevel} — ${xp}/${nextXP} XP to next level | Press P to close</div>
        <div style="display:grid;gap:10px;">
          ${perks.map(p => {
            const unlocked = playerLevel >= p.lvl;
            const current = p.lvl === playerLevel + 1;
            const bg = unlocked ? 'rgba(40,80,40,0.8)' : current ? 'rgba(60,60,20,0.8)' : 'rgba(20,20,20,0.6)';
            const border = unlocked ? '#44aa44' : current ? '#aaaa44' : '#333333';
            const textCol = unlocked ? '#ffffff' : current ? '#ffffaa' : '#666666';
            return `<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:12px 16px;display:flex;align-items:center;gap:14px;">
              <div style="font-size:24px;">${p.icon}</div>
              <div>
                <div style="color:${textCol};font-size:13px;font-weight:bold;">${unlocked ? '✓ ' : ''}${p.name} <span style="color:#666;font-size:10px;">LVL ${p.lvl}</span></div>
                <div style="color:#888;font-size:11px;margin-top:2px;">${p.desc}</div>
              </div>
              ${unlocked ? '<div style="margin-left:auto;color:#44aa44;font-size:18px;">★</div>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const keyClose = (e) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { overlay.remove(); document.removeEventListener('keydown', keyClose); }};
    document.addEventListener('keydown', keyClose);
  }

  _toggleStatsScreen() {
    const existing = document.getElementById('stats-screen');
    if (existing) { existing.remove(); return; }

    const elapsed = this.survivalStartTime ? Math.floor((Date.now() - this.survivalStartTime) / 1000) : 0;
    const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
    const player = this.player;
    const inv = this.inventorySystem;

    // Calculate stats
    const filledSlots = inv?.slots?.filter(Boolean).length ?? 0;
    const totalWeight = inv?._currentWeight ?? 0;
    const zombieStats = this.zombieManager?.getZombieStats() ?? {};
    const topType = Object.entries(zombieStats).sort((a,b)=>b[1]-a[1])[0];
    const achievements = this.achievementSystem?.getUnlocked() ?? [];

    const overlay = document.createElement('div');
    overlay.id = 'stats-screen';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.94);z-index:5002;overflow-y:auto;font-family:monospace;color:#cccccc;';
    overlay.innerHTML = `
      <div style="max-width:700px;margin:30px auto;padding:20px;">
        <div style="color:#44ffaa;font-size:20px;letter-spacing:3px;margin-bottom:4px;">📊 SURVIVAL STATS</div>
        <div style="color:#444;font-size:11px;margin-bottom:24px;">Press K or click outside to close</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div style="background:rgba(20,30,20,0.8);border:1px solid #224422;border-radius:6px;padding:14px;">
            <div style="color:#44ff88;font-size:12px;margin-bottom:10px;">⚔ COMBAT</div>
            <div style="margin:4px 0;">Zombies Killed: <span style="color:#fff">${this.zombieKills ?? 0}</span></div>
            <div style="margin:4px 0;">Headshots: <span style="color:#ffdd44">${this._headshotCount ?? 0}</span></div>
            <div style="margin:4px 0;">Stealth Kills: <span style="color:#88ffcc">${player?._stealthKillCount ?? 0}</span></div>
            <div style="margin:4px 0;">Most Killed: <span style="color:#ff8866">${topType ? topType[0]+' ('+topType[1]+')' : 'none'}</span></div>
            <div style="margin:4px 0;">Current Streak: <span style="color:#ff8800">${player?._killStreak ?? 0}</span></div>
          </div>
          <div style="background:rgba(20,20,30,0.8);border:1px solid #222244;border-radius:6px;padding:14px;">
            <div style="color:#8888ff;font-size:12px;margin-bottom:10px;">🎮 PLAYER</div>
            <div style="margin:4px 0;">Level: <span style="color:#ffdd44">${player?.level ?? 1}</span></div>
            <div style="margin:4px 0;">Total XP: <span style="color:#aaddff">${player?.xp ?? 0}</span></div>
            <div style="margin:4px 0;">Max Health: <span style="color:#ff6666">${player?.maxHealth ?? 100}</span></div>
            <div style="margin:4px 0;">Max Stamina: <span style="color:#66aaff">${player?.maxStamina ?? 100}</span></div>
            <div style="margin:4px 0;">Perks Unlocked: <span style="color:#ffaa44">${Math.max(0, (player?.level??1)-1)}/9</span></div>
          </div>
          <div style="background:rgba(30,20,20,0.8);border:1px solid #442222;border-radius:6px;padding:14px;">
            <div style="color:#ff8888;font-size:12px;margin-bottom:10px;">🎒 INVENTORY</div>
            <div style="margin:4px 0;">Items Held: <span style="color:#fff">${filledSlots}/${inv?.totalSlots??54}</span></div>
            <div style="margin:4px 0;">Total Weight: <span style="color:${totalWeight > 21 ? '#ff8844' : '#88ff88'}">${totalWeight.toFixed(1)} kg</span></div>
            <div style="margin:4px 0;">Backpack: <span style="color:#aaffaa">${player?._hasBackpack ? 'YES (+9 slots)' : 'No'}</span></div>
            <div style="margin:4px 0;">Items Crafted: <span style="color:#aaddff">${this._craftCount ?? 0}</span></div>
          </div>
          <div style="background:rgba(20,25,20,0.8);border:1px solid #223322;border-radius:6px;padding:14px;">
            <div style="color:#88ff88;font-size:12px;margin-bottom:10px;">⏱ SURVIVAL</div>
            <div style="margin:4px 0;">Time Alive: <span style="color:#fff">${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</span></div>
            <div style="margin:4px 0;">Distance: <span style="color:#aaddff">${Math.round(this.distanceTraveled ?? 0)}m</span></div>
            <div style="margin:4px 0;">Nights Survived: <span style="color:#8888ff">${this._nightsSurvived ?? 0}</span></div>
            <div style="margin:4px 0;">Campfires: <span style="color:#ff8833">${this._campfires?.length ?? 0}</span></div>
            <div style="margin:4px 0;">Temperature: <span style="color:#88ccff">${(player?.temperature??37).toFixed(1)}°C</span></div>
          </div>
        </div>

        <div style="background:rgba(15,15,25,0.8);border:1px solid #333355;border-radius:6px;padding:14px;margin-bottom:16px;">
          <div style="color:#aaaaff;font-size:12px;margin-bottom:10px;">🏆 ACHIEVEMENTS (${achievements.length}/15)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${achievements.map(a => `<span style="background:rgba(40,40,60,0.9);border:1px solid #446644;border-radius:4px;padding:3px 8px;font-size:11px;">${a.icon} ${a.name}</span>`).join('')}
            ${achievements.length === 0 ? '<span style="color:#444;">None yet — get out there!</span>' : ''}
          </div>
        </div>

        <div style="text-align:center;color:#333;font-size:11px;margin-top:12px;">[K] Close · [P] Perks · [TAB] Map · [F5] Save · [F9] Load</div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const kClose = (e) => { if (e.key.toLowerCase()==='k'||e.key==='Escape') { overlay.remove(); document.removeEventListener('keydown',kClose); }};
    document.addEventListener('keydown', kClose);

    // Track stealth kills
    if (player) player._stealthKillCount = player._stealthKillCount ?? 0;
  }

  _throwRock() {
    const cam = this.scene.getCamera();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const pos = this.player.getPosition().clone().addScaledVector(dir, 1.2);
    pos.y += 0.3;

    // 3D rock mesh
    const scene = this.scene.scene;
    const mat = new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.9 });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), mat);
    rock.position.copy(pos);
    scene.add(rock);

    // Projectile physics
    const vel = dir.clone().multiplyScalar(18);
    vel.y += 3;
    let t = 0;
    const tick = () => {
      t += 0.016;
      vel.y -= 20 * 0.016; // gravity
      rock.position.addScaledVector(vel, 0.016);
      rock.rotation.x += 0.15;
      rock.rotation.z += 0.1;
      // Emit noise where rock lands
      if (t > 0.8 || rock.position.y < 0.5) {
        scene.remove(rock);
        rock.geometry?.dispose();
        rock.material?.dispose();
        this._emitNoise(rock.position.x, rock.position.z, 18);
        // Small impact particle
        this.particleSystem?.createBlood?.(rock.position.clone(), 3);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();

    const notif = document.getElementById('loot-notification');
    if (notif) { notif.textContent = '🪨 Rock thrown! [T]'; notif.style.color='#aaaaaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
  }

  // ─── Campfire system ────────────────────────────────────────────────────────

  _placeCampfire(x, y, z) {
    if (!this._campfires) this._campfires = [];
    const scene = this.scene.scene;

    // Base ring of stones
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), stoneMat);
      stone.scale.set(1.2, 0.6, 1.0);
      stone.position.set(x + Math.cos(ang) * 0.32, y + 0.06, z + Math.sin(ang) * 0.32);
      scene.add(stone);
    }
    // Log cross
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.95 });
    for (const rot of [0, Math.PI / 2]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.65, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rot;
      log.position.set(x, y + 0.06, z);
      scene.add(log);
    }
    // Ember glow disc
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: new THREE.Color(0xff3300),
      emissiveIntensity: 1.2,
      roughness: 0.8
    });
    const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), emberMat);
    embers.position.set(x, y + 0.04, z);
    scene.add(embers);

    // Flame cones (multiple sizes)
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 1.5,
      transparent: true, opacity: 0.85
    });
    const flames = [];
    for (let f = 0; f < 5; f++) {
      const h = 0.18 + Math.random() * 0.22;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.06 + Math.random() * 0.05, h, 6), flameMat.clone());
      fl.position.set(
        x + (Math.random() - 0.5) * 0.15,
        y + 0.04 + h / 2,
        z + (Math.random() - 0.5) * 0.15
      );
      fl._baseY = fl.position.y;
      fl._phase = Math.random() * Math.PI * 2;
      scene.add(fl);
      flames.push(fl);
    }

    // Point light — warm flickering fire
    const fireLight = new THREE.PointLight(0xff8833, 2.0, 12);
    fireLight.position.set(x, y + 0.4, z);
    scene.add(fireLight);
    fireLight._baseIntensity = 2.0;

    const campfire = { x, y, z, flames, fireLight, embers };
    this._campfires.push(campfire);
    // Mark player as near fire (for temperature)
    if (this.player) this.player._nearFire = true;

    const notif = document.getElementById('loot-notification');
    if (notif) {
      notif.textContent = '🔥 Campfire placed! Nearby zombies avoid fire.';
      notif.style.color = '#ff8833';
      notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
    }
  }

  _updateCampfires(dt) {
    if (!this._campfires?.length) return;
    const t = Date.now() / 1000;
    for (const cf of this._campfires) {
      // Animate flames
      for (const fl of cf.flames) {
        fl.position.y = fl._baseY + Math.sin(t * 4 + fl._phase) * 0.04;
        fl.scale.x = 0.85 + Math.sin(t * 3.5 + fl._phase) * 0.15;
        fl.scale.z = fl.scale.x;
        fl.material.opacity = 0.7 + Math.sin(t * 5 + fl._phase) * 0.15;
      }
      // Flicker light
      cf.fireLight.intensity = cf.fireLight._baseIntensity * (0.85 + Math.sin(t * 7) * 0.15);
      // Repel zombies
      if (this.zombieManager) {
        for (const z of this.zombieManager.getZombies()) {
          const dx = z.position.x - cf.x;
          const dz = z.position.z - cf.z;
          if (dx * dx + dz * dz < 9) z.state = 'idle';  // 3m radius repels
        }
      }
    }
    // Update player near-fire status
    if (this.player) {
      const px = this.player.position.x, pz = this.player.position.z;
      this.player._nearFire = this._campfires.some(cf => {
        const dx = px - cf.x, dz = pz - cf.z;
        return dx * dx + dz * dz < 25;  // 5m warmth radius
      });
    }
  }

  // ─── Barricade system ────────────────────────────────────────────────────────

  _placeBarricade() {
    if (!this.player) return;
    const hasWood = this.inventorySystem?.slots?.some(s => s?.type === 'wood');
    const hasTape = this.inventorySystem?.slots?.some(s => s?.type === 'mat_duct_tape');
    if (!hasWood) {
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '🪵 Need wood to barricade'; notif.style.color = '#ff6666'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      return;
    }
    // Remove 1 wood
    const wi = this.inventorySystem.slots.findIndex(s => s?.type === 'wood');
    if (wi !== -1) this.inventorySystem.removeItem(wi, 1);

    const cam = this.scene.getCamera();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = 0; dir.normalize();

    const pos = this.player.getPosition().clone().addScaledVector(dir, 1.4);
    pos.y = this.player.getPosition().y - 0.2;

    const scene = this.scene.scene;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9, metalness: 0.0 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.08), mat);
    board.rotation.y = Math.atan2(dir.x, dir.z);
    board.position.copy(pos);
    board.castShadow = true;
    scene.add(board);
    // Nail details
    const nailMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.8 });
    for (const [nx, ny] of [[-0.35, 0.55],[-0.35,-0.55],[0.35,0.55],[0.35,-0.55]]) {
      const nail = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), nailMat);
      nail.position.copy(pos).add(new THREE.Vector3(
        Math.cos(board.rotation.y)*nx, ny, Math.sin(board.rotation.y)*nx
      ));
      scene.add(nail);
    }
    const bPhys = new CANNON.Body({ mass: 0 });
    bPhys.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.8, 0.04)));
    bPhys.position.set(pos.x, pos.y, pos.z);
    bPhys.quaternion.setFromEuler(0, board.rotation.y, 0);
    this.physicsWorld.addBody(bPhys);

    const notif = document.getElementById('loot-notification');
    if (notif) { notif.textContent = '🪵 Barricade placed!'; notif.style.color = '#ccaa66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
  }

  _placeSandbagWall() {
    const hasCloth = this.inventorySystem?.slots?.some(s => s?.type === 'mat_cloth');
    const hasSand  = this.inventorySystem?.slots?.some(s => s?.type === 'mat_sand');
    if (!hasCloth || !hasSand) {
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '🪣 Need mat_cloth + mat_sand for sandbags'; notif.style.color='#ff6666'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      return;
    }
    ['mat_cloth','mat_sand'].forEach(type => {
      const i = this.inventorySystem.slots.findIndex(s => s?.type === type);
      if (i !== -1) this.inventorySystem.removeItem(i, 1);
    });

    const cam = this.scene.getCamera();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir); dir.y = 0; dir.normalize();
    const pos = this.player.getPosition().clone().addScaledVector(dir, 1.2);
    pos.y = this.player.getPosition().y - 0.5;

    const scene = this.scene.scene;
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc8a85a, roughness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0xaa8840, roughness: 0.98 });

    // Stack of 3 sandbag rows
    for (let row = 0; row < 3; row++) {
      const bagsPerRow = 3;
      for (let b = 0; b < bagsPerRow; b++) {
        const offset = (b - (bagsPerRow-1)/2) * 0.38;
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 4, 8), row%2===0 ? sandMat : darkMat);
        bag.rotation.z = Math.PI / 2;
        bag.rotation.y = Math.atan2(dir.x, dir.z);
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        bag.position.copy(pos)
          .addScaledVector(perp, offset)
          .add(new THREE.Vector3(0, row * 0.3 + 0.16, 0));
        bag.castShadow = true;
        scene.add(bag);
      }
    }

    // Physics body
    const sbPhys = new CANNON.Body({ mass: 0 });
    sbPhys.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.45, 0.2)));
    sbPhys.position.set(pos.x, pos.y + 0.45, pos.z);
    sbPhys.quaternion.setFromEuler(0, Math.atan2(dir.x, dir.z), 0);
    this.physicsWorld.addBody(sbPhys);

    const notif = document.getElementById('loot-notification');
    if (notif) { notif.textContent = '🪣 Sandbag wall built! [N]'; notif.style.color='#ccaa66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
  }

  _placeElectroTrap() {
    const hasWire = this.inventorySystem?.slots?.some(s => s?.type === 'mat_wire');
    const hasBatt = this.inventorySystem?.slots?.some(s => s?.type === 'mat_battery');
    if (!hasWire || !hasBatt) {
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '⚡ Need mat_wire + mat_battery'; notif.style.color='#ff6666'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      return;
    }
    // Consume materials
    [['mat_wire',1],['mat_battery',1]].forEach(([type]) => {
      const i = this.inventorySystem.slots.findIndex(s => s?.type === type);
      if (i !== -1) this.inventorySystem.removeItem(i, 1);
    });

    const scene = this.scene.scene;
    const pos = this.player.getPosition().clone();
    pos.y += 0.05;

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.5, metalness: 0.7 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), baseMat);
    base.position.copy(pos);
    scene.add(base);

    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaff, roughness: 0.2, metalness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const ang = (i/4)*Math.PI*2;
      const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6), spikeMat);
      spike.position.set(pos.x + Math.cos(ang)*0.2, pos.y + 0.13, pos.z + Math.sin(ang)*0.2);
      scene.add(spike);
    }

    const ledMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: new THREE.Color(0x0000ff), emissiveIntensity: 1.0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), ledMat);
    led.position.set(pos.x, pos.y + 0.08, pos.z);
    scene.add(led);

    const trapLight = new THREE.PointLight(0x4444ff, 0.8, 3);
    trapLight.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
    scene.add(trapLight);

    if (!this._electroTraps) this._electroTraps = [];
    this._electroTraps.push({ pos: pos.clone(), led, trapLight, active: true, cooldown: 0 });

    const notif = document.getElementById('loot-notification');
    if (notif) { notif.textContent = '⚡ Electro trap armed! [Y]'; notif.style.color='#4488ff'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
  }

  _updateElectroTraps(dt) {
    if (!this._electroTraps?.length) return;
    for (const trap of this._electroTraps) {
      if (!trap.active) continue;
      if (trap.cooldown > 0) { trap.cooldown -= dt; continue; }
      const zombies = this.zombieManager?.getZombies() ?? [];
      for (const z of zombies) {
        const dx = z.position.x - trap.pos.x, dz = z.position.z - trap.pos.z;
        if (dx*dx + dz*dz < 2.25) { // 1.5m radius
          z.takeDamage(45, false);
          z.state = 'idle';
          if (trap.trapLight) { trap.trapLight.intensity = 4; setTimeout(() => { if(trap.trapLight) trap.trapLight.intensity = 0.8; }, 150); }
          if (trap.led) { trap.led.material.color.set(0xffffff); setTimeout(() => { if(trap.led) trap.led.material.color.set(0x0000ff); }, 150); }
          trap.cooldown = 2.0;
          this._emitNoise(trap.pos.x, trap.pos.z, 8);
          break;
        }
      }
    }
  }

  _updatePlacedTraps(dt) {
    if (!this._traps?.length) return;
    const zombies = this.zombieManager?.getZombies() ?? [];
    for (const trap of this._traps) {
      if (!trap.armed || trap.triggered) continue;
      for (const z of zombies) {
        const dx = z.position.x - trap.pos.x, dz = z.position.z - trap.pos.z;
        if (dx*dx + dz*dz < 1.0) { // 1m trigger radius
          trap.triggered = true;
          if (trap.type === 'bear') {
            z.takeDamage(60, false);
            z.stunned   = true;
            z.stunTimer = 5;
            this.particleSystem?.createBlood?.(z.position, 8);
            this._emitNoise(trap.pos.x, trap.pos.z, 10);
          } else if (trap.type === 'landmine') {
            // AoE explosion — damage all zombies within 5m
            const allZombies = this.zombieManager?.getZombies() ?? [];
            for (const target of allZombies) {
              const ex = target.position.x - trap.pos.x;
              const ez = target.position.z - trap.pos.z;
              const dist2 = ex*ex + ez*ez;
              if (dist2 < 25) { // 5m radius
                const dmg = 120 * (1 - Math.sqrt(dist2) / 5);
                target.takeDamage(Math.round(dmg), false);
              }
            }
            this.particleSystem?.createExplosion?.(trap.pos.clone());
            this._emitNoise(trap.pos.x, trap.pos.z, 40);
          } else if (trap.type === 'claymore') {
            // Directional cone — kills zombies in 8m cone in front of where player was facing
            const allZombies = this.zombieManager?.getZombies() ?? [];
            for (const target of allZombies) {
              const ex = target.position.x - trap.pos.x;
              const ez = target.position.z - trap.pos.z;
              const dist2 = ex*ex + ez*ez;
              if (dist2 < 64) { // 8m radius
                const dmg = 180 * (1 - Math.sqrt(dist2) / 8);
                target.takeDamage(Math.round(dmg), false);
              }
            }
            this.particleSystem?.createExplosion?.(trap.pos.clone());
            this._emitNoise(trap.pos.x, trap.pos.z, 50);
          } else { // snare
            z.stunned   = true;
            z.stunTimer = 8;
            z.takeDamage(15, false);
            this._emitNoise(trap.pos.x, trap.pos.z, 10);
          }
          break;
        }
      }
    }
    // Cleanup triggered traps
    this._traps = this._traps.filter(t => !t.triggered);
  }

  _updateAirdropTimer(dt) {
    if (this.inFriendHouse) return;
    this._airdropTimer = (this._airdropTimer ?? 300) - dt;
    if (this._airdropTimer > 0) return;
    this._airdropTimer = 300; // reset 5-min timer
    this._triggerAirdrop();
  }

  _triggerAirdrop() {
    const player = this.player;
    if (!player) return;
    const pos = player.getPosition();

    // Random landing spot 20-40m from player
    const ang = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 20;
    const dropX = pos.x + Math.cos(ang) * dist;
    const dropZ = pos.z + Math.sin(ang) * dist;
    const terrainY = this.terrainGenerator?.getHeightAt(dropX, dropZ) ?? 0;

    // Notification — use dedicated airdrop toast
    const notif = document.getElementById('loot-notification');
    this._showAirdropToast('✈ Supply drop incoming!  Listen for the crash…');

    // Animate crate falling from sky
    const scene = this.scene.scene;
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x226622, roughness: 0.7 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateMat);
    crate.position.set(dropX, terrainY + 60, dropZ);
    crate.castShadow = true;
    scene.add(crate);

    // Parachute visual
    const chuteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const chute = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 8, 1, true), chuteMat);
    chute.position.y = 1.8;
    crate.add(chute);

    // Ropes from crate to chute
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xcccc88, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const ang2 = (i/4)*Math.PI*2;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 4), ropeMat);
      rope.rotation.z = 0.3;
      rope.rotation.y = ang2;
      rope.position.set(Math.cos(ang2)*0.2, 0.9, Math.sin(ang2)*0.2);
      crate.add(rope);
    }

    // Animate falling
    let fallY = terrainY + 60;
    const fallTick = () => {
      fallY -= 0.8;
      crate.position.y = fallY;
      crate.rotation.y += 0.02;
      if (fallY > terrainY + 0.45) {
        requestAnimationFrame(fallTick);
      } else {
        crate.position.y = terrainY + 0.45;
        crate.remove(chute);
        // Impact smoke
        this.particleSystem?.createExplosion?.(new THREE.Vector3(dropX, terrainY, dropZ));
        // Spawn high-tier loot
        const wi = this.worldItemSystem;
        if (wi) {
          const airdrops = [
            ['weapon_rifle_found', 1], ['ammo_556', 30], ['ammo_9mm', 24],
            ['medical_kit', 2], ['armor_vest', 1], ['food_military_ration', 3],
            ['explosive_grenade', 2], ['gear_night_vision', 1],
          ];
          airdrops.forEach(([type, qty], i) => {
            const ang3 = (i/airdrops.length)*Math.PI*2;
            wi.spawnItem(type, dropX+Math.cos(ang3)*0.6, terrainY+0.02, dropZ+Math.sin(ang3)*0.6, qty);
          });
        }
        // Remove crate from scene after loot appears
        scene.remove(crate);
        crate.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose()); else c.material.dispose(); } } });
        // Alert notification
        const compass = ang < Math.PI/4 ? 'N' : ang < 3*Math.PI/4 ? 'E' : ang < 5*Math.PI/4 ? 'S' : ang < 7*Math.PI/4 ? 'W' : 'N';
        this._showAirdropToast(`📦 Supply drop landed!  ${Math.round(dist)}m ${compass}`);
        this._emitNoise(dropX, dropZ, 50); // big noise from impact
      }
    };
    requestAnimationFrame(fallTick);
  }

  _showAirdropToast(msg) {
    const existing = document.getElementById('airdrop-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'airdrop-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4100);
  }

  updateCoordinates() {
    const coordsDisplay = document.getElementById('coords-display');
    if (!coordsDisplay || coordsDisplay.style.display === 'none' || !this.player) return;
    document.getElementById('coord-x').textContent = this.player.getPosition().x.toFixed(1);
    document.getElementById('coord-y').textContent = this.player.getPosition().y.toFixed(1);
    document.getElementById('coord-z').textContent = this.player.getPosition().z.toFixed(1);
  }

  updateFPSDisplay() {
    const fpsDisplay = document.getElementById('fps-display');
    if (!fpsDisplay || fpsDisplay.style.display === 'none') return;
    const counter = document.getElementById('fps-counter');
    if (counter) counter.textContent = this.fps;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  stop() {
    this.isRunning = false;
  }

  spawnZombie(type) {
    if (this.zombieManager) {
      const x = this.player.getPosition().x + Math.random() * 20 - 10;
      const z = this.player.getPosition().z + Math.random() * 20 - 10;
      this.zombieManager.spawn(type, x, z);
    }
  }

  spawnVehicle(type) {
    if (this.vehicleManager) {
      const x = this.player.getPosition().x + 10;
      const z = this.player.getPosition().z + 10;
      this.vehicleManager.spawn(type, x, z);
    }
  }

  saveGame() {
    try {
      const player = this.player;
      const inv = this.inventorySystem;
      const data = {
        version: 1,
        ts: Date.now(),
        player: {
          health: player.health, stamina: player.stamina,
          hunger: player.hunger, thirst: player.thirst,
          level: player.level, xp: player.xp,
          maxHealth: player.maxHealth, maxStamina: player.maxStamina,
        },
        inventory: inv?.slots?.map(s => s ? { type: s.type, quantity: s.quantity } : null) ?? [],
        zombieKills: this.zombieKills ?? 0,
        achievements: this.achievementSystem?.getAll()?.map(a => ({ id:a.id, unlocked:a.unlocked })) ?? [],
        inFriendHouse: this.inFriendHouse,
      };
      localStorage.setItem('zombieSave', JSON.stringify(data));
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '💾 Game saved!'; notif.style.color='#44ffaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      return true;
    } catch(e) { console.warn('Save failed:', e); return false; }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem('zombieSave');
      if (!raw) { console.log('No save found'); return false; }
      const data = JSON.parse(raw);
      if (data.version !== 1) return false;
      const player = this.player;
      if (player && data.player) {
        Object.assign(player, data.player);
        player._updateXPBar?.();
      }
      if (this.inventorySystem && data.inventory) {
        data.inventory.forEach((s, i) => {
          if (!s) { this.inventorySystem.slots[i] = null; return; }
          const def = this.inventorySystem.itemTypes[s.type] ?? {};
          this.inventorySystem.slots[i] = {
            type:      s.type,
            quantity:  s.quantity,
            name:      def.name     ?? s.type,
            rarity:    def.rarity   ?? 'common',
            category:  def.category ?? '',
            effect:    def.effect   ?? '',
            stackable: def.stackable ?? false,
          };
        });
        for (let i = 0; i < this.inventorySystem.totalSlots; i++) this.inventorySystem._syncSlot(i);
        this.inventorySystem.updateQuickSlotDisplay?.();
      }
      this.zombieKills = data.zombieKills ?? 0;
      if (this.achievementSystem && data.achievements) {
        for (const saved of data.achievements) {
          const ach = this.achievementSystem._achievements.find(a => a.id === saved.id);
          if (ach) ach.unlocked = saved.unlocked;
        }
      }
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '📂 Game loaded!'; notif.style.color='#44ffaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      return true;
    } catch(e) { console.warn('Load failed:', e); return false; }
  }
}
