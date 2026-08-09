export class SettingsMenu {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.currentTab = 'graphics';
    this.menu = document.getElementById('settings-menu');
    this.content = document.getElementById('settings-content');
    this.rebindingKey = null;
    this.rebindingButton = null;
    this.setupEventListeners();
    this.populateTabs();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    document.getElementById('settings-close').addEventListener('click', () => {
      this.close();
    });

    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  populateTabs() {
    this.defaultKeybinds = {
      moveForward: 'w',
      moveBackward: 's',
      moveLeft: 'a',
      moveRight: 'd',
      jump: ' ',
      sprint: 'Shift',
      crouch: 'c',
      melee: 'f',
      punch: 'f',
      slap: 'g',
      kick: 'h',
      sneeze: 'x',
      reload: 'r',
      nextWeapon: 'e',
      prevWeapon: 'q',
      inventory: 'e',
      talk: 'n',
      vehicle: 'f',
      lights: 'l'
    };

    this.tabs = {
      graphics: [
        { label: 'Quality Preset', type: 'select', key: 'graphics.quality', options: ['low', 'medium', 'high', 'ultra'] },
        { label: 'FOV', type: 'slider', key: 'graphics.fov', min: 60, max: 120, step: 5 },
        { label: 'Render Distance', type: 'slider', key: 'graphics.renderDistance', min: 100, max: 2000, step: 100 },
        { label: 'Shadow Quality', type: 'select', key: 'graphics.shadowQuality', options: ['low', 'medium', 'high'] },
        { label: 'Anti-aliasing', type: 'checkbox', key: 'graphics.antialiasing' },
        { label: 'Show FPS', type: 'checkbox', key: 'graphics.showFPS' },
        { label: 'Show Coordinates', type: 'checkbox', key: 'graphics.showCoords' }
      ],
      controls: [
        { label: 'Mouse Sensitivity', type: 'slider', key: 'controls.mouseSensitivity', min: 0.1, max: 3, step: 0.1 },
        { label: 'Invert Y', type: 'checkbox', key: 'controls.invertY' }
      ],
      keybinds: [
        { label: 'Move Forward', type: 'keybind', key: 'moveForward' },
        { label: 'Move Backward', type: 'keybind', key: 'moveBackward' },
        { label: 'Move Left', type: 'keybind', key: 'moveLeft' },
        { label: 'Move Right', type: 'keybind', key: 'moveRight' },
        { label: 'Jump', type: 'keybind', key: 'jump' },
        { label: 'Sprint', type: 'keybind', key: 'sprint' },
        { label: 'Crouch', type: 'keybind', key: 'crouch' },
        { label: 'Punch', type: 'keybind', key: 'punch' },
        { label: 'Slap', type: 'keybind', key: 'slap' },
        { label: 'Kick', type: 'keybind', key: 'kick' },
        { label: 'Sneeze', type: 'keybind', key: 'sneeze' },
        { label: 'Reload', type: 'keybind', key: 'reload' },
        { label: 'Next Weapon', type: 'keybind', key: 'nextWeapon' },
        { label: 'Previous Weapon', type: 'keybind', key: 'prevWeapon' },
        { label: 'Inventory', type: 'keybind', key: 'inventory' },
        { label: 'Talk to NPC', type: 'keybind', key: 'talk' },
        { label: 'Enter Vehicle', type: 'keybind', key: 'vehicle' },
        { label: 'Vehicle Lights', type: 'keybind', key: 'lights' }
      ],
      audio: [
        { label: 'Master Volume', type: 'slider', key: 'audio.masterVolume', min: 0, max: 1, step: 0.1 },
        { label: 'SFX Volume', type: 'slider', key: 'audio.sfxVolume', min: 0, max: 1, step: 0.1 },
        { label: 'Music Volume', type: 'slider', key: 'audio.musicVolume', min: 0, max: 1, step: 0.1 }
      ],
      gameplay: [
        { label: 'HUD Opacity', type: 'slider', key: 'gameplay.hudOpacity', min: 0.2, max: 1, step: 0.1 },
        { label: 'Minimap Size', type: 'slider', key: 'gameplay.minimapSize', min: 100, max: 300, step: 25 },
        { label: 'Blood Effects', type: 'checkbox', key: 'gameplay.bloodEffects' },
        { label: 'Difficulty', type: 'select', key: 'gameplay.difficulty', options: ['easy', 'normal', 'hard', 'insane'] }
      ]
    };
  }

  switchTab(tabName) {
    if (!this.tabs[tabName]) return;
    this.currentTab = tabName;

    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.renderTabContent();
  }

  renderTabContent() {
    this.content.innerHTML = '';

    const tabSettings = this.tabs[this.currentTab] || [];

    tabSettings.forEach(setting => {
      const group = document.createElement('div');
      group.className = 'setting-group';

      const label = document.createElement('label');
      label.textContent = setting.label;

      group.appendChild(label);

      const value = this.game.settings.get(setting.key);

      if (setting.type === 'slider') {
        const input = document.createElement('input');
        input.type = 'range';
        input.min = setting.min;
        input.max = setting.max;
        input.step = setting.step;
        input.value = value || setting.min;

        input.addEventListener('change', (e) => {
          const numValue = parseFloat(e.target.value);
          this.game.settings.set(setting.key, numValue);
        });

        group.appendChild(input);
      } else if (setting.type === 'checkbox') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value || false;

        input.addEventListener('change', (e) => {
          this.game.settings.set(setting.key, e.target.checked);
        });

        label.insertBefore(input, label.firstChild);
      } else if (setting.type === 'select') {
        const select = document.createElement('select');

        setting.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
          select.appendChild(option);
        });
        // Set the current value AFTER options exist, or it silently no-ops and the
        // dropdown always shows the first option regardless of the saved setting.
        select.value = value || setting.options[0];

        select.addEventListener('change', (e) => {
          this.game.settings.set(setting.key, e.target.value);
        });

        group.appendChild(select);
      } else if (setting.type === 'keybind') {
        const currentKey = this.game.settings.get(`keybinds.${setting.key}`) || this.defaultKeybinds[setting.key];
        const btn = document.createElement('button');
        btn.className = 'keybind-btn';
        btn.textContent = currentKey.toUpperCase();
        btn.style.padding = '8px 15px';
        btn.style.background = '#00ff00';
        btn.style.border = 'none';
        btn.style.color = '#000';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.style.minWidth = '80px';

        btn.addEventListener('click', () => {
          this.startRebinding(btn, setting.key);
        });

        group.appendChild(btn);
      }

      this.content.appendChild(group);
    });
  }

  startRebinding(btn, actionKey) {
    this.rebindingKey = actionKey;
    this.rebindingButton = btn;
    btn.textContent = 'Press any key...';
    btn.style.background = '#ffff00';
    btn.style.color = '#000';

    const handleKeyDown = (e) => {
      e.preventDefault();
      if (e.key === 'Escape') {
        this.cancelRebinding();
        return;
      }

      const keyName = e.key === ' ' ? 'Space' : e.key.toUpperCase();
      this.game.settings.set(`keybinds.${actionKey}`, keyName.toLowerCase());
      btn.textContent = keyName;
      btn.style.background = '#00ff00';

      document.removeEventListener('keydown', handleKeyDown);
      this.rebindingKey = null;
      this.rebindingButton = null;
    };

    document.addEventListener('keydown', handleKeyDown);
  }

  cancelRebinding() {
    if (this.rebindingButton) {
      const currentKey = this.game.settings.get(`keybinds.${this.rebindingKey}`) || this.defaultKeybinds[this.rebindingKey];
      this.rebindingButton.textContent = currentKey.toUpperCase();
      this.rebindingButton.style.background = '#00ff00';
      this.rebindingKey = null;
      this.rebindingButton = null;
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.menu.style.display = 'flex';
    this.game.inputManager.exitPointerLock();
    this.game.pause();
    this.renderTabContent();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.menu.style.display = 'none';
    this.game.resume();
    if (this.game.player) {
      this.game.inputManager.requestPointerLock();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
