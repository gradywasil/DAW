/**
 * Phase 1 / T-01: Multi-Track Stem WAV Export
 *
 * Renders individual stereo audio stems for every lane (drums, bass, chords,
 * lead) plus the master mix directly from the linear arrangement, encodes each
 * to standard 16-bit stereo PCM WAV via `encodeWav16`, and bundles them into
 * a single zero-dependency `.bitbounce-stems.zip` archive.
 */

import type { ProjectDocument } from "../document/schema";
import { LANE_IDS } from "../document/schema";
import { renderProjectToBuffer, type RenderedLoop } from "./render";
import { encodeWav16 } from "./wav";
import { createZip, type ZipEntry } from "./zip";
import {
  type DownloadSeam,
  safeFileStem,
} from "../persist/fileIO";

export const STEMS_EXTENSION = ".bitbounce-stems.zip";

export type StemsExportFailureKind = "render" | "encode" | "zip" | "io";

export interface StemsExportFailure {
  readonly ok: false;
  readonly kind: StemsExportFailureKind;
  readonly message: string;
  readonly suggestion: string;
}

export interface StemsExportSuccess {
  readonly ok: true;
  readonly filename: string;
  readonly byteLength: number;
  readonly bars: number;
  readonly trackCount: number;
  readonly sampleRate: number;
}

export type StemsExportResult = StemsExportSuccess | StemsExportFailure;

export interface ExportStemsOptions {
  readonly seam?: DownloadSeam;
  readonly render?: (project: ProjectDocument) => Promise<RenderedLoop>;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function defaultSeam(): DownloadSeam {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createElement: (tag) =>
      document.createElement(tag as "a") as HTMLAnchorElement,
  };
}

function downloadZipBytes(
  filename: string,
  bytes: Uint8Array,
  seam: DownloadSeam,
): void {
  const blob = new Blob([bytes.slice()], { type: "application/zip" });
  const url = seam.createObjectURL(blob);
  try {
    const anchor = seam.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    seam.revokeObjectURL(url);
  }
}

/**
 * Render stems for all lanes + master mix, compress into a zip file, and trigger download.
 */
export async function exportStems(
  project: ProjectDocument,
  opts: ExportStemsOptions = {},
): Promise<StemsExportResult> {
  const renderFn =
    opts.render ??
    ((doc) =>
      renderProjectToBuffer(doc, {
        arrangement: "linear",
        stereoLaneStems: true,
      }));

  let rendered: RenderedLoop;
  try {
    rendered = await renderFn(project);
  } catch {
    return {
      ok: false,
      kind: "render",
      message: "Stems could not be rendered.",
      suggestion:
        "Playback is untouched — close other tabs or apps and try again.",
    };
  }

  const outputSamples = rendered.outputSamples ?? rendered.channels[0]!.length;
  const entries: ZipEntry[] = [];

  try {
    // 1. Master stereo mix
    const masterChannels = rendered.channels.map((ch) =>
      ch.length === outputSamples ? ch : ch.subarray(0, outputSamples),
    );
    const masterBytes = encodeWav16(masterChannels, rendered.sampleRate);
    entries.push({
      name: "00_Master.wav",
      data: masterBytes,
    });

    // 2. Individual lane stereo stems
    const stereoStems = rendered.stereoLaneStems;
    if (stereoStems && stereoStems.length > 0) {
      stereoStems.forEach((pair, i) => {
        const laneId = LANE_IDS[i] ?? `lane_${i + 1}`;
        const laneName = capitalize(laneId);
        const prefix = String(i + 1).padStart(2, "0");

        const stemChannels = pair.map((ch) =>
          ch.length === outputSamples ? ch : ch.subarray(0, outputSamples),
        );
        const wavBytes = encodeWav16(stemChannels, rendered.sampleRate);
        entries.push({
          name: `${prefix}_${laneName}.wav`,
          data: wavBytes,
        });
      });
    }
  } catch {
    return {
      ok: false,
      kind: "encode",
      message: "Stems WAV encoding failed.",
      suggestion: "Memory was exceeded while formatting audio files.",
    };
  }

  let zipBytes: Uint8Array;
  try {
    zipBytes = createZip(entries);
  } catch {
    return {
      ok: false,
      kind: "zip",
      message: "Stems archive packaging failed.",
      suggestion: "Archive creation was interrupted — try exporting again.",
    };
  }

  const baseStem = safeFileStem(project.name);
  const filename = `${baseStem}${STEMS_EXTENSION}`;

  try {
    downloadZipBytes(filename, zipBytes, opts.seam ?? defaultSeam());
  } catch {
    return {
      ok: false,
      kind: "io",
      message: "Stems download could not start.",
      suggestion:
        "Check browser download permissions, then export again.",
    };
  }

  return {
    ok: true,
    filename,
    byteLength: zipBytes.byteLength,
    bars: rendered.loopSteps / 16,
    trackCount: entries.length,
    sampleRate: rendered.sampleRate,
  };
}
