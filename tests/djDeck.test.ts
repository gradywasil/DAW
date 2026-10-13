import { describe, it, expect } from "vitest";
import {
  calculateCrossfaderGains,
  calculateIsolatorGain,
  calculateEffectivePlaybackRate,
  calculateLoopRollDurationMs,
} from "../src/audio/djDeck";

describe("Performance DJ Deck & Dual-Platter Studio Engine", () => {
  describe("Crossfader Curve Calculations", () => {
    it("computes equal-power sinusoidal gains across the fader range in smooth mode", () => {
      // Left edge (-1): 100% Deck A, 0% Deck B
      const left = calculateCrossfaderGains(-1, "smooth");
      expect(left.gainA).toBeCloseTo(1.0, 3);
      expect(left.gainB).toBeCloseTo(0.0, 3);

      // Center (0): Equal power (-3 dB, ~0.7071 each)
      const center = calculateCrossfaderGains(0, "smooth");
      expect(center.gainA).toBeCloseTo(Math.SQRT1_2, 3);
      expect(center.gainB).toBeCloseTo(Math.SQRT1_2, 3);
      const powerSum = Math.pow(center.gainA, 2) + Math.pow(center.gainB, 2);
      expect(powerSum).toBeCloseTo(1.0, 3);

      // Right edge (+1): 0% Deck A, 100% Deck B
      const right = calculateCrossfaderGains(1, "smooth");
      expect(right.gainA).toBeCloseTo(0.0, 3);
      expect(right.gainB).toBeCloseTo(1.0, 3);
    });

    it("computes sharp-cut DJ scratch curves", () => {
      // At center, scratch mode keeps both decks at 100% volume
      const center = calculateCrossfaderGains(0, "scratch");
      expect(center.gainA).toBe(1.0);
      expect(center.gainB).toBe(1.0);

      // At extreme edges, the cut deck is muted
      const left = calculateCrossfaderGains(-1, "scratch");
      expect(left.gainA).toBe(1.0);
      expect(left.gainB).toBe(0.0);

      const right = calculateCrossfaderGains(1, "scratch");
      expect(right.gainA).toBe(0.0);
      expect(right.gainB).toBe(1.0);
    });

    it("clamps out-of-range positions safely", () => {
      const overLeft = calculateCrossfaderGains(-2.5, "smooth");
      expect(overLeft.gainA).toBeCloseTo(1.0, 3);
      expect(overLeft.gainB).toBeCloseTo(0.0, 3);

      const overRight = calculateCrossfaderGains(3.0, "smooth");
      expect(overRight.gainA).toBeCloseTo(0.0, 3);
      expect(overRight.gainB).toBeCloseTo(1.0, 3);
    });
  });

  describe("3-Band Isolator EQ & Kill Switches", () => {
    it("converts 0 dB unity gain to 1.0 linear multiplier", () => {
      const unity = calculateIsolatorGain(0, false);
      expect(unity).toBe(1.0);
    });

    it("converts +6 dB boost to approximately 2.0x linear multiplier", () => {
      const boost = calculateIsolatorGain(6, false);
      expect(boost).toBeCloseTo(1.9953, 3);
    });

    it("drops gain to zero when kill switch is engaged or gain is at -48 dB", () => {
      const killed = calculateIsolatorGain(0, true);
      expect(killed).toBe(0);

      const killedWithBoost = calculateIsolatorGain(6, true);
      expect(killedWithBoost).toBe(0);

      const floor = calculateIsolatorGain(-48, false);
      expect(floor).toBe(0);
    });
  });

  describe("Turntable Pitch Nudge & Vinyl Motor Brake", () => {
    it("applies positive and negative pitch bend nudge percentages accurately", () => {
      const normal = calculateEffectivePlaybackRate(0, false, 0);
      expect(normal).toBe(1.0);

      const nudgeUp = calculateEffectivePlaybackRate(4, false, 0);
      expect(nudgeUp).toBe(1.04);

      const nudgeDown = calculateEffectivePlaybackRate(-4, false, 0);
      expect(nudgeDown).toBe(0.96);
    });

    it("models quadratic vinyl turntable slowdown during motor brake", () => {
      // Start of brake
      const start = calculateEffectivePlaybackRate(0, true, 0);
      expect(start).toBe(1.0);

      // Halfway through brake (0.5 progress -> 1 - 0.25 = 0.75)
      const mid = calculateEffectivePlaybackRate(0, true, 0.5);
      expect(mid).toBe(0.75);

      // Complete stop
      const stopped = calculateEffectivePlaybackRate(0, true, 1.0);
      expect(stopped).toBe(0.0);
    });
  });

  describe("Slip Loop Roll Calculations", () => {
    it("computes exact millisecond loop window durations at 120 BPM", () => {
      expect(calculateLoopRollDurationMs(120, "1/2")).toBe(1000);
      expect(calculateLoopRollDurationMs(120, "1/4")).toBe(500);
      expect(calculateLoopRollDurationMs(120, "1/8")).toBe(250);
      expect(calculateLoopRollDurationMs(120, "1/16")).toBe(125);
      expect(calculateLoopRollDurationMs(120, null)).toBe(0);
    });
  });
});
