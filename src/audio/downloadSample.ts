import { encodeWav16 } from "./wav";

/** Preserve the source sample rate and duplicate mono into a stereo WAV. */
export function downloadSample(buffer: AudioBuffer, name: string): void {
  const bytes = encodeWav16(
    [
      buffer.getChannelData(0),
      buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)),
    ],
    buffer.sampleRate,
  );
  const url = URL.createObjectURL(
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "audio/wav" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "sample"}.wav`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
