import { useCallback, useRef, useState } from 'react'
import {
  createStarterInstances,
  findRecipeResult,
  getJewelleryDetail,
  spawnInstance,
  type JewelleryDetail,
} from '../data/catalog'
import { findDropTarget } from '../lib/hitTest'
import { playMergeSound } from '../lib/mergeSound'
import type { CraftInstance, MergeBurstState } from '../types'
import { CraftElement } from './CraftElement'
import { JewellerySheet } from './JewellerySheet'
import { MergeBurst } from './MergeBurst'
import './CraftSpace.css'

const MERGE_MS = 520

export function CraftSpace() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef<CraftInstance[]>([])
  const busyRef = useRef(false)

  const [elements, setElements] = useState<CraftInstance[]>(() => {
    const starters = createStarterInstances()
    elementsRef.current = starters
    return starters
  })
  const [order, setOrder] = useState<string[]>(() =>
    elementsRef.current.map((el) => el.instanceId),
  )
  const [mergingIds, setMergingIds] = useState<string[]>([])
  const [bursts, setBursts] = useState<MergeBurstState[]>([])
  const [sheet, setSheet] = useState<JewelleryDetail | null>(null)

  const commitElements = useCallback((next: CraftInstance[]) => {
    elementsRef.current = next
    setElements(next)
  }, [])

  const handleMove = useCallback(
    (instanceId: string, next: { x: number; y: number }) => {
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

      const result = spawnInstance(resultCatalogId, pos.x, pos.y)
      if (!result) return

      busyRef.current = true
      const consumeIds = [dragged.instanceId, target.instanceId]
      setMergingIds(consumeIds)
      playMergeSound()

      const burstId = `burst-${Date.now()}`
      setBursts((b) => [...b, { id: burstId, x: pos.x, y: pos.y }])

      window.setTimeout(() => {
        const without = elementsRef.current.filter(
          (el) => !consumeIds.includes(el.instanceId),
        )
        const next = [...without, result]
        commitElements(next)
        setOrder((o) => [
          ...o.filter((id) => !consumeIds.includes(id)),
          result.instanceId,
        ])
        setMergingIds([])
        setBursts((b) => b.filter((x) => x.id !== burstId))
        busyRef.current = false
      }, MERGE_MS)
    },
    [commitElements],
  )

  return (
    <div className="craft-space" ref={spaceRef}>
      <div className="craft-space__atmosphere" aria-hidden="true" />
      <div className="craft-space__grain" aria-hidden="true" />

      <header className={`craft-space__brand${sheet ? ' is-sheet-open' : ''}`}>
        <p className="craft-space__eyebrow">Craft space</p>
        <h1 className="craft-space__title">Celestial</h1>
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
          merging={mergingIds.includes(el.instanceId)}
          onMove={handleMove}
          onDrop={handleDrop}
          onBringFront={bringFront}
          onOpenJewellery={openJewellery}
        />
      ))}

      {bursts.map((b) => (
        <MergeBurst key={b.id} x={b.x} y={b.y} />
      ))}

      {sheet ? (
        <JewellerySheet detail={sheet} onClose={closeJewellery} />
      ) : null}
    </div>
  )
}
