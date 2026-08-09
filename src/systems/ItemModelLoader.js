import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Optional real 3D models for world items / props
// ─────────────────────────────────────────────────────────────────────────────
// Renders a downloaded model for a pickup type instead of the procedural mesh.
// Any item without a model keeps its procedural mesh — this is purely additive.
//
// To add models:
//   1. Drop GLB files in  public/models/items/   (GLB preferred; .gltf also works)
//   2. List them in       public/models/items/manifest.json  as:
//        { "med_medkit": "medkit.glb", "ammo_9mm": "ammo_box.glb", ... }
//      Keys are item `type` strings (see InventorySystem.itemTypes).
//
// Good CC0 / game-ready sources (consistent style, permissive licence, GLB):
//   • Kenney.nl (CC0)   • Quaternius.com (CC0)   • Poly.pizza (CC0/CC-BY)
//
// Each model is auto-scaled to a sane pickup size; spawnItem handles ground
// placement. Missing manifest / files / parse errors → procedural fallback.
// ─────────────────────────────────────────────────────────────────────────────
const MANIFEST_URL = '/models/items/manifest.json';
const ITEM_DIR     = '/models/items/';
const TARGET_SIZE  = 0.42; // metres — longest bounding-box dimension after scaling

export class ItemModelLoader {
  constructor() {
    this.ready = false;
    this._templates = new Map(); // type -> normalized THREE.Object3D
    this._load();
  }

  // Synchronous: returns a fresh model clone for `type`, or null (→ procedural).
  // Geometry is shared across clones; materials are cloned per instance so the
  // item-pickup disposal (which disposes materials) can't corrupt other items.
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
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) return; // no manifest → feature off, procedural everywhere
      manifest = await res.json();
    } catch (_) { return; }
    if (!manifest || typeof manifest !== 'object') return;

    const loader = new GLTFLoader();
    const entries = Object.entries(manifest);
    await Promise.all(entries.map(([type, file]) =>
      new Promise(resolve => {
        loader.load(ITEM_DIR + file,
          g => { try { this._templates.set(type, this._normalize(g.scene)); } catch (_) {} resolve(); },
          undefined,
          () => resolve() // missing/broken file → just skip this type
        );
      })
    ));
    this.ready = this._templates.size > 0;
    if (this.ready) {
      console.info(`[ItemModelLoader] ${this._templates.size} item model(s): [${[...this._templates.keys()].join(', ')}]`);
    }
  }

  // Uniformly scale so the longest dimension is TARGET_SIZE, and rest the model
  // on its own origin (spawnItem re-grounds it, but this keeps scale sane).
  _normalize(scene) {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    scene.scale.setScalar(TARGET_SIZE / longest);
    scene.updateMatrixWorld(true);
    return scene;
  }
}
