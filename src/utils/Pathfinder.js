export class Pathfinder {
  constructor(gridSize = 32) {
    this.gridSize = gridSize;
  }

  getKey(x, z) {
    return Math.floor(x / this.gridSize) + ',' + Math.floor(z / this.gridSize);
  }

  heuristic(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getNeighbors(x, z) {
    const step = this.gridSize;
    return [
      [x,      z - step],
      [x,      z + step],
      [x - step, z     ],
      [x + step, z     ],
      [x - step, z - step],
      [x - step, z + step],
      [x + step, z - step],
      [x + step, z + step],
    ];
  }

  findPath(startX, startZ, endX, endZ, terrain) {
    const startKey = this.getKey(startX, startZ);
    const endKey   = this.getKey(endX,   endZ);

    if (startKey === endKey) return [];

    // openSet as array; openSetKeys as Set for O(1) membership
    const openSet     = [[startX, startZ]];
    const openSetKeys = new Set([startKey]);
    const closedSet   = new Set();
    const cameFrom    = new Map();
    const gScore      = new Map([[startKey, 0]]);
    const fScore      = new Map([[startKey, this.heuristic(startX, startZ, endX, endZ)]]);

    const maxIterations = 100;
    let iterations = 0;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest fScore — O(openSet.length) but bounded by maxIterations
      let bestIdx = 0;
      let bestF = fScore.get(this.getKey(openSet[0][0], openSet[0][1])) ?? Infinity;
      for (let i = 1; i < openSet.length; i++) {
        const f = fScore.get(this.getKey(openSet[i][0], openSet[i][1])) ?? Infinity;
        if (f < bestF) { bestF = f; bestIdx = i; }
      }

      const current = openSet[bestIdx];
      const currentKey = this.getKey(current[0], current[1]);

      if (Math.abs(current[0] - endX) < this.gridSize && Math.abs(current[1] - endZ) < this.gridSize) {
        return this._reconstructPath(cameFrom, current);
      }

      // Remove from openSet in O(1) by swapping with last
      openSet[bestIdx] = openSet[openSet.length - 1];
      openSet.pop();
      openSetKeys.delete(currentKey);
      closedSet.add(currentKey);

      for (const neighbor of this.getNeighbors(current[0], current[1])) {
        const neighborKey = this.getKey(neighbor[0], neighbor[1]);
        if (closedSet.has(neighborKey)) continue;

        const terrainHeight = terrain ? terrain.getHeightAt(neighbor[0], neighbor[1]) : 0;
        if (terrainHeight < -100) continue;

        const tentativeG = (gScore.get(currentKey) ?? 0) +
          this.heuristic(current[0], current[1], neighbor[0], neighbor[1]);

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          fScore.set(neighborKey, tentativeG + this.heuristic(neighbor[0], neighbor[1], endX, endZ));

          if (!openSetKeys.has(neighborKey)) {
            openSet.push(neighbor);
            openSetKeys.add(neighborKey);
          }
        }
      }
    }

    return [];
  }

  _reconstructPath(cameFrom, current) {
    const path = [current];
    let key = this.getKey(current[0], current[1]);
    while (cameFrom.has(key)) {
      current = cameFrom.get(key);
      path.unshift(current);
      const prevKey = this.getKey(current[0], current[1]);
      if (prevKey === key) break;
      key = prevKey;
    }
    return path;
  }

  getDirectionTowards(fromX, fromZ, toX, toZ) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length === 0) return [0, 0];
    return [dx / length, dz / length];
  }
}
