import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
//  External zombie model integration
// ─────────────────────────────────────────────────────────────────────────────
// Renders a real rigged model in place of the procedural zombie. If anything
// below is missing or fails to load, the game silently falls back to the
// procedural body — nothing breaks without the files.
//
// Files live in public/models/ (served at the site root). The default config
// matches the shipped character pack: a base FBX mesh, per-clip animation FBX
// files, and a converted PBR texture set. See public/models/README.md.
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_CONFIG = {
  // Mesh: first path that exists wins (GLB preferred, FBX supported).
  // The shipped mesh is .fbx — list it first so the loader finds it on the first
  // probe (glb/gltf are only fallbacks; probing them first 404s in the console).
  meshPaths: ['/models/zombie.fbx', '/models/zombie.glb', '/models/zombie.gltf'],

  // Separate per-clip animation files (Mixamo / character-pack style). Each
  // file's first clip is renamed to `clip`. Leave [] if the mesh embeds clips.
  // Multiple files can map to the same state — a random one plays each time the
  // zombie (re)enters that state, so attacks/idles/deaths vary across the horde.
  animFiles: [
    { file: '/models/anims/idle.fbx',    clip: 'idle'    },
    { file: '/models/anims/idle2.fbx',   clip: 'idle2'   },
    { file: '/models/anims/walk.fbx',    clip: 'walk'    },
    { file: '/models/anims/run.fbx',     clip: 'run'     },
    { file: '/models/anims/attack.fbx',  clip: 'attack'  },
    { file: '/models/anims/attack2.fbx', clip: 'attack2' },
    { file: '/models/anims/attack3.fbx', clip: 'attack3' },
    { file: '/models/anims/attack4.fbx', clip: 'attack4' },
    { file: '/models/anims/death.fbx',   clip: 'death'   },
    { file: '/models/anims/death2.fbx',  clip: 'death2'  },
  ],

  // Optional PBR texture set (standard web images) applied over the mesh's
  // materials. Remove any map you don't have. `map` is treated as sRGB colour;
  // the rest are linear data maps.
  textures: {
    map:          '/models/textures/albedo.jpg',
    normalMap:    '/models/textures/normal.jpg',
    roughnessMap: '/models/textures/roughness.jpg',
    metalnessMap: '/models/textures/metalness.jpg',
    aoMap:        '/models/textures/ao.jpg',
    emissiveMap:  '/models/textures/emissive.jpg',
  },

  targetHeight: 1.8,   // metres — model is uniformly scaled to this
  footLocalY:  -0.9,   // soles rest here in local space (matches procedural footY)
  rotationY:    0,     // radians — set to Math.PI if the model faces the wrong way

  // Locomotion clips that carry ROOT MOTION: strip horizontal travel so the
  // physics body owns movement (no foot-sliding). Empty for the shipped pack —
  // its clips are already in-place (verified: hips/reference bones have ~0 travel;
  // the large motions are intentional IK foot/hand effectors, which this must NOT
  // touch). Only enable for a pack whose ROOT/HIPS bone actually translates.
  inPlace: [],

  // Which loaded clip name each gameplay state uses. First substring match wins,
  // so the direct names above ('idle','walk',…) match themselves.
  clips: {
    idle:   ['idle', 'breath', 'stand'],
    walk:   ['walk', 'shamble', 'stagger', 'move'],
    run:    ['run', 'sprint', 'chase', 'jog'],
    attack: ['attack', 'atack', 'bite', 'swipe', 'punch', 'hit'],
    death:  ['death', 'die', 'dead', 'fall'],
  },
};

export class ZombieModelLoader {
  constructor() {
    this.ready = false;
    this.failed = false;
    this._template = null;
    this._stateClips = {};
    this._headshotY = 1.55;
    this._healthBarHeight = 2.05;
    this._load();
  }

  isReady() { return this.ready; }

  // Build one independent, animatable zombie rig, or null if not ready. Each
  // instance owns its geometry + materials so per-zombie hit-flash and the
  // corpse-fade disposal can't affect other live instances.
  createInstance() {
    if (!this.ready || !this._template) return null;

    const model = cloneSkeleton(this._template);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
      if (o.geometry) o.geometry = o.geometry.clone();
      if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone());
      else if (o.material) o.material = o.material.clone();
    });

    const group = new THREE.Group();
    group.add(model);

    const mixer = new THREE.AnimationMixer(model);
    // One action pool per state (may hold several variant clips).
    const pools = {};
    for (const [state, clipArr] of Object.entries(this._stateClips)) {
      pools[state] = (clipArr || []).map(c => mixer.clipAction(c));
    }

    let curState = null, current = null;
    const play = (state) => {
      if (state === curState && current) return; // already in this state — don't re-pick
      let pool = pools[state];
      if (!pool || !pool.length) pool = pools.idle || pools.walk;
      if (!pool || !pool.length) return;
      // Random variant each time the state is (re)entered → varied attacks/idles/deaths.
      const action = pool[(Math.random() * pool.length) | 0];
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.fadeIn(0.2);
      action.play();
      if (current && current !== action) current.crossFadeTo(action, 0.2, false);
      current = action;
      curState = state;
    };

    return {
      group, mixer, play,
      headshotY: this._headshotY,
      healthBarHeight: this._healthBarHeight,
      hasAnim: Object.values(pools).some(p => p.length > 0),
      stop: () => mixer.stopAllAction(),
    };
  }

  async _load() {
    try {
      const mesh = await this._loadFirst(MODEL_CONFIG.meshPaths);
      if (!mesh || !mesh.scene) { this.failed = true; return; }

      const scene = mesh.scene;
      this._normalize(scene);
      await this._applyTextures(scene);
      this._template = scene;

      // Merge clips: any embedded in the mesh + one per external animation file.
      let clips = (mesh.animations || []).slice();
      for (const { file, clip } of (MODEL_CONFIG.animFiles || [])) {
        try {
          let exists = false;
          try { exists = (await fetch(file, { method: 'HEAD' })).ok; } catch (_) {}
          if (!exists) continue;
          const a = await this._loadOne(file);
          const c = a?.animations?.[0];
          if (c) {
            c.name = clip;
            if ((MODEL_CONFIG.inPlace || []).includes(clip)) this._makeInPlace(c);
            clips.push(c);
          }
        } catch (_) { /* skip this clip */ }
      }
      this._stateClips = this._mapClips(clips);

      const matched = Object.entries(this._stateClips)
        .filter(([, a]) => a.length).map(([s, a]) => `${s}×${a.length}`);
      console.info(
        `[ZombieModelLoader] model loaded (${clips.length} clips). ` +
        `States: ${matched.join(', ') || 'none'}. All clips: [${clips.map(c => c.name).join(', ')}]`
      );

      this.ready = true;
    } catch (e) {
      this.failed = true;
      console.info('[ZombieModelLoader] no external zombie model — using procedural zombies.', e?.message || e);
    }
  }

  // Load the PBR texture set and apply it to every skinned mesh in the model.
  async _applyTextures(scene) {
    const cfg = MODEL_CONFIG.textures;
    if (!cfg) return;
    const tl = new THREE.TextureLoader();
    const load = (url) => url ? new Promise(res => tl.load(url, t => res(t), undefined, () => res(null))) : Promise.resolve(null);

    const [map, normalMap, roughnessMap, metalnessMap, aoMap, emissiveMap] = await Promise.all([
      load(cfg.map), load(cfg.normalMap), load(cfg.roughnessMap),
      load(cfg.metalnessMap), load(cfg.aoMap), load(cfg.emissiveMap),
    ]);
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    if (emissiveMap) emissiveMap.colorSpace = THREE.SRGBColorSpace;
    // AO uses the primary UV set (single-texture-set character).
    if (aoMap) aoMap.channel = 0;
    if (!map && !normalMap && !emissiveMap) return; // nothing usable

    const mat = new THREE.MeshStandardMaterial({
      map: map || null,
      normalMap: normalMap || null,
      roughnessMap: roughnessMap || null,
      metalnessMap: metalnessMap || null,
      aoMap: aoMap || null,
      emissiveMap: emissiveMap || null,
      emissive: emissiveMap ? 0xffffff : 0x000000,
      emissiveIntensity: emissiveMap ? 1.0 : 0,
      roughness: roughnessMap ? 1.0 : 0.85,
      metalness: metalnessMap ? 1.0 : 0.0,
    });
    scene.traverse(o => {
      if (o.isMesh) { o.material = mat; }
    });
  }

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
    this._headshotY = box.max.y - h * 0.12;
    this._healthBarHeight = box.max.y + 0.25;
  }

  // Flatten the X/Z of the single most-translating .position track (the
  // locomotion root) to its first-frame value, converting a root-motion clip to
  // in-place. Only touches one track, and only if it actually travels.
  _makeInPlace(clip) {
    let best = null, bestRange = -1;
    for (const t of clip.tracks) {
      if (!t.name.endsWith('.position')) continue;
      const v = t.values;
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (let i = 0; i < v.length; i += 3) {
        if (v[i] < minx) minx = v[i]; if (v[i] > maxx) maxx = v[i];
        if (v[i + 2] < minz) minz = v[i + 2]; if (v[i + 2] > maxz) maxz = v[i + 2];
      }
      const range = (maxx - minx) + (maxz - minz);
      if (range > bestRange) { bestRange = range; best = t; }
    }
    if (best && bestRange > 1e-3) {
      const v = best.values, x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  }

  // Returns { state: AnimationClip[] } — every clip whose name matches the state's
  // keywords (so idle2/attack2-4/death2 group with their base state).
  _mapClips(clips) {
    const out = {};
    for (const [state, needles] of Object.entries(MODEL_CONFIG.clips)) {
      out[state] = clips.filter(c => {
        const n = (c.name || '').toLowerCase();
        return needles.some(k => n.includes(k));
      });
    }
    if (!out.walk.length)   out.walk   = out.run.length ? out.run : (out.idle.length ? out.idle : (clips[0] ? [clips[0]] : []));
    if (!out.run.length)    out.run    = out.walk;
    if (!out.idle.length)   out.idle   = out.walk;
    if (!out.attack.length) out.attack = out.walk;
    return out;
  }

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
