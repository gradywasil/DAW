import { describe, expect, it } from "vitest";
import {
  exportStems,
  STEMS_EXTENSION,
} from "../src/audio/exportStems";
import type { DownloadSeam } from "../src/persist/fileIO";
import type { ProjectDocument } from "../src/document/schema";
import { createDefaultProject, LANE_IDS } from "../src/document/schema";
import type { RenderedLoop } from "../src/audio/render";

function fakeLoopWithStems(loopSamples: number): RenderedLoop {
  const mk = () => new Float32Array(loopSamples).fill(0.1);
  return {
    channels: [mk(), mk()],
    stereoLaneStems: LANE_IDS.map(() => [mk(), mk()]),
    outputSamples: loopSamples,
    loopSamples,
    tailSamples: 0,
    sampleRate: 44100,
    loopSteps: 32, // 2 bars
    bpm: 120,
  };
}

function captureSeam(): {
  seam: DownloadSeam;
  downloads: { name: string; blob: Blob }[];
} {
  const downloads: { name: string; blob: Blob }[] = [];
  let n = 0;
  const seam: DownloadSeam = {
    createObjectURL: (blob) => {
      downloads.push({ name: `#pending-${n++}`, blob });
      return `blob:fake-${n}`;
    },
    revokeObjectURL: () => undefined,
    createElement: () => ({ click: () => undefined, href: "", download: "" }),
  };
  return { seam, downloads };
}

describe("exportStems — multi-track ZIP export", () => {
  it("renders Master plus all lane stems and downloads a ZIP archive", async () => {
    const cap = captureSeam();
    const doc = createDefaultProject();
    const result = await exportStems(doc, {
      render: () => Promise.resolve(fakeLoopWithStems(44100)),
      seam: cap.seam,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Master + LANE_IDS lanes
    expect(result.trackCount).toBe(1 + LANE_IDS.length);
    expect(result.bars).toBe(2);
    expect(result.sampleRate).toBe(44100);
    expect(result.filename.endsWith(STEMS_EXTENSION)).toBe(true);
    expect(cap.downloads).toHaveLength(1);
    expect(cap.downloads[0]!.blob.type).toBe("application/zip");
    expect(result.byteLength).toBe(cap.downloads[0]!.blob.size);
  });

  it("sanitizes filename from project name", async () => {
    const cap = captureSeam();
    const doc = {
      ...createDefaultProject(),
      name: "../my stems/\\lane",
    } as ProjectDocument;

    const result = await exportStems(doc, {
      render: () => Promise.resolve(fakeLoopWithStems(1000)),
      seam: cap.seam,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toBe(`..my stemslane${STEMS_EXTENSION}`);
  });

  it("returns typed error when render fails", async () => {
    const cap = captureSeam();
    const doc = createDefaultProject();

    const result = await exportStems(doc, {
      render: () => Promise.reject(new Error("Offline render failed")),
      seam: cap.seam,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("render");
    expect(cap.downloads).toHaveLength(0);
  });

  it("returns typed error when download seam fails", async () => {
    const faultySeam: DownloadSeam = {
      createObjectURL: () => {
        throw new Error("QuotaExceeded");
      },
      revokeObjectURL: () => undefined,
      createElement: () => ({ click: () => undefined, href: "", download: "" }),
    };

    const doc = createDefaultProject();
    const result = await exportStems(doc, {
      render: () => Promise.resolve(fakeLoopWithStems(1000)),
      seam: faultySeam,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("io");
  });
});
