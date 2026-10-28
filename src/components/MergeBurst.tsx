import {
  MERGE_FLASH_SCALE,
  MERGE_PUNCH_MS,
  MERGE_REVEAL_MS,
} from '../lib/mergeTiming'
import type { MergeBurstKind } from '../types'
import './MergeBurst.css'

interface MergeBurstProps {
  x: number
  y: number
  kind?: MergeBurstKind
}

/** Soft jewellery sparkles — radial light points + twinkles (not a flat white disc). */
const SPARKS = Array.from({ length: 26 }, (_, i) => i)
const GLINTS = Array.from({ length: 12 }, (_, i) => i)

export function MergeBurst({ x, y, kind = 'jewellery' }: MergeBurstProps) {
  const totalMs = MERGE_PUNCH_MS + MERGE_REVEAL_MS

  return (
    <div
      className={`merge-burst merge-burst--${kind}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ['--merge-punch-ms' as string]: `${MERGE_PUNCH_MS}ms`,
        ['--merge-reveal-ms' as string]: `${MERGE_REVEAL_MS}ms`,
        ['--merge-flash-ms' as string]: `${totalMs}ms`,
        ['--merge-flash-scale' as string]: String(MERGE_FLASH_SCALE),
      }}
      aria-hidden="true"
    >
      {/* Soft ambient bloom — kept subtle so sparks read as the main event */}
      <span className="merge-burst__bloom" />
      {SPARKS.map((i) => (
        <span
          key={`s-${i}`}
          className={`merge-burst__spark${i % 3 === 0 ? ' merge-burst__spark--star' : ''}`}
          style={{
            ['--a' as string]: `${(360 / SPARKS.length) * i + (i % 2) * 7}deg`,
            ['--d' as string]: `${28 + (i % 5) * 14}px`,
            animationDelay: `${i * 12}ms`,
          }}
        />
      ))}
      {GLINTS.map((i) => (
        <span
          key={`g-${i}`}
          className="merge-burst__glint"
          style={{
            ['--gx' as string]: `${Math.cos((i / GLINTS.length) * Math.PI * 2) * (18 + (i % 3) * 10)}px`,
            ['--gy' as string]: `${Math.sin((i / GLINTS.length) * Math.PI * 2) * (14 + (i % 4) * 8)}px`,
            animationDelay: `${40 + i * 28}ms`,
          }}
        />
      ))}
    </div>
  )
}
