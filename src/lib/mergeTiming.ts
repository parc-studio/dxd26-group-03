/**
 * Merge choreography timings + parent explode (easy to tweak).
 */
/** Parents are sucked into the merge point (speed up + shrink to nothing). */
export const MERGE_CONVERGE_MS = 450
/** Beat between the parents vanishing and the new piece leaving that point. */
export const MERGE_PUNCH_MS = 60
/**
 * After a jewellery merge the parents come back (no explosion) this far (px)
 * either side of the new piece, as the reveal opens over them.
 */
export const MERGE_PARENT_GAP_PX = 90
/** Flash eases out while the new jewellery reveals (longer = smoother fade). */
export const MERGE_REVEAL_MS = 960

export const MERGE_JEWELLERY_MS =
  MERGE_CONVERGE_MS + MERGE_PUNCH_MS + MERGE_REVEAL_MS

/** Full-screen finished-product reveal (veil / 3D / UI). */
export const JEWELLERY_REVEAL_EXIT_MS = 720
/**
 * Closing the reveal: the 3D piece shrinks back to its spot on the board.
 * The flight takes longer the farther it goes (a corner isn't a blink):
 * MIN + PER_PX × distance, capped at MAX.
 */
export const JEWELLERY_REVEAL_RETURN_MIN_MS = 480
export const JEWELLERY_REVEAL_RETURN_PER_PX_MS = 1.1
export const JEWELLERY_REVEAL_RETURN_MAX_MS = 1100

export function jewelleryRevealReturnMs(distancePx: number): number {
  return Math.round(
    Math.min(
      JEWELLERY_REVEAL_RETURN_MAX_MS,
      JEWELLERY_REVEAL_RETURN_MIN_MS +
        JEWELLERY_REVEAL_RETURN_PER_PX_MS * distancePx,
    ),
  )
}
/** End of that flight: the 3D piece fades into the board piece (crossfade). */
export const JEWELLERY_REVEAL_LAND_FADE_MS = 200

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
