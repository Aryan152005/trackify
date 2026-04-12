"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import type { WorkEntryStatus } from "@/lib/types/database";
import type { Tag } from "@/lib/types/database";
import { Image as ImageIcon, X } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const BUCKET = "entry-attachments";
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

type AddEntryFormProps = {
  userId: string;
  tags: Pick<Tag, "id" | "name" | "color">[];
};

const STATUS_OPTIONS: { value: WorkEntryStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
];

export function AddEntryForm({ userId, tags }: AddEntryFormProps) {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkEntryStatus>("done");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
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
    if (imagePreviews[index]) {
      URL.revokeObjectURL(imagePreviews[index]);
    }
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
    const status = (formData.get("status") as WorkEntryStatus) || "done";
    const tagIds = formData.getAll("tag_ids") as string[];

    const supabase = createClient();

    // Create entry
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

    // Add tags
    if (entry && tagIds.length > 0) {
      await supabase.from("entry_tags").insert(
        tagIds.map((tag_id) => ({ entry_id: entry.id, tag_id }))
      );
    }

    // Upload images
    if (entry && selectedImages.length > 0) {
      const uploadPromises = selectedImages.map(async (file, index) => {
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/${entry.id}/${Date.now()}_${index}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
        return {
          entry_id: entry.id,
          file_url: urlData.publicUrl,
          type: "image" as const,
        };
      });

      try {
        const attachments = await Promise.all(uploadPromises);
        await supabase.from("attachments").insert(attachments);
      } catch (uploadErr) {
        console.error("Image upload error:", uploadErr);
        setError("Entry saved but some images failed to upload");
      }
    }

    // Cleanup previews
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));

    setLoading(false);
    router.push("/entries");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {error && (
        <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <input type="hidden" name="status" value={status} />
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
        </div>
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Backend API work"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Brief overview"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="work_done" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Work done
        </label>
        <textarea
          id="work_done"
          name="work_done"
          rows={3}
          placeholder="Tasks completed..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="learning" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Learning
        </label>
        <textarea
          id="learning"
          name="learning"
          rows={2}
          placeholder="What you learned..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      <div>
        <label htmlFor="next_day_plan" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Next day plan
        </label>
        <textarea
          id="next_day_plan"
          name="next_day_plan"
          rows={2}
          placeholder="Plans for tomorrow..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mood" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Mood
          </label>
          <input
            id="mood"
            name="mood"
            type="text"
            placeholder="e.g. Focused"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>
        <div>
          <label htmlFor="productivity_score" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Productivity score (1–10)
          </label>
          <input
            id="productivity_score"
            name="productivity_score"
            type="number"
            min={1}
            max={10}
            placeholder="5"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>
      </div>

      {/* Photo Proof Section */}
      <div>
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Photo Proof (Optional)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={selectedImages.length >= MAX_IMAGES}
          className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 disabled:opacity-50"
        >
          <ImageIcon className="h-4 w-4" />
          {selectedImages.length === 0
            ? "Add photos as proof of work"
            : `Add more (${selectedImages.length}/${MAX_IMAGES})`}
        </button>
        {imagePreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="h-24 w-full rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Max {MAX_IMAGES} images, {MAX_FILE_SIZE / 1024 / 1024}MB each
        </p>
      </div>

      {tags.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tags
          </span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                <input
                  type="checkbox"
                  name="tag_ids"
                  value={tag.id}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span style={{ color: tag.color }}>{tag.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save entry"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
