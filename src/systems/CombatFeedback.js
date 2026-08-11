import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
//  Floating combat damage numbers
// ─────────────────────────────────────────────────────────────────────────────
// Spawns a short-lived screen-space number at a world hit point every time a
// zombie is damaged. White for body hits, orange for crits, yellow for headshots.
// Purely additive juice — a DOM overlay projected from the 3D hit point; the
// element animates (rise + fade) via CSS and removes itself, so there is no
// per-frame work and nothing to leak. Active elements are capped so a shotgun /
// explosion spamming hits can't flood the DOM.
// ─────────────────────────────────────────────────────────────────────────────
const MAX_ACTIVE = 28;
const _v = new THREE.Vector3();

export class CombatFeedback {
  constructor(game) {
    this.game = game;
    this._active = [];
    let el = document.getElementById('combat-feedback');
    if (!el) {
      el = document.createElement('div');
      el.id = 'combat-feedback';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  _camera() {
    return this.game.scene?.getCamera?.() || this.game.scene?.camera || null;
  }

  // Project a world point to pixel coordinates. Returns null if behind the camera.
  _project(worldPos) {
    const cam = this._camera();
    if (!cam || !worldPos) return null;
    _v.set(worldPos.x, worldPos.y, worldPos.z).project(cam);
    if (_v.z > 1) return null;                       // behind the camera
    if (_v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.2) return null; // off-screen
    return {
      x: (_v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-_v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  // amount: number  kind: 'normal' | 'crit' | 'headshot'
  damageNumber(worldPos, amount, kind = 'normal') {
    const p = this._project(worldPos);
    if (!p) return;

    // Cap concurrent numbers — drop the oldest if we're over budget.
    if (this._active.length >= MAX_ACTIVE) {
      const old = this._active.shift();
      old?.remove();
    }

    const n = document.createElement('div');
    n.className = 'dmg-number' + (kind !== 'normal' ? ' ' + kind : '');
    n.textContent = kind === 'headshot' ? `${Math.round(amount)}!` : `${Math.round(amount)}`;
    // Small horizontal jitter so stacked hits fan out instead of overlapping.
    const jitter = (Math.sin(worldPos.x * 12.9 + worldPos.z * 78.2) * 0.5) * 26;
    n.style.left = (p.x + jitter) + 'px';
    n.style.top  = p.y + 'px';
    this.container.appendChild(n);
    this._active.push(n);

    const done = () => {
      n.removeEventListener('animationend', done);
      const i = this._active.indexOf(n);
      if (i >= 0) this._active.splice(i, 1);
      n.remove();
    };
    n.addEventListener('animationend', done);
    // Safety net in case animationend never fires (tab hidden, etc.)
    setTimeout(done, 1200);
  }

  // Remove everything (called on world reset / player death cleanup).
  clear() {
    for (const n of this._active) n.remove();
    this._active.length = 0;
  }
}
