import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Animated quadruped model for the ZombieHound — a self-contained GLB (mesh +
// embedded animations). Falls back to the procedural dog if absent.
//   public/models/hound/wolf.glb   (Quaternius Animated Animal Pack, CC0)
const MODEL_URL   = '/models/hound/wolf.glb';
const TARGET_H    = 0.72;   // metres tall (shoulder-ish) — matches the procedural dog
const FOOT_Y      = -0.9;   // feet rest here (physics body centre rides 0.9 m up)
const ROT_Y       = 0;      // set to Math.PI if the dog faces backwards
// gameplay state -> clip name substrings (wolf clips: Idle/Walk/Gallop/Attack/Death)
const CLIPS = {
  idle:   ['idle'],
  walk:   ['walk'],
  run:    ['gallop', 'run'],
  attack: ['attack', 'bite'],
  death:  ['death'],
};

export class HoundModelLoader {
  constructor() {
    this.ready = false;
    this.failed = false;
    this._template = null;
    this._clips = [];
    this._load();
  }

  isReady() { return this.ready; }

  createInstance() {
    if (!this.ready || !this._template) return null;
    const model = cloneSkeleton(this._template);
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
      if (o.geometry) o.geometry = o.geometry.clone();       // own it (safe disposal)
      if (Array.isArray(o.material)) o.material = o.material.map(m => m.clone());
      else if (o.material) o.material = o.material.clone();
    });
    const group = new THREE.Group();
    group.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const [state, needles] of Object.entries(CLIPS)) {
      // prefer the plain clip name over the "AnimalArmature|..." duplicate
      const clip = this._clips.find(c => { const n = c.name.toLowerCase(); return !n.includes('|') && needles.some(k => n.includes(k)); })
                || this._clips.find(c => needles.some(k => c.name.toLowerCase().includes(k)));
      if (clip) actions[state] = mixer.clipAction(clip);
    }
    let current = null;
    const play = (state) => {
      const a = actions[state] || actions.walk || actions.idle || null;
      if (!a || a === current) return;
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(0.2); a.play();
      if (current && current !== a) current.crossFadeTo(a, 0.2, false);
      current = a;
    };
    return { group, mixer, play, hasAnim: Object.keys(actions).length > 0, stop: () => mixer.stopAllAction() };
  }

  async _load() {
    try {
      let exists = false;
      try { exists = (await fetch(MODEL_URL, { method: 'HEAD' })).ok; } catch (_) {}
      if (!exists) { this.failed = true; return; }
      const gltf = await new Promise((res, rej) => new GLTFLoader().load(MODEL_URL, res, undefined, rej));
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3(); box.getSize(size);
      scene.scale.setScalar(TARGET_H / (size.y || 1));
      scene.rotation.y = ROT_Y;
      scene.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(scene);
      scene.position.y += FOOT_Y - box.min.y;   // feet rest at FOOT_Y
      this._template = scene;
      this._clips = gltf.animations || [];
      console.info(`[HoundModelLoader] wolf loaded (${this._clips.length} clips).`);
      this.ready = true;
    } catch (e) {
      this.failed = true;
      console.info('[HoundModelLoader] no hound model — using procedural dog.', e?.message || e);
    }
  }
}
