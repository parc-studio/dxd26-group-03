import { useCallback, useEffect, useRef, useState } from 'react'
import type { JewelleryDetail } from '../data/catalog'
import './JewellerySheet.css'

interface JewellerySheetProps {
  detail: JewelleryDetail
  onClose: () => void
}

const DISMISS_PX = 96

export function JewellerySheet({ detail, onClose }: JewellerySheetProps) {
  const [qty, setQty] = useState(1)
  const [dragY, setDragY] = useState(0)
  const [closing, setClosing] = useState(false)
  const [entered, setEntered] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startY: number
    dragging: boolean
  } | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const finishClose = useCallback(() => {
    onClose()
  }, [onClose])

  const requestClose = useCallback(() => {
    setClosing(true)
    setDragY(0)
    window.setTimeout(finishClose, 280)
  }, [finishClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const onHandlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      dragging: true,
    }
  }

  const onHandlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId || !d.dragging) return
    const dy = Math.max(0, e.clientY - d.startY)
    setDragY(dy)
  }

  const onHandlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (dragY >= DISMISS_PX) {
      requestClose()
    } else {
      setDragY(0)
    }
  }

  /** Allow swipe-down from scroll body only when scrolled to top. */
  const onBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const sc = scrollRef.current
    if (!sc || sc.scrollTop > 2) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      dragging: false,
    }
  }

  const onBodyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.dragging) {
      if (dy < 10) return
      const sc = scrollRef.current
      if (sc && sc.scrollTop > 2) {
        dragRef.current = null
        return
      }
      d.dragging = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    if (d.dragging) {
      e.preventDefault()
      setDragY(Math.max(0, dy))
    }
  }

  const onBodyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const wasDragging = d.dragging
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (!wasDragging) return
    if (dragY >= DISMISS_PX) requestClose()
    else setDragY(0)
  }

  const panelOffset = closing || !entered ? '110%' : `${dragY}px`
  const backdropOpacity =
    closing || !entered ? 0 : Math.max(0.12, 1 - dragY / 280)
  const panelTransition = dragY > 0 && !closing ? 'none' : undefined

  const priceLabel = new Intl.NumberFormat('en-CH', {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).format(detail.price)

  return (
    <div
      className={`jewellery-sheet${entered && !closing ? ' is-open' : ''}${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="jewellery-sheet-title"
    >
      <button
        type="button"
        className="jewellery-sheet__backdrop"
        aria-label="Close"
        style={{ opacity: backdropOpacity }}
        onClick={requestClose}
      />

      <div
        className="jewellery-sheet__panel"
        style={{
          transform: `translate3d(0, ${panelOffset}, 0)`,
          transition: panelTransition,
        }}
      >
        <div
          className="jewellery-sheet__grab"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="jewellery-sheet__handle" aria-hidden="true" />
          <button
            type="button"
            className="jewellery-sheet__close"
            aria-label="Close details"
            onClick={requestClose}
          >
            Close
          </button>
        </div>

        <div
          className="jewellery-sheet__scroll"
          ref={scrollRef}
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onPointerCancel={onBodyPointerUp}
        >
          <div className="jewellery-sheet__hero" aria-hidden="true">
            <div
              className="jewellery-sheet__hero-img"
              style={{ backgroundImage: `url(${detail.image})` }}
            />
            {detail.inset ? (
              <span
                className="jewellery-sheet__hero-inset"
                style={{
                  backgroundImage: `url(${detail.inset})`,
                  backgroundPosition: detail.insetImagePosition ?? 'center',
                  backgroundSize: detail.insetImageSize ?? 'cover',
                }}
              />
            ) : null}
          </div>

          <h2 id="jewellery-sheet-title" className="jewellery-sheet__title">
            {detail.label}
          </h2>

          <p className="jewellery-sheet__desc">{detail.description}</p>

          <section className="jewellery-sheet__section" aria-label="Elements">
            <h3 className="jewellery-sheet__section-title">Elements</h3>
            <ul className="jewellery-sheet__ingredients">
              {detail.ingredients.map((part) => (
                <li key={part.id} className="jewellery-sheet__ingredient">
                  <span
                    className="jewellery-sheet__ingredient-swatch"
                    style={{ backgroundImage: `url(${part.image})` }}
                    aria-hidden="true"
                  />
                  <span className="jewellery-sheet__ingredient-label">
                    {part.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="jewellery-sheet__buy" aria-label="Price and quantity">
            <div className="jewellery-sheet__price">
              <span className="jewellery-sheet__price-label">Price</span>
              <span className="jewellery-sheet__price-value">{priceLabel}</span>
            </div>
            <div className="jewellery-sheet__qty">
              <span className="jewellery-sheet__qty-label">Quantity</span>
              <div className="jewellery-sheet__qty-controls">
                <button
                  type="button"
                  className="jewellery-sheet__qty-btn"
                  aria-label="Decrease quantity"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </button>
                <span className="jewellery-sheet__qty-value" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  className="jewellery-sheet__qty-btn"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(9, q + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <p className="jewellery-sheet__footnote">
            Placeholder details — Fotini will refine images and copy.
          </p>
        </div>
      </div>
    </div>
  )
}
