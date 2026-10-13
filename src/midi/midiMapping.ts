/**
 * MIDI message decoding and instrument mapping for Bitbounce.
 * Pure functions: maps incoming wire bytes to typed MIDI commands,
 * and translates General MIDI drum notes to Bitbounce DrumPiece values.
 */

import { DRUM_PIECES, type DrumPiece } from "../document/schema";

/** GM note numbers for all 16 drum voices. The original six mappings stay fixed. */
export const GM_DRUM_NOTES: Readonly<Record<DrumPiece, number>> = {
  kick: 36, // Bass Drum 1
  snare: 38, // Acoustic Snare
  hat: 42, // Closed Hi-Hat
  openhat: 46, // Open Hi-Hat
  clap: 39, // Hand Clap
  tom: 45, // Low Tom
  kick2: 35,
  snare2: 40,
  hat2: 44,
  midtom: 47,
  hightom: 50,
  rim: 37,
  shaker: 70,
  cowbell: 56,
  crash: 49,
  perc: 75,
} as const;

/**
 * Standard GM drum note assignments mapped directly to Bitbounce DrumPiece.
 * Includes both primary GM note mappings and common drum pad controller aliases.
 */
const MIDI_NOTE_TO_DRUM: Readonly<Record<number, DrumPiece>> = {
  // Kicks
  35: "kick2",
  36: "kick",
  // Snares & Rim
  37: "rim",
  38: "snare",
  40: "snare2",
  // Clap
  39: "clap",
  // Hats
  42: "hat",
  44: "hat2",
  46: "openhat",
  // Toms
  41: "tom", // Low floor tom
  43: "tom", // High floor tom
  45: "tom", // Low tom
  47: "midtom", // Low-mid tom
  48: "midtom", // High-mid tom
  50: "hightom", // High tom
  // Cymbals
  49: "crash", // Crash cymbal 1
  51: "crash", // Ride cymbal 1
  57: "crash", // Crash cymbal 2
  59: "crash", // Ride cymbal 2
  // Aux Percussion & Shaker
  56: "cowbell",
  69: "shaker", // Cabasa
  70: "shaker", // Maracas
  75: "perc", // Claves
  76: "perc", // Hi wood block
  77: "perc", // Low wood block
};

/**
 * Map an incoming MIDI note (0..127) to a DrumPiece.
 * If the note matches a standard GM drum key, the corresponding piece is returned.
 * Otherwise falls back to deterministic modulo mapping across all 16 drum voices.
 */
export function midiNoteToDrumPiece(note: number): DrumPiece {
  const direct = MIDI_NOTE_TO_DRUM[note];
  if (direct) return direct;
  const clamped = Math.max(0, Math.min(127, Math.round(note)));
  return DRUM_PIECES[clamped % DRUM_PIECES.length]!;
}

/**
 * Map a Bitbounce DrumPiece to its standard General MIDI note number.
 */
export function drumPieceToMidiNote(piece: DrumPiece): number {
  return GM_DRUM_NOTES[piece] ?? 36;
}

export type MidiCommandType =
  | "note-on"
  | "note-off"
  | "control-change"
  | "pitch-bend"
  | "other";

export interface ParsedMidiMessage {
  readonly command: MidiCommandType;
  /** MIDI channel 0..15 (channel 9 is GM Drum channel). */
  readonly channel: number;
  /** MIDI note number 0..127 (note-on / note-off). */
  readonly note?: number;
  /** Velocity 0..127 (note-on / note-off). */
  readonly velocity?: number;
  /** CC controller number 0..127 (control-change). */
  readonly controller?: number;
  /** CC value 0..127 (control-change). */
  readonly value?: number;
  /** Raw wire bytes. */
  readonly raw: Uint8Array;
}

/**
 * Parse raw MIDI wire bytes into a typed ParsedMidiMessage.
 * Accurately handles the MIDI standard law: Note On with velocity 0 is Note Off.
 */
export function parseMidiBytes(
  bytes: Uint8Array | readonly number[],
): ParsedMidiMessage | null {
  if (!bytes || bytes.length === 0) return null;
  const status = bytes[0]!;
  if (status < 0x80) return null; // Running status or data byte

  const commandNibble = status >> 4;
  const channel = status & 0x0f;
  const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  if (commandNibble === 0x9) {
    const note = bytes[1] ?? 0;
    const velocity = bytes[2] ?? 0;
    if (velocity === 0) {
      return { command: "note-off", channel, note, velocity: 0, raw };
    }
    return { command: "note-on", channel, note, velocity, raw };
  }

  if (commandNibble === 0x8) {
    const note = bytes[1] ?? 0;
    const velocity = bytes[2] ?? 0;
    return { command: "note-off", channel, note, velocity, raw };
  }

  if (commandNibble === 0xb) {
    const controller = bytes[1] ?? 0;
    const value = bytes[2] ?? 0;
    return { command: "control-change", channel, controller, value, raw };
  }

  if (commandNibble === 0xe) {
    const lsb = bytes[1] ?? 0;
    const msb = bytes[2] ?? 0;
    const value = (msb << 7) | lsb; // 14-bit pitch bend (8192 is center)
    return { command: "pitch-bend", channel, value, raw };
  }

  return { command: "other", channel, raw };
}
