import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ChainBorderButton.css'

interface ChainBorderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

/** Build a path of interlocking oval “links” around a rounded rectangle. */
function chainLinkPath(
  w: number,
  h: number,
  pad: number,
  linkW: number,
  linkH: number,
): string {
  const left = pad
  const right = w - pad
  const top = pad
  const bottom = h - pad
  const parts: string[] = []

  const oval = (cx: number, cy: number, rot = 0) => {
    const rw = linkW / 2
    const rh = linkH / 2
    if (rot === 90) {
      parts.push(
        `M ${cx - rh} ${cy} a ${rh} ${rw} 0 1 0 ${rh * 2} 0 a ${rh} ${rw} 0 1 0 ${-rh * 2} 0`,
      )
    } else {
      parts.push(
        `M ${cx - rw} ${cy} a ${rw} ${rh} 0 1 0 ${rw * 2} 0 a ${rw} ${rh} 0 1 0 ${-rw * 2} 0`,
      )
    }
  }

  const stepX = linkW * 0.72
  const stepY = linkW * 0.72

  for (let x = left + linkW * 0.35; x <= right - linkW * 0.35; x += stepX) {
    oval(x, top, 0)
    oval(x, bottom, 0)
  }
  for (let y = top + linkW * 0.45; y <= bottom - linkW * 0.45; y += stepY) {
    oval(left, y, 90)
    oval(right, y, 90)
  }

  return parts.join(' ')
}

const VB_W = 220
const VB_H = 52
const CHAIN_D = chainLinkPath(VB_W, VB_H, 6, 11, 7)

/**
 * Primary action with interlocking oval “chain” frame (Fotini Figma motif).
 */
export function ChainBorderButton({
  children,
  className = '',
  type = 'button',
  ...rest
}: ChainBorderButtonProps) {
  return (
    <button type={type} className={`chain-btn ${className}`.trim()} {...rest}>
      <svg
        className="chain-btn__frame"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={CHAIN_D}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="chain-btn__label">{children}</span>
    </button>
  )
}
