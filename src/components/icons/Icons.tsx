/**
 * Bespoke Art Icons for Bitbounce Membrane DAW.
 *
 * Pixel-aligned on a 16x16 coordinate space with 1.5px stroke by default.
 * Fully theme-adaptive (currentColor), accessible (aria-hidden by default),
 * and styled for quiet Membrane tactile hardware elegance.
 */

import type { JSX } from "solid-js";

export interface IconProps {
  class?: string;
  size?: number | string;
  width?: number | string;
  height?: number | string;
  strokeWidth?: number | string;
  color?: string;
  title?: string;
  style?: JSX.CSSProperties | string;
  filled?: boolean;
}

function resolveSize(props: IconProps, fallback = 14): { w: number | string; h: number | string } {
  const s = props.size;
  return {
    w: s ?? props.width ?? fallback,
    h: s ?? props.height ?? fallback,
  };
}

/** Precision Plus '+' icon for steppers, slot additions, and creation affordances. */
export function IconPlus(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 12);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

/** Precision Minus '–' icon for steppers, reductions, and decrements. */
export function IconMinus(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 12);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3.5 8h9" />
    </svg>
  );
}

/** Chevron left '<' for backward pagination, reorder left, and previous steps. */
export function IconChevronLeft(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M10 3.5L5.5 8 10 12.5" />
    </svg>
  );
}

/** Chevron right '>' for forward pagination, reorder right, and next steps. */
export function IconChevronRight(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M6 3.5L10.5 8 6 12.5" />
    </svg>
  );
}

/** Chevron down 'v' for dropdown menus, disclosures, and expandable panels. */
export function IconChevronDown(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 12);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3.5 6L8 10.5 12.5 6" />
    </svg>
  );
}

/** Chevron up '^' for collapsed panels and upward navigation. */
export function IconChevronUp(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 12);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3.5 10L8 5.5 12.5 10" />
    </svg>
  );
}

/** Close / cancel / dismiss '✕' icon. */
export function IconClose(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M4 4l8 8M12 4L4 12" />
    </svg>
  );
}

/** Trash / remove icon with lid, basket body, and vertical ribs. */
export function IconTrash(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2.5 4.5h11M6 4.5V2.75a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.75M4.25 4.5l.75 8.75a1.25 1.25 0 0 0 1.25 1.25h3.5a1.25 1.25 0 0 0 1.25-1.25l.75-8.75M6.5 7.25v4.5M9.5 7.25v4.5" />
    </svg>
  );
}

/** Pencil / note drawing tool icon. */
export function IconPencil(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M11.25 2.5a1.414 1.414 0 0 1 2 2L5.25 12.5l-2.75.75.75-2.75L11.25 2.5z" />
    </svg>
  );
}

/** Pan / hand navigation tool icon. */
export function IconHand(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M6 7.5V3.5a.75.75 0 0 1 1.5 0V7M7.5 7V2.5a.75.75 0 0 1 1.5 0V7M9 7V3.5a.75.75 0 0 1 1.5 0V8M10.5 8V4.5a.75.75 0 0 1 1.5 0v5a4 4 0 0 1-8 0V8a.75.75 0 0 1 1.5 0v1" />
    </svg>
  );
}

/** Search / magnifying glass icon. */
export function IconSearch(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.5}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

/** Star / favorite icon (supports filled boolean). */
export function IconStar(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill={props.filled ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13.1l.7-4-2.9-2.8 4-.6L8 2z" />
    </svg>
  );
}

/** Clock / recent history icon. */
export function IconClock(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.25l2.25 1.5" />
    </svg>
  );
}

/** Audio speaker cone / volume icon. */
export function IconVolume(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2.5 5.75h2.25L8 2.75v10.5L4.75 10.25H2.5a1 1 0 0 1-1-1v-2.5a1 1 0 0 1 1-1zM11 5.5a3.5 3.5 0 0 1 0 5M12.75 3.5a6 6 0 0 1 0 9" />
    </svg>
  );
}

/** Muted audio speaker cone with slash. */
export function IconMute(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2.5 5.75h2.25L8 2.75v10.5L4.75 10.25H2.5a1 1 0 0 1-1-1v-2.5a1 1 0 0 1 1-1zM10.75 6.25l3.5 3.5M14.25 6.25l-3.5 3.5" />
    </svg>
  );
}

/** Solo focus target icon. */
export function IconSolo(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <circle cx="8" cy="8" r="5.75" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

/** Padlock icon for channel lock. */
export function IconLock(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="3.25" y="6.5" width="9.5" height="7" rx="1.5" />
      <path d="M5.5 6.5V4.25a2.5 2.5 0 0 1 5 0v2.25" />
    </svg>
  );
}

/** Sparkle / generative AI / auto mix icon. */
export function IconSparkle(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 1.5l1.5 4 4 1.5-4 1.5L8 12.5l-1.5-4-4-1.5 4-1.5zM12.5 10.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

/** Add FX device rack module icon. */
export function IconAddFx(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M5.5 8h5M8 5.5v5" />
    </svg>
  );
}

/** Equalizer multi-band curve and sliders icon. */
export function IconEq(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3.5 13V9M3.5 6V3M8 13V7.5M8 4.5V3M12.5 13V10.5M12.5 7.5V3M2 9h3M6.5 7.5h3M11 10.5h3" />
    </svg>
  );
}

/** Compressor gain reduction curve icon. */
export function IconCompressor(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2.5 13.5h11M2.5 13.5l5.5-5.5 5.5-1.5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Filter resonant lowpass curve icon. */
export function IconFilter(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 13.5h12M2.5 6h4c1.5 0 2.25-2.5 3.25-2.5s2 10 3.75 10" />
    </svg>
  );
}

/** Drive / saturation waveform icon. */
export function IconDrive(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 8h2.5l1.5-4.5h4l1.5 9h2L14 8" />
    </svg>
  );
}

/** Delay echo repeats icon. */
export function IconDelay(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 8c1-3 2.5-3 3.5 0s2.5 3 3.5 0 2-2 3 0 2 2 3 0" />
      <circle cx="5.5" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Reverb spatial acoustic room icon. */
export function IconReverb(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.3}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3 5l5-2.5 5 2.5v6l-5 2.5-5-2.5V5zM8 2.5v11M3 5l5 3 5-3" />
    </svg>
  );
}

/** Bitcrusher bit-quantized staircase icon. */
export function IconBitcrush(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 13h3V9.5h3V6h3V2.5h3" />
    </svg>
  );
}

/** Waveform audio / stems / WAV icon. */
export function IconWaveform(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 8v0M4.5 5.5v5M7 3v10M9.5 2v12M12 5.5v5M14.5 8v0" />
    </svg>
  );
}

/** Multi-track audio layers / stems icon. */
export function IconLayers(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
      <circle cx="5" cy="4" r="1.25" fill="currentColor" />
      <circle cx="11" cy="8" r="1.25" fill="currentColor" />
      <circle cx="7.5" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

/** 5-pin DIN MIDI port icon. */
export function IconMidi(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <circle cx="8" cy="8" r="5.75" />
      <circle cx="5.25" cy="8.5" r=".75" fill="currentColor" />
      <circle cx="10.75" cy="8.5" r=".75" fill="currentColor" />
      <circle cx="6.25" cy="6" r=".75" fill="currentColor" />
      <circle cx="9.75" cy="6" r=".75" fill="currentColor" />
      <circle cx="8" cy="5" r=".75" fill="currentColor" />
    </svg>
  );
}

/** Tactile membrane disk / save icon. */
export function IconDisk(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3 2.5h7.5l2.5 2.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1zM5 2.5v3h5v-3M5 14v-4h6v4" />
    </svg>
  );
}

/** Open project / folder icon. */
export function IconFolder(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 4a1 1 0 0 1 1-1h3.25l1.5 2H13a1 1 0 0 1 1 1v1.5H3.5l-1 5.5V4z" />
      <path d="M3.5 7.5h10.5l-1.5 5.5a1 1 0 0 1-1 .75H4a1 1 0 0 1-1-.75L1.5 7.5" />
    </svg>
  );
}

/** New project / document plus icon. */
export function IconFilePlus(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3.5 2.5h5.5l3.5 3.5V13a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1z" />
      <path d="M7.5 7.5v4M5.5 9.5h4" />
    </svg>
  );
}

/** Duplicate block icon. */
export function IconDuplicate(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="2.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M6 5.5V3.5A1.5 1.5 0 0 1 7.5 2h5A1.5 1.5 0 0 1 14 3.5v5a1.5 1.5 0 0 1-1.5 1.5H10" />
    </svg>
  );
}

/** Copy / clipboard icon. */
export function IconCopy(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="4.5" y="4.5" width="8" height="8.5" rx="1.5" />
      <path d="M3.5 11.5H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v.5" />
    </svg>
  );
}

/** Length double (x2) icon. */
export function IconDouble(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.5}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3 5.5l2.5 2.5L3 10.5M7.5 5.5L10 8l-2.5 2.5M12.5 7v2" />
    </svg>
  );
}

/** 4-quadrant stage layout icon (Instruments 1–4). */
export function IconGridStage(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  );
}

/** Extended 8-instrument rack icon (Instruments 5–8). */
export function IconRack(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M8 2.5v11M2.5 8h11M5.25 2.5v11M10.75 2.5v11" />
    </svg>
  );
}

/** Song arrangement chain / timeline blocks icon. */
export function IconTimeline(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.35}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <rect x="2.5" y="3.5" width="4.5" height="3.5" rx="1" />
      <rect x="8.5" y="3.5" width="5" height="3.5" rx="1" />
      <rect x="2.5" y="9" width="6.5" height="3.5" rx="1" />
      <rect x="10.5" y="9" width="3" height="3.5" rx="1" />
    </svg>
  );
}

/** Mixer console vertical faders icon. */
export function IconMixer(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M4 2v12M8 2v12M12 2v12M2.5 5.5h3M6.5 10.5h3M10.5 7.5h3" />
    </svg>
  );
}

/** Arrow right / sequence flow icon. */
export function IconArrowRight(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.5}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2.5 8h11M10 4.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
}

/** Loop / circular sequence repeat icon. */
export function IconLoop(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M12.5 6.5H4a2 2 0 0 0-2 2v.5M10.5 4.5l2 2-2 2M3.5 9.5H12a2 2 0 0 0 2-2V7M5.5 11.5l-2-2 2-2" />
    </svg>
  );
}

/** Directional Arrow Up '▲'. */
export function IconArrowUp(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 12);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 12.5V3.5M4 7.5l4-4 4 4" />
    </svg>
  );
}

/** Directional Arrow Down '▼'. */
export function IconArrowDown(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 12);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 3.5v9M4 8.5l4 4 4-4" />
    </svg>
  );
}

/** Checkmark icon for success toasts and indicators. */
export function IconCheck(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/** Warning / error triangle icon. */
export function IconAlertTriangle(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 2.25L14.25 13.5H1.75L8 2.25zM8 6.5v3M8 11.5v.5" />
    </svg>
  );
}

/** Info circle icon. */
export function IconInfoCircle(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 14);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 7v4M8 5v.5" />
    </svg>
  );
}

/** Tactile Undo action icon (curved left rewind arrow). */
export function IconUndo(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M4 6.5h5.5a3.5 3.5 0 0 1 3.5 3.5v.5a3.5 3.5 0 0 1-3.5 3.5H5" />
      <path d="M6.5 4L4 6.5l2.5 2.5" />
    </svg>
  );
}

/** Tactile Redo action icon (curved right forward arrow). */
export function IconRedo(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M12 6.5H6.5A3.5 3.5 0 0 0 3 10v.5A3.5 3.5 0 0 0 6.5 14H11" />
      <path d="M9.5 4l2.5 2.5-2.5 2.5" />
    </svg>
  );
}

/** Time Travel History clock dial icon. */
export function IconHistory(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M8 3a5.5 5.5 0 1 0 5.5 5.5" />
      <path d="M8 5.5v3l2 1.5" />
      <path d="M5.5 3H8V.5" />
    </svg>
  );
}

/** Resonant parametric EQ bell curve icon for curves, presets, and EQ modes. */
export function IconCurve(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M2 13h2c1.5 0 2.2-8.5 4-8.5s2.5 8.5 4 8.5h2" />
      <circle cx="8" cy="4.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

/** Real-time collaborative Jam / broadcast signal icon. */
export function IconJam(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <path d="M4.5 8.5a5 5 0 0 1 7 0M2.2 6.2a8.2 8.2 0 0 1 11.6 0M8 10.5v1.5" />
    </svg>
  );
}

/** Collaborative peers / ensemble icon. */
export function IconUsers(props: IconProps): JSX.Element {
  const { w, h } = resolveSize(props, 13);
  return (
    <svg
      viewBox="0 0 16 16"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.4}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={props.class ? `app-icon ${props.class}` : "app-icon"}
      style={props.style}
    >
      <path d="M11.5 13.5v-1a2.5 2.5 0 0 0-2.5-2.5h-4a2.5 2.5 0 0 0-2.5 2.5v1" />
      <circle cx="7" cy="5.5" r="2.25" />
      <path d="M14.5 13.5v-1a2.2 2.2 0 0 0-1.7-2.1M10.8 3.5a2.2 2.2 0 0 1 0 4.2" />
    </svg>
  );
}
