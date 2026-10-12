/**
 * Pure, zero-dependency ZIP archive generator (PKWARE .ZIP file format).
 *
 * Implements the uncompressed (Store, method 0) specification with exact
 * IEEE 802.3 CRC-32 checksums and UTF-8 filename flags. Standard-compliant
 * across Windows Explorer, macOS Archive Utility, Linux unzip, and all DAWs.
 */

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

/** Compute standard IEEE 802.3 32-bit Cyclic Redundancy Check. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(bytes: Uint8Array, offset: number, val: number): void {
  bytes[offset] = val & 0xff;
  bytes[offset + 1] = (val >>> 8) & 0xff;
}

function writeU32(bytes: Uint8Array, offset: number, val: number): void {
  bytes[offset] = val & 0xff;
  bytes[offset + 1] = (val >>> 8) & 0xff;
  bytes[offset + 2] = (val >>> 16) & 0xff;
  bytes[offset + 3] = (val >>> 24) & 0xff;
}

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

/**
 * Build a valid ZIP archive byte buffer from an array of named file entries.
 * Pure function: throws nothing on valid input, allocates exactly once.
 */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const processed = entries.map((e) => {
    const nameBytes = enc.encode(e.name);
    const data = e.data;
    const crc = crc32(data);
    return { nameBytes, data, crc };
  });

  let totalSize = 0;
  for (const p of processed) {
    totalSize += 30 + p.nameBytes.length + p.data.length; // Local file header + name + payload
  }
  let centralDirSize = 0;
  for (const p of processed) {
    centralDirSize += 46 + p.nameBytes.length; // Central directory header + name
  }
  totalSize += centralDirSize + 22; // End of Central Directory record (22 bytes)

  const out = new Uint8Array(totalSize);
  let offset = 0;
  const localOffsets: number[] = [];

  // 1. Local file headers and payloads
  for (const p of processed) {
    localOffsets.push(offset);
    writeU32(out, offset, 0x04034b50); // Signature
    writeU16(out, offset + 4, 20); // Version needed (2.0)
    writeU16(out, offset + 6, 0x0800); // Bit flag: UTF-8 filenames
    writeU16(out, offset + 8, 0); // Compression method: 0 (Store)
    writeU16(out, offset + 10, 0); // Mod time (DOS)
    writeU16(out, offset + 12, 0); // Mod date (DOS)
    writeU32(out, offset + 14, p.crc);
    writeU32(out, offset + 18, p.data.length); // Compressed size
    writeU32(out, offset + 22, p.data.length); // Uncompressed size
    writeU16(out, offset + 26, p.nameBytes.length);
    writeU16(out, offset + 28, 0); // Extra field length
    out.set(p.nameBytes, offset + 30);
    out.set(p.data, offset + 30 + p.nameBytes.length);
    offset += 30 + p.nameBytes.length + p.data.length;
  }

  // 2. Central directory headers
  const centralDirStart = offset;
  for (let i = 0; i < processed.length; i++) {
    const p = processed[i]!;
    const localOffset = localOffsets[i]!;
    writeU32(out, offset, 0x02014b50); // Central directory signature
    writeU16(out, offset + 4, 20); // Version made by
    writeU16(out, offset + 6, 20); // Version needed
    writeU16(out, offset + 8, 0x0800); // Bit flag: UTF-8
    writeU16(out, offset + 10, 0); // Compression method: 0 (Store)
    writeU16(out, offset + 12, 0); // Mod time
    writeU16(out, offset + 14, 0); // Mod date
    writeU32(out, offset + 16, p.crc);
    writeU32(out, offset + 20, p.data.length);
    writeU32(out, offset + 24, p.data.length);
    writeU16(out, offset + 28, p.nameBytes.length);
    writeU16(out, offset + 30, 0); // Extra field length
    writeU16(out, offset + 32, 0); // File comment length
    writeU16(out, offset + 34, 0); // Disk number start
    writeU16(out, offset + 36, 0); // Internal file attributes
    writeU32(out, offset + 38, 0); // External file attributes
    writeU32(out, offset + 42, localOffset); // Relative offset of local header
    out.set(p.nameBytes, offset + 46);
    offset += 46 + p.nameBytes.length;
  }

  // 3. End of Central Directory Record (EOCD)
  writeU32(out, offset, 0x06054b50); // EOCD signature
  writeU16(out, offset + 4, 0); // Number of this disk
  writeU16(out, offset + 6, 0); // Disk with central directory
  writeU16(out, offset + 8, processed.length); // Entries on this disk
  writeU16(out, offset + 10, processed.length); // Total entries
  writeU32(out, offset + 12, centralDirSize); // Size of central directory
  writeU32(out, offset + 16, centralDirStart); // Offset of central directory
  writeU16(out, offset + 20, 0); // ZIP comment length

  return out;
}
