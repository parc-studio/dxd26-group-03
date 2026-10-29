# Celestial — Craft Space

First drag prototype for the jewellery-shop project: a full-bleed craft canvas with clustered material elements you can reposition.

## Run

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `https://localhost:5173` — self-signed; accept the warning).

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

Vite serves **HTTPS** on the LAN (`@vitejs/plugin-basic-ssl`) so DeviceMotion can work on Android Chrome. Plain `http://LAN-IP` is **not** a secure context and often gets **zero** `devicemotion` events.

1. Note the Mac LAN IP (e.g. `10.189.8.89`).
2. On the phone (same Wi‑Fi), open **`https://<LAN-IP>:5173/#/craft`** (not http).
3. Accept the self-signed certificate warning (“Advanced” → proceed).
4. Shake the phone — pieces should jostle, then reset to a fresh starter layout.

### Shake debug (no motion sensors needed)

On `#/craft`:

- Tap the temporary **Shake** button (bottom-right), or
- **Long-press the celestial logo** (~0.65s)

Both run the same jostle → reset path as a real shake. Check the browser console for `[craft-shake]` logs (`listener attached`, `first … event`, `SHAKE FIRED`, etc.).

### Chrome remote sensors (desktop)

Chrome DevTools → ⋮ → More tools → Sensors → set Orientation to a preset / play with acceleration to simulate shake while on `#/craft`. Prefer `https://localhost:5173/#/craft`.

### Android vs iPhone

- **Android Chrome (target):** motion should work on the **HTTPS** LAN URL after accepting the cert. Watch console: if you never see `first devicemotion event`, sensors are blocked or off.
- **iPhone (Safari, Chrome, home-screen app):** a tap opens the iOS motion prompt (`requestMotionPermissionOnTap()` in `src/lib/shakeDetect.ts`, retried on each tap until allowed); tilt and shake work once it is allowed. Needs HTTPS.

Implementation: `src/lib/shakeDetect.ts`, `src/lib/shakeJostle.ts`, wired in `CraftSpace`.
