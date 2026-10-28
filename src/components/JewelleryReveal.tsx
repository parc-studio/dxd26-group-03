import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { JewelleryDetail } from '../data/catalog'
import { JEWELLERY_REVEAL_EXIT_MS } from '../lib/mergeTiming'
import type { Metal } from './HeroModel'
import './JewelleryReveal.css'

const HeroModel = lazy(() => import('./HeroModel'))

interface JewelleryRevealProps {
  detail: JewelleryDetail
  metal?: Metal
  onClose: () => void
  onViewProduct: () => void
}

const heroModelUrl = (metal: Metal) =>
  `${import.meta.env.BASE_URL}chain1-${metal}.glb`

export function JewelleryReveal({
  detail,
  metal = 'gold',
  onClose,
  onViewProduct,
}: JewelleryRevealProps) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'leaving'>('enter')

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const finishClose = useCallback(() => {
    onClose()
  }, [onClose])

  const requestClose = useCallback(() => {
    setPhase('leaving')
    window.setTimeout(finishClose, JEWELLERY_REVEAL_EXIT_MS)
  }, [finishClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const open = phase === 'open'
  const leaving = phase === 'leaving'

  return (
    <div
      className={`jewellery-reveal${open ? ' is-open' : ''}${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={detail.displayName}
    >
      <div className="jewellery-reveal__veil" aria-hidden="true" />

      <button
        type="button"
        className="jewellery-reveal__close"
        aria-label="Close"
        onClick={requestClose}
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="jewellery-reveal__stage">
        <Suspense fallback={null}>
          <HeroModel
            className="jewellery-reveal__model"
            src={heroModelUrl(metal)}
            metal={metal}
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
      </div>
    </div>
  )
}
