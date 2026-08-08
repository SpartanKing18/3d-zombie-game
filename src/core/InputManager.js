export class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = {
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: 0,
      leftClick: false,
      rightClick: false,
      scrollDelta: 0,
    };
    this.touchStartX = 0;
    this.touchStartY = 0;

    this.setupListeners();
  }

  setupListeners() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    document.addEventListener('mousemove', (e) => {
      this.mouse.deltaX = e.movementX || e.mozMovementX || 0;
      this.mouse.deltaY = e.movementY || e.mozMovementY || 0;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.getElementById('command-console').style.display !== 'flex') {
        this.mouse.leftClick = true;
      }
      if (e.button === 2) this.mouse.rightClick = true;
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.leftClick = false;
      if (e.button === 2) this.mouse.rightClick = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('wheel', (e) => {
      this.mouse.scrollDelta = e.deltaY > 0 ? 1 : -1;
    }, { passive: true });

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.mouse.deltaX = e.touches[0].clientX - this.touchStartX;
        this.mouse.deltaY = e.touches[0].clientY - this.touchStartY;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    });
  }

  isKeyPressed(key) {
    return this.keys[key.toLowerCase()] || false;
  }

  isMoving() {
    return this.isKeyPressed('w') || this.isKeyPressed('a') ||
           this.isKeyPressed('s') || this.isKeyPressed('d') ||
           this.isKeyPressed('arrowup') || this.isKeyPressed('arrowleft') ||
           this.isKeyPressed('arrowdown') || this.isKeyPressed('arrowright');
  }

  getMovementDirection() {
    const direction = { x: 0, z: 0 };

    if (this.isKeyPressed('w') || this.isKeyPressed('arrowup')) direction.z += 1;
    if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) direction.z -= 1;
    if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft')) direction.x -= 1;
    if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) direction.x += 1;

    const length = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (length > 0) {
      direction.x /= length;
      direction.z /= length;
    }

    return direction;
  }

  resetMouseDelta() {
    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;
  }

  requestPointerLock() {
    const canvas = document.getElementById('game-canvas');
    canvas.requestPointerLock =
      canvas.requestPointerLock ||
      canvas.mozRequestPointerLock ||
      canvas.webkitRequestPointerLock;

    if (canvas.requestPointerLock && !document.pointerLockElement) {
      canvas.requestPointerLock();
    }
  }

  exitPointerLock() {
    document.exitPointerLock =
      document.exitPointerLock ||
      document.mozExitPointerLock ||
      document.webkitExitPointerLock;

    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  isPointerLocked() {
    return document.pointerLockElement === document.getElementById('game-canvas') ||
           document.mozPointerLockElement === document.getElementById('game-canvas') ||
           document.webkitPointerLockElement === document.getElementById('game-canvas');
  }
}
