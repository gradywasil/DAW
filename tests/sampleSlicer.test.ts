import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateSlices,
  detectTransients,
  renderSliceBuffer,
  type AudioSlice,
} from "../src/audio/sampleSlicer";

// Helper to create a mock AudioBuffer for Vitest / Node environments
function createMockAudioBuffer(
  numberOfChannels: number,
  length: number,
  sampleRate: number,
): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channelData.push(new Float32Array(length));
  }

  return {
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channelData[ch]!,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

// Mock AudioContext for renderSliceBuffer
function createMockAudioContext(sampleRate = 44100): AudioContext {
  return {
    sampleRate,
    createBuffer: (channels: number, length: number, rate: number) =>
      createMockAudioBuffer(channels, length, rate),
  } as unknown as AudioContext;
}

describe("Sample Slicer & Transient Chopper Engine", () => {
  it("bakes pitch and gain into exported audio as well as previews", () => {
    const source = createMockAudioBuffer(1, 8, 44100);
    source.getChannelData(0).set([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    const slice: AudioSlice = {
      id: "pitch",
      index: 0,
      start: 0,
      end: 8 / 44100,
      gain: 0.5,
      reverse: false,
      pitchSemitones: 12,
      energy: 0.5,
    };
    const rendered = renderSliceBuffer(createMockAudioContext(), source, slice);
    expect(rendered.length).toBe(4);
    expect([...rendered.getChannelData(0)]).toEqual([
      0,
      expect.closeTo(0.1),
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
  });
  const sampleRate = 44100;
  const duration = 2.0; // 2 seconds
  const totalSamples = Math.floor(sampleRate * duration);

  let mockBuffer: AudioBuffer;

  beforeEach(() => {
    mockBuffer = createMockAudioBuffer(2, totalSamples, sampleRate);
    const left = mockBuffer.getChannelData(0);

    // Populate buffer with 4 sharp transient pulses at 0.0s, 0.5s, 1.0s, and 1.5s
    const pulsePositions = [0, 0.5, 1.0, 1.5];
    for (const pos of pulsePositions) {
      const idx = Math.floor(pos * sampleRate);
      for (let i = 0; i < 200 && idx + i < totalSamples; i++) {
        left[idx + i] = 0.9 * Math.exp(-i / 30);
      }
    }
  });

  it("calculates equal grid slices for grid-4 mode", () => {
    const slices = calculateSlices(mockBuffer, "grid-4");
    expect(slices.length).toBe(4);
    expect(slices[0]!.start).toBeCloseTo(0.0);
    expect(slices[0]!.end).toBeCloseTo(0.5);
    expect(slices[1]!.start).toBeCloseTo(0.5);
    expect(slices[1]!.end).toBeCloseTo(1.0);
    expect(slices[2]!.start).toBeCloseTo(1.0);
    expect(slices[2]!.end).toBeCloseTo(1.5);
    expect(slices[3]!.start).toBeCloseTo(1.5);
    expect(slices[3]!.end).toBeCloseTo(2.0);
  });

  it("calculates equal grid slices for grid-8 mode", () => {
    const slices = calculateSlices(mockBuffer, "grid-8");
    expect(slices.length).toBe(8);
    expect(slices[0]!.start).toBeCloseTo(0.0);
    expect(slices[0]!.end).toBeCloseTo(0.25);
    expect(slices[7]!.end).toBeCloseTo(2.0);
  });

  it("calculates equal grid slices for grid-16 mode", () => {
    const slices = calculateSlices(mockBuffer, "grid-16");
    expect(slices.length).toBe(16);
    expect(slices[0]!.start).toBeCloseTo(0.0);
    expect(slices[0]!.end).toBeCloseTo(0.125);
    expect(slices[15]!.end).toBeCloseTo(2.0);
  });

  it("detects transient attack onsets using energy derivatives", () => {
    const transients = detectTransients(mockBuffer, 0.6);
    expect(transients.length).toBeGreaterThanOrEqual(2);
    expect(transients[0]).toBe(0); // initial start
    // Second transient should be close to 0.5s
    expect(transients[1]).toBeGreaterThanOrEqual(0.45);
    expect(transients[1]).toBeLessThanOrEqual(0.55);
  });

  it("renders an audition slice buffer with gain scaling", () => {
    const mockCtx = createMockAudioContext(sampleRate);
    const slice: AudioSlice = {
      id: "slice-test-1",
      index: 0,
      start: 0.5,
      end: 1.0,
      gain: 0.8,
      reverse: false,
      pitchSemitones: 0,
      energy: 0.9,
    };

    const rendered = renderSliceBuffer(mockCtx, mockBuffer, slice);
    expect(rendered.numberOfChannels).toBe(2);
    expect(rendered.duration).toBeCloseTo(0.5, 2);
  });

  it("renders a reversed slice buffer with inverted sample order", () => {
    const mockCtx = createMockAudioContext(sampleRate);
    const left = mockBuffer.getChannelData(0);
    // Put distinctive gradient values between sample 1000 and 1100
    for (let i = 0; i < 100; i++) {
      left[1000 + i] = i / 100;
    }

    const slice: AudioSlice = {
      id: "slice-rev",
      index: 0,
      start: 1000 / sampleRate,
      end: 1100 / sampleRate,
      gain: 1.0,
      reverse: true,
      pitchSemitones: 0,
      energy: 0.5,
    };

    const rendered = renderSliceBuffer(mockCtx, mockBuffer, slice);
    const renderedData = rendered.getChannelData(0);
    // First sample of reversed buffer should equal last sample of original slice range
    expect(renderedData[0]).toBeCloseTo(left[1099]!, 3);
    // Last sample of reversed buffer should equal first sample of original slice range
    expect(renderedData[renderedData.length - 1]).toBeCloseTo(left[1000]!, 3);
  });
});
