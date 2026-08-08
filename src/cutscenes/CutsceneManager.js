export class CutsceneManager {
  constructor(game) {
    this.game = game;
    this.currentCutscene = null;
    this.isPlaying = false;
    this.cutscenes = new Map();
  }

  registerCutscene(name, cutsceneClass) {
    this.cutscenes.set(name, cutsceneClass);
  }

  async playCutscene(name) {
    if (this.isPlaying) return;

    const CutsceneClass = this.cutscenes.get(name);
    if (!CutsceneClass) {
      console.error(`Cutscene '${name}' not found`);
      return;
    }

    this.isPlaying = true;
    this.currentCutscene = new CutsceneClass(this.game);

    try {
      await this.currentCutscene.play();
    } catch (e) {
      console.error(`Error playing cutscene '${name}':`, e);
    } finally {
      this.isPlaying = false;
      this.currentCutscene = null;
    }
  }

  skipCutscene() {
    if (this.currentCutscene && this.currentCutscene.skip) {
      this.currentCutscene.skip();
    }
  }
}
