"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useTheme } from "next-themes";
import { useMemo, useCallback } from "react";
import type { Block } from "@blocknote/core";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface BlockEditorProps {
  initialContent?: unknown[];
  onChange?: (content: unknown[]) => void;
  editable?: boolean;
}

const BUCKET = "entry-attachments"; // reused public bucket (see migration 005)
// Bucket caps at 5MB (set in migration 005) and accepts jpeg/png/gif/webp/pdf.
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

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

  // Upload dropped/pasted images to Supabase Storage and return the public URL.
  // BlockNote calls this automatically when a user drags an image into the
  // editor, pastes from clipboard, or uses the file picker — no more URL-embed
  // prompts.
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (file.size > MAX_SIZE) {
      toast.error(`File too large (max ${MAX_SIZE / 1024 / 1024}MB)`);
      throw new Error("File too large");
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      toast.error(`Unsupported file type (${file.type}). Allowed: JPEG/PNG/GIF/WebP/PDF.`);
      throw new Error("Unsupported type");
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in to upload files");
      throw new Error("Not authenticated");
    }
    // Path MUST start with user.id — matches the RLS policy in migration 005
    // (first folder must equal auth.uid()).
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${user.id}/notes/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      throw error;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const editor = useCreateBlockNote({
    initialContent: parsedContent,
    uploadFile,
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
