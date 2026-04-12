"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  renderTemplatePreview,
  type TemplateId,
  type TemplateFields,
} from "@/lib/admin/template-actions";
import type { RenderedEmail } from "@/lib/admin/preview-actions";

interface TemplateMeta {
  id: TemplateId;
  name: string;
  desc: string;
}

const TEMPLATES: TemplateMeta[] = [
  { id: "invite", name: "✨ Platform Invitation", desc: "Marketing email inviting someone to try Trackify (hero banner + features + CTA)" },
  { id: "notification", name: "Custom Notification", desc: "Free-form subject + message" },
  { id: "maintenance", name: "Maintenance Notice", desc: "Scheduled downtime announcement" },
  { id: "new-feature", name: "New Feature Announcement", desc: "Announce a new feature with CTA button" },
  { id: "welcome", name: "Welcome Email", desc: "Onboarding email template" },
];

interface Props {
  previewRecipient: string;
  onPreview: (payload: RenderedEmail, template: TemplateId) => void;
}

export function BroadcastComposer({ previewRecipient, onPreview }: Props) {
  const [templateId, setTemplateId] = useState<TemplateId>("notification");
  const [fields, setFields] = useState<Record<string, string>>({
    subject: "",
    message: "",
    scheduledTime: "",
    duration: "",
    details: "",
    featureName: "",
    description: "",
    ctaText: "",
    ctaUrl: "",
    name: "",
    recipientName: "",
    inviterName: "",
    inviteCtaUrl: "",
  });
  const [loadingPreview, setLoadingPreview] = useState(false);

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
      case "maintenance":
        if (!fields.scheduledTime.trim() || !fields.duration.trim() || !fields.details.trim()) return null;
        return { scheduledTime: fields.scheduledTime, duration: fields.duration, details: fields.details };
      case "new-feature":
        if (!fields.featureName.trim() || !fields.description.trim() || !fields.ctaText.trim() || !fields.ctaUrl.trim()) return null;
        return {
          featureName: fields.featureName,
          description: fields.description,
          ctaText: fields.ctaText,
          ctaUrl: fields.ctaUrl,
        };
      case "welcome":
        if (!fields.name.trim()) return null;
        return { name: fields.name };
    }
  }

  const filled = getCurrentFields();
  const canPreview = !!filled;

  async function handlePreview() {
    if (!filled) return;
    setLoadingPreview(true);
    try {
      const rendered = await renderTemplatePreview(templateId, filled, previewRecipient);
      onPreview(rendered, templateId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to render preview");
    }
    setLoadingPreview(false);
  }

  const tmplMeta = TEMPLATES.find((t) => t.id === templateId)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose Email</CardTitle>
        <CardDescription>
          Pick a template, fill in the fields, then preview to copy the HTML or open in your mail app.
          Emails are sent manually — this tool renders the template for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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

          {templateId === "invite" && (
            <>
              <Alert type="info">
                Marketing-style invite. Recipient name shows as a personal greeting; inviter name adds a &quot;X thought you&apos;d love it&quot; touch. Both are optional — leave blank for a neutral tone.
              </Alert>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Recipient Name (optional)" value={fields.recipientName} onChange={(v) => setField("recipientName", v)} placeholder="Sarah" />
                <TextField label="Inviter Name (optional)" value={fields.inviterName} onChange={(v) => setField("inviterName", v)} placeholder="Aryan" />
              </div>
              <TextField label="Signup URL (defaults to /signup)" value={fields.inviteCtaUrl} onChange={(v) => setField("inviteCtaUrl", v)} placeholder="https://trackify.app/signup" type="url" />
            </>
          )}

          {templateId === "notification" && (
            <>
              <TextField label="Subject" value={fields.subject} onChange={(v) => setField("subject", v)} placeholder="New feature: Mind Maps are here!" />
              <TextArea label="Message" value={fields.message} onChange={(v) => setField("message", v)} placeholder="Write your message — plain text only. Line breaks are preserved." rows={5} />
            </>
          )}

          {templateId === "maintenance" && (
            <>
              <TextField label="Scheduled Time" value={fields.scheduledTime} onChange={(v) => setField("scheduledTime", v)} placeholder="Saturday, April 20 at 2:00 AM UTC" />
              <TextField label="Duration" value={fields.duration} onChange={(v) => setField("duration", v)} placeholder="30 minutes" />
              <TextArea label="Details" value={fields.details} onChange={(v) => setField("details", v)} placeholder="What's being done and what users can expect." rows={4} />
            </>
          )}

          {templateId === "new-feature" && (
            <>
              <TextField label="Feature Name" value={fields.featureName} onChange={(v) => setField("featureName", v)} placeholder="Mind Maps" />
              <TextArea label="Description" value={fields.description} onChange={(v) => setField("description", v)} placeholder="Visualize ideas as interactive node graphs…" rows={3} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="CTA Button Text" value={fields.ctaText} onChange={(v) => setField("ctaText", v)} placeholder="Try Mind Maps" />
                <TextField label="CTA URL" value={fields.ctaUrl} onChange={(v) => setField("ctaUrl", v)} placeholder="https://trackify.app/mindmaps" type="url" />
              </div>
            </>
          )}

          {templateId === "welcome" && (
            <TextField label="Recipient Name" value={fields.name} onChange={(v) => setField("name", v)} placeholder="Alex" />
          )}

          <div className="flex justify-end">
            <Button type="button" disabled={!canPreview || loadingPreview} onClick={handlePreview}>
              {loadingPreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview &amp; copy
            </Button>
          </div>
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
