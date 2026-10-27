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
import { opposingExplodeDirs, runParentExplode } from '../lib/mergeExplode'
import { playMergeSound } from '../lib/mergeSound'
import {
  MERGE_CONVERGE_MS,
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

export function CraftSpace() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef<CraftInstance[]>([])
  const busyRef = useRef(false)
  const dragOriginRef = useRef<Record<string, { x: number; y: number }>>({})
  const explodeCancelRef = useRef<(() => void) | null>(null)

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

  const applyExplodePositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const next = elementsRef.current.map((el) => {
        const slot = positions[el.instanceId]
        return slot ? { ...el, x: slot.x, y: slot.y } : el
      })
      commitElements(next)
    },
    [commitElements],
  )

  const startParentExplode = useCallback(
    (
      mid: { x: number; y: number },
      parentA: string,
      parentB: string,
      approach: { x: number; y: number },
      onDone: () => void,
    ) => {
      explodeCancelRef.current?.()

      const rect = spaceRef.current?.getBoundingClientRect()
      const spaceWidthPx = rect?.width ?? 390
      const spaceHeightPx = rect?.height ?? 700
      const [dirA, dirB] = opposingExplodeDirs(approach.x, approach.y)

      setParentMergePhase({
        [parentA]: 'explode',
        [parentB]: 'explode',
      })

      // Seat parents at the merge point before the impulse so motion is visible.
      commitElements(
        elementsRef.current.map((el) =>
          el.instanceId === parentA || el.instanceId === parentB
            ? { ...el, x: mid.x, y: mid.y }
            : el,
        ),
      )

      explodeCancelRef.current = runParentExplode({
        mid,
        bodies: [
          { id: parentA, dir: dirA },
          { id: parentB, dir: dirB },
        ],
        spaceWidthPx,
        spaceHeightPx,
        onFrame: applyExplodePositions,
        onDone: () => {
          explodeCancelRef.current = null
          setParentMergePhase({})
          onDone()
        },
      })
    },
    [applyExplodePositions, commitElements],
  )

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

      const origin = dragOriginRef.current[instanceId]
      // Approach along the drag path when available; else parent separation.
      const approach = origin
        ? { x: pos.x - origin.x, y: pos.y - origin.y }
        : { x: dragged.x - target.x, y: dragged.y - target.y }

      const parentA = dragged.instanceId
      const parentB = target.instanceId

      // Mid merges: spawn result, then parents explode apart with physics.
      if (resultDef.kind !== 'jewellery') {
        const result = spawnInstance(resultCatalogId, mid.x, mid.y)
        if (!result) return

        busyRef.current = true
        playMergeSound()

        const withResult = [
          ...elementsRef.current.map((el) =>
            el.instanceId === parentA || el.instanceId === parentB
              ? { ...el, x: mid.x, y: mid.y }
              : el,
          ),
          result,
        ]
        commitElements(withResult)
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ])

        startParentExplode(mid, parentA, parentB, approach, () => {
          busyRef.current = false
          delete dragOriginRef.current[instanceId]
        })
        return
      }

      // Finished jewellery: converge → flash → vanish → reveal → explode apart.
      const result = spawnInstance(resultCatalogId, mid.x, mid.y)
      if (!result) return

      busyRef.current = true
      playMergeSound()

      setParentMergePhase({
        [parentA]: 'converge',
        [parentB]: 'converge',
      })

      commitElements(
        elementsRef.current.map((el) =>
          el.instanceId === parentA || el.instanceId === parentB
            ? { ...el, x: mid.x, y: mid.y }
            : el,
        ),
      )

      window.setTimeout(() => {
        setParentMergePhase({
          [parentA]: 'vanish',
          [parentB]: 'vanish',
        })

        const burstId = `burst-${Date.now()}`
        setBursts((b) => [
          ...b,
          { id: burstId, x: mid.x, y: mid.y, kind: 'jewellery' },
        ])

        const withResult = [...elementsRef.current, result]
        commitElements(withResult)
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ])
        setUnderFlashId(result.instanceId)

        window.setTimeout(() => {
          setUnderFlashId(null)
          setRevealAnimId(result.instanceId)

          window.setTimeout(() => {
            setRevealAnimId(null)
            setBursts((b) => b.filter((x) => x.id !== burstId))

            // Reappear at the flash center, then fly apart with the same physics.
            startParentExplode(mid, parentA, parentB, approach, () => {
              busyRef.current = false
              delete dragOriginRef.current[instanceId]
            })
          }, MERGE_REVEAL_MS)
        }, MERGE_PUNCH_MS)
      }, MERGE_CONVERGE_MS)
    },
    [commitElements, startParentExplode],
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
