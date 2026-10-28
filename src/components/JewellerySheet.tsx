import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { getCatalogElement, type JewelleryDetail } from '../data/catalog'
import type { Metal } from './HeroModel'
import './JewellerySheet.css'

// Loaded on demand to keep three.js out of the main bundle.
const HeroModel = lazy(() => import('./HeroModel'))

interface JewellerySheetProps {
  detail: JewelleryDetail
  onClose: () => void
}

const DISMISS_PX = 96
const HERO_MODEL_URL = `${import.meta.env.BASE_URL}chain1-gold.glb`

// Text for the piece shown by the 3D model, which is the same for every
// jewellery result; swatches reuse the closest catalog textures.
const SHOWCASE = {
  name: 'Necklace Mirror of the Seas',
  stock: 1,
  description:
    'A fine chain traced like a shoreline, set with peridot and blue apatite ' +
    'that catch the light like sun on shallow and deep water.',
  chains: {
    gold: { id: 'chain_gold', label: 'Gold chain' },
    silver: { id: 'chain_silver', label: 'Silver chain' },
  },
  gems: [
    { id: 'gem_green', label: 'Peridot gem' },
    { id: 'gem_light_blue', label: 'Apatite gem' },
  ],
}

// Making-of photos for the showcased piece, shown before the price.
// Files follow the chosen metal: WIP-gold.jfif, final-silver.jfif, …
const gallery = (metal: Metal) => [
  {
    src: `${import.meta.env.BASE_URL}WIP-${metal}.jfif`,
    alt: `Jeweller’s bench with blue apatite and peridot stones, a spool of fine ${metal} chain and pliers`,
  },
  {
    src: `${import.meta.env.BASE_URL}final-${metal}.jfif`,
    alt: `The finished Mirror of the Seas necklace in ${metal}`,
  },
]

const METAL_OPTIONS: { value: Metal; label: string }[] = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
]

const swatch = (id: string) => getCatalogElement(id)?.image ?? ''

export function JewellerySheet({ detail, onClose }: JewellerySheetProps) {
  const [qty, setQty] = useState(1)
  const [metal, setMetal] = useState<Metal>('silver')
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
    setDragY(Math.max(0, e.clientY - d.startY))
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
    if (dragY >= DISMISS_PX) requestClose()
    else setDragY(0)
  }

  // Touch: native listeners, because only a non-passive touchmove can stop the
  // browser from turning a downward swipe at the top into a scroll/overscroll.
  useEffect(() => {
    const sc = scrollRef.current
    if (!sc) return
    let touch: { id: number; startY: number; dy: number; dragging: boolean } | null =
      null

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      // The 3D view keeps its own gestures (orbit, pinch).
      const onHero = (e.target as Element).closest('.jewellery-sheet__hero')
      if (e.touches.length !== 1 || onHero || sc.scrollTop > 2) {
        touch = null
        return
      }
      touch = { id: t.identifier, startY: t.clientY, dy: 0, dragging: false }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return
      const t = [...e.changedTouches].find((c) => c.identifier === touch?.id)
      if (!t) return
      const dy = t.clientY - touch.startY
      if (!touch.dragging) {
        // Upward or already scrolled: let the content scroll normally.
        if (dy < 0 || sc.scrollTop > 2) {
          touch = null
          return
        }
        if (dy < 10) return
        touch.dragging = true
      }
      e.preventDefault()
      touch.dy = Math.max(0, dy)
      setDragY(touch.dy)
    }

    const onTouchEnd = () => {
      if (!touch?.dragging) {
        touch = null
        return
      }
      const { dy } = touch
      touch = null
      if (dy >= DISMISS_PX) requestClose()
      else setDragY(0)
    }

    sc.addEventListener('touchstart', onTouchStart, { passive: true })
    sc.addEventListener('touchmove', onTouchMove, { passive: false })
    sc.addEventListener('touchend', onTouchEnd)
    sc.addEventListener('touchcancel', onTouchEnd)
    return () => {
      sc.removeEventListener('touchstart', onTouchStart)
      sc.removeEventListener('touchmove', onTouchMove)
      sc.removeEventListener('touchend', onTouchEnd)
      sc.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [requestClose])

  // Mouse: drag the content down from the top (touch is handled above).
  const onBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const sc = scrollRef.current
    if (!sc || sc.scrollTop > 2) return
    if (e.pointerType !== 'mouse' || e.button !== 0) return
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
    closing || !entered ? 0 : Math.max(0.2, 1 - dragY / 280)
  const panelTransition = dragY > 0 && !closing ? 'none' : undefined

  // Shop format: "CHF25.00", no space after the currency.
  const priceLabel = `CHF${detail.price.toFixed(2)}`

  const pieceName = SHOWCASE.name

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
        </div>

        <div
          className="jewellery-sheet__scroll"
          ref={scrollRef}
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onPointerCancel={onBodyPointerUp}
        >
          <div
            className="jewellery-sheet__hero"
            aria-hidden="true"
            // Orbiting the camera must not start the sheet's drag-to-dismiss.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Suspense fallback={null}>
              <HeroModel
                className="jewellery-sheet__hero-model"
                src={HERO_MODEL_URL}
                metal={metal}
              />
            </Suspense>
          </div>

          <div className="jewellery-sheet__body">
            <h2 id="jewellery-sheet-title" className="jewellery-sheet__name">
              {pieceName}
            </h2>

            <p className="jewellery-sheet__desc">{SHOWCASE.description}</p>

            <section className="jewellery-sheet__section" aria-label="Elements">
              <ul className="jewellery-sheet__ingredients">
                <li className="jewellery-sheet__ingredient">
                  <span
                    className="jewellery-sheet__ingredient-swatch"
                    style={{
                      backgroundImage: `url(${swatch(SHOWCASE.chains[metal].id)})`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="jewellery-sheet__ingredient-label">
                    {SHOWCASE.chains[metal].label}
                  </span>
                  <div
                    className="jewellery-sheet__metal"
                    role="group"
                    aria-label="Chain metal"
                  >
                    {METAL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="jewellery-sheet__metal-btn"
                        aria-pressed={metal === option.value}
                        onClick={() => setMetal(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </li>
                {SHOWCASE.gems.map((part) => (
                  <li key={part.id} className="jewellery-sheet__ingredient">
                    <span
                      className="jewellery-sheet__ingredient-swatch"
                      style={{ backgroundImage: `url(${swatch(part.id)})` }}
                      aria-hidden="true"
                    />
                    <span className="jewellery-sheet__ingredient-label">
                      {part.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="jewellery-sheet__section" aria-label="Making of">
              <div className="jewellery-sheet__gallery">
                {gallery(metal).map((photo) => (
                  <figure key={photo.src} className="jewellery-sheet__photo">
                    <img
                      className="jewellery-sheet__photo-img"
                      src={photo.src}
                      alt={photo.alt}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </figure>
                ))}
              </div>
            </section>

            <p className="jewellery-sheet__price">{priceLabel}</p>

            <div className="jewellery-sheet__stock-row">
              <div className="jewellery-sheet__qty" role="group" aria-label="Quantity">
                <button
                  type="button"
                  className="jewellery-sheet__qty-btn"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  -
                </button>
                <span className="jewellery-sheet__qty-value" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  className="jewellery-sheet__qty-btn"
                  aria-label="Increase quantity"
                  disabled={qty >= SHOWCASE.stock}
                  onClick={() => setQty((q) => Math.min(SHOWCASE.stock, q + 1))}
                >
                  +
                </button>
              </div>
              <p className="jewellery-sheet__stock">{SHOWCASE.stock} in stock</p>
            </div>

            <button
              type="button"
              className="jewellery-sheet__cart"
              onClick={() => {
                /* prototype placeholder */
              }}
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
