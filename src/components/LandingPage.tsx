import { useMemo, useState } from 'react'
import { CelestialHeader } from './CelestialHeader'
import './LandingPage.css'

/** Boutique grid cards — lifestyle fabric shots (keep opaque photo BG). */
const PRODUCTS = [
  {
    id: 'dionysos-silver',
    image: '/products/dionysos-silver.png',
    name: '"Dionysos" ring - Aventurine & silver',
    price: 'CHF25.00',
    category: 'Rings',
  },
  {
    id: 'dionysos-gold',
    image: '/products/dionysos-gold.png',
    name: '"Dionysos" ring - Aventurine & gold',
    price: 'CHF25.00',
    category: 'Rings',
  },
  {
    id: 'heracles-silver',
    image: '/products/heracles-silver.png',
    name: 'Ring "Héraclès" - Labradorite & silver',
    price: 'CHF25.00',
    category: 'Rings',
  },
  {
    id: 'heracles-gold',
    image: '/products/heracles-gold.png',
    name: 'Ring "Héraclès" - Labradorite & gold',
    price: 'CHF25.00',
    category: 'Rings',
  },
] as const

const CATEGORIES = ['All products', 'Rings'] as const

interface LandingPageProps {
  onCreateYourOwn: () => void
}

export function LandingPage({ onCreateYourOwn }: LandingPageProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>('All products')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRODUCTS.filter((product) => {
      if (category !== 'All products' && product.category !== category) {
        return false
      }
      if (!q) return true
      return (
        product.name.toLowerCase().includes(q) ||
        product.id.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        product.price.toLowerCase().includes(q)
      )
    })
  }, [query, category])

  return (
    <div className="landing">
      <div className="landing__header-sticky">
        <CelestialHeader />
      </div>

      <main className="landing__main">
        <label className="landing__search">
          <span className="landing__search-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="17" height="17" fill="none">
              <circle cx="8.25" cy="8.25" r="5.5" stroke="currentColor" strokeWidth="1.35" />
              <path
                d="M12.9 12.9 16.75 16.75"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            type="search"
            className="landing__search-input"
            placeholder="Search by product name, attributes or SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div className="landing__browse">
          <span className="landing__browse-label">Browse by:</span>
          <div className="landing__browse-select-wrap">
            <select
              className="landing__browse-select"
              aria-label="Browse by category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as (typeof CATEGORIES)[number])
              }
            >
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="landing__browse-chevron" aria-hidden="true">
              <svg viewBox="0 0 12 8" width="10" height="7" fill="none">
                <path
                  d="M1 1.5 6 6.5 11 1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>

        <section className="landing__products" aria-label="Products">
          {filtered.map((product) => (
            <article key={product.id} className="landing__product">
              <div className="landing__product-media">
                <img
                  src={product.image}
                  alt=""
                  className="landing__product-image"
                  draggable={false}
                />
              </div>
              <h2 className="landing__product-name">{product.name}</h2>
              <p className="landing__product-price">{product.price}</p>
            </article>
          ))}
        </section>

        {filtered.length === 0 ? (
          <p className="landing__empty">No products match your search.</p>
        ) : null}
      </main>

      <div className="landing__craft-bar">
        <button
          type="button"
          className="landing__craft-btn"
          onClick={onCreateYourOwn}
        >
          Discover the possibilities
        </button>
      </div>
    </div>
  )
}
