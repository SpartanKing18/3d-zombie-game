export class ChunkManager {
  constructor(game, terrainGenerator) {
    this.game = game;
    this.terrainGenerator = terrainGenerator;
    this.loadedChunks = new Map();
    this.chunkQueue = [];
    this.chunkSize = 64;
    this.loadDistance = 3;
    this.unloadDistance = 5;
    this.lastPlayerChunkX = null;
    this.lastPlayerChunkZ = null;
  }

  getChunkCoords(position) {
    const chunkX = Math.floor(position.x / this.chunkSize);
    const chunkZ = Math.floor(position.z / this.chunkSize);
    return { x: chunkX, z: chunkZ };
  }

  update(playerPosition) {
    const playerChunk = this.getChunkCoords(playerPosition);

    if (playerChunk.x !== this.lastPlayerChunkX || playerChunk.z !== this.lastPlayerChunkZ) {
      this.lastPlayerChunkX = playerChunk.x;
      this.lastPlayerChunkZ = playerChunk.z;
      this._enqueueChunksAroundPlayer(playerChunk);
      this.unloadDistantChunks(playerChunk);
    }

    // Process at most 2 chunks per frame to avoid frame spikes
    for (let i = 0; i < 2 && this.chunkQueue.length > 0; i++) {
      const { x, z } = this.chunkQueue.shift();
      const key = x + ',' + z;
      if (!this.loadedChunks.has(key)) {
        const chunk = this.terrainGenerator.generateChunk(x, z);
        this.loadedChunks.set(key, chunk);
      }
    }
  }

  _enqueueChunksAroundPlayer(playerChunk) {
    const toEnqueue = [];
    for (let x = playerChunk.x - this.loadDistance; x <= playerChunk.x + this.loadDistance; x++) {
      for (let z = playerChunk.z - this.loadDistance; z <= playerChunk.z + this.loadDistance; z++) {
        const key = x + ',' + z;
        if (!this.loadedChunks.has(key) && !this.chunkQueue.some(c => c.x === x && c.z === z)) {
          const dx = x - playerChunk.x;
          const dz = z - playerChunk.z;
          toEnqueue.push({ x, z, dist: dx * dx + dz * dz });
        }
      }
    }
    // Nearest chunks first
    toEnqueue.sort((a, b) => a.dist - b.dist);
    this.chunkQueue.push(...toEnqueue);
  }

  loadChunksAroundPlayer(playerChunk) {
    this._enqueueChunksAroundPlayer(playerChunk);
  }

  unloadDistantChunks(playerChunk) {
    // Reconcile against the terrain generator's registry, not just our own map —
    // chunks pre-generated elsewhere (cutscene start, house-exit preload) would
    // otherwise keep their meshes and physics bodies loaded forever
    for (const [key, chunk] of this.terrainGenerator.chunks) {
      const dx = Math.abs(chunk.chunkX - playerChunk.x);
      const dz = Math.abs(chunk.chunkZ - playerChunk.z);

      if (dx > this.unloadDistance || dz > this.unloadDistance) {
        this.terrainGenerator.unloadChunk(chunk.chunkX, chunk.chunkZ);
        this.loadedChunks.delete(key);
      }
    }
  }

  getLoadedChunks() {
    return Array.from(this.loadedChunks.values());
  }

  getChunkCount() {
    return this.loadedChunks.size;
  }

  clear() {
    for (const [key, chunk] of this.loadedChunks) {
      this.terrainGenerator.unloadChunk(chunk.chunkX, chunk.chunkZ);
    }
    this.loadedChunks.clear();
    this.chunkQueue = [];
  }
}
