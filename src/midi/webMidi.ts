/**
 * Web MIDI API Manager for Bitbounce.
 * Connects external MIDI keyboards, pad controllers, and hardware synthesizers.
 * Supports hotplugging, omni / single-port filtering, velocity scaling,
 * scale quantization, and step recording into the active grid.
 *
 * Implements seam injection (MidiAccessFactory) so the entire manager
 * lifecycle and message handling are 100% unit-testable without real hardware.
 */

import type { LaneId } from "../document/schema";
import { parseMidiBytes, type ParsedMidiMessage } from "./midiMapping";

export type WebMidiStatus =
  | "unsupported"
  | "idle"
  | "requesting"
  | "connected"
  | "disconnected"
  | "denied"
  | "error";

export type MidiRoutingMode = "auto" | "split";

export interface WebMidiDevice {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly state: "connected" | "disconnected";
}

export interface MidiMessageEventLike {
  readonly data: Uint8Array;
  readonly timeStamp?: number;
}

export interface MidiPortLike {
  readonly id: string;
  readonly name?: string | null;
  readonly manufacturer?: string | null;
  readonly state?: "connected" | "disconnected" | string;
  onmidimessage?: ((event: MidiMessageEventLike) => void) | null;
}

export interface MidiAccessLike {
  readonly inputs: {
    values(): IterableIterator<MidiPortLike>;
    forEach(callback: (port: MidiPortLike) => void): void;
  };
  onstatechange?: ((event: unknown) => void) | null;
}

export type MidiAccessFactory = (options?: {
  sysex?: boolean;
}) => Promise<MidiAccessLike>;

export const defaultMidiAccessFactory: MidiAccessFactory = (options) => {
  if (
    typeof navigator === "undefined" ||
    typeof (navigator as unknown as { requestMIDIAccess?: unknown })
      .requestMIDIAccess !== "function"
  ) {
    return Promise.reject(
      new Error("Web MIDI API is not supported in this browser."),
    );
  }
  return (
    navigator as unknown as {
      requestMIDIAccess: (opts?: unknown) => Promise<MidiAccessLike>;
    }
  ).requestMIDIAccess(options);
};

export interface WebMidiManagerOptions {
  readonly factory?: MidiAccessFactory;
  readonly onStatusChange?: (status: WebMidiStatus) => void;
  readonly onDevicesChange?: (devices: readonly WebMidiDevice[]) => void;
  readonly onNoteOn?: (
    event: {
      laneId: LaneId;
      note: number;
      velocity: number;
      channel: number;
      deviceId: string;
    },
  ) => void;
  readonly onNoteOff?: (
    event: {
      laneId: LaneId;
      note: number;
      velocity: number;
      channel: number;
      deviceId: string;
    },
  ) => void;
  readonly onActivity?: () => void;
  /** Active lane provider to route omni notes to the focused instrument. */
  readonly getActiveLane?: () => LaneId;
}

export class WebMidiManager {
  private status: WebMidiStatus = "idle";
  private access: MidiAccessLike | null = null;
  private devices: WebMidiDevice[] = [];
  private selectedDeviceId: string | "all" = "all";
  private routingMode: MidiRoutingMode = "auto";
  private scaleQuantize = true;
  private stepRecord = false;
  private boundPorts = new Set<string>();

  constructor(private readonly options: WebMidiManagerOptions = {}) {
    if (
      typeof navigator !== "undefined" &&
      typeof (navigator as unknown as { requestMIDIAccess?: unknown })
        .requestMIDIAccess !== "function" &&
      !options.factory
    ) {
      this.status = "unsupported";
    }
  }

  getStatus(): WebMidiStatus {
    return this.status;
  }

  getDevices(): readonly WebMidiDevice[] {
    return this.devices;
  }

  getSelectedDeviceId(): string | "all" {
    return this.selectedDeviceId;
  }

  setSelectedDeviceId(id: string | "all"): void {
    this.selectedDeviceId = id;
  }

  getRoutingMode(): MidiRoutingMode {
    return this.routingMode;
  }

  setRoutingMode(mode: MidiRoutingMode): void {
    this.routingMode = mode;
  }

  isScaleQuantize(): boolean {
    return this.scaleQuantize;
  }

  setScaleQuantize(enabled: boolean): void {
    this.scaleQuantize = enabled;
  }

  isStepRecord(): boolean {
    return this.stepRecord;
  }

  setStepRecord(enabled: boolean): void {
    this.stepRecord = enabled;
  }

  /**
   * Request MIDI access via the Web MIDI API.
   * Prompts the browser for permission if required, enumerates ports,
   * and attaches message listeners to all available input devices.
   */
  async requestAccess(): Promise<boolean> {
    const factory = this.options.factory ?? defaultMidiAccessFactory;
    this.setStatus("requesting");

    try {
      const access = await factory({ sysex: false });
      this.access = access;
      this.syncDevices();

      access.onstatechange = () => {
        this.syncDevices();
      };

      const hasDevices = this.devices.some((d) => d.state === "connected");
      this.setStatus(hasDevices ? "connected" : "disconnected");
      return true;
    } catch (err) {
      const errorMsg = String(err);
      if (
        errorMsg.toLowerCase().includes("denied") ||
        errorMsg.toLowerCase().includes("security")
      ) {
        this.setStatus("denied");
      } else if (errorMsg.toLowerCase().includes("not supported")) {
        this.setStatus("unsupported");
      } else {
        this.setStatus("error");
      }
      return false;
    }
  }

  /**
   * Disconnect and release all MIDI device event listeners.
   */
  disconnect(): void {
    if (this.access) {
      this.access.onstatechange = null;
      this.access.inputs.forEach((port) => {
        port.onmidimessage = null;
      });
      this.access = null;
    }
    this.boundPorts.clear();
    this.devices = [];
    this.setStatus("idle");
    this.options.onDevicesChange?.(this.devices);
  }

  /**
   * Refresh device list from the MIDIAccess port map and bind listeners.
   */
  private syncDevices(): void {
    if (!this.access) return;

    const list: WebMidiDevice[] = [];
    this.access.inputs.forEach((port) => {
      const device: WebMidiDevice = {
        id: port.id,
        name: port.name ?? `MIDI Device ${port.id}`,
        manufacturer: port.manufacturer ?? "Generic",
        state: port.state === "disconnected" ? "disconnected" : "connected",
      };
      list.push(device);

      // Attach listener if not already attached
      if (!this.boundPorts.has(port.id)) {
        port.onmidimessage = (event: MidiMessageEventLike) => {
          this.handleMidiMessage(event.data, port.id);
        };
        this.boundPorts.add(port.id);
      }
    });

    this.devices = list;
    this.options.onDevicesChange?.(this.devices);

    const hasConnected = this.devices.some((d) => d.state === "connected");
    if (this.status === "connected" || this.status === "disconnected") {
      this.setStatus(hasConnected ? "connected" : "disconnected");
    }
  }

  /**
   * Process incoming raw MIDI wire bytes from a device.
   */
  handleMidiMessage(data: Uint8Array, deviceId = "default"): void {
    if (
      this.selectedDeviceId !== "all" &&
      this.selectedDeviceId !== deviceId
    ) {
      return;
    }

    const parsed = parseMidiBytes(data);
    if (!parsed) return;

    this.options.onActivity?.();

    if (parsed.command === "note-on" && parsed.note !== undefined) {
      const laneId = this.resolveLaneForMessage(parsed);
      this.options.onNoteOn?.({
        laneId,
        note: parsed.note,
        velocity: parsed.velocity ?? 100,
        channel: parsed.channel,
        deviceId,
      });
    } else if (parsed.command === "note-off" && parsed.note !== undefined) {
      const laneId = this.resolveLaneForMessage(parsed);
      this.options.onNoteOff?.({
        laneId,
        note: parsed.note,
        velocity: parsed.velocity ?? 0,
        channel: parsed.channel,
        deviceId,
      });
    }
  }

  /**
   * Resolve target lane for an incoming message based on routing mode.
   */
  private resolveLaneForMessage(msg: ParsedMidiMessage): LaneId {
    const activeLane = this.options.getActiveLane?.() ?? "drums";

    if (this.routingMode === "auto") {
      // GM Drum channel (wire index 9) always routes to drums; other channels follow active lane
      if (msg.channel === 9) return "drums";
      return activeLane;
    }

    // Split channel routing:
    // Ch 1 (0): bass, Ch 2 (1): chords, Ch 3 (2): lead, Ch 10 (9): drums
    // Extra channels (3..6): extra1..extra4
    switch (msg.channel) {
      case 9:
        return "drums";
      case 0:
        return "bass";
      case 1:
        return "chords";
      case 2:
        return "lead";
      case 3:
        return "extra1";
      case 4:
        return "extra2";
      case 5:
        return "extra3";
      case 6:
        return "extra4";
      default:
        return activeLane;
    }
  }

  private setStatus(status: WebMidiStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatusChange?.(status);
  }
}
