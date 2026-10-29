export type ElementCategory =
  | 'beads'
  | 'stones'
  | 'gold'
  | 'silver'
  | 'chains'
  | 'jewellery'

export type ShapeKind = 'circle' | 'rect' | 'diamond' | 'oval' | 'link' | 'ring'

export type ElementKind = 'material' | 'mid' | 'jewellery'

/** Catalog definition (shared type for every instance of this material/piece). */
export interface CatalogElement {
  id: string
  label: string
  category: ElementCategory
  shape: ShapeKind
  kind: ElementKind
  /** Public path to the Fotini (or result) photo — always set. */
  image: string
  /** Optional crop position for sheet-style photos (CSS background-position). */
  imagePosition?: string
  /** Optional CSS background-size for sheet-style photos. */
  imageSize?: string
  /**
   * Optional craft-board visual scale override (multiplies shape footprint).
   * Prefer `src/data/craftScales.ts` for category defaults / BY_ID map.
   */
  scale?: number
  /** Optional inset photo (bead/stone seated in a ring, or mid accent). */
  inset?: string
  /** Placement of the inset circle inside the shape (CSS left top). */
  insetPosition?: string
  /** Diameter of the inset circle (CSS length, usually %). */
  insetSize?: string
  /** Crop inside the inset photo. */
  insetImagePosition?: string
  insetImageSize?: string
  /** Product sheet copy (jewellery). */
  description?: string
  /** Catalog ids of materials used to craft this piece. */
  ingredients?: string[]
  /** Price in whole currency units (placeholder). */
  price?: number
  /** Figma-style product title shown in the sheet. */
  displayName?: string
  /** Centered materials line under the product image. */
  materialsLine?: string
}

export interface Recipe {
  a: string
  b: string
  result: string
}

/** Combinable-looking pair with no product yet — shows appointment CTA. */
export interface AppointmentPair {
  a: string
  b: string
}

/** Live instance on the craft space. */
export interface CraftInstance {
  instanceId: string
  catalogId: string
  label: string
  category: ElementCategory
  shape: ShapeKind
  kind: ElementKind
  image: string
  imagePosition?: string
  imageSize?: string
  /** Craft-board scale from catalog, when set. */
  scale?: number
  inset?: string
  insetPosition?: string
  insetSize?: string
  insetImagePosition?: string
  insetImageSize?: string
  /** Random tilt in degrees given to stones when they spawn. */
  rotation?: number
  x: number
  y: number
}

export type MergeBurstKind = 'jewellery'

export interface MergeBurstState {
  id: string
  x: number
  y: number
  kind: MergeBurstKind
}

/** Visual phase for parent pieces during a merge. */
export type ParentMergePhase = 'converge' | 'vanish' | 'explode'
