# External zombie model — drop-in folder

The game renders **procedural** zombies by default. To swap in a real downloaded
model, put the files here. Vite serves this folder at the site root, so a file at
`public/models/zombie.glb` is loaded from `/models/zombie.glb`.

## What to add

| File | Purpose |
|------|---------|
| `zombie.glb` (or `.gltf` / `.fbx`) | **Required.** The rigged base mesh. GLB is preferred — convert the pack's mesh if it's FBX. |
| `zombie_anim.glb` (or `.gltf` / `.fbx`) | **Optional.** Only needed if the animations are a *separate* file from the mesh (the pack's "Zombie animation" archive). If the mesh file already embeds its clips, skip this. |

Textures that ship *inside* the GLB/FBX are used automatically. (The pack's
separate "Texture set" archives are UV-mapped for this mesh; embed them into the
GLB during conversion, e.g. in Blender: import FBX + textures → export glTF Binary.)

## How it behaves

- Loaded once at startup, cloned per zombie (each owns its geometry + materials).
- Auto-scaled to ~1.8 m with feet planted, so it aligns with the world.
- Gameplay states drive the animation: `idle`, `walk`, `run`, `attack`.
- **If anything here is missing or fails to load, the game silently falls back to
  the procedural zombies — nothing breaks.**

## Tuning (in `src/entities/zombies/ZombieModelLoader.js` → `MODEL_CONFIG`)

Open the browser console after adding the files — the loader logs every animation
clip name it found and which ones it matched. If a state shows no clip, add the
right substring to `MODEL_CONFIG.clips`. Other knobs:

- `rotationY` — set to `Math.PI` if the model faces backwards.
- `targetHeight` / `footLocalY` — size / ground alignment.

## Performance note

Each zombie clones the mesh's geometry, so a very high-poly model (e.g. 16k+
triangles) across a large horde uses real GPU memory. If you see frame drops,
use a lower-poly mesh or cap concurrent zombies.
