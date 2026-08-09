import * as THREE from 'three';

export class InventorySystem {
  static getIconCat(type) {
    if (/^drink_|water_bottle|^drink$/.test(type)) return 'drink';
    const cats = {
      food:'food', medical:'medical', ammo:'ammo', weapon:'weapon',
      tool:'tool', gear:'gear', electronics:'gear', key:'key',
      special:'special', material:'material', armor:'armor'
    };
    if (type.startsWith('food_'))    return 'food';
    if (type.startsWith('med_') || type === 'bandage' || type === 'medical_kit') return 'medical';
    if (type.startsWith('ammo_'))    return 'ammo';
    if (type.startsWith('weapon_'))  return 'weapon';
    if (type.startsWith('tool_'))    return 'tool';
    if (type.startsWith('elec_') || type.startsWith('gear_')) return 'gear';
    if (type.startsWith('armor_') || type.startsWith('cloth_')) return 'armor';
    if (type.startsWith('key') || type.startsWith('keycard') || type === 'lockpick_set' || type === 'access_fob') return 'key';
    if (type.startsWith('special_')) return 'special';
    if (type.startsWith('mat_') || type === 'rope' || type === 'wood') return 'material';
    return 'default';
  }

  static getItemEmoji(type) {
    const m = {
      // ── Food ────────────────────────────────────────────────────────────────
      food_canned_beans:'🥫', food_canned_soup:'🥫', food_canned_tuna:'🐟',
      food_canned_corn:'🌽', food_bread:'🍞', food_crackers:'🍘',
      food_chocolate_bar:'🍫', food_protein_bar:'🍫', food_beef_jerky:'🥩',
      food_granola:'🌾', food_apple:'🍎', food_orange:'🍊', food_banana:'🍌',
      food_chips:'🥔', food_cereal:'🥣', food_pasta:'🍝', food_rice:'🍚',
      food_peanut_butter:'🥜', food_jam:'🫙', food_instant_noodles:'🍜',
      food_energy_bar:'⚡', food_trail_mix:'🥜', food_sardines:'🐟', food_spam:'🥩',
      // ── Drink ───────────────────────────────────────────────────────────────
      water_bottle:'🍶', drink_energy_drink:'⚡', drink_soda:'🥤',
      drink_coffee:'☕', drink_milk:'🥛', drink_juice:'🧃',
      drink_sports_drink:'🥤', drink_dirty_water:'💧', drink_purified_water:'💧',
      drink_beer:'🍺',
      // ── Medical ─────────────────────────────────────────────────────────────
      medical_kit:'🏥', bandage:'🩹', med_antibiotics:'💊', med_antivenom:'💉',
      med_blood_bag:'🩸', med_morphine:'💉', med_adrenaline:'💉',
      med_vitamins:'💊', med_caffeine_pills:'☕', med_sleeping_pills:'💊',
      med_antiradiation:'☢️', med_gauze:'🩹', med_suture_kit:'🧵',
      med_tourniquet:'🩹', med_eyedrops:'👁️', med_burn_cream:'🧴',
      med_pain_killers:'💊',
      // ── Ammo ────────────────────────────────────────────────────────────────
      ammo_9mm:'🔸', ammo_556:'🔸', ammo_12gauge:'🟠', ammo_308:'🔸',
      ammo_50cal:'🔶', ammo_45acp:'🔸', ammo_762:'🔸',
      ammo_crossbow_bolt:'➡️', ammo_arrow:'🏹',
      // ── Weapons ─────────────────────────────────────────────────────────────
      weapon_pistol_found:'🔫', weapon_revolver:'🔫', weapon_sawed_off:'🔫', weapon_baseball_bat:'🏏', weapon_crowbar:'🔧',
      weapon_kitchen_knife:'🔪', weapon_machete:'⚔️', weapon_axe:'🪓',
      weapon_pipe:'⚫', weapon_fire_poker:'🔥', weapon_crossbow:'🏹',
      // ── Tools ───────────────────────────────────────────────────────────────
      tool_flashlight:'🔦', tool_wrench:'🔧', tool_hammer:'🔨',
      tool_multitool:'🔧', tool_crowbar:'🔧',
      // ── Electronics / Gear ──────────────────────────────────────────────────
      elec_phone:'📱', elec_radio:'📻', elec_laptop:'💻', elec_camera:'📷',
      elec_usb_drive:'💾', gear_compass:'🧭', gear_binoculars:'🔭',
      gear_map:'🗺️', gear_gps:'📍', gear_night_vision:'🔭',
      gear_walkie_talkie:'📡', gear_fire_starter:'🔥',
      // ── Armor / Clothing ────────────────────────────────────────────────────
      armor_vest:'🦺', armor_helmet:'⛑️', armor_plate:'🛡️',
      armor_gasmask:'😷', cloth_jacket:'🧥', cloth_boots:'👢',
      cloth_gloves:'🧤', cloth_backpack:'🎒', cloth_military_jacket:'🧥',
      cloth_hazmat_suit:'🥼',
      // ── Keys ────────────────────────────────────────────────────────────────
      key_house:'🗝️', key_car:'🔑', key_safe:'🔑', key_padlock:'🔐',
      key_locker:'🔑', key_master:'🗝️', keycard_red:'🟥',
      keycard_blue:'🟦', keycard_green:'🟩', keycard_yellow:'🟨',
      lockpick_set:'📎', access_fob:'💳',
      // ── Special ─────────────────────────────────────────────────────────────
      special_journal_page:'📄', special_map_fragment:'🗺️',
      special_survivor_note:'📝', special_photograph:'📸',
      special_lab_report:'🔬', special_virus_sample:'🧪',
      special_artifact:'✨', special_admin_keycard:'💳',
      special_alien_device:'🛸', special_power_cell:'🔋',
      // ── Materials ───────────────────────────────────────────────────────────
      mat_duct_tape:'📦', mat_zip_ties:'📦', mat_super_glue:'🧪',
      mat_rope:'🪢', mat_nails:'📌', rope:'🪢', wood:'🪵',
      mat_alcohol_isopropyl:'🧪', mat_battery:'🔋', mat_wire:'〰️',
      mat_charcoal:'⬛', mat_sand:'🟨',
      food_mushroom:'🍄', food_berry:'🫐', food_honey:'🍯',
      food_cooked_meat:'🍖', food_military_ration:'🥡',
      explosive_molotov:'🔥', explosive_grenade:'💣', trap_spike_trap:'🪝',
      trap_bear_trap:'🪤', trap_landmine:'💥', explosive_smoke_grenade:'💨', tool_generator:'⚡',
      weapon_flare_gun:'🚨', weapon_nail_bat:'🏏', weapon_slingshot:'🪃',
      weapon_electric_baton:'⚡', weapon_compound_bow:'🏹',
      gear_whistle:'📯', gear_sleeping_bag:'🛏️', gear_water_filter:'🧹',
      gear_headlamp:'🔦', gear_paracord:'🪢', gear_tarp:'🟫', gear_bungee_cord:'〰️',
      drink_wine:'🍷', drink_whiskey:'🥃', drink_rum:'🍹', drink_tea:'🍵', drink_hot_cocoa:'☕',
      food_frozen_pizza:'🍕', food_cookies:'🍪', food_soup_bowl:'🍲',
      food_oatmeal:'🥣', food_granola_bar:'🌾', food_dried_fruit:'🍇', food_canned_peaches:'🍑',
      tool_lighter:'🔥', tool_canteen:'🫙', tool_matches:'🔥', tool_knife_swiss:'🔪', tool_hand_saw:'🪚',
      special_family_photo:'📸', special_diary:'📔', special_recipe_book:'📖', special_house_plan:'📐',
      med_aspirin:'💊', med_ibuprofen:'💊', med_thermometer:'🌡️', med_stethoscope:'🩺',
      mat_salt:'🧂', mat_sugar:'🍬', mat_coffee_grounds:'☕', mat_candles:'🕯️',
      // New items
      tool_multitool:'🔧', tool_wire_cutter:'✂️', tool_bolt_cutter:'🔗', tool_rope:'🪢', tool_handcuffs:'🔒',
      gear_tarp:'⛺', gear_hammock:'🛏️',
      med_epipen:'💉', med_defibrillator:'⚡', med_blood_bag:'🩸', med_suture_kit:'🧵', med_splint:'🩹',
      elec_radio_transceiver:'📡', elec_emp_grenade:'💥', elec_tracker:'📟', elec_stun_baton:'⚡', elec_laser_sight:'🔴',
      mat_gunpowder:'💨', mat_saltpeter:'🧪', mat_charcoal:'⬛', mat_resin:'🫙', mat_kevlar_shred:'🛡️', mat_circuit_board:'💾',
      special_cdc_keycard:'🔑', special_vaccine_dose:'💉', special_military_id:'🪪', special_black_market_note:'📋',
      food_roasted_meat:'🍖', food_hardtack:'🫓', food_jerky:'🥩', food_pemmican:'🥚',
      drink_coconut_water:'🥥', drink_rain_water:'💧',
      gear_decoy:'🎵', tool_repair_kit:'🔨', food_energy_bar:'⚡', special_blueprint:'📐',
      gear_ghillie_suit:'🌿', med_stim_shot:'💉', explosive_claymore:'💣',
    };
    if (m[type]) return m[type];
    if (type.startsWith('ammo_'))  return '🔸';
    if (type.startsWith('food_'))  return '🍴';
    if (type.startsWith('drink_')) return '🥤';
    if (type.startsWith('med_'))   return '💊';
    if (type.startsWith('weapon_'))return '⚔️';
    if (type.startsWith('tool_'))  return '🔧';
    if (type.startsWith('elec_') || type.startsWith('gear_')) return '📡';
    if (type.startsWith('armor_') || type.startsWith('cloth_')) return '👕';
    if (type.startsWith('key'))    return '🗝️';
    if (type.startsWith('special_')) return '✨';
    if (type.startsWith('mat_'))   return '📦';
    return '📦';
  }

  constructor(game) {
    this.game = game;
    this.totalSlots = 54;
    this.quickSlots = 9;
    this.slots = Array(this.totalSlots).fill(null);
    this.isOpen = false;
    this.selectedSlot = -1;
    this.lastSelectedQuickSlot = -1;

    this.itemTypes = {
      // ── Original items ──────────────────────────────────────────────────
      water_bottle:  { name: 'Water Bottle',  stackable: true,  icon: 'icon-water',       rarity: 'common',   effect: 'restores 30 thirst, 20 stamina',    usable: true,  category: 'food'     },
      food:          { name: 'Food',           stackable: true,  icon: 'icon-food',        rarity: 'common',   effect: 'restores 25 hunger',                usable: true,  category: 'food'     },
      ammo_pistol:   { name: 'Pistol Ammo',   stackable: true,  icon: 'icon-ammo-pistol', rarity: 'common',   effect: 'weapon ammo',                       usable: false, category: 'ammo'     },
      ammo_rifle:    { name: 'Rifle Ammo',    stackable: true,  icon: 'icon-ammo-rifle',  rarity: 'common',   effect: 'weapon ammo',                       usable: false, category: 'ammo'     },
      medical_kit:   { name: 'Medical Kit',   stackable: true,  icon: 'icon-medical',     rarity: 'rare',     effect: 'restores 50 health',                usable: true,  category: 'medical'  },
      bandage:       { name: 'Bandage',       stackable: true,  icon: 'icon-bandage',     rarity: 'common',   effect: 'restores 15 health',                usable: true,  category: 'medical'  },
      tool_hammer:   { name: 'Hammer',        stackable: false, icon: 'icon-hammer',      rarity: 'uncommon', effect: 'melee weapon, 25 damage',           usable: false, category: 'tool'     },
      tool_wrench:   { name: 'Wrench',        stackable: false, icon: 'icon-wrench',      rarity: 'uncommon', effect: 'repair tool',                       usable: false, category: 'tool'     },
      key:           { name: 'Key',           stackable: false, icon: 'icon-key',         rarity: 'rare',     effect: 'unlocks doors',                     usable: false, category: 'key'      },
      fuel:          { name: 'Fuel',          stackable: true,  icon: 'icon-fuel',        rarity: 'common',   effect: 'vehicle fuel',                      usable: false, category: 'material' },
      ore_copper:    { name: 'Copper Ore',    stackable: true,  icon: 'icon-ore-copper',  rarity: 'uncommon', effect: 'crafting material',                 usable: false, category: 'material' },
      ore_iron:      { name: 'Iron Ore',      stackable: true,  icon: 'icon-ore-iron',    rarity: 'uncommon', effect: 'crafting material',                 usable: false, category: 'material' },
      ingot_copper:  { name: 'Copper Ingot',  stackable: true,  icon: 'icon-ingot-copper',rarity: 'uncommon', effect: 'crafting material',                 usable: false, category: 'material' },
      ingot_iron:    { name: 'Iron Ingot',    stackable: true,  icon: 'icon-ingot-iron',  rarity: 'uncommon', effect: 'crafting material',                 usable: false, category: 'material' },
      wood:          { name: 'Wood',          stackable: true,  icon: 'icon-wood',        rarity: 'common',   effect: 'crafting material',                 usable: false, category: 'material' },
      rope:          { name: 'Rope',          stackable: true,  icon: 'icon-rope',        rarity: 'common',   effect: 'crafting material',                 usable: false, category: 'material' },

      // ── Food ────────────────────────────────────────────────────────────
      food_canned_beans:    { name: 'Canned Beans',       stackable: true, rarity: 'common',   effect: 'restores 15 hunger',                   usable: true,  category: 'food' },
      food_canned_soup:     { name: 'Canned Soup',        stackable: true, rarity: 'common',   effect: 'restores 18 hunger',                   usable: true,  category: 'food' },
      food_canned_tuna:     { name: 'Canned Tuna',        stackable: true, rarity: 'common',   effect: 'restores 20 hunger',                   usable: true,  category: 'food' },
      food_canned_corn:     { name: 'Canned Corn',        stackable: true, rarity: 'common',   effect: 'restores 12 hunger',                   usable: true,  category: 'food' },
      food_bread:           { name: 'Bread',              stackable: true, rarity: 'common',   effect: 'restores 20 hunger',                   usable: true,  category: 'food' },
      food_crackers:        { name: 'Crackers',           stackable: true, rarity: 'common',   effect: 'restores 8 hunger',                    usable: true,  category: 'food' },
      food_chocolate_bar:   { name: 'Chocolate Bar',      stackable: true, rarity: 'common',   effect: 'restores 10 hunger, 5 stamina',         usable: true,  category: 'food' },
      food_protein_bar:     { name: 'Protein Bar',        stackable: true, rarity: 'common',   effect: 'restores 15 hunger, 10 stamina',        usable: true,  category: 'food' },
      food_beef_jerky:      { name: 'Beef Jerky',         stackable: true, rarity: 'common',   effect: 'restores 18 hunger',                   usable: true,  category: 'food' },
      food_granola:         { name: 'Granola',            stackable: true, rarity: 'common',   effect: 'restores 12 hunger',                   usable: true,  category: 'food' },
      food_apple:           { name: 'Apple',              stackable: true, rarity: 'common',   effect: 'restores 8 hunger, 5 thirst',        usable: true,  category: 'food' },
      food_orange:          { name: 'Orange',             stackable: true, rarity: 'common',   effect: 'restores 10 hunger, 8 thirst',       usable: true,  category: 'food' },
      food_banana:          { name: 'Banana',             stackable: true, rarity: 'common',   effect: 'restores 12 hunger, 5 stamina',         usable: true,  category: 'food' },
      food_chips:           { name: 'Chips',              stackable: true, rarity: 'common',   effect: 'restores 5 hunger',                    usable: true,  category: 'food' },
      food_cereal:          { name: 'Cereal',             stackable: true, rarity: 'common',   effect: 'restores 14 hunger',                   usable: true,  category: 'food' },
      food_pasta:           { name: 'Pasta',              stackable: true, rarity: 'common',   effect: 'restores 25 hunger',                   usable: true,  category: 'food' },
      food_rice:            { name: 'Rice',               stackable: true, rarity: 'common',   effect: 'restores 20 hunger',                   usable: true,  category: 'food' },
      food_peanut_butter:   { name: 'Peanut Butter',      stackable: true, rarity: 'common',   effect: 'restores 22 hunger, 5 stamina',         usable: true,  category: 'food' },
      food_jam:             { name: 'Jam',                stackable: true, rarity: 'common',   effect: 'restores 10 hunger',                   usable: true,  category: 'food' },
      food_instant_noodles: { name: 'Instant Noodles',    stackable: true, rarity: 'common',   effect: 'restores 18 hunger',                   usable: true,  category: 'food' },
      food_energy_bar:      { name: 'Energy Bar',         stackable: true, rarity: 'common',   effect: 'restores 10 hunger, 15 stamina',        usable: true,  category: 'food' },
      food_trail_mix:       { name: 'Trail Mix',          stackable: true, rarity: 'common',   effect: 'restores 12 hunger, 8 stamina',         usable: true,  category: 'food' },
      food_sardines:        { name: 'Sardines',           stackable: true, rarity: 'common',   effect: 'restores 16 hunger',                   usable: true,  category: 'food' },
      food_spam:            { name: 'Spam',               stackable: true, rarity: 'common',   effect: 'restores 20 hunger',                   usable: true,  category: 'food' },

      // ── Drinks ──────────────────────────────────────────────────────────
      drink_energy_drink:   { name: 'Energy Drink',       stackable: true, rarity: 'common',   effect: 'restores 12 thirst, 25 stamina',        usable: true,  category: 'food' },
      drink_soda:           { name: 'Soda',               stackable: true, rarity: 'common',   effect: 'restores 15 thirst, 10 stamina, 5 hunger', usable: true, category: 'food' },
      drink_coffee:         { name: 'Coffee',             stackable: true, rarity: 'common',   effect: 'restores 10 thirst, 20 stamina',        usable: true,  category: 'food' },
      drink_milk:           { name: 'Milk',               stackable: true, rarity: 'common',   effect: 'restores 22 thirst, 15 stamina, 10 hunger', usable: true, category: 'food' },
      drink_juice:          { name: 'Juice',              stackable: true, rarity: 'common',   effect: 'restores 25 thirst, 15 stamina, 8 hunger', usable: true, category: 'food' },
      drink_sports_drink:   { name: 'Sports Drink',       stackable: true, rarity: 'common',   effect: 'restores 30 thirst, 20 stamina',        usable: true,  category: 'food' },
      drink_dirty_water:    { name: 'Dirty Water',        stackable: true, rarity: 'common',   effect: 'restores 20 thirst, risk of sickness',  usable: true,  category: 'food' },
      drink_purified_water: { name: 'Purified Water',     stackable: true, rarity: 'common',   effect: 'restores 40 thirst, 20 stamina',        usable: true,  category: 'food' },
      drink_beer:           { name: 'Beer',               stackable: true, rarity: 'common',   effect: 'restores 8 thirst, minor debuff',       usable: true,  category: 'food' },

      // ── Medical ─────────────────────────────────────────────────────────
      med_antibiotics:      { name: 'Antibiotics',        stackable: true,  rarity: 'rare',    effect: 'cures infection',                       usable: true,  category: 'medical' },
      med_antivenom:        { name: 'Antivenom',          stackable: true,  rarity: 'rare',    effect: 'cures poison',                          usable: true,  category: 'medical' },
      med_blood_bag:        { name: 'Blood Bag',          stackable: true,  rarity: 'rare',    effect: 'restores 40 health',                    usable: true,  category: 'medical' },
      med_morphine:         { name: 'Morphine',           stackable: true,  rarity: 'rare',    effect: 'removes pain, restores 20 health',      usable: true,  category: 'medical' },
      med_adrenaline:       { name: 'Adrenaline Shot',    stackable: true,  rarity: 'rare',    effect: 'restores 30 stamina, 15 health',        usable: true,  category: 'medical' },
      med_vitamins:         { name: 'Vitamins',           stackable: true,  rarity: 'uncommon',effect: 'restores 10 health over time',          usable: true,  category: 'medical' },
      med_caffeine_pills:   { name: 'Caffeine Pills',     stackable: true,  rarity: 'common',  effect: 'restores 20 stamina',                   usable: true,  category: 'medical' },
      med_sleeping_pills:   { name: 'Sleeping Pills',     stackable: true,  rarity: 'uncommon',effect: 'recover health while resting',          usable: true,  category: 'medical' },
      med_antiradiation:    { name: 'Anti-Radiation Pills',stackable: true, rarity: 'rare',    effect: 'reduces radiation exposure',            usable: true,  category: 'medical' },
      med_gauze:            { name: 'Gauze',              stackable: true,  rarity: 'common',  effect: 'restores 10 health',                    usable: true,  category: 'medical' },
      med_suture_kit:       { name: 'Suture Kit',         stackable: true,  rarity: 'uncommon',effect: 'restores 25 health, stops bleeding',    usable: true,  category: 'medical' },
      med_tourniquet:       { name: 'Tourniquet',         stackable: true,  rarity: 'uncommon',effect: 'stops heavy bleeding',                  usable: true,  category: 'medical' },
      med_eyedrops:         { name: 'Eye Drops',          stackable: true,  rarity: 'common',  effect: 'removes blurred vision',                usable: true,  category: 'medical' },
      med_burn_cream:       { name: 'Burn Cream',         stackable: true,  rarity: 'uncommon',effect: 'restores 15 health, removes burn',      usable: true,  category: 'medical' },
      med_dental_kit:       { name: 'Dental Kit',         stackable: true,  rarity: 'uncommon',effect: 'removes tooth pain debuff',             usable: true,  category: 'medical' },
      med_pain_killers:     { name: 'Pain Killers',       stackable: true,  rarity: 'common',  effect: 'restores 15 health, dulls pain',        usable: true,  category: 'medical' },

      // ── Weapons ─────────────────────────────────────────────────────────
      weapon_pistol_found:  { name: 'Pistol',             stackable: false, rarity: 'rare',    effect: 'firearm, 35 damage',                    usable: false, category: 'weapon' },
      weapon_revolver:      { name: 'Revolver',           stackable: false, rarity: 'rare',    effect: 'firearm, 48 damage, 6 shots, high recoil', usable: false, category: 'weapon' },
      weapon_sawed_off:     { name: 'Sawed-Off Shotgun',  stackable: false, rarity: 'rare',    effect: 'shotgun, 55×8 pellets, 2 shots, 10m range', usable: false, category: 'weapon' },
      weapon_rifle_found:   { name: 'Rifle',              stackable: false, rarity: 'rare',    effect: 'firearm, 60 damage',                    usable: false, category: 'weapon' },
      weapon_shotgun_found: { name: 'Shotgun',            stackable: false, rarity: 'rare',    effect: 'firearm, 80 damage (spread)',           usable: false, category: 'weapon' },
      weapon_smg_found:     { name: 'SMG',                stackable: false, rarity: 'rare',    effect: 'firearm, 25 damage, fast fire rate',    usable: false, category: 'weapon' },
      weapon_crossbow:      { name: 'Crossbow',           stackable: false, rarity: 'uncommon',effect: 'ranged, 45 damage, silent',             usable: false, category: 'weapon' },
      weapon_bow:           { name: 'Bow',                stackable: false, rarity: 'uncommon',effect: 'ranged, 35 damage, silent',             usable: false, category: 'weapon' },
      weapon_spear:         { name: 'Spear',              stackable: false, rarity: 'uncommon',effect: 'melee, 40 damage, long reach',          usable: false, category: 'weapon' },
      weapon_sword:         { name: 'Sword',              stackable: false, rarity: 'uncommon',effect: 'melee, 50 damage',                      usable: false, category: 'weapon' },
      weapon_machete:       { name: 'Machete',            stackable: false, rarity: 'uncommon',effect: 'melee, 40 damage',                      usable: false, category: 'weapon' },
      weapon_axe:           { name: 'Axe',                stackable: false, rarity: 'uncommon',effect: 'melee, 55 damage',                      usable: false, category: 'weapon' },
      weapon_hatchet:       { name: 'Hatchet',            stackable: false, rarity: 'uncommon',effect: 'melee, 35 damage',                      usable: false, category: 'weapon' },
      weapon_crowbar:       { name: 'Crowbar',            stackable: false, rarity: 'uncommon',effect: 'melee, 30 damage, opens locks',         usable: false, category: 'weapon' },
      weapon_baseball_bat:  { name: 'Baseball Bat',       stackable: false, rarity: 'uncommon',effect: 'melee, 28 damage',                      usable: false, category: 'weapon' },
      weapon_kitchen_knife: { name: 'Kitchen Knife',      stackable: false, rarity: 'uncommon',effect: 'melee, 22 damage',                      usable: false, category: 'weapon' },
      weapon_pipe:          { name: 'Pipe',               stackable: false, rarity: 'common',  effect: 'melee, 20 damage',                      usable: false, category: 'weapon' },
      weapon_golf_club:     { name: 'Golf Club',          stackable: false, rarity: 'uncommon',effect: 'melee, 25 damage',                      usable: false, category: 'weapon' },
      weapon_cricket_bat:   { name: 'Cricket Bat',        stackable: false, rarity: 'uncommon',effect: 'melee, 27 damage',                      usable: false, category: 'weapon' },
      weapon_tire_iron:     { name: 'Tire Iron',          stackable: false, rarity: 'common',  effect: 'melee, 22 damage',                      usable: false, category: 'weapon' },
      weapon_fire_poker:    { name: 'Fire Poker',         stackable: false, rarity: 'common',  effect: 'melee, 20 damage',                      usable: false, category: 'weapon' },
      weapon_meat_cleaver:  { name: 'Meat Cleaver',       stackable: false, rarity: 'uncommon',effect: 'melee, 38 damage',                      usable: false, category: 'weapon' },
      weapon_katana:        { name: 'Katana',             stackable: false, rarity: 'epic',    effect: 'melee, 70 damage, fast swing',          usable: false, category: 'weapon' },
      weapon_sledgehammer:  { name: 'Sledgehammer',       stackable: false, rarity: 'uncommon',effect: 'melee, 65 damage, slow',                usable: false, category: 'weapon' },
      weapon_chainsaw:      { name: 'Chainsaw',           stackable: false, rarity: 'rare',    effect: 'melee, 90 damage, loud, needs fuel',    usable: false, category: 'weapon' },
      weapon_flare_gun:     { name: 'Flare Gun',          stackable: false, rarity: 'uncommon',effect: 'fires flares, can ignite zombies',       usable: false, category: 'weapon' },
      weapon_nail_bat:      { name: 'Spiked Bat',         stackable: false, rarity: 'uncommon',effect: 'melee, 35 damage, causes bleed',         usable: false, category: 'weapon' },
      weapon_slingshot:     { name: 'Slingshot',          stackable: false, rarity: 'common',  effect: 'ranged, 12 damage, silent',             usable: false, category: 'weapon' },
      weapon_electric_baton:{ name: 'Electric Baton',     stackable: false, rarity: 'rare',    effect: 'melee, 45 damage, stuns enemies',       usable: false, category: 'weapon' },
      weapon_compound_bow:  { name: 'Compound Bow',       stackable: false, rarity: 'rare',    effect: 'ranged, 55 damage, silent, accurate',   usable: false, category: 'weapon' },

      // ── Ammo ────────────────────────────────────────────────────────────
      ammo_9mm:             { name: '9mm Ammo',           stackable: true,  rarity: 'common',  effect: 'pistol ammunition',                     usable: false, category: 'ammo' },
      ammo_45acp:           { name: '.45 ACP Ammo',       stackable: true,  rarity: 'common',  effect: 'pistol ammunition',                     usable: false, category: 'ammo' },
      ammo_556:             { name: '5.56mm Ammo',        stackable: true,  rarity: 'common',  effect: 'rifle ammunition',                      usable: false, category: 'ammo' },
      ammo_762:             { name: '7.62mm Ammo',        stackable: true,  rarity: 'common',  effect: 'rifle ammunition',                      usable: false, category: 'ammo' },
      ammo_308:             { name: '.308 Ammo',          stackable: true,  rarity: 'common',  effect: 'sniper rifle ammunition',               usable: false, category: 'ammo' },
      ammo_12gauge_buck:    { name: '12 Gauge Buckshot',  stackable: true,  rarity: 'common',  effect: 'shotgun ammunition',                    usable: false, category: 'ammo' },
      ammo_12gauge_slug:    { name: '12 Gauge Slug',      stackable: true,  rarity: 'common',  effect: 'shotgun ammunition, armor penetrating', usable: false, category: 'ammo' },
      ammo_50cal:           { name: '.50 Cal Ammo',       stackable: true,  rarity: 'uncommon',effect: 'heavy weapon ammunition',               usable: false, category: 'ammo' },
      ammo_crossbow_bolt:   { name: 'Crossbow Bolt',      stackable: true,  rarity: 'common',  effect: 'crossbow ammunition',                   usable: false, category: 'ammo' },
      ammo_arrow:           { name: 'Arrow',              stackable: true,  rarity: 'common',  effect: 'bow ammunition, recoverable',           usable: false, category: 'ammo' },
      ammo_flare:           { name: 'Flare',              stackable: true,  rarity: 'uncommon',effect: 'signals flare, illuminates area',       usable: false, category: 'ammo' },

      // ── Tools ───────────────────────────────────────────────────────────
      tool_flashlight:      { name: 'Flashlight',         stackable: false, rarity: 'uncommon',effect: 'illuminates dark areas',                usable: true,  category: 'tool' },
      tool_crowbar:         { name: 'Crowbar',            stackable: false, rarity: 'uncommon',effect: 'pries open doors and crates',           usable: false, category: 'tool' },
      tool_multitool:       { name: 'Multitool',          stackable: false, rarity: 'uncommon',effect: 'multi-purpose repair tool',             usable: false, category: 'tool' },
      tool_wire_cutters:    { name: 'Wire Cutters',       stackable: false, rarity: 'uncommon',effect: 'cuts wire fences and locks',            usable: false, category: 'tool' },
      tool_bolt_cutters:    { name: 'Bolt Cutters',       stackable: false, rarity: 'uncommon',effect: 'cuts padlocks and chains',              usable: false, category: 'tool' },
      tool_pipe_wrench:     { name: 'Pipe Wrench',        stackable: false, rarity: 'uncommon',effect: 'repairs plumbing, melee 20 damage',     usable: false, category: 'tool' },
      tool_hacksaw:         { name: 'Hacksaw',            stackable: false, rarity: 'uncommon',effect: 'cuts metal',                            usable: false, category: 'tool' },
      tool_drill_bit:       { name: 'Drill Bit',          stackable: true,  rarity: 'common',  effect: 'crafting component',                    usable: false, category: 'tool' },
      tool_measuring_tape:  { name: 'Measuring Tape',     stackable: false, rarity: 'common',  effect: 'building aid',                          usable: false, category: 'tool' },
      tool_level:           { name: 'Spirit Level',       stackable: false, rarity: 'common',  effect: 'building aid',                          usable: false, category: 'tool' },
      tool_soldering_iron:  { name: 'Soldering Iron',     stackable: false, rarity: 'uncommon',effect: 'repairs electronics',                   usable: false, category: 'tool' },

      // ── Survival Gear ────────────────────────────────────────────────────
      gear_compass:         { name: 'Compass',            stackable: false, rarity: 'uncommon',effect: 'shows cardinal direction',              usable: true,  category: 'gear' },
      gear_map:             { name: 'Map',                stackable: false, rarity: 'uncommon',effect: 'reveals map area',                      usable: true,  category: 'gear' },
      gear_gps:             { name: 'GPS Device',         stackable: false, rarity: 'rare',    effect: 'shows exact position on map',          usable: true,  category: 'gear' },
      gear_binoculars:      { name: 'Binoculars',         stackable: false, rarity: 'uncommon',effect: 'zoom vision',                           usable: true,  category: 'gear' },
      gear_night_vision:    { name: 'Night Vision Goggles',stackable: false,rarity: 'rare',    effect: 'see in the dark',                       usable: true,  category: 'gear' },
      gear_gas_mask:        { name: 'Gas Mask',           stackable: false, rarity: 'rare',    effect: 'protects from toxic gas',               usable: true,  category: 'gear' },
      gear_radiation_detector:{ name: 'Radiation Detector',stackable: false,rarity: 'rare',   effect: 'detects radiation zones',               usable: true,  category: 'gear' },
      gear_walkie_talkie:   { name: 'Walkie-Talkie',      stackable: false, rarity: 'uncommon',effect: 'communicate with survivors',            usable: true,  category: 'gear' },
      gear_flare_gun_item:  { name: 'Flare Gun',          stackable: false, rarity: 'uncommon',effect: 'fires signal flares',                   usable: true,  category: 'gear' },
      gear_signal_mirror:   { name: 'Signal Mirror',      stackable: false, rarity: 'common',  effect: 'signal aircraft or distant survivors',  usable: true,  category: 'gear' },
      gear_whistle:         { name: 'Whistle',            stackable: false, rarity: 'common',  effect: 'attract or distract zombies',           usable: true,  category: 'gear' },
      gear_sleeping_bag:    { name: 'Sleeping Bag',       stackable: false, rarity: 'common',  effect: 'rest to recover health',                usable: true,  category: 'gear' },
      gear_tent:            { name: 'Tent',               stackable: false, rarity: 'uncommon',effect: 'portable shelter, safe rest point',     usable: true,  category: 'gear' },
      gear_water_filter:    { name: 'Water Filter',       stackable: false, rarity: 'uncommon',effect: 'purify dirty water',                    usable: true,  category: 'gear' },
      gear_fire_starter:    { name: 'Fire Starter',       stackable: true,  rarity: 'common',  effect: 'start campfires',                       usable: true,  category: 'gear' },
      gear_fishing_rod:     { name: 'Fishing Rod',        stackable: false, rarity: 'common',  effect: 'catch fish for food',                   usable: true,  category: 'gear' },
      gear_snare_trap:      { name: 'Snare Trap',         stackable: true,  rarity: 'common',  effect: 'trap small animals',                    usable: true,  category: 'gear' },

      // ── Electronics & Valuables ──────────────────────────────────────────
      elec_phone:           { name: 'Smartphone',         stackable: false, rarity: 'rare',    effect: 'access stored data',                    usable: false, category: 'electronics' },
      elec_laptop:          { name: 'Laptop',             stackable: false, rarity: 'epic',    effect: 'hack terminals',                        usable: false, category: 'electronics' },
      elec_tablet:          { name: 'Tablet',             stackable: false, rarity: 'rare',    effect: 'access digital manuals',                usable: false, category: 'electronics' },
      elec_radio:           { name: 'Radio',              stackable: false, rarity: 'rare',    effect: 'receive survivor broadcasts',           usable: false, category: 'electronics' },
      elec_circuit_board:   { name: 'Circuit Board',      stackable: true,  rarity: 'uncommon',effect: 'crafting component',                    usable: false, category: 'electronics' },
      elec_battery_pack:    { name: 'Battery Pack',       stackable: true,  rarity: 'uncommon',effect: 'power source for devices',              usable: false, category: 'electronics' },
      elec_solar_panel:     { name: 'Solar Panel',        stackable: false, rarity: 'rare',    effect: 'generate power from sunlight',          usable: false, category: 'electronics' },
      elec_generator_part:  { name: 'Generator Part',     stackable: true,  rarity: 'rare',    effect: 'repair generators',                     usable: false, category: 'electronics' },
      elec_usb_drive:       { name: 'USB Drive',          stackable: true,  rarity: 'uncommon',effect: 'store or transfer data',                usable: false, category: 'electronics' },
      elec_camera:          { name: 'Camera',             stackable: false, rarity: 'rare',    effect: 'document findings',                     usable: false, category: 'electronics' },
      elec_night_cam:       { name: 'Night Camera',       stackable: false, rarity: 'epic',    effect: 'see and record in darkness',            usable: false, category: 'electronics' },
      elec_gps_tracker:     { name: 'GPS Tracker',        stackable: true,  rarity: 'rare',    effect: 'track targets remotely',                usable: false, category: 'electronics' },

      // ── Crafting Materials ───────────────────────────────────────────────
      mat_duct_tape:        { name: 'Duct Tape',          stackable: true,  rarity: 'common',  effect: 'Repair weapons +40% durability',         usable: true,  category: 'material' },
      mat_zip_ties:         { name: 'Zip Ties',           stackable: true,  rarity: 'common',  effect: 'crafting material',                     usable: false, category: 'material' },
      mat_super_glue:       { name: 'Super Glue',         stackable: true,  rarity: 'common',  effect: 'crafting material',                     usable: false, category: 'material' },
      mat_epoxy:            { name: 'Epoxy',              stackable: true,  rarity: 'uncommon',effect: 'strong bonding agent',                  usable: false, category: 'material' },
      mat_solder:           { name: 'Solder',             stackable: true,  rarity: 'uncommon',effect: 'electronics crafting material',         usable: false, category: 'material' },
      mat_spring:           { name: 'Spring',             stackable: true,  rarity: 'common',  effect: 'mechanical crafting component',         usable: false, category: 'material' },
      mat_gear:             { name: 'Gear',               stackable: true,  rarity: 'common',  effect: 'mechanical crafting component',         usable: false, category: 'material' },
      mat_motor:            { name: 'Motor',              stackable: true,  rarity: 'uncommon',effect: 'mechanical crafting component',         usable: false, category: 'material' },
      mat_engine_part:      { name: 'Engine Part',        stackable: true,  rarity: 'uncommon',effect: 'vehicle repair component',              usable: false, category: 'material' },
      mat_spark_plug:       { name: 'Spark Plug',         stackable: true,  rarity: 'common',  effect: 'vehicle repair component',              usable: false, category: 'material' },
      mat_glass_bottle:     { name: 'Glass Bottle',       stackable: true,  rarity: 'common',  effect: 'crafting material, holds liquids',      usable: false, category: 'material' },
      mat_plastic_wrap:     { name: 'Plastic Wrap',       stackable: true,  rarity: 'common',  effect: 'crafting material',                     usable: false, category: 'material' },
      mat_rubber_tube:      { name: 'Rubber Tube',        stackable: true,  rarity: 'common',  effect: 'crafting material',                     usable: false, category: 'material' },
      mat_fiberglass:       { name: 'Fiberglass',         stackable: true,  rarity: 'uncommon',effect: 'armor crafting material',               usable: false, category: 'material' },
      mat_carbon_fiber:     { name: 'Carbon Fiber',       stackable: true,  rarity: 'rare',    effect: 'high-tier armor crafting material',     usable: false, category: 'material' },
      mat_kevlar_fiber:     { name: 'Kevlar Fiber',       stackable: true,  rarity: 'rare',    effect: 'ballistic protection material',         usable: false, category: 'material' },
      mat_leather:          { name: 'Leather',            stackable: true,  rarity: 'common',  effect: 'armor and clothing material',           usable: false, category: 'material' },
      mat_cloth:            { name: 'Cloth',              stackable: true,  rarity: 'common',  effect: 'crafting and bandage material',         usable: false, category: 'material' },
      mat_thread:           { name: 'Thread',             stackable: true,  rarity: 'common',  effect: 'clothing repair material',              usable: false, category: 'material' },
      mat_nails:            { name: 'Nails',              stackable: true,  rarity: 'common',  effect: 'construction material',                 usable: false, category: 'material' },
      mat_screws:           { name: 'Screws',             stackable: true,  rarity: 'common',  effect: 'construction material',                 usable: false, category: 'material' },
      mat_bolts:            { name: 'Bolts',              stackable: true,  rarity: 'common',  effect: 'construction material',                 usable: false, category: 'material' },
      mat_chain:            { name: 'Chain',              stackable: true,  rarity: 'uncommon',effect: 'crafting material',                     usable: false, category: 'material' },
      mat_bearing:          { name: 'Bearing',            stackable: true,  rarity: 'common',  effect: 'mechanical crafting component',         usable: false, category: 'material' },
      mat_gunpowder:        { name: 'Gunpowder',          stackable: true,  rarity: 'uncommon',effect: 'explosive crafting material',           usable: false, category: 'material' },
      mat_bleach:           { name: 'Bleach',             stackable: true,  rarity: 'common',  effect: 'cleaning/chemical crafting material',   usable: false, category: 'material' },
      mat_acetone:          { name: 'Acetone',            stackable: true,  rarity: 'common',  effect: 'chemical solvent',                      usable: false, category: 'material' },
      mat_alcohol_isopropyl:{ name: 'Isopropyl Alcohol',  stackable: true,  rarity: 'common',  effect: 'antiseptic, crafting material',         usable: false, category: 'material' },

      // ── Keys & Access ────────────────────────────────────────────────────
      key_car:              { name: 'Car Key',             stackable: false, rarity: 'rare',    effect: 'starts a vehicle',                      usable: true,  category: 'key' },
      key_padlock:          { name: 'Padlock Key',         stackable: false, rarity: 'rare',    effect: 'opens a padlock',                       usable: true,  category: 'key' },
      key_house:            { name: 'House Key',           stackable: false, rarity: 'rare',    effect: 'opens a house door',                    usable: true,  category: 'key' },
      key_safe:             { name: 'Safe Key',            stackable: false, rarity: 'rare',    effect: 'opens a safe',                          usable: true,  category: 'key' },
      key_locker:           { name: 'Locker Key',          stackable: false, rarity: 'uncommon',effect: 'opens a storage locker',                usable: true,  category: 'key' },
      keycard_red:          { name: 'Red Keycard',         stackable: false, rarity: 'rare',    effect: 'access level 1 secure areas',          usable: true,  category: 'key' },
      keycard_blue:         { name: 'Blue Keycard',        stackable: false, rarity: 'rare',    effect: 'access level 2 secure areas',          usable: true,  category: 'key' },
      keycard_green:        { name: 'Green Keycard',       stackable: false, rarity: 'rare',    effect: 'access level 3 secure areas',          usable: true,  category: 'key' },
      keycard_yellow:       { name: 'Yellow Keycard',      stackable: false, rarity: 'rare',    effect: 'access maintenance areas',              usable: true,  category: 'key' },
      key_master:           { name: 'Master Key',          stackable: false, rarity: 'epic',    effect: 'opens most locks',                      usable: true,  category: 'key' },
      lockpick_set:         { name: 'Lockpick Set',        stackable: false, rarity: 'rare',    effect: 'pick locks without a key',              usable: true,  category: 'key' },
      access_fob:           { name: 'Access Fob',          stackable: false, rarity: 'rare',    effect: 'electronic access device',              usable: true,  category: 'key' },

      // ── Armor & Clothing ─────────────────────────────────────────────────
      armor_vest:           { name: 'Ballistic Vest',      stackable: false, rarity: 'rare',    effect: '+40 armor, reduces bullet damage',      usable: false, category: 'armor' },
      armor_helmet:         { name: 'Combat Helmet',       stackable: false, rarity: 'rare',    effect: '+20 armor, head protection',            usable: false, category: 'armor' },
      armor_plate:          { name: 'Armor Plate',         stackable: true,  rarity: 'uncommon',effect: 'insert into vest for extra protection', usable: false, category: 'armor' },
      armor_gasmask:        { name: 'Armored Gas Mask',    stackable: false, rarity: 'rare',    effect: 'face protection + gas immunity',        usable: false, category: 'armor' },
      cloth_jacket:         { name: 'Jacket',              stackable: false, rarity: 'uncommon',effect: '+10 armor, cold protection',            usable: false, category: 'armor' },
      cloth_boots:          { name: 'Combat Boots',        stackable: false, rarity: 'uncommon',effect: '+5 armor, quieter movement',            usable: false, category: 'armor' },
      cloth_gloves:         { name: 'Gloves',              stackable: false, rarity: 'common',  effect: '+3 armor, better grip',                 usable: false, category: 'armor' },
      cloth_backpack:       { name: 'Backpack',            stackable: false, rarity: 'uncommon',effect: '+9 inventory slots',                    usable: true,  category: 'armor' },
      cloth_military_jacket:{ name: 'Military Jacket',     stackable: false, rarity: 'rare',    effect: '+20 armor, many pockets',               usable: false, category: 'armor' },
      cloth_hazmat_suit:    { name: 'Hazmat Suit',         stackable: false, rarity: 'rare',    effect: 'full body protection from chemicals/radiation', usable: false, category: 'armor' },

      // ── Unique / Special ─────────────────────────────────────────────────
      special_journal_page:   { name: 'Journal Page',       stackable: true,  rarity: 'epic',    effect: 'reveals story lore',                    usable: true,  category: 'special' },
      special_map_fragment:   { name: 'Map Fragment',        stackable: true,  rarity: 'epic',    effect: 'reveals a section of the world map',   usable: true,  category: 'special' },
      special_lab_report:     { name: 'Lab Report',          stackable: false, rarity: 'epic',    effect: 'contains research data on the virus',   usable: true,  category: 'special' },
      special_survivor_note:  { name: 'Survivor Note',       stackable: true,  rarity: 'epic',    effect: 'left by a survivor, hints at loot',     usable: true,  category: 'special' },
      special_photograph:     { name: 'Photograph',          stackable: true,  rarity: 'epic',    effect: 'a photograph of someone or somewhere',   usable: true,  category: 'special' },
      special_virus_sample:   { name: 'Virus Sample',        stackable: false, rarity: 'legendary',effect: 'dangerous biological sample, quest item',usable: false, category: 'special' },
      special_artifact:       { name: 'Strange Artifact',    stackable: false, rarity: 'legendary',effect: 'unknown origin and purpose',            usable: true,  category: 'special' },
      special_alien_device:   { name: 'Alien Device',        stackable: false, rarity: 'legendary',effect: 'technology beyond current understanding',usable: true, category: 'special' },
      special_power_cell:     { name: 'Power Cell',          stackable: true,  rarity: 'epic',    effect: 'advanced energy source',                usable: false, category: 'special' },
      special_admin_keycard:  { name: 'Admin Keycard',        stackable: false, rarity: 'legendary',effect: 'access all restricted areas',          usable: true,  category: 'special' },

      // ── New forageable foods ─────────────────────────────────────────────
      food_mushroom:        { name: 'Mushroom',            stackable: true,  rarity: 'common',  effect: 'restores 8 hunger, crafting ingredient',  usable: true,  category: 'food' },
      food_berry:           { name: 'Wild Berries',        stackable: true,  rarity: 'common',  effect: 'restores 6 hunger, 5 thirst',          usable: true,  category: 'food' },
      food_honey:           { name: 'Honey',               stackable: true,  rarity: 'uncommon',effect: 'restores 12 hunger, 10 stamina',          usable: true,  category: 'food' },
      food_cooked_meat:     { name: 'Cooked Meat',         stackable: true,  rarity: 'common',  effect: 'restores 30 hunger, 10 health',           usable: true,  category: 'food' },
      food_military_ration: { name: 'Military Ration',     stackable: true,  rarity: 'uncommon',effect: 'restores 40 hunger, 20 stamina',          usable: true,  category: 'food' },

      // ── New crafting materials ────────────────────────────────────────────
      mat_battery:          { name: 'Battery',             stackable: true,  rarity: 'common',  effect: 'powers electronic devices',               usable: false, category: 'material' },
      mat_wire:             { name: 'Copper Wire',         stackable: true,  rarity: 'common',  effect: 'electronics crafting component',          usable: false, category: 'material' },
      mat_charcoal:         { name: 'Charcoal',            stackable: true,  rarity: 'common',  effect: 'crafting/filtering material',             usable: false, category: 'material' },
      mat_sand:             { name: 'Sand',                stackable: true,  rarity: 'common',  effect: 'crafting material, makes glass',          usable: false, category: 'material' },

      // ── Explosives & Traps ───────────────────────────────────────────────
      explosive_molotov:    { name: 'Molotov Cocktail',    stackable: true,  rarity: 'uncommon',effect: 'throwable fire bomb, area damage',        usable: true,  category: 'weapon' },
      trap_spike_trap:      { name: 'Spike Trap',          stackable: true,  rarity: 'uncommon',effect: 'place on ground, damages zombies',        usable: true,  category: 'weapon' },
      explosive_grenade:    { name: 'Frag Grenade',        stackable: true,  rarity: 'rare',    effect: 'throwable explosive',                     usable: true,  category: 'weapon' },

      // ── Drinks (additional) ──────────────────────────────────────────────
      drink_wine:           { name: 'Wine Bottle',         stackable: true,  rarity: 'uncommon',effect: 'restores 12 stamina, minor debuff',       usable: true,  category: 'food' },
      drink_whiskey:        { name: 'Whiskey',             stackable: true,  rarity: 'uncommon',effect: 'restores 15 stamina, pain reduction',     usable: true,  category: 'food' },
      drink_rum:            { name: 'Rum',                 stackable: true,  rarity: 'uncommon',effect: 'restores 12 stamina',                    usable: true,  category: 'food' },
      drink_tea:            { name: 'Green Tea',           stackable: true,  rarity: 'common',  effect: 'restores 15 stamina, calming effect',    usable: true,  category: 'food' },
      drink_hot_cocoa:      { name: 'Hot Cocoa Mix',       stackable: true,  rarity: 'common',  effect: 'restores 10 hunger, 10 stamina',         usable: true,  category: 'food' },

      // ── Food (additional) ────────────────────────────────────────────────
      food_frozen_pizza:    { name: 'Frozen Pizza',        stackable: true,  rarity: 'uncommon',effect: 'restores 28 hunger',                    usable: true,  category: 'food' },
      food_cookies:         { name: 'Cookies',             stackable: true,  rarity: 'common',  effect: 'restores 8 hunger, 5 stamina',           usable: true,  category: 'food' },
      food_soup_bowl:       { name: 'Canned Tomato Soup',  stackable: true,  rarity: 'common',  effect: 'restores 20 hunger',                    usable: true,  category: 'food' },
      food_oatmeal:         { name: 'Oatmeal',             stackable: true,  rarity: 'common',  effect: 'restores 18 hunger, 5 stamina',          usable: true,  category: 'food' },
      food_granola_bar:     { name: 'Granola Bar',         stackable: true,  rarity: 'common',  effect: 'restores 10 hunger, 8 stamina',          usable: true,  category: 'food' },
      food_dried_fruit:     { name: 'Dried Fruit',         stackable: true,  rarity: 'common',  effect: 'restores 12 hunger, 5 thirst',        usable: true,  category: 'food' },
      food_canned_peaches:  { name: 'Canned Peaches',      stackable: true,  rarity: 'common',  effect: 'restores 14 hunger, 8 thirst',        usable: true,  category: 'food' },

      // ── Tools (additional) ───────────────────────────────────────────────
      tool_lighter:         { name: 'Lighter',             stackable: false, rarity: 'common',  effect: 'start fires, light torches',             usable: true,  category: 'tool' },
      tool_canteen:         { name: 'Canteen',             stackable: false, rarity: 'common',  effect: 'holds water, refillable',                usable: true,  category: 'tool' },
      tool_matches:         { name: 'Matches',             stackable: true,  rarity: 'common',  effect: 'start fires',                            usable: true,  category: 'tool' },
      tool_knife_swiss:     { name: 'Swiss Army Knife',    stackable: false, rarity: 'uncommon',effect: 'multi-tool, melee 10 damage',            usable: false, category: 'tool' },
      tool_hand_saw:        { name: 'Hand Saw',            stackable: false, rarity: 'uncommon',effect: 'cuts wood, crafting tool',               usable: false, category: 'tool' },

      // ── Special (additional) ─────────────────────────────────────────────
      special_family_photo: { name: 'Family Photo',        stackable: false, rarity: 'epic',    effect: 'a photo of the family who lived here',   usable: true,  category: 'special' },
      special_diary:        { name: 'Personal Diary',      stackable: false, rarity: 'epic',    effect: 'contains pre-apocalypse personal stories',usable: true, category: 'special' },
      special_recipe_book:  { name: 'Recipe Book',         stackable: false, rarity: 'uncommon',effect: 'unlocks new cooking recipes',            usable: true,  category: 'special' },
      special_house_plan:   { name: 'House Blueprint',     stackable: false, rarity: 'rare',    effect: 'reveals hidden rooms on the map',        usable: true,  category: 'special' },

      // ── Gear (additional) ────────────────────────────────────────────────
      gear_headlamp:        { name: 'Headlamp',            stackable: false, rarity: 'uncommon',effect: 'hands-free illumination',                usable: true,  category: 'gear' },
      gear_paracord:        { name: 'Paracord',            stackable: true,  rarity: 'common',  effect: 'versatile survival cord',                usable: false, category: 'gear' },
      gear_tarp:            { name: 'Tarp',                stackable: false, rarity: 'common',  effect: 'emergency shelter, crafting material',   usable: false, category: 'gear' },
      gear_bungee_cord:     { name: 'Bungee Cord',         stackable: true,  rarity: 'common',  effect: 'securing/crafting material',             usable: false, category: 'gear' },

      // ── Medical (additional) ─────────────────────────────────────────────
      med_aspirin:          { name: 'Aspirin',             stackable: true,  rarity: 'common',  effect: 'restores 8 health, reduces fever',       usable: true,  category: 'medical' },
      med_ibuprofen:        { name: 'Ibuprofen',           stackable: true,  rarity: 'common',  effect: 'restores 10 health, anti-inflammatory',  usable: true,  category: 'medical' },
      med_thermometer:      { name: 'Thermometer',         stackable: false, rarity: 'common',  effect: 'detect fever / infection status',        usable: true,  category: 'medical' },
      med_stethoscope:      { name: 'Stethoscope',         stackable: false, rarity: 'uncommon',effect: 'advanced health diagnosis',              usable: true,  category: 'medical' },

      // ── Ammo (alias for backward compat) ─────────────────────────────────
      ammo_12gauge:         { name: '12 Gauge Shells',     stackable: true,  rarity: 'common',  effect: 'shotgun ammunition',                     usable: false, category: 'ammo' },

      // ── Materials (additional) ───────────────────────────────────────────
      mat_salt:             { name: 'Salt',                stackable: true,  rarity: 'common',  effect: 'food preservation, crafting ingredient', usable: false, category: 'material' },
      mat_sugar:            { name: 'Sugar',               stackable: true,  rarity: 'common',  effect: 'food ingredient, energy source',         usable: false, category: 'material' },
      mat_coffee_grounds:   { name: 'Coffee Grounds',      stackable: true,  rarity: 'common',  effect: 'make coffee, bait for animals',          usable: false, category: 'material' },
      mat_candles:          { name: 'Candles',             stackable: true,  rarity: 'common',  effect: 'light source, crafting material',        usable: true,  category: 'material' },

      // ── New weapons (added this session) ────────────────────────────────
      weapon_flare_gun:     { name: 'Flare Gun',          stackable: false, rarity: 'uncommon', effect: 'fires flares, can ignite zombies',          usable: false, category: 'weapon' },
      weapon_nail_bat:      { name: 'Spiked Bat',          stackable: false, rarity: 'uncommon', effect: 'melee, 35 damage, causes bleed',            usable: false, category: 'weapon' },
      weapon_slingshot:     { name: 'Slingshot',           stackable: false, rarity: 'common',   effect: 'ranged, 12 damage, silent',                 usable: false, category: 'weapon' },
      weapon_electric_baton:{ name: 'Electric Baton',      stackable: false, rarity: 'rare',     effect: 'melee, 45 damage, stuns enemies',           usable: false, category: 'weapon' },
      weapon_compound_bow:  { name: 'Compound Bow',        stackable: false, rarity: 'rare',     effect: 'ranged, 55 damage, silent, accurate',       usable: false, category: 'weapon' },

      // ── New Tactical & Gear Items ────────────────────────────────────────
      gear_decoy:           { name: 'Noise Decoy',         stackable: true,  rarity: 'uncommon', effect: 'throws a noise-making decoy, distracts zombies 20s', usable: true,  category: 'gear' },
      tool_repair_kit:      { name: 'Repair Kit',          stackable: true,  rarity: 'uncommon', effect: 'repairs equipped armor by 40%, restores durability', usable: true,  category: 'tool' },
      food_energy_bar:      { name: 'Energy Bar',          stackable: true,  rarity: 'common',   effect: 'restores 20 hunger and 30 stamina instantly',         usable: true,  category: 'food' },
      special_blueprint:    { name: 'Crafting Blueprint',  stackable: true,  rarity: 'rare',     effect: 'teaches a new crafting recipe',                      usable: true,  category: 'special' },
      gear_ghillie_suit:    { name: 'Ghillie Suit',        stackable: false, rarity: 'rare',     effect: 'reduces zombie aggro range by 40% while worn',       usable: true,  category: 'gear' },
      med_stim_shot:        { name: 'Stim Shot',           stackable: true,  rarity: 'rare',     effect: '+50% speed and fire rate for 8s, then -20% for 5s',  usable: true,  category: 'medical' },
      explosive_claymore:   { name: 'Claymore Mine',       stackable: true,  rarity: 'epic',     effect: 'directional mine, massive damage in 8m cone',        usable: true,  category: 'weapon' },

      // ── Traps & Tactical ────────────────────────────────────────────────
      trap_bear_trap:       { name: 'Bear Trap',           stackable: true,  rarity: 'uncommon', effect: 'place on ground, snares and heavily damages zombies', usable: true, category: 'weapon' },
      trap_wire_snare:      { name: 'Wire Snare',          stackable: true,  rarity: 'common',   effect: 'tripwire trap, slows and damages zombies',  usable: true,  category: 'weapon' },
      trap_alarm_trap:      { name: 'Noise Alarm',         stackable: true,  rarity: 'uncommon', effect: 'triggers loud alarm when triggered',         usable: true,  category: 'tool' },
      trap_landmine:        { name: 'Landmine',            stackable: true,  rarity: 'rare',     effect: 'pressure plate, massive AoE explosion on trigger', usable: true, category: 'weapon' },

      // ── Smoke & Tactical Grenades ────────────────────────────────────────
      explosive_smoke_grenade:{ name: 'Smoke Grenade',     stackable: true,  rarity: 'uncommon', effect: 'throwable, creates dense smoke cloud',      usable: true,  category: 'weapon' },
      explosive_flash_bang: { name: 'Flashbang',           stackable: true,  rarity: 'rare',     effect: 'throwable, blinds and stuns enemies',       usable: true,  category: 'weapon' },
      explosive_pipe_bomb:  { name: 'Pipe Bomb',           stackable: true,  rarity: 'uncommon', effect: 'improvised explosive, large area damage',   usable: true,  category: 'weapon' },

      // ── Power & Utility ──────────────────────────────────────────────────
      tool_generator:       { name: 'Portable Generator',  stackable: false, rarity: 'rare',     effect: 'generates electricity, powers electronics', usable: true,  category: 'tool' },
      tool_solar_panel:     { name: 'Solar Panel',         stackable: false, rarity: 'rare',     effect: 'passive power generation in daylight',      usable: true,  category: 'tool' },
      tool_car_battery:     { name: 'Car Battery',         stackable: false, rarity: 'uncommon', effect: 'portable power source for vehicles/tools',  usable: false, category: 'tool' },
      tool_fuel_can:        { name: 'Fuel Can',            stackable: true,  rarity: 'common',   effect: 'fuel for generator or vehicles',            usable: false, category: 'material' },

      // ── Navigation & Scouting ────────────────────────────────────────────
      gear_drone:           { name: 'Scout Drone',         stackable: false, rarity: 'epic',     effect: 'aerial reconnaissance, 60s battery life',  usable: true,  category: 'gear' },
      gear_flare:           { name: 'Signal Flare',        stackable: true,  rarity: 'common',   effect: 'marks position, attracts or distracts zombies', usable: true, category: 'gear' },
      gear_smoke_signal:    { name: 'Smoke Signal',        stackable: true,  rarity: 'uncommon', effect: 'visible from far away, signals rescue',     usable: true,  category: 'gear' },

      // ── Survival / Shelter ───────────────────────────────────────────────
      gear_tarp:            { name: 'Emergency Tarp',      stackable: false, rarity: 'common',   effect: 'improvised shelter from rain and wind',     usable: true,  category: 'gear' },
      gear_hammock:         { name: 'Hammock',             stackable: false, rarity: 'uncommon', effect: 'rest off-ground, prevents insect bites',    usable: true,  category: 'gear' },
      tool_multitool:       { name: 'Multi-Tool',          stackable: false, rarity: 'uncommon', effect: 'repair weapon durability (+30), craft items', usable: true, category: 'tool' },
      tool_wire_cutter:     { name: 'Wire Cutters',        stackable: false, rarity: 'uncommon', effect: 'cut fences and wire traps',                 usable: false, category: 'tool' },
      tool_bolt_cutter:     { name: 'Bolt Cutters',        stackable: false, rarity: 'rare',     effect: 'open locked chains and padlocks',           usable: false, category: 'tool' },
      tool_rope:            { name: 'Rope (10m)',          stackable: true,  rarity: 'common',   effect: 'climbing, crafting, securing barricades',   usable: false, category: 'material' },
      tool_handcuffs:       { name: 'Zip Ties',            stackable: true,  rarity: 'common',   effect: 'bind zombies briefly when combined with stunner', usable: false, category: 'tool' },

      // ── Advanced Medical ─────────────────────────────────────────────────
      med_epipen:           { name: 'EpiPen',              stackable: true,  rarity: 'rare',     effect: 'instantly reverses adrenaline crash, +30 HP', usable: true, category: 'medical' },
      med_defibrillator:    { name: 'Defibrillator',       stackable: false, rarity: 'legendary',effect: 'restart heart — revive from 0 HP once',     usable: true,  category: 'medical' },
      med_blood_bag:        { name: 'Blood Bag (O+)',       stackable: true,  rarity: 'rare',     effect: 'transfusion: +50 HP, cures bleeding',       usable: true,  category: 'medical' },
      med_suture_kit:       { name: 'Suture Kit',          stackable: true,  rarity: 'uncommon', effect: 'stitches wounds, stops heavy bleeding permanently', usable: true, category: 'medical' },
      med_splint:           { name: 'Splint',              stackable: true,  rarity: 'common',   effect: 'immobilise broken limb, restores full movement', usable: true, category: 'medical' },

      // ── Scavenged Electronics ────────────────────────────────────────────
      elec_radio_transceiver:{ name: 'Radio Transceiver',  stackable: false, rarity: 'epic',     effect: 'long-range comms, detects broadcast signals', usable: true, category: 'gear' },
      elec_emp_grenade:     { name: 'EMP Grenade',         stackable: true,  rarity: 'epic',     effect: 'disables electronic zombies and alarms in radius', usable: true, category: 'weapon' },
      elec_tracker:         { name: 'Motion Tracker',      stackable: false, rarity: 'rare',     effect: 'beeps when zombies within 15m, shows on minimap', usable: true, category: 'gear' },
      elec_stun_baton:      { name: 'Stun Baton',          stackable: false, rarity: 'rare',     effect: 'close-range stun, no durability loss',       usable: true,  category: 'weapon' },
      elec_laser_sight:     { name: 'Laser Sight',         stackable: true,  rarity: 'uncommon', effect: 'attachable to guns, reduces spread by 40%',  usable: false, category: 'tool' },

      // ── Craftable Components ─────────────────────────────────────────────
      mat_gunpowder:        { name: 'Gunpowder',           stackable: true,  rarity: 'uncommon', effect: 'craft ammo or explosives',                  usable: false, category: 'material' },
      mat_saltpeter:        { name: 'Saltpeter',           stackable: true,  rarity: 'uncommon', effect: 'explosive oxidiser',                        usable: false, category: 'material' },
      mat_charcoal:         { name: 'Charcoal',            stackable: true,  rarity: 'common',   effect: 'fuel, water filter component',              usable: false, category: 'material' },
      mat_resin:            { name: 'Pine Resin',          stackable: true,  rarity: 'common',   effect: 'adhesive and fire-starter compound',        usable: false, category: 'material' },
      mat_kevlar_shred:     { name: 'Kevlar Shreds',       stackable: true,  rarity: 'rare',     effect: 'reinforce armour vest for extra protection', usable: false, category: 'material' },
      mat_circuit_board:    { name: 'Circuit Board',       stackable: true,  rarity: 'uncommon', effect: 'craft electronics and traps',               usable: false, category: 'material' },

      // ── Rare / Legendary Finds ───────────────────────────────────────────
      special_cdc_keycard:  { name: 'CDC Keycard',         stackable: false, rarity: 'legendary',effect: 'opens locked CDC facilities',               usable: false, category: 'key' },
      special_vaccine_dose: { name: 'Experimental Vaccine',stackable: false, rarity: 'legendary',effect: 'cure for zombie infection — use immediately', usable: true, category: 'medical' },
      special_military_id:  { name: 'Military ID Badge',   stackable: false, rarity: 'epic',     effect: 'grants access to military checkpoints',     usable: false, category: 'key' },
      special_black_market_note:{ name: 'Black Market List', stackable: false, rarity: 'rare',   effect: 'lists hidden supply stash locations',       usable: true,  category: 'special' },

      // ── Food (Cooked) ────────────────────────────────────────────────────
      food_roasted_meat:    { name: 'Roasted Meat',        stackable: true,  rarity: 'common',   effect: '+35 hunger, requires campfire to craft',    usable: true,  category: 'food' },
      food_hardtack:        { name: 'Hardtack Biscuit',    stackable: true,  rarity: 'common',   effect: '+10 hunger, extremely durable, no spoilage', usable: true,  category: 'food' },
      food_jerky:           { name: 'Beef Jerky',          stackable: true,  rarity: 'common',   effect: '+18 hunger, high salt content',             usable: true,  category: 'food' },
      food_pemmican:        { name: 'Pemmican',            stackable: true,  rarity: 'uncommon', effect: '+30 hunger +10 thirst, high-energy survival food', usable: true, category: 'food' },
      drink_coconut_water:  { name: 'Coconut Water',       stackable: true,  rarity: 'uncommon', effect: '+30 thirst, natural electrolytes',          usable: true,  category: 'drink' },
      drink_rain_water:     { name: 'Collected Rain Water',stackable: true,  rarity: 'common',   effect: '+15 thirst, must be purified first',        usable: true,  category: 'drink' },
    };

    this.setupUI();
    this.setupKeybinds();
    this.createQuickSlots();
    this.setupItemNameDisplay();
  }

  setupUI() {
    this.screen = document.getElementById('inventory-screen');
    this.grid = document.getElementById('inventory-grid');
    this.itemNameDisplay = document.getElementById('item-name-display');
    this._buildGrid();
  }

  setupItemNameDisplay() {
    this.itemNameDisplay = document.getElementById('item-name-display');
  }

  _buildGrid() {
    if (!this.grid) return;
    this.grid.innerHTML = '';
    this._slotEls = [];

    for (let i = 0; i < this.totalSlots; i++) {
      const el = document.createElement('div');
      el.className = i < this.quickSlots
        ? 'inventory-slot inv-hotbar-slot'
        : 'inventory-slot';
      el.dataset.slot = i;

      el.addEventListener('click', () => this.useItem(i));
      el.addEventListener('mouseenter', () => this._showTooltip(i, el));
      el.addEventListener('mouseleave', () => this._hideTooltip());

      this._slotEls.push(el);
      this.grid.appendChild(el);
    }

    // Sync initial state (all slots start empty, but guard for late calls)
    for (let i = 0; i < this.totalSlots; i++) {
      this._syncSlot(i);
    }
  }

  _syncSlot(i) {
    const el = this._slotEls[i];
    if (!el) return;

    // Reset to base class
    el.className = i < this.quickSlots
      ? 'inventory-slot inv-hotbar-slot'
      : 'inventory-slot';

    const slotData = this.slots[i];
    if (slotData) {
      const def = this.itemTypes[slotData.type];
      el.classList.add('occupied', `rarity-${def?.rarity ?? 'common'}`);
      const cat = InventorySystem.getIconCat(slotData.type);
      el.innerHTML = `<div class="item-icon" data-cat="${cat}"></div>`
        + (slotData.quantity > 1
          ? `<div class="inv-qty">${slotData.quantity}</div>`
          : '');
    } else {
      el.innerHTML = '';
    }
  }

  setupKeybinds() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'e' && !this.game.commandSystem.isOpen && !this.game.settingsMenu?.isOpen) {
        this.toggleInventory();
      }

      if (e.key >= '1' && e.key <= '9' && !this.game.commandSystem.isOpen && !this.isOpen) {
        const slotNum = parseInt(e.key) - 1;
        this.selectQuickSlot(slotNum);
      }

      // G = use last selected quick-slot item (use without opening inventory)
      if (e.key.toLowerCase() === 'g' && !this.game.commandSystem.isOpen && !this.isOpen) {
        const idx = this.lastSelectedQuickSlot >= 0 ? this.lastSelectedQuickSlot : 0;
        if (this.slots[idx]) {
          this.useItem(idx);
        }
      }
    });
  }

  createQuickSlots() {
    const container = document.getElementById('quick-slots');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < this.quickSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'quick-slot';
      slot.id = `quick-slot-${i}`;
      slot.addEventListener('click', () => this.selectQuickSlot(i));
      container.appendChild(slot);
    }

    this.updateQuickSlotDisplay();
  }

  addItem(itemType, quantity = 1) {
    if (!this.itemTypes[itemType]) {
      console.error('Unknown item type:', itemType);
      return false;
    }

    const itemDef = this.itemTypes[itemType];

    if (itemDef.stackable) {
      for (let i = 0; i < this.totalSlots; i++) {
        if (this.slots[i] && this.slots[i].type === itemType) {
          this.slots[i].quantity += quantity;
          this._syncSlot(i);
          this.updateQuickSlotDisplay();
          this._updateWeight();
          return true;
        }
      }
    }

    for (let i = 0; i < this.totalSlots; i++) {
      if (!this.slots[i]) {
        this.slots[i] = {
          type: itemType,
          quantity: quantity,
          name: itemDef.name
        };
        this._syncSlot(i);
        this.updateQuickSlotDisplay();
        this._updateWeight();
        return true;
      }
    }

    console.warn('Inventory full!');
    return false;
  }

  removeItem(slotIndex, quantity = 1) {
    if (!this.slots[slotIndex]) return false;

    this.slots[slotIndex].quantity -= quantity;
    if (this.slots[slotIndex].quantity <= 0) {
      this.slots[slotIndex] = null;
    }

    this._syncSlot(slotIndex);
    this.updateQuickSlotDisplay();
    this._updateWeight();
    return true;
  }

  getItem(slotIndex) {
    return this.slots[slotIndex];
  }

  hasItem(type) {
    return this.slots.some(s => s && s.type === type);
  }

  toggleInventory() {
    if (this.isOpen) {
      this.closeInventory();
    } else {
      this.openInventory();
    }
  }

  openInventory() {
    this.isOpen = true;
    this.screen.classList.add('open');
    this.game.inputManager.exitPointerLock();
    this.game.pause();
    // Grid is always up-to-date via _syncSlot; no rebuild needed
  }

  closeInventory() {
    this.isOpen = false;
    this.screen.classList.remove('open');
    this.game.resume();
    if (this.game.player) {
      this.game.inputManager.requestPointerLock();
    }
  }

  renderInventory() {
    // Full sync — updates all slot DOM nodes in-place (no DOM rebuild)
    for (let i = 0; i < this.totalSlots; i++) {
      this._syncSlot(i);
    }
  }

  selectSlot(index) {
    this.selectedSlot = index;
  }

  selectQuickSlot(index) {
    if (!this.slots[index]) return;
    const item = this.slots[index];
    this.lastSelectedQuickSlot = index;
    this.showQuickSlotName(index);
  }

  showQuickSlotName(index) {
    if (!this.slots[index]) return;
    const item = this.slots[index];
    this.itemNameDisplay.textContent = item.name;
    this.itemNameDisplay.style.opacity = '1';

    if (this.itemNameTimeout) clearTimeout(this.itemNameTimeout);
    this.itemNameTimeout = setTimeout(() => {
      this.itemNameDisplay.style.opacity = '0';
    }, 2000);
  }

  _showTooltip(index, slotEl) {
    if (!this.slots[index]) return;

    const item = this.slots[index];
    const itemDef = this.itemTypes[item.type];
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-name">${item.name}</div>
      <div class="tooltip-rarity rarity-${itemDef.rarity}">${itemDef.rarity.toUpperCase()}</div>
      <div class="tooltip-effect">${itemDef.effect}</div>
      ${itemDef.usable ? '<div class="tooltip-usage">Click to use</div>' : ''}
    `;

    slotEl.appendChild(tooltip);
    this.currentTooltip = tooltip;
  }

  _hideTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  // Legacy aliases kept for any external callers
  showItemTooltip(index, slotEl) { this._showTooltip(index, slotEl); }
  hideItemTooltip() { this._hideTooltip(); }

  useItem(index) {
    if (!this.slots[index]) return;
    const item = this.slots[index];
    const itemDef = this.itemTypes[item.type];

    if (!itemDef || !itemDef.usable) {
      console.log('This item cannot be used');
      return;
    }

    const player = this.game.player;

    // ── Original items ───────────────────────────────────────────────────
    switch (item.type) {
      case 'water_bottle':
        if (player) {
          player.stamina = Math.min(player.stamina + 20, player.maxStamina);
          if (player.thirst !== undefined) player.thirst = Math.min(player.thirst + 30, player.maxThirst);
        }
        this.game.audioManager?.playEat?.();
        this.removeItem(index, 1);
        return;
      case 'food':
        if (player) player.hunger = Math.min(player.hunger + 25, player.maxHunger);
        this.game.audioManager?.playEat?.();
        this.removeItem(index, 1);
        return;
      case 'medical_kit':
        if (player) {
          player.health = player.maxHealth;
          player._bleeding = false;
          player._bleedTimer = 0;
          player._infected = false;
          player._infectTimer = 0;
          this.game.particleSystem?.createHeal?.(player.getPosition());
        }
        this.removeItem(index, 1);
        return;
      case 'bandage':
        if (player) {
          player.health = Math.min(player.health + 15, player.maxHealth);
          player._bleeding = false;
          player._bleedTimer = 0;
          this.game.particleSystem?.createHeal?.(player.getPosition());
        }
        this.removeItem(index, 1);
        return;
    }

    // ── Tool: flashlight ─────────────────────────────────────────────────
    if (item.type === 'tool_flashlight') {
      if (player) {
        player.flashlightOn = !player.flashlightOn;
        console.log(`Flashlight ${player.flashlightOn ? 'ON' : 'OFF'}`);
      }
      return; // flashlight is not consumed
    }

    // ── Food items (food_*) ───────────────────────────────────────────────
    if (item.type.startsWith('food_')) {
      if (player) {
        const hungerMap = {
          food_canned_beans: 15, food_canned_soup: 18, food_canned_tuna: 20,
          food_canned_corn: 12,  food_bread: 20,        food_crackers: 8,
          food_chocolate_bar: 10, food_protein_bar: 15, food_beef_jerky: 18,
          food_granola: 12,       food_apple: 8,         food_orange: 10,
          food_banana: 12,        food_chips: 5,         food_cereal: 14,
          food_pasta: 25,         food_rice: 20,         food_peanut_butter: 22,
          food_jam: 10,           food_instant_noodles: 18, food_energy_bar: 10,
          food_trail_mix: 12,     food_sardines: 16,     food_spam: 20,
          food_mushroom: 8,       food_berry: 6,         food_honey: 12,
          food_cooked_meat: 30,   food_military_ration: 40,
          food_frozen_pizza: 28,  food_cookies: 8,       food_soup_bowl: 20,
          food_oatmeal: 18,       food_granola_bar: 10,  food_dried_fruit: 12,
          food_canned_peaches: 14,
          food_roasted_meat: 28, food_hardtack: 14, food_jerky: 20,
          food_pemmican: 32,     food_raw_meat: 10
        };
        const staminaBonus = {
          food_chocolate_bar: 5, food_protein_bar: 10, food_banana: 5,
          food_peanut_butter: 5, food_energy_bar: 15,  food_trail_mix: 8,
          food_honey: 10,        food_military_ration: 20,
          food_oatmeal: 8,       food_granola_bar: 8,  food_cookies: 5,
          food_pemmican: 15,     food_roasted_meat: 12, food_jerky: 8
        };
        const healthBonus = {
          food_cooked_meat: 10, food_military_ration: 0,
          food_roasted_meat: 8, food_pemmican: 5
        };
        const thirstBonus = { food_apple: 5, food_orange: 8, food_berry: 5, food_canned_peaches: 8, food_soup_bowl: 10 };
        const hungerRestore = hungerMap[item.type] ?? 10;
        player.hunger = Math.min((player.hunger ?? 0) + hungerRestore, player.maxHunger ?? 100);
        if (staminaBonus[item.type]) {
          player.stamina = Math.min((player.stamina ?? 0) + staminaBonus[item.type], player.maxStamina ?? 100);
        }
        if (thirstBonus[item.type] && player.thirst !== undefined) {
          player.thirst = Math.min(player.thirst + thirstBonus[item.type], player.maxThirst ?? 100);
        }
        if (healthBonus[item.type]) {
          player.health = Math.min((player.health ?? 0) + healthBonus[item.type], player.maxHealth ?? 100);
        }
      }
      this.game.audioManager?.playEat?.();
      this.removeItem(index, 1);
      return;
    }

    // ── Drink items (drink_*) ─────────────────────────────────────────────
    if (item.type.startsWith('drink_')) {
      if (player) {
        const staminaMap = {
          drink_energy_drink: 25,  drink_soda: 10,     drink_coffee: 20,
          drink_milk: 15,          drink_juice: 15,    drink_sports_drink: 20,
          drink_dirty_water: 5,    drink_purified_water: 20, drink_beer: 10,
          drink_wine: 12,          drink_whiskey: 15,  drink_rum: 12,
          drink_tea: 15,           drink_hot_cocoa: 10,
          drink_coconut_water: 18, drink_rain_water: 8
        };
        const thirstMap = {
          drink_purified_water: 40, drink_sports_drink: 30, drink_juice: 25,
          drink_milk: 22,           drink_soda: 15,          drink_energy_drink: 12,
          drink_coffee: 10,         drink_beer: 8,           drink_dirty_water: 20,
          drink_wine: 10,           drink_whiskey: 8,        drink_rum: 8,
          drink_tea: 30,            drink_hot_cocoa: 25,
          drink_coconut_water: 35, drink_rain_water: 25
        };
        const hungerBonus = { drink_soda: 5, drink_milk: 10, drink_juice: 8 };
        const staminaRestore = staminaMap[item.type] ?? 10;
        player.stamina = Math.min((player.stamina ?? 0) + staminaRestore, player.maxStamina ?? 100);
        const thirstRestore = thirstMap[item.type] ?? 15;
        if (player.thirst !== undefined) {
          player.thirst = Math.min(player.thirst + thirstRestore, player.maxThirst ?? 100);
        }
        if (hungerBonus[item.type]) {
          player.hunger = Math.min((player.hunger ?? 0) + hungerBonus[item.type], player.maxHunger ?? 100);
        }
        // Alcoholic drinks: camera sway + stamina debuff for 30 seconds
        if (item.type === 'drink_wine' || item.type === 'drink_whiskey' || item.type === 'drink_rum') {
          const origMax = player.maxStamina ?? 100;
          player.maxStamina = Math.max(0, origMax - 5);
          player.stamina = Math.min(player.stamina ?? 0, player.maxStamina);
          if (player._drunkTimer !== undefined) player._drunkTimer = Math.min(60, (player._drunkTimer ?? 0) + 30);
          setTimeout(() => { player.maxStamina = origMax; }, 30000);
        }
        // Dirty / rain water: risk of infection and stamina debuff
        if (item.type === 'drink_dirty_water') {
          if (Math.random() < 0.35) {
            setTimeout(() => { player.stamina = Math.max(0, (player.stamina ?? 0) - 20); }, 5000);
          }
          if (Math.random() < 0.20 && player._infected !== undefined) {
            player._infected = true; player._infectTimer = player._infectTimer || 0;
          }
        }
        if (item.type === 'drink_rain_water') {
          if (Math.random() < 0.12 && player._infected !== undefined && !player._immune) {
            player._infected = true; player._infectTimer = player._infectTimer || 0;
          }
        }
      }
      this.game.audioManager?.playEat?.();
      this.removeItem(index, 1);
      return;
    }

    // ── Medical items (med_*) ─────────────────────────────────────────────
    if (item.type.startsWith('med_')) {
      this.game._medItemsUsed = (this.game._medItemsUsed ?? 0) + 1;
      if (player) {
        switch (item.type) {
          case 'med_antibiotics':
            player._infected = false;
            player._infectTimer = 0;
            player.health = Math.min((player.health ?? 0) + 5, player.maxHealth ?? 100);
            break;
          case 'med_antivenom':
            player.poisoned = false;
            player.health = Math.min((player.health ?? 0) + 5, player.maxHealth ?? 100);
            break;
          case 'med_blood_bag':
            player.health = Math.min((player.health ?? 0) + 40, player.maxHealth ?? 100);
            player._bleeding = false;
            player._bleedTimer = 0;
            break;
          case 'med_morphine':
            player.health = Math.min((player.health ?? 0) + 20, player.maxHealth ?? 100);
            player.painDebuff = false;
            if (player._shakeTime !== undefined) player._shakeTime = 0;
            if (player._morphineTimer !== undefined) player._morphineTimer = 30;
            break;
          case 'med_adrenaline':
            player.health = Math.min((player.health ?? 0) + 15, player.maxHealth ?? 100);
            player.stamina = Math.min((player.stamina ?? 0) + 30, player.maxStamina ?? 100);
            if (player._speedBoostTimer !== undefined) {
              player._speedBoostTimer = 15;
              player._speedBoostMult = 1.5;
              player._adrenalineActive = true;
              setTimeout(() => { if (player._adrenalineActive) player._adrenalineActive = false; }, 15000);
            }
            break;
          case 'med_vitamins':
            player.health = Math.min((player.health ?? 0) + 10, player.maxHealth ?? 100);
            break;
          case 'med_caffeine_pills':
            player.stamina = Math.min((player.stamina ?? 0) + 20, player.maxStamina ?? 100);
            if (player._speedBoostTimer !== undefined) {
              player._speedBoostTimer = 30;
              player._speedBoostMult = 1.3;
            }
            break;
          case 'med_sleeping_pills':
            player.health = Math.min((player.health ?? 0) + 20, player.maxHealth ?? 100);
            break;
          case 'med_antiradiation':
            player.radiation = Math.max((player.radiation ?? 0) - 30, 0);
            break;
          case 'med_gauze':
            player.health = Math.min((player.health ?? 0) + 10, player.maxHealth ?? 100);
            break;
          case 'med_suture_kit':
            player.health = Math.min((player.health ?? 0) + 25, player.maxHealth ?? 100);
            player._bleeding = false;
            player._bleedTimer = 0;
            break;
          case 'med_tourniquet':
            player._bleeding = false;
            player._bleedTimer = 0;
            break;
          case 'med_eyedrops':
            player.blurredVision = false;
            break;
          case 'med_burn_cream':
            player.health = Math.min((player.health ?? 0) + 15, player.maxHealth ?? 100);
            player.burned = false;
            break;
          case 'med_dental_kit':
            player.toothPain = false;
            break;
          case 'med_pain_killers':
            player.health = Math.min((player.health ?? 0) + 15, player.maxHealth ?? 100);
            if (player._morphineTimer !== undefined) player._morphineTimer = Math.max(player._morphineTimer, 10);
            break;
          case 'med_aspirin':
            player.health = Math.min((player.health ?? 0) + 8, player.maxHealth ?? 100);
            if (player._shakeTime !== undefined) player._shakeTime = 0;
            break;
          case 'med_ibuprofen':
            player.health = Math.min((player.health ?? 0) + 10, player.maxHealth ?? 100);
            player.burned = false;
            break;
          case 'med_epipen':
            // Epinephrine: revive from critical, clear bleeding, grant speed burst
            player.health = Math.min((player.health ?? 0) + 30, player.maxHealth ?? 100);
            player._bleeding = false; player._bleedTimer = 0;
            player._speedBoostTimer = (player._speedBoostTimer ?? 0) + 12;
            player._adrenalineActive = true;
            break;
          case 'med_defibrillator':
            // Defibrillator: emergency revive — restore 60 HP (one-time use)
            player.health = Math.min((player.health ?? 0) + 60, player.maxHealth ?? 100);
            player._bleeding = false; player._bleedTimer = 0;
            player._infected = false; player._infectTimer = 0;
            break;
          case 'med_splint':
            // Clear movement penalty (simulated broken leg)
            player._legInjury = false;
            player.health = Math.min((player.health ?? 0) + 8, player.maxHealth ?? 100);
            break;
          default:
            player.health = Math.min((player.health ?? 0) + 5, player.maxHealth ?? 100);
        }
      }
      // Heal particle effect for any med item that restores health
      if (player) this.game.particleSystem?.createHeal?.(player.getPosition());
      this.removeItem(index, 1);
      return;
    }

    // ── Gear / special usables ────────────────────────────────────────────
    switch (item.type) {
      case 'gear_compass': {
        // Toggle compass HUD on for 60 seconds
        const compassEl = document.getElementById('compass-display');
        if (compassEl) {
          compassEl.style.display = 'block';
          clearTimeout(this._compassTimer);
          this._compassTimer = setTimeout(() => { compassEl.style.display = 'none'; }, 60000);
        }
        break;
      }
      case 'gear_gps':
      case 'gear_map': {
        // Show compass + coords for 120 seconds
        const compassEl = document.getElementById('compass-display');
        if (compassEl) {
          compassEl.style.display = 'block';
          clearTimeout(this._compassTimer);
          this._compassTimer = setTimeout(() => { compassEl.style.display = 'none'; }, 120000);
        }
        const coordsEl = document.getElementById('coords-display');
        if (coordsEl) {
          coordsEl.style.display = 'block';
          clearTimeout(this._coordsTimer);
          this._coordsTimer = setTimeout(() => { coordsEl.style.display = 'none'; }, 120000);
        }
        break;
      }
      case 'gear_binoculars': {
        // Toggle zoom FOV
        const camera = this.game.scene?.getCamera?.();
        if (camera) {
          const defaultFov = 75;
          const zoomFov    = 22;
          camera.fov = Math.abs(camera.fov - zoomFov) < 5 ? defaultFov : zoomFov;
          camera.updateProjectionMatrix();
          const notif = document.getElementById('loot-notification');
          if (notif) {
            notif.textContent = camera.fov < 40 ? '🔭 Binoculars: ON' : '🔭 Binoculars: OFF';
            notif.style.color = '#aaddff';
            notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
          }
        }
        break;
      }
      case 'gear_night_vision': {
        if (player) {
          player.nightVisionOn = !player.nightVisionOn;
          const overlay = document.getElementById('night-vision');
          if (overlay) overlay.classList.toggle('active', player.nightVisionOn);
          const notif = document.getElementById('loot-notification');
          if (notif) {
            notif.textContent = player.nightVisionOn ? '👁 Night Vision: ON' : '👁 Night Vision: OFF';
            notif.style.color = '#44ff88';
            notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
          }
        }
        break;
      }
      case 'gear_whistle': {
        // Attract all nearby zombies to player's current position, then stun briefly
        const notif = document.getElementById('loot-notification');
        const zombies = this.game.zombieManager?.getZombies() ?? [];
        let attracted = 0;
        if (player) {
          zombies.forEach(z => {
            if (z.position.distanceTo(player.getPosition()) < 40) {
              z.state = 'chasing';
              z.pathRecalcTimer = 0;
              attracted++;
            }
          });
        }
        this.game.audioManager?.playWhistle?.();
        if (notif) {
          notif.textContent = `📯 Whistle! ${attracted} zombies alerted`;
          notif.style.color = '#ffcc44';
          notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
        }
        break; // not consumed
      }
      case 'gear_sleeping_bag': {
        if (player && !player._sleeping) {
          const notif = document.getElementById('loot-notification');
          player._sleeping = true;
          player.moveSpeed = 0.5;
          let ticks = 0;
          const heal = setInterval(() => {
            if (!player._sleeping) { clearInterval(heal); return; }
            player.health = Math.min(player.maxHealth, player.health + 5);
            player.hunger  = Math.min(player.maxHunger, player.hunger  - 2);
            ticks++;
            if (ticks >= 8) {
              clearInterval(heal);
              player._sleeping  = false;
              player.moveSpeed  = 5;
              if (notif) { notif.textContent = '😴 Rested! +40 HP'; notif.style.color = '#88ffaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
            }
          }, 500);
          if (notif) { notif.textContent = '😴 Resting… (4s)'; notif.style.color = '#88ffaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        }
        break; // not consumed
      }
      case 'gear_water_filter': {
        // Purify all dirty water in inventory
        let purified = 0;
        for (let i2 = 0; i2 < this.totalSlots; i2++) {
          if (this.slots[i2]?.type === 'drink_dirty_water') {
            const qty = this.slots[i2].quantity;
            this.slots[i2] = null;
            this.addItem('drink_purified_water', qty);
            purified += qty;
          }
        }
        const notif = document.getElementById('loot-notification');
        if (notif) {
          notif.textContent = purified > 0 ? `💧 Purified ×${purified} dirty water` : '💧 No dirty water to purify';
          notif.style.color = '#66aaff';
          notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
        }
        break; // not consumed
      }
      case 'gear_fire_starter': {
        // Create a campfire particle effect
        if (player) this.game.particleSystem?.createExplosion?.(player.getPosition().clone());
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🔥 Campfire lit!'; notif.style.color = '#ff8833'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'gear_snare_trap': {
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🪤 Snare trap placed!'; notif.style.color = '#ccaa66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'explosive_molotov': {
        if (player) {
          const cam   = this.game.scene?.getCamera?.();
          const dir   = new THREE.Vector3();
          if (cam) cam.getWorldDirection(dir);
          const pos = player.getPosition().clone().addScaledVector(dir, 1.5);
          pos.y += 1;
          // Launch a molotov projectile
          this._throwExplosive(pos, dir.clone().multiplyScalar(14), 0xff6600, 12, false);
        }
        this.removeItem(index, 1);
        break;
      }
      case 'explosive_grenade': {
        if (player) {
          const cam = this.game.scene?.getCamera?.();
          const dir = new THREE.Vector3();
          if (cam) cam.getWorldDirection(dir);
          const pos = player.getPosition().clone().addScaledVector(dir, 1.5);
          pos.y += 1;
          this._throwExplosive(pos, dir.clone().multiplyScalar(18), 0x888888, 20, true);
        }
        this.removeItem(index, 1);
        break;
      }
      case 'trap_spike_trap': {
        if (player) {
          const pos = player.getPosition().clone();
          pos.y = 0.5;
          this._placeTrap(pos);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🪝 Spike trap placed!'; notif.style.color = '#ccaa66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'cloth_backpack': {
        if (!player._hasBackpack) {
          player._hasBackpack = true;
          this.totalSlots = Math.min(this.totalSlots + 9, 63);
          this.slots.length = this.totalSlots;
          for (let i2 = 0; i2 < this.totalSlots; i2++) {
            if (this.slots[i2] === undefined) this.slots[i2] = null;
          }
          this._buildGrid();
          const notif = document.getElementById('loot-notification');
          if (notif) { notif.textContent = '🎒 Backpack equipped! +9 inventory slots'; notif.style.color = '#ffcc44'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
          this.removeItem(index, 1);
        }
        break;
      }
      case 'tool_lighter':
      case 'tool_matches': {
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🔥 Fire started!'; notif.style.color = '#ff8833'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        // Flash a fire effect
        if (player) this.game.particleSystem?.createExplosion?.(player.getPosition().clone());
        this.removeItem(index, 1);
        break;
      }
      case 'tool_canteen': {
        if (player && player.thirst !== undefined) {
          player.thirst = Math.min(player.thirst + 25, player.maxThirst ?? 100);
          player.stamina = Math.min((player.stamina ?? 0) + 10, player.maxStamina ?? 100);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🪣 Drank from canteen +25 thirst'; notif.style.color = '#66aaff'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        // Canteen is not consumed (refillable), but mark it needs refill
        break;
      }
      case 'mat_candles': {
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🕯 Candle lit — minor illumination'; notif.style.color = '#ffeeaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'elec_emp_grenade': {
        if (player) {
          const cam = this.game.scene?.getCamera?.();
          const dir = new THREE.Vector3();
          if (cam) cam.getWorldDirection(dir);
          const pos = player.getPosition().clone().addScaledVector(dir, 1.5);
          pos.y += 1;
          // EMP: stun all zombies in radius 10, no damage
          const stunPos = pos.clone();
          setTimeout(() => {
            const zombies = this.game.zombieManager?.getZombies() ?? [];
            let stunned = 0;
            zombies.forEach(z => {
              if (z.position.distanceTo(stunPos) < 10) {
                z.stunned = true; z.stunTimer = 3.5; stunned++;
              }
            });
            this.game.particleSystem?.createExplosion?.(stunPos);
            const n = document.getElementById('loot-notification');
            if (n) { n.textContent = `⚡ EMP! ${stunned} zombies stunned`; n.style.color = '#33ccff'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
          }, 800);
          this._throwExplosive(pos, dir.clone().multiplyScalar(12), 0x33ccff, 0, false);
        }
        this.removeItem(index, 1);
        break;
      }
      case 'elec_tracker': {
        // Toggle zombie tracking on minimap for 45 seconds
        if (!this._trackerTimer) {
          this.game._trackerActive = true;
          const n = document.getElementById('loot-notification');
          if (n) { n.textContent = '📡 Motion Tracker: ON (45s)'; n.style.color = '#22ccaa'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
          this._trackerTimer = setTimeout(() => {
            this.game._trackerActive = false;
            this._trackerTimer = null;
            const n2 = document.getElementById('loot-notification');
            if (n2) { n2.textContent = '📡 Motion Tracker: OFF'; n2.style.color = '#aaaaaa'; n2.classList.remove('show'); void n2.offsetWidth; n2.classList.add('show'); }
          }, 45000);
        }
        break; // not consumed
      }
      case 'elec_stun_baton': {
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = '⚡ Stun Baton equipped (use as melee)'; n.style.color = '#4455ff'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        break; // handled by weapon system
      }
      case 'tool_multitool': {
        // Repair all weapons by 60%
        const wm = this.game.weaponManager;
        if (wm) wm.getWeapons?.()?.forEach(w => { if (w.durability !== undefined) w.durability = Math.min(100, w.durability + 60); });
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = '🔧 Multi-Tool: weapons repaired +60%'; n.style.color = '#aaddff'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        break; // not consumed (reusable)
      }
      case 'tool_wire_cutter':
      case 'tool_bolt_cutter': {
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = item.type === 'tool_bolt_cutter' ? '✂ Bolt Cutters ready' : '✂ Wire Cutters ready'; n.style.color = '#aaaacc'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        break; // used contextually
      }
      case 'tool_handcuffs': {
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = '🔗 Handcuffs — restrain survivors or looters'; n.style.color = '#888899'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        break;
      }
      case 'elec_radio_transceiver': {
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = '📻 Radio active — broadcasting distress signal…'; n.style.color = '#44cc88'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        break;
      }
      case 'special_vaccine_dose': {
        if (player) { player._infected = false; player._infectTimer = 0; player._immune = true; }
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = '💉 Vaccine administered — infection immunity!'; n.style.color = '#44ffcc'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'special_cdc_keycard': {
        const n = document.getElementById('loot-notification');
        if (n) { n.textContent = '🪪 CDC Keycard — grants access to secure areas'; n.style.color = '#88bbff'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
        break;
      }
      case 'special_journal_page':
        this._showReadable(itemDef.name, this._getReadableText('journal_page'));
        break;
      case 'special_lab_report':
        this._showReadable(itemDef.name, this._getReadableText('lab_report'));
        break;
      case 'special_survivor_note':
        this._showReadable(itemDef.name, this._getReadableText('survivor_note'));
        break;
      case 'special_map_fragment':
        this._showReadable(itemDef.name, this._getReadableText('map_fragment'));
        break;
      case 'special_photograph':
        this._showReadable(itemDef.name, this._getReadableText('photograph'));
        break;
      case 'special_artifact':
      case 'special_alien_device':
        this._showReadable(itemDef.name, 'Its surface hums faintly under your fingers.\n\nYou have no idea what this is or where it came from.\n\nBut something about it feels deeply wrong.');
        break;
      case 'gear_headlamp': {
        if (player) {
          player.headlampOn = !player.headlampOn;
          // Use the flashlight light but at lower intensity
          if (player._flashlight) {
            if (player.headlampOn) {
              player._flashlight.intensity = 1.8;
              player._flashlight.distance = 25;
              player.flashlightOn = true;
            } else {
              player.flashlightOn = false;
              player._flashlight.intensity = 0;
            }
          }
          const notif = document.getElementById('loot-notification');
          if (notif) { notif.textContent = player.headlampOn ? '💡 Headlamp: ON' : '💡 Headlamp: OFF'; notif.style.color = '#ffffaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        }
        break;
      }
      case 'special_family_photo':
        this._showReadable(itemDef.name, 'A photograph of a family. Three kids, two parents. All smiling.\n\nYou don\'t know them. You don\'t need to.\n\nThey were someone\'s whole world.');
        break;
      case 'special_diary':
        this._showReadable(itemDef.name, 'Day 47 of the outbreak.\n\nWe ran out of canned food yesterday. Jake found a water source two blocks east but the area is crawling with them.\n\nI don\'t know how much longer we can hold out here.');
        break;
      case 'special_recipe_book':
        this._showReadable(itemDef.name, 'Well-worn cookbook. Handwritten notes in the margins: \'Great with rice\', \'Kids love this one\', \'Save for special occasions\'.\n\nSome pages have been torn out.');
        break;
      case 'special_house_plan':
        this._showReadable(itemDef.name, 'Architectural blueprint for this house. A basement is marked on the plan — but you haven\'t found any basement entrance.\n\nThere\'s something written in red pen: \'DO NOT OPEN\'');
        break;
      case 'mat_duct_tape': {
        // Repair all weapons by 40% durability
        const wm = this.game.weaponManager;
        if (wm) {
          wm.getWeapons?.()?.forEach(w => { if (w.durability !== undefined) w.durability = Math.min(100, w.durability + 40); });
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🔧 Weapons repaired +40%'; notif.style.color='#aaddff'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'explosive_smoke_grenade': {
        if (player) {
          const cam = this.game.scene?.getCamera?.();
          const dir = new THREE.Vector3();
          if (cam) cam.getWorldDirection(dir);
          const pos = player.getPosition().clone().addScaledVector(dir, 1.5);
          pos.y += 0.8;
          this._throwExplosive(pos, dir.clone().multiplyScalar(11), 0x888888, 0, false);
          // Cloud lingers: repel / confuse zombies for 6s in radius 8
          setTimeout(() => {
            const cloudPos = pos.clone();
            const zombies  = this.game.zombieManager?.getZombies() ?? [];
            zombies.forEach(z => {
              if (z.position.distanceTo(cloudPos) < 8) {
                z.stunned  = true;
                z.stunTimer = 4;
              }
            });
            this.game.particleSystem?.createSmoke?.(cloudPos, 12);
          }, 700);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '💨 Smoke grenade deployed!'; notif.style.color = '#aaaacc'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'explosive_flash_bang': {
        if (player) {
          const cam = this.game.scene?.getCamera?.();
          const dir = new THREE.Vector3();
          if (cam) cam.getWorldDirection(dir);
          const pos = player.getPosition().clone().addScaledVector(dir, 1.5);
          pos.y += 0.8;
          this._throwExplosive(pos, dir.clone().multiplyScalar(13), 0xffffff, 0, false);
          setTimeout(() => {
            const blastPos = pos.clone();
            const zombies  = this.game.zombieManager?.getZombies() ?? [];
            let stunned = 0;
            zombies.forEach(z => {
              if (z.position.distanceTo(blastPos) < 12) {
                z.stunned  = true;
                z.stunTimer = 3;
                stunned++;
              }
            });
            // White flash on screen
            const flash = document.createElement('div');
            flash.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0.85;pointer-events:none;z-index:9999;transition:opacity 0.8s';
            document.body.appendChild(flash);
            requestAnimationFrame(() => { flash.style.opacity = '0'; });
            setTimeout(() => flash.remove(), 900);
            const n = document.getElementById('loot-notification');
            if (n) { n.textContent = `💥 Flashbang! ${stunned} zombies stunned`; n.style.color = '#ffffaa'; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
          }, 600);
        }
        this.removeItem(index, 1);
        break;
      }
      case 'trap_bear_trap': {
        if (player) {
          const pos = player.getPosition().clone();
          pos.y = 0.1;
          // Register trap in game's trap list
          if (!this.game._traps) this.game._traps = [];
          this.game._traps.push({ pos: pos.clone(), type: 'bear', armed: true, triggered: false });
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🪤 Bear trap placed!'; notif.style.color = '#ccaa66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'trap_wire_snare': {
        if (player) {
          const pos = player.getPosition().clone();
          pos.y = 0.1;
          if (!this.game._traps) this.game._traps = [];
          this.game._traps.push({ pos: pos.clone(), type: 'snare', armed: true, triggered: false });
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🪢 Wire snare set!'; notif.style.color = '#ccaa66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'trap_landmine': {
        if (player) {
          const pos = player.getPosition().clone();
          pos.y = 0.05;
          if (!this.game._traps) this.game._traps = [];
          this.game._traps.push({ pos: pos.clone(), type: 'landmine', armed: true, triggered: false });
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '💥 Landmine armed!'; notif.style.color = '#ff6633'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'gear_flare': {
        if (player) {
          const pos = player.getPosition().clone();
          pos.y += 0.5;
          this.game.particleSystem?.createFireEffect?.(pos);
          // Distract zombies for 15s within radius 30
          const zombies = this.game.zombieManager?.getZombies() ?? [];
          const flarePos = pos.clone();
          zombies.forEach(z => {
            if (z.position.distanceTo(flarePos) < 30) {
              z.state = 'chasing';
              z._flareTarget = flarePos.clone();
              setTimeout(() => { delete z._flareTarget; }, 15000);
            }
          });
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🚨 Signal flare lit! Zombies attracted'; notif.style.color = '#ff5533'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'gear_gas_mask': {
        if (player) {
          player.gasMaskOn = !player.gasMaskOn;
          // Gas mask blocks infection and acid damage while worn
          player._immunePoison = player.gasMaskOn;
          player._immuneInfect = player.gasMaskOn;
          const overlay = document.getElementById('gas-mask-overlay');
          if (overlay) overlay.classList.toggle('active', player.gasMaskOn);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) {
          notif.textContent = player?.gasMaskOn ? '😷 Gas Mask: ON — immune to gas & acid' : '😷 Gas Mask: OFF';
          notif.style.color = '#aaccaa';
          notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
        }
        break; // not consumed
      }
      case 'gear_decoy': {
        if (player) {
          const pos = player.getPosition().clone();
          const cam = this.game.scene?.getCamera?.();
          const fwdVec = new THREE.Vector3();
          if (cam) cam.getWorldDirection(fwdVec);
          const decoyX = pos.x + fwdVec.x * 8;
          const decoyZ = pos.z + fwdVec.z * 8;
          const zombies = this.game.zombieManager?.getZombies() ?? [];
          const fp = new THREE.Vector3(decoyX, pos.y, decoyZ);
          zombies.forEach(z => {
            if (z.position.distanceTo(pos) < 35) {
              z.state = 'chasing';
              z._flareTarget = fp.clone();
              setTimeout(() => { delete z._flareTarget; }, 20000);
            }
          });
          this.game._emitNoise?.(decoyX, decoyZ, 30);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🎵 Decoy thrown! Zombies distracted'; notif.style.color = '#aaddff'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'food_energy_bar': {
        if (player) {
          player.hunger  = Math.min(player.maxHunger  ?? 100, (player.hunger  ?? 50) + 20);
          player.stamina = Math.min(player.maxStamina ?? 100, (player.stamina ?? 50) + 30);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '⚡ Energy Bar: +20 hunger, +30 stamina'; notif.style.color = '#ffee66'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'med_stim_shot': {
        if (player) {
          const orig = player.moveSpeed ?? 5;
          player.moveSpeed = orig * 1.5;
          player._stimActive = true;
          setTimeout(() => {
            player.moveSpeed = orig * 0.8;
            player._stimActive = false;
            setTimeout(() => { player.moveSpeed = orig; }, 5000);
          }, 8000);
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '💉 STIM: Speed +50% for 8s!'; notif.style.color = '#ff88ff'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'tool_repair_kit': {
        if (player) {
          // Restore player's innate armor bonus (simulates armor repair)
          player._innateArmor = Math.min(0.2, (player._innateArmor ?? 0) + 0.08);
          if (player.health < player.maxHealth) {
            player.health = Math.min(player.maxHealth, player.health + 15);
          }
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '🔨 Repair Kit used — armor restored'; notif.style.color = '#aaaaff'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'gear_ghillie_suit': {
        if (player) {
          player._ghillieSuit = !player._ghillieSuit;
          // When wearing ghillie suit, reduce zombie aggro range by applying a multiplier
          // Zombies check player._stealthMult when computing aggroRange
          player._stealthMult = player._ghillieSuit ? 0.6 : 1.0;
        }
        const notif = document.getElementById('loot-notification');
        if (notif) {
          notif.textContent = player?._ghillieSuit ? '🌿 Ghillie Suit: ON — less visible' : '🌿 Ghillie Suit: OFF';
          notif.style.color = '#88cc88'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show');
        }
        break; // not consumed
      }
      case 'special_blueprint': {
        if (!this.game._blueprintsUsed) this.game._blueprintsUsed = 0;
        this.game._blueprintsUsed++;
        const bpBonuses = [
          { label: 'Scope Mount unlocked', fn: g => { g.player?.gainXP?.(75, 'blueprint'); } },
          { label: 'Suppressor recipe unlocked', fn: g => { g.player?.gainXP?.(75, 'blueprint'); } },
          { label: 'Extended Mag recipe unlocked', fn: g => { g.player?.gainXP?.(75, 'blueprint'); } },
          { label: 'Combat Armor recipe unlocked', fn: g => { g.player?.gainXP?.(75, 'blueprint'); } },
        ];
        const bonus = bpBonuses[(this.game._blueprintsUsed - 1) % bpBonuses.length];
        bonus.fn(this.game);
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = `📐 ${bonus.label} (+75 XP)`; notif.style.color = '#ffcc44'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }
      case 'explosive_claymore': {
        if (player) {
          const pos = player.getPosition().clone();
          pos.y = 0.1;
          if (!this.game._traps) this.game._traps = [];
          this.game._traps.push({ pos: pos.clone(), type: 'claymore', armed: true, triggered: false });
        }
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = '💣 Claymore placed!'; notif.style.color = '#ff5533'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
        this.removeItem(index, 1);
        break;
      }

      default: {
        const notif = document.getElementById('loot-notification');
        if (notif) { notif.textContent = `Used ${itemDef.name}`; notif.style.color = '#aaaaaa'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
      }
    }
  }

  _updateWeight() {
    const weights = { ammo:0.3, food:0.4, medical:0.3, weapon:1.5, material:0.5, gear:0.8, armor:2.0, key:0.1, special:0.1, default:0.3 };
    let total = 0;
    for (const slot of this.slots) {
      if (!slot) continue;
      const cat = InventorySystem.getIconCat(slot.type);
      total += (weights[cat] ?? weights.default) * (slot.quantity ?? 1);
    }
    this._currentWeight = Math.round(total * 10) / 10;
    this._maxWeight = 30 + (this.game.player?._hasBackpack ? 15 : 0);

    if (!this._weightEl) {
      // Use existing CSS #weight-display definition; only create if not in HTML
      let el = document.getElementById('weight-display');
      if (!el) { el = document.createElement('div'); el.id = 'weight-display'; document.body.appendChild(el); }
      this._weightEl = el;
    }
    const pct = this._currentWeight / this._maxWeight;
    this._weightEl.classList.toggle('heavy',      pct > 0.7 && pct <= 0.9);
    this._weightEl.classList.toggle('overloaded', pct > 0.9);
    this._weightEl.innerHTML = `⚖ ${this._currentWeight.toFixed(1)}/${this._maxWeight}kg`;

    if (this.game.player) {
      if (pct > 0.9) {
        this.game.player._encumbrance = 0.4;
      } else if (pct > 0.7) {
        this.game.player._encumbrance = 0.75;
      } else {
        this.game.player._encumbrance = 1.0;
      }
    }
  }

  _throwExplosive(startPos, velocity, color, damage, shrapnel) {
    const geo  = new THREE.SphereGeometry(0.18, 6, 6);
    const mat  = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    this.game.scene.scene.add(mesh);

    let vel = velocity.clone();
    let pos = startPos.clone();
    let life = 3.0;

    const tick = (dt = 0.016) => {
      life -= dt;
      vel.y -= 9.8 * dt;
      pos.addScaledVector(vel, dt);
      mesh.position.copy(pos);

      // Detonate when near ground or time out
      const groundY = this.game.terrainGenerator?.getHeightAt(pos.x, pos.z) ?? 0;
      if (pos.y <= groundY + 0.3 || life <= 0) {
        this.game.scene.scene.remove(mesh);
        geo.dispose(); mat.dispose();
        this.game.particleSystem?.createExplosion(pos.clone());
        // Damage all zombies in radius
        const zombies = this.game.zombieManager?.getZombies() ?? [];
        zombies.forEach(z => {
          const d = z.position.distanceTo(pos);
          if (d < 5) z.takeDamage(damage * (1 - d / 5));
        });
        // Damage player if too close
        const player = this.game.player;
        if (player && player.getPosition().distanceTo(pos) < 4) {
          player.takeDamage(damage * 0.5);
        }
        return;
      }
      if (life > 0) requestAnimationFrame(() => tick(0.016));
    };
    tick();
  }

  _placeTrap(pos) {
    const geo  = new THREE.BoxGeometry(0.8, 0.1, 0.8);
    const mat  = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geo, mat);
    // Add spikes
    for (let i = 0; i < 6; i++) {
      const sg = new THREE.ConeGeometry(0.04, 0.25, 4);
      const sm = new THREE.MeshPhongMaterial({ color: 0xcccccc });
      const spike = new THREE.Mesh(sg, sm);
      spike.position.set(
        (Math.random() - 0.5) * 0.6, 0.17, (Math.random() - 0.5) * 0.6
      );
      mesh.add(spike);
    }
    mesh.position.copy(pos);
    this.game.scene.scene.add(mesh);

    let trapLife = 30;
    const check = (dt = 0.016) => {
      trapLife -= dt;
      const zombies = this.game.zombieManager?.getZombies() ?? [];
      zombies.forEach(z => {
        if (z.position.distanceTo(pos) < 1.0) {
          z.takeDamage(40);
          z.stunned  = true;
          z.stunTimer = 1.5;
        }
      });
      if (trapLife > 0) requestAnimationFrame(() => check(0.016));
      else {
        this.game.scene.scene.remove(mesh);
        geo.dispose(); mat.dispose();
      }
    };
    check();
  }

  _showReadable(title, body) {
    const popup = document.getElementById('readable-popup');
    if (!popup) return;
    document.getElementById('readable-title').textContent = title;
    document.getElementById('readable-body').textContent  = body;
    popup.style.display = 'flex';
    this.isOpen = true;
    this.game.pause?.();

    const closeBtn = document.getElementById('readable-close');
    const close = () => {
      popup.style.display = 'none';
      this.isOpen = false;
      this.game.resume?.();
      closeBtn.removeEventListener('click', close);
      document.removeEventListener('keydown', keyClose);
    };
    const keyClose = (e) => { if (e.key === 'e' || e.key === 'E' || e.key === 'Escape') { e.stopPropagation(); close(); } };
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', keyClose, { capture: true });
  }

  _getReadableText(type) {
    const texts = {
      journal_page: [
        'Day 14\n\nI haven\'t slept properly in four days. The sounds from outside keep getting louder. Michael says we should stay put but I don\'t know how much longer we can hold out.\n\nWe found canned goods in the basement — maybe two weeks worth if we\'re careful. The radio is dead. No signal anywhere.\n\nI keep thinking about the evacuation bus. We were three minutes late.',
        'Day 21\n\nMichael is sick. Fever — not the infection, I don\'t think. Just the cold. We barely have any blankets left.\n\nI went to the neighbor\'s house for supplies. The door was unlocked. I don\'t want to write what I saw inside.\n\nFound a map. The military checkpoint at Route 9 is marked. Can\'t tell if it\'s still active.',
        'Day 3\n\nIt happened fast. Faster than the news said it would. By the time they announced mandatory evacuations half the city was already gone.\n\nWe didn\'t make it to the shelter. Nobody at the shelter either — at least not anymore.\n\nNote to self: water filters. More water filters. And batteries. Always batteries.',
      ],
      lab_report: [
        'CLASSIFIED — CDC INTERNAL MEMO\nSubject: Pathogen Classification Update\n\nAs of Day 8 post-outbreak, we are reclassifying the agent from UNKNOWN to PRION-ADJACENT.\n\nTransmission vectors confirmed:\n  - Bite (HIGH)\n  - Scratch (MODERATE)\n  - Fluid contact (LOW)\n\nIncubation period: 4-72 hours depending on exposure load.\n\nThere is NO confirmed cure at this time.\n\n— Dr. Reyes, Virology Division',
        'FIELD ANALYSIS NOTE\nSample batch: 14-B\n\nBrain tissue from recovered specimens shows near-total degradation of the prefrontal cortex. Motor and sensory functions remain partially intact.\n\nThe subjects respond to sound and movement but show no evidence of pain response.\n\nMost alarming finding: specimens in cooler temperatures (below 5°C) show REDUCED activity. This may be exploitable.',
      ],
      survivor_note: [
        'To whoever finds this:\n\nDon\'t go downtown. I don\'t care what you think you need from there.\n\nThe fire station on Maple has supplies — or had them when I came through. Second floor window, left unlocked.\n\nThere\'s a group heading north toward the mountains. You might catch them if you leave soon.\n\nStay quiet. Stay moving. Don\'t trust strangers who are too friendly.\n\n— Jess',
        'Gas station at Route 12 and Birch has a generator. Fuel tank still had some left when I checked. Owner\'s key is taped under the counter.\n\nWATCH OUT for the crawler type. It doesn\'t moan. You won\'t hear it until it\'s already on you.\n\nGood luck.',
        'I left three caches:\n  1. Old oak behind the library — ammo\n  2. Manhole near the park fountain — food\n  3. Don\'t look for the third one. It\'s gone.\n\nP.S. — The infection can be slowed with antibiotics. Not stopped. Slowed.',
      ],
      map_fragment: [
        '[ Hand-drawn map fragment — torn on two sides ]\n\nLegible markings:\n  "SAFE?" with an arrow pointing northeast\n  An X over what appears to be a hospital\n  A circled area labeled "AVOID — HORDE"\n  Dotted line leading off the torn edge\n\nScrawled in the margin:\n  "follow the river"',
      ],
      photograph: [
        '[ A photograph ]\n\nA family — three people. Parents and a child, maybe seven or eight years old, at what looks like a backyard barbecue. Summer. Everyone smiling.\n\nOn the back, in neat handwriting:\n"Fourth of July, 2019. Our last normal one."\n\nYou don\'t recognize them.\n\nYou put it in your pocket anyway.',
      ],
    };

    const pool = texts[type] || texts['survivor_note'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  updateQuickSlotDisplay() {
    for (let i = 0; i < this.quickSlots; i++) {
      const slotEl = document.getElementById(`quick-slot-${i}`);
      if (this.slots[i]) {
        slotEl.classList.add('occupied');
        const itemDef = this.itemTypes[this.slots[i].type];
        slotEl.innerHTML = `
          <div class="item-icon" data-cat="${InventorySystem.getIconCat(this.slots[i].type)}" style="width:30px;height:30px;"></div>
          ${this.slots[i].quantity > 1 ? '<div class="quick-slot-qty">x' + this.slots[i].quantity + '</div>' : ''}
        `;
      } else {
        slotEl.classList.remove('occupied');
        slotEl.innerHTML = '';
      }
    }
  }

  updateDisplay() {
    this.updateQuickSlotDisplay();
    if (this.isOpen) {
      this.renderInventory(); // calls _syncSlot for all slots, no DOM rebuild
    }
  }

  getEmptySlotCount() {
    return this.slots.filter(s => !s).length;
  }

  getItemCount(itemType) {
    let count = 0;
    this.slots.forEach(slot => {
      if (slot && slot.type === itemType) {
        count += slot.quantity;
      }
    });
    return count;
  }

}
