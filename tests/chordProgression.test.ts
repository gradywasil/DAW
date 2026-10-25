import { describe, it, expect } from "vitest";
import {
  buildChordDegrees,
  generateChordNotes,
  CHORD_PROGRESSIONS,
  applyProgressionToProject,
} from "../src/audio/chordProgression";
import { docStore, loadDocument } from "../src/state/store";
import { createDemoProject } from "../src/document/demoSong";
import { selectPattern } from "../src/state/selection";

describe("Scale-Aware Chord Progression & Voicing Generator", () => {
  it("changes the selected pattern, preserves other patterns, and supports one undo", () => {
    const doc = createDemoProject();
    const original = doc.patterns.chords[0];
    const selected = { ...original, id: "chords-selected", name: "B" };
    loadDocument({
      ...doc,
      patterns: { ...doc.patterns, chords: [...doc.patterns.chords, selected] },
    });
    selectPattern("chords", selected.id);
    const before = docStore.getState().doc;
    applyProgressionToProject(CHORD_PROGRESSIONS[0], "whole-bar", false);
    const after = docStore.getState().doc;
    expect(after.patterns.chords[0]).toBe(before.patterns.chords[0]);
    const generated = after.patterns.chords.at(-1);
    if (generated?.kind === "pitched")
      expect(generated.notes).toHaveLength(generated.bars);
    expect(after.patterns.chords.at(-1)).not.toEqual(
      before.patterns.chords.at(-1),
    );
    docStore.temporal.getState().undo();
    expect(docStore.getState().doc).toEqual(before);
  });
  it("builds correct chord degrees for triad voicings", () => {
    const degrees = buildChordDegrees(0, "triad");
    expect(degrees).toEqual([0, 2, 4]);

    const iiDegrees = buildChordDegrees(1, "triad");
    expect(iiDegrees).toEqual([1, 3, 5]);
  });

  it("builds correct chord degrees for 7th and 9th voicings", () => {
    const seventh = buildChordDegrees(0, "seventh");
    expect(seventh).toEqual([0, 2, 4, 6]);

    const ninth = buildChordDegrees(0, "ninth");
    expect(ninth).toEqual([0, 2, 4, 6, 8]);
  });

  it("builds correct chord degrees for inversions and drop-2 voicings", () => {
    const firstInv = buildChordDegrees(0, "first-inversion");
    expect(firstInv).toEqual([2, 4, 7]);

    const secondInv = buildChordDegrees(0, "second-inversion");
    expect(secondInv).toEqual([4, 7, 9]);

    const drop2 = buildChordDegrees(0, "drop-2");
    expect(drop2).toEqual([-7, 4, 9, 13]);
  });

  it("generates correct timing notes for whole-bar and half-bar rhythms", () => {
    const neoSoul = CHORD_PROGRESSIONS.find((p) => p.id === "neo-soul")!;
    expect(neoSoul).toBeDefined();

    const wholeBarNotes = generateChordNotes(
      neoSoul,
      "seventh",
      "whole-bar",
      2,
    );
    // 2 bars with 4 notes per chord = 8 notes total
    expect(wholeBarNotes.length).toBe(8);
    // First chord starts at step 0, second chord at step 16
    expect(wholeBarNotes[0]!.start).toBe(0);
    expect(wholeBarNotes[4]!.start).toBe(16);

    const halfBarNotes = generateChordNotes(neoSoul, "seventh", "half-bar", 2);
    // 4 chords with 4 notes = 16 notes total
    expect(halfBarNotes.length).toBe(16);
    expect(halfBarNotes[0]!.start).toBe(0);
    expect(halfBarNotes[4]!.start).toBe(8);
    expect(halfBarNotes[8]!.start).toBe(16);
    expect(halfBarNotes[12]!.start).toBe(24);
  });

  it("verifies all chord templates have consistent roots and chord names", () => {
    for (const template of CHORD_PROGRESSIONS) {
      expect(template.rootDegrees.length).toBeGreaterThanOrEqual(3);
      expect(template.rootDegrees.length).toBe(template.chordNames.length);
      expect(template.genre.length).toBeGreaterThan(0);
    }
  });

  it("applies chord progression and accompanying bassline to docStore cleanly", () => {
    const lofi = CHORD_PROGRESSIONS.find((p) => p.id === "lofi-chill")!;
    applyProgressionToProject(lofi, "half-bar", true);

    const updatedDoc = docStore.getState().doc;
    const chordsPattern = updatedDoc.patterns.chords[0];
    expect(chordsPattern).toBeDefined();
    if (chordsPattern && chordsPattern.kind === "pitched") {
      expect(chordsPattern.notes.length).toBeGreaterThan(0);
      // All note degrees should be in rowDegrees
      const degreeSet = new Set(chordsPattern.rowDegrees);
      for (const note of chordsPattern.notes) {
        expect(degreeSet.has(note.degree)).toBe(true);
      }
    }

    const bassPattern = updatedDoc.patterns.bass[0];
    expect(bassPattern).toBeDefined();
    if (bassPattern && bassPattern.kind === "pitched") {
      expect(bassPattern.notes.length).toBeGreaterThan(0);
    }
  });
});
