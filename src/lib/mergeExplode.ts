import {
  MERGE_EXPLODE_DAMPING,
  MERGE_EXPLODE_MAX_MS,
  MERGE_EXPLODE_SPEED_PX,
  MERGE_EXPLODE_STOP_SPEED_PX,
  MERGE_PARENT_SPLIT_PX,
} from './mergeTiming'

export interface ExplodeBody {
  id: string
  /** Unit direction of travel. */
  dir: { x: number; y: number }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

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
  let base =
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

/**
 * Integrate two parents outward from `mid` with velocity + exponential damping.
 * Positions are craft-space percents. Calls `onFrame` each tick; `onDone` when settled.
 * Returns a cancel function.
 */
export function runParentExplode(options: {
  mid: { x: number; y: number }
  bodies: ExplodeBody[]
  spaceWidthPx: number
  spaceHeightPx: number
  onFrame: (positions: Record<string, { x: number; y: number }>) => void
  onDone: () => void
}): () => void {
  const {
    mid,
    bodies,
    spaceWidthPx,
    spaceHeightPx,
    onFrame,
    onDone,
  } = options

  const w = Math.max(1, spaceWidthPx)
  const h = Math.max(1, spaceHeightPx)

  // Scale impulse so typical travel lands near MERGE_PARENT_SPLIT_PX.
  const speedScale = MERGE_PARENT_SPLIT_PX / 100
  const speed0 = MERGE_EXPLODE_SPEED_PX * speedScale

  const state = bodies.map((body) => ({
    id: body.id,
    x: mid.x,
    y: mid.y,
    // % / second
    vx: ((body.dir.x * speed0) / w) * 100,
    vy: ((body.dir.y * speed0) / h) * 100,
  }))

  let raf = 0
  let last = performance.now()
  const started = last
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
    const finalPos: Record<string, { x: number; y: number }> = {}
    for (const s of state) {
      finalPos[s.id] = {
        x: clamp(s.x, 8, 92),
        y: clamp(s.y, 12, 90),
      }
    }
    onFrame(finalPos)
    onDone()
  }

  const tick = (now: number) => {
    if (finished) return
    const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000))
    last = now

    const damp = Math.exp(-MERGE_EXPLODE_DAMPING * dt)
    let maxSpeedPx = 0
    const positions: Record<string, { x: number; y: number }> = {}

    for (const s of state) {
      s.vx *= damp
      s.vy *= damp
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.x = clamp(s.x, 8, 92)
      s.y = clamp(s.y, 12, 90)
      positions[s.id] = { x: s.x, y: s.y }

      const speedPx = Math.hypot((s.vx / 100) * w, (s.vy / 100) * h)
      maxSpeedPx = Math.max(maxSpeedPx, speedPx)
    }

    onFrame(positions)

    if (
      maxSpeedPx < MERGE_EXPLODE_STOP_SPEED_PX ||
      now - started > MERGE_EXPLODE_MAX_MS
    ) {
      finish()
      return
    }

    raf = requestAnimationFrame(tick)
  }

  // Emit start pose immediately so the first frame isn't a jump from elsewhere.
  const startPos: Record<string, { x: number; y: number }> = {}
  for (const s of state) startPos[s.id] = { x: s.x, y: s.y }
  onFrame(startPos)

  raf = requestAnimationFrame(tick)

  return () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
  }
}
