/**
 * MIDI Reactive State & Dispatcher for Bitbounce.
 * Connects WebMidiManager to the Solid reactive graph, Session live engine,
 * and the active grid selection/step recording.
 */

import { createSignal } from "solid-js";
import { getSession } from "../engine/session";
import {
  activeLane,
  focusedCell,
  focusCell,
  currentPatternFor,
} from "../state/selection";
import { addNote, toggleDrumStep } from "../state/store";
import {
  WebMidiManager,
  type WebMidiDevice,
  type WebMidiStatus,
  type MidiRoutingMode,
} from "./webMidi";
import { midiNoteToDrumPiece } from "./midiMapping";
import { effectiveScale, midiToDegree } from "../document/scales";
import { docStore } from "../state/store";
import { getPreset } from "../audio/presets";
import type { LaneId, PitchedLane } from "../document/schema";

const STORAGE_KEY_ROUTING = "bitbounce.midi.routing";
const STORAGE_KEY_QUANTIZE = "bitbounce.midi.quantize";
const STORAGE_KEY_STEP_RECORD = "bitbounce.midi.stepRecord";

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function saveStorage(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Storage unavailable
  }
}

const [midiStatus, setMidiStatus] = createSignal<WebMidiStatus>("idle");
const [midiDevices, setMidiDevices] = createSignal<readonly WebMidiDevice[]>([]);
const [midiSelectedDevice, setMidiSelectedDeviceSignal] = createSignal<string | "all">("all");
const [midiRoutingMode, setMidiRoutingModeSignal] = createSignal<MidiRoutingMode>(
  loadStorage<MidiRoutingMode>(STORAGE_KEY_ROUTING, "auto"),
);
const [midiScaleQuantize, setMidiScaleQuantizeSignal] = createSignal<boolean>(
  loadStorage<boolean>(STORAGE_KEY_QUANTIZE, true),
);
const [midiStepRecord, setMidiStepRecordSignal] = createSignal<boolean>(
  loadStorage<boolean>(STORAGE_KEY_STEP_RECORD, false),
);
const [midiActivityPulse, setMidiActivityPulse] = createSignal(false);
const [midiPopoverOpen, setMidiPopoverOpen] = createSignal(false);

let pulseTimeout: ReturnType<typeof setTimeout> | null = null;

function triggerActivityPulse(): void {
  setMidiActivityPulse(true);
  if (pulseTimeout) clearTimeout(pulseTimeout);
  pulseTimeout = setTimeout(() => {
    setMidiActivityPulse(false);
  }, 120);
}

const session = getSession();

export const midiManager = new WebMidiManager({
  getActiveLane: () => activeLane(),
  onStatusChange: (status) => setMidiStatus(status),
  onDevicesChange: (devices) => setMidiDevices(devices),
  onActivity: () => triggerActivityPulse(),
  onNoteOn: ({ laneId, note, velocity }) => {
    // 1. Live audition through audio engine
    void session.triggerMidiNote(laneId, note, velocity, {
      quantizeToScale: midiScaleQuantize(),
    });

    // 2. Step Recording if enabled
    if (midiStepRecord()) {
      handleStepRecord(laneId, note);
    }
  },
});

// Sync initial configuration to manager
midiManager.setRoutingMode(midiRoutingMode());
midiManager.setScaleQuantize(midiScaleQuantize());
midiManager.setStepRecord(midiStepRecord());

function handleStepRecord(laneId: LaneId, note: number): void {
  const current = focusedCell();
  const step = current && current.lane === laneId ? current.step : 0;
  const pattern = currentPatternFor(laneId);
  if (!pattern) return;

  if (laneId === "drums") {
    const piece = midiNoteToDrumPiece(note);
    toggleDrumStep(piece, step);
    // Advance focused cell to next step
    const nextStep = (step + 1) % 16;
    focusCell({ lane: "drums", row: piece, step: nextStep });
  } else {
    // Pitched lanes
    const doc = docStore.getState().doc;
    const scale = effectiveScale(doc, laneId);
    const laneObj = doc.lanes.find(
      (l): l is PitchedLane => l.id === laneId,
    );
    const preset = getPreset(laneObj?.presetId ?? "preset-bass-1");
    const octaveBase =
      (preset?.pitchRange?.octaveBase ?? 3) + (laneObj?.octave ?? 0);
    const { degree } = midiToDegree(scale, note, octaveBase);

    addNote(laneId as Exclude<LaneId, "drums">, pattern.id, {
      degree,
      start: step,
      length: 1,
    });
    // Advance focused cell to next step
    const nextStep = (step + 1) % 16;
    focusCell({ lane: laneId, row: degree, step: nextStep });
  }
}

export function setMidiRoutingMode(mode: MidiRoutingMode): void {
  setMidiRoutingModeSignal(mode);
  midiManager.setRoutingMode(mode);
  saveStorage(STORAGE_KEY_ROUTING, mode);
}

export function setMidiScaleQuantize(enabled: boolean): void {
  setMidiScaleQuantizeSignal(enabled);
  midiManager.setScaleQuantize(enabled);
  saveStorage(STORAGE_KEY_QUANTIZE, enabled);
}

export function setMidiStepRecord(enabled: boolean): void {
  setMidiStepRecordSignal(enabled);
  midiManager.setStepRecord(enabled);
  saveStorage(STORAGE_KEY_STEP_RECORD, enabled);
}

export function setMidiSelectedDevice(deviceId: string | "all"): void {
  setMidiSelectedDeviceSignal(deviceId);
  midiManager.setSelectedDeviceId(deviceId);
}

export async function connectMidi(): Promise<boolean> {
  return await midiManager.requestAccess();
}

export function disconnectMidi(): void {
  midiManager.disconnect();
}

export async function toggleMidiConnection(): Promise<void> {
  if (midiStatus() === "connected" || midiStatus() === "disconnected") {
    disconnectMidi();
  } else {
    await connectMidi();
  }
}

export {
  midiStatus,
  midiDevices,
  midiSelectedDevice,
  midiRoutingMode,
  midiScaleQuantize,
  midiStepRecord,
  midiActivityPulse,
  midiPopoverOpen,
  setMidiPopoverOpen,
};
