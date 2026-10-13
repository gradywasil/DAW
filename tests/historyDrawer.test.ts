import { describe, it, expect, beforeEach } from "vitest";
import {
  canUndo,
  canRedo,
  pastCount,
  futureCount,
  historyTimeline,
  jumpToHistoryIndex,
  clearHistory,
} from "../src/state/historyState";
import {
  createFreshProjectDocument,
  docStore,
  loadDocument,
  setProjectName,
  setTransport,
} from "../src/state/store";

describe("HistoryDrawer time-travel scrubbing logic", () => {
  beforeEach(() => {
    const fresh = createFreshProjectDocument();
    loadDocument(fresh);
    clearHistory();
  });

  it("calculates correct step indexing for timeline entries", () => {
    setProjectName("Take 1");
    setTransport({ bpm: 128 });
    setTransport({ swing: 0.15 });

    const timeline = historyTimeline();
    expect(timeline.length).toBe(4); // 3 past + 1 current

    // Past items have negative step delta
    expect(timeline[0]!.stepDelta).toBe(-3);
    expect(timeline[1]!.stepDelta).toBe(-2);
    expect(timeline[2]!.stepDelta).toBe(-1);
    expect(timeline[3]!.stepDelta).toBe(0);
    expect(timeline[3]!.isCurrent).toBe(true);

    // Jump to middle
    jumpToHistoryIndex(1);
    expect(pastCount()).toBe(1);
    expect(futureCount()).toBe(2);

    const scrubbedTimeline = historyTimeline();
    expect(scrubbedTimeline[1]!.isCurrent).toBe(true);
    expect(scrubbedTimeline[1]!.stepDelta).toBe(0);
    expect(scrubbedTimeline[2]!.stepDelta).toBe(1);
    expect(scrubbedTimeline[3]!.stepDelta).toBe(2);
  });

  it("scrubs back to initial document and forward to future", () => {
    setProjectName("Version Alpha");
    setTransport({ bpm: 145 });

    expect(pastCount()).toBe(2);
    expect(futureCount()).toBe(0);

    // Scrub back to 0 (initial)
    jumpToHistoryIndex(0);
    expect(pastCount()).toBe(0);
    expect(futureCount()).toBe(2);
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(true);

    // Scrub forward to 2 (most recent)
    jumpToHistoryIndex(2);
    expect(pastCount()).toBe(2);
    expect(futureCount()).toBe(0);
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);
    expect(docStore.getState().doc.transport.bpm).toBe(145);
  });

  it("clearing history resets stacks to clean state", () => {
    setProjectName("Version Beta");
    setTransport({ bpm: 110 });
    expect(pastCount()).toBe(2);

    clearHistory();
    expect(pastCount()).toBe(0);
    expect(futureCount()).toBe(0);
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });
});
