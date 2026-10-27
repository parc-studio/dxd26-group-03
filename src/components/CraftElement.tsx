import { useCallback, type CSSProperties, type RefObject } from 'react'
import type { CraftInstance } from '../types'
import { usePointerDrag } from '../hooks/usePointerDrag'
import './CraftElement.css'

interface CraftElementProps {
  data: CraftInstance
  boundsRef: RefObject<HTMLElement | null>
  zIndex: number
  merging?: boolean
  onMove: (instanceId: string, next: { x: number; y: number }) => void
  onDrop: (instanceId: string, next: { x: number; y: number }) => void
  onBringFront: (instanceId: string) => void
  /** Tap a finished jewellery piece to open its detail sheet. */
  onOpenJewellery?: (catalogId: string) => void
}

export function CraftElement({
  data,
  boundsRef,
  zIndex,
  merging = false,
  onMove,
  onDrop,
  onBringFront,
  onOpenJewellery,
}: CraftElementProps) {
  const handleMove = useCallback(
    (next: { x: number; y: number }) => onMove(data.instanceId, next),
    [data.instanceId, onMove],
  )

  const handleDrop = useCallback(
    (next: { x: number; y: number }) => onDrop(data.instanceId, next),
    [data.instanceId, onDrop],
  )

  const handleTap = useCallback(() => {
    if (data.kind !== 'jewellery' || !onOpenJewellery) return false
    onOpenJewellery(data.catalogId)
    return true
  }, [data.kind, data.catalogId, onOpenJewellery])

  const { dragging, handlers } = usePointerDrag({
    position: { x: data.x, y: data.y },
    onMove: handleMove,
    onDrop: handleDrop,
    onTap: handleTap,
    boundsRef,
  })

  const kindClass =
    data.kind === 'jewellery'
      ? ' craft-el--jewellery-piece'
      : data.kind === 'mid'
        ? ' craft-el--mid'
        : ''

  const isRing = data.shape === 'ring'
  const hasPhoto = Boolean(data.image)

  const shapeStyle: CSSProperties = isRing
    ? {
        backgroundImage: `url(${data.image})`,
        backgroundPosition: 'center',
        backgroundSize: 'contain',
      }
    : {
        backgroundImage: `url(${data.image})`,
        backgroundPosition: data.imagePosition ?? 'center',
        backgroundSize: data.imageSize ?? 'cover',
      }

  const [insetLeft, insetTop] = (data.insetPosition ?? '50% 40%').split(/\s+/)
  const insetStyle: CSSProperties | undefined = data.inset
    ? {
        backgroundImage: `url(${data.inset})`,
        backgroundPosition: data.insetImagePosition ?? 'center',
        backgroundSize: data.insetImageSize ?? 'cover',
        width: data.insetSize ?? '32%',
        height: data.insetSize ?? '32%',
        left: insetLeft ?? '50%',
        top: insetTop ?? '40%',
      }
    : undefined

  const aria =
    data.kind === 'jewellery'
      ? `Open details for ${data.label}`
      : `Drag ${data.label}`

  return (
    <button
      type="button"
      className={`craft-el craft-el--${data.category} craft-el--${data.shape}${kindClass}${hasPhoto ? ' craft-el--photo' : ''}${dragging ? ' is-dragging' : ''}${merging ? ' is-merging' : ''}`}
      style={{
        left: `${data.x}%`,
        top: `${data.y}%`,
        zIndex: dragging ? 1000 : zIndex,
      }}
      data-instance-id={data.instanceId}
      data-catalog-id={data.catalogId}
      data-kind={data.kind}
      aria-label={aria}
      disabled={merging}
      {...handlers}
      onPointerDown={(e) => {
        if (merging) return
        onBringFront(data.instanceId)
        handlers.onPointerDown(e)
      }}
    >
      <span className="craft-el__shape" style={shapeStyle} aria-hidden="true">
        {insetStyle ? (
          <span className="craft-el__inset" style={insetStyle} />
        ) : null}
      </span>
      <span className="craft-el__label">{data.label}</span>
    </button>
  )
}
