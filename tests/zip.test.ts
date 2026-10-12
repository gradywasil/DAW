import { describe, expect, it } from "vitest";
import { crc32, createZip } from "../src/audio/zip";

describe("zip generator (PKWARE Store mode)", () => {
  it("computes standard IEEE 802.3 CRC-32", () => {
    const enc = new TextEncoder();
    expect(crc32(new Uint8Array([]))).toBe(0);
    // Standard test vector: "123456789" -> 0xcbf43926
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    // "Hello World" -> 0x4a17b156
    expect(crc32(enc.encode("Hello World"))).toBe(0x4a17b156);
  });

  it("packages multiple files with valid ZIP headers and signatures", () => {
    const enc = new TextEncoder();
    const entries = [
      { name: "00_Master.wav", data: enc.encode("RIFF...WAVEfmt ") },
      { name: "01_Drums.wav", data: enc.encode("RIFF...DrumsData") },
      { name: "02_Bass.wav", data: enc.encode("RIFF...BassData") },
    ];

    const zipBytes = createZip(entries);
    expect(zipBytes.byteLength).toBeGreaterThan(0);

    const view = new DataView(
      zipBytes.buffer,
      zipBytes.byteOffset,
      zipBytes.byteLength,
    );

    // First local header starts with PK\3\4 (0x04034b50)
    expect(view.getUint32(0, true)).toBe(0x04034b50);

    // EOCD record is at the end: PK\5\6 (0x06054b50)
    const eocdOffset = zipBytes.byteLength - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    // EOCD total entries = entries.length
    expect(view.getUint16(eocdOffset + 10, true)).toBe(entries.length);
  });

  it("handles empty entries list cleanly", () => {
    const zipBytes = createZip([]);
    expect(zipBytes.byteLength).toBe(22); // exactly EOCD
    const view = new DataView(
      zipBytes.buffer,
      zipBytes.byteOffset,
      zipBytes.byteLength,
    );
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(10, true)).toBe(0);
  });
});
