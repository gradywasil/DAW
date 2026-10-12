import { describe, expect, it, vi } from "vitest";
import {
  WebMidiManager,
  type MidiAccessLike,
  type MidiPortLike,
} from "../src/midi/webMidi";

class MockMidiPort implements MidiPortLike {
  onmidimessage?: ((event: { data: Uint8Array }) => void) | null = null;
  constructor(
    public id: string,
    public name: string,
    public manufacturer: string,
    public state: "connected" | "disconnected" = "connected",
  ) {}

  simulateMessage(bytes: number[]): void {
    this.onmidimessage?.({ data: new Uint8Array(bytes) });
  }
}

class MockMidiAccess implements MidiAccessLike {
  public portMap = new Map<string, MockMidiPort>();
  onstatechange?: ((event: unknown) => void) | null = null;

  get inputs() {
    return {
      values: () => this.portMap.values(),
      forEach: (cb: (port: MidiPortLike) => void) => {
        for (const port of this.portMap.values()) {
          cb(port);
        }
      },
    };
  }

  addPort(port: MockMidiPort): void {
    this.portMap.set(port.id, port);
    this.onstatechange?.({ port });
  }

  removePort(id: string): void {
    const port = this.portMap.get(id);
    if (port) {
      port.state = "disconnected";
      this.onstatechange?.({ port });
    }
  }
}

describe("WebMidiManager", () => {
  it("initializes with idle status when factory is provided", () => {
    const manager = new WebMidiManager({
      factory: () => Promise.resolve(new MockMidiAccess()),
    });
    expect(manager.getStatus()).toBe("idle");
    expect(manager.getDevices()).toEqual([]);
  });

  it("handles access grant, enumerates devices, and connects", async () => {
    const mockAccess = new MockMidiAccess();
    const port1 = new MockMidiPort("in-1", "Akai MPK Mini", "Akai");
    mockAccess.addPort(port1);

    const onStatusChange = vi.fn();
    const onDevicesChange = vi.fn();

    const manager = new WebMidiManager({
      factory: () => Promise.resolve(mockAccess),
      onStatusChange,
      onDevicesChange,
    });

    const success = await manager.requestAccess();
    expect(success).toBe(true);
    expect(manager.getStatus()).toBe("connected");
    expect(manager.getDevices()).toHaveLength(1);
    expect(manager.getDevices()[0].name).toBe("Akai MPK Mini");
    expect(onStatusChange).toHaveBeenCalledWith("requesting");
    expect(onStatusChange).toHaveBeenCalledWith("connected");
  });

  it("handles permission denial gracefully", async () => {
    const onStatusChange = vi.fn();
    const manager = new WebMidiManager({
      factory: () => Promise.reject(new Error("SecurityError: Permission denied")),
      onStatusChange,
    });

    const success = await manager.requestAccess();
    expect(success).toBe(false);
    expect(manager.getStatus()).toBe("denied");
  });

  it("supports dynamic hotplugging of new devices", async () => {
    const mockAccess = new MockMidiAccess();
    const manager = new WebMidiManager({
      factory: () => Promise.resolve(mockAccess),
    });

    await manager.requestAccess();
    expect(manager.getDevices()).toHaveLength(0);

    const port = new MockMidiPort("pad-1", "Novation Launchkey", "Novation");
    mockAccess.addPort(port);

    expect(manager.getDevices()).toHaveLength(1);
    expect(manager.getDevices()[0].name).toBe("Novation Launchkey");
  });

  it("routes notes in auto mode (omni follows activeLane, ch 9 goes to drums)", async () => {
    const mockAccess = new MockMidiAccess();
    const port = new MockMidiPort("key-1", "Arturia Keystep", "Arturia");
    mockAccess.addPort(port);

    const onNoteOn = vi.fn();
    const onActivity = vi.fn();
    let currentActiveLane: "bass" | "lead" | "drums" = "bass";

    const manager = new WebMidiManager({
      factory: () => Promise.resolve(mockAccess),
      getActiveLane: () => currentActiveLane,
      onNoteOn,
      onActivity,
    });

    await manager.requestAccess();

    // Note on channel 0 (Ch 1) -> routes to active lane 'bass'
    port.simulateMessage([0x90, 48, 110]);
    expect(onNoteOn).toHaveBeenCalledWith({
      laneId: "bass",
      note: 48,
      velocity: 110,
      channel: 0,
      deviceId: "key-1",
    });
    expect(onActivity).toHaveBeenCalled();

    // Switch active lane to 'lead'
    currentActiveLane = "lead";
    port.simulateMessage([0x90, 72, 95]);
    expect(onNoteOn).toHaveBeenCalledWith({
      laneId: "lead",
      note: 72,
      velocity: 95,
      channel: 0,
      deviceId: "key-1",
    });

    // Note on channel 9 (GM Drums, 0x99) -> routes to 'drums' regardless of active lane
    port.simulateMessage([0x99, 36, 127]);
    expect(onNoteOn).toHaveBeenCalledWith({
      laneId: "drums",
      note: 36,
      velocity: 127,
      channel: 9,
      deviceId: "key-1",
    });
  });

  it("routes notes in split channel mode", async () => {
    const mockAccess = new MockMidiAccess();
    const port = new MockMidiPort("key-1", "Master Keyboard", "Roland");
    mockAccess.addPort(port);

    const onNoteOn = vi.fn();
    const manager = new WebMidiManager({
      factory: () => Promise.resolve(mockAccess),
      getActiveLane: () => "lead",
      onNoteOn,
    });

    await manager.requestAccess();
    manager.setRoutingMode("split");

    // Ch 0 -> bass
    port.simulateMessage([0x90, 36, 100]);
    expect(onNoteOn).toHaveBeenLastCalledWith(
      expect.objectContaining({ laneId: "bass", note: 36 }),
    );

    // Ch 1 -> chords
    port.simulateMessage([0x91, 60, 100]);
    expect(onNoteOn).toHaveBeenLastCalledWith(
      expect.objectContaining({ laneId: "chords", note: 60 }),
    );

    // Ch 2 -> lead
    port.simulateMessage([0x92, 72, 100]);
    expect(onNoteOn).toHaveBeenLastCalledWith(
      expect.objectContaining({ laneId: "lead", note: 72 }),
    );

    // Ch 9 -> drums
    port.simulateMessage([0x99, 38, 100]);
    expect(onNoteOn).toHaveBeenLastCalledWith(
      expect.objectContaining({ laneId: "drums", note: 38 }),
    );
  });

  it("filters messages when a specific device is selected", async () => {
    const mockAccess = new MockMidiAccess();
    const port1 = new MockMidiPort("dev-1", "Keyboard 1", "Brand A");
    const port2 = new MockMidiPort("dev-2", "Keyboard 2", "Brand B");
    mockAccess.addPort(port1);
    mockAccess.addPort(port2);

    const onNoteOn = vi.fn();
    const manager = new WebMidiManager({
      factory: () => Promise.resolve(mockAccess),
      getActiveLane: () => "lead",
      onNoteOn,
    });

    await manager.requestAccess();
    manager.setSelectedDeviceId("dev-1");

    // dev-1 message accepted
    port1.simulateMessage([0x90, 60, 100]);
    expect(onNoteOn).toHaveBeenCalledTimes(1);

    // dev-2 message ignored
    port2.simulateMessage([0x90, 60, 100]);
    expect(onNoteOn).toHaveBeenCalledTimes(1);
  });

  it("disconnect unbinds listeners and resets devices", async () => {
    const mockAccess = new MockMidiAccess();
    const port = new MockMidiPort("dev-1", "Keyboard", "Brand");
    mockAccess.addPort(port);

    const manager = new WebMidiManager({
      factory: () => Promise.resolve(mockAccess),
    });

    await manager.requestAccess();
    expect(manager.getDevices()).toHaveLength(1);
    expect(port.onmidimessage).not.toBeNull();

    manager.disconnect();
    expect(manager.getStatus()).toBe("idle");
    expect(manager.getDevices()).toHaveLength(0);
    expect(port.onmidimessage).toBeNull();
  });
});
