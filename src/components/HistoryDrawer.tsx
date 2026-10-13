/**
 * HistoryDrawer: Floating hardware time-travel panel for Bitbounce DAW.
 * Provides interactive timeline scrubbing, history revision inspection,
 * step diff previews, and direct jump to any past or future document state.
 */

import { For, onCleanup, onMount } from "solid-js";
import { registerHelp } from "../help/registry";
import {
  canUndo,
  canRedo,
  pastCount,
  futureCount,
  historyTimeline,
  jumpToHistoryIndex,
  undo,
  redo,
  clearHistory,
} from "../state/historyState";
import { IconHistory, IconUndo, IconRedo, IconClose } from "./icons";
import "../styles/history-drawer.css";

registerHelp([
  {
    id: "history.timetravel",
    title: "TIME TRAVEL & HISTORY",
    text: "Scrub backwards and forwards through project history. Inspect what changed at every step, jump to any previous state, or restore future edits.",
  },
  {
    id: "history.scrubber",
    title: "TIMELINE SCRUBBER",
    text: "Drag the slider to scrub through song revisions in real-time, or click any history entry in the list to restore that moment.",
  },
]);

export interface HistoryDrawerProps {
  readonly onClose: () => void;
}

export default function HistoryDrawer(props: HistoryDrawerProps) {
  let popoverRef: HTMLDivElement | undefined;

  onMount(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    }

    function onPointerDown(e: MouseEvent) {
      if (popoverRef && !popoverRef.contains(e.target as Node)) {
        // If clicked outside, close
        const button = (e.target as HTMLElement | null)?.closest(
          ".booth-btn-history",
        );
        if (!button) {
          props.onClose();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    });
  });

  const totalSteps = () => pastCount() + 1 + futureCount();
  const currentStepNum = () => pastCount() + 1;

  const currentItem = () => {
    const list = historyTimeline();
    const curr = list.find((item) => item.isCurrent);
    return curr ?? list[pastCount()];
  };

  return (
    <div
      ref={popoverRef}
      class="history-pop"
      role="dialog"
      aria-label="Undo and Redo History Timeline"
      data-help="history.timetravel"
    >
      {/* Header */}
      <div class="history-pop-header">
        <div class="history-pop-title-wrap">
          <IconHistory size={15} />
          <span class="history-pop-title">Timeline History</span>
        </div>
        <div class="history-pop-badge">
          Step {currentStepNum()} / {totalSteps()}
        </div>
        <button
          type="button"
          class="history-pop-close"
          aria-label="Close History Panel"
          title="Close (Esc)"
          onClick={props.onClose}
        >
          <IconClose size={13} />
        </button>
      </div>

      {/* Scrubbing Bar Card */}
      <div class="history-scrubber-card" data-help="history.scrubber">
        <div class="history-scrubber-labels">
          <span>Past ({pastCount()})</span>
          <span>Current</span>
          <span>Future ({futureCount()})</span>
        </div>

        <div class="history-scrubber-range-wrap">
          <input
            type="range"
            class="history-scrubber-input"
            min={0}
            max={totalSteps() - 1}
            value={pastCount()}
            aria-label="History Scrub Slider"
            onInput={(e) => {
              const target = Number(e.currentTarget.value);
              jumpToHistoryIndex(target);
            }}
          />
        </div>

        <div class="history-scrubber-current-label">
          <span class="history-scrubber-current-tag">NOW</span>
          <span class="history-entry-text">{currentItem()?.label ?? "Current state"}</span>
        </div>
      </div>

      {/* Detailed Revision List */}
      <div class="history-list-wrap" role="list">
        <For each={[...historyTimeline()].reverse()}>
          {(item) => {
            const tagText = () => {
              if (item.isCurrent) return "NOW";
              if (item.stepDelta < 0) return `${item.stepDelta}`;
              return `+${item.stepDelta}`;
            };

            return (
              <button
                type="button"
                role="listitem"
                class="history-entry-row"
                classList={{
                  "is-current": item.isCurrent,
                  "is-future": item.stepDelta > 0,
                  "is-past": item.stepDelta < 0,
                }}
                onClick={() => jumpToHistoryIndex(item.index)}
                aria-label={`Jump to history state: ${item.label}`}
              >
                <div class="history-entry-left">
                  <span class="history-entry-tag">{tagText()}</span>
                  <span class="history-entry-text">{item.label}</span>
                </div>
                <span class="history-entry-action-hint">
                  {item.isCurrent ? "Active" : "Jump"}
                </span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Footer Quick Controls */}
      <div class="history-pop-footer">
        <div class="history-footer-btn-group">
          <button
            type="button"
            class="history-footer-btn"
            disabled={!canUndo()}
            onClick={() => undo()}
            aria-label="Undo step"
            title="Undo (Ctrl+Z)"
          >
            <IconUndo size={12} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            class="history-footer-btn"
            disabled={!canRedo()}
            onClick={() => redo()}
            aria-label="Redo step"
            title="Redo (Ctrl+Y)"
          >
            <IconRedo size={12} />
            <span>Redo</span>
          </button>
        </div>

        <button
          type="button"
          class="history-footer-btn history-clear-btn"
          disabled={pastCount() === 0 && futureCount() === 0}
          onClick={() => clearHistory()}
          aria-label="Clear history stack"
          title="Clear all undo/redo history"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
