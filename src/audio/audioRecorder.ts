/**
 * Live Microphone Recording & Vocal Quick-Sampler Engine.
 * Handles microphone capture via Web Audio, real-time input analysis,
 * automatic silence trimming, peak normalization, and Slicer integration.
 */

import { createSignal } from "solid-js";
import { setIsSlicerOpen } from "./sampleSlicer";

export type RecorderStatus = "idle" | "recording" | "recorded";

export interface RecorderState {
  status: RecorderStatus;
  durationSeconds: number;
  inputLevel: number; // 0 to 1 for live meter
  peakDb: number;
}

export const [isRecorderOpen, setIsRecorderOpen] = createSignal(false);
export const [recorderStatus, setRecorderStatus] = createSignal<RecorderStatus>("idle");
export const [recordedBuffer, setRecordedBuffer] = createSignal<AudioBuffer | null>(null);
export const [recordedTakeName, setRecordedTakeName] = createSignal("Vocal Take 1");
export const [liveInputLevel, setLiveInputLevel] = createSignal(0);

// Shared source bridge for SampleSlicerModal
export const [sharedSlicerSource, setSharedSlicerSource] = createSignal<{
  buffer: AudioBuffer;
  name: string;
} | null>(null);

/**
 * Creates an AudioBuffer safely in browser or headless/test environments.
 */
export function createAudioBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  const AudioCtx =
    typeof window !== "undefined"
      ? (window.AudioContext || (window as any).webkitAudioContext)
      : (globalThis as any).AudioContext;

  if (AudioCtx) {
    try {
      const ctx = new AudioCtx();
      return ctx.createBuffer(channels, length, sampleRate);
    } catch {
      // Fallback
    }
  }

  const channelData = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (c: number) => channelData[c]!,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

/**
 * Calculates the absolute peak amplitude across all channels in an AudioBuffer.
 */
export function computeBufferPeak(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]!);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

/**
 * Normalizes an AudioBuffer to a target peak in decibels (e.g. -0.5 dB).
 */
export function normalizeBuffer(buffer: AudioBuffer, targetPeakDb = -0.5): AudioBuffer {
  const currentPeak = computeBufferPeak(buffer);
  if (currentPeak <= 0.00001) return buffer;

  const targetLinear = Math.pow(10, targetPeakDb / 20);
  const gainMultiplier = targetLinear / currentPeak;

  const normalized = createAudioBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dest = normalized.getChannelData(c);
    for (let i = 0; i < src.length; i++) {
      dest[i] = src[i]! * gainMultiplier;
    }
  }

  return normalized;
}

/**
 * Trims leading and trailing silence from an AudioBuffer below a threshold in decibels.
 */
export function trimSilence(buffer: AudioBuffer, thresholdDb = -45): AudioBuffer {
  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const channels = buffer.numberOfChannels;
  const length = buffer.length;

  let startSample = length;
  let endSample = 0;

  // Find first sample exceeding threshold across any channel
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      if (Math.abs(data[i]!) > thresholdLinear) {
        if (i < startSample) startSample = i;
        break;
      }
    }
    for (let i = length - 1; i >= 0; i--) {
      if (Math.abs(data[i]!) > thresholdLinear) {
        if (i > endSample) endSample = i;
        break;
      }
    }
  }

  if (startSample >= endSample) {
    return buffer; // All silence or invalid
  }

  // Add gentle padding (up to 10ms) without restoring all silence
  const maxPad = Math.floor((length - (endSample - startSample)) / 4);
  const padSamples = Math.min(Math.floor(buffer.sampleRate * 0.01), Math.max(0, maxPad));
  const trimmedStart = Math.max(0, startSample - padSamples);
  const trimmedEnd = Math.min(length, endSample + padSamples);
  const trimmedLength = trimmedEnd - trimmedStart;

  const trimmed = createAudioBuffer(channels, trimmedLength, buffer.sampleRate);

  for (let c = 0; c < channels; c++) {
    const src = buffer.getChannelData(c);
    const dest = trimmed.getChannelData(c);
    for (let i = 0; i < trimmedLength; i++) {
      dest[i] = src[trimmedStart + i]!;
    }
  }

  return trimmed;
}

/**
 * Loads the recorded audio take into the Sample Slicer for instant MPC chop & pitch sequencing.
 */
export function sendRecordingToSlicer(buffer: AudioBuffer, name: string): void {
  setSharedSlicerSource({ buffer, name });
  setIsRecorderOpen(false);
  setIsSlicerOpen(true);
}
