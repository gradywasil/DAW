/**
 * Compact Project Cloud Links & URL Project Sharing Engine.
 * Compresses canonical ProjectDocument JSON using native raw deflate and base64url,
 * producing ultra-compact, click-to-play shareable web links.
 */

import { createSignal } from "solid-js";
import { encode, decode } from "../document/codec";
import type { ProjectDocument } from "../document/schema";
import { showInfo, showError } from "../state/toasts";

export const [isShareModalOpen, setIsShareModalOpen] = createSignal(false);

export function uint8ArrayToBase64Url(u8: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlToUint8Array(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    u8[i] = binary.charCodeAt(i);
  }
  return u8;
}

/**
 * Compresses an arbitrary string into a URL-safe base64 string using deflate-raw.
 */
export async function compressStringToUrlSafe(text: string): Promise<string> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return uint8ArrayToBase64Url(
    new Uint8Array(await new Response(stream).arrayBuffer()),
  );
}

/**
 * Decompresses a URL-safe base64 string back into a plain string using deflate-raw.
 */
export async function decompressStringFromUrlSafe(
  b64url: string,
): Promise<string> {
  const bytes = new Uint8Array(base64UrlToUint8Array(b64url));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/**
 * Encodes a ProjectDocument into a shareable URL string.
 */
export async function encodeDocumentToShareUrl(
  doc: ProjectDocument,
  baseUrl?: string,
): Promise<string> {
  const canonicalJson = encode(doc);
  const compressedPayload = await compressStringToUrlSafe(canonicalJson);

  let origin = baseUrl;
  if (!origin) {
    if (typeof window !== "undefined" && window.location) {
      origin = `${window.location.origin}${window.location.pathname}`;
    } else {
      origin = "https://bitbounce.app/";
    }
  }

  return `${origin}#song=${compressedPayload}`;
}

/**
 * Extracts and decodes a ProjectDocument from a URL string or hash query.
 */
export async function decodeDocumentFromShareUrl(
  urlOrHash: string,
): Promise<ProjectDocument | null> {
  try {
    let payload = "";
    if (urlOrHash.includes("#song=")) {
      payload = urlOrHash.split("#song=")[1]?.split("&")[0] ?? "";
    } else if (urlOrHash.includes("?song=")) {
      payload = urlOrHash.split("?song=")[1]?.split("&")[0] ?? "";
    } else if (/^[A-Za-z0-9_-]+$/.test(urlOrHash)) {
      payload = urlOrHash;
    }

    if (!payload) return null;

    const jsonText = await decompressStringFromUrlSafe(payload);
    return decode(jsonText);
  } catch {
    // Return null on corrupt or mismatched payloads
    return null;
  }
}

/**
 * Checks for a shared project link in current window location on boot.
 * If found, loads it into the store and notifies the user.
 */
export async function checkAndLoadShareUrlOnBoot(
  load: (doc: ProjectDocument) => Promise<void>,
): Promise<boolean> {
  if (typeof window === "undefined" || !window.location) return false;

  const hash = window.location.hash;
  const search = window.location.search;
  const source = hash.includes("song=")
    ? hash
    : search.includes("song=")
      ? search
      : null;

  if (!source) return false;

  try {
    const doc = await decodeDocumentFromShareUrl(source);
    if (doc) {
      await load(doc);
      showInfo(`Loaded shared song: "${doc.name || "Untitled"}"`);

      // Clean the URL hash without triggering page reload
      if (window.history?.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, "", cleanUrl);
      }
      return true;
    }
    throw new Error("Invalid shared song");
  } catch {
    showError(
      "Could not load song from shared link (corrupted or incompatible).",
    );
  }

  return false;
}
