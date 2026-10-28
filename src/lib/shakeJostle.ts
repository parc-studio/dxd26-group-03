import {
  bounceWalls,
  clampToPlayfield,
  resolveBodyCollisions,
  type PhysicsBody,
  type PlayfieldBounds,
} from './craftPhysics'

const JOSTLE_SPEED_PX = 520
const JOSTLE_DAMPING = 3.4
const JOSTLE_MAX_MS = 900
const JOSTLE_STOP_SPEED_PX = 28
const KICK_SPEED_PX = 380

function randomUnit(): { x: number; y: number } {
  const a = Math.random() * Math.PI * 2
  return { x: Math.cos(a), y: Math.sin(a) }
}

/**
 * Scatter craft pieces with the shared physics integrator (walls + collisions).
 * Call `kick()` while the phone is still shaking to re-impulse bodies.
 */
export function runShakeJostle(options: {
  bodies: { id: string; x: number; y: number }[]
  spaceWidthPx: number
  spaceHeightPx: number
  playfield: PlayfieldBounds
  onFrame: (positions: Record<string, { x: number; y: number }>) => void
  onDone: () => void
}): { cancel: () => void; kick: (intensity?: number) => void } {
  const {
    bodies,
    spaceWidthPx,
    spaceHeightPx,
    playfield,
    onFrame,
    onDone,
  } = options

  const w = Math.max(1, spaceWidthPx)
  const h = Math.max(1, spaceHeightPx)
  const speed0 = (JOSTLE_SPEED_PX / w) * 100

  const state: PhysicsBody[] = bodies.map((b) => {
    const dir = randomUnit()
    const c = clampToPlayfield(b.x, b.y, playfield)
    return {
      id: b.id,
      x: c.x,
      y: c.y,
      vx: dir.x * speed0 * (0.65 + Math.random() * 0.55),
      vy: dir.y * speed0 * (0.65 + Math.random() * 0.55),
    }
  })

  let raf = 0
  let last = performance.now()
  const started = last
  let finished = false
  /** Keep simulating a bit longer after a late kick. */
  let holdUntil = started + JOSTLE_MAX_MS

  const emit = () => {
    const positions: Record<string, { x: number; y: number }> = {}
    for (const s of state) {
      positions[s.id] = { x: s.x, y: s.y }
    }
    onFrame(positions)
  }

  const finish = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(raf)
    for (const s of state) {
      const c = clampToPlayfield(s.x, s.y, playfield)
      s.x = c.x
      s.y = c.y
      s.vx = 0
      s.vy = 0
    }
    for (let i = 0; i < 5; i++) {
      resolveBodyCollisions(state, w, h)
      bounceWalls(state, playfield)
    }
    emit()
    onDone()
  }

  const kick = (intensity = 18) => {
    if (finished) return
    const scale = Math.min(1.6, 0.7 + intensity / 40)
    const kickSpeed = ((KICK_SPEED_PX * scale) / w) * 100
    for (const s of state) {
      const dir = randomUnit()
      s.vx += dir.x * kickSpeed
      s.vy += dir.y * kickSpeed
    }
    holdUntil = Math.max(holdUntil, performance.now() + 420)
  }

  const tick = (now: number) => {
    if (finished) return
    const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000))
    last = now

    const damp = Math.exp(-JOSTLE_DAMPING * dt)
    let maxSpeedPx = 0

    for (const s of state) {
      s.vx *= damp
      s.vy *= damp
      s.x += s.vx * dt
      s.y += s.vy * dt
    }

    resolveBodyCollisions(state, w, h)
    bounceWalls(state, playfield)

    for (const s of state) {
      maxSpeedPx = Math.max(
        maxSpeedPx,
        Math.hypot((s.vx / 100) * w, (s.vy / 100) * h),
      )
    }

    emit()

    if (maxSpeedPx < JOSTLE_STOP_SPEED_PX && now >= holdUntil) {
      finish()
      return
    }
    if (now - started > JOSTLE_MAX_MS * 2.2) {
      finish()
      return
    }

    raf = requestAnimationFrame(tick)
  }

  emit()
  raf = requestAnimationFrame(tick)

  return {
    cancel: () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
    },
    kick,
  }
}
