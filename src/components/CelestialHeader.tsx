import { forwardRef } from 'react'
import './CelestialHeader.css'

interface CelestialHeaderProps {
  onLogoClick?: () => void
}

export const CelestialHeader = forwardRef<HTMLElement, CelestialHeaderProps>(
  function CelestialHeader({ onLogoClick }, ref) {
    return (
      <header ref={ref} className="celestial-header">
        <h1 className="celestial-header__title">
          <button
            type="button"
            className="celestial-header__logo-btn"
            aria-label="Reload celestial"
            onClick={onLogoClick ?? (() => window.location.reload())}
          >
            <img
              className="celestial-header__logo"
              src="/celestial-logo-new.png"
              alt="celestial Switzerland"
              width={130}
              height={51}
              draggable={false}
            />
          </button>
        </h1>
        <div className="celestial-header__spacer" aria-hidden="true" />
        <button
          type="button"
          className="celestial-header__cart"
          aria-label="Shopping bag"
        >
          <svg
            className="celestial-header__cart-icon"
            viewBox="0 0 19 24"
            width={19}
            height={24}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1.5 7.25h16v14.25a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V7.25Z" />
            <path d="M6 7.25V5a3.5 3.5 0 0 1 7 0v2.25" />
          </svg>
        </button>
        <button
          type="button"
          className="celestial-header__burger"
          aria-label="Menu"
        >
          <span className="celestial-header__burger-bun" aria-hidden="true" />
          <span className="celestial-header__burger-meat" aria-hidden="true" />
          <span className="celestial-header__burger-bun" aria-hidden="true" />
        </button>
      </header>
    )
  },
)
