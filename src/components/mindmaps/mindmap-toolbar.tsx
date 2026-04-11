"use client";

import React from "react";
import { Plus, Trash2, LayoutGrid, Maximize } from "lucide-react";

interface MindMapToolbarProps {
  onAddNode: () => void;
  onDeleteSelected: () => void;
  onAutoLayout: () => void;
  onZoomFit: () => void;
}

export function MindMapToolbar({
  onAddNode,
  onDeleteSelected,
  onAutoLayout,
  onZoomFit,
}: MindMapToolbarProps) {
  const buttons = [
    {
      icon: Plus,
      label: "Add Node",
      onClick: onAddNode,
    },
    {
      icon: Trash2,
      label: "Delete Selected",
      onClick: onDeleteSelected,
    },
    {
      icon: LayoutGrid,
      label: "Auto Layout",
      onClick: onAutoLayout,
    },
    {
      icon: Maximize,
      label: "Zoom to Fit",
      onClick: onZoomFit,
    },
  ];

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/90">
        {buttons.map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            title={label}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
