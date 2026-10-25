import {
  Show,
  Suspense,
  lazy,
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import type { LaneId } from "../document/schema";
import { openHelp } from "../state/helpOverlay";
import { helpMode, toggleHelp } from "../state/helpMode";
import { midiPopoverOpen, setMidiPopoverOpen } from "../midi/midiState";
import { isJamDrawerOpen, setIsJamDrawerOpen } from "../collab/jamSession";
import { isSlicerOpen, setIsSlicerOpen } from "../audio/sampleSlicer";
import { isRecorderOpen, setIsRecorderOpen } from "../audio/audioRecorder";
import {
  isChordGeneratorOpen,
  setIsChordGeneratorOpen,
} from "../audio/chordProgression";
import { selectLane } from "../state/selection";
import "../styles/studio-tools.css";

const MidiPopover = lazy(() => import("./MidiPopover"));
const JamDrawer = lazy(() => import("./JamDrawer"));
const SampleSlicerModal = lazy(() => import("./SampleSlicerModal"));
const AudioRecorderModal = lazy(() => import("./AudioRecorderModal"));
const ChordGeneratorModal = lazy(() => import("./ChordGeneratorModal"));

function ToolMenu(props: { label: string; children: JSX.Element }) {
  let disclosure!: HTMLDetailsElement;
  const [expanded, setExpanded] = createSignal(false);
  createEffect(() => {
    if (!expanded()) return;
    const outside = (e: PointerEvent) => {
      if (!disclosure.contains(e.target as Node)) disclosure.open = false;
    };
    document.addEventListener("pointerdown", outside);
    onCleanup(() => document.removeEventListener("pointerdown", outside));
  });
  return (
    <details
      class="studio-tools"
      ref={(el) => {
        disclosure = el;
      }}
      onToggle={() => setExpanded(disclosure.open)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        e.currentTarget.open = false;
        e.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary>{props.label}</summary>
      <div
        class="studio-tools-menu"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) {
            disclosure.open = false;
            disclosure.querySelector("summary")?.focus();
          }
        }}
      >
        {props.children}
      </div>
    </details>
  );
}

export function SessionTools() {
  return (
    <span class="session-tools">
      <ToolMenu label="Session tools">
        <button type="button" onClick={() => setMidiPopoverOpen(true)}>
          MIDI controller
        </button>
        <button type="button" onClick={() => setIsJamDrawerOpen(true)}>
          Collaborative jam
        </button>
        <button type="button" onClick={(e) => openHelp(e.currentTarget)}>
          Keyboard shortcuts
        </button>
        <button type="button" aria-pressed={helpMode()} onClick={toggleHelp}>
          Info mode
        </button>
      </ToolMenu>
      <Suspense fallback={null}>
        <Show when={midiPopoverOpen()}>
          <MidiPopover onClose={() => setMidiPopoverOpen(false)} />
        </Show>
        <Show when={isJamDrawerOpen()}>
          <JamDrawer onClose={() => setIsJamDrawerOpen(false)} />
        </Show>
      </Suspense>
    </span>
  );
}

export function TrackTools(props: { lane: LaneId }) {
  return (
    <Show when={props.lane === "drums" || props.lane === "chords"}>
      <ToolMenu label={props.lane === "drums" ? "Sample tools" : "Chord tools"}>
        <Show
          when={props.lane === "drums"}
          fallback={
            <button
              type="button"
              onClick={() => {
                selectLane("chords");
                setIsChordGeneratorOpen(true);
              }}
            >
              Generate progression
            </button>
          }
        >
          <button type="button" onClick={() => setIsSlicerOpen(true)}>
            Slice audio
          </button>
          <button type="button" onClick={() => setIsRecorderOpen(true)}>
            Record microphone
          </button>
        </Show>
      </ToolMenu>
    </Show>
  );
}

export function StudioDialogs() {
  return (
    <Suspense fallback={null}>
      <Show when={isSlicerOpen()}>
        <SampleSlicerModal onClose={() => setIsSlicerOpen(false)} />
      </Show>
      <Show when={isRecorderOpen()}>
        <AudioRecorderModal onClose={() => setIsRecorderOpen(false)} />
      </Show>
      <Show when={isChordGeneratorOpen()}>
        <ChordGeneratorModal onClose={() => setIsChordGeneratorOpen(false)} />
      </Show>
    </Suspense>
  );
}
