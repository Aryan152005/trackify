"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import type { Block } from "@blocknote/core";

interface BlockEditorProps {
  initialContent?: unknown[];
  onChange?: (content: unknown[]) => void;
  editable?: boolean;
}

export function BlockEditor({
  initialContent,
  onChange,
  editable = true,
}: BlockEditorProps) {
  const { resolvedTheme } = useTheme();

  const parsedContent = useMemo(() => {
    if (!initialContent || !Array.isArray(initialContent) || initialContent.length === 0) {
      return undefined;
    }
    return initialContent as Block[];
  }, [initialContent]);

  const editor = useCreateBlockNote({
    initialContent: parsedContent,
  });

  return (
    <div className="bn-container">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={() => {
          onChange?.(editor.document as unknown[]);
        }}
      />
    </div>
  );
}
