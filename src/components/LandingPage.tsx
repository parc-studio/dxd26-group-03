import { CelestialHeader } from './CelestialHeader'
import './LandingPage.css'

const PRODUCTS = [
  {
    id: 'poseidon',
    image: '/example_poseidon_cyanite_dore.avif',
    name: 'Bague "Poséidon" - Cyanite & doré',
    price: 'CHF25.00',
  },
  {
    id: 'dionysos',
    image: '/example_ring_dionysos.avif',
    name: 'Bague "Dionysos" - Aventurine & doré',
    price: 'CHF25.00',
  },
  {
    id: 'apatite',
    image: '/example_collier_apatite.avif',
    name: 'Collier – Apatite – doré',
    price: 'CHF69.00',
  },
] as const

/** Static craft-preview scatter (catalog textures). */
const PREVIEW_PIECES = [
  { src: '/textures/gem_blue.png', left: '18%', top: '22%', size: '14%' },
  { src: '/textures/gem_yellow.png', left: '62%', top: '18%', size: '12%' },
  { src: '/textures/chain_gold.png', left: '38%', top: '34%', size: '28%' },
  { src: '/textures/gem_violet.png', left: '72%', top: '42%', size: '13%' },
  { src: '/textures/green_amethyst.png', left: '22%', top: '48%', size: '12%' },
  { src: '/textures/labradorite.png', left: '55%', top: '28%', size: '13%' },
  { src: '/textures/ring_thin_gold.png', left: '48%', top: '56%', size: '16%' },
  { src: '/textures/gem_light_blue.png', left: '14%', top: '68%', size: '13%' },
  { src: '/textures/gem_rect_light_green.png', left: '68%', top: '70%', size: '15%' },
  { src: '/textures/gem_rect_light_blue.png', left: '42%', top: '78%', size: '14%' },
] as const

interface LandingPageProps {
  onCreateYourOwn: () => void
}

export function LandingPage({ onCreateYourOwn }: LandingPageProps) {
  return (
    <div className="landing">
      <CelestialHeader />

      <div className="landing__split">
        <section className="landing__pane landing__pane--boutique" aria-label="Browse jewellery">
          <div className="landing__pane-body">
            <div className="landing__products">
              {PRODUCTS.map((product) => (
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
            </div>
          </div>
          <div className="landing__veil" aria-hidden="true" />
          <div className="landing__cta-wrap">
            <a className="landing__cta" href="#/" aria-disabled="true">
              browse jewellery
            </a>
          </div>
        </section>

        <section className="landing__pane landing__pane--craft" aria-label="Create your own">
          <div className="landing__pane-body">
            <div className="landing__preview" aria-hidden="true">
              {PREVIEW_PIECES.map((piece) => (
                <img
                  key={piece.src + piece.left}
                  className="landing__preview-piece"
                  src={piece.src}
                  alt=""
                  draggable={false}
                  style={{
                    left: piece.left,
                    top: piece.top,
                    width: piece.size,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="landing__veil" aria-hidden="true" />
          <div className="landing__cta-wrap">
            <button
              type="button"
              className="landing__cta"
              onClick={onCreateYourOwn}
            >
              create your own
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
