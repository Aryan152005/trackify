"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export interface EmailPreviewPayload {
  to: string;
  subject: string;
  html: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: EmailPreviewPayload | null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function EmailPreviewDialog({ open, onOpenChange, payload }: Props) {
  const [copied, setCopied] = useState<"html" | "text" | "to" | "subject" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!payload) return null;

  const text = htmlToText(payload.html);
  const mailtoHref = `mailto:${encodeURIComponent(payload.to)}?subject=${encodeURIComponent(
    payload.subject
  )}&body=${encodeURIComponent(text)}`;

  async function copy(kind: "html" | "text" | "to" | "subject") {
    try {
      if (kind === "html") {
        // Write BOTH text/html and text/plain. When the target paste context
        // is a rich editor (Gmail, Outlook, Apple Mail), it consumes text/html
        // and the rendered email appears with full formatting. Plain-text
        // editors fall back to the text/plain variant.
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          const htmlBlob = new Blob([payload!.html], { type: "text/html" });
          const textBlob = new Blob([text], { type: "text/plain" });
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": htmlBlob,
              "text/plain": textBlob,
            }),
          ]);
        } else {
          // Firefox / older browsers: copy-from-live-DOM fallback that
          // retains rendered HTML via execCommand('copy') on a temporary
          // contenteditable container.
          const container = document.createElement("div");
          container.setAttribute("contenteditable", "true");
          container.style.position = "fixed";
          container.style.left = "-9999px";
          container.innerHTML = payload!.html;
          document.body.appendChild(container);
          const range = document.createRange();
          range.selectNodeContents(container);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          document.execCommand("copy");
          sel?.removeAllRanges();
          document.body.removeChild(container);
        }
      } else {
        const val =
          kind === "text" ? text
          : kind === "to" ? payload!.to
          : payload!.subject;
        await navigator.clipboard.writeText(val);
      }
      setCopied(kind);
      setCopyError(null);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyError("Clipboard blocked. Select the preview and copy manually with ⌘/Ctrl+C.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900"
          style={{ maxHeight: "90vh" }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Email preview — copy &amp; send manually
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Copy any field below, or open in your mail app to send.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-3 space-y-1.5">
              <FieldRow
                label="To"
                value={payload.to}
                mono
                copied={copied === "to"}
                onCopy={() => copy("to")}
              />
              <FieldRow
                label="Subject"
                value={payload.subject}
                copied={copied === "subject"}
                onCopy={() => copy("subject")}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <iframe
                title="Email preview"
                srcDoc={payload.html}
                sandbox=""
                className="h-[50vh] w-full border-0 bg-white"
              />
            </div>

            {copyError && (
              <div className="mt-3">
                <Alert type="error">{copyError}</Alert>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <strong>Copy HTML</strong> keeps the design. Paste directly into Gmail / Outlook / Apple Mail compose — the rendered email appears with logo, buttons, colors.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copy("text")}>
                {copied === "text" ? <Check className="mr-1.5 h-4 w-4 text-green-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied === "text" ? "Copied" : "Copy Text"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => copy("html")}>
                {copied === "html" ? <Check className="mr-1.5 h-4 w-4 text-green-600" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied === "html" ? "Copied" : "Copy HTML"}
              </Button>
              <a href={mailtoHref}>
                <Button size="sm" type="button">
                  <Mail className="mr-1.5 h-4 w-4" />
                  Open in Mail App
                </Button>
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FieldRow({
  label, value, mono, copied, onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className={`flex-1 truncate text-zinc-800 dark:text-zinc-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      <button
        type="button"
        onClick={onCopy}
        className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
