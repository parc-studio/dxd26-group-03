import type { Metal } from '../components/HeroModel'

/** GLB for jewellery focus sheet + merge reveal, keyed by catalog id. */
export function jewelleryHeroModelUrl(id: string, metal: Metal): string {
  const base = import.meta.env.BASE_URL
  if (id === 'necklace_apatite') {
    return `${base}necklace1stone-2.glb`
  }
  // necklace_poseidon (and fallback) — metal-swappable chain showcase
  return `${base}chain1-${metal}.glb`
}
