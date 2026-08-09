import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ─── Layout constants ──────────────────────────────────────────────────────────
const FLOOR_Y = 0.5;   // top of floor surface
const WALL_H  = 3.2;   // floor-to-ceiling height
const WALL_T  = 0.22;  // wall thickness
const DOOR_W  = 1.1;   // door opening width
const DOOR_H  = 2.15;  // door opening height
const CEIL_T  = 0.2;   // ceiling thickness

// House footprint: x: -14 to +14, z: -10 to +10
// Room boundaries:
//   Living Room:    x:-14 to +6,  z:  0 to +10
//   Kitchen:        x: +6 to +14, z:  0 to +10
//   Master Bedroom: x:-14 to -2,  z:-10 to  0
//   Bedroom 2:      x: -2 to +6,  z:-10 to  0
//   Bathroom:       x: +6 to +14, z:-10 to  0

// Legacy room size constants (used by old load* methods)
const W  = 10;
const D  = 16;
const H  = 4;
const T  = 0.3;
const FH = FLOOR_Y;

export class FriendsHouse {
  constructor(game) {
    this.game        = game;
    this.scene       = game.scene.scene;
    this.physicsWorld = game.physicsWorld;
    this.objects     = [];
    this.physBodies  = [];
    this.doors       = [];          // walk-through door pivots (new system)
    this.currentRoom = 'attic';     // kept for backward compat

    // Legacy animation state (old room-teleport system)
    this._doorAnim = null;
    this._walkAnim = null;
  }

  // ─── Material helpers ────────────────────────────────────────────────────────

  mat(color, roughness = 0.85, metalness = 0.05, map = null) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
  }

  // Generate a canvas-based procedural texture
  _makeProcTex(type, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (type === 'plaster') {
      ctx.fillStyle = '#d0c9be';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 4000; i++) {
        const alpha = (Math.random() - 0.5) * 0.09;
        ctx.fillStyle = alpha > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${-alpha})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random(), 1 + Math.random());
      }
      // Subtle horizontal paint streaks
      for (let i = 0; i < 20; i++) {
        const y = Math.random() * size;
        ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`;
        ctx.fillRect(0, y, size, 0.5 + Math.random() * 1.5);
      }
    } else if (type === 'wood') {
      ctx.fillStyle = '#8b7050';
      ctx.fillRect(0, 0, size, size);
      // Plank dividers every 32px
      for (let p = 0; p < size; p += 32) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, p, size, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, p + 2, size, 1);
      }
      // Wood grain lines
      for (let i = 0; i < 40; i++) {
        const y = Math.random() * size;
        ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.07})`;
        ctx.fillRect(0, y, size, 0.5 + Math.random() * 1.5);
      }
      // Random lighter grain
      for (let i = 0; i < 20; i++) {
        const y = Math.random() * size;
        ctx.fillStyle = `rgba(255,210,140,${0.03 + Math.random() * 0.05})`;
        ctx.fillRect(0, y, size, 0.5 + Math.random());
      }
    } else if (type === 'tile') {
      ctx.fillStyle = '#e0ddd8';
      ctx.fillRect(0, 0, size, size);
      const ts = 40;
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= size; x += ts) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      }
      for (let y = 0; y <= size; y += ts) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
      // Subtle grout shadow
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let x = 3; x <= size; x += ts) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      }
      for (let y = 3; y <= size; y += ts) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
    } else if (type === 'brick') {
      ctx.fillStyle = '#c8a07a';
      ctx.fillRect(0, 0, size, size);
      const bw = 48, bh = 24;
      for (let row = 0; row < size / bh; row++) {
        const offset = (row % 2) * bw * 0.5;
        for (let col = -1; col < size / bw + 1; col++) {
          const bx = col * bw + offset;
          const by = row * bh;
          const shade = 0.85 + Math.random() * 0.3;
          const r = Math.round(180 * shade), g = Math.round(130 * shade), b = Math.round(90 * shade);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (!this._procTextures) this._procTextures = [];
    this._procTextures.push(tex);
    return tex;
  }

  // ─── Scene helpers ───────────────────────────────────────────────────────────

  add(mesh) {
    this.scene.add(mesh);
    this.objects.push(mesh);
    return mesh;
  }

  addLight(light) {
    this.scene.add(light);
    this.objects.push(light);
  }

  box(w, h, d, color, rough = 0.85, metal = 0.05) {
    const g    = new THREE.BoxGeometry(w, h, d);
    const m    = this.mat(color, rough, metal);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ─── Physics helpers ─────────────────────────────────────────────────────────

  phys(w, h, d, x, y, z, mass = 0) {
    const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
    const body  = new CANNON.Body({ mass });
    body.addShape(shape);
    body.position.set(x, y, z);
    this.physicsWorld.addBody(body);
    this.physBodies.push(body);
    return body;
  }

  placeBox(w, h, d, x, y, z, color, rough = 0.85, metal = 0.05) {
    const mesh = this.box(w, h, d, color, rough, metal);
    mesh.position.set(x, y, z);
    this.add(mesh);
    this.phys(w, h, d, x, y, z);
    return mesh;
  }

  // ─── Wall builders ───────────────────────────────────────────────────────────

  /**
   * Build a wall that runs along the X axis (constant z), spanning xMin→xMax.
   * doors: [{ center: <x>, width: <w> }]  – each door cuts an opening in the wall.
   */
  buildXWall(z, xMin, xMax, color, doors = []) {
    const wallY    = FLOOR_Y + WALL_H / 2;
    const totalLen = xMax - xMin;

    // Sort door openings left-to-right
    const sorted = [...doors].sort((a, b) => a.center - b.center);

    // Build segments between / around openings
    let cursor = xMin;
    for (const door of sorted) {
      const openL = door.center - door.width / 2;
      const openR = door.center + door.width / 2;

      if (openL > cursor) {
        const segLen = openL - cursor;
        const segX   = cursor + segLen / 2;
        this._wallSeg(segX, wallY, z, segLen, WALL_H, WALL_T, color, 'x');
      }
      // Lintel above door
      const lintelH = WALL_H - DOOR_H;
      if (lintelH > 0.01) {
        this._wallSeg(
          door.center,
          FLOOR_Y + DOOR_H + lintelH / 2,
          z,
          door.width,
          lintelH,
          WALL_T,
          color,
          'x'
        );
      }
      cursor = openR;
    }

    // Remaining segment after last door
    if (cursor < xMax) {
      const segLen = xMax - cursor;
      const segX   = cursor + segLen / 2;
      this._wallSeg(segX, wallY, z, segLen, WALL_H, WALL_T, color, 'x');
    }
  }

  /**
   * Build a wall that runs along the Z axis (constant x), spanning zMin→zMax.
   * doors: [{ center: <z>, width: <w> }]
   */
  buildZWall(x, zMin, zMax, color, doors = []) {
    const wallY  = FLOOR_Y + WALL_H / 2;

    const sorted = [...doors].sort((a, b) => a.center - b.center);

    let cursor = zMin;
    for (const door of sorted) {
      const openL = door.center - door.width / 2;
      const openR = door.center + door.width / 2;

      if (openL > cursor) {
        const segLen = openL - cursor;
        const segZ   = cursor + segLen / 2;
        this._wallSeg(x, wallY, segZ, WALL_T, WALL_H, segLen, color, 'z');
      }
      const lintelH = WALL_H - DOOR_H;
      if (lintelH > 0.01) {
        this._wallSeg(
          x,
          FLOOR_Y + DOOR_H + lintelH / 2,
          door.center,
          WALL_T,
          lintelH,
          door.width,
          color,
          'z'
        );
      }
      cursor = openR;
    }

    if (cursor < zMax) {
      const segLen = zMax - cursor;
      const segZ   = cursor + segLen / 2;
      this._wallSeg(x, wallY, segZ, WALL_T, WALL_H, segLen, color, 'z');
    }
  }

  _wallSeg(x, y, z, w, h, d, color, axis) {
    const isExt = (color === 0xd4b896);
    const srcTex = isExt ? this._extWallTex : this._wallTex;
    let mesh;
    if (srcTex) {
      const len = axis === 'x' ? w : d;
      const texCopy = srcTex.clone();
      texCopy.needsUpdate = true;
      texCopy.repeat.set(Math.max(0.5, len / 2.4), Math.max(0.5, h / 3.0));
      const mat = new THREE.MeshStandardMaterial({
        map: texCopy,
        roughness: isExt ? 0.88 : 0.82,
        metalness: isExt ? 0.02 : 0.0,
        color: isExt ? 0xffffff : 0xe8e2d8
      });
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    } else {
      mesh = this.box(w, h, d, color);
    }
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    this.add(mesh);
    this.phys(w, h, d, x, y, z);
  }

  // ─── Window helper ───────────────────────────────────────────────────────────

  /**
   * Add a visual-only window opening. No physics body.
   * axis: 'x' (window faces along X, embedded in z-const wall)
   *       'z' (window faces along Z, embedded in x-const wall)
   */
  addWindow(constCoord, otherCoord, axis, winY = null) {
    const WW = 1.2;
    const WH = 0.9;
    if (winY === null) winY = FLOOR_Y + WALL_H * 0.55;

    const frameColor = 0x2a2a2a;
    const frameMesh  = this.box(
      axis === 'x' ? WW + 0.1 : WALL_T + 0.05,
      WH + 0.1,
      axis === 'x' ? WALL_T + 0.05 : WW + 0.1,
      frameColor, 0.6, 0.1
    );
    if (axis === 'x') {
      frameMesh.position.set(otherCoord, winY, constCoord);
    } else {
      frameMesh.position.set(constCoord, winY, otherCoord);
    }
    this.add(frameMesh);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aabb, transparent: true, opacity: 0.3,
      roughness: 0.1, metalness: 0.3
    });
    const glassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        axis === 'x' ? WW : 0.05,
        WH,
        axis === 'x' ? 0.05 : WW
      ),
      glassMat
    );
    if (axis === 'x') {
      glassMesh.position.set(otherCoord, winY, constCoord);
    } else {
      glassMesh.position.set(constCoord, winY, otherCoord);
    }
    this.add(glassMesh);
  }

  // ─── Door system ─────────────────────────────────────────────────────────────

  /**
   * Add an animated walk-through door.
   * wallAxis: 'x' = wall runs along X (z = const), 'z' = wall runs along Z (x = const)
   * wallConst: the constant coordinate of the wall
   * doorCenter: center on the other axis
   * swingDir: +1 or -1 (direction panel swings open)
   */
  addDoor(id, wallAxis, wallConst, doorCenter, swingDir) {
    const pivot = new THREE.Group();
    pivot.userData = {
      isDoor:       true,
      id,
      wallAxis,
      wallConst,
      doorCenter,
      swingDir,
      isOpen:       false,
      currentAngle: 0,
      targetAngle:  Math.PI * 0.8 * swingDir,
    };

    // Door panel
    const panel = this.box(DOOR_W, DOOR_H, 0.05, 0x5c3d1e, 0.75, 0.05);
    panel.castShadow    = true;
    panel.receiveShadow = true;

    // Handle
    const handleMat  = this.mat(0xc8a000, 0.3, 0.8);
    const handle     = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), handleMat);

    if (wallAxis === 'x') {
      // Wall runs along X (constant z). Panel lies in XY plane. Pivot at hinge edge.
      // Hinge is at x = doorCenter - DOOR_W/2, y = FLOOR_Y, z = wallConst
      pivot.position.set(doorCenter - DOOR_W / 2, FLOOR_Y, wallConst);
      // Panel: its left edge at x=0, center at x=DOOR_W/2
      panel.position.set(DOOR_W / 2, DOOR_H / 2, 0);
      // Handle on opening side face
      handle.position.set(DOOR_W - 0.12, DOOR_H / 2 - 0.1, 0.08);
    } else {
      // Wall runs along Z (constant x). Panel lies in ZY plane. Pivot at hinge edge.
      // Hinge is at x = wallConst, y = FLOOR_Y, z = doorCenter - DOOR_W/2
      pivot.position.set(wallConst, FLOOR_Y, doorCenter - DOOR_W / 2);
      // Rotate panel so its width spans Z instead of X
      panel.rotation.y = Math.PI / 2;
      // Panel: its near edge at z=0, center at z=DOOR_W/2
      panel.position.set(0, DOOR_H / 2, DOOR_W / 2);
      handle.position.set(0.08, DOOR_H / 2 - 0.1, DOOR_W - 0.12);
    }

    pivot.add(panel);
    pivot.add(handle);

    // Door frame (static, not part of pivot)
    this._addDoorFrame(wallAxis, wallConst, doorCenter);

    this.scene.add(pivot);
    this.objects.push(pivot);
    this.doors.push(pivot);
    return pivot;
  }

  _addDoorFrame(wallAxis, wallConst, doorCenter) {
    const frameMat   = this.mat(0x3a2510, 0.85, 0.05);
    const frameThick = 0.08;
    const frameDepth = WALL_T + 0.04;

    const makeFrame = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, y, z);
      m.castShadow    = true;
      m.receiveShadow = true;
      this.add(m);
    };

    if (wallAxis === 'x') {
      // Wall at z = wallConst
      const topY = FLOOR_Y + DOOR_H + frameThick / 2;
      makeFrame(DOOR_W + frameThick * 2, frameThick, frameDepth,
        doorCenter, topY, wallConst);
      makeFrame(frameThick, DOOR_H, frameDepth,
        doorCenter - DOOR_W / 2 - frameThick / 2, FLOOR_Y + DOOR_H / 2, wallConst);
      makeFrame(frameThick, DOOR_H, frameDepth,
        doorCenter + DOOR_W / 2 + frameThick / 2, FLOOR_Y + DOOR_H / 2, wallConst);
    } else {
      // Wall at x = wallConst
      const topY = FLOOR_Y + DOOR_H + frameThick / 2;
      makeFrame(frameDepth, frameThick, DOOR_W + frameThick * 2,
        wallConst, topY, doorCenter);
      makeFrame(frameDepth, DOOR_H, frameThick,
        wallConst, FLOOR_Y + DOOR_H / 2, doorCenter - DOOR_W / 2 - frameThick / 2);
      makeFrame(frameDepth, DOOR_H, frameThick,
        wallConst, FLOOR_Y + DOOR_H / 2, doorCenter + DOOR_W / 2 + frameThick / 2);
    }
  }

  toggleDoor(id) {
    const door = this.doors.find(d => d.userData.id === id);
    if (!door) return;
    door.userData.isOpen = !door.userData.isOpen;
  }

  getNearbyDoor(playerX, playerZ, maxDist = 2.5) {
    let best     = null;
    let bestDist = maxDist;
    for (const door of this.doors) {
      const ud  = door.userData;
      let dx, dz;
      if (ud.wallAxis === 'x') {
        dx = playerX - ud.doorCenter;
        dz = playerZ - ud.wallConst;
      } else {
        dx = playerX - ud.wallConst;
        dz = playerZ - ud.doorCenter;
      }
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best     = door;
      }
    }
    return best;
  }

  toggleNearbyDoor(playerX, playerZ) {
    const door = this.getNearbyDoor(playerX, playerZ, 2.5);
    if (door) this.toggleDoor(door.userData.id);
  }

  // ─── Build the whole connected house ─────────────────────────────────────────

  buildHouse() {
    this.clearAll();
    this.doors = [];

    // Procedural textures (created once, cloned per wall segment)
    this._wallTex    = this._makeProcTex('plaster', 256);
    this._extWallTex = this._makeProcTex('brick',   256);
    this._woodTex    = this._makeProcTex('wood',    256);
    this._tileTex    = this._makeProcTex('tile',    256);

    this._buildGround();
    this._buildFloor();
    this._buildExteriorWalls();
    this._buildInteriorWalls();
    this._buildCeilings();
    this._buildAtticBox();
    this._buildLighting();
    this._buildLivingRoomFurniture();
    this._buildKitchenFurniture();
    this._buildMasterBedroomFurniture();
    this._buildBedroom2Furniture();
    this._buildBathroomFurniture();
    this._buildLawn();
    this._buildCurtains();
    this._buildBaseboards();
  }

  _buildGround() {
    // Vast grass ground
    const gnd = this.box(300, 0.5, 300, 0x2d5a1b, 0.95, 0.0);
    gnd.position.set(0, 0.25, 0);
    this.add(gnd);
    this.phys(300, 0.5, 300, 0, 0.25, 0);
  }

  _buildFloor() {
    const floorH = FLOOR_Y;

    // Wood floor for main house area
    let floorMat;
    if (this._woodTex) {
      const woodCopy = this._woodTex.clone();
      woodCopy.needsUpdate = true;
      woodCopy.repeat.set(12, 8);
      floorMat = new THREE.MeshStandardMaterial({ map: woodCopy, roughness: 0.88, metalness: 0.0, color: 0xb09070 });
    } else {
      floorMat = this.mat(0x8b7355, 0.9, 0.0);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(28, floorH, 20), floorMat);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.position.set(0, floorH / 2, 0);
    this.add(mesh);
    this.phys(28, floorH, 20, 0, floorH / 2, 0);

    // Living room rug
    const rugMesh = this.box(8, 0.03, 6, 0x7a3a2a, 0.9, 0.0);
    rugMesh.position.set(-4, FLOOR_Y + 0.015, 5);
    this.add(rugMesh);

    // Bathroom tile floor overlay
    let tileMat;
    if (this._tileTex) {
      const tileCopy = this._tileTex.clone();
      tileCopy.needsUpdate = true;
      tileCopy.repeat.set(4, 6);
      tileMat = new THREE.MeshStandardMaterial({ map: tileCopy, roughness: 0.45, metalness: 0.12, color: 0xffffff });
    } else {
      tileMat = this.mat(0xdedede, 0.5, 0.1);
    }
    const tileMesh = new THREE.Mesh(new THREE.BoxGeometry(7.56, 0.03, 9.56), tileMat);
    tileMesh.castShadow = false;
    tileMesh.receiveShadow = true;
    tileMesh.position.set(10, FLOOR_Y + 0.015, -5);
    this.add(tileMesh);
  }

  _buildExteriorWalls() {
    const extColor  = 0xd4b896; // warm siding
    const wallY     = FLOOR_Y + WALL_H / 2;

    // South wall z=+10 (front exterior) — front door at x=0
    this.buildXWall(10, -14, 14, extColor, [{ center: 0, width: DOOR_W }]);
    // Add windows on south wall
    this.addWindow(10, -8, 'x');
    this.addWindow(10, -4, 'x');
    this.addWindow(10,  9, 'x');

    // North wall z=-10
    this.buildXWall(-10, -14, 14, extColor, []);
    this.addWindow(-10, -9, 'x');
    this.addWindow(-10,  0, 'x');
    this.addWindow(-10,  9, 'x');

    // West wall x=-14
    this.buildZWall(-14, -10, 10, extColor, []);
    this.addWindow(-14, -6, 'z');
    this.addWindow(-14,  5, 'z');

    // East wall x=+14 — back door at z=+5
    this.buildZWall(14, -10, 10, extColor, [{ center: 5, width: DOOR_W }]);
    this.addWindow(14, -6, 'z');

    // Exterior foundation trim
    const trimMat = this.mat(0x5a4530, 0.8, 0.1);
    const trimTop = new THREE.Mesh(new THREE.BoxGeometry(28.6, 0.15, 20.6), trimMat);
    trimTop.position.set(0, FLOOR_Y - 0.05, 0);
    this.add(trimTop);
  }

  _buildInteriorWalls() {
    const intColor = 0xc8bfb0; // interior wall paint

    // ── Z_PARTITION: z=0, x: -14 to +14 ──────────────────────────────────────
    // Doors: LR→MBR at x=-9, LR→BR2 at x=+1
    this.buildXWall(0, -14, 14, intColor, [
      { center: -9, width: DOOR_W },
      { center:  1, width: DOOR_W },
    ]);

    // ── LR_KIT: x=+6, z: 0 to +10 ────────────────────────────────────────────
    // Door: LR→Kitchen at z=+5
    this.buildZWall(6, 0, 10, intColor, [{ center: 5, width: DOOR_W }]);

    // ── MBR_BR2: x=-2, z: -10 to 0 ──────────────────────────────────────────
    // No internal door between MBR and BR2 (use hallway via z-partition)
    this.buildZWall(-2, -10, 0, intColor, []);

    // ── BR2_BATH: x=+6, z: -10 to 0 ─────────────────────────────────────────
    // Door: BR2→Bathroom at z=-5
    this.buildZWall(6, -10, 0, intColor, [{ center: -5, width: DOOR_W }]);

    // ── Register all doors ────────────────────────────────────────────────────
    // Front door: south wall z=+10, center x=0, swing inward (-z)
    this.addDoor('D_FRONT',    'x', 10,  0,  -1);
    // LR→MBR: z-partition z=0, center x=-9, swing into MBR (-z)
    this.addDoor('D_LR_MBR',  'x',  0, -9,  -1);
    // LR→BR2: z-partition z=0, center x=+1, swing into BR2 (-z)
    this.addDoor('D_LR_BR2',  'x',  0,  1,  -1);
    // LR→Kitchen: x-wall x=+6, center z=+5, swing into kitchen (+x)
    this.addDoor('D_LR_KIT',  'z',  6,  5,  +1);
    // BR2→Bath: x-wall x=+6, center z=-5, swing into bathroom (+x)
    this.addDoor('D_BR2_BATH','z',  6, -5,  +1);
    // Back door: east wall x=+14, center z=+5, swing out (+x)
    this.addDoor('D_BATH_EXT','z', 14,  5,  +1);
  }

  _buildCeilings() {
    const ceilColor = 0xe8e4dc;
    const ceilY     = FLOOR_Y + WALL_H + CEIL_T / 2;

    // Single ceiling slab for whole house
    const mesh = this.box(28, CEIL_T, 20, ceilColor, 0.8, 0.0);
    mesh.position.set(0, ceilY, 0);
    this.add(mesh);
    this.phys(28, CEIL_T, 20, 0, ceilY, 0);
  }

  _buildAtticBox() {
    // Non-accessible attic above ceiling — visible exterior roof
    const atticH    = 1.8;
    const roofColor = 0x3a3a3a;
    const atticY    = FLOOR_Y + WALL_H + CEIL_T + atticH / 2;

    const walls = this.mat(0xb8a888, 0.8, 0.0);
    const attic = new THREE.Mesh(new THREE.BoxGeometry(28.4, atticH, 20.4), walls);
    attic.position.set(0, atticY, 0);
    attic.castShadow    = true;
    attic.receiveShadow = true;
    this.add(attic);

    // Roof slab
    const roof = this.box(29, 0.35, 21, roofColor, 0.7, 0.2);
    roof.position.set(0, atticY + atticH / 2 + 0.175, 0);
    this.add(roof);
  }

  _buildLighting() {
    // Global ambient — soft fill
    const amb = new THREE.AmbientLight(0xfff5e8, 0.45);
    this.addLight(amb);

    // Main directional (sun through windows)
    const sun = new THREE.DirectionalLight(0xfff8e0, 0.6);
    sun.position.set(-8, 12, 14);
    sun.castShadow              = true;
    sun.shadow.mapSize.width    = 2048;
    sun.shadow.mapSize.height   = 2048;
    sun.shadow.camera.near      = 0.5;
    sun.shadow.camera.far       = 80;
    sun.shadow.camera.left      = -25;
    sun.shadow.camera.right     = 25;
    sun.shadow.camera.top       = 25;
    sun.shadow.camera.bottom    = -25;
    this.addLight(sun);

    // Soft fill from opposite side (skylight bounce)
    const sky = new THREE.DirectionalLight(0xc8d8ff, 0.18);
    sky.position.set(5, 8, -12);
    this.addLight(sky);

    // ── Per-room ceiling lights ──────────────────────────────────────────────
    const ceilFixY = FLOOR_Y + WALL_H - 0.12;
    const rooms = [
      { x: -4,  z:  5,  color: 0xfff0d8, intensity: 1.1, dist: 13 }, // Living room — warm white
      { x:  10, z:  5,  color: 0xf0f8ff, intensity: 0.9, dist: 9  }, // Kitchen — cool white
      { x: -9,  z: -5,  color: 0xffd098, intensity: 0.8, dist: 10 }, // Master bedroom — amber
      { x:   2, z: -5,  color: 0xffe8b0, intensity: 0.8, dist: 8  }, // Bedroom 2 — warm
      { x:  10, z: -5,  color: 0xe8f2ff, intensity: 0.9, dist: 7  }, // Bathroom — cool
    ];
    const fixMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xfffce8), emissiveIntensity: 1.2 });
    for (const r of rooms) {
      const pl = new THREE.PointLight(r.color, r.intensity, r.dist);
      pl.position.set(r.x, ceilFixY - 0.1, r.z);
      pl.castShadow = false;
      this.addLight(pl);
      // Ceiling fixture disc
      const fix = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 10), fixMat);
      fix.position.set(r.x, ceilFixY, r.z);
      this.add(fix);
    }
  }

  // ─── Furniture helpers ───────────────────────────────────────────────────────

  _sofa(x, z, rotY = 0) {
    // Seat base
    const seat = this.box(2.4, 0.45, 0.9, 0x4a3535, 0.9, 0.0);
    seat.position.set(x, FLOOR_Y + 0.225, z);
    seat.rotation.y = rotY;
    this.add(seat);
    this.phys(2.4, 0.45, 0.9, x, FLOOR_Y + 0.225, z);

    // Back (slightly curved top using capsule cross-section)
    const backMat = this.mat(0x3d2b2b, 0.9, 0.0);
    const backMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.18), backMat);
    backMesh.rotation.y = rotY;
    backMesh.position.set(
      x + Math.sin(rotY) * 0.42,
      FLOOR_Y + 0.73,
      z + Math.cos(rotY) * 0.42
    );
    this.add(backMesh);
    this.phys(2.4, 0.55, 0.18, backMesh.position.x, backMesh.position.y, backMesh.position.z);

    // Rounded back top cap
    const backCapMat = this.mat(0x3a2828, 0.85, 0.0);
    const backCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 10), backCapMat);
    backCap.rotation.z = rotY === 0 ? Math.PI / 2 : 0;
    backCap.rotation.y = rotY;
    backCap.position.set(
      x + Math.sin(rotY) * 0.42,
      FLOOR_Y + 1.005,
      z + Math.cos(rotY) * 0.42
    );
    this.add(backCap);

    // Arms — rounded tops
    for (const side of [-1, 1]) {
      const arm = this.box(0.18, 0.46, 0.95, 0x3d2b2b, 0.9, 0.0);
      arm.rotation.y = rotY;
      arm.position.set(x + Math.cos(rotY) * side * 1.11,
                       FLOOR_Y + 0.23, z + Math.sin(rotY) * side * 1.11);
      this.add(arm);
      // Rounded arm top
      const capMat = this.mat(0x3a2828, 0.85, 0.0);
      const armCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.95, 8), capMat);
      armCap.rotation.x = Math.PI / 2;
      armCap.rotation.y = rotY;
      armCap.position.set(x + Math.cos(rotY) * side * 1.11,
                          FLOOR_Y + 0.46, z + Math.sin(rotY) * side * 1.11);
      this.add(armCap);
    }

    // Cushions — capsule-shaped for realism
    const cushMat = this.mat(0x5a4545, 0.95, 0.0);
    for (let i = -1; i <= 1; i++) {
      const cush = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), cushMat);
      cush.rotation.z = Math.PI / 2;
      cush.rotation.y = rotY;
      cush.position.set(x + Math.cos(rotY) * i * 0.72,
                        FLOOR_Y + 0.55, z + Math.sin(rotY) * i * 0.72);
      this.add(cush);
    }

    // Sofa legs — cylinders
    const legMat = this.mat(0x2a1a0e, 0.7, 0.1);
    for (const [ds, dd] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.18, 6), legMat);
      leg.position.set(
        x + Math.cos(rotY) * ds * 1.05 - Math.sin(rotY) * dd * 0.35,
        FLOOR_Y + 0.09,
        z + Math.sin(rotY) * ds * 1.05 + Math.cos(rotY) * dd * 0.35
      );
      this.add(leg);
    }
  }

  _tv(x, z) {
    // Stand
    this.placeBox(1.5, 0.45, 0.45, x, FLOOR_Y + 0.225, z, 0x1a1a1a, 0.5, 0.4);
    // Screen housing
    this.placeBox(1.6, 0.9, 0.08, x, FLOOR_Y + 0.9, z, 0x0a0a0a, 0.3, 0.6);
    // Screen face
    const screen = this.box(1.55, 0.85, 0.02, 0x0d1820, 0.1, 0.1);
    screen.position.set(x, FLOOR_Y + 0.9, z + 0.05);
    this.add(screen);
    // TV glow
    const tvLight = new THREE.PointLight(0x4488ff, 0.25, 4);
    tvLight.position.set(x, FLOOR_Y + 0.9, z + 0.5);
    this.addLight(tvLight);
  }

  _coffeeTable(x, z) {
    // Oval-ish table top (box with rounded look via scale)
    const topMat = this.mat(0x5a4030, 0.75, 0.05);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.055, 32), topMat);
    top.scale.x = 1.0;
    top.scale.z = 0.6;
    top.position.set(x, FLOOR_Y + 0.38, z);
    this.add(top);
    this.phys(1.2, 0.055, 0.72, x, FLOOR_Y + 0.38, z);

    // Tapered cylinder legs
    const legMat = this.mat(0x3a2a1e, 0.8, 0.1);
    for (const [dx, dz] of [[-0.42, -0.22], [0.42, -0.22], [-0.42, 0.22], [0.42, 0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.35, 6), legMat);
      leg.position.set(x + dx, FLOOR_Y + 0.175, z + dz);
      leg.rotation.z = dx < 0 ? 0.08 : -0.08;
      this.add(leg);
    }
  }

  _bookshelf(x, z, rotY = 0) {
    const frame = this.box(1.0, 1.8, 0.32, 0x3a2a1e, 0.8, 0.05);
    frame.rotation.y = rotY;
    frame.position.set(x, FLOOR_Y + 0.9, z);
    this.add(frame);
    this.phys(1.0, 1.8, 0.32, x, FLOOR_Y + 0.9, z);
    // Shelves with books
    const bookColors = [0x8b2222, 0x22558b, 0x226b22, 0x8b7022, 0x4a228b];
    for (let shelf = 0; shelf < 3; shelf++) {
      let bx = x - 0.4;
      while (bx < x + 0.4) {
        const bw  = 0.06 + Math.random() * 0.06;
        const col = bookColors[Math.floor(Math.random() * bookColors.length)];
        const bk  = this.box(bw, 0.25 + Math.random() * 0.1, 0.28, col, 0.9, 0.0);
        bk.rotation.y = rotY;
        const shelfY   = FLOOR_Y + 0.35 + shelf * 0.55;
        const offsetDir = rotY === 0 ? 1 : 0;
        bk.position.set(
          rotY === 0 ? bx + bw / 2 : x,
          shelfY + 0.14,
          rotY === 0 ? z : bx + bw / 2
        );
        this.add(bk);
        bx += bw + 0.01;
      }
    }
  }

  _floorLamp(x, z) {
    const baseMat = this.mat(0x222222, 0.5, 0.7);
    const stand   = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.08, 1.5, 8), baseMat
    );
    stand.position.set(x, FLOOR_Y + 0.75, z);
    this.add(stand);

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.35, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf5e0c0, side: THREE.DoubleSide, roughness: 0.9 })
    );
    shade.rotation.x = Math.PI;
    shade.position.set(x, FLOOR_Y + 1.65, z);
    this.add(shade);

    const pl = new THREE.PointLight(0xffd080, 0.5, 5);
    pl.position.set(x, FLOOR_Y + 1.5, z);
    this.addLight(pl);
  }

  _armchair(x, z, rotY = 0) {
    // Seat cushion — capsule-ish via scaled sphere
    const seatMat = this.mat(0x6a4a3a, 0.88, 0.0);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.82), seatMat);
    seat.position.set(x, FLOOR_Y + 0.28, z);
    seat.rotation.y = rotY;
    this.add(seat);
    this.phys(0.9, 0.38, 0.82, x, FLOOR_Y + 0.28, z);

    // Seat cushion top dome
    const domeMat = this.mat(0x6e4e3e, 0.9, 0.0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 6, 0, Math.PI*2, 0, Math.PI/2), domeMat);
    dome.scale.set(1.0, 0.22, 0.9);
    dome.rotation.y = rotY;
    dome.position.set(x, FLOOR_Y + 0.455, z);
    this.add(dome);

    // Back cushion — capsule cross section
    const backMat = this.mat(0x5a3a2a, 0.9, 0.0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.5, 0.14), backMat);
    back.rotation.y = rotY;
    const bx = x - Math.sin(rotY) * 0.37;
    const bz = z - Math.cos(rotY) * 0.37;
    back.position.set(bx, FLOOR_Y + 0.64, bz);
    this.add(back);

    // Rounded back top — torus cross-section cap
    const capMat = this.mat(0x543524, 0.88, 0.0);
    const backCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.88, 8), capMat);
    backCap.rotation.z = rotY === 0 ? Math.PI / 2 : 0;
    backCap.rotation.y = rotY;
    backCap.position.set(bx, FLOOR_Y + 0.895, bz);
    this.add(backCap);

    // Arms — rounded top with cylinder cap
    for (const side of [-1, 1]) {
      const armMat = this.mat(0x5a3a2a, 0.9, 0.0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.84), armMat);
      arm.rotation.y = rotY;
      arm.position.set(
        x + Math.cos(rotY) * side * 0.42,
        FLOOR_Y + 0.38,
        z + Math.sin(rotY) * side * 0.42
      );
      this.add(arm);
      // Round arm cap
      const armCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.84, 8), capMat);
      armCap.rotation.x = Math.PI / 2;
      armCap.rotation.y = rotY;
      armCap.position.set(
        x + Math.cos(rotY) * side * 0.42,
        FLOOR_Y + 0.57,
        z + Math.sin(rotY) * side * 0.42
      );
      this.add(armCap);
    }

    // Tapered wooden legs
    const legMat = this.mat(0x2e1e0e, 0.7, 0.1);
    for (const [ds, dd] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.2, 6), legMat);
      leg.position.set(
        x + Math.cos(rotY)*ds*0.38 - Math.sin(rotY)*dd*0.33,
        FLOOR_Y + 0.1,
        z + Math.sin(rotY)*ds*0.38 + Math.cos(rotY)*dd*0.33
      );
      this.add(leg);
    }
  }

  _sideTable(x, z) {
    // Round top
    const topMat = this.mat(0x5a4030, 0.75, 0.05);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 18), topMat);
    top.position.set(x, FLOOR_Y + 0.56, z);
    this.add(top);
    this.phys(0.56, 0.04, 0.56, x, FLOOR_Y + 0.56, z);
    // Shelf ring
    const shelfMat = this.mat(0x4a3020, 0.8, 0.05);
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 18), shelfMat);
    shelf.position.set(x, FLOOR_Y + 0.28, z);
    this.add(shelf);
    // Tapered turned legs
    const legMat = this.mat(0x3a2a1e, 0.8, 0.12);
    for (const [dx, dz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.015, 0.52, 7), legMat);
      leg.position.set(x + dx, FLOOR_Y + 0.27, z + dz);
      this.add(leg);
    }
    // Connecting ring (turned wood detail)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 16), legMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, FLOOR_Y + 0.22, z);
    this.add(ring);
  }

  _painting(x, y, z, rotY, w = 0.8, h = 0.6) {
    const colors = [0x8b2222, 0x224488, 0x226622, 0x886622, 0x552277];
    const col    = colors[Math.floor(Math.random() * colors.length)];
    const frame  = this.box(w + 0.08, h + 0.08, 0.05, 0x2a1a0a, 0.9, 0.1);
    frame.rotation.y = rotY;
    frame.position.set(x, y, z);
    this.add(frame);
    const canvas_ = this.box(w, h, 0.03, col, 0.6, 0.0);
    canvas_.rotation.y = rotY;
    canvas_.position.set(
      x + Math.sin(rotY) * 0.04,
      y,
      z + Math.cos(rotY) * 0.04
    );
    this.add(canvas_);
  }

  _desk(x, z, rotY = 0) {
    // Tabletop
    const topMat = this.mat(0x5a4030, 0.75, 0.05);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.65), topMat);
    top.rotation.y = rotY;
    top.position.set(x, FLOOR_Y + 0.72, z);
    this.add(top);
    this.phys(1.4, 0.05, 0.65, x, FLOOR_Y + 0.72, z);

    // Rounded front edge detail — torus strip
    const edgeMat = this.mat(0x4a3020, 0.7, 0.08);
    const edgeRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.4, 8), edgeMat);
    edgeRoll.rotation.z = rotY === 0 ? Math.PI/2 : 0;
    edgeRoll.rotation.y = rotY;
    edgeRoll.position.set(
      x + Math.sin(rotY) * 0.325,
      FLOOR_Y + 0.72,
      z + Math.cos(rotY) * 0.325
    );
    this.add(edgeRoll);

    // Tapered round legs
    const legMat = this.mat(0x3a2a1e, 0.8, 0.12);
    for (const [dx, dz] of [[-0.6, -0.27], [0.6, -0.27], [-0.6, 0.27], [0.6, 0.27]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.7, 7), legMat);
      leg.position.set(
        x + Math.cos(rotY) * dx - Math.sin(rotY) * dz,
        FLOOR_Y + 0.35,
        z + Math.sin(rotY) * dx + Math.cos(rotY) * dz
      );
      this.add(leg);
    }

    // Laptop base
    const laptop = this.box(0.35, 0.022, 0.25, 0x2a2a2a, 0.35, 0.55);
    laptop.rotation.y = rotY;
    laptop.position.set(x, FLOOR_Y + 0.756, z);
    this.add(laptop);

    // Laptop screen
    const screen = this.box(0.33, 0.21, 0.02, 0x1a1a2a, 0.35, 0.3);
    screen.rotation.y = rotY;
    screen.rotation.x = -0.38;
    screen.position.set(
      x + Math.sin(rotY) * (-0.12),
      FLOOR_Y + 0.878,
      z - Math.cos(rotY) * 0.12
    );
    this.add(screen);

    // Screen glow
    const glow = new THREE.PointLight(0x3355cc, 0.2, 2.5);
    glow.position.set(
      x + Math.sin(rotY) * (-0.12),
      FLOOR_Y + 0.878,
      z - Math.cos(rotY) * 0.12 + Math.cos(rotY) * 0.5
    );
    this.addLight(glow);

    // Keyboard
    const kbMat = this.mat(0x1a1a1a, 0.6, 0.3);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.012, 0.14), kbMat);
    kb.rotation.y = rotY;
    kb.position.set(x + Math.sin(rotY)*0.06, FLOOR_Y + 0.748, z + Math.cos(rotY)*0.06);
    this.add(kb);

    // Mouse
    const mouseMat = this.mat(0x111111, 0.5, 0.4);
    const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.06, 4, 8), mouseMat);
    mouse.rotation.x = Math.PI / 2;
    mouse.rotation.y = rotY;
    mouse.position.set(
      x + Math.cos(rotY) * 0.28 + Math.sin(rotY) * 0.06,
      FLOOR_Y + 0.748,
      z - Math.sin(rotY) * 0.28 + Math.cos(rotY) * 0.06
    );
    this.add(mouse);
  }

  _bed(x, z, w = 1.9, d = 2.3) {
    // Bed frame
    this.placeBox(w, 0.34, d, x, FLOOR_Y + 0.17, z, 0x3d2b1e, 0.8, 0.05);
    // Mattress
    const mattMat = this.mat(0x8a8a9a, 0.9, 0.0);
    const matt = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.22, d - 0.1), mattMat);
    matt.position.set(x, FLOOR_Y + 0.455, z);
    this.add(matt);
    // Mattress top edge — slightly rounded
    const edgeMat = this.mat(0x9a9aaa, 0.85, 0.0);
    for (const [ex, ez, ew, ed] of [
      [x, z + (d-0.1)/2, w-0.06, 0.04],
      [x, z - (d-0.1)/2, w-0.06, 0.04],
      [x + (w-0.06)/2, z, 0.04, d-0.1],
      [x - (w-0.06)/2, z, 0.04, d-0.1],
    ]) {
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, Math.max(ew, ed), 7), edgeMat);
      edge.rotation.z = ew > ed ? Math.PI/2 : 0;
      edge.position.set(ex, FLOOR_Y + 0.455 + 0.11, ez);
      this.add(edge);
    }

    // Blanket (slightly bunched at bottom)
    const blankMat = this.mat(0x2a4a7a, 0.9, 0.0);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.13, d * 0.58), blankMat);
    blanket.position.set(x, FLOOR_Y + 0.565, z - d * 0.15);
    this.add(blanket);
    // Blanket fold at top
    const foldMat = this.mat(0x3a5a8a, 0.9, 0.0);
    const fold = new THREE.Mesh(new THREE.CylinderGeometry((w-0.12)/2, (w-0.12)/2, 0.07, 10), foldMat);
    fold.rotation.z = Math.PI / 2;
    fold.position.set(x, FLOOR_Y + 0.565, z - d*0.15 + d*0.58/2);
    this.add(fold);

    // Pillows — capsule shaped
    const pillowMat = this.mat(0xeeeedc, 0.92, 0.0);
    const pillowPositions = w > 1.5
      ? [[-w*0.25, 0], [w*0.25, 0]]    // king: two pillows
      : [[0, 0]];                        // single: one pillow
    for (const [px, pz] of pillowPositions) {
      const pillow = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 4, 10), pillowMat);
      pillow.rotation.z = Math.PI / 2;
      pillow.position.set(x + px, FLOOR_Y + 0.59, z + d/2 - 0.35);
      this.add(pillow);
    }

    // Headboard — arched top
    const hbMat = this.mat(0x3d2b1e, 0.8, 0.05);
    const hbMain = new THREE.Mesh(new THREE.BoxGeometry(w, 0.64, 0.14), hbMat);
    hbMain.position.set(x, FLOOR_Y + 0.72, z + d/2 + 0.11);
    this.add(hbMain);
    this.phys(w, 0.64, 0.14, x, FLOOR_Y + 0.72, z + d/2 + 0.11);
    // Arched top of headboard
    const archMat = this.mat(0x3d2b1e, 0.8, 0.05);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(w/2, w/2, 0.14, 16, 1, false, 0, Math.PI), archMat);
    arch.rotation.z = Math.PI / 2;
    arch.position.set(x, FLOOR_Y + 1.055, z + d/2 + 0.11);
    this.add(arch);

    // Bed legs — four turned wooden cylinders
    const legMat = this.mat(0x2e1e0e, 0.7, 0.08);
    for (const [lx, lz] of [[-w/2+0.08, -d/2+0.1],[w/2-0.08, -d/2+0.1],[-w/2+0.08, d/2-0.1],[w/2-0.08, d/2-0.1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.14, 8), legMat);
      leg.position.set(x + lx, FLOOR_Y + 0.07, z + lz);
      this.add(leg);
    }
  }

  _bedside(x, z) {
    this.placeBox(0.45, 0.55, 0.45, x, FLOOR_Y + 0.275, z, 0x4a3525, 0.8, 0.05);
    // Lamp
    const lm = this.box(0.04, 0.3, 0.04, 0x222222, 0.5, 0.7);
    lm.position.set(x, FLOOR_Y + 0.7, z);
    this.add(lm);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.2, 8, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf5e0c0, side: THREE.DoubleSide, roughness: 0.9 })
    );
    shade.rotation.x = Math.PI;
    shade.position.set(x, FLOOR_Y + 0.95, z);
    this.add(shade);
    const pl = new THREE.PointLight(0xffd080, 0.35, 4);
    pl.position.set(x, FLOOR_Y + 0.9, z);
    this.addLight(pl);
  }

  _dresser(x, z, rotY = 0) {
    const drMat = this.mat(0x4a3525, 0.8, 0.05);
    const dr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.55), drMat);
    dr.rotation.y = rotY;
    dr.position.set(x, FLOOR_Y + 0.55, z);
    this.add(dr);
    this.phys(1.2, 1.1, 0.55, x, FLOOR_Y + 0.55, z);

    // Four drawers with groove lines
    const drawerMat = this.mat(0x4e3828, 0.82, 0.04);
    const handleMat = this.mat(0xccaa77, 0.25, 0.75);
    for (let row = 0; row < 4; row++) {
      const dy = FLOOR_Y + 0.15 + row * 0.24;
      // Drawer panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.2, 0.03), drawerMat);
      panel.rotation.y = rotY;
      panel.position.set(
        x + Math.sin(rotY) * 0.29,
        dy,
        z + Math.cos(rotY) * 0.29
      );
      this.add(panel);
      // Handle — small cylinder bar
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), handleMat);
      handle.rotation.z = rotY === 0 ? Math.PI/2 : 0;
      handle.rotation.y = rotY;
      handle.position.set(
        x + Math.sin(rotY) * 0.31,
        dy,
        z + Math.cos(rotY) * 0.31
      );
      this.add(handle);
      // Handle end caps
      for (const side of [-0.11, 0.11]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), handleMat);
        cap.position.set(
          x + Math.sin(rotY) * 0.31 + Math.cos(rotY) * side,
          dy,
          z + Math.cos(rotY) * 0.31 + Math.sin(rotY) * side
        );
        this.add(cap);
      }
    }

    // Legs
    const legMat = this.mat(0x2e1e0e, 0.7, 0.1);
    const hw = 0.55, hd = 0.22;
    for (const [ds, dd] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.12, 7), legMat);
      leg.position.set(
        x + Math.cos(rotY)*ds*hw/2 - Math.sin(rotY)*dd*hd,
        FLOOR_Y + 0.06,
        z + Math.sin(rotY)*ds*hw/2 + Math.cos(rotY)*dd*hd
      );
      this.add(leg);
    }
  }

  _wardrobe(x, z, rotY = 0) {
    const wbMat = this.mat(0x3a2810, 0.8, 0.05);
    const wb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 0.6), wbMat);
    wb.rotation.y = rotY;
    wb.position.set(x, FLOOR_Y + 1.0, z);
    this.add(wb);
    this.phys(1.6, 2.0, 0.6, x, FLOOR_Y + 1.0, z);

    // Door seam
    const seamMat = this.mat(0x1a1208, 0.8, 0.0);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.98, 0.62), seamMat);
    seam.rotation.y = rotY;
    seam.position.set(x, FLOOR_Y + 1.0, z + Math.cos(rotY) * 0.01);
    this.add(seam);

    // Crown molding on top — cylinder roll
    const crownMat = this.mat(0x2e1e0a, 0.75, 0.08);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.64, 8), crownMat);
    crown.rotation.z = rotY === 0 ? Math.PI/2 : 0;
    crown.rotation.y = rotY;
    crown.position.set(
      x + Math.sin(rotY) * 0.31,
      FLOOR_Y + 2.02,
      z + Math.cos(rotY) * 0.31
    );
    this.add(crown);

    // Door handles (two — one per door)
    const hMat = this.mat(0xccaa55, 0.2, 0.8);
    for (const side of [-0.4, 0.4]) {
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), hMat);
      handle.position.set(
        x + Math.cos(rotY) * side + Math.sin(rotY) * 0.32,
        FLOOR_Y + 1.05,
        z - Math.sin(rotY) * side + Math.cos(rotY) * 0.32
      );
      this.add(handle);
    }

    // Base plinth
    const plinthMat = this.mat(0x2e1e0a, 0.8, 0.05);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.62), plinthMat);
    plinth.rotation.y = rotY;
    plinth.position.set(x, FLOOR_Y + 0.04, z);
    this.add(plinth);
  }

  _vanity(x, z, rotY = 0) {
    // Frame
    const frame = this.box(0.8, 1.0, 0.05, 0x2a2a2a, 0.6, 0.1);
    frame.rotation.y = rotY;
    frame.position.set(x, FLOOR_Y + WALL_H * 0.6, z);
    this.add(frame);
    // Mirror surface
    const mirror = this.box(0.75, 0.9, 0.02, 0xc8d8e8, 0.05, 0.9);
    mirror.rotation.y = rotY;
    mirror.position.set(
      x + Math.sin(rotY) * 0.035,
      FLOOR_Y + WALL_H * 0.6,
      z + Math.cos(rotY) * 0.035
    );
    this.add(mirror);
  }

  _kitchenCounter(x1, x2, z, side = 'south') {
    const len = x2 - x1;
    const cx  = (x1 + x2) / 2;
    // Cabinet body
    this.placeBox(len, 0.9, 0.65, cx, FLOOR_Y + 0.45, z, 0x5a5a5a, 0.6, 0.3);
    // Countertop
    const ct = this.box(len + 0.05, 0.04, 0.7, 0x888888, 0.3, 0.5);
    ct.position.set(cx, FLOOR_Y + 0.92, z);
    this.add(ct);
  }

  _stove(x, z) {
    const body = this.box(0.65, 0.88, 0.65, 0x2a2a2a, 0.4, 0.5);
    body.position.set(x, FLOOR_Y + 0.44, z);
    this.add(body);
    this.phys(0.65, 0.88, 0.65, x, FLOOR_Y + 0.44, z);

    // Cooktop surface (slightly lighter than body)
    const topMat = this.mat(0x1a1a1a, 0.35, 0.6);
    const cooktop = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.02, 0.63), topMat);
    cooktop.position.set(x, FLOOR_Y + 0.88, z);
    this.add(cooktop);

    // Burners — with concentric rings for realism
    const bRimMat = this.mat(0x333333, 0.45, 0.55);
    const bCoreMat = this.mat(0x111111, 0.4, 0.6);
    for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
      // Outer ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 5, 16), bRimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x + dx, FLOOR_Y + 0.895, z + dz);
      this.add(ring);
      // Inner core disc
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.015, 12), bCoreMat);
      core.position.set(x + dx, FLOOR_Y + 0.896, z + dz);
      this.add(core);
    }

    // Control knobs — 4 cylinders on front
    const knobMat = this.mat(0x555555, 0.4, 0.4);
    const knobPointerMat = this.mat(0xffffff, 0.8, 0.0);
    for (let i = 0; i < 4; i++) {
      const kx = x - 0.22 + i * 0.145;
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.025, 10), knobMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(kx, FLOOR_Y + 0.74, z + 0.33);
      this.add(knob);
      // Pointer line (tiny box)
      const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.004), knobPointerMat);
      ptr.position.set(kx, FLOOR_Y + 0.755, z + 0.33);
      this.add(ptr);
    }

    // Oven door handle
    const hMat = this.mat(0x888888, 0.3, 0.75);
    const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), hMat);
    hBar.rotation.z = Math.PI / 2;
    hBar.position.set(x, FLOOR_Y + 0.52, z + 0.34);
    this.add(hBar);
  }

  _buildRadio(x, z) {
    const mat = this.mat(0x1a1a1a, 0.4, 0.4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.18), mat);
    body.position.set(x, FLOOR_Y + 0.99, z);
    this.add(body);
    // Speaker grille
    const grilleMat = this.mat(0x333333, 0.8, 0.1);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.01), grilleMat);
    grille.position.set(x - 0.04, FLOOR_Y + 0.99, z + 0.09);
    this.add(grille);
    // Dial knobs
    const dialMat = this.mat(0x888888, 0.3, 0.6);
    for (const dx of [0.07, 0.1]) {
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.015, 8), dialMat);
      dial.rotation.x = Math.PI/2;
      dial.position.set(x + dx, FLOOR_Y + 0.99, z + 0.09);
      this.add(dial);
    }
    // Antenna
    const antennaMat = this.mat(0xaaaaaa, 0.3, 0.8);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), antennaMat);
    antenna.rotation.z = 0.2;
    antenna.position.set(x + 0.1, FLOOR_Y + 1.12, z - 0.06);
    this.add(antenna);
    // Red power LED
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: new THREE.Color(0xff0000), emissiveIntensity: 1.0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), ledMat);
    led.position.set(x + 0.08, FLOOR_Y + 1.035, z + 0.095);
    this.add(led);
    // Register radio position for Game.js
    if (!this.game._radioObjects) this.game._radioObjects = [];
    this.game._radioObjects.push({ x, y: FLOOR_Y + 0.99, z });
  }

  _fridge(x, z) {
    // Main body
    this.placeBox(0.75, 1.85, 0.72, x, FLOOR_Y + 0.925, z, 0xe4e4e4, 0.35, 0.4);
    // Door seam
    const seamMat = this.mat(0xbbbbbb, 0.4, 0.3);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.01, 0.73), seamMat);
    seam.position.set(x, FLOOR_Y + 1.1, z);
    this.add(seam);
    // Handle — cylinder rod
    const handleMat = this.mat(0xaaaaaa, 0.2, 0.85);
    const handleRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), handleMat);
    handleRod.position.set(x + 0.39, FLOOR_Y + 1.3, z);
    this.add(handleRod);
    // Handle end caps
    for (const dy of [-0.27, 0.27]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), handleMat);
      cap.position.set(x + 0.39, FLOOR_Y + 1.3 + dy, z);
      this.add(cap);
    }
    // Freezer handle (top section)
    const fRod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 8), handleMat);
    fRod.position.set(x + 0.39, FLOOR_Y + 0.55, z);
    this.add(fRod);
  }

  _sink(x, z, rotY = 0) {
    // Cabinet
    const cab = this.box(0.72, 0.85, 0.56, 0x5a5a5a, 0.6, 0.2);
    cab.rotation.y = rotY;
    cab.position.set(x, FLOOR_Y + 0.425, z);
    this.add(cab);
    this.phys(0.72, 0.85, 0.56, x, FLOOR_Y + 0.425, z);

    // Countertop
    const ctMat = this.mat(0x888888, 0.3, 0.5);
    const ct = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.035, 0.6), ctMat);
    ct.rotation.y = rotY;
    ct.position.set(x, FLOOR_Y + 0.885, z);
    this.add(ct);

    // Oval basin — cylinder scaled to oval
    const basinMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, metalness: 0.4 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 14, 1, false, 0, Math.PI * 2), basinMat);
    basin.scale.x = 1.3;
    basin.scale.z = 1.0;
    basin.rotation.y = rotY;
    basin.position.set(x, FLOOR_Y + 0.94, z);
    this.add(basin);

    // Basin inner (darker for depth)
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xbbbbcc, roughness: 0.15, metalness: 0.3 });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.09, 14, 1, true), innerMat);
    inner.scale.x = 1.25;
    inner.rotation.y = rotY;
    inner.position.set(x, FLOOR_Y + 0.905, z);
    this.add(inner);

    // Faucet
    const fMat = this.mat(0xcccccc, 0.15, 0.95);
    const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.06, 8), fMat);
    faucetBase.rotation.y = rotY;
    faucetBase.position.set(
      x - Math.sin(rotY) * 0.14,
      FLOOR_Y + 0.99,
      z - Math.cos(rotY) * 0.14
    );
    this.add(faucetBase);
    const faucetNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), fMat);
    faucetNeck.rotation.y = rotY;
    faucetNeck.position.set(
      x - Math.sin(rotY) * 0.14,
      FLOOR_Y + 1.1,
      z - Math.cos(rotY) * 0.14
    );
    this.add(faucetNeck);
    // Spout arm
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8), fMat);
    spout.rotation.z = rotY === 0 ? -Math.PI / 2 : Math.PI / 2;
    spout.rotation.y = rotY;
    spout.position.set(
      x - Math.sin(rotY) * 0.14 + Math.sin(rotY) * 0.07,
      FLOOR_Y + 1.18,
      z - Math.cos(rotY) * 0.14 + Math.cos(rotY) * 0.07
    );
    this.add(spout);
  }

  _kitchenTable(x, z) {
    // Round table top
    const topMat = this.mat(0x7a6040, 0.75, 0.05);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), topMat);
    top.position.set(x, FLOOR_Y + 0.72, z);
    this.add(top);
    this.phys(1.1, 0.05, 1.1, x, FLOOR_Y + 0.72, z);
    // Edge band
    const edgeMat = this.mat(0x5a4020, 0.7, 0.08);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 24), edgeMat);
    edge.rotation.x = Math.PI / 2;
    edge.position.set(x, FLOOR_Y + 0.72, z);
    this.add(edge);

    // Pedestal base — single center column style
    const pedMat = this.mat(0x5a4030, 0.8, 0.1);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.65, 10), pedMat);
    ped.position.set(x, FLOOR_Y + 0.37, z);
    this.add(ped);
    // Foot spider arms
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 7), pedMat);
      arm.rotation.z = 0.4;
      arm.rotation.y = ang;
      arm.position.set(x + Math.cos(ang) * 0.16, FLOOR_Y + 0.08, z + Math.sin(ang) * 0.16);
      this.add(arm);
    }

    // Chairs — two with rounded seats
    for (const [side, ang] of [[-1, 0], [1, Math.PI]]) {
      const chairX = x + side * 0.72;
      const seatMat = this.mat(0x5a4030, 0.85, 0.05);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), seatMat);
      seat.position.set(chairX, FLOOR_Y + 0.44, z);
      this.add(seat);
      // Chair back
      const bMat = this.mat(0x4a3020, 0.85, 0.05);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.04), bMat);
      back.position.set(chairX + side * 0.2, FLOOR_Y + 0.67, z);
      this.add(back);
      // Rounded back top
      const bCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 7), bMat);
      bCap.rotation.z = Math.PI / 2;
      bCap.position.set(chairX + side * 0.2, FLOOR_Y + 0.84, z);
      this.add(bCap);
      // Chair legs
      const cLegMat = this.mat(0x3a2010, 0.7, 0.1);
      for (const [dz, ddx] of [[-0.16, -0.16],[0.16,-0.16],[-0.16,0.16],[0.16,0.16]]) {
        const cleg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.42, 6), cLegMat);
        cleg.position.set(chairX + ddx, FLOOR_Y + 0.21, z + dz);
        this.add(cleg);
      }
    }
  }

  _overheadCabinets(x1, x2, z, wallSide = 'south') {
    const len = x2 - x1;
    const cx  = (x1 + x2) / 2;
    const cab = this.box(len, 0.65, 0.35, 0x4a4a4a, 0.7, 0.2);
    cab.position.set(cx, FLOOR_Y + WALL_H - 0.65, z);
    this.add(cab);
  }

  _microwave(x, z) {
    const mwMat = this.mat(0x2a2a2a, 0.4, 0.55);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.38), mwMat);
    body.position.set(x, FLOOR_Y + 1.08, z);
    this.add(body);

    // Viewport window — dark glass rectangle with rounded frame
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111120, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.025), glassMat);
    glass.position.set(x - 0.07, FLOOR_Y + 1.08, z + 0.19);
    this.add(glass);

    // Door frame ring
    const frameMat = this.mat(0x1a1a1a, 0.5, 0.4);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.02), frameMat);
    fr.position.set(x - 0.07, FLOOR_Y + 1.08, z + 0.2);
    this.add(fr);

    // Control panel
    const panelMat = this.mat(0x333333, 0.55, 0.3);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.025), panelMat);
    panel.position.set(x + 0.165, FLOOR_Y + 1.08, z + 0.195);
    this.add(panel);

    // Display — green emissive
    const dispMat = new THREE.MeshStandardMaterial({ color: 0x002200, emissive: new THREE.Color(0x00bb44), emissiveIntensity: 0.6, roughness: 0.5 });
    const disp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.01), dispMat);
    disp.position.set(x + 0.165, FLOOR_Y + 1.1, z + 0.207);
    this.add(disp);

    // Dial knob
    const dialMat = this.mat(0x444444, 0.4, 0.4);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 10), dialMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(x + 0.165, FLOOR_Y + 1.03, z + 0.205);
    this.add(dial);

    // Handle bar
    const hMat = this.mat(0x888888, 0.3, 0.7);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), hMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(x + 0.07, FLOOR_Y + 1.08, z + 0.206);
    this.add(handle);
  }

  _bathtub(x, z) {
    // Outer tub shell — rounded ends via capsule-like construction
    const tubMat = this.mat(0xf0f0f0, 0.25, 0.25);
    // Main body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 1.6, 16, 1, false, 0, Math.PI), tubMat);
    body.rotation.z = Math.PI / 2;
    body.position.set(x, FLOOR_Y + 0.38, z);
    this.add(body);
    this.phys(1.6, 0.5, 0.76, x, FLOOR_Y + 0.25, z);

    // Flat bottom cap
    const baseColor = this.mat(0xe8e8ee, 0.3, 0.2);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.76), baseColor);
    base.position.set(x, FLOOR_Y + 0.04, z);
    this.add(base);

    // Interior bowl (dark for depth illusion)
    const innerMat = new THREE.MeshStandardMaterial({ color: 0xdde8ff, roughness: 0.15, metalness: 0.1 });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 1.45, 14, 1, false, 0, Math.PI), innerMat);
    inner.rotation.z = Math.PI / 2;
    inner.position.set(x, FLOOR_Y + 0.44, z);
    this.add(inner);

    // Rim edge
    const rimMat = this.mat(0xffffff, 0.2, 0.4);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.028, 6, 20, Math.PI), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.rotation.y = Math.PI / 2;
    rim.position.set(x, FLOOR_Y + 0.5, z);
    this.add(rim);

    // Faucet + handles
    const fMat = this.mat(0xcccccc, 0.15, 0.95);
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 8), fMat);
    faucet.position.set(x + 0.62, FLOOR_Y + 0.62, z);
    this.add(faucet);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 8), fMat);
    spout.rotation.z = Math.PI / 2;
    spout.position.set(x + 0.68, FLOOR_Y + 0.72, z);
    this.add(spout);

    // Tub feet — 4 curved bun feet
    const footMat = this.mat(0xdddddd, 0.3, 0.5);
    for (const [fx, fz] of [[-0.62,-0.22],[-0.62,0.22],[0.62,-0.22],[0.62,0.22]]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), footMat);
      foot.scale.y = 0.7;
      foot.position.set(x + fx, FLOOR_Y + 0.07, z + fz);
      this.add(foot);
    }
  }

  _toilet(x, z, rotY = 0) {
    const wMat = this.mat(0xf0f0f0, 0.25, 0.1);

    // Pedestal base — tapered cylinder
    const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.18, 12), wMat);
    pedBase.rotation.y = rotY;
    pedBase.position.set(x, FLOOR_Y + 0.09, z + Math.cos(rotY) * 0.06);
    this.add(pedBase);

    // Bowl body — ellipsoid via scaled sphere
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), wMat);
    bowl.scale.set(0.88, 0.62, 1.15);
    bowl.rotation.y = rotY;
    bowl.position.set(x, FLOOR_Y + 0.3, z + Math.cos(rotY) * 0.06);
    this.add(bowl);
    this.phys(0.42, 0.42, 0.6, x, FLOOR_Y + 0.21, z);

    // Seat ring — torus
    const seatMat = this.mat(0xe8e8e8, 0.3, 0.08);
    const seatRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.032, 8, 20), seatMat);
    seatRing.rotation.x = Math.PI / 2;
    seatRing.rotation.y = rotY;
    seatRing.scale.x = 0.82;
    seatRing.position.set(x, FLOOR_Y + 0.42, z + Math.cos(rotY) * 0.06);
    this.add(seatRing);

    // Seat lid (flat oval)
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), seatMat);
    lid.scale.x = 0.82;
    lid.rotation.y = rotY;
    lid.position.set(x, FLOOR_Y + 0.46, z + Math.cos(rotY) * 0.06);
    this.add(lid);

    // Tank — slightly rounded box
    const tank = this.box(0.38, 0.38, 0.18, 0xf0f0f0, 0.3, 0.1);
    tank.rotation.y = rotY;
    tank.position.set(
      x - Math.sin(rotY) * 0.22,
      FLOOR_Y + 0.57,
      z - Math.cos(rotY) * 0.22
    );
    this.add(tank);

    // Tank lid
    const tankLid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 8), seatMat);
    tankLid.scale.x = 1.0; tankLid.scale.z = 0.48;
    tankLid.rotation.y = rotY;
    tankLid.position.set(
      x - Math.sin(rotY) * 0.22,
      FLOOR_Y + 0.775,
      z - Math.cos(rotY) * 0.22
    );
    this.add(tankLid);
  }

  _towelRack(x, z, rotY = 0) {
    const postMat = this.mat(0xbbbbbb, 0.2, 0.9);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), postMat
      );
      post.rotation.z = Math.PI / 2;
      post.position.set(
        x + Math.cos(rotY) * side * 0.25,
        FLOOR_Y + 1.2,
        z + Math.sin(rotY) * side * 0.25
      );
      this.add(post);
    }
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8), postMat
    );
    bar.rotation.z = Math.PI / 2;
    bar.rotation.y = rotY;
    bar.position.set(x, FLOOR_Y + 1.2, z);
    this.add(bar);
    // Towel
    const towel = this.box(0.5, 0.45, 0.02, 0x3a7aaa, 0.9, 0.0);
    towel.rotation.y = rotY;
    towel.position.set(x, FLOOR_Y + 1.0, z + Math.cos(rotY) * 0.02);
    this.add(towel);
  }

  _medicineCabinet(x, z, rotY = 0) {
    const cab = this.box(0.55, 0.65, 0.12, 0x3a3a3a, 0.6, 0.2);
    cab.rotation.y = rotY;
    cab.position.set(x, FLOOR_Y + WALL_H * 0.65, z);
    this.add(cab);
    const mirror = this.box(0.5, 0.6, 0.03, 0xc8d8e8, 0.05, 0.9);
    mirror.rotation.y = rotY;
    mirror.position.set(
      x + Math.sin(rotY) * 0.07,
      FLOOR_Y + WALL_H * 0.65,
      z + Math.cos(rotY) * 0.07
    );
    this.add(mirror);
  }

  _indoorPlant(x, z, scale = 1.0) {
    // Terracotta pot — cylinder with tapered sides
    const potMat = this.mat(0xc1613a, 0.85, 0.05);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * scale, 0.1 * scale, 0.2 * scale, 10), potMat);
    pot.position.set(x, FLOOR_Y + 0.1 * scale, z);
    this.add(pot);
    // Rim
    const rimMat = this.mat(0xb85530, 0.8, 0.05);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.135 * scale, 0.018 * scale, 6, 12), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, FLOOR_Y + 0.2 * scale, z);
    this.add(rim);
    // Soil
    const soilMat = this.mat(0x3a2a1a, 0.95, 0.0);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.025 * scale, 10), soilMat);
    soil.position.set(x, FLOOR_Y + 0.21 * scale, z);
    this.add(soil);
    // Leaves — multiple spheres as leaf clusters
    const leafMat = this.mat(0x2a6e28, 0.85, 0.0);
    const darkLeaf = this.mat(0x1e5a1c, 0.85, 0.0);
    const positions = [
      [0, 0.35 * scale, 0, 0.18 * scale],
      [0.12 * scale, 0.25 * scale, 0.05 * scale, 0.13 * scale],
      [-0.1 * scale, 0.28 * scale, -0.08 * scale, 0.14 * scale],
      [0.05 * scale, 0.42 * scale, -0.1 * scale, 0.12 * scale],
      [-0.08 * scale, 0.38 * scale, 0.12 * scale, 0.11 * scale],
    ];
    for (const [ox, oy, oz, r] of positions) {
      const mat = Math.random() > 0.5 ? leafMat : darkLeaf;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
      leaf.position.set(x + ox, FLOOR_Y + 0.22 * scale + oy, z + oz);
      leaf.scale.y = 0.8;
      this.add(leaf);
    }
    this.phys(0.28 * scale, 0.6 * scale, 0.28 * scale, x, FLOOR_Y + 0.3 * scale, z);
  }

  _ceilingLight(x, z, color = 0xffe8cc, intensity = 1.0, radius = 12) {
    const ceilY = FLOOR_Y + WALL_H;
    // Ceiling mount disc
    const mountMat = this.mat(0xdddddd, 0.6, 0.2);
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), mountMat);
    mount.position.set(x, ceilY - 0.02, z);
    this.add(mount);
    // Pendant cord
    const cordMat = this.mat(0x222222, 0.9, 0.0);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), cordMat);
    cord.position.set(x, ceilY - 0.17, z);
    this.add(cord);
    // Shade (inverted cone bowl)
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xf5e8d0, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide
    });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 16, 1, true), shadeMat);
    shade.rotation.x = Math.PI;
    shade.position.set(x, ceilY - 0.44, z);
    this.add(shade);
    // Bulb glow
    const bulbMat = this.mat(0xffeecc, 0.1, 0.0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), bulbMat);
    bulb.position.set(x, ceilY - 0.34, z);
    this.add(bulb);
    // Light source
    const pl = new THREE.PointLight(color, intensity, radius);
    pl.position.set(x, ceilY - 0.45, z);
    pl.castShadow = false;
    this.addLight(pl);
  }

  _wallClock(x, y, z, rotY = 0) {
    const frameMat = this.mat(0x2a1a0e, 0.8, 0.1);
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20), frameMat);
    frame.rotation.x = Math.PI / 2;
    frame.rotation.y = rotY;
    frame.position.set(x, y, z);
    this.add(frame);
    // Face
    const faceMat = this.mat(0xf5f0e8, 0.7, 0.0);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 20), faceMat);
    face.rotation.x = Math.PI / 2;
    face.rotation.y = rotY;
    face.position.set(
      x + Math.sin(rotY) * 0.03, y, z + Math.cos(rotY) * 0.03
    );
    this.add(face);
    // Hour hand
    const handMat = this.mat(0x111111, 0.8, 0.0);
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.01), handMat);
    hourHand.rotation.y = rotY;
    hourHand.rotation.z = 0.8;
    hourHand.position.set(
      x + Math.sin(rotY) * 0.04, y + 0.04, z + Math.cos(rotY) * 0.04
    );
    this.add(hourHand);
    // Minute hand
    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.155, 0.01), handMat);
    minHand.rotation.y = rotY;
    minHand.rotation.z = -0.4;
    minHand.position.set(
      x + Math.sin(rotY) * 0.04, y + 0.05, z + Math.cos(rotY) * 0.04
    );
    this.add(minHand);
    // Center pin
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), handMat);
    pin.position.set(x + Math.sin(rotY) * 0.04, y, z + Math.cos(rotY) * 0.04);
    this.add(pin);
  }

  _kettle(x, z) {
    const bodyMat = this.mat(0x222233, 0.4, 0.6);
    // Body — squat cylinder
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 12), bodyMat);
    body.position.set(x, FLOOR_Y + 0.99, z);
    this.add(body);
    // Spout
    const spoutMat = this.mat(0x1a1a2a, 0.4, 0.6);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 6), spoutMat);
    spout.rotation.z = -0.7;
    spout.rotation.y = Math.PI / 4;
    spout.position.set(x + 0.1, FLOOR_Y + 1.07, z - 0.08);
    this.add(spout);
    // Lid
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
    lid.position.set(x, FLOOR_Y + 1.08, z);
    this.add(lid);
    // Handle
    const handleMat = this.mat(0x444444, 0.8, 0.1);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 10, Math.PI * 1.1), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(x - 0.12, FLOOR_Y + 1.03, z);
    this.add(handle);
    // Base plate
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), handleMat);
    base.position.set(x, FLOOR_Y + 0.9, z);
    this.add(base);
  }

  _toaster(x, z) {
    const bodyMat = this.mat(0x888888, 0.35, 0.65);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.16), bodyMat);
    body.position.set(x, FLOOR_Y + 0.98, z);
    this.add(body);
    // Slots
    const slotMat = this.mat(0x111111, 0.8, 0.1);
    for (const dx of [-0.06, 0.06]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.12), slotMat);
      slot.position.set(x + dx, FLOOR_Y + 1.065, z);
      this.add(slot);
    }
    // Lever
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), slotMat);
    lever.rotation.z = Math.PI / 2;
    lever.position.set(x + 0.14, FLOOR_Y + 0.97, z + 0.04);
    this.add(lever);
  }

  _kitchenStools(x, z) {
    for (const side of [-0.65, 0.65]) {
      const seatMat = this.mat(0x4a3020, 0.85, 0.05);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 12), seatMat);
      seat.position.set(x + side, FLOOR_Y + 0.72, z + 0.75);
      this.add(seat);
      // Stool leg
      const legMat = this.mat(0x888888, 0.3, 0.8);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8), legMat);
      leg.position.set(x + side, FLOOR_Y + 0.38, z + 0.75);
      this.add(leg);
      // Foot ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 5, 12), legMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x + side, FLOOR_Y + 0.25, z + 0.75);
      this.add(ring);
    }
  }

  _gamingChair(x, z, rotY = 0) {
    const baseMat = this.mat(0x222222, 0.5, 0.6);
    const darkMat = this.mat(0x1a1a1a, 0.7, 0.2);
    const accentMat = this.mat(0xcc2222, 0.5, 0.1);

    // Star base — 5 arms
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 6), baseMat);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = ang;
      arm.position.set(x + Math.cos(ang) * 0.14, FLOOR_Y + 0.04, z + Math.sin(ang) * 0.14);
      this.add(arm);
      // Caster wheel
      const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), baseMat);
      wheel.position.set(x + Math.cos(ang) * 0.26, FLOOR_Y + 0.035, z + Math.sin(ang) * 0.26);
      this.add(wheel);
    }
    // Hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10), baseMat);
    hub.position.set(x, FLOOR_Y + 0.04, z);
    this.add(hub);

    // Pneumatic stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.35, 8), baseMat);
    stem.position.set(x, FLOOR_Y + 0.215, z);
    this.add(stem);

    // Seat — cushion shape (capsule dome)
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.52), darkMat);
    seatBase.rotation.y = rotY;
    seatBase.position.set(x, FLOOR_Y + 0.43, z);
    this.add(seatBase);
    this.phys(0.52, 0.12, 0.52, x, FLOOR_Y + 0.44, z);
    // Seat cushion dome
    const cushMat = this.mat(0x222222, 0.75, 0.15);
    const cush = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI*2, 0, Math.PI/2), cushMat);
    cush.scale.set(1.0, 0.28, 1.0);
    cush.rotation.y = rotY;
    cush.position.set(x, FLOOR_Y + 0.476, z);
    this.add(cush);

    // Back
    const bx = x - Math.sin(rotY) * 0.22;
    const bz = z - Math.cos(rotY) * 0.22;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.1), darkMat);
    back.rotation.y = rotY;
    back.position.set(bx, FLOOR_Y + 0.86, bz);
    this.add(back);

    // Back rounded top cap
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8), darkMat);
    topCap.rotation.z = rotY === 0 ? Math.PI/2 : 0;
    topCap.rotation.y = rotY;
    topCap.position.set(bx, FLOOR_Y + 1.225, bz);
    this.add(topCap);

    // Red accent strips on back sides
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.7, 0.105), accentMat);
      strip.rotation.y = rotY;
      strip.position.set(
        bx + Math.cos(rotY) * side * 0.218,
        FLOOR_Y + 0.86,
        bz + Math.sin(rotY) * side * 0.218
      );
      this.add(strip);
    }

    // Headrest — separate cushion
    const hrMat = this.mat(0x111111, 0.7, 0.2);
    const headrest = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), hrMat);
    headrest.rotation.z = Math.PI / 2;
    headrest.rotation.y = rotY;
    headrest.position.set(bx, FLOOR_Y + 1.28, bz + Math.cos(rotY) * 0.04);
    this.add(headrest);

    // Armrests — cylinder bars
    const armMat = this.mat(0x222222, 0.5, 0.4);
    for (const side of [-1, 1]) {
      const armPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 7), armMat);
      armPost.rotation.y = rotY;
      armPost.position.set(
        x + Math.cos(rotY) * side * 0.24,
        FLOOR_Y + 0.53,
        z + Math.sin(rotY) * side * 0.24
      );
      this.add(armPost);
      const armPad = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.14, 4, 8), armMat);
      armPad.rotation.x = Math.PI / 2;
      armPad.rotation.y = rotY;
      armPad.position.set(
        x + Math.cos(rotY) * side * 0.24,
        FLOOR_Y + 0.625,
        z + Math.sin(rotY) * side * 0.24
      );
      this.add(armPad);
    }
  }

  _monitorSetup(x, z, rotY = 0) {
    // Desk top — dark surface (NO physics body: caller is expected to pair with _desk)
    const top = this.box(1.2, 0.05, 0.65, 0x2a2a2a, 0.5, 0.3);
    top.rotation.y = rotY;
    top.position.set(x, FLOOR_Y + 0.72, z);
    this.add(top);

    // Monitor bezel
    const bezMat = this.mat(0x111111, 0.3, 0.55);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.045), bezMat);
    mon.rotation.y = rotY;
    const mx = x;
    const mz = z - Math.cos(rotY) * 0.08;
    mon.position.set(mx, FLOOR_Y + 0.98, mz);
    this.add(mon);

    // Screen face (emissive)
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x0a1530, emissive: new THREE.Color(0x112244), emissiveIntensity: 0.4,
      roughness: 0.1, metalness: 0.05
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.35, 0.02), screenMat);
    screen.rotation.y = rotY;
    screen.position.set(mx + Math.sin(rotY)*0.025, FLOOR_Y + 0.98, mz + Math.cos(rotY)*0.025);
    this.add(screen);

    // Monitor stand neck
    const standMat = this.mat(0x222222, 0.45, 0.55);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), standMat);
    neck.position.set(mx, FLOOR_Y + 0.82, mz);
    this.add(neck);
    // Monitor stand foot
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.14), standMat);
    foot.rotation.y = rotY;
    foot.position.set(mx, FLOOR_Y + 0.735, mz);
    this.add(foot);

    // PC tower — with case details
    const towerMat = this.mat(0x111111, 0.5, 0.4);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.4), towerMat);
    tower.rotation.y = rotY;
    tower.position.set(
      x + Math.cos(rotY) * 0.44,
      FLOOR_Y + 0.21,
      z - Math.sin(rotY) * 0.44
    );
    this.add(tower);
    // Power button (sphere)
    const pwrMat = this.mat(0x0066ff, 0.3, 0.6);
    const pwr = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), pwrMat);
    pwr.position.set(
      tower.position.x + Math.sin(rotY) * 0.1,
      FLOOR_Y + 0.38,
      tower.position.z + Math.cos(rotY) * 0.1
    );
    this.add(pwr);
    // RGB light strip on tower
    const rgbMat = new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: new THREE.Color(0x00ff88), emissiveIntensity: 0.5 });
    const rgb = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.28, 0.005), rgbMat);
    rgb.rotation.y = rotY;
    rgb.position.set(
      tower.position.x + Math.sin(rotY) * 0.1,
      FLOOR_Y + 0.21,
      tower.position.z + Math.cos(rotY) * 0.1
    );
    this.add(rgb);

    // Speakers
    for (const side of [-1, 1]) {
      const spkMat = this.mat(0x1a1a1a, 0.7, 0.2);
      const spkBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.2, 10), spkMat);
      spkBody.position.set(
        mx + Math.cos(rotY) * side * 0.42,
        FLOOR_Y + 0.84,
        mz + Math.sin(rotY) * side * 0.42
      );
      this.add(spkBody);
      const spkFront = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 10), this.mat(0x333333, 0.8, 0.1));
      spkFront.rotation.x = Math.PI / 2;
      spkFront.rotation.y = rotY;
      spkFront.position.set(
        spkBody.position.x + Math.sin(rotY) * 0.105,
        FLOOR_Y + 0.84,
        spkBody.position.z + Math.cos(rotY) * 0.105
      );
      this.add(spkFront);
    }

    // Keyboard
    const kbMat = this.mat(0x1a1a1a, 0.6, 0.3);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.015, 0.16), kbMat);
    kb.rotation.y = rotY;
    kb.position.set(x + Math.sin(rotY)*0.08, FLOOR_Y + 0.738, z + Math.cos(rotY)*0.08);
    this.add(kb);

    // Mouse pad
    const padMat = this.mat(0x111111, 0.95, 0.0);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.008, 0.24), padMat);
    pad.rotation.y = rotY;
    pad.position.set(
      x + Math.cos(rotY)*0.28 + Math.sin(rotY)*0.06,
      FLOOR_Y + 0.729,
      z - Math.sin(rotY)*0.28 + Math.cos(rotY)*0.06
    );
    this.add(pad);

    // Mouse on pad
    const mouseMat = this.mat(0x111111, 0.5, 0.4);
    const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.06, 4, 8), mouseMat);
    mouse.rotation.x = Math.PI / 2;
    mouse.rotation.y = rotY;
    mouse.position.set(pad.position.x, FLOOR_Y + 0.742, pad.position.z);
    this.add(mouse);

    // Monitor glow
    const glow = new THREE.PointLight(0x2244ff, 0.35, 3.5);
    glow.position.set(mx, FLOOR_Y + 0.98, mz + Math.cos(rotY) * 0.6);
    this.addLight(glow);
  }

  // ─── Room furniture builders ─────────────────────────────────────────────────

  _buildLivingRoomFurniture() {
    // Living Room: x:-14 to +6, z:0 to +10

    // Sofa facing TV
    this._sofa(-5, 7);

    // TV + stand on the interior z-partition wall side
    this._tv(-5, 2);

    // Add an interactive radio on the TV stand
    this._buildRadio(-3.5, 2.1);

    // Coffee table (now oval, between sofa and TV)
    this._coffeeTable(-5, 5.5);

    // Bookshelf on west wall
    this._bookshelf(-13, 5, Math.PI / 2);

    // Floor lamp next to sofa
    this._floorLamp(-2.5, 7.5);

    // Armchair
    this._armchair(-8, 6, Math.PI * 0.1);

    // Side table next to armchair
    this._sideTable(-8, 7.2);

    // Round area rug (circle geometry)
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.95 });
    const rugMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.02, 32), rugMat);
    rugMesh.position.set(-5, FLOOR_Y + 0.015, 5.0);
    this.add(rugMesh);

    // Indoor plant in corner
    this._indoorPlant(-13, 9, 1.2);
    this._indoorPlant(-12, 9.2, 0.9);

    // Ceiling pendant lights
    this._ceilingLight(-8, 5, 0xffddaa, 0.8, 16);
    this._ceilingLight(-2, 5, 0xffddaa, 0.7, 14);

    // Wall clock above TV
    this._wallClock(-5, FLOOR_Y + WALL_H * 0.75, 0.12, 0);

    // Paintings on walls
    this._painting(-13.88, FLOOR_Y + WALL_H * 0.6, 3, Math.PI / 2);
    this._painting(-13.88, FLOOR_Y + WALL_H * 0.6, 7, Math.PI / 2);
    this._painting(-8, FLOOR_Y + WALL_H * 0.6, 9.88, 0);
    this._painting(-3, FLOOR_Y + WALL_H * 0.6, 9.88, 0);

    // Small end table lamp
    this._floorLamp(-12, 1.2);
  }

  _buildKitchenFurniture() {
    // Kitchen: x:+6 to +14, z:0 to +10

    // Counter along north wall
    this._kitchenCounter(7, 13.5, 9.3);
    this._overheadCabinets(7, 13.5, 9.0);
    this._stove(9, 9.1);
    this._microwave(12, 9.1);
    this._fridge(7.5, 2);
    this._sink(11.5, 9.1);

    // Kettle and toaster on counter
    this._kettle(8.2, 9.1);
    this._toaster(10.6, 9.1);

    // Counter island — rounded edges on countertop
    const islandBody = this.box(2.2, 0.9, 1.2, 0x666666, 0.6, 0.2);
    islandBody.position.set(10, FLOOR_Y + 0.45, 5);
    this.add(islandBody);
    this.phys(2.2, 0.9, 1.2, 10, FLOOR_Y + 0.45, 5);
    // Island top — white marble look
    const islandTopMat = this.mat(0xf0f0ee, 0.2, 0.3);
    const islandTop = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.05, 1.28), islandTopMat);
    islandTop.position.set(10, FLOOR_Y + 0.925, 5);
    this.add(islandTop);

    // Stools at island
    this._kitchenStools(10, 4.4);

    // Kitchen table
    this._kitchenTable(9.5, 2.5);

    // Pendant light over island
    this._ceilingLight(10, 5, 0xffffff, 1.0, 10);

    // Plant on windowsill area
    this._indoorPlant(13.5, 1.2, 0.7);

    // Fruit bowl on island (decorative)
    const bowlMat = this.mat(0x8b6030, 0.6, 0.1);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), bowlMat);
    bowl.rotation.x = Math.PI;
    bowl.scale.y = 0.4;
    bowl.position.set(10.4, FLOOR_Y + 0.99, 5.1);
    this.add(bowl);
    // Fruit in bowl
    const fruitColors = [0xee3311, 0xff8800, 0xffdd00, 0x22aa44];
    for (let i = 0; i < 4; i++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5),
        this.mat(fruitColors[i], 0.65, 0.0));
      const ang = (i / 4) * Math.PI * 2;
      fruit.position.set(10.4 + Math.cos(ang) * 0.07, FLOOR_Y + 1.04, 5.1 + Math.sin(ang) * 0.07);
      this.add(fruit);
    }
  }

  _buildMasterBedroomFurniture() {
    // Master Bedroom: x:-14 to -2, z:-10 to 0

    this._bed(-9, -6, 2.0, 2.4);
    this._bedside(-10.3, -5);
    this._bedside(-7.7, -5);
    this._dresser(-9, -9.5, 0);
    this._wardrobe(-13.3, -3, Math.PI / 2);
    this._desk(-4.5, -7.5, Math.PI);
    this._vanity(-9, -9.78, 0);
    this._floorLamp(-3.5, -2.5);

    // Ceiling light
    this._ceilingLight(-9, -5, 0xffe0bb, 0.85, 16);

    // Indoor plant
    this._indoorPlant(-13, -1, 1.0);

    // Wall clock
    this._wallClock(-13.88, FLOOR_Y + WALL_H * 0.72, -8, Math.PI / 2);

    // Small ottoman at foot of bed
    const ottMat = this.mat(0x5a4040, 0.85, 0.0);
    const ottoman = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 14), ottMat);
    ottoman.position.set(-9, FLOOR_Y + 0.125, -3.9);
    this.add(ottoman);
    this.phys(0.64, 0.25, 0.64, -9, FLOOR_Y + 0.125, -3.9);

    // Paintings
    this._painting(-13.88, FLOOR_Y + WALL_H * 0.6, -6, Math.PI / 2);
    this._painting(-9,     FLOOR_Y + WALL_H * 0.6, -9.88, 0);

    // Locked safe — wall-mounted in corner near dresser
    this._buildSafe(-13.5, -8.5);
  }

  _buildSafe(x, z) {
    const safeMat = this.mat(0x2a2a2a, 0.4, 0.7);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.4), safeMat);
    body.position.set(x, FLOOR_Y + 0.7, z);
    this.add(body);
    this.phys(0.55, 0.45, 0.4, x, FLOOR_Y + 0.7, z);
    // Door face
    const doorMat = this.mat(0x1a1a1a, 0.35, 0.8);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.43, 0.02), doorMat);
    door.position.set(x, FLOOR_Y + 0.7, z + 0.21);
    this.add(door);
    // Handle wheel
    const wheelMat = this.mat(0xccaa44, 0.2, 0.9);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 16), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x - 0.08, FLOOR_Y + 0.7, z + 0.235);
    this.add(wheel);
    // Spokes
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), wheelMat);
      spoke.rotation.z = ang;
      spoke.position.set(x - 0.08, FLOOR_Y + 0.7, z + 0.25);
      this.add(spoke);
    }
    // Keyhole
    const holeMat = this.mat(0x111111, 0.8, 0.1);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(x + 0.14, FLOOR_Y + 0.7, z + 0.24);
    this.add(hole);
    // Red lock light
    const lockMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.8 });
    const lockLight = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), lockMat);
    lockLight.position.set(x + 0.17, FLOOR_Y + 0.82, z + 0.24);
    this.add(lockLight);
    // Register safe position for Game.js interaction
    if (!this.game._safeObjects) this.game._safeObjects = [];
    this.game._safeObjects.push({ x, y: FLOOR_Y + 0.7, z, opened: false });
  }

  _buildBedroom2Furniture() {
    // Bedroom 2: x:-2 to +6, z:-10 to 0

    this._bed(2, -7, 1.2, 2.0);
    // _monitorSetup provides the full desk surface + legs visually;
    // add a physics body manually so the player can stand on it
    this._monitorSetup(1, -9.3, 0);
    this.phys(1.2, 0.05, 0.65, 1, FLOOR_Y + 0.72, -9.3);  // desk collision only
    this._bookshelf(-1.5, -5, Math.PI / 2);
    this._dresser(5, -9, Math.PI / 2);
    this._gamingChair(1, -8, 0);

    // Ceiling light
    this._ceilingLight(2, -5, 0xffe0bb, 0.8, 14);

    // Bedside table
    this._bedside(3, -6.5);

    // Poster / painting on wall
    this._painting(2, FLOOR_Y + WALL_H * 0.6, -9.88, 0);
    this._painting(5.8, FLOOR_Y + WALL_H * 0.55, -6, Math.PI / 2);

    // Rug under bed
    const rugMat = this.mat(0x3a4a6a, 0.9, 0.0);
    const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.015, 2.8), rugMat);
    rugMesh.position.set(2, FLOOR_Y + 0.01, -6.8);
    this.add(rugMesh);
  }

  _buildBathroomFurniture() {
    // Bathroom: x:+6 to +14, z:-10 to 0

    this._bathtub(9, -9.2);
    this._toilet(13, -9, Math.PI);
    this._sink(7.5, -5, Math.PI / 2);
    this._vanity(6.12, -5, Math.PI / 2);
    this._towelRack(13.7, -7, Math.PI / 2);
    this._medicineCabinet(7.5, -9.8, 0);

    // Ceiling light — cool white for bathroom
    this._ceilingLight(10, -5, 0xddeeff, 1.0, 12);

    // Soap dish on sink
    const soapMat = this.mat(0xffeecc, 0.6, 0.05);
    const soap = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.07, 4, 8), soapMat);
    soap.rotation.z = Math.PI / 2;
    soap.position.set(7.8, FLOOR_Y + 0.99, -5.1);
    this.add(soap);

    // Towels folded on shelf
    const towelMat = this.mat(0x6699cc, 0.9, 0.0);
    const towelRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), towelMat);
    towelRoll.rotation.z = Math.PI / 2;
    towelRoll.position.set(12.5, FLOOR_Y + 0.3, -9.5);
    this.add(towelRoll);

    // Toilet paper holder
    const tpMat = this.mat(0xffffff, 0.7, 0.05);
    const tpRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), tpMat);
    tpRoll.rotation.z = Math.PI / 2;
    tpRoll.position.set(13.6, FLOOR_Y + 0.75, -7.5);
    this.add(tpRoll);
    const tpHolder = this.mat(0x888888, 0.3, 0.8);
    const tpBar = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6), tpHolder);
    tpBar.rotation.z = Math.PI / 2;
    tpBar.position.set(13.6, FLOOR_Y + 0.75, -7.5);
    this.add(tpBar);

    // Bathroom rug
    const bathRug = this.mat(0x7a8855, 0.95, 0.0);
    const bathRugMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.015, 20), bathRug);
    bathRugMesh.position.set(7.5, FLOOR_Y + 0.01, -4.0);
    this.add(bathRugMesh);
  }

  _buildLawn() {
    // Concrete path to front door
    const path = this.box(2.8, 0.06, 5, 0xb8b8b8, 0.8, 0.1);
    path.position.set(0, 0.53, 12.5);
    this.add(path);

    // Porch steps — two layers
    const step1 = this.box(4.0, 0.14, 0.7, 0x999999, 0.8, 0.1);
    step1.position.set(0, 0.57, 10.65);
    this.add(step1);
    const step2 = this.box(3.6, 0.12, 0.6, 0x888888, 0.8, 0.1);
    step2.position.set(0, 0.62, 10.35);
    this.add(step2);

    // Porch slab
    const porch = this.box(5.0, 0.1, 1.5, 0xaaaaaa, 0.85, 0.1);
    porch.position.set(0, 0.55, 9.55);
    this.add(porch);

    // Garden bushes — varied sizes and greens
    const bushColors = [0x2a5a1a, 0x336622, 0x1e4a15, 0x3a6a22];
    const bushPositions = [
      [-16, 10, 0.55, 0.75], [-16, 5, 0.45, 0.65], [-16, -5, 0.5, 0.7],
      [16, 10, 0.5, 0.7],    [16, 5, 0.45, 0.65],  [16, -5, 0.55, 0.8],
      [-5, 12.5, 0.55, 0.7], [5, 12.5, 0.5, 0.65],
      [-3, 10.8, 0.35, 0.5], [3, 10.8, 0.4, 0.55],
    ];
    for (const [bx, bz, r, h] of bushPositions) {
      const col = bushColors[Math.floor(Math.random() * bushColors.length)];
      const bushMat = this.mat(col, 0.9, 0.0);
      // Main sphere
      const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), bushMat);
      bush.position.set(bx, 0.5 + h * 0.5, bz);
      bush.scale.y = 0.7;
      this.add(bush);
      // Small bump on top
      const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 6, 5), bushMat);
      top.position.set(bx + (Math.random()-0.5)*r*0.4, 0.5 + h * 0.85, bz + (Math.random()-0.5)*r*0.4);
      top.scale.y = 0.65;
      this.add(top);
    }

    // Trees (trunk + layered canopies)
    const treeTrunkMat = this.mat(0x5a3a1e, 0.85, 0.05);
    const treePositions = [[-20, 5], [-20, -3], [20, 3], [20, -4], [-12, 16], [12, 16]];
    for (const [tx, tz] of treePositions) {
      const trunkH = 2.5 + Math.random() * 1.0;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, trunkH, 8), treeTrunkMat);
      trunk.position.set(tx, 0.5 + trunkH / 2, tz);
      this.add(trunk);
      const leafColors = [0x1e5a18, 0x256620, 0x2a7a22];
      const leafMat = this.mat(leafColors[Math.floor(Math.random() * leafColors.length)], 0.85, 0.0);
      for (let layer = 0; layer < 3; layer++) {
        const cr = 1.2 - layer * 0.25;
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(cr, 8, 6), leafMat);
        canopy.scale.y = 0.72;
        canopy.position.set(tx, 0.5 + trunkH * 0.7 + layer * 0.7, tz);
        this.add(canopy);
      }
    }

    // Mailbox near front path
    const mbPostMat = this.mat(0x2a2a2a, 0.7, 0.3);
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), mbPostMat);
    mbPost.position.set(3.5, 1.05, 15.2);
    this.add(mbPost);
    const mbMat = this.mat(0x1a3a6a, 0.5, 0.4);
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.48), mbMat);
    mbBox.position.set(3.5, 1.62, 15.2);
    this.add(mbBox);
    const mbCap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 10, 1, false, 0, Math.PI), mbMat);
    mbCap.rotation.z = Math.PI / 2;
    mbCap.position.set(3.5, 1.76, 15.2);
    this.add(mbCap);

    // Fence posts — with pointed tops
    const fencePostMat = this.mat(0xd4aa60, 0.85, 0.05);
    for (let fx = -20; fx <= 20; fx += 2.4) {
      // Skip gate opening
      if (fx > -1.5 && fx < 1.5) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.95, 6), fencePostMat);
      post.position.set(fx, 0.975, 15.5);
      this.add(post);
      // Pointed cap
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.14, 6), fencePostMat);
      cap.position.set(fx, 1.52, 15.5);
      this.add(cap);
    }
    // Fence rails
    for (const fz of [15.5]) {
      for (let fx = -20; fx <= 20; fx += 2.4) {
        if (fx > -1.5 && fx < 1.5) continue;
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), fencePostMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(fx + 1.2, 1.1, fz);
        this.add(rail);
        const rail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), fencePostMat);
        rail2.rotation.z = Math.PI / 2;
        rail2.position.set(fx + 1.2, 0.75, fz);
        this.add(rail2);
      }
    }

    // Street lamp near path
    const lampPostMat = this.mat(0x333333, 0.5, 0.6);
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.5, 8), lampPostMat);
    lampPost.position.set(-4, 2.25, 16);
    this.add(lampPost);
    const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), this.mat(0x2a2a2a, 0.5, 0.5));
    lampHead.position.set(-4, 3.8, 16);
    this.add(lampHead);
    const lampGlow = new THREE.PointLight(0xffeeaa, 1.2, 18);
    lampGlow.position.set(-4, 3.5, 16);
    this.addLight(lampGlow);
  }

  _buildCurtains() {
    // Curtain rod + drapes for every window
    // Windows: south z=10, north z=-10, west x=-14, east x=14
    const rodMat = this.mat(0x555544, 0.4, 0.7);
    const curtainColors = [0x8b4a2a, 0x4a6a8a, 0x6a4a8a, 0x4a8a5a];
    let ci = 0;

    const addCurtain = (wx, wz, axis) => {
      const col = curtainColors[ci++ % curtainColors.length];
      const cMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
      const curtainY = FLOOR_Y + WALL_H * 0.55;
      const curtainH = WALL_H * 0.72;
      const rodH = FLOOR_Y + WALL_H - 0.18;

      if (axis === 'x') {
        // Rod
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.8, 6), rodMat);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(wx, rodH, wz);
        this.add(rod);
        // Rod finials
        for (const side of [-0.9, 0.9]) {
          const fin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), rodMat);
          fin.position.set(wx + side, rodH, wz);
          this.add(fin);
        }
        // Two drape panels
        for (const side of [-0.55, 0.55]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.56, curtainH, 0.04), cMat);
          panel.position.set(wx + side, curtainY, wz);
          this.add(panel);
          // Curtain fold detail (slightly bunched)
          for (let f = 0; f < 3; f++) {
            const fold = new THREE.Mesh(new THREE.BoxGeometry(0.055, curtainH * 0.9, 0.02), cMat);
            fold.position.set(wx + side - 0.2 + f * 0.2, curtainY - 0.05, wz + 0.025);
            this.add(fold);
          }
        }
      } else {
        // Z-axis wall
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.8, 6), rodMat);
        rod.position.set(wx, rodH, wz);
        this.add(rod);
        for (const side of [-0.9, 0.9]) {
          const fin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), rodMat);
          fin.position.set(wx, rodH, wz + side);
          this.add(fin);
        }
        for (const side of [-0.55, 0.55]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, curtainH, 0.56), cMat);
          panel.position.set(wx, curtainY, wz + side);
          this.add(panel);
        }
      }
    };

    // South wall windows
    addCurtain(-8, 9.8, 'x');
    addCurtain(-4, 9.8, 'x');
    addCurtain( 9, 9.8, 'x');
    // North wall windows
    addCurtain(-9, -9.8, 'x');
    addCurtain( 0, -9.8, 'x');
    // West wall windows
    addCurtain(-13.8, -6, 'z');
    addCurtain(-13.8,  5, 'z');
    // East wall window
    addCurtain(13.8, -6, 'z');
  }

  _buildBaseboards() {
    const h = 0.1;
    const y = FLOOR_Y + h / 2;
    const mat = this.mat(0xf0ede8, 0.7, 0.05);

    const plank = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      this.add(m);
    };

    // Outer walls — interior face
    plank(0,    9.88, 28,   0.04);   // south interior
    plank(0,   -9.88, 28,   0.04);   // north interior
    plank(-13.88, 0, 0.04, 20);       // west interior
    plank( 13.88, 0, 0.04, 20);       // east interior

    // Interior partition z=0 (south face)
    plank(-14/2 + 6/2 - 4, 0.04, 8,  0.04);  // left of LR→MBR door
    plank(3, 0.04, 14, 0.04);                  // right section

    // Interior x=6 wall
    plank(6.04, 5, 0.04, 10);
    // Interior x=-2 wall
    plank(-2.04, -5, 0.04, 10);
    // Interior x=6 south (BR2→BATH)
    plank(6.04, -5, 0.04, 10);
  }

  // ─── Update (door animation) ─────────────────────────────────────────────────

  update(dt) {
    // Animate walk-through doors
    for (const door of this.doors) {
      const ud = door.userData;
      const target = ud.isOpen ? ud.targetAngle : 0;
      const diff   = target - ud.currentAngle;
      if (Math.abs(diff) > 0.001) {
        ud.currentAngle += diff * Math.min(dt * 4, 1);
        if (ud.wallAxis === 'x') {
          door.rotation.y = ud.currentAngle;
        } else {
          door.rotation.y = ud.currentAngle;
        }
      }
    }

    // Legacy room-teleport animation (for backward compat with Game.js)
    if (this._doorAnim) {
      this._doorAnim.t += dt;
      const t    = Math.min(1, this._doorAnim.t / 0.55);
      const ease = 1 - (1 - t) * (1 - t);
      if (this._doorAnim.pivot) {
        this._doorAnim.pivot.rotation.y = ease * (Math.PI * 0.67);
      }
      if (t >= 1) {
        const dest  = this._doorAnim.destination;
        const pivot = this._doorAnim.pivot;
        this._doorAnim = null;
        this._startWalkThrough(dest, pivot);
      }
      return;
    }

    if (this._walkAnim) {
      this._walkAnim.t += dt;
      const walkDur = 0.5;
      if (this._walkAnim.t <= walkDur) {
        const player = this.game.player;
        if (player?.body) {
          player.body.position.x += this._walkAnim.dir.x * 3.5 * dt;
          player.body.position.z += this._walkAnim.dir.z * 3.5 * dt;
          player.position.copy(player.body.position);
        }
        if (this._walkAnim.t > walkDur * 0.55 && !this._walkAnim.fadingStarted) {
          this._walkAnim.fadingStarted = true;
          const fade = document.getElementById('room-fade');
          if (fade) fade.classList.add('fading');
        }
      } else if (!this._walkAnim.roomChanged) {
        this._walkAnim.roomChanged = true;
        const dest = this._walkAnim.destination;
        this.changeRoom(dest);
        this._walkAnim = null;
        setTimeout(() => {
          const fade = document.getElementById('room-fade');
          if (fade) fade.classList.remove('fading');
        }, 120);
      }
    }
  }

  // ─── Legacy API (kept for backward compatibility) ─────────────────────────────

  get isAnimating() {
    return !!(this._doorAnim || this._walkAnim);
  }

  startDoorAnimation(destination) {
    if (this._doorAnim || this._walkAnim) return;
    const pivot = this.objects.find(
      o => o.isGroup && o.userData?.interactive && o.userData?.destination === destination
    );
    this._doorAnim = { pivot, destination, t: 0 };
  }

  _startWalkThrough(destination, pivot) {
    const player = this.game.player;
    let dir = new THREE.Vector3(0, 0, 1);
    if (player) {
      player.game.camera.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
      dir.normalize();
    }
    this._walkAnim = { destination, dir, t: 0, fadingStarted: false, roomChanged: false };
  }

  changeRoom(destination) {
    const spawnY = FH + 0.95;
    switch (destination) {
      case 'bedroom':
        this.loadBedroom();
        this.game.player.setPosition(0, spawnY, 0);
        break;
      case 'kitchen':
        this.loadKitchen();
        this.game.player.setPosition(0, spawnY, 0);
        break;
      case 'livingroom':
        this.loadLivingRoom();
        this.game.player.setPosition(0, spawnY, 0);
        break;
      case 'attic':
        this.loadAttic();
        this.game.player.setPosition(0, spawnY, 0);
        break;
      case 'outside':
        this.exitHouse();
        break;
    }
    if (destination !== 'outside' && this.game.player?.body) {
      this.game.player.body.velocity.set(0, 0, 0);
    }
  }

  // ─── Legacy room loaders ─────────────────────────────────────────────────────

  buildRoom(floorColor, wallColor, ceilColor) {
    this.placeBox(W, FH, D, 0, FH / 2, 0, floorColor, 0.9, 0.0);
    this.placeBox(W + T * 2, T, D + T * 2, 0, H + FH + T / 2, 0, ceilColor, 0.8, 0.0);
    this.placeBox(W + T * 2, H, T, 0, FH + H / 2,  D / 2 + T / 2, wallColor);
    this.placeBox(W + T * 2, H, T, 0, FH + H / 2, -D / 2 - T / 2, wallColor);
    this.placeBox(T, H, D, -W / 2 - T / 2, FH + H / 2, 0, wallColor);
    this.placeBox(T, H, D,  W / 2 + T / 2, FH + H / 2, 0, wallColor);
    const gnd = this.box(300, 0.5, 300, 0x2d5a1b, 0.95, 0.0);
    gnd.position.set(0, -0.25, 0);
    this.add(gnd);
    this.phys(300, 0.5, 300, 0, -0.25, 0);
    this.buildExterior(wallColor);
  }

  buildExterior(wallColor) {
    const ew = W + T * 2 + 0.2;
    const ed = D + T * 2 + 0.2;
    const eh = H + 0.5;
    const extMat = this.mat(0xc9b99a, 0.8, 0.1);
    const makeExt = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), extMat);
      m.position.set(x, y, z);
      m.castShadow    = true;
      m.receiveShadow = true;
      this.add(m);
    };
    const oy = FH + eh / 2;
    makeExt(ew + 0.4, eh, T * 0.5, 0, oy,  ed / 2 + 0.1);
    makeExt(ew + 0.4, eh, T * 0.5, 0, oy, -ed / 2 - 0.1);
    makeExt(T * 0.5, eh, ed, -ew / 2 - 0.1, oy, 0);
    makeExt(T * 0.5, eh, ed,  ew / 2 + 0.1, oy, 0);
    const roofMat = this.mat(0x3a3a3a, 0.7, 0.2);
    const roof    = new THREE.Mesh(new THREE.BoxGeometry(ew + 0.6, 0.3, ed + 0.6), roofMat);
    roof.position.set(0, FH + eh + 0.15, 0);
    roof.castShadow = true;
    this.add(roof);
  }

  roomLighting(warmth = 0xffddaa, intensity = 0.8) {
    const amb = new THREE.AmbientLight(0xffffff, 0.4);
    this.addLight(amb);
    const main = new THREE.DirectionalLight(0xffffff, 0.6);
    main.position.set(5, 6, 3);
    main.castShadow           = true;
    main.shadow.mapSize.width  = 1024;
    main.shadow.mapSize.height = 1024;
    this.addLight(main);
    const ceil = new THREE.PointLight(warmth, intensity, 12);
    ceil.position.set(0, H + FH - 0.2, 0);
    this.addLight(ceil);
  }

  _legacyAddDoor(x, z, destination, label = '') {
    const pivot = new THREE.Group();
    pivot.position.set(x - 0.6, FH, z);
    pivot.userData = { interactive: true, destination };

    const door = this.box(1.2, 2.1, T, 0x5c3d1e, 0.75, 0.05);
    door.position.set(0.6, 1.05, 0);
    pivot.add(door);

    const frameMat = this.mat(0x3a2510, 0.85, 0.05);
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, T + 0.04), frameMat);
    frameTop.position.set(x, FH + 2.16, z);
    this.add(frameTop);
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, T + 0.04), frameMat);
    frameL.position.set(x - 0.65, FH + 1.05, z);
    this.add(frameL);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, T + 0.04), frameMat);
    frameR.position.set(x + 0.65, FH + 1.05, z);
    this.add(frameR);

    const handleMat = this.mat(0xc8a000, 0.3, 0.8);
    const handle    = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.95, 1.0, T / 2 + 0.04);
    pivot.add(handle);

    this.scene.add(pivot);
    this.objects.push(pivot);
  }

  _legacyAddWindow(x, z, rotY = 0) {
    const frame = this.box(1.4, 1.0, T + 0.1, 0x2a2a2a, 0.6, 0.1);
    frame.position.set(x, FH + H / 2, z);
    frame.rotation.y = rotY;
    this.add(frame);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.85, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x88aabb, transparent: true, opacity: 0.4,
        roughness: 0.1, metalness: 0.3
      })
    );
    glass.position.set(x, FH + H / 2, z);
    glass.rotation.y = rotY;
    this.add(glass);
  }

  _legacyBed(x, z) {
    this.placeBox(1.9, 0.35, 2.3, x, FH + 0.175, z, 0x3d2b1e, 0.8, 0.05);
    this.placeBox(1.8, 0.2, 2.15, x, FH + 0.45,  z, 0x8a8a9a, 0.9, 0.0);
    const blanket = this.box(1.75, 0.12, 1.3, 0x2a4a7a, 0.9, 0.0);
    blanket.position.set(x, FH + 0.56, z - 0.35);
    this.add(blanket);
    const pillow = this.box(1.5, 0.15, 0.55, 0xddddcc, 0.9, 0.0);
    pillow.position.set(x, FH + 0.575, z + 0.78);
    this.add(pillow);
    this.placeBox(1.9, 0.7, 0.12, x, FH + 0.7, z + 1.16, 0x3d2b1e, 0.8, 0.05);
  }

  _legacyDesk(x, z) {
    this.placeBox(1.4, 0.05, 0.65, x, FH + 0.72, z, 0x5a4030, 0.75, 0.05);
    const legMat = this.mat(0x3a2a1e, 0.8, 0.1);
    for (const [dx, dz] of [[-0.6, -0.27], [0.6, -0.27], [-0.6, 0.27], [0.6, 0.27]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), legMat);
      leg.position.set(x + dx, FH + 0.35, z + dz);
      this.add(leg);
    }
    const laptop = this.box(0.35, 0.025, 0.25, 0x2a2a2a, 0.4, 0.5);
    laptop.position.set(x - 0.1, FH + 0.76, z);
    this.add(laptop);
    const screen_ = this.box(0.34, 0.22, 0.02, 0x1a1a2a, 0.4, 0.3);
    screen_.position.set(x - 0.1, FH + 0.885, z - 0.11);
    screen_.rotation.x = -0.35;
    this.add(screen_);
  }

  _legacyDresser(x, z) {
    this.placeBox(1.2, 1.1, 0.55, x, FH + 0.55, z, 0x4a3525, 0.8, 0.05);
    for (const dy of [-0.3, 0.3]) {
      const h = this.box(0.08, 0.04, 0.04, 0xaaaaaa, 0.4, 0.6);
      h.position.set(x, FH + 0.55 + dy, z + 0.28);
      this.add(h);
    }
  }

  _legacyLamp(x, z) {
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.45, 8),
      this.mat(0x222222, 0.5, 0.7)
    );
    stand.position.set(x, FH + 0.225, z);
    this.add(stand);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.28, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf5e0c0, side: THREE.DoubleSide, roughness: 0.9 })
    );
    shade.rotation.x = Math.PI;
    shade.position.set(x, FH + 0.6, z);
    this.add(shade);
    const pl = new THREE.PointLight(0xffd080, 0.6, 6);
    pl.position.set(x, FH + 0.55, z);
    this.addLight(pl);
  }

  _legacySofa(x, z) {
    this.placeBox(2.4, 0.45, 0.9, x, FH + 0.225, z, 0x4a3535, 0.9, 0.0);
    this.placeBox(2.4, 0.6, 0.15, x, FH + 0.75, z + 0.43, 0x3d2b2b, 0.9, 0.0);
    this.placeBox(0.15, 0.5, 0.9, x - 1.22, FH + 0.25, z, 0x3d2b2b, 0.9, 0.0);
    this.placeBox(0.15, 0.5, 0.9, x + 1.22, FH + 0.25, z, 0x3d2b2b, 0.9, 0.0);
    for (const dx of [-0.7, 0, 0.7]) {
      const c = this.box(0.65, 0.15, 0.75, 0x5a4545, 0.95, 0.0);
      c.position.set(x + dx, FH + 0.52, z);
      this.add(c);
    }
  }

  _legacyTV(x, z) {
    this.placeBox(1.5, 0.45, 0.45, x, FH + 0.225, z, 0x1a1a1a, 0.5, 0.4);
    this.placeBox(1.6, 0.9, 0.08, x, FH + 0.9, z, 0x0a0a0a, 0.3, 0.6);
    const screen_ = this.box(1.55, 0.85, 0.02, 0x0d1820, 0.1, 0.1);
    screen_.position.set(x, FH + 0.9, z + 0.05);
    this.add(screen_);
    const screenLight = new THREE.RectAreaLight(0x4488ff, 0.3, 1.5, 0.8);
    screenLight.position.set(x, FH + 0.9, z + 0.1);
    screenLight.lookAt(x, FH + 0.9, z + 5);
    this.addLight(screenLight);
  }

  _legacyKitchenCounter(x, z) {
    this.placeBox(2.8, 0.85, 0.65, x, FH + 0.425, z, 0x5a5a5a, 0.6, 0.3);
    this.placeBox(2.85, 0.04, 0.7, x, FH + 0.87, z, 0x888888, 0.3, 0.5);
    const stoveMat = this.mat(0x222222, 0.4, 0.6);
    for (const dx of [-0.5, 0.5]) {
      for (const dz of [-0.15, 0.15]) {
        const burner = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16), stoveMat
        );
        burner.position.set(x + dx, FH + 0.91, z + dz);
        this.add(burner);
      }
    }
  }

  _legacyFridge(x, z) {
    this.placeBox(0.75, 1.85, 0.7, x, FH + 0.925, z, 0xe0e0e0, 0.4, 0.4);
    const handle = this.box(0.06, 0.5, 0.05, 0xaaaaaa, 0.3, 0.7);
    handle.position.set(x + 0.38, FH + 1.2, z);
    this.add(handle);
  }

  _legacyShelf(x, z, rotY = 0) {
    for (let i = 0; i < 3; i++) {
      const shelf = this.box(0.9, 0.04, 0.22, 0x3a2a1e, 0.8, 0.05);
      shelf.position.set(x, FH + 0.5 + i * 0.45, z);
      shelf.rotation.y = rotY;
      this.add(shelf);
    }
  }

  _legacyStorageBox(x, z) {
    const colors = [0x8a6a4a, 0x7a6a5a, 0x9a8a6a];
    const c      = colors[Math.floor(Math.random() * colors.length)];
    this.placeBox(0.7, 0.5, 0.5, x, FH + 0.25, z, c, 0.9, 0.0);
  }

  loadAttic() {
    this.clearAll();
    this.currentRoom = 'attic';

    this.buildRoom(0x6a5a40, 0x4a3a2a, 0x3a2a1a);
    this.placeBox(W - 2, 1.2, D - 2, 0, FH + H + 0.6, 0, 0x2a1e10, 0.9, 0.0);
    this.roomLighting(0xffcc88, 0.6);

    this._legacyStorageBox(-3.5, -5);
    this._legacyStorageBox( 3.5, -5);
    this._legacyStorageBox(-3.5, -3);
    this._legacyStorageBox( 3.5, -3);
    this._legacyStorageBox( 0,    5);
    this._legacyStorageBox( 1,    5);
    this._legacyShelf(-4,  7.5);
    this._legacyShelf( 4,  7.5);

    const ropeMat = this.mat(0x5a4030, 0.9, 0.0);
    const rope    = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), ropeMat);
    rope.position.set(0, FH + H - 0.75, 0);
    this.add(rope);

    this._legacyAddDoor(0, -D / 2 + 0.05, 'livingroom', 'Living Room');
    this._legacyAddWindow(-W / 2 - 0.15, 1, Math.PI / 2);
    this._legacyAddWindow( W / 2 + 0.15, 1, Math.PI / 2);
  }

  loadBedroom() {
    this.clearAll();
    this.currentRoom = 'bedroom';

    this.buildRoom(0x7a5a38, 0x4a5568, 0xd4d4d4);
    this.roomLighting(0xffddaa, 0.8);

    this._legacyBed(-3, 3);
    this._legacyDesk(3.5, -4);
    this._legacyDresser(-3.5, -5.5);
    this._legacyLamp(3.5, -3.5);
    this._legacyShelf(4.5, -6);
    this._legacyAddWindow(-W / 2 - 0.15, 1.5, Math.PI / 2);

    this._legacyAddDoor(0,  D / 2 - 0.05, 'kitchen',    'Kitchen →');
    this._legacyAddDoor(0, -D / 2 + 0.05, 'livingroom', '← Living Room');
  }

  loadKitchen() {
    this.clearAll();
    this.currentRoom = 'kitchen';

    this.buildRoom(0xa0a0a0, 0x5a6a7a, 0xe8e8e8);
    this.roomLighting(0xffffff, 1.0);

    this._legacyKitchenCounter(3.5, -3);
    this._legacyFridge(4.3, 4);
    this._legacyShelf(-4.5, 4);
    for (const dx of [-1, 0, 1]) {
      this._legacyStorageBox(dx * 0.7 + 3, -3.3);
    }

    this._legacyAddWindow(0, -D / 2 - 0.15, 0);
    this._legacyAddWindow(0,  D / 2 + 0.15, 0);

    this._legacyAddDoor(0, -D / 2 + 0.05, 'bedroom',    '← Bedroom');
    this._legacyAddDoor(0,  D / 2 - 0.05, 'livingroom', 'Living Room →');
  }

  loadLivingRoom() {
    this.clearAll();
    this.currentRoom = 'livingroom';

    this.buildRoom(0x6a5a4a, 0x5a6a7a, 0xe0e0e0);
    this.roomLighting(0xffcc88, 0.7);

    this._legacySofa(-0.5, 3.5);
    this._legacyTV(-3.5, -3);

    const coffeeTable = this.placeBox(0.9, 0.04, 0.5, -0.5, FH + 0.3, 2, 0x4a3525, 0.75, 0.05);

    this._legacyAddWindow(-W / 2 - 0.15, -1, Math.PI / 2);
    this._legacyAddWindow( W / 2 + 0.15,  2, Math.PI / 2);

    this._legacyAddDoor(0, -D / 2 + 0.05, 'kitchen',  '← Kitchen');
    this._legacyAddDoor(0,  D / 2 - 0.05, 'outside',  'EXIT →');

    const ladderMat = this.mat(0x3a2a1e, 0.8, 0.1);
    for (let i = 0; i < 5; i++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), ladderMat);
      rung.position.set(3.8, FH + 0.5 + i * 0.5, 5);
      this.add(rung);
    }
    const ladderAccess = this.box(0.6, 0.05, 0.6, 0x1a1a1a, 0.7, 0.1);
    ladderAccess.position.set(3.8, FH + 3.0, 5);
    ladderAccess.userData = { interactive: true, destination: 'attic' };
    this.add(ladderAccess);
  }

  _spawnOutdoorLootCrates(cx, cz) {
    if (!this.game.worldItemSystem) return;
    const scene = this.scene;

    const spawnCrate = (x, z, lootPool) => {
      // Visual crate — wooden box with metal bands
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6030, roughness: 0.9 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.7 });
      const terH = this.game.terrainGenerator.getHeightAt(x, z);
      const y = isFinite(terH) ? terH : 0;

      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), woodMat);
      box.position.set(x, y + 0.25, z);
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);

      // Metal band strips
      for (const dz of [-0.2, 0, 0.2]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.02), metalMat);
        band.position.set(x, y + 0.25, z + dz + 0.26);
        scene.add(band);
      }

      // Lock hasp
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), metalMat);
      lock.position.set(x, y + 0.25, z + 0.27);
      scene.add(lock);

      // Spawn items from the pool above the crate, scaled by elapsed survival time
      const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];
      const elapsed = this.game.survivalStartTime ? (Date.now() - this.game.survivalStartTime) / 1000 : 0;
      const qualityBonus = Math.min(3, Math.floor(elapsed / 120)); // +1 item per 2 min, max +3
      const count = 2 + qualityBonus + Math.floor(Math.random() * 3);
      const wi = this.game.worldItemSystem;
      for (let i = 0; i < count; i++) {
        const type = pick(lootPool);
        const itemX = x + (Math.random()-0.5)*0.4;
        const itemZ = z + (Math.random()-0.5)*0.4;
        wi.spawnItem(type, itemX, y + 0.52, itemZ, 1);
      }
      // Bonus rare item for high-quality loot
      if (qualityBonus >= 2 && Math.random() < 0.4) {
        const rareItems = ['weapon_rifle_found','weapon_smg_found','armor_vest','medical_kit','keycard_red','explosive_grenade','gear_night_vision','med_morphine'];
        wi.spawnItem(rareItems[Math.floor(Math.random()*rareItems.length)], x, y + 0.8, z, 1);
      }
    };

    // Different crate types at varying distances
    const CRATE_DEFS = [
      { dx:  18, dz:  5,  pool: ['ammo_9mm','ammo_556','ammo_12gauge','weapon_pistol_found','bandage','food_military_ration'] },
      { dx: -15, dz:  8,  pool: ['medical_kit','med_antibiotics','med_morphine','med_blood_bag','bandage','med_suture_kit'] },
      { dx:   5, dz: 22,  pool: ['food_canned_beans','food_canned_tuna','food_bread','food_military_ration','drink_purified_water','food_protein_bar'] },
      { dx: -20, dz: -8,  pool: ['armor_vest','armor_helmet','cloth_military_jacket','cloth_boots','cloth_gloves','armor_plate'] },
      { dx:  25, dz: 15,  pool: ['weapon_rifle_found','ammo_556','weapon_crossbow','ammo_crossbow_bolt','weapon_smg_found','ammo_9mm'] },
      { dx:  -8, dz: 30,  pool: ['elec_laptop','elec_usb_drive','elec_phone','gear_gps','gear_night_vision','keycard_red'] },
      { dx:  12, dz: -12, pool: ['mat_duct_tape','mat_nails','mat_gunpowder','rope','mat_wire','tool_multitool'] },
      { dx: -25, dz: 20,  pool: ['explosive_grenade','explosive_molotov','ammo_flare','weapon_machete','weapon_axe','weapon_sledgehammer'] },
    ];

    for (const def of CRATE_DEFS) {
      const jx = (Math.random()-0.5)*6;
      const jz = (Math.random()-0.5)*6;
      try { spawnCrate(cx + def.dx + jx, cz + def.dz + jz, def.pool); }
      catch(e) { console.warn('crate spawn:', e); }
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  clearAll() {
    this.objects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this.objects = [];

    this.physBodies.forEach(body => {
      if (body !== this.game.player?.body) this.physicsWorld.removeBody(body);
    });
    this.physBodies = [];

    // Dispose procedural textures
    if (this._procTextures) {
      this._procTextures.forEach(t => t.dispose());
      this._procTextures = [];
    }
    this._wallTex = null;
    this._extWallTex = null;
    this._woodTex = null;
    this._tileTex = null;

    this.doors = [];
  }

  // ─── Exit to outside world ───────────────────────────────────────────────────

  // Called 5s after house loads — generates outdoor terrain in the background
  // so walking outside requires no scene swap at all.
  preloadOutdoorTerrain() {
    if (this._outdoorTerrainReady) return;
    this._outdoorTerrainReady = true;

    // 3×3 core chunks synchronously — these are under/around the house exit
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        try { this.game.terrainGenerator.generateChunk(dx, dz); }
        catch (e) { /* ignore */ }
      }
    }

    // Outer ring and content (buildings, trees) — spread over time, no frame spike
    const outer = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        if (Math.abs(dx) === 2 || Math.abs(dz) === 2) outer.push([dx, dz]);

    let oi = 0;
    const genOuter = () => {
      if (oi >= outer.length) return;
      const [cx, cz] = outer[oi++];
      try { this.game.terrainGenerator.generateChunk(cx, cz); } catch (e) {}
      setTimeout(genOuter, 60);
    };
    setTimeout(genOuter, 200);

    // Buildings and trees after terrain is ready
    const all = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) all.push([dx, dz]);
    let bi = 0;
    const genContent = () => {
      if (bi >= all.length) return;
      const [cx, cz] = all[bi++];
      try {
        this.game.buildingGenerator.generateBuildingsForChunk(cx, cz, 64, 16);
        this.game.treeGenerator.generateTreesForChunk(cx, cz, 64, this.game.terrainGenerator);
      } catch (e) {}
      setTimeout(genContent, 60);
    };
    setTimeout(genContent, 2500);

    // Suburban neighborhood (streets + houses) around the exit — built now, while
    // still behind the house walls, so stepping outside lands on a street.
    try { this.game.neighborhood?.build(); } catch (e) { console.error('[Neighborhood]', e); }

    // Loot crates outside
    setTimeout(() => this._spawnOutdoorLootCrates(0, 0), 3500);
  }

  exitHouse() {
    // If preload hasn't finished yet (player rushed the door), finish it now
    if (!this._outdoorTerrainReady) this.preloadOutdoorTerrain();

    // Remove the house interior — outdoor terrain is already in the world
    this.clearAll();
    this.game.worldItemSystem?.removeAll();
    this.game.inFriendHouse = false;

    // Player stays exactly where they are — no position change, no Y snap.
    // Physics drops them the small gap onto outdoor terrain naturally.

    // NPC settlement spawns far away
    setTimeout(() => {
      if (this.game.npcManager) this.game.npcManager.spawnOutdoorNPCs(0, 0);
    }, 500);
  }
}
