/**
 * Android-first shake detection via `devicemotion`.
 *
 * Secure context: many Chromium builds only deliver motion on HTTPS (or
 * localhost). Plain `http://LAN-IP` often gets zero events — use the Vite
 * HTTPS LAN URL, or the on-screen Shake / long-press-logo debug trigger.
 *
 * iOS follow-up: Safari 13+ needs `DeviceMotionEvent.requestPermission()`
 * from a user gesture before events fire. `getDeviceMotionPermissionApi()`
 * is ready for an “Enable shake” control; we do not prompt on load yet.
 */

export interface ShakeDetectOptions {
  /** Peak Δacceleration that counts as a shake sample. */
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
  /** Called on every above-threshold sample (live jostle kicks). */
  onShakePulse?: (intensity: number) => void
}

type DeviceMotionPermission = 'granted' | 'denied' | 'prompt'

interface DeviceMotionEventWithPermission {
  requestPermission?: () => Promise<DeviceMotionPermission>
}

const LOG = '[craft-shake]'

function readAccel(event: DeviceMotionEvent): {
  ax: number
  ay: number
  az: number
  source: 'linear' | 'gravity'
} | null {
  const linear = event.acceleration
  const grav = event.accelerationIncludingGravity

  const lx = linear?.x
  const ly = linear?.y
  const lz = linear?.z
  if (lx != null && ly != null && lz != null) {
    // Some Androids report linear as all zeros forever — treat as missing.
    if (Math.abs(lx) + Math.abs(ly) + Math.abs(lz) > 0.01) {
      return { ax: lx, ay: ly, az: lz, source: 'linear' }
    }
  }

  const gx = grav?.x
  const gy = grav?.y
  const gz = grav?.z
  if (gx != null && gy != null && gz != null) {
    return { ax: gx, ay: gy, az: gz, source: 'gravity' }
  }

  return null
}

export function attachShakeListener(options: ShakeDetectOptions): () => void {
  // Soft defaults — previous 18 was too stiff on some Android phones.
  const threshold = options.threshold ?? 7
  const minSamples = options.minSamples ?? 2
  const windowMs = options.windowMs ?? 900
  const cooldownMs = options.cooldownMs ?? 1800
  const sampleIntervalMs = options.sampleIntervalMs ?? 50

  let lastX = 0
  let lastY = 0
  let lastZ = 0
  let hasSample = false
  let lastSampleAt = 0
  let cooldownUntil = 0
  let sawEvent = false
  let loggedSource: string | null = null
  const hits: number[] = []

  const secure = typeof window.isSecureContext === 'boolean' ? window.isSecureContext : true
  console.info(LOG, 'listener attached', {
    secureContext: secure,
    protocol: window.location.protocol,
    host: window.location.host,
    threshold,
    minSamples,
    hasDeviceMotion:
      typeof window.DeviceMotionEvent !== 'undefined',
    iOSPermissionApi: Boolean(getDeviceMotionPermissionApi()),
  })
  if (!secure) {
    console.warn(
      LOG,
      'NOT a secure context — DeviceMotion is often blocked. Prefer https://LAN:5173 (self-signed) or use the Shake debug button / long-press logo.',
    )
  }

  const onMotion = (event: DeviceMotionEvent) => {
    if (!sawEvent) {
      sawEvent = true
      console.info(LOG, 'first devicemotion event received')
    }

    const sample = readAccel(event)
    if (!sample) return

    const { ax, ay, az, source } = sample
    if (loggedSource !== source) {
      loggedSource = source
      console.info(LOG, `using acceleration source: ${source}`)
    }

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

    const dx = ax - lastX
    const dy = ay - lastY
    const dz = az - lastZ
    lastX = ax
    lastY = ay
    lastZ = az

    const intensity = Math.abs(dx) + Math.abs(dy) + Math.abs(dz)
    if (intensity < threshold) return

    console.debug(LOG, 'pulse', intensity.toFixed(1))
    options.onShakePulse?.(intensity)

    hits.push(now)
    while (hits.length && now - hits[0]! > windowMs) hits.shift()

    if (hits.length < minSamples) return
    if (now < cooldownUntil) return

    cooldownUntil = now + cooldownMs
    hits.length = 0
    console.info(LOG, 'SHAKE FIRED', { intensity: Number(intensity.toFixed(1)) })
    options.onShake()
  }

  window.addEventListener('devicemotion', onMotion)

  // If no event arrives quickly, surface a hint (common on http LAN / iOS).
  const watchdog = window.setTimeout(() => {
    if (!sawEvent) {
      console.warn(
        LOG,
        'no devicemotion after 3s — motion blocked, permission missing (iPhone), or sensors off. Use Shake button / long-press logo to test jostle+reset.',
      )
    }
  }, 3000)

  return () => {
    window.clearTimeout(watchdog)
    window.removeEventListener('devicemotion', onMotion)
    console.info(LOG, 'listener detached')
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
