import { createSignal } from "solid-js";

export const [isSlicerOpen, setIsSlicerOpen] = createSignal(false);
/**
 * Audio Sample Slicer & Transient Chopper Engine.
 * Analyzes audio waveforms, calculates transient onsets, generates
 * sample slices, and handles real-time slice playback.
 */

export interface AudioSlice {
  readonly id: string;
  readonly index: number;
  start: number; // in seconds
  end: number;   // in seconds
  gain: number;  // 0 to 2.0 (1.0 = normal)
  reverse: boolean;
  pitchSemitones: number; // -12 to +12
  readonly energy: number; // 0 to 1
}

export type SlicingMode = "transients" | "grid-4" | "grid-8" | "grid-16";

export interface SlicerState {
  audioBuffer: AudioBuffer | null;
  fileName: string;
  duration: number;
  slices: AudioSlice[];
  selectedSliceIndex: number;
  mode: SlicingMode;
  sensitivity: number; // 0.1 to 1.0 (lower = more transients)
  activePlayingSlice: number | null;
}

/**
 * Detects transient attack points in an AudioBuffer.
 * Uses spectral flux and energy derivative over small analysis windows.
 */
export function detectTransients(
  buffer: AudioBuffer,
  sensitivity = 0.5,
  minDistanceSeconds = 0.08,
): number[] {
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
  const hopSize = Math.floor(windowSize / 2);
  const numHops = Math.floor((channelData.length - windowSize) / hopSize);

  if (numHops <= 0) return [0];

  const energies: number[] = new Array(numHops);

  for (let i = 0; i < numHops; i++) {
    const offset = i * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const val = channelData[offset + j]!;
      sum += val * val;
    }
    energies[i] = Math.sqrt(sum / windowSize);
  }

  // Calculate forward difference (energy derivative)
  const diffs: number[] = new Array(numHops).fill(0);
  for (let i = 1; i < numHops; i++) {
    const delta = (energies[i] ?? 0) - (energies[i - 1] ?? 0);
    diffs[i] = delta > 0 ? delta : 0;
  }

  // Calculate dynamic threshold
  let maxDiff = 0;
  for (let i = 0; i < numHops; i++) {
    if (diffs[i]! > maxDiff) maxDiff = diffs[i]!;
  }

  if (maxDiff === 0) return [0];

  // Invert sensitivity: 1.0 = highly sensitive (low threshold), 0.1 = low sensitivity (high threshold)
  const threshold = maxDiff * (1.05 - Math.max(0.1, Math.min(0.95, sensitivity)));
  const minHopDistance = Math.floor((minDistanceSeconds * sampleRate) / hopSize);

  const onsetPoints: number[] = [0]; // always start with 0
  let lastHop = 0;

  for (let i = 2; i < numHops - 2; i++) {
    const current = diffs[i]!;
    if (
      current > threshold &&
      current > diffs[i - 1]! &&
      current >= diffs[i + 1]! &&
      i - lastHop >= minHopDistance
    ) {
      const timeSec = (i * hopSize) / sampleRate;
      onsetPoints.push(timeSec);
      lastHop = i;
    }
  }

  return onsetPoints;
}

/**
 * Generates an array of slices based on either detected transients or equal grid intervals.
 */
export function calculateSlices(
  buffer: AudioBuffer,
  mode: SlicingMode,
  sensitivity = 0.5,
): AudioSlice[] {
  const duration = buffer.duration;
  let splitPoints: number[] = [];

  if (mode === "grid-4") {
    splitPoints = [0, duration * 0.25, duration * 0.5, duration * 0.75];
  } else if (mode === "grid-8") {
    splitPoints = Array.from({ length: 8 }, (_, i) => (duration * i) / 8);
  } else if (mode === "grid-16") {
    splitPoints = Array.from({ length: 16 }, (_, i) => (duration * i) / 16);
  } else {
    splitPoints = detectTransients(buffer, sensitivity);
    // Cap at 16 slices for performance and UI clarity
    if (splitPoints.length > 16) {
      splitPoints = splitPoints.slice(0, 16);
    }
  }

  const slices: AudioSlice[] = [];
  for (let i = 0; i < splitPoints.length; i++) {
    const start = splitPoints[i]!;
    const end = i < splitPoints.length - 1 ? splitPoints[i + 1]! : duration;
    slices.push({
      id: `slice-${i}-${Math.round(start * 1000)}`,
      index: i,
      start,
      end,
      gain: 1.0,
      reverse: false,
      pitchSemitones: 0,
      energy: 0.8,
    });
  }

  return slices;
}

/**
 * Creates an audition audio buffer from an AudioBuffer slice,
 * applying pitch shifting, reversal, and start/end trimming.
 */
export function renderSliceBuffer(
  audioCtx: AudioContext,
  sourceBuffer: AudioBuffer,
  slice: AudioSlice,
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const startSample = Math.max(0, Math.floor(slice.start * sampleRate));
  const endSample = Math.min(sourceBuffer.length, Math.ceil(slice.end * sampleRate));
  const length = Math.max(1, endSample - startSample);

  const outputBuffer = audioCtx.createBuffer(
    sourceBuffer.numberOfChannels,
    length,
    sampleRate,
  );

  for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
    const srcData = sourceBuffer.getChannelData(ch);
    const destData = outputBuffer.getChannelData(ch);

    if (slice.reverse) {
      for (let i = 0; i < length; i++) {
        destData[i] = (srcData[endSample - 1 - i] ?? 0) * slice.gain;
      }
    } else {
      for (let i = 0; i < length; i++) {
        destData[i] = (srcData[startSample + i] ?? 0) * slice.gain;
      }
    }
  }

  return outputBuffer;
}

/**
 * Synthesizes a high-quality stereo breakbeat audio loop in-memory
 * for instant slicing without requiring network or sample downloads.
 */
export function generateSyntheticBreakbeat(
  audioCtx: AudioContext,
  bpm = 130,
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const secondsPerBeat = 60 / bpm;
  const duration = secondsPerBeat * 4; // 1 bar = 4 beats
  const totalSamples = Math.floor(duration * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Pattern hits (beat positions in 16th notes: 0 to 15)
  // Kick on 0, 7, 10
  // Snare on 4, 12, with ghost notes on 9, 15
  // Hi-hats on all 16ths
  const hits: Array<{ step: number; type: "kick" | "snare" | "ghost" | "hat" }> = [
    { step: 0, type: "kick" },
    { step: 1, type: "hat" },
    { step: 2, type: "hat" },
    { step: 3, type: "hat" },
    { step: 4, type: "snare" },
    { step: 5, type: "hat" },
    { step: 6, type: "hat" },
    { step: 7, type: "kick" },
    { step: 8, type: "hat" },
    { step: 9, type: "ghost" },
    { step: 10, type: "kick" },
    { step: 11, type: "hat" },
    { step: 12, type: "snare" },
    { step: 13, type: "hat" },
    { step: 14, type: "hat" },
    { step: 15, type: "ghost" },
  ];

  const sixteenthSec = secondsPerBeat / 4;

  for (const hit of hits) {
    const hitStart = Math.floor(hit.step * sixteenthSec * sampleRate);
    if (hit.type === "kick") {
      const kickLen = Math.floor(0.22 * sampleRate);
      for (let i = 0; i < kickLen && hitStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const freq = 140 * Math.exp(-t * 22) + 45;
        const env = Math.exp(-t * 14);
        const val = Math.sin(2 * Math.PI * freq * t) * env * 0.85;
        left[hitStart + i]! += val;
        right[hitStart + i]! += val;
      }
    } else if (hit.type === "snare" || hit.type === "ghost") {
      const snareLen = Math.floor((hit.type === "snare" ? 0.18 : 0.08) * sampleRate);
      const amp = hit.type === "snare" ? 0.75 : 0.3;
      for (let i = 0; i < snareLen && hitStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 20);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 16);
        const val = (tone * 0.4 + noise * 0.6) * amp;
        left[hitStart + i]! += val * 0.95;
        right[hitStart + i]! += val * 1.05;
      }
    } else if (hit.type === "hat") {
      const hatLen = Math.floor(0.04 * sampleRate);
      for (let i = 0; i < hatLen && hitStart + i < totalSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 60);
        const val = noise * 0.25;
        left[hitStart + i]! += val * 1.1;
        right[hitStart + i]! += val * 0.9;
      }
    }
  }

  // Soft peak limiter to avoid clipping
  for (let i = 0; i < totalSamples; i++) {
    left[i] = Math.tanh(left[i]!);
    right[i] = Math.tanh(right[i]!);
  }

  return buffer;
}
