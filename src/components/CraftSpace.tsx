import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  allowsCraftOverlap,
  CATALOG_ELEMENTS,
  createStarterInstances,
  findRecipeResult,
  getCatalogElement,
  getJewelleryDetail,
  isAppointmentPair,
  spawnInstance,
  spinStones,
  type JewelleryDetail,
} from "../data/catalog";
import {
  boundsFor,
  clampToPlayfield,
  defaultPlayfield,
  ELEMENT_HIT_RADIUS_PX,
  measurePlayfield,
  resolveDragPush,
  separateAll,
  setHitRadiusLookup,
  setTopInsetLookup,
  type PlayfieldBounds,
} from "../lib/craftPhysics";
import { findDropTarget, findMatchingTarget } from "../lib/hitTest";
import {
  jewelleryHeroModelUrl,
  resolveJewelleryMetal,
} from "../lib/jewelleryModel";
import {
  opposingExplodeDirs,
  runParentBurst,
  type BurstControl,
} from "../lib/mergeExplode";
import {
  JEWELLERY_REVEAL_LAND_FADE_MS,
  MERGE_CONVERGE_MS,
  MERGE_PARENT_SPLIT_PX,
} from "../lib/mergeTiming";
import {
  attachShakeListener,
  requestMotionPermissionOnTap,
} from "../lib/shakeDetect";
import { runShakeJostle } from "../lib/shakeJostle";
import { attachTiltDrift } from "../lib/tiltDrift";
import type { CraftInstance, ParentMergePhase } from "../types";
import { AppointmentToast } from "./AppointmentToast";
import { CelestialHeader } from "./CelestialHeader";
import { CraftElement } from "./CraftElement";
import "./CraftSpace.css";
import type { Metal } from "./HeroModel";
import { JewelleryReveal } from "./JewelleryReveal";
import { JewellerySheet } from "./JewellerySheet";

/** Only pieces that really combine may rest on each other after a drop. */
const isRecipePair = (a: string, b: string) =>
  Boolean(findRecipeResult(a, b));

/**
 * Nothing touches — not even pieces that combine: the tilt / shake physics
 * separate every pair, so a touching pair would visibly jump apart once the
 * board is live again. A few rounds settle crowded spots fully (one round can
 * leave a bit of overlap).
 */
function seatApart(
  instances: CraftInstance[],
  bounds: PlayfieldBounds,
  w: number,
  h: number,
  isPinned?: (el: CraftInstance) => boolean,
): CraftInstance[] {
  let next = instances;
  for (let round = 0; round < 4; round++) {
    next = separateAll(next, bounds, w, h, undefined, isPinned);
  }
  return next;
}

const APPOINTMENT_TOAST_MS = 6000;
/** Necklace hit circle as a share of its drawn half-width (1 = whole box). */
const NECKLACE_HIT_RADIUS_RATIO = 0.9;
/** Lets the board's own images load first before warming the 3D reveal. */
const REVEAL_WARMUP_DELAY_MS = 1200;

const CRAFT_HASH = "/craft";

/** Catalog id of the product open in the URL (`#/craft/<id>`), if any. */
function readProductFromHash(): string | null {
  const match = window.location.hash.match(/^#\/?craft\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function detailFromHash(): JewelleryDetail | null {
  const id = readProductFromHash();
  return id ? getJewelleryDetail(id) : null;
}

export function CraftSpace() {
  const spaceRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLElement>(null);
  const playfieldRef = useRef<PlayfieldBounds>(defaultPlayfield());
  const elementsRef = useRef<CraftInstance[]>([]);
  const busyRef = useRef(false);
  const dragOriginRef = useRef<Record<string, { x: number; y: number }>>({});
  /** Pieces under a finger; tilt drift leaves them where they are. */
  const draggingRef = useRef(new Set<string>());
  /** The running merge burst (pieces growing, the board pushed aside). */
  const mergeBurstRef = useRef<BurstControl | null>(null);
  /** A jewellery merge's next step, waiting for the suck-in to end. */
  const convergeStepRef = useRef<{ timer: number; run: () => void } | null>(
    null,
  );
  const shakeJostleRef = useRef<{
    cancel: () => void;
    kick: (intensity?: number) => void;
  } | null>(null);

  const [elements, setElements] = useState<CraftInstance[]>(() => {
    const starters = createStarterInstances();
    elementsRef.current = starters;
    return starters;
  });
  const [order, setOrder] = useState<string[]>(() =>
    elementsRef.current.map((el) => el.instanceId),
  );
  const [sheet, setSheet] = useState<JewelleryDetail | null>(detailFromHash);
  /** The open sheet was opened by the reveal's "View product". */
  const [sheetFromReveal, setSheetFromReveal] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  /** True when the open sheet pushed its own history entry (close → back). */
  const sheetPushedRef = useRef(false);
  const [jewelleryReveal, setJewelleryReveal] =
    useState<JewelleryDetail | null>(null);
  /** Metal for the open reveal — from the craft parents, not static catalog copy. */
  const [jewelleryRevealMetal, setJewelleryRevealMetal] =
    useState<Metal>("gold");
  /**
   * The reveal has fully arrived: its product page may now mount (held) to
   * warm up — not earlier, so its 3D setup doesn't stutter the fly-in.
   */
  const [revealArrived, setRevealArrived] = useState(false);
  const handleRevealCovered = useCallback(() => {
    setRevealArrived(true);
  }, []);
  /** Screen point where the parents were sucked in — the reveal's 3D piece grows from it. */
  const [jewelleryRevealOrigin, setJewelleryRevealOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [parentMergePhase, setParentMergePhase] = useState<
    Record<string, ParentMergePhase>
  >({});
  /** Where each parent started its suck-in, in px from the merge point. */
  const [parentMergeFrom, setParentMergeFrom] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [underFlashId, setUnderFlashId] = useState<string | null>(null);
  /** Board piece made by the merge behind the open reveal. */
  const revealResultIdRef = useRef<string | null>(null);
  /** Board piece fading in as the closing reveal's 3D piece lands on it. */
  const [returnLandId, setReturnLandId] = useState<string | null>(null);
  const [appointmentToast, setAppointmentToast] = useState<
    "off" | "on" | "leaving"
  >("off");
  const appointmentToastVisibleRef = useRef(false);
  const appointmentToastTimerRef = useRef<number | null>(null);
  const jewelleryRevealOpenRef = useRef(false);
  const explodeDoneRef = useRef(true);

  const commitElements = useCallback((next: CraftInstance[]) => {
    elementsRef.current = next;
    setElements(next);
  }, []);

  const beginAppointmentToastLeave = useCallback(() => {
    if (appointmentToastTimerRef.current !== null) {
      window.clearTimeout(appointmentToastTimerRef.current);
      appointmentToastTimerRef.current = null;
    }
    setAppointmentToast((phase) => (phase === "on" ? "leaving" : phase));
  }, []);

  const finishAppointmentToastLeave = useCallback(() => {
    appointmentToastVisibleRef.current = false;
    setAppointmentToast("off");
  }, []);

  const showAppointmentToast = useCallback(() => {
    // Never cover the finished-product 3D reveal / focus view.
    if (jewelleryRevealOpenRef.current) return;
    if (appointmentToastVisibleRef.current) return;
    appointmentToastVisibleRef.current = true;
    setAppointmentToast("on");
    if (appointmentToastTimerRef.current !== null) {
      window.clearTimeout(appointmentToastTimerRef.current);
    }
    appointmentToastTimerRef.current = window.setTimeout(() => {
      appointmentToastTimerRef.current = null;
      setAppointmentToast((phase) => (phase === "on" ? "leaving" : phase));
    }, APPOINTMENT_TOAST_MS);
  }, []);

  /** Extra top inset (px) per catalog piece; cleared when the board resizes. */
  const topInsetPxRef = useRef(new Map<string, number>());

  // Pieces taller than the hit radius (finished jewellery) keep their top
  // edge as low as the small pieces' — and their name (shown above them while
  // dragged) too — never up over the logo. Layout effect, so it is in place
  // before the starters are seated below.
  useLayoutEffect(() => {
    setTopInsetLookup((id) => {
      const space = spaceRef.current;
      const el = elementsRef.current.find((e) => e.instanceId === id);
      if (!space || !el) return 0;
      let extraPx = topInsetPxRef.current.get(el.catalogId);
      if (extraPx === undefined) {
        const piece = space.querySelector<HTMLElement>(
          `[data-instance-id="${id}"]`,
        );
        const shape = piece?.querySelector<HTMLElement>(".craft-el__shape");
        const label = piece?.querySelector<HTMLElement>(".craft-el__label");
        if (!piece || !shape) return 0; // not on screen yet: measured next time
        const overHalf = shape.offsetHeight / 2 - ELEMENT_HIT_RADIUS_PX;
        // name sits above the piece box (bottom: 100% + gap): negative offsetTop
        const labelPx = label ? Math.max(0, -label.offsetTop) : 0;
        extraPx = overHalf > 0 ? overHalf + labelPx : 0;
        topInsetPxRef.current.set(el.catalogId, extraPx);
      }
      return extraPx > 0
        ? (extraPx / Math.max(1, space.clientHeight)) * 100
        : 0;
    });
    return () => setTopInsetLookup(null);
  }, []);

  /** Collision radius (px) per necklace; cleared when the board resizes. */
  const hitRadiusPxRef = useRef(new Map<string, number>());

  // Necklaces are drawn far bigger than the 34px hit circle: give them one
  // their own size, so they don't lie over each other or over the metals.
  useLayoutEffect(() => {
    setHitRadiusLookup((id) => {
      const el = elementsRef.current.find((e) => e.instanceId === id);
      if (!el || !el.catalogId.startsWith("necklace")) {
        return ELEMENT_HIT_RADIUS_PX;
      }
      let radius = hitRadiusPxRef.current.get(el.catalogId);
      if (radius === undefined) {
        const shape = spaceRef.current?.querySelector<HTMLElement>(
          `[data-instance-id="${id}"] .craft-el__shape`,
        );
        if (!shape) return ELEMENT_HIT_RADIUS_PX; // measured next time
        radius = Math.max(
          ELEMENT_HIT_RADIUS_PX,
          (shape.offsetWidth / 2) * NECKLACE_HIT_RADIUS_RATIO,
        );
        hitRadiusPxRef.current.set(el.catalogId, radius);
      }
      return radius;
    });
    return () => setHitRadiusLookup(null);
  }, []);

  useEffect(() => {
    return () => {
      if (appointmentToastTimerRef.current !== null) {
        window.clearTimeout(appointmentToastTimerRef.current);
      }
    };
  }, []);

  const refreshPlayfield = useCallback(() => {
    const space = spaceRef.current;
    if (!space) return playfieldRef.current;
    const next = measurePlayfield(space, brandRef.current);
    playfieldRef.current = next;
    topInsetPxRef.current.clear();
    hitRadiusPxRef.current.clear();
    return next;
  }, []);

  const getPlayfield = useCallback((id: string) => {
    return boundsFor(playfieldRef.current, id);
  }, []);

  const spaceSize = useCallback(() => {
    const rect = spaceRef.current?.getBoundingClientRect();
    return {
      w: rect?.width ?? 390,
      h: rect?.height ?? 700,
    };
  }, []);

  // Warm the reveal while the player is still crafting: three.js chunk, studio
  // HDRI and every finished piece's glb (both metals), so the 3D is ready the
  // moment a merge opens the reveal instead of loading behind the blur.
  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      import("./HeroModel").then(({ preloadHeroModel }) => {
        if (cancelled) return;
        const urls = new Set<string>();
        for (const el of CATALOG_ELEMENTS) {
          if (el.kind !== "jewellery") continue;
          for (const metal of ["silver", "gold"] as const) {
            urls.add(jewelleryHeroModelUrl(el.id, metal));
          }
        }
        urls.forEach(preloadHeroModel);
      });
    }, REVEAL_WARMUP_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  // Measure playfield under the logo/hint and de-overlap starters.
  // Nothing may touch at first view (seatApart).
  useLayoutEffect(() => {
    const seat = (bounds: PlayfieldBounds) => {
      const { w, h } = spaceSize();
      const clamped = elementsRef.current.map((el) => {
        const c = clampToPlayfield(el.x, el.y, boundsFor(bounds, el.instanceId));
        return { ...el, x: c.x, y: c.y };
      });
      commitElements(seatApart(clamped, bounds, w, h));
    };
    seat(refreshPlayfield());

    const onResize = () => seat(refreshPlayfield());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [commitElements, refreshPlayfield, spaceSize]);

  const applyExplodePositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const next = elementsRef.current.map((el) => {
        const slot = positions[el.instanceId];
        return slot ? { ...el, x: slot.x, y: slot.y } : el;
      });
      commitElements(next);
    },
    [commitElements],
  );

  const startParentExplode = useCallback(
    (
      mid: { x: number; y: number },
      parentA: string,
      parentB: string,
      approach: { x: number; y: number },
      onDone: () => void,
      /** The new piece the parents burst out of (it grows in with them). */
      sourceId?: string,
      /** Under the reveal's blur: slow and discreet, each piece grows in place. */
      soft = false,
    ) => {
      mergeBurstRef.current?.cancel();

      const bounds = refreshPlayfield();
      const { w, h } = spaceSize();
      const [dirA, dirB] = opposingExplodeDirs(approach.x, approach.y);
      const midClamped = clampToPlayfield(mid.x, mid.y, bounds);

      const phase: ParentMergePhase = soft ? "emerge" : "explode";
      setParentMergePhase({
        [parentA]: phase,
        [parentB]: phase,
        ...(sourceId ? { [sourceId]: phase } : null),
      });

      // Parents on the merge point: where a burst starts them, and where
      // their spots are worked out from.
      const start = elementsRef.current.map((el) =>
        el.instanceId === parentA || el.instanceId === parentB
          ? { ...el, x: midClamped.x, y: midClamped.y }
          : el,
      );

      // Each parent's spot: out on its side, clear of the new piece and of
      // pieces that stay put (finished jewellery) — worked out with the
      // whole board spread (seatApart); only the parents' spots are kept.
      const stays = (el: CraftInstance) =>
        el.kind === "jewellery" || el.instanceId === sourceId;
      const split = (dir: { x: number; y: number }) => ({
        x: midClamped.x + ((dir.x * MERGE_PARENT_SPLIT_PX) / w) * 100,
        y: midClamped.y + ((dir.y * MERGE_PARENT_SPLIT_PX) / h) * 100,
      });
      const ends = { [parentA]: split(dirA), [parentB]: split(dirB) };
      const spots = seatApart(
        start.map((el) => {
          const end = ends[el.instanceId];
          if (!end) return el;
          const c = clampToPlayfield(
            end.x,
            end.y,
            boundsFor(bounds, el.instanceId),
          );
          return { ...el, x: c.x, y: c.y };
        }),
        bounds,
        w,
        h,
        stays,
      );
      const spotOf = (id: string) => {
        const el = spots.find((e) => e.instanceId === id);
        return { x: el?.x ?? midClamped.x, y: el?.y ?? midClamped.y };
      };

      // A burst grows the parents out of the merge point; soft, they grow
      // in place, already on their spot (nothing comes out of one point).
      commitElements(
        soft
          ? start.map((el) =>
              el.instanceId === parentA || el.instanceId === parentB
                ? { ...el, ...spotOf(el.instanceId) }
                : el,
            )
          : start,
      );

      // One smooth move: the new piece and the parents grow (in CSS), out
      // of the merge point with the parents gliding out, or soft, each in
      // place; all three push the other pieces (and each other) aside as
      // they reach them.
      mergeBurstRef.current = runParentBurst({
        mid: midClamped,
        parents: [
          { id: parentA, to: spotOf(parentA) },
          { id: parentB, to: spotOf(parentB) },
        ],
        others: start
          .filter(
            (el) => el.instanceId !== parentA && el.instanceId !== parentB,
          )
          .map((el) => ({
            id: el.instanceId,
            x: el.x,
            y: el.y,
            pinned: stays(el),
          })),
        sourceId,
        soft,
        spaceWidthPx: w,
        spaceHeightPx: h,
        playfield: bounds,
        onFrame: applyExplodePositions,
        onDone: () => {
          mergeBurstRef.current = null;
          setParentMergePhase({});
          onDone();
        },
      });
    },
    [applyExplodePositions, commitElements, refreshPlayfield, spaceSize],
  );

  const handleMove = useCallback(
    (instanceId: string, next: { x: number; y: number }) => {
      if (busyRef.current) return;
      const dragged = elementsRef.current.find(
        (el) => el.instanceId === instanceId,
      );
      if (!dragged) return;

      const bounds = refreshPlayfield();
      const { w, h } = spaceSize();
      const pushed = resolveDragPush(
        elementsRef.current,
        instanceId,
        next,
        bounds,
        w,
        h,
        (otherCatalogId) =>
          allowsCraftOverlap(dragged.catalogId, otherCatalogId),
      );
      commitElements(pushed);
    },
    [commitElements, refreshPlayfield, spaceSize],
  );

  const bringFront = useCallback((instanceId: string) => {
    setOrder((prev) => [...prev.filter((x) => x !== instanceId), instanceId]);
  }, []);

  const handleDragStart = useCallback(
    (instanceId: string, origin: { x: number; y: number }) => {
      dragOriginRef.current[instanceId] = origin;
      draggingRef.current.add(instanceId);
    },
    [],
  );

  const clearBusyIfIdle = useCallback(() => {
    if (!jewelleryRevealOpenRef.current && explodeDoneRef.current) {
      busyRef.current = false;
    }
  }, []);

  /** Drop a running merge where it is (the board is being replaced). */
  const cancelMerge = useCallback(() => {
    mergeBurstRef.current?.cancel();
    mergeBurstRef.current = null;
    if (convergeStepRef.current) {
      window.clearTimeout(convergeStepRef.current.timer);
      convergeStepRef.current = null;
    }
  }, []);

  /**
   * A reveal button was pressed: jump a running merge to its end at once
   * (the step after the suck-in runs now, then the pieces land on their
   * final spot at full size), on the page right away, so the board is
   * settled when it shows again and the 3D piece flies back to the right
   * spot.
   */
  const finishMerge = useCallback(() => {
    if (!convergeStepRef.current && !mergeBurstRef.current) return;
    flushSync(() => {
      const step = convergeStepRef.current;
      if (step) {
        window.clearTimeout(step.timer);
        step.run();
      }
      mergeBurstRef.current?.finish();
    });
  }, []);

  /** Wipe merges/products and seat a fresh starter scatter. */
  const resetCraftToStarters = useCallback(() => {
    cancelMerge();
    shakeJostleRef.current?.cancel();
    shakeJostleRef.current = null;

    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    setParentMergePhase({});
    setUnderFlashId(null);
    dragOriginRef.current = {};
    explodeDoneRef.current = true;
    beginAppointmentToastLeave();

    sheetPushedRef.current = false;
    if (readProductFromHash()) {
      window.history.replaceState(null, "", `#${CRAFT_HASH}`);
    }
    setSheet(null);

    const starters = createStarterInstances();
    const bounds = refreshPlayfield();
    const { w, h } = spaceSize();
    const seated = separateAll(
      starters.map((el) => {
        const c = clampToPlayfield(el.x, el.y, bounds);
        return { ...el, x: c.x, y: c.y };
      }),
      bounds,
      w,
      h,
      allowsCraftOverlap,
    );
    commitElements(seated);
    setOrder(seated.map((el) => el.instanceId));
    busyRef.current = false;
  }, [
    beginAppointmentToastLeave,
    cancelMerge,
    commitElements,
    refreshPlayfield,
    spaceSize,
  ]);

  const startShakeJostle = useCallback(() => {
    cancelMerge();
    shakeJostleRef.current?.cancel();

    busyRef.current = true;
    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    setParentMergePhase({});
    setUnderFlashId(null);
    beginAppointmentToastLeave();
    sheetPushedRef.current = false;
    if (readProductFromHash()) {
      window.history.replaceState(null, "", `#${CRAFT_HASH}`);
    }
    setSheet(null);

    const bounds = refreshPlayfield();
    const { w, h } = spaceSize();
    commitElements(spinStones(elementsRef.current));
    const live = elementsRef.current;
    // nothing to jostle: re-seat the starters rather than leave it empty
    if (live.length === 0) {
      resetCraftToStarters();
      return;
    }

    shakeJostleRef.current = runShakeJostle({
      bodies: live.map((el) => ({
        id: el.instanceId,
        x: el.x,
        y: el.y,
      })),
      spaceWidthPx: w,
      spaceHeightPx: h,
      playfield: bounds,
      onFrame: applyExplodePositions,
      onDone: () => {
        shakeJostleRef.current = null;
        // pieces stay where the jostle left them
        busyRef.current = false;
      },
    });
  }, [
    applyExplodePositions,
    beginAppointmentToastLeave,
    cancelMerge,
    commitElements,
    refreshPlayfield,
    resetCraftToStarters,
    spaceSize,
  ]);

  // Tilting the phone slowly slides the pieces toward the low side.
  const sheetOpenRef = useRef(false);
  sheetOpenRef.current = sheet !== null;

  useEffect(
    () =>
      attachTiltDrift({
        getBodies: () =>
          elementsRef.current.map((el) => ({
            id: el.instanceId,
            x: el.x,
            y: el.y,
            pinned: draggingRef.current.has(el.instanceId),
          })),
        getSpace: () => ({ ...spaceSize(), playfield: playfieldRef.current }),
        // Paused while dragging: tilt collisions would push the merge target
        // away from the finger (they don't know about merge partners).
        isEnabled: () =>
          draggingRef.current.size === 0 &&
          !busyRef.current &&
          !sheetOpenRef.current &&
          !jewelleryRevealOpenRef.current &&
          !shakeJostleRef.current &&
          !mergeBurstRef.current,
        onFrame: applyExplodePositions,
      }),
    [applyExplodePositions, spaceSize],
  );

  // A big shake jostles the pieces, same as the Shake button / logo
  // long-press. Thresholds are high so tilting or a light wobble don't fire.
  // startShakeJostle is read via ref so the listener is attached once.
  const startShakeJostleRef = useRef(startShakeJostle);
  startShakeJostleRef.current = startShakeJostle;

  // iPhone: shake and tilt only get motion events after this permission.
  useEffect(() => requestMotionPermissionOnTap(), []);

  useEffect(() => {
    const detach = attachShakeListener({
      threshold: 20,
      minSamples: 3,
      onShakePulse: (intensity) => {
        shakeJostleRef.current?.kick(intensity);
      },
      onShake: () => {
        console.info("[craft-shake]", "big shake → jostle");
        startShakeJostleRef.current();
      },
    });
    return () => {
      detach();
      shakeJostleRef.current?.cancel();
      shakeJostleRef.current = null;
    };
  }, []);

  // The URL drives the product sheet, so back/forward and shared links work.
  useEffect(() => {
    const onHashChange = () => {
      const detail = detailFromHash();
      if (!detail) sheetPushedRef.current = false;
      setSheet(detail);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!sheet) setSheetFromReveal(false);
  }, [sheet]);

  const showSheet = useCallback((detail: JewelleryDetail) => {
    if (readProductFromHash() === detail.id) return;
    sheetPushedRef.current = true;
    window.location.hash = `${CRAFT_HASH}/${encodeURIComponent(detail.id)}`;
  }, []);

  const openJewellery = useCallback(
    (catalogId: string) => {
      if (busyRef.current && !jewelleryRevealOpenRef.current) return;
      const detail = getJewelleryDetail(catalogId);
      if (detail) showSheet(detail);
    },
    [showSheet],
  );

  const closeJewellery = useCallback(() => {
    if (sheetPushedRef.current) {
      sheetPushedRef.current = false;
      window.history.back();
      return;
    }
    // Landed directly on a product URL: swap it for the craft route in place.
    window.history.replaceState(null, "", `#${CRAFT_HASH}`);
    setSheet(null);
  }, []);

  // Closing the reveal: its 3D piece flies back onto the new piece on the
  // board; that piece stays hidden, then fades in as the 3D one fades out.
  const handleRevealReturn = useCallback(() => {
    // the board settles first: the flight back measures the piece's spot
    finishMerge();
    const id = revealResultIdRef.current;
    if (!id) return null;
    const shape = spaceRef.current?.querySelector(
      `[data-instance-id="${id}"] .craft-el__shape`,
    );
    if (!shape) return null;
    // read before hiding: the hidden state scales the piece down
    const rect = shape.getBoundingClientRect();
    setUnderFlashId(id);
    return rect;
  }, [finishMerge]);

  // ...and fades in over the last beat of the flight
  const handleRevealReturnFlight = useCallback((ms: number) => {
    const id = revealResultIdRef.current;
    if (!id) return;
    window.setTimeout(
      () => {
        setUnderFlashId(null);
        setReturnLandId(id);
      },
      Math.max(0, ms - JEWELLERY_REVEAL_LAND_FADE_MS),
    );
  }, []);

  const closeJewelleryReveal = useCallback(() => {
    setUnderFlashId(null);
    setReturnLandId(null);
    revealResultIdRef.current = null;
    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    clearBusyIfIdle();
  }, [clearBusyIfIdle]);

  // The product page slides in over the still-open reveal, which unmounts
  // once covered (sheet onEntered → closeJewelleryReveal): the board never shows.
  const viewProductFromReveal = useCallback(() => {
    if (!jewelleryReveal) return;
    // the board is settled by the time the product page closes
    finishMerge();
    const detail = jewelleryReveal;
    revealResultIdRef.current = null;
    setSheetFromReveal(true);
    // mount the sheet now, not on the async hashchange
    setSheet(detail);
    showSheet(detail);
  }, [finishMerge, jewelleryReveal, showSheet]);

  const handleDrop = useCallback(
    (instanceId: string, pos: { x: number; y: number }) => {
      draggingRef.current.delete(instanceId);
      if (busyRef.current) return;

      const bounds = refreshPlayfield();
      const clamped = clampToPlayfield(
        pos.x,
        pos.y,
        boundsFor(bounds, instanceId),
      );
      const placed = elementsRef.current.map((el) =>
        el.instanceId === instanceId
          ? { ...el, x: clamped.x, y: clamped.y }
          : el,
      );
      commitElements(placed);

      const dragged = placed.find((el) => el.instanceId === instanceId);
      if (!dragged) return;

      const target = findDropTarget(placed, instanceId, clamped.x, clamped.y);
      const appointmentTarget = findMatchingTarget(
        placed,
        instanceId,
        clamped.x,
        clamped.y,
        (otherCatalogId) =>
          isAppointmentPair(dragged.catalogId, otherCatalogId),
      );
      const recipeCatalogId = target
        ? findRecipeResult(dragged.catalogId, target.catalogId)
        : null;

      // Recipe still crafts. Else show appointment toast only on pointer release
      // while overlapping a ring / chain / earring partner (not while dragging).
      if (!recipeCatalogId && appointmentTarget) {
        showAppointmentToast();
        const { w, h } = spaceSize();
        // No combination: the pieces split apart (only real recipes may stack).
        commitElements(
          separateAll(elementsRef.current, bounds, w, h, isRecipePair),
        );
        delete dragOriginRef.current[instanceId];
        return;
      }

      if (!target) {
        // Soft settle so a non-merge drop doesn't leave overlaps.
        const { w, h } = spaceSize();
        commitElements(
          separateAll(elementsRef.current, bounds, w, h, allowsCraftOverlap),
        );
        delete dragOriginRef.current[instanceId];
        return;
      }

      const resultCatalogId = recipeCatalogId;
      if (!resultCatalogId) {
        const { w, h } = spaceSize();
        commitElements(
          separateAll(elementsRef.current, bounds, w, h, allowsCraftOverlap),
        );
        delete dragOriginRef.current[instanceId];
        return;
      }

      const resultDef = getCatalogElement(resultCatalogId);
      if (!resultDef) return;

      const mid = clampToPlayfield(
        (clamped.x + target.x) / 2,
        (clamped.y + target.y) / 2,
        bounds,
      );

      const origin = dragOriginRef.current[instanceId];
      // From the target toward the side the dragged piece started on: the
      // pieces split back along it, so the drop never swaps their order.
      const approach = origin
        ? { x: origin.x - target.x, y: origin.y - target.y }
        : { x: dragged.x - target.x, y: dragged.y - target.y };

      const parentA = dragged.instanceId;
      const parentB = target.instanceId;

      if (resultDef.kind !== "jewellery") {
        const result = spawnInstance(resultCatalogId, mid.x, mid.y);
        if (!result) return;

        busyRef.current = true;

        const withResult = [
          ...elementsRef.current.map((el) =>
            el.instanceId === parentA || el.instanceId === parentB
              ? { ...el, x: mid.x, y: mid.y }
              : el,
          ),
          result,
        ];
        commitElements(withResult);
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ]);

        startParentExplode(
          mid,
          parentA,
          parentB,
          approach,
          () => {
            busyRef.current = false;
            delete dragOriginRef.current[instanceId];
          },
          result.instanceId,
        );
        return;
      }

      const result = spawnInstance(resultCatalogId, mid.x, mid.y);
      if (!result) return;
      const detail = getJewelleryDetail(resultCatalogId);
      // Metal from the pieces on the board (e.g. silver apatite mid → silver GLB),
      // not from the finished product's static ingredient list.
      const revealMetal = resolveJewelleryMetal(
        dragged.catalogId,
        target.catalogId,
        resultCatalogId,
      );
      // fetch the 3D piece during the merge so it is there to grow from the merge point
      if (detail) {
        import("./HeroModel").then(({ preloadHeroModel }) =>
          preloadHeroModel(jewelleryHeroModelUrl(detail.id, revealMetal)),
        );
      }

      busyRef.current = true;
      explodeDoneRef.current = false;
      // Slide the appointment CTA away before the big product focus opens.
      beginAppointmentToastLeave();

      // Parents jump to the merge point at once; the suck-in animation starts
      // them at their old spot (this px offset) and pulls them in with
      // transform only — animating left/top relaid out every frame (choppy).
      const { w, h } = spaceSize();
      const from: Record<string, { x: number; y: number }> = {};
      for (const el of elementsRef.current) {
        if (el.instanceId !== parentA && el.instanceId !== parentB) continue;
        from[el.instanceId] = {
          x: ((el.x - mid.x) / 100) * w,
          y: ((el.y - mid.y) / 100) * h,
        };
      }
      setParentMergeFrom(from);

      // Open the reveal right at the drop: its blur starts fading in over the
      // board at once, and the whole merge (suck-in, then the pieces growing)
      // plays under it. Its 3D piece flies in once its model is ready.
      if (detail) {
        jewelleryRevealOpenRef.current = true;
        const rect = spaceRef.current?.getBoundingClientRect();
        setJewelleryRevealOrigin(
          rect
            ? {
                x: rect.left + (mid.x / 100) * rect.width,
                y: rect.top + (mid.y / 100) * rect.height,
              }
            : null,
        );
        setJewelleryRevealMetal(revealMetal);
        setRevealArrived(false);
        revealResultIdRef.current = result.instanceId;
        setJewelleryReveal(detail);
      }

      setParentMergePhase({
        [parentA]: "converge",
        [parentB]: "converge",
      });

      commitElements(
        elementsRef.current.map((el) =>
          el.instanceId === parentA || el.instanceId === parentB
            ? { ...el, x: mid.x, y: mid.y }
            : el,
        ),
      );

      // The rest waits for the suck-in to end; a reveal button runs it at
      // once (finishMerge).
      const afterConverge = () => {
        convergeStepRef.current = null;
        const withResult = [...elementsRef.current, result];
        commitElements(withResult);
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ]);

        // Right after the suck-in, no pause: the new piece grows on the merge
        // point and the parents grow back on their spot beside it (on the
        // side each came from), nothing coming out of one point; all three
        // slowly push the board aside as they grow (MERGE_EMERGE_MS), under
        // the reveal's blur, fading in since the drop.
        startParentExplode(
          mid,
          parentA,
          parentB,
          approach,
          () => {
            explodeDoneRef.current = true;
            delete dragOriginRef.current[instanceId];
            clearBusyIfIdle();
          },
          result.instanceId,
          Boolean(detail),
        );
      };
      convergeStepRef.current = {
        timer: window.setTimeout(afterConverge, MERGE_CONVERGE_MS),
        run: afterConverge,
      };
    },
    [
      beginAppointmentToastLeave,
      clearBusyIfIdle,
      commitElements,
      refreshPlayfield,
      showAppointmentToast,
      spaceSize,
      startParentExplode,
    ],
  );

  return (
    <div
      className={`craft-space${
        jewelleryReveal ? " is-jewellery-revealing is-jewellery-reveal-shown" : ""
      }${sheet ? " is-sheet-open" : ""}`}
      ref={spaceRef}
    >
      <CelestialHeader
        ref={brandRef}
        cartCount={cartCount}
        onLogoLongPress={() => {
          console.info("[craft-shake]", "logo long-press → jostle");
          startShakeJostle();
        }}
      />

      {elements.map((el) => (
        <CraftElement
          key={el.instanceId}
          data={el}
          boundsRef={spaceRef}
          getPlayfield={getPlayfield}
          zIndex={10 + Math.max(0, order.indexOf(el.instanceId))}
          underOverlay={jewelleryReveal !== null || sheet !== null}
          mergePhase={parentMergePhase[el.instanceId]}
          mergeFrom={parentMergeFrom[el.instanceId]}
          revealing={underFlashId === el.instanceId}
          returnLand={returnLandId === el.instanceId}
          onMove={handleMove}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onBringFront={bringFront}
          onOpenJewellery={openJewellery}
        />
      ))}

      {appointmentToast !== "off" ? (
        <AppointmentToast
          exiting={appointmentToast === "leaving"}
          onClose={beginAppointmentToastLeave}
          onExited={finishAppointmentToastLeave}
        />
      ) : null}

      {jewelleryReveal ? (
        <JewelleryReveal
          detail={jewelleryReveal}
          metal={jewelleryRevealMetal}
          onCovered={handleRevealCovered}
          onReturn={handleRevealReturn}
          onReturnFlight={handleRevealReturnFlight}
          origin={jewelleryRevealOrigin}
          onClose={closeJewelleryReveal}
          onViewProduct={viewProductFromReveal}
        />
      ) : null}

      {/* while the reveal is up, its product page waits mounted (held) so
          "View product" slides it in at once, its 3D already warm */}
      {sheet || (jewelleryReveal && revealArrived) ? (
        <JewellerySheet
          key={(sheet ?? jewelleryReveal)!.id}
          detail={(sheet ?? jewelleryReveal)!}
          fromReveal={!sheet || sheetFromReveal}
          held={!sheet}
          onEntered={closeJewelleryReveal}
          onClose={closeJewellery}
          onAddToCart={(qty) => setCartCount((n) => n + qty)}
        />
      ) : null}
    </div>
  );
}
