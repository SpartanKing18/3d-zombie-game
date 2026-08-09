import * as THREE from 'three';

export class TreeGenerator {
  constructor(game) {
    this.game = game;
    this.trees = [];
  }

  generateTreesForChunk(chunkX, chunkZ, chunkSize, terrainGenerator) {
    const treeDensity = {
      forest:   0.12,
      plains:   0.025,
      mountain: 0.015,
      desert:   0.003,
      swamp:    0.06
    };

    const gridSize = 10;
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        // Jitter within each grid cell so trees don't form a grid
        const jx = (Math.random() - 0.5) * (chunkSize / gridSize);
        const jz = (Math.random() - 0.5) * (chunkSize / gridSize);
        const cx = chunkX * chunkSize + (gx / gridSize) * chunkSize + jx;
        const cz = chunkZ * chunkSize + (gz / gridSize) * chunkSize + jz;

        const biome = terrainGenerator.getBiome(cx, cz);
        const density = treeDensity[biome] || 0.01;

        if (Math.random() < density) {
          // Keep the area around the house clear — no trees in the 80-unit safe zone
          const distFromHouse = Math.sqrt(cx * cx + cz * cz);
          if (distFromHouse < 80) continue;

          const terrH = terrainGenerator.getHeightAt(cx, cz);
          // Don't plant on very steep slopes or snow peaks
          const slope = terrainGenerator.getSlopeAt?.(cx, cz) ?? 0;
          if (slope > 0.7) continue;
          if (biome === 'mountain' && terrH > terrainGenerator.maxHeight * 0.8) continue;

          this.createTree(cx, cz, terrH, biome);
        }
      }
    }
  }

  createTree(x, z, groundY, biome) {
    const group = new THREE.Group();

    // Randomise per-tree
    const scale = 0.7 + Math.random() * 0.7;
    const tilt = (Math.random() - 0.5) * 0.06; // slight random lean

    if (biome === 'desert') {
      this.buildCactus(group, scale);
    } else if (biome === 'swamp') {
      this.buildSwampTree(group, scale);
    } else if (biome === 'mountain') {
      this.buildPine(group, scale);
    } else if (biome === 'forest') {
      Math.random() < 0.5 ? this.buildOak(group, scale) : this.buildPine(group, scale);
    } else {
      // plains: mix of oaks and isolated pines
      Math.random() < 0.7 ? this.buildOak(group, scale) : this.buildPine(group, scale);
    }

    group.position.set(x, groundY, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.rotation.z = tilt;

    this.game.scene.addObject(group);
    this.trees.push({ x, z, y: groundY, biome, mesh: group });
  }

  // ─── Tree types ─────────────────────────────────────────────────────────────

  buildPine(group, scale) {
    const trunkH = (3.5 + Math.random() * 4) * scale;
    const trunkR = (0.18 + Math.random() * 0.1) * scale;

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, 7),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.95, metalness: 0 })
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Layered cones for pine foliage
    const layers = Math.round(3 + Math.random() * 3);
    const maxR = (1.4 + Math.random() * 1.2) * scale;
    const layerH = trunkH * 0.55;
    // Green foliage with subtle per-tree variation (HSL keeps the hue in the
    // green range — adding hex numbers bled channels and produced blue/purple trees)
    const pineColor = new THREE.Color().setHSL(0.30 + Math.random() * 0.04, 0.5, 0.14 + Math.random() * 0.06);
    const foliageMat = new THREE.MeshStandardMaterial({ color: pineColor, roughness: 0.95, metalness: 0 });

    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const r = maxR * (1 - t * 0.55);
      const yOff = trunkH * 0.6 + layerH * t;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, r * 1.4, 8 + i),
        foliageMat
      );
      cone.position.y = yOff;
      cone.castShadow = true;
      group.add(cone);
    }
  }

  buildOak(group, scale) {
    const trunkH = (2.5 + Math.random() * 2.5) * scale;
    const trunkR = (0.2 + Math.random() * 0.12) * scale;
    const canopyR = (2.0 + Math.random() * 1.5) * scale;

    // Bark colour varies per tree (brown hue range)
    const barkHue = new THREE.Color().setHSL(0.07 + Math.random() * 0.03, 0.45, 0.11 + Math.random() * 0.05);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 8),
      new THREE.MeshStandardMaterial({ color: barkHue, roughness: 0.95, metalness: 0 })
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Main canopy sphere — green hue range
    const leafHue = new THREE.Color().setHSL(0.25 + Math.random() * 0.06, 0.5, 0.2 + Math.random() * 0.08);
    const leafMat = new THREE.MeshStandardMaterial({ color: leafHue, roughness: 0.9, metalness: 0 });

    const mainCanopy = new THREE.Mesh(
      new THREE.SphereGeometry(canopyR, 10, 8),
      leafMat
    );
    mainCanopy.position.y = trunkH + canopyR * 0.55;
    mainCanopy.castShadow = true;
    mainCanopy.scale.y = 0.78;
    group.add(mainCanopy);

    // 2–4 sub-blobs for organic shape
    const blobs = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < blobs; i++) {
      const angle = (i / blobs) * Math.PI * 2 + Math.random() * 0.8;
      const dist = canopyR * (0.4 + Math.random() * 0.4);
      const br = canopyR * (0.5 + Math.random() * 0.35);
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(br, 7, 6),
        leafMat
      );
      blob.position.set(
        Math.cos(angle) * dist,
        trunkH + canopyR * 0.35 + (Math.random() - 0.5) * canopyR * 0.6,
        Math.sin(angle) * dist
      );
      blob.castShadow = true;
      group.add(blob);
    }
  }

  buildSwampTree(group, scale) {
    const trunkH = (3 + Math.random() * 3) * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, trunkH, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 0.98, metalness: 0 })
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Drooping moss clumps
    const mossColor = 0x2a4a18;
    const mossMat = new THREE.MeshStandardMaterial({ color: mossColor, roughness: 0.98, metalness: 0 });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.8;
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 6, 5), mossMat);
      blob.position.set(
        Math.cos(angle) * r * 0.6,
        trunkH * (0.6 + Math.random() * 0.3),
        Math.sin(angle) * r * 0.6
      );
      blob.scale.y = 1.4;
      blob.castShadow = true;
      group.add(blob);
    }
  }

  buildCactus(group, scale) {
    const h = (2 + Math.random() * 2) * scale;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.8, metalness: 0 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.25 * scale, h, 8), mat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Arms
    const armCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < armCount; i++) {
      const armY = h * (0.4 + Math.random() * 0.4);
      const armLen = h * (0.25 + Math.random() * 0.25);
      const armR = 0.15 * scale;
      const side = i % 2 === 0 ? 1 : -1;

      const horiz = new THREE.Mesh(new THREE.CylinderGeometry(armR, armR, armLen, 6), mat);
      horiz.rotation.z = Math.PI / 2;
      horiz.position.set(side * armLen / 2, armY, 0);
      group.add(horiz);

      const vert = new THREE.Mesh(new THREE.CylinderGeometry(armR, armR, armLen * 0.7, 6), mat);
      vert.position.set(side * armLen, armY + armLen * 0.35, 0);
      group.add(vert);
    }
  }

  getTrees() { return this.trees; }

  clear() {
    this.trees.forEach(t => {
      if (t.mesh) this.game.scene.removeObject(t.mesh);
    });
    this.trees = [];
  }
}
