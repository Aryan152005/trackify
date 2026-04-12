"use client";

import React, { useCallback, useRef, useMemo, useEffect } from "react";
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Viewport,
  type Node,
  type Edge,
  BackgroundVariant,
  ConnectionMode,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import { MindMapNodeComponent } from "./mindmap-node";
import { MindMapToolbar } from "./mindmap-toolbar";
import type { MindMapNode, MindMapEdge } from "@/lib/types/mindmap";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MindMapCanvasProps {
  initialNodes: MindMapNode[];
  initialEdges: MindMapEdge[];
  initialViewport?: { x: number; y: number; zoom: number };
  onNodesChange: (nodes: MindMapNode[]) => void;
  onEdgesChange: (edges: MindMapEdge[]) => void;
  onViewportChange: (viewport: { x: number; y: number; zoom: number }) => void;
}

// ---------------------------------------------------------------------------
// Node types map (must be defined outside component to avoid re-creating)
// ---------------------------------------------------------------------------

const nodeTypes = {
  mindmapNode: MindMapNodeComponent,
};

// ---------------------------------------------------------------------------
// Default edge options
// ---------------------------------------------------------------------------

const defaultEdgeOptions = {
  type: "smoothstep",
  animated: true,
  style: { stroke: "#6366f1", strokeWidth: 2 },
};

// ---------------------------------------------------------------------------
// Inner canvas (needs ReactFlowProvider above it)
// ---------------------------------------------------------------------------

function MindMapCanvasInner({
  initialNodes,
  initialEdges,
  initialViewport,
  onNodesChange: onNodesChangeProp,
  onEdgesChange: onEdgesChangeProp,
  onViewportChange,
}: MindMapCanvasProps) {
  const reactFlowInstance = useReactFlow();

  // Convert initial nodes to have the correct type
  const rfInitialNodes: Node[] = useMemo(
    () =>
      initialNodes.map((n) => ({
        ...n,
        type: n.type || "mindmapNode",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const rfInitialEdges: Edge[] = useMemo(
    () =>
      initialEdges.map((e) => ({
        ...e,
        type: e.type || "smoothstep",
        animated: e.animated ?? true,
        style: e.style
          ? (e.style as React.CSSProperties)
          : { stroke: "#6366f1", strokeWidth: 2 },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes, handleNodesChange] = useNodesState(rfInitialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(rfInitialEdges);

  const nodeIdCounter = useRef(
    Math.max(
      0,
      ...initialNodes.map((n) => {
        const num = parseInt(n.id.replace(/\D/g, ""), 10);
        return isNaN(num) ? 0 : num;
      })
    ) + 1
  );

  // Sync changes back to parent
  const syncNodes = useCallback(
    (updatedNodes: Node[]) => {
      const mapped: MindMapNode[] = updatedNodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data as MindMapNode["data"],
      }));
      onNodesChangeProp(mapped);
    },
    [onNodesChangeProp]
  );

  const syncEdges = useCallback(
    (updatedEdges: Edge[]) => {
      const mapped: MindMapEdge[] = updatedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        animated: e.animated,
        style: e.style as Record<string, unknown> | undefined,
      }));
      onEdgesChangeProp(mapped);
    },
    [onEdgesChangeProp]
  );

  const onNodesChangeHandler = useCallback(
    (changes: NodeChange[]) => {
      handleNodesChange(changes);
    },
    [handleNodesChange]
  );

  const onEdgesChangeHandler = useCallback(
    (changes: EdgeChange[]) => {
      handleEdgesChange(changes);
    },
    [handleEdgesChange]
  );

  // Sync node/edge changes to parent via effects — avoids the "setState during
  // render" warning that happens when a parent setter is called inside a child's
  // setState updater function. Skip the first run so we don't immediately write
  // the initial props back to the parent.
  const isFirstNodesSync = useRef(true);
  useEffect(() => {
    if (isFirstNodesSync.current) {
      isFirstNodesSync.current = false;
      return;
    }
    syncNodes(nodes);
  }, [nodes, syncNodes]);

  const isFirstEdgesSync = useRef(true);
  useEffect(() => {
    if (isFirstEdgesSync.current) {
      isFirstEdgesSync.current = false;
      return;
    }
    syncEdges(edges);
  }, [edges, syncEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          },
          eds
        )
      );
      // Parent sync happens via the useEffect below.
    },
    [setEdges]
  );

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      onViewportChange({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
    },
    [onViewportChange]
  );

  // -------------------------------------------------------------------------
  // Toolbar actions
  // -------------------------------------------------------------------------

  const handleAddNode = useCallback(() => {
    const id = `node-${nodeIdCounter.current++}`;
    // Place near center of the current viewport
    const position = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode: Node = {
      id,
      type: "mindmapNode",
      position: { x: position.x - 75, y: position.y - 25 },
      data: { label: "New Idea", color: "#6366f1" },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  const handleDeleteSelected = useCallback(() => {
    setNodes((nds) => {
      const selected = nds.filter((n) => n.selected).map((n) => n.id);
      if (selected.length === 0) return nds;
      const remaining = nds.filter((n) => !n.selected);
      // Remove edges connected to deleted nodes — safe inside this setter because
      // it only mutates child state; parent sync runs via useEffect.
      setEdges((eds) =>
        eds.filter((e) => !selected.includes(e.source) && !selected.includes(e.target))
      );
      return remaining;
    });
  }, [setNodes, setEdges]);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => {
      if (nds.length === 0) return nds;
      const cols = Math.ceil(Math.sqrt(nds.length));
      const spacingX = 220;
      const spacingY = 120;
      return nds.map((node, i) => ({
        ...node,
        position: {
          x: (i % cols) * spacingX,
          y: Math.floor(i / cols) * spacingY,
        },
      }));
    });
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }, 50);
  }, [setNodes, reactFlowInstance]);

  const handleZoomFit = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
  }, [reactFlowInstance]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={onConnect}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={initialViewport ?? { x: 0, y: 0, zoom: 1 }}
        fitView={!initialViewport}
        snapToGrid
        snapGrid={[16, 16]}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-zinc-50 dark:bg-zinc-950"
      >
        <Controls
          className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800 [&>button]:border-zinc-200 [&>button]:bg-white [&>button]:text-zinc-600 [&>button]:hover:bg-zinc-100 dark:[&>button]:border-zinc-700 dark:[&>button]:bg-zinc-800 dark:[&>button]:text-zinc-300 dark:[&>button]:hover:bg-zinc-700"
        />
        <MiniMap
          nodeColor="#6366f1"
          maskColor="rgba(0,0,0,0.1)"
          className="rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-700"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d4d4d8"
          className="dark:opacity-30"
        />
      </ReactFlow>

      <MindMapToolbar
        onAddNode={handleAddNode}
        onDeleteSelected={handleDeleteSelected}
        onAutoLayout={handleAutoLayout}
        onZoomFit={handleZoomFit}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper with ReactFlowProvider
// ---------------------------------------------------------------------------

export function MindMapCanvas(props: MindMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <MindMapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
