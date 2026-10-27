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
    x,
    y,
  }
}

export function createStarterInstances(): CraftInstance[] {
  return catalog.starters
    .map((s) => spawnInstance(s.catalogId, s.x, s.y))
    .filter((el): el is CraftInstance => el !== null)
}

export const CATALOG_ELEMENTS = catalog.elements
export const RECIPES = catalog.recipes
