import { useCallback, useRef, useState } from 'react'
import {
  createStarterInstances,
  findRecipeResult,
  getCatalogElement,
  getJewelleryDetail,
  spawnInstance,
  type JewelleryDetail,
} from '../data/catalog'
import { findDropTarget } from '../lib/hitTest'
import { playMergeSound } from '../lib/mergeSound'
import {
  MERGE_CONVERGE_MS,
  MERGE_PARENT_SPLIT_PX,
  MERGE_PUNCH_MS,
  MERGE_REVEAL_MS,
} from '../lib/mergeTiming'
import type {
  CraftInstance,
  MergeBurstState,
  ParentMergePhase,
} from '../types'
import { CraftElement } from './CraftElement'
import { JewellerySheet } from './JewellerySheet'
import { MergeBurst } from './MergeBurst'
import './CraftSpace.css'

function clampPct(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Place parents one left / one right of the merge point (kept, not consumed). */
function splitParentSlots(
  mid: { x: number; y: number },
  spaceWidthPx: number,
  leftId: string,
  rightId: string,
): Record<string, { x: number; y: number }> {
  const dxPct =
    spaceWidthPx > 0 ? (MERGE_PARENT_SPLIT_PX / spaceWidthPx) * 100 : 6
  return {
    [leftId]: {
      x: clampPct(mid.x - dxPct, 8, 92),
      y: clampPct(mid.y, 12, 90),
    },
    [rightId]: {
      x: clampPct(mid.x + dxPct, 8, 92),
      y: clampPct(mid.y, 12, 90),
    },
  }
}

export function CraftSpace() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef<CraftInstance[]>([])
  const busyRef = useRef(false)
  const dragOriginRef = useRef<Record<string, { x: number; y: number }>>({})

  const [elements, setElements] = useState<CraftInstance[]>(() => {
    const starters = createStarterInstances()
    elementsRef.current = starters
    return starters
  })
  const [order, setOrder] = useState<string[]>(() =>
    elementsRef.current.map((el) => el.instanceId),
  )
  const [bursts, setBursts] = useState<MergeBurstState[]>([])
  const [sheet, setSheet] = useState<JewelleryDetail | null>(null)
  const [parentMergePhase, setParentMergePhase] = useState<
    Record<string, ParentMergePhase>
  >({})
  /** Result id while hidden under the flash punch. */
  const [underFlashId, setUnderFlashId] = useState<string | null>(null)
  /** Result id while easing into view after the punch. */
  const [revealAnimId, setRevealAnimId] = useState<string | null>(null)

  const commitElements = useCallback((next: CraftInstance[]) => {
    elementsRef.current = next
    setElements(next)
  }, [])

  const handleMove = useCallback(
    (instanceId: string, next: { x: number; y: number }) => {
      if (busyRef.current) return
      const updated = elementsRef.current.map((el) =>
        el.instanceId === instanceId ? { ...el, x: next.x, y: next.y } : el,
      )
      commitElements(updated)
    },
    [commitElements],
  )

  const bringFront = useCallback((instanceId: string) => {
    setOrder((prev) => [...prev.filter((x) => x !== instanceId), instanceId])
  }, [])

  const handleDragStart = useCallback(
    (instanceId: string, origin: { x: number; y: number }) => {
      dragOriginRef.current[instanceId] = origin
    },
    [],
  )

  const openJewellery = useCallback((catalogId: string) => {
    if (busyRef.current) return
    const detail = getJewelleryDetail(catalogId)
    if (detail) setSheet(detail)
  }, [])

  const closeJewellery = useCallback(() => setSheet(null), [])

  const handleDrop = useCallback(
    (instanceId: string, pos: { x: number; y: number }) => {
      if (busyRef.current) return

      const placed = elementsRef.current.map((el) =>
        el.instanceId === instanceId ? { ...el, x: pos.x, y: pos.y } : el,
      )
      commitElements(placed)

      const dragged = placed.find((el) => el.instanceId === instanceId)
      if (!dragged) return

      const target = findDropTarget(placed, instanceId, pos.x, pos.y)
      if (!target) return

      const resultCatalogId = findRecipeResult(dragged.catalogId, target.catalogId)
      if (!resultCatalogId) return

      const resultDef = getCatalogElement(resultCatalogId)
      if (!resultDef) return

      const mid = {
        x: (pos.x + target.x) / 2,
        y: (pos.y + target.y) / 2,
      }

      // Keep relative left/right from approach so the split feels natural.
      const leftId =
        dragged.x <= target.x ? dragged.instanceId : target.instanceId
      const rightId =
        leftId === dragged.instanceId
          ? target.instanceId
          : dragged.instanceId
      const spaceWidth = spaceRef.current?.getBoundingClientRect().width ?? 390
      const splitSlots = splitParentSlots(
        mid,
        spaceWidth,
        leftId,
        rightId,
      )

      // Mid (and other non-jewellery) merges: spawn + parents split beside result.
      if (resultDef.kind !== 'jewellery') {
        const result = spawnInstance(resultCatalogId, mid.x, mid.y)
        if (!result) return

        const split = elementsRef.current.map((el) => {
          const slot = splitSlots[el.instanceId]
          return slot ? { ...el, x: slot.x, y: slot.y } : el
        })
        const next = [...split, result]
        commitElements(next)
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ])
        playMergeSound()
        delete dragOriginRef.current[instanceId]
        return
      }

      // Finished jewellery: converge → flash → vanish → reveal → parents reappear split.
      const result = spawnInstance(resultCatalogId, mid.x, mid.y)
      if (!result) return

      busyRef.current = true
      playMergeSound()

      const parentIds = [dragged.instanceId, target.instanceId]
      setParentMergePhase({
        [dragged.instanceId]: 'converge',
        [target.instanceId]: 'converge',
      })

      // Enlarge toward each other at the merge midpoint.
      commitElements(
        elementsRef.current.map((el) =>
          parentIds.includes(el.instanceId) ? { ...el, x: mid.x, y: mid.y } : el,
        ),
      )

      window.setTimeout(() => {
        // Intense flash; parents vanish into it.
        setParentMergePhase({
          [dragged.instanceId]: 'vanish',
          [target.instanceId]: 'vanish',
        })

        const burstId = `burst-${Date.now()}`
        setBursts((b) => [
          ...b,
          { id: burstId, x: mid.x, y: mid.y, kind: 'jewellery' },
        ])

        // Spawn product hidden under the flash, then reveal as punch eases.
        const withResult = [...elementsRef.current, result]
        commitElements(withResult)
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ])
        setUnderFlashId(result.instanceId)

        window.setTimeout(() => {
          // Flash eases; jewellery becomes readable with lasting glow.
          setUnderFlashId(null)
          setRevealAnimId(result.instanceId)

          window.setTimeout(() => {
            // Parents reappear split left/right of the merge point (kept).
            const split = elementsRef.current.map((el) => {
              const slot = splitSlots[el.instanceId]
              return slot ? { ...el, x: slot.x, y: slot.y } : el
            })
            commitElements(split)
            setParentMergePhase({})
            setRevealAnimId(null)
            setBursts((b) => b.filter((x) => x.id !== burstId))
            busyRef.current = false
            delete dragOriginRef.current[instanceId]
          }, MERGE_REVEAL_MS)
        }, MERGE_PUNCH_MS)
      }, MERGE_CONVERGE_MS)
    },
    [commitElements],
  )

  return (
    <div className="craft-space" ref={spaceRef}>
      <div className="craft-space__atmosphere" aria-hidden="true" />
      <div className="craft-space__grain" aria-hidden="true" />

      <header className={`craft-space__brand${sheet ? ' is-sheet-open' : ''}`}>
        <h1 className="craft-space__title">
          <img
            className="craft-space__logo"
            src="/celestial-logo-new.png"
            alt="celestial Switzerland"
            width={375}
            height={145}
            draggable={false}
          />
        </h1>
        {!sheet ? (
          <p className="craft-space__hint">
            Drag materials to craft. Tap a finished piece for details.
          </p>
        ) : null}
      </header>

      {elements.map((el) => (
        <CraftElement
          key={el.instanceId}
          data={el}
          boundsRef={spaceRef}
          zIndex={10 + Math.max(0, order.indexOf(el.instanceId))}
          mergePhase={parentMergePhase[el.instanceId]}
          revealing={underFlashId === el.instanceId}
          revealAnim={revealAnimId === el.instanceId}
          onMove={handleMove}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onBringFront={bringFront}
          onOpenJewellery={openJewellery}
        />
      ))}

      {bursts.map((b) => (
        <MergeBurst key={b.id} x={b.x} y={b.y} kind={b.kind} />
      ))}

      {sheet ? (
        <JewellerySheet detail={sheet} onClose={closeJewellery} />
      ) : null}
    </div>
  )
}
