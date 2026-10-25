import { expect, it } from "vitest";
import { Session } from "../src/engine/session";
import { EventOutbox } from "../src/audio/voiceEngine";
import type {
  SampleVoiceHost,
  VoiceEngineHost,
} from "../src/audio/voiceEngine";
import { getPreset, noteParamsFor } from "../src/audio/presets";

function coldSynth() {
  const clock = { now: 10 };
  const dispatched: { when: number; now: number }[] = [];
  let release!: () => void;
  let began!: () => void;
  const loading = new Promise<void>((resolve) => {
    began = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const host: VoiceEngineHost = {
    outbox: new EventOutbox(8),
    sendEvents(_lane, events) {
      for (const event of events)
        dispatched.push({ when: event.time, now: clock.now });
    },
    connect() {},
    allOff() {},
    dispose() {},
  };
  const session = new Session({
    startDelaySeconds: 0.025,
    engine: {
      getContext: () => ({
        get currentTime() {
          return clock.now;
        },
        sampleRate: 44100,
        state: "running",
      }),
      unlock: async () => {},
    } as never,
    createVoiceEngineHost: async () => {
      began();
      await ready;
      return host;
    },
    setIntervalFn: () => 0,
    clearIntervalFn: () => {},
  });
  session.setLaneEvents(
    "lead",
    [
      noteParamsFor(getPreset("preset-lead-1")!, {
        time: 0,
        midi: 60,
        holdSeconds: 0.25,
      }),
    ],
    16,
  );
  return { session, release, loading, clock, dispatched };
}

it("hands the first note to a ready engine before transport UI work consumes its lead", async () => {
  const { session, release, loading, clock, dispatched } = coldSynth();
  const unsubscribe = session.subscribe((snapshot) => {
    if (snapshot.playing) clock.now += 0.2;
  });
  const playing = session.togglePlay();
  await loading;
  release();
  await playing;
  expect(dispatched).toHaveLength(1);
  expect(dispatched[0]!.when).toBeGreaterThan(dispatched[0]!.now);
  unsubscribe();
  await session.togglePlay();
});

it("waits for a cold synth worklet before starting the transport clock", async () => {
  const { session, release, loading } = coldSynth();
  const playing = session.togglePlay();
  await loading;
  expect(session.transport.snapshot.playing).toBe(false);
  release();
  await playing;
  expect(session.transport.snapshot.playing).toBe(true);
  await session.togglePlay();
});

it("a second Play press cancels cold synth preparation", async () => {
  const { session, release, loading } = coldSynth();
  const playing = session.togglePlay();
  await loading;
  await session.togglePlay();
  release();
  await playing;
  expect(session.transport.snapshot.playing).toBe(false);
});

it("waits for an agent-selected sample before starting transport", async () => {
  let ready = false;
  const loaded: string[] = [];
  const host: VoiceEngineHost = {
    outbox: new EventOutbox(8),
    sendEvents() {},
    connect() {},
    allOff() {},
    dispose() {},
  };
  const samples: SampleVoiceHost = {
    sendEvents() {},
    connect() {},
    allOff() {},
    dispose() {},
    async preload(refs) {
      loaded.push(...refs);
      await Promise.resolve();
      ready = true;
    },
    async settled() {},
    droppedCount: () => 0,
    stolenCount: () => 0,
  };
  const session = new Session({
    engine: {
      getContext: () => ({
        currentTime: 10,
        sampleRate: 44100,
        state: "running",
        resume: async () => {},
      }),
      unlock: async () => {},
    } as never,
    createVoiceEngineHost: async () => host,
    createSampleVoiceHost: async () => samples,
    setIntervalFn: () => 0,
    clearIntervalFn: () => {},
  });
  session.setLaneSound("bass", "preset-bass-13");
  let readyAtPlay = false;
  const stop = session.subscribe((s) => {
    if (s.playing) readyAtPlay = ready;
  });
  await session.togglePlay();
  stop();
  await session.togglePlay();
  expect(loaded).toContain("voice.bass.lowtone");
  expect(readyAtPlay).toBe(true);

  // A second press while decoding cancels the pending start.
  let finish = () => {};
  samples.preload = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const pending = session.togglePlay();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await session.togglePlay();
  finish();
  await pending;
  expect(session.transport.snapshot.playing).toBe(false);
});
