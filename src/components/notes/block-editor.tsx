"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useTheme } from "next-themes";
import { useMemo, useCallback, useEffect, useRef } from "react";
import type { Block } from "@blocknote/core";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useYjsDoc } from "@/lib/collab/use-yjs-doc";

interface BlockEditorProps {
  /** Page id — when provided, the editor mounts Yjs collaboration. */
  pageId?: string;
  /** Legacy JSON content, used as seed if the Y doc is empty. */
  initialContent?: unknown[];
  onChange?: (content: unknown[]) => void;
  editable?: boolean;
}

const BUCKET = "entry-attachments"; // reused public bucket (see migration 005)
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export function BlockEditor({
  pageId,
  initialContent,
  onChange,
  editable = true,
}: BlockEditorProps) {
  const { resolvedTheme } = useTheme();

  // Mount Yjs doc + provider when we have a pageId. Notes collab is now CRDT-
  // backed, so two users editing simultaneously merge via operational
  // transform instead of overwriting each other on the next autosave.
  const { doc: yDoc, provider, ready: yReady, self } = useYjsDoc({
    entity: "pages",
    id: pageId ?? "",
    enabled: !!pageId,
  });

  const yFragment = useMemo(() => {
    if (!yDoc) return null;
    return yDoc.getXmlFragment("doc");
  }, [yDoc]);

  const parsedContent = useMemo(() => {
    if (!initialContent || !Array.isArray(initialContent) || initialContent.length === 0) {
      return undefined;
    }
    return initialContent as Block[];
  }, [initialContent]);

  // Upload dropped/pasted images to Supabase Storage and return the public URL.
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

  // Create the editor. When we have a Yjs fragment, hand it to BlockNote's
  // collaboration extension; otherwise fall back to local-only mode.
  const editor = useCreateBlockNote(
    pageId
      ? yFragment && provider
        ? {
            uploadFile,
            collaboration: {
              provider: { awareness: provider.awareness },
              fragment: yFragment,
              user: { name: self.name, color: self.color },
            },
          }
        : undefined // wait for Yjs to mount — avoids a local-first editor that gets swapped out
      : {
          // No pageId (shouldn't happen in production, but keep a safety net):
          // single-user mode with the legacy content.
          initialContent: parsedContent,
          uploadFile,
        },
    [pageId, yFragment, provider],
  );

  // One-time seed: when the Y doc is empty and we have legacy JSON, write
  // it into the editor so the first Yjs update carries the existing content.
  // Afterwards Yjs is the source of truth.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!editor || !yReady || !yFragment) return;
    if (!parsedContent || parsedContent.length === 0) return;
    // If the fragment already has child nodes, the content was loaded from
    // the Y state column — don't re-seed.
    if (yFragment.length > 0) {
      seededRef.current = true;
      return;
    }
    try {
      editor.replaceBlocks(editor.document, parsedContent);
      seededRef.current = true;
    } catch {
      // editor not fully mounted yet — the next effect tick will retry.
    }
  }, [editor, yReady, yFragment, parsedContent]);

  // Still emit change events so the page's existing debounced-JSON save
  // keeps populating `pages.content` for exports and pre-Yjs viewers.
  const handleChange = useCallback(() => {
    if (!editor) return;
    onChange?.(editor.document as unknown[]);
  }, [editor, onChange]);

  // Show a subtle loading state while Yjs is wiring up.
  if (pageId && !yReady) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        Syncing…
      </div>
    );
  }
  if (!editor) return null;

  return (
    <div className="bn-container">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={handleChange}
      />
    </div>
  );
}
