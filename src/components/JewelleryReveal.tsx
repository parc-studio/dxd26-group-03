import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { JewelleryDetail } from '../data/catalog'
import { jewelleryHeroModelUrl } from '../lib/jewelleryModel'
import { JEWELLERY_REVEAL_EXIT_MS } from '../lib/mergeTiming'
import type { Metal } from './HeroModel'
import './JewelleryReveal.css'

const HeroModel = lazy(() => import('./HeroModel'))

/**
 * Longest wait for the 3D model before the piece flies in regardless (it is
 * preloaded from the craft board, so this only bites on a slow first load).
 */
const MODEL_WAIT_MAX_MS = 700

/**
 * The 3D piece flies in and grows over this time, and the blur fades in over
 * the same time from the same frame, so the two stay in sync.
 */
const ARRIVE_MS = 1100

interface JewelleryRevealProps {
  detail: JewelleryDetail
  metal?: Metal
  /** Screen point (px) where the parents merged; the 3D piece grows out of it. */
  origin?: { x: number; y: number } | null
  /**
   * false: mounted but invisible, so the 3D view can load and compile early
   * (during the merge); the reveal opens when this turns true.
   */
  shown?: boolean
  /** The blur has fully faded in over the board (safe to change the board). */
  onCovered?: () => void
  onClose: () => void
  onViewProduct: () => void
}

export function JewelleryReveal({
  detail,
  metal = 'gold',
  origin,
  shown = true,
  onCovered,
  onClose,
  onViewProduct,
}: JewelleryRevealProps) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'leaving'>('enter')
  // the piece flies in once its 3D model is in the scene (never an empty frame)
  const [modelReady, setModelReady] = useState(false)
  const onModelReady = useCallback(() => setModelReady(true), [])
  const stageRef = useRef<HTMLDivElement>(null)

  // slow network: fly in anyway rather than leave the centre empty
  useEffect(() => {
    if (!shown) return
    const id = window.setTimeout(onModelReady, MODEL_WAIT_MAX_MS)
    return () => window.clearTimeout(id)
  }, [shown, onModelReady])

  // The 3D piece comes out of the merge point: it starts as a speck there
  // (offset from the stage centre) and grows into the middle of the screen.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || !origin) return
    const rect = stage.getBoundingClientRect()
    stage.style.setProperty('--grow-x', `${origin.x - (rect.left + rect.width / 2)}px`)
    stage.style.setProperty('--grow-y', `${origin.y - (rect.top + rect.height / 2)}px`)
    // origin is read once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!shown) return
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'))
    })
    return () => cancelAnimationFrame(id)
  }, [shown])

  const finishClose = useCallback(() => {
    onClose()
  }, [onClose])

  const requestClose = useCallback(() => {
    setPhase('leaving')
    window.setTimeout(finishClose, JEWELLERY_REVEAL_EXIT_MS)
  }, [finishClose])

  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, requestClose])

  const open = phase === 'open'
  const leaving = phase === 'leaving'
  // the 3D piece flies in once its model is ready, the blur with it
  const arrived = open && modelReady

  const coveredOnce = useRef(false)
  useEffect(() => {
    if (!arrived || coveredOnce.current) return
    coveredOnce.current = true
    const id = window.setTimeout(() => onCovered?.(), ARRIVE_MS)
    return () => window.clearTimeout(id)
  }, [arrived, onCovered])

  const stateClass = `${shown ? '' : ' is-pending'}${open ? ' is-open' : ''}${arrived || leaving ? ' is-arrived' : ''}${leaving ? ' is-leaving' : ''}`
  const arriveVar = { ['--reveal-arrive-ms' as string]: `${ARRIVE_MS}ms` }

  return (
    <>
    {/* full page, under the header (logo stays sharp), over every craft piece */}
    <div
      className={`jewellery-reveal__veil${stateClass}`}
      style={arriveVar}
      aria-hidden="true"
    />
    <div
      className={`jewellery-reveal${stateClass}`}
      aria-hidden={!shown}
      style={arriveVar}
      role="dialog"
      aria-modal="true"
      aria-label={detail.displayName}
    >

      <button
        type="button"
        className="jewellery-reveal__close"
        aria-label="Close"
        onClick={requestClose}
      >
        {/* same 24px stroke icon as the product page's back arrow */}
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <h2 className="jewellery-reveal__name">{detail.label}</h2>

      <div
        ref={stageRef}
        className={`jewellery-reveal__stage${arrived ? ' is-arrived' : ''}`}
      >
        <Suspense fallback={null}>
          <HeroModel
            className="jewellery-reveal__model"
            src={jewelleryHeroModelUrl(detail.id, metal)}
            metal={metal}
            transparentBackground
            onReady={onModelReady}
          />
        </Suspense>
      </div>

      <div className="jewellery-reveal__actions">
        <button
          type="button"
          className="jewellery-reveal__cta"
          onClick={onViewProduct}
        >
          View product
        </button>
        <button
          type="button"
          className="jewellery-reveal__link"
          onClick={requestClose}
        >
          Continue to discover
        </button>
      </div>
    </div>
    </>
  )
}
