"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, Loader2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  renderTemplatePreview,
  type TemplateId,
  type TemplateFields,
} from "@/lib/admin/template-actions";
import type { RenderedEmail } from "@/lib/admin/preview-actions";

interface SelectedUser {
  id: string;
  email: string;
  name: string;
}

interface Props {
  selected: SelectedUser[];
  onPreview: (payload: RenderedEmail) => void;
  onClear: () => void;
  onDeselect: (userId: string) => void;
}

const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: "invite", name: "✨ Platform Invitation", desc: "Marketing invite with hero banner, features, CTA" },
  { id: "notification", name: "Custom Notification", desc: "Free-form subject + message" },
  { id: "new-feature", name: "New Feature Announcement", desc: "Announce a new feature with CTA" },
  { id: "maintenance", name: "Maintenance Notice", desc: "Scheduled downtime" },
];

export function TargetedEmailComposer({ selected, onPreview, onClear, onDeselect }: Props) {
  const [templateId, setTemplateId] = useState<TemplateId>("invite");
  const [fields, setFields] = useState<Record<string, string>>({
    subject: "",
    message: "",
    recipientName: "",
    inviterName: "",
    inviteCtaUrl: "",
    featureName: "",
    description: "",
    ctaText: "",
    ctaUrl: "",
    scheduledTime: "",
    duration: "",
    details: "",
  });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedRecipients, setCopiedRecipients] = useState(false);

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function getCurrentFields(): TemplateFields[TemplateId] | null {
    switch (templateId) {
      case "invite": {
        const ctaUrl = fields.inviteCtaUrl.trim() || (typeof window !== "undefined" ? `${window.location.origin}/signup` : "https://trackify.app/signup");
        return {
          recipientName: fields.recipientName.trim(),
          inviterName: fields.inviterName.trim(),
          ctaUrl,
        };
      }
      case "notification":
        if (!fields.subject.trim() || !fields.message.trim()) return null;
        return { subject: fields.subject, message: fields.message };
      case "new-feature":
        if (!fields.featureName.trim() || !fields.description.trim() || !fields.ctaText.trim() || !fields.ctaUrl.trim()) return null;
        return {
          featureName: fields.featureName,
          description: fields.description,
          ctaText: fields.ctaText,
          ctaUrl: fields.ctaUrl,
        };
      case "maintenance":
        if (!fields.scheduledTime.trim() || !fields.duration.trim() || !fields.details.trim()) return null;
        return { scheduledTime: fields.scheduledTime, duration: fields.duration, details: fields.details };
      case "welcome":
        return null;
    }
  }

  const filled = getCurrentFields();
  const canPreview = !!filled && selected.length > 0;
  const recipientList = selected.map((u) => u.email).join(", ");
  const tmplMeta = TEMPLATES.find((t) => t.id === templateId)!;

  async function handlePreview() {
    if (!filled) return;
    setLoadingPreview(true);
    try {
      // Preview rendered for the first selected user (same HTML sent via BCC to all)
      const rendered = await renderTemplatePreview(templateId, filled, selected[0].email);
      onPreview(rendered);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
    setLoadingPreview(false);
  }

  async function copyRecipients() {
    try {
      await navigator.clipboard.writeText(recipientList);
      setCopiedRecipients(true);
      setTimeout(() => setCopiedRecipients(false), 2000);
    } catch {
      toast.error("Clipboard blocked. Copy the emails manually from the chips above.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Email {selected.length} selected user{selected.length === 1 ? "" : "s"}</CardTitle>
            <CardDescription>
              Pick a template, fill fields, preview, then copy the HTML and paste the recipient list into your mail client&apos;s <strong>BCC</strong> field.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear selection
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recipients */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Recipients</label>
            <Button type="button" variant="outline" size="sm" onClick={copyRecipients}>
              {copiedRecipients ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copiedRecipients ? "Copied" : "Copy all emails"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
            {selected.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-indigo-700 ring-1 ring-indigo-200 dark:bg-zinc-900 dark:text-indigo-300 dark:ring-indigo-900/50"
              >
                {u.email}
                <button
                  type="button"
                  onClick={() => onDeselect(u.id)}
                  className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  aria-label={`Remove ${u.email}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Template picker */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Template</label>
          <Select value={templateId} onValueChange={(v) => setTemplateId(v as TemplateId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tmplMeta.desc}</p>
        </div>

        {/* Template-specific fields */}
        {templateId === "invite" && (
          <>
            <Alert type="info">
              Sent via BCC to all selected users, so the recipient name is generic. Leave &quot;Recipient Name&quot; blank for a neutral &quot;Hi there&quot;.
            </Alert>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Recipient Name (optional)" value={fields.recipientName} onChange={(v) => setField("recipientName", v)} placeholder="leave blank for BCC" />
              <TextField label="Inviter Name (optional)" value={fields.inviterName} onChange={(v) => setField("inviterName", v)} placeholder="Aryan" />
            </div>
            <TextField label="Signup URL" value={fields.inviteCtaUrl} onChange={(v) => setField("inviteCtaUrl", v)} placeholder="https://trackify.app/signup" type="url" />
          </>
        )}

        {templateId === "notification" && (
          <>
            <TextField label="Subject" value={fields.subject} onChange={(v) => setField("subject", v)} placeholder="Quick update" />
            <TextArea label="Message" value={fields.message} onChange={(v) => setField("message", v)} placeholder="Plain text. Line breaks preserved." rows={5} />
          </>
        )}

        {templateId === "new-feature" && (
          <>
            <TextField label="Feature Name" value={fields.featureName} onChange={(v) => setField("featureName", v)} placeholder="Mind Maps" />
            <TextArea label="Description" value={fields.description} onChange={(v) => setField("description", v)} rows={3} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="CTA Text" value={fields.ctaText} onChange={(v) => setField("ctaText", v)} placeholder="Try it now" />
              <TextField label="CTA URL" value={fields.ctaUrl} onChange={(v) => setField("ctaUrl", v)} placeholder="https://trackify.app/…" type="url" />
            </div>
          </>
        )}

        {templateId === "maintenance" && (
          <>
            <TextField label="Scheduled Time" value={fields.scheduledTime} onChange={(v) => setField("scheduledTime", v)} placeholder="Sat, April 20 at 2:00 AM UTC" />
            <TextField label="Duration" value={fields.duration} onChange={(v) => setField("duration", v)} placeholder="30 minutes" />
            <TextArea label="Details" value={fields.details} onChange={(v) => setField("details", v)} rows={3} />
          </>
        )}

        <div className="flex justify-end">
          <Button type="button" disabled={!canPreview || loadingPreview} onClick={handlePreview}>
            {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Preview &amp; copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TextField({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
      />
    </div>
  );
}

function TextArea({
  label, value, onChange, placeholder, rows = 4,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
      />
    </div>
  );
}
