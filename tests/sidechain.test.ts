import { describe, it, expect } from "vitest";
import {
  calculateDuckGain,
  SIDECHAIN_PRESETS,
  applySidechainPreset,
  currentSidechain,
  currentGlue,
  liveReductionDb,
  triggerSidechainPulse,
} from "../src/audio/sidechain";

describe("Master Bus Glue Compressor & Sidechain Ducking Engine", () => {
  it("calculates duck gain correctly during attack phase", () => {
    const attack = 0.01; // 10ms
    const release = 0.2; // 200ms
    const amount = 0.8; // 80% ducking

    // At t = 0, gain should be 1.0
    const gainStart = calculateDuckGain(0, attack, release, amount, "linear");
    expect(gainStart).toBeCloseTo(1.0, 2);

    // At t = attack, gain should reach minimum
    const gainMin = calculateDuckGain(attack, attack, release, amount, "linear");
    const expectedMin = 1.0 - amount * 0.95;
    expect(gainMin).toBeCloseTo(expectedMin, 2);
  });

  it("recovers gain back towards unity during release phase", () => {
    const attack = 0.01;
    const release = 0.2;
    const amount = 0.8;

    // At midway through release (t = attack + release / 2)
    const midRelease = attack + release / 2;
    const gainMid = calculateDuckGain(midRelease, attack, release, amount, "linear");
    const minGain = 1.0 - amount * 0.95;
    expect(gainMid).toBeGreaterThan(minGain);
    expect(gainMid).toBeLessThan(1.0);

    // At t >= attack + release, gain should fully return to 1.0
    const gainEnd = calculateDuckGain(attack + release + 0.01, attack, release, amount, "linear");
    expect(gainEnd).toBe(1.0);
  });

  it("computes differing curvature for punchy vs smooth curves", () => {
    const attack = 0.01;
    const release = 0.2;
    const amount = 0.9;
    const midPoint = attack + release * 0.3;

    const punchyGain = calculateDuckGain(midPoint, attack, release, amount, "punchy");
    const smoothGain = calculateDuckGain(midPoint, attack, release, amount, "smooth");

    // Punchy curve stays ducked longer and snaps back late (relT^2), so at 30% release it is lower than smooth
    expect(punchyGain).not.toEqual(smoothGain);
    expect(punchyGain).toBeLessThan(smoothGain);
  });

  it("verifies all sidechain presets have valid routing and compression parameters", () => {
    for (const preset of SIDECHAIN_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.genre.length).toBeGreaterThan(0);
      expect(preset.sidechain.amount).toBeGreaterThanOrEqual(0);
      expect(preset.sidechain.amount).toBeLessThanOrEqual(1);
      expect(preset.sidechain.attack).toBeGreaterThan(0);
      expect(preset.sidechain.release).toBeGreaterThan(0);

      // Verify routing targets object
      expect(typeof preset.sidechain.targets.bass).toBe("boolean");
      expect(typeof preset.sidechain.targets.chords).toBe("boolean");
      expect(typeof preset.sidechain.targets.lead).toBe("boolean");
      expect(typeof preset.sidechain.targets.master).toBe("boolean");

      // Verify glue compressor settings
      expect(preset.glue.threshold).toBeLessThanOrEqual(0);
      expect(preset.glue.ratio).toBeGreaterThanOrEqual(1.5);
      expect(preset.glue.sidechainHpHz).toBeGreaterThanOrEqual(20);
    }
  });

  it("applies a sidechain preset and updates reactive signals", () => {
    const frenchHouse = SIDECHAIN_PRESETS.find((p) => p.id === "french-house")!;
    expect(frenchHouse).toBeDefined();

    applySidechainPreset(frenchHouse);

    expect(currentSidechain().mode).toBe("four-on-the-floor");
    expect(currentSidechain().amount).toBe(0.85);
    expect(currentSidechain().targets.bass).toBe(true);
    expect(currentSidechain().targets.chords).toBe(true);

    expect(currentGlue().mode).toBe("pumping-club");
    expect(currentGlue().ratio).toBe(4);
    expect(currentGlue().sidechainHpHz).toBe(120);
  });

  it("triggers duck pulse and engages live reduction", () => {
    triggerSidechainPulse(0.8);
    // Instantaneous live reduction should register a negative dB value
    expect(liveReductionDb()).toBeLessThan(0);
  });
});
