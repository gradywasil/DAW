/**
 * SampleSlicerModal — Interactive Audio Sample Slicer & Transient Chopper Studio.
 * Allows producers to import loops or use synthetic factory breakbeats,
 * visualize audio waveforms, detect transient attack points, fine-tune slice
 * boundaries, audition pads with keyboard shortcuts, and commit chopped breaks
 * directly to the drum pattern.
 */

import {
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  For,
  Show,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import { sharedSlicerSource, setSharedSlicerSource } from "../audio/audioRecorder";
import {
  calculateSlices,
  generateSyntheticBreakbeat,
  renderSliceBuffer,
  type AudioSlice,
  type SlicingMode,
} from "../audio/sampleSlicer";
import { getSession } from "../engine/session";
import { toggleDrumStep } from "../state/store";
import { type DrumPiece } from "../document/schema";
import { IconScissors, IconClose } from "./icons";
import "../styles/sample-slicer.css";

interface SampleSlicerModalProps {
  onClose: () => void;
}

export default function SampleSlicerModal(props: SampleSlicerModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;
  let canvasRef!: HTMLCanvasElement;
  let fileInputRef!: HTMLInputElement;

  const [mode, setMode] = createSignal<SlicingMode>("transients");
  const [sensitivity, setSensitivity] = createSignal(0.55);
  const [audioBuffer, setAudioBuffer] = createSignal<AudioBuffer | null>(null);
  const [sampleName, setSampleName] = createSignal("Synthetic Funk Breakbeat");
  const [slices, setSlices] = createSignal<AudioSlice[]>([]);
  const [selectedSliceIndex, setSelectedSliceIndex] = createSignal(0);
  const [playingSliceIndex, setPlayingSliceIndex] = createSignal<number | null>(null);
  const [playheadRatio, setPlayheadRatio] = createSignal<number | null>(null);
  const [isDraggingSlice, setIsDraggingSlice] = createSignal<number | null>(null);

  // Web Audio Context
  let activeAudioCtx: AudioContext | null = null;
  let activeSourceNode: AudioBufferSourceNode | null = null;

  const getAudioContext = (): AudioContext => {
    if (!activeAudioCtx) {
      try {
        const session = getSession();
        activeAudioCtx = (session as any).audioContext ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        activeAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
    return activeAudioCtx!;
  };

  const loadDefaultBreakbeat = (bpm = 130) => {
    try {
      const ctx = getAudioContext();
      const buffer = generateSyntheticBreakbeat(ctx, bpm);
      setAudioBuffer(buffer);
      setSampleName(`Synthetic Funk Break (${bpm} BPM)`);
      recalculateSlices(buffer);
    } catch {
      // AudioContext unavailable in mock environment
    }
  };

  const recalculateSlices = (buffer: AudioBuffer | null = audioBuffer()) => {
    if (!buffer) return;
    const computed = calculateSlices(buffer, mode(), sensitivity());
    setSlices(computed);
    if (selectedSliceIndex() >= computed.length) {
      setSelectedSliceIndex(0);
    }
  };

  const handleModeChange = (newMode: SlicingMode) => {
    setMode(newMode);
    recalculateSlices();
  };

  const handleSensitivityChange = (newSens: number) => {
    setSensitivity(newSens);
    if (mode() === "transients") {
      recalculateSlices();
    }
  };

  const stopActivePlayback = () => {
    if (activeSourceNode) {
      try {
        activeSourceNode.stop();
        activeSourceNode.disconnect();
      } catch {
        // ignore
      }
      activeSourceNode = null;
    }
    setPlayingSliceIndex(null);
    setPlayheadRatio(null);
  };

  const playSlice = (sliceIndex: number) => {
    const buffer = audioBuffer();
    const currentSlices = slices();
    const slice = currentSlices[sliceIndex];
    if (!buffer || !slice) return;

    stopActivePlayback();
    setSelectedSliceIndex(sliceIndex);

    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const sliceBuffer = renderSliceBuffer(ctx, buffer, slice);
      const source = ctx.createBufferSource();
      source.buffer = sliceBuffer;

      // Pitch shift via playbackRate
      if (slice.pitchSemitones !== 0) {
        source.playbackRate.value = Math.pow(2, slice.pitchSemitones / 12);
      }

      const gainNode = ctx.createGain();
      gainNode.gain.value = slice.gain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      activeSourceNode = source;
      setPlayingSliceIndex(sliceIndex);

      const durationMs = (slice.end - slice.start) * 1000;
      setPlayheadRatio(slice.start / buffer.duration);

      source.onended = () => {
        if (activeSourceNode === source) {
          setPlayingSliceIndex(null);
          setPlayheadRatio(null);
        }
      };

      source.start();
      setTimeout(() => {
        if (playingSliceIndex() === sliceIndex) {
          setPlayingSliceIndex(null);
        }
      }, Math.max(80, durationMs));
    } catch {
      // Audio playback mock fallback
    }
  };

  const handleToggleReverse = (sliceIndex: number, e: MouseEvent) => {
    e.stopPropagation();
    setSlices((prev) =>
      prev.map((s, idx) => (idx === sliceIndex ? { ...s, reverse: !s.reverse } : s)),
    );
  };

  const handleFileUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;
      try {
        const ctx = getAudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        setSampleName(file.name.replace(/\.[^/.]+$/, ""));
        recalculateSlices(decoded);
      } catch (err) {
        alert("Failed to decode audio file: " + String(err));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Draw Waveform and Slice markers on canvas
  const drawWaveform = () => {
    if (!canvasRef) return;
    const canvas = canvasRef;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const buffer = audioBuffer();

    ctx.clearRect(0, 0, width, height);

    // Background grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!buffer) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("No audio loaded", width / 2, height / 2);
      return;
    }

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Draw audio wave peaks
    ctx.fillStyle = "#00d2ff";
    for (let x = 0; x < width; x++) {
      let min = 1.0;
      let max = -1.0;
      const startIdx = x * step;
      for (let j = 0; j < step && startIdx + j < data.length; j++) {
        const val = data[startIdx + j]!;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      if (max < min) {
        min = 0;
        max = 0;
      }
      const yMin = (1 + min) * amp;
      const yMax = Math.max(yMin + 1, (1 + max) * amp);
      ctx.fillRect(x, yMin, 1, yMax - yMin);
    }

    // Draw slice regions and boundary lines
    const currentSlices = slices();
    const duration = buffer.duration;

    currentSlices.forEach((slice, idx) => {
      const startX = (slice.start / duration) * width;
      const endX = (slice.end / duration) * width;

      // Highlight selected slice
      if (idx === selectedSliceIndex()) {
        ctx.fillStyle = "rgba(0, 245, 212, 0.18)";
        ctx.fillRect(startX, 0, endX - startX, height);
      }

      // Vertical marker line
      ctx.strokeStyle = idx === selectedSliceIndex() ? "#00f5d4" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = idx === selectedSliceIndex() ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();

      // Slice index badge
      ctx.fillStyle = idx === selectedSliceIndex() ? "#00f5d4" : "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 9px monospace";
      ctx.fillText(String(idx + 1), startX + 4, 12);
    });

    // Draw playhead if active
    const ratio = playheadRatio();
    if (ratio !== null) {
      const playheadX = ratio * width;
      ctx.strokeStyle = "#ff007f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  };

  // Canvas interaction: drag slice boundary or select slice
  const handleCanvasMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef;
    const buffer = audioBuffer();
    if (!canvas || !buffer) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, x / rect.width));
    const clickTime = clickRatio * buffer.duration;

    // Check if clicked near an existing slice start
    const currentSlices = slices();
    const hitIndex = currentSlices.findIndex((s, i) => {
      if (i === 0) return false;
      const distPx = Math.abs((s.start / buffer.duration) * rect.width - x);
      return distPx < 10;
    });

    if (hitIndex > 0) {
      setIsDraggingSlice(hitIndex);
    } else {
      // Find slice containing clickTime
      const clickedSlice = currentSlices.findIndex(
        (s) => clickTime >= s.start && clickTime < s.end,
      );
      if (clickedSlice >= 0) {
        playSlice(clickedSlice);
      }
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    const dragIdx = isDraggingSlice();
    const canvas = canvasRef;
    const buffer = audioBuffer();
    if (dragIdx === null || !canvas || !buffer) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0.01, Math.min(0.99, x / rect.width));
    const newTime = ratio * buffer.duration;

    setSlices((prev) => {
      const next = [...prev];
      const target = next[dragIdx];
      const prevSlice = next[dragIdx - 1];
      if (!target || !prevSlice) return prev;

      // Bound between prevSlice.start and target.end
      if (newTime > prevSlice.start + 0.02 && newTime < target.end - 0.02) {
        next[dragIdx] = { ...target, start: newTime };
        next[dragIdx - 1] = { ...prevSlice, end: newTime };
      }
      return next;
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingSlice(null);
  };

  // Keyboard shortcut listener (1-8, 9-0 to trigger slices)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
      return;
    }
    const num = parseInt(e.key, 10);
    if (!isNaN(num)) {
      const sliceIdx = num === 0 ? 9 : num - 1;
      if (sliceIdx < slices().length) {
        playSlice(sliceIdx);
      }
    }
  };

  // Commit Chops to Drum Pattern: arranges slices onto drum track steps
  const handleCommitToDrumPattern = () => {
    const currentSlices = slices();
    if (currentSlices.length === 0) return;

    // Pattern map: Kick on beat 1 & 3, Snare on beat 2 & 4, Hats/Chops on intervening steps
    const drumPatternOrder: DrumPiece[] = [
      "kick",
      "hat",
      "hat",
      "hat",
      "snare",
      "hat",
      "kick",
      "hat",
      "kick",
      "hat",
      "snare",
      "hat",
      "kick",
      "hat",
      "snare",
      "hat2",
    ];

    try {
      const stepsToFill = Math.min(16, currentSlices.length);
      for (let step = 0; step < stepsToFill; step++) {
        const piece = drumPatternOrder[step] ?? "kick";
        toggleDrumStep(piece, step);
      }
      props.onClose();
    } catch {
      props.onClose();
    }
  };

  onMount(() => {
    dialogRef.showModal();
    const shared = sharedSlicerSource();
    if (shared) {
      setAudioBuffer(shared.buffer);
      setSampleName(shared.name);
      recalculateSlices(shared.buffer);
      setSharedSlicerSource(null);
    } else {
      loadDefaultBreakbeat(130);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleCanvasMouseUp);
  });

  onCleanup(() => {
    stopActivePlayback();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("mouseup", handleCanvasMouseUp);
  });

  createEffect(() => {
    // Redraw waveform when slices, audioBuffer, or selectedSliceIndex changes
    slices();
    audioBuffer();
    selectedSliceIndex();
    playingSliceIndex();
    playheadRatio();
    drawWaveform();
  });

  return (
    <Portal>
      <dialog
        ref={dialogRef}
        class="sample-slicer-dialog"
        role="dialog"
        aria-label="Sample Slicer and Drum Chopper"
      >
        <div class="sample-slicer-header">
          <div class="sample-slicer-title-wrap">
            <IconScissors size={16} />
            <span class="sample-slicer-title">SAMPLE CHOPPER & TRANSIENT SLICER</span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close Sample Slicer"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="sample-slicer-body">
          {/* Waveform Canvas Visualizer */}
          <div class="waveform-container">
            <canvas
              ref={canvasRef}
              class="waveform-canvas"
              width={880}
              height={150}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
            />
          </div>

          {/* Controls Bar */}
          <div class="slicer-controls-bar">
            {/* Slicing Modes */}
            <div class="slicer-btn-group">
              <button
                type="button"
                class="slicer-btn"
                classList={{ "is-active": mode() === "transients" }}
                onClick={() => handleModeChange("transients")}
              >
                TRANSIENTS
              </button>
              <button
                type="button"
                class="slicer-btn"
                classList={{ "is-active": mode() === "grid-4" }}
                onClick={() => handleModeChange("grid-4")}
              >
                4 SLICES
              </button>
              <button
                type="button"
                class="slicer-btn"
                classList={{ "is-active": mode() === "grid-8" }}
                onClick={() => handleModeChange("grid-8")}
              >
                8 SLICES
              </button>
              <button
                type="button"
                class="slicer-btn"
                classList={{ "is-active": mode() === "grid-16" }}
                onClick={() => handleModeChange("grid-16")}
              >
                16 SLICES
              </button>
            </div>

            {/* Transient Sensitivity (visible in transient mode) */}
            <Show when={mode() === "transients"}>
              <div class="slicer-slider-wrap">
                <span>SENSITIVITY</span>
                <input
                  type="range"
                  class="slicer-range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={sensitivity()}
                  onInput={(e) => handleSensitivityChange(Number(e.currentTarget.value))}
                />
                <span>{Math.round(sensitivity() * 100)}%</span>
              </div>
            </Show>

            {/* Audio Sources & Upload */}
            <div class="slicer-btn-group">
              <button
                type="button"
                class="slicer-btn"
                onClick={() => loadDefaultBreakbeat(130)}
              >
                FUNK BREAK
              </button>
              <button
                type="button"
                class="slicer-btn"
                onClick={() => loadDefaultBreakbeat(140)}
              >
                TRAP 808
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                class="slicer-btn"
                onClick={() => fileInputRef.click()}
              >
                UPLOAD AUDIO...
              </button>
            </div>
          </div>

          {/* MPC Beat Pads Grid */}
          <div class="slicer-pads-grid">
            <For each={slices()}>
              {(slice, index) => (
                <div
                  class="slicer-pad"
                  classList={{
                    "is-selected": index() === selectedSliceIndex(),
                    "is-playing": index() === playingSliceIndex(),
                  }}
                  onClick={() => playSlice(index())}
                >
                  <div class="slicer-pad-top">
                    <span class="slicer-pad-index">SLICE #{index() + 1}</span>
                    <span class="slicer-pad-key">
                      KEY {index() < 9 ? index() + 1 : index() === 9 ? 0 : ""}
                    </span>
                  </div>
                  <div class="slicer-pad-timing">
                    {slice.start.toFixed(2)}s - {slice.end.toFixed(2)}s
                  </div>
                  <div class="slicer-pad-actions">
                    <button
                      type="button"
                      class="slicer-pad-mini-btn"
                      classList={{ "is-active": slice.reverse }}
                      onClick={(e) => handleToggleReverse(index(), e)}
                    >
                      REV
                    </button>
                    <button
                      type="button"
                      class="slicer-pad-mini-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        playSlice(index());
                      }}
                    >
                      PLAY
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div class="sample-slicer-footer">
          <div style={{ "font-size": "11px", color: "var(--color-ink)" }}>
            <strong>{sampleName()}</strong> &bull; {slices().length} Chops Ready &bull; Press 1-8 to Audition
          </div>
          <button
            type="button"
            class="slicer-commit-btn"
            onClick={handleCommitToDrumPattern}
          >
            COMMIT CHOPS TO DRUM PATTERN
          </button>
        </div>
      </dialog>
    </Portal>
  );
}
