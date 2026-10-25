import { createSignal } from "solid-js";
import type { Note, PitchedPattern } from "../document/schema";
import { commitDocumentEdit, docStore } from "../state/store";
import { currentPatternFor } from "../state/selection";

export const [isChordGeneratorOpen, setIsChordGeneratorOpen] =
  createSignal(false);

export type VoicingStyle =
  | "triad"
  | "seventh"
  | "ninth"
  | "drop-2"
  | "first-inversion"
  | "second-inversion";

export type ChordRhythm = "whole-bar" | "half-bar" | "syncopated";

export interface ChordTemplate {
  readonly id: string;
  readonly name: string;
  readonly genre: string;
  readonly description: string;
  readonly rootDegrees: readonly number[]; // Scale degrees relative to 0
  readonly chordNames: readonly string[]; // Roman numeral or standard labels
}

export const CHORD_PROGRESSIONS: readonly ChordTemplate[] = [
  {
    id: "neo-soul",
    name: "Neo-Soul Silk",
    genre: "Neo-Soul / R&B",
    description: "Lush, jazzy 2-5-1-6 progression with rich extensions.",
    rootDegrees: [1, 4, 0, 5],
    chordNames: ["ii9", "V13", "Imaj9", "vi7"],
  },
  {
    id: "lofi-chill",
    name: "Lofi Midnight",
    genre: "Lo-Fi / Hip-Hop",
    description: "Melancholic minor loop popular in late-night study beats.",
    rootDegrees: [0, 3, 6, 2],
    chordNames: ["i7", "iv7", "VII7", "IIImaj7"],
  },
  {
    id: "synthwave",
    name: "80s Neon Drive",
    genre: "Synthwave / Retro",
    description: "Driving minor-to-major progression full of retro nostalgia.",
    rootDegrees: [5, 3, 0, 4],
    chordNames: ["vi", "IV", "I", "V"],
  },
  {
    id: "pop-anthem",
    name: "Golden Anthem",
    genre: "Pop / Indie",
    description:
      "The timeless 4-chord sequence behind hundreds of global hits.",
    rootDegrees: [0, 4, 5, 3],
    chordNames: ["I", "V", "vi", "IV"],
  },
  {
    id: "deep-house",
    name: "Club Warehouse",
    genre: "Deep House / EDM",
    description: "Hypnotic minor club groove with syncopated stabs.",
    rootDegrees: [0, 4, 3, 0],
    chordNames: ["i7", "v7", "iv7", "i7"],
  },
  {
    id: "city-pop",
    name: "Tokyo Boulevard",
    genre: "City Pop / Funk",
    description: "Breezy Japanese 80s Royal Road chord progression.",
    rootDegrees: [3, 4, 2, 5],
    chordNames: ["IVmaj7", "V7", "iii7", "vi7"],
  },
  {
    id: "andalusian",
    name: "Spanish Cadence",
    genre: "Flamenco / Drama",
    description:
      "Descending flamenco turnaround with high tension and resolution.",
    rootDegrees: [0, 6, 5, 4],
    chordNames: ["i", "VII", "VI", "V"],
  },
  {
    id: "r&b-ballad",
    name: "Velvet Groove",
    genre: "R&B / Soul",
    description: "Emotional soulful walk-up with warm major/minor color.",
    rootDegrees: [0, 2, 3, 3],
    chordNames: ["I", "iii", "IV", "iv"],
  },
];

/**
 * Calculates scale degrees for a chord given a root degree and voicing style.
 */
export function buildChordDegrees(
  rootDegree: number,
  voicing: VoicingStyle,
): number[] {
  const r = rootDegree;
  switch (voicing) {
    case "triad":
      return [r, r + 2, r + 4];
    case "seventh":
      return [r, r + 2, r + 4, r + 6];
    case "ninth":
      return [r, r + 2, r + 4, r + 6, r + 8];
    case "first-inversion":
      return [r + 2, r + 4, r + 7];
    case "second-inversion":
      return [r + 4, r + 7, r + 9];
    case "drop-2":
      // Root in bass octave (-7), then 5th, 3rd up, 7th up
      return [r - 7, r + 4, r + 9, r + 13];
    default:
      return [r, r + 2, r + 4];
  }
}

/**
 * Generates an array of Note objects strictly bounded within the pattern's step width.
 */
export function generateChordNotes(
  progression: ChordTemplate,
  voicing: VoicingStyle,
  rhythm: ChordRhythm,
  bars = 1,
): Note[] {
  const notes: Note[] = [];
  const maxSteps = bars * 16;
  const interval = rhythm === "whole-bar" ? 16 : 8;
  const timings =
    rhythm === "syncopated"
      ? Array.from({ length: bars }, (_, bar) =>
          [0, 3, 6, 8, 11, 14].map((start) => bar * 16 + start),
        ).flat()
      : Array.from(
          { length: Math.ceil(maxSteps / interval) },
          (_, i) => i * interval,
        );
  timings.forEach((start, i) => {
    const root = progression.rootDegrees[i % progression.rootDegrees.length];
    const length = rhythm === "syncopated" ? 1.75 : interval - 0.5;
    for (const degree of buildChordDegrees(root, voicing))
      notes.push({ degree, start, length: Math.min(length, maxSteps - start) });
  });
  return notes;
}

/**
 * Applies the generated chord progression to the project's Chords lane pattern.
 * Also optionally writes accompanying root bass notes to the Bass lane.
 */
export function applyProgressionToProject(
  progression: ChordTemplate,
  rhythm: ChordRhythm,
  includeBass = true,
): void {
  const currentDoc = docStore.getState().doc;
  const chords = currentPatternFor("chords");
  if (!chords || chords.kind !== "pitched") return;
  const replace = (pattern: PitchedPattern, notes: Note[]): PitchedPattern => ({
    ...pattern,
    rowDegrees: [
      ...new Set([...pattern.rowDegrees, ...notes.map((n) => n.degree)]),
    ].sort((a, b) => a - b),
    notes,
  });
  // Chords stores roots; the canonical compiler expands each root into a triad.
  const notes = generateChordNotes(
    progression,
    "triad",
    rhythm,
    chords.bars,
  ).filter((_, i) => i % 3 === 0);
  const patterns = {
    ...currentDoc.patterns,
    chords: currentDoc.patterns.chords.map((p) =>
      p.id === chords.id ? replace(chords, notes) : p,
    ),
  };
  const bass = currentPatternFor("bass");
  if (includeBass && bass?.kind === "pitched") {
    const bassNotes = generateChordNotes(
      progression,
      "triad",
      rhythm,
      bass.bars,
    ).filter((_, i) => i % 3 === 0);
    patterns.bass = currentDoc.patterns.bass.map((p) =>
      p.id === bass.id ? replace(bass, bassNotes) : p,
    );
  }
  commitDocumentEdit(currentDoc, { ...currentDoc, patterns });
}
