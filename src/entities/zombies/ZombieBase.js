import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Pathfinder } from '../../utils/Pathfinder.js';
import { Textures } from '../../utils/Textures.js';

// Human-readable names for the internal snake_case zombie type ids. Used by the
// death screen and kill feed so the player never sees "Killed by acid_spitter".
const ZOMBIE_DISPLAY_NAMES = {
  walker: 'Walker', runner: 'Runner', tank: 'Tank', spitter: 'Spitter', screamer: 'Screamer',
  crawler: 'Crawler', armored: 'Armored Zombie', bloater: 'Bloater', stalker: 'Stalker',
  regenerator: 'Regenerator', berserker: 'Berserker', leaper: 'Leaper', child_zombie: 'Child Zombie',
  juggernaut: 'Juggernaut', phantom: 'Phantom', horde_master: 'Horde Master', bomber: 'Bomber',
  acid_spitter: 'Acid Spitter', zombie_hound: 'Zombie Hound', necromancer: 'Necromancer',
  zombie_soldier: 'Zombie Soldier', splitter: 'Splitter', mutant_giant: 'Mutant Giant',
  mini_splitter: 'Splitterling'
};

export function zombieDisplayName(type) {
  return ZOMBIE_DISPLAY_NAMES[type]
    ?? String(type).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export class ZombieBase {
  constructor(x, z, game, config = {}) {
    this.game = game;
    this.position = new THREE.Vector3(x, game.terrainGenerator.getHeightAt(x, z) + 1, z);
    this.velocity = new THREE.Vector3();

    this.type = config.type || 'walker';
    this.health = config.health || 50;
    this.maxHealth = config.maxHealth || config.health || 50;
    this.damage = config.damage || 10;
    this.speed = config.speed || 3;
    this.attackRange = config.attackRange || 2;
    this.aggroRange = config.aggroRange || 30;
    this.attackCooldown = config.attackCooldown || 1.5;

    this.state = 'idle';
    this.stateTimer = 0;
    this.lastAttackTime = 0; // counts up; attack allowed once it reaches attackCooldown
    this.pathfinder = new Pathfinder();
    this.currentPath = [];
    this.pathIndex = 0;
    this.pathRecalcTimer = Math.random() * 1.5; // stagger so zombies don't all recalc at once
    this.pathRecalcInterval = 1.5;

    this._dead = false;
    this.mesh = null;
    this.body = null;
    this.healthBarGroup = null;
    this._walkTime = 0;
    this.stunned = false;
    this.stunTimer = 0;
    this._notifEl    = null;  // cached on first use
    this._hitmarkerEl = null;
    this.setupPhysics();
    this.createMesh();
    this.createHealthBar();
  }

  setupPhysics() {
    const shape = new CANNON.Cylinder(0.4, 0.4, 1.8, 8);
    this.body = new CANNON.Body({ mass: 1 });
    this.body.addShape(shape);
    this.body.position.copy(this.position);
    this.body.linearDamping = 0.3;
    this.body.angularDamping = 1;
    this.body.fixedRotation = true;
    // Only collide with the player — skip terrain and zombie-zombie checks
    // (terrain grounding is done manually in updateMovement)
    this.body.collisionFilterGroup = 2; // GROUP_ZOMBIE
    this.body.collisionFilterMask  = 1; // GROUP_PLAYER only
    this.game.physicsWorld.addBody(this.body);
  }

  createMesh() {
    // Prefer an external rigged model if one has been loaded; otherwise build the
    // procedural humanoid. Only the default body goes through the loader — special
    // variants override createMesh() and keep their bespoke procedural shapes.
    const rig = this.game.zombieModelLoader?.createInstance?.();
    if (rig) {
      this._modelRig = rig;
      this._modelMixer = rig.mixer;
      this.headshotY = rig.headshotY;
      this._healthBarHeight = rig.healthBarHeight;
      this.finalizeMesh(rig.group);
      rig.play('idle');
      return;
    }
    const { group } = this.buildHumanoid();
    this.finalizeMesh(group);
  }

  // Tag, position, and register a finished mesh group. Shared by base + variants.
  finalizeMesh(group) {
    group.userData.zombie = this;
    group.traverse(child => {
      if (child.isMesh) child.userData.zombie = this;
    });
    group.position.copy(this.position);
    this.game.scene.addObject(group);
    this.mesh = group;
  }

  // Build a realistically proportioned (~1.8m), articulated human body from primitives.
  // Returns { group, refs } — refs holds joint pivots and materials so variants can
  // restyle or attach gear. Local origin sits at the physics body center (0.9m above feet).
  //
  // opts:
  //   scale       overall size multiplier (feet stay planted at footY)
  //   bulk        width multiplier for torso/limbs (muscle/fat)
  //   footY       local Y where soles rest (default -0.9)
  //   skinColor / shirtColor / pantsColor   hex overrides (default: decayed random palette)
  //   shirtless   bare rotted torso
  //   belly       0..1 distended gut
  //   hunch       forward slump of the spine in radians (default ~0.30)
  //   armPose     'reach' (classic zombie), 'hang', or 'none' (variant poses arms itself)
  //   gore        number of wounds/blood patches (default 2-4)
  //   bald        skip hair
  //   eyeColor / eyeEmissive   iris color + glow strength (default milky, faint)
  //   legless     no legs (crawler-type bodies)
  // Build the realistic external model, scaled + tinted per the variant's opts,
  // returning stub refs so variant gear (armour plates, sacs, humps) attaches to
  // detached groups and is harmlessly dropped — the variant still looks realistic.
  _modelHumanoid(rig, opts = {}) {
    const s = opts.scale ?? 1;
    rig.group.scale.setScalar(s);
    if (opts.skinColor != null) {
      const tint = new THREE.Color(opts.skinColor);
      rig.group.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m.color) m.color.lerp(tint, 0.4); });
      });
    }
    this._modelRig = rig;
    this._modelMixer = rig.mixer;
    this.headshotY = (rig.headshotY ?? 1.5) * s;
    this._healthBarHeight = (rig.healthBarHeight ?? 2.0) * s;
    rig.play('idle');
    return { group: rig.group, refs: this._stubRefs() };
  }

  // Detached groups/materials satisfying every refs.* a variant touches. Anything
  // added to them isn't in the scene graph, so gear is silently dropped.
  _stubRefs() {
    const G = () => new THREE.Group();
    const arm = () => { const g = G(); g.shoulder = G(); g.elbow = G(); g.hand = G(); return g; };
    const M = () => new THREE.MeshStandardMaterial();
    const skull = G(); skull.material = M();
    return {
      root: G(), torsoGroup: G(), chest: G(), abdomen: G(), pelvis: G(),
      headGroup: G(), jaw: G(), skull,
      armL: arm(), armR: arm(), legL: G(), legR: G(),
      skinMat: M(), goreMat: M(), shirtMat: M(), pantsMat: M(),
    };
  }

  buildHumanoid(opts = {}) {
    // Prefer the external rigged model (realistic look) for every humanoid variant.
    const rig = this.game?.zombieModelLoader?.createInstance?.();
    if (rig) return this._modelHumanoid(rig, opts);

    const s     = opts.scale ?? 1;
    const bulk  = opts.bulk ?? 1;
    const footY = opts.footY ?? -0.9;
    const belly = opts.belly ?? 0;
    const hunch = opts.hunch ?? (0.22 + Math.random() * 0.16);
    const rnd   = (a, b) => a + Math.random() * (b - a);

    const group = new THREE.Group();
    const inner = new THREE.Group();
    // Scale about origin, then drop so soles rest at footY
    inner.scale.setScalar(s);
    inner.position.y = footY + 0.9 * s;
    group.add(inner);

    // --- Materials: decayed skin palette, grimy torn clothes ---
    // A faint self-lit emissive of the skin tone fakes subsurface scattering so
    // flesh reads soft instead of turning flat-black in shadow.
    const skinPalette = [0x9a9a84, 0x8f9878, 0x86907a, 0xa8a390, 0x7f8a72, 0x9c8f7e];
    const skinColor = new THREE.Color(opts.skinColor ?? skinPalette[Math.floor(Math.random() * skinPalette.length)]);
    skinColor.offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.07, (Math.random() - 0.5) * 0.07);
    const shirtColor = new THREE.Color(opts.shirtColor ?? new THREE.Color().setHSL(Math.random(), 0.22 + Math.random() * 0.2, 0.15 + Math.random() * 0.14).getHex());
    const pantsColor = new THREE.Color(opts.pantsColor ?? [0x2e3440, 0x3a3630, 0x2a3038, 0x403a30, 0x24272e][Math.floor(Math.random() * 5)]);

    // Photographic skin: a real texture map (pores/mottling) + normal map (bumps,
    // muscle/skin relief) tinted by the decayed skin colour — the biggest lever
    // against the flat "cartoon" look on the thing the player looks at most.
    const skinTex = Textures.skin(2);
    const skinMat  = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.82, metalness: 0, map: skinTex.map, normalMap: skinTex.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), emissive: skinColor.clone().multiplyScalar(0.1), emissiveIntensity: 0.4, envMapIntensity: 0.5 });
    // Slightly darker skin for joints/recesses — fakes ambient occlusion & muscle definition
    const skinDark = new THREE.MeshStandardMaterial({ color: skinColor.clone().multiplyScalar(0.72), roughness: 0.85, metalness: 0, map: skinTex.map, normalMap: skinTex.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.95, metalness: 0 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.95, metalness: 0 });
    const goreMat  = new THREE.MeshStandardMaterial({ color: 0x6a1410, roughness: 0.6, metalness: 0, emissive: 0x1a0303, emissiveIntensity: 0.6 });
    const goreDeep = new THREE.MeshStandardMaterial({ color: 0x360808, roughness: 0.7, metalness: 0 });
    const torsoMat = opts.shirtless ? skinMat : shirtMat;
    const sleeveMat = opts.shirtless ? skinMat : shirtMat;

    const M = (geo, mat, x, y, z, parent = inner) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // High-detail geometry helpers. `detail` scales segment counts so each body is
    // a dense, smooth mesh (~15k triangles — comfortably above the 10k target)
    // with no visible faceting on the organic forms. Tuned for max realism on
    // capable hardware — each body is ~45-55k triangles. Variants may pass a
    // higher `detail` for hero/boss zombies.
    const DET = opts.detail ?? 1.35;
    const R    = (n) => Math.max(3, Math.round(n * DET));
    const SPH  = (r, w = 24, h = 18) => new THREE.SphereGeometry(r, R(w), R(h));
    const CAP  = (r, len, cs = 6, rs = 22) => new THREE.CapsuleGeometry(r, len, R(cs), R(rs));
    const CYL  = (r1, r2, h, rs = 22) => new THREE.CylinderGeometry(r1, r2, h, R(rs));

    // Per-instance asymmetry — real bodies (and shambling corpses) aren't symmetric
    const leanZ  = rnd(-0.05, 0.05);
    const dropSide = Math.random() < 0.5 ? -1 : 1; // this shoulder hangs lower
    const headTilt = rnd(-0.12, 0.12);

    // --- Pelvis (doesn't hunch) ---
    const pelvis = M(SPH(0.15, 40, 28), pantsMat, 0, 0, 0);
    pelvis.scale.set(1.12 * bulk, 0.82, 0.92 * bulk);

    // --- Legs: hip pivot → thigh → knee joint → shin → foot ---
    const legs = {};
    if (!opts.legless) {
      const shoeMat = new THREE.MeshStandardMaterial({ color: 0x24201b, roughness: 0.9 });
      for (const side of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.1 * bulk, -0.02, 0);
        hip.rotation.z = side * 0.03; // slight natural splay
        inner.add(hip);

        // Thigh tapers from hip to knee
        const thigh = M(CAP(0.088 * bulk, 0.26, 8, 30), pantsMat, 0, -0.2, 0, hip);
        thigh.scale.set(1, 1, 0.92);
        // Knee joint
        M(SPH(0.062 * bulk, 20, 16), pantsMat, 0, -0.4, 0.01, hip);
        const knee = new THREE.Group();
        knee.position.set(0, -0.45, 0);
        knee.rotation.x = 0.14;
        hip.add(knee);
        // Shin (thinner than thigh)
        M(CAP(0.058 * bulk, 0.26, 8, 28), pantsMat, 0, -0.18, 0, knee);
        // Ankle + foot (heel block + toe box, angled) — reads as a shoe/foot, not a slab
        M(SPH(0.05 * bulk, 16, 12), skinDark, 0, -0.36, 0, knee);
        const foot = M(new THREE.BoxGeometry(0.1 * bulk, 0.07, 0.2), shoeMat, 0, -0.41, 0.06, knee);
        M(new THREE.BoxGeometry(0.1 * bulk, 0.05, 0.09), shoeMat, 0, -0.42, 0.17, knee); // toe cap
        legs[side < 0 ? 'L' : 'R'] = hip;
      }
    }

    // --- Torso group (hunches forward from the waist) ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.04;
    torsoGroup.rotation.x = hunch;
    torsoGroup.rotation.z = leanZ;
    inner.add(torsoGroup);

    // Waist / abdomen (belly option distends it)
    const abdomen = M(CAP(0.125 * bulk, 0.13, 8, 32), torsoMat, 0, 0.14, 0, torsoGroup);
    abdomen.scale.set(1 + belly * 0.55, 1, 0.92 + belly * 1.0);
    // Ribcage / chest — broader, tapering up to the shoulders
    const chest = M(CAP(0.155 * bulk, 0.22, 8, 34), torsoMat, 0, 0.38, 0, torsoGroup);
    chest.scale.set(1.22, 1, 0.82);
    // Upper-chest / clavicle shelf so shoulders don't float
    M(CAP(0.055 * bulk, 0.28 * bulk, 6, 18), torsoMat, 0, 0.5, 0.02, torsoGroup).rotation.z = Math.PI / 2;
    // Bare-flesh definition on a shirtless torso (sternum line + pec hint)
    if (opts.shirtless) {
      const pec = M(SPH(0.07 * bulk, 18, 14), skinMat, 0, 0.44, 0.09, torsoGroup);
      pec.scale.set(1.5, 0.7, 0.5);
    }

    // Torn shirt hem — ragged strips hanging below the shirt line
    if (!opts.shirtless) {
      for (let i = 0; i < 4; i++) {
        const strip = M(
          new THREE.BoxGeometry(0.05 + Math.random() * 0.04, 0.08 + Math.random() * 0.1, 0.02),
          shirtMat,
          (Math.random() - 0.5) * 0.24 * bulk, -0.02 - Math.random() * 0.04, (Math.random() < 0.5 ? 1 : -1) * 0.11 * bulk,
          torsoGroup
        );
        strip.rotation.x = (Math.random() - 0.5) * 0.4;
      }
      // Collar
      const collar = M(new THREE.TorusGeometry(0.07 * bulk, 0.022, 6, 12), shirtMat, 0, 0.56, 0.01, torsoGroup);
      collar.rotation.x = Math.PI / 2;
    }

    // --- Arms: shoulder pivot → deltoid → upper arm → elbow → forearm → hand ---
    const armPose = opts.armPose ?? 'reach';
    const shoulderY = 0.52, shoulderX = 0.2 * bulk + 0.045;
    const arms = {};
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * shoulderX, shoulderY + (side === dropSide ? -0.03 : 0), 0);
      torsoGroup.add(shoulder);

      // Rounded deltoid at the joint
      M(SPH(0.068 * bulk, 22, 18), sleeveMat, 0, -0.02, 0, shoulder);
      // Upper arm (sleeve or skin), tapering
      const upper = M(CAP(0.05 * bulk, 0.2, 6, 26), sleeveMat, 0, -0.14, 0, shoulder);
      upper.scale.set(1, 1, 0.95);
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.3, 0);
      shoulder.add(elbow);
      // Elbow joint + bare forearm
      M(SPH(0.04 * bulk, 16, 12), skinDark, 0, 0, 0, elbow);
      M(CAP(0.04 * bulk, 0.18, 6, 24), skinMat, 0, -0.12, 0, elbow);
      // Hand: rounded palm + a curled finger mass + thumb (palm is the `hand` ref)
      const hand = M(CAP(0.03, 0.05, 4, 16), skinMat, 0, -0.27, 0.01, elbow);
      const fingers = M(CAP(0.024, 0.045, 3, 10), skinMat, 0, -0.05, 0.02, hand);
      fingers.rotation.x = 0.7; // fingers curl toward the palm
      const thumb = M(CAP(0.011, 0.03, 3, 8), skinMat, 0.03, -0.02, 0.02, hand);
      thumb.rotation.z = 0.6;

      if (armPose === 'reach') {
        shoulder.rotation.x = -1.12 - Math.random() * 0.28;
        shoulder.rotation.z = side * 0.1;
        elbow.rotation.x = -0.28 - Math.random() * 0.22;
      } else if (armPose === 'hang') {
        shoulder.rotation.x = -0.05 + Math.random() * 0.1;
        shoulder.rotation.z = side * 0.14;
        elbow.rotation.x = -0.2 - Math.random() * 0.1;
      }
      shoulder.userData.baseRotX = shoulder.rotation.x;
      arms[side < 0 ? 'L' : 'R'] = { shoulder, elbow, hand };
    }

    // --- Head: neck → skull, sunken gaunt face, nose, ears, hanging jaw ---
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.56;
    headGroup.rotation.x = 0.14 + Math.random() * 0.12; // head droop
    headGroup.rotation.z = headTilt;
    torsoGroup.add(headGroup);

    // Tapered neck (with a tendon hint)
    M(CYL(0.045, 0.062, 0.13, 20), skinMat, 0, 0.02, 0, headGroup);
    // Skull — elongated, slightly narrowed (highest detail: the face reads closest)
    const skull = M(SPH(0.115, 48, 36), skinMat, 0, 0.17, 0.005, headGroup);
    skull.scale.set(0.9, 1.16, 1.02);
    // Brow ridge + gaunt cheekbones
    M(new THREE.BoxGeometry(0.14, 0.03, 0.05), skinMat, 0, 0.2, 0.095, headGroup).rotation.x = 0.15;
    for (const side of [-1, 1]) M(SPH(0.03, 14, 12), skinMat, side * 0.07, 0.14, 0.07, headGroup).scale.set(0.8, 1, 0.6);
    // Jaw underside + hanging lower jaw with a bloodied maw
    M(new THREE.BoxGeometry(0.11, 0.05, 0.1), skinMat, 0, 0.085, 0.03, headGroup);
    const jaw = M(new THREE.BoxGeometry(0.075, 0.035, 0.07), goreMat, 0, 0.05, 0.075, headGroup);
    jaw.rotation.x = 0.5;
    // Teeth
    M(new THREE.BoxGeometry(0.06, 0.014, 0.012), new THREE.MeshStandardMaterial({ color: 0xd8d2b8, roughness: 0.5 }), 0, 0.078, 0.1, headGroup);
    // Nose (small wedge)
    M(new THREE.ConeGeometry(0.022, 0.05, 4), skinMat, 0, 0.135, 0.11, headGroup).rotation.x = Math.PI / 2.2;
    // Ears
    for (const side of [-1, 1]) M(SPH(0.025, 12, 10), skinMat, side * 0.11, 0.16, 0.0, headGroup).scale.set(0.4, 1, 0.7);

    // Sunken eye sockets + milky dead eyes (faint glow keeps them readable at night)
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 1 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: opts.eyeColor ?? 0xcfc9b8,
      emissive: new THREE.Color(opts.eyeColor ?? 0xb8b2a0),
      emissiveIntensity: opts.eyeEmissive ?? 0.35,
      roughness: 0.3
    });
    for (const side of [-1, 1]) {
      const socket = M(SPH(0.032, 14, 12), socketMat, side * 0.045, 0.185, 0.088, headGroup);
      socket.scale.set(1.25, 1.15, 0.7);
      socket.castShadow = false;
      const eye = M(SPH(0.017, 16, 12), eyeMat, side * 0.045, 0.183, 0.1, headGroup);
      eye.castShadow = false;
    }

    // Matted hair (most zombies; some bald)
    if (!opts.bald && Math.random() < 0.72) {
      const hairMat = new THREE.MeshStandardMaterial({
        color: [0x2a221a, 0x161616, 0x4a3a28, 0x555048, 0x6a5a44][Math.floor(Math.random() * 5)],
        roughness: 1
      });
      const hair = M(SPH(0.118, 28, 22), hairMat, 0, 0.22, -0.02, headGroup);
      hair.scale.set(0.98, 0.78, 1.02);
      // A few matted clumps
      for (let i = 0; i < 3; i++) M(CAP(0.012, 0.05, 3, 8), hairMat, rnd(-0.09, 0.09), 0.2, rnd(-0.1, 0.02), headGroup).rotation.set(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4));
    }

    // --- Gore: two-layer wounds (torn rim + dark cavity), blood streaks, smears ---
    const goreCount = opts.gore ?? (2 + Math.floor(Math.random() * 3));
    const wound = (parent, x, y, z, r) => {
      const rim = M(new THREE.SphereGeometry(r, 7, 6), goreMat, x, y, z, parent);
      rim.scale.set(1, 1, 0.4); rim.castShadow = false;
      const cav = M(new THREE.SphereGeometry(r * 0.6, 6, 5), goreDeep, x, y, z + 0.01, parent);
      cav.scale.set(1, 1, 0.35); cav.castShadow = false;
      // Blood streak dripping down from the wound
      if (Math.random() < 0.7) {
        const streak = M(new THREE.BoxGeometry(r * 0.5, rnd(0.06, 0.16), 0.012), goreMat, x, y - r - 0.04, z + 0.005, parent);
        streak.castShadow = false;
      }
    };
    for (let i = 0; i < goreCount; i++) {
      if (Math.random() < 0.75) wound(torsoGroup, (Math.random() - 0.5) * 0.22 * bulk, 0.2 + Math.random() * 0.28, (Math.random() < 0.65 ? 1 : -1) * 0.13 * bulk, rnd(0.03, 0.055));
      else wound(headGroup, (Math.random() - 0.5) * 0.1, 0.12 + Math.random() * 0.1, 0.085, rnd(0.02, 0.035));
    }
    // Blood running from the mouth
    if (Math.random() < 0.6) M(new THREE.BoxGeometry(0.02, rnd(0.05, 0.11), 0.01), goreMat, rnd(-0.02, 0.02), 0.0, 0.1, headGroup).castShadow = false;
    // Bloodied hands (palm + fingers)
    if (Math.random() < 0.6) {
      for (const a of [arms.L, arms.R]) {
        a.hand.material = goreMat;
        a.hand.children.forEach(c => { if (c.isMesh) c.material = goreMat; });
      }
    }

    // Animation hooks: shoulders and hips are the swing pivots
    this._leftArm  = arms.L.shoulder;
    this._rightArm = arms.R.shoulder;
    this._leftLeg  = legs.L ?? null;
    this._rightLeg = legs.R ?? null;
    this._torsoGroup = torsoGroup;
    this._torsoBaseRotX = hunch;

    // Head height (local) above body center — used for headshot detection
    this.headshotY = inner.position.y + 0.56 * s;
    // Health bar floats just above the scaled head
    this._healthBarHeight = inner.position.y + 0.95 * s + 0.25;

    return {
      group,
      refs: {
        root: inner, torsoGroup, headGroup, chest, abdomen, pelvis,
        armL: arms.L, armR: arms.R, legL: legs.L ?? null, legR: legs.R ?? null,
        skull, jaw,
        skinMat, shirtMat, pantsMat, goreMat
      }
    };
  }

  createHealthBar() {
    const barGroup = new THREE.Group();

    // depthWrite:false + renderOrder keeps the three planes layered correctly,
    // while keeping depthTest ON so walls/cars/terrain occlude the bar (it no
    // longer shows through solid geometry).
    // Outer border
    const borderMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthWrite: false });
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.115), borderMat);
    border.renderOrder = 997;
    barGroup.add(border);

    // Dark background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x1a0505, side: THREE.DoubleSide, depthWrite: false })
    );
    bg.position.z = 0.001;
    bg.renderOrder = 998;
    barGroup.add(bg);

    // Health fill bar
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x00ff44, side: THREE.DoubleSide, depthWrite: false })
    );
    fg.position.z = 0.002;
    fg.renderOrder = 999;
    barGroup.add(fg);

    this.healthBarBg = bg;
    this.healthBarFg = fg;

    // Health bars must never absorb bullets
    barGroup.traverse(c => { if (c.isMesh) c.userData.noHit = true; });

    this.game.scene.scene.add(barGroup);
    this.healthBarGroup = barGroup;
  }

  update(deltaTime) {
    // Stun: freeze movement while timer counts down
    if (this.stunned) {
      this.stunTimer = (this.stunTimer ?? 0) - deltaTime;
      if (this.stunTimer <= 0) {
        this.stunned = false;
      } else {
        this.body.velocity.x = 0;
        this.body.velocity.z = 0;
        this.body.velocity.y = 0; // no grounding while stunned — don't let gravity sink them
        this.updateMeshPosition();
        return;
      }
    }

    this.pathRecalcTimer -= deltaTime;
    this.lastAttackTime += deltaTime;

    const player = this.game.player;
    if (!player) return;
    const distToPlayer = this.position.distanceTo(player.getPosition());

    this.updateState(distToPlayer);
    this.updateMovement(deltaTime, player, distToPlayer);
    this.updateMeshPosition();

    this.checkAttack(player, distToPlayer);

    if (this.mesh) this._animate(deltaTime);
  }

  // Skeletal animation. Zombies always move a little — even standing idle they
  // breathe and sway, so they never look like frozen mannequins.
  _animate(deltaTime) {
    // External rigged model: advance its mixer and crossfade to the clip that
    // matches the current state instead of the procedural limb animation.
    if (this._modelMixer) {
      this._modelMixer.update(deltaTime);
      if (this._modelRig?.hasAnim) {
        const clip = this.state === 'idle'      ? 'idle'
                   : this.state === 'attacking' ? 'attack'
                   : (this.speed > 4.2 ? 'run' : 'walk');
        this._modelRig.play(clip);
      }
      return;
    }

    const lArm = this._leftArm, rArm = this._rightArm;
    const lLeg = this._leftLeg, rLeg = this._rightLeg, torso = this._torsoGroup;
    const laB = lArm?.userData?.baseRotX ?? 0, raB = rArm?.userData?.baseRotX ?? 0;
    const llB = lLeg?.userData?.baseRotX ?? 0, rlB = rLeg?.userData?.baseRotX ?? 0;
    const tB  = this._torsoBaseRotX ?? 0;

    if (this.state === 'idle') {
      // Subtle breathing + weight shift so an idle zombie still reads as "alive"
      this._idleTime = (this._idleTime ?? Math.random() * 7) + deltaTime;
      const t = this._idleTime;
      const breathe = Math.sin(t * 1.1);
      const sway = Math.sin(t * 0.7);
      if (lArm) lArm.rotation.x = laB + breathe * 0.05;
      if (rArm) rArm.rotation.x = raB - breathe * 0.05;
      if (lLeg) lLeg.rotation.x = llB;
      if (rLeg) rLeg.rotation.x = rlB;
      if (torso) {
        torso.rotation.z = sway * 0.035;
        torso.rotation.x = tB + breathe * 0.03;
      }
      return;
    }

    // Walking / attacking: alternating gait with a shambling lurch
    this._walkTime += deltaTime * Math.min(this.speed, 4) * 2.0;
    const swing = Math.sin(this._walkTime);
    if (lArm) lArm.rotation.x = laB + swing * 0.32;
    if (rArm) rArm.rotation.x = raB - swing * 0.32;
    if (lLeg) lLeg.rotation.x = llB - swing * 0.85;
    if (rLeg) rLeg.rotation.x = rlB + swing * 0.85;
    if (torso) {
      torso.rotation.z = Math.sin(this._walkTime * 0.5) * 0.08;
      torso.rotation.x = tB + Math.abs(Math.cos(this._walkTime)) * 0.05;
    }
  }

  _canSeePlayer(player, distToPlayer) {
    // Ghillie suit reduces effective aggro range
    const effectiveRange = this.aggroRange * (player?._stealthMult ?? 1.0);
    if (distToPlayer > effectiveRange) return false;
    // At close range (< 3m) always detect
    if (distToPlayer < 3) return true;
    // Vision cone: 150° forward arc
    const toPlayer = new THREE.Vector3(
      player.getPosition().x - this.position.x,
      0,
      player.getPosition().z - this.position.z
    ).normalize();
    // Zombie facing direction from mesh rotation
    const facing = new THREE.Vector3(
      Math.sin(this.mesh?.rotation.y ?? 0),
      0,
      Math.cos(this.mesh?.rotation.y ?? 0)
    );
    const dot = facing.dot(toPlayer);
    return dot > -0.26; // cos(105°) ≈ -0.26 → 210° total FOV
  }

  updateState(distToPlayer) {
    const player = this.game.player;
    switch (this.state) {
      case 'idle':
        if (this._canSeePlayer(player, distToPlayer)) {
          this.state = 'chasing';
          this.pathRecalcTimer = 0;
          // Alert nearby idle zombies (pack behavior)
          if (Math.random() < 0.4) {
            this.game.audioManager?.playZombieGroan?.();
            // Wake nearby zombies — staggered so they don't all start chasing in one frame
            const zombies = this.game.zombieManager?.getZombies() ?? [];
            let alertDelay = 0;
            for (const z of zombies) {
              if (z !== this && z.state === 'idle') {
                const dx = z.position.x - this.position.x;
                const dz = z.position.z - this.position.z;
                if (dx*dx + dz*dz < 100) {
                  setTimeout(() => { z.state = 'chasing'; }, alertDelay);
                  alertDelay += 50;
                }
              }
            }
          }
        }
        break;

      case 'chasing':
        if (distToPlayer > this.aggroRange * 1.5) {
          this.state = 'idle';
          this.currentPath = [];
        } else if (distToPlayer < this.attackRange) {
          this.state = 'attacking';
        }
        break;

      case 'attacking':
        if (distToPlayer > this.attackRange * 2) {
          this.state = 'chasing';
          this.pathRecalcTimer = 0;
        }
        break;
    }

    // Also wake up from noise
    if (this.state === 'idle' && this.game._noiseEvents) {
      for (const evt of this.game._noiseEvents) {
        const dx = evt.x - this.position.x;
        const dz = evt.z - this.position.z;
        if (dx*dx + dz*dz < evt.radius * evt.radius) {
          this.state = 'chasing';
          break;
        }
      }
    }
  }

  updateMovement(deltaTime, player, distToPlayer) {
    // Always sync position from physics so mesh and distance checks stay accurate
    this.position.copy(this.body.position);

    // A leaping zombie (Leaper) keeps its launched velocity and arcs under gravity —
    // skip grounding and steering so the pounce isn't cancelled the same frame.
    if (this._isLeaping) return;

    // Grounding: zombies don't collide with terrain physics (terrain mask is player-only),
    // so pin them to the surface every frame. Cancel gravity so they never sink between
    // frames, and smooth toward the (cached, grid-quantized) terrain height to avoid steps.
    if (!this.game.inFriendHouse) {
      const groundY = this.game.terrainGenerator?.getHeightAt(this.body.position.x, this.body.position.z);
      if (isFinite(groundY)) {
        const targetY = groundY + 0.9;
        const dy = targetY - this.body.position.y;
        // Snap large corrections (spawn, cliffs), smooth small ones (walking slopes)
        this.body.position.y += Math.abs(dy) > 1.5 ? dy : dy * Math.min(1, deltaTime * 12);
        this.body.velocity.y = 0;
      }
    }
    this.position.copy(this.body.position);

    if (this.state === 'idle') {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      return;
    }

    if (this.state === 'chasing') {
      // Outdoors: skip A* entirely — open terrain needs no pathfinding
      if (!this.game.inFriendHouse) {
        this.currentPath = [];
      } else if (this.pathRecalcTimer <= 0) {
        const playerPos = player.getPosition();
        this.currentPath = this.pathfinder.findPath(
          this.position.x,
          this.position.z,
          playerPos.x,
          playerPos.z,
          this.game.terrainGenerator
        );
        this.pathIndex = 0;
        this.pathRecalcTimer = this.pathRecalcInterval;
      }

      if (this.currentPath.length > 0) {
        const targetNode = this.currentPath[Math.min(this.pathIndex, this.currentPath.length - 1)];
        const dirX = targetNode[0] - this.position.x;
        const dirZ = targetNode[1] - this.position.z;
        const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);

        if (dist < 2) {
          this.pathIndex++;
        }

        if (dist > 0) {
          const normalX = dirX / dist;
          const normalZ = dirZ / dist;
          this.body.velocity.x = normalX * this.speed;
          this.body.velocity.z = normalZ * this.speed;
        }
      } else {
        // Flare distraction: walk to flare, mill about on arrival, resume chase when flare expires
        const target = this._flareTarget ?? player.getPosition();
        const dirX = target.x - this.position.x;
        const dirZ = target.z - this.position.z;
        const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);

        if (this._flareTarget && dist < 2.0) {
          // Arrived at flare — wander slowly in place
          const wt = performance.now() / 1000;
          this.body.velocity.x = Math.sin(wt * 1.3 + this.position.x) * this.speed * 0.25;
          this.body.velocity.z = Math.cos(wt * 0.9 + this.position.z) * this.speed * 0.25;
        } else if (dist > 0) {
          this.body.velocity.x = (dirX / dist) * this.speed;
          this.body.velocity.z = (dirZ / dist) * this.speed;
        }
      }
    } else if (this.state === 'attacking') {
      const playerPos = player.getPosition();
      const dirX = playerPos.x - this.position.x;
      const dirZ = playerPos.z - this.position.z;
      const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);

      if (dist > this.attackRange * 0.5) {
        if (dist > 0) {
          this.body.velocity.x = (dirX / dist) * (this.speed * 0.5);
          this.body.velocity.z = (dirZ / dist) * (this.speed * 0.5);
        }
      } else {
        this.body.velocity.x = 0;
        this.body.velocity.z = 0;
      }
    }

    // Night speed multiplier — applied here so it stacks with (never overwrites)
    // any ability that changed this.speed. Idle already returned above.
    const nm = this._nightMult ?? 1;
    if (nm !== 1) { this.body.velocity.x *= nm; this.body.velocity.z *= nm; }
  }

  checkAttack(player, distToPlayer) {
    if (this.state === 'attacking' && distToPlayer < this.attackRange && this.lastAttackTime >= this.attackCooldown) {
      if (player.health - this.damage <= 0 && player.setDeathCause) {
        const name = this.displayName();
        player.setDeathCause(`Killed by ${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`);
      }
      player.takeDamage(this.damage, this.position);
      this.game.audioManager?.resume?.();
      this.game.audioManager?.playZombieHit?.();

      // Knockback: push player away from zombie
      if (player.body) {
        const dx = player.getPosition().x - this.position.x;
        const dz = player.getPosition().z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
        player.body.velocity.x += (dx / dist) * 4;
        player.body.velocity.z += (dz / dist) * 4;
        player.body.velocity.y = Math.max(player.body.velocity.y, 2.5);
      }

      // Chance to apply status effects (not while damage is blocked entirely)
      if (player.godMode || player.spawnProtectionTime > 0) { this.lastAttackTime = 0; return; }
      if (!this._notifEl) this._notifEl = document.getElementById('loot-notification');
      const notifEl = this._notifEl;
      if (Math.random() < 0.15 && !player._infected && !player._immuneInfect) {
        player._infected = true;
        player._infectTimer = 0;
        if (notifEl) { notifEl.textContent = '⚠ Infected!'; notifEl.style.color='#44ff44'; notifEl.classList.remove('show'); void notifEl.offsetWidth; notifEl.classList.add('show'); }
      } else if (Math.random() < 0.20 && !player._bleeding) {
        player._bleeding = true;
        player._bleedTimer = 12;
        if (notifEl) { notifEl.textContent = '🩸 Bleeding!'; notifEl.style.color='#ff3333'; notifEl.classList.remove('show'); void notifEl.offsetWidth; notifEl.classList.add('show'); }
      }
      this.lastAttackTime = 0;
    }
  }

  updateMeshPosition() {
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      const vx = this.body?.velocity?.x ?? 0;
      const vz = this.body?.velocity?.z ?? 0;
      if (vx * vx + vz * vz > 0.5) {
        // Smoothly interpolate rotation to avoid snapping
        const targetY = Math.atan2(vx, vz);
        const diff = targetY - this.mesh.rotation.y;
        // Wrap to [-PI, PI]
        const wrap = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        this.mesh.rotation.y += wrap * 0.18;
      }
    }

    if (this.healthBarGroup) {
      // Position above zombie head, billboard toward camera — no per-frame clone
      this.healthBarGroup.position.set(this.position.x, this.position.y + (this._healthBarHeight ?? 2.2), this.position.z);

      // Billboard: copy camera quaternion so bar always faces player
      const camera = this.game.scene.getCamera();
      this.healthBarGroup.quaternion.copy(camera.quaternion);

      // Shrink the bar when the zombie is close so a point-blank attacker's bar
      // doesn't balloon into a giant slab across the screen. Natural size at range.
      const camDist = camera.position.distanceTo(this.healthBarGroup.position);
      const barScale = Math.min(1, Math.max(0.22, camDist / 6.5));
      this.healthBarGroup.scale.setScalar(barScale);
      // Hide entirely at full health until first damaged (less HUD clutter)
      this.healthBarGroup.visible = camDist < 45 && this.health < this.maxHealth;

      // Scale foreground to show current health ratio
      const ratio = Math.max(0, Math.min(1, this.health / this.maxHealth));
      this.healthBarFg.scale.x = ratio;
      this.healthBarFg.position.x = (ratio - 1) * 0.4;
      // Color: green → yellow → red as health drops
      if (ratio > 0.5) {
        this.healthBarFg.material.color.setRGB(2 - ratio * 2, 1, 0);
      } else {
        this.healthBarFg.material.color.setRGB(1, ratio * 2, 0);
      }
    }
  }

  takeDamage(amount, isHeadshot = false) {
    // HordeMaster aura grants nearby zombies a damage-reduction buff (_dmgReduction).
    const mitigated = amount * (1 - (this._dmgReduction ?? 0));
    // Headshot: 2.5x damage and instant stagger
    const finalAmount = isHeadshot ? mitigated * 2.5 : mitigated;
    this.health -= finalAmount;

    if (isHeadshot && this.game.triggerHitmarker) {
      this.game.triggerHitmarker();
      if (!this._hitmarkerEl) this._hitmarkerEl = document.getElementById('hitmarker');
      if (!this._notifEl)    this._notifEl    = document.getElementById('loot-notification');
      if (this._hitmarkerEl) { this._hitmarkerEl.style.color = '#ffdd00'; setTimeout(() => { this._hitmarkerEl.style.color = ''; }, 200); }
      if (this._notifEl) { this._notifEl.textContent = '💀 HEADSHOT!'; this._notifEl.style.color = '#ffdd00'; this._notifEl.classList.remove('show'); void this._notifEl.offsetWidth; this._notifEl.classList.add('show'); }
    }

    // Hit flash: tint all mesh materials red — track timer so it clears if zombie dies
    if (this.mesh && !this._dead) {
      clearTimeout(this._hitFlashTimer);
      this._hitFlashColors = this._hitFlashColors ?? [];
      if (!this._hitFlashing) {
        this._hitFlashColors = [];
        const seen = new Set(); // materials are shared across meshes — record each once
        this.mesh.traverse(child => {
          if (child.isMesh && child.material && !seen.has(child.material)) {
            seen.add(child.material);
            this._hitFlashColors.push({ mat: child.material, hex: child.material.color.getHex() });
            child.material.color.set(0xff2222);
          }
        });
        this._hitFlashing = true;
      }
      this._hitFlashTimer = setTimeout(() => {
        this._hitFlashing = false;
        if (this._hitFlashColors) {
          for (const { mat, hex } of this._hitFlashColors) {
            if (mat && !mat.disposed) mat.color.setHex(hex);
          }
          this._hitFlashColors = [];
        }
      }, 80);
    }

    // Floating damage number
    this._spawnDamageNumber(Math.round(finalAmount), isHeadshot);

    if (this.health <= 0 && !this._dead) {
      this.die();
    }
  }

  _spawnDamageNumber(amount, isHeadshot = false) {
    const camera = this.game.scene.getCamera();
    const w3 = this.position.clone();
    w3.y += 2;
    w3.project(camera);
    if (w3.z >= 1) return; // behind camera

    const sx = (w3.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-w3.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    const isCrit = isHeadshot || amount > 50;
    el.className = 'dmg-number' + (isCrit ? ' crit' : '');
    el.textContent = (isCrit ? '💥' : '') + `-${amount}`;
    // Randomize horizontal drift slightly
    const dx = (Math.random() - 0.5) * 30;
    el.style.left = (sx + dx) + 'px';
    el.style.top  = sy + 'px';
    if (isCrit) el.style.setProperty('--drift', dx + 'px');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  die() {
    if (this._dead) return;
    this._dead = true;

    // Clear any pending timers to avoid callbacks on dead zombie
    clearTimeout(this._hitFlashTimer);
    this._hitFlashing = false;
    this._hitFlashColors = [];

    // Notify game of kill
    if (this.game.onZombieKilled) {
      this.game.onZombieKilled(this);
    }

    // Register corpse for Necromancer resurrection tracking
    if (this.mesh) {
      if (!this.game._deadZombieCorpses) this.game._deadZombieCorpses = [];
      this.game._deadZombieCorpses.push(this);
    }

    // Blood particles + a persistent pool on the ground where it fell
    if (this.game.particleSystem) {
      this.game.particleSystem.createBlood(this.position.clone(), 15);
      const gx = this.position.x, gz = this.position.z;
      const gy = this.game.inFriendHouse
        ? this.position.y - 0.85
        : (this.game.terrainGenerator?.getHeightAt(gx, gz) ?? this.position.y - 0.85);
      const poolR = 0.7 * (this._healthBarHeight ? Math.max(0.8, this._healthBarHeight / 2.5) : 1);
      this.game.particleSystem.createBloodDecal?.({ x: gx, y: gy, z: gz }, poolR);
    }

    // Remove health bar immediately
    if (this.healthBarGroup) {
      this.game.scene.scene.remove(this.healthBarGroup);
      this.healthBarGroup = null;
    }

    // Remove physics body now so no more collisions
    if (this.body) {
      this.game.physicsWorld.removeBody(this.body);
      this.body = null;
    }

    // Death fall animation: tip zombie over 0.5s before removing mesh
    if (this.mesh) {
      const mesh = this.mesh;
      this.mesh = null; // prevent updateMeshPosition from touching it
      this._corpseMesh = mesh; // kept so a Necromancer can revive this corpse
      const startRot = mesh.rotation.z;
      const targetRot = (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      const startY = mesh.position.y;
      let t = 0;
      const duration = 0.4;
      const tick = (dt) => {
        if (!this._dead) return; // resurrected — stop the fall animation
        t += dt;
        const p = Math.min(t / duration, 1);
        const ease = 1 - (1 - p) * (1 - p);
        mesh.rotation.z = startRot + (targetRot - startRot) * ease;
        mesh.position.y = startY - ease * 0.6;
        if (p < 1) {
          this._deathTickId = requestAnimationFrame(() => tick(0.016));
        } else {
          // Fade out instead of instant removal
          let fadeT = 0;
          mesh.traverse(c => { if (c.isMesh) c.castShadow = false; }); // no solid shadow while fading
          const fadeTick = () => {
            if (!this._dead) return; // resurrected mid-fade — abort removal
            fadeT += 0.016;
            const opacity = Math.max(0, 1 - fadeT / 1.5);
            mesh.traverse(c => {
              if (c.isMesh && c.material) {
                c.material.transparent = true;
                c.material.opacity = opacity;
              }
            });
            if (fadeT < 1.5) {
              this._deathTickId = requestAnimationFrame(fadeTick);
            } else {
              this.game.scene.removeObject(mesh);
              // Free GPU resources and drop the corpse reference so memory doesn't grow forever
              this._corpseMesh = null;
              this._corpseDisposed = true;
              // Stop the animation mixer (model zombies/hound) so it stops pinning
              // the skeleton once the corpse is gone.
              this._modelRig?.stop?.();
              this._modelMixer = null;
              const seen = new Set();
              mesh.traverse(c => {
                if (c.isMesh) {
                  c.geometry?.dispose?.();
                  // Skinned rigs (model zombies/hound) get a per-skeleton GPU bone
                  // texture in r165 — free it, or every dead model-zombie leaks one.
                  if (c.isSkinnedMesh) c.skeleton?.dispose?.();
                  const mats = Array.isArray(c.material) ? c.material : [c.material];
                  for (const m of mats) { if (m && !seen.has(m)) { seen.add(m); m.dispose?.(); } }
                }
              });
              const corpses = this.game._deadZombieCorpses;
              const ci = corpses ? corpses.indexOf(this) : -1;
              if (ci >= 0) corpses.splice(ci, 1);
            }
          };
          // Wait 10 seconds before starting fade (give player time to loot)
          this._fadeTimeoutId = setTimeout(() => { this._deathTickId = requestAnimationFrame(fadeTick); }, 10000);
        }
      };
      tick(0);
    }

    // Drop loot
    this.dropLoot();
  }

  // Bring a corpse back to life (Necromancer). Restores the kept corpse mesh,
  // rebuilds physics with the correct collision filters, and re-registers state.
  // Returns false if the corpse has already faded away and been disposed.
  revive(healthFrac = 0.5) {
    if (!this._dead) return false;
    const mesh = this._corpseMesh;
    if (!mesh || this._corpseDisposed) return false;

    clearTimeout(this._fadeTimeoutId);
    cancelAnimationFrame(this._deathTickId);

    this._dead = false;
    this.health = Math.ceil(this.maxHealth * healthFrac);
    this.state = 'chasing';
    this.pathRecalcTimer = 0;

    // Stand the corpse back up and restore opacity (Phantoms keep their base translucency)
    mesh.rotation.z = 0;
    const baseOpacity = this._baseOpacity ?? 1;
    mesh.traverse(c => {
      if (c.isMesh && c.material) {
        c.material.opacity = baseOpacity;
        c.material.transparent = baseOpacity < 1;
        c.castShadow = true;   // die()'s fade disabled it — restore for the revived zombie
      }
    });
    this.mesh = mesh;
    this._corpseMesh = null;

    // die() removed the body — rebuild it (setupPhysics applies group/mask filters)
    if (!this.body) this.setupPhysics();
    this.body.position.copy(this.position);

    if (!this.healthBarGroup) this.createHealthBar();

    const corpses = this.game._deadZombieCorpses;
    const ci = corpses ? corpses.indexOf(this) : -1;
    if (ci >= 0) corpses.splice(ci, 1);

    // Fresh mesh in the scene — make it shootable immediately
    this.game._raycastTargetTime = 0;
    return true;
  }

  dropLoot() {
    const realWi = this.game.worldItemSystem;
    if (!realWi) return;
    const px = this.position.x, pz = this.position.z;
    const py = (this.game.terrainGenerator?.getHeightAt(px, pz) ?? this.position.y) + 0.12;
    const roll = Math.random();
    // Zombie drops must not respawn after pickup (house loot does; drops giving
    // free ammo twice more at the kill spot is an exploit)
    const wi = {
      spawnItem: (type, x, y, z, qty) => {
        const item = realWi.spawnItem(type, x, y, z, qty);
        if (item) item.respawnsLeft = 0;
        return item;
      }
    };

    if (roll < 0.28) {
      // Ammo drop
      const ammoTypes = [
        { type:'ammo_9mm',          qty:[6,14] },
        { type:'ammo_556',          qty:[8,18] },
        { type:'ammo_12gauge_buck', qty:[4,8]  },
        { type:'ammo_308',          qty:[3,8]  },
        { type:'ammo_762',          qty:[5,12] },
      ];
      const pick = ammoTypes[Math.floor(Math.random()*ammoTypes.length)];
      const qty  = pick.qty[0] + Math.floor(Math.random()*(pick.qty[1]-pick.qty[0]+1));
      wi.spawnItem(pick.type, px, py, pz, qty);

    } else if (roll < 0.44) {
      // Consumable drop
      const items = [
        'bandage','food_canned_beans','food_canned_soup','med_gauze',
        'food_chips','food_crackers','food_mushroom','food_berry',
        'drink_purified_water','med_vitamins',
        'food_jerky','food_hardtack','drink_coconut_water','drink_rain_water',
      ];
      wi.spawnItem(items[Math.floor(Math.random()*items.length)], px, py, pz, 1);

    } else if (roll < 0.52) {
      // Medical drop
      const med = [
        'medical_kit','med_antibiotics','med_morphine','bandage','med_suture_kit',
        'med_epipen','med_splint',
      ];
      wi.spawnItem(med[Math.floor(Math.random()*med.length)], px, py, pz, 1);

    } else if (roll < 0.56) {
      // Rare weapon drop (only Tank and Screamer types)
      if (this.type === 'tank' || this.type === 'screamer') {
        const weapons = ['weapon_pistol_found','weapon_smg_found','weapon_rifle_found'];
        wi.spawnItem(weapons[Math.floor(Math.random()*weapons.length)], px, py, pz, 1);
      } else {
        wi.spawnItem('bandage', px, py, pz, 1);
      }

    } else if (roll < 0.59) {
      // Crafting material
      const mats = [
        'mat_duct_tape','mat_super_glue','mat_nails','rope','mat_battery','mat_wire',
        'mat_gunpowder','mat_charcoal','mat_saltpeter','mat_circuit_board','mat_kevlar_shred',
      ];
      wi.spawnItem(mats[Math.floor(Math.random()*mats.length)], px, py, pz, 1);

    } else if (roll < 0.62) {
      // Rare electronics drop (boss-tier zombies more likely to carry these)
      const elite = this.type === 'tank' || this.type === 'horde_master' || this.type === 'necromancer';
      if (elite) {
        const elec = ['elec_emp_grenade','elec_tracker','elec_stun_baton','explosive_flash_bang'];
        wi.spawnItem(elec[Math.floor(Math.random()*elec.length)], px, py, pz, 1);
      } else {
        wi.spawnItem('mat_circuit_board', px, py, pz, 1);
      }

    } else if (roll < 0.66) {
      // Gear drop (boss types only)
      const isBoss = this.type === 'tank' || this.type === 'horde_master' || this.type === 'necromancer'
                  || this.type === 'juggernaut' || this.type === 'armored';
      if (isBoss) {
        const gear = ['gear_gas_mask','gear_flare','explosive_smoke_grenade','trap_bear_trap'];
        wi.spawnItem(gear[Math.floor(Math.random()*gear.length)], px, py, pz, 1);
      } else {
        wi.spawnItem('mat_nails', px, py, pz, Math.floor(Math.random()*4+2));
      }
    }
    // ~34%: no drop
  }

  getPosition() {
    return this.position.clone();
  }

  isAlive() {
    return !this._dead && this.health > 0;
  }

  // Human-readable name for HUD / death screen / kill feed
  displayName() {
    return zombieDisplayName(this.type);
  }
}
