/* global navigator, window */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Exercise real MediaRecorder/decoding with Chromium's synthetic input, without a microphone.
const browser = await chromium.launch({
  headless: true,
  downloadsPath: resolve("node_modules/.cache/recovery/downloads"),
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    window.testStreams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      window.testStreams.push(stream);
      return stream;
    };
  });
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".lane-grid-scroll").first().waitFor();
  await page.getByText("Sample tools", { exact: true }).click();
  await page
    .getByRole("button", { name: "Record microphone", exact: true })
    .click();
  await page.locator(".recorder-dialog").waitFor();
  assert.equal(await page.evaluate(() => window.testStreams.length), 0);
  await page.getByRole("button", { name: "RECORD TAKE", exact: true }).click();
  await page
    .getByRole("button", { name: "STOP RECORDING", exact: true })
    .waitFor();
  await page.waitForTimeout(1500);
  await page
    .getByRole("button", { name: "STOP RECORDING", exact: true })
    .click();
  await page.locator(".recorder-actions-card").waitFor();
  const take = await page.evaluate(async () => {
    const { recordedBuffer, computeBufferPeak } =
      await import("/src/audio/audioRecorder.ts");
    const buffer = recordedBuffer();
    return { duration: buffer.duration, peak: computeBufferPeak(buffer) };
  });
  assert.ok(take.duration > 0.5 && take.peak > 0);
  await page
    .getByRole("button", { name: "NORMALIZE (-0.5 dB)", exact: true })
    .click();
  await page.getByRole("button", { name: "TRIM SILENCE", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "EXPORT TAKE WAV", exact: true })
    .click();
  const download = await downloading;
  const bytes = readFileSync(await download.path());
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.ok(bytes.length > 1000);
  await page
    .getByRole("button", { name: "CHOP IN SAMPLE SLICER", exact: true })
    .click();
  await page.locator(".sample-slicer-dialog").waitFor();
  assert.equal(await page.locator(".recorder-dialog").count(), 0);
  assert.ok(
    await page.evaluate(() =>
      window.testStreams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === "ended"),
      ),
    ),
  );
  assert.deepEqual(errors, []);
  const result = {
    browser: browser.version(),
    syntheticInputOnly: true,
    requestedOnRecord: true,
    capturedAndDecoded: take,
    normalizeAndTrim: true,
    wavDownloaded: true,
    sentToSlicer: true,
    tracksStoppedOnClose: true,
    errors,
  };
  writeFileSync(
    "docs/dev/recovery-2026-10-25/recorder.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
