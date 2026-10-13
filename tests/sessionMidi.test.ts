import { describe, expect, it, vi } from "vitest";
import { Session } from "../src/engine/session";
import type { VoiceNoteOnEvent } from "../src/audio/presets";
import {
  EventOutbox,
  type VoiceEngineHost,
  type SampleVoiceHost,
} from "../src/audio/voiceEngine";
import type { AudioContextLike } from "../src/audio/context";

function fakeCtx(): AudioContextLike {
  return {
    currentTime: 10,
    sampleRate: 44100,
    state: "running",
    resume: async () => {},
  };
}

function fakeEngine(): never {
  return {
    getContext: () => fakeCtx(),
    unlock: async () => {},
  } as never;
}

function createTestSession() {
  const sent: VoiceNoteOnEvent[][] = [];
  const host: VoiceEngineHost = {
    outbox: new EventOutbox(4),
    sendEvents: (_lane, events) => {
      sent.push([...events]);
    },
    connect: () => {},
    allOff: () => {},
    dispose: () => {},
  };
  const samples: SampleVoiceHost = {
    sendEvents: (_lane, events) => sent.push([...events]),
    connect: () => {},
    allOff: () => {},
    dispose: () => {},
    preload: async () => {},
    settled: async () => {},
    droppedCount: () => 0,
    stolenCount: () => 0,
  };
  const session = new Session({
    engine: fakeEngine(),
    createVoiceEngineHost: async () => host,
    createSampleVoiceHost: async () => samples,
    setIntervalFn: () => 0,
    clearIntervalFn: () => {},
  });

  return { session, sent };
}

describe("Session.triggerMidiNote", () => {
  it("triggers drum hits using GM note mapping with velocity scaling", async () => {
    const { session, sent } = createTestSession();

    // Trigger GM Kick (note 36) at velocity 127
    await session.triggerMidiNote("drums", 36, 127);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);
    const kickEvent = sent[0][0];
    expect(kickEvent.level).toBeGreaterThan(0.7);

    // Trigger GM Snare (note 38) at half velocity 64
    await session.triggerMidiNote("drums", 38, 64);
    expect(sent).toHaveLength(2);
    const snareEvent = sent[1][0];
    expect(snareEvent.level).toBeLessThan(kickEvent.level);
  });

  it("triggers pitched notes on bass lane with exact MIDI note", async () => {
    const { session, sent } = createTestSession();

    // Trigger C2 (MIDI 36)
    await session.triggerMidiNote("bass", 36, 100);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);
    const bassEvent = sent[0][0];
    expect(bassEvent.freq).toBeCloseTo(65.4, 0); // C2 ~ 65.4 Hz
  });

  it("quantizes pitched notes to scale when enabled", async () => {
    const { session, sent } = createTestSession();

    // Trigger C#4 (MIDI 61) with quantizeToScale: true in C minor
    // In C minor, C# (1) is not in scale; snaps to C (0) or D (2)
    await session.triggerMidiNote("lead", 61, 100, { quantizeToScale: true });
    expect(sent).toHaveLength(1);
    const note = sent[0][0];
    // Frequency should snap to C4 (~261.6Hz) or D4 (~293.7Hz), NOT C#4 (~277Hz)
    expect(note.freq).not.toBeCloseTo(277.18, 0);
  });

  it("triggers triads on chords lane when quantized to scale", async () => {
    const { session, sent } = createTestSession();

    await session.triggerMidiNote("chords", 60, 100, { quantizeToScale: true });
    expect(sent).toHaveLength(1);
    // Should produce 3 notes for the diatonic triad
    expect(sent[0]).toHaveLength(3);
  });
});
