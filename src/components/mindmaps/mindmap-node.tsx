"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

interface MindMapNodeData {
  label: string;
  color?: string;
  description?: string;
}

export function MindMapNodeComponent({ data, selected }: NodeProps<MindMapNodeData>) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const color = data.color || "#6366f1";

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback(() => {
    setEditing(true);
  }, []);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (label.trim()) {
      data.label = label.trim();
    } else {
      setLabel(data.label);
    }
  }, [label, data]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      }
      if (e.key === "Escape") {
        setLabel(data.label);
        setEditing(false);
      }
    },
    [handleSave, data.label]
  );

  return (
    <div
      className="group relative"
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-zinc-400 dark:!border-zinc-900 dark:!bg-zinc-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-zinc-400 dark:!border-zinc-900 dark:!bg-zinc-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-zinc-400 dark:!border-zinc-900 dark:!bg-zinc-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-zinc-400 dark:!border-zinc-900 dark:!bg-zinc-500"
      />

      {/* Node body */}
      <div
        className="min-w-[150px] rounded-xl px-4 py-3 shadow-md transition-shadow"
        style={{
          backgroundColor: color + "18",
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: selected ? color : color + "60",
          boxShadow: selected
            ? `0 0 0 2px ${color}40, 0 4px 12px ${color}20`
            : `0 2px 8px rgba(0,0,0,0.08)`,
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-sm font-medium text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="block text-center text-sm font-semibold"
            style={{ color }}
          >
            {data.label}
          </span>
        )}

        {data.description && !editing && (
          <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {data.description}
          </p>
        )}
      </div>
    </div>
  );
}
