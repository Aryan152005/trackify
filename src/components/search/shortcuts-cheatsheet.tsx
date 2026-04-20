"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Keyboard-shortcut cheatsheet. Opens when the user presses `?` anywhere
 * outside a text input. Linear-style overlay — groups shortcuts by
 * section and shows the key chord using styled <kbd> tags.
 *
 * Shortcuts are documented here, NOT implemented here. Actual bindings
 * live in:
 *   - CommandPalette (Cmd+K) — command-palette.tsx
 *   - GlobalCaptureFab (C) — global-capture-fab.tsx
 *   - ShortcutsCheatsheet (?) — this file
 * Keeping the docs + bindings decoupled means we don't have to re-wire
 * the whole thing every time we add a binding. If you add a new binding
 * somewhere, update this list too.
 */

interface Shortcut {
  keys: string[]; // key chord, e.g. ["⌘", "K"] or ["G", "T"]
  label: string;
  hint?: string;
}

interface Group {
  title: string;
  items: Shortcut[];
}

const GROUPS: Group[] = [
  {
    title: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette", hint: "Ctrl+K on Windows/Linux" },
      { keys: ["?"], label: "Show this cheatsheet" },
      { keys: ["C"], label: "Quick capture (task / reminder / event)" },
      { keys: ["Esc"], label: "Close any open dialog / drawer" },
    ],
  },
  {
    title: "Navigate",
    items: [
      { keys: ["G", "T"], label: "Go to Today" },
      { keys: ["G", "I"], label: "Go to Inbox" },
      { keys: ["G", "K"], label: "Go to Tasks" },
      { keys: ["G", "N"], label: "Go to Notes" },
      { keys: ["G", "B"], label: "Go to Boards" },
      { keys: ["G", "D"], label: "Go to Dashboard" },
      { keys: ["G", "P"], label: "Go to Preferences" },
    ],
  },
  {
    title: "Create",
    items: [
      { keys: ["C", "T"], label: "New task" },
      { keys: ["C", "N"], label: "New note" },
      { keys: ["C", "R"], label: "New reminder" },
      { keys: ["C", "E"], label: "New work entry" },
      { keys: ["C", "B"], label: "New board" },
    ],
  },
  {
    title: "Inside lists & editors",
    items: [
      { keys: ["Enter"], label: "Open selected item" },
      { keys: ["↑"], label: "Move up" },
      { keys: ["↓"], label: "Move down" },
      { keys: ["⌘", "Enter"], label: "Submit a comment / reply" },
    ],
  },
];

// ── keyboard listener hook ─────────────────────────────────────────

function useShortcutListener(
  onTrigger: () => void,
  onNavigate?: (chord: string) => void,
) {
  useEffect(() => {
    // Buffer for chord detection (e.g. "G" then "T" = Go to Today).
    // Reset after 1.2s idle or on any input focus.
    let buffer = "";
    let bufferTimer: ReturnType<typeof setTimeout> | null = null;

    function resetBuffer() {
      buffer = "";
      if (bufferTimer) clearTimeout(bufferTimer);
      bufferTimer = null;
    }

    function handleKey(e: KeyboardEvent) {
      // Skip when the user is typing in a form field.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      // Modifier-less key handling only (Cmd+K is owned by the palette).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // `?` → open cheatsheet
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        onTrigger();
        resetBuffer();
        return;
      }

      // Accept letter keys only for chords.
      const k = e.key.toUpperCase();
      if (!/^[A-Z]$/.test(k)) {
        resetBuffer();
        return;
      }

      // Grow buffer, check for a known 2-char chord.
      buffer += k;
      if (bufferTimer) clearTimeout(bufferTimer);
      bufferTimer = setTimeout(resetBuffer, 1200);

      if (buffer.length === 2) {
        onNavigate?.(buffer);
        resetBuffer();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (bufferTimer) clearTimeout(bufferTimer);
    };
  }, [onTrigger, onNavigate]);
}

// ── component ─────────────────────────────────────────────────────

/** Map of 2-char chords to their navigation target. Kept in sync
 *  with the shortcut labels above — if you add a `G X` entry, add it
 *  here too. */
const CHORD_ROUTES: Record<string, string> = {
  GT: "/today",
  GI: "/inbox",
  GK: "/tasks",
  GN: "/notes",
  GB: "/boards",
  GD: "/dashboard",
  GP: "/settings/preferences",
  GR: "/reminders",
  GC: "/calendar",
  GM: "/mindmaps",
  CT: "/tasks/new",
  CN: "/notes/new",
  CR: "/reminders/new",
  CE: "/entries/new",
  CB: "/boards/new",
};

export function ShortcutsCheatsheet() {
  const [open, setOpen] = useState(false);

  useShortcutListener(
    () => setOpen(true),
    (chord) => {
      const target = CHORD_ROUTES[chord];
      if (target && typeof window !== "undefined") {
        // Use full navigation (pushState is fine, but replacing lets the
        // back button work as expected after a chord hit).
        window.location.href = target;
      }
    },
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="sheet-on-mobile fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                <Keyboard className="h-4 w-4 text-indigo-500" />
                Keyboard shortcuts
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Press the key combo anywhere outside a text field.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid max-h-[70vh] gap-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <section key={g.title}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {g.title}
                </h3>
                <ul className="space-y-1.5">
                  {g.items.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                        {s.label}
                        {s.hint && (
                          <span className="ml-1 text-[11px] text-zinc-400">({s.hint})</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {s.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className={cn(
                              "rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]",
                              "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                            )}
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50/60 px-5 py-2.5 text-center text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            Everything else is in the command palette — hit <kbd className="rounded border border-zinc-200 bg-white px-1 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-800">⌘K</kbd>.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
