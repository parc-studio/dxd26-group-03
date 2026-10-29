import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  allowsCraftOverlap,
  createStarterInstances,
  findRecipeResult,
  getCatalogElement,
  getJewelleryDetail,
  isAppointmentPair,
  spawnInstance,
  type JewelleryDetail,
} from "../data/catalog";
import {
  clampToPlayfield,
  defaultPlayfield,
  measurePlayfield,
  resolveDragPush,
  separateAll,
  type PlayfieldBounds,
} from "../lib/craftPhysics";
import { findDropTarget, findMatchingTarget } from "../lib/hitTest";
import { opposingExplodeDirs, runParentExplode } from "../lib/mergeExplode";
import {
  MERGE_CONVERGE_MS,
  MERGE_JEWELLERY_EXPLODE_SCALE,
  MERGE_PUNCH_MS,
} from "../lib/mergeTiming";
import { resolveJewelleryMetal } from "../lib/jewelleryModel";
import {
  attachShakeListener,
  requestMotionPermissionOnFirstTap,
} from "../lib/shakeDetect";
import { runShakeJostle } from "../lib/shakeJostle";
import { attachTiltDrift } from "../lib/tiltDrift";
import type {
  CraftInstance,
  MergeBurstState,
  ParentMergePhase,
} from "../types";
import { AppointmentToast } from "./AppointmentToast";
import { CelestialHeader } from "./CelestialHeader";
import { CraftElement } from "./CraftElement";
import "./CraftSpace.css";
import type { Metal } from "./HeroModel";
import { JewelleryReveal } from "./JewelleryReveal";
import { JewellerySheet } from "./JewellerySheet";
import { MergeBurst } from "./MergeBurst";

const APPOINTMENT_TOAST_MS = 6000;
/** Hold overlap this long before showing the appointment toast. */
const APPOINTMENT_HOLD_MS = 350;

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
  const explodeCancelRef = useRef<(() => void) | null>(null);
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
  const [bursts, setBursts] = useState<MergeBurstState[]>([]);
  const [sheet, setSheet] = useState<JewelleryDetail | null>(detailFromHash);
  const [cartCount, setCartCount] = useState(0);
  /** True when the open sheet pushed its own history entry (close → back). */
  const sheetPushedRef = useRef(false);
  const [jewelleryReveal, setJewelleryReveal] =
    useState<JewelleryDetail | null>(null);
  /** Metal for the open reveal — from the craft parents, not static catalog copy. */
  const [jewelleryRevealMetal, setJewelleryRevealMetal] =
    useState<Metal>("gold");
  const [parentMergePhase, setParentMergePhase] = useState<
    Record<string, ParentMergePhase>
  >({});
  const [underFlashId, setUnderFlashId] = useState<string | null>(null);
  const [appointmentToast, setAppointmentToast] = useState<
    "off" | "on" | "leaving"
  >("off");
  const appointmentToastVisibleRef = useRef(false);
  const appointmentToastTimerRef = useRef<number | null>(null);
  const appointmentHoldTimerRef = useRef<number | null>(null);
  const jewelleryRevealOpenRef = useRef(false);
  const explodeDoneRef = useRef(true);

  const commitElements = useCallback((next: CraftInstance[]) => {
    elementsRef.current = next;
    setElements(next);
  }, []);

  const clearAppointmentHold = useCallback(() => {
    if (appointmentHoldTimerRef.current !== null) {
      window.clearTimeout(appointmentHoldTimerRef.current);
      appointmentHoldTimerRef.current = null;
    }
  }, []);

  const beginAppointmentToastLeave = useCallback(() => {
    clearAppointmentHold();
    if (appointmentToastTimerRef.current !== null) {
      window.clearTimeout(appointmentToastTimerRef.current);
      appointmentToastTimerRef.current = null;
    }
    setAppointmentToast((phase) => (phase === "on" ? "leaving" : phase));
  }, [clearAppointmentHold]);

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

  const armAppointmentHold = useCallback(() => {
    if (jewelleryRevealOpenRef.current) return;
    if (appointmentToastVisibleRef.current) return;
    if (appointmentHoldTimerRef.current !== null) return;
    appointmentHoldTimerRef.current = window.setTimeout(() => {
      appointmentHoldTimerRef.current = null;
      showAppointmentToast();
    }, APPOINTMENT_HOLD_MS);
  }, [showAppointmentToast]);

  useEffect(() => {
    return () => {
      if (appointmentToastTimerRef.current !== null) {
        window.clearTimeout(appointmentToastTimerRef.current);
      }
      if (appointmentHoldTimerRef.current !== null) {
        window.clearTimeout(appointmentHoldTimerRef.current);
      }
    };
  }, []);

  const refreshPlayfield = useCallback(() => {
    const space = spaceRef.current;
    if (!space) return playfieldRef.current;
    const next = measurePlayfield(space, brandRef.current);
    playfieldRef.current = next;
    return next;
  }, []);

  const getPlayfield = useCallback(() => {
    return playfieldRef.current;
  }, []);

  const spaceSize = useCallback(() => {
    const rect = spaceRef.current?.getBoundingClientRect();
    return {
      w: rect?.width ?? 390,
      h: rect?.height ?? 700,
    };
  }, []);

  // Measure playfield under the logo/hint and de-overlap starters.
  useLayoutEffect(() => {
    const bounds = refreshPlayfield();
    const { w, h } = spaceSize();
    const seated = separateAll(
      elementsRef.current.map((el) => {
        const c = clampToPlayfield(el.x, el.y, bounds);
        return { ...el, x: c.x, y: c.y };
      }),
      bounds,
      w,
      h,
      allowsCraftOverlap,
    );
    commitElements(seated);

    const onResize = () => {
      const nextBounds = refreshPlayfield();
      const size = spaceSize();
      commitElements(
        separateAll(
          elementsRef.current.map((el) => {
            const c = clampToPlayfield(el.x, el.y, nextBounds);
            return { ...el, x: c.x, y: c.y };
          }),
          nextBounds,
          size.w,
          size.h,
          allowsCraftOverlap,
        ),
      );
    };
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
      impulseScale = 1,
    ) => {
      explodeCancelRef.current?.();

      const bounds = refreshPlayfield();
      const { w, h } = spaceSize();
      const [dirA, dirB] = opposingExplodeDirs(approach.x, approach.y);
      const midClamped = clampToPlayfield(mid.x, mid.y, bounds);

      setParentMergePhase({
        [parentA]: "explode",
        [parentB]: "explode",
      });

      // Seat parents at the merge point before the impulse so motion is visible.
      // Keep the new result (if any) where it is — other pieces can be nudged.
      commitElements(
        elementsRef.current.map((el) =>
          el.instanceId === parentA || el.instanceId === parentB
            ? { ...el, x: midClamped.x, y: midClamped.y }
            : el,
        ),
      );

      const others = elementsRef.current
        .filter((el) => el.instanceId !== parentA && el.instanceId !== parentB)
        .map((el) => ({
          id: el.instanceId,
          x: el.x,
          y: el.y,
          // Finished jewellery stays put; materials get knocked around.
          pinned: el.kind === "jewellery",
        }));

      explodeCancelRef.current = runParentExplode({
        mid: midClamped,
        bodies: [
          { id: parentA, dir: dirA },
          { id: parentB, dir: dirB },
        ],
        others,
        spaceWidthPx: w,
        spaceHeightPx: h,
        playfield: bounds,
        impulseScale,
        onFrame: applyExplodePositions,
        onDone: () => {
          explodeCancelRef.current = null;
          setParentMergePhase({});
          // Final board-wide separation after the burst settles.
          const size = spaceSize();
          const pf = refreshPlayfield();
          commitElements(
            separateAll(
              elementsRef.current,
              pf,
              size.w,
              size.h,
              allowsCraftOverlap,
            ),
          );
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

      const draggedNow = pushed.find((el) => el.instanceId === instanceId);
      if (!draggedNow) return;
      const appointmentTarget = findMatchingTarget(
        pushed,
        instanceId,
        draggedNow.x,
        draggedNow.y,
        (otherCatalogId) =>
          isAppointmentPair(draggedNow.catalogId, otherCatalogId),
      );
      if (appointmentTarget) {
        armAppointmentHold();
      } else {
        clearAppointmentHold();
      }
    },
    [
      armAppointmentHold,
      clearAppointmentHold,
      commitElements,
      refreshPlayfield,
      spaceSize,
    ],
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

  /** Wipe merges/products and seat a fresh starter scatter. */
  const resetCraftToStarters = useCallback(() => {
    explodeCancelRef.current?.();
    explodeCancelRef.current = null;
    shakeJostleRef.current?.cancel();
    shakeJostleRef.current = null;

    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    setBursts([]);
    setParentMergePhase({});
    setUnderFlashId(null);
    dragOriginRef.current = {};
    explodeDoneRef.current = true;
    clearAppointmentHold();
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
    clearAppointmentHold,
    commitElements,
    refreshPlayfield,
    spaceSize,
  ]);

  const startShakeJostle = useCallback(() => {
    explodeCancelRef.current?.();
    explodeCancelRef.current = null;
    shakeJostleRef.current?.cancel();

    busyRef.current = true;
    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    setBursts([]);
    setParentMergePhase({});
    setUnderFlashId(null);
    clearAppointmentHold();
    beginAppointmentToastLeave();
    sheetPushedRef.current = false;
    if (readProductFromHash()) {
      window.history.replaceState(null, "", `#${CRAFT_HASH}`);
    }
    setSheet(null);

    const bounds = refreshPlayfield();
    const { w, h } = spaceSize();
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
    clearAppointmentHold,
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
        isEnabled: () =>
          !busyRef.current &&
          !sheetOpenRef.current &&
          !jewelleryRevealOpenRef.current &&
          !shakeJostleRef.current &&
          !explodeCancelRef.current,
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
  useEffect(() => requestMotionPermissionOnFirstTap(), []);

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

  const closeJewelleryReveal = useCallback(() => {
    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    clearBusyIfIdle();
  }, [clearBusyIfIdle]);

  const viewProductFromReveal = useCallback(() => {
    if (!jewelleryReveal) return;
    const detail = jewelleryReveal;
    jewelleryRevealOpenRef.current = false;
    setJewelleryReveal(null);
    setJewelleryRevealMetal("gold");
    showSheet(detail);
    clearBusyIfIdle();
  }, [jewelleryReveal, clearBusyIfIdle, showSheet]);

  const handleDrop = useCallback(
    (instanceId: string, pos: { x: number; y: number }) => {
      draggingRef.current.delete(instanceId);
      if (busyRef.current) return;
      clearAppointmentHold();

      const bounds = refreshPlayfield();
      const clamped = clampToPlayfield(pos.x, pos.y, bounds);
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

      // A real recipe on the nearest piece still crafts. Otherwise a thin
      // ring + any stone books an appointment instead of bouncing silently.
      if (!recipeCatalogId && appointmentTarget) {
        showAppointmentToast();
        const { w, h } = spaceSize();
        // Keep appointment pairs stacked; only separate unrelated overlaps.
        commitElements(
          separateAll(
            elementsRef.current,
            bounds,
            w,
            h,
            allowsCraftOverlap,
          ),
        );
        delete dragOriginRef.current[instanceId];
        return;
      }

      if (!target) {
        // Soft settle so a non-merge drop doesn't leave overlaps.
        const { w, h } = spaceSize();
        commitElements(
          separateAll(
            elementsRef.current,
            bounds,
            w,
            h,
            allowsCraftOverlap,
          ),
        );
        delete dragOriginRef.current[instanceId];
        return;
      }

      const resultCatalogId = recipeCatalogId;
      if (!resultCatalogId) {
        const { w, h } = spaceSize();
        commitElements(
          separateAll(
            elementsRef.current,
            bounds,
            w,
            h,
            allowsCraftOverlap,
          ),
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
      const approach = origin
        ? { x: clamped.x - origin.x, y: clamped.y - origin.y }
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

        startParentExplode(mid, parentA, parentB, approach, () => {
          busyRef.current = false;
          delete dragOriginRef.current[instanceId];
        });
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

      busyRef.current = true;
      explodeDoneRef.current = false;
      // Slide the appointment CTA away before the big product focus opens.
      beginAppointmentToastLeave();

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

      window.setTimeout(() => {
        setParentMergePhase({
          [parentA]: "vanish",
          [parentB]: "vanish",
        });

        const burstId = `burst-${Date.now()}`;
        setBursts((b) => [
          ...b,
          { id: burstId, x: mid.x, y: mid.y, kind: "jewellery" },
        ]);

        const withResult = [...elementsRef.current, result];
        commitElements(withResult);
        setOrder((o) => [
          ...o.filter((id) => id !== result.instanceId),
          result.instanceId,
        ]);
        setUnderFlashId(result.instanceId);

        window.setTimeout(() => {
          setUnderFlashId(null);
          setBursts((b) => b.filter((x) => x.id !== burstId));

          if (detail) {
            jewelleryRevealOpenRef.current = true;
            beginAppointmentToastLeave();
            setJewelleryRevealMetal(revealMetal);
            setJewelleryReveal(detail);
          }

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
            MERGE_JEWELLERY_EXPLODE_SCALE,
          );
        }, MERGE_PUNCH_MS);
      }, MERGE_CONVERGE_MS);
    },
    [
      beginAppointmentToastLeave,
      clearAppointmentHold,
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
      className={`craft-space${jewelleryReveal ? " is-jewellery-revealing" : ""}`}
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
          mergePhase={parentMergePhase[el.instanceId]}
          revealing={underFlashId === el.instanceId}
          onMove={handleMove}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onBringFront={bringFront}
          onOpenJewellery={openJewellery}
        />
      ))}

      {bursts.map((b) => (
        <MergeBurst key={b.id} x={b.x} y={b.y} kind={b.kind} />
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
          onClose={closeJewelleryReveal}
          onViewProduct={viewProductFromReveal}
        />
      ) : null}

      {sheet ? (
        <JewellerySheet
          detail={sheet}
          onClose={closeJewellery}
          onAddToCart={(qty) => setCartCount((n) => n + qty)}
        />
      ) : null}
    </div>
  );
}
