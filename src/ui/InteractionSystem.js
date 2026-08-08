export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.nearbyNPC = null;
    this.setupUI();
  }

  setupUI() {
    this.promptEl = document.getElementById('action-prompt');
    this.promptText = document.getElementById('prompt-text');
    this.yesBtn = document.getElementById('action-yes');
    this.noBtn = document.getElementById('action-no');

    this.yesBtn?.addEventListener('click', () => this.handleYes());
    this.noBtn?.addEventListener('click', () => this.handleNo());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') {
        const g = this.game;
        if (g.commandSystem?.isOpen || g.inventorySystem?.isOpen || g.npcManager?.currentDialog) return;
        this.handleNPCInteraction();
      }
    });
  }

  update() {
    const npcManager = this.game.npcManager;
    if (!npcManager) return;

    const nearest = npcManager.getNearestNPC(5);

    if (nearest && nearest !== this.nearbyNPC) {
      this.nearbyNPC = nearest;
      this.showPrompt(`Press N to talk to ${nearest.name ?? 'Stranger'}`);
    } else if (!nearest && this.nearbyNPC) {
      this.nearbyNPC = null;
      this.hidePrompt();
    }
  }

  showPrompt(text) {
    if (this.promptText) this.promptText.textContent = text;
    this.promptEl?.classList.add('show');
  }

  hidePrompt() {
    this.promptEl?.classList.remove('show');
  }

  handleNPCInteraction() {
    if (this.nearbyNPC) {
      this.game.npcManager.talkToNPC(this.nearbyNPC);
      this.hidePrompt();
    }
  }

  handleYes() {
    console.log('Action confirmed');
    this.hidePrompt();
  }

  handleNo() {
    console.log('Action cancelled');
    this.hidePrompt();
  }
}
