/**
 * Fullscreen Performance DJ Deck & Dual-Platter Studio Engine.
 * Provides equal-power and sharp-cut crossfading between Deck A and Deck B,
 * 3-band frequency isolator EQs with instant kills (-inf dB),
 * vinyl turntable pitch nudging, motor brake slowdown, and slip loop rolls.
 */

import { createSignal } from "solid-js";

export type CrossfaderCurve = "smooth" | "scratch";
export type LoopRollSize = "1/2" | "1/4" | "1/8" | "1/16" | null;

export interface DeckChannelState {
  lowGainDb: number;   // -48 dB to +6 dB (0 dB unity)
  midGainDb: number;   // -48 dB to +6 dB (0 dB unity)
  highGainDb: number;  // -48 dB to +6 dB (0 dB unity)
  lowKill: boolean;    // true = full cut (-inf dB)
  midKill: boolean;
  highKill: boolean;
  filterCutoff: number; // 0 to 1 (0.5 = neutral bypass)
  cueActive: boolean;
  volume: number;      // 0 to 1
  assignedLanes: string[];
}

export interface DjDeckState {
  crossfader: number;          // -1.0 (100% Deck A) to +1.0 (100% Deck B)
  crossfaderCurve: CrossfaderCurve;
  deckA: DeckChannelState;
  deckB: DeckChannelState;
  loopRoll: LoopRollSize;
  slipActive: boolean;
  isVinylBraking: boolean;
  bpmNudgePercent: number;    // -8% to +8% temporary pitch bend
}

export const [isDjDeckOpen, setIsDjDeckOpen] = createSignal(false);

const defaultDeckA: DeckChannelState = {
  lowGainDb: 0,
  midGainDb: 0,
  highGainDb: 0,
  lowKill: false,
  midKill: false,
  highKill: false,
  filterCutoff: 0.5,
  cueActive: true,
  volume: 1.0,
  assignedLanes: ["drums", "bass"],
};

const defaultDeckB: DeckChannelState = {
  lowGainDb: 0,
  midGainDb: 0,
  highGainDb: 0,
  lowKill: false,
  midKill: false,
  highKill: false,
  filterCutoff: 0.5,
  cueActive: false,
  volume: 1.0,
  assignedLanes: ["chords", "lead"],
};

export const [djDeckState, setDjDeckState] = createSignal<DjDeckState>({
  crossfader: 0.0,
  crossfaderCurve: "smooth",
  deckA: defaultDeckA,
  deckB: defaultDeckB,
  loopRoll: null,
  slipActive: true,
  isVinylBraking: false,
  bpmNudgePercent: 0,
});

/**
 * Calculates equal-power or scratch gains for Deck A and Deck B based on crossfader position [-1, 1].
 */
export function calculateCrossfaderGains(
  position: number,
  curve: CrossfaderCurve = "smooth",
): { gainA: number; gainB: number } {
  const clamped = Math.max(-1, Math.min(1, position));

  if (curve === "scratch") {
    // Sharp DJ cut: deck remains 100% until 90% across the crossfader
    const norm = (clamped + 1) / 2; // 0.0 to 1.0
    const gainA = norm < 0.95 ? 1.0 : Math.cos(((norm - 0.95) / 0.05) * (Math.PI / 2));
    const gainB = norm > 0.05 ? 1.0 : Math.sin((norm / 0.05) * (Math.PI / 2));
    return {
      gainA: Math.max(0, Math.min(1, Number(gainA.toFixed(4)))),
      gainB: Math.max(0, Math.min(1, Number(gainB.toFixed(4)))),
    };
  }

  // Equal-power sinusoidal crossfade: gainA^2 + gainB^2 = 1.0 at center
  const angle = ((clamped + 1) / 4) * Math.PI; // 0 to PI/2
  const gainA = Math.cos(angle);
  const gainB = Math.sin(angle);

  return {
    gainA: Math.max(0, Math.min(1, Number(gainA.toFixed(4)))),
    gainB: Math.max(0, Math.min(1, Number(gainB.toFixed(4)))),
  };
}

/**
 * Converts isolator dB (-48 to +6) and kill state into a linear multiplier (0.0 to ~2.0).
 */
export function calculateIsolatorGain(gainDb: number, isKilled: boolean): number {
  if (isKilled) return 0;
  if (gainDb <= -48) return 0;
  const clampedDb = Math.max(-48, Math.min(6, gainDb));
  return Number(Math.pow(10, clampedDb / 20).toFixed(4));
}

/**
 * Resolves effective playback rate with temporary pitch nudge and vinyl brake curve.
 */
export function calculateEffectivePlaybackRate(
  nudgePercent: number,
  isVinylBraking: boolean,
  brakeProgress = 0, // 0 (start of brake) to 1 (full stop)
): number {
  if (isVinylBraking) {
    const brakeFactor = Math.max(0, 1 - Math.pow(brakeProgress, 2));
    return Number(brakeFactor.toFixed(3));
  }
  const nudgeMultiplier = 1 + nudgePercent / 100;
  return Number(nudgeMultiplier.toFixed(4));
}

/**
 * Calculates loop roll duration in milliseconds given tempo and division.
 */
export function calculateLoopRollDurationMs(bpm: number, division: LoopRollSize): number {
  if (!division) return 0;
  const quarterNoteMs = (60 / Math.max(20, bpm)) * 1000;
  switch (division) {
    case "1/2":
      return quarterNoteMs * 2;
    case "1/4":
      return quarterNoteMs;
    case "1/8":
      return quarterNoteMs / 2;
    case "1/16":
      return quarterNoteMs / 4;
  }
}
