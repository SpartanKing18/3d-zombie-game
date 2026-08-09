import { Game } from './core/Game.js';

let game = null;

// Suppress verbose debug logs during gameplay (but allow everything during startup)
const originalLog = console.log;
console.logSuppressed = false;
console.log = function(...args) {
  if (!console.logSuppressed) {
    originalLog.apply(console, args);
  }
};

function showError(message) {
  const errorDisplay = document.getElementById('error-display');
  const errorMessage = document.getElementById('error-message');
  const errorClose = document.getElementById('error-close');

  console.error('ERROR:', message);
  errorMessage.textContent = message;
  errorDisplay.classList.add('active');

  if (errorClose) {
    errorClose.onclick = () => {
      errorDisplay.classList.remove('active');
    };
  }
}

function setupMenu() {
  const singleplayerBtn = document.getElementById('singleplayer-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const quitBtnMenu = document.getElementById('quit-btn-menu');
  const backBtn = document.getElementById('back-btn');
  const createWorldBtn = document.getElementById('create-world-btn');

  const mainMenu = document.getElementById('main-menu');
  const worldSelect = document.getElementById('world-select');
  const gameCanvas = document.getElementById('game-canvas');
  const hud = document.getElementById('hud');

  singleplayerBtn.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    worldSelect.classList.add('active');
  });

  settingsBtn.addEventListener('click', () => {
    if (game && game.settingsMenu) {
      mainMenu.classList.add('hidden');
      game.settingsMenu.open();
    } else {
      showError('Game not initialized. Please create a world first.');
    }
  });

  quitBtnMenu.addEventListener('click', () => {
    window.location.reload();
  });

  backBtn.addEventListener('click', () => {
    worldSelect.classList.remove('active');
    mainMenu.classList.remove('hidden');
  });

  createWorldBtn.addEventListener('click', () => {
    startGame();
  });

  // Show main menu on page load
  mainMenu.classList.remove('hidden');
  worldSelect.classList.remove('active');
  gameCanvas.classList.add('hidden');
  hud.classList.add('hidden');
}

function startGame() {
  try {
    console.log('Initializing Game...');
    game = new Game();
    window.game = game;
    console.log('Game created successfully');

    const mainMenu = document.getElementById('main-menu');
    const worldSelect = document.getElementById('world-select');
    const gameCanvas = document.getElementById('game-canvas');
    const hud = document.getElementById('hud');

    mainMenu.classList.add('hidden');
    worldSelect.classList.remove('active');
    gameCanvas.classList.remove('hidden');
    hud.classList.remove('hidden');

    console.log('Starting game loop and terrain generation...');
    game.start();
    setupControlsCard();
    console.log('Game started! Press Enter to open console with commands.');
    console.log('Example commands: /godmode, /time set day, /spawn zombie walker');
  } catch (e) {
    console.error('Game failed to start:', e);
    console.error('Stack:', e.stack);
    showError(`Game initialization failed: ${e.message}`);

    const mainMenu = document.getElementById('main-menu');
    const worldSelect = document.getElementById('world-select');
    mainMenu.classList.remove('hidden');
    worldSelect.classList.remove('active');
  }
}

// Controls quick-reference: auto-show on the player's first run (localStorage),
// toggle with the corner ? button, dismiss with "Got it". Never pauses the game.
function setupControlsCard() {
  const card = document.getElementById('controls-card');
  const helpBtn = document.getElementById('help-btn');
  const closeBtn = document.getElementById('cc-close');
  if (!card || !helpBtn) return;

  const show = () => { card.style.display = 'flex'; };
  const hide = () => { card.style.display = 'none'; };

  helpBtn.style.display = 'flex';
  helpBtn.onclick = () => { card.style.display === 'flex' ? hide() : show(); };
  if (closeBtn) closeBtn.onclick = hide;
  card.addEventListener('click', (e) => { if (e.target === card) hide(); });

  let seen = false;
  try { seen = localStorage.getItem('dz_controls_seen') === '1'; } catch (e) {}
  if (!seen) {
    show();
    try { localStorage.setItem('dz_controls_seen', '1'); } catch (e) {}
  }
}

setupMenu();
