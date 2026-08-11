import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SimplexNoise } from 'simplex-noise';
import { Textures } from '../utils/Textures.js';

export class TerrainGenerator {
  constructor(game) {
    this.game = game;
    this.noise = new SimplexNoise(Math.random);
    this.biomeNoise = new SimplexNoise(Math.random);
    this.chunkSize = 64;
    this.segmentsPerChunk = 16;
    this.scale = 0.05;
    this.maxHeight = 14;
    this.chunks = new Map();
    this.physicsBodies = new Map();
    this._heightCache = new Map(); // key: "rx,rz" at 0.5-unit resolution
  }

  generateChunk(chunkX, chunkZ) {
    const key = chunkX + ',' + chunkZ;
    if (this.chunks.has(key)) {
      return this.chunks.get(key);
    }

    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.segmentsPerChunk,
      this.segmentsPerChunk
    );

    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position.array;
    const normals   = geometry.attributes.normal.array;
    // Float32Array (0.0–1.0) avoids all Uint8Array normalization issues
    const colors = new Float32Array(positions.length);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const heightData = [];
    const e = 0.75; // gradient sample distance for analytic normals

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];

      const worldX = chunkX * this.chunkSize + x + this.chunkSize / 2;
      const worldZ = chunkZ * this.chunkSize + z + this.chunkSize / 2;

      const height = this.getHeight(worldX, worldZ);
      positions[i + 1] = height;

      // Analytic normal from the CONTINUOUS height field (not per-chunk triangles),
      // so shared border vertices get identical normals in adjacent chunks — no seams.
      const hL = this.getHeight(worldX - e, worldZ);
      const hR = this.getHeight(worldX + e, worldZ);
      const hD = this.getHeight(worldX, worldZ - e);
      const hU = this.getHeight(worldX, worldZ + e);
      let nx = hL - hR, ny = 2 * e, nz = hD - hU;
      const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
      normals[i]     = nx * inv;
      normals[i + 1] = ny * inv;
      normals[i + 2] = nz * inv;

      const color = this.getTerrainColor(worldX, worldZ, height);
      colors[i]     = color.r / 255;
      colors[i + 1] = color.g / 255;
      colors[i + 2] = color.b / 255;

      heightData.push([worldX, worldZ, height]);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;

    // Photographic ground detail (shared across chunks). map multiplies the biome
    // vertex colours so the terrain keeps its colour but gains real surface texture
    // + relief from the normal map, instead of a flat solid shade.
    const gt = Textures.ground(20);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: gt.map,
      normalMap: gt.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.35,
      side: THREE.FrontSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;   // terrain doesn't shadow-cast meaningfully
    mesh.receiveShadow = true;
    mesh.position.set(
      chunkX * this.chunkSize + this.chunkSize / 2,
      0,
      chunkZ * this.chunkSize + this.chunkSize / 2
    );

    this.game.scene.addObject(mesh);

    const heightmap = this.createHeightmap(chunkX, chunkZ);
    const physicsBody = this.createPhysicsHeightfield(chunkX, chunkZ, heightmap);

    const chunk = {
      mesh,
      geometry,
      chunkX,
      chunkZ,
      heightData,
      heightmap,
      physicsBody
    };

    this.chunks.set(key, chunk);
    this.physicsBodies.set(key, physicsBody);

    return chunk;
  }

  createHeightmap(chunkX, chunkZ) {
    const heights = [];
    const resolution = this.segmentsPerChunk + 1;

    for (let x = 0; x < resolution; x++) {
      heights[x] = [];
      for (let z = 0; z < resolution; z++) {
        const worldX = chunkX * this.chunkSize + (x / this.segmentsPerChunk) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (z / this.segmentsPerChunk) * this.chunkSize;
        heights[x][z] = this.getHeight(worldX, worldZ);
      }
    }

    return heights;
  }

  createPhysicsHeightfield(chunkX, chunkZ, heightmap) {
    const body = new CANNON.Body({ mass: 0 });
    // Heightfield data lives in the body's local X/Y plane with heights along +Z,
    // so it must be rotated flat — unrotated it forms a vertical wall in the world.
    // After the -90° X rotation local +Y maps to world -Z, so reverse each row and
    // anchor the body at the chunk's far-Z edge to keep data[x][z] → world (+X, +Z).
    const flipped = heightmap.map(row => [...row].reverse());
    const shape = new CANNON.Heightfield(flipped, {
      elementSize: this.chunkSize / this.segmentsPerChunk
    });

    body.addShape(shape);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    body.position.set(
      chunkX * this.chunkSize,
      0,
      chunkZ * this.chunkSize + this.chunkSize
    );

    // Only the player needs physics terrain — zombies use manual height snapping
    body.collisionFilterGroup = 4; // GROUP_TERRAIN
    body.collisionFilterMask  = 1; // GROUP_PLAYER only
    this.game.physicsWorld.addBody(body);
    return body;
  }

  getHeight(x, z) {
    let height = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let octave = 0; octave < 3; octave++) {
      const sampleX = x * frequency * this.scale;
      const sampleZ = z * frequency * this.scale;

      const noiseValue = this.noise.noise2D(sampleX, sampleZ);
      height += noiseValue * amplitude;
      maxAmplitude += amplitude;

      amplitude *= 0.5;
      frequency *= 2;
    }

    height /= maxAmplitude;
    height = (height + 1) / 2; // 0..1

    // Cap biome multipliers so final height never exceeds maxHeight
    // (getTerrainColor normalises by maxHeight; exceeding it causes snow-white terrain)
    const biome = this.getBiome(x, z);
    let biomeScale = 1.0;
    if (biome === 'mountain') biomeScale = 0.95;
    else if (biome === 'swamp')  biomeScale = 0.55;
    else if (biome === 'desert') biomeScale = 0.75;
    else if (biome === 'forest') biomeScale = 0.80;

    const rawHeight = Math.max(0, height * this.maxHeight * biomeScale);

    // Flatten a generous zone covering the whole neighborhood (houses out to x=±44,
    // z=58) AND the industrial lot / factory down the street (to z≈95), so nothing
    // is ever clipped or covered by the surrounding hills. Hills blend in past the
    // edges. Flat zone: x∈±58, z∈-25..+105.
    const FLAT_X  = 58;  const BLEND_X  = 45;  // flat until ±58, blend to ±103
    const FLAT_ZF = 105; const BLEND_ZF = 45;  // front: flat until z=105, blend to z=150
    const FLAT_ZB = 25;  const BLEND_ZB = 40;  // back : flat until z=-25, blend to z=-65

    const hx = Math.max(0, Math.abs(x) - FLAT_X)  / BLEND_X;
    const hz = z > 0
      ? Math.max(0, z - FLAT_ZF) / BLEND_ZF
      : Math.max(0, -z - FLAT_ZB) / BLEND_ZB;

    const hBlend = this.smoothstep(0, 1, Math.sqrt(hx * hx + hz * hz));

    return rawHeight * hBlend;
  }

  getBiome(x, z) {
    const value = this.biomeNoise.noise2D(x * 0.005, z * 0.005);
    const normalized = (value + 1) / 2;

    if (normalized < 0.15) return 'swamp';
    if (normalized < 0.35) return 'desert';
    if (normalized < 0.65) return 'plains';
    if (normalized < 0.80) return 'forest';
    return 'mountain';
  }

  // Smooth step helper
  smoothstep(a, b, t) {
    const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  }

  // Linear interpolate two RGB colors
  lerpColor(c1, c2, t) {
    t = Math.max(0, Math.min(1, t));
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
  }

  // Micro noise for surface texture variation
  microNoise(x, z) {
    return (this.noise.noise2D(x * 2.5, z * 2.5) * 0.5 + 0.5); // 0..1
  }

  // Approximate slope by sampling neighbours
  getSlopeAt(x, z) {
    const d = 2;
    const h0 = this.getHeight(x, z);
    const h1 = this.getHeight(x + d, z);
    const h2 = this.getHeight(x, z + d);
    const dx = Math.abs(h1 - h0) / d;
    const dz = Math.abs(h2 - h0) / d;
    return Math.min(1, Math.sqrt(dx * dx + dz * dz));
  }

  getTerrainColor(worldX, worldZ, height) {
    const biome = this.getBiome(worldX, worldZ);
    const h = height / this.maxHeight; // normalised 0..1
    const slope = this.getSlopeAt(worldX, worldZ);
    const n = this.microNoise(worldX, worldZ); // tiny variation

    // ── Shared height layers ────────────────────────────────────────────────
    const mud     = { r: 78,  g: 62,  b: 42  };
    const sand    = { r: 195, g: 175, b: 110 };
    const dryGrass= { r: 168, g: 148, b: 65  };
    const lushGrass={ r: 62, g: 120, b: 38   };
    const darkGrass={ r: 30, g: 80,  b: 20   };
    const alpine  = { r: 75,  g: 100, b: 55  };
    const rock    = { r: 105, g: 98,  b: 88  };
    const darkRock= { r: 70,  g: 65,  b: 58  };
    const snowRock= { r: 175, g: 170, b: 165 };
    const snow    = { r: 235, g: 238, b: 248 };

    // Slope drives rock exposure: any terrain steeper than ~25° goes rocky
    const rockBlend = this.smoothstep(0.35, 0.65, slope);

    let base;

    if (biome === 'desert') {
      // Desert: tan → ochre at height, slight reddish at mid
      const desert1 = { r: 198, g: 165, b: 90 };
      const desert2 = { r: 210, g: 135, b: 75 };
      base = h < 0.4 ? this.lerpColor(desert1, sand, h / 0.4)
                      : this.lerpColor(desert2, rock, (h - 0.4) / 0.6);

    } else if (biome === 'swamp') {
      // Swamp: dark saturated ground, stays low
      const swamp1 = { r: 48,  g: 65,  b: 28 };
      const swamp2 = { r: 62,  g: 82,  b: 35 };
      base = h < 0.15 ? mud : this.lerpColor(swamp1, swamp2, Math.min(1, (h - 0.15) / 0.6));

    } else if (biome === 'mountain') {
      // Mountain: dramatic height bands
      if (h < 0.25)      base = darkGrass;
      else if (h < 0.45) base = this.lerpColor(darkGrass, alpine,   (h - 0.25) / 0.2);
      else if (h < 0.65) base = this.lerpColor(alpine,    rock,     (h - 0.45) / 0.2);
      else if (h < 0.82) base = this.lerpColor(rock,      snowRock, (h - 0.65) / 0.17);
      else               base = this.lerpColor(snowRock,  snow,     (h - 0.82) / 0.18);

    } else if (biome === 'forest') {
      // Forest: rich dark greens, some mud at base
      if (h < 0.12)      base = mud;
      else if (h < 0.5)  base = this.lerpColor(darkGrass, lushGrass, (h - 0.12) / 0.38);
      else if (h < 0.72) base = this.lerpColor(lushGrass, alpine,    (h - 0.5)  / 0.22);
      else               base = this.lerpColor(alpine,    rock,      (h - 0.72) / 0.28);

    } else {
      // Plains: varied grass with subtle dryness at height
      if (h < 0.08)      base = mud;
      else if (h < 0.55) base = this.lerpColor(lushGrass, dryGrass, this.smoothstep(0.08, 0.55, h));
      else if (h < 0.75) base = this.lerpColor(dryGrass,  rock,     (h - 0.55) / 0.2);
      else               base = this.lerpColor(rock,      snow,     (h - 0.75) / 0.25);
    }

    // Apply slope-based rock overlay
    if (rockBlend > 0.01) {
      base = this.lerpColor(base, darkRock, rockBlend * 0.8);
    }

    // Micro noise: ±8 luminance variation so adjacent vertices aren't identical
    const jitter = Math.round((n - 0.5) * 16);
    return {
      r: Math.max(0, Math.min(255, base.r + jitter)),
      g: Math.max(0, Math.min(255, base.g + jitter)),
      b: Math.max(0, Math.min(255, base.b + jitter))
    };
  }

  // Keep for backwards compat
  getBiomeColor(biome) {
    const colors = {
      swamp:    { r: 55,  g: 72,  b: 28  },
      desert:   { r: 194, g: 164, b: 88  },
      plains:   { r: 72,  g: 120, b: 38  },
      forest:   { r: 34,  g: 80,  b: 22  },
      mountain: { r: 110, g: 105, b: 95  }
    };
    return colors[biome] || colors.plains;
  }

  unloadChunk(chunkX, chunkZ) {
    const key = chunkX + ',' + chunkZ;
    const chunk = this.chunks.get(key);

    if (chunk) {
      this.game.scene.removeObject(chunk.mesh);
      chunk.geometry.dispose();
      chunk.mesh.material.dispose();

      const physicsBody = this.physicsBodies.get(key);
      if (physicsBody) {
        this.game.physicsWorld.removeBody(physicsBody);
      }

      this.chunks.delete(key);
      this.physicsBodies.delete(key);
    }
  }

  updateChunksAroundPlayer(playerPos) {
    const playerChunkX = Math.floor(playerPos.x / this.chunkSize);
    const playerChunkZ = Math.floor(playerPos.z / this.chunkSize);

    const loadDistance = 3;
    const unloadDistance = 5;

    for (let x = playerChunkX - loadDistance; x <= playerChunkX + loadDistance; x++) {
      for (let z = playerChunkZ - loadDistance; z <= playerChunkZ + loadDistance; z++) {
        this.generateChunk(x, z);
      }
    }

    const chunksToRemove = [];
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.chunkX - playerChunkX);
      const dz = Math.abs(chunk.chunkZ - playerChunkZ);
      if (dx > unloadDistance || dz > unloadDistance) {
        chunksToRemove.push(key);
      }
    }

    chunksToRemove.forEach(key => {
      const parts = key.split(',');
      this.unloadChunk(parseInt(parts[0]), parseInt(parts[1]));
    });
  }

  getHeightAt(x, z) {
    // Round to 0.5-unit grid — zombies/NPCs move slowly so reuse cached values
    const rx = Math.round(x * 2);
    const rz = Math.round(z * 2);
    const key = rx * 100003 + rz; // cheap int hash, no string alloc
    const cached = this._heightCache.get(key);
    if (cached !== undefined) return cached;
    const h = this.getHeight(x, z);
    // Evict if cache grows large (player moves far from original area)
    if (this._heightCache.size > 8192) this._heightCache.clear();
    this._heightCache.set(key, h);
    return h;
  }

  getChunkCount() {
    return this.chunks.size;
  }

  // Remove all terrain meshes and physics bodies from the world, then clear caches.
  clearAll() {
    for (const chunk of this.chunks.values()) {
      this.game.scene.removeObject(chunk.mesh);
      chunk.geometry.dispose();
      chunk.mesh.material.dispose();
    }
    for (const body of this.physicsBodies.values()) {
      this.game.physicsWorld.removeBody(body);
    }
    this.chunks.clear();
    this.physicsBodies.clear();
  }

  // Legacy alias used after FriendsHouse.clearAll() already removed scene/physics objects.
  clearCacheOnly() {
    this.chunks.clear();
    this.physicsBodies.clear();
  }

  getTerrainNormalAt(x, z) {
    const offset = 1;
    const h0 = this.getHeight(x, z);
    const h1 = this.getHeight(x + offset, z);
    const h2 = this.getHeight(x, z + offset);

    const v1 = new THREE.Vector3(offset, h1 - h0, 0);
    const v2 = new THREE.Vector3(0, h2 - h0, offset);
    const normal = new THREE.Vector3();
    normal.crossVectors(v1, v2).normalize();

    return normal;
  }
}
