import raw from './catalog.json'
import type {
  AppointmentPair,
  CatalogElement,
  CraftInstance,
  Recipe,
} from '../types'

const catalog = raw as {
  elements: CatalogElement[]
  recipes: Recipe[]
  starters: { catalogId: string; x: number; y: number }[]
  appointmentPairs?: AppointmentPair[]
}

const byId = new Map(catalog.elements.map((el) => [el.id, el]))

/** Undirected recipe lookup: sorted pair key → result catalog id */
const recipeMap = new Map<string, string>()
for (const recipe of catalog.recipes) {
  const key = [recipe.a, recipe.b].sort().join('::')
  recipeMap.set(key, recipe.result)
}

/** Thin rings that book an appointment with every stone, rather than crafting. */
const THIN_RING_IDS = ['ring_thin_silver', 'ring_thin_gold'] as const

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::')
}

/** Undirected appointment-CTA pairs (overlap allowed, no product merge). */
const appointmentPairSet = new Set<string>()
for (const pair of catalog.appointmentPairs ?? []) {
  appointmentPairSet.add(pairKey(pair.a, pair.b))
}

// Every gem/stone pairs with both thin rings, even if a catalog line is missing.
for (const el of catalog.elements) {
  if (el.category !== 'stones') continue
  for (const ringId of THIN_RING_IDS) {
    appointmentPairSet.add(pairKey(el.id, ringId))
  }
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
  return recipeMap.get(pairKey(a, b)) ?? null
}

/** True when this pair should overlap and prompt “book an appointment”. */
export function isAppointmentPair(a: string, b: string): boolean {
  if (a === b) return false
  // A real recipe wins over the appointment CTA.
  if (recipeMap.has(pairKey(a, b))) return false
  return appointmentPairSet.has(pairKey(a, b))
}

/**
 * Pairs that may sit on top of each other (no bounce/separation):
 * valid recipes and appointment/booking combinations.
 */
export function allowsCraftOverlap(a: string, b: string): boolean {
  if (a === b) return false
  return Boolean(findRecipeResult(a, b)) || isAppointmentPair(a, b)
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
    scale: def.scale,
    inset: def.inset,
    insetPosition: def.insetPosition,
    insetSize: def.insetSize,
    insetImagePosition: def.insetImagePosition,
    insetImageSize: def.insetImageSize,
    rotation: def.category === 'stones' ? Math.random() * 360 : undefined,
    x,
    y,
  }
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

function jitterPct(value: number, amount = 5): number {
  const next = value + (Math.random() * 2 - 1) * amount
  return Math.min(90, Math.max(10, next))
}

/**
 * Scatter starters across the playfield with mixed categories
 * (shuffle ids onto shuffled/jittered slots so chains/gems/rings don't clump).
 */
export function createStarterInstances(): CraftInstance[] {
  // Finished jewellery only appears after a successful jewellery merge.
  const materialStarters = catalog.starters.filter((s) => {
    const def = byId.get(s.catalogId)
    return Boolean(def && def.kind !== 'jewellery')
  })

  const ids = shuffleInPlace(materialStarters.map((s) => s.catalogId))
  const slots = shuffleInPlace(
    materialStarters.map((s) => ({
      x: jitterPct(s.x),
      y: jitterPct(s.y),
    })),
  )

  return ids
    .map((catalogId, i) => {
      const slot = slots[i] ?? { x: 50, y: 50 }
      return spawnInstance(catalogId, slot.x, slot.y)
    })
    .filter((el): el is CraftInstance => el !== null)
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

  for (const pair of catalog.appointmentPairs ?? []) {
    for (const id of [pair.a, pair.b]) {
      if (!elementIds.has(id)) {
        errors.push(`appointmentPair references missing element ${id}`)
      }
    }
    const key = pairKey(pair.a, pair.b)
    if (recipeMap.has(key)) {
      errors.push(`appointmentPair ${key} also has a recipe — remove one`)
    }
  }

  const stoneIds = catalog.elements
    .filter((el) => el.category === 'stones')
    .map((el) => el.id)
  for (const stoneId of stoneIds) {
    for (const ringId of THIN_RING_IDS) {
      const key = pairKey(stoneId, ringId)
      const listed = (catalog.appointmentPairs ?? []).some(
        (pair) => pairKey(pair.a, pair.b) === key,
      )
      if (!listed) {
        errors.push(
          `stone ${stoneId} missing appointment pair with ${ringId}`,
        )
      }
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
export const APPOINTMENT_PAIRS = catalog.appointmentPairs ?? []
