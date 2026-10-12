/**
 * ChordGeneratorModal — Scale-Aware Chord Progression & Voicing Generator.
 * Generates genre-tailored musical chord progressions, previews harmonies,
 * configures voice leading and rhythmic pacing, and writes chords and basslines
 * directly into the project sequence.
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
  CHORD_PROGRESSIONS,
  applyProgressionToProject,
  buildChordDegrees,
  type ChordTemplate,
  type VoicingStyle,
  type ChordRhythm,
} from "../audio/chordProgression";
import { getSession } from "../engine/session";
import { IconChord, IconClose } from "./icons";
import "../styles/chord-generator.css";

interface ChordGeneratorModalProps {
  onClose: () => void;
}

export default function ChordGeneratorModal(props: ChordGeneratorModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;

  const [selectedProgression, setSelectedProgression] = createSignal<ChordTemplate>(
    CHORD_PROGRESSIONS[0]!,
  );
  const [voicing, setVoicing] = createSignal<VoicingStyle>("seventh");
  const [rhythm, setRhythm] = createSignal<ChordRhythm>("half-bar");
  const [includeBass, setIncludeBass] = createSignal(true);
  const [auditioningIndex, setAuditioningIndex] = createSignal<number | null>(null);

  // Simple Web Audio audition oscillator chord player
  const playChordDegreeAudition = (rootDegree: number, index: number) => {
    setAuditioningIndex(index);
    try {
      const session = getSession();
      const ctx = (session as any).audioContext ?? new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") void ctx.resume();

      const degrees = buildChordDegrees(rootDegree, voicing());
      // Convert degrees into fundamental frequencies around A3 (220Hz)
      const baseFreq = 220;

      degrees.forEach((deg) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";

        // Semitone approximation: ~deg * 1.7 semitones in scale
        const semitones = deg * 1.8;
        osc.frequency.value = baseFreq * Math.pow(2, semitones / 12);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.7);
      });

      setTimeout(() => {
        if (auditioningIndex() === index) {
          setAuditioningIndex(null);
        }
      }, 700);
    } catch {
      // Mock fallback
      setTimeout(() => setAuditioningIndex(null), 300);
    }
  };

  const handleApply = () => {
    applyProgressionToProject(
      selectedProgression(),
      voicing(),
      rhythm(),
      includeBass(),
    );
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
        ref={dialogRef}
        class="chord-generator-dialog"
        role="dialog"
        aria-label="Chord Progression Generator"
      >
        <div class="chord-generator-header">
          <div class="chord-generator-title-wrap">
            <IconChord size={16} />
            <span class="chord-generator-title">SCALE-AWARE CHORD GENERATOR</span>
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
          {/* Active Progression Preview Strip */}
          <div class="chord-timeline-strip">
            <For each={selectedProgression().chordNames}>
              {(chordName, idx) => (
                <div
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
                  <span class="chord-block-roman">{chordName}</span>
                  <span class="chord-block-root">
                    Degree {selectedProgression().rootDegrees[idx()]}
                  </span>
                  <span class="chord-block-play-hint">TAP TO HEAR</span>
                </div>
              )}
            </For>
          </div>

          {/* Options & Voicings Bar */}
          <div class="chord-options-bar">
            <div class="chord-opt-group">
              <span class="chord-opt-label">VOICING:</span>
              <select
                class="chord-select"
                value={voicing()}
                onChange={(e) => setVoicing(e.currentTarget.value as VoicingStyle)}
              >
                <option value="triad">Basic Triad (3-Note)</option>
                <option value="seventh">7th Chords (4-Note)</option>
                <option value="ninth">9th Rich Extensions (5-Note)</option>
                <option value="first-inversion">1st Inversion</option>
                <option value="second-inversion">2nd Inversion</option>
                <option value="drop-2">Drop-2 Spread Voicing</option>
              </select>
            </div>

            <div class="chord-opt-group">
              <span class="chord-opt-label">RHYTHM:</span>
              <select
                class="chord-select"
                value={rhythm()}
                onChange={(e) => setRhythm(e.currentTarget.value as ChordRhythm)}
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
                <div
                  class="chord-preset-card"
                  classList={{
                    "is-selected": prog.id === selectedProgression().id,
                  }}
                  onClick={() => setSelectedProgression(prog)}
                >
                  <div class="chord-preset-top">
                    <span class="chord-preset-genre">{prog.genre}</span>
                  </div>
                  <div class="chord-preset-name">{prog.name}</div>
                  <div class="chord-preset-desc">{prog.description}</div>
                  <div class="chord-preset-chords">
                    <For each={prog.chordNames}>
                      {(name) => <span class="chord-badge">{name}</span>}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Modal Footer */}
        <div class="chord-generator-footer">
          <div style={{ "font-size": "11px", color: "var(--color-ink)" }}>
            Selected: <strong>{selectedProgression().name}</strong> ({voicing()},{" "}
            {rhythm()})
          </div>
          <button
            type="button"
            class="chord-commit-btn"
            onClick={handleApply}
          >
            APPLY TO CHORDS LANE
          </button>
        </div>
      </dialog>
    </Portal>
  );
}
