import * as THREE from 'three';

const ZOMBIE_COLORS = {
  walker:        '#ff3333',
  runner:        '#ff6600',
  tank:          '#cc0000',
  spitter:       '#88ff00',
  screamer:      '#ff00ff',
  crawler:       '#ff9900',
  armored:       '#ff8800',
  bloater:       '#99dd00',
  stalker:       '#cc44ff',
  berserker:     '#ff2244',
  leaper:        '#ffcc00',
  phantom:       '#aaaaff',
  horde_master:  '#ff0066',
  necromancer:   '#8800ff',
  juggernaut:    '#ff0000',
  mutant_giant:  '#ff5511',
  zombie_hound:  '#ffaa44',
  child_zombie:  '#ffff44',
  regenerator:   '#00ff88',
  bomber:        '#ff6600',
  zombie_soldier:'#aaddff',
  splitter:      '#ccff44',
  mini_splitter: '#aaee22',
  toxic:         '#44ff00',
  acid_spitter:  '#aaff33',
  burning:       '#ff5500',
  frozen:        '#88ddff',
};

const RARITY_COLORS = {
  legendary: '#ff8800',
  epic:      '#aa44ff',
  rare:      '#3399ff',
  uncommon:  '#44cc44',
  common:    '#aaaaaa',
};

export class MinimapRenderer {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.scale = 0.15;
    this.padding = 20;
    // Reuse direction vector every frame — no per-frame allocation
    this._dir = new THREE.Vector3();
  }

  update() {
    const player = this.game.player;
    if (!player || !this.canvas || !this.ctx) return;

    const W = this.canvas.width, H = this.canvas.height;
    const centerX = W / 2, centerY = H / 2;

    // Clip to circle
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, centerX - 1, 0, Math.PI * 2);
    this.ctx.clip();

    this.ctx.fillStyle = '#050e07';
    this.ctx.fillRect(0, 0, W, H);

    const playerPos = player.getPosition();

    this.drawBuildings(playerPos, centerX, centerY);
    this.drawCampfires(playerPos, centerX, centerY);
    this.drawItems(playerPos, centerX, centerY);
    this.drawZombies(playerPos, centerX, centerY);
    this.drawNPCs(playerPos, centerX, centerY);
    this.drawPlayer(centerX, centerY, player);
    this.ctx.restore();

    // Outer border ring
    this.ctx.strokeStyle = '#00cc44';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, centerX - 1, 0, Math.PI * 2);
    this.ctx.stroke();

    // Item count label (top of minimap)
    const itemCount = this.game.worldItemSystem?.items?.length ?? 0;
    if (itemCount > 0) {
      this.ctx.fillStyle = 'rgba(255,238,0,0.8)';
      this.ctx.font = '9px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${itemCount} items`, centerX, 13);
      this.ctx.textAlign = 'left';
    }
  }

  drawZombies(playerPos, centerX, centerY) {
    const zombies  = this.game.zombieManager?.getZombies?.() ?? [];
    const tracker  = this.game._trackerActive;
    const t        = performance.now() / 1000;
    // Without tracker: only show zombies within 20m
    const maxDist2 = tracker ? Infinity : 20 * 20;

    zombies.forEach(zombie => {
      if (!zombie.isAlive?.()) return;
      const pos = zombie.getPosition?.() ?? zombie.position;
      if (!pos) return;

      const dx = pos.x - playerPos.x, dz = pos.z - playerPos.z;
      if (dx * dx + dz * dz > maxDist2) return;

      const screenX = centerX + dx * this.scale;
      const screenY = centerY + dz * this.scale;
      if (!this.isOnScreen(screenX, screenY)) return;

      const color = ZOMBIE_COLORS[zombie.type] ?? '#ff3333';
      const isBoss = zombie.type === 'tank' || zombie.type === 'horde_master' || zombie.type === 'necromancer'
                  || zombie.type === 'juggernaut' || zombie.type === 'mutant_giant';

      if (tracker) {
        // Tracker mode: pulsing radar blips
        const pulse = 0.6 + 0.4 * Math.sin(t * 4 + pos.x * 0.3);
        const r = isBoss ? 5 : 3.5;
        // Outer ring pulse
        this.ctx.globalAlpha = pulse * 0.35;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, r * 2.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        // Core dot
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        this.ctx.fill();
        // Boss ring
        if (isBoss) {
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      } else {
        // No tracker: small dim dots only for nearby zombies
        const r = isBoss ? 3.5 : 2;
        this.ctx.globalAlpha = 0.65;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }
    });
  }

  drawNPCs(playerPos, centerX, centerY) {
    const npcs = this.game.npcManager?.getNPCs?.() ?? [];
    this.ctx.fillStyle = '#00ffff';
    npcs.forEach(npc => {
      const pos = npc.getPosition();
      const relX = (pos.x - playerPos.x) * this.scale;
      const relZ = (pos.z - playerPos.z) * this.scale;
      const screenX = centerX + relX;
      const screenY = centerY + relZ;
      if (this.isOnScreen(screenX, screenY)) {
        this.ctx.fillRect(screenX - 3, screenY - 3, 6, 6);
      }
    });
  }

  drawBuildings(playerPos, centerX, centerY) {
    const buildings = this.game.buildingGenerator?.getBuildings?.() ?? [];
    this.ctx.fillStyle = 'rgba(100,100,120,0.7)';
    buildings.forEach(building => {
      const relX = (building.x - playerPos.x) * this.scale;
      const relZ = (building.z - playerPos.z) * this.scale;
      const screenX = centerX + relX;
      const screenY = centerY + relZ;
      const w = building.width * this.scale;
      const h = building.depth * this.scale;
      if (this.isOnScreen(screenX, screenY)) {
        this.ctx.fillRect(screenX - w / 2, screenY - h / 2, w, h);
      }
    });
  }

  drawCampfires(playerPos, centerX, centerY) {
    const campfires = this.game._campfires ?? [];
    campfires.forEach(cf => {
      const relX = (cf.x - playerPos.x) * this.scale;
      const relZ = (cf.z - playerPos.z) * this.scale;
      const screenX = centerX + relX;
      const screenY = centerY + relZ;
      if (this.isOnScreen(screenX, screenY)) {
        // Warm glow halo
        const grad = this.ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, 6);
        grad.addColorStop(0, 'rgba(255,150,30,0.7)');
        grad.addColorStop(1, 'rgba(255,80,0,0)');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        // Core dot
        this.ctx.fillStyle = '#ffbb44';
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  drawItems(playerPos, centerX, centerY) {
    const items = this.game.worldItemSystem?.items ?? [];
    const itemTypes = this.game.inventorySystem?.itemTypes ?? {};
    items.forEach(item => {
      const p = item.mesh?.position;
      if (!p) return;
      const relX = (p.x - playerPos.x) * this.scale;
      const relZ = (p.z - playerPos.z) * this.scale;
      const screenX = centerX + relX;
      const screenY = centerY + relZ;
      if (!this.isOnScreen(screenX, screenY)) return;

      const def = itemTypes[item.type] ?? {};
      const color = RARITY_COLORS[def.rarity] ?? RARITY_COLORS.common;
      // Legendary / epic get a subtle glow
      if (def.rarity === 'legendary' || def.rarity === 'epic') {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 4;
      }
      this.ctx.fillStyle = color;
      this.ctx.fillRect(screenX - 1.5, screenY - 1.5, 3, 3);
      this.ctx.shadowBlur = 0;
    });
  }

  drawPlayer(centerX, centerY, player) {
    const camera = this.game.scene.getCamera();
    camera.getWorldDirection(this._dir);
    const angle = Math.atan2(this._dir.z, this._dir.x);

    // Facing cone
    this.ctx.fillStyle = 'rgba(0,255,80,0.12)';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.arc(centerX, centerY, 22, angle - 0.5, angle + 0.5);
    this.ctx.closePath();
    this.ctx.fill();

    // Player arrow
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(angle - Math.PI / 2);
    const maxHp = player.maxHealth ?? 100;
    const hp = player.health ?? maxHp;
    const green = Math.round((hp / maxHp) * 255);
    const red   = Math.round(((maxHp - hp) / maxHp) * 200);
    this.ctx.fillStyle = `rgb(${red},${green},40)`;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -6);
    this.ctx.lineTo(-4, 5);
    this.ctx.lineTo(0, 2);
    this.ctx.lineTo(4, 5);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 0.7;
    this.ctx.stroke();
    this.ctx.restore();
  }

  isOnScreen(x, y) {
    return x > 2 && x < this.canvas.width - 2 && y > 2 && y < this.canvas.height - 2;
  }

  showFullMap() {
    if (this._fullMapEl) return;
    const overlay = document.createElement('div');
    overlay.id = 'fullmap-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:5000;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    overlay.innerHTML = `
      <div style="color:#44ffaa;font-size:14px;font-family:monospace;margin-bottom:12px;letter-spacing:2px;">📍 AREA MAP — [TAB] to close</div>
      <canvas id="fullmap-canvas" width="600" height="600" style="border:1px solid #224433;border-radius:4px;"></canvas>
      <div id="fullmap-legend" style="color:#888;font-size:11px;font-family:monospace;margin-top:10px;display:flex;gap:20px;">
        <span>🔵 You</span><span style="color:#ff4444">🔴 Zombie</span><span style="color:#ffdd44">🟡 Loot crate</span><span style="color:#ff8833">🟠 Campfire</span><span style="color:#ffffff">⬜ Building</span>
      </div>`;
    document.body.appendChild(overlay);
    this._fullMapEl = overlay;
    this._renderFullMap();
    // Keep it live while open — player/zombie/NPC dots used to freeze at their
    // positions from the instant TAB was pressed.
    clearInterval(this._fullMapInterval);
    this._fullMapInterval = setInterval(() => this._renderFullMap(), 250);
    // Click outside to close
    overlay.addEventListener('click', e => { if (e.target === overlay) this.hideFullMap(); });
  }

  hideFullMap() {
    clearInterval(this._fullMapInterval);
    this._fullMapInterval = null;
    if (this._fullMapEl) {
      this._fullMapEl.remove();
      this._fullMapEl = null;
    }
  }

  _renderFullMap() {
    const canvas = document.getElementById('fullmap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 600, H = 600;
    ctx.clearRect(0, 0, W, H);
    // Dark background
    ctx.fillStyle = '#0a1a0e';
    ctx.fillRect(0, 0, W, H);
    // Grid lines
    ctx.strokeStyle = '#1a2a1e';
    ctx.lineWidth = 1;
    for (let g = 0; g <= W; g += 60) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke();
    }
    const player = this.game.player;
    if (!player) return;
    const cx = player.getPosition().x, cz = player.getPosition().z;
    const scale = 1.2; // units per pixel (1 pixel = 1.2 world units at 600px → 360 world units visible)
    const toScreen = (wx, wz) => ({
      x: W/2 + (wx - cx) / scale,
      y: H/2 + (wz - cz) / scale
    });
    // Draw house outline (approximate)
    if (this.game.inFriendHouse) {
      ctx.strokeStyle = '#336644';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        W/2 + (-14-cx)/scale, H/2 + (-10-cz)/scale,
        28/scale, 20/scale
      );
    }
    // Buildings
    const buildings = this.game.buildingGenerator?.getBuildings?.() ?? [];
    for (const b of buildings) {
      const s = toScreen(b.x, b.z);
      if (s.x < -50 || s.x > W+50 || s.y < -50 || s.y > H+50) continue;
      const bw = (b.width ?? 14) / scale, bh = (b.depth ?? 10) / scale;
      ctx.fillStyle = 'rgba(80,95,85,0.75)';
      ctx.fillRect(s.x - bw/2, s.y - bh/2, bw, bh);
      ctx.strokeStyle = '#334433';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(s.x - bw/2, s.y - bh/2, bw, bh);
    }
    // Zombies
    const zombies = this.game.zombieManager?.getZombies() ?? [];
    for (const z of zombies) {
      if (!z.isAlive?.()) continue;
      const pos = z.getPosition?.() ?? z.position;
      const s = toScreen(pos.x, pos.z);
      if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
      ctx.fillStyle = ZOMBIE_COLORS[z.type] ?? '#ff3333';
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI*2); ctx.fill();
    }
    // Campfires
    for (const cf of (this.game._campfires ?? [])) {
      const s = toScreen(cf.x, cf.z);
      if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
      ctx.fillStyle = '#ff8833';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffcc44';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // World items — draw as diamonds colored by rarity
    const worldItems = this.game.worldItemSystem?.items ?? [];
    const itemTypes = this.game.inventorySystem?.itemTypes ?? {};
    for (const item of worldItems) {
      const p = item.mesh?.position;
      if (!p) continue;
      const s = toScreen(p.x, p.z);
      if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
      const def = itemTypes[item.type] ?? {};
      const color = RARITY_COLORS[def.rarity] ?? RARITY_COLORS.common;
      const sz = def.rarity === 'legendary' ? 5 : def.rarity === 'epic' ? 4 : 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(s.x,      s.y - sz);
      ctx.lineTo(s.x + sz, s.y);
      ctx.lineTo(s.x,      s.y + sz);
      ctx.lineTo(s.x - sz, s.y);
      ctx.closePath();
      ctx.fill();
    }
    // NPC survivors — cyan squares
    const npcs = this.game.npcManager?.getNPCs?.() ?? [];
    for (const npc of npcs) {
      const pos = npc.getPosition?.();
      if (!pos) continue;
      const s = toScreen(pos.x, pos.z);
      if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
      ctx.fillStyle = '#00ffee';
      ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
    }
    // Player (last, on top)
    const ps = toScreen(cx, cz);
    // Draw player arrow facing their direction
    const yaw = player.yaw ?? 0;
    ctx.save();
    ctx.translate(ps.x, ps.y);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(-5, 6); ctx.lineTo(0, 3); ctx.lineTo(5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Compass rose
    ctx.fillStyle = '#448866';
    ctx.font = '12px monospace';
    ctx.fillText('N', W/2 - 5, 18);
    ctx.fillText('S', W/2 - 5, H - 6);
    ctx.fillText('W', 6, H/2 + 5);
    ctx.fillText('E', W - 14, H/2 + 5);
    // Coordinates
    ctx.fillStyle = '#446655';
    ctx.font = '10px monospace';
    ctx.fillText(`X:${Math.round(cx)} Z:${Math.round(cz)}`, 8, H - 8);
  }
}
