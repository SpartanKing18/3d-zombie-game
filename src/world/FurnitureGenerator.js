import * as THREE from 'three';

export class FurnitureGenerator {
  constructor(game) {
    this.game = game;
    this.furniture = [];
  }

  generateFurnitureForBuilding(building) {
    const furnitureCount = Math.floor(building.width * building.depth / 16);

    for (let i = 0; i < furnitureCount; i++) {
      const x = (Math.random() - 0.5) * (building.width - 2);
      const z = (Math.random() - 0.5) * (building.depth - 2);
      const y = 0.5;

      // Procedural types (crate/barrel) + model-backed types (registered in the
      // furniture manifest). Unregistered model types simply produce nothing, so
      // only keep ones that have a model.
      const types = ['table', 'chair', 'bed', 'shelf', 'crate', 'barrel',
                     'sofa', 'desk', 'cabinet', 'plant', 'lamp',
                     'fridge', 'stove', 'sink', 'toilet', 'bathtub'];
      const type = types[Math.floor(Math.random() * types.length)];

      this.createFurniture(building.x + x, building.y + y, building.z + z, type);
    }

    this._spawnBuildingLoot(building);
  }

  _spawnBuildingLoot(building) {
    const wi = this.game.worldItemSystem;
    if (!wi) return;

    // Loot table by building type — weighted entries
    const tables = {
      farmhouse: [
        { type:'food_crackers',       w:4 }, { type:'food_canned_beans',    w:3 },
        { type:'food_bread',          w:2 }, { type:'water_bottle',         w:3 },
        { type:'bandage',             w:2 }, { type:'ammo_9mm',             w:2, qty:[4,10] },
        { type:'med_pain_killers',    w:1 }, { type:'tool_flashlight',      w:1 },
        { type:'weapon_kitchen_knife',w:1 }, { type:'food_canned_soup',     w:2 },
        { type:'trap_wire_snare',     w:1 }, { type:'gear_flare',           w:1 },
      ],
      stable: [
        { type:'food_crackers',       w:3 }, { type:'mat_rope',             w:4 },
        { type:'tool_hammer',         w:2 }, { type:'bandage',              w:2 },
        { type:'food_canned_beans',   w:2 }, { type:'weapon_baseball_bat',  w:1 },
        { type:'mat_nails',           w:2 }, { type:'ammo_12gauge_buck',    w:1, qty:[2,6] },
        { type:'trap_bear_trap',      w:1 },
      ],
      barn: [
        { type:'food_crackers',       w:3 }, { type:'mat_rope',             w:3 },
        { type:'ammo_12gauge_buck',   w:2, qty:[4,8] },
        { type:'tool_flashlight',     w:1 }, { type:'bandage',              w:2 },
        { type:'food_canned_beans',   w:2 }, { type:'tool_hammer',          w:1 },
        { type:'weapon_baseball_bat', w:1 }, { type:'mat_nails',            w:2 },
        { type:'trap_bear_trap',      w:1 }, { type:'trap_wire_snare',      w:1 },
      ],
      cabin: [
        { type:'food_canned_beans',   w:3 }, { type:'water_bottle',         w:3 },
        { type:'ammo_9mm',            w:2, qty:[6,14] }, { type:'bandage',  w:2 },
        { type:'med_pain_killers',    w:1 }, { type:'tool_flashlight',      w:1 },
        { type:'food_beef_jerky',     w:2 }, { type:'weapon_crowbar',       w:1 },
        { type:'ammo_556',            w:1, qty:[4,10] }, { type:'gear_flare', w:1 },
      ],
      ranger_station: [
        { type:'ammo_308',            w:3, qty:[4,10] },
        { type:'ammo_556',            w:3, qty:[6,12] },
        { type:'bandage',             w:3 }, { type:'med_pain_killers',     w:2 },
        { type:'gear_binoculars',     w:2 }, { type:'tool_flashlight',      w:2 },
        { type:'food_beef_jerky',     w:2 }, { type:'water_bottle',         w:2 },
        { type:'gear_compass',        w:1 }, { type:'gear_gas_mask',        w:1 },
        { type:'trap_bear_trap',      w:1 }, { type:'gear_flare',           w:2 },
        { type:'trap_landmine',       w:1 }, { type:'gear_ghillie_suit',    w:1 },
        { type:'food_energy_bar',     w:2 }, { type:'tool_repair_kit',      w:1 },
        { type:'weapon_revolver',     w:1 },
      ],
      lodge: [
        { type:'food_canned_soup',    w:3 }, { type:'food_crackers',        w:3 },
        { type:'water_bottle',        w:3 }, { type:'bandage',              w:2 },
        { type:'med_pain_killers',    w:2 }, { type:'cloth_jacket',         w:1 },
        { type:'food_trail_mix',      w:2 }, { type:'gear_fire_starter',    w:1 },
        { type:'weapon_axe',          w:1 }, { type:'trap_wire_snare',      w:1 },
        { type:'gear_sleeping_bag',   w:1 },
      ],
      gas_station: [
        { type:'drink_soda',          w:4 }, { type:'food_crackers',        w:3 },
        { type:'ammo_9mm',            w:3, qty:[8,16] },
        { type:'ammo_556',            w:2, qty:[8,20] },
        { type:'bandage',             w:2 }, { type:'med_caffeine_pills',   w:2 },
        { type:'food_chips',          w:2 }, { type:'mat_duct_tape',        w:1 },
        { type:'fuel',                w:2 }, { type:'tool_flashlight',      w:1 },
        { type:'gear_flare',          w:1 }, { type:'explosive_smoke_grenade', w:1 },
        { type:'food_energy_bar',     w:2 }, { type:'tool_repair_kit',      w:1 },
      ],
      store: [
        { type:'food_canned_beans',   w:4 }, { type:'food_canned_soup',     w:3 },
        { type:'food_bread',          w:3 }, { type:'food_chips',           w:3 },
        { type:'water_bottle',        w:3 }, { type:'drink_soda',           w:2 },
        { type:'bandage',             w:2 }, { type:'food_crackers',        w:3 },
        { type:'food_cereal',         w:2 }, { type:'food_instant_noodles', w:2 },
        { type:'med_ibuprofen',       w:1 }, { type:'mat_duct_tape',        w:1 },
      ],
      motel: [
        { type:'water_bottle',        w:3 }, { type:'food_crackers',        w:3 },
        { type:'bandage',             w:3 }, { type:'med_pain_killers',     w:2 },
        { type:'cloth_jacket',        w:1 }, { type:'med_gauze',            w:2 },
        { type:'cloth_boots',         w:1 }, { type:'food_instant_noodles', w:2 },
        { type:'elec_phone',          w:1 }, { type:'gear_headlamp',        w:1 },
      ],
      watchtower: [
        { type:'ammo_308',            w:3, qty:[4,10] },
        { type:'ammo_556',            w:3, qty:[8,16] },
        { type:'bandage',             w:2 }, { type:'food_crackers',        w:2 },
        { type:'gear_binoculars',     w:2 }, { type:'weapon_pistol_found',  w:1 },
        { type:'med_pain_killers',    w:1 }, { type:'water_bottle',         w:2 },
        { type:'gear_flare',          w:2 }, { type:'elec_tracker',         w:1 },
        { type:'explosive_flash_bang',w:1 }, { type:'trap_landmine',        w:1 },
        { type:'weapon_sawed_off',    w:1 },
      ],
      shelter: [
        { type:'food_canned_beans',   w:3 }, { type:'water_bottle',         w:3 },
        { type:'bandage',             w:3 }, { type:'med_pain_killers',     w:2 },
        { type:'ammo_9mm',            w:1, qty:[4,8] },
        { type:'med_gauze',           w:2 }, { type:'food_crackers',        w:2 },
        { type:'med_antibiotics',     w:1 }, { type:'gear_gas_mask',        w:1 },
      ],
    };

    const fallback = [
      { type:'food_crackers',         w:3 }, { type:'water_bottle',         w:3 },
      { type:'bandage',               w:2 }, { type:'ammo_9mm',             w:2, qty:[4,10] },
      { type:'med_pain_killers',      w:1 }, { type:'mat_rope',             w:1 },
    ];

    const table = tables[building.type] || fallback;
    const totalW = table.reduce((s, e) => s + e.w, 0);
    const count = 3 + Math.floor(Math.random() * 3); // 3–5 items per building

    for (let i = 0; i < count; i++) {
      let r = Math.random() * totalW;
      let entry = table[0];
      for (const e of table) { r -= e.w; if (r <= 0) { entry = e; break; } }

      const ox = (Math.random() - 0.5) * Math.max(1, building.width  - 1.5);
      const oz = (Math.random() - 0.5) * Math.max(1, building.depth  - 1.5);
      const qty = entry.qty
        ? entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1))
        : 1;

      wi.spawnItem(entry.type, building.x + ox, building.y + 0.18, building.z + oz, qty);
    }
  }

  createFurniture(x, y, z, type) {
    let mesh = null;
    const group = new THREE.Group();

    // Use a downloaded furniture model if one is registered for this type.
    const model = this.game.furnitureModelLoader?.createModel?.(type);
    if (model) {
      group.add(model);
      // Procedural furniture builders put their base at local y=0 and are placed
      // at y (the floor), so the ground-aligned model uses the same y — no offset.
      group.position.set(x, y, z);
      this.game.scene.addObject(group);
      this.furniture.push({ mesh: group, type, position: { x, y, z } });
      return;
    }

    switch (type) {
      case 'table':
        mesh = this.createTable();
        break;
      case 'chair':
        mesh = this.createChair();
        break;
      case 'bed':
        mesh = this.createBed();
        break;
      case 'shelf':
        mesh = this.createShelf();
        break;
      case 'crate':
        mesh = this.createCrate();
        break;
      case 'barrel':
        mesh = this.createBarrel();
        break;
    }

    if (mesh) {
      group.add(mesh);
      group.position.set(x, y, z);
      this.game.scene.addObject(group);
      this.furniture.push({ mesh: group, type, position: { x, y, z } });
    }
  }

  createTable() {
    const group = new THREE.Group();

    const topGeometry = new THREE.BoxGeometry(2, 0.2, 1);
    const topMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9, metalness: 0 });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.75;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const legGeometry = new THREE.BoxGeometry(0.1, 0.7, 0.1);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, metalness: 0 });

    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      const offsetX = (i % 2) * 0.9 - 0.45;
      const offsetZ = Math.floor(i / 2) * 0.45 - 0.225;
      leg.position.set(offsetX, 0.35, offsetZ);
      leg.castShadow = true;
      group.add(leg);
    }

    return group;
  }

  createChair() {
    const group = new THREE.Group();

    const seatGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
    const seatMaterial = new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.9, metalness: 0 });
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.y = 0.45;
    seat.castShadow = true;
    group.add(seat);

    const backGeometry = new THREE.BoxGeometry(0.5, 0.6, 0.1);
    const back = new THREE.Mesh(backGeometry, seatMaterial);
    back.position.set(0, 0.75, -0.2);
    back.castShadow = true;
    group.add(back);

    const legGeometry = new THREE.BoxGeometry(0.08, 0.4, 0.08);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(legGeometry, seatMaterial);
      const offsetX = (i % 2) * 0.2 - 0.1;
      const offsetZ = Math.floor(i / 2) * 0.2 - 0.1;
      leg.position.set(offsetX, 0.2, offsetZ);
      leg.castShadow = true;
      group.add(leg);
    }

    return group;
  }

  createBed() {
    const group = new THREE.Group();

    const frameGeometry = new THREE.BoxGeometry(1.2, 0.2, 2);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, metalness: 0 });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.y = 0.1;
    frame.castShadow = true;
    group.add(frame);

    const mattressGeometry = new THREE.BoxGeometry(1, 0.3, 1.8);
    const mattressMaterial = new THREE.MeshStandardMaterial({ color: 0xd2691e, roughness: 0.9, metalness: 0 });
    const mattress = new THREE.Mesh(mattressGeometry, mattressMaterial);
    mattress.position.y = 0.4;
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    group.add(mattress);

    return group;
  }

  createShelf() {
    const group = new THREE.Group();

    const backGeometry = new THREE.BoxGeometry(0.5, 1.5, 0.2);
    const backMaterial = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.9, metalness: 0 });
    const back = new THREE.Mesh(backGeometry, backMaterial);
    back.position.y = 0.75;
    back.castShadow = true;
    group.add(back);

    for (let i = 0; i < 3; i++) {
      const shelfGeometry = new THREE.BoxGeometry(0.45, 0.05, 0.15);
      const shelf = new THREE.Mesh(shelfGeometry, backMaterial);
      shelf.position.y = 0.3 + i * 0.5;
      shelf.position.z = -0.1;
      shelf.castShadow = true;
      group.add(shelf);
    }

    return group;
  }

  createCrate() {
    const group = new THREE.Group();

    const crateGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9, metalness: 0 });
    const crate = new THREE.Mesh(crateGeometry, crateMaterial);
    crate.position.y = 0.3;
    crate.castShadow = true;
    crate.receiveShadow = true;
    group.add(crate);

    return group;
  }

  createBarrel() {
    const group = new THREE.Group();

    const barrelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16);
    const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9, metalness: 0 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.position.y = 0.4;
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);

    return group;
  }

  getFurniture() {
    return this.furniture;
  }

  clear() {
    this.furniture.forEach(item => {
      if (item.mesh) {
        this.game.scene.removeObject(item.mesh);
      }
    });
    this.furniture = [];
  }
}
