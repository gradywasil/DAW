import { createSignal } from "solid-js";
import type { Note, PitchedPattern, ProjectDocument } from "../document/schema";
import { commitDocumentEdit, docStore } from "../state/store";

export const [isChordGeneratorOpen, setIsChordGeneratorOpen] = createSignal(false);

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
    description: "The timeless 4-chord sequence behind hundreds of global hits.",
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
    description: "Descending flamenco turnaround with high tension and resolution.",
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
  const roots = progression.rootDegrees;
  const numChords = roots.length;
  const maxSteps = bars * 16;

  if (rhythm === "whole-bar") {
    // 1 chord per 16 steps
    const chordsToPlace = Math.min(bars, numChords);
    for (let i = 0; i < chordsToPlace; i++) {
      const root = roots[i % numChords]!;
      const degrees = buildChordDegrees(root, voicing);
      const start = i * 16;
      const length = 15; // 15 sixteenths with 1-sixteenth breath
      if (start < maxSteps) {
        for (const deg of degrees) {
          notes.push({ degree: deg, start, length });
        }
      }
    }
  } else if (rhythm === "half-bar") {
    // If 1 bar: 4 chords fit at 4-step intervals (beats 1, 2, 3, 4)
    // If >= 2 bars: chords fit at 8-step intervals (half-bars)
    const stepInterval = bars === 1 ? 4 : 8;
    const noteLength = bars === 1 ? 3.75 : 7.5;
    const maxChords = Math.min(Math.floor(maxSteps / stepInterval), numChords);

    for (let i = 0; i < maxChords; i++) {
      const root = roots[i % numChords]!;
      const degrees = buildChordDegrees(root, voicing);
      const start = i * stepInterval;
      if (start < maxSteps) {
        for (const deg of degrees) {
          notes.push({ degree: deg, start, length: noteLength });
        }
      }
    }
  } else if (rhythm === "syncopated") {
    // 1-bar syncopation (steps 0, 3, 6, 8, 11, 14)
    const syncPattern = [
      { start: 0, length: 2.75 },
      { start: 3, length: 2.75 },
      { start: 6, length: 1.75 },
      { start: 8, length: 2.75 },
      { start: 11, length: 2.75 },
      { start: 14, length: 1.75 },
    ];
    for (let i = 0; i < syncPattern.length; i++) {
      const timing = syncPattern[i]!;
      if (timing.start < maxSteps) {
        const root = roots[i % numChords]!;
        const degrees = buildChordDegrees(root, voicing);
        for (const deg of degrees) {
          notes.push({ degree: deg, start: timing.start, length: timing.length });
        }
      }
    }
  }

  return notes;
}

/**
 * Applies the generated chord progression to the project's Chords lane pattern.
 * Also optionally writes accompanying root bass notes to the Bass lane.
 */
export function applyProgressionToProject(
  progression: ChordTemplate,
  voicing: VoicingStyle,
  rhythm: ChordRhythm,
  includeBass = true,
): void {
  const currentDoc = docStore.getState().doc;

  const chordsPatterns = currentDoc.patterns.chords;
  if (!chordsPatterns || chordsPatterns.length === 0) return;

  const activeChordsPattern = chordsPatterns[0] as PitchedPattern;
  const bars = activeChordsPattern.bars;
  const chordNotes = generateChordNotes(progression, voicing, rhythm, bars);

  // Compute required row degrees so all chord notes are visible on the grid
  const uniqueDegrees = Array.from(new Set(chordNotes.map((n) => n.degree))).sort(
    (a, b) => a - b,
  );

  const updatedDoc: ProjectDocument = JSON.parse(JSON.stringify(currentDoc));

  // Update Chords lane active pattern
  const existingDegrees = new Set(activeChordsPattern.rowDegrees);
  for (const deg of uniqueDegrees) {
    existingDegrees.add(deg);
  }
  const combinedDegrees = Array.from(existingDegrees).sort((a, b) => a - b);

  const nextChordsPattern: PitchedPattern = {
    ...activeChordsPattern,
    rowDegrees: combinedDegrees,
    notes: chordNotes,
  };

  const nextPatterns: Record<string, readonly any[]> = {
    ...updatedDoc.patterns,
    chords: [nextChordsPattern, ...chordsPatterns.slice(1)],
  };

  // Update Bass lane if requested
  if (includeBass) {
    const bassPatterns = updatedDoc.patterns.bass;
    if (bassPatterns && bassPatterns.length > 0) {
      const activeBassPattern = bassPatterns[0] as PitchedPattern;
      const bassBars = activeBassPattern.bars;
      const bassMaxSteps = bassBars * 16;
      const bassNotes: Note[] = [];

      const stepInterval = bassBars === 1 ? 4 : 8;
      const bassLen = bassBars === 1 ? 3.75 : 7.0;
      const maxChords = Math.min(Math.floor(bassMaxSteps / stepInterval), progression.rootDegrees.length);

      for (let i = 0; i < maxChords; i++) {
        const deg = progression.rootDegrees[i]!;
        const start = i * stepInterval;
        if (start < bassMaxSteps) {
          bassNotes.push({ degree: deg, start, length: bassLen });
        }
      }

      const existingBassDegrees = new Set(activeBassPattern.rowDegrees);
      for (const n of bassNotes) {
        existingBassDegrees.add(n.degree);
      }

      const nextBassPattern: PitchedPattern = {
        ...activeBassPattern,
        rowDegrees: Array.from(existingBassDegrees).sort((a, b) => a - b),
        notes: bassNotes,
      };

      nextPatterns.bass = [nextBassPattern, ...bassPatterns.slice(1)];
    }
  }

  (updatedDoc as any).patterns = nextPatterns;

  commitDocumentEdit(currentDoc, updatedDoc);
}
