import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import type { CraftInstance, ParentMergePhase } from '../types'
import { resolveCraftScale } from '../data/craftScales'
import { usePointerDrag } from '../hooks/usePointerDrag'
import type { PlayfieldBounds } from '../lib/craftPhysics'
import {
  JEWELLERY_REVEAL_LAND_FADE_MS,
  MERGE_BURST_MS,
  MERGE_CONVERGE_MS,
  MERGE_PUNCH_MS,
  MERGE_REVEAL_MS,
} from '../lib/mergeTiming'
import './CraftElement.css'

/** Wait until the texture is decoded so WebKit won’t paint a plate under drop-shadow. */
function useTexturePaintReady(src: string | undefined): boolean {
  const [ready, setReady] = useState(() => !src)

  useEffect(() => {
    if (!src) {
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)

    const markReady = () => {
      if (cancelled) return
      // Two frames: decode → first transparent paint → then enable filter.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true)
        })
      })
    }

    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(markReady).catch(markReady)
      } else {
        markReady()
      }
    }
    img.onerror = markReady
    img.src = src
    if (img.complete) {
      if (typeof img.decode === 'function') {
        img.decode().then(markReady).catch(markReady)
      } else {
        markReady()
      }
    }

    return () => {
      cancelled = true
    }
  }, [src])

  return ready
}

interface CraftElementProps {
  data: CraftInstance
  boundsRef: RefObject<HTMLElement | null>
  /** Playfield for this piece (by instance id: tall pieces sit lower). */
  getPlayfield?: (instanceId: string) => PlayfieldBounds
  zIndex: number
  mergePhase?: ParentMergePhase
  /** Suck-in start, in px from the merge point (element is already there). */
  mergeFrom?: { x: number; y: number }
  /** Product is under the flash (invisible) during the punch. */
  revealing?: boolean
  /** Soft entrance once the flash eases. */
  revealAnim?: boolean
  /** Fades in as the closing reveal's 3D piece lands on it. */
  returnLand?: boolean
  /**
   * The reveal or the product page is over the board: no merge lift above
   * them, and stays under them (UNDER_OVERLAY_MAX_Z) in its stacking order.
   */
  underOverlay?: boolean
  onMove: (instanceId: string, next: { x: number; y: number }) => void
  onDrop: (instanceId: string, next: { x: number; y: number }) => void
  onDragStart?: (instanceId: string, origin: { x: number; y: number }) => void
  onBringFront: (instanceId: string) => void
  /** Tap a finished jewellery piece to open its detail sheet. */
  onOpenJewellery?: (catalogId: string) => void
}

/** Just under the product page (40) and the reveal's blur (44). */
const UNDER_OVERLAY_MAX_Z = 39

export function CraftElement({
  data,
  boundsRef,
  getPlayfield,
  zIndex,
  mergePhase,
  mergeFrom,
  revealing = false,
  revealAnim = false,
  returnLand = false,
  underOverlay = false,
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

  const ownPlayfield = useMemo(
    () => (getPlayfield ? () => getPlayfield(data.instanceId) : undefined),
    [getPlayfield, data.instanceId],
  )

  const { dragging, handlers } = usePointerDrag({
    position: { x: data.x, y: data.y },
    onMove: handleMove,
    onDrop: handleDrop,
    onDragStart: handleDragStart,
    onTap: handleTap,
    boundsRef,
    getPlayfield: ownPlayfield,
  })

  const kindClass =
    data.kind === 'jewellery'
      ? ' craft-el--jewellery-piece'
      : data.kind === 'mid'
        ? ' craft-el--mid'
        : ''

  const isRing = data.shape === 'ring'
  const hasPhoto = Boolean(data.image)
  const paintReady = useTexturePaintReady(data.image)
  const craftScale = resolveCraftScale(data)
  // Prefer contain so transparent product cutouts aren't cropped into a hard frame.
  const bgSize = data.imageSize ?? (isRing || hasPhoto ? 'contain' : 'cover')

  const shapeStyle: CSSProperties = {
    backgroundImage: data.image ? `url(${data.image})` : undefined,
    backgroundPosition: data.imagePosition ?? 'center',
    backgroundSize: bgSize,
    backgroundColor: 'transparent',
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
      className={`craft-el craft-el--${data.category} craft-el--${data.shape}${kindClass}${hasPhoto ? ' craft-el--photo' : ''}${paintReady ? ' is-paint-ready' : ''}${dragging ? ' is-dragging' : ''}${phaseClass}${revealing ? ' is-under-flash' : ''}${revealAnim ? ' is-merge-reveal' : ''}${returnLand ? ' is-return-land' : ''}`}
      style={{
        left: `${data.x}%`,
        top: `${data.y}%`,
        // merging pieces lift above the board but keep their stacking order
        // (the dragged gem stays in front of the chain it lands on); under
        // the reveal / product page they keep that order below them instead
        zIndex: dragging
          ? 1100
          : underOverlay && !revealing && !returnLand
            ? Math.min(zIndex, UNDER_OVERLAY_MAX_Z)
            : mergePhase
              ? 1000 + zIndex
              : revealing || revealAnim || returnLand
                ? 1150
                : zIndex,
        backgroundColor: 'transparent',
        ['--craft-scale' as string]: String(craftScale),
        ['--craft-rotate' as string]: `${data.rotation ?? 0}deg`,
        ['--merge-converge-ms' as string]: `${MERGE_CONVERGE_MS}ms`,
        ['--merge-burst-ms' as string]: `${MERGE_BURST_MS}ms`,
        ['--merge-from-x' as string]: `${mergeFrom?.x ?? 0}px`,
        ['--merge-from-y' as string]: `${mergeFrom?.y ?? 0}px`,
        ['--merge-punch-ms' as string]: `${MERGE_PUNCH_MS}ms`,
        ['--merge-reveal-ms' as string]: `${MERGE_REVEAL_MS}ms`,
        ['--return-land-ms' as string]: `${JEWELLERY_REVEAL_LAND_FADE_MS}ms`,
      }}
      data-instance-id={data.instanceId}
      data-catalog-id={data.catalogId}
      data-kind={data.kind}
      data-craft-scale={craftScale}
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
        ) : null}      </span>
    </button>
  )
}
