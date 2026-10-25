import { describe, expect, it } from "vitest";
import {
  STUDIO_PRESETS,
  STUDIO_SOUND_IDS,
} from "../../src/audio/studioPresets";
import { SOUND_CATALOG } from "../../src/audio/soundCatalog";
import { noteParamsFor } from "../../src/audio/presets";
import { findNonFinite, hashChannelsHex, renderOffline } from "./helpers";

describe("recovery sound palette", () => {
  it("every pick exists, including natural instrument and drum choices", () => {
    for (const id of STUDIO_SOUND_IDS)
      expect(
        SOUND_CATALOG.some((sound) => sound.id === id),
        id,
      ).toBe(true);
  });
  it("renders all authored instruments through the real worklet with distinct, finite audio", async () => {
    const fingerprints = new Set<string>();
    for (const preset of STUDIO_PRESETS) {
      const { mono } = await renderOffline({
        startTime: 0.05,
        duration: 3,
        lanes: [[noteParamsFor(preset, { time: 0, midi: 60, holdSeconds: 1 })]],
      });
      expect(findNonFinite(mono), preset.id).toBe(0);
      let peak = 0;
      let power = 0;
      for (const sample of mono) {
        peak = Math.max(peak, Math.abs(sample));
        power += sample * sample;
      }
      expect(peak, preset.id).toBeGreaterThan(0.02);
      expect(peak, preset.id).toBeLessThan(0.95);
      expect(Math.sqrt(power / mono.length), preset.id).toBeGreaterThan(0.005);
      const fingerprint = await hashChannelsHex([mono]);
      expect(fingerprints.has(fingerprint), preset.id).toBe(false);
      fingerprints.add(fingerprint);
    }
  }, 60_000);
});
