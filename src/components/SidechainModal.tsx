/**
 * SidechainModal — Master Bus Glue Compressor & Sidechain Ducking Studio.
 * Real-time analog VU meter with needle physics, sidechain pump controls,
 * target routing, and glue compressor styling.
 */

import {
  createSignal,
  onMount,
  onCleanup,
  For,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  currentSidechain,
  setCurrentSidechain,
  currentGlue,
  setCurrentGlue,
  liveReductionDb,
  triggerSidechainPulse,
  SIDECHAIN_PRESETS,
  applySidechainPreset,
  type SidechainPreset,
  type DuckingMode,
  type DuckingCurve,
  type GlueCompressorMode,
} from "../audio/sidechain";
import { IconCompressor, IconClose } from "./icons";
import "../styles/sidechain.css";

interface SidechainModalProps {
  onClose: () => void;
}

export default function SidechainModal(props: SidechainModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;
  const [selectedPresetId, setSelectedPresetId] = createSignal<string>(
    SIDECHAIN_PRESETS[0]!.id,
  );

  // Compute needle rotation angle from liveReductionDb (-24dB to 0dB)
  // -24dB maps to ~ -45deg, 0dB maps to ~ +40deg
  const needleAngle = () => {
    const db = Math.max(-24, Math.min(3, liveReductionDb()));
    // Map -24..0 to -42..+38 deg
    const normalized = (db + 24) / 27; // 0 to 1
    return -42 + normalized * 80;
  };

  const handleSelectPreset = (preset: SidechainPreset) => {
    setSelectedPresetId(preset.id);
    applySidechainPreset(preset);
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
        class="sidechain-dialog"
        role="dialog"
        aria-label="Master Bus Glue & Sidechain Studio"
      >
        <div class="sidechain-header">
          <div class="sidechain-title-wrap">
            <IconCompressor size={16} />
            <span class="sidechain-title">MASTER BUS GLUE & SIDECHAIN DUCKING</span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close Sidechain Studio"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="sidechain-body">
          {/* Backlit Analog VU Meter */}
          <div class="vu-meter-chassis">
            <svg
              class="vu-meter-scale-svg"
              viewBox="0 0 300 100"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="vuGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#f5b041" />
                  <stop offset="75%" stop-color="#f5b041" />
                  <stop offset="85%" stop-color="#e74c3c" />
                  <stop offset="100%" stop-color="#e74c3c" />
                </linearGradient>
              </defs>

              {/* Dial Arc */}
              <path
                d="M 40 85 A 130 130 0 0 1 260 85"
                fill="none"
                stroke="url(#vuGrad)"
                stroke-width="3"
              />

              {/* Ticks & Labels */}
              <text x="50" y="78" fill="#f5b041" font-size="7" font-family="monospace">-20</text>
              <text x="80" y="60" fill="#f5b041" font-size="7" font-family="monospace">-10</text>
              <text x="120" y="48" fill="#f5b041" font-size="7" font-family="monospace">-5</text>
              <text x="150" y="44" fill="#f5b041" font-size="7" font-family="monospace">-3</text>
              <text x="180" y="45" fill="#f5b041" font-size="7" font-family="monospace">-1</text>
              <text x="210" y="52" fill="#e74c3c" font-size="8" font-weight="bold" font-family="monospace">0</text>
              <text x="245" y="72" fill="#e74c3c" font-size="7" font-family="monospace">+3</text>

              {/* Center Pivot Pivot */}
              <circle cx="150" cy="98" r="8" fill="#222" stroke="#5a4b32" stroke-width="2" />

              {/* Animated Needle */}
              <g transform={`rotate(${needleAngle()} 150 98)`}>
                <line
                  x1="150"
                  y1="98"
                  x2="150"
                  y2="28"
                  stroke="#fff"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
                <circle cx="150" cy="27" r="1.5" fill="#e74c3c" />
              </g>
            </svg>
            <div class="vu-meter-label">
              GAIN REDUCTION {liveReductionDb() < -0.1 ? `${liveReductionDb().toFixed(1)} dB` : "0.0 dB"}
            </div>
          </div>

          {/* Preset Selector Chips */}
          <div class="sidechain-param-row">
            <span class="sidechain-param-name" style={{ "font-weight": "bold" }}>
              STYLE PRESETS:
            </span>
            <div class="sidechain-presets-row">
              <For each={SIDECHAIN_PRESETS}>
                {(preset) => (
                  <button
                    type="button"
                    class="preset-chip"
                    classList={{ "is-active": preset.id === selectedPresetId() }}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset.name}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Two-Column Studio Layout */}
          <div class="sidechain-columns">
            {/* Column 1: Sidechain Ducking */}
            <div class="sidechain-panel">
              <div class="sidechain-panel-header">
                <span class="sidechain-panel-title">SIDECHAIN DUCKING</span>
                <label class="chord-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={currentSidechain().enabled}
                    onChange={(e) =>
                      setCurrentSidechain((s) => ({
                        ...s,
                        enabled: e.currentTarget.checked,
                      }))
                    }
                  />
                  <span>ACTIVE</span>
                </label>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">TRIGGER MODE:</span>
                <select
                  class="chord-select"
                  value={currentSidechain().mode}
                  onChange={(e) =>
                    setCurrentSidechain((s) => ({
                      ...s,
                      mode: e.currentTarget.value as DuckingMode,
                    }))
                  }
                >
                  <option value="four-on-the-floor">4-On-The-Floor Pulse</option>
                  <option value="kick-transient">Kick Drum Transient</option>
                </select>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">DUCK DEPTH:</span>
                <input
                  type="range"
                  class="sidechain-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={currentSidechain().amount}
                  onInput={(e) =>
                    setCurrentSidechain((s) => ({
                      ...s,
                      amount: parseFloat(e.currentTarget.value),
                    }))
                  }
                />
                <span class="sidechain-param-val">
                  {Math.round(currentSidechain().amount * 100)}%
                </span>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">RELEASE TIME:</span>
                <input
                  type="range"
                  class="sidechain-slider"
                  min="0.05"
                  max="0.6"
                  step="0.01"
                  value={currentSidechain().release}
                  onInput={(e) =>
                    setCurrentSidechain((s) => ({
                      ...s,
                      release: parseFloat(e.currentTarget.value),
                    }))
                  }
                />
                <span class="sidechain-param-val">
                  {Math.round(currentSidechain().release * 1000)}ms
                </span>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">ENVELOPE CURVE:</span>
                <select
                  class="chord-select"
                  value={currentSidechain().curve}
                  onChange={(e) =>
                    setCurrentSidechain((s) => ({
                      ...s,
                      curve: e.currentTarget.value as DuckingCurve,
                    }))
                  }
                >
                  <option value="punchy">Punchy Logarithmic</option>
                  <option value="smooth">Smooth Exponential</option>
                  <option value="linear">Linear</option>
                </select>
              </div>

              <div>
                <span class="sidechain-param-name" style={{ "font-size": "10px" }}>
                  DUCKING TARGETS:
                </span>
                <div class="sidechain-targets-grid">
                  <button
                    type="button"
                    class="target-btn"
                    classList={{ "is-active": currentSidechain().targets.bass }}
                    onClick={() =>
                      setCurrentSidechain((s) => ({
                        ...s,
                        targets: { ...s.targets, bass: !s.targets.bass },
                      }))
                    }
                  >
                    BASS
                  </button>
                  <button
                    type="button"
                    class="target-btn"
                    classList={{ "is-active": currentSidechain().targets.chords }}
                    onClick={() =>
                      setCurrentSidechain((s) => ({
                        ...s,
                        targets: { ...s.targets, chords: !s.targets.chords },
                      }))
                    }
                  >
                    CHORDS
                  </button>
                  <button
                    type="button"
                    class="target-btn"
                    classList={{ "is-active": currentSidechain().targets.lead }}
                    onClick={() =>
                      setCurrentSidechain((s) => ({
                        ...s,
                        targets: { ...s.targets, lead: !s.targets.lead },
                      }))
                    }
                  >
                    LEAD
                  </button>
                  <button
                    type="button"
                    class="target-btn"
                    classList={{ "is-active": currentSidechain().targets.master }}
                    onClick={() =>
                      setCurrentSidechain((s) => ({
                        ...s,
                        targets: { ...s.targets, master: !s.targets.master },
                      }))
                    }
                  >
                    MASTER
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2: Master Bus Glue Compressor */}
            <div class="sidechain-panel">
              <div class="sidechain-panel-header">
                <span class="sidechain-panel-title">MASTER BUS GLUE COMP</span>
                <label class="chord-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={currentGlue().enabled}
                    onChange={(e) =>
                      setCurrentGlue((g) => ({
                        ...g,
                        enabled: e.currentTarget.checked,
                      }))
                    }
                  />
                  <span>ACTIVE</span>
                </label>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">CIRCUIT TOPOLOGY:</span>
                <select
                  class="chord-select"
                  value={currentGlue().mode}
                  onChange={(e) =>
                    setCurrentGlue((g) => ({
                      ...g,
                      mode: e.currentTarget.value as GlueCompressorMode,
                    }))
                  }
                >
                  <option value="vca-punch">Vintage British VCA</option>
                  <option value="opto-smooth">Smooth Optical Leveler</option>
                  <option value="tape-warmth">Warm Analog Tape</option>
                  <option value="pumping-club">Pumping Club VCA</option>
                </select>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">THRESHOLD:</span>
                <input
                  type="range"
                  class="sidechain-slider"
                  min="-36"
                  max="0"
                  step="1"
                  value={currentGlue().threshold}
                  onInput={(e) =>
                    setCurrentGlue((g) => ({
                      ...g,
                      threshold: parseFloat(e.currentTarget.value),
                    }))
                  }
                />
                <span class="sidechain-param-val">{currentGlue().threshold} dB</span>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">RATIO:</span>
                <input
                  type="range"
                  class="sidechain-slider"
                  min="1.5"
                  max="8"
                  step="0.5"
                  value={currentGlue().ratio}
                  onInput={(e) =>
                    setCurrentGlue((g) => ({
                      ...g,
                      ratio: parseFloat(e.currentTarget.value),
                    }))
                  }
                />
                <span class="sidechain-param-val">{currentGlue().ratio}:1</span>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">SIDECHAIN HPF:</span>
                <input
                  type="range"
                  class="sidechain-slider"
                  min="20"
                  max="250"
                  step="5"
                  value={currentGlue().sidechainHpHz}
                  onInput={(e) =>
                    setCurrentGlue((g) => ({
                      ...g,
                      sidechainHpHz: parseFloat(e.currentTarget.value),
                    }))
                  }
                />
                <span class="sidechain-param-val">{currentGlue().sidechainHpHz} Hz</span>
              </div>

              <div class="sidechain-param-row">
                <span class="sidechain-param-name">MAKEUP GAIN:</span>
                <input
                  type="range"
                  class="sidechain-slider"
                  min="0"
                  max="10"
                  step="0.5"
                  value={currentGlue().makeup}
                  onInput={(e) =>
                    setCurrentGlue((g) => ({
                      ...g,
                      makeup: parseFloat(e.currentTarget.value),
                    }))
                  }
                />
                <span class="sidechain-param-val">+{currentGlue().makeup} dB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div class="sidechain-footer">
          <button
            type="button"
            class="test-pump-btn"
            onClick={() => triggerSidechainPulse()}
          >
            AUDITION DUCK PULSE
          </button>
          <div style={{ "font-size": "11px", color: "var(--color-ink)" }}>
            Sidechain: <strong>{currentSidechain().enabled ? "ENABLED" : "BYPASSED"}</strong> | Glue:{" "}
            <strong>{currentGlue().enabled ? "ENABLED" : "BYPASSED"}</strong>
          </div>
        </div>
      </dialog>
    </Portal>
  );
}
