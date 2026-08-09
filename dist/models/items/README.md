# Item / prop models (drop-in)

Real 3D models for world-item pickups. Items **without** a model keep their
procedural mesh — this is purely additive and safe.

## Add a model
1. Put a `.glb` here (GLB preferred; `.gltf` works).
2. Register it in `manifest.json`, keyed by item `type`
   (see `src/ui/InventorySystem.js` → `itemTypes`):

```json
{
  "med_medkit": "medkit.glb",
  "ammo_9mm":   "ammo_box.glb",
  "food_canned_beans": "can.glb"
}
```

Models auto-scale to a sane pickup size; the loader clones per pickup (materials
cloned per instance so disposal is safe). Missing files just fall back to
procedural.

## Best free sources (CC0, game-ready, GLB)
- **Kenney.nl** — huge CC0 packs (survival, food, weapons, tools, furniture)
- **Quaternius.com** — CC0 low-poly packs
- **Poly.pizza** — searchable CC0/CC-BY GLBs, one-click download

Prefer one consistent low-poly source so items match visually. These same packs
also cover **furniture/props** if you want to dress up rooms without touching the
structural house geometry.
