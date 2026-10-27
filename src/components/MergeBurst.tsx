import './MergeBurst.css'

interface MergeBurstProps {
  x: number
  y: number
}

const SPARKS = Array.from({ length: 10 }, (_, i) => i)

/** Short star/sparkle burst at a craft-space percent position. */
export function MergeBurst({ x, y }: MergeBurstProps) {
  return (
    <div
      className="merge-burst"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-hidden="true"
    >
      <span className="merge-burst__flash" />
      {SPARKS.map((i) => (
        <span
          key={i}
          className="merge-burst__spark"
          style={{
            ['--a' as string]: `${(360 / SPARKS.length) * i}deg`,
            ['--d' as string]: `${28 + (i % 3) * 10}px`,
            animationDelay: `${i * 18}ms`,
          }}
        />
      ))}
    </div>
  )
}
