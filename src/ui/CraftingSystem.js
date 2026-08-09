export class CraftingSystem {
  constructor(game, inventorySystem) {
    this.game = game;
    this.inventory = inventorySystem;

    this.recipes = [
      {
        name: 'Wooden Spear',
        result: 'weapon_spear',
        ingredients: { wood: 3 },
        category: 'weapons'
      },
      {
        name: 'Copper Ingot',
        result: 'ingot_copper',
        ingredients: { ore_copper: 2 },
        category: 'smelting'
      },
      {
        name: 'Iron Ingot',
        result: 'ingot_iron',
        ingredients: { ore_iron: 2 },
        category: 'smelting'
      },
      {
        name: 'First Aid Kit',
        result: 'medical_kit',
        ingredients: { bandage: 5 },
        category: 'medicine'
      },
      {
        name: 'Rope',
        result: 'rope',
        ingredients: { mat_cloth: 3 },
        category: 'materials'
      },
      {
        name: 'Cloth Bandage',
        result: 'bandage',
        ingredients: { mat_cloth: 2 },
        category: 'medicine'
      },
      {
        name: 'Purified Water',
        result: 'drink_purified_water',
        ingredients: { drink_dirty_water: 1, mat_alcohol_isopropyl: 1 },
        category: 'medicine'
      },
      {
        name: 'Wooden Bow',
        result: 'weapon_bow',
        ingredients: { wood: 5, rope: 2 },
        category: 'weapons'
      },
      {
        name: 'Metal Wrench',
        result: 'tool_wrench',
        ingredients: { ingot_iron: 3 },
        category: 'tools'
      },
      {
        name: 'Leather Jacket',
        result: 'cloth_jacket',
        ingredients: { mat_leather: 3, mat_thread: 2 },
        category: 'armor'
      },
      {
        name: 'Sword',
        result: 'weapon_sword',
        ingredients: { ingot_iron: 5, wood: 2 },
        category: 'weapons'
      },
      {
        name: 'Makeshift Knife',
        result: 'weapon_kitchen_knife',
        ingredients: { ingot_iron: 1, mat_cloth: 1 },
        category: 'weapons'
      },
      {
        name: 'Nails',
        result: 'mat_nails',
        qty: 10,
        ingredients: { ingot_iron: 1 },
        category: 'materials'
      },
      {
        name: 'Molotov Cocktail',
        result: 'explosive_molotov',
        ingredients: { mat_glass_bottle: 1, mat_alcohol_isopropyl: 1, mat_cloth: 1 },
        category: 'weapons'
      },
      {
        name: 'Reinforced Bandage',
        result: 'bandage',
        qty: 3,
        ingredients: { bandage: 1, mat_duct_tape: 1 },
        category: 'medicine'
      },
      {
        name: 'Arrows (5)',
        result: 'ammo_arrow',
        qty: 5,
        ingredients: { wood: 2, mat_nails: 3 },
        category: 'materials'
      },
      {
        name: 'Crossbow Bolts (5)',
        result: 'ammo_crossbow_bolt',
        qty: 5,
        ingredients: { ingot_iron: 1, wood: 1 },
        category: 'materials'
      },
      {
        name: 'Spike Trap',
        result: 'trap_spike_trap',
        ingredients: { mat_nails: 5, wood: 2 },
        category: 'materials'
      },
      {
        name: 'Improvised Explosives',
        result: 'explosive_molotov',
        qty: 2,
        ingredients: { mat_gunpowder: 2, mat_glass_bottle: 1, mat_cloth: 1 },
        category: 'weapons'
      },
      {
        name: 'Antidote',
        result: 'med_antivenom',
        ingredients: { mat_alcohol_isopropyl: 1, bandage: 1, food_mushroom: 2 },
        category: 'medicine'
      },
      {
        name: 'Energy Mix',
        result: 'drink_energy_drink',
        qty: 2,
        ingredients: { food_honey: 1, mat_alcohol_isopropyl: 1 },
        category: 'medicine'
      },
      {
        name: 'Improvised Pistol Rounds (12)',
        result: 'ammo_9mm',
        qty: 12,
        ingredients: { mat_gunpowder: 1, ingot_iron: 1 },
        category: 'materials'
      },
      {
        name: 'Poison Blade',
        result: 'weapon_machete',
        ingredients: { weapon_kitchen_knife: 1, food_mushroom: 3, mat_alcohol_isopropyl: 1 },
        category: 'weapons'
      },
      {
        name: 'Makeshift Armor Plate',
        result: 'armor_plate',
        ingredients: { ingot_iron: 4, mat_duct_tape: 2 },
        category: 'armor'
      },
      // SURVIVAL
      {
        name: 'Frag Grenade',
        result: 'explosive_grenade',
        ingredients: { mat_gunpowder: 3, mat_screws: 4, mat_spring: 1 },
        category: 'weapons'
      },
      {
        name: 'Crossbow Bolt (x5)',
        result: 'ammo_crossbow_bolt',
        qty: 5,
        ingredients: { wood: 1, mat_nails: 1 },
        category: 'ammo'
      },
      {
        name: 'Arrow (x5)',
        result: 'ammo_arrow',
        qty: 5,
        ingredients: { wood: 1, mat_cloth: 1 },
        category: 'ammo'
      },
      {
        name: 'Canteen',
        result: 'tool_canteen',
        ingredients: { mat_rubber_tube: 1, mat_plastic_wrap: 2 },
        category: 'tools'
      },
      {
        name: 'Water Filter',
        result: 'gear_water_filter',
        ingredients: { mat_cloth: 2, mat_charcoal: 2, mat_rubber_tube: 1 },
        category: 'tools'
      },
      // MEDICAL
      {
        name: 'Suture Kit',
        result: 'med_suture_kit',
        ingredients: { mat_thread: 3, mat_alcohol_isopropyl: 1 },
        category: 'medicine'
      },
      {
        name: 'Tourniquet',
        result: 'med_tourniquet',
        ingredients: { mat_cloth: 2, rope: 1 },
        category: 'medicine'
      },
      {
        name: 'Burn Cream',
        result: 'med_burn_cream',
        ingredients: { mat_alcohol_isopropyl: 1, mat_cloth: 1 },
        category: 'medicine'
      },
      // GEAR
      {
        name: 'Signal Mirror',
        result: 'gear_signal_mirror',
        ingredients: { mat_glass_bottle: 1 },
        category: 'gear'
      },
      {
        name: 'Sleeping Bag',
        result: 'gear_sleeping_bag',
        ingredients: { mat_cloth: 5, rope: 2 },
        category: 'gear'
      },
      {
        name: 'Snare Trap',
        result: 'gear_snare_trap',
        ingredients: { rope: 2, mat_wire: 1 },
        category: 'gear'
      },
      {
        name: 'Paracord',
        result: 'gear_paracord',
        ingredients: { rope: 1 },
        category: 'gear'
      },
      // WEAPON UPGRADES
      {
        name: 'Katana',
        result: 'weapon_katana',
        ingredients: { weapon_sword: 1, mat_duct_tape: 2, mat_screws: 2 },
        category: 'weapons'
      },
      {
        name: 'Molotov Arrow',
        result: 'ammo_arrow',
        qty: 3,
        ingredients: { ammo_arrow: 3, mat_alcohol_isopropyl: 1 },
        category: 'ammo'
      },
      // MATERIALS
      {
        name: 'Gunpowder',
        result: 'mat_gunpowder',
        ingredients: { mat_charcoal: 2, mat_salt: 1 },
        category: 'materials'
      },
      {
        name: 'Glass Bottle',
        result: 'mat_glass_bottle',
        qty: 2,
        ingredients: { mat_sand: 3 },
        category: 'materials'
      },
      {
        name: 'Nails (x10)',
        result: 'mat_nails',
        qty: 10,
        ingredients: { ingot_iron: 1 },
        category: 'materials'
      },
      // ── New Recipes ──────────────────────────────────────────────────────
      {
        name: 'Roasted Meat',
        result: 'food_roasted_meat',
        ingredients: { food_raw_meat: 1 },
        category: 'food',
        requiresCampfire: true
      },
      {
        name: 'Hardtack Biscuit (x3)',
        result: 'food_hardtack',
        qty: 3,
        ingredients: { mat_flour: 2, mat_salt: 1 },
        category: 'food'
      },
      {
        name: 'Pemmican',
        result: 'food_pemmican',
        ingredients: { food_jerky: 1, food_dried_fruit: 1, mat_salt: 1 },
        category: 'food'
      },
      {
        name: 'Gunpowder',
        result: 'mat_gunpowder',
        qty: 3,
        ingredients: { mat_charcoal: 2, mat_saltpeter: 1 },
        category: 'materials'
      },
      {
        name: '9mm Ammo (x6)',
        result: 'ammo_9mm',
        qty: 6,
        ingredients: { mat_gunpowder: 1, ingot_iron: 1 },
        category: 'ammo'
      },
      {
        name: 'Smoke Grenade',
        result: 'explosive_smoke_grenade',
        ingredients: { mat_gunpowder: 1, mat_cloth: 2, mat_charcoal: 1 },
        category: 'weapons'
      },
      {
        name: 'EMP Grenade',
        result: 'elec_emp_grenade',
        ingredients: { mat_circuit_board: 2, mat_battery: 2, mat_wire: 1 },
        category: 'weapons'
      },
      {
        name: 'Bear Trap',
        result: 'trap_bear_trap',
        ingredients: { ingot_iron: 2, mat_nails: 4, mat_wire: 1 },
        category: 'traps'
      },
      {
        name: 'Multi-Tool',
        result: 'tool_multitool',
        ingredients: { ingot_iron: 3, mat_duct_tape: 1 },
        category: 'tools'
      },
      {
        name: 'Stun Baton',
        result: 'elec_stun_baton',
        ingredients: { mat_circuit_board: 1, mat_battery: 2, mat_wire: 2, mat_duct_tape: 1 },
        category: 'weapons'
      },
      {
        name: 'Motion Tracker',
        result: 'elec_tracker',
        ingredients: { mat_circuit_board: 2, mat_battery: 3, elec_phone: 1 },
        category: 'gear'
      },
      {
        name: 'Reinforced Vest',
        result: 'armor_plate',
        ingredients: { armor_vest: 1, mat_kevlar_shred: 2, mat_duct_tape: 2 },
        category: 'armor'
      },
      {
        name: 'Suture Kit',
        result: 'med_suture_kit',
        ingredients: { mat_super_glue: 1, mat_wire: 1, bandage: 2 },
        category: 'medicine'
      },
      // ── Advanced recipes ─────────────────────────────────────────────────
      {
        name: 'Wire Snare',
        result: 'trap_wire_snare',
        ingredients: { mat_wire: 2, rope: 1 },
        category: 'traps'
      },
      {
        name: 'Signal Flare',
        result: 'gear_flare',
        qty: 2,
        ingredients: { mat_gunpowder: 1, mat_cloth: 1 },
        category: 'gear'
      },
      {
        name: 'Gas Mask Filter (Improvised)',
        result: 'gear_gas_mask',
        ingredients: { mat_cloth: 4, mat_charcoal: 2, mat_rubber_tube: 1 },
        category: 'gear'
      },
      {
        name: 'Adrenaline Shot',
        result: 'med_adrenaline',
        ingredients: { mat_alcohol_isopropyl: 2, bandage: 1, med_vitamins: 1 },
        category: 'medicine'
      },
      {
        name: 'Flashbang',
        result: 'explosive_flash_bang',
        ingredients: { mat_gunpowder: 1, mat_glass_bottle: 1, mat_screws: 2 },
        category: 'weapons'
      },
      {
        name: 'Nail Bat',
        result: 'weapon_nail_bat',
        ingredients: { weapon_baseball_bat: 1, mat_nails: 8 },
        category: 'weapons'
      },
      {
        name: 'Morphine (Improvised)',
        result: 'med_morphine',
        ingredients: { food_mushroom: 4, mat_alcohol_isopropyl: 1 },
        category: 'medicine'
      },
      {
        name: 'Landmine',
        result: 'trap_landmine',
        ingredients: { mat_gunpowder: 4, mat_nails: 6, mat_wire: 2, mat_circuit_board: 1 },
        category: 'weapons'
      },
      {
        name: 'Pipe Bomb',
        result: 'explosive_pipe_bomb',
        ingredients: { mat_gunpowder: 3, mat_nails: 4, rope: 1 },
        category: 'weapons'
      },
      {
        name: 'Molotov Cocktail',
        result: 'explosive_molotov',
        ingredients: { mat_glass_bottle: 1, tool_fuel_can: 1, mat_cloth: 1 },
        category: 'weapons'
      },
      {
        name: 'Bear Trap',
        result: 'trap_bear_trap',
        ingredients: { mat_nails: 8, mat_wire: 3, rope: 1 },
        category: 'weapons'
      },
      {
        name: 'Noise Decoy',
        result: 'gear_decoy',
        ingredients: { mat_nails: 2, mat_wire: 1, mat_battery: 1 },
        category: 'gear'
      },
      {
        name: 'Repair Kit',
        result: 'tool_repair_kit',
        ingredients: { mat_duct_tape: 2, mat_wire: 1, mat_cloth: 2 },
        category: 'gear'
      },
      {
        name: 'Stim Shot',
        result: 'med_stim_shot',
        ingredients: { med_adrenaline: 1, med_caffeine_pills: 2, mat_alcohol_isopropyl: 1 },
        category: 'medicine'
      },
      {
        name: 'Claymore Mine',
        result: 'explosive_claymore',
        ingredients: { mat_gunpowder: 6, mat_nails: 12, mat_wire: 3, mat_circuit_board: 1 },
        category: 'weapons'
      },
      {
        name: 'Energy Bar',
        result: 'food_energy_bar',
        ingredients: { mat_sugar: 2, food_honey: 1, mat_coffee_grounds: 1 },
        category: 'food'
      }
    ];

    this.setupUI();
  }

  setupUI() {
    this.recipesContainer = document.getElementById('recipes');
    this.renderRecipes();
  }

  renderRecipes() {
    if (!this.recipesContainer) return;
    this.recipesContainer.innerHTML = '';

    this.recipes.forEach((recipe, index) => {
      const recipeEl = document.createElement('div');
      recipeEl.className = 'recipe';

      const nameEl = document.createElement('div');
      nameEl.className = 'recipe-name';
      nameEl.textContent = recipe.name;
      recipeEl.appendChild(nameEl);

      const ingredientsEl = document.createElement('div');
      ingredientsEl.className = 'recipe-ingredients';
      const ingredientTexts = Object.entries(recipe.ingredients).map(([item, qty]) => {
        const have = this.inventory.getItemCount(item);
        const color = have >= qty ? '#00ff00' : '#ff0000';
        return `<span style="color: ${color}">${item}: ${have}/${qty}</span>`;
      });
      ingredientsEl.innerHTML = ingredientTexts.join(' | ');
      recipeEl.appendChild(ingredientsEl);

      const btnEl = document.createElement('button');
      btnEl.className = 'recipe-btn';
      btnEl.textContent = 'Craft';
      btnEl.disabled = !this.canCraft(recipe);

      btnEl.addEventListener('click', () => {
        if (this.canCraft(recipe)) {
          this.craft(recipe);
        }
      });

      recipeEl.appendChild(btnEl);
      this.recipesContainer.appendChild(recipeEl);
    });
  }

  canCraft(recipe) {
    for (const [item, qty] of Object.entries(recipe.ingredients)) {
      if (this.inventory.getItemCount(item) < qty) {
        return false;
      }
    }
    return true;
  }

  craft(recipe) {
    if (!this.canCraft(recipe)) {
      console.warn('Cannot craft:', recipe.name);
      return false;
    }

    for (const [item, qty] of Object.entries(recipe.ingredients)) {
      for (let i = 0; i < qty; i++) {
        const slotIndex = this.inventory.slots.findIndex(s => s && s.type === item);
        if (slotIndex !== -1) {
          this.inventory.removeItem(slotIndex, 1);
        }
      }
    }

    const added = this.inventory.addItem(recipe.result, recipe.qty ?? 1);
    if (!added) {
      // Inventory full: drop the crafted result at the player's feet rather than
      // silently destroying it (the ingredients were already consumed above).
      const p = this.game.player?.getPosition?.();
      if (p && this.game.worldItemSystem?.spawnItem) {
        const gy = this.game.inFriendHouse
          ? p.y - 0.85
          : (this.game.terrainGenerator?.getHeightAt(p.x, p.z) ?? p.y - 0.85);
        this.game.worldItemSystem.spawnItem(recipe.result, p.x, gy + 0.3, p.z, recipe.qty ?? 1);
      }
      const notif = document.getElementById('loot-notification');
      if (notif) { notif.textContent = '🎒 Inventory full — crafted item dropped at your feet'; notif.style.color = '#ffcc44'; notif.classList.remove('show'); void notif.offsetWidth; notif.classList.add('show'); }
    }
    this.renderRecipes();
    this.game._craftCount = (this.game._craftCount ?? 0) + 1;
    // XP for crafting
    this.game.player?.gainXP?.(15, 'craft');
    return true;
  }

  getRecipes() {
    return this.recipes;
  }

  addRecipe(recipe) {
    this.recipes.push(recipe);
    this.renderRecipes();
  }
}
