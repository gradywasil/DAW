# Audio engine benchmark

Use the development-only page at `/audio-engine-benchmark.html` to compare Bitbounce's production `createReverbDevice` path with Elementary's offline WebAssembly convolver. The page does not play sound or change the project. It warms both engines, then alternates five offline renders per engine using an 8-second deterministic stereo input, the same seeded 1.22-second stereo impulse response, and a 50% wet mix. It reports median render time, real-time factor, output delta, and finite-output status.

## Results and diagnostic findings

One run on Chrome 153 for Windows reported:

- Browser-reported context: 44.1 kHz, 10 ms `baseLatency`, 0 ms `outputLatency`.
- Native Bitbounce reverb: 158.8 ms median for 9.22 seconds of output (58.1× real time).
- Elementary offline renderer: 111.4 ms median (82.8× real time), 29.8% faster in this workload.
- Output mismatch: 61.07% relative RMS, 1.60 peak absolute difference; both outputs were finite.
- Dry-only paths match exactly after the first half-second; wet-only paths also match after that first segment, with 4.43% overall relative RMS difference.
- The first samples of the Elementary dry output do not contain the input transient. Moving only that transient forward by 512 samples moved the peak error to sample 512. This strongly indicates a first-block input/timing issue in this offline harness or its `el.in` graph, rather than a sustained mix-law or channel mismatch.

The timing is an offline throughput estimate from one browser/device, not a live CPU-load or glitch-rate measurement. The 0 ms output-latency value is what this browser reported for the temporary measurement context; it does not establish zero physical output latency. The initial-block defect invalidates the current output parity comparison, and these observations do not establish that Elementary's live engine has the same defect. Do not change the production engine based on this result alone.

## Follow-up gate

Fix the offline input/graph startup alignment and rerun the isolated dry and wet probes before interpreting full-chain parity. Then repeat on target browsers/devices and compare the live `AudioWorklet` path. Any integration trial must keep the FX document schema and prove live/offline render parity, control updates, bypass, disposal, and audio quality. Current reverb code remains authoritative until those checks and listening review pass.
