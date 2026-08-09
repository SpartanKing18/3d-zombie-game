# External zombie model (drop-in)

The game renders **procedural** zombies by default and uses the files here when
present. If anything is missing or fails to load, it silently falls back to the
procedural body — nothing breaks.

## What's here (shipped character pack)

```
models/
  zombie.fbx              rigged base mesh (FBX 7.5, skinned)
  anims/
    idle.fbx  walk.fbx  run.fbx  attack.fbx  death.fbx   one animation clip each
  textures/
    albedo.jpg  normal.jpg  roughness.jpg  metalness.jpg  ao.jpg  emissive.jpg
```

The source pack shipped a base FBX + separate per-clip animation FBX files +
4096² TGA textures. The TGAs were converted/downscaled to web JPGs (albedo &
normal 2048², the rest 1024²; `roughness.jpg` is the pack's gloss map inverted),
and five clips were selected. This whole folder is ~15 MB.

## How it works

`src/entities/zombies/ZombieModelLoader.js` loads the base mesh, merges one clip
from each `anims/*.fbx`, builds a PBR material from `textures/`, auto-scales to
~1.8 m and plants the feet, then renders it per zombie (each instance owns its
geometry + materials). Gameplay state drives the clip: `idle / walk / run /
attack`; death freezes the pose for the existing fall/fade/revive logic.

## Tuning (`MODEL_CONFIG` in ZombieModelLoader.js)

Open the browser console — the loader logs every clip it found and matched.

- `rotationY`: set to `Math.PI` if the model faces backwards.
- `targetHeight` / `footLocalY`: size / ground alignment.
- `animFiles`: add more clips (the pack also has atack2-4, death2, gethit, roar,
  idle2) by copying them in and adding `{ file, clip }` entries.
- `textures`: swap in a different texture set, or remove maps you don't want.
- Prefer a single GLB? Drop `zombie.glb` in and it's used instead of the FBX.

## Performance

Each zombie clones the mesh geometry. This model is fairly high-poly, so a large
horde uses real GPU memory — lower the model res or cap concurrent zombies if you
see frame drops.
