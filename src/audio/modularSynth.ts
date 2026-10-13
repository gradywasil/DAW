/**
 * Modular Audio Node Canvas Engine (Max/MSP & PureData style visual modular patchbay).
 * Defines node types (Oscillator, LFO, Gain/VCA, Filter/VCF, Delay, Waveshaper, Output),
 * jack sockets (audio/control inputs and outputs), bezier patch cable routing,
 * signal propagation, and JSON/URL serializable graph definitions.
 */

import { createSignal } from "solid-js";

export type ModularNodeType =
  | "oscillator"
  | "lfo"
  | "vca"
  | "filter"
  | "delay"
  | "waveshaper"
  | "noise"
  | "output";

export interface ModularJack {
  id: string;
  name: string;
  type: "audio" | "control";
  direction: "in" | "out";
}

export interface ModularNode {
  id: string;
  type: ModularNodeType;
  title: string;
  x: number;
  y: number;
  params: Record<string, number | string>;
  inputs: ModularJack[];
  outputs: ModularJack[];
}

export interface ModularConnection {
  id: string;
  fromNodeId: string;
  fromJackId: string;
  toNodeId: string;
  toJackId: string;
  color?: string;
}

export interface ModularPatchGraph {
  nodes: ModularNode[];
  connections: ModularConnection[];
}

export const [isModularCanvasOpen, setIsModularCanvasOpen] = createSignal(false);

const DEFAULT_NODES: ModularNode[] = [
  {
    id: "osc-1",
    type: "oscillator",
    title: "VCO 1 (Primary)",
    x: 40,
    y: 60,
    params: { waveform: "sawtooth", detune: 0, octave: 0 },
    inputs: [
      { id: "cv-pitch", name: "Pitch CV", type: "control", direction: "in" },
      { id: "cv-fm", name: "FM In", type: "audio", direction: "in" },
    ],
    outputs: [
      { id: "out-audio", name: "Audio Out", type: "audio", direction: "out" },
    ],
  },
  {
    id: "lfo-1",
    type: "lfo",
    title: "LFO MODULATOR",
    x: 40,
    y: 280,
    params: { rate: 3.5, shape: "sine", depth: 0.8 },
    inputs: [
      { id: "cv-rate", name: "Rate CV", type: "control", direction: "in" },
    ],
    outputs: [
      { id: "out-cv", name: "CV Out", type: "control", direction: "out" },
    ],
  },
  {
    id: "filter-1",
    type: "filter",
    title: "VCF 4-POLE LPF",
    x: 320,
    y: 60,
    params: { cutoff: 1800, resonance: 4.5, type: "lowpass" },
    inputs: [
      { id: "in-audio", name: "Audio In", type: "audio", direction: "in" },
      { id: "cv-cutoff", name: "Cutoff CV", type: "control", direction: "in" },
      { id: "cv-res", name: "Res CV", type: "control", direction: "in" },
    ],
    outputs: [
      { id: "out-audio", name: "Audio Out", type: "audio", direction: "out" },
    ],
  },
  {
    id: "vca-1",
    type: "vca",
    title: "VCA AMPLIFIER",
    x: 600,
    y: 60,
    params: { gain: 0.8, drive: 1.0 },
    inputs: [
      { id: "in-audio", name: "Audio In", type: "audio", direction: "in" },
      { id: "cv-gain", name: "Gain CV", type: "control", direction: "in" },
    ],
    outputs: [
      { id: "out-audio", name: "Audio Out", type: "audio", direction: "out" },
    ],
  },
  {
    id: "output-main",
    type: "output",
    title: "MASTER OUT",
    x: 880,
    y: 120,
    params: { volume: 1.0 },
    inputs: [
      { id: "in-left", name: "L In", type: "audio", direction: "in" },
      { id: "in-right", name: "R In", type: "audio", direction: "in" },
    ],
    outputs: [],
  },
];

const DEFAULT_CONNECTIONS: ModularConnection[] = [
  {
    id: "c-1",
    fromNodeId: "osc-1",
    fromJackId: "out-audio",
    toNodeId: "filter-1",
    toJackId: "in-audio",
    color: "#00f0ff",
  },
  {
    id: "c-2",
    fromNodeId: "lfo-1",
    fromJackId: "out-cv",
    toNodeId: "filter-1",
    toJackId: "cv-cutoff",
    color: "#ffaa00",
  },
  {
    id: "c-3",
    fromNodeId: "filter-1",
    fromJackId: "out-audio",
    toNodeId: "vca-1",
    toJackId: "in-audio",
    color: "#00f0ff",
  },
  {
    id: "c-4",
    fromNodeId: "vca-1",
    fromJackId: "out-audio",
    toNodeId: "output-main",
    toJackId: "in-left",
    color: "#00f0ff",
  },
  {
    id: "c-5",
    fromNodeId: "vca-1",
    fromJackId: "out-audio",
    toNodeId: "output-main",
    toJackId: "in-right",
    color: "#00f0ff",
  },
];

export const [modularGraph, setModularGraph] = createSignal<ModularPatchGraph>({
  nodes: DEFAULT_NODES,
  connections: DEFAULT_CONNECTIONS,
});

/**
 * Computes smooth cubic Bezier curve coordinates for drawing realistic patch cords.
 */
export function computePatchCablePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  slack = 40,
): string {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const sag = Math.max(slack, dist * 0.15);

  const cp1X = startX + Math.max(30, dx * 0.5);
  const cp1Y = startY + sag;
  const cp2X = endX - Math.max(30, dx * 0.5);
  const cp2Y = endY + sag;

  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
}

/**
 * Validates connection compatibility between output and input jacks.
 */
export function isValidConnection(
  sourceJack: ModularJack,
  targetJack: ModularJack,
  sourceNodeId: string,
  targetNodeId: string,
): { valid: boolean; reason?: string } {
  if (sourceNodeId === targetNodeId) {
    return { valid: false, reason: "Cannot connect a node to itself." };
  }
  if (sourceJack.direction !== "out" || targetJack.direction !== "in") {
    return { valid: false, reason: "Must connect an output jack to an input jack." };
  }
  // Audio outputs can feed audio inputs or CV inputs; CV outputs should feed CV inputs
  if (sourceJack.type === "control" && targetJack.type === "audio") {
    return { valid: false, reason: "Control voltages (CV) cannot directly feed audio inputs." };
  }
  return { valid: true };
}

/**
 * Serializes the modular patch graph to a JSON string.
 */
export function serializeModularGraph(graph: ModularPatchGraph): string {
  return JSON.stringify(graph);
}

/**
 * Deserializes and validates a modular patch graph from a JSON string.
 */
export function deserializeModularGraph(rawJson: string): ModularPatchGraph {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.connections)) {
      throw new Error("Invalid modular graph structure.");
    }
    return parsed as ModularPatchGraph;
  } catch (e) {
    return { nodes: DEFAULT_NODES, connections: DEFAULT_CONNECTIONS };
  }
}
