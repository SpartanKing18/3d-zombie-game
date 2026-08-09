import * as THREE from 'three';

export class Scene {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.skyMesh = null;
    this.skyUniforms = null;

    this.setupRenderer();
    this.setupCamera();
    this.setupSky();
    this.setupStars();
    this.setupLights();
    this.setupClouds();
    this.setupEventListeners();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // softer, less jagged contact shadows
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(0x000000, 1);
    this.scene.fog = new THREE.FogExp2(0x8aadcc, 0.0005);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.05,
      8000
    );
    this.camera.position.set(0, 2, 0);
  }

  setupSky() {
    // Gradient sky sphere using a shader
    const skyGeo = new THREE.SphereGeometry(4000, 32, 15);

    this.skyUniforms = {
      topColor:      { value: new THREE.Color(0x0a1a3a) },
      horizonColor:  { value: new THREE.Color(0x4a7a9b) },
      groundColor:   { value: new THREE.Color(0x1a2a1a) },
      sunDirection:  { value: new THREE.Vector3(0, 1, 0) },
      sunColor:      { value: new THREE.Color(0xfff4cc) },
      sunStrength:   { value: 1.0 },
      moonDirection:  { value: new THREE.Vector3(0, -1, 0) },
      moonStrength:   { value: 0.0 },
      offset:         { value: 300 },
      exponent:       { value: 0.4 },
      uTime:          { value: 0.0 },
      uStormStrength: { value: 0.0 }
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        uniform float sunStrength;
        uniform vec3 moonDirection;
        uniform float moonStrength;
        uniform float offset;
        uniform float exponent;
        uniform float uTime;
        uniform float uStormStrength;
        varying vec3 vWorldPosition;

        // Cheap hash-based value noise for cloud wisps
        float hash(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1,0)), f.x),
            mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
            f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.2; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          vec3 offsetPos = vWorldPosition + vec3(offset);
          float hLen = length(offsetPos);
          float h = hLen > 0.001 ? offsetPos.y / hLen : 0.0;

          // Sky gradient: zenith → horizon → ground
          vec3 skyColor;
          if (h > 0.0) {
            float t = pow(max(h, 0.0), exponent);
            skyColor = mix(horizonColor, topColor, t);
          } else {
            skyColor = mix(horizonColor, groundColor, pow(clamp(-h * 2.0, 0.0, 1.0), 0.5));
          }

          // Sun disc + soft limb darkening
          vec3 sunDir = normalize(sunDirection);
          float sunDot  = dot(dir, sunDir);
          float sunDisc = smoothstep(0.9985, 0.9998, sunDot);
          float limbDark = 1.0 - (1.0 - smoothstep(0.9985, 0.9998, sunDot)) * 0.4;
          float sunGlow  = pow(max(sunDot, 0.0), 96.0) * 0.65 * sunStrength;
          float sunHalo  = pow(max(sunDot, 0.0), 12.0) * 0.22 * sunStrength;
          float mie = pow(max(sunDot, 0.0), 4.0) * 0.08 * sunStrength * (1.0 - clamp(h * 3.0, 0.0, 1.0));
          skyColor += sunColor * (sunDisc * limbDark * 3.5 + sunGlow + sunHalo + mie);

          // Horizon atmospheric scattering
          float horizonBand = exp(-abs(h) * 5.0) * 0.22;
          skyColor += horizonColor * horizonBand;

          // Sunrise / sunset warm band: glows orange-red near horizon when sun is low
          float duskT = smoothstep(0.35, -0.05, sunDir.y) * smoothstep(-0.18, 0.25, sunDir.y);
          if (duskT > 0.0 && sunStrength > 0.05) {
            float warmBand = exp(-abs(h) * 9.0);
            warmBand = clamp(warmBand * (1.0 - abs(h) * 3.0), 0.0, 1.0);
            // Colour shifts: deep red near horizon, amber higher up
            vec3 sunriseCol = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.55, 0.12), clamp(h * 8.0, 0.0, 1.0));
            // Brighter where the sun is (azimuth aligned)
            vec2 dirXZ = normalize(vec2(dir.x, dir.z) + 0.001);
            vec2 sunXZ = normalize(vec2(sunDir.x, sunDir.z) + 0.001);
            float azimuthFocus = pow(max(dot(dirXZ, sunXZ), 0.0), 3.0);
            skyColor = mix(skyColor, sunriseCol, warmBand * duskT * (0.45 + 0.35 * azimuthFocus) * sunStrength);
          }

          // Anti-sun subtle glow
          float antiSunDot = dot(dir, -sunDir);
          float antiGlow = pow(max(antiSunDot, 0.0), 6.0) * 0.04 * sunStrength;
          skyColor += vec3(0.2, 0.3, 0.5) * antiGlow;

          // Moon disc — silvery white, slightly blue, smaller than sun
          vec3 moonDir = normalize(moonDirection);
          float moonDot  = dot(dir, moonDir);
          float moonDisc = smoothstep(0.9993, 0.9999, moonDot);
          float moonLimb = 1.0 - (1.0 - smoothstep(0.9993, 0.9999, moonDot)) * 0.25;
          float moonGlow = pow(max(moonDot, 0.0), 54.0) * 0.18 * moonStrength;
          float moonHalo = pow(max(moonDot, 0.0), 9.0)  * 0.07 * moonStrength;
          // Corona ring around moon: broader diffuse band
          float moonCorona = pow(max(moonDot, 0.0), 5.0) * 0.04 * moonStrength * (1.0 - clamp(h * 2.0, 0.0, 1.0));
          skyColor += vec3(0.88, 0.93, 1.0) * (moonDisc * moonLimb * 2.5 + moonGlow + moonHalo) * moonStrength;
          skyColor += vec3(0.6, 0.7, 1.0) * moonCorona;

          // Wispy cirrus clouds near horizon (only daytime / twilight)
          if (h > 0.02 && h < 0.45 && sunStrength > 0.1) {
            float driftSpeed = mix(0.004, 0.009, uStormStrength);
            vec2 uv = vec2(atan(dir.x, dir.z) * 0.8, h * 6.0);
            uv.x += uTime * driftSpeed;
            float cloud = fbm(uv * 2.5 + 0.6) - 0.38;
            cloud = clamp(cloud * 3.0, 0.0, 1.0);
            float cloudAlpha = cloud * smoothstep(0.45, 0.08, h) * sunStrength * 0.55;
            vec3 cloudColor = mix(vec3(0.82, 0.86, 0.95), vec3(1.0, 0.96, 0.88), 1.0 - sunStrength);
            skyColor = mix(skyColor, cloudColor, cloudAlpha);
          }

          // Heavy storm overcast: thick dark clouds covering sky
          if (uStormStrength > 0.0 && h > 0.0) {
            vec2 suv = vec2(atan(dir.x, dir.z) * 0.5, h * 3.5);
            suv.x += uTime * 0.012;
            float stormCloud = fbm(suv * 1.8) * fbm(suv * 3.5 + 1.7);
            stormCloud = smoothstep(0.18, 0.55, stormCloud);
            vec3 stormColor = mix(vec3(0.22, 0.24, 0.30), vec3(0.14, 0.16, 0.22), fbm(suv * 6.0));
            float stormAlpha = stormCloud * uStormStrength * smoothstep(0.0, 0.12, h);
            skyColor = mix(skyColor, stormColor, stormAlpha);
            // Overall sky darkening
            skyColor *= mix(1.0, 0.45, uStormStrength * 0.7);
          }

          gl_FragColor = vec4(skyColor, 1.0);
        }
      `,
      side: THREE.BackSide
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
  }

  setupStars() {
    const starCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const brightnesses = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Random point on upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9); // bias toward top
      const r = 3800;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      brightnesses[i] = 0.4 + Math.random() * 0.6;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));

    this._starTimeUniform = { value: 0.0 };
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    this._starTimeUniform,
        uOpacity: { value: 0.0 },
      },
      vertexShader: `
        attribute float brightness;
        varying float vBrightness;
        void main() {
          vBrightness = brightness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 1.5 + brightness * 2.0;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying float vBrightness;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float soft = 1.0 - smoothstep(0.2, 0.5, d);
          float twinkle = 0.72 + 0.28 * sin(uTime * (2.0 + vBrightness * 1.2) + vBrightness * 12.566);
          gl_FragColor = vec4(vec3(0.9 + vBrightness * 0.1, 0.93, 1.0), vBrightness * twinkle * soft * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.stars = new THREE.Points(geometry, starMaterial);
    this.scene.add(this.stars);
  }

  setupLights() {
    // Hemisphere for realistic sky/ground ambient
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x2a1a0a, 0.5);
    this.scene.add(this.hemiLight);

    // Main sun (directional)
    this.sunLight = new THREE.DirectionalLight(0xfffaee, 2.0);
    this.sunLight.position.set(200, 300, 100);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.left = -120;
    this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top = 120;
    this.sunLight.shadow.camera.bottom = -120;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.03;
    this.scene.add(this.sunLight);
    // Target must be in the scene graph so DayNightCycle can move the shadow
    // frustum to follow the player (otherwise shadows only exist near the origin).
    this.scene.add(this.sunLight.target);

    // Blue sky fill from opposite side
    const fillLight = new THREE.DirectionalLight(0x8ab4cc, 0.4);
    fillLight.position.set(-150, 100, -100);
    this.scene.add(fillLight);

    this.directionalLight = this.sunLight;
  }

  // Called by DayNightCycle to update sky colors — no per-frame allocations
  setSkyTime(t) {
    if (!this.skyUniforms) return;

    // Cached color palette instances
    if (!this._skyPalette) {
      this._skyPalette = {
        day:   { top: new THREE.Color(0x0a2a6a), horizon: new THREE.Color(0x6aadcc), ground: new THREE.Color(0x2a1a0a) },
        dusk:  { top: new THREE.Color(0x200a30), horizon: new THREE.Color(0xee7722), ground: new THREE.Color(0x1a1a10) },
        night: { top: new THREE.Color(0x020510), horizon: new THREE.Color(0x0a1520), ground: new THREE.Color(0x050a05) },
        _tmp:  { top: new THREE.Color(), horizon: new THREE.Color(), ground: new THREE.Color() },
      };
    }
    const { day, dusk, night, _tmp } = this._skyPalette;

    if (t < 0.2 || t > 0.85) {
      _tmp.top.copy(night.top); _tmp.horizon.copy(night.horizon); _tmp.ground.copy(night.ground);
      if (this.sunLight) this.sunLight.intensity = 0.05;
      if (this.hemiLight) { this.hemiLight.intensity = 0.1; this.hemiLight.color.set(0x1a2a4a); }
    } else if (t < 0.3 || t > 0.75) {
      const f = t < 0.3 ? (t - 0.2) / 0.1 : (0.85 - t) / 0.1;
      _tmp.top.copy(night.top).lerp(dusk.top, f);
      _tmp.horizon.copy(night.horizon).lerp(dusk.horizon, f);
      _tmp.ground.copy(night.ground).lerp(dusk.ground, f);
      if (this.sunLight) this.sunLight.intensity = f * 1.5;
      if (this.hemiLight) this.hemiLight.intensity = 0.1 + f * 0.3;
    } else if (t < 0.4 || t > 0.65) {
      const f = t < 0.4 ? (t - 0.3) / 0.1 : (0.75 - t) / 0.1;
      _tmp.top.copy(dusk.top).lerp(day.top, f);
      _tmp.horizon.copy(dusk.horizon).lerp(day.horizon, f);
      _tmp.ground.copy(dusk.ground).lerp(day.ground, f);
      if (this.sunLight) this.sunLight.intensity = 1.5 + f * 0.5;
      if (this.hemiLight) this.hemiLight.intensity = 0.4 + f * 0.1;
    } else {
      _tmp.top.copy(day.top); _tmp.horizon.copy(day.horizon); _tmp.ground.copy(day.ground);
      if (this.sunLight) this.sunLight.intensity = 2.0;
      if (this.hemiLight) { this.hemiLight.intensity = 0.5; this.hemiLight.color.set(0x87ceeb); }
    }

    this.skyUniforms.topColor.value.copy(_tmp.top);
    this.skyUniforms.horizonColor.value.copy(_tmp.horizon);
    this.skyUniforms.groundColor.value.copy(_tmp.ground);
    this.scene.fog.color.copy(_tmp.horizon);

    // Sun direction: elevates at noon, sinks at dawn/dusk
    if (this.skyUniforms.sunDirection && this.sunLight) {
      this.skyUniforms.sunDirection.value.copy(this.sunLight.position).normalize();
      const sunEl = this.sunLight.position.y > 0 ? 1 : 0;
      this.skyUniforms.sunStrength.value = Math.max(0, sunEl) * (this.sunLight.intensity / 2.0);
      // Sun color: white at noon, orange at dawn/dusk
      if (t < 0.38 || t > 0.63) this.skyUniforms.sunColor.value.set(0xff8833);
      else this.skyUniforms.sunColor.value.set(0xfff4cc);
    }

    // Tint clouds: white at day, orange at dawn/dusk, dim at night
    if (this.cloudGroup) {
      let cloudColor, cloudOpacity;
      if (t < 0.2 || t > 0.85) { cloudColor = 0x1a2030; cloudOpacity = 0.3; }
      else if (t < 0.35 || t > 0.7) { cloudColor = 0xee8833; cloudOpacity = 0.7; }
      else { cloudColor = 0xffffff; cloudOpacity = 0.82; }
      this.cloudGroup.children.forEach(cluster => {
        cluster.children.forEach(blob => {
          blob.material.color.set(cloudColor);
          blob.material.opacity = cloudOpacity;
        });
      });
    }

    // Stars: visible at night, fade at dawn/dusk and near bright moon
    if (this.stars) {
      let starOpacity = 0;
      if (t < 0.2 || t > 0.85) starOpacity = 0.9;
      else if (t < 0.28) starOpacity = 0.9 * (1 - (t - 0.2) / 0.08);
      else if (t > 0.77) starOpacity = 0.9 * ((t - 0.77) / 0.08);
      const moonStr = this.skyUniforms?.moonStrength?.value ?? 0;
      starOpacity *= (1.0 - moonStr * 0.55);
      this.stars.material.uniforms.uOpacity.value = starOpacity;
    }

    // Moon: opposite direction from sun, visible at night
    if (this.skyUniforms.moonDirection && this.sunLight) {
      const su = this.skyUniforms;
      su.moonDirection.value.copy(this.sunLight.position).negate().normalize();
      const isMoonUp = su.moonDirection.value.y > 0;
      const nightDepth = Math.max(0, -this.sunLight.position.y / 300);
      su.moonStrength.value = isMoonUp ? Math.min(1.0, nightDepth * 1.4) : 0.0;
    }
  }

  updateStars(dt) {
    if (this._starTimeUniform) this._starTimeUniform.value += dt;
    if (this.skyUniforms?.uTime) this.skyUniforms.uTime.value += dt;
  }

  setStormStrength(strength) {
    if (this.skyUniforms?.uStormStrength) {
      this.skyUniforms.uStormStrength.value = Math.max(0, Math.min(1, strength));
    }
  }

  setupClouds() {
    this.cloudGroup = new THREE.Group();
    // MeshBasicMaterial: no lighting calculation — much cheaper than Standard
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });

    const rand = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 20; i++) {  // 20 clusters instead of 60
      const cluster = new THREE.Group();
      const blobCount = 3 + Math.floor(Math.random() * 3); // 3-5 blobs
      for (let b = 0; b < blobCount; b++) {
        const rx = rand(18, 40), ry = rand(8, 16), rz = rand(14, 30);
        const geo = new THREE.SphereGeometry(1, 5, 4); // 5×4 segments instead of 7×5
        const blob = new THREE.Mesh(geo, cloudMat);
        blob.scale.set(rx, ry, rz);
        blob.position.set(rand(-rx, rx), rand(-ry * 0.3, ry * 0.3), rand(-rz, rz));
        cluster.add(blob);
      }
      cluster.position.set(rand(-1800, 1800), rand(160, 260), rand(-1800, 1800));
      cluster.rotation.y = Math.random() * Math.PI * 2;
      this.cloudGroup.add(cluster);
    }
    this.scene.add(this.cloudGroup);
  }

  updateClouds(deltaTime) {
    if (!this.cloudGroup) return;
    this.cloudGroup.children.forEach((cluster, i) => {
      cluster.position.x += deltaTime * (0.8 + (i % 4) * 0.3);
      if (cluster.position.x > 1800) cluster.position.x = -1800;
    });
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  addObject(object) { this.scene.add(object); }
  removeObject(object) { this.scene.remove(object); }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getSkyColor() {
    return this.skyUniforms ? this.skyUniforms.horizonColor.value.getHex() : 0x87ceeb;
  }

  setSkyColor(color) {
    if (this.skyUniforms) {
      const c = new THREE.Color(color);
      this.skyUniforms.horizonColor.value.copy(c);
    }
  }

  getScene() { return this.scene; }
  getCamera() { return this.camera; }
  getRenderer() { return this.renderer; }
}
