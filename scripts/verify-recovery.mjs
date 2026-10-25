/* global document, window, navigator, DOMException */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, firefox } from "playwright";
import { resolve } from "node:path";

const out = "docs/dev/recovery-2026-10-25";
const base = "http://127.0.0.1:5174/";
mkdirSync(out, { recursive: true });
mkdirSync("node_modules/.cache/recovery/downloads", { recursive: true });
const capture = process.argv.includes("--screenshots");
const engine = process.env.RECOVERY_BROWSER ?? "chromium";
const browser = await (engine === "firefox" ? firefox : chromium).launch({
  downloadsPath: resolve("node_modules/.cache/recovery/downloads"),
  headless: true,
  ...(engine === "chromium"
    ? { args: ["--autoplay-policy=no-user-gesture-required"] }
    : {}),
});
const results = [{ browser: engine, version: browser.version() }];
try {
  for (const [width, height] of [
    [320, 667],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 800,
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator(".lane-grid-scroll").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
      "Workspace must not overflow horizontally",
    );
    if (capture)
      await page.screenshot({
        path: `${out}/after-${width}.png`,
        fullPage: true,
      });

    if (width === 390) {
      await page.locator(".theme-selector").click();
      if (capture)
        await page.screenshot({
          path: `${out}/after-390-light.png`,
          fullPage: true,
        });
      await page.locator(".theme-selector").click();
    }
    await page.locator(".booth-btn-play").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector(".booth-btn-play")
          ?.getAttribute("aria-pressed") === "true",
    );
    const nav = width < 600 ? ".phone-mixer-nav" : ".desktop-page-nav";
    await page.locator(`${nav} [data-page="song"]`).click();
    await page.locator(".stage-song").waitFor();
    await page.locator(`${nav} [data-page="mixer"]`).click();
    await page.locator(".mixer-page").waitFor();
    await page.getByRole("button", { name: "Visualizer", exact: true }).click();
    await page.locator(".viz-page").waitFor();
    if (capture && width === 390)
      await page.screenshot({ path: `${out}/visualizer-390.png` });
    assert.equal(
      await page.evaluate(
        async () =>
          (await import("/src/engine/session.ts")).getSession().transport
            .snapshot.playing,
      ),
      true,
    );
    await page.keyboard.press("Escape");
    await page.locator(".mixer-page").waitFor();
    await page.locator(".booth-btn-play").click();
    await page.locator(`${nav} [data-page="edit"]`).click();

    if (width === 1440) {
      await page.locator(`${nav} [data-page="instruments"]`).click();
      await page
        .getByRole("button", { name: "Add instrument to track 5", exact: true })
        .click();
      await page
        .locator('.lane-floor[data-lane="extra1"] .lane-grid-scroll')
        .waitFor();
      await page.evaluate(async () =>
        (await import("/src/state/store.ts")).undo(),
      );
      await page.locator(`${nav} [data-page="edit"]`).click();
    }
    if (width < 600)
      await page.locator('.lane-switch-tab[data-lane="bass"]').click();
    const lane = page.locator('.lane-floor[data-lane="bass"]');
    await lane.locator(".head-sound-browse").click();
    assert.ok(
      (await page.locator(".sound-result").count()) <= 20,
      "Picks must be a small starting set",
    );
    await page
      .getByRole("button", { name: "Preview TINE PIANO", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use sound", exact: true })
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".sound-use").disabled,
    );
    if (capture && width === 390)
      await page.screenshot({ path: `${out}/sounds-390.png` });
    await page.getByRole("button", { name: "Use sound", exact: true }).click();
    assert.equal(
      await page.evaluate(
        async () =>
          (await import("/src/state/store.ts")).docStore
            .getState()
            .doc.lanes.find((l) => l.id === "bass").presetId,
      ),
      "preset-keys-tine",
    );

    if (width === 390) {
      await page.locator('.lane-switch-tab[data-lane="chords"]').click();
      await page.getByText("Chord tools", { exact: true }).click();
      await page
        .getByRole("button", { name: "Generate progression", exact: true })
        .click();
      await page.locator(".chord-generator-dialog[open]").waitFor();
      if (capture) await page.screenshot({ path: `${out}/chords-390.png` });
      await page.locator(".chord-block").first().click();
      const before = await page.evaluate(async () =>
        JSON.stringify(
          (await import("/src/state/store.ts")).docStore.getState().doc,
        ),
      );
      await page
        .getByRole("button", { name: "REPLACE SELECTED PATTERNS", exact: true })
        .click();
      await page.evaluate(async () =>
        (await import("/src/state/store.ts")).undo(),
      );
      assert.equal(
        await page.evaluate(async () =>
          JSON.stringify(
            (await import("/src/state/store.ts")).docStore.getState().doc,
          ),
        ),
        before,
        "Generated patterns must undo in one step",
      );

      await page.locator('.lane-switch-tab[data-lane="drums"]').click();
      await page.getByText("Sample tools", { exact: true }).click();
      await page
        .getByRole("button", { name: "Slice audio", exact: true })
        .click();
      await page.locator(".sample-slicer-dialog[open]").waitFor();
      if (capture) await page.screenshot({ path: `${out}/slicer-390.png` });
      const downloaded = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "EXPORT SELECTED SLICE WAV", exact: true })
        .click();
      const download = await downloaded;
      const bytes = readFileSync(await download.path());
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
      assert.ok(bytes.length > 1000);
      await page
        .getByRole("button", { name: "Close Sample Slicer", exact: true })
        .click();

      await page.evaluate(() => {
        window.micRequests = 0;
        navigator.mediaDevices.getUserMedia = async () => {
          window.micRequests++;
          throw new DOMException("Test denial", "NotAllowedError");
        };
      });
      await page.getByText("Sample tools", { exact: true }).click();
      await page
        .getByRole("button", { name: "Record microphone", exact: true })
        .click();
      await page.locator(".recorder-dialog[open]").waitFor();
      assert.equal(
        await page.evaluate(() => window.micRequests),
        0,
        "Opening the recorder must not request a microphone",
      );
      await page
        .getByRole("button", { name: "RECORD TAKE", exact: true })
        .click();
      await page
        .getByText("Microphone access failed.", { exact: false })
        .waitFor();
      await page.keyboard.press("Escape");
    }
    assert.deepEqual(errors, [], `No browser errors at ${width}px`);
    results.push({
      width,
      height,
      playbackAcrossViews: true,
      sounds: true,
      errors,
    });
    await context.close();
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.locator(".lane-grid-scroll").first().waitFor();
  const keeper = await page.evaluate(async () => {
    const store = await import("/src/state/store.ts");
    const boot = await import("/src/persist/boot.ts");
    store.setProjectName("Recovery keeper");
    await boot.getAutosaveController().flush();
    return {
      id: boot.getActiveProjectId(),
      json: (await boot.getBootDb().getRecord(boot.getActiveProjectId())).json,
    };
  });
  await page.locator(".projects-btn").click();
  await page
    .getByRole("button", { name: "SHARE SONG LINK", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector(".share-url-input")?.value.includes("#song="),
  );
  const url = await page.locator(".share-url-input").inputValue();
  await page.goto(url);
  await page.waitForFunction(
    async () =>
      (await import("/src/persist/boot.ts")).getActiveProjectId() !== null,
  );
  await page.waitForFunction(() => !window.location.hash.includes("song="));
  const imported = await page.evaluate(async (keeper) => {
    const boot = await import("/src/persist/boot.ts");
    return {
      id: boot.getActiveProjectId(),
      original: (await boot.getBootDb().getRecord(keeper.id)).json,
    };
  }, keeper);
  assert.notEqual(
    imported.id,
    keeper.id,
    "A shared song must open in a new local project",
  );
  assert.equal(
    imported.original,
    keeper.json,
    "Opening a song link must preserve the previous saved project",
  );
  results.push({
    sharedSongUsesSeparateProject: true,
    previousSavedProjectPreserved: true,
  });
  await context.close();
  writeFileSync(
    `${out}/browser-recovery-${engine}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
