/**
 * Lookahead scheduler.
 *
 * The ONLY scheduling authority is a compiled, sorted list of absolute
 * audio-clock events. This class never creates events; it asks the injected
 * `provideEvents(afterTime, untilTime)` "compiler" for events inside the
 * horizon and forwards each one, at its exact absolute time, to
 * `scheduleEvent(event, when)`.
 *
 * All timing decisions derive from ctx.currentTime exclusively.
 *
 * LIVE EDITS (2026-09-18): events handed to the voice engine are committed —
 * an edit can only change steps that have NOT been delivered yet. A fixed
 * 1.5 s horizon therefore meant a note placed ahead of the playhead stayed
 * silent until the next loop. The horizon is now ADAPTIVE: while the page is
 * visible it is short (`liveHorizonSeconds`, ~50 ms, refilled every 20 ms —
 * edits land within less than one beat-sixteenth), and when the page is hidden
 * it widens to `horizonSeconds` (1.5 s) so a background-throttled
 * setInterval (>= 1 Hz) still never starves the audio. The switch to the
 * long horizon runs synchronously on `visibilitychange`, before the browser
 * starts throttling timers.
 */

export interface EngineEvent {
  readonly type: "tick";
  /** Absolute audio-clock time in seconds. */
  readonly time: number;
  /** Global (monotonic across loops) step index. */
  readonly step: number;
}

export type ScheduleEventFn = (event: EngineEvent, when: number) => void;
export type ProvideEventsFn = (
  afterTime: number,
  untilTime: number,
) => readonly EngineEvent[];

export interface SchedulerOptions {
  /** Injected clock source (real, offline, or fake context). */
  getContext(): { readonly currentTime: number };
  scheduleEvent: ScheduleEventFn;
  provideEvents: ProvideEventsFn;
  /** Refill interval (default 20 ms — must sit well inside the live horizon). */
  readonly intervalMs?: number;
  /**
   * Background event horizon in seconds; 1-2 s covers 1 Hz timer throttling.
   * Passing it WITHOUT `liveHorizonSeconds` pins a fixed horizon (tests).
   */
  readonly horizonSeconds?: number;
  /** Foreground horizon in seconds (default 0.05): how late an edit can land. */
  readonly liveHorizonSeconds?: number;
  /** True while the page is hidden (default: document.visibilityState). */
  readonly isHidden?: () => boolean;
  /**
   * Subscribe to visibility changes; returns an unsubscribe. Default: the
   * document's `visibilitychange` event (no-op outside a browser).
   */
  readonly onVisibilityChange?: (fn: () => void) => () => void;
  /** Injectable timers for tests. */
  readonly setIntervalFn?: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setInterval>;
  readonly clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
}

export class LookaheadScheduler {
  private readonly getContext: SchedulerOptions["getContext"];
  private readonly scheduleEvent: ScheduleEventFn;
  private readonly provideEvents: ProvideEventsFn;
  private readonly intervalMs: number;
  private readonly horizonSeconds: number;
  private readonly liveHorizonSeconds: number;
  private readonly isHidden: () => boolean;
  private readonly onVisibilityChange: NonNullable<
    SchedulerOptions["onVisibilityChange"]
  >;
  private unsubscribeVisibility: (() => void) | null = null;
  private readonly setIntervalFn: NonNullable<
    SchedulerOptions["setIntervalFn"]
  >;
  private readonly clearIntervalFn: NonNullable<
    SchedulerOptions["clearIntervalFn"]
  >;

  private queue: EngineEvent[] = [];
  private generatedUntil = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: SchedulerOptions) {
    this.getContext = opts.getContext;
    this.scheduleEvent = opts.scheduleEvent;
    this.provideEvents = opts.provideEvents;
    this.intervalMs = opts.intervalMs ?? 20;
    this.horizonSeconds = opts.horizonSeconds ?? 1.5;
    this.liveHorizonSeconds =
      opts.liveHorizonSeconds ??
      (opts.horizonSeconds !== undefined ? opts.horizonSeconds : 0.05);
    this.isHidden = opts.isHidden ?? defaultIsHidden;
    this.onVisibilityChange =
      opts.onVisibilityChange ?? defaultOnVisibilityChange;
    this.setIntervalFn =
      opts.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalFn = opts.clearIntervalFn ?? ((id) => clearInterval(id));
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    this.queue = [];
    this.generatedUntil = this.getContext().currentTime;
    this.refill();
    this.timer = this.setIntervalFn(() => this.refill(), this.intervalMs);
    this.unsubscribeVisibility = this.onVisibilityChange(() => {
      // Visibility flipped. Re-run refill immediately: if the page just went
      // hidden, this widens coverage to the 1.5 s horizon synchronously,
      // BEFORE the browser has a chance to clamp setInterval to 1 Hz.
      if (this.running) this.refill();
    });
  }

  stop(): void {
    if (this.timer === null) return;
    this.clearIntervalFn(this.timer);
    this.timer = null;
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = null;
    this.queue = [];
  }

  private currentHorizon(): number {
    return this.isHidden() ? this.horizonSeconds : this.liveHorizonSeconds;
  }

  private refill(): void {
    const now = this.getContext().currentTime;
    const horizon = this.currentHorizon();
    const until = now + horizon;

    // Drain already-delivered events from the queue (currentTime has passed).
    // The queue is sorted by time; find the first event whose time is in the
    // future.
    let dropCount = 0;
    while (
      dropCount < this.queue.length &&
      this.queue[dropCount].time <= now
    ) {
      dropCount++;
    }
    if (dropCount > 0) {
      this.queue.splice(0, dropCount);
    }

    // Ask the compiler for new events between generatedUntil and until.
    if (this.generatedUntil < until) {
      const newEvents = this.provideEvents(this.generatedUntil, until);
      for (const ev of newEvents) {
        this.queue.push(ev);
        this.scheduleEvent(ev, ev.time);
      }
      this.generatedUntil = until;
    }
  }
}

function defaultIsHidden(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden";
}

function defaultOnVisibilityChange(fn: () => void): () => void {
  if (
    typeof document === "undefined" ||
    typeof document.addEventListener !== "function"
  ) {
    return () => {};
  }
  const handler = () => fn();
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}
