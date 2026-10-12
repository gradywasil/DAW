/**
 * KaossModal — XY Touch Kaoss FX Pad & Live Beat Stutter Studio.
 * Real-time 2D multi-touch parameter morphing, momentary repeaters,
 * and vinyl tape stop emulation.
 */

import {
  createSignal,
  onMount,
  onCleanup,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  kaossState,
  setKaossState,
  resolveKaossParameters,
  type StutterDivision,
} from "../audio/kaossPad";
import { IconKaoss, IconClose } from "./icons";
import "../styles/kaoss.css";

interface KaossModalProps {
  onClose: () => void;
}

export default function KaossModal(props: KaossModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;
  let surfaceRef!: HTMLDivElement;

  const [activeStutter, setActiveStutter] = createSignal<StutterDivision | null>(null);
  const [tapeStopActive, setTapeStopActive] = createSignal(false);

  const params = () =>
    resolveKaossParameters(kaossState().x, kaossState().y, kaossState().mode);

  const updateCoordinates = (clientX: number, clientY: number) => {
    if (!surfaceRef) return;
    const rect = surfaceRef.getBoundingClientRect();
    const rawX = (clientX - rect.left) / rect.width;
    const rawY = 1.0 - (clientY - rect.top) / rect.height; // Y inverted: bottom is 0, top is 1
    const x = Math.max(0, Math.min(1, rawX));
    const y = Math.max(0, Math.min(1, rawY));

    setKaossState((prev) => ({
      ...prev,
      x,
      y,
      active: true,
    }));
  };

  const handlePointerDown = (e: PointerEvent) => {
    surfaceRef.setPointerCapture(e.pointerId);
    updateCoordinates(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (kaossState().active) {
      updateCoordinates(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    try {
      surfaceRef.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setKaossState((prev) => ({
      ...prev,
      active: prev.hold, // retain coordinates if hold is enabled
      ...(prev.hold ? {} : { y: 0.0 }), // reset wetness on release if not holding
    }));
  };

  const handleStutterStart = (div: StutterDivision) => {
    setActiveStutter(div);
    setKaossState((s) => ({ ...s, stutterDivision: div }));
  };

  const handleStutterEnd = () => {
    setActiveStutter(null);
    setKaossState((s) => ({ ...s, stutterDivision: null }));
  };

  const handleTapeStopStart = () => {
    setTapeStopActive(true);
    setKaossState((s) => ({ ...s, isTapeStopping: true }));
  };

  const handleTapeStopEnd = () => {
    setTapeStopActive(false);
    setKaossState((s) => ({ ...s, isTapeStopping: false }));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    dialogRef.showModal();
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Portal>
      <dialog
        ref={dialogRef}
        class="kaoss-dialog"
        role="dialog"
        aria-label="XY Kaoss FX Pad & Beat Stutter Studio"
      >
        <div class="kaoss-header">
          <div class="kaoss-title-wrap">
            <IconKaoss size={16} />
            <span class="kaoss-title">XY KAOSS FX PAD & BEAT STUTTER</span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close Kaoss Studio"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="kaoss-body">
          {/* Mode Selector Row */}
          <div class="kaoss-modes-row">
            <button
              type="button"
              class="kaoss-mode-btn"
              classList={{ "is-active": kaossState().mode === "filter-space" }}
              onClick={() =>
                setKaossState((s) => ({ ...s, mode: "filter-space" }))
              }
            >
              FILTER & SPACE
            </button>
            <button
              type="button"
              class="kaoss-mode-btn"
              classList={{ "is-active": kaossState().mode === "crush-drive" }}
              onClick={() =>
                setKaossState((s) => ({ ...s, mode: "crush-drive" }))
              }
            >
              BITCRUSH & DRIVE
            </button>
            <button
              type="button"
              class="kaoss-mode-btn"
              classList={{ "is-active": kaossState().mode === "flange-mod" }}
              onClick={() =>
                setKaossState((s) => ({ ...s, mode: "flange-mod" }))
              }
            >
              FLANGE & MOD
            </button>
          </div>

          {/* Interactive XY Touch Surface */}
          <div class="kaoss-pad-container">
            <div
              ref={surfaceRef}
              class="kaoss-surface"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div class="kaoss-gridlines" />

              {/* Glowing Follow Reticle */}
              <div
                class="kaoss-reticle"
                style={{
                  left: `${kaossState().x * 100}%`,
                  top: `${(1.0 - kaossState().y) * 100}%`,
                }}
              >
                <div class="kaoss-reticle-crosshair-x" />
                <div class="kaoss-reticle-crosshair-y" />
                <div class="kaoss-reticle-circle" />
                <div class="kaoss-reticle-dot" />
              </div>
            </div>

            {/* Readout Bar */}
            <div class="kaoss-readout-bar">
              <div class="kaoss-readout-item">
                <span class="kaoss-readout-label">{params().paramXName}:</span>
                <span class="kaoss-readout-value">{params().paramXValue}</span>
              </div>
              <div class="kaoss-readout-item">
                <span class="kaoss-readout-label">{params().paramYName}:</span>
                <span class="kaoss-readout-value">{params().paramYValue}</span>
              </div>
              <button
                type="button"
                class="preset-chip"
                classList={{ "is-active": kaossState().hold }}
                onClick={() =>
                  setKaossState((s) => ({ ...s, hold: !s.hold }))
                }
              >
                {kaossState().hold ? "HOLD: LOCKED" : "HOLD: OFF"}
              </button>
            </div>
          </div>

          {/* Momentary Beat Stutter & Tape Stop Repeater */}
          <div class="kaoss-stutter-section">
            <div class="kaoss-stutter-label">
              MOMENTARY BEAT REPEATERS (PRESS & HOLD):
            </div>
            <div class="kaoss-stutter-grid">
              <button
                type="button"
                class="stutter-pad-btn"
                classList={{ "is-active": activeStutter() === "1/2" }}
                onPointerDown={() => handleStutterStart("1/2")}
                onPointerUp={handleStutterEnd}
                onPointerLeave={handleStutterEnd}
              >
                1/2
              </button>
              <button
                type="button"
                class="stutter-pad-btn"
                classList={{ "is-active": activeStutter() === "1/4" }}
                onPointerDown={() => handleStutterStart("1/4")}
                onPointerUp={handleStutterEnd}
                onPointerLeave={handleStutterEnd}
              >
                1/4
              </button>
              <button
                type="button"
                class="stutter-pad-btn"
                classList={{ "is-active": activeStutter() === "1/8" }}
                onPointerDown={() => handleStutterStart("1/8")}
                onPointerUp={handleStutterEnd}
                onPointerLeave={handleStutterEnd}
              >
                1/8
              </button>
              <button
                type="button"
                class="stutter-pad-btn"
                classList={{ "is-active": activeStutter() === "1/16" }}
                onPointerDown={() => handleStutterStart("1/16")}
                onPointerUp={handleStutterEnd}
                onPointerLeave={handleStutterEnd}
              >
                1/16
              </button>
              <button
                type="button"
                class="stutter-pad-btn"
                classList={{ "is-active": activeStutter() === "1/32" }}
                onPointerDown={() => handleStutterStart("1/32")}
                onPointerUp={handleStutterEnd}
                onPointerLeave={handleStutterEnd}
              >
                1/32
              </button>
              <button
                type="button"
                class="stutter-pad-btn stutter-pad-tape"
                classList={{ "is-active": tapeStopActive() }}
                onPointerDown={handleTapeStopStart}
                onPointerUp={handleTapeStopEnd}
                onPointerLeave={handleTapeStopEnd}
              >
                TAPE STOP
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </Portal>
  );
}
