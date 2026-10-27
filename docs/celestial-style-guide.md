# Celestial Jewelry — style overview (2d-shop)

Tokens for the craft prototype, matched to [celestial-jewelry.ch](https://celestial-jewelry.ch/) (computed styles, 2026-10-27). Source of truth in the app: `src/styles/tokens.css`.

## Colors

| Hex | Role | Notes |
|-----|------|--------|
| `#472b2b` | Brand / CTA fill / heading ink | Live primary button & H2/H3. Closest to hint `#462a2b`. |
| `#462a2b` | Brand deep (alias) | User-hinted button; kept as `--color-brand-deep`. |
| `#5c3e34` | Warm brown / overlays | Collection card tints (`rgba(92,62,52,…)` on site). |
| `#a67c6d` | Soft metal-rose accent | Present in site CSS; muted companion. |
| `#ffe5a9` | Cream / hero title | Live H1 on dark photo. Closest to hint `#fee4a8`. |
| `#fee4a8` | Cream hint (alias) | User-hinted header cream. |
| `#fcedc2` | Soft cream body on dark | Hero supporting line under H1. |
| `#ffffff` | Surface | Cards, sheet, header background blocks. |
| `#f7f3ec` | Muted surface | Image wells / sheet hero backdrop. |
| `#1d1e20` | Body ink | Site default text. |
| `#0d141a` | Nav ink | Header “Accueil” link. |
| `#ffffff` on brand | On-brand text | CTA labels. |

Craft-space dark atmosphere is derived from the brand browns (`--color-space-*`), with cream text for contrast on the dark canvas.

## Fonts

| Family | Role |
|--------|------|
| **Lora** | Primary brand serif — headings, nav, CTAs (`--font-display`). |
| **Playfair Display** | Large collection / display labels (`--font-display-alt`). |
| **DM Sans** | UI / body companion (`--font-ui`; site body uses DM Sans; Inter also appears on some CTAs). |

## Type

- Body: `1rem` / leading `1.5`
- Section titles: `2rem`, Lora semibold, leading ~`1.3`
- Hero display: up to `4rem`, Lora semibold
- Labels (Elements, Price): small caps-style UI with wide tracking (`0.18em`)
- CTA: Lora medium `1rem`

## Spacing & shape

- Rhythm: 4px base → `--space-1`…`--space-12` (0.25–3rem)
- CTA pill radius ~`28px` (`--radius-pill`)
- Sheet top radius ~`1.35rem`
- Collection-style card radius ~`14px`

## Wired in the craft app

- Global tokens: `src/styles/tokens.css` (imported from `src/index.css`)
- Fonts loaded in `index.html` (Lora, Playfair Display, DM Sans)
- Header hint, craft atmosphere, jewellery sheet, and Add to cart / qty controls consume these variables
