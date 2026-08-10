import * as THREE from 'three';

// Shared geometry cache — one geometry instance per shape key
const GEO_CACHE = {};
function geo(key, factory) {
  if (!GEO_CACHE[key]) GEO_CACHE[key] = factory();
  return GEO_CACHE[key];
}

export class WorldItemSystem {
  constructor(game) {
    this.game  = game;
    this.scene = game.scene.scene;
    this.items = [];
    this.time  = 0;
    this._id   = 0;

    this._pickupEl    = null;
    this._pickupTimer = null;
    this._respawnQueue = [];
    this._hoverCard   = null;
    this._ihcIcon     = null;
    this._ihcName     = null;
    this._ihcRarity   = null;
    this._ihcQty      = null;
    this._initPickupEl();
  }

  _initPickupEl() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'top:38%', 'left:50%',
      'transform:translate(-50%,0)',
      'font-size:17px', 'font-weight:bold',
      'pointer-events:none', 'z-index:9999',
      'text-shadow:0 0 6px currentColor',
      'opacity:0', 'transition:opacity 0.15s'
    ].join(';');
    document.body.appendChild(el);
    this._pickupEl = el;
  }

  // ─── Category ─────────────────────────────────────────────────────────────

  _category(type) {
    if (type.startsWith('ammo_'))  return 'ammo';
    if (type.startsWith('food_') || type.startsWith('drink_') || type.startsWith('meal_')) return 'food';
    if (type.startsWith('med_') || type === 'bandage' || type === 'medical_kit') return 'medical';
    if (type.startsWith('weapon_')) return 'weapon';
    if (type.startsWith('tool_'))  return 'tool';
    if (type.startsWith('elec_') || type.startsWith('gear_')) return 'gear';
    if (type.startsWith('mat_') || type === 'rope' || type === 'wood') return 'material';
    if (type.startsWith('key') || type.startsWith('armor_') || type.startsWith('cloth_')) return 'key';
    if (type.startsWith('special_')) return 'special';
    return 'default';
  }

  // Maps an item type to a category-default model key (cat_*), so items without a
  // specific model still render a sensible real model instead of the flat mesh.
  _categoryModelKey(type) {
    const t = type;
    let cat;
    if (/^weapon_/.test(t)) cat = 'weapon';
    else if (/^food_|^food$/.test(t)) cat = 'food';
    else if (/^drink_|^water_|water_bottle/.test(t)) cat = 'drink';
    else if (/^med_|^medical|bandage/.test(t)) cat = 'med';
    else if (/^ammo_/.test(t)) cat = 'ammo';
    else if (/^tool_/.test(t)) cat = 'tool';
    else if (/^gear_/.test(t)) cat = 'gear';
    else if (/^elec_/.test(t)) cat = 'elec';
    else if (/^explosive_/.test(t)) cat = 'explosive';
    else if (/^armor_/.test(t)) cat = 'armor';
    else if (/^cloth_/.test(t)) cat = 'cloth';
    else if (/^(key|keycard|lockpick|access_fob)/.test(t)) cat = 'key';
    else if (/^special_/.test(t)) cat = 'special';
    else if (t === 'wood') cat = 'wood';
    else if (/fuel/.test(t)) cat = 'fuel';
    else cat = 'mat'; // materials, ingots, ore, traps, rope, and anything else → supply crate
    return 'cat_' + cat;
  }

  _rarityGlow(type) {
    const def = this.game.inventorySystem?.itemTypes?.[type];
    switch (def?.rarity) {
      case 'common':    return { color: 0x888888, intensity: 0.10 };
      case 'uncommon':  return { color: 0x44cc44, intensity: 0.25 };
      case 'rare':      return { color: 0x4499ff, intensity: 0.35 };
      case 'epic':      return { color: 0xcc44ff, intensity: 0.50 };
      case 'legendary': return { color: 0xffaa00, intensity: 0.70 };
      default:          return { color: 0x666666, intensity: 0.10 };
    }
  }

  _rarityColor(type) { return this._rarityGlow(type).color; }
  _rarityHex(type)   { return '#' + this._rarityColor(type).toString(16).padStart(6, '0'); }

  _itemColor(type) {
    if (type.includes('apple'))           return 0xee3311;
    if (type.includes('orange'))          return 0xff8800;
    if (type.includes('banana'))          return 0xffdd00;
    if (type.includes('bread'))           return 0xcc9944;
    if (type.includes('chocolate'))       return 0x663311;
    if (type.includes('milk'))            return 0xeeeeff;
    if (type.includes('beer'))            return 0xcc8800;
    if (type.includes('purified_water') || type === 'water_bottle') return 0x88ccff;
    if (type.includes('dirty_water'))     return 0x887755;
    if (type.includes('soda'))            return 0xff4422;
    if (type.includes('coffee'))          return 0x553311;
    if (type.includes('energy_drink'))    return 0x22ff88;
    if (type.includes('mushroom'))         return 0xcc8866;
    if (type.includes('berry'))            return 0x993399;
    if (type.includes('honey'))            return 0xffaa00;
    if (type.includes('cooked_meat'))      return 0xaa5533;
    if (type.includes('military_ration'))  return 0x667744;
    if (type.includes('molotov'))          return 0xff6600;
    if (type.includes('emp_grenade'))      return 0x33ccff;  // electric cyan
    if (type.includes('grenade'))          return 0x556644;
    if (type.includes('spike_trap'))       return 0x777777;
    if (type.includes('battery'))         return 0xaabb33;
    if (type.includes('circuit_board'))   return 0x22aa44;  // green PCB
    if (type.includes('wire'))             return 0xbb7700;
    if (type.includes('blood_bag'))        return 0xcc0011;
    if (type.includes('stun_baton'))       return 0x3355ff;  // electric blue
    if (type.includes('tracker'))          return 0x22ccaa;  // teal
    if (type.includes('radio_transceiver'))return 0x557766;
    if (type.includes('laser_sight'))      return 0xff1133;
    if (type.includes('gunpowder'))        return 0x333333;
    if (type.includes('saltpeter'))        return 0xddddbb;
    if (type.includes('charcoal'))         return 0x222222;
    if (type.includes('resin'))            return 0xcc8833;
    if (type.includes('kevlar_shred'))     return 0x334433;
    if (type.includes('cdc_keycard'))      return 0x88bbff;
    if (type.includes('vaccine_dose'))     return 0x44ffcc;
    if (type.includes('military_id'))      return 0xccaa66;
    if (type.includes('black_market'))     return 0x443322;
    if (type.includes('defibrillator'))    return 0xffdd22;  // yellow
    if (type.includes('epipen'))           return 0xff8844;
    if (type.includes('suture_kit'))       return 0xffdddd;
    if (type.includes('splint'))           return 0xcc9955;
    if (type.includes('roasted_meat') || type.includes('jerky') || type.includes('pemmican')) return 0x883322;
    if (type.includes('hardtack'))         return 0xddbb88;
    if (type.includes('coconut_water'))    return 0xddfff0;
    if (type.includes('rain_water'))       return 0xaaddff;
    if (type.includes('bandage') || type.includes('gauze')) return 0xfff0e0;
    if (type === 'medical_kit')           return 0xffffff;
    if (type.includes('morphine') || type.includes('antibiotics')) return 0x88aaff;
    if (type.includes('adrenaline'))      return 0xff8844;
    if (type.includes('keycard_red'))     return 0xff2222;
    if (type.includes('keycard_blue'))    return 0x2244ff;
    if (type.includes('keycard_green'))   return 0x22aa44;
    if (type.includes('keycard_yellow'))  return 0xffcc00;
    if (type.includes('chips') || type.includes('crisps') || type.includes('popcorn')) return 0xffcc22;
    if (type.includes('smoke_grenade'))   return 0x44aa44;
    if (type.includes('flash_bang'))      return 0xddddcc;
    if (type.includes('pipe_bomb'))       return 0x774433;
    if (type.includes('bear_trap') || type.includes('wire_snare')) return 0x666655;
    if (type.includes('generator') || type.includes('solar_panel')) return 0x333344;
    if (type.includes('car_battery'))    return 0x223344;
    if (type.includes('flare_gun'))      return 0xcc4422;
    if (type.includes('nail_bat'))       return 0x8b6040;
    if (type.includes('slingshot'))      return 0x9b7040;
    if (type.includes('electric_baton')) return 0x3333aa;
    if (type.includes('compound_bow'))   return 0x556633;
    if (type.includes('canned'))          return 0x99aabb;
    if (type.includes('duct_tape'))       return 0x888888;  // silver-grey
    if (type.includes('scrap_metal'))     return 0x886655;  // rusty brown-grey
    if (type.includes('zip_ties'))        return 0xccddcc;  // pale grey-green
    if (type.includes('rope') || type.includes('twine')) return 0xaa8855;  // rope brown
    if (type.includes('energy_bar') || type.includes('trail_mix') || type.includes('protein')) return 0xdd9944;
    if (type.includes('antibiot') || type.includes('antivenom') || type.includes('caffeine_pills')) return 0xaaaaff;
    if (type.includes('survivor_note') || type.includes('journal_page') || type.includes('photograph')) return 0xeeddcc;
    if (type.includes('glass_shard'))     return 0xaaccee;  // translucent blue-grey
    if (type.includes('rubber'))          return 0x222222;
    if (type.includes('night_vision') || type.includes('binocular') || type.includes('gps')) return 0x223344;
    if (type.includes('gas_mask') || type.includes('hazmat')) return 0x334433;
    if (type.includes('flare') && !type.includes('gun')) return 0xff4400;
    if (type.includes('morphine') || type.includes('pain_killer')) return 0xddaaff;
    if (type.includes('caffeine'))        return 0xeedd88;
    if (type.includes('super_glue'))      return 0xddddff;
    if (type.includes('alcohol'))         return 0xddeeff;
    if (type.includes('map') && !type.includes('minimap')) return 0xccbb99;
    switch (this._category(type)) {
      case 'food':     return 0xcc7733;
      case 'ammo':     return 0xccaa22;
      case 'medical':  return 0xff5555;
      case 'weapon':   return 0x556677;
      case 'tool':     return 0x887744;
      case 'gear':     return 0x335577;
      case 'material': return 0x776655;
      case 'key':      return 0xffcc00;
      case 'special':  return 0xcc44ff;
      default:         return 0x888888;
    }
  }

  // ─── 3D Model Builder ─────────────────────────────────────────────────────
  // Returns a Group with composite Three.js primitive meshes.

  _mat(color, glow, roughness = 0.55, metalness = 0.15) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive:          new THREE.Color(glow.color),
      emissiveIntensity: glow.intensity,
      roughness,
      metalness,
    });
  }

  _buildModel(type, glow) {
    const root = new THREE.Group();
    const c    = this._itemColor(type);

    // Shorthand: create a mesh with a cached geometry and fresh material
    const mk = (geoKey, geoFn, color = c, r = 0.55, m = 0.15) => {
      const mesh = new THREE.Mesh(geo(geoKey, geoFn), this._mat(color, glow, r, m));
      mesh.castShadow = false;
      return mesh;
    };

    // ── Guns ────────────────────────────────────────────────────────────────
    if (/pistol|rifle|shotgun|smg|found_gun|crossbow/.test(type)) {
      const barrel = mk('g_barrel', () => new THREE.BoxGeometry(0.45, 0.07, 0.08), c, 0.3, 0.75);
      barrel.position.y = 0.035;
      const grip = mk('g_grip', () => new THREE.BoxGeometry(0.07, 0.22, 0.07), c, 0.3, 0.7);
      grip.position.set(-0.1, -0.08, 0);
      grip.rotation.z = -0.28;
      const slide = mk('g_slide', () => new THREE.BoxGeometry(0.28, 0.04, 0.07), 0x333344, 0.2, 0.9);
      slide.position.set(0.05, 0.07, 0);
      root.add(barrel, grip, slide);
      root.rotation.x = Math.PI / 2; // lay flat so it's clearly a gun

    // ── Melee: sword / knife ─────────────────────────────────────────────────
    } else if (/sword|knife|dagger/.test(type)) {
      const blade  = mk('w_blade',  () => new THREE.BoxGeometry(0.042, 0.44, 0.014), 0xd4dce4, 0.15, 0.9);
      const edge   = mk('w_edge',   () => new THREE.BoxGeometry(0.006, 0.44, 0.016), 0xffffff, 0.1, 1.0);
      edge.position.x = 0.024; // clear of blade — sits proud of it
      const guard  = mk('w_guard',  () => new THREE.BoxGeometry(0.2, 0.028, 0.028),  0xaa8833, 0.4, 0.55);
      guard.position.y = -0.1;
      const handle = mk('w_handle', () => new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), 0x6b3f1e, 0.85, 0);
      handle.position.y = -0.24;
      const pommel = mk('w_pommel', () => new THREE.SphereGeometry(0.032, 6, 5), 0xaa8833, 0.4, 0.55);
      pommel.position.y = -0.34;
      root.add(blade, edge, guard, handle, pommel);

    // ── Spear ────────────────────────────────────────────────────────────────
    } else if (/spear|lance/.test(type)) {
      const shaft = mk('sp_shaft', () => new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6), 0x8b6040, 0.9, 0);
      const tip   = mk('sp_tip',   () => new THREE.ConeGeometry(0.038, 0.14, 6), 0xd4dce4, 0.15, 0.9);
      tip.position.y = 0.42;
      root.add(shaft, tip);

    // ── Bow ──────────────────────────────────────────────────────────────────
    } else if (/bow/.test(type)) {
      const arc = mk('bow_arc', () => new THREE.TorusGeometry(0.2, 0.018, 6, 14, Math.PI * 1.05), 0x8b6040, 0.9, 0);
      arc.rotation.z = Math.PI / 2;
      const str = mk('bow_str', () => new THREE.CylinderGeometry(0.004, 0.004, 0.38, 4), 0xddcc99, 0.9, 0);
      root.add(arc, str);

    // ── Axe ──────────────────────────────────────────────────────────────────
    } else if (/axe|hatchet/.test(type)) {
      const hnd  = mk('ax_hnd',  () => new THREE.CylinderGeometry(0.024, 0.024, 0.5, 6), 0x8b6040, 0.9, 0);
      const head = mk('ax_head', () => new THREE.BoxGeometry(0.16, 0.2, 0.04), c, 0.3, 0.7);
      head.position.set(0.1, 0.18, 0);
      root.add(hnd, head);

    // ── Flare gun ────────────────────────────────────────────────────────────
    } else if (/flare_gun/.test(type)) {
      const barrel = mk('fg_barrel', () => new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), 0x884422, 0.4, 0.5);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.05, 0.02, 0);
      const grip = mk('fg_grip', () => new THREE.BoxGeometry(0.06, 0.16, 0.06), 0x553311, 0.7, 0.1);
      grip.position.set(-0.03, -0.06, 0);
      const guard = mk('fg_guard', () => new THREE.TorusGeometry(0.045, 0.009, 4, 10, Math.PI), 0x553311, 0.7, 0.1);
      guard.position.set(-0.03, -0.002, 0);
      root.add(barrel, grip, guard);

    // ── Nail bat ─────────────────────────────────────────────────────────────
    } else if (/nail_bat/.test(type)) {
      const bat = mk('nb_bat', () => new THREE.CylinderGeometry(0.04, 0.025, 0.58, 7), 0x8b6040, 0.85, 0.05);
      const nail1 = mk('nb_nail1', () => new THREE.CylinderGeometry(0.006, 0.006, 0.1, 4), 0xaaaaaa, 0.2, 0.9);
      nail1.position.set(0.048, 0.18, 0);
      const nail2 = mk('nb_nail2', () => new THREE.CylinderGeometry(0.006, 0.006, 0.1, 4), 0xaaaaaa, 0.2, 0.9);
      nail2.rotation.z = Math.PI / 2;
      nail2.position.set(0, 0.22, 0.048);
      const nail3 = mk('nb_nail3', () => new THREE.CylinderGeometry(0.006, 0.006, 0.1, 4), 0xaaaaaa, 0.2, 0.9);
      nail3.position.set(-0.048, 0.28, 0);
      root.add(bat, nail1, nail2, nail3);

    // ── Slingshot ─────────────────────────────────────────────────────────────
    } else if (/slingshot/.test(type)) {
      const handle = mk('ss_handle', () => new THREE.CylinderGeometry(0.02, 0.025, 0.22, 6), 0x8b6040, 0.85, 0.05);
      const forkL = mk('ss_forkL', () => new THREE.CylinderGeometry(0.014, 0.014, 0.14, 5), 0x8b6040, 0.85, 0.05);
      forkL.position.set(-0.055, 0.17, 0);
      forkL.rotation.z = 0.45;
      const forkR = mk('ss_forkR', () => new THREE.CylinderGeometry(0.014, 0.014, 0.14, 5), 0x8b6040, 0.85, 0.05);
      forkR.position.set(0.055, 0.17, 0);
      forkR.rotation.z = -0.45;
      const band = mk('ss_band', () => new THREE.BoxGeometry(0.14, 0.008, 0.008), 0xcc8844, 0.8, 0.05);
      band.position.y = 0.24;
      const pouch = mk('ss_pouch', () => new THREE.BoxGeometry(0.04, 0.028, 0.022), 0x8b6040, 0.8, 0.05);
      pouch.position.y = 0.24;
      root.add(handle, forkL, forkR, band, pouch);

    // ── Electric / stun baton ─────────────────────────────────────────────────
    } else if (/electric_baton|stun_baton/.test(type)) {
      const body = mk('eb_body', () => new THREE.CylinderGeometry(0.026, 0.032, 0.5, 8), 0x222266, 0.4, 0.55);
      const tip1 = mk('eb_tip1', () => new THREE.CylinderGeometry(0.007, 0.007, 0.07, 4), 0xaaaacc, 0.2, 0.9);
      tip1.position.set(0.018, 0.29, 0);
      const tip2 = mk('eb_tip2', () => new THREE.CylinderGeometry(0.007, 0.007, 0.07, 4), 0xaaaacc, 0.2, 0.9);
      tip2.position.set(-0.018, 0.29, 0);
      const arc = mk('eb_arc', () => new THREE.TorusGeometry(0.018, 0.005, 4, 8, Math.PI), 0x88ccff, 0.3, 0.1);
      arc.position.set(0, 0.32, 0);
      arc.rotation.z = Math.PI / 2;
      const grip = mk('eb_grip', () => new THREE.CylinderGeometry(0.032, 0.03, 0.15, 8, 1, true), 0x111122, 0.7, 0.2);
      grip.position.y = -0.18;
      root.add(body, tip1, tip2, arc, grip);

    // ── Generic melee ────────────────────────────────────────────────────────
    } else if (this._category(type) === 'weapon') {
      const bat = mk('w_bat', () => new THREE.CylinderGeometry(0.034, 0.022, 0.55, 7), c, 0.75, 0.1);
      root.add(bat);

    // ── Apple / orange ───────────────────────────────────────────────────────
    } else if (/apple|orange/.test(type)) {
      const body = mk('fruit_sph', () => new THREE.SphereGeometry(0.13, 10, 8), c, 0.65, 0);
      const stem = mk('fruit_stem', () => new THREE.CylinderGeometry(0.011, 0.008, 0.065, 4), 0x5a3a1a, 0.9, 0);
      stem.position.y = 0.165;
      const leaf = mk('fruit_leaf', () => new THREE.BoxGeometry(0.062, 0.005, 0.04), 0x228833, 0.9, 0);
      leaf.position.set(0.04, 0.19, 0);
      leaf.rotation.z = 0.4;
      root.add(body, stem, leaf);

    // ── Banana ───────────────────────────────────────────────────────────────
    } else if (/banana/.test(type)) {
      const body = mk('banana', () => new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), 0xffdd00, 0.75, 0);
      body.rotation.z = 0.55;
      const tip1 = mk('banana_t1', () => new THREE.SphereGeometry(0.04, 5, 4), 0x776600, 0.9, 0);
      tip1.position.set(0.1, 0.1, 0);
      const tip2 = mk('banana_t2', () => new THREE.SphereGeometry(0.04, 5, 4), 0x776600, 0.9, 0);
      tip2.position.set(-0.08, -0.1, 0);
      root.add(body, tip1, tip2);

    // ── Bread ────────────────────────────────────────────────────────────────
    } else if (/bread|loaf/.test(type)) {
      const loaf = mk('bread', () => new THREE.CapsuleGeometry(0.07, 0.22, 4, 8), c, 0.9, 0);
      loaf.rotation.z = Math.PI / 2;
      const score1 = mk('bread_s1', () => new THREE.BoxGeometry(0.005, 0.08, 0.075), 0xaa7733, 0.95, 0);
      score1.position.set(0.078, 0, 0); // just outside capsule surface
      const score2 = mk('bread_s2', () => new THREE.BoxGeometry(0.005, 0.08, 0.075), 0xaa7733, 0.95, 0);
      score2.position.set(-0.078, 0, 0);
      root.add(loaf, score1, score2);

    // ── Wine / whiskey / rum bottle ──────────────────────────────────────────
    } else if (/wine|whiskey|rum/.test(type)) {
      const body = mk('wine_body', () => new THREE.CylinderGeometry(0.048, 0.06, 0.3, 10), c, 0.15, 0.35);
      const shoulder = mk('wine_shldr', () => new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI*2, 0, Math.PI/2), c, 0.15, 0.35);
      shoulder.position.y = 0.15;
      const neck = mk('wine_neck', () => new THREE.CylinderGeometry(0.022, 0.048, 0.12, 8), c, 0.15, 0.35);
      neck.position.y = 0.26;
      const cap  = mk('wine_cap',  () => new THREE.CylinderGeometry(0.026, 0.026, 0.04, 8), 0x444444, 0.5, 0.3);
      cap.position.y = 0.345;
      root.add(body, shoulder, neck, cap);

    // ── Lighter ──────────────────────────────────────────────────────────────
    } else if (/lighter|matches/.test(type)) {
      const body = mk('lighter_body', () => new THREE.BoxGeometry(0.04, 0.1, 0.022), c, 0.4, 0.3);
      const top = mk('lighter_top', () => new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), 0x888888, 0.3, 0.8);
      top.position.y = 0.065;
      const flame = mk('lighter_flame', () => new THREE.ConeGeometry(0.008, 0.025, 6), 0xff8800, 0.3, 0);
      flame.position.y = 0.092;
      root.add(body, top, flame);

    // ── Canteen ──────────────────────────────────────────────────────────────
    } else if (/canteen/.test(type)) {
      const body = mk('canteen_body', () => new THREE.CylinderGeometry(0.058, 0.065, 0.18, 10), c, 0.55, 0.3);
      body.scale.z = 0.7;
      const cap = mk('canteen_cap', () => new THREE.CylinderGeometry(0.028, 0.035, 0.03, 8), 0x555555, 0.4, 0.5);
      cap.position.y = 0.105;
      const strap = mk('canteen_strap', () => new THREE.TorusGeometry(0.072, 0.008, 4, 10), 0x663322, 0.8, 0);
      strap.rotation.x = Math.PI / 2;
      strap.position.y = 0.03;
      root.add(body, cap, strap);

    // ── Photo / diary ────────────────────────────────────────────────────────
    } else if (/photo|diary|recipe_book|house_plan/.test(type)) {
      const cover = mk('book_cover', () => new THREE.BoxGeometry(0.2, 0.26, 0.025), c, 0.7, 0.05);
      const pages = mk('book_pages', () => new THREE.BoxGeometry(0.18, 0.24, 0.018), 0xf5f0e8, 0.9, 0);
      pages.position.set(0.002, 0, 0.022);
      root.add(cover, pages);

    // ── Candles ──────────────────────────────────────────────────────────────
    } else if (/candle/.test(type)) {
      const stick = mk('candle_stick', () => new THREE.CylinderGeometry(0.025, 0.028, 0.18, 8), 0xf5e8c0, 0.8, 0);
      const wick = mk('candle_wick', () => new THREE.CylinderGeometry(0.003, 0.003, 0.025, 4), 0x222222, 0.9, 0);
      wick.position.y = 0.102;
      const flame = mk('candle_flame', () => new THREE.ConeGeometry(0.01, 0.035, 6), 0xff8800, 0.3, 0);
      flame.position.y = 0.125;
      root.add(stick, wick, flame);

    // ── Bottle / drink ───────────────────────────────────────────────────────
    } else if (/drink_|water_bottle|water|milk|juice|soda|beer|energy|coffee|tea|cocoa/.test(type)) {
      const body = mk('btl_body', () => new THREE.CylinderGeometry(0.055, 0.065, 0.22, 10), c, 0.2, 0.05);
      const neck = mk('btl_neck', () => new THREE.CylinderGeometry(0.028, 0.05, 0.068, 8), c, 0.2, 0.05);
      neck.position.y = 0.144;
      const cap  = mk('btl_cap',  () => new THREE.CylinderGeometry(0.032, 0.032, 0.024, 8), 0x222222, 0.5, 0.2);
      cap.position.y = 0.19;
      root.add(body, neck, cap);

    // ── Chips / crisp bag ────────────────────────────────────────────────────
    } else if (/chips|crisps|popcorn/.test(type)) {
      const bag    = mk('chips_bag',  () => new THREE.BoxGeometry(0.13, 0.23, 0.06),  c, 0.55, 0.05);
      const topSeal = mk('chips_top', () => new THREE.BoxGeometry(0.1, 0.03, 0.056), 0xffffff, 0.65, 0.0);
      topSeal.position.y = 0.13;
      topSeal.scale.x = 0.88;
      const logo   = mk('chips_logo', () => new THREE.BoxGeometry(0.14, 0.065, 0.065), 0xffd700, 0.5, 0.05);
      logo.position.y = 0.025;
      const botSeal = mk('chips_bot', () => new THREE.BoxGeometry(0.1, 0.03, 0.056), 0xffffff, 0.65, 0.0);
      botSeal.position.y = -0.13;
      botSeal.scale.x = 0.88;
      root.add(bag, topSeal, logo, botSeal);

    // ── Canned food ──────────────────────────────────────────────────────────
    } else if (this._category(type) === 'food') {
      const can = mk('can_body', () => new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), c, 0.45, 0.35);
      const lid = mk('can_lid',  () => new THREE.CylinderGeometry(0.089, 0.089, 0.008, 12), 0xcccccc, 0.3, 0.5);
      lid.position.y = 0.078;
      const ring = mk('can_ring', () => new THREE.TorusGeometry(0.076, 0.007, 4, 12), 0xaaaaaa, 0.3, 0.6);
      ring.position.y = 0.083;
      root.add(can, lid, ring);

    // ── Bandage ───────────────────────────────────────────────────────────────
    } else if (/bandage|gauze/.test(type)) {
      const roll  = mk('bandage_roll',  () => new THREE.CylinderGeometry(0.065, 0.065, 0.1, 10), 0xf5e6d0, 0.9, 0);
      roll.rotation.z = Math.PI / 2;
      const strip = mk('bandage_strip', () => new THREE.BoxGeometry(0.1, 0.006, 0.065), 0xfff5ee, 0.9, 0);
      strip.position.x = 0.065;
      root.add(roll, strip);

    // ── Syringe (morphine / antibiotics) ─────────────────────────────────────
    } else if (/morphine|antibiotics|syringe|inject/.test(type)) {
      const barrel  = mk('syr_barrel',  () => new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), 0xddeeff, 0.2, 0.1);
      const fluid   = mk('syr_fluid',   () => new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8), c, 0.3, 0.0);
      fluid.position.y = -0.02;
      const plunger = mk('syr_plunger', () => new THREE.CylinderGeometry(0.022, 0.022, 0.025, 8), 0xaaaaaa, 0.4, 0.4);
      plunger.position.y = -0.17;
      const rod     = mk('syr_rod',     () => new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6), 0xaaaaaa, 0.4, 0.4);
      rod.position.y = -0.24;
      const needle  = mk('syr_needle',  () => new THREE.CylinderGeometry(0.004, 0.004, 0.07, 4), 0xbbbbbb, 0.15, 0.9);
      needle.position.y = 0.175;
      root.add(barrel, fluid, plunger, rod, needle);

    // ── Adrenaline pen ────────────────────────────────────────────────────────
    } else if (/adrenaline/.test(type)) {
      const pen = mk('adr_pen', () => new THREE.CylinderGeometry(0.028, 0.028, 0.24, 8), 0xff7700, 0.35, 0.2);
      const tip = mk('adr_tip', () => new THREE.ConeGeometry(0.028, 0.06, 8), 0xffaa44, 0.4, 0.2);
      tip.position.y = -0.15;
      tip.rotation.z = Math.PI;
      const band = mk('adr_band', () => new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8), 0x333333, 0.4, 0.3);
      band.position.y = 0.06;
      root.add(pen, tip, band);

    // ── Blood bag ─────────────────────────────────────────────────────────────
    } else if (/blood_bag/.test(type)) {
      // Soft bag — slightly bulged box with rounded edges implied by scale
      const bag  = mk('blood_bag',  () => new THREE.BoxGeometry(0.15, 0.22, 0.042), 0xcc0011, 0.6, 0.1);
      // Rounded corners via sphere on each corner
      const cornerMat = this._mat(0xcc0011, { color: 0xcc0011, intensity: 0 }, 0.6, 0.1);
      for (const [cx, cy] of [[-0.065,0.09],[0.065,0.09],[-0.065,-0.09],[0.065,-0.09]]) {
        const corner = new THREE.Mesh(new THREE.SphereGeometry(0.032, 5, 4), cornerMat);
        corner.scale.z = 1.3;
        corner.position.set(cx, cy, 0);
        root.add(corner);
      }
      const tube = mk('blood_tube', () => new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), 0xcc3333, 0.6, 0.1);
      tube.position.set(0, -0.16, 0);
      root.add(bag, tube);

    // ── Medical kit ───────────────────────────────────────────────────────────
    } else if (type === 'medical_kit') {
      const box   = mk('mkit_box', () => new THREE.BoxGeometry(0.3, 0.15, 0.22), 0xffffff, 0.8, 0);
      const crossH = mk('mkit_cH', () => new THREE.BoxGeometry(0.2, 0.035, 0.025), 0xff2222, 0.8, 0);
      const crossV = mk('mkit_cV', () => new THREE.BoxGeometry(0.035, 0.13, 0.025), 0xff2222, 0.8, 0);
      crossH.position.z = 0.125; // well proud of box face (box half-depth = 0.11)
      crossV.position.z = 0.125;
      const latch = mk('mkit_latch', () => new THREE.BoxGeometry(0.06, 0.025, 0.015), 0xcccccc, 0.3, 0.6);
      latch.position.set(0, 0, 0.115);
      root.add(box, crossH, crossV, latch);

    // ── Generic medicine (pill bottle) ────────────────────────────────────────
    } else if (this._category(type) === 'medical') {
      const bottle = mk('pill_bottle', () => new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), 0xffa0a0, 0.55, 0.1);
      const cap    = mk('pill_cap',    () => new THREE.CylinderGeometry(0.056, 0.056, 0.038, 8), 0xffffff, 0.55, 0);
      cap.position.y = 0.089;
      const label  = mk('pill_label',  () => new THREE.CylinderGeometry(0.051, 0.051, 0.08, 8, 1, true), 0xffffff, 0.9, 0);
      root.add(bottle, cap, label);

    // ── Ammo box ─────────────────────────────────────────────────────────────
    } else if (this._category(type) === 'ammo') {
      const box    = mk('ammo_box',    () => new THREE.BoxGeometry(0.22, 0.1, 0.15), c, 0.5, 0.35);
      const stripe = mk('ammo_stripe', () => new THREE.BoxGeometry(0.24, 0.018, 0.03), 0xff4400, 0.65, 0);
      stripe.position.set(0, 0.03, 0.09);
      const lid    = mk('ammo_lid',    () => new THREE.BoxGeometry(0.22, 0.014, 0.15), 0x445566, 0.35, 0.5);
      lid.position.y = 0.057;
      root.add(box, stripe, lid);
      root.rotation.x = Math.PI / 2;

    // ── Wrench / tool ─────────────────────────────────────────────────────────
    } else if (this._category(type) === 'tool') {
      const handle = mk('tool_hnd', () => new THREE.CylinderGeometry(0.024, 0.024, 0.4, 7), c, 0.3, 0.65);
      const jaw1   = mk('tool_jaw1', () => new THREE.BoxGeometry(0.12, 0.05, 0.04), c, 0.3, 0.7);
      jaw1.position.set(0.02, 0.22, 0);
      const jaw2   = mk('tool_jaw2', () => new THREE.BoxGeometry(0.09, 0.04, 0.04), c, 0.3, 0.7);
      jaw2.position.set(0.025, 0.17, 0);
      root.add(handle, jaw1, jaw2);

    // ── Rope ─────────────────────────────────────────────────────────────────
    } else if (type === 'rope') {
      const coil  = mk('rope_coil',  () => new THREE.TorusGeometry(0.1, 0.022, 6, 16), 0xcc9944, 0.9, 0);
      coil.rotation.x = Math.PI / 2;
      const coil2 = mk('rope_coil2', () => new THREE.TorusGeometry(0.07, 0.018, 6, 14), 0xbb8833, 0.9, 0);
      coil2.rotation.x = Math.PI / 2;
      coil2.position.y = 0.02;
      root.add(coil, coil2);

    // ── Wood plank ────────────────────────────────────────────────────────────
    } else if (type === 'wood') {
      const plank = mk('wood_plank', () => new THREE.BoxGeometry(0.4, 0.07, 0.12), 0x9b6b3a, 0.9, 0);
      const grain = mk('wood_grain', () => new THREE.BoxGeometry(0.42, 0.005, 0.02), 0x7a5020, 0.95, 0);
      grain.position.set(0, 0.035, 0.02);
      root.add(plank, grain);
      root.rotation.x = Math.PI / 2;

    // ── Metal ingot ───────────────────────────────────────────────────────────
    } else if (/ingot_/.test(type)) {
      const bar = mk('ingot', () => new THREE.BoxGeometry(0.26, 0.08, 0.12), c, 0.3, 0.75);
      const bevel = mk('ingot_top', () => new THREE.BoxGeometry(0.2, 0.01, 0.08), 0xffffff, 0.15, 1.0);
      bevel.position.y = 0.05; // clear of ingot top face (0.04)
      root.add(bar, bevel);
      root.rotation.x = Math.PI / 2;

    // ── Ore ───────────────────────────────────────────────────────────────────
    } else if (/ore_/.test(type)) {
      const rock  = mk('ore_rock',  () => new THREE.DodecahedronGeometry(0.12, 0), c, 0.55, 0.4);
      const vein  = mk('ore_vein',  () => new THREE.DodecahedronGeometry(0.07, 0), 0xffffff, 0.2, 0.8);
      vein.position.set(0.06, 0.06, 0.05);
      root.add(rock, vein);

    // ── Generic material ──────────────────────────────────────────────────────
    } else if (this._category(type) === 'material') {
      const chunk = mk('mat_chunk', () => new THREE.BoxGeometry(0.18, 0.1, 0.14), c, 0.7, 0.15);
      root.add(chunk);

    // ── Circuit board / gear ──────────────────────────────────────────────────
    } else if (this._category(type) === 'gear') {
      const board = mk('gear_board', () => new THREE.BoxGeometry(0.26, 0.055, 0.2), 0x1a4422, 0.6, 0.1);
      const chip1 = mk('gear_chip',  () => new THREE.BoxGeometry(0.065, 0.028, 0.065), 0x111111, 0.3, 0.5);
      chip1.position.set(0.07, 0.04, 0.04);
      const chip2 = mk('gear_chip',  () => new THREE.BoxGeometry(0.065, 0.028, 0.065), 0x111111, 0.3, 0.5);
      chip2.position.set(-0.05, 0.04, -0.04);
      const cap1  = mk('gear_cap',   () => new THREE.CylinderGeometry(0.015, 0.015, 0.03, 6), 0x3366aa, 0.4, 0.3);
      cap1.position.set(0.07, 0.04, -0.05);
      const cap2  = mk('gear_cap',   () => new THREE.CylinderGeometry(0.015, 0.015, 0.03, 6), 0x3366aa, 0.4, 0.3);
      cap2.position.set(-0.05, 0.04, 0.05);
      root.add(board, chip1, chip2, cap1, cap2);
      root.rotation.x = Math.PI / 2;

    // ── Keycard ───────────────────────────────────────────────────────────────
    } else if (/keycard/.test(type)) {
      const card  = mk('keycard',      () => new THREE.BoxGeometry(0.22, 0.14, 0.012), c, 0.45, 0.1);
      const chip  = mk('keycard_chip', () => new THREE.BoxGeometry(0.055, 0.04, 0.015), 0xddcc55, 0.25, 0.7);
      chip.position.set(-0.06, 0.02, 0);
      const strip = mk('keycard_str',  () => new THREE.BoxGeometry(0.22, 0.025, 0.015), 0x222222, 0.4, 0.5);
      strip.position.set(0, -0.04, 0);
      root.add(card, chip, strip);

    // ── Armor vest ────────────────────────────────────────────────────────────
    } else if (/armor_vest|armor_plate/.test(type)) {
      const body  = mk('vest_body',  () => new THREE.BoxGeometry(0.32, 0.38, 0.07), c, 0.65, 0.2);
      const plate = mk('vest_plate', () => new THREE.BoxGeometry(0.22, 0.28, 0.09), 0x333344, 0.35, 0.6);
      root.add(body, plate);

    // ── Cloth / worn armor ────────────────────────────────────────────────────
    } else if (this._category(type) === 'key') {
      const card = mk('key_card', () => new THREE.BoxGeometry(0.22, 0.14, 0.012), c, 0.45, 0.1);
      root.add(card);

    // ── Mushroom ─────────────────────────────────────────────────────────────
    } else if (/mushroom/.test(type)) {
      const stem = mk('mush_stem', () => new THREE.CylinderGeometry(0.04, 0.06, 0.16, 6), 0xeeddcc, 0.8, 0);
      const cap  = mk('mush_cap',  () => new THREE.SphereGeometry(0.14, 8, 6), c, 0.65, 0);
      cap.scale.y = 0.55;
      cap.position.y = 0.12;
      root.add(stem, cap);

    // ── Molotov cocktail ──────────────────────────────────────────────────────
    } else if (/molotov/.test(type)) {
      const btl  = mk('molotov_btl',  () => new THREE.CylinderGeometry(0.045, 0.06, 0.22, 8), 0x88aa44, 0.3, 0.1);
      const neck = mk('molotov_neck', () => new THREE.CylinderGeometry(0.022, 0.04, 0.07, 8), 0x88aa44, 0.3, 0.1);
      neck.position.y = 0.145;
      const rag  = mk('molotov_rag',  () => new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), 0xcc7722, 0.9, 0);
      rag.position.y = 0.22;
      const flame = mk('molotov_flm', () => new THREE.ConeGeometry(0.03, 0.08, 6), 0xff6600, 0.5, 0);
      flame.position.y = 0.30;
      root.add(btl, neck, rag, flame);

    // ── EMP Grenade ───────────────────────────────────────────────────────────
    } else if (/emp_grenade/.test(type)) {
      const body  = mk('emp_body',  () => new THREE.CylinderGeometry(0.07, 0.065, 0.16, 8), 0x223344, 0.4, 0.6);
      const ring  = mk('emp_ring',  () => new THREE.TorusGeometry(0.075, 0.009, 4, 10), 0x33ccff, 0.3, 0.3);
      ring.position.y = 0.03;
      const ant1  = mk('emp_ant1',  () => new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), 0xaaccff, 0.4, 0.5);
      ant1.position.set(0.035, 0.12, 0);
      const ant2  = mk('emp_ant2',  () => new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), 0xaaccff, 0.4, 0.5);
      ant2.position.set(-0.035, 0.12, 0);
      const pin   = mk('emp_pin',   () => new THREE.TorusGeometry(0.038, 0.008, 4, 8), 0x33ccff, 0.3, 0.5);
      pin.position.y = 0.09; pin.rotation.x = Math.PI / 2;
      root.add(body, ring, ant1, ant2, pin);

    // ── Defibrillator ─────────────────────────────────────────────────────────
    } else if (/defibrillator/.test(type)) {
      const box   = mk('def_box',  () => new THREE.BoxGeometry(0.28, 0.18, 0.1), 0xffdd22, 0.5, 0.1);
      const screen = mk('def_scr', () => new THREE.BoxGeometry(0.12, 0.08, 0.015), 0x112233, 0.4, 0.1);
      screen.position.set(-0.04, 0.03, 0.058);
      const padL  = mk('def_padL', () => new THREE.BoxGeometry(0.07, 0.025, 0.065), 0x222222, 0.5, 0.4);
      padL.position.set(-0.08, -0.06, 0);
      const padR  = mk('def_padR', () => new THREE.BoxGeometry(0.07, 0.025, 0.065), 0x222222, 0.5, 0.4);
      padR.position.set(0.08, -0.06, 0);
      const cord  = mk('def_cord', () => new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), 0x333333, 0.7, 0.1);
      cord.rotation.z = Math.PI / 2; cord.position.set(0, -0.06, 0);
      root.add(box, screen, padL, padR, cord);

    // ── Epipen ────────────────────────────────────────────────────────────────
    } else if (/epipen/.test(type)) {
      const pen   = mk('epi_pen',  () => new THREE.CylinderGeometry(0.022, 0.025, 0.22, 8), 0xff8844, 0.35, 0.2);
      const cap   = mk('epi_cap',  () => new THREE.CylinderGeometry(0.026, 0.026, 0.06, 8), 0xcc5533, 0.35, 0.2);
      cap.position.y = 0.14;
      const needle = mk('epi_ndl', () => new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), 0xbbbbbb, 0.15, 0.9);
      needle.position.y = -0.14;
      const label = mk('epi_lbl',  () => new THREE.CylinderGeometry(0.023, 0.023, 0.1, 8, 1, true), 0xffffff, 0.9, 0);
      label.position.y = 0.02;
      root.add(pen, cap, needle, label);

    // ── Grenade ───────────────────────────────────────────────────────────────
    } else if (/explosive_grenade|pipe_bomb|flash_bang/.test(type)) {
      const body = mk('gren_body', () => new THREE.CylinderGeometry(0.08, 0.07, 0.18, 8), c, 0.5, 0.5);
      const pin  = mk('gren_pin',  () => new THREE.TorusGeometry(0.04, 0.008, 4, 8), 0xdddd44, 0.3, 0.8);
      pin.position.y = 0.10;
      pin.rotation.x = Math.PI / 2;
      const lever = mk('gren_lev', () => new THREE.BoxGeometry(0.14, 0.018, 0.025), 0xdddd44, 0.3, 0.8);
      lever.position.y = 0.095;
      root.add(body, pin, lever);

    // ── Smoke grenade ─────────────────────────────────────────────────────────
    } else if (/smoke_grenade/.test(type)) {
      const body = mk('smk_body', () => new THREE.CylinderGeometry(0.07, 0.07, 0.2, 10), 0x44aa44, 0.5, 0.35);
      const band = mk('smk_band', () => new THREE.CylinderGeometry(0.075, 0.075, 0.025, 10), 0xffffff, 0.5, 0.15);
      band.position.y = 0.04;
      const top  = mk('smk_top',  () => new THREE.CylinderGeometry(0.04, 0.065, 0.065, 8), 0x44aa44, 0.5, 0.35);
      top.position.y = 0.133;
      const vent1 = mk('smk_v1', () => new THREE.CylinderGeometry(0.007, 0.007, 0.05, 5), 0x222222, 0.5, 0.3);
      vent1.position.set(0.025, 0.185, 0);
      const vent2 = mk('smk_v2', () => new THREE.CylinderGeometry(0.007, 0.007, 0.05, 5), 0x222222, 0.5, 0.3);
      vent2.position.set(-0.025, 0.185, 0);
      root.add(body, band, top, vent1, vent2);

    // ── Bear trap ─────────────────────────────────────────────────────────────
    } else if (/bear_trap|wire_snare/.test(type)) {
      const base  = mk('bt_base',  () => new THREE.CylinderGeometry(0.11, 0.12, 0.018, 12), 0x555555, 0.4, 0.6);
      const jawL  = mk('bt_jawL',  () => new THREE.BoxGeometry(0.22, 0.016, 0.04), 0x666666, 0.3, 0.7);
      jawL.position.set(0, 0.02, 0);
      jawL.rotation.y = 0.35;
      const teethL = mk('bt_tL', () => new THREE.BoxGeometry(0.015, 0.05, 0.015), 0x888888, 0.25, 0.75);
      teethL.position.set(-0.08, 0.04, -0.015);
      const teethR = mk('bt_tR', () => new THREE.BoxGeometry(0.015, 0.05, 0.015), 0x888888, 0.25, 0.75);
      teethR.position.set(0.08, 0.04, -0.015);
      const spring = mk('bt_spring', () => new THREE.TorusGeometry(0.04, 0.008, 4, 10), 0x555555, 0.4, 0.5);
      spring.position.set(0, 0.012, 0.07);
      spring.rotation.x = Math.PI / 2;
      root.add(base, jawL, teethL, teethR, spring);

    // ── Generator ─────────────────────────────────────────────────────────────
    } else if (/generator|solar_panel|car_battery/.test(type)) {
      const box    = mk('gen_box',    () => new THREE.BoxGeometry(0.32, 0.22, 0.24), 0x444444, 0.5, 0.4);
      const panel  = mk('gen_panel',  () => new THREE.BoxGeometry(0.28, 0.18, 0.01), 0x333355, 0.35, 0.15);
      panel.position.z = 0.125;
      const exhaust = mk('gen_exh',   () => new THREE.CylinderGeometry(0.024, 0.024, 0.1, 6), 0x333333, 0.4, 0.4);
      exhaust.position.set(0.1, 0.16, 0);
      const handle = mk('gen_hnd',    () => new THREE.CylinderGeometry(0.014, 0.014, 0.26, 5), 0x555555, 0.4, 0.3);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(0, 0.14, 0);
      root.add(box, panel, exhaust, handle);
      root.scale.setScalar(0.88);

    // ── Special / gem ─────────────────────────────────────────────────────────
    } else if (this._category(type) === 'special') {
      const gem   = mk('gem_oct',    () => new THREE.OctahedronGeometry(0.14, 0), c, 0.05, 0.2);
      const inner = mk('gem_inner',  () => new THREE.OctahedronGeometry(0.08, 0), 0xffffff, 0.02, 0.05);
      inner.position.y = 0.02;
      inner.scale.set(0.55, 1.3, 0.55);
      root.add(gem, inner);

    // ── Aspirin / ibuprofen / pain killers (small pill blister) ────────────────
    } else if (/aspirin|ibuprofen|pain_killer/.test(type)) {
      const blister = mk('blister_base', () => new THREE.BoxGeometry(0.18, 0.005, 0.12), 0xddccaa, 0.7, 0.1);
      const foil    = mk('blister_foil', () => new THREE.BoxGeometry(0.18, 0.005, 0.12), 0xaaaacc, 0.3, 0.5);
      foil.position.y = 0.005;
      // Pill bumps
      for (let pi = 0; pi < 6; pi++) {
        const bump = mk(`blister_p${pi}`, () => new THREE.SphereGeometry(0.022, 6, 4), c, 0.55, 0.0);
        bump.scale.y = 0.6;
        bump.position.set(-0.06 + (pi % 3) * 0.06, 0.012, -0.02 + Math.floor(pi/3) * 0.04);
        root.add(bump);
      }
      root.add(blister, foil);

    // ── Thermometer / stethoscope ─────────────────────────────────────────────
    } else if (/thermometer/.test(type)) {
      const body = mk('thermo_body', () => new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), 0xffffff, 0.4, 0.1);
      const tip  = mk('thermo_tip',  () => new THREE.SphereGeometry(0.018, 6, 5), 0xcc2222, 0.5, 0.1);
      tip.position.y = -0.1;
      const cap  = mk('thermo_cap',  () => new THREE.CylinderGeometry(0.015, 0.015, 0.025, 6), 0xaaaaaa, 0.3, 0.5);
      cap.position.y = 0.1;
      root.add(body, tip, cap);

    } else if (/stethoscope/.test(type)) {
      const tube = mk('steth_tube', () => new THREE.TorusGeometry(0.1, 0.012, 6, 14, Math.PI * 1.4), 0x111111, 0.5, 0.2);
      tube.rotation.x = Math.PI / 2;
      const chest = mk('steth_chest', () => new THREE.CylinderGeometry(0.04, 0.04, 0.012, 12), 0x333333, 0.3, 0.5);
      chest.position.y = -0.06;
      root.add(tube, chest);

    // ── Duct tape — flat roll ─────────────────────────────────────────────────
    } else if (/duct_tape/.test(type)) {
      const roll = mk('tape_roll', () => new THREE.CylinderGeometry(0.1, 0.1, 0.07, 12), c, 0.6, 0.1);
      const hole = mk('tape_hole', () => new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), 0x111111, 0.8, 0.0);
      const strip = mk('tape_strip', () => new THREE.BoxGeometry(0.02, 0.07, 0.08), 0xbbbbbb, 0.7, 0.05);
      strip.position.set(0.1, 0, 0);
      root.add(roll, hole, strip);

    // ── Rope — coiled cylinder ────────────────────────────────────────────────
    } else if (/rope|twine/.test(type)) {
      const coil = mk('rope_coil', () => new THREE.TorusGeometry(0.1, 0.025, 6, 14), c, 0.7, 0.05);
      const coil2 = mk('rope_coil2', () => new THREE.TorusGeometry(0.075, 0.02, 6, 12), c, 0.75, 0.05);
      coil2.position.y = 0.04;
      coil2.rotation.z = 0.5;
      root.add(coil, coil2);

    // ── Scrap metal — irregular shards ───────────────────────────────────────
    } else if (/scrap_metal/.test(type)) {
      const shard1 = mk('shard1', () => new THREE.BoxGeometry(0.2, 0.02, 0.12), c, 0.5, 0.6);
      const shard2 = mk('shard2', () => new THREE.BoxGeometry(0.14, 0.02, 0.09), c, 0.5, 0.6);
      shard1.rotation.y = 0.3;
      shard2.position.set(0.05, 0.02, 0.04); shard2.rotation.y = -0.8;
      root.add(shard1, shard2);

    // ── Night vision goggles — twin lens visor ────────────────────────────────
    } else if (/night_vision/.test(type)) {
      const frame = mk('nv_frame', () => new THREE.BoxGeometry(0.25, 0.1, 0.07), c, 0.4, 0.3);
      const lens1 = mk('nv_l1', () => new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), 0x003300, 0.1, 0.05);
      const lens2 = mk('nv_l2', () => new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), 0x003300, 0.1, 0.05);
      lens1.rotation.x = Math.PI/2; lens1.position.set(-0.07, 0, 0.04);
      lens2.rotation.x = Math.PI/2; lens2.position.set( 0.07, 0, 0.04);
      const gLens1 = mk('nv_gl1', () => new THREE.CylinderGeometry(0.038, 0.038, 0.01, 8), 0x00ff44, 0.05, 0.1);
      const gLens2 = mk('nv_gl2', () => new THREE.CylinderGeometry(0.038, 0.038, 0.01, 8), 0x00ff44, 0.05, 0.1);
      gLens1.rotation.x = Math.PI/2; gLens1.position.set(-0.07, 0, 0.06);
      gLens2.rotation.x = Math.PI/2; gLens2.position.set( 0.07, 0, 0.06);
      root.add(frame, lens1, lens2, gLens1, gLens2);

    // ── Gas mask ──────────────────────────────────────────────────────────────
    } else if (/gas_mask|hazmat/.test(type)) {
      const face = mk('gm_face', () => new THREE.SphereGeometry(0.13, 8, 6), c, 0.45, 0.2);
      face.scale.z = 0.7;
      const filter = mk('gm_filter', () => new THREE.CylinderGeometry(0.04, 0.045, 0.07, 8), 0x222222, 0.6, 0.3);
      filter.position.set(0, -0.06, 0.1); filter.rotation.x = Math.PI/2;
      const le = mk('gm_le', () => new THREE.CylinderGeometry(0.038, 0.038, 0.01, 8), 0x222222, 0.1, 0.0);
      const re = mk('gm_re', () => new THREE.CylinderGeometry(0.038, 0.038, 0.01, 8), 0x222222, 0.1, 0.0);
      le.rotation.x = Math.PI/2; le.position.set(-0.06, 0.04, 0.11);
      re.rotation.x = Math.PI/2; re.position.set( 0.06, 0.04, 0.11);
      root.add(face, filter, le, re);

    // ── Default — octahedron (better than a plain box) ─────────────────────────
    } else {
      const gem = mk('fallback_gem', () => new THREE.OctahedronGeometry(0.11, 0), c, 0.5, 0.2);
      const ring = mk('fallback_ring', () => new THREE.TorusGeometry(0.085, 0.018, 5, 10), 0xffffff, 0.3, 0.4);
      ring.rotation.x = Math.PI / 2;
      ring.scale.y = 0.4;
      root.add(gem, ring);
    }

    return root;
  }

  // ─── Spawn ────────────────────────────────────────────────────────────────

  spawnItem(type, x, y, z, quantity = 1) {
    const id   = this._id++;
    const glow = this._rarityGlow(type);

    // Model priority: specific model for this type → category-default model (so
    // EVERY item gets a real model) → procedural mesh. The code below re-grounds
    // and scales whichever it gets.
    const reg = this.game.itemModelLoader;
    const model = reg?.createModel?.(type)
      || reg?.createModel?.(this._categoryModelKey(type))
      || this._buildModel(type, glow);

    // Shift model up so its bottom edge sits exactly at y=0.
    // Without this every model floats at half its height above ground.
    model.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(model);
    if (isFinite(bbox.min.y)) model.position.y -= bbox.min.y;

    // Inner group — slight scale for visibility
    const inner = new THREE.Group();
    inner.add(model);
    inner.scale.setScalar(1.25);

    // Tiny random XZ spread so multiple drops don't clip inside each other
    const jx = (Math.random() - 0.5) * 0.4;
    const jz = (Math.random() - 0.5) * 0.4;

    const group = new THREE.Group();
    group.add(inner);
    group.position.set(x + jx, y, z + jz);

    // Rarity glow for uncommon+ items — an unlit halo mesh, NOT a PointLight:
    // hundreds of dropped items each carrying a real light breaks the renderer
    if (glow.intensity > 0.12) {
      // Share one halo geometry across all drops so it never needs per-item
      // disposal (item disposal only frees materials, so a fresh geometry per
      // halo would leak on every rare drop).
      if (!this._haloGeo) this._haloGeo = new THREE.SphereGeometry(0.22, 8, 6);
      const halo = new THREE.Mesh(
        this._haloGeo,
        new THREE.MeshBasicMaterial({
          color: glow.color, transparent: true,
          opacity: Math.min(0.4, glow.intensity * 0.9),
          depthWrite: false
        })
      );
      halo.position.set(0, 0.18, 0);
      halo.userData.noHit = true;
      group.add(halo);
    }

    this.scene.add(group);

    // Collect all materials from the whole group (incl. the halo) for disposal.
    const matSet = new Set();
    group.traverse(o => { if (o.isMesh) matSet.add(o.material); });
    const mats = [...matSet];

    const item = {
      mesh: group, _mesh: inner,
      mat: mats[0], _mats: mats,
      type, quantity, id, baseY: y, respawnsLeft: 2
    };
    this.items.push(item);
    return item;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(dt) {
    this.time += dt;
    const playerPos = this.game.player?.getPosition?.();

    // ─── Float + rotate all world items ─────────────────────────────────────
    for (const item of this.items) {
      item._mesh.position.y = Math.sin(this.time * 1.5 + item.id * 1.3) * 0.055;
      item._mesh.rotation.y += dt * 0.65;
    }

    // ─── Hover card ──────────────────────────────────────────────────────────
    if (!this._hoverCard) {
      this._hoverCard = document.getElementById('item-hover-card');
      this._ihcIcon   = document.getElementById('ihc-icon');
      this._ihcName   = document.getElementById('ihc-name');
      this._ihcRarity = document.getElementById('ihc-rarity');
      this._ihcQty    = document.getElementById('ihc-qty');
    }
    // Never show the pickup card over the death screen / pause menu / when stopped
    if (this._deathScreenEl === undefined) this._deathScreenEl = document.getElementById('death-screen');
    const uiBlocked = this.game.isPaused || !this.game.isRunning
      || (this._deathScreenEl && this._deathScreenEl.style.display === 'flex');

    if (this._hoverCard && uiBlocked) {
      this._hoverCard.classList.remove('ihc-show');
    } else if (this._hoverCard) {
      // Only show for the item the crosshair is actually pointing at (look-at)
      const camera = this.game.scene?.getCamera?.();
      const nearest = (playerPos && camera)
        ? this.getLookedAtItem(camera, playerPos, 4.5)
        : null;
      if (nearest) {
        const def = this.game.inventorySystem?.itemTypes?.[nearest.type];
        const t   = nearest.type;
        const cat = t.startsWith('drink_') || t === 'water_bottle' ? 'drink'
                  : t.startsWith('armor_') || t.startsWith('cloth_') ? 'armor'
                  : this._category(t);

        if (this._ihcIcon)   this._ihcIcon.dataset.cat = cat;
        if (this._ihcName)   this._ihcName.textContent = def?.name ?? t;
        if (this._ihcRarity) {
          const r = def?.rarity ?? 'common';
          this._ihcRarity.textContent    = r.toUpperCase();
          this._ihcRarity.dataset.rarity = r;
        }
        if (this._ihcQty) {
          if (nearest.quantity > 1) {
            this._ihcQty.textContent   = `×${nearest.quantity}`;
            this._ihcQty.style.display = '';
          } else {
            this._ihcQty.style.display = 'none';
          }
        }
        this._hoverCard.classList.add('ihc-show');
      } else {
        this._hoverCard.classList.remove('ihc-show');
      }
    }

    for (let i = this._respawnQueue.length - 1; i >= 0; i--) {
      const r = this._respawnQueue[i];
      r.timer -= dt;
      if (r.timer <= 0) {
        const spawned = this.spawnItem(r.type, r.x, r.y, r.z, r.quantity);
        spawned.respawnsLeft = r.respawnsLeft;
        this._respawnQueue.splice(i, 1);
      }
    }

    // ─── Cull: zombie drops accumulate forever otherwise ────────────────────
    this._cullTimer = (this._cullTimer ?? 0) + dt;
    if (this._cullTimer > 5 && playerPos && this.items.length > 250) {
      this._cullTimer = 0;
      for (let i = this.items.length - 1; i >= 0 && this.items.length > 250; i--) {
        const it = this.items[i];
        const dx = it.mesh.position.x - playerPos.x;
        const dz = it.mesh.position.z - playerPos.z;
        if (dx * dx + dz * dz > 3600) { // > 60m away — player won't miss it
          this.scene.remove(it.mesh);
          it._mats.forEach(m => m.dispose());
          this.items.splice(i, 1);
        }
      }
    }
  }

  // ─── Nearby check ─────────────────────────────────────────────────────────

  getNearbyItem(playerX, playerY, playerZ, maxDist = 1.8) {
    let nearest = null;
    let nearestD = maxDist * maxDist;
    for (const item of this.items) {
      // Vertical gate so you can't grab items through a floor/ceiling
      if (Math.abs(item.mesh.position.y - playerY) > 2.2) continue;
      const dx = item.mesh.position.x - playerX;
      const dz = item.mesh.position.z - playerZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < nearestD) { nearestD = d2; nearest = item; }
    }
    return nearest;
  }

  // The item the crosshair is pointing at (within reach). Used for the hover
  // prompt/card and F pickup so they only show when you actually LOOK at an item,
  // not merely stand near one. Pre-filters by proximity so we never raycast the
  // hundreds of scattered item meshes.
  getLookedAtItem(camera, playerPos, maxDist = 4.5) {
    if (!camera || !playerPos) return null;
    const md2 = (maxDist + 1.5) * (maxDist + 1.5);
    const near = [];
    for (const item of this.items) {
      const dx = item.mesh.position.x - playerPos.x;
      const dy = item.mesh.position.y - playerPos.y;
      const dz = item.mesh.position.z - playerPos.z;
      if (dx * dx + dy * dy + dz * dz < md2) near.push(item);
    }
    if (!near.length) return null;
    if (!this._itemRay) { this._itemRay = new THREE.Raycaster(); this._rayCenter = new THREE.Vector2(0, 0); }
    camera.updateMatrixWorld(); // ensure the ray uses the current camera transform
    this._itemRay.setFromCamera(this._rayCenter, camera);
    this._itemRay.far = maxDist;
    const meshes = [];
    for (const it of near) {
      it.mesh.updateMatrixWorld(); // near items only — keep raycast accurate regardless of render timing
      it.mesh.traverse(o => { if (o.isMesh) { o.userData._ownerItem = it; meshes.push(o); } });
    }
    const hits = this._itemRay.intersectObjects(meshes, false);
    return hits.length ? (hits[0].object.userData._ownerItem ?? null) : null;
  }

  // ─── Pickup ───────────────────────────────────────────────────────────────

  tryPickup(playerX, playerY, playerZ, range = 1.8) {
    return this.pickupItem(this.getNearbyItem(playerX, playerY, playerZ, range));
  }

  // Pick up a specific item (used by look-at F pickup and click pickup).
  pickupItem(item) {
    if (!item) return false;

    const ok = this.game.inventorySystem?.addItem(item.type, item.quantity) ?? false;
    if (!ok) return false;

    // Grant weapon to WeaponManager when picking up a weapon item
    this.game.weaponManager?.grantWeaponFromPickup?.(item.type);

    // Feed ammo directly into weapon reserves when picking up ammo
    if (item.type.startsWith('ammo_')) {
      this.game.weaponManager?.feedAmmoFromPickup?.(item.type, item.quantity);
    }

    // Notify mission system of pickup for supply-gathering tracking
    this.game.missionSystem?.trackItemPickup?.(item.type);

    // XP for picking up rare/epic/legendary items
    const def = this.game.inventorySystem?.itemTypes?.[item.type];
    const rarityXP = { uncommon: 3, rare: 8, epic: 18, legendary: 40 };
    if (rarityXP[def?.rarity]) this.game.player?.gainXP?.(rarityXP[def.rarity], 'pickup');

    if (item.respawnsLeft > 0) {
      this._respawnQueue.push({
        type: item.type,
        x: item.mesh.position.x,
        y: item.baseY,
        z: item.mesh.position.z,
        quantity: item.quantity,
        timer: 90,
        respawnsLeft: item.respawnsLeft - 1
      });
    }

    this.game.audioManager?.resume?.();
    this.game.audioManager?.playPickup?.();

    this.scene.remove(item.mesh);
    const mats = item._mats;
    setTimeout(() => { mats.forEach(m => m.dispose()); }, 500);

    const idx = this.items.indexOf(item);
    if (idx !== -1) this.items.splice(idx, 1);
    this._showPickupText(item);
    return true;
  }

  _showPickupText(item) {
    const el = this._pickupEl;
    if (!el) return;
    const def  = this.game.inventorySystem?.itemTypes?.[item.type];
    const name = def?.name ?? item.type;
    const qty  = item.quantity > 1 ? ` ×${item.quantity}` : '';
    el.textContent = `+ ${name}${qty}`;
    el.style.color = this._rarityHex(item.type);
    el.style.opacity = '1';
    if (this._pickupTimer) clearTimeout(this._pickupTimer);
    this._pickupTimer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  removeAll() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
      const mats = item._mats;
      setTimeout(() => { mats.forEach(m => m.dispose()); }, 100);
    }
    this.items = [];
    this._respawnQueue = [];
  }
}
