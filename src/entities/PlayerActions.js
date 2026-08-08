import * as THREE from 'three';

export class PlayerActions {
  constructor(game) {
    this.game = game;
    this.actions = {
      punch:  { damage: 15, range: 2,   cooldown: 0.5, animation: 'punch' },
      kick:   { damage: 20, range: 2.5, cooldown: 0.8, animation: 'kick'  },
      sneeze: { damage: 0,  range: 3,   cooldown: 2,   animation: 'sneeze', effect: 'stun' },
    };

    this.lastActionTime = {};
    Object.keys(this.actions).forEach(action => {
      this.lastActionTime[action] = -Infinity;
    });

    this.setupKeybinds();
  }

  setupKeybinds() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const blocked = this.game.commandSystem?.isOpen || this.game.inventorySystem?.isOpen || this.game.settingsMenu?.isOpen;
      if (blocked) return;

      // G is reserved for quick-use item; F is interact; V = kick melee, X = sneeze
      if (key === 'v') this.performAction('kick');
      if (key === 'x') this.performAction('sneeze');
    });
  }

  performAction(actionName) {
    const action = this.actions[actionName];
    if (!action) return;

    const now = performance.now() / 1000;
    if (now - (this.lastActionTime[actionName] ?? -Infinity) < action.cooldown) return;
    this.lastActionTime[actionName] = now;

    const player = this.game.player;
    const playerPos = player.getPosition();
    const direction = new THREE.Vector3();
    this.game.scene.getCamera().getWorldDirection(direction);

    if (actionName === 'sneeze') {
      this.handleSneeze(playerPos, direction, action);
    } else {
      this.handleMeleeAction(playerPos, direction, action);
    }
  }

  handleMeleeAction(position, direction, action) {
    const zombies = this.game.zombieManager?.getZombies() ?? [];
    zombies.forEach(target => {
      const dist = position.distanceTo(target.getPosition());
      if (dist < action.range) {
        const targetDir = new THREE.Vector3().subVectors(target.getPosition(), position).normalize();
        if (direction.dot(targetDir) > 0.7) {
          target.takeDamage(action.damage);
        }
      }
    });
  }

  handleSneeze(position, direction, action) {
    const zombies = this.game.zombieManager?.getZombies() ?? [];
    zombies.forEach(zombie => {
      if (position.distanceTo(zombie.getPosition()) < action.range) {
        zombie.stunned = true;
        zombie.stunTimer = 2;
      }
    });
  }

  getAction(name) { return this.actions[name]; }
  getAllActions()  { return this.actions; }
}
