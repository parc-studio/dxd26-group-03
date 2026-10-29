import {
  bounceWalls,
  resolveBodyCollisions,
  type PhysicsBody,
  type PlayfieldBounds,
} from './craftPhysics'
import { MERGE_BURST_MS } from './mergeTiming'

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

type Positions = Record<string, { x: number; y: number }>

/** Grow-in start size: matches craft-explode-grow in CraftElement.css. */
const GROW_FROM = 0.15

/** Collision passes per frame, and on the last frame to leave nothing touching. */
const PUSH_PASSES = 2
const FINAL_PASSES = 10

/**
 * The merge burst as one smooth move: the parents glide from the merge point
 * to their spot (`to`) on an ease-in-out curve, growing meanwhile, and push
 * the other pieces aside as they reach them, frame by frame. They pass
 * through the new piece they burst out of (`sourceId`), which can grow in at
 * the same pace (`growSource`) and push its neighbours away too. Hit radii
 * grow with the pieces (same curve as the CSS grow), so a push starts when
 * the pieces visibly touch. Positions are craft-space percents. Returns a
 * cancel function.
 */
export function runParentBurst(options: {
  mid: { x: number; y: number }
  parents: { id: string; to: { x: number; y: number } }[]
  /** Everything else on the board; pinned pieces stay put. */
  others: { id: string; x: number; y: number; pinned?: boolean }[]
  sourceId?: string
  /** The new piece grows in with the parents (not when it shows later). */
  growSource?: boolean
  spaceWidthPx: number
  spaceHeightPx: number
  playfield: PlayfieldBounds
  durationMs?: number
  onFrame: (positions: Positions) => void
  onDone: () => void
}): () => void {
  const {
    mid,
    parents,
    others,
    sourceId,
    growSource = false,
    spaceWidthPx: w,
    spaceHeightPx: h,
    playfield,
    durationMs = MERGE_BURST_MS,
    onFrame,
    onDone,
  } = options

  const parentIds = new Set(parents.map((p) => p.id))
  const burstIds = new Set(parentIds)
  if (sourceId) burstIds.add(sourceId)
  const passThrough = (aId: string, bId: string) =>
    burstIds.has(aId) && burstIds.has(bId)

  // parents are driven along their path (pinned: they push, aren't pushed)
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

  const source =
    growSource && sourceId ? state.find((s) => s.id === sourceId) : undefined

  const settle = (passes: number) => {
    for (let i = 0; i < passes; i++) {
      resolveBodyCollisions(state, w, h, passThrough)
      bounceWalls(state, playfield)
    }
    // pushes are positional only: no velocity carried between frames
    for (const s of state) {
      s.vx = 0
      s.vy = 0
    }
  }

  const emit = () => {
    const positions: Positions = {}
    for (const s of state) positions[s.id] = { x: s.x, y: s.y }
    onFrame(positions)
  }

  let raf = 0
  let finished = false
  const started = performance.now()

  const tick = (now: number) => {
    if (finished) return
    const t = Math.min(1, (now - started) / durationMs)
    const k = easeInOut(t)
    const scale = GROW_FROM + (1 - GROW_FROM) * k
    parents.forEach((p, i) => {
      parentBodies[i].x = mid.x + (p.to.x - mid.x) * k
      parentBodies[i].y = mid.y + (p.to.y - mid.y) * k
      parentBodies[i].scale = scale
    })
    if (source) source.scale = scale
    settle(t < 1 ? PUSH_PASSES : FINAL_PASSES)
    emit()
    if (t < 1) {
      raf = requestAnimationFrame(tick)
      return
    }
    finished = true
    onDone()
  }

  raf = requestAnimationFrame(tick)

  return () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
  }
}
