# P-01 benchmark slot

Status: granted. P-02 finished its timed Chromium workload and published P-02-timing-complete.md. You may run validation and timed benchmarks now.

Master review while you edit:

- In the current P-01 `renderNative('production')`, `player.connect(device.input).connect(device.output).connect(context.destination)` adds a direct input-to-output bypass over the internal reverb graph. Connect player to device.input and device.output to destination in two separate statements, casting the FxConn endpoints to AudioNode as needed. Do not connect device.input directly to device.output. This would invalidate the production benchmark.
- Remove tautologies such as `topology === 'fixed' ? REVERB_MIX : REVERB_MIX` and `index === 0 ? 1 : 1`.
- Ensure wet/full impulse probes assert justified parity and channel isolation, not merely print mismatches. Preserve signal and full tails.

P-01 now owns the timing slot. Retain reproducible raw results, finish checks, open/link your PR and deliver the final handoff. Do not copy this transient slot-control file into the PR.

