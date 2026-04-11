"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Board } from "@/lib/types/board";

interface BoardHeaderProps {
  board: Board;
  onAddColumn: () => void;
  onEditBoard: (name: string, description: string) => void;
}

export function BoardHeader({ board, onAddColumn, onEditBoard }: BoardHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(board.name);
    setDescription(board.description ?? "");
  }, [board.name, board.description]);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (editingDesc) descRef.current?.focus();
  }, [editingDesc]);

  const commitName = useCallback(() => {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== board.name) {
      onEditBoard(trimmed, description);
    } else {
      setName(board.name);
    }
  }, [name, description, board.name, onEditBoard]);

  const commitDesc = useCallback(() => {
    setEditingDesc(false);
    const trimmed = description.trim();
    if (trimmed !== (board.description ?? "")) {
      onEditBoard(name, trimmed);
    } else {
      setDescription(board.description ?? "");
    }
  }, [name, description, board.description, onEditBoard]);

  return (
    <div className="flex items-start justify-between gap-4 pb-4">
      <div className="min-w-0 flex-1">
        {/* Board name */}
        {editingName ? (
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setName(board.name);
                setEditingName(false);
              }
            }}
            className="w-full rounded-md border border-indigo-300 bg-transparent px-1 text-2xl font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-600 dark:text-zinc-50"
          />
        ) : (
          <h1
            className="cursor-pointer truncate rounded-md px-1 text-2xl font-bold text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => setEditingName(true)}
            title="Click to edit board name"
          >
            {board.name}
          </h1>
        )}

        {/* Description */}
        {editingDesc ? (
          <input
            ref={descRef}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDesc();
              if (e.key === "Escape") {
                setDescription(board.description ?? "");
                setEditingDesc(false);
              }
            }}
            placeholder="Add a description..."
            className="mt-1 w-full rounded-md border border-indigo-300 bg-transparent px-1 text-sm text-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-600 dark:text-zinc-400"
          />
        ) : (
          <p
            className="mt-1 cursor-pointer truncate rounded-md px-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            onClick={() => setEditingDesc(true)}
            title="Click to edit description"
          >
            {board.description || "Add a description..."}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Member filter (placeholder) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          <Users className="h-3.5 w-3.5" />
          Members
        </Button>

        {/* Add column */}
        <Button size="sm" className="gap-1.5" onClick={onAddColumn}>
          <Plus className="h-3.5 w-3.5" />
          Add Column
        </Button>
      </div>
    </div>
  );
}
