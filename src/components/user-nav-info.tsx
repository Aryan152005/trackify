"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function UserNavInfo() {
  const [name, setName] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name")
        .eq("user_id", user.id)
        .single();

      if (profile) setName(profile.name);
    }
    load();
  }, []);

  if (!name) return null;

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/motivation"
        className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        Motivation
      </Link>
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        Hi, <span className="font-medium text-zinc-900 dark:text-zinc-50">{name}</span>
      </span>
    </div>
  );
}
