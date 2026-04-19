"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Creator/owner user id — typically `tasks.user_id` or `entries.user_id`. */
  userId: string;
  /** When provided AND equal to `userId`, the badge renders nothing (it's you). */
  currentUserId?: string | null;
  /** Optional label prefix, e.g. "by" → "by Alice". Default renders just the name. */
  prefix?: string;
  className?: string;
}

/**
 * Tiny "by Alice" pill shown on workspace-shared items so viewers can
 * tell at a glance who created something vs assumed-their-own.
 *
 * Kept client-side + ref-counted: each badge fetches the user_profiles row
 * for its userId on first mount, results are cached across all badges in
 * the same session so a list of 50 shared tasks triggers at most a handful
 * of queries (one per unique author).
 */

const profileCache = new Map<string, { name: string; avatarUrl: string | null }>();
const inflightRequests = new Map<string, Promise<void>>();

async function fetchProfile(userId: string) {
  if (profileCache.has(userId)) return;
  if (inflightRequests.has(userId)) return inflightRequests.get(userId)!;

  const p = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      profileCache.set(userId, {
        name: (data.name as string) ?? "Member",
        avatarUrl: (data.avatar_url as string | null) ?? null,
      });
    } else {
      profileCache.set(userId, { name: "Member", avatarUrl: null });
    }
  })();
  inflightRequests.set(userId, p);
  try { await p; } finally { inflightRequests.delete(userId); }
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hues = [210, 280, 340, 20, 50, 150, 190];
  return `hsl(${hues[Math.abs(hash) % hues.length]} 70% 45%)`;
}

export function AuthorBadge({ userId, currentUserId, prefix, className }: Props) {
  const [profile, setProfile] = useState(profileCache.get(userId) ?? null);

  useEffect(() => {
    if (profile) return;
    let cancelled = false;
    fetchProfile(userId).then(() => {
      if (cancelled) return;
      setProfile(profileCache.get(userId) ?? null);
    });
    return () => { cancelled = true; };
  }, [userId, profile]);

  // If the item is the current user's own, render nothing — avoids clutter
  // in the "my tasks" view. Drop `currentUserId` prop to force render.
  if (currentUserId && currentUserId === userId) return null;

  const name = profile?.name ?? "";
  const avatar = profile?.avatarUrl ?? null;
  const color = colorFor(userId);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${className ?? ""}`}
      title={name ? `Created by ${name}` : "Shared by workspace member"}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
      ) : (
        <span
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initialsOf(name || "?")}
        </span>
      )}
      {prefix ? <span className="text-zinc-400 dark:text-zinc-500">{prefix}</span> : null}
      <span className="max-w-[10ch] truncate">{name || "…"}</span>
    </span>
  );
}
