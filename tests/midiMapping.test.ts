import { describe, expect, it } from "vitest";
import {
  drumPieceToMidiNote,
  midiNoteToDrumPiece,
  parseMidiBytes,
} from "../src/midi/midiMapping";
import { DRUM_PIECES } from "../src/document/schema";

describe("midiMapping: parseMidiBytes", () => {
  it("returns null for empty or invalid byte streams", () => {
    expect(parseMidiBytes([])).toBeNull();
    expect(parseMidiBytes(new Uint8Array())).toBeNull();
    // Status byte must be >= 0x80
    expect(parseMidiBytes([0x7f, 0x3c, 0x64])).toBeNull();
  });

  it("parses Note On messages with channel, note, and velocity", () => {
    // 0x90 = Note On, Channel 0 (Ch 1)
    const msg = parseMidiBytes([0x90, 60, 100]);
    expect(msg).not.toBeNull();
    expect(msg?.command).toBe("note-on");
    expect(msg?.channel).toBe(0);
    expect(msg?.note).toBe(60);
    expect(msg?.velocity).toBe(100);
  });

  it("converts Note On with velocity 0 into Note Off (MIDI standard)", () => {
    const msg = parseMidiBytes([0x92, 64, 0]);
    expect(msg).not.toBeNull();
    expect(msg?.command).toBe("note-off");
    expect(msg?.channel).toBe(2);
    expect(msg?.note).toBe(64);
    expect(msg?.velocity).toBe(0);
  });

  it("parses Note Off messages", () => {
    // 0x89 = Note Off, Channel 9 (GM Drum channel)
    const msg = parseMidiBytes([0x89, 36, 64]);
    expect(msg).not.toBeNull();
    expect(msg?.command).toBe("note-off");
    expect(msg?.channel).toBe(9);
    expect(msg?.note).toBe(36);
    expect(msg?.velocity).toBe(64);
  });

  it("parses Control Change (CC) messages", () => {
    // 0xB0 = CC, Channel 0, Controller 7 (Volume), Value 120
    const msg = parseMidiBytes([0xb0, 7, 120]);
    expect(msg).not.toBeNull();
    expect(msg?.command).toBe("control-change");
    expect(msg?.channel).toBe(0);
    expect(msg?.controller).toBe(7);
    expect(msg?.value).toBe(120);
  });

  it("parses Pitch Bend messages (14-bit resolution)", () => {
    // 0xE0 = Pitch Bend, Channel 0, LSB 0, MSB 64 (center: 8192)
    const msg = parseMidiBytes([0xe0, 0, 64]);
    expect(msg).not.toBeNull();
    expect(msg?.command).toBe("pitch-bend");
    expect(msg?.channel).toBe(0);
    expect(msg?.value).toBe(8192);
  });
});

describe("midiMapping: midiNoteToDrumPiece", () => {
  it("maps primary GM drum notes to corresponding DrumPiece", () => {
    expect(midiNoteToDrumPiece(36)).toBe("kick");
    expect(midiNoteToDrumPiece(35)).toBe("kick2");
    expect(midiNoteToDrumPiece(38)).toBe("snare");
    expect(midiNoteToDrumPiece(40)).toBe("snare2");
    expect(midiNoteToDrumPiece(37)).toBe("rim");
    expect(midiNoteToDrumPiece(39)).toBe("clap");
    expect(midiNoteToDrumPiece(42)).toBe("hat");
    expect(midiNoteToDrumPiece(44)).toBe("hat2");
    expect(midiNoteToDrumPiece(46)).toBe("openhat");
    expect(midiNoteToDrumPiece(45)).toBe("tom");
    expect(midiNoteToDrumPiece(47)).toBe("midtom");
    expect(midiNoteToDrumPiece(50)).toBe("hightom");
    expect(midiNoteToDrumPiece(49)).toBe("crash");
    expect(midiNoteToDrumPiece(56)).toBe("cowbell");
    expect(midiNoteToDrumPiece(70)).toBe("shaker");
    expect(midiNoteToDrumPiece(75)).toBe("perc");
  });

  it("falls back gracefully for any arbitrary MIDI note", () => {
    for (let note = 0; note <= 127; note++) {
      const piece = midiNoteToDrumPiece(note);
      expect(DRUM_PIECES).toContain(piece);
    }
  });

  it("maps drum pieces back to GM MIDI notes via drumPieceToMidiNote", () => {
    expect(drumPieceToMidiNote("kick")).toBe(36);
    expect(drumPieceToMidiNote("snare")).toBe(38);
    expect(drumPieceToMidiNote("hat")).toBe(42);
    expect(drumPieceToMidiNote("openhat")).toBe(46);
    expect(drumPieceToMidiNote("clap")).toBe(39);
  });
});
