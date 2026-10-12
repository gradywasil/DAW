import { describe, it, expect } from "vitest";
import {
  mapXToFrequency,
  mapYToWet,
  resolveKaossParameters,
  calculateTapeStopRate,
  getStutterIntervalSeconds,
  kaossState,
  setKaossState,
} from "../src/audio/kaossPad";

describe("XY Kaoss FX Pad & Live Beat Stutter Engine", () => {
  it("maps X coordinate to logarithmic audio filter frequencies accurately", () => {
    expect(mapXToFrequency(0)).toBe(100);
    expect(mapXToFrequency(1)).toBe(18000);

    const midFreq = mapXToFrequency(0.5);
    // Logarithmic midpoint should be approx sqrt(100 * 18000) ~ 1341 Hz
    expect(midFreq).toBeGreaterThan(1200);
    expect(midFreq).toBeLessThan(1500);

    // Clamping checks
    expect(mapXToFrequency(-0.5)).toBe(100);
    expect(mapXToFrequency(1.5)).toBe(18000);
  });

  it("maps Y coordinate to wet mix percentage", () => {
    expect(mapYToWet(0)).toBe(0);
    expect(mapYToWet(0.5)).toBe(50);
    expect(mapYToWet(1)).toBe(100);
    expect(mapYToWet(2)).toBe(100);
    expect(mapYToWet(-1)).toBe(0);
  });

  it("resolves expressive parameters for filter-space mode", () => {
    const params = resolveKaossParameters(0.5, 0.8, "filter-space");
    expect(params.paramXName).toBe("CUTOFF");
    expect(params.paramYName).toBe("SPACE WET");
    expect(params.paramYValue).toBe("80%");
    expect(params.reverbWet).toBeCloseTo(0.64, 2);
    expect(params.filterResonance).toBeGreaterThan(1);
  });

  it("resolves expressive parameters for crush-drive mode", () => {
    const params = resolveKaossParameters(1.0, 0.5, "crush-drive");
    expect(params.paramXName).toBe("CRUSH");
    expect(params.paramYName).toBe("DRIVE");
    expect(params.bitDepth).toBe(4); // Heavily crushed
    expect(params.drive).toBeGreaterThan(1.0);
  });

  it("resolves expressive parameters for flange-mod mode", () => {
    const params = resolveKaossParameters(0.2, 0.6, "flange-mod");
    expect(params.paramXName).toBe("LFO RATE");
    expect(params.paramYName).toBe("FEEDBACK");
    expect(params.paramYValue).toBe("60%");
  });

  it("computes quadratic vinyl braking curve for tape stop", () => {
    const duration = 0.6;
    expect(calculateTapeStopRate(0, duration)).toBe(1.0);
    expect(calculateTapeStopRate(duration / 2, duration)).toBeCloseTo(0.25, 2);
    expect(calculateTapeStopRate(duration, duration)).toBe(0.0);
    expect(calculateTapeStopRate(duration + 0.1, duration)).toBe(0.0);
  });

  it("computes exact musical beat stutter intervals at tempo", () => {
    const bpm = 120; // 0.5s per quarter note
    expect(getStutterIntervalSeconds("1/2", bpm)).toBe(1.0);
    expect(getStutterIntervalSeconds("1/4", bpm)).toBe(0.5);
    expect(getStutterIntervalSeconds("1/8", bpm)).toBe(0.25);
    expect(getStutterIntervalSeconds("1/16", bpm)).toBe(0.125);
    expect(getStutterIntervalSeconds("1/32", bpm)).toBe(0.0625);
  });

  it("updates reactive kaoss state cleanly", () => {
    setKaossState((s) => ({ ...s, x: 0.75, y: 0.25, hold: true }));
    expect(kaossState().x).toBe(0.75);
    expect(kaossState().y).toBe(0.25);
    expect(kaossState().hold).toBe(true);
  });
});
