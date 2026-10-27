/**
 * Merge choreography timings + parent split (easy to tweak).
 */
export const MERGE_CONVERGE_MS = 320
/** Peak flash punch before the product starts to read clearly. */
export const MERGE_PUNCH_MS = 300
/** Flash eases out while the new jewellery reveals. */
export const MERGE_REVEAL_MS = 800

export const MERGE_JEWELLERY_MS =
  MERGE_CONVERGE_MS + MERGE_PUNCH_MS + MERGE_REVEAL_MS

/**
 * Horizontal distance from the merge midpoint to each parent after a merge
 * (one left, one right). ~half a craft element / ~36–48px — tweak freely.
 */
export const MERGE_PARENT_SPLIT_PX = 42
