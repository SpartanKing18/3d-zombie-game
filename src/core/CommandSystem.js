export class CommandSystem {
  constructor(game) {
    this.game = game;
    this.console = document.getElementById('command-console');
    this.output = document.getElementById('console-output');
    this.input = document.getElementById('console-input');
    this.history = [];
    this.historyIndex = -1;
    this.isOpen = false;

    this.commands = {
      godmode: this.cmdGodMode.bind(this),
      noclip: this.cmdNoClip.bind(this),
      time: this.cmdTime.bind(this),
      weather: this.cmdWeather.bind(this),
      spawn: this.cmdSpawn.bind(this),
      kill: this.cmdKill.bind(this),
      tp: this.cmdTeleport.bind(this),
      give: this.cmdGive.bind(this),
      set: this.cmdSet.bind(this),
      coords: this.cmdCoords.bind(this),
      fps: this.cmdFPS.bind(this),
      help: this.cmdHelp.bind(this),
      clear: this.cmdClear.bind(this),
      quit: this.cmdQuit.bind(this),
      query: this.cmdQuery.bind(this)
    };

    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!this.isOpen) {
          this.open();
          e.preventDefault();
        } else {
          this.execute();
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        if (this.isOpen) {
          this.close();
          e.preventDefault();
        }
      } else if (e.key === 'ArrowUp' && this.isOpen) {
        this.historyUp();
        e.preventDefault();
      } else if (e.key === 'ArrowDown' && this.isOpen) {
        this.historyDown();
        e.preventDefault();
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.console.style.display = 'flex';
    this.input.focus();
    this.game.inputManager.exitPointerLock();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.console.style.display = 'none';
    this.input.value = '';
    this.historyIndex = -1;
    if (this.game.player) {
      this.game.inputManager.requestPointerLock();
    }
  }

  execute() {
    const input = this.input.value.trim();
    if (!input) return;

    this.addLine('You: ' + input, 'info');
    this.history.push(input);
    this.historyIndex = -1;
    this.input.value = '';

    // Check if we're in dialogue mode
    if (this.game.dialogueSystem && this.game.dialogueSystem.isDialogueActive) {
      const response = this.game.dialogueSystem.playerSpeak(input);
      const npcName = this.game.dialogueSystem.currentNPC?.name ?? 'NPC';
      this.addLine(npcName + ': ' + response, 'success');
    } else if (input.startsWith('/')) {
      this.parseCommand(input.substring(1));
    } else {
      this.addLine('Type / to use commands, or press Enter to open the command console', 'error');
    }
  }

  parseCommand(input) {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd in this.commands) {
      try {
        this.commands[cmd](args);
      } catch (e) {
        this.addLine('Error: ' + e.message, 'error');
      }
    } else {
      this.addLine('Unknown command: ' + cmd, 'error');
    }
  }

  addLine(text, type = 'info') {
    const line = document.createElement('div');
    line.className = 'console-line console-' + type;
    line.textContent = text;
    this.output.appendChild(line);
    this.output.scrollTop = this.output.scrollHeight;
  }

  historyUp() {
    if (this.history.length === 0) return;
    if (this.historyIndex < 0) {
      this.historyIndex = this.history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }
    this.input.value = this.history[this.historyIndex];
  }

  historyDown() {
    if (this.history.length === 0) return;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.input.value = this.history[this.historyIndex];
    } else {
      this.historyIndex = -1;
      this.input.value = '';
    }
  }

  cmdGodMode(args) {
    if (!this.game.player) throw new Error('Player not initialized');
    this.game.player.godMode = !this.game.player.godMode;
    this.addLine('Godmode: ' + (this.game.player.godMode ? 'ON' : 'OFF'), 'success');
  }

  cmdNoClip(args) {
    if (!this.game.player) throw new Error('Player not initialized');
    this.game.player.noclip = !this.game.player.noclip;
    this.addLine('Noclip: ' + (this.game.player.noclip ? 'ON' : 'OFF'), 'success');
  }

  cmdTime(args) {
    if (args.length < 2) throw new Error('Usage: /time set day|night|<0-23>');
    const subCmd = args[0].toLowerCase();
    const value = args[1].toLowerCase();

    if (subCmd === 'set') {
      if (value === 'day') {
        if (this.game.dayNightCycle) this.game.dayNightCycle.setTime(12);
        this.addLine('Time set to day (12:00)', 'success');
      } else if (value === 'night') {
        if (this.game.dayNightCycle) this.game.dayNightCycle.setTime(0);
        this.addLine('Time set to night (00:00)', 'success');
      } else {
        const hour = parseInt(value);
        if (isNaN(hour) || hour < 0 || hour > 23) throw new Error('Hour must be 0-23');
        if (this.game.dayNightCycle) this.game.dayNightCycle.setTime(hour);
        this.addLine('Time set to ' + hour + ':00', 'success');
      }
    } else {
      throw new Error('Usage: /time set day|night|<0-23>');
    }
  }

  cmdWeather(args) {
    if (args.length < 1) throw new Error('Usage: /weather clear|rain|fog|storm');
    const weather = args[0].toLowerCase();
    if (this.game.weatherSystem) {
      this.game.weatherSystem.setWeather(weather);
      this.addLine('Weather set to: ' + weather, 'success');
    } else {
      this.addLine('Weather system not initialized', 'error');
    }
  }

  cmdSpawn(args) {
    if (args.length < 2) throw new Error('Usage: /spawn zombie <type> or /spawn car <type>');
    const type = args[0].toLowerCase();
    const subType = args[1].toLowerCase();

    if (type === 'zombie') {
      const player = this.game.player;
      if (player) {
        const playerPos = player.getPosition();
        const x = playerPos.x + Math.random() * 20 - 10;
        const z = playerPos.z + Math.random() * 20 - 10;
        this.game.zombieManager.spawn(subType, x, z);
        this.addLine('Spawned ' + subType + ' zombie', 'success');
      }
    } else if (type === 'car') {
      this.game.spawnVehicle(subType);
      this.addLine('Spawned ' + subType + ' vehicle', 'success');
    } else {
      throw new Error('Unknown spawn type: ' + type);
    }
  }

  cmdKill(args) {
    if (args.length < 1) throw new Error('Usage: /kill zombies or /kill all');
    const target = args[0].toLowerCase();

    if (target === 'zombies') {
      if (this.game.zombieManager) {
        this.game.zombieManager.killAll();
      }
      this.addLine('All zombies killed', 'success');
    } else if (target === 'all') {
      if (this.game.zombieManager) {
        this.game.zombieManager.killAll();
      }
      this.addLine('All entities destroyed', 'success');
    } else {
      throw new Error('Unknown kill target: ' + target);
    }
  }

  cmdTeleport(args) {
    if (!this.game.player) throw new Error('Player not initialized');
    if (args.length < 3) throw new Error('Usage: /tp <x> <y> <z>');

    const x = parseFloat(args[0]);
    const y = parseFloat(args[1]);
    const z = parseFloat(args[2]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) throw new Error('Coordinates must be numbers');

    this.game.player.setPosition(x, y, z);
    this.addLine('Teleported to ' + x.toFixed(1) + ', ' + y.toFixed(1) + ', ' + z.toFixed(1), 'success');
  }

  cmdGive(args) {
    if (!this.game.player) throw new Error('Player not initialized');
    if (args.length < 1) throw new Error('Usage: /give weapon <name> | /give ammo [qty] | /give <item_type> [qty]');

    const sub = args[0].toLowerCase();

    if (sub === 'weapon') {
      const wname = (args[1] ?? 'pistol').toLowerCase();
      const wmap = {
        pistol:'weapon_pistol_found', rifle:'weapon_rifle_found',
        shotgun:'weapon_shotgun_found', smg:'weapon_smg_found',
        sniper:'weapon_sniper_found', bat:'weapon_baseball_bat',
        knife:'weapon_kitchen_knife', axe:'weapon_axe', machete:'weapon_machete',
      };
      const itemType = wmap[wname] ?? `weapon_${wname}_found`;
      const ok = this.game.inventorySystem?.addItem(itemType, 1);
      if (ok) {
        this.game.weaponManager?.grantWeaponFromPickup?.(itemType);
        this.addLine(`Given weapon: ${wname}`, 'success');
      } else {
        this.addLine(`Unknown weapon "${wname}". Try: pistol rifle shotgun smg sniper bat knife axe machete`, 'error');
      }

    } else if (sub === 'ammo') {
      const qty = parseInt(args[1]) || 60;
      const ammoTypes = ['ammo_9mm','ammo_556','ammo_308','ammo_12gauge_buck','ammo_45acp'];
      let added = 0;
      ammoTypes.forEach(t => {
        if (this.game.inventorySystem?.addItem(t, qty)) {
          this.game.weaponManager?.feedAmmoFromPickup?.(t, qty);
          added++;
        }
      });
      this.addLine(`Added ${qty}x each ammo type (${added} types)`, 'success');

    } else {
      // Direct item type
      const qty = parseInt(args[1]) || 1;
      const ok = this.game.inventorySystem?.addItem(sub, qty);
      if (ok) {
        if (sub.startsWith('ammo_')) this.game.weaponManager?.feedAmmoFromPickup?.(sub, qty);
        if (sub.startsWith('weapon_')) this.game.weaponManager?.grantWeaponFromPickup?.(sub);
        this.addLine(`Given ${qty}x ${sub}`, 'success');
      } else {
        this.addLine(`Unknown item type: "${sub}". Use /give weapon <name> or /give ammo [qty]`, 'error');
      }
    }
  }

  cmdSet(args) {
    if (args.length < 2) throw new Error('Usage: /set <property> <value>');
    const property = args[0].toLowerCase();
    const value = args[1];

    if (property === 'speed') {
      if (this.game.player) {
        this.game.player.moveSpeed = parseFloat(value);
        this.addLine('Speed set to ' + value, 'success');
      }
    } else if (property === 'health') {
      if (this.game.player) {
        this.game.player.health = parseInt(value);
        this.addLine('Health set to ' + value, 'success');
      }
    } else if (property === 'stamina') {
      if (this.game.player) {
        this.game.player.stamina = parseInt(value);
        this.addLine('Stamina set to ' + value, 'success');
      }
    } else {
      throw new Error('Unknown property: ' + property);
    }
  }

  cmdCoords(args) {
    const el = document.getElementById('coords-display');
    if (!el) { this.addLine('coords-display element not found', 'error'); return; }
    const isVisible = el.style.display !== 'none';
    el.style.display = isVisible ? 'none' : 'block';
    this.addLine('Coordinates: ' + (isVisible ? 'OFF' : 'ON'), 'success');
  }

  cmdFPS(args) {
    const el = document.getElementById('fps-display');
    if (!el) { this.addLine('fps-display element not found', 'error'); return; }
    const isVisible = el.style.display !== 'none';
    el.style.display = isVisible ? 'none' : 'block';
    this.addLine('FPS Counter: ' + (isVisible ? 'OFF' : 'ON'), 'success');
  }

  cmdHelp(args) {
    const commands = [
      '/godmode - Toggle invincibility',
      '/noclip - Toggle fly through walls',
      '/time set day|night|<0-23> - Set time of day',
      '/weather clear|rain|fog|storm - Set weather',
      '/spawn zombie <walker|runner|tank|spitter|screamer|crawler>',
      '/kill zombies - Kill all zombies',
      '/tp <x> <y> <z> - Teleport to coords',
      '/give weapon <pistol|rifle|shotgun|smg|sniper|bat|knife|axe>',
      '/give ammo [qty] - Add all ammo types',
      '/give <item_type> [qty] - Add any item by type ID',
      '/set speed|health|stamina|hunger|thirst <value>',
      '/coords - Toggle XYZ display',
      '/fps - Toggle FPS counter',
      '/query <question> - Help system',
      '/clear - Clear console',
      '',
      '=== KEYBOARD SHORTCUTS ===',
      'E - Inventory  |  J - Mission log',
      'M - Minimap    |  N - Talk to NPC',
      'G - Kick  |  X - Sneeze (stuns zombies)',
      'R - Reload  |  F - Interact/Pickup',
      'Tab - Next weapon  |  Scroll - Cycle weapons',
    ];

    this.addLine('=== COMMAND HELP ===', 'info');
    commands.forEach(cmd => this.addLine(cmd, 'info'));
  }

  cmdClear(args) {
    this.output.innerHTML = '';
  }

  cmdQuit(args) {
    window.location.reload();
  }

  cmdQuery(args) {
    const question = args.join(' ');

    const aiResponses = {
      door: 'Check if it requires a key or if zombies are blocking it. Try clicking on doors to interact.',
      key: 'Keys are found in buildings or dropped by defeated zombies. Check your inventory (E).',
      crafting: 'Open inventory (E) and scroll down to see recipes. You need ingredients - check the requirements.',
      zombie: 'Zombies spawn randomly around you. Use weapons (Left-click) or melee attacks (F/G/H). Avoid groups.',
      health: 'Eat food or use medical kits from your inventory to restore health. Healing items are found in buildings.',
      hunger: 'Eat food from your inventory to reduce hunger. Hunger drains over time and low hunger damages you.',
      ammo: 'Find ammo in buildings or craft it with ingredients. Check inventory for ammo items.',
      npc: 'Press N when near NPCs to talk. Different NPCs offer different benefits if recruited.',
      vehicle: 'Press F near vehicles to enter. Use WASD to drive, L for headlights.',
      inventory: 'Press E to open inventory. Use 1-9 to access quick slots. Right-click items to use them.',
      craft: 'Open inventory and find recipes at the bottom. Click Craft if you have ingredients.',
      recruit: 'Talk to NPCs (N) and select "I\'ll help" to recruit them to your team.',
      stamina: 'Sprint (Shift) drains stamina. It regenerates when you rest. Crouch (C) is slower but uses less.',
      water: 'Use water bottles from your inventory to restore thirst. Find water in buildings.',
      bottle: 'Water bottles restore thirst when used. Right-click to drink from your inventory.',
      weapon: 'Switch weapons with E/Q. Fire with Left-click. Reload with R. Different weapons have different uses.',
      minimap: 'Press M to toggle the minimap display in the bottom right corner.'
    };

    for (const [keyword, response] of Object.entries(aiResponses)) {
      if (question.toLowerCase().includes(keyword)) {
        this.addLine('AI Assistant: ' + response, 'success');
        return;
      }
    }

    const generalResponses = [
      'Explore the world, gather resources, and survive!',
      'Try talking to NPCs for help and guidance.',
      'Check your inventory (E) and craft items you need.',
      'Use /help to see all available commands.',
      'The world is your playground - make your own story!'
    ];

    const randomResponse = generalResponses[Math.floor(Math.random() * generalResponses.length)];
    this.addLine('AI Assistant: ' + randomResponse, 'success');
  }
}
