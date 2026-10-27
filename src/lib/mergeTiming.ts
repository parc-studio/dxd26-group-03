/**
 * Merge choreography timings + parent explode (easy to tweak).
 */
export const MERGE_CONVERGE_MS = 320
/** Peak flash punch before the product starts to read clearly. */
export const MERGE_PUNCH_MS = 300
/** Flash eases out while the new jewellery reveals. */
export const MERGE_REVEAL_MS = 800

export const MERGE_JEWELLERY_MS =
  MERGE_CONVERGE_MS + MERGE_PUNCH_MS + MERGE_REVEAL_MS

/**
 * Approx travel of each parent from the merge point after the explode
 * (~80–120px+). Used to scale initial velocity; settle is physics-driven.
 */
export const MERGE_PARENT_SPLIT_PX = 100

/** Initial outward speed (px / second) at the explode start. */
export const MERGE_EXPLODE_SPEED_PX = 920

/** Velocity retention per second (friction). Lower = stops sooner. */
export const MERGE_EXPLODE_DAMPING = 5.4

/** Stop integrating when speed falls below this (px / second). */
export const MERGE_EXPLODE_STOP_SPEED_PX = 18

/** Safety cap so a soft explode cannot hang the board. */
export const MERGE_EXPLODE_MAX_MS = 900
