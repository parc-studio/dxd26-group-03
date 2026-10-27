/**
 * Jewellery merge choreography timings (easy to tweak).
 * Mid merges skip this sequence entirely.
 */
export const MERGE_CONVERGE_MS = 320
/** Peak flash punch before the product starts to read clearly. */
export const MERGE_PUNCH_MS = 300
/** Flash eases out while the new jewellery reveals. */
export const MERGE_REVEAL_MS = 800

export const MERGE_JEWELLERY_MS =
  MERGE_CONVERGE_MS + MERGE_PUNCH_MS + MERGE_REVEAL_MS
