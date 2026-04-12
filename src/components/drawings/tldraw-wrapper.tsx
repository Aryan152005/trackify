"use client";

import { useCallback, useEffect, useRef } from "react";
import { Tldraw, type Editor } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

interface TldrawWrapperProps {
  initialData?: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>) => void;
}

export function TldrawWrapper({ initialData, onChange }: TldrawWrapperProps) {
  const editorRef = useRef<Editor | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(() => {
    if (!editorRef.current || !onChange) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      try {
        const snapshot = editorRef.current.store.getStoreSnapshot();
        onChange(snapshot as unknown as Record<string, unknown>);
      } catch {
        // silently handle serialization errors
      }
    }, 2000);
  }, [onChange]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      // Listen for store changes
      editor.store.listen(handleChange, { source: "user", scope: "document" });
    },
    [handleChange]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative h-[calc(100dvh-10rem)] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
      style={{ minHeight: 520 }}
    >
      {/* Tldraw requires an absolutely-positioned parent with explicit height
          to render its floating toolbars (pen/eraser/colors/shapes/etc.). */}
      <div className="absolute inset-0">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
