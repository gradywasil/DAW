import { describe, it, expect } from "vitest";
import {
  computePatchCablePath,
  isValidConnection,
  serializeModularGraph,
  deserializeModularGraph,
  type ModularJack,
  type ModularPatchGraph,
} from "../src/audio/modularSynth";

describe("Modular Audio Node Canvas & Visual Patchbay", () => {
  describe("Bezier Patch Cable Routing", () => {
    it("generates smooth cubic bezier SVG path definition with natural sag", () => {
      const path = computePatchCablePath(50, 100, 250, 120, 40);
      expect(path).toContain("M 50 100 C");
      expect(path).toContain("250 120");
    });
  });

  describe("Modular Jack Connection Validation", () => {
    const audioOut: ModularJack = { id: "out-audio", name: "Audio Out", type: "audio", direction: "out" };
    const audioIn: ModularJack = { id: "in-audio", name: "Audio In", type: "audio", direction: "in" };
    const cvOut: ModularJack = { id: "out-cv", name: "CV Out", type: "control", direction: "out" };
    const cvIn: ModularJack = { id: "cv-cutoff", name: "Cutoff CV", type: "control", direction: "in" };

    it("allows valid audio output to audio input connection between different nodes", () => {
      const res = isValidConnection(audioOut, audioIn, "node-1", "node-2");
      expect(res.valid).toBe(true);
    });

    it("allows control output to control input connection between different nodes", () => {
      const res = isValidConnection(cvOut, cvIn, "lfo-1", "filter-1");
      expect(res.valid).toBe(true);
    });

    it("rejects connecting a node to itself", () => {
      const res = isValidConnection(audioOut, audioIn, "node-1", "node-1");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("itself");
    });

    it("rejects connecting input to input or output to output", () => {
      const inToIn = isValidConnection(audioIn, audioIn, "node-1", "node-2");
      expect(inToIn.valid).toBe(false);

      const outToOut = isValidConnection(audioOut, audioOut, "node-1", "node-2");
      expect(outToOut.valid).toBe(false);
    });

    it("rejects control voltage output directly connected to audio input", () => {
      const res = isValidConnection(cvOut, audioIn, "lfo-1", "filter-1");
      expect(res.valid).toBe(false);
    });
  });

  describe("Patch Graph Serialization & Deserialization", () => {
    it("losslessly serializes and restores modular patch topologies", () => {
      const graph: ModularPatchGraph = {
        nodes: [
          {
            id: "osc-test",
            type: "oscillator",
            title: "Test VCO",
            x: 100,
            y: 150,
            params: { waveform: "square" },
            inputs: [],
            outputs: [{ id: "out", name: "Out", type: "audio", direction: "out" }],
          },
        ],
        connections: [],
      };

      const serialized = serializeModularGraph(graph);
      const restored = deserializeModularGraph(serialized);
      expect(restored.nodes.length).toBe(1);
      expect(restored.nodes[0]!.id).toBe("osc-test");
      expect(restored.nodes[0]!.params.waveform).toBe("square");
    });

    it("gracefully falls back to default patch if corrupted json is supplied", () => {
      const restored = deserializeModularGraph("{ corrupted json");
      expect(restored.nodes.length).toBeGreaterThan(0);
      expect(restored.connections.length).toBeGreaterThan(0);
    });
  });
});
