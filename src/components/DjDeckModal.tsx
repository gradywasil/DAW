/**
 * DjDeckModal — Fullscreen Performance DJ Deck & Dual-Platter Studio.
 * Dual spinning vinyl platters, 3-band isolator EQ with instant frequency kills,
 * central crossfader with curve selector, slip loop rolls, and vinyl brake.
 */

import { createSignal, onMount, onCleanup, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { getSession } from "../engine/session";
import { docStore } from "../state/store";
import {
  djDeckState,
  setDjDeckState,
  calculateCrossfaderGains,
  type LoopRollSize,
  type CrossfaderCurve,
} from "../audio/djDeck";
import { IconDjDeck, IconClose } from "./icons";
import "../styles/dj-deck.css";

interface DjDeckModalProps {
  onClose: () => void;
}

export default function DjDeckModal(props: DjDeckModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;

  const session = getSession();
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [crossfader, setCrossfader] = createSignal(djDeckState().crossfader);
  const [curve, setCurve] = createSignal<CrossfaderCurve>(
    djDeckState().crossfaderCurve,
  );

  // Deck A EQ
  const [lowA, setLowA] = createSignal(djDeckState().deckA.lowGainDb);
  const [midA, setMidA] = createSignal(djDeckState().deckA.midGainDb);
  const [highA, setHighA] = createSignal(djDeckState().deckA.highGainDb);
  const [lowKillA, setLowKillA] = createSignal(djDeckState().deckA.lowKill);
  const [midKillA, setMidKillA] = createSignal(djDeckState().deckA.midKill);
  const [highKillA, setHighKillA] = createSignal(djDeckState().deckA.highKill);

  // Deck B EQ
  const [lowB, setLowB] = createSignal(djDeckState().deckB.lowGainDb);
  const [midB, setMidB] = createSignal(djDeckState().deckB.midGainDb);
  const [highB, setHighB] = createSignal(djDeckState().deckB.highGainDb);
  const [lowKillB, setLowKillB] = createSignal(djDeckState().deckB.lowKill);
  const [midKillB, setMidKillB] = createSignal(djDeckState().deckB.midKill);
  const [highKillB, setHighKillB] = createSignal(djDeckState().deckB.highKill);

  // Center Controls
  const [activeLoopRoll, setActiveLoopRoll] = createSignal<LoopRollSize>(null);
  const [isBraking, setIsBraking] = createSignal(false);
  const [nudge, setNudge] = createSignal(0);

  const doc = docStore.getState().doc;

  onMount(() => {
    dialogRef.showModal();

    const unsubscribe = session.subscribe((snap: { playing: boolean }) => {
      setIsPlaying(snap.playing);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      if (e.code === "Space" && e.target === dialogRef) {
        e.preventDefault();
        void session.togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const gains = () => calculateCrossfaderGains(crossfader(), curve());

  const handleCrossfaderChange = (val: number) => {
    setCrossfader(val);
    setDjDeckState((prev) => ({ ...prev, crossfader: val }));
  };

  const handleCurveChange = (nextCurve: CrossfaderCurve) => {
    setCurve(nextCurve);
    setDjDeckState((prev) => ({ ...prev, crossfaderCurve: nextCurve }));
  };

  const handleLoopRoll = (size: LoopRollSize) => {
    const next = activeLoopRoll() === size ? null : size;
    setActiveLoopRoll(next);
    setDjDeckState((prev) => ({ ...prev, loopRoll: next }));
  };

  const handleVinylBrake = () => {
    if (isBraking()) return;
    setIsBraking(true);
    setDjDeckState((prev) => ({ ...prev, isVinylBraking: true }));

    // Emulate 1.2s turntable stop
    setTimeout(() => {
      if (isPlaying()) void session.togglePlay();
      setIsBraking(false);
      setDjDeckState((prev) => ({ ...prev, isVinylBraking: false }));
    }, 1200);
  };

  const handleNudge = (direction: -1 | 1) => {
    const amount = direction * 4; // 4% pitch bend
    setNudge(amount);
    setDjDeckState((prev) => ({ ...prev, bpmNudgePercent: amount }));
    setTimeout(() => {
      setNudge(0);
      setDjDeckState((prev) => ({ ...prev, bpmNudgePercent: 0 }));
    }, 400);
  };

  const effectiveBpm = () => {
    const base = doc.transport.bpm;
    const offset = Math.round(base * (nudge() / 100));
    return base + offset;
  };

  return (
    <Portal>
      <dialog
        ref={(el) => {
          dialogRef = el;
        }}
        class="dj-dialog"
        role="dialog"
        aria-label="Performance DJ Deck"
      >
        {/* Header */}
        <div class="dj-header">
          <div class="dj-title-wrap">
            <IconDjDeck size={18} />
            <span class="dj-title">PERFORMANCE DJ DECK // DUAL-PLATTER</span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close DJ Deck"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="dj-body">
          {/* DECK A */}
          <div class="dj-deck-col deck-a">
            <div class="dj-deck-meta">
              <span class="dj-deck-badge">DECK A</span>
              <span style={{ color: "#7b8fa3", "font-size": "10px" }}>
                DRUMS + BASS
              </span>
            </div>

            {/* Turntable Platter */}
            <div class="dj-platter-wrap">
              <div
                class="dj-platter"
                classList={{
                  "is-stopped": !isPlaying(),
                  "is-braking": isBraking(),
                }}
              >
                <div class="dj-platter-grooves" />
                <div class="dj-platter-label">
                  <span>DECK A</span>
                </div>
              </div>
              <div class="dj-tonearm" />
            </div>

            {/* 3-Band Isolator EQ Strip */}
            <div class="dj-eq-strip">
              <div class="dj-eq-col">
                <span class="dj-eq-label">HIGH</span>
                <input
                  type="range"
                  min="-48"
                  max="6"
                  step="1"
                  value={highA()}
                  class="dj-eq-slider"
                  onInput={(e) => setHighA(parseFloat(e.currentTarget.value))}
                />
                <button
                  type="button"
                  class="dj-kill-btn"
                  classList={{ "is-killed": highKillA() }}
                  onClick={() => setHighKillA(!highKillA())}
                >
                  KILL
                </button>
              </div>

              <div class="dj-eq-col">
                <span class="dj-eq-label">MID</span>
                <input
                  type="range"
                  min="-48"
                  max="6"
                  step="1"
                  value={midA()}
                  class="dj-eq-slider"
                  onInput={(e) => setMidA(parseFloat(e.currentTarget.value))}
                />
                <button
                  type="button"
                  class="dj-kill-btn"
                  classList={{ "is-killed": midKillA() }}
                  onClick={() => setMidKillA(!midKillA())}
                >
                  KILL
                </button>
              </div>

              <div class="dj-eq-col">
                <span class="dj-eq-label">LOW</span>
                <input
                  type="range"
                  min="-48"
                  max="6"
                  step="1"
                  value={lowA()}
                  class="dj-eq-slider"
                  onInput={(e) => setLowA(parseFloat(e.currentTarget.value))}
                />
                <button
                  type="button"
                  class="dj-kill-btn"
                  classList={{ "is-killed": lowKillA() }}
                  onClick={() => setLowKillA(!lowKillA())}
                >
                  KILL
                </button>
              </div>
            </div>
          </div>

          {/* CENTER MIXER & PERFORMANCE CONTROLS */}
          <div class="dj-center-mixer">
            <div class="dj-mixer-header">
              <span>
                {doc.name || "BITBOUNCE"} — {effectiveBpm()} BPM
              </span>
            </div>

            {/* Main Play & Brake Controls */}
            <div class="dj-transport-deck">
              <button
                type="button"
                class="dj-brake-btn"
                classList={{ "is-active": isBraking() }}
                onClick={handleVinylBrake}
              >
                VINYL BRAKE
              </button>

              <button
                type="button"
                class="booth-btn booth-btn-play"
                style={{ "font-size": "11px", padding: "8px 16px" }}
                classList={{ "is-on": isPlaying() }}
                onClick={() => void session.togglePlay()}
              >
                {isPlaying() ? "PAUSE" : "PLAY"}
              </button>

              <div class="dj-nudge-group">
                <button
                  type="button"
                  class="dj-nudge-btn"
                  title="Pitch Nudge Down"
                  onClick={() => handleNudge(-1)}
                >
                  NUDGE -
                </button>
                <button
                  type="button"
                  class="dj-nudge-btn"
                  title="Pitch Nudge Up"
                  onClick={() => handleNudge(1)}
                >
                  NUDGE +
                </button>
              </div>
            </div>

            {/* Loop Roll Pads */}
            <div class="dj-loop-section">
              <div class="dj-loop-title">SLIP LOOP ROLL</div>
              <div class="dj-loop-grid">
                <button
                  type="button"
                  class="dj-loop-pad"
                  classList={{ "is-active": activeLoopRoll() === "1/2" }}
                  onClick={() => handleLoopRoll("1/2")}
                >
                  1/2
                </button>
                <button
                  type="button"
                  class="dj-loop-pad"
                  classList={{ "is-active": activeLoopRoll() === "1/4" }}
                  onClick={() => handleLoopRoll("1/4")}
                >
                  1/4
                </button>
                <button
                  type="button"
                  class="dj-loop-pad"
                  classList={{ "is-active": activeLoopRoll() === "1/8" }}
                  onClick={() => handleLoopRoll("1/8")}
                >
                  1/8
                </button>
                <button
                  type="button"
                  class="dj-loop-pad"
                  classList={{ "is-active": activeLoopRoll() === "1/16" }}
                  onClick={() => handleLoopRoll("1/16")}
                >
                  1/16
                </button>
              </div>
            </div>

            {/* Crossfader Section */}
            <div class="dj-crossfader-section">
              <div class="dj-crossfader-labels">
                <span class="a-lbl">
                  DECK A ({Math.round(gains().gainA * 100)}%)
                </span>
                <span class="b-lbl">
                  DECK B ({Math.round(gains().gainB * 100)}%)
                </span>
              </div>

              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={crossfader()}
                class="dj-crossfader-slider"
                onInput={(e) =>
                  handleCrossfaderChange(parseFloat(e.currentTarget.value))
                }
              />

              <div class="dj-curve-row">
                <span>CURVE:</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    class="dj-curve-btn"
                    classList={{ "is-active": curve() === "smooth" }}
                    onClick={() => handleCurveChange("smooth")}
                  >
                    SMOOTH
                  </button>
                  <button
                    type="button"
                    class="dj-curve-btn"
                    classList={{ "is-active": curve() === "scratch" }}
                    onClick={() => handleCurveChange("scratch")}
                  >
                    SCRATCH
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* DECK B */}
          <div class="dj-deck-col deck-b">
            <div class="dj-deck-meta">
              <span class="dj-deck-badge">DECK B</span>
              <span style={{ color: "#7b8fa3", "font-size": "10px" }}>
                CHORDS + LEAD
              </span>
            </div>

            {/* Turntable Platter */}
            <div class="dj-platter-wrap">
              <div
                class="dj-platter"
                classList={{
                  "is-stopped": !isPlaying(),
                  "is-braking": isBraking(),
                }}
              >
                <div class="dj-platter-grooves" />
                <div class="dj-platter-label">
                  <span>DECK B</span>
                </div>
              </div>
              <div class="dj-tonearm" />
            </div>

            {/* 3-Band Isolator EQ Strip */}
            <div class="dj-eq-strip">
              <div class="dj-eq-col">
                <span class="dj-eq-label">HIGH</span>
                <input
                  type="range"
                  min="-48"
                  max="6"
                  step="1"
                  value={highB()}
                  class="dj-eq-slider"
                  onInput={(e) => setHighB(parseFloat(e.currentTarget.value))}
                />
                <button
                  type="button"
                  class="dj-kill-btn"
                  classList={{ "is-killed": highKillB() }}
                  onClick={() => setHighKillB(!highKillB())}
                >
                  KILL
                </button>
              </div>

              <div class="dj-eq-col">
                <span class="dj-eq-label">MID</span>
                <input
                  type="range"
                  min="-48"
                  max="6"
                  step="1"
                  value={midB()}
                  class="dj-eq-slider"
                  onInput={(e) => setMidB(parseFloat(e.currentTarget.value))}
                />
                <button
                  type="button"
                  class="dj-kill-btn"
                  classList={{ "is-killed": midKillB() }}
                  onClick={() => setMidKillB(!midKillB())}
                >
                  KILL
                </button>
              </div>

              <div class="dj-eq-col">
                <span class="dj-eq-label">LOW</span>
                <input
                  type="range"
                  min="-48"
                  max="6"
                  step="1"
                  value={lowB()}
                  class="dj-eq-slider"
                  onInput={(e) => setLowB(parseFloat(e.currentTarget.value))}
                />
                <button
                  type="button"
                  class="dj-kill-btn"
                  classList={{ "is-killed": lowKillB() }}
                  onClick={() => setLowKillB(!lowKillB())}
                >
                  KILL
                </button>
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </Portal>
  );
}
