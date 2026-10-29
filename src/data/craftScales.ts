import type { ElementKind, ShapeKind } from '../types'

/**
 * Craft-board image scale (Fotini).
 *
 * How to tune sizes
 * ----------------
 * 1. Category defaults below (or the matching CSS vars on `.craft-space`
 *    in CraftSpace.css — keep them in sync).
 * 2. Per-piece: add an id here in `CRAFT_SCALE_BY_ID`, or set `"scale": 1.35`
 *    on an element in `catalog.json` (catalog wins).
 *
 * Values multiply the CSS shape footprint (`1` = base size in CraftElement.css).
 */
export const CRAFT_SCALE_DEFAULTS = {
  /** Beads, stones, chains, mids */
  default: 1,
  /** Material rings */
  ring: 0.9,
  /** Finished jewellery products (PNG cutouts run small) */
  jewellery: 1.6,
} as const

/** Optional overrides keyed by catalog id (or set `"scale"` in catalog.json). */
export const CRAFT_SCALE_BY_ID: Record<string, number> = {
  // necklace_apatite: 1.35,
  // necklace_peridot: 1.25,
  // 'earring-gold': 1.15,
  // 'earring-silver': 1.15,
  // rose_quartz: 1.1,
}

export function resolveCraftScale(el: {
  catalogId: string
  kind: ElementKind
  shape: ShapeKind
  /** From catalog.json `"scale"` when set. */
  scale?: number
}): number {
  if (typeof el.scale === 'number' && Number.isFinite(el.scale) && el.scale > 0) {
    return el.scale
  }
  const byId = CRAFT_SCALE_BY_ID[el.catalogId]
  if (typeof byId === 'number' && Number.isFinite(byId) && byId > 0) {
    return byId
  }
  if (el.kind === 'jewellery') return CRAFT_SCALE_DEFAULTS.jewellery
  if (el.shape === 'ring') return CRAFT_SCALE_DEFAULTS.ring
  return CRAFT_SCALE_DEFAULTS.default
}
