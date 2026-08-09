import * as THREE from 'three';
import { NPC } from './NPC.js';

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.npcs = [];
    this.currentDialog = null;
    this.recruited = [];

    this.setupDialogUI();
    // NPCs are spawned after the player exits the house (spawnOutdoorNPCs),
    // not at construction time, because outdoor terrain doesn't exist yet.
  }

  setupDialogUI() {
    this.dialogEl = document.getElementById('npc-dialog');
    this.nameEl    = this.dialogEl?.querySelector('.npc-name');
    this.textEl    = this.dialogEl?.querySelector('.npc-text');
    this.optionsEl = this.dialogEl?.querySelector('.dialog-options');
  }

  spawnOutdoorNPCs(centerX = 0, centerZ = 40) {
    // Guard synchronously: NPCs are pushed to this.npcs inside staggered setTimeouts
    // that fire up to ~2.7s later, so a second call within that window would slip
    // past a `this.npcs.length` check and spawn a duplicate 10-NPC settlement.
    if (this._spawnStarted || this.npcs.length > 0) return;
    this._spawnStarted = true;

    // Settlement is at a fixed world location 250 units in front of the house
    // — far enough that the player never sees them on exit, must walk there
    const sx = 0;
    const sz = 250;
    const npcConfigs = [
      { name: 'Mayor',        type: 'mayor',     x: sx + 18,  z: sz + 18 },
      { name: 'Merchant',     type: 'merchant',  x: sx - 22,  z: sz + 22 },
      { name: 'Guard Captain',type: 'soldier',   x: sx + 12,  z: sz + 30 },
      { name: 'Scientist',    type: 'scientist', x: sx - 28,  z: sz + 10 },
      { name: 'Sarah',        type: 'civilian',  x: sx + 30,  z: sz +  5 },
      { name: 'John',         type: 'civilian',  x: sx - 15,  z: sz + 38 },
      { name: 'Doc Miller',   type: 'doctor',    x: sx +  8,  z: sz - 12 },
      { name: 'Engineer Tom', type: 'engineer',  x: sx - 35,  z: sz - 20 },
      { name: 'Maria',        type: 'civilian',  x: sx + 38,  z: sz - 18 },
      { name: 'Officer Mike', type: 'guard',     x: sx - 10,  z: sz + 15 },
    ];

    npcConfigs.forEach((config, idx) => {
      // Stagger NPC creation 300ms apart — avoids adding 10 physics bodies in one frame
      setTimeout(() => {
      const npc = new NPC(config.name, config.type, config.x, config.z, this.game);

      if (idx === 0) {
        npc.setupDialogues([
          { text: 'Greetings, survivor! Welcome to our settlement.', options: [
            { text: 'What can I do here?', next: 1 },
            { text: 'I need to leave.', next: 'end' }
          ]},
          { text: 'Defend our base, gather resources, and help rebuild civilization.', options: [
            { text: 'I\'ll help', action: 'recruit', next: 2 },
            { text: 'Not interested', next: 'end' }
          ]},
          { text: 'Great! You\'re now part of our team.', options: [
            { text: 'Will do!', next: 'end' }
          ]}
        ]);
      } else if (idx === 1) {
        npc.setupDialogues([
          { text: 'Welcome to my shop! I have supplies.', options: [
            { text: 'What are you selling?', next: 1 },
            { text: 'I\'ll come back later', next: 'end' }
          ]},
          { text: 'Weapons, food, medicine, and crafting materials.', options: [
            { text: 'Interesting!', next: 'end' }
          ]}
        ]);
      } else if (idx === 2) {
        npc.setupDialogues([
          { text: 'Stay alert, survivor. Zombies don\'t sleep.', options: [
            { text: 'Can you help us fight?', next: 1 },
            { text: 'Thanks for the warning', next: 'end' }
          ]},
          { text: 'I can teach you combat techniques.', options: [
            { text: 'Yes, teach me!', action: 'recruit', next: 2 },
            { text: 'Not now', next: 'end' }
          ]},
          { text: 'Good. I\'ll help improve your skills.', options: [
            { text: 'Thank you', next: 'end' }
          ]}
        ]);
      } else if (idx === 3) {
        npc.setupDialogues([
          { text: 'Fascinating... the zombie virus is evolving.', options: [
            { text: 'What do you need?', next: 1 },
            { text: 'That\'s dangerous', next: 'end' }
          ]},
          { text: 'Bring me samples. It could be key to a cure.', options: [
            { text: 'I\'ll help', action: 'recruit', next: 2 },
            { text: 'Never mind', next: 'end' }
          ]},
          { text: 'Excellent! You\'re my research partner now.', options: [
            { text: 'Glad to help', next: 'end' }
          ]}
        ]);
      } else {
        npc.setupDialogues([
          { text: `Hi, I'm ${config.name}. Nice to meet you!`, options: [
            { text: 'Want to join forces?', next: 1 },
            { text: 'See you around', next: 'end' }
          ]},
          { text: 'Sure, I\'d like that. Together we might survive this.', options: [
            { text: 'Welcome to the team!', action: 'recruit', next: 'end' }
          ]}
        ]);
      }

      this.npcs.push(npc);
      }, idx * 300);
    });
  }

  update(deltaTime) {
    this.npcs.forEach(npc => npc.update(deltaTime));

    const player = this.game.player;
    if (!player) return;

    const playerPos = player.getPosition();

    this.npcs.forEach(npc => {
      const dist = npc.getPosition().distanceTo(playerPos);
      npc.distanceToPlayer = dist;
    });

    // Companion combat behavior
    for (const npc of this.recruited) {
      if (!npc.isCompanion) continue;
      const npcPos = npc.mesh?.position;
      if (!npcPos) continue;

      // Follow player
      const dx = player.getPosition().x - npcPos.x;
      const dz = player.getPosition().z - npcPos.z;
      const distToPlayer = Math.sqrt(dx*dx + dz*dz);
      if (distToPlayer > 4) {
        const speed = 3.5;
        npcPos.x += (dx / distToPlayer) * speed * deltaTime;
        npcPos.z += (dz / distToPlayer) * speed * deltaTime;
        if (npc.body) { npc.body.position.x = npcPos.x; npc.body.position.z = npcPos.z; }
      }

      // Attack nearest zombie
      npc._attackTimer = (npc._attackTimer ?? 0) + deltaTime;
      if (npc._attackTimer >= 2.0) {
        npc._attackTimer = 0;
        const zombies = this.game.zombieManager?.getZombies() ?? [];
        let nearest = null, nearestDist = 8;
        for (const z of zombies) {
          const zdx = z.position.x - npcPos.x, zdz = z.position.z - npcPos.z;
          const d = Math.sqrt(zdx*zdx + zdz*zdz);
          if (d < nearestDist) { nearestDist = d; nearest = z; }
        }
        if (nearest) {
          nearest.takeDamage(12 + Math.random() * 8);
          this.game.triggerHitmarker?.();
        }
      }
    }
  }

  getNearestNPC(maxDistance = 5) {
    const player = this.game.player;
    if (!player) return null;

    const playerPos = player.getPosition();
    let nearest = null;
    let minDist = maxDistance;

    this.npcs.forEach(npc => {
      const dist = npc.getPosition().distanceTo(playerPos);
      if (dist < minDist) {
        minDist = dist;
        nearest = npc;
      }
    });

    return nearest;
  }

  talkToNPC(npc) {
    this.currentDialog = npc;
    npc.startDialog();
    this.showDialog(npc, 0);
  }

  showDialog(npc, dialogIndex) {
    const dialog = npc.dialogues[dialogIndex];
    if (!dialog) {
      this.hideDialog();
      return;
    }

    if (!this.dialogEl) return;
    this.dialogEl.classList.add('open');
    if (this.nameEl)    this.nameEl.textContent = npc.name;
    if (this.textEl)    this.textEl.textContent = dialog.text;

    if (this.optionsEl) {
      this.optionsEl.innerHTML = '';
      dialog.options.forEach(option => {
        const btn = document.createElement('div');
        btn.className = 'dialog-option';
        btn.textContent = option.text;

        btn.addEventListener('click', () => {
          if (option.action === 'recruit' && !this.recruited.includes(npc)) {
            npc.isCompanion = true;
            npc.isRecruited = true;
            this.recruited.push(npc);
          }

          if (option.next === 'end') {
            this.hideDialog();
          } else if (typeof option.next === 'number') {
            this.showDialog(npc, option.next);
          }
        });

        this.optionsEl.appendChild(btn);
      });
    }
  }

  hideDialog() {
    this.dialogEl?.classList.remove('open');
    this.currentDialog = null;
  }

  getRecruited() {
    return this.recruited;
  }

  getNPCs() {
    return this.npcs;
  }
}
