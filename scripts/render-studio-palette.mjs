/* global OfflineAudioContext, btoa */
import { writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5174/");
  const reel = await page.evaluate(async () => {
    const { STUDIO_PRESETS } = await import("/src/audio/studioPresets.ts");
    const { noteParamsFor } = await import("/src/audio/presets.ts");
    const { createVoiceEngine, workletContextFor } =
      await import("/src/audio/voiceEngine.ts");
    const { encodeWav16 } = await import("/src/audio/wav.ts");
    const ctx = new OfflineAudioContext(
      2,
      44100 * STUDIO_PRESETS.length * 3,
      44100,
    );
    const host = await createVoiceEngine(workletContextFor(ctx), 1);
    host.connect(0, ctx.destination);
    const events = STUDIO_PRESETS.flatMap((preset, i) => {
      const bed = preset.id.includes("pads-") || preset.id.includes("bowed-");
      const base = preset.pitchRange.octaveBase <= 2 ? 36 : bed ? 48 : 60;
      return (bed ? [0, 3, 7] : [0, 3, 7, 10]).map((offset, n) =>
        noteParamsFor(preset, {
          time: i * 3 + 0.1 + (bed ? 0 : n * 0.32),
          midi: base + offset,
          holdSeconds: bed ? 1.4 : 0.25,
        }),
      );
    });
    host.sendEvents(0, events);
    await host.waitUntilLoaded();
    const buffer = await ctx.startRendering();
    host.dispose();
    const bytes = encodeWav16(
      [buffer.getChannelData(0), buffer.getChannelData(1)],
      44100,
    );
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return {
      audio: btoa(binary),
      instruments: STUDIO_PRESETS.map((p, i) => ({
        name: p.name,
        id: p.id,
        startsAtSeconds: i * 3,
      })),
    };
  });
  const out = "docs/dev/recovery-2026-10-25";
  writeFileSync(`${out}/studio-palette.wav`, Buffer.from(reel.audio, "base64"));
  writeFileSync(
    `${out}/studio-palette.json`,
    JSON.stringify(reel.instruments, null, 2),
  );
  console.log(
    `Rendered ${reel.instruments.length} instruments, three seconds each, through the real AudioWorklet.`,
  );
} finally {
  await browser.close();
}
