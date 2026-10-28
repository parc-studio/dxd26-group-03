/**
 * Merge choreography timings + parent explode (easy to tweak).
 */
export const MERGE_CONVERGE_MS = 320
/** Peak flash punch before the product starts to read clearly. */
export const MERGE_PUNCH_MS = 300
/** Flash eases out while the new jewellery reveals (longer = smoother fade). */
export const MERGE_REVEAL_MS = 960

export const MERGE_JEWELLERY_MS =
  MERGE_CONVERGE_MS + MERGE_PUNCH_MS + MERGE_REVEAL_MS

/**
 * Multiplier for the jewellery merge flash disc size (CSS `--merge-flash-scale`).
 * 1 = base size in MergeBurst.css; raise for a bigger bloom.
 */
export const MERGE_FLASH_SCALE = 1.22

/**
 * Approx travel of each parent from the merge point after the explode
 * (~80–120px+). Used to scale initial velocity; settle is physics-driven.
 */
export const MERGE_PARENT_SPLIT_PX = 80

/** Initial outward speed (px / second) at the explode start. */
export const MERGE_EXPLODE_SPEED_PX = 500

/** Velocity retention per second (friction). Lower = stops sooner. */
export const MERGE_EXPLODE_DAMPING = 7

/** Stop integrating when speed falls below this (px / second). */
export const MERGE_EXPLODE_STOP_SPEED_PX = 14

/** Safety cap so a soft explode cannot hang the board. */
export const MERGE_EXPLODE_MAX_MS = 900
