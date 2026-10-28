import type { Metal } from '../components/HeroModel'
import { getCatalogElement } from '../data/catalog'

/** GLB for jewellery focus sheet + merge reveal, keyed by catalog id. */
export function jewelleryHeroModelUrl(id: string, metal: Metal): string {
  const base = import.meta.env.BASE_URL
  if (id === 'necklace_apatite') {
    return `${base}necklace1stone-2.glb`
  }
  // necklace_poseidon (and fallback) — metal-swappable chain showcase
  return `${base}chain1-${metal}.glb`
}

/**
 * Infer chain metal from the pieces that were just merged (and their
 * catalog ingredients). Prefer parent craft path over the result's static
 * ingredient list — e.g. silver apatite necklace + peridot → silver GLB
 * even if the two-stone catalog row still mentions gold.
 */
export function resolveJewelleryMetal(...catalogIds: string[]): Metal {
  const seen = new Set<string>()
  const queue = [...catalogIds]

  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)

    if (id.includes('silver')) return 'silver'
    if (id.includes('gold')) {
      // Keep scanning — a silver ancestor should still win if present later.
      continue
    }

    const def = getCatalogElement(id)
    if (def?.category === 'silver') return 'silver'
    if (def?.ingredients?.length) {
      for (const part of def.ingredients) queue.push(part)
    }
  }

  for (const id of seen) {
    if (id.includes('gold')) return 'gold'
    if (getCatalogElement(id)?.category === 'gold') return 'gold'
  }
  return 'gold'
}
