"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { updateProfile, updateAvatar } from "@/lib/profile/actions";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

function initialsFromName(name: string, email: string) {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

export function ProfileForm({
  initialName,
  initialAvatarUrl,
  email,
  userId,
}: {
  initialName: string;
  initialAvatarUrl: string | null;
  email: string;
  userId: string;
}) {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [savingName, startSavingName] = useTransition();
  const [removing, startRemoving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = initialsFromName(name, email);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("File too large. Maximum size is 2MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      await updateAvatar(publicUrl);
      setAvatarUrl(publicUrl);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    startRemoving(async () => {
      try {
        await updateAvatar("");
        setAvatarUrl(null);
        toast.success("Avatar removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove avatar");
      }
    });
  }

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    startSavingName(async () => {
      try {
        await updateProfile({ name: trimmed });
        toast.success("Name updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update name");
      }
    });
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Your Profile"
        description="Update your name and avatar."
        backHref="/settings"
      />

      {/* Avatar */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Avatar</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          PNG, JPG or GIF. Max 2MB.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500 text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Upload new avatar
                </>
              )}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removing}
                onClick={handleRemove}
              >
                {removing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                Remove
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Name */}
      <Card className="p-6">
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Name
            </label>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              This name is visible to other members of your workspaces.
            </p>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={`mt-2 ${inputClass}`}
              placeholder="Your name"
            />
          </div>
          <div>
            <Button type="submit" disabled={savingName || name.trim() === initialName.trim()}>
              {savingName && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save name
            </Button>
          </div>
        </form>
      </Card>

      {/* Email */}
      <Card className="p-6">
        <label
          htmlFor="email"
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          className={`mt-2 ${inputClass} cursor-not-allowed opacity-70`}
        />
        <Alert type="info" className="mt-3">
          Email cannot be changed here. Contact admin to update it.
        </Alert>
      </Card>
    </div>
  );
}
