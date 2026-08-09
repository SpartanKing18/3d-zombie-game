import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Generic drop-in model registry (used for both world items and furniture)
// ─────────────────────────────────────────────────────────────────────────────
// Loads GLB models listed in a manifest and hands out per-instance clones to
// replace procedural meshes. Anything not registered keeps its procedural mesh —
// purely additive; a missing manifest/file just falls back.
//
//   manifest.json:  { "<type>": "file.glb", ... }   (keys are item/furniture types)
//
// Options:
//   manifestUrl / dir  where the manifest and GLBs live
//   fit                scale so the longest bbox dimension = this many metres
//                      (good for small pickups). Ignored if `scale` is set.
//   scale              uniform scale factor (preserves relative sizes — good for
//                      furniture where a chair and a table must differ)
//   ground             shift so the model's base sits at local y=0
//
// Good CC0 sources: Kenney.nl, Quaternius.com, Poly.pizza.
// ─────────────────────────────────────────────────────────────────────────────
export class ModelRegistry {
  constructor(opts = {}) {
    this.manifestUrl = opts.manifestUrl || '/models/items/manifest.json';
    this.dir         = opts.dir         || '/models/items/';
    this.fit         = opts.fit ?? 0.42;   // metres (longest dim); null to disable
    this.scale       = opts.scale ?? null; // uniform factor; overrides `fit`
    this.ground      = opts.ground ?? false;
    this.label       = opts.label || 'ModelRegistry';

    this.ready = false;
    this._templates = new Map();
    this._load();
  }

  // Synchronous: a fresh clone for `type`, or null (→ procedural). Geometry is
  // shared across clones; materials are cloned per instance so the caller's
  // material disposal can't corrupt other instances.
  createModel(type) {
    const tpl = this._templates.get(type);
    if (!tpl) return null;
    const model = tpl.clone(true);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone());
      else if (o.material) o.material = o.material.clone();
    });
    return model;
  }

  async _load() {
    let manifest;
    try {
      const res = await fetch(this.manifestUrl);
      if (!res.ok) return;
      manifest = await res.json();
    } catch (_) { return; }
    if (!manifest || typeof manifest !== 'object') return;

    const loader = new GLTFLoader();
    await Promise.all(Object.entries(manifest).map(([type, file]) =>
      new Promise(resolve => {
        loader.load(this.dir + file,
          g => { try { this._templates.set(type, this._normalize(g.scene)); } catch (_) {} resolve(); },
          undefined,
          () => resolve()
        );
      })
    ));
    this.ready = this._templates.size > 0;
    if (this.ready) {
      console.info(`[${this.label}] ${this._templates.size} model(s): [${[...this._templates.keys()].join(', ')}]`);
    }
  }

  _normalize(scene) {
    scene.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(scene);
    if (this.scale != null) {
      scene.scale.setScalar(this.scale);
    } else if (this.fit != null) {
      const size = new THREE.Vector3(); box.getSize(size);
      const longest = Math.max(size.x, size.y, size.z) || 1;
      scene.scale.setScalar(this.fit / longest);
    }
    if (this.ground) {
      scene.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(scene);
      if (isFinite(box.min.y)) scene.position.y -= box.min.y;
    }
    return scene;
  }
}
