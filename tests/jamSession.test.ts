import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  JamSession,
  jamConnected,
  jamRoomId,
  jamMyPeer,
  jamPeers,
  jamLastNudge,
  setJamSyncDoc,
  setJamSyncTransport,
  type JamPeer,
  type JamMessage,
} from "../src/collab/jamSession";
import { docStore } from "../src/state/store";
import { createDefaultProject } from "../src/document/schema";

describe("JamSession Collaborative P2P Engine", () => {
  let session: JamSession;

  beforeEach(() => {
    session = new JamSession();
    setJamSyncDoc(true);
    setJamSyncTransport(true);
  });

  afterEach(() => {
    session.disconnect();
  });

  it("initializes with a valid default room, producer profile, and color", () => {
    expect(jamRoomId()).toMatch(/^jam-/);
    const myPeer = jamMyPeer();
    expect(myPeer.id).toBeTruthy();
    expect(myPeer.name).toBeTruthy();
    expect(myPeer.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(myPeer.isHost).toBe(true);
  });

  it("updates user producer profile name and color", () => {
    session.setMyName("Cyber Beatmaker");
    expect(jamMyPeer().name).toBe("Cyber Beatmaker");

    session.setMyColor("#ff007f");
    expect(jamMyPeer().color).toBe("#ff007f");
  });

  it("connects to a room and updates connection status", () => {
    session.connect("jam-test-123");
    expect(jamConnected()).toBe(true);
    expect(jamRoomId()).toBe("jam-test-123");

    session.disconnect();
    expect(jamConnected()).toBe(false);
    expect(jamPeers().length).toBe(0);
  });

  it("handles incoming HELLO messages and registers remote peers", () => {
    session.connect("jam-sync-room");

    const remotePeer: JamPeer = {
      id: "peer-remote-999",
      name: "Modular Fox",
      color: "#00d2ff",
      isHost: false,
      lastActive: Date.now(),
    };

    // Simulate incoming HELLO
    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "HELLO",
      sender: remotePeer,
      timestamp: Date.now(),
    });

    const peers = jamPeers();
    expect(peers.length).toBe(1);
    expect(peers[0]!.id).toBe("peer-remote-999");
    expect(peers[0]!.name).toBe("Modular Fox");
    expect(peers[0]!.color).toBe("#00d2ff");
  });

  it("updates peer activity on HEARTBEAT and removes on LEAVE", () => {
    session.connect("jam-heartbeat-room");

    const remotePeer: JamPeer = {
      id: "peer-pulse-1",
      name: "Acid Walker",
      color: "#2ecc71",
      isHost: false,
      lastActive: Date.now(),
    };

    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "HELLO",
      sender: remotePeer,
      timestamp: Date.now(),
    });

    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "HEARTBEAT",
      senderId: "peer-pulse-1",
      activeLane: "bass",
      activeStep: 7,
      timestamp: Date.now(),
    });

    expect(jamPeers()[0]!.activeLane).toBe("bass");
    expect(jamPeers()[0]!.activeStep).toBe(7);

    // Simulate LEAVE
    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "LEAVE",
      senderId: "peer-pulse-1",
      timestamp: Date.now(),
    });

    expect(jamPeers().length).toBe(0);
  });

  it("receives and dispatches jam nudges and audio/visual pings", () => {
    session.connect("jam-nudge-room");

    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "NUDGE",
      senderId: "peer-hype-2",
      senderName: "Solar Beat",
      text: "🔥 DROP!",
      timestamp: Date.now(),
    });

    const lastNudge = jamLastNudge();
    expect(lastNudge).not.toBeNull();
    expect(lastNudge!.senderName).toBe("Solar Beat");
    expect(lastNudge!.text).toBe("🔥 DROP!");
  });

  it("synchronizes project document on SYNC_DOC when enabled", () => {
    session.connect("jam-doc-room");

    const testProject = createDefaultProject();
    testProject.name = "Collaborative Anthem";

    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "SYNC_DOC",
      senderId: "peer-sync-author",
      doc: testProject,
      rev: 1,
      timestamp: Date.now(),
    });

    expect(docStore.getState().doc.name).toBe("Collaborative Anthem");
  });

  it("ignores remote document changes when jamSyncDoc is disabled", () => {
    session.connect("jam-doc-ignore");
    setJamSyncDoc(false);

    const prevName = docStore.getState().doc.name;
    const testProject = createDefaultProject();
    testProject.name = "Ignored Remote Project";

    (
      session as unknown as { handleIncomingMessage(message: JamMessage): void }
    ).handleIncomingMessage({
      type: "SYNC_DOC",
      senderId: "peer-sync-author",
      doc: testProject,
      rev: 2,
      timestamp: Date.now(),
    });

    expect(docStore.getState().doc.name).toBe(prevName);
  });
});
