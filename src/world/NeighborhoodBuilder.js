import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Textures } from '../utils/Textures.js';

// Builds a persistent suburban neighborhood in the flat zone around the origin so
// stepping out the house's front door lands the player on a real street lined with
// houses (instead of empty terrain). Geometry is added straight to the scene and
// tracked here for disposal — NOT into FriendsHouse.objects, so exitHouse()'s
// clearAll() leaves it intact.
//
// Coordinate facts (see TerrainGenerator flat zone |x|<=40, z=-20..+70, y=0):
//   - Player house footprint x:±14, z:±10, front door faces +z (toward z=20 road).
//   - Player exits at ~(0, ~1, 11.6) facing +z.
export class NeighborhoodBuilder {
  constructor(game) {
    this.game = game;
    this._objects = [];
    this._bodies = [];
    this._lights = [];
    this._built = false;

    // Road grid (world coords). A main street in front of the house plus a back
    // street and two cross avenues → a block with four intersections.
    this.roads = [
      { type: 'ew', z: 20,  x0: -46, x1: 46, w: 8 },   // Main St (house faces this)
      { type: 'ew', z: 48,  x0: -46, x1: 46, w: 8 },   // Second St
      { type: 'ns', x: -34, z0: 6,   z1: 54, w: 7 },   // Oak Ave
      { type: 'ns', x: 34,  z0: 6,   z1: 54, w: 7 },   // Pine Ave
      { type: 'ns', x: 0,   z0: 48,  z1: 76, w: 9 },   // Factory Rd (spur to the factory)
    ];
  }

  // --- material palette (built once) ---
  _mats() {
    if (this._m) return this._m;
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });
    // Shared photographic textures (map + normalMap) for real surface detail
    const roadTex = Textures.road(9);
    const concTex = Textures.concrete(5);
    const wallTex = Textures.wall(2.2);
    this._m = {
      asphalt:  std(0x6a6d72, { roughness: 0.96, ...roadTex }),
      line:     new THREE.MeshStandardMaterial({ color: 0x8a7f38, roughness: 0.85 }), // worn paint, no glow
      concrete: std(0xb8b8b2, { roughness: 0.95, ...concTex }),
      curb:     std(0x82827c),
      grass:    std(0x4a6a34, { roughness: 1 }),
      roof:     [std(0x6a2e26), std(0x3a3f46), std(0x4a3a2c), std(0x2f3a48), std(0x5a4436)],
      siding:   [std(0xd8cbb0, wallTex), std(0xb6c2b4, wallTex), std(0xe0d6c0, wallTex), std(0xc0b6a4, wallTex), std(0xc8d0d4, wallTex), std(0xe4c8ac, wallTex), std(0xb4c0c8, wallTex)],
      trim:     std(0xe8e4d8),
      door:     [std(0x5a3a26), std(0x2e4636), std(0x6a2222), std(0x28324a)],
      glass:    new THREE.MeshStandardMaterial({ color: 0x223028, roughness: 0.15, metalness: 0.1, emissive: 0x1a2620, emissiveIntensity: 0.25 }),
      foundation: std(0x54524d),
      metal:    new THREE.MeshStandardMaterial({ color: 0x50555c, roughness: 0.5, metalness: 0.6 }),
      darkmetal: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6, metalness: 0.5 }),
      hedge:    std(0x35502a, { roughness: 1 }),
      lamppost: std(0x2a2c30, { metalness: 0.4, roughness: 0.5 }),
      lamphead: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe89a, emissiveIntensity: 0.7, roughness: 0.4 }),
      carbody:  [new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.35, metalness: 0.55 }),
                 new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.35, metalness: 0.55 }),
                 new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.35, metalness: 0.55 }),
                 new THREE.MeshStandardMaterial({ color: 0x6a6a60, roughness: 0.35, metalness: 0.55 })],
      carglass: new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.1, metalness: 0.3 }),
      tire:     std(0x141414, { roughness: 0.9 }),
    };
    return this._m;
  }

  _add(mesh, cast = true) {
    mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.userData.noHit = mesh.userData.noHit ?? false;
    this.game.scene.addObject(mesh);
    this._objects.push(mesh);
    return mesh;
  }

  _box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  build() {
    if (this._built) return;
    this._built = true;
    const M = this._mats();

    this._buildGroundFloor();
    this._buildRoads(M);
    this._buildHouses(M);
    this._buildProps(M);
    this._buildFactory(M);
    this._buildWrecks(M);
    this._buildStreetDebris(M);
    this._spawnCorpses();
  }

  // ─── Roads, sidewalks, curbs ────────────────────────────────────────────────
  _buildRoads(M) {
    for (const r of this.roads) {
      const cx = r.type === 'ew' ? (r.x0 + r.x1) / 2 : r.x;
      const cz = r.type === 'ew' ? r.z : (r.z0 + r.z1) / 2;
      const len = r.type === 'ew' ? (r.x1 - r.x0) : (r.z1 - r.z0);

      // Slightly different heights per orientation so overlapping asphalt/dashes
      // at intersections don't z-fight (EW sits just above NS).
      const roadY = r.type === 'ew' ? 0.021 : 0.018;
      const dashY = r.type === 'ew' ? 0.036 : 0.033;

      // Asphalt
      const road = new THREE.Mesh(
        r.type === 'ew' ? new THREE.PlaneGeometry(len, r.w) : new THREE.PlaneGeometry(r.w, len),
        M.asphalt
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(cx, roadY, cz);
      road.receiveShadow = true; road.userData.noHit = true;
      this.game.scene.addObject(road); this._objects.push(road);

      // Dashed centre line
      const dashes = Math.floor(len / 4);
      for (let i = 0; i < dashes; i++) {
        const t = r.x0 !== undefined && r.type === 'ew' ? r.x0 + i * 4 + 1 : r.z0 + i * 4 + 1;
        const dash = new THREE.Mesh(
          r.type === 'ew' ? new THREE.PlaneGeometry(2, 0.18) : new THREE.PlaneGeometry(0.18, 2),
          M.line
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(r.type === 'ew' ? t : cx, dashY, r.type === 'ew' ? cz : t);
        dash.userData.noHit = true;
        this.game.scene.addObject(dash); this._objects.push(dash);
      }

      // Sidewalks + curbs on both sides
      const half = r.w / 2;
      for (const s of [-1, 1]) {
        const swW = 2.4;
        const sw = new THREE.Mesh(
          r.type === 'ew' ? new THREE.BoxGeometry(len, 0.12, swW) : new THREE.BoxGeometry(swW, 0.12, len),
          M.concrete
        );
        if (r.type === 'ew') sw.position.set(cx, 0.06, cz + s * (half + swW / 2));
        else sw.position.set(cx + s * (half + swW / 2), 0.06, cz);
        sw.receiveShadow = true; sw.userData.noHit = true;
        this.game.scene.addObject(sw); this._objects.push(sw);
      }
    }
  }

  // ─── House lots ─────────────────────────────────────────────────────────────
  _onRoad(x, z, buffer = 5) {
    for (const r of this.roads) {
      if (r.type === 'ew') {
        if (Math.abs(z - r.z) < r.w / 2 + buffer && x > r.x0 - buffer && x < r.x1 + buffer) return true;
      } else {
        if (Math.abs(x - r.x) < r.w / 2 + buffer && z > r.z0 - buffer && z < r.z1 + buffer) return true;
      }
    }
    return false;
  }

  _buildHouses(M) {
    // Lots: face = cardinal the FRONT faces (toward its road). N=+z, S=-z, E=+x, W=-x
    const lots = [
      // South of Main St (face +z toward Main); player house occupies x:±14
      { x: -28, z: 8, face: 'N' }, { x: 28, z: 8, face: 'N' },
      // North of Main St, south of the block (face -z toward Main)
      { x: -44, z: 30, face: 'S' }, { x: -20, z: 30, face: 'S' }, { x: -6, z: 30, face: 'S' },
      { x: 6, z: 30, face: 'S' }, { x: 20, z: 30, face: 'S' }, { x: 44, z: 30, face: 'S' },
      // North of the block, south of Second St (face +z toward Second St)
      { x: -44, z: 38, face: 'N' }, { x: -20, z: 38, face: 'N' }, { x: -6, z: 38, face: 'N' },
      { x: 6, z: 38, face: 'N' }, { x: 20, z: 38, face: 'N' }, { x: 44, z: 38, face: 'N' },
      // North of Second St (face -z toward Second St)
      { x: -28, z: 58, face: 'S' }, { x: -6, z: 58, face: 'S' }, { x: 20, z: 58, face: 'S' },
      // Along Oak Ave (west edge, face +x) and Pine Ave (east edge, face -x)
      { x: -44, z: 14, face: 'E' }, { x: 44, z: 14, face: 'W' },
    ];
    let i = 0;
    for (const lot of lots) {
      if (this._onRoad(lot.x, lot.z, 3)) continue;
      if (Math.abs(lot.x) < 20 && Math.abs(lot.z) < 15) continue; // keep player's lot clear
      this._house(lot.x, lot.z, lot.face, i++);
    }
    // Small front yard + driveway + fence for the player's own house
    this._playerYard(M);
  }

  _faceRot(face) {
    return { N: 0, S: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[face] ?? 0;
  }

  // Wall colliders for an enterable house (model-local, Y-up, door faces -Z, floor
  // at y=0). Front wall is split around the door gap and topped by a lintel, so the
  // doorway (|x|<DW/2, below DH) is left open to walk through. Everything is rotated
  // by the house yaw and offset to the lot. MUST match build_houses.py dimensions.
  _addHouseColliders(x, z, yaw) {
    const OW = 8, OD = 7, H = 3, T = 0.22, DW = 1.6, DH = 2.25, LIFT = 0.12;
    // Interior floor collider so the player stands ON the wooden floor (which sits a
    // little above the grass so it doesn't z-fight the terrain), not on the terrain.
    const floor = new CANNON.Body({ mass: 0 });
    floor.addShape(new CANNON.Box(new CANNON.Vec3(OW / 2, LIFT / 2 + 0.03, OD / 2)));
    floor.position.set(x, LIFT / 2, z);
    floor.collisionFilterGroup = 8; floor.collisionFilterMask = 1;
    this.game.physicsWorld.addBody(floor); this._bodies.push(floor);
    const fx = (OW / 2 - DW / 2) / 2;    // front-segment half width
    const fcx = (OW / 2 + DW / 2) / 2;   // front-segment centre |x|
    const walls = [
      [0, H / 2, OD / 2 - T / 2, OW / 2, H / 2, T / 2],              // back (+Z)
      [-OW / 2 + T / 2, H / 2, 0, T / 2, H / 2, OD / 2],             // left (-X)
      [OW / 2 - T / 2, H / 2, 0, T / 2, H / 2, OD / 2],              // right (+X)
      [-fcx, H / 2, -OD / 2 + T / 2, fx, H / 2, T / 2],              // front-left
      [fcx, H / 2, -OD / 2 + T / 2, fx, H / 2, T / 2],               // front-right
      [0, (DH + H) / 2, -OD / 2 + T / 2, DW / 2, (H - DH) / 2, T / 2], // lintel over door
    ];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const q = new CANNON.Quaternion().setFromEuler(0, yaw, 0);
    for (const [cx, cy, cz, hx, hy, hz] of walls) {
      const wx = x + cx * c + cz * s;    // three.js Ry(yaw) on the local (x,z)
      const wz = z - cx * s + cz * c;
      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
      body.position.set(wx, cy + LIFT, wz);
      body.quaternion.copy(q);
      body.collisionFilterGroup = 8;
      body.collisionFilterMask = 1;
      this.game.physicsWorld.addBody(body);
      this._bodies.push(body);
    }
  }

  _house(x, z, face, seed) {
    // Enterable Blender house: a hollow shell you can walk into, with per-wall
    // collision leaving the doorway open. Falls back to the procedural house below.
    const reg = this.game.enterableHouseLoader;
    if (reg?.ready) {
      if (!this._hKeys) this._hKeys = ['house-a', 'house-b', 'house-c', 'house-d'];
      const model = reg.createModel(this._hKeys[(Math.random() * this._hKeys.length) | 0]);
      if (model) {
        // Model door faces -Z; +PI rotates it to point the cardinal `face` direction.
        const yaw = this._faceRot(face) + Math.PI;
        const g = new THREE.Group();
        g.add(model);
        g.position.set(x, 0.12, z);   // lift so the wood floor sits above the grass
        g.rotation.y = yaw;
        g.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          // Render both sides so the floor/walls are solid when viewed from inside.
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            m.side = THREE.DoubleSide;
            // Enclosed interiors are lit mostly by the image-based environment, which
            // blows them out to white; damp the IBL so rooms read at a normal level.
            m.envMapIntensity = 0.35;
            // The interior wood floor sits just above the grass; the scene's far plane
            // makes that thin gap z-fight, so bias the floor toward the camera so it
            // always wins over the terrain underneath.
            if (o.name === 'floor') { m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; }
          }
        });
        this.game.scene.addObject(g);
        this._objects.push(g);
        this._addHouseColliders(x, z, yaw);
        return;
      }
    }

    const M = this._mats();
    const rand = (a, b) => a + Math.random() * (b - a);
    const W = rand(8.5, 11.5), D = rand(8, 11), H = rand(3.2, 4.2);
    const siding = M.siding[Math.floor(Math.random() * M.siding.length)];
    const roofMat = M.roof[Math.floor(Math.random() * M.roof.length)];

    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = this._faceRot(face);

    const mk = (w, h, d, mat, px, py, pz, cast = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(px, py, pz); m.castShadow = cast; m.receiveShadow = true;
      g.add(m); return m;
    };

    // Foundation + walls (front faces +z local)
    mk(W + 0.4, 0.4, D + 0.4, M.foundation, 0, 0.2, 0);
    mk(W, H, D, siding, 0, 0.4 + H / 2, 0);

    // Hip roof (4-sided pyramid) with a small overhang
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.72, H * 0.7, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 0.4 + H + H * 0.35 - 0.05, 0);
    roof.castShadow = true; roof.receiveShadow = true;
    g.add(roof);

    // Front door + small porch (on +z face)
    mk(1.1, 2.2, 0.18, M.door[Math.floor(Math.random() * M.door.length)], 0, 0.4 + 1.1, D / 2 + 0.02);
    const porch = mk(3.2, 0.15, 1.6, M.concrete, 0, 0.42, D / 2 + 0.8);
    for (const s of [-1, 1]) mk(0.16, 2.1, 0.16, M.trim, s * 1.4, 0.42 + 1.05, D / 2 + 1.5);
    mk(3.4, 0.18, 1.9, roofMat, 0, 0.42 + 2.2, D / 2 + 0.85); // porch roof

    // Windows with frames + glass on front and both sides
    const addWindow = (px, py, pz, faceAxis) => {
      const fw = 1.3, fh = 1.2;
      const frame = faceAxis === 'z'
        ? mk(fw + 0.16, fh + 0.16, 0.1, M.trim, px, py, pz)
        : mk(0.1, fh + 0.16, fw + 0.16, M.trim, px, py, pz);
      const glass = faceAxis === 'z'
        ? mk(fw, fh, 0.06, M.glass, px, py, pz + (pz > 0 ? 0.04 : -0.04), false)
        : mk(0.06, fh, fw, M.glass, px + (px > 0 ? 0.04 : -0.04), py, pz, false);
    };
    const wy = 0.4 + H * 0.6;
    addWindow(-W / 4, wy, D / 2 + 0.03, 'z');
    addWindow(W / 4, wy, D / 2 + 0.03, 'z');
    for (const s of [-1, 1]) { addWindow(s * (W / 2 + 0.03), wy, -D / 5, 'x'); addWindow(s * (W / 2 + 0.03), wy, D / 5, 'x'); }
    addWindow(-W / 4, wy, -D / 2 - 0.03, 'z'); // back

    // Chimney
    mk(0.7, 1.6, 0.7, M.foundation, W / 3, 0.4 + H + 0.6, -D / 4);

    g.userData.noHit = false;
    this.game.scene.addObject(g);
    this._objects.push(g);

    // Collision: 4 static wall boxes (player only) — reuses BuildingGenerator's approach
    const rot = this._faceRot(face);
    const q = new CANNON.Quaternion().setFromEuler(0, rot, 0);
    const body = new CANNON.Body({ mass: 0 });
    const w = W / 2, d = D / 2, h = (H + 0.4) / 2, t = 0.25;
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, h, t)), new CANNON.Vec3(0, 0, -d));
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, h, t)), new CANNON.Vec3(0, 0, d));
    body.addShape(new CANNON.Box(new CANNON.Vec3(t, h, d)), new CANNON.Vec3(-w, 0, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(t, h, d)), new CANNON.Vec3(w, 0, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(w, t, d)), new CANNON.Vec3(0, h, 0));
    body.position.set(x, h, z);
    body.quaternion.copy(q);
    body.collisionFilterGroup = 8;
    body.collisionFilterMask = 1;
    this.game.physicsWorld.addBody(body);
    this._bodies.push(body);
  }

  _playerYard(M) {
    // Concrete walkway from the front door (z≈10) to Main St sidewalk (z≈16)
    const path = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 6.5), M.concrete);
    path.position.set(0, 0.06, 13.3); path.receiveShadow = true; path.userData.noHit = true;
    this.game.scene.addObject(path); this._objects.push(path);
    // Driveway to the side
    const drive = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 7), M.asphalt);
    drive.position.set(9, 0.05, 14); drive.receiveShadow = true; drive.userData.noHit = true;
    this.game.scene.addObject(drive); this._objects.push(drive);
  }

  // ─── Street props ───────────────────────────────────────────────────────────
  _buildProps(M) {
    // Streetlights along Main St + Second St (a few real point lights, rest emissive)
    let lit = 0;
    for (const r of this.roads) {
      if (r.type !== 'ew') continue;
      for (let x = r.x0 + 6; x < r.x1; x += 18) {
        for (const s of [-1, 1]) {
          const lz = r.z + s * (r.w / 2 + 2.2);
          this._streetlight(x, lz, lit++ % 3 === 0); // every 3rd casts a real light
        }
      }
    }
    // Trees along sidewalks
    const tg = this.game.treeGenerator;
    if (tg?.createTree) {
      for (const r of this.roads) {
        if (r.type !== 'ew') continue;
        for (let x = r.x0 + 12; x < r.x1; x += 20) {
          for (const s of [-1, 1]) {
            const tz = r.z + s * (r.w / 2 + 3.2);
            if (this._onRoad(x, tz, 1)) continue;
            const tree = tg.createTree(x + (Math.random() - 0.5) * 2, tz, 0, 'plains');
            if (tree) { this._objects.push(tree); }
          }
        }
      }
    }
    // Parked cars along the curbs
    const carSpots = [[-24, 16.5, 0], [12, 16.5, 0], [-38, 44, Math.PI], [24, 51.5, 0], [-30, 44, Math.PI], [40, 24, Math.PI / 2]];
    for (const [cx, cz, rot] of carSpots) if (!this._onRoad(cx, cz, 0)) this._car(cx, cz, rot, M);
    // Hydrants, trash cans, mailboxes, hedges at intervals
    for (let x = -40; x <= 40; x += 13) {
      this._mailbox(x + 3, 16.2, M);
      if (Math.abs(x) % 26 < 2) this._hydrant(x, 16.4, M);
      this._trashcan(x - 4, 24.4, M);
    }
  }

  _streetlight(x, z, realLight) {
    const M = this._mats();
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 10), M.lamppost);
    pole.position.y = 2.6; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), M.lamppost);
    arm.rotation.z = Math.PI / 2; arm.position.set(0.55, 5.1, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), M.lamphead);
    head.position.set(1.1, 5.0, 0); g.add(head);
    this.game.scene.addObject(g); this._objects.push(g);
    if (realLight) {
      const pl = new THREE.PointLight(0xffe6a8, 0.55, 14, 2);
      pl.position.set(x + 1.1, 5.0, z);
      this.game.scene.addObject(pl); this._objects.push(pl); this._lights.push(pl);
    }
  }

  _car(x, z, rot, M) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const body = M.carbody[Math.floor(Math.random() * M.carbody.length)];
    const lower = this._box(4.2, 0.7, 1.9, body, 0, 0.75, 0); lower.castShadow = true; g.add(lower);
    const cabin = this._box(2.3, 0.7, 1.75, body, -0.1, 1.35, 0); cabin.castShadow = true; g.add(cabin);
    const glass = this._box(2.0, 0.55, 1.65, M.carglass, -0.1, 1.4, 0); g.add(glass);
    for (const sx of [-1.3, 1.3]) for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), M.tire);
      wheel.rotation.x = Math.PI / 2; wheel.position.set(sx, 0.4, sz * 0.95); wheel.castShadow = true; g.add(wheel);
    }
    this.game.scene.addObject(g); this._objects.push(g);
    // Simple collision box
    const b = new CANNON.Body({ mass: 0 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(2.1, 0.8, 0.95)));
    b.position.set(x, 0.8, z); b.quaternion.setFromEuler(0, rot, 0);
    b.collisionFilterGroup = 8; b.collisionFilterMask = 1;
    this.game.physicsWorld.addBody(b); this._bodies.push(b);
  }

  _mailbox(x, z, M) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), M.door[0]); post.position.y = 0.55; g.add(post);
    const box = this._box(0.28, 0.24, 0.42, M.metal, 0, 1.15, 0); g.add(box);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.game.scene.addObject(g); this._objects.push(g);
  }

  _hydrant(x, z, M) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0xa02020, roughness: 0.6, metalness: 0.3 }));
    body.position.y = 0.35; g.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), body.material); cap.position.y = 0.72; g.add(cap);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.game.scene.addObject(g); this._objects.push(g);
  }

  _trashcan(x, z, M) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.8, 12), M.darkmetal);
    can.position.set(x, 0.4, z); can.castShadow = true; can.receiveShadow = true;
    this.game.scene.addObject(can); this._objects.push(can);
  }

  // ─── Factory (down Factory Rd, north end of the block) ──────────────────────
  _buildFactory(M) {
    const FX = 0, FZ = 88;                 // factory centre, straight down the spur
    const g = new THREE.Group();
    g.position.set(FX, 0, FZ);

    const wallM = new THREE.MeshStandardMaterial({ color: 0x8b9196, roughness: 0.82, metalness: 0.3 });
    const rust  = new THREE.MeshStandardMaterial({ color: 0x6e4a33, roughness: 0.96, metalness: 0.15 });
    const roofM = new THREE.MeshStandardMaterial({ color: 0x394046, roughness: 0.85, metalness: 0.35 });
    const glowM = new THREE.MeshStandardMaterial({ color: 0xff7733, emissive: 0xdd5522, emissiveIntensity: 0.8, roughness: 0.6 });
    const skyM  = new THREE.MeshStandardMaterial({ color: 0x2b333a, roughness: 0.3, metalness: 0.4 });  // dark skylight glass

    const W = 34, H = 10, D = 22;
    const mk = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };

    // Main hall
    mk(W, H, D, wallM, 0, H / 2, 0);
    // Rusted lower band (weathering)
    mk(W + 0.05, 2.4, D + 0.05, rust, 0, 1.2, 0);
    // Sawtooth roof: four angled skylight ridges
    for (let i = 0; i < 4; i++) {
      const zc = -D / 2 + 2.8 + i * 5.2;
      mk(W, 0.35, 5.0, roofM, 0, H + 0.15, zc);
      const sky = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 1.6, 0.3), skyM);
      sky.position.set(0, H + 0.9, zc - 2.2); sky.rotation.x = -0.7; g.add(sky);
    }

    // Loading dock: three roll-up doors on the front (−z, facing the road)
    for (let i = -1; i <= 1; i++) {
      mk(4.2, 4.4, 0.3, M.darkmetal, i * 6.0, 2.4, -D / 2 - 0.16);
      // ribbed door lines
      for (let r = 0; r < 5; r++) mk(4.0, 0.06, 0.34, roofM, i * 6.0, 0.8 + r * 0.85, -D / 2 - 0.2);
    }
    // Concrete loading ramp
    const ramp = mk(W - 4, 0.5, 4, M.concrete, 0, 0.25, -D / 2 - 2.4);
    ramp.userData.noHit = true;

    // Two smokestacks with warning bands + glowing tips
    for (const sx of [-11, 11]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 12, 14), rust);
      stack.position.set(sx, H + 6, 6); stack.castShadow = true; g.add(stack);
      for (let bcol = 0; bcol < 2; bcol++) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.8, 14), M.darkmetal);
        band.position.set(sx, H + 9 + bcol * 2, 6); g.add(band);
      }
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.9, 0.6, 14), glowM);
      tip.position.set(sx, H + 12.2, 6); g.add(tip);
      const pl = new THREE.PointLight(0xff6622, 0.6, 20, 2);
      pl.position.set(sx, H + 12.2, 6); g.add(pl); this._lights.push(pl);
    }

    // Rooftop vents / HVAC blocks
    for (const [vx, vz] of [[-8, 8], [8, 8], [0, 9]]) mk(2.2, 1.2, 2.2, M.darkmetal, vx, H + 0.7, vz);

    // Big rooftop sign board with real lit lettering
    mk(16, 2.6, 0.3, M.darkmetal, 0, H + 2.2, -D / 2 + 0.4);
    const signTex = this._signTexture('AXIOM STEELWORKS');
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.9,
      transparent: true, roughness: 0.6,
    });
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.2), signMat);
    signFace.position.set(0, H + 2.2, -D / 2 + 0.24);
    signFace.rotation.y = Math.PI;         // face the road (−z)
    signFace.userData.noHit = true; g.add(signFace);

    // Perimeter chain-link-ish fence posts along the front
    for (let px = -W / 2; px <= W / 2; px += 3) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), M.lamppost);
      post.position.set(px, 1, -D / 2 - 5); g.add(post);
    }

    g.traverse(o => { if (o.isMesh && o.userData.noHit === undefined) o.userData.noHit = false; });
    this.game.scene.addObject(g); this._objects.push(g);

    // Solid collision box for the hall (players/zombies can't walk through it)
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(W / 2, H / 2, D / 2)));
    body.position.set(FX, H / 2, FZ);
    body.collisionFilterGroup = 8; body.collisionFilterMask = 1;
    this.game.physicsWorld.addBody(body); this._bodies.push(body);
  }

  // Invisible fallback floor at y=0 across the flat zone. The terrain heightfield is
  // built per-chunk and a chunk may not be generated where a corpse spawns, so
  // dynamic props (ragdolls) could fall into the void. This static box guarantees a
  // surface to rest on; it coincides with the flat (y=0) terrain, so it's invisible
  // and harmless to the player.
  _buildGroundFloor() {
    const b = new CANNON.Body({ mass: 0 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(62, 1, 68)));
    b.position.set(0, -1, 40);   // top face at y=0
    this.game.physicsWorld.addBody(b); this._bodies.push(b);
  }

  // Canvas texture for the factory sign lettering.
  _signTexture(text) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 160;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#12161a';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '900 104px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb347';
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 26;
    ctx.fillText(text, c.width / 2, c.height / 2 + 4);
    // a couple of dead/flickered letters for grime
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(20,22,26,0.55)';
    ctx.fillRect(c.width * 0.62, 30, 46, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ─── Broken / wrecked cars ──────────────────────────────────────────────────
  _wreck(x, z, rot, M) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const burnt = new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.95, metalness: 0.4 });
    const rust  = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.98, metalness: 0.2 });
    const bodyMat = Math.random() < 0.5 ? burnt : rust;
    // crushed/dented body
    const lower = this._box(4.2, 0.6, 1.9, bodyMat, 0, 0.6, 0); lower.castShadow = true; g.add(lower);
    const cabin = this._box(2.1, 0.55, 1.7, bodyMat, -0.2, 1.1, 0);
    cabin.rotation.z = (Math.random() - 0.5) * 0.14;              // caved-in roof
    cabin.castShadow = true; g.add(cabin);
    // shattered windshield (dark)
    g.add(this._box(1.9, 0.4, 1.55, M.carglass, -0.2, 1.15, 0));
    // hood popped open
    const hood = this._box(1.4, 0.06, 1.7, bodyMat, 1.6, 1.0, 0);
    hood.rotation.z = -0.6; g.add(hood);
    // some wheels missing / flat — only place two, sunk low
    const wheels = [[-1.3, 0.85], [1.3, -0.9]];
    for (const [wx, wz] of wheels) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12), M.tire);
      wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.34, wz); g.add(wheel);
    }
    // scorch/oil pool under it
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, transparent: true, opacity: 0.65 }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; pool.userData.noHit = true; g.add(pool);

    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    this.game.scene.addObject(g); this._objects.push(g);

    const b = new CANNON.Body({ mass: 0 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(2.1, 0.7, 0.95)));
    b.position.set(x, 0.7, z); b.quaternion.setFromEuler(0, rot, 0);
    b.collisionFilterGroup = 8; b.collisionFilterMask = 1;
    this.game.physicsWorld.addBody(b); this._bodies.push(b);
  }

  _buildWrecks(M) {
    const spots = [
      [-16, 22.5, 0.5], [22, 45.5, -0.3], [8, 74, 1.6],
      [-8, 70, 0.2], [30, 22, Math.PI / 2 + 0.2], [-30, 47, -0.4],
    ];
    for (const [x, z, rot] of spots) if (!this._onRoad(x, z, 0)) this._wreck(x, z, rot, M);
    // A couple actually ON the road, abandoned at angles (traffic jam feel)
    this._wreck(-2, 20, 0.35, M);
    this._wreck(3.5, 48.5, -0.5, M);
  }

  // ─── Street debris / grime for a lived-in, post-outbreak look ────────────────
  _buildStreetDebris(M) {
    const rand = (a, b) => a + Math.random() * (b - a);
    const trashMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 });
    const boxMat   = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xcac4b4, roughness: 1 });

    // Scatter small debris across the streets and yards
    const debrisSpots = 46;
    for (let i = 0; i < debrisSpots; i++) {
      const x = rand(-50, 50), z = rand(10, 80);
      const kind = Math.floor(Math.random() * 4);
      let m;
      if (kind === 0) { // trash bag
        m = new THREE.Mesh(new THREE.SphereGeometry(rand(0.22, 0.36), 8, 6), trashMat);
        m.scale.y = 0.8; m.position.set(x, 0.2, z);
      } else if (kind === 1) { // cardboard box
        const s = rand(0.3, 0.55);
        m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s), boxMat);
        m.position.set(x, s * 0.35, z); m.rotation.y = rand(0, Math.PI);
      } else if (kind === 2) { // flattened newspaper / paper
        m = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.3, 0.5), rand(0.3, 0.5)), paperMat);
        m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, Math.PI); m.position.set(x, 0.05, z);
        m.userData.noHit = true;
      } else { // crack/oil stain decal
        m = new THREE.Mesh(new THREE.CircleGeometry(rand(0.3, 0.8), 10),
          new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 1, transparent: true, opacity: 0.5 }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.userData.noHit = true;
      }
      m.castShadow = m.userData.noHit ? false : true; m.receiveShadow = true;
      this.game.scene.addObject(m); this._objects.push(m);
    }

    // A green dumpster by the factory + a couple tire piles
    const dumpMat = new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: 0.8, metalness: 0.3 });
    const dump = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1.3), dumpMat);
    dump.position.set(-12, 0.7, 78); dump.castShadow = true; dump.receiveShadow = true;
    this.game.scene.addObject(dump); this._objects.push(dump);
    const db = new CANNON.Body({ mass: 0 });
    db.addShape(new CANNON.Box(new CANNON.Vec3(1.2, 0.7, 0.65)));
    db.position.set(-12, 0.7, 78); db.collisionFilterGroup = 8; db.collisionFilterMask = 1;
    this.game.physicsWorld.addBody(db); this._bodies.push(db);

    for (const [tx, tz] of [[13, 76], [-14, 24]]) {
      for (let k = 0; k < 4; k++) {
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 8, 14), M.tire);
        tire.rotation.x = Math.PI / 2; tire.position.set(tx + rand(-0.2, 0.2), 0.16 + k * 0.22, tz + rand(-0.2, 0.2));
        tire.castShadow = true; this.game.scene.addObject(tire); this._objects.push(tire);
      }
    }
  }

  // ─── Dead bodies (physics-driven, pushable) ─────────────────────────────────
  _spawnCorpses() {
    const pp = this.game.physicsProps;
    if (!pp) return;
    const spots = [
      [-6, 24], [10, 46], [4, 70], [26, 44], [-24, 22], [-11, 79],
    ];
    for (const [x, z] of spots) {
      try { pp.addCorpse(x, z); } catch (e) { /* silent */ }
    }
  }

  // ─── Cleanup (on restart) ───────────────────────────────────────────────────
  dispose() {
    // Dispose geometry, and any per-instance (non-shared-palette) materials.
    const shared = new Set(Object.values(this._m ?? {}).flat());
    for (const o of this._objects) {
      this.game.scene.removeObject(o);
      o.traverse?.(c => {
        if (!c.isMesh) return;
        c.geometry?.dispose?.();
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const m of mats) if (m && !shared.has(m)) m.dispose?.();
      });
    }
    for (const b of this._bodies) this.game.physicsWorld.removeBody(b);
    this._objects = []; this._bodies = []; this._lights = [];
    this._built = false;
  }
}
