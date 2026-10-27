import { useCallback, type CSSProperties, type RefObject } from 'react'
import type { CraftInstance, ParentMergePhase } from '../types'
import { usePointerDrag } from '../hooks/usePointerDrag'
import {
  MERGE_CONVERGE_MS,
  MERGE_PUNCH_MS,
  MERGE_REVEAL_MS,
} from '../lib/mergeTiming'
import './CraftElement.css'

interface CraftElementProps {
  data: CraftInstance
  boundsRef: RefObject<HTMLElement | null>
  zIndex: number
  mergePhase?: ParentMergePhase
  /** Product is under the flash (invisible) during the punch. */
  revealing?: boolean
  /** Soft entrance once the flash eases. */
  revealAnim?: boolean
  onMove: (instanceId: string, next: { x: number; y: number }) => void
  onDrop: (instanceId: string, next: { x: number; y: number }) => void
  onDragStart?: (instanceId: string, origin: { x: number; y: number }) => void
  onBringFront: (instanceId: string) => void
  /** Tap a finished jewellery piece to open its detail sheet. */
  onOpenJewellery?: (catalogId: string) => void
}

export function CraftElement({
  data,
  boundsRef,
  zIndex,
  mergePhase,
  revealing = false,
  revealAnim = false,
  onMove,
  onDrop,
  onDragStart,
  onBringFront,
  onOpenJewellery,
}: CraftElementProps) {
  const merging = Boolean(mergePhase)
  const locked = merging || revealing

  const handleMove = useCallback(
    (next: { x: number; y: number }) => onMove(data.instanceId, next),
    [data.instanceId, onMove],
  )

  const handleDrop = useCallback(
    (next: { x: number; y: number }) => onDrop(data.instanceId, next),
    [data.instanceId, onDrop],
  )

  const handleDragStart = useCallback(
    (origin: { x: number; y: number }) => onDragStart?.(data.instanceId, origin),
    [data.instanceId, onDragStart],
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
    onDragStart: handleDragStart,
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

  const phaseClass =
    mergePhase === 'converge'
      ? ' is-merge-converge'
      : mergePhase === 'vanish'
        ? ' is-merge-vanish'
        : mergePhase === 'explode'
          ? ' is-merge-explode'
          : ''

  return (
    <button
      type="button"
      className={`craft-el craft-el--${data.category} craft-el--${data.shape}${kindClass}${hasPhoto ? ' craft-el--photo' : ''}${dragging ? ' is-dragging' : ''}${phaseClass}${revealing ? ' is-under-flash' : ''}${revealAnim ? ' is-merge-reveal' : ''}`}
      style={{
        left: `${data.x}%`,
        top: `${data.y}%`,
        zIndex: dragging || mergePhase ? 1100 : revealing || revealAnim ? 1150 : zIndex,
        ['--merge-converge-ms' as string]: `${MERGE_CONVERGE_MS}ms`,
        ['--merge-punch-ms' as string]: `${MERGE_PUNCH_MS}ms`,
        ['--merge-reveal-ms' as string]: `${MERGE_REVEAL_MS}ms`,
      }}
      data-instance-id={data.instanceId}
      data-catalog-id={data.catalogId}
      data-kind={data.kind}
      aria-label={aria}
      disabled={locked}
      {...handlers}
      onPointerDown={(e) => {
        if (locked) return
        onBringFront(data.instanceId)
        handlers.onPointerDown(e)
      }}
    >
      <span className="craft-el__label" aria-hidden={!dragging}>
        {data.label}
      </span>
      <span className="craft-el__shape" style={shapeStyle} aria-hidden="true">
        {insetStyle ? (
          <span className="craft-el__inset" style={insetStyle} />
        ) : null}
      </span>
    </button>
  )
}
