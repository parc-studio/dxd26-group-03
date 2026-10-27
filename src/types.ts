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
}

export interface Recipe {
  a: string
  b: string
  result: string
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
  inset?: string
  insetPosition?: string
  insetSize?: string
  insetImagePosition?: string
  insetImageSize?: string
  x: number
  y: number
}

export interface MergeBurstState {
  id: string
  x: number
  y: number
}
