/**
 * Jam Drawer Component — Real-Time Collaborative Jamming & Ensemble Controls.
 */

import { Show, For, createSignal, onCleanup } from "solid-js";
import {
  getJamSession,
  jamConnected,
  jamRoomId,
  jamMyPeer,
  jamPeers,
  jamSyncDoc,
  setJamSyncDoc,
  jamSyncTransport,
  setJamSyncTransport,
  jamLastNudge,
} from "../collab/jamSession";
import { IconJam, IconUsers, IconClose } from "./icons";
import "../styles/jam-drawer.css";

const PEER_COLORS = [
  "#00f5d4",
  "#f39c12",
  "#ff007f",
  "#00d2ff",
  "#2ecc71",
  "#9b59b6",
  "#e67e22",
  "#f1c40f",
];

const QUICK_REACTIONS = [
  { emoji: "🔥", text: "DROP" },
  { emoji: "🥁", text: "FILL" },
  { emoji: "✨", text: "SOLO" },
  { emoji: "👂", text: "LISTEN" },
  { emoji: "👏", text: "HYPE" },
];

export interface JamDrawerProps {
  onClose: () => void;
}

export default function JamDrawer(props: JamDrawerProps) {
  const session = getJamSession();
  const [copied, setCopied] = createSignal(false);
  const [editingRoom, setEditingRoom] = createSignal(false);
  const [roomInput, setRoomInput] = createSignal(jamRoomId());
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));

  const handleCopyLink = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}?jam=${jamRoomId()}`
        : `?jam=${jamRoomId()}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => setCopied(false), 1800);
  };

  const handleRoomSwitch = (e: Event) => {
    e.preventDefault();
    const clean = roomInput()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (clean) {
      session.connect(clean);
      setEditingRoom(false);
    }
  };

  return (
    <div class="jam-pop" role="dialog" aria-label="Collaborative Jam Session">
      <div class="jam-pop-header">
        <div class="jam-pop-title-wrap">
          <IconJam size={14} />
          <span class="jam-pop-title">LOCAL TAB JAM</span>
          <span class="jam-badge" classList={{ "is-online": jamConnected() }}>
            {jamConnected() ? "LIVE" : "OFFLINE"}
          </span>
        </div>
        <button
          type="button"
          class="jam-pop-close"
          aria-label="Close Jam Drawer"
          onClick={props.onClose}
        >
          <IconClose size={12} />
        </button>
      </div>

      <p>
        Sync edits and transport between tabs in this browser profile. Room
        links do not connect different devices.
      </p>
      <button
        type="button"
        class="jam-btn-small"
        onClick={() =>
          jamConnected() ? session.disconnect() : session.connect()
        }
      >
        {jamConnected() ? "Leave session" : "Join local session"}
      </button>
      {/* Room Identifier & Sharing */}
      <div class="jam-room-bar">
        <Show
          when={editingRoom()}
          fallback={
            <>
              <span class="jam-room-code">{jamRoomId()}</span>
              <button
                type="button"
                class="jam-btn-small"
                classList={{ "is-copied": copied() }}
                onClick={handleCopyLink}
              >
                {copied() ? "COPIED!" : "COPY LINK"}
              </button>
              <button
                type="button"
                class="jam-btn-small"
                onClick={() => setEditingRoom(true)}
              >
                CHANGE
              </button>
            </>
          }
        >
          <form
            onSubmit={handleRoomSwitch}
            style={{ display: "flex", gap: "4px", width: "100%" }}
          >
            <input
              type="text"
              class="jam-self-name-input"
              style={{ flex: "1" }}
              value={roomInput()}
              onInput={(e) => setRoomInput(e.currentTarget.value)}
              placeholder="room-code"
              autofocus
            />
            <button type="submit" class="jam-btn-small">
              JOIN
            </button>
            <button
              type="button"
              class="jam-btn-small"
              onClick={() => setEditingRoom(false)}
            >
              CANCEL
            </button>
          </form>
        </Show>
      </div>

      {/* Glowing Nudge Announcement */}
      <Show when={jamLastNudge()}>
        {(nudge) => (
          <div class="jam-nudge-toast">
            <span>📢</span>
            <strong>{nudge().senderName}:</strong>
            <span>{nudge().text}</span>
          </div>
        )}
      </Show>

      {/* Connected Peers List */}
      <div>
        <div
          class="jam-section-label"
          style={{ display: "flex", "align-items": "center", gap: "4px" }}
        >
          <IconUsers size={12} />
          <span>PEERS IN SESSION ({jamPeers().length + 1})</span>
        </div>
        <div class="jam-peers-list">
          {/* Self */}
          <div class="jam-peer-row">
            <div class="jam-peer-info">
              <span
                class="jam-peer-dot"
                style={{ "background-color": jamMyPeer().color }}
              />
              <span class="jam-peer-name">{jamMyPeer().name} (You)</span>
            </div>
            <span class="jam-peer-tag">HOST</span>
          </div>

          {/* Remote peers */}
          <For
            each={jamPeers()}
            fallback={
              <div
                style={{
                  "font-size": "10px",
                  opacity: 0.6,
                  padding: "4px 8px",
                  "text-align": "center",
                }}
              >
                No other peers connected yet. Open another tab or share your
                link!
              </div>
            }
          >
            {(peer) => (
              <div class="jam-peer-row">
                <div class="jam-peer-info">
                  <span
                    class="jam-peer-dot"
                    style={{ "background-color": peer.color }}
                  />
                  <span class="jam-peer-name">{peer.name}</span>
                </div>
                <span class="jam-peer-tag">
                  {peer.activeLane ? `Editing ${peer.activeLane}` : "Listening"}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Your Producer Profile */}
      <div class="jam-self-editor">
        <div class="jam-section-label">YOUR PROFILE</div>
        <input
          type="text"
          class="jam-self-name-input"
          value={jamMyPeer().name}
          onInput={(e) => session.setMyName(e.currentTarget.value)}
          placeholder="Producer Name"
          maxLength={20}
        />
        <div class="jam-color-palette">
          <For each={PEER_COLORS}>
            {(col) => (
              <button
                type="button"
                class="jam-color-btn"
                classList={{ "is-active": jamMyPeer().color === col }}
                style={{ "background-color": col }}
                aria-label={`Color ${col}`}
                onClick={() => session.setMyColor(col)}
              />
            )}
          </For>
        </div>
      </div>

      {/* Real-time Sync Controls */}
      <div>
        <div class="jam-section-label">SYNC SETTINGS</div>
        <div class="jam-sync-toggles">
          <label class="jam-toggle-row">
            <span>Sync Project Edits (Notes, Mix, Scales)</span>
            <input
              type="checkbox"
              checked={jamSyncDoc()}
              onChange={(e) => setJamSyncDoc(e.currentTarget.checked)}
            />
          </label>
          <label class="jam-toggle-row">
            <span>Sync Transport (Play / Stop)</span>
            <input
              type="checkbox"
              checked={jamSyncTransport()}
              onChange={(e) => setJamSyncTransport(e.currentTarget.checked)}
            />
          </label>
        </div>
      </div>

      {/* Quick Audio/Visual Nudge Reactions */}
      <div>
        <div class="jam-section-label">LIVE JAM PINGS</div>
        <div class="jam-reaction-cluster">
          <For each={QUICK_REACTIONS}>
            {(item) => (
              <button
                type="button"
                class="jam-reaction-btn"
                onClick={() => session.sendNudge(`${item.emoji} ${item.text}!`)}
              >
                <span>{item.emoji}</span>
                <span>{item.text}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
