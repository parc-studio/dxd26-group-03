# Celestial — Craft Space

First drag prototype for the jewellery-shop project: a full-bleed craft canvas with clustered material elements you can reposition.

## Run

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## What’s in this slice

- Atmospheric full-bleed craft space (mobile-first; desktop OK)
- Catalog + recipes in `src/data/catalog.json`
- Drag materials onto each other to merge (sparkles + click); no recipe → both stay
- Placeholder path to jewellery: Pearl + Gold wire → Gold bead + Fine chain → Pendant

Out of scope for now: jewellery popup, parent/duplicate logic, real product images.

## Phone / LAN

```bash
npm run dev
```

Open `http://<this-Mac-LAN-IP>:5173` on the same Wi‑Fi (Vite listens with `server.host: true`).

Try: drag **Pearl** onto **Gold wire**, then the **Gold bead** onto **Fine chain**.

### Shake to reset (`#/craft`)

On Android (Chrome), shake the phone to jostle pieces with craft physics, then reset to a fresh starter layout (clears merges / products / sheets).

Implementation: `src/lib/shakeDetect.ts` + `src/lib/shakeJostle.ts`, wired in `CraftSpace`.

**iPhone follow-up:** iOS Safari 13+ does not fire `devicemotion` until the page calls `DeviceMotionEvent.requestPermission()` from a user gesture. We deliberately skip that prompt for now (Android-first). Next step: an explicit “Enable shake” control that calls `getDeviceMotionPermissionApi()` from `shakeDetect.ts`, then keeps the same listener path.
