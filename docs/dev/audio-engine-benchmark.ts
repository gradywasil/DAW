import { el } from "@elemaudio/core";
import OfflineRenderer from "@elemaudio/offline-renderer";
import { createReverbDevice, renderImpulseResponse } from "../../src/audio/fx";

const SAMPLE_RATE = 44_100;
const PROGRAM_SECONDS = 8;
const PASSES = 5;
const REVERB_SEED = 0x5eed;
const REVERB_SIZE = 0.65;
const REVERB_MIX = 0.5;
const runButton = document.querySelector<HTMLButtonElement>("#run")!;
const result = document.querySelector<HTMLElement>("#result")!;

function makeInput(seconds: number, firstTransientOffset = 0): [Float32Array, Float32Array] {
  const count = Math.round(SAMPLE_RATE * seconds);
  const channels: [Float32Array, Float32Array] = [
    new Float32Array(count),
    new Float32Array(count),
  ];
  // A repeatable, sparse musical transient pattern gives the tail enough
  // activity to exercise the full convolution without adding RNG noise.
  for (let beat = 0; beat < 16; beat++) {
    const start = Math.round((beat * 60 / 120) * SAMPLE_RATE) + (beat === 0 ? firstTransientOffset : 0);
    for (let i = 0; i < 180; i++) {
      const envelope = Math.exp(-i / 34);
      const sample = (i === 0 ? 0.8 : 0) + Math.sin(i * 1.71) * envelope * 0.18;
      channels[0][start + i] = sample;
      channels[1][start + i] = sample * (0.96 + Math.sin(i * 0.07) * 0.03);
    }
  }
  return channels;
}

const reverbDevice = {
  type: "reverb" as const,
  bypassed: false,
  params: { size: REVERB_SIZE, mix: REVERB_MIX },
};
const ir = renderImpulseResponse({ seed: REVERB_SEED, size: REVERB_SIZE, sampleRate: SAMPLE_RATE });
let input = makeInput(PROGRAM_SECONDS);
const outputSeconds = PROGRAM_SECONDS + ir.lengthSeconds;
const outputFrames = Math.ceil(outputSeconds * SAMPLE_RATE);
type ProbeMode = "full" | "dry" | "wet";

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function formatMs(value: number): string {
  return `${value.toFixed(1)} ms`;
}

function summarize(left: Float32Array, right: Float32Array) {
  let energy = 0;
  let peak = 0;
  let peakIndex = 0;
  let finite = true;
  for (let i = 0; i < left.length; i++) {
    const l = left[i]!;
    const r = right[i]!;
    finite &&= Number.isFinite(l) && Number.isFinite(r);
    energy += l * l + r * r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  return { rms: Math.sqrt(energy / (left.length * 2)), peak, finite };
}

function compare(left: Float32Array, right: Float32Array, refL: Float32Array, refR: Float32Array) {
  let square = 0;
  let peak = 0;
  let peakIndex = 0;
  let refSquare = 0;
  const beatErrors: number[] = [];
  const beatFrames = SAMPLE_RATE / 2;
  for (let i = 0; i < left.length; i++) {
    const dl = left[i]! - refL[i]!;
    const dr = right[i]! - refR[i]!;
    square += dl * dl + dr * dr;
    refSquare += refL[i]! * refL[i]! + refR[i]! * refR[i]!;
    const samplePeak = Math.max(Math.abs(dl), Math.abs(dr));
    if (samplePeak > peak) {
      peak = samplePeak;
      peakIndex = i;
    }
  }
  for (let beat = 0; beat < PROGRAM_SECONDS * 2; beat++) {
    let beatSquare = 0;
    let beatRefSquare = 0;
    const start = beat * beatFrames;
    const end = Math.min(left.length, start + beatFrames);
    for (let i = start; i < end; i++) {
      const dl = left[i]! - refL[i]!;
      const dr = right[i]! - refR[i]!;
      beatSquare += dl * dl + dr * dr;
      beatRefSquare += refL[i]! * refL[i]! + refR[i]! * refR[i]!;
    }
    beatErrors.push(Math.sqrt(beatSquare / Math.max(beatRefSquare, 1e-20)));
  }
  return {
    relativeRms: Math.sqrt(square / Math.max(refSquare, 1e-20)),
    peak,
    peakIndex,
    firstBeat: beatErrors[0]!,
    laterBeats: Math.sqrt(beatErrors.slice(1).reduce((sum, value) => sum + value * value, 0) / Math.max(1, beatErrors.length - 1)),
  };
}

function findAlignment(left: Float32Array, right: Float32Array, refL: Float32Array, refR: Float32Array) {
  const limit = Math.min(8192, left.length, refL.length);
  const radius = 512;
  let best = { offset: 0, correlation: -1 };
  for (let offset = -radius; offset <= radius; offset++) {
    const start = Math.max(0, -offset);
    const end = Math.min(limit, limit - offset);
    let dot = 0;
    let aa = 0;
    let bb = 0;
    for (let i = start; i < end; i++) {
      const aL = left[i]!;
      const aR = right[i]!;
      const bL = refL[i + offset]!;
      const bR = refR[i + offset]!;
      dot += aL * bL + aR * bR;
      aa += aL * aL + aR * aR;
      bb += bL * bL + bR * bR;
    }
    const correlation = dot / Math.sqrt(Math.max(aa * bb, 1e-30));
    if (correlation > best.correlation) best = { offset, correlation };
  }
  return best;
}

async function renderNative(mode: ProbeMode = "full") {
  const context = new OfflineAudioContext(2, outputFrames, SAMPLE_RATE);
  const source = context.createBuffer(2, input[0].length, SAMPLE_RATE);
  source.copyToChannel(input[0], 0);
  source.copyToChannel(input[1], 1);
  const player = context.createBufferSource();
  player.buffer = source;
  if (mode === "full") {
    const reverb = createReverbDevice(context, reverbDevice, { seed: REVERB_SEED });
    player.connect(reverb.input).connect(reverb.output).connect(context.destination);
  } else if (mode === "dry") {
    player.connect(context.destination);
  } else {
    const impulse = context.createBuffer(2, ir.channels[0].length, SAMPLE_RATE);
    impulse.copyToChannel(ir.channels[0], 0);
    impulse.copyToChannel(ir.channels[1], 1);
    const convolver = context.createConvolver();
    convolver.normalize = false;
    convolver.buffer = impulse;
    const wet = context.createGain();
    wet.gain.value = REVERB_MIX;
    player.connect(convolver).connect(wet).connect(context.destination);
  }
  player.start();

  const startedAt = performance.now();
  const buffer = await context.startRendering();
  const elapsedMs = performance.now() - startedAt;
  return {
    elapsedMs,
    left: buffer.getChannelData(0),
    right: buffer.getChannelData(1),
  };
}

async function renderElementary(mode: ProbeMode = "full") {
  const core = new OfflineRenderer();
  await core.initialize({
    numInputChannels: 2,
    numOutputChannels: 2,
    sampleRate: SAMPLE_RATE,
    virtualFileSystem: {
      "/ir-left": ir.channels[0],
      "/ir-right": ir.channels[1],
    },
  });
  const channelGraph = (channel: number, path: string) => {
    const dry = el.in({ channel });
    if (mode === "dry") return dry;
    const wet = el.convolve({ path }, dry);
    if (mode === "wet") return el.mul(REVERB_MIX, wet);
    return el.add(el.mul(1 - 0.5 * REVERB_MIX, dry), el.mul(REVERB_MIX, wet));
  };
  await core.render(channelGraph(0, "/ir-left"), channelGraph(1, "/ir-right"));
  const left = new Float32Array(outputFrames);
  const right = new Float32Array(outputFrames);
  const startedAt = performance.now();
  core.process([input[0], input[1]], [left, right]);
  const elapsedMs = performance.now() - startedAt;
  return { elapsedMs, left, right };
}

async function benchmark() {
  runButton.disabled = true;
  result.textContent = "Warming up engines…";
  await new Promise((resolve) => setTimeout(resolve, 40));

  // Warm each engine once, then alternate measurement order to reduce bias
  // from thermal changes or browser background work.
  const warmNative = await renderNative();
  const warmElementary = await renderElementary();
  let native: Awaited<ReturnType<typeof renderNative>> = warmNative;
  let elementary: Awaited<ReturnType<typeof renderElementary>> = warmElementary;
  const nativeTimes: number[] = [];
  const elementaryTimes: number[] = [];
  result.textContent = `Warm-up complete. Running ${PASSES} measured passes…`;

  for (let pass = 0; pass < PASSES; pass++) {
    if (pass % 2 === 0) {
      native = await renderNative();
      nativeTimes.push(native.elapsedMs);
      elementary = await renderElementary();
      elementaryTimes.push(elementary.elapsedMs);
    } else {
      elementary = await renderElementary();
      elementaryTimes.push(elementary.elapsedMs);
      native = await renderNative();
      nativeTimes.push(native.elapsedMs);
    }
  }

  const nativeMedian = median(nativeTimes);
  const elementaryMedian = median(elementaryTimes);
  const delta = compare(elementary.left, elementary.right, native.left, native.right);
  const alignment = findAlignment(elementary.left, elementary.right, native.left, native.right);
  const nativeSound = summarize(native.left, native.right);
  const elementarySound = summarize(elementary.left, elementary.right);
  const probes: { mode: ProbeMode; delta: ReturnType<typeof compare>; native: Float32Array; elementary: Float32Array }[] = [];
  for (const mode of ["dry", "wet"] as const) {
    const [nativeProbe, elementaryProbe] = await Promise.all([
      renderNative(mode),
      renderElementary(mode),
    ]);
    probes.push({
      mode,
      delta: compare(elementaryProbe.left, elementaryProbe.right, nativeProbe.left, nativeProbe.right),
      native: nativeProbe.left,
      elementary: elementaryProbe.left,
    });
  }
  input = makeInput(PROGRAM_SECONDS, 512);
  const [delayedNative, delayedElementary] = await Promise.all([renderNative("dry"), renderElementary("dry")]);
  const delayedDry = compare(delayedElementary.left, delayedElementary.right, delayedNative.left, delayedNative.right);
  input = makeInput(PROGRAM_SECONDS);
  const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
  await audioContext.resume();
  const latency = {
    sampleRate: audioContext.sampleRate,
    baseLatency: audioContext.baseLatency,
    outputLatency: "outputLatency" in audioContext
      ? (audioContext as AudioContext & { outputLatency: number }).outputLatency
      : null,
  };
  await audioContext.close();

  result.textContent = [
    `Device: ${navigator.userAgent}`,
    `Context: ${latency.sampleRate} Hz · base latency ${latency.baseLatency == null ? "unavailable" : formatMs(latency.baseLatency * 1000)} · output latency ${latency.outputLatency == null ? "unavailable" : formatMs(latency.outputLatency * 1000)}`,
    `Workload: ${PROGRAM_SECONDS.toFixed(1)} s stereo input · ${ir.lengthSeconds.toFixed(2)} s seeded stereo IR · ${PASSES} passes per engine`,
    "",
    `Native ConvolverNode median: ${formatMs(nativeMedian)} (${(outputSeconds * 1000 / nativeMedian).toFixed(1)}× real-time)` ,
    `Elementary WASM median: ${formatMs(elementaryMedian)} (${(outputSeconds * 1000 / elementaryMedian).toFixed(1)}× real-time)` ,
    `Elementary vs native render time: ${((elementaryMedian / nativeMedian - 1) * 100).toFixed(1)}%`,
    `Output difference: relative RMS ${(delta.relativeRms * 100).toFixed(2)}% · peak ${delta.peak.toExponential(2)}`,
    `Full peak-error sample: ${delta.peakIndex} (${(delta.peakIndex / SAMPLE_RATE * 1000).toFixed(2)} ms) · first 8 native [${Array.from(native.left.slice(0, 8)).map((v) => v.toFixed(4)).join(", ")}] · Elementary [${Array.from(elementary.left.slice(0, 8)).map((v) => v.toFixed(4)).join(", ")}]`,
    `Alignment probe: ${alignment.offset} samples (${(alignment.offset / SAMPLE_RATE * 1000).toFixed(2)} ms) · first-window correlation ${alignment.correlation.toFixed(5)}`,
    ...probes.map((probe) => `${probe.mode} only difference: relative RMS ${(probe.delta.relativeRms * 100).toFixed(2)}% · peak ${probe.delta.peak.toExponential(2)} at ${probe.delta.peakIndex} · first 8 native [${Array.from(probe.native.slice(0, 8)).map((v) => v.toFixed(4)).join(", ")}] · Elementary [${Array.from(probe.elementary.slice(0, 8)).map((v) => v.toFixed(4)).join(", ")}]`),
    `Per-beat error (full): first ${ (delta.firstBeat * 100).toFixed(2)}% · beats 2–16 RMS ${(delta.laterBeats * 100).toFixed(2)}%`,
    ...probes.map((probe) => `Per-beat error (${probe.mode}): first ${(probe.delta.firstBeat * 100).toFixed(2)}% · later ${(probe.delta.laterBeats * 100).toFixed(2)}%`),
    `Dry first transient moved by 512 samples: relative RMS ${(delayedDry.relativeRms * 100).toFixed(2)}% · peak ${delayedDry.peak.toExponential(2)} at ${delayedDry.peakIndex}`,
    `Finite output: native ${nativeSound.finite ? "yes" : "NO"} · Elementary ${elementarySound.finite ? "yes" : "NO"}`,
    `Output RMS: native ${nativeSound.rms.toFixed(6)} · Elementary ${elementarySound.rms.toFixed(6)}`,
    "",
    "Interpretation: offline throughput estimates DSP cost; it does not establish live glitch rate or latency. Context latency is browser/device output latency, common to both renderers. Repeat on each target browser and device before choosing an engine.",
  ].join("\n");
}

runButton.addEventListener("click", () => {
  void benchmark().catch((error: unknown) => {
    result.textContent = `Benchmark failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`;
  }).finally(() => {
    runButton.disabled = false;
  });
});
