# 🧟 DEADZONE — 3D Zombie Survival Shooter

A fast, gory browser-based 3D zombie survival shooter built with **Three.js** and
**cannon-es** physics. No install, no plugins — it runs entirely in the browser.

Survive the outbreak: scavenge, craft, build a base, and hold out against endless
waves of mutant undead through a full day/night cycle.

---

## ✨ Features

- **20+ zombie types**, each with a distinct realistic body and behavior — shambling
  walkers, sprinting runners, hulking tanks, riot-armored cops, acid spitters,
  screamers, a quadruped hound, a necromancer that revives the dead, and a towering
  mutant giant boss.
- **Gore & juice** — headshots, dismemberment-style hit flashes, floating damage
  numbers, and persistent blood pools that stain the ground.
- **Survival systems** — health, stamina, hunger, thirst, temperature, bleeding and
  infection status effects.
- **Deep inventory & crafting** — 200+ item types, equipment slots, and a crafting tree.
- **Base building** — barricades, sandbag walls, campfires, bear traps, and electro-traps.
- **Dynamic world** — procedurally generated terrain, a furnished starting house,
  weather, and a full day/night cycle with a custom sky shader.
- **Progression** — XP, levels, perks, missions, achievements, and a kill-streak system.

## 🎮 Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Sprint | `Shift` |
| Jump | `Space` |
| Crouch | `Ctrl` |
| Fire / use | `Left Mouse` |
| Aim | `Right Mouse` |
| Reload | `R` |
| Interact / pick up | `F` |
| Inventory | `E` |
| Throw distraction rock | `T` |
| Weapon slots | `1`–`9` |

Click the canvas to lock the mouse and look around.

## 🛠️ Tech stack

- [Three.js](https://threejs.org/) — WebGL rendering
- [cannon-es](https://github.com/pmndrs/cannon-es) — physics
- [simplex-noise](https://github.com/jwagner/simplex-noise.js) — procedural terrain
- [Vite](https://vitejs.dev/) — build tooling

## 🚀 Run locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
```

## 📦 Build for production

```bash
npm run build    # outputs static files to ./dist
npm run preview  # serve the built site locally to verify
```

The `dist/` folder is a fully static site — host it anywhere.

## 🌐 Deploy on Render (Static Site)

1. Push this repo to GitHub.
2. In Render: **New → Static Site**, connect the repo.
3. Settings:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
4. Deploy. (A `render.yaml` blueprint is included for one-click setup.)

> **Publish directory = `dist`**

The same `dist/` output also works on Netlify, Vercel, Cloudflare Pages, or GitHub Pages.

## 📄 License

MIT — see game code. Audio/music not included; drop an `.mp3` at
`public/music/the-driest-beast.mp3` to enable the soundtrack (the game runs fine without it).
