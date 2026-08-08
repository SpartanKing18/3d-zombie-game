import { Cutscene } from './Cutscene.js';
import * as THREE from 'three';

export class OpeningCutscene extends Cutscene {
  constructor(game) {
    super(game);
    this.bedroomScene = null;
    this.bedroomCamera = null;
    this.originalScene = game.scene.scene;
    this.originalCamera = game.scene.camera;
    this.originalRenderer = game.scene.renderer;
    this.speechSynthesis = window.speechSynthesis;

    // Import sound effects dynamically
    import('../systems/SoundEffects.js').then(module => {
      this.SoundEffects = module.SoundEffects;
      this.soundEffects = new this.SoundEffects();
    });
  }

  speak(text, rate = 0.9) {
    if (!this.speechSynthesis) return Promise.resolve();

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;

      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.speechSynthesis.cancel();
          resolve();
        }
      }, 5000);

      utterance.onend = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      };

      utterance.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      };

      try {
        this.speechSynthesis.cancel();
        this.speechSynthesis.speak(utterance);
      } catch (e) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve();
        }
      }
    });
  }

  async play() {
    try {
      // Save original state
      this.game.isPaused = true;

      // Use friend's house bedroom
      this.game.friendsHouse.loadBedroom();
      this.game.inFriendHouse = true;
      this.game.player.setPosition(0, 1.6, 3);

      // Play cutscene sequence
      await this.fadeFromBlack(1000);
      await this.wait(1000);

      // TV news sequence
      await this.playNewsSequence();

      // Grandpa dialogue
      await this.playGrandpaDialogue();

      // Going to bed
      await this.playGoToBed();

      // Wait in bed
      await this.wait(2000);

      // Attack sequence
      await this.playAttackSequence();

      // Escape and hide
      await this.playEscapeSequence();

      // End cutscene
      await this.fadeToBlack(1000);

      // Clean up and return to game
      await this.transitionToGame();
    } catch (e) {
      console.error('Cutscene error:', e);
    }
  }

  async setupBedroom() {
    // Create a simple bedroom scene
    this.bedroomScene = new THREE.Scene();
    this.bedroomScene.background = new THREE.Color(0x2a2a2a);
    this.bedroomScene.fog = new THREE.Fog(0x2a2a2a, 30, 100);

    // Lighting
    this.bedroomAmbient = new THREE.AmbientLight(0xffffff, 0.5);
    this.bedroomScene.add(this.bedroomAmbient);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    this.bedroomScene.add(directionalLight);

    // Camera
    this.bedroomCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.bedroomCamera.position.set(0, 1.6, 2);

    // Floor
    const floorGeom = new THREE.PlaneGeometry(10, 12);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a3f35 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.bedroomScene.add(floor);

    // Walls
    this.addWall(this.bedroomScene, 5, 0, 0, 10, 4, 0x3a3a3a); // back wall
    this.addWall(this.bedroomScene, -5, 0, 0, 10, 4, 0x3a3a3a); // left wall
    this.addWall(this.bedroomScene, 0, 0, -6, 10, 4, 0x3a3a3a); // front wall

    // Bed
    this.addBed(this.bedroomScene);

    // TV
    this.tv = this.addTV(this.bedroomScene);

    // Window
    this.window = this.addWindow(this.bedroomScene);

    // Grandpa (simple representation)
    this.grandpa = this.addGrandpa(this.bedroomScene);

    // Store original scene and set to bedroom
    this.game.inCutscene = true;
    this.game.cutsceneScene = this.bedroomScene;
    this.game.cutsceneCamera = this.bedroomCamera;
  }

  addWall(scene, x, y, z, width, height, color) {
    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshStandardMaterial({ color });
    const wall = new THREE.Mesh(geom, mat);
    wall.position.set(x, y + height / 2, z);
    if (Math.abs(x) > 1) wall.rotation.y = Math.PI / 2;
    scene.add(wall);
  }

  addBed(scene) {
    // Bed frame
    const frameGeom = new THREE.BoxGeometry(2, 0.5, 2.2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(-1.5, 0.3, -3);
    scene.add(frame);

    // Mattress
    const mattressGeom = new THREE.BoxGeometry(1.9, 0.25, 2.1);
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    const mattress = new THREE.Mesh(mattressGeom, mattressMat);
    mattress.position.set(-1.5, 0.65, -3);
    scene.add(mattress);

    // Pillow
    const pillowGeom = new THREE.BoxGeometry(1.5, 0.3, 0.5);
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a });
    const pillow = new THREE.Mesh(pillowGeom, pillowMat);
    pillow.position.set(-1.5, 1.1, -2.5);
    scene.add(pillow);

    // Blanket
    const blanketGeom = new THREE.BoxGeometry(1.8, 0.15, 1.5);
    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x3a3a5a });
    const blanket = new THREE.Mesh(blanketGeom, blanketMat);
    blanket.position.set(-1.5, 0.85, -3.3);
    scene.add(blanket);
  }

  addTV(scene) {
    // TV stand
    const standGeom = new THREE.BoxGeometry(2.5, 0.5, 0.5);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const stand = new THREE.Mesh(standGeom, standMat);
    stand.position.set(2, 0.3, 2);
    scene.add(stand);

    // TV screen
    const screenGeom = new THREE.BoxGeometry(2.2, 1.4, 0.1);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      emissive: 0x333333,
      emissiveIntensity: 0.5
    });
    const screen = new THREE.Mesh(screenGeom, screenMat);
    screen.position.set(2, 1.1, 2);
    scene.add(screen);

    return { screen, stand };
  }

  addWindow(scene) {
    // Window frame
    const frameGeom = new THREE.BoxGeometry(2, 1.5, 0.1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(-4.8, 1.2, -5.8);
    scene.add(frame);

    // Glass
    const glassGeom = new THREE.PlaneGeometry(1.9, 1.4);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x4a6a8a,
      transparent: true,
      opacity: 0.6
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.set(-4.8, 1.2, -5.7);
    scene.add(glass);

    return { frame, glass };
  }

  addGrandpa(scene) {
    // Simple character representation
    const group = new THREE.Group();

    // Body
    const bodyGeom = new THREE.CapsuleGeometry(0.3, 1, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.8;
    group.add(body);

    // Head
    const headGeom = new THREE.SphereGeometry(0.25, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(0, 1.8, 0);
    group.add(head);

    group.position.set(1, 0, 0);
    scene.add(group);

    return group;
  }

  async playNewsSequence() {
    // Camera moves toward TV
    for (let i = 0; i < 30; i++) {
      this.bedroomCamera.position.z += 0.05;
      this.bedroomCamera.position.x = Math.sin(i * 0.05) * 0.3;
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    await this.wait(2000);

    // TV voice - news anchor speaking
    await this.speak("We are receiving reports of a mysterious outbreak in the region. Authorities are investigating possible sources.", 0.95);

    await this.wait(1500);

    await this.speak("Victims are showing signs of extreme aggression, high fever, and disorientation. Health officials believe it may be a severe mutation of rabies virus.", 0.95);

    await this.wait(1500);

    await this.speak("We are advising all residents to remain indoors. Lock all doors and windows. Do not approach any suspected victims. More updates as this develops.", 0.95);

    await this.wait(2000);
  }

  async playGrandpaDialogue() {
    // Camera pulls back to show grandpa
    for (let i = 0; i < 20; i++) {
      this.bedroomCamera.position.z -= 0.05;
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    await this.wait(1000);

    // Animate grandpa moving
    this.grandpa.position.x = -1;

    await this.speak("Don't worry about that news nonsense. Just some hysteria. Your grandma and I are heading over to the Hendersons' place.", 0.85);

    await this.wait(1500);

    await this.speak("We'll be back by tomorrow afternoon. You stay here, lock the doors, and get some rest. Okay?", 0.85);

    await this.wait(1500);

    this.grandpa.position.x = -3;

    await this.speak("We'll be fine. See you tomorrow.", 0.85);

    await this.wait(2000);

    // Wait for door to close
    await this.wait(2000);
  }

  async playGoToBed() {
    // Camera moves to bed
    const startPos = this.game.camera.position.clone();
    for (let i = 0; i < 50; i++) {
      this.game.camera.position.x = startPos.x + (i / 50) * (-3);
      this.game.camera.position.y = startPos.y - (i / 50) * 0.6;
      this.game.camera.position.z = startPos.z + (i / 50) * 2;
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    await this.wait(2000);

    // Slowly darken the room for sleep
    const lights = this.game.scene.scene.children.filter(c => c instanceof THREE.Light);
    const originalIntensities = lights.map(l => l.intensity);

    for (let i = 0; i < 60; i++) {
      lights.forEach((light, idx) => {
        if (light instanceof THREE.AmbientLight) {
          light.intensity = originalIntensities[idx] * (1 - i / 60);
        }
      });
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    await this.wait(3000);
  }

  async playAttackSequence() {
    // Sudden wake - camera shakes violently, move back to normal position
    const lights = this.game.scene.scene.children.filter(c => c instanceof THREE.Light);
    const originalIntensities = lights.map(l => l.intensity);

    for (let i = 0; i < 15; i++) {
      this.game.camera.position.x += (Math.random() - 0.5) * 0.4;
      this.game.camera.position.y += (Math.random() - 0.5) * 0.3;

      // Lights suddenly flare on
      lights.forEach((light, idx) => {
        if (light instanceof THREE.AmbientLight) {
          light.intensity = Math.min(1.2, 0.2 + (i / 15) * 1.0);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    await this.wait(1500);

    // Screams
    await this.speak("AHHHHHHHHH!", 1.5);

    await this.wait(1000);

    await this.speak("NO! GET AWAY! GET—", 1.5);

    await this.wait(2000);

    // Heavy footsteps
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Camera frantically looks around
    for (let i = 0; i < 20; i++) {
      this.game.camera.position.x = Math.sin(i * 0.2) * 1;
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    await this.wait(1500);
  }

  async playEscapeSequence() {
    // Camera rapidly falls/moves out the window
    for (let i = 0; i < 25; i++) {
      this.bedroomCamera.position.y -= 0.2;
      this.bedroomCamera.position.z += 0.1;
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    await this.wait(2000);

    // Quick running camera effect to friend's house
    for (let i = 0; i < 30; i++) {
      this.bedroomCamera.position.z += 0.2;
      this.bedroomCamera.position.x = Math.sin(i * 0.4) * 1.5;
      this.bedroomCamera.position.y = 1 + Math.sin(i * 0.3) * 0.3;
      await new Promise(resolve => setTimeout(resolve, 35));
    }

    await this.wait(1500);

    await this.speak("MICHAEL! OPEN THE DOOR!", 1.3);

    await this.wait(1000);

    await this.speak("Oh my god... get inside. NOW!", 1.3);

    await this.wait(1500);

    // Lights dim
    if (this.bedroomAmbient) {
      for (let i = 0; i < 20; i++) {
        this.bedroomAmbient.intensity = 0.3 - (i / 20) * 0.2;
        await new Promise(resolve => setTimeout(resolve, 40));
      }
    }

    await this.wait(1500);

    await this.speak("Upstairs! The attic! We have to hide. They're everywhere!", 1.2);

    await this.wait(2000);

    // Camera rapidly moves upward
    for (let i = 0; i < 20; i++) {
      this.bedroomCamera.position.y += 0.3;
      this.bedroomCamera.position.z += 0.05;
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    await this.wait(3000);
  }

  async transitionToGame() {
    // End cutscene mode
    this.game.inCutscene = false;
    this.game.isPaused = false;
    this.game.inFriendHouse = true;

    // Player now in attic after cutscene
    this.game.friendsHouse.loadAttic();
    this.game.player.setPosition(0, 0.9, 0);
    this.game.player.body.velocity.set(0, 0, 0);
    this.game.camera.position.copy(this.game.player.position);
    this.game.camera.position.y += 1.6;

    // Step physics a few times to settle player on floor
    for (let i = 0; i < 10; i++) {
      this.game.physicsWorld.step();
      this.game.player.update(0.016);
    }

    // Start mission briefing with Michael
    await this.wait(1500);
    await this.speak("We need to get supplies. There's a store a few blocks away.", 0.9);
    await this.wait(2000);
    await this.speak("We need food, water, weapons, and medical supplies. Are you ready to go?", 0.9);

    // Activate dialogue system for player response
    this.game.dialogueSystem.startDialogue('Michael');

    // Clean up overlays
    const overlay = document.getElementById('cutscene-overlay');
    if (overlay) overlay.remove();

    const subtitle = document.getElementById('cutscene-subtitle');
    if (subtitle) subtitle.remove();

    if (this.subtitleTimeout) clearTimeout(this.subtitleTimeout);
  }

  skip() {
    super.skip();
    this.skipRequested = true;
  }
}
