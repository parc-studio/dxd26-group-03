/**
 * Android-first shake detection via `devicemotion`.
 *
 * Tune sensitivity here (exported constants below):
 *   SHAKE_THRESHOLD      — peak linear |a| in m/s² (rest noise ~0.5–2; real shake ≫)
 *   SHAKE_COUNT          — spikes required inside SHAKE_WINDOW_MS
 *   SHAKE_WINDOW_MS      — multi-peak window
 *   SHAKE_COOLDOWN_MS    — one confirmed shake → one reset (debounce)
 *   SHAKE_MIN_SPIKE_GAP_MS — min gap between counted spikes (same peak ≠ 2)
 *
 * Secure context: Chromium often blocks motion on plain http://LAN — use HTTPS.
 * iOS: still needs DeviceMotionEvent.requestPermission() from a user gesture.
 */

/** Peak linear acceleration magnitude (m/s²) to count as a spike. */
export const SHAKE_THRESHOLD = 14

/** How many spikes must land inside SHAKE_WINDOW_MS. */
export const SHAKE_COUNT = 4

/** Sliding window for counting spikes (ms). */
export const SHAKE_WINDOW_MS = 750

/** After a fire, ignore further shakes this long (ms). */
export const SHAKE_COOLDOWN_MS = 3500

/** Min time between samples we inspect (ms). */
export const SHAKE_SAMPLE_MS = 40

/** Min time between two counted spikes so one peak isn’t double-counted. */
export const SHAKE_MIN_SPIKE_GAP_MS = 70

export interface ShakeDetectOptions {
  threshold?: number
  minSamples?: number
  windowMs?: number
  cooldownMs?: number
  sampleIntervalMs?: number
  minSpikeGapMs?: number
  /** When true, ignore motion (e.g. finger is dragging a craft piece). */
  isSuppressed?: () => boolean
  onShake: () => void
  /**
   * Only invoked after a shake has been confirmed and while a jostle may
   * still be running — never used to start motion from a single noisy sample.
   */
  onShakePulse?: (intensity: number) => void
}

type DeviceMotionPermission = 'granted' | 'denied' | 'prompt'

interface DeviceMotionEventWithPermission {
  requestPermission?: () => Promise<DeviceMotionPermission>
}

const LOG = '[craft-shake]'

/**
 * Prefer true linear acceleration. If the device only exposes
 * accelerationIncludingGravity, high-pass it so gravity (~9.8) drops out.
 */
function readLinearAccel(event: DeviceMotionEvent): {
  ax: number
  ay: number
  az: number
  source: 'linear' | 'gravity-hp'
} | null {
  const linear = event.acceleration
  const lx = linear?.x
  const ly = linear?.y
  const lz = linear?.z
  if (lx != null && ly != null && lz != null) {
    if (Math.abs(lx) + Math.abs(ly) + Math.abs(lz) > 0.05) {
      return { ax: lx, ay: ly, az: lz, source: 'linear' }
    }
  }

  const grav = event.accelerationIncludingGravity
  const gx = grav?.x
  const gy = grav?.y
  const gz = grav?.z
  if (gx == null || gy == null || gz == null) return null
  return { ax: gx, ay: gy, az: gz, source: 'gravity-hp' }
}

export function attachShakeListener(options: ShakeDetectOptions): () => void {
  const threshold = options.threshold ?? SHAKE_THRESHOLD
  const minSamples = options.minSamples ?? SHAKE_COUNT
  const windowMs = options.windowMs ?? SHAKE_WINDOW_MS
  const cooldownMs = options.cooldownMs ?? SHAKE_COOLDOWN_MS
  const sampleIntervalMs = options.sampleIntervalMs ?? SHAKE_SAMPLE_MS
  const minSpikeGapMs = options.minSpikeGapMs ?? SHAKE_MIN_SPIKE_GAP_MS

  // Low-pass of including-gravity → high-pass residual ≈ linear accel.
  let lpX = 0
  let lpY = 0
  let lpZ = 0
  let lpReady = false
  const LP_ALPHA = 0.15

  let lastSampleAt = 0
  let lastSpikeAt = -Infinity
  let cooldownUntil = 0
  let sawEvent = false
  let loggedSource: string | null = null
  /** After a confirmed shake, pulses may re-kick an active jostle until cooldown. */
  let pulseArmedUntil = 0
  const spikes: number[] = []

  const secure =
    typeof window.isSecureContext === 'boolean' ? window.isSecureContext : true
  console.info(LOG, 'listener attached', {
    secureContext: secure,
    protocol: window.location.protocol,
    host: window.location.host,
    SHAKE_THRESHOLD: threshold,
    SHAKE_COUNT: minSamples,
    SHAKE_WINDOW_MS: windowMs,
    SHAKE_COOLDOWN_MS: cooldownMs,
  })
  if (!secure) {
    console.warn(
      LOG,
      'NOT a secure context — DeviceMotion is often blocked. Prefer https://LAN:5173 or use the Shake debug button / long-press logo.',
    )
  }

  const onMotion = (event: DeviceMotionEvent) => {
    if (!sawEvent) {
      sawEvent = true
      console.info(LOG, 'first devicemotion event received')
    }

    if (options.isSuppressed?.()) return

    const raw = readLinearAccel(event)
    if (!raw) return

    let { ax, ay, az } = raw
    if (raw.source === 'gravity-hp') {
      if (!lpReady) {
        lpX = ax
        lpY = ay
        lpZ = az
        lpReady = true
        return
      }
      lpX = lpX * (1 - LP_ALPHA) + ax * LP_ALPHA
      lpY = lpY * (1 - LP_ALPHA) + ay * LP_ALPHA
      lpZ = lpZ * (1 - LP_ALPHA) + az * LP_ALPHA
      ax -= lpX
      ay -= lpY
      az -= lpZ
    }

    if (loggedSource !== raw.source) {
      loggedSource = raw.source
      console.info(LOG, `using acceleration source: ${raw.source}`)
    }

    const now = performance.now()
    if (now - lastSampleAt < sampleIntervalMs) return
    lastSampleAt = now

    // Peak linear magnitude (m/s²). Rest noise ≪ threshold; a real shake spikes.
    const intensity = Math.hypot(ax, ay, az)
    if (intensity < threshold) return

    if (now - lastSpikeAt < minSpikeGapMs) return
    lastSpikeAt = now

    spikes.push(now)
    while (spikes.length && now - spikes[0]! > windowMs) spikes.shift()

    console.debug(LOG, 'spike', intensity.toFixed(1), `${spikes.length}/${minSamples}`)

    // Pulses only after a confirmed shake (re-kick during the jostle), never alone.
    if (now < pulseArmedUntil) {
      options.onShakePulse?.(intensity)
    }

    if (spikes.length < minSamples) return
    if (now < cooldownUntil) return

    cooldownUntil = now + cooldownMs
    pulseArmedUntil = now + Math.min(cooldownMs, 1200)
    spikes.length = 0
    console.info(LOG, 'SHAKE FIRED', {
      intensity: Number(intensity.toFixed(1)),
      threshold,
      count: minSamples,
    })
    options.onShake()
  }

  window.addEventListener('devicemotion', onMotion)

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

export function getDeviceMotionPermissionApi():
  | (() => Promise<DeviceMotionPermission>)
  | null {
  const Ctor = DeviceMotionEvent as unknown as DeviceMotionEventWithPermission
  return typeof Ctor.requestPermission === 'function'
    ? () => Ctor.requestPermission!()
    : null
}
