/**
 * ChordGeneratorModal — Scale-Aware Chord Progression & Voicing Generator.
 * Generates genre-tailored musical chord progressions, previews harmonies,
 * configures voice leading and rhythmic pacing, and writes chords and basslines
 * directly into the project sequence.
 */

import { createSignal, onMount, onCleanup, For, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import {
  CHORD_PROGRESSIONS,
  applyProgressionToProject,
  type ChordTemplate,
  type ChordRhythm,
} from "../audio/chordProgression";
import { getSession } from "../engine/session";
import { IconChord, IconClose } from "./icons";
import "../styles/chord-generator.css";

interface ChordGeneratorModalProps {
  onClose: () => void;
}

export default function ChordGeneratorModal(
  props: ChordGeneratorModalProps,
): JSX.Element {
  let dialogRef!: HTMLDialogElement;

  const [selectedProgression, setSelectedProgression] =
    createSignal<ChordTemplate>(CHORD_PROGRESSIONS[0]!);
  const [rhythm, setRhythm] = createSignal<ChordRhythm>("half-bar");
  const [includeBass, setIncludeBass] = createSignal(true);
  const [auditioningIndex, setAuditioningIndex] = createSignal<number | null>(
    null,
  );

  let auditionTimer: ReturnType<typeof setTimeout> | undefined;
  const playChordDegreeAudition = (rootDegree: number, index: number) => {
    clearTimeout(auditionTimer);
    setAuditioningIndex(index);
    void getSession().audition("chords", rootDegree);
    auditionTimer = setTimeout(() => setAuditioningIndex(null), 700);
  };
  onCleanup(() => clearTimeout(auditionTimer));

  const handleApply = () => {
    applyProgressionToProject(selectedProgression(), rhythm(), includeBass());
    props.onClose();
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
        ref={(el) => {
          dialogRef = el;
        }}
        class="chord-generator-dialog"
        role="dialog"
        aria-label="Chord Progression Generator"
      >
        <div class="chord-generator-header">
          <div class="chord-generator-title-wrap">
            <IconChord size={16} />
            <span class="chord-generator-title">
              SCALE-AWARE CHORD GENERATOR
            </span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close Chord Generator"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="chord-generator-body">
          <p>
            Uses the Chords lane's diatonic triads. Replaces the selected Chords
            pattern and optional Bass pattern. One Undo restores both.
          </p>
          {/* Active Progression Preview Strip */}
          <div class="chord-timeline-strip">
            <For each={selectedProgression().chordNames}>
              {(chordName, idx) => (
                <button
                  type="button"
                  class="chord-block"
                  classList={{ "is-playing": auditioningIndex() === idx() }}
                  onClick={() =>
                    playChordDegreeAudition(
                      selectedProgression().rootDegrees[idx()]!,
                      idx(),
                    )
                  }
                  title="Click to audition chord"
                >
                  <span class="chord-block-roman">
                    {chordName.replace(/maj[0-9]*|[0-9]+/g, "")}
                  </span>
                  <span class="chord-block-root">
                    Degree {selectedProgression().rootDegrees[idx()]}
                  </span>
                  <span class="chord-block-play-hint">TAP TO HEAR</span>
                </button>
              )}
            </For>
          </div>

          {/* Options & Voicings Bar */}
          <div class="chord-options-bar">
            <div class="chord-opt-group">
              <span class="chord-opt-label">RHYTHM:</span>
              <select
                class="chord-select"
                aria-label="Chord rhythm"
                value={rhythm()}
                onChange={(e) =>
                  setRhythm(e.currentTarget.value as ChordRhythm)
                }
              >
                <option value="whole-bar">Whole Bar (1 chord / bar)</option>
                <option value="half-bar">Half Bar (2 chords / bar)</option>
                <option value="syncopated">Syncopated Groove (3+3+2)</option>
              </select>
            </div>

            <label class="chord-checkbox-wrap">
              <input
                type="checkbox"
                checked={includeBass()}
                onChange={(e) => setIncludeBass(e.currentTarget.checked)}
              />
              <span>Generate Accompanying Bassline</span>
            </label>
          </div>

          {/* Preset Progressions Grid */}
          <div class="chord-presets-grid">
            <For each={CHORD_PROGRESSIONS}>
              {(prog) => (
                <button
                  type="button"
                  class="chord-preset-card"
                  classList={{
                    "is-selected": prog.id === selectedProgression().id,
                  }}
                  onClick={() => setSelectedProgression(prog)}
                >
                  <div class="chord-preset-name">{prog.name}</div>
                  <div class="chord-preset-chords">
                    <For each={prog.chordNames}>
                      {(name) => (
                        <span class="chord-badge">
                          {name.replace(/maj[0-9]*|[0-9]+/g, "")}
                        </span>
                      )}
                    </For>
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Modal Footer */}
        <div class="chord-generator-footer">
          <div style={{ "font-size": "11px", color: "var(--color-ink)" }}>
            Selected: <strong>{selectedProgression().name}</strong> (triads,{" "}
            {rhythm()})
          </div>
          <button type="button" class="chord-commit-btn" onClick={handleApply}>
            REPLACE SELECTED PATTERNS
          </button>
        </div>
      </dialog>
    </Portal>
  );
}
