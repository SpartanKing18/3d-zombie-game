import { Walker } from './zombies/Walker.js';
import { Runner } from './zombies/Runner.js';
import { Tank } from './zombies/Tank.js';
import { Spitter } from './zombies/Spitter.js';
import { Screamer } from './zombies/Screamer.js';
import { Crawler } from './zombies/Crawler.js';
import { Armored } from './zombies/Armored.js';
import { Bloater } from './zombies/Bloater.js';
import { Stalker } from './zombies/Stalker.js';
import { Regenerator } from './zombies/Regenerator.js';
import { Berserker } from './zombies/Berserker.js';
import { Leaper } from './zombies/Leaper.js';
import { ChildZombie } from './zombies/ChildZombie.js';
import { Juggernaut } from './zombies/Juggernaut.js';
import { Phantom } from './zombies/Phantom.js';
import { HordeMaster } from './zombies/HordeMaster.js';
import { Bomber } from './zombies/Bomber.js';
import { AcidSpitter } from './zombies/AcidSpitter.js';
import { ZombieHound } from './zombies/ZombieHound.js';
import { Necromancer } from './zombies/Necromancer.js';
import { ZombieSoldier } from './zombies/ZombieSoldier.js';
import { Splitter } from './zombies/Splitter.js';
import { MutantGiant } from './zombies/MutantGiant.js';

export class ZombieManager {
  constructor(game) {
    this.game = game;
    this.zombies = [];
    this.spawnTimer = 0;
    this.maxZombies = 50;
    this.spawnInterval = 3;
    this._groanTimer = 3 + Math.random() * 5;
  }

  spawn(type, x, z) {
    let zombie = null;

    switch (type.toLowerCase()) {
      case 'walker':
        zombie = new Walker(x, z, this.game);
        break;
      case 'runner':
        zombie = new Runner(x, z, this.game);
        break;
      case 'tank':
        zombie = new Tank(x, z, this.game);
        break;
      case 'spitter':
        zombie = new Spitter(x, z, this.game);
        break;
      case 'screamer':
        zombie = new Screamer(x, z, this.game);
        break;
      case 'crawler':
        zombie = new Crawler(x, z, this.game);
        break;
      case 'armored':
        zombie = new Armored(x, z, this.game);
        break;
      case 'bloater':
        zombie = new Bloater(x, z, this.game);
        break;
      case 'stalker':
        zombie = new Stalker(x, z, this.game);
        break;
      case 'regenerator':
        zombie = new Regenerator(x, z, this.game);
        break;
      case 'berserker':
        zombie = new Berserker(x, z, this.game);
        break;
      case 'leaper':
        zombie = new Leaper(x, z, this.game);
        break;
      case 'child_zombie':
        zombie = new ChildZombie(x, z, this.game);
        break;
      case 'juggernaut':
        zombie = new Juggernaut(x, z, this.game);
        break;
      case 'phantom':
        zombie = new Phantom(x, z, this.game);
        break;
      case 'horde_master':
        zombie = new HordeMaster(x, z, this.game);
        break;
      case 'bomber':
        zombie = new Bomber(x, z, this.game);
        break;
      case 'acid_spitter':
        zombie = new AcidSpitter(x, z, this.game);
        break;
      case 'zombie_hound':
        zombie = new ZombieHound(x, z, this.game);
        break;
      case 'necromancer':
        zombie = new Necromancer(x, z, this.game);
        break;
      case 'zombie_soldier':
        zombie = new ZombieSoldier(x, z, this.game);
        break;
      case 'splitter':
        zombie = new Splitter(x, z, this.game);
        break;
      case 'mutant_giant':
        zombie = new MutantGiant(x, z, this.game);
        break;
      default:
        zombie = new Walker(x, z, this.game);
    }

    if (zombie) {
      this.zombies.push(zombie);
      // New mesh must be shootable immediately — invalidate the weapon raycast cache
      this.game._raycastTargetTime = 0;
    }

    return zombie;
  }

  spawnRandom(x, z) {
    const types = ['walker', 'runner', 'tank', 'spitter', 'screamer', 'crawler', 'armored', 'bloater', 'stalker', 'regenerator', 'berserker', 'leaper', 'child_zombie'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    return this.spawn(randomType, x, z);
  }

  spawnWave(count, centerX, centerZ, radius) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = Math.random() * radius;
      const x = centerX + Math.cos(angle) * r;
      const z = centerZ + Math.sin(angle) * r;
      this.spawnRandom(x, z);
    }
  }

  killAll() {
    this.zombies.forEach(zombie => zombie.die());
    this.zombies = [];
  }

  update(deltaTime) {
    const aliveZombies = [];

    for (let i = 0; i < this.zombies.length; i++) {
      const zombie = this.zombies[i];
      if (zombie.isAlive()) {
        zombie.update(deltaTime);
        aliveZombies.push(zombie);
      } else {
        zombie.die();
      }
    }

    this.zombies = aliveZombies;

    this._separateCrowd();

    // Progressive difficulty: faster spawns and higher cap as survival time grows
    const elapsed = this.game.survivalStartTime
      ? (Date.now() - this.game.survivalStartTime) / 1000
      : 0;
    const diffMult = Math.min(3, 1 + elapsed / 180); // ramps to 3× over 6 minutes
    // Cap the live horde lower now that each zombie is a high-poly (~16k tri) model,
    // to keep draw-calls/triangles reasonable on modest hardware.
    const dynamicMax   = Math.min(48, Math.floor(12 + elapsed / 22));
    const dynamicInterval = Math.max(1.0, this.spawnInterval / diffMult);

    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0 && this.zombies.length < dynamicMax) {
      this.spawnRandomZombie(diffMult);
      this.spawnTimer = dynamicInterval;
    }

    // Ambient zombie groans
    this._groanTimer -= deltaTime;
    if (this._groanTimer <= 0 && this.zombies.length > 0) {
      this.game.audioManager?.playZombieGroan?.();
      this._groanTimer = 3 + Math.random() * 5;
    }
  }

  // Soft crowd separation so a horde doesn't merge into one clipping blob.
  // Zombies don't collide with each other in physics (by design, for perf), so we
  // nudge overlapping pairs apart here. Cheap O(n²) — the count is capped at ~80.
  _separateCrowd() {
    const zs = this.zombies;
    const n = zs.length;
    if (n < 2) return;
    const MIN = 0.85;          // desired spacing between centers
    const MIN2 = MIN * MIN;
    for (let i = 0; i < n; i++) {
      const a = zs[i]; if (!a.body) continue;
      for (let j = i + 1; j < n; j++) {
        const b = zs[j]; if (!b.body) continue;
        let dx = a.body.position.x - b.body.position.x;
        let dz = a.body.position.z - b.body.position.z;
        let d2 = dx * dx + dz * dz;
        if (d2 >= MIN2) continue;
        if (d2 < 1e-4) { dx = (Math.sin(i * 12.9) ); dz = (Math.cos(j * 78.2)); d2 = dx*dx+dz*dz || 1; }
        const d = Math.sqrt(d2);
        const push = (MIN - d) * 0.25; // gentle — separates over a few frames
        const nx = dx / d, nz = dz / d;
        a.body.position.x += nx * push; a.body.position.z += nz * push;
        b.body.position.x -= nx * push; b.body.position.z -= nz * push;
      }
    }
  }

  spawnRandomZombie(diffMult = 1) {
    const player = this.game.player;
    if (!player) return;
    const playerPos = player.getPosition();

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 20;
    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;

    // Higher difficulty → more runners/tanks/crawlers
    let type;
    const r = Math.random();
    if (diffMult < 1.5) {
      type = r < 0.28 ? 'walker' : r < 0.46 ? 'runner' : r < 0.58 ? 'crawler' : r < 0.68 ? 'zombie_hound' : r < 0.76 ? 'child_zombie' : r < 0.84 ? 'leaper' : r < 0.92 ? 'stalker' : 'screamer';
    } else if (diffMult < 2.2) {
      type = r < 0.15 ? 'walker' : r < 0.30 ? 'runner' : r < 0.42 ? 'crawler' : r < 0.50 ? 'zombie_hound' : r < 0.57 ? 'tank' : r < 0.64 ? 'stalker' : r < 0.70 ? 'bloater' : r < 0.76 ? 'regenerator' : r < 0.81 ? 'leaper' : r < 0.86 ? 'child_zombie' : r < 0.91 ? 'acid_spitter' : r < 0.96 ? 'bomber' : 'screamer';
    } else {
      type = r < 0.06 ? 'walker' : r < 0.13 ? 'runner' : r < 0.20 ? 'crawler' : r < 0.26 ? 'zombie_hound' : r < 0.31 ? 'tank' : r < 0.36 ? 'armored' : r < 0.40 ? 'bloater' : r < 0.44 ? 'berserker' : r < 0.48 ? 'regenerator' : r < 0.52 ? 'leaper' : r < 0.55 ? 'stalker' : r < 0.58 ? 'phantom' : r < 0.61 ? 'spitter' : r < 0.64 ? 'child_zombie' : r < 0.67 ? 'screamer' : r < 0.70 ? 'acid_spitter' : r < 0.73 ? 'bomber' : r < 0.76 ? 'zombie_soldier' : r < 0.79 ? 'splitter' : r < 0.82 ? 'horde_master' : r < 0.86 ? 'necromancer' : r < 0.90 ? 'juggernaut' : r < 0.95 ? 'necromancer' : 'mutant_giant';
    }
    this.spawn(type, x, z);
  }

  addZombie(zombie) {
    if (zombie && !this.zombies.includes(zombie)) {
      this.zombies.push(zombie);
    }
  }

  getZombies() {
    return this.zombies;
  }

  getZombieCount() {
    return this.zombies.length;
  }

  getZombieStats() {
    const stats = {
      walker: 0, runner: 0, tank: 0,
      spitter: 0, screamer: 0, crawler: 0,
      armored: 0, bloater: 0, stalker: 0,
      regenerator: 0, berserker: 0, leaper: 0, child_zombie: 0,
      juggernaut: 0, phantom: 0,
      horde_master: 0, bomber: 0, acid_spitter: 0,
      zombie_hound: 0, necromancer: 0,
      zombie_soldier: 0, splitter: 0, mutant_giant: 0
    };

    this.zombies.forEach(zombie => {
      // Some types (e.g. mini_splitter) aren't pre-seeded — don't produce NaN
      stats[zombie.type] = (stats[zombie.type] ?? 0) + 1;
    });

    return stats;
  }
}
