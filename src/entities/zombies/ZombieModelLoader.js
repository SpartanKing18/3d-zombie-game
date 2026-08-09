import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  External zombie model integration
// ─────────────────────────────────────────────────────────────────────────────
// Drop your downloaded/extracted model here (Vite serves `public/` at the site
// root, so a file at public/models/zombie.glb is fetched from "/models/zombie.glb"):
//
//   public/models/zombie.glb     ← preferred. Convert the pack's mesh to glTF/GLB.
//   public/models/zombie.fbx     ← also supported (the pack is likely FBX).
//
// If the animations are a SEPARATE file (the pack ships "Zombie animation"
// separately from "Base mesh"), also drop:
//
//   public/models/zombie_anim.glb  (or .fbx)
//
// The loader auto-scales the model to ~1.8 m and plants its feet, so it lines up
// with the procedural zombies. If ANY of this is missing or fails to load, the
// game silently falls back to the procedural humanoid — nothing breaks.
//
// After you add the files, open the browser console: the loader logs the exact
// animation clip names it found. If your clips aren't matched, edit CLIPS below.
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_CONFIG = {
  meshPaths:  ['/models/zombie.glb', '/models/zombie.gltf', '/models/zombie.fbx'],
  animPaths:  ['/models/zombie_anim.glb', '/models/zombie_anim.gltf', '/models/zombie_anim.fbx'],
  targetHeight: 1.8,   // metres — model is uniformly scaled to this
  footLocalY:  -0.9,   // soles rest here in local space (matches procedural footY)
  rotationY:    0,     // radians — rotate if the model faces the wrong way (try Math.PI)
  // Map a gameplay state to the first animation clip whose name CONTAINS any of
  // these substrings (case-insensitive). Tune to match your pack's clip names.
  clips: {
    idle:   ['idle', 'breath', 'stand', 'tpose', 'pose'],
    walk:   ['walk', 'shamble', 'stagger', 'move'],
    run:    ['run', 'sprint', 'chase', 'jog'],
    attack: ['attack', 'bite', 'swipe', 'punch', 'hit'],
    death:  ['death', 'die', 'dead', 'fall'],
  },
};

export class ZombieModelLoader {
  constructor() {
    this.ready = false;      // true once a usable template + clips are loaded
    this.failed = false;     // true if no model file was found (→ procedural)
    this._template = null;   // normalized THREE.Object3D used as the clone source
    this._stateClips = {};   // { idle|walk|run|attack|death: AnimationClip }
    this._headshotY = 1.55;
    this._healthBarHeight = 2.05;
    this._load();            // fire-and-forget; createInstance() no-ops until ready
  }

  // ── Public API ────────────────────────────────────────────────────────────
  isReady() { return this.ready; }

  // Build one independent, animatable zombie rig, or null if the model isn't
  // ready. Each instance owns its geometry + materials so per-zombie hit-flash
  // and the corpse-disposal path can't affect other zombies.
  createInstance() {
    if (!this.ready || !this._template) return null;

    const model = cloneSkeleton(this._template);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
      // Own the geometry: cloneSkeleton shares it, but the corpse-fade disposal
      // calls geometry.dispose(), which would corrupt every other live instance.
      if (o.geometry) o.geometry = o.geometry.clone();
      // Own the materials: enables per-zombie red hit-flash / tinting.
      if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone());
      else if (o.material) o.material = o.material.clone();
    });

    const group = new THREE.Group();
    group.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const [state, clip] of Object.entries(this._stateClips)) {
      if (clip) actions[state] = mixer.clipAction(clip);
    }

    let current = null;
    const play = (state) => {
      const action = actions[state] || actions.idle || actions.walk || null;
      if (!action || action === current) return;
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.fadeIn(0.2);
      action.play();
      if (current) current.crossFadeTo(action, 0.2, false);
      current = action;
    };

    return {
      group,
      mixer,
      play,
      headshotY: this._headshotY,
      healthBarHeight: this._healthBarHeight,
      hasAnim: Object.keys(actions).length > 0,
      stop: () => mixer.stopAllAction(),
    };
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  async _load() {
    try {
      const mesh = await this._loadFirst(MODEL_CONFIG.meshPaths);
      if (!mesh || !mesh.scene) { this.failed = true; return; }

      const scene = mesh.scene;
      this._normalize(scene);
      this._template = scene;

      // Animations: prefer clips embedded in the mesh file, else a separate file.
      let clips = mesh.animations || [];
      if (clips.length === 0) {
        const anim = await this._loadFirst(MODEL_CONFIG.animPaths);
        if (anim) clips = anim.animations || [];
      }
      this._stateClips = this._mapClips(clips);

      const matched = Object.entries(this._stateClips)
        .filter(([, c]) => c).map(([s, c]) => `${s}=${c.name}`);
      console.info(
        `[ZombieModelLoader] model loaded (${clips.length} clips). ` +
        `Matched: ${matched.join(', ') || 'none'}. All clips: [${clips.map(c => c.name).join(', ')}]`
      );

      this.ready = true; // usable even with zero clips (static posed mesh > nothing)
    } catch (e) {
      this.failed = true;
      console.info('[ZombieModelLoader] no external zombie model — using procedural zombies.', e?.message || e);
    }
  }

  // Scale the model to targetHeight, drop its feet to footLocalY, apply the
  // facing correction, and derive headshot / health-bar heights from its bounds.
  _normalize(scene) {
    scene.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const scale = (MODEL_CONFIG.targetHeight || 1.8) / (size.y || 1.8);
    scene.scale.setScalar(scale);

    scene.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(scene);
    scene.position.y += (MODEL_CONFIG.footLocalY ?? -0.9) - box.min.y;
    scene.rotation.y = MODEL_CONFIG.rotationY || 0;

    scene.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y;
    this._headshotY = box.max.y - h * 0.12;   // ~head height, local to the group
    this._healthBarHeight = box.max.y + 0.25;
  }

  _mapClips(clips) {
    const out = {};
    for (const [state, needles] of Object.entries(MODEL_CONFIG.clips)) {
      out[state] = clips.find(c => {
        const n = (c.name || '').toLowerCase();
        return needles.some(k => n.includes(k));
      }) || null;
    }
    // Sensible fallbacks so a partial clip set still animates.
    out.walk   = out.walk   || out.run  || out.idle || clips[0] || null;
    out.run    = out.run    || out.walk || null;
    out.idle   = out.idle   || out.walk || null;
    out.attack = out.attack || out.walk || null;
    return out;
  }

  // Try each path in order; resolve with the first that loads. A quiet HEAD
  // check first means missing files don't spam the console with loader errors.
  async _loadFirst(paths) {
    for (const p of paths) {
      let exists = false;
      try { exists = (await fetch(p, { method: 'HEAD' })).ok; } catch (_) { exists = false; }
      if (!exists) continue;
      try {
        const r = await this._loadOne(p);
        if (r) return r;
      } catch (_) { /* present but failed to parse — try next */ }
    }
    return null;
  }

  _loadOne(path) {
    const ext = path.split('.').pop().toLowerCase();
    return new Promise((resolve, reject) => {
      if (ext === 'glb' || ext === 'gltf') {
        new GLTFLoader().load(path,
          g => resolve({ scene: g.scene, animations: g.animations || [] }),
          undefined, reject);
      } else if (ext === 'fbx') {
        new FBXLoader().load(path,
          g => resolve({ scene: g, animations: g.animations || [] }),
          undefined, reject);
      } else {
        reject(new Error('unsupported model extension: ' + ext));
      }
    });
  }
}
