import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  /**
   * Opened from the finished-product reveal: waits off-screen for its 3D view
   * (no first-load hitch mid-slide), then slides in slower over the reveal.
   */
  fromReveal?: boolean;
  /**
   * Mounted ahead of time, hidden off-screen, so its 3D view is warm by the
   * time it is asked for; slides in when this turns false.
   */
  held?: boolean;
  /** fromReveal: the slide-in is over and the sheet covers the screen. */
  onEntered?: () => void;
}

/** Slide-in over the reveal (the closing slide stays at 280ms). */
const REVEAL_ENTER_MS = 480;
/** Longest wait for a cold 3D view before sliding in regardless. */
const MODEL_WAIT_MAX_MS = 400;

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

/** Spec block under making-of photos (Poseidon / two-stone). */
type PieceDetail =
  | { label: string; value: string }
  | { label: string; items: string[] };

type Piece = Partial<Pick<typeof SHOWCASE, "name" | "stock" | "description" | "gems">> & {
  /** Metals the piece is made in (default: all); one hides the switch. */
  metals?: Metal[];
  /** Finished-piece photo, shared by every metal. */
  finalPhoto?: string;
  /** Spec lines under the photos (two-stone / Poseidon, etc.). */
  details?: PieceDetail[];
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
  // Crafted via silver apatite necklace + peridot — silver chain1 / final-silver.
  necklace_poseidon: {
    name: "Necklace Poseidon",
    description:
      "A fine silver chain traced like a shoreline, set with peridot and blue apatite " +
      "that catch the light like sun on shallow and deep water.",
    gems: [
      { id: "peridot", label: "Peridot" },
      { id: "apatite", label: "Apatite" },
    ],
    metals: ["silver", "gold"],
    details: [
      {
        label: "Fine stone",
        items: ["Apatite (Brazil)", "Peridot (Arizona, US)"],
      },
      { label: "Chain & Wire", items: ["Stainless steel"] },
    ],
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

const BADGE_SIZE = 15;
const BADGE_BG = "rgb(224, 224, 224)";
// Scale of the window once it has become the badge.
const BADGE_SCALE = 0.1;
const FLY_MS = 800;

/**
 * Morphs the whole panel into the bag badge while moving it to the header
 * bag, in one motion. Returns a cancel function.
 */
function flyPanelToCart(
  panel: HTMLElement,
  veil: HTMLElement,
  onArrive: () => void,
): () => void {
  const bag = document.querySelector(".celestial-header__cart");
  if (!bag || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onArrive();
    return () => {};
  }
  const rect = panel.getBoundingClientRect();
  const to = bag.getBoundingClientRect();
  const dx = to.right - BADGE_SIZE / 2 - (rect.left + rect.width / 2);
  const dy = to.bottom - BADGE_SIZE / 2 - (rect.top + rect.height / 2);
  // clip is in panel pixels, shown at BADGE_SCALE on screen
  const dot = BADGE_SIZE / BADGE_SCALE;

  const timing = {
    duration: FLY_MS,
    easing: "cubic-bezier(0.55, 0, 0.25, 1)",
    fill: "forwards" as const,
  };
  const morph = panel.animate(
    [
      { transform: "translate(0, 0) scale(1)", clipPath: "inset(0px 0px round 0px)" },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${BADGE_SCALE})`,
        clipPath: `inset(${(rect.height - dot) / 2}px ${(rect.width - dot) / 2}px round ${dot / 2}px)`,
      },
    ],
    timing,
  );
  const fade = veil.animate(
    [{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }],
    timing,
  );
  morph.onfinish = onArrive;
  return () => {
    morph.cancel();
    fade.cancel();
  };
}

export function JewellerySheet({
  detail,
  onClose,
  onAddToCart,
  fromReveal = false,
  held = false,
  onEntered,
}: JewellerySheetProps) {
  const piece = { ...SHOWCASE, metals: METALS, ...PIECES[detail.id] };
  const metalOptions = METAL_OPTIONS.filter((o) => piece.metals.includes(o.value));
  const [metal, setMetal] = useState<Metal>(() =>
    piece.metals.includes("silver") ? "silver" : piece.metals[0],
  );
  const [closing, setClosing] = useState(false);
  // Quantity being added while the window flies into the bag.
  const [flying, setFlying] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  // Element whose name bubble is showing after a tap on its swatch.
  const [shownElement, setShownElement] = useState<string | null>(null);

  // fromReveal: slide in only once the 3D view is compiled and in the scene
  const [modelReady, setModelReady] = useState(!fromReveal);
  const onModelReady = useCallback(() => setModelReady(true), []);
  useEffect(() => {
    if (modelReady || held) return;
    const id = window.setTimeout(onModelReady, MODEL_WAIT_MAX_MS);
    return () => window.clearTimeout(id);
  }, [modelReady, held, onModelReady]);

  useEffect(() => {
    if (!modelReady || held) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [modelReady, held]);

  // fromReveal: the init-time flag, so the callback fires once
  const fromRevealRef = useRef(fromReveal);
  const onEnteredRef = useRef(onEntered);
  onEnteredRef.current = onEntered;
  useEffect(() => {
    if (!entered || !fromRevealRef.current) return;
    const id = window.setTimeout(() => onEnteredRef.current?.(), REVEAL_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [entered]);

  // fetch every metal's glb up front so the switch swaps without a reload
  const metalsKey = piece.metals.join();
  useEffect(() => {
    let cancelled = false;
    import("./HeroModel").then(({ preloadHeroModel }) => {
      if (cancelled) return;
      for (const m of metalsKey.split(",") as Metal[]) {
        preloadHeroModel(jewelleryHeroModelUrl(detail.id, m));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detail.id, metalsKey]);

  useEffect(() => {
    if (!shownElement) return;
    const id = window.setTimeout(() => setShownElement(null), 2000);
    return () => window.clearTimeout(id);
  }, [shownElement]);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  // latest callbacks, so a parent re-render doesn't restart the flight
  const callbacks = useRef({ onAddToCart, onClose });
  callbacks.current = { onAddToCart, onClose };

  useLayoutEffect(() => {
    if (flying === null || !panelRef.current || !veilRef.current) return;
    return flyPanelToCart(panelRef.current, veilRef.current, () => {
      callbacks.current.onAddToCart(flying);
      callbacks.current.onClose();
    });
  }, [flying]);

  useEffect(() => {
    if (held) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [held, requestClose]);

  // Shop format: "CHF25.00", no space after the currency.
  const priceLabel = `CHF${detail.price.toFixed(2)}`;

  const pieceName = piece.name;

  return (
    <div
      className={`jewellery-sheet${entered && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}${flying !== null ? " is-flying" : ""}${fromRevealRef.current && !closing ? " is-from-reveal" : ""}${held ? " is-held" : ""}`}
      style={{ ["--sheet-reveal-enter-ms" as string]: `${REVEAL_ENTER_MS}ms` }}
      aria-hidden={held || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="jewellery-sheet-title"
    >
      <div ref={panelRef} className="jewellery-sheet__panel">
        {flying !== null && (
          <div
            ref={veilRef}
            className="jewellery-sheet__badge-veil"
            style={{ background: BADGE_BG, fontSize: `${9 / BADGE_SCALE}px` }}
            aria-hidden="true"
          >
            {flying}
          </div>
        )}
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
                  freeOrbit={false}
                  onReady={onModelReady}
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

            {piece.details && piece.details.length > 0 && (
              <dl className="jewellery-sheet__details" aria-label="Details">
                {piece.details.map((block) => (
                  <div key={block.label} className="jewellery-sheet__detail">
                    {"items" in block ? (
                      <>
                        <dt className="jewellery-sheet__detail-label">
                          {block.label}:
                        </dt>
                        <dd className="jewellery-sheet__detail-body">
                          <ul className="jewellery-sheet__detail-items">
                            {block.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    ) : (
                      <div className="jewellery-sheet__detail-line">
                        <dt className="jewellery-sheet__detail-label">
                          {block.label}:
                        </dt>{" "}
                        <dd className="jewellery-sheet__detail-value">
                          {block.value}
                        </dd>
                      </div>
                    )}
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        <footer className="jewellery-sheet__footer">
          <button
            type="button"
            className="jewellery-sheet__cart"
            onClick={() => {
              if (closing || flying !== null) return;
              setFlying(1);
            }}
          >
            <span className="jewellery-sheet__price">{priceLabel}</span>
            <span>Add to cart</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
