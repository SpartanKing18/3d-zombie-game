export class AchievementSystem {
  constructor(game) {
    this.game = game;
    this._achievements = [
      { id:'first_blood',    name:'First Blood',       desc:'Kill your first zombie',               icon:'💀', unlocked:false, condition: g => (g.zombieKills??0) >= 1 },
      { id:'survivor',       name:'Survivor',          desc:'Survive 10 minutes total',             icon:'⏱', unlocked:false, condition: g => ((Date.now()-(g._sessionStartTime??Date.now()))/60000) >= 10 },
      { id:'headhunter',     name:'Headhunter',        desc:'Score 10 headshots',                   icon:'🎯', unlocked:false, condition: g => (g._headshotCount??0) >= 10 },
      { id:'hoarder',        name:'Hoarder',           desc:'Fill 30 inventory slots',              icon:'🎒', unlocked:false, condition: g => g.inventorySystem?.slots?.filter(Boolean).length >= 30 },
      { id:'zombie_slayer',  name:'Zombie Slayer',     desc:'Kill 50 zombies',                      icon:'⚔', unlocked:false, condition: g => (g.zombieKills??0) >= 50 },
      { id:'well_armed',     name:'Well Armed',        desc:'Own 4 different weapons',              icon:'🔫', unlocked:false, condition: g => (g.weaponManager?.getWeapons?.()?.length??0) >= 4 },
      { id:'medic',          name:'Field Medic',       desc:'Use 10 medical items',                 icon:'🩹', unlocked:false, condition: g => (g._medItemsUsed??0) >= 10 },
      { id:'explorer',       name:'Explorer',          desc:'Travel 500m from the house',           icon:'🗺', unlocked:false, condition: g => { const p=g.player?.getPosition?.(); return p && Math.sqrt(p.x*p.x+p.z*p.z)>500; }},
      { id:'pyromaniac',     name:'Pyromaniac',        desc:'Place 3 campfires',                    icon:'🔥', unlocked:false, condition: g => (g._campfires?.length??0) >= 3 },
      { id:'crafter',        name:'Master Crafter',    desc:'Craft 15 items',                      icon:'⚙', unlocked:false, condition: g => (g._craftCount??0) >= 15 },
      { id:'armored_up',     name:'Armored Up',        desc:'Equip vest + helmet',                  icon:'🦺', unlocked:false, condition: g => g.inventorySystem?.slots?.some(s=>s?.type==='armor_vest') && g.inventorySystem?.slots?.some(s=>s?.type==='armor_helmet') },
      { id:'night_owl',      name:'Night Owl',         desc:'Survive a full night (20:00→6:00)',    icon:'🌙', unlocked:false, condition: g => (g._nightsSurvived??0) >= 1 },
      { id:'surgeon',        name:'Surgeon',           desc:'Open the locked safe',                 icon:'🔓', unlocked:false, condition: g => g._safeObjects?.some(s=>s.opened) },
      { id:'blaster',        name:'Demolitions Expert',desc:'Kill 5 zombies with explosives',       icon:'💥', unlocked:false, condition: g => (g._explosiveKills??0) >= 5 },
      { id:'level5',         name:'Veteran',           desc:'Reach Level 5',                        icon:'⭐', unlocked:false, condition: g => (g.player?.level??0) >= 5 },
    ];
    this._checkTimer = 0;
    this._createUI();
  }

  _createUI() {
    // Achievement popup container
    if (!document.getElementById('ach-popup')) {
      const el = document.createElement('div');
      el.id = 'ach-popup';
      el.style.cssText = 'position:fixed;top:80px;right:-320px;width:280px;background:linear-gradient(135deg,rgba(20,20,30,0.97),rgba(30,30,50,0.97));border:1px solid #gold;border-color:#aa8833;border-radius:8px;padding:12px 16px;z-index:9000;transition:right 0.4s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;';
      el.innerHTML = '<div style="color:#ffdd44;font-size:11px;font-family:monospace;letter-spacing:1px;margin-bottom:4px;">🏆 ACHIEVEMENT UNLOCKED</div><div id="ach-icon" style="font-size:28px;float:left;margin-right:10px;"></div><div id="ach-name" style="color:#ffffff;font-size:14px;font-weight:bold;font-family:monospace;"></div><div id="ach-desc" style="color:#aaaacc;font-size:11px;font-family:monospace;margin-top:2px;"></div><div style="clear:both"></div>';
      document.body.appendChild(el);
    }
  }

  _showUnlock(ach) {
    const el = document.getElementById('ach-popup');
    if (!el) return;
    document.getElementById('ach-icon').textContent = ach.icon;
    document.getElementById('ach-name').textContent = ach.name;
    document.getElementById('ach-desc').textContent = ach.desc;
    el.style.right = '16px';
    clearTimeout(this._achTimer);
    this._achTimer = setTimeout(() => { el.style.right = '-320px'; }, 3500);
    // Screen flash
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:rgba(255,220,0,0.08);pointer-events:none;z-index:8999;';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
  }

  update(dt) {
    this._checkTimer += dt;
    if (this._checkTimer < 2) return;
    this._checkTimer = 0;
    const g = this.game;
    for (const ach of this._achievements) {
      if (ach.unlocked) continue;
      try {
        if (ach.condition(g)) {
          ach.unlocked = true;
          this._showUnlock(ach);
          g.player?.gainXP?.(50, 'achievement');
          break; // one at a time
        }
      } catch(e) {}
    }
  }

  getUnlocked() { return this._achievements.filter(a => a.unlocked); }
  getAll() { return this._achievements; }
}
