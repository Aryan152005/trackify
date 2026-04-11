"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { createBoard } from "@/lib/boards/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewBoardPage() {
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      setError("No workspace selected. Please select a workspace first.");
      return;
    }
    if (!name.trim()) {
      setError("Board name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const board = await createBoard(
        workspaceId,
        name.trim(),
        description.trim() || undefined
      );
      router.push(`/boards/${board.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create board");
      setLoading(false);
    }
  }

  return (
    <AnimatedPage>
      <div className="mx-auto max-w-lg space-y-6">
        {/* Back link */}
        <Link
          href="/boards"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Boards
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Create New Board</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="board-name"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Board Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="board-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sprint 12, Product Roadmap"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="board-description"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Description{" "}
                  <span className="text-zinc-400 dark:text-zinc-500">
                    (optional)
                  </span>
                </label>
                <textarea
                  id="board-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this board for?"
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  disabled={loading}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={loading || !name.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Board"
                  )}
                </Button>
                <Link href="/boards">
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
