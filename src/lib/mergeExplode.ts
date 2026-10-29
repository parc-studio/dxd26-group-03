import {
  bounceWalls,
  hitRadius,
  resolveBodyCollisions,
  type PhysicsBody,
  type PlayfieldBounds,
} from './craftPhysics'
import { MERGE_BURST_MS, MERGE_EMERGE_MS } from './mergeTiming'

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y)
  if (len < 1e-6) return { x: 1, y: 0 }
  return { x: x / len, y: y / len }
}

/**
 * Build opposing fly-apart directions from the approach vector
 * (or a random axis if the approach is tiny), with a little perpendicular jitter.
 */
export function opposingExplodeDirs(
  approachX: number,
  approachY: number,
): [{ x: number; y: number }, { x: number; y: number }] {
  const base =
    Math.hypot(approachX, approachY) < 0.08
      ? (() => {
          const a = Math.random() * Math.PI * 2
          return { x: Math.cos(a), y: Math.sin(a) }
        })()
      : normalize(approachX, approachY)

  const perp = { x: -base.y, y: base.x }
  const jitter = (Math.random() - 0.5) * 0.4
  const a = normalize(base.x + perp.x * jitter, base.y + perp.y * jitter)
  return [a, { x: -a.x, y: -a.y }]
}

/** Cubic ease-in-out: slow start, quick middle, soft landing. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Sine ease-out: starts at once (gently), slows to a soft landing. */
function easeOutSine(t: number): number {
  return Math.sin((Math.PI * t) / 2)
}

type Positions = Record<string, { x: number; y: number }>

/** A running merge burst. */
export interface BurstControl {
  /** Stop where it is. */
  cancel: () => void
  /** Jump to its end at once (last frame, then `onDone`). */
  finish: () => void
}

/**
 * Grow curve, start size, fade-in end (share of the move) and length: match
 * craft-explode-grow and craft-emerge (soft) in CraftElement.css. Pushed
 * pieces move at most `pushPxPerMs`, so a push is a glide, never a jump.
 * With `travel` the parents glide out of the merge point to their spot;
 * without it they sit on their spot from the start and only grow there.
 */
const BURST = {
  ease: easeInOut,
  growFrom: 0.15,
  fadeUntil: 0.25,
  durationMs: MERGE_BURST_MS,
  pushPxPerMs: 0.6,
  travel: true,
}
const EMERGE = {
  ease: easeOutSine,
  growFrom: 0.15,
  fadeUntil: 0.25,
  durationMs: MERGE_EMERGE_MS,
  pushPxPerMs: 0.12,
  travel: false,
}

/** Collision passes per frame, and on the last frame to leave nothing touching. */
const PUSH_PASSES = 4
const FINAL_PASSES = 10

/** Smallest hit size, so pieces still on one point never divide by zero. */
const MIN_HIT = 0.01

/**
 * The merge burst as one smooth move: the new piece (`sourceId`) and its two
 * parents all grow out of the merge point together, on one ease-in-out curve
 * (same as the CSS grow). The new piece stays on that point; the parents
 * glide out to their spot (`to`), never inside the growing new piece nor
 * each other (they ride its edge until their path takes over), and the three
 * push the other pieces aside as they reach them, frame by frame. Hit radii
 * grow from nothing as the pieces grow and fade in, so nothing is pushed by
 * a piece not yet seen, and pushed pieces glide (no jump, no back-and-forth
 * when caught between two). Soft (under the reveal's blur), nothing comes
 * out of the merge point: the new piece and both parents just grow where
 * they stand, the parents already on their spot, slowly pushing the board
 * aside. Positions are craft-space percents. Returns its controls.
 */
export function runParentBurst(options: {
  mid: { x: number; y: number }
  parents: { id: string; to: { x: number; y: number } }[]
  /** Everything else on the board; pinned pieces stay put. */
  others: { id: string; x: number; y: number; pinned?: boolean }[]
  sourceId?: string
  /** The slow, discreet version (under the reveal's blur): grow in place. */
  soft?: boolean
  spaceWidthPx: number
  spaceHeightPx: number
  playfield: PlayfieldBounds
  onFrame: (positions: Positions) => void
  onDone: () => void
}): BurstControl {
  const {
    mid,
    parents,
    others,
    sourceId,
    soft = false,
    spaceWidthPx: w,
    spaceHeightPx: h,
    playfield,
    onFrame,
    onDone,
  } = options
  const { ease, growFrom, fadeUntil, durationMs, pushPxPerMs, travel } = soft
    ? EMERGE
    : BURST

  const parentIds = new Set(parents.map((p) => p.id))

  // the burst pieces are driven (pinned: they push, aren't pushed)
  const parentBodies: PhysicsBody[] = parents.map((p) => ({
    id: p.id,
    x: mid.x,
    y: mid.y,
    vx: 0,
    vy: 0,
    pinned: true,
  }))
  const state: PhysicsBody[] = [
    ...parentBodies,
    ...others
      .filter((o) => !parentIds.has(o.id))
      .map((o) => ({
        id: o.id,
        x: o.x,
        y: o.y,
        vx: 0,
        vy: 0,
        pinned: Boolean(o.pinned) || o.id === sourceId,
      })),
  ]

  const source = sourceId ? state.find((s) => s.id === sourceId) : undefined
  // everything grows out of the new piece's centre
  const centre = source ? { x: source.x, y: source.y } : mid
  const burst = source ? [...parentBodies, source] : parentBodies

  // each parent's path from the centre, in px (the hit circles are px-round)
  const paths = parents.map((p) => {
    const dx = ((p.to.x - centre.x) / 100) * w
    const dy = ((p.to.y - centre.y) / 100) * h
    const dir = normalize(dx, dy)
    return {
      dir,
      length: Math.hypot(dx, dy),
      // contact distance with the new piece at full size
      contact: source ? hitRadius(source.id) + hitRadius(p.id) : 0,
    }
  })

  /** The burst pieces make room for each other (the new piece stays put). */
  const spreadBurst = () => {
    for (const b of parentBodies) b.pinned = false
    for (let i = 0; i < PUSH_PASSES; i++) resolveBodyCollisions(burst, w, h)
    for (const b of parentBodies) b.pinned = true
  }

  const settle = (passes: number, maxStepPx: number) => {
    const before = state.map((s) => ({ x: s.x, y: s.y }))
    for (let i = 0; i < passes; i++) {
      resolveBodyCollisions(state, w, h)
      bounceWalls(state, playfield)
    }
    state.forEach((s, i) => {
      // pushes are positional only: no velocity carried between frames
      s.vx = 0
      s.vy = 0
      if (s.pinned) return
      // a pushed piece glides toward its new spot, never jumps
      const from = before[i]
      const step = Math.hypot(
        ((s.x - from.x) / 100) * w,
        ((s.y - from.y) / 100) * h,
      )
      if (step <= maxStepPx) return
      const f = maxStepPx / step
      s.x = from.x + (s.x - from.x) * f
      s.y = from.y + (s.y - from.y) * f
    })
  }

  const emit = () => {
    const positions: Positions = {}
    for (const s of state) positions[s.id] = { x: s.x, y: s.y }
    onFrame(positions)
  }

  /** The move at time `t` (0 to 1), `dt` ms after the previous frame. */
  const frame = (t: number, dt: number) => {
    const k = ease(t)
    // hit size: drawn size × how far faded in (a faint piece barely pushes)
    const scale = growFrom + (1 - growFrom) * k
    const hit = Math.max(MIN_HIT, scale * ease(Math.min(1, t / fadeUntil)))
    paths.forEach((path, i) => {
      // along its path (or already on its spot, growing in place), but
      // pushed out by the new piece growing under it
      const dist = Math.max(path.length * (travel ? k : 1), path.contact * hit)
      parentBodies[i].x = centre.x + ((path.dir.x * dist) / w) * 100
      parentBodies[i].y = centre.y + ((path.dir.y * dist) / h) * 100
      parentBodies[i].scale = hit
    })
    if (source) source.scale = hit
    spreadBurst()
    if (t < 1) settle(PUSH_PASSES, pushPxPerMs * dt)
    else settle(FINAL_PASSES, Infinity)
    emit()
  }

  let raf = 0
  let finished = false
  const started = performance.now()
  let last = started

  const tick = (now: number) => {
    if (finished) return
    const t = Math.min(1, Math.max(0, (now - started) / durationMs))
    const dt = Math.max(0, now - last)
    last = now
    frame(t, dt)
    if (t < 1) {
      raf = requestAnimationFrame(tick)
      return
    }
    finished = true
    onDone()
  }

  raf = requestAnimationFrame(tick)

  return {
    cancel: () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
    },
    finish: () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
      // its last frame, now: final spots, full size, nothing touching
      frame(1, 0)
      onDone()
    },
  }
}
