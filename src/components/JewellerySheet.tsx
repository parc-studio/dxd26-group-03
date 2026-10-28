import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { getCatalogElement, type JewelleryDetail } from "../data/catalog";
import { jewelleryHeroModelUrl } from "../lib/jewelleryModel";
import type { Metal } from "./HeroModel";
import "./JewellerySheet.css";

// Loaded on demand to keep three.js out of the main bundle.
const HeroModel = lazy(() => import("./HeroModel"));

interface JewellerySheetProps {
  detail: JewelleryDetail;
  onClose: () => void;
}

// Text for the piece shown by the 3D model, which is the same for every
// jewellery result; swatches reuse the closest catalog textures.
const SHOWCASE = {
  name: "Necklace Poseidon",
  stock: 1,
  description:
    "A fine chain traced like a shoreline, set with peridot and blue apatite " +
    "that catch the light like sun on shallow and deep water.",
  chains: {
    gold: { id: "chain_gold", label: "Stainless steel" },
    silver: { id: "chain_silver", label: "Stainless steel" },
  },
  gems: [
    { id: "peridot", label: "Peridot" },
    { id: "apatite", label: "Apatite" },
  ],
};

// Making-of photos for the showcased piece, shown before the price.
// Files follow the chosen metal: WIP-gold.jfif, final-silver.jfif, …
const gallery = (metal: Metal) => [
  {
    src: `${import.meta.env.BASE_URL}WIP-${metal}.jfif`,
    alt: `Jeweller’s bench with blue apatite and peridot stones, a spool of fine ${metal} chain and pliers`,
  },
  {
    src: `${import.meta.env.BASE_URL}final-${metal}.jfif`,
    alt: `The finished Poseidon necklace in ${metal}`,
  },
];

const METAL_OPTIONS: { value: Metal; label: string }[] = [
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
];

const swatch = (id: string) => getCatalogElement(id)?.image ?? "";

export function JewellerySheet({ detail, onClose }: JewellerySheetProps) {
  const [qty, setQty] = useState(1);
  const [metal, setMetal] = useState<Metal>("silver");
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  // Element whose name bubble is showing after a tap on its swatch.
  const [shownElement, setShownElement] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!shownElement) return;
    const id = window.setTimeout(() => setShownElement(null), 2000);
    return () => window.clearTimeout(id);
  }, [shownElement]);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // Shop format: "CHF25.00", no space after the currency.
  const priceLabel = `CHF${detail.price.toFixed(2)}`;

  const pieceName = SHOWCASE.name;

  return (
    <div
      className={`jewellery-sheet${entered && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="jewellery-sheet-title"
    >
      <div className="jewellery-sheet__panel">
        <header className="jewellery-sheet__bar">
          <button
            type="button"
            className="jewellery-sheet__back"
            aria-label="Back"
            onClick={requestClose}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>

        <div className="jewellery-sheet__scroll">
          <div className="jewellery-sheet__hero">
            <div className="jewellery-sheet__hero-model" aria-hidden="true">
              <Suspense fallback={null}>
                <HeroModel
                  className="jewellery-sheet__hero-model"
                  src={jewelleryHeroModelUrl(detail.id, metal)}
                  metal={metal}
                />
              </Suspense>
            </div>

            <div className="jewellery-sheet__hero-controls">
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

              <ul
                className="jewellery-sheet__ingredients"
                aria-label="Elements"
              >
                {[
                  { ...SHOWCASE.chains[metal], className: "" },
                  ...SHOWCASE.gems.map((part) => ({
                    ...part,
                    className: ` jewellery-sheet__ingredient-swatch--${part.id}`,
                  })),
                ].map((part) => (
                  <li key={part.id} className="jewellery-sheet__ingredient">
                    <button
                      type="button"
                      className={`jewellery-sheet__ingredient-swatch${part.className}`}
                      style={{ backgroundImage: `url(${swatch(part.id)})` }}
                      aria-label={part.label}
                      aria-expanded={shownElement === part.id}
                      onClick={() =>
                        setShownElement((id) =>
                          id === part.id ? null : part.id,
                        )
                      }
                    />
                    {shownElement === part.id && (
                      <span
                        className="jewellery-sheet__ingredient-name"
                        role="status"
                      >
                        {part.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="jewellery-sheet__body">
            <h2 id="jewellery-sheet-title" className="jewellery-sheet__name">
              {pieceName}
            </h2>

            <p className="jewellery-sheet__desc">{SHOWCASE.description}</p>

            <section
              className="jewellery-sheet__section"
              aria-label="Making of"
            >
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
          </div>
        </div>

        <footer className="jewellery-sheet__footer">
          <div className="jewellery-sheet__stock-row">
            <p className="jewellery-sheet__price">{priceLabel}</p>
            <div
              className="jewellery-sheet__qty"
              role="group"
              aria-label="Quantity"
            >
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
        </footer>
      </div>
    </div>
  );
}
