import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  createStarterInstances,
  findRecipeResult,
  getCatalogElement,
  getJewelleryDetail,
  isAppointmentPair,
  spawnInstance,
  type JewelleryDetail,
} from '../data/catalog'
import {
  clampToPlayfield,
  defaultPlayfield,
  measurePlayfield,
  resolveDragPush,
  separateAll,
  type PlayfieldBounds,
} from '../lib/craftPhysics'
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
import { AppointmentToast } from './AppointmentToast'
import { CraftElement } from './CraftElement'
import { JewellerySheet } from './JewellerySheet'
import { MergeBurst } from './MergeBurst'
import './CraftSpace.css'

const APPOINTMENT_TOAST_MS = 6000

export function CraftSpace() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLElement>(null)
  const playfieldRef = useRef<PlayfieldBounds>(defaultPlayfield())
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
  const [underFlashId, setUnderFlashId] = useState<string | null>(null)
  const [revealAnimId, setRevealAnimId] = useState<string | null>(null)
  const [appointmentToast, setAppointmentToast] = useState<
    'off' | 'on' | 'leaving'
  >('off')
  const appointmentToastVisibleRef = useRef(false)
  const appointmentToastTimerRef = useRef<number | null>(null)

  const commitElements = useCallback((next: CraftInstance[]) => {
    elementsRef.current = next
    setElements(next)
  }, [])

  const beginAppointmentToastLeave = useCallback(() => {
    if (appointmentToastTimerRef.current !== null) {
      window.clearTimeout(appointmentToastTimerRef.current)
      appointmentToastTimerRef.current = null
    }
    setAppointmentToast((phase) => (phase === 'on' ? 'leaving' : phase))
  }, [])

  const finishAppointmentToastLeave = useCallback(() => {
    appointmentToastVisibleRef.current = false
    setAppointmentToast('off')
  }, [])

  const showAppointmentToast = useCallback(() => {
    if (appointmentToastVisibleRef.current) return
    appointmentToastVisibleRef.current = true
    setAppointmentToast('on')
    if (appointmentToastTimerRef.current !== null) {
      window.clearTimeout(appointmentToastTimerRef.current)
    }
    appointmentToastTimerRef.current = window.setTimeout(() => {
      appointmentToastTimerRef.current = null
      setAppointmentToast((phase) => (phase === 'on' ? 'leaving' : phase))
    }, APPOINTMENT_TOAST_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (appointmentToastTimerRef.current !== null) {
        window.clearTimeout(appointmentToastTimerRef.current)
      }
    }
  }, [])

  const reloadPage = useCallback(() => {
    window.location.reload()
  }, [])

  const refreshPlayfield = useCallback(() => {
    const space = spaceRef.current
    if (!space) return playfieldRef.current
    const next = measurePlayfield(space, brandRef.current)
    playfieldRef.current = next
    return next
  }, [])

  const getPlayfield = useCallback(() => {
    return playfieldRef.current
  }, [])

  const spaceSize = useCallback(() => {
    const rect = spaceRef.current?.getBoundingClientRect()
    return {
      w: rect?.width ?? 390,
      h: rect?.height ?? 700,
    }
  }, [])

  // Measure playfield under the logo/hint and de-overlap starters.
  useLayoutEffect(() => {
    const bounds = refreshPlayfield()
    const { w, h } = spaceSize()
    const seated = separateAll(
      elementsRef.current.map((el) => {
        const c = clampToPlayfield(el.x, el.y, bounds)
        return { ...el, x: c.x, y: c.y }
      }),
      bounds,
      w,
      h,
    )
    commitElements(seated)

    const onResize = () => {
      const nextBounds = refreshPlayfield()
      const size = spaceSize()
      commitElements(
        separateAll(
          elementsRef.current.map((el) => {
            const c = clampToPlayfield(el.x, el.y, nextBounds)
            return { ...el, x: c.x, y: c.y }
          }),
          nextBounds,
          size.w,
          size.h,
        ),
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [commitElements, refreshPlayfield, spaceSize])

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

      const bounds = refreshPlayfield()
      const { w, h } = spaceSize()
      const [dirA, dirB] = opposingExplodeDirs(approach.x, approach.y)
      const midClamped = clampToPlayfield(mid.x, mid.y, bounds)

      setParentMergePhase({
        [parentA]: 'explode',
        [parentB]: 'explode',
      })

      // Seat parents at the merge point before the impulse so motion is visible.
      // Keep the new result (if any) where it is — other pieces can be nudged.
      commitElements(
        elementsRef.current.map((el) =>
          el.instanceId === parentA || el.instanceId === parentB
            ? { ...el, x: midClamped.x, y: midClamped.y }
            : el,
        ),
      )

      const others = elementsRef.current
        .filter(
          (el) =>
            el.instanceId !== parentA && el.instanceId !== parentB,
        )
        .map((el) => ({
          id: el.instanceId,
          x: el.x,
          y: el.y,
          // Finished jewellery stays put; materials get knocked around.
          pinned: el.kind === 'jewellery',
        }))

      explodeCancelRef.current = runParentExplode({
        mid: midClamped,
        bodies: [
          { id: parentA, dir: dirA },
          { id: parentB, dir: dirB },
        ],
        others,
        spaceWidthPx: w,
        spaceHeightPx: h,
        playfield: bounds,
        onFrame: applyExplodePositions,
        onDone: () => {
          explodeCancelRef.current = null
          setParentMergePhase({})
          // Final board-wide separation after the burst settles.
          const size = spaceSize()
          const pf = refreshPlayfield()
          commitElements(separateAll(elementsRef.current, pf, size.w, size.h))
          onDone()
        },
      })
    },
    [applyExplodePositions, commitElements, refreshPlayfield, spaceSize],
  )

  const handleMove = useCallback(
    (instanceId: string, next: { x: number; y: number }) => {
      if (busyRef.current) return
      const dragged = elementsRef.current.find((el) => el.instanceId === instanceId)
      if (!dragged) return

      const bounds = refreshPlayfield()
      const { w, h } = spaceSize()
      const pushed = resolveDragPush(
        elementsRef.current,
        instanceId,
        next,
        bounds,
        w,
        h,
        (otherCatalogId) =>
          Boolean(findRecipeResult(dragged.catalogId, otherCatalogId)) ||
          isAppointmentPair(dragged.catalogId, otherCatalogId),
      )
      commitElements(pushed)

      const draggedNow = pushed.find((el) => el.instanceId === instanceId)
      if (!draggedNow) return
      const target = findDropTarget(
        pushed,
        instanceId,
        draggedNow.x,
        draggedNow.y,
      )
      if (
        target &&
        isAppointmentPair(draggedNow.catalogId, target.catalogId)
      ) {
        showAppointmentToast()
      }
    },
    [commitElements, refreshPlayfield, showAppointmentToast, spaceSize],
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

      const bounds = refreshPlayfield()
      const clamped = clampToPlayfield(pos.x, pos.y, bounds)
      const placed = elementsRef.current.map((el) =>
        el.instanceId === instanceId
          ? { ...el, x: clamped.x, y: clamped.y }
          : el,
      )
      commitElements(placed)

      const dragged = placed.find((el) => el.instanceId === instanceId)
      if (!dragged) return

      const target = findDropTarget(placed, instanceId, clamped.x, clamped.y)
      if (!target) {
        // Soft settle so a non-merge drop doesn't leave overlaps.
        const { w, h } = spaceSize()
        commitElements(separateAll(elementsRef.current, bounds, w, h))
        delete dragOriginRef.current[instanceId]
        return
      }

      // Appointment pairs look combinable but have no product — CTA only.
      if (isAppointmentPair(dragged.catalogId, target.catalogId)) {
        const { w, h } = spaceSize()
        commitElements(separateAll(elementsRef.current, bounds, w, h))
        delete dragOriginRef.current[instanceId]
        return
      }

      const resultCatalogId = findRecipeResult(dragged.catalogId, target.catalogId)
      if (!resultCatalogId) {
        const { w, h } = spaceSize()
        commitElements(separateAll(elementsRef.current, bounds, w, h))
        delete dragOriginRef.current[instanceId]
        return
      }

      const resultDef = getCatalogElement(resultCatalogId)
      if (!resultDef) return

      const mid = clampToPlayfield(
        (clamped.x + target.x) / 2,
        (clamped.y + target.y) / 2,
        bounds,
      )

      const origin = dragOriginRef.current[instanceId]
      const approach = origin
        ? { x: clamped.x - origin.x, y: clamped.y - origin.y }
        : { x: dragged.x - target.x, y: dragged.y - target.y }

      const parentA = dragged.instanceId
      const parentB = target.instanceId

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

            startParentExplode(mid, parentA, parentB, approach, () => {
              busyRef.current = false
              delete dragOriginRef.current[instanceId]
            })
          }, MERGE_REVEAL_MS)
        }, MERGE_PUNCH_MS)
      }, MERGE_CONVERGE_MS)
    },
    [commitElements, refreshPlayfield, spaceSize, startParentExplode],
  )

  return (
    <div className="craft-space" ref={spaceRef}>
      <header
        ref={brandRef}
        className={`craft-space__header${sheet ? ' is-sheet-open' : ''}`}
      >
        <h1 className="craft-space__title">
          <button
            type="button"
            className="craft-space__logo-btn"
            aria-label="Reload celestial craft space"
            onClick={reloadPage}
          >
            <img
              className="craft-space__logo"
              src="/celestial-logo-new.png"
              alt="celestial Switzerland"
              width={375}
              height={145}
              draggable={false}
            />
          </button>
        </h1>
        <button
          type="button"
          className="craft-space__icon-btn craft-space__icon-btn--bag"
          aria-label="Shopping bag"
        >
          <svg
            className="craft-space__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.5 8.5h11l-.7 11.2a1.5 1.5 0 0 1-1.5 1.4H8.7a1.5 1.5 0 0 1-1.5-1.4L6.5 8.5Z" />
            <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
          </svg>
        </button>
        <button
          type="button"
          className="craft-space__icon-btn craft-space__icon-btn--menu"
          aria-label="Menu"
        >
          <svg
            className="craft-space__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </header>

      {elements.map((el) => (
        <CraftElement
          key={el.instanceId}
          data={el}
          boundsRef={spaceRef}
          getPlayfield={getPlayfield}
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

      {appointmentToast !== 'off' ? (
        <AppointmentToast
          exiting={appointmentToast === 'leaving'}
          onClose={beginAppointmentToastLeave}
          onExited={finishAppointmentToastLeave}
        />
      ) : null}

      {sheet ? (
        <JewellerySheet detail={sheet} onClose={closeJewellery} />
      ) : null}
    </div>
  )
}
