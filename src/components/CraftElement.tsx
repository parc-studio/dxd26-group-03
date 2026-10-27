import { useCallback } from 'react'
import type { CraftInstance } from '../types'
import { usePointerDrag } from '../hooks/usePointerDrag'
import './CraftElement.css'

interface CraftElementProps {
  data: CraftInstance
  boundsRef: React.RefObject<HTMLElement | null>
  zIndex: number
  merging?: boolean
  onMove: (instanceId: string, next: { x: number; y: number }) => void
  onDrop: (instanceId: string, next: { x: number; y: number }) => void
  onBringFront: (instanceId: string) => void
}

export function CraftElement({
  data,
  boundsRef,
  zIndex,
  merging = false,
  onMove,
  onDrop,
  onBringFront,
}: CraftElementProps) {
  const handleMove = useCallback(
    (next: { x: number; y: number }) => onMove(data.instanceId, next),
    [data.instanceId, onMove],
  )

  const handleDrop = useCallback(
    (next: { x: number; y: number }) => onDrop(data.instanceId, next),
    [data.instanceId, onDrop],
  )

  const { dragging, handlers } = usePointerDrag({
    position: { x: data.x, y: data.y },
    onMove: handleMove,
    onDrop: handleDrop,
    boundsRef,
  })

  const kindClass =
    data.kind === 'jewellery'
      ? ' craft-el--jewellery-piece'
      : data.kind === 'mid'
        ? ' craft-el--mid'
        : ''

  return (
    <button
      type="button"
      className={`craft-el craft-el--${data.category} craft-el--${data.shape}${kindClass}${dragging ? ' is-dragging' : ''}${merging ? ' is-merging' : ''}`}
      style={{
        left: `${data.x}%`,
        top: `${data.y}%`,
        zIndex: dragging ? 1000 : zIndex,
      }}
      data-instance-id={data.instanceId}
      data-catalog-id={data.catalogId}
      aria-label={`Drag ${data.label}`}
      disabled={merging}
      {...handlers}
      onPointerDown={(e) => {
        if (merging) return
        onBringFront(data.instanceId)
        handlers.onPointerDown(e)
      }}
    >
      <span className="craft-el__shape" aria-hidden="true" />
      <span className="craft-el__label">{data.label}</span>
    </button>
  )
}
