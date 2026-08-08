import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class BuildingGenerator {
  constructor(game, terrainGenerator, furnitureGenerator = null) {
    this.game = game;
    this.terrainGenerator = terrainGenerator;
    this.furnitureGenerator = furnitureGenerator;
    this.buildings = [];
  }

  findBuildingSites(chunkX, chunkZ, chunkSize, segmentsPerChunk) {
    const sites = [];
    const minFlatness = 0.5;
    const gridSize = 16;

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const cx = chunkX * chunkSize + (gx / gridSize) * chunkSize;
        const cz = chunkZ * chunkSize + (gz / gridSize) * chunkSize;

        const flatness = this.calculateFlatness(cx, cz, 8);

        if (flatness > minFlatness) {
          sites.push({
            x: cx,
            z: cz,
            flatness: flatness,
            biome: this.terrainGenerator.getBiome(cx, cz)
          });
        }
      }
    }

    return sites;
  }

  calculateFlatness(cx, cz, radius) {
    const center = this.terrainGenerator.getHeight(cx, cz);
    let differences = 0;

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius;
      const pz = cz + Math.sin(angle) * radius;
      const height = this.terrainGenerator.getHeight(px, pz);
      differences += Math.abs(height - center);
    }

    const avgDiff = differences / 8;
    return Math.max(0, 1 - avgDiff / 3);
  }

  generateBuildingsForChunk(chunkX, chunkZ, chunkSize, segmentsPerChunk) {
    const sites = this.findBuildingSites(chunkX, chunkZ, chunkSize, segmentsPerChunk);
    const buildingsToGenerate = Math.floor(sites.length * 0.15);

    // Exclude the house safe zone so buildings never spawn near the player's exit point.
    // Safe zone: |x| < 55, -30 < z < 85  (flat zone ±15 units buffer for building size)
    const SAFE_X = 55, SAFE_ZN = -30, SAFE_ZF = 85;

    const placedSites = [];
    const MIN_SPACING = 20; // prevent buildings from overlapping each other

    const candidateSites = sites
      .filter(s => Math.abs(s.x) >= SAFE_X || s.z <= SAFE_ZN || s.z >= SAFE_ZF)
      .sort((a, b) => b.flatness - a.flatness);

    for (const site of candidateSites) {
      if (placedSites.length >= buildingsToGenerate) break;
      // Skip if too close to an already-placed building
      const tooClose = placedSites.some(p => {
        const dx = p.x - site.x, dz = p.z - site.z;
        return dx * dx + dz * dz < MIN_SPACING * MIN_SPACING;
      });
      if (!tooClose) placedSites.push(site);
    }

    placedSites.forEach(site => this.createBuilding(site));
  }

  createBuilding(site) {
    const biomeType = site.biome;
    const buildingTypes = this.getBuildingTypesForBiome(biomeType);
    const buildingType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];

    const building = {
      x: site.x,
      z: site.z,
      y: this.terrainGenerator.getHeight(site.x, site.z),
      type: buildingType,
      width: 8 + Math.random() * 8,
      depth: 8 + Math.random() * 8,
      height: 4 + Math.random() * 4,
      floors: Math.floor(2 + Math.random() * 2),
      mesh: null,
      physicsBody: null
    };

    this.buildBuilding(building);
    this.buildings.push(building);
  }

  buildBuilding(building) {
    const group = new THREE.Group();

    const walls = this.createWalls(building);
    group.add(walls);

    const roof = this.createRoof(building);
    group.add(roof);

    const doors = this.createDoors(building);
    group.add(doors);

    group.position.set(building.x, building.y, building.z);

    building.mesh = group;
    this.game.scene.addObject(group);

    this.createPhysicsBody(building);

    if (this.furnitureGenerator) {
      this.furnitureGenerator.generateFurnitureForBuilding(building);
    }
  }

  createWalls(building) {
    const group = new THREE.Group();

    const wallMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.1, 0.3, 0.5)
    });

    const w = building.width;
    const d = building.depth;
    const h = building.height;

    const wallGeometry = new THREE.BoxGeometry(w, h, 0.5);
    const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall1.position.z = -d / 2;
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    group.add(wall1);

    const wall2 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall2.position.z = d / 2;
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    group.add(wall2);

    const wall3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, d), wallMaterial);
    wall3.position.x = -w / 2;
    wall3.castShadow = true;
    wall3.receiveShadow = true;
    group.add(wall3);

    const wall4 = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, d), wallMaterial);
    wall4.position.x = w / 2;
    wall4.castShadow = true;
    wall4.receiveShadow = true;
    group.add(wall4);

    return group;
  }

  createRoof(building) {
    const roofMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.05, 0.4, 0.3)
    });

    const roofGeometry = new THREE.BoxGeometry(building.width, 0.5, building.depth);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = building.height / 2 + 0.25;
    roof.castShadow = true;
    roof.receiveShadow = true;

    return roof;
  }

  createDoors(building) {
    const group = new THREE.Group();

    const doorMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.08, 0.6, 0.3)
    });

    const doorGeometry = new THREE.BoxGeometry(2, 2.5, 0.2);
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.z = -building.depth / 2 - 0.1;
    door.position.y = 1.25;
    door.castShadow = true;
    group.add(door);

    return group;
  }

  createPhysicsBody(building) {
    // Use four thin wall shapes instead of one solid box so the interior is
    // accessible and the player can't get trapped inside solid geometry.
    const body = new CANNON.Body({ mass: 0 });
    const w = building.width / 2;
    const d = building.depth / 2;
    const h = building.height / 2;
    const t = 0.25; // wall half-thickness

    // Front wall (–z face)
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, h, t)),
      new CANNON.Vec3(0, 0, -d));
    // Back wall (+z face)
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, h, t)),
      new CANNON.Vec3(0, 0,  d));
    // Left wall (–x face)
    body.addShape(new CANNON.Box(new CANNON.Vec3(t, h, d)),
      new CANNON.Vec3(-w, 0, 0));
    // Right wall (+x face)
    body.addShape(new CANNON.Box(new CANNON.Vec3(t, h, d)),
      new CANNON.Vec3( w, 0, 0));
    // Roof slab
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, t, d)),
      new CANNON.Vec3(0, h, 0));

    body.position.set(building.x, building.y + h, building.z);
    body.collisionFilterGroup = 8; // GROUP_WORLD
    body.collisionFilterMask  = 1; // GROUP_PLAYER only
    this.game.physicsWorld.addBody(body);
    building.physicsBody = body;
  }

  getBuildingTypesForBiome(biome) {
    const types = {
      plains: ['farmhouse', 'barn', 'stable'],
      forest: ['cabin', 'ranger_station', 'lodge'],
      mountain: ['shelter', 'watchtower'],
      desert: ['gas_station', 'motel', 'store'],
      swamp: ['shack', 'trading_post']
    };

    return types[biome] || types.plains;
  }

  getBuildings() {
    return this.buildings;
  }

  clear() {
    this.buildings.forEach(building => {
      if (building.mesh) {
        this.game.scene.removeObject(building.mesh);
      }
      if (building.physicsBody) {
        this.game.physicsWorld.removeBody(building.physicsBody);
      }
    });
    this.buildings = [];
  }
}
