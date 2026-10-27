export type ElementCategory =
  | 'beads'
  | 'stones'
  | 'gold'
  | 'silver'
  | 'chains'
  | 'jewellery'

export type ShapeKind = 'circle' | 'rect' | 'diamond' | 'oval' | 'link'

export type ElementKind = 'material' | 'mid' | 'jewellery'

/** Catalog definition (shared type for every instance of this material/piece). */
export interface CatalogElement {
  id: string
  label: string
  category: ElementCategory
  shape: ShapeKind
  kind: ElementKind
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
  x: number
  y: number
}

export interface MergeBurstState {
  id: string
  x: number
  y: number
}
