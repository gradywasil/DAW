/**
 * Reactive Undo / Redo History and Time Travel Timeline State.
 * Bridges Zundo's temporal store with Solid signals for real-time
 * history visualization, breadcrumb scrubbing, and diff inspection.
 */

import { createSignal, createMemo } from "solid-js";
import { docStore, undo as storeUndo, redo as storeRedo } from "./store";
import {
  ALL_LANE_IDS,
  DRUM_PIECES,
  PITCH_CLASS_NAMES,
  type ProjectDocument,
} from "../document/schema";

export interface HistoryItem {
  readonly id: string;
  readonly index: number;
  readonly label: string;
  readonly stepDelta: number; // < 0 for past, 0 for current, > 0 for future
  readonly isCurrent: boolean;
  readonly doc: ProjectDocument;
}

/**
 * Compare two project documents and produce a concise, human-readable summary
 * of the change (e.g. "BPM 128", "Drums pattern edited", "Lead sound changed").
 */
export function describeDocumentDiff(
  prev: ProjectDocument | null | undefined,
  curr: ProjectDocument,
): string {
  if (!prev) return "Initial state";
  if (prev === curr) return "No changes";

  // 1. Name change
  if (prev.name !== curr.name) {
    return `Project renamed to "${curr.name}"`;
  }

  // 2. Transport changes
  if (prev.transport.bpm !== curr.transport.bpm) {
    return `Tempo set to ${curr.transport.bpm} BPM`;
  }
  if (prev.transport.swing !== curr.transport.swing) {
    return `Swing set to ${Math.round(curr.transport.swing * 100)}%`;
  }

  // 3. Scale changes
  if (prev.scale.root !== curr.scale.root || prev.scale.mode !== curr.scale.mode) {
    const rootName =
      PITCH_CLASS_NAMES[
        curr.scale.root as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
      ] ?? String(curr.scale.root);
    return `Scale changed to ${rootName} ${curr.scale.mode}`;
  }

  // 4. Mix / volume / solo / mute / octave changes
  for (const currLane of curr.lanes) {
    const prevLane = prev.lanes.find((l) => l.id === currLane.id);
    if (!prevLane) continue;

    if (currLane.volume !== prevLane.volume) {
      const vol = Math.round((currLane.volume ?? 1) * 100);
      return `${currLane.id} volume ${vol}%`;
    }
    if (currLane.mute !== prevLane.mute) {
      return `${currLane.id} ${currLane.mute ? "muted" : "unmuted"}`;
    }
    if (currLane.solo !== prevLane.solo) {
      return `${currLane.id} ${currLane.solo ? "soloed" : "unsoloed"}`;
    }
    if ("octave" in currLane && "octave" in prevLane) {
      if (currLane.octave !== prevLane.octave) {
        const oct = currLane.octave ?? 0;
        return `${currLane.id} octave ${oct >= 0 ? `+${oct}` : oct}`;
      }
    }
    if ("presetId" in currLane && "presetId" in prevLane) {
      if (currLane.presetId !== prevLane.presetId) {
        return `${currLane.id} sound preset changed`;
      }
    }
    if ("kitId" in currLane && "kitId" in prevLane) {
      if (currLane.kitId !== prevLane.kitId) {
        return `Drum kit changed to ${currLane.kitId}`;
      }
    }
    if (currLane.fxChain.length !== prevLane.fxChain.length) {
      return `${currLane.id} FX chain modified`;
    }
  }

  // 5. Pattern content edits (notes, hits)
  for (const lane of ALL_LANE_IDS) {
    const prevList = prev.patterns?.[lane] ?? [];
    const currList = curr.patterns?.[lane] ?? [];
    if (prevList.length !== currList.length) {
      return `${lane} pattern pool changed`;
    }
    for (let i = 0; i < currList.length; i++) {
      const cp = currList[i]!;
      const pp = prevList.find((p) => p.id === cp.id);
      if (!pp) continue;

      if (cp.kind === "drums" && pp.kind === "drums") {
        for (const piece of DRUM_PIECES) {
          const cSteps = cp.steps[piece] ?? [];
          const pSteps = pp.steps[piece] ?? [];
          for (let step = 0; step < Math.max(cSteps.length, pSteps.length); step++) {
            if (cSteps[step] !== pSteps[step]) {
              return `Drums ${piece} step ${step + 1} ${cSteps[step] ? "on" : "off"}`;
            }
          }
        }
      } else if (cp.kind === "pitched" && pp.kind === "pitched") {
        if (cp.notes.length !== pp.notes.length) {
          return `${lane} note count changed (${cp.notes.length})`;
        }
        for (let n = 0; n < cp.notes.length; n++) {
          const cn = cp.notes[n]!;
          const pn = pp.notes[n];
          if (
            !pn ||
            cn.degree !== pn.degree ||
            cn.start !== pn.start ||
            cn.length !== pn.length
          ) {
            return `${lane} note edit at step ${cn.start + 1}`;
          }
        }
      }

      if (cp.bars !== pp.bars) {
        return `${lane} pattern ${cp.id} length set to ${cp.bars} bars`;
      }
    }
  }

  // 6. Chains (arrangement slot sequence per lane)
  for (const lane of ALL_LANE_IDS) {
    const prevSlots = prev.songChain?.[lane];
    const currSlots = curr.songChain?.[lane];
    if (!prevSlots || !currSlots) continue;
    if (prevSlots.length !== currSlots.length) {
      return `${lane} chain length modified`;
    }
    for (let s = 0; s < currSlots.length; s++) {
      if (currSlots[s] !== prevSlots[s]) {
        return `${lane} arrangement slot ${s + 1} changed`;
      }
    }
  }

  return "Project edit";
}

// ---------------------------------------------------------------------------
// Reactive History Store
// ---------------------------------------------------------------------------

const [pastCount, setPastCount] = createSignal(
  docStore.temporal.getState().pastStates.length,
);
const [futureCount, setFutureCount] = createSignal(
  docStore.temporal.getState().futureStates.length,
);
const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = createSignal(false);
const [historyRevision, setHistoryRevision] = createSignal(0);

// Sync with temporal changes
function syncTemporal() {
  const temporal = docStore.temporal.getState();
  setPastCount(temporal.pastStates.length);
  setFutureCount(temporal.futureStates.length);
  setHistoryRevision((r) => r + 1);
}

// Subscribe to temporal store and docStore mutations
docStore.temporal.subscribe(() => {
  syncTemporal();
});

docStore.subscribe(() => {
  syncTemporal();
});

export const canUndo = () => pastCount() > 0;
export const canRedo = () => futureCount() > 0;
export { pastCount, futureCount, isHistoryDrawerOpen, setIsHistoryDrawerOpen };

export function toggleHistoryDrawer(): void {
  setIsHistoryDrawerOpen((open) => !open);
}

/**
 * Rewind history by the given number of steps (default 1).
 */
export function undo(steps = 1): void {
  if (steps <= 0) return;
  if (steps === 1) {
    storeUndo();
  } else {
    docStore.temporal.getState().undo(steps);
  }
  syncTemporal();
}

/**
 * Fast-forward history by the given number of steps (default 1).
 */
export function redo(steps = 1): void {
  if (steps <= 0) return;
  if (steps === 1) {
    storeRedo();
  } else {
    docStore.temporal.getState().redo(steps);
  }
  syncTemporal();
}

/**
 * Clears the undo/redo history stacks.
 */
export function clearHistory(): void {
  docStore.temporal.getState().clear();
  syncTemporal();
}

/**
 * Jump directly to any entry in the history timeline.
 * If targetIndex < currentIndex, undos (currentIndex - targetIndex) times.
 * If targetIndex > currentIndex, redos (targetIndex - currentIndex) times.
 */
export function jumpToHistoryIndex(targetIndex: number): void {
  const temporal = docStore.temporal.getState();
  const currentIndex = temporal.pastStates.length;
  if (targetIndex === currentIndex) return;

  if (targetIndex < currentIndex) {
    const steps = currentIndex - targetIndex;
    undo(steps);
  } else {
    const steps = targetIndex - currentIndex;
    redo(steps);
  }
}

/**
 * Memoized list of all timeline items: past, present, and future.
 * Recomputed automatically when history changes or documents mutate.
 */
export const historyTimeline = createMemo((): readonly HistoryItem[] => {
  // Read revision signal to subscribe to updates
  historyRevision();

  const temporal = docStore.temporal.getState();
  const past = temporal.pastStates;
  const future = temporal.futureStates;
  const currentDoc = docStore.getState().doc;

  const items: HistoryItem[] = [];

  // 1. Past states (from oldest to newest)
  for (let i = 0; i < past.length; i++) {
    const doc = past[i]?.doc;
    if (!doc) continue;
    const prevDoc = i === 0 ? null : past[i - 1]?.doc;
    const label = describeDocumentDiff(prevDoc, doc);
    items.push({
      id: `past-${i}`,
      index: i,
      label,
      stepDelta: i - past.length, // negative
      isCurrent: false,
      doc,
    });
  }

  // 2. Current state
  const prevCurrentDoc = past.length > 0 ? past[past.length - 1]?.doc : null;
  const currentLabel =
    past.length === 0
      ? "Initial Document"
      : describeDocumentDiff(prevCurrentDoc, currentDoc);

  items.push({
    id: "current",
    index: past.length,
    label: currentLabel,
    stepDelta: 0,
    isCurrent: true,
    doc: currentDoc,
  });

  // 3. Future states (from immediate next to furthest redo)
  let prevFutureDoc: ProjectDocument = currentDoc;
  for (let j = 0; j < future.length; j++) {
    const doc = future[j]?.doc;
    if (!doc) continue;
    const label = describeDocumentDiff(prevFutureDoc, doc);
    prevFutureDoc = doc;
    const futureIndex = past.length + 1 + j;
    items.push({
      id: `future-${j}`,
      index: futureIndex,
      label,
      stepDelta: j + 1, // positive
      isCurrent: false,
      doc,
    });
  }

  return items;
});
