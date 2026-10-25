import { describe, it, expect } from "vitest";
import {
  compressStringToUrlSafe,
  decompressStringFromUrlSafe,
  uint8ArrayToBase64Url,
  base64UrlToUint8Array,
  encodeDocumentToShareUrl,
  decodeDocumentFromShareUrl,
} from "../src/persist/shareUrl";
import { createDemoProject } from "../src/document/demoSong";

describe("Compact Project Cloud Links & URL Project Sharing Engine", () => {
  it("drains compression while writing a large project-sized payload", async () => {
    let state = 47;
    const text = Array.from({ length: 250_000 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return String.fromCharCode(32 + ((state >>> 16) % 90));
    }).join("");
    const compressed = await compressStringToUrlSafe(text);
    expect(await decompressStringFromUrlSafe(compressed)).toBe(text);
  }, 2000);
  it("encodes and decodes arbitrary byte arrays into URL-safe base64 strings", () => {
    const original = new Uint8Array([0, 1, 2, 63, 64, 127, 128, 255]);
    const encoded = uint8ArrayToBase64Url(original);

    // Verify URL safety (no +, /, or = characters)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = base64UrlToUint8Array(encoded);
    expect(decoded.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBe(original[i]);
    }
  });

  it("losslessly compresses and decompresses plain text using native deflate-raw", async () => {
    const sample =
      "Bitbounce DAW — Fast, expressive in-browser music studio. ".repeat(20);
    const compressed = await compressStringToUrlSafe(sample);

    expect(compressed.length).toBeLessThan(sample.length);
    expect(compressed).toMatch(/^[A-Za-z0-9_-]+$/);

    const decompressed = await decompressStringFromUrlSafe(compressed);
    expect(decompressed).toBe(sample);
  });

  it("round-trips a complete ProjectDocument through share URL encoding and decoding", async () => {
    const demo = createDemoProject();
    const shareUrl = await encodeDocumentToShareUrl(
      demo,
      "https://bitbounce.app/",
    );

    expect(shareUrl.startsWith("https://bitbounce.app/#song=")).toBe(true);

    const decodedDoc = await decodeDocumentFromShareUrl(shareUrl);
    expect(decodedDoc).not.toBeNull();
    expect(decodedDoc?.version).toBe(demo.version);
    expect(decodedDoc?.name).toBe(demo.name);
    expect(decodedDoc?.transport.bpm).toBe(demo.transport.bpm);
    expect(decodedDoc?.patterns.drums.length).toBe(demo.patterns.drums.length);
  });

  it("decodes share URLs formatted with search params (?song=...)", async () => {
    const demo = createDemoProject();
    const shareUrl = await encodeDocumentToShareUrl(
      demo,
      "https://bitbounce.app/",
    );
    const queryUrl = shareUrl.replace("#song=", "?song=");

    const decodedDoc = await decodeDocumentFromShareUrl(queryUrl);
    expect(decodedDoc).not.toBeNull();
    expect(decodedDoc?.name).toBe(demo.name);
  });

  it("safely handles corrupted or invalid payloads without throwing", async () => {
    const corrupt1 = await decodeDocumentFromShareUrl(
      "https://bitbounce.app/#song=not-a-real-deflate-payload",
    );
    expect(corrupt1).toBeNull();

    const corrupt2 = await decodeDocumentFromShareUrl("");
    expect(corrupt2).toBeNull();
  });

  it("achieves substantial compression on project document JSON", async () => {
    const demo = createDemoProject();
    const jsonLength = JSON.stringify(demo).length;

    const shareUrl = await encodeDocumentToShareUrl(demo);
    const payloadLength = shareUrl.split("#song=")[1]!.length;

    // Deflate-raw on JSON achieves over 50% size reduction
    expect(payloadLength).toBeLessThan(jsonLength * 0.5);
  });
});
