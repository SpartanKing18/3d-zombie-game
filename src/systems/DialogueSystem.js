export class DialogueSystem {
  constructor(game) {
    this.game = game;
    this.currentNPC = null;
    this.isDialogueActive = false;
    this.dialogueHistory = [];
    this.speechSynthesis = window.speechSynthesis;
    this.dialogueResponses = this.initializeResponses();
  }

  initializeResponses() {
    return {
      'help': "I'm trying to stay alive. We need to find supplies and figure out what's happening.",
      'supplies': "We need food, water, weapons, and medical supplies. The store might have some things.",
      'what happened': "I don't know. Those things came out of nowhere. Your grandparents... I'm so sorry.",
      'how did you know': "I heard the commotion and looked outside. I saw them attacking people. I'm scared too.",
      'what do we do': "We stay here. We gather supplies quietly. We stay alive. That's all we can do right now.",
      'how long': "I don't know. We take it one day at a time.",
      'food': "We can check the kitchen. I have some canned goods. There's also a convenience store nearby.",
      'weapons': "There's a hunting rifle in my garage. Some hunting knives. It's not much.",
      'outside': "It's too dangerous right now. We need to plan carefully. We need to observe patterns.",
      'infected': "Those things... they used to be human. Now they're something else. They're fast and they're hungry.",
      'escape': "We can't just run. We don't know how many there are. We need supplies and a plan.",
      'scared': "Me too. But we have to stay calm and think clearly.",
      'survive': "One step at a time. Food, water, shelter, safety. That's how we survive.",
      'friends': "I've tried calling everyone. No one's answering. I don't know who else is alive.",
      'parents': "I'm sorry about your grandparents. We'll figure this out together.",
      'default': "I hear you. Let's focus on staying alive right now."
    };
  }

  getNPCResponse(playerInput) {
    const input = playerInput.toLowerCase().trim();

    // Check for keyword matches
    for (const [keyword, response] of Object.entries(this.dialogueResponses)) {
      if (keyword !== 'default' && input.includes(keyword)) {
        return response;
      }
    }

    // Contextual responses
    if (input.includes('mission') || input.includes('objective')) {
      return "We need to go to the supply store and gather what we can. Then we need to find a safe place. That's our mission.";
    }

    if (input.includes('friend')) {
      return "I'm glad you made it here. We have to stick together.";
    }

    if (input.includes('sorry')) {
      return "Don't be. It's not your fault. We just need to survive.";
    }

    if (input.includes('ok') || input.includes('okay') || input.includes('alright')) {
      return "Good. Let's get ready. The sooner we move, the better.";
    }

    // Default response
    return this.dialogueResponses['default'];
  }

  startDialogue(npc) {
    this.currentNPC = npc;
    this.isDialogueActive = true;
    if (this.game.commandSystem) this.game.commandSystem.isOpen = false;
  }

  endDialogue() {
    this.isDialogueActive = false;
    this.currentNPC = null;
  }

  speakText(text, voice = 'Michael') {
    if (!this.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Set voice based on character
    const voices = this.speechSynthesis.getVoices();
    if (voice === 'Michael' && voices.length > 0) {
      utterance.voice = voices[Math.floor(voices.length / 2)];
    }

    this.speechSynthesis.speak(utterance);
  }

  playerSpeak(text) {
    // Player speaks to NPC
    this.dialogueHistory.push({
      speaker: 'Player',
      text: text,
      timestamp: Date.now()
    });

    // Get NPC response
    const response = this.getNPCResponse(text);

    // NPC responds
    const npcName = this.currentNPC?.name ?? 'Michael';
    this.dialogueHistory.push({
      speaker: npcName,
      text: response,
      timestamp: Date.now()
    });

    // Speak the response
    this.speakText(response, npcName);

    return response;
  }

  clearHistory() {
    this.dialogueHistory = [];
  }
}
