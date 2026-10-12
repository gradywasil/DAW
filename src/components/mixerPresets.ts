/**
 * Parametric Equalizer Studio Presets & Curve Profiles.
 * Pure definitions for standard studio EQ curves: vocal clarity, bass punch,
 * mid scoop, warm tape roll-off, and flat reset.
 */

import type { EqBand, Equalizer } from "../document/mixer";

export interface EqPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly bands: readonly EqBand[];
}

export const EQ_PRESETS: readonly EqPreset[] = [
  {
    id: "vocalClarity",
    name: "Vocal Clarity",
    description: "Low-cut mud filter, presence boost, and silky top air",
    bands: [
      { id: 1, type: "highpass", frequency: 85, gain: 0, q: 0.7, enabled: true },
      { id: 2, type: "peaking", frequency: 450, gain: -2.5, q: 1.6, enabled: true },
      { id: 3, type: "peaking", frequency: 3200, gain: 3.0, q: 1.2, enabled: true },
      { id: 4, type: "highshelf", frequency: 10500, gain: 4.0, q: 0.8, enabled: true },
    ],
  },
  {
    id: "bassTight",
    name: "Bass Tight",
    description: "Sub rumble filter, fundamental punch, and boxiness scoop",
    bands: [
      { id: 1, type: "highpass", frequency: 32, gain: 0, q: 0.8, enabled: true },
      { id: 2, type: "peaking", frequency: 65, gain: 3.5, q: 1.5, enabled: true },
      { id: 3, type: "peaking", frequency: 280, gain: -3.5, q: 2.0, enabled: true },
      { id: 4, type: "lowpass", frequency: 6500, gain: 0, q: 0.7, enabled: true },
    ],
  },
  {
    id: "midScoop",
    name: "Mid Scoop",
    description: "Low punch, wide midrange cut, and sparkling highs",
    bands: [
      { id: 1, type: "lowshelf", frequency: 120, gain: 2.5, q: 0.9, enabled: true },
      { id: 2, type: "peaking", frequency: 750, gain: -4.0, q: 1.3, enabled: true },
      { id: 3, type: "peaking", frequency: 2400, gain: 1.5, q: 1.2, enabled: true },
      { id: 4, type: "highshelf", frequency: 8500, gain: 3.0, q: 0.8, enabled: true },
    ],
  },
  {
    id: "warmTape",
    name: "Warm Tape",
    description: "Gentle low-mid warmth, analog body, and smooth top-end roll-off",
    bands: [
      { id: 1, type: "peaking", frequency: 140, gain: 2.0, q: 1.1, enabled: true },
      { id: 2, type: "peaking", frequency: 1200, gain: -1.0, q: 1.5, enabled: true },
      { id: 3, type: "highshelf", frequency: 6000, gain: -2.0, q: 0.7, enabled: true },
      { id: 4, type: "lowpass", frequency: 14000, gain: 0, q: 0.7, enabled: true },
    ],
  },
  {
    id: "resetFlat",
    name: "Reset Flat",
    description: "Clean flat reference across all four bands",
    bands: [
      { id: 1, type: "lowshelf", frequency: 100, gain: 0, q: 1.0, enabled: true },
      { id: 2, type: "peaking", frequency: 500, gain: 0, q: 1.0, enabled: true },
      { id: 3, type: "peaking", frequency: 2500, gain: 0, q: 1.0, enabled: true },
      { id: 4, type: "highshelf", frequency: 10000, gain: 0, q: 1.0, enabled: true },
    ],
  },
];

export function applyEqPreset(eq: Equalizer, presetId: string): Equalizer {
  const preset = EQ_PRESETS.find((p) => p.id === presetId);
  if (!preset) return eq;
  return {
    ...eq,
    bands: [...preset.bands],
  };
}
