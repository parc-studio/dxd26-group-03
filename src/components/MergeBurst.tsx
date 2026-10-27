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

const SPARKS = Array.from({ length: 14 }, (_, i) => i)

/** Intense flash for finished jewellery merges (parents vanish into it). */
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
      <span className="merge-burst__flash" />
      <span className="merge-burst__core" />
      {SPARKS.map((i) => (
        <span
          key={i}
          className="merge-burst__spark"
          style={{
            ['--a' as string]: `${(360 / SPARKS.length) * i}deg`,
            ['--d' as string]: `${34 + (i % 4) * 12}px`,
            animationDelay: `${i * 14}ms`,
          }}
        />
      ))}
    </div>
  )
}
