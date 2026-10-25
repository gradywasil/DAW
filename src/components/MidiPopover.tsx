/**
 * MidiPopover: Floating hardware control chassis for Web MIDI input.
 * Connects external MIDI keyboards and pad controllers, configures routing
 * (auto-follow vs channel split), scale quantization, and step recording.
 */

import { For, Show, onCleanup, onMount } from "solid-js";
import { registerHelp } from "../help/registry";
import {
  midiStatus,
  midiDevices,
  midiSelectedDevice,
  midiRoutingMode,
  midiScaleQuantize,
  midiStepRecord,
  setMidiSelectedDevice,
  setMidiRoutingMode,
  setMidiScaleQuantize,
  setMidiStepRecord,
  connectMidi,
  disconnectMidi,
} from "../midi/midiState";
import { IconMidi } from "./icons";
import "../styles/midi-popover.css";

registerHelp([
  {
    id: "midi.connect",
    title: "WEB MIDI",
    text: "Connect external USB or Bluetooth MIDI keyboards, drum pads, or synthesizers directly to Bitbounce.",
  },
  {
    id: "midi.routing",
    title: "ROUTING MODE",
    text: "Follow Active Lane plays whichever lane you have selected. Split Channels routes Ch 1 to Bass, Ch 2 to Chords, Ch 3 to Lead, and Ch 10 to Drums.",
  },
  {
    id: "midi.quantize",
    title: "SCALE QUANTIZATION",
    text: "Automatically snaps chromatic keys to the nearest note in the song's current scale so every note sounds in key.",
  },
  {
    id: "midi.stepRecord",
    title: "STEP RECORDING",
    text: "When enabled, pressing keys or striking pads adds notes into the active pattern and advances the step cursor automatically.",
  },
]);

export interface MidiPopoverProps {
  readonly onClose: () => void;
}

export default function MidiPopover(props: MidiPopoverProps) {
  onMount(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  const statusLabel = () => {
    switch (midiStatus()) {
      case "connected":
        return `${midiDevices().length} DEVICE${midiDevices().length === 1 ? "" : "S"}`;
      case "requesting":
        return "CONNECTING...";
      case "denied":
        return "PERMISSION DENIED";
      case "unsupported":
        return "UNSUPPORTED";
      case "error":
        return "ERROR";
      case "disconnected":
        return "NO DEVICES";
      default:
        return "OFFLINE";
    }
  };

  const ledClass = () => {
    switch (midiStatus()) {
      case "connected":
        return "is-connected";
      case "requesting":
        return "is-pending";
      case "denied":
      case "error":
        return "is-error";
      default:
        return "";
    }
  };

  return (
    <div
      class="midi-pop"
      role="dialog"
      aria-label="Web MIDI Controller Settings"
      data-help="midi.connect"
    >
      <div class="midi-pop-header">
        <div class="midi-pop-title-wrap">
          <IconMidi size={14} />
          <span class="midi-pop-title">MIDI INPUT</span>
        </div>
        <div class="midi-pop-status-badge">
          <span class={`midi-pop-led ${ledClass()}`} />
          <span>{statusLabel()}</span>
        </div>
      </div>

      <div class="midi-pop-devices">
        <span class="midi-pop-section-label">INPUT CONTROLLERS</span>
        <div
          class="midi-device-list"
          role="radiogroup"
          aria-label="MIDI Inputs"
        >
          <Show
            when={midiDevices().length > 0}
            fallback={
              <div class="midi-device-none">
                {midiStatus() === "connected" || midiStatus() === "disconnected"
                  ? "No hardware controllers detected. Connect a USB or Bluetooth MIDI device."
                  : midiStatus() === "unsupported"
                    ? "This browser does not support Web MIDI. You can still edit and play with the grid."
                    : "Click Connect to grant Web MIDI permission."}
              </div>
            }
          >
            <button
              type="button"
              class="midi-device-item"
              classList={{ "is-selected": midiSelectedDevice() === "all" }}
              onClick={() => setMidiSelectedDevice("all")}
            >
              <span>All Connected Devices (Omni)</span>
            </button>
            <For each={midiDevices()}>
              {(device) => (
                <button
                  type="button"
                  class="midi-device-item"
                  classList={{
                    "is-selected": midiSelectedDevice() === device.id,
                  }}
                  onClick={() => setMidiSelectedDevice(device.id)}
                >
                  <span>{device.name}</span>
                  <span class="midi-pop-section-label">
                    {device.manufacturer}
                  </span>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>

      <div class="midi-pop-toggles" data-help="midi.routing">
        <span class="midi-pop-section-label">ROUTING</span>
        <div class="midi-mode-buttons">
          <button
            type="button"
            class="midi-mode-btn"
            classList={{ "is-active": midiRoutingMode() === "auto" }}
            onClick={() => setMidiRoutingMode("auto")}
          >
            ACTIVE LANE
          </button>
          <button
            type="button"
            class="midi-mode-btn"
            classList={{ "is-active": midiRoutingMode() === "split" }}
            onClick={() => setMidiRoutingMode("split")}
          >
            CH 1-3 & 10 SPLIT
          </button>
        </div>
      </div>

      <div class="midi-pop-toggles">
        <label class="midi-toggle-row" data-help="midi.quantize">
          <span>Scale Quantize</span>
          <input
            type="checkbox"
            checked={midiScaleQuantize()}
            onChange={(e) => setMidiScaleQuantize(e.currentTarget.checked)}
          />
        </label>
        <label class="midi-toggle-row" data-help="midi.stepRecord">
          <span>Step Sequencer Record</span>
          <input
            type="checkbox"
            checked={midiStepRecord()}
            onChange={(e) => setMidiStepRecord(e.currentTarget.checked)}
          />
        </label>
      </div>

      <div class="midi-pop-actions">
        <Show
          when={midiStatus() === "connected" || midiStatus() === "disconnected"}
          fallback={
            <button
              type="button"
              class="midi-action-btn is-primary"
              disabled={
                midiStatus() === "unsupported" || midiStatus() === "requesting"
              }
              onClick={async () => {
                await connectMidi();
              }}
            >
              CONNECT
            </button>
          }
        >
          <button
            type="button"
            class="midi-action-btn"
            onClick={() => {
              disconnectMidi();
            }}
          >
            DISCONNECT
          </button>
        </Show>
        <button
          type="button"
          class="midi-action-btn"
          onClick={() => props.onClose()}
        >
          DONE
        </button>
      </div>
    </div>
  );
}
