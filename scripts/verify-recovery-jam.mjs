import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of pages) {
    await page.goto("http://127.0.0.1:5174/");
    await page.locator(".lane-grid-scroll").first().waitFor();
    await page.getByText("Session tools", { exact: true }).click();
    await page
      .getByRole("button", { name: "Collaborative jam", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Join local session", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(async () =>
        (await import("/src/collab/jamSession.ts")).jamConnected(),
      ),
      false,
    );
  }
  const [a, b] = pages;
  await a
    .getByRole("button", { name: "Join local session", exact: true })
    .click();
  const room = await a.locator(".jam-room-code").textContent();
  await b.getByRole("button", { name: "CHANGE", exact: true }).click();
  await b.locator("form .jam-self-name-input").fill(room);
  await b.getByRole("button", { name: "JOIN", exact: true }).click();
  for (const page of pages)
    await page.waitForFunction(
      async () =>
        (await import("/src/collab/jamSession.ts")).jamPeers().length === 1,
    );
  await a.evaluate(async () =>
    (await import("/src/state/store.ts")).setProjectName("Recovery sync check"),
  );
  await b.waitForFunction(
    async () =>
      (await import("/src/state/store.ts")).docStore.getState().doc.name ===
      "Recovery sync check",
  );
  await b.evaluate(async () =>
    (await import("/src/state/store.ts")).setTransport({ bpm: 123 }),
  );
  await a.waitForFunction(
    async () =>
      (await import("/src/state/store.ts")).docStore.getState().doc.transport
        .bpm === 123,
  );
  for (const page of pages) {
    await page
      .getByRole("button", { name: "Leave session", exact: true })
      .click();
    assert.equal(
      await page.evaluate(async () =>
        (await import("/src/collab/jamSession.ts")).jamConnected(),
      ),
      false,
    );
  }
  const result = {
    browser: browser.version(),
    explicitJoin: true,
    twoTabDiscovery: true,
    projectEditsSyncBothWays: true,
    explicitLeave: true,
    remoteDevicesTested: false,
  };
  writeFileSync(
    "docs/dev/recovery-2026-10-25/jam.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
