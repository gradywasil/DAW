/**
 * ShareModal — Compact Project Cloud Links & URL Project Sharing.
 * Generates an ultra-compact, click-to-play URL encoding the entire song state,
 * with clipboard copy, Markdown embed generator, and compression statistics.
 */

import {
  createSignal,
  onMount,
  onCleanup,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import { docStore } from "../state/store";
import { encodeDocumentToShareUrl } from "../persist/shareUrl";
import { showInfo } from "../state/toasts";
import { IconShare, IconClose, IconCheck } from "./icons";
import "../styles/share-modal.css";

interface ShareModalProps {
  onClose: () => void;
}

export default function ShareModal(props: ShareModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;
  let inputRef!: HTMLInputElement;

  const [shareUrl, setShareUrl] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [copiedMd, setCopiedMd] = createSignal(false);
  const [rawSize, setRawSize] = createSignal(0);
  const [compressedSize, setCompressedSize] = createSignal(0);

  const doc = docStore.getState().doc;

  onMount(async () => {
    dialogRef.showModal();

    try {
      const url = await encodeDocumentToShareUrl(doc);
      setShareUrl(url);

      const rawJson = JSON.stringify(doc);
      setRawSize(rawJson.length);

      const payload = url.split("#song=")[1] || "";
      setCompressedSize(payload.length);
    } catch (err) {
      console.error("Failed to generate share URL:", err);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleCopyLink = async () => {
    const url = shareUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showInfo("Song link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      inputRef?.select();
    }
  };

  const handleCopyMarkdown = async () => {
    const url = shareUrl();
    if (!url) return;

    const title = doc.name || "Bitbounce Song";
    const md = `[🎵 Listen to "${title}" on Bitbounce](${url})`;

    try {
      await navigator.clipboard.writeText(md);
      setCopiedMd(true);
      showInfo("Markdown link copied to clipboard!");
      setTimeout(() => setCopiedMd(false), 2500);
    } catch {
      // fallback
    }
  };

  const savingsPct = () => {
    if (rawSize() <= 0) return 0;
    return Math.round((1 - compressedSize() / rawSize()) * 100);
  };

  return (
    <Portal>
      <dialog
        ref={dialogRef}
        class="share-dialog"
        role="dialog"
        aria-label="Share Project Link"
      >
        <div class="share-header">
          <div class="share-title-wrap">
            <IconShare size={16} />
            <span class="share-title">SHARE PROJECT LINK</span>
          </div>
          <button
            type="button"
            class="slicer-btn"
            style={{ padding: "4px 8px" }}
            aria-label="Close Share Dialog"
            onClick={props.onClose}
          >
            <IconClose size={12} />
          </button>
        </div>

        <div class="share-body">
          {/* Project Summary Card */}
          <div class="share-summary-card">
            <div class="share-song-title">
              {doc.name || "Untitled Project"}
            </div>
            <div class="share-meta-row">
              <span class="share-meta-item">
                Tempo: <strong>{doc.transport.bpm} BPM</strong>
              </span>
              <span class="share-meta-item">
                Scale: <strong>{doc.scale.root} {doc.scale.mode}</strong>
              </span>
              <span class="share-meta-item">
                Lanes: <strong>Drums, Bass, Chords, Lead</strong>
              </span>
            </div>
          </div>

          {/* Compression Stats */}
          <div class="share-stats-bar">
            <span>
              RAW: <strong>{rawSize()} B</strong> &rarr; URL:{" "}
              <strong>{compressedSize()} B</strong>
            </span>
            <span class="share-stats-ratio">
              {savingsPct()}% SMALLER (CLICK-TO-PLAY)
            </span>
          </div>

          {/* Shareable URL Input & Copy Button */}
          <div class="share-link-section">
            <div class="share-link-input-row">
              <input
                ref={inputRef}
                type="text"
                readonly
                class="share-url-input"
                value={shareUrl()}
                onClick={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                class="share-copy-btn"
                classList={{ "is-copied": copied() }}
                onClick={handleCopyLink}
              >
                {copied() ? (
                  <>
                    <IconCheck size={12} />
                    <span>COPIED!</span>
                  </>
                ) : (
                  <span>COPY LINK</span>
                )}
              </button>
            </div>

            <div class="share-alt-actions">
              <button
                type="button"
                class="share-alt-btn"
                onClick={handleCopyMarkdown}
              >
                {copiedMd() ? "COPIED MARKDOWN!" : "COPY DISCORD / REDDIT MARKDOWN"}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </Portal>
  );
}
