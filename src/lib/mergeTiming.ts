/**
 * Merge choreography timings + parent explode (easy to tweak).
 */
/** Parents are sucked into the merge point (speed up + shrink to nothing). */
export const MERGE_CONVERGE_MS = 450
/** Beat between the parents vanishing and the new piece leaving that point. */
export const MERGE_PUNCH_MS = 60
/**
 * The new jewellery piece slowly grows in on the board, under the reveal's
 * blur, once that blur fully covers the board.
 */
export const MERGE_REVEAL_MS = 1800

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
 * Travel of each parent from the merge point in the burst (px); pieces in
 * the way, or a bigger new piece, can push them a bit farther.
 */
export const MERGE_PARENT_SPLIT_PX = 80

/**
 * The burst: parents grow out of the merge point and glide to their side
 * while the board makes room, all in one ease-in-out move.
 */
export const MERGE_BURST_MS = 1400
