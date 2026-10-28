import { useMemo, useState } from 'react'
import { CelestialHeader } from './CelestialHeader'
import './LandingPage.css'

const PRODUCTS = [
  {
    id: 'poseidon',
    image: '/example_poseidon_cyanite_dore.avif',
    name: 'Bague "Poséidon" - Cyanite & doré',
    price: 'CHF25.00',
    category: 'Rings',
  },
  {
    id: 'dionysos',
    image: '/example_ring_dionysos.avif',
    name: 'Bague "Dionysos" - Aventurine & doré',
    price: 'CHF25.00',
    category: 'Rings',
  },
  {
    id: 'apatite',
    image: '/example_collier_apatite.avif',
    name: 'Collier – Apatite – doré',
    price: 'CHF69.00',
    category: 'Necklaces',
  },
  {
    id: 'mirror-gold',
    image: '/final-gold.jfif',
    name: 'Collier "Miroir des Mers" – doré',
    price: 'CHF168.00',
    category: 'Necklaces',
  },
  {
    id: 'mirror-silver',
    image: '/final-silver.jfif',
    name: 'Collier "Miroir des Mers" – argenté',
    price: 'CHF168.00',
    category: 'Necklaces',
  },
] as const

const CATEGORIES = ['All products', 'Rings', 'Necklaces'] as const

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
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M13.2 13.2 17 17"
                stroke="currentColor"
                strokeWidth="1.4"
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

        <div className="landing__toolbar">
          <button
            type="button"
            className="landing__craft-link"
            onClick={onCreateYourOwn}
          >
            Create your own
          </button>
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
    </div>
  )
}
