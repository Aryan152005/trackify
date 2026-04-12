"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import type { WorkEntryStatus } from "@/lib/types/database";
import type { Tag } from "@/lib/types/database";
import {
  Image as ImageIcon, X, Calendar, CheckCircle2, Type, AlignLeft,
  Briefcase, Lightbulb, ArrowRight, Smile, Gauge, TagIcon, Loader2,
} from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";

const BUCKET = "entry-attachments";
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 4 * 1024 * 1024;

type AddEntryFormProps = {
  userId: string;
  tags: Pick<Tag, "id" | "name" | "color">[];
};

const STATUS_OPTIONS: { value: WorkEntryStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 sm:text-sm";

export function AddEntryForm({ userId, tags }: AddEntryFormProps) {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkEntryStatus>("done");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return false;
      }
      return true;
    });

    if (selectedImages.length + validFiles.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const newImages = [...selectedImages, ...validFiles];
    setSelectedImages(newImages);
    setImagePreviews(newImages.map((file) => URL.createObjectURL(file)));
    setError(null);
  }

  function removeImage(index: number) {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
    if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const date = formData.get("date") as string;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const work_done = (formData.get("work_done") as string) || null;
    const learning = (formData.get("learning") as string) || null;
    const next_day_plan = (formData.get("next_day_plan") as string) || null;
    const mood = (formData.get("mood") as string) || null;
    const productivity_score = formData.get("productivity_score")
      ? Number(formData.get("productivity_score"))
      : null;
    const tagIds = Array.from(selectedTagIds);

    const supabase = createClient();

    const { data: entry, error: insertError } = await supabase
      .from("work_entries")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        date,
        title,
        description,
        work_done,
        learning,
        next_day_plan,
        mood,
        productivity_score,
        status,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    if (entry && tagIds.length > 0) {
      await supabase.from("entry_tags").insert(
        tagIds.map((tag_id) => ({ entry_id: entry.id, tag_id }))
      );
    }

    if (entry && selectedImages.length > 0) {
      const uploadPromises = selectedImages.map(async (file, index) => {
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/${entry.id}/${Date.now()}_${index}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        return { entry_id: entry.id, file_url: urlData.publicUrl, type: "image" as const };
      });

      try {
        const attachments = await Promise.all(uploadPromises);
        await supabase.from("attachments").insert(attachments);
      } catch {
        setError("Entry saved but some images failed to upload");
      }
    }

    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setLoading(false);
    router.push("/entries");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      {error && <Alert type="error">{error}</Alert>}

      {/* ────── Section 1: Essentials ────── */}
      <Section
        title="Essentials"
        description="The basics — when, what, and current status."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Date" icon={<Calendar className="h-3.5 w-3.5" />} htmlFor="date">
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={today}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Status" icon={<CheckCircle2 className="h-3.5 w-3.5" />} htmlFor="status">
            <Select value={status} onValueChange={(v) => setStatus(v as WorkEntryStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Title"
            required
            icon={<Type className="h-3.5 w-3.5" />}
            htmlFor="title"
            className="lg:col-span-1"
          >
            <input
              id="title"
              name="title"
              type="text"
              required
              autoFocus
              placeholder="e.g. Backend API work"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Field label="Description (short summary)" icon={<AlignLeft className="h-3.5 w-3.5" />} htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={2}
            placeholder="One or two sentences about this entry…"
            className={`${INPUT_CLASS} resize-y`}
          />
        </Field>
      </Section>

      {/* ────── Section 2: Reflection (2-col) ────── */}
      <Section
        title="Daily reflection"
        description="Capture what actually happened and what you learned."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Work done" icon={<Briefcase className="h-3.5 w-3.5" />} htmlFor="work_done">
            <textarea
              id="work_done"
              name="work_done"
              rows={5}
              placeholder="What you completed today…"
              className={`${INPUT_CLASS} resize-y`}
            />
          </Field>
          <Field label="Learning" icon={<Lightbulb className="h-3.5 w-3.5" />} htmlFor="learning">
            <textarea
              id="learning"
              name="learning"
              rows={5}
              placeholder="Something new, a surprise, an insight…"
              className={`${INPUT_CLASS} resize-y`}
            />
          </Field>
        </div>
        <Field label="Next day plan" icon={<ArrowRight className="h-3.5 w-3.5" />} htmlFor="next_day_plan">
          <textarea
            id="next_day_plan"
            name="next_day_plan"
            rows={3}
            placeholder="What you'll tackle tomorrow…"
            className={`${INPUT_CLASS} resize-y`}
          />
        </Field>
      </Section>

      {/* ────── Section 3: Measure & tag ────── */}
      <Section
        title="Measure & tag"
        description="Score the day, tag the work, attach proof."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Mood" icon={<Smile className="h-3.5 w-3.5" />} htmlFor="mood">
            <input
              id="mood"
              name="mood"
              type="text"
              placeholder="e.g. Focused, drained, energized"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Productivity score (1–10)" icon={<Gauge className="h-3.5 w-3.5" />} htmlFor="productivity_score">
            <input
              id="productivity_score"
              name="productivity_score"
              type="number"
              min={1}
              max={10}
              placeholder="7"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {tags.length > 0 && (
          <Field label="Tags" icon={<TagIcon className="h-3.5 w-3.5" />}>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "border-transparent text-white"
                        : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                    style={active ? { backgroundColor: tag.color } : { color: tag.color }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Photo proof */}
        <Field label="Photo proof (optional)" icon={<ImageIcon className="h-3.5 w-3.5" />}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <div className="flex flex-wrap items-start gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={selectedImages.length >= MAX_IMAGES}
              className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 transition hover:border-indigo-400 hover:bg-indigo-50/50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/20"
            >
              <ImageIcon className="h-5 w-5" />
              <span className="text-center leading-tight">
                {selectedImages.length === 0 ? "Add photo" : `+ (${selectedImages.length}/${MAX_IMAGES})`}
              </span>
            </button>
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative h-24 w-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="h-full w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Max {MAX_IMAGES} images · {MAX_FILE_SIZE / 1024 / 1024}MB each
          </p>
        </Field>
      </Section>

      {/* Sticky submit bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={() => router.push("/entries")}
            disabled={loading}
            className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 sm:w-auto dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Saving…" : "Save entry"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  icon,
  htmlFor,
  required,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
