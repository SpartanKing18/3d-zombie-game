export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.missions = [];
    this.currentMissionIndex = 0;
    this.completedMissions = [];
    this.initializeMissions();
    this.setupUI();
  }

  initializeMissions() {
    this.missions = [
      {
        id: 'survive_night',
        title: 'Survive the Night',
        description: 'Stay hidden in Michael\'s attic and survive until dawn.',
        objectives: [
          'Hide in the attic',
          'Stay quiet and avoid detection',
          'Wait until morning'
        ],
        reward: 'Safety and time to plan',
        status: 'in_progress',
        progress: 0
      },
      {
        id: 'gather_supplies',
        title: 'Gather Supplies',
        description: 'Scavenge for food, water, weapons, and medical supplies.',
        objectives: [
          'Find food and water',
          'Locate weapons',
          'Find medical supplies',
          'Return to safe location'
        ],
        reward: 'Resources for survival',
        status: 'pending',
        progress: 0
      },
      {
        id: 'explore_neighborhood',
        title: 'Explore the Neighborhood',
        description: 'Scout the area and locate other survivors or safe houses.',
        objectives: [
          'Map the infected territories',
          'Find other survivors',
          'Identify safe zones',
          'Report findings'
        ],
        reward: 'Knowledge of the world',
        status: 'pending',
        progress: 0
      },
      {
        id: 'find_sanctuary',
        title: 'Find Sanctuary',
        description: 'Locate a long-term safe location to establish a base.',
        objectives: [
          'Search for fortifiable locations',
          'Gather more supplies',
          'Recruit other survivors',
          'Establish a base camp'
        ],
        reward: 'Long-term survival',
        status: 'pending',
        progress: 0
      }
    ];
  }

  setupUI() {
    if (document.getElementById('mission-log')) {
      return; // Already set up
    }

    // Mission tracker hidden by default (sandbox mode — press J to open mission log)
    const tracker = document.createElement('div');
    tracker.id = 'mission-tracker';
    tracker.style.cssText = 'display:none;position:fixed;top:12px;left:12px;color:#dd8833;font-family:monospace;font-size:12px;pointer-events:none;text-shadow:1px 1px 2px #000;z-index:500;';
    document.body.appendChild(tracker);
    this._updateTracker();

    const missionLog = document.createElement('div');
    missionLog.id = 'mission-log';
    missionLog.style.display = 'none';
    missionLog.style.position = 'fixed';
    missionLog.style.top = '0';
    missionLog.style.right = '0';
    missionLog.style.width = '400px';
    missionLog.style.height = '100vh';
    missionLog.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    missionLog.style.borderLeft = '2px solid #dd8833';
    missionLog.style.color = '#ccc';
    missionLog.style.fontFamily = "'Verdana', sans-serif";
    missionLog.style.zIndex = '2000';
    missionLog.style.overflowY = 'auto';
    missionLog.style.padding = '20px';

    document.body.appendChild(missionLog);

    // J key toggles mission log (X is reserved for sneeze action)
    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'j' && !this.game.commandSystem?.isOpen && !this.game.inventorySystem?.isOpen) {
        this.toggleMissionLog();
      }
    });
  }

  toggleMissionLog() {
    const log = document.getElementById('mission-log');
    if (log.style.display === 'none') {
      log.style.display = 'block';
      this.updateMissionDisplay();
    } else {
      log.style.display = 'none';
    }
  }

  updateMissionDisplay() {
    const log = document.getElementById('mission-log');
    if (!log) return;

    log.innerHTML = '<h2 style="color: #dd8833; margin-bottom: 20px;">MISSION LOG</h2>';

    if (this.missions.length === 0) {
      log.innerHTML += '<p>No missions available.</p>';
      return;
    }

    this.missions.forEach((mission, index) => {
      const missionEl = document.createElement('div');
      missionEl.style.marginBottom = '20px';
      missionEl.style.paddingBottom = '15px';
      missionEl.style.borderBottom = '1px solid #444';

      const statusColor = {
        'in_progress': '#dd8833',
        'completed': '#66ff66',
        'pending': '#888888'
      }[mission.status] || '#888888';

      missionEl.innerHTML = `
        <h3 style="color: ${statusColor}; margin: 0 0 8px 0;">${mission.title}</h3>
        <p style="margin: 8px 0; font-size: 12px; color: #999;">${mission.description}</p>
        <div style="margin: 10px 0;">
          <p style="margin: 5px 0; font-size: 11px; font-weight: bold;">Objectives:</p>
          ${mission.objectives.map(obj => `<p style="margin: 3px 0 3px 15px; font-size: 11px;">• ${obj}</p>`).join('')}
        </div>
        <p style="margin: 8px 0; font-size: 11px; color: #dd8833;">Status: ${mission.status.toUpperCase()}</p>
      `;

      log.appendChild(missionEl);
    });
  }

  _updateTracker() {
    const el = document.getElementById('mission-tracker');
    if (!el) return;
    const mission = this.getCurrentMission();
    if (!mission || mission.status === 'completed') {
      el.textContent = '';
      return;
    }
    const bar = '█'.repeat(Math.floor((mission.progress ?? 0) / 10)) + '░'.repeat(10 - Math.floor((mission.progress ?? 0) / 10));
    el.innerHTML = `▶ ${mission.title}<br>[${bar}] ${mission.progress ?? 0}%`;
  }

  completeMission(missionId) {
    const mission = this.missions.find(m => m.id === missionId);
    if (mission && mission.status !== 'completed') {
      mission.status = 'completed';
      mission.progress = 100;
      this.completedMissions.push(missionId);
      this.updateMissionDisplay();
      this._updateTracker();
      this._showToast(`Mission Complete: ${mission.title}`);
    }
  }

  setMissionInProgress(missionId) {
    const mission = this.missions.find(m => m.id === missionId);
    if (mission && mission.status === 'pending') {
      mission.status = 'in_progress';
      this.updateMissionDisplay();
      this._updateTracker();
      this._showToast(`New Mission: ${mission.title}`);
    }
  }

  // Called by Game.onZombieKilled
  trackZombieKill() {
    const mission = this.missions.find(m => m.id === 'gather_supplies' && m.status === 'in_progress');
    if (mission) {
      mission.progress = Math.min(100, (mission.progress || 0) + 5);
      if (mission.progress >= 100) this.completeMission('gather_supplies');
    }
    const explore = this.missions.find(m => m.id === 'explore_neighborhood' && m.status === 'in_progress');
    if (explore) {
      explore.progress = Math.min(100, (explore.progress || 0) + 3);
      if (explore.progress >= 100) this.completeMission('explore_neighborhood');
    }
    this._updateTracker();
  }

  // Called by WorldItemSystem when an item is picked up
  trackItemPickup(type) {
    const mission = this.missions.find(m => m.id === 'gather_supplies' && m.status === 'in_progress');
    if (mission) {
      mission.progress = Math.min(100, (mission.progress || 0) + 2);
      if (mission.progress >= 100) this.completeMission('gather_supplies');
    }
    this._updateTracker();
  }

  _showToast(text) {
    const notif = document.getElementById('loot-notification');
    if (!notif) return;
    notif.textContent = `📋 ${text}`;
    notif.style.color = '#44ddff';
    notif.classList.remove('show');
    void notif.offsetWidth;
    notif.classList.add('show');
  }

  getCurrentMission() {
    return this.missions.find(m => m.status === 'in_progress') || this.missions[0];
  }
}
