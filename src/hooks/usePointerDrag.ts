import { useCallback, useEffect, useRef, useState } from 'react'

interface Position {
  x: number
  y: number
}

interface UsePointerDragOptions {
  /** Position in percent of the craft space (0–100). */
  position: Position
  onMove: (next: Position) => void
  /** Called once when a drag ends, with the final position. */
  onDrop?: (next: Position) => void
  /** Element that defines the drag bounds (the craft space). */
  boundsRef: React.RefObject<HTMLElement | null>
}

let activeDragCount = 0

function setDraggingClass(on: boolean) {
  if (on) {
    activeDragCount += 1
    document.documentElement.classList.add('is-dragging')
  } else {
    activeDragCount = Math.max(0, activeDragCount - 1)
    if (activeDragCount === 0) {
      document.documentElement.classList.remove('is-dragging')
    }
  }
}

/**
 * Pointer-based drag in percent coordinates of the bounds element.
 * Uses Pointer Events + capture so mouse and touch stay reliable on mobile
 * without page scroll/bounce while dragging.
 */
export function usePointerDrag({
  position,
  onMove,
  onDrop,
  boundsRef,
}: UsePointerDragOptions) {
  const [dragging, setDragging] = useState(false)
  const offsetRef = useRef({ x: 0, y: 0 })
  const pointerIdRef = useRef<number | null>(null)
  const lastPosRef = useRef(position)
  const positionRef = useRef(position)
  const onMoveRef = useRef(onMove)
  const onDropRef = useRef(onDrop)

  useEffect(() => {
    positionRef.current = position
    if (!dragging) lastPosRef.current = position
  }, [position, dragging])

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    onDropRef.current = onDrop
  }, [onDrop])

  useEffect(() => {
    return () => {
      if (pointerIdRef.current !== null) {
        setDraggingClass(false)
        pointerIdRef.current = null
      }
    }
  }, [])

  const moveToClient = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = boundsRef.current
      if (!bounds) return

      const rect = bounds.getBoundingClientRect()
      const pointerX = ((clientX - rect.left) / rect.width) * 100
      const pointerY = ((clientY - rect.top) / rect.height) * 100

      const nextX = Math.min(92, Math.max(8, pointerX - offsetRef.current.x))
      const nextY = Math.min(90, Math.max(12, pointerY - offsetRef.current.y))
      const next = { x: nextX, y: nextY }
      lastPosRef.current = next
      onMoveRef.current(next)
    },
    [boundsRef],
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const bounds = boundsRef.current
      if (!bounds) return
      if (event.button !== 0 && event.pointerType === 'mouse') return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerIdRef.current = event.pointerId

      const rect = bounds.getBoundingClientRect()
      const pointerX = ((event.clientX - rect.left) / rect.width) * 100
      const pointerY = ((event.clientY - rect.top) / rect.height) * 100
      const pos = positionRef.current

      offsetRef.current = {
        x: pointerX - pos.x,
        y: pointerY - pos.y,
      }
      lastPosRef.current = pos
      setDragging(true)
      setDraggingClass(true)
    },
    [boundsRef],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (pointerIdRef.current !== event.pointerId) return
      event.preventDefault()
      moveToClient(event.clientX, event.clientY)
    },
    [moveToClient],
  )

  const endDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    event.preventDefault()
    pointerIdRef.current = null
    setDragging(false)
    setDraggingClass(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
    onDropRef.current?.(lastPosRef.current)
  }, [])

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
