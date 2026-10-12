import { describe, it, expect } from "vitest";
import {
  EQ_PRESETS,
  applyEqPreset,
} from "../src/components/mixerPresets";
import {
  DEFAULT_EQ,
  DEFAULT_MIXER,
  DEFAULT_CHANNEL,
  type Equalizer,
} from "../src/document/mixer";
import { createDefaultProject } from "../src/document/schema";
import { validateProject } from "../src/document/validate";

describe("Parametric EQ presets and curves", () => {
  it("provides comprehensive studio curve presets with valid acoustic parameters", () => {
    expect(EQ_PRESETS.length).toBeGreaterThanOrEqual(5);

    for (const preset of EQ_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.bands.length).toBe(4);

      for (const band of preset.bands) {
        expect(band.frequency).toBeGreaterThanOrEqual(20);
        expect(band.frequency).toBeLessThanOrEqual(20000);
        expect(band.gain).toBeGreaterThanOrEqual(-18);
        expect(band.gain).toBeLessThanOrEqual(18);
        expect(band.q).toBeGreaterThanOrEqual(0.1);
        expect(band.q).toBeLessThanOrEqual(18);
        expect(band.enabled).toBe(true);
      }
    }
  });

  it("applies Vocal Clarity preset and preserves equalizer enabled state", () => {
    const eq: Equalizer = {
      ...DEFAULT_EQ,
      enabled: true,
    };

    const updated = applyEqPreset(eq, "vocalClarity");
    expect(updated.enabled).toBe(true);
    expect(updated.bands.length).toBe(4);
    expect(updated.bands[0]!.type).toBe("highpass");
    expect(updated.bands[0]!.frequency).toBe(85);
    expect(updated.bands[3]!.type).toBe("highshelf");
    expect(updated.bands[3]!.gain).toBe(4.0);
  });

  it("applies Bass Tightener preset and produces valid project schema", () => {
    const eq: Equalizer = {
      ...DEFAULT_EQ,
      enabled: false,
    };

    const updated = applyEqPreset(eq, "bassTight");
    expect(updated.enabled).toBe(false);
    expect(updated.bands.length).toBe(4);
    expect(updated.bands[1]!.type).toBe("peaking");
    expect(updated.bands[1]!.frequency).toBe(65);

    const project = createDefaultProject();
    project.mixer = {
      ...DEFAULT_MIXER,
      channels: {
        ...DEFAULT_MIXER.channels,
        bass: { ...DEFAULT_CHANNEL, eq: updated },
      },
    };

    const validated = validateProject(project);
    expect(validated.mixer?.channels.bass?.eq.bands?.[1]?.frequency).toBe(65);
  });

  it("applies Reset Flat preset to restore neutral frequency response", () => {
    const eq: Equalizer = {
      ...DEFAULT_EQ,
      enabled: true,
    };

    const flat = applyEqPreset(eq, "resetFlat");
    for (const b of flat.bands) {
      expect(b.gain).toBe(0);
      expect(b.q).toBe(1.0);
      expect(b.enabled).toBe(true);
    }
  });

  it("leaves equalizer unmodified when given an invalid preset id", () => {
    const eq: Equalizer = {
      ...DEFAULT_EQ,
      enabled: true,
    };

    const unchanged = applyEqPreset(eq, "unknownPresetId");
    expect(unchanged).toBe(eq);
  });
});
