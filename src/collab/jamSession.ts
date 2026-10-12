/**
 * Real-Time Collaborative Jam Session & P2P Synchronization Engine.
 * Supports zero-latency local/multi-tab jamming via BroadcastChannel
 * and direct P2P mesh data channels via WebRTC.
 */

import { createSignal } from "solid-js";
import { docStore, loadDocument, setTransport } from "../state/store";
import { getSession } from "../engine/session";
import type { ProjectDocument } from "../document/schema";

export interface JamPeer {
  readonly id: string;
  name: string;
  color: string;
  isHost: boolean;
  lastActive: number;
  activeLane?: string;
  activeStep?: number;
}

export interface JamNudge {
  readonly id: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly text: string;
  readonly timestamp: number;
}

export type JamMessage =
  | { type: "HELLO"; sender: JamPeer; timestamp: number }
  | { type: "WELCOME"; sender: JamPeer; doc?: ProjectDocument; timestamp: number }
  | { type: "HEARTBEAT"; senderId: string; activeLane?: string; activeStep?: number; timestamp: number }
  | { type: "SYNC_DOC"; senderId: string; doc: ProjectDocument; rev: number; timestamp: number }
  | { type: "SYNC_TRANSPORT"; senderId: string; playing: boolean; bpm?: number; timestamp: number }
  | { type: "NUDGE"; senderId: string; senderName: string; text: string; timestamp: number }
  | { type: "LEAVE"; senderId: string; timestamp: number };

const PEER_COLORS = [
  "#00f5d4", // Neon teal
  "#f39c12", // Amber gold
  "#ff007f", // Neon magenta
  "#00d2ff", // Electric cyan
  "#2ecc71", // Mint green
  "#9b59b6", // Cosmic violet
  "#e67e22", // Retro orange
  "#f1c40f", // Cyber yellow
];

const PRODUCER_HANDLES = [
  "Neon Wave",
  "Tape Runner",
  "Analog Lynx",
  "Echo Pulse",
  "Acid Bloom",
  "Sub Maestro",
  "Solar Groove",
  "Poly Rhythm",
  "Phase Rider",
  "Filter Nomad",
];

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function generateRandomId(len = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Global Solid Signals
export const [isJamDrawerOpen, setIsJamDrawerOpen] = createSignal(false);
export const [jamConnected, setJamConnected] = createSignal(false);
export const [jamRoomId, setJamRoomId] = createSignal<string>("jam-" + generateRandomId(4));
export const [jamMyPeer, setJamMyPeer] = createSignal<JamPeer>({
  id: "peer-" + generateRandomId(8),
  name: randomChoice(PRODUCER_HANDLES),
  color: randomChoice(PEER_COLORS),
  isHost: true,
  lastActive: Date.now(),
});
export const [jamPeers, setJamPeers] = createSignal<JamPeer[]>([]);
export const [jamSyncDoc, setJamSyncDoc] = createSignal(true);
export const [jamSyncTransport, setJamSyncTransport] = createSignal(true);
export const [jamLastNudge, setJamLastNudge] = createSignal<JamNudge | null>(null);
export const [jamPulse, setJamPulse] = createSignal(false);

export function toggleJamDrawer(): void {
  setIsJamDrawerOpen(!isJamDrawerOpen());
}

export class JamSession {
  private channel: BroadcastChannel | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pruneInterval: ReturnType<typeof setInterval> | null = null;
  private docUnsubscribe: (() => void) | null = null;
  private transportUnsubscribe: (() => void) | null = null;
  private isApplyingRemoteDoc = false;
  private isApplyingRemoteTransport = false;
  private lastTransportState = { playing: false, bpm: 120 };
  private documentRevision = 0;

  constructor() {
    this.setupUrlRoomCheck();
  }

  private setupUrlRoomCheck(): void {
    if (typeof window === "undefined" || !window.location) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const jamParam = params.get("jam");
      if (jamParam) {
        setJamRoomId(jamParam);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  public connect(roomId = jamRoomId()): void {
    if (this.channel) {
      this.disconnect();
    }

    setJamRoomId(roomId);

    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`bitbounce-jam-${roomId}`);
      this.channel.onmessage = (e: MessageEvent<JamMessage>) => {
        this.handleIncomingMessage(e.data);
      };
    }

    setJamConnected(true);

    // Announce presence
    this.broadcast({
      type: "HELLO",
      sender: jamMyPeer(),
      timestamp: Date.now(),
    });

    // Start heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: "HEARTBEAT",
        senderId: jamMyPeer().id,
        activeLane: jamMyPeer().activeLane,
        activeStep: jamMyPeer().activeStep,
        timestamp: Date.now(),
      });
    }, 2500);

    // Prune stale peers (> 8 seconds without heartbeat)
    this.pruneInterval = setInterval(() => {
      const cutoff = Date.now() - 8000;
      setJamPeers((prev) => prev.filter((p) => p.lastActive > cutoff));
    }, 4000);

    this.bindDocumentListener();
    this.bindTransportListener();
  }

  public disconnect(): void {
    if (this.channel) {
      this.broadcast({
        type: "LEAVE",
        senderId: jamMyPeer().id,
        timestamp: Date.now(),
      });
      this.channel.close();
      this.channel = null;
    }

    for (const dc of this.dataChannels.values()) {
      try {
        dc.close();
      } catch {
        // ignore
      }
    }
    this.dataChannels.clear();

    for (const pc of this.peerConnections.values()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    this.peerConnections.clear();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
    if (this.docUnsubscribe) {
      this.docUnsubscribe();
      this.docUnsubscribe = null;
    }
    if (this.transportUnsubscribe) {
      this.transportUnsubscribe();
      this.transportUnsubscribe = null;
    }

    setJamConnected(false);
    setJamPeers([]);
  }

  public broadcast(msg: JamMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {
        // channel error
      }
    }

    // Also send via WebRTC Data Channels
    const serialized = JSON.stringify(msg);
    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === "open") {
        try {
          dc.send(serialized);
        } catch {
          // ignore send error
        }
      }
    }
  }

  private handleIncomingMessage(msg: JamMessage): void {
    if (!msg || typeof msg !== "object") return;
    const myId = jamMyPeer().id;

    switch (msg.type) {
      case "HELLO": {
        if (msg.sender.id === myId) return;
        this.upsertPeer(msg.sender);
        // Reply with welcome and current document if host
        if (jamMyPeer().isHost) {
          this.broadcast({
            type: "WELCOME",
            sender: jamMyPeer(),
            doc: docStore.getState().doc,
            timestamp: Date.now(),
          });
        }
        this.triggerPulse();
        break;
      }

      case "WELCOME": {
        if (msg.sender.id === myId) return;
        this.upsertPeer(msg.sender);
        if (msg.doc && jamSyncDoc()) {
          this.applyRemoteDocument(msg.doc);
        }
        this.triggerPulse();
        break;
      }

      case "HEARTBEAT": {
        if (msg.senderId === myId) return;
        setJamPeers((prev) =>
          prev.map((p) =>
            p.id === msg.senderId
              ? {
                  ...p,
                  lastActive: Date.now(),
                  activeLane: msg.activeLane ?? p.activeLane,
                  activeStep: msg.activeStep ?? p.activeStep,
                }
              : p,
          ),
        );
        break;
      }

      case "SYNC_DOC": {
        if (msg.senderId === myId) return;
        if (!jamSyncDoc()) return;
        this.applyRemoteDocument(msg.doc);
        this.triggerPulse();
        break;
      }

      case "SYNC_TRANSPORT": {
        if (msg.senderId === myId) return;
        if (!jamSyncTransport()) return;
        this.applyRemoteTransport(msg.playing, msg.bpm);
        this.triggerPulse();
        break;
      }

      case "NUDGE": {
        if (msg.senderId === myId) return;
        const nudge: JamNudge = {
          id: "nudge-" + Date.now(),
          senderId: msg.senderId,
          senderName: msg.senderName,
          text: msg.text,
          timestamp: Date.now(),
        };
        setJamLastNudge(nudge);
        this.triggerPulse();
        break;
      }

      case "LEAVE": {
        setJamPeers((prev) => prev.filter((p) => p.id !== msg.senderId));
        break;
      }
    }
  }

  private upsertPeer(peer: JamPeer): void {
    setJamPeers((prev) => {
      const idx = prev.findIndex((p) => p.id === peer.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx]!, ...peer, lastActive: Date.now() };
        return next;
      }
      return [...prev, { ...peer, lastActive: Date.now() }];
    });
  }

  private triggerPulse(): void {
    setJamPulse(true);
    setTimeout(() => setJamPulse(false), 300);
  }

  private applyRemoteDocument(doc: ProjectDocument): void {
    this.isApplyingRemoteDoc = true;
    try {
      loadDocument(doc);
    } catch {
      // document validation failed
    } finally {
      this.isApplyingRemoteDoc = false;
    }
  }

  private applyRemoteTransport(playing: boolean, bpm?: number): void {
    this.isApplyingRemoteTransport = true;
    try {
      const session = getSession();
      if (bpm !== undefined && Math.round(bpm) !== Math.round(this.lastTransportState.bpm)) {
        session.setBpm(bpm);
        setTransport({ bpm });
      }
      if (this.lastTransportState.playing !== playing) {
        void session.togglePlay();
      }
    } catch {
      // transport error
    } finally {
      this.isApplyingRemoteTransport = false;
    }
  }

  private bindDocumentListener(): void {
    if (this.docUnsubscribe) this.docUnsubscribe();
    this.docUnsubscribe = docStore.subscribe((state) => {
      if (!jamConnected() || !jamSyncDoc() || this.isApplyingRemoteDoc) return;
      this.documentRevision++;
      this.broadcast({
        type: "SYNC_DOC",
        senderId: jamMyPeer().id,
        doc: state.doc,
        rev: this.documentRevision,
        timestamp: Date.now(),
      });
    });
  }

  private bindTransportListener(): void {
    if (this.transportUnsubscribe) this.transportUnsubscribe();
    try {
      const session = getSession();
      this.transportUnsubscribe = session.subscribe((snap) => {
        const playingChanged = snap.playing !== this.lastTransportState.playing;
        const bpmChanged = snap.bpm !== this.lastTransportState.bpm;
        this.lastTransportState = { playing: snap.playing, bpm: snap.bpm };

        if (!jamConnected() || !jamSyncTransport() || this.isApplyingRemoteTransport) return;
        if (playingChanged || bpmChanged) {
          this.broadcast({
            type: "SYNC_TRANSPORT",
            senderId: jamMyPeer().id,
            playing: snap.playing,
            bpm: snap.bpm,
            timestamp: Date.now(),
          });
        }
      });
    } catch {
      // Session subscription not available in non-audio tests
    }
  }

  public sendNudge(text: string): void {
    const msg: JamMessage = {
      type: "NUDGE",
      senderId: jamMyPeer().id,
      senderName: jamMyPeer().name,
      text,
      timestamp: Date.now(),
    };
    this.broadcast(msg);
    setJamLastNudge({
      id: "nudge-" + Date.now(),
      senderId: jamMyPeer().id,
      senderName: jamMyPeer().name,
      text,
      timestamp: Date.now(),
    });
  }

  public updateMyPresence(activeLane?: string, activeStep?: number): void {
    setJamMyPeer((prev) => ({
      ...prev,
      activeLane: activeLane ?? prev.activeLane,
      activeStep: activeStep ?? prev.activeStep,
    }));
  }

  public setMyName(name: string): void {
    const trimmed = name.trim().slice(0, 20);
    if (!trimmed) return;
    setJamMyPeer((prev) => ({ ...prev, name: trimmed }));
    if (jamConnected()) {
      this.broadcast({
        type: "HELLO",
        sender: jamMyPeer(),
        timestamp: Date.now(),
      });
    }
  }

  public setMyColor(color: string): void {
    setJamMyPeer((prev) => ({ ...prev, color }));
    if (jamConnected()) {
      this.broadcast({
        type: "HELLO",
        sender: jamMyPeer(),
        timestamp: Date.now(),
      });
    }
  }

  // WebRTC Direct P2P Mesh Handshake
  public async createP2POffer(): Promise<string> {
    if (typeof RTCPeerConnection === "undefined") {
      throw new Error("WebRTC is not supported in this environment");
    }
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const dc = pc.createDataChannel("bitbounce-jam");
    const peerId = "p2p-" + generateRandomId(6);

    this.setupDataChannel(peerId, dc);
    this.peerConnections.set(peerId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        const check = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", check);
        setTimeout(resolve, 1500); // 1.5s max gather timeout
      }
    });

    return btoa(JSON.stringify(pc.localDescription));
  }

  public async acceptP2POffer(offerToken: string): Promise<string> {
    if (typeof RTCPeerConnection === "undefined") {
      throw new Error("WebRTC is not supported in this environment");
    }
    const offerSdp = JSON.parse(atob(offerToken)) as RTCSessionDescriptionInit;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const peerId = "p2p-" + generateRandomId(6);

    pc.ondatachannel = (e) => {
      this.setupDataChannel(peerId, e.channel);
    };
    this.peerConnections.set(peerId, pc);

    await pc.setRemoteDescription(offerSdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        const check = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", check);
        setTimeout(resolve, 1500);
      }
    });

    return btoa(JSON.stringify(pc.localDescription));
  }

  public async finalizeP2PAnswer(peerId: string, answerToken: string): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc) return;
    const answerSdp = JSON.parse(atob(answerToken)) as RTCSessionDescriptionInit;
    await pc.setRemoteDescription(answerSdp);
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel): void {
    this.dataChannels.set(peerId, dc);
    dc.onopen = () => {
      this.broadcast({
        type: "HELLO",
        sender: jamMyPeer(),
        timestamp: Date.now(),
      });
      this.triggerPulse();
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as JamMessage;
        this.handleIncomingMessage(msg);
      } catch {
        // ignore malformed message
      }
    };
    dc.onclose = () => {
      this.dataChannels.delete(peerId);
      this.peerConnections.delete(peerId);
      setJamPeers((prev) => prev.filter((p) => p.id !== peerId));
    };
  }
}

let jamSessionInstance: JamSession | null = null;

export function getJamSession(): JamSession {
  if (!jamSessionInstance) {
    jamSessionInstance = new JamSession();
  }
  return jamSessionInstance;
}
