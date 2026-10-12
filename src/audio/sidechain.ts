/**
 * Master Bus Glue Compressor & Sidechain Ducking Engine.
 * Provides pump envelopes, sidechain triggering (4-on-the-floor and kick transient),
 * target routing, and vintage analog compressor characteristics.
 */

import { createSignal } from "solid-js";

export interface SidechainTargetRouting {
  bass: boolean;
  chords: boolean;
  lead: boolean;
  master: boolean;
}

export type DuckingMode = "four-on-the-floor" | "kick-transient";
export type DuckingCurve = "punchy" | "linear" | "smooth";
export type GlueCompressorMode = "vca-punch" | "opto-smooth" | "tape-warmth" | "pumping-club";

export interface SidechainSettings {
  enabled: boolean;
  mode: DuckingMode;
  amount: number; // 0 to 1 (0% to 100% ducking depth, up to -24dB)
  attack: number; // in seconds (0.002 to 0.05)
  release: number; // in seconds (0.05 to 0.6)
  curve: DuckingCurve;
  targets: SidechainTargetRouting;
}

export interface GlueCompressorSettings {
  enabled: boolean;
  mode: GlueCompressorMode;
  threshold: number; // -40 to 0 dB
  ratio: number; // 1.5 to 10
  attack: number; // 0.001 to 0.1 seconds
  release: number; // 0.02 to 1.0 seconds
  makeup: number; // 0 to 12 dB
  sidechainHpHz: number; // 20 to 300 Hz filter for detector
}

export interface SidechainPreset {
  id: string;
  name: string;
  genre: string;
  description: string;
  sidechain: SidechainSettings;
  glue: GlueCompressorSettings;
}

export const SIDECHAIN_PRESETS: readonly SidechainPreset[] = [
  {
    id: "french-house",
    name: "French House Pump",
    genre: "House / Nu-Disco",
    description: "Deep, bouncy 4-on-the-floor pump that breathes with the kick drum.",
    sidechain: {
      enabled: true,
      mode: "four-on-the-floor",
      amount: 0.85,
      attack: 0.005,
      release: 0.22,
      curve: "punchy",
      targets: { bass: true, chords: true, lead: true, master: false },
    },
    glue: {
      enabled: true,
      mode: "pumping-club",
      threshold: -16,
      ratio: 4,
      attack: 0.015,
      release: 0.18,
      makeup: 2.5,
      sidechainHpHz: 120,
    },
  },
  {
    id: "lofi-breathing",
    name: "Lo-Fi Breathing Tape",
    genre: "Lo-Fi / Hip-Hop",
    description: "Warm, slow-release tape compression with organic melodic ducking.",
    sidechain: {
      enabled: true,
      mode: "kick-transient",
      amount: 0.55,
      attack: 0.01,
      release: 0.35,
      curve: "smooth",
      targets: { bass: true, chords: true, lead: false, master: false },
    },
    glue: {
      enabled: true,
      mode: "tape-warmth",
      threshold: -20,
      ratio: 2.5,
      attack: 0.03,
      release: 0.3,
      makeup: 3.0,
      sidechainHpHz: 80,
    },
  },
  {
    id: "sub-pocket",
    name: "Sub Bass Pocket",
    genre: "Trap / Drill / Bass",
    description: "Surgically ducks the sub bass out of the kick's punch to keep low-end pristine.",
    sidechain: {
      enabled: true,
      mode: "kick-transient",
      amount: 0.95,
      attack: 0.002,
      release: 0.15,
      curve: "punchy",
      targets: { bass: true, chords: false, lead: false, master: false },
    },
    glue: {
      enabled: false,
      mode: "vca-punch",
      threshold: -12,
      ratio: 3,
      attack: 0.01,
      release: 0.1,
      makeup: 1.0,
      sidechainHpHz: 150,
    },
  },
  {
    id: "vca-master-glue",
    name: "VCA Studio Glue",
    genre: "Mastering / Mix Bus",
    description: "Classic British console bus compressor for transparent cohesion and snap.",
    sidechain: {
      enabled: false,
      mode: "four-on-the-floor",
      amount: 0.3,
      attack: 0.01,
      release: 0.2,
      curve: "smooth",
      targets: { bass: false, chords: false, lead: false, master: true },
    },
    glue: {
      enabled: true,
      mode: "vca-punch",
      threshold: -14,
      ratio: 2,
      attack: 0.03,
      release: 0.1,
      makeup: 1.5,
      sidechainHpHz: 100,
    },
  },
];

export const [isSidechainOpen, setIsSidechainOpen] = createSignal(false);
export const [currentSidechain, setCurrentSidechain] = createSignal<SidechainSettings>({
  ...SIDECHAIN_PRESETS[0]!.sidechain,
});
export const [currentGlue, setCurrentGlue] = createSignal<GlueCompressorSettings>({
  ...SIDECHAIN_PRESETS[0]!.glue,
});

// Real-time animated reduction signal for the analog VU meter (0 to -24 dB)
export const [liveReductionDb, setLiveReductionDb] = createSignal(0);

/**
 * Calculates ducking gain multiplier (0 to 1) at time t within a duck cycle.
 */
export function calculateDuckGain(
  t: number,
  attack: number,
  release: number,
  amount: number,
  curve: DuckingCurve,
): number {
  if (t < 0 || t >= attack + release) return 1.0;

  // Maximum duck reduction: 1.0 down to (1 - amount * 0.95)
  const minGain = Math.max(0.05, 1.0 - amount * 0.95);

  if (t < attack) {
    // Attack phase: drop from 1.0 to minGain
    const progress = t / Math.max(0.001, attack);
    if (curve === "punchy") {
      return 1.0 - (1.0 - minGain) * Math.sqrt(progress);
    } else if (curve === "smooth") {
      return 1.0 - (1.0 - minGain) * (progress * progress);
    }
    return 1.0 - (1.0 - minGain) * progress;
  } else {
    // Release phase: recover from minGain back to 1.0
    const relT = (t - attack) / Math.max(0.001, release);
    if (curve === "punchy") {
      return minGain + (1.0 - minGain) * (relT * relT);
    } else if (curve === "smooth") {
      return minGain + (1.0 - minGain) * Math.sqrt(relT);
    }
    return minGain + (1.0 - minGain) * relT;
  }
}

/**
 * Trigger an instantaneous sidechain ducking envelope.
 * Animates the live VU reduction needle and applies modulation.
 */
export function triggerSidechainPulse(amount?: number): void {
  const sc = currentSidechain();
  if (!sc.enabled) return;

  const effAmount = amount ?? sc.amount;
  const reductionDb = -effAmount * 18; // e.g. -15dB reduction

  setLiveReductionDb(reductionDb);

  // Safe requestAnimationFrame fallback for test/node environments
  const raf =
    typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame
      : (fn: () => void) => {
          setTimeout(fn, 16);
          return 0;
        };

  // Recovery animation
  const startTime = Date.now();
  const durationMs = (sc.attack + sc.release) * 1000;

  const step = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed < durationMs) {
      const progress = elapsed / durationMs;
      // Exponential recovery
      setLiveReductionDb(reductionDb * (1 - progress));
      raf(step);
    } else {
      setLiveReductionDb(0);
    }
  };

  raf(step);
}

/**
 * Applies a sidechain preset to current state.
 */
export function applySidechainPreset(preset: SidechainPreset): void {
  setCurrentSidechain(JSON.parse(JSON.stringify(preset.sidechain)));
  setCurrentGlue(JSON.parse(JSON.stringify(preset.glue)));
  triggerSidechainPulse();
}
