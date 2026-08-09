import * as THREE from 'three';

// Shared CC0 photographic textures (Poly Haven) applied as map + normalMap so
// surfaces have real detail instead of flat plastic colour. Cached per
// (file, repeat, colorspace) since tiling lives on the texture object.
const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const loader = new THREE.TextureLoader();
const cache = new Map();

function tex(file, { srgb = false, repeat = 1 } = {}) {
  const key = `${file}|${repeat}|${srgb}`;
  if (cache.has(key)) return cache.get(key);
  const t = loader.load(BASE + 'textures/' + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

// Returns { map, normalMap } ready to spread onto a MeshStandardMaterial.
export const Textures = {
  road:     (r = 10) => ({ map: tex('asphalt.jpg',  { srgb: true, repeat: r }), normalMap: tex('asphalt_n.jpg',  { repeat: r }) }),
  concrete: (r = 6)  => ({ map: tex('concrete.jpg', { srgb: true, repeat: r }), normalMap: tex('concrete_n.jpg', { repeat: r }) }),
  wall:     (r = 2.2)=> ({ map: tex('plaster.jpg',  { srgb: true, repeat: r }), normalMap: tex('plaster_n.jpg',  { repeat: r }) }),
  ground:   (r = 22) => ({ map: tex('ground.jpg',   { srgb: true, repeat: r }), normalMap: tex('ground_n.jpg',   { repeat: r }) }),
  skin:     (r = 2.5)=> ({ map: tex('skin.jpg',     { srgb: true, repeat: r }), normalMap: tex('skin_n.jpg',     { repeat: r }) }),
  wood:     (r = 1)  => ({ map: tex('wood.jpg',     { srgb: true, repeat: r }) }),
};
