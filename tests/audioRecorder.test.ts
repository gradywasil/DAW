import { describe, it, expect } from "vitest";
import {
  computeBufferPeak,
  normalizeBuffer,
  trimSilence,
  sendRecordingToSlicer,
  sharedSlicerSource,
  isRecorderOpen,
  setIsRecorderOpen,
  recorderStatus,
  setRecorderStatus,
  createAudioBuffer,
} from "../src/audio/audioRecorder";
import { isSlicerOpen } from "../src/audio/sampleSlicer";

// Helper to create synthetic test buffer
function createTestBuffer(
  samples: number[],
  sampleRate = 44100,
): AudioBuffer {
  const buf = createAudioBuffer(1, samples.length, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    data[i] = samples[i]!;
  }
  return buf;
}

describe("Live Microphone Recording & Vocal Sampler Engine", () => {
  it("computes the absolute peak amplitude of an AudioBuffer", () => {
    const buffer = createTestBuffer([0.0, 0.2, -0.75, 0.4, -0.3]);
    expect(computeBufferPeak(buffer)).toBe(0.75);
  });

  it("handles zero buffer peaks safely", () => {
    const buffer = createTestBuffer([0.0, 0.0, 0.0]);
    expect(computeBufferPeak(buffer)).toBe(0.0);
  });

  it("normalizes an AudioBuffer to target peak dB", () => {
    // Peak is 0.5 (~ -6dB)
    const samples = [0.1, -0.5, 0.2, -0.1];
    const buffer = createTestBuffer(samples);

    const normalized = normalizeBuffer(buffer, -0.5);
    const targetLinear = Math.pow(10, -0.5 / 20); // ~0.944
    expect(computeBufferPeak(normalized)).toBeCloseTo(targetLinear, 2);
  });

  it("trims leading and trailing silence below threshold", () => {
    // 100 silent samples, 200 active samples (0.5), 100 silent samples
    const samples: number[] = [];
    for (let i = 0; i < 100; i++) samples.push(0.0001); // Silence (~ -80dB)
    for (let i = 0; i < 200; i++) samples.push(0.5);     // Active signal
    for (let i = 0; i < 100; i++) samples.push(0.0001); // Silence

    const buffer = createTestBuffer(samples);
    const trimmed = trimSilence(buffer, -40);

    expect(trimmed.length).toBeLessThan(buffer.length);
    expect(trimmed.length).toBeGreaterThan(150);
  });

  it("hands recorded take off directly to the Sample Slicer", () => {
    const testBuffer = createTestBuffer([0.1, 0.2, 0.3]);
    setIsRecorderOpen(true);

    sendRecordingToSlicer(testBuffer, "Hook Vocal 01");

    expect(isRecorderOpen()).toBe(false);
    expect(isSlicerOpen()).toBe(true);
    expect(sharedSlicerSource()).toEqual({
      buffer: testBuffer,
      name: "Hook Vocal 01",
    });
  });

  it("updates recorder state cleanly", () => {
    setRecorderStatus("recording");
    expect(recorderStatus()).toBe("recording");
    setRecorderStatus("idle");
    expect(recorderStatus()).toBe("idle");
  });
});
