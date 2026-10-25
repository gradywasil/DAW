/* global document, window, performance, MessagePort */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

// Audio-clock estimates exclude speakers, Bluetooth, and device output latency.
const label = process.argv[2] ?? "after";
const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const samples = [];
try {
  for (let run = 0; run < 10; run++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = new Proxy(NativeAudioContext, {
        construct(Target, args) {
          const ctx = Reflect.construct(Target, args);
          window.testAudioContext = ctx;
          return ctx;
        },
      });
      const post = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function (message, ...rest) {
        if (
          window.pressAt &&
          !window.firstNote &&
          message?.type === "events" &&
          message.events?.length
        ) {
          const leadMs =
            (message.events[0].time - window.testAudioContext.currentTime) *
            1000;
          window.firstNote = {
            clickToScheduledAudioMs:
              performance.now() - window.pressAt + Math.max(0, leadMs),
            clickToFirstDispatchMs: performance.now() - window.pressAt,
            leadAtDispatchMs: leadMs,
          };
        }
        return post.call(this, message, ...rest);
      };
      document.addEventListener(
        "click",
        (event) => {
          const button = event.target.closest?.(".booth-btn-play");
          if (button && button.getAttribute("aria-pressed") !== "true") {
            window.pressAt = performance.now();
            window.firstNote = null;
          }
        },
        true,
      );
    });
    await page.goto("http://127.0.0.1:5174/");
    await page.locator(".lane-grid-scroll").first().waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector(".head-sound-browse")
        ?.textContent.includes("SOFT STEP"),
    );
    for (const state of ["cold", "warm"]) {
      await page.locator(".booth-btn-play").click();
      await page.waitForFunction(() => window.firstNote);
      samples.push({
        run,
        state,
        ...(await page.evaluate(() => window.firstNote)),
      });
      await page.locator(".booth-btn-play").click();
    }
    await context.close();
  }
  const median = (values) => {
    const sorted = values.sort((a, b) => a - b);
    return (sorted[4] + sorted[5]) / 2;
  };
  const result = {
    browser: browser.version(),
    cpuThrottle: 4,
    physicalOutputLatencyMeasured: false,
    lateFirstDispatches: samples.filter((s) => s.leadAtDispatchMs < 0).length,
    samples,
    coldMedianMs: median(
      samples
        .filter((s) => s.state === "cold")
        .map((s) => s.clickToScheduledAudioMs),
    ),
    warmMedianMs: median(
      samples
        .filter((s) => s.state === "warm")
        .map((s) => s.clickToScheduledAudioMs),
    ),
  };
  writeFileSync(
    `docs/dev/recovery-2026-10-25/${label}-latency.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
