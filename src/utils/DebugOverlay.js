export class DebugOverlay {
  constructor(game) {
    this.game = game;
    this.overlay = document.createElement('div');
    this.overlay.id = 'debug-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid #0f0;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      color: #0f0;
      z-index: 500;
      pointer-events: none;
      line-height: 1.6;
    `;
    document.getElementById('game-container').appendChild(this.overlay);
  }

  update() {
    let text = 'Debug Stats:\n';
    text += 'FPS: ' + this.game.fps + '\n';
    text += 'Delta: ' + this.game.deltaTime.toFixed(3) + 's\n';

    if (this.game.player) {
      const pos = this.game.player.getPosition();
      text += 'Pos: ' + pos.x.toFixed(1) + ', ' + pos.y.toFixed(1) + ', ' + pos.z.toFixed(1) + '\n';
      text += 'Health: ' + this.game.player.health.toFixed(0) + '\n';
      text += 'Stamina: ' + this.game.player.stamina.toFixed(0) + '\n';
      text += 'Grounded: ' + (this.game.player.isGrounded ? 'Yes' : 'No') + '\n';
    }

    if (this.game.chunkManager) {
      text += 'Chunks: ' + this.game.chunkManager.getChunkCount() + '\n';
    }

    if (this.game.buildingGenerator) {
      text += 'Buildings: ' + this.game.buildingGenerator.getBuildings().length + '\n';
    }

    if (this.game.zombieManager) {
      text += 'Zombies: ' + this.game.zombieManager.getZombieCount() + '\n';
    }

    if (this.game.weaponManager) {
      const weapon = this.game.weaponManager.getCurrentWeapon();
      if (weapon) {
        const ammo = weapon.getAmmoStatus();
        text += 'Weapon: ' + weapon.getName() + ' (' + ammo.inMag + '/' + ammo.reserve + ')\n';
      }
    }

    if (this.game.dayNightCycle) {
      const time = this.game.dayNightCycle.getTime();
      text += 'Time: ' + Math.floor(time) + ':' + String(Math.floor((time % 1) * 60)).padStart(2, '0') + '\n';
    }

    if (this.game.npcManager) {
      text += 'NPCs: ' + this.game.npcManager.getNPCs().length + '\n';
      text += 'Recruited: ' + this.game.npcManager.getRecruited().length + '\n';
    }

    if (this.game.inventorySystem) {
      text += 'Inv: ' + (this.game.inventorySystem.totalSlots - this.game.inventorySystem.getEmptySlotCount()) + '/' + this.game.inventorySystem.totalSlots + '\n';
    }

    text += 'Weather: ' + (this.game.weatherSystem ? this.game.weatherSystem.getWeather() : 'N/A');

    this.overlay.textContent = text;
  }

  remove() {
    this.overlay.remove();
  }
}
