/**
 * Android-first shake detection via `devicemotion`.
 *
 * iOS follow-up (not implemented yet):
 * Safari 13+ requires a user gesture to call
 * `DeviceMotionEvent.requestPermission()` before events fire.
 * Wire that behind an explicit “Enable shake” control; do not prompt
 * on load. Until then, attach the listener anyway — Android Chrome
 * delivers events without a permission prompt.
 */

export interface ShakeDetectOptions {
  /** Peak delta (sum of |Δax|+|Δay|+|Δaz|) that counts as a shake sample. */
  threshold?: number
  /** Min samples above threshold within the window to confirm a shake. */
  minSamples?: number
  /** Sliding window for counting samples (ms). */
  windowMs?: number
  /** Ignore new confirmations for this long after one fires (ms). */
  cooldownMs?: number
  /** Min ms between acceleration samples. */
  sampleIntervalMs?: number
  /** Called when a shake burst is confirmed. */
  onShake: () => void
  /**
   * Called on every above-threshold sample while listening
   * (for live jostle kicks during an ongoing shake).
   */
  onShakePulse?: (intensity: number) => void
}

type DeviceMotionPermission = 'granted' | 'denied' | 'prompt'

interface DeviceMotionEventWithPermission {
  requestPermission?: () => Promise<DeviceMotionPermission>
}

export function attachShakeListener(options: ShakeDetectOptions): () => void {
  const threshold = options.threshold ?? 18
  const minSamples = options.minSamples ?? 2
  const windowMs = options.windowMs ?? 600
  const cooldownMs = options.cooldownMs ?? 2200
  const sampleIntervalMs = options.sampleIntervalMs ?? 80

  let lastX = 0
  let lastY = 0
  let lastZ = 0
  let hasSample = false
  let lastSampleAt = 0
  let cooldownUntil = 0
  const hits: number[] = []

  const onMotion = (event: DeviceMotionEvent) => {
    // Prefer linear acceleration; fall back to including-gravity deltas.
    const linear = event.acceleration
    const grav = event.accelerationIncludingGravity
    const ax = linear?.x ?? grav?.x
    const ay = linear?.y ?? grav?.y
    const az = linear?.z ?? grav?.z
    if (ax == null || ay == null || az == null) return

    const now = performance.now()
    if (now - lastSampleAt < sampleIntervalMs) return
    lastSampleAt = now

    if (!hasSample) {
      lastX = ax
      lastY = ay
      lastZ = az
      hasSample = true
      return
    }

    const intensity =
      Math.abs(ax - lastX) + Math.abs(ay - lastY) + Math.abs(az - lastZ)
    lastX = ax
    lastY = ay
    lastZ = az

    if (intensity < threshold) return

    options.onShakePulse?.(intensity)

    hits.push(now)
    while (hits.length && now - hits[0]! > windowMs) hits.shift()

    if (hits.length < minSamples) return
    if (now < cooldownUntil) return

    cooldownUntil = now + cooldownMs
    hits.length = 0
    options.onShake()
  }

  window.addEventListener('devicemotion', onMotion)

  return () => {
    window.removeEventListener('devicemotion', onMotion)
  }
}

/**
 * iOS-only helper for a future “Enable shake” control.
 * Returns null when the browser does not gate motion behind permission.
 */
export function getDeviceMotionPermissionApi():
  | (() => Promise<DeviceMotionPermission>)
  | null {
  const Ctor = DeviceMotionEvent as unknown as DeviceMotionEventWithPermission
  return typeof Ctor.requestPermission === 'function'
    ? () => Ctor.requestPermission!()
    : null
}
