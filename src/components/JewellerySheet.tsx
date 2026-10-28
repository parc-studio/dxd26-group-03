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
  /** Called with the chosen quantity; the sheet then closes. */
  onAddToCart: (qty: number) => void;
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

type Piece = Partial<Pick<typeof SHOWCASE, "name" | "stock" | "description" | "gems">> & {
  /** Metals the piece is made in (default: all); one hides the switch. */
  metals?: Metal[];
  /** Finished-piece photo, shared by every metal. */
  finalPhoto?: string;
};

// Per-piece overrides of the showcase.
const PIECES: Record<string, Piece> = {
  necklace_apatite: {
    name: "Necklace Apatite",
    stock: 2,
    description:
      "A fine silver chain with a single drop of blue apatite " +
      "that catches the light like deep water.",
    gems: [{ id: "apatite", label: "Apatite" }],
    metals: ["silver"],
    finalPhoto: "apatite-chain.jpg",
  },
};

// Making-of photos for the showcased piece, shown before the price.
// Files follow the chosen metal: WIP-gold.jfif, final-silver.jfif, …
const photo = (metal: Metal, pieceId: string, pieceName: string) => [
  {
    src: `${import.meta.env.BASE_URL}WIP-${metal}.jfif`,
    alt: `Jeweller’s bench with blue apatite and peridot stones, a spool of fine ${metal} chain and pliers`,
  },
  {
    src: `${import.meta.env.BASE_URL}${PIECES[pieceId]?.finalPhoto ?? `final-${metal}.jfif`}`,
    alt: `The finished ${pieceName} in ${metal}`,
  },
];

// Each slot holds every metal's photo (once per distinct file), stacked so
// switching metal crossfades instead of reloading the image.
const gallery = (pieceId: string, pieceName: string, metals: Metal[]) => {
  const byMetal = metals.map((metal) => photo(metal, pieceId, pieceName));
  return byMetal[0].map((_, slot) => {
    const layers: { src: string; alt: string; metals: Metal[] }[] = [];
    metals.forEach((metal, i) => {
      const { src, alt } = byMetal[i][slot];
      const layer = layers.find((l) => l.src === src);
      if (layer) layer.metals.push(metal);
      else layers.push({ src, alt, metals: [metal] });
    });
    return layers;
  });
};

const METAL_OPTIONS: { value: Metal; label: string }[] = [
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
];

const METALS = METAL_OPTIONS.map((option) => option.value);

const swatch = (id: string) => getCatalogElement(id)?.image ?? "";

export function JewellerySheet({
  detail,
  onClose,
  onAddToCart,
}: JewellerySheetProps) {
  const piece = { ...SHOWCASE, metals: METALS, ...PIECES[detail.id] };
  const metalOptions = METAL_OPTIONS.filter((o) => piece.metals.includes(o.value));
  const [qty, setQty] = useState(1);
  const [metal, setMetal] = useState<Metal>(() =>
    piece.metals.includes("silver") ? "silver" : piece.metals[0],
  );
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

  const pieceName = piece.name;

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
              {metalOptions.length > 1 && (
                <div
                  className="jewellery-sheet__metal"
                  role="group"
                  aria-label="Chain metal"
                >
                  {metalOptions.map((option) => (
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
              )}

              <ul
                className="jewellery-sheet__ingredients"
                aria-label="Elements"
              >
                {[
                  { ...SHOWCASE.chains[metal], className: "" },
                  ...piece.gems.map((part) => ({
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

            <p className="jewellery-sheet__desc">{piece.description}</p>

            <section
              className="jewellery-sheet__section"
              aria-label="Making of"
            >
              <div className="jewellery-sheet__gallery">
                {gallery(detail.id, pieceName, piece.metals).map((layers, slot) => (
                  <figure key={slot} className="jewellery-sheet__photo">
                    {layers.map((layer) => {
                      const shown = layer.metals.includes(metal);
                      return (
                        <img
                          key={layer.src}
                          className={`jewellery-sheet__photo-img${shown ? " is-shown" : ""}`}
                          src={layer.src}
                          alt={shown ? layer.alt : ""}
                          aria-hidden={!shown}
                          decoding="async"
                          draggable={false}
                        />
                      );
                    })}
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
                disabled={qty >= piece.stock}
                onClick={() => setQty((q) => Math.min(piece.stock, q + 1))}
              >
                +
              </button>
            </div>
            <p className="jewellery-sheet__stock">{piece.stock} in stock</p>
          </div>

          <button
            type="button"
            className="jewellery-sheet__cart"
            onClick={() => {
              onAddToCart(qty);
              requestClose();
            }}
          >
            Add to cart
          </button>
        </footer>
      </div>
    </div>
  );
}
