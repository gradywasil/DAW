# Bitbounce recovery, 2026-10-25

The recovery keeps the existing instrument-console identity, musical document format, saved preset recipes and working core editors. It removes the header's pile of studio shortcuts, repairs concrete audio and persistence failures, and puts optional tools closer to their task.

The starting checkout was clean at `c301ca4`. TypeScript, the production build and all 2,039 existing unit tests passed before editing. The failures were in behavior, inactive rendering, incomplete integrations and stale browser fixtures. No project reset or data clearing was used against the user's browser profile. Browser tests use disposable profiles.

| Feature | Recovery result |
| --- | --- |
| Mobile navigation | One Instruments / Song / Mixer row. Visuals is directly beside Play. Double pattern moves inside Bars. Desktop retains all four workspace tabs. |
| Header | Session tools contains MIDI, collaboration and help. Sample tools is on Drums, Chord tools on Chords, and Share song link is in Projects. |
| MIDI | Cold sample notes receive a fresh timestamp after decoding. Drum recording sets a hit instead of toggling it away, and step advance follows the selected pattern's full length. Unsupported browsers receive an explicit message. Physical MIDI hardware was not used. |
| Collaboration | Explicit Join and Leave. Two disposable tabs discover each other and synchronize project edits both ways. The incomplete remote WebRTC interface is removed. Opening the panel no longer starts a persistent session. |
| Slicer | Shared session context, touch/pointer slice editing, preview, and real stereo WAV download. Pitch, reversal and gain are baked into the exported slice. The old action that substituted arbitrary kit hits for slices is removed. |
| Recorder | Microphone permission is requested by Record, not opening the panel. Denial is visible. Sources, timers and streams have cleanup paths, including late permission responses. Normalization and trimming allocate buffers without opening extra audio contexts. Takes can be exported as WAV or sent to the slicer. Live microphone capture was not exercised. |
| Chord generator | Uses the current sound and scale, replaces the selected patterns, and undoes in one step. Writes canonical chord roots rather than multiplying each already-voiced chord into several triads. The available tool is deliberately limited to diatonic triads. |
| Song links | Large payload compression drains while writing. Shared songs import into a separate saved row and preserve the previous project. Both boot and same-tab hash navigation use the same import operation. |
| Unfinished studios | DJ deck, modular canvas, XY effects and sidechain panel are removed from production controls. Their settings did not reach the song's audio. Source is preserved for future implementation. The working Mixer remains available. |
| Sounds | Picks presents 16 pitched choices and six contrasting kits. Twelve authored instruments introduce tine electric-piano, FM and detuned ensemble synthesis, plus damped pluck and mallet choices. Existing IDs and recipes remain intact. All 848 pitched presets remain searchable; result rendering grows in batches of 48. |

The new instrument models are synthesized sounds, including the natural-instrument approximations. Their real-worklet output passes finite-sample, non-silence, peak-bound and distinct-fingerprint checks. These checks do not establish listening preference or acoustic realism. `studio-palette.wav` contains each new instrument for three seconds, in the order recorded in `studio-palette.json`.

| Measured behavior | Before | After | Evidence boundary |
| --- | ---: | ---: | --- |
| Stopped phone grid animation callbacks, one-second window | 60 | 0 | Instrumented Chromium. |
| Hidden grid callbacks under Mixer, one-second window | 61 | 0 | Audio playback continues. |
| Hidden grid callbacks under Visuals, one-second window | 63 | 0 | Only the visible visualizer continues rendering. |
| Covered Booth / note-follow callbacks under Visuals | 61 / 61 | 0 / 0 | Inactive editor work is parked. |
| Cold Play press to possible audio onset, median | 224.0 ms | 216.7 ms | Ten fresh Chromium contexts, 4x main-thread CPU slowdown. Dispatch-adjusted audio-clock estimate; excludes device output. |
| Warm Play press to possible audio onset, median | 96.7 ms | 25.9 ms | Same ten contexts and throttle. |
| First-note batches dispatched after their scheduled time | 10 of 20 | 0 of 20 | Native MessagePort and AudioContext observation. Final minimum remaining lead: 16.3 ms. |

The full final initial JavaScript graph is 148.99 KiB gzip, within the existing 300 KiB budget. Visualizer, Mixer and optional instrument-page code loads on demand. The bundle checker now recognizes minified static imports and uses local Node executables on Windows. The initial-graph figure is not a before/after comparison of total downloaded bytes.

The foreground scheduling horizon remains 50 ms with a 20 ms refill interval, and the hidden-tab horizon remains 1.5 seconds. Playback now waits for cold synth worklet initialization as well as sample decoding before starting its clock. The singleton's start margin drops from 100 ms to 25 ms after that barrier. A ready engine receives the first step before synchronous transport UI observers run; later refills retain their established delivery order. A regression test advances the audio clock during UI work and proves the first note is already handed off. The native Web Audio and AudioWorklet engine is retained. No evidence justified an engine replacement.

Early cold-start readings used the requested timestamp even when it was already in the past. That was an invalid onset estimate. The corrected before artifact retains those timestamps separately, and bounds possible onset at actual dispatch. The final probe observes native message dispatch and the real audio clock. Cold startup remains dominated by engine initialization; this run does not establish a meaningful reduction in that cost. Intermediate timing artifacts are retained as diagnostic history, not final results.

Verification completed locally:

- 125 unit files, 2,046 tests passed, including regressions for large-link compression, selected-pattern chord generation, cold MIDI sample timestamps, cold synth readiness/cancellation, first-note dispatch ahead of UI work and slice pitch export.
- All 41 focused Chromium browser tests passed together in the final run across 10 files. These cover the built-app edit/export/reload journey, sound swaps on all four default tracks, sample playback, mixer DSP, the new palette, mobile transport/options/grid navigation, and visualizer reroll/focus/persistence.
- The recovery journey passed in Chromium 151 and Firefox 153 at 320x667, 390x844, 768x1024 and 1440x900. It covers playback across views, sound preview/apply, extra-track creation, chord undo, actual slice download, microphone denial and preservation of the previous saved project during song-link import. Firefox required execution outside the Windows sandbox because its own profile/registry initialization failed inside it.
- A two-tab collaboration journey passed, including explicit Join, peer discovery, edit propagation in both directions and Leave.
- The recorder captured and decoded 1.56 seconds from Chromium's synthetic microphone. Normalize, trim, actual WAV download and transfer to the slicer passed, and all capture tracks ended when the recorder closed. This exercises real browser media APIs without proving physical microphone quality.
- TypeScript, ESLint, production build, bundle budget and whitespace checks are recorded in the adjacent verification files.
- Mobile and desktop screenshots were viewed directly, including light mode and the visualizer. The Impeccable detector returned no required findings and three advisory color findings in retained tool/backdrop styling.

The browser runs are desktop-engine checks with phone-sized layouts and touch emulation. They do not establish physical Android/iOS behavior, speaker/Bluetooth latency, thermal behavior, battery use, physical MIDI behavior, live microphone quality or public deployment. Web MIDI availability also varies by browser and requires the relevant permissions and device access, as documented by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API). MP4 encoding remains subject to the existing browser capability checks.

The first broad browser attempts were stopped after stale fixture failures. Native-select assumptions were corrected to the actual sound-browser button, the effects test now operates the Mixer numeric control, and visualizer boot readiness no longer depends on a rail that is absent from the initial editor page. The repaired focused runs are retained with the earlier failure logs. The exhaustive legacy 848-preset / 80-kit render sweep was not completed in this run; the new palette and existing sampled-voice checks were completed.

Reproduction scripts are `scripts/verify-recovery.mjs`, `scripts/verify-recovery-jam.mjs`, `scripts/verify-recovery-recorder.mjs`, `scripts/verify-recovery-lifecycle.mjs`, `scripts/verify-recovery-latency.mjs` and `scripts/render-studio-palette.mjs`. They expect the local Vite server on `127.0.0.1:5174`. Set `PLAYWRIGHT_BROWSERS_PATH` to an installed browser cache; `RECOVERY_BROWSER=firefox` selects Firefox for the recovery journey. The latency script accepts `before` or `after` as its output label. Its before artifact was captured using the previous 100 ms start margin; its after artifact uses the final 25 ms margin.

Changes remain local. No commit, push or deployment is part of this recovery run.
