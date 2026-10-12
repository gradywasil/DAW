import { describe, it, expect, beforeEach } from "vitest";
import {
  describeDocumentDiff,
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
  setProjectName,
  setTransport,
  setProjectScale,
  setLaneMix,
  undo,
  redo,
  loadDocument,
  toggleDrumStep,
} from "../src/state/store";

describe("historyState and document diff analyzer", () => {
  beforeEach(() => {
    // Reset document and clear history
    const fresh = createFreshProjectDocument();
    loadDocument(fresh);
    clearHistory();
  });

  describe("describeDocumentDiff", () => {
    it("handles initial state and identity", () => {
      const doc = createFreshProjectDocument();
      expect(describeDocumentDiff(null, doc)).toBe("Initial state");
      expect(describeDocumentDiff(doc, doc)).toBe("No changes");
    });

    it("detects name change", () => {
      const doc1 = createFreshProjectDocument();
      const doc2 = { ...doc1, name: "Neon Horizon" };
      expect(describeDocumentDiff(doc1, doc2)).toBe('Project renamed to "Neon Horizon"');
    });

    it("detects transport BPM and swing changes", () => {
      const doc1 = createFreshProjectDocument();
      const doc2 = {
        ...doc1,
        transport: { ...doc1.transport, bpm: 135 },
      };
      expect(describeDocumentDiff(doc1, doc2)).toBe("Tempo set to 135 BPM");

      const doc3 = {
        ...doc1,
        transport: { ...doc1.transport, swing: 0.25 },
      };
      expect(describeDocumentDiff(doc1, doc3)).toBe("Swing set to 25%");
    });

    it("detects scale changes", () => {
      const doc1 = createFreshProjectDocument();
      const doc2 = {
        ...doc1,
        scale: { root: 2 as const, mode: "dorian" as const },
      };
      expect(describeDocumentDiff(doc1, doc2)).toBe("Scale changed to D dorian");
    });

    it("detects lane mix changes (volume, mute, solo)", () => {
      const doc1 = createFreshProjectDocument();
      const doc2 = {
        ...doc1,
        lanes: doc1.lanes.map((l) => (l.id === "bass" ? { ...l, volume: 0.8 } : l)),
      };
      expect(describeDocumentDiff(doc1, doc2)).toBe("bass volume 80%");

      const doc3 = {
        ...doc1,
        lanes: doc1.lanes.map((l) => (l.id === "lead" ? { ...l, mute: true } : l)),
      };
      expect(describeDocumentDiff(doc1, doc3)).toBe("lead muted");

      const doc4 = {
        ...doc1,
        lanes: doc1.lanes.map((l) => (l.id === "drums" ? { ...l, solo: true } : l)),
      };
      expect(describeDocumentDiff(doc1, doc4)).toBe("drums soloed");
    });

    it("detects drum step changes", () => {
      const doc1 = createFreshProjectDocument();
      const firstPattern = doc1.patterns.drums[0]!;
      const modifiedSteps = {
        ...firstPattern.steps,
        kick: [...firstPattern.steps.kick],
      };
      modifiedSteps.kick[4] = true;
      const doc2 = {
        ...doc1,
        patterns: {
          ...doc1.patterns,
          drums: [{ ...firstPattern, steps: modifiedSteps }],
        },
      };
      expect(describeDocumentDiff(doc1, doc2)).toBe("Drums kick step 5 on");
    });
  });

  describe("reactive timeline navigation", () => {
    it("tracks mutations and reflects canUndo / canRedo", () => {
      expect(canUndo()).toBe(false);
      expect(canRedo()).toBe(false);

      setProjectName("My Synth Track");
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(false);
      expect(pastCount()).toBe(1);

      setTransport({ bpm: 140 });
      expect(pastCount()).toBe(2);

      const timeline = historyTimeline();
      expect(timeline.length).toBe(3); // 2 past + 1 current
      expect(timeline[0]!.isCurrent).toBe(false);
      expect(timeline[0]!.stepDelta).toBe(-2);
      expect(timeline[1]!.isCurrent).toBe(false);
      expect(timeline[1]!.stepDelta).toBe(-1);
      expect(timeline[2]!.isCurrent).toBe(true);
      expect(timeline[2]!.stepDelta).toBe(0);

      // Undo one step
      undo();
      expect(canUndo()).toBe(true);
      expect(canRedo()).toBe(true);
      expect(pastCount()).toBe(1);
      expect(futureCount()).toBe(1);

      // Redo one step
      redo();
      expect(pastCount()).toBe(2);
      expect(futureCount()).toBe(0);
      expect(docStore.getState().doc.transport.bpm).toBe(140);
    });

    it("jumps directly across multiple timeline steps", () => {
      setProjectName("Step 1");
      setTransport({ bpm: 130 });
      setProjectScale({ root: 7, mode: "minor" });
      setLaneMix("bass", { volume: 0.75 });

      expect(pastCount()).toBe(4);

      // Jump back to index 1 (after Step 1, before BPM)
      jumpToHistoryIndex(1);
      expect(pastCount()).toBe(1);
      expect(futureCount()).toBe(3);
      expect(docStore.getState().doc.name).toBe("Step 1");
      expect(docStore.getState().doc.transport.bpm).not.toBe(130);

      // Jump forward to the latest index (4)
      jumpToHistoryIndex(4);
      expect(pastCount()).toBe(4);
      expect(futureCount()).toBe(0);
      expect(docStore.getState().doc.scale.mode).toBe("minor");
      expect(docStore.getState().doc.lanes.find((l) => l.id === "bass")?.volume).toBe(0.75);
    });
  });
});
