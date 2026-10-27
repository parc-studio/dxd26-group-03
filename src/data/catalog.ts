import raw from './catalog.json'
import type { CatalogElement, CraftInstance, Recipe } from '../types'

const catalog = raw as {
  elements: CatalogElement[]
  recipes: Recipe[]
  starters: { catalogId: string; x: number; y: number }[]
}

const byId = new Map(catalog.elements.map((el) => [el.id, el]))

/** Undirected recipe lookup: sorted pair key → result catalog id */
const recipeMap = new Map<string, string>()
for (const recipe of catalog.recipes) {
  const key = [recipe.a, recipe.b].sort().join('::')
  recipeMap.set(key, recipe.result)
}

let instanceCounter = 0

export function createInstanceId(): string {
  instanceCounter += 1
  return `inst-${instanceCounter}-${Math.random().toString(36).slice(2, 7)}`
}

export function getCatalogElement(id: string): CatalogElement | undefined {
  return byId.get(id)
}

export function findRecipeResult(a: string, b: string): string | null {
  if (a === b) return null
  return recipeMap.get([a, b].sort().join('::')) ?? null
}

export function spawnInstance(
  catalogId: string,
  x: number,
  y: number,
): CraftInstance | null {
  const def = byId.get(catalogId)
  if (!def) return null
  return {
    instanceId: createInstanceId(),
    catalogId: def.id,
    label: def.label,
    category: def.category,
    shape: def.shape,
    kind: def.kind,
    image: def.image,
    imagePosition: def.imagePosition,
    imageSize: def.imageSize,
    inset: def.inset,
    insetPosition: def.insetPosition,
    insetSize: def.insetSize,
    insetImagePosition: def.insetImagePosition,
    insetImageSize: def.insetImageSize,
    x,
    y,
  }
}

export function createStarterInstances(): CraftInstance[] {
  // Finished jewellery only appears after a successful jewellery merge.
  return catalog.starters
    .map((s) => spawnInstance(s.catalogId, s.x, s.y))
    .filter((el): el is CraftInstance => el !== null && el.kind !== 'jewellery')
}

/** Dev-time alignment check: every recipe id exists; every image path is used. */
export function assertCatalogAligned(knownImageFiles: string[]): string[] {
  const errors: string[] = []
  const elementIds = new Set(catalog.elements.map((e) => e.id))
  const imagePaths = new Set<string>()

  for (const el of catalog.elements) {
    if (!el.image) errors.push(`element ${el.id} missing image`)
    else imagePaths.add(el.image)
    if (el.inset) imagePaths.add(el.inset)
  }

  for (const recipe of catalog.recipes) {
    for (const id of [recipe.a, recipe.b, recipe.result]) {
      if (!elementIds.has(id)) errors.push(`recipe references missing element ${id}`)
    }
  }

  for (const starter of catalog.starters) {
    if (!elementIds.has(starter.catalogId)) {
      errors.push(`starter references missing element ${starter.catalogId}`)
    }
  }

  const normalizedKnown = new Set(
    knownImageFiles.map((f) => (f.startsWith('/') ? f : `/textures/${f}`)),
  )
  for (const path of imagePaths) {
    if (knownImageFiles.length && !normalizedKnown.has(path)) {
      errors.push(`catalog image not on disk: ${path}`)
    }
  }
  for (const known of normalizedKnown) {
    if (![...imagePaths].includes(known)) {
      errors.push(`orphan texture file unused by catalog: ${known}`)
    }
  }

  return errors
}

export interface JewelleryDetail {
  id: string
  label: string
  displayName: string
  materialsLine: string
  image: string
  inset?: string
  insetImagePosition?: string
  insetImageSize?: string
  description: string
  ingredients: { id: string; label: string; image: string }[]
  price: number
}

export function getJewelleryDetail(catalogId: string): JewelleryDetail | null {
  const def = byId.get(catalogId)
  if (!def || def.kind !== 'jewellery') return null
  const ingredients = (def.ingredients ?? []).map((id) => {
    const part = byId.get(id)
    return {
      id,
      label: part?.label ?? id,
      image: part?.image ?? def.image,
    }
  })
  const materialsFallback = ingredients.map((p) => p.label).join(' & ')
  return {
    id: def.id,
    label: def.label,
    displayName: def.displayName ?? def.label,
    materialsLine: def.materialsLine ?? materialsFallback,
    image: def.image,
    inset: def.inset,
    insetImagePosition: def.insetImagePosition,
    insetImageSize: def.insetImageSize,
    description: def.description ?? `A Celestial piece — ${def.label.toLowerCase()}.`,
    ingredients,
    price: def.price ?? 120,
  }
}

export const CATALOG_ELEMENTS = catalog.elements
export const RECIPES = catalog.recipes
