/**
 * AudioRecorderModal — Live Microphone Recording & Vocal Quick-Sampler.
 * Captures live microphone audio, renders live input oscilloscope & VU meters,
 * provides silence trimming and peak normalization, and routes directly to the Slicer.
 */

import { createSignal, onMount, onCleanup, Show, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { getSession } from "../engine/session";
import { downloadSample } from "../audio/downloadSample";
import {
  recorderStatus,
  setRecorderStatus,
  recordedBuffer,
  setRecordedBuffer,
  recordedTakeName,
  setRecordedTakeName,
  liveInputLevel,
  setLiveInputLevel,
  normalizeBuffer,
  trimSilence,
  sendRecordingToSlicer,
  computeBufferPeak,
} from "../audio/audioRecorder";
import { IconMic, IconClose, IconScissors, IconPlay } from "./icons";
import "../styles/audio-recorder.css";

interface AudioRecorderModalProps {
  onClose: () => void;
}

export default function AudioRecorderModal(
  props: AudioRecorderModalProps,
): JSX.Element {
  let dialogRef!: HTMLDialogElement;
  let canvasRef!: HTMLCanvasElement;

  const [elapsedSeconds, setElapsedSeconds] = createSignal(0);
  const [isPlayingTake, setIsPlayingTake] = createSignal(false);

  // Audio streams & nodes
  let mediaStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let analyserNode: AnalyserNode | null = null;
  let animFrameId: number | null = null;
  let timerIntervalId: number | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let disposed = false;
  const [starting, setStarting] = createSignal(false);
  const [message, setMessage] = createSignal(
    "Press Record take to allow microphone access.",
  );
  let playbackSource: AudioBufferSourceNode | null = null;

  const formatTimer = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const getAudioContext = (): AudioContext => {
    if (!audioCtx) {
      audioCtx = getSession().engine.getContext() as AudioContext;
    }
    return audioCtx;
  };

  const startMicMonitoring = async () => {
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        setMessage(
          "Microphone recording is unavailable in this browser. You can import audio in Sample tools.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStream = stream;
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(mediaStream);
      analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 512;
      source.connect(analyserNode);

      drawOscilloscope();
    } catch {
      setMessage(
        "Microphone access failed. Allow microphone access in your browser and try again.",
      );
    }
  };

  const stopMicMonitoring = () => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    analyserNode = null;
  };

  const drawOscilloscope = () => {
    if (!canvasRef) return;
    const canvas = canvasRef;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const bufferLength = analyserNode?.frequencyBinCount ?? 256;
    const dataArray = new Uint8Array(bufferLength);
    const render = () => {
      animFrameId = requestAnimationFrame(render);
      if (!analyserNode) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      analyserNode.getByteTimeDomainData(dataArray);

      // Compute RMS level for VU meter
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i]! - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);
      setLiveInputLevel(Math.min(1.0, rms * 4));

      ctx.clearRect(0, 0, width, height);

      // Draw Waveform Oscilloscope Trace
      ctx.lineWidth = 2;
      ctx.strokeStyle =
        recorderStatus() === "recording" ? "#ff0055" : "#00f0ff";
      ctx.shadowBlur = 8;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i]! / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    render();
  };

  const handleToggleRecord = () => {
    if (recorderStatus() === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    if (starting() || disposed) return;
    setStarting(true);
    try {
      if (!mediaStream) await startMicMonitoring();
    } finally {
      setStarting(false);
    }
    if (!mediaStream || disposed) return;

    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";

    mediaRecorder = new MediaRecorder(
      mediaStream,
      mimeType ? { mimeType } : undefined,
    );
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (disposed) return;
      const blob = new Blob(recordedChunks, {
        type: mediaRecorder?.mimeType || "audio/webm",
      });
      const arrayBuffer = await blob.arrayBuffer();
      const ctx = getAudioContext();
      try {
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (disposed) return;
        setRecordedBuffer(decoded);
        setRecorderStatus("recorded");
      } catch {
        setRecorderStatus("idle");
      }
    };

    mediaRecorder.start(100);
    setRecorderStatus("recording");
    setElapsedSeconds(0);

    const startTime = Date.now();
    timerIntervalId = window.setInterval(() => {
      setElapsedSeconds((Date.now() - startTime) / 1000);
    }, 100);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
  };

  const handlePlayTake = () => {
    const buffer = recordedBuffer();
    if (!buffer) return;

    if (isPlayingTake()) {
      if (playbackSource) {
        try {
          playbackSource.stop();
        } catch {
          /* The source may have ended already. */
        }
      }
      setIsPlayingTake(false);
      return;
    }

    const ctx = getAudioContext();
    playbackSource = ctx.createBufferSource();
    playbackSource.buffer = buffer;
    playbackSource.connect(ctx.destination);
    playbackSource.onended = () => setIsPlayingTake(false);
    playbackSource.start(0);
    setIsPlayingTake(true);
  };

  const handleNormalize = () => {
    const buffer = recordedBuffer();
    if (!buffer) return;
    const normalized = normalizeBuffer(buffer, -0.5);
    setRecordedBuffer(normalized);
  };

  const handleTrimSilence = () => {
    const buffer = recordedBuffer();
    if (!buffer) return;
    const trimmed = trimSilence(buffer, -42);
    setRecordedBuffer(trimmed);
  };

  const handleSendToSlicer = () => {
    const buffer = recordedBuffer();
    if (!buffer) return;
    sendRecordingToSlicer(buffer, recordedTakeName());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    } else if (e.key === " " && e.target === document.body) {
      e.preventDefault();
      handleToggleRecord();
    }
  };

  onMount(() => {
    dialogRef.showModal();
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    disposed = true;
    if (mediaRecorder && mediaRecorder.state !== "inactive")
      mediaRecorder.stop();
    setRecorderStatus(recordedBuffer() ? "recorded" : "idle");
    stopMicMonitoring();
    if (timerIntervalId) clearInterval(timerIntervalId);
    if (playbackSource) {
      try {
        playbackSource.stop();
      } catch {
        /* The source may have ended already. */
      }
    }
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Portal>
      <dialog
        ref={(el) => {
          dialogRef = el;
        }}
        class="recorder-dialog"
        role="dialog"
        aria-label="Microphone Audio Recorder Studio"
      >
        <div class="recorder-header">
          <div class="recorder-title-wrap">
            <IconMic size={16} />
            <span class="recorder-title">LIVE MICROPHONE & VOCAL SAMPLER</span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close Recorder Studio"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="recorder-body">
          {/* Oscilloscope Stage */}
          <div class="recorder-stage">
            <canvas
              ref={(el) => {
                canvasRef = el;
              }}
              class="recorder-canvas"
              width="600"
              height="200"
            />
            <div class="recorder-badge">
              <div
                class="recorder-badge-dot"
                classList={{ "is-recording": recorderStatus() === "recording" }}
              />
              <span>{recorderStatus().toUpperCase()}</span>
            </div>
            <div class="recorder-timer">{formatTimer(elapsedSeconds())}</div>
          </div>

          {/* Live Input VU Meter Bar */}
          <div class="recorder-vu-wrap">
            <span>MIC LEVEL:</span>
            <div class="recorder-vu-track">
              <div
                class="recorder-vu-fill"
                style={{ width: `${Math.round(liveInputLevel() * 100)}%` }}
              />
            </div>
            <span style={{ "min-width": "36px", "text-align": "right" }}>
              {Math.round(liveInputLevel() * 100)}%
            </span>
          </div>

          {/* Record Control Button */}
          <div class="rec-trigger-wrap">
            <button
              type="button"
              class="rec-btn-big"
              classList={{ "is-recording": recorderStatus() === "recording" }}
              disabled={starting()}
              onClick={handleToggleRecord}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  "border-radius":
                    recorderStatus() === "recording" ? "2px" : "50%",
                  background: "#fff",
                }}
              />
              <span>
                {recorderStatus() === "recording"
                  ? "STOP RECORDING"
                  : "RECORD TAKE"}
              </span>
            </button>
          </div>

          <p role="status">{message()}</p>
          {/* Recorded Take Deck */}
          <Show when={recordedBuffer()}>
            <div class="recorder-actions-card">
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                }}
              >
                <span style={{ "font-size": "12px", "font-weight": "bold" }}>
                  TAKE: {recordedTakeName()} (
                  {recordedBuffer()!.duration.toFixed(2)}s, Peak:{" "}
                  {(
                    20 *
                    Math.log10(
                      Math.max(1e-4, computeBufferPeak(recordedBuffer()!)),
                    )
                  ).toFixed(1)}{" "}
                  dB)
                </span>
                <input
                  type="text"
                  class="name-input"
                  style={{ width: "160px", padding: "4px 8px" }}
                  aria-label="Take name"
                  value={recordedTakeName()}
                  onInput={(e) => setRecordedTakeName(e.currentTarget.value)}
                />
              </div>

              <div class="recorder-action-btns">
                <button
                  type="button"
                  class="recorder-action-btn"
                  onClick={() =>
                    downloadSample(recordedBuffer()!, recordedTakeName())
                  }
                >
                  EXPORT TAKE WAV
                </button>
                <button
                  type="button"
                  class="recorder-action-btn"
                  onClick={handlePlayTake}
                >
                  <IconPlay size={12} />
                  <span>{isPlayingTake() ? "STOP" : "AUDITION"}</span>
                </button>
                <button
                  type="button"
                  class="recorder-action-btn"
                  onClick={handleNormalize}
                >
                  NORMALIZE (-0.5 dB)
                </button>
                <button
                  type="button"
                  class="recorder-action-btn"
                  onClick={handleTrimSilence}
                >
                  TRIM SILENCE
                </button>
                <button
                  type="button"
                  class="recorder-action-btn recorder-primary-action"
                  onClick={handleSendToSlicer}
                >
                  <IconScissors size={12} />
                  <span>CHOP IN SAMPLE SLICER</span>
                </button>
              </div>
            </div>
          </Show>
        </div>
      </dialog>
    </Portal>
  );
}
