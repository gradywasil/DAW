import { createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { docStore } from "../state/store";
import { encodeDocumentToShareUrl } from "../persist/shareUrl";
import "../styles/share-modal.css";

export default function ShareModal(props: { onClose: () => void }) {
  let dialog!: HTMLDialogElement;
  let input!: HTMLInputElement;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const [url, setUrl] = createSignal("");
  const [status, setStatus] = createSignal("Creating the song link…");
  const [copied, setCopied] = createSignal(false);
  const doc = docStore.getState().doc;
  onMount(() => {
    dialog.showModal();
    void encodeDocumentToShareUrl(doc)
      .then((value) => {
        if (disposed) return;
        setUrl(value);
        setStatus(
          "The link contains this song. It does not upload your music.",
        );
      })
      .catch(() => {
        if (!disposed)
          setStatus(
            "This browser could not create a song link. Use Save file in Projects to share an editable copy.",
          );
      });
  });
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
    dialog.close();
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      if (disposed) return;
      setCopied(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCopied(false), 2000);
    } catch {
      input.focus();
      input.select();
      setStatus("Select and copy the link from this field.");
    }
  };
  return (
    <Portal>
      <dialog
        ref={(el) => {
          dialog = el;
        }}
        class="share-dialog"
        aria-label="Share song link"
        onCancel={(e) => {
          e.preventDefault();
          props.onClose();
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header class="share-header">
          <h2>Share song link</h2>
          <button type="button" class="slicer-btn" onClick={props.onClose}>
            Close
          </button>
        </header>
        <div class="share-body">
          <h3>{doc.name || "Untitled song"}</h3>
          <p>Anyone with the link can open and edit a separate local copy.</p>
          <label>
            Song link
            <input
              ref={(el) => {
                input = el;
              }}
              class="share-url-input"
              readonly
              value={url()}
              onClick={(e) => e.currentTarget.select()}
            />
          </label>
          <p role="status">{status()}</p>
          <button
            type="button"
            class="share-copy-btn"
            disabled={!url()}
            onClick={() => void copy()}
          >
            {copied() ? "Copied" : "Copy link"}
          </button>
        </div>
      </dialog>
    </Portal>
  );
}
