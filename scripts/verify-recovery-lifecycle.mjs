/* global window, performance */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const label = process.argv[2] ?? "after";
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    const origins = new WeakMap();
    window.frameWork = {};
    window.requestAnimationFrame = (callback) => {
      if (!origins.has(callback)) {
        const stack = new Error().stack ?? "";
        origins.set(
          callback,
          ["grid/renderer", "Booth", "soundingFollow", "viz/renderer"].find(
            (name) => stack.includes(name),
          ) ?? "other",
        );
      }
      const origin = origins.get(callback);
      return request((time) => {
        const start = performance.now();
        callback(time);
        const entry = (window.frameWork[origin] ??= { calls: 0, ms: 0 });
        entry.calls++;
        entry.ms += performance.now() - start;
      });
    };
  });
  await page.goto("http://127.0.0.1:5174/");
  await page.locator(".lane-grid-scroll").first().waitFor();
  const measure = async (mode) => {
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.frameWork = {};
    });
    await page.waitForTimeout(1000);
    results.push({ mode, work: await page.evaluate(() => window.frameWork) });
  };
  await measure("idle-edit");
  await page.locator(".booth-btn-play").click();
  await measure("playing-edit");
  await page.evaluate(async () =>
    (await import("/src/state/phonePage.ts")).showPhonePage("song"),
  );
  await measure("playing-song");
  await page.evaluate(async () =>
    (await import("/src/state/phonePage.ts")).showPhonePage("mixer"),
  );
  await measure("playing-mixer");
  await page.evaluate(async () =>
    (await import("/src/state/vizMode.ts")).openViz(),
  );
  await page.locator(".viz-page").waitFor();
  await measure("playing-viz");
  await page.evaluate(async () =>
    (await import("/src/state/vizMode.ts")).closeViz(),
  );
  await page.evaluate(async () =>
    (await import("/src/engine/session.ts")).getSession().togglePlay(),
  );
  await measure("idle-mixer");
  writeFileSync(
    `docs/dev/recovery-2026-10-25/${label}-lifecycle.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  const idle = results.find((r) => r.mode === "idle-edit");
  assert.equal(
    idle.work["grid/renderer"]?.calls ?? 0,
    0,
    "Stopped grids must not request continuous animation frames",
  );
  for (const result of results.filter((r) =>
    ["playing-song", "playing-mixer", "playing-viz"].includes(r.mode),
  )) {
    assert.ok(
      (result.work["grid/renderer"]?.calls ?? 0) <= 4,
      `Hidden grids must not poll during ${result.mode}`,
    );
  }
  for (const mode of ["playing-viz", "playing-mixer"]) {
    const result = results.find((r) => r.mode === mode);
    assert.equal(
      result.work.soundingFollow?.calls ?? 0,
      0,
      `Note-follow must sleep during ${mode}`,
    );
  }
  assert.equal(
    results.find((r) => r.mode === "playing-viz").work.Booth?.calls ?? 0,
    0,
  );
} finally {
  await browser.close();
}
