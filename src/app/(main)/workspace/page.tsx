"use client";

import { useState } from "react";
import { useWorkspace, useRequireRole } from "@/lib/workspace/hooks";
import { updateWorkspace } from "@/lib/workspace/actions";
import { AnimatedPage } from "@/components/ui/animated-layout";
import Link from "next/link";
import { Settings, Users, ArrowLeft, Puzzle, Link2 } from "lucide-react";

export default function WorkspaceSettingsPage() {
  const { workspace } = useWorkspace();
  const isAdmin = useRequireRole("admin");
  const [name, setName] = useState(workspace?.name || "");
  const [description, setDescription] = useState(workspace?.description || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !isAdmin) return;
    setSaving(true);
    try {
      await updateWorkspace(workspace.id, { name, description });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // handle error
    }
    setSaving(false);
  }

  if (!workspace) return null;

  return (
    <AnimatedPage>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-6 w-6 text-zinc-500" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Workspace Settings
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              General
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Workspace Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isAdmin}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>
              {isAdmin && (
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  {saved && (
                    <span className="text-sm text-green-600 dark:text-green-400">
                      Saved!
                    </span>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            href="/workspace/members"
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <Users className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Members
              </div>
              <div className="text-xs text-zinc-500">
                Manage team members & roles
              </div>
            </div>
          </Link>

          <Link
            href="/workspace/integrations"
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <Puzzle className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Integrations
              </div>
              <div className="text-xs text-zinc-500">
                Slack, GitHub, webhooks & more
              </div>
            </div>
          </Link>

          <Link
            href="/workspace/shared-links"
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
          >
            <Link2 className="h-5 w-5 text-indigo-500" />
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Share links
              </div>
              <div className="text-xs text-zinc-500">
                Audit &amp; revoke every active share link
              </div>
            </div>
          </Link>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              Workspace Info
            </div>
            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              <div>Slug: <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">{workspace.slug}</code></div>
              <div>Type: {workspace.is_personal ? "Personal" : "Team"}</div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
