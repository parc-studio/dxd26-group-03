import type { ElementCategory, ElementKind, ShapeKind } from '../types'

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
  default: 0.9,
  ring: 0.8,
  jewellery: 1.7,
  /** earring-gold / earring-silver — Fotini can edit */
  earring: 1.1,
} as const

/** Optional overrides keyed by catalog id (or set `"scale"` in catalog.json). */
export const CRAFT_SCALE_BY_ID: Record<string, number> = {
  // necklace_apatite: 1.35,
  // necklace_peridot: 1.25,
  // rose_quartz: 1.1,
}

function isEarring(el: { catalogId: string; category?: ElementCategory }): boolean {
  return el.category === 'earring' || el.catalogId.startsWith('earring')
}

export function resolveCraftScale(el: {
  catalogId: string
  kind: ElementKind
  shape: ShapeKind
  category?: ElementCategory
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
  if (isEarring(el)) return CRAFT_SCALE_DEFAULTS.earring
  return CRAFT_SCALE_DEFAULTS.default
}
