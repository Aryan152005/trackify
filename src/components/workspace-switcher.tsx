"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace/hooks";
import { createWorkspace } from "@/lib/workspace/actions";
import { ChevronDown, Plus, Building2, Loader2, Check } from "lucide-react";

export function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const ws = await createWorkspace(newName.trim());
      toast.success(`Workspace "${ws.name}" created`);
      switchWorkspace(ws.id);
      setCreating(false);
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create workspace");
    } finally {
      setBusy(false);
    }
  }

  if (!workspace) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Current workspace: ${workspace.name}. Click to switch.`}
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
      >
        <Building2 className="h-4 w-4 text-zinc-500" />
        <span className="max-w-[180px] truncate">{workspace.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Workspaces
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  switchWorkspace(ws.id);
                  setOpen(false);
                }}
                className={`flex min-h-[40px] w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition ${
                  ws.id === workspace.id
                    ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate">{ws.name}</span>
                {ws.is_personal && (
                  <span className="ml-auto text-[10px] font-medium text-zinc-400">Personal</span>
                )}
                {ws.id === workspace.id && (
                  <Check className="ml-auto h-3.5 w-3.5 text-indigo-500" />
                )}
              </button>
            ))}

            <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />

            {creating ? (
              <form onSubmit={handleCreate} className="p-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-2 flex gap-1">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName(""); }}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                New workspace
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
