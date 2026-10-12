/**
 * XY Kaoss FX Pad & Live Beat Stutter Engine.
 * Provides real-time 2D expressive filtering, spatial effects,
 * momentary beat repeaters (1/2 to 1/32), and vinyl tape stop emulation.
 */

import { createSignal } from "solid-js";

export type KaossMode = "filter-space" | "crush-drive" | "flange-mod";
export type StutterDivision = "1/2" | "1/4" | "1/8" | "1/16" | "1/32";

export interface KaossState {
  x: number; // 0 to 1 (normalized)
  y: number; // 0 to 1 (normalized)
  active: boolean; // whether pointer is actively engaging the pad
  hold: boolean; // lock XY coordinate
  mode: KaossMode;
  stutterDivision: StutterDivision | null;
  isTapeStopping: boolean;
}

export interface KaossParameters {
  paramXName: string;
  paramYName: string;
  paramXValue: string;
  paramYValue: string;
  filterCutoffHz: number;
  filterResonance: number;
  reverbWet: number;
  delayFeedback: number;
  bitDepth: number;
  drive: number;
}

export const [isKaossOpen, setIsKaossOpen] = createSignal(false);
export const [kaossState, setKaossState] = createSignal<KaossState>({
  x: 0.5,
  y: 0.0,
  active: false,
  hold: false,
  mode: "filter-space",
  stutterDivision: null,
  isTapeStopping: false,
});

/**
 * Maps normalized X (0 to 1) to logarithmic audio filter cutoff frequency (100 Hz to 18,000 Hz).
 */
export function mapXToFrequency(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  const minFreq = 100;
  const maxFreq = 18000;
  return Math.round(minFreq * Math.pow(maxFreq / minFreq, clamped));
}

/**
 * Maps normalized Y (0 to 1) to spatial wet mix percentage (0% to 100%).
 */
export function mapYToWet(y: number): number {
  const clamped = Math.max(0, Math.min(1, y));
  return Math.round(clamped * 100);
}

/**
 * Maps normalized coordinates to high-level effect parameters according to mode.
 */
export function resolveKaossParameters(x: number, y: number, mode: KaossMode): KaossParameters {
  const clampedX = Math.max(0, Math.min(1, x));
  const clampedY = Math.max(0, Math.min(1, y));

  switch (mode) {
    case "filter-space": {
      const freq = mapXToFrequency(clampedX);
      const wet = mapYToWet(clampedY);
      return {
        paramXName: "CUTOFF",
        paramYName: "SPACE WET",
        paramXValue: `${freq} Hz`,
        paramYValue: `${wet}%`,
        filterCutoffHz: freq,
        filterResonance: 1 + clampedY * 8,
        reverbWet: clampedY * 0.8,
        delayFeedback: clampedY * 0.6,
        bitDepth: 16,
        drive: 1.0,
      };
    }
    case "crush-drive": {
      const bitDepth = Math.round(16 - clampedX * 12); // 16 down to 4 bits
      const drive = 1.0 + clampedY * 6; // 1x to 7x drive
      return {
        paramXName: "CRUSH",
        paramYName: "DRIVE",
        paramXValue: `${bitDepth} BITS`,
        paramYValue: `+${(drive * 3).toFixed(1)} dB`,
        filterCutoffHz: 16000,
        filterResonance: 1,
        reverbWet: 0,
        delayFeedback: 0,
        bitDepth,
        drive,
      };
    }
    case "flange-mod": {
      const rateHz = (0.1 + clampedX * 4.9).toFixed(2);
      const depth = Math.round(clampedY * 100);
      return {
        paramXName: "LFO RATE",
        paramYName: "FEEDBACK",
        paramXValue: `${rateHz} Hz`,
        paramYValue: `${depth}%`,
        filterCutoffHz: 12000,
        filterResonance: 2 + clampedY * 6,
        reverbWet: clampedY * 0.4,
        delayFeedback: clampedY * 0.7,
        bitDepth: 16,
        drive: 1.0,
      };
    }
  }
}

/**
 * Calculates playback rate for a vinyl tape stop curve at elapsed time t (seconds).
 */
export function calculateTapeStopRate(t: number, totalDuration = 0.6): number {
  if (t <= 0) return 1.0;
  if (t >= totalDuration) return 0.0;
  const progress = t / totalDuration;
  // Quadratic turntable braking curve
  return Math.max(0, Math.pow(1.0 - progress, 2));
}

/**
 * Calculates division duration in seconds at a given BPM.
 */
export function getStutterIntervalSeconds(division: StutterDivision, bpm: number): number {
  const beatSec = 60 / bpm;
  switch (division) {
    case "1/2":
      return beatSec * 2;
    case "1/4":
      return beatSec;
    case "1/8":
      return beatSec / 2;
    case "1/16":
      return beatSec / 4;
    case "1/32":
      return beatSec / 8;
  }
}
