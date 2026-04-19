"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Trash2, Loader2, Clock, User, Shield, Share2, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace/hooks";
import {
  getWorkspaceSharedLinks,
  revokeSharedLink,
  getLinkVisitSummary,
  type SharedLinkAudit,
  type ShareLinkVisitSummary,
} from "@/lib/collaboration/sharing-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIST } from "@/lib/utils/datetime";

/**
 * Workspace-wide audit of every active share link. Admins land here when
 * they want to clean up links created by former members (who can no longer
 * revoke their own links — and until this page existed, the only way to
 * revoke a teammate's link was direct DB access).
 *
 * Visibility comes from RLS on shared_links (workspace viewer+), revoke
 * comes from the creator-or-admin policy. So a plain member sees the list
 * but gets an error if they try to revoke someone else's link — that's by
 * design.
 */
export default function WorkspaceSharedLinksPage() {
  const { workspace } = useWorkspace();
  const [links, setLinks] = useState<SharedLinkAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmRevoke, setConfirmRevoke] = useState<SharedLinkAudit | null>(null);
  // Per-link visit summary + expand state.
  const [visitByLink, setVisitByLink] = useState<Record<string, ShareLinkVisitSummary>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingVisits, setLoadingVisits] = useState<Record<string, boolean>>({});

  async function toggleVisits(linkId: string) {
    const next = !expanded[linkId];
    setExpanded((p) => ({ ...p, [linkId]: next }));
    if (next && !visitByLink[linkId]) {
      setLoadingVisits((p) => ({ ...p, [linkId]: true }));
      try {
        const summary = await getLinkVisitSummary(linkId);
        setVisitByLink((p) => ({ ...p, [linkId]: summary }));
      } catch {
        toast.error("Couldn't load visit log");
      } finally {
        setLoadingVisits((p) => ({ ...p, [linkId]: false }));
      }
    }
  }

  async function load() {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await getWorkspaceSharedLinks(workspace.id);
      setLinks(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load share links");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workspace) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  function handleRevoke() {
    const target = confirmRevoke;
    if (!target || !workspace) return;
    startTransition(async () => {
      try {
        await revokeSharedLink(target.id, workspace.id);
        setLinks((prev) => prev.filter((l) => l.id !== target.id));
        toast.success("Share link revoked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't revoke");
      } finally {
        setConfirmRevoke(null);
      }
    });
  }

  if (!workspace) return null;

  return (
    <AnimatedPage>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Workspace Settings
          </Link>
        </div>

        <PageHeader
          title="Active share links"
          description="Every active share link in this workspace. Workspace admins can revoke any link; members can revoke links they created."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4 text-indigo-500" />
              {links.length} active link{links.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription className="text-xs">
              Revoking a link immediately breaks any URL pointing at it —
              visitors get &ldquo;Shared link not found&rdquo;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : links.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center dark:border-zinc-700">
                <Link2 className="mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No active share links in this workspace.
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  Use the Share button on any page, task, board, etc. to create one.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {links.map((l) => {
                  const isOpen = !!expanded[l.id];
                  const summary = visitByLink[l.id];
                  const visitsLoading = !!loadingVisits[l.id];
                  return (
                    <li key={l.id} className="py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {l.entity_type}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                l.permission === "edit"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : l.permission === "comment"
                                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                              }`}
                            >
                              <Shield className="mr-0.5 inline h-2.5 w-2.5" />
                              {l.permission}
                            </span>
                            <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                              {l.entity_title}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {l.creator_name}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Created {formatIST(l.created_at, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: undefined,
                                minute: undefined,
                                hour12: undefined,
                              })}
                            </span>
                            {l.expires_at && (
                              <span className="inline-flex items-center gap-1">
                                Expires {formatIST(l.expires_at, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: undefined,
                                  minute: undefined,
                                  hour12: undefined,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleVisits(l.id)}
                            className="gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {summary ? summary.total : "Log"}
                            {isOpen ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmRevoke(l)}
                            disabled={pending}
                            className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                          {visitsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                            </div>
                          ) : !summary ? (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Unable to load visit log (RLS may restrict non-admin members).
                            </p>
                          ) : summary.total === 0 ? (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              No visits yet.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                                <span>
                                  <strong className="text-zinc-900 dark:text-zinc-100">{summary.total}</strong> visits
                                </span>
                                <span>
                                  <strong className="text-zinc-900 dark:text-zinc-100">{summary.unique_visitors}</strong> unique
                                </span>
                                {summary.last_accessed_at && (
                                  <span>
                                    Last {formatIST(summary.last_accessed_at)}
                                  </span>
                                )}
                                {Object.entries(summary.by_outcome).map(([k, v]) => (
                                  <span
                                    key={k}
                                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                                      k.startsWith("denied")
                                        ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                        : k === "auto-joined-workspace"
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                    }`}
                                  >
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                              <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
                                {summary.recent.map((v) => (
                                  <li
                                    key={v.id}
                                    className="flex items-center gap-2 px-2 py-1 text-[11px]"
                                  >
                                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                                      {v.visitor_email ?? v.visitor_user_id ?? "Anonymous"}
                                    </span>
                                    <span
                                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase ${
                                        v.outcome.startsWith("denied")
                                          ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                          : v.outcome === "auto-joined-workspace"
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                      }`}
                                    >
                                      {v.outcome}
                                    </span>
                                    <div className="flex-1" />
                                    <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                                      {formatIST(v.accessed_at)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={(next) => !next && setConfirmRevoke(null)}
        title="Revoke this share link?"
        description={
          confirmRevoke
            ? `Anyone currently using this link to view "${confirmRevoke.entity_title}" will immediately lose access.`
            : ""
        }
        confirmLabel="Revoke"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={handleRevoke}
      />
    </AnimatedPage>
  );
}
