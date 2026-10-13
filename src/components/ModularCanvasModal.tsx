/**
 * ModularCanvasModal — Max/MSP / PureData style visual modular audio patchbay.
 * Users drag custom sound-generator nodes, connect inputs and outputs with glowing
 * cubic Bezier patch cords, tweak parameters live, and audition modular patches.
 */

import {
  createSignal,
  onMount,
  onCleanup,
  For,
  Show,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  modularGraph,
  setModularGraph,
  computePatchCablePath,
  isValidConnection,
  type ModularNode,
  type ModularConnection,
  type ModularJack,
} from "../audio/modularSynth";
import { IconModular, IconClose } from "./icons";
import "../styles/modular-synth.css";

interface ModularCanvasModalProps {
  onClose: () => void;
}

export default function ModularCanvasModal(props: ModularCanvasModalProps): JSX.Element {
  let dialogRef!: HTMLDialogElement;
  let canvasRef!: HTMLDivElement;

  const [graph, setGraph] = createSignal(modularGraph());
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null);

  // Dragging state for nodes
  const [draggingNode, setDraggingNode] = createSignal<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Patching state for cables
  const [pendingCable, setPendingCable] = createSignal<{
    fromNodeId: string;
    fromJack: ModularJack;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  onMount(() => {
    dialogRef.showModal();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const handlePointerDownHeader = (e: MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = graph().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setDraggingNode({
      id: nodeId,
      offsetX: e.clientX - node.x,
      offsetY: e.clientY - node.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    const dragging = draggingNode();
    if (dragging) {
      const rect = canvasRef.getBoundingClientRect();
      const newX = Math.max(10, Math.min(rect.width - 180, e.clientX - dragging.offsetX));
      const newY = Math.max(10, Math.min(rect.height - 200, e.clientY - dragging.offsetY));

      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === dragging.id ? { ...n, x: newX, y: newY } : n)),
      }));
      setModularGraph(graph());
    }

    const pending = pendingCable();
    if (pending) {
      const rect = canvasRef.getBoundingClientRect();
      setPendingCable({
        ...pending,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
    setPendingCable(null);
  };

  const handleJackStart = (e: MouseEvent, node: ModularNode, jack: ModularJack) => {
    e.stopPropagation();
    const rect = canvasRef.getBoundingClientRect();
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = targetRect.left - rect.left + 6;
    const startY = targetRect.top - rect.top + 6;

    setPendingCable({
      fromNodeId: node.id,
      fromJack: jack,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  };

  const handleJackEnd = (e: MouseEvent, targetNode: ModularNode, targetJack: ModularJack) => {
    e.stopPropagation();
    const pending = pendingCable();
    if (!pending) return;

    const validation = isValidConnection(
      pending.fromJack,
      targetJack,
      pending.fromNodeId,
      targetNode.id,
    );

    if (validation.valid) {
      const newConn: ModularConnection = {
        id: `c-${Date.now()}`,
        fromNodeId: pending.fromNodeId,
        fromJackId: pending.fromJack.id,
        toNodeId: targetNode.id,
        toJackId: targetJack.id,
        color: pending.fromJack.type === "control" ? "#ffaa00" : "#00f0ff",
      };

      setGraph((prev) => ({
        ...prev,
        connections: [...prev.connections, newConn],
      }));
      setModularGraph(graph());
    }
    setPendingCable(null);
  };

  const deleteConnection = (connId: string) => {
    setGraph((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== connId),
    }));
    setModularGraph(graph());
  };

  const getNodeJackCoords = (nodeId: string, jackId: string) => {
    const node = graph().nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    // Estimate socket position on node
    const isOutput = node.outputs.some((j) => j.id === jackId);
    return {
      x: isOutput ? node.x + 155 : node.x + 15,
      y: node.y + 115,
    };
  };

  return (
    <Portal>
      <dialog
        ref={dialogRef}
        class="modular-dialog"
        role="dialog"
        aria-label="Modular Audio Node Canvas"
      >
        {/* Header */}
        <div class="modular-header">
          <div class="modular-title-wrap">
            <IconModular size={18} />
            <span class="modular-title">MODULAR AUDIO NODE CANVAS // MAX/MSP PATCHBAY</span>
          </div>

          <div class="modular-actions">
            <button
              type="button"
              class="slicer-btn"
              style={{ padding: "4px 8px" }}
              aria-label="Close Modular Canvas"
              onClick={props.onClose}
            >
              <IconClose size={12} />
            </button>
          </div>
        </div>

        {/* Interactive Canvas */}
        <div
          ref={canvasRef}
          class="modular-canvas"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* SVG Patch Cords Layer */}
          <svg class="modular-cables-svg">
            <For each={graph().connections}>
              {(conn) => {
                const start = () => getNodeJackCoords(conn.fromNodeId, conn.fromJackId);
                const end = () => getNodeJackCoords(conn.toNodeId, conn.toJackId);
                return (
                  <path
                    d={computePatchCablePath(start().x, start().y, end().x, end().y)}
                    stroke={conn.color || "#00f0ff"}
                    class="patch-cable"
                    onClick={() => deleteConnection(conn.id)}
                  >
                    <title>Click to disconnect cable</title>
                  </path>
                );
              }}
            </For>

            {/* Pending Cable currently being dragged */}
            <Show when={pendingCable()}>
              {(pending) => (
                <path
                  d={computePatchCablePath(
                    pending().startX,
                    pending().startY,
                    pending().currentX,
                    pending().currentY,
                  )}
                  stroke={pending().fromJack.type === "control" ? "#ffaa00" : "#00f0ff"}
                  stroke-dasharray="4 4"
                  class="patch-cable"
                />
              )}
            </Show>
          </svg>

          {/* Draggable Modular Audio Nodes */}
          <For each={graph().nodes}>
            {(node) => (
              <div
                class="modular-node"
                classList={{ "is-selected": selectedNodeId() === node.id }}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }}
                onClick={() => setSelectedNodeId(node.id)}
              >
                {/* Node Title & Drag Handle */}
                <div
                  class="modular-node-header"
                  onMouseDown={(e) => handlePointerDownHeader(e, node.id)}
                >
                  <span>{node.title}</span>
                  <span class="modular-node-type">{node.type}</span>
                </div>

                <div class="modular-node-body">
                  {/* Parameter Controls */}
                  <div class="modular-node-params">
                    <For each={Object.entries(node.params)}>
                      {([paramName, value]) => (
                        <div class="modular-param-row">
                          <span>{paramName.toUpperCase()}</span>
                          <Show
                            when={typeof value === "number"}
                            fallback={<span>{String(value)}</span>}
                          >
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={Number(value) * 10}
                            />
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>

                  {/* Input & Output Jacks */}
                  <div class="modular-jacks-row">
                    {/* Inputs */}
                    <div class="modular-jacks-col">
                      <For each={node.inputs}>
                        {(jack) => (
                          <div class="modular-jack-item">
                            <div
                              class="modular-jack-socket"
                              classList={{
                                "type-audio": jack.type === "audio",
                                "type-control": jack.type === "control",
                              }}
                              onMouseUp={(e) => handleJackEnd(e, node, jack)}
                            />
                            <span>{jack.name}</span>
                          </div>
                        )}
                      </For>
                    </div>

                    {/* Outputs */}
                    <div class="modular-jacks-col" style={{ "align-items": "flex-end" }}>
                      <For each={node.outputs}>
                        {(jack) => (
                          <div class="modular-jack-item">
                            <span>{jack.name}</span>
                            <div
                              class="modular-jack-socket"
                              classList={{
                                "type-audio": jack.type === "audio",
                                "type-control": jack.type === "control",
                              }}
                              onMouseDown={(e) => handleJackStart(e, node, jack)}
                            />
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </dialog>
    </Portal>
  );
}
