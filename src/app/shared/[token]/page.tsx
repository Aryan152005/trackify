"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Globe,
  Lock,
  FileText,
  ClipboardList,
  Columns,
  BookOpen,
  Pencil as DrawIcon,
  Brain,
  Target,
  Mail,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { BlockNoteReadOnly } from "@/components/shared/blocknote-readonly";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Pencil } from "lucide-react";
import {
  listLinkGrants,
  addLinkGrant,
  revokeLinkGrant,
  type GrantPermission,
  type ShareLinkGrant,
} from "@/lib/collaboration/sharing-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ViewerGrant {
  id: string;
  permission: GrantPermission;
}

interface SharedData {
  entity: Record<string, unknown>;
  entityType: string;
  permission: "view" | "comment" | "edit";
  workspaceName?: string;
  workspaceId?: string;
  viewerGrant: ViewerGrant | null;
  autoJoined: boolean;
  linkId?: string;
}

const ENTITY_APP_URL: Record<string, (id: string) => string> = {
  page: (id) => `/notes/${id}`,
  task: (id) => `/tasks/${id}`,
  board: (id) => `/boards/${id}`,
  entry: (id) => `/entries/${id}`,
  drawing: (id) => `/drawings/${id}`,
  mindmap: (id) => `/mindmaps/${id}`,
  challenge: (id) => `/challenges/${id}`,
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  page: <FileText className="h-5 w-5" />,
  task: <ClipboardList className="h-5 w-5" />,
  board: <Columns className="h-5 w-5" />,
  entry: <BookOpen className="h-5 w-5" />,
  drawing: <DrawIcon className="h-5 w-5" />,
  mindmap: <Brain className="h-5 w-5" />,
  challenge: <Target className="h-5 w-5" />,
};

const ENTITY_LABELS: Record<string, string> = {
  page: "Note",
  task: "Task",
  board: "Board",
  entry: "Entry",
  drawing: "Drawing",
  mindmap: "Mind map",
  challenge: "Challenge",
};

function SharedPageContent({ entity, entityType }: { entity: Record<string, unknown>; entityType: string }) {
  switch (entityType) {
    case "page":
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {!!entity.icon && (
              <span className="text-2xl">{entity.icon as string}</span>
            )}
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {(entity.title as string) || "Untitled"}
            </h1>
          </div>
          <div className="text-zinc-800 dark:text-zinc-200">
            <BlockNoteReadOnly blocks={entity.content} />
          </div>
        </div>
      );

    case "task":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Task"}
          </h1>
          <div className="flex flex-wrap gap-2">
            {!!entity.status && (
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                {entity.status as string}
              </span>
            )}
            {!!entity.priority && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Priority: {entity.priority as string}
              </span>
            )}
          </div>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {entity.description as string}
            </p>
          )}
          {!!entity.due_date && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Due: {new Date(entity.due_date as string).toLocaleDateString()}
            </p>
          )}
        </div>
      );

    case "board":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.name as string) || "Untitled Board"}
          </h1>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {entity.description as string}
            </p>
          )}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            Board view is available when you open this in the full app.
          </div>
        </div>
      );

    case "entry":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Entry"}
          </h1>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {entity.description as string}
            </p>
          )}
          {!!entity.hours_worked && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Hours logged: {entity.hours_worked as number}
            </p>
          )}
          {!!entity.date && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Date: {new Date(entity.date as string).toLocaleDateString()}
            </p>
          )}
        </div>
      );

    case "drawing":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Drawing"}
          </h1>
          {!!entity.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entity.thumbnail_url as string}
              alt={(entity.title as string) || "Drawing"}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
          )}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            Open in the full app to edit or collaborate on this drawing.
          </div>
        </div>
      );

    case "mindmap":
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Mind Map"}
          </h1>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {entity.description as string}
            </p>
          )}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            Mind-map view is interactive — open in the full app to explore.
          </div>
        </div>
      );

    case "challenge": {
      const duration = (entity.duration_days as number) ?? 21;
      const mode = (entity.mode as string) ?? "habit";
      const days = Array.isArray(entity.days) ? (entity.days as Record<string, unknown>[]) : [];
      const doneCount = days.filter((d) => {
        if (mode === "habit" || mode === "roadmap") return !!d.done;
        const tasks = Array.isArray(d.tasks) ? (d.tasks as { done: boolean }[]) : [];
        return tasks.length > 0 && tasks.every((t) => t.done);
      }).length;
      const pct = duration ? Math.round((doneCount / duration) * 100) : 0;
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {(entity.title as string) || "Untitled Challenge"}
          </h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 capitalize">
              {mode}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {duration} days
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              {doneCount}/{duration} · {pct}%
            </span>
          </div>
          {!!entity.description && (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {entity.description as string}
            </p>
          )}
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
            Open in the full app to check off days or collaborate.
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Unable to display this content type.
        </div>
      );
  }
}

export default function SharedTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEditInApp, setCanEditInApp] = useState(false);

  // Delegation panel state — only relevant when viewerGrant is set AND the
  // viewer isn't already a workspace member (in which case they'd use the
  // in-app share dialog instead).
  const [grants, setGrants] = useState<ShareLinkGrant[]>([]);
  const [grantsOpen, setGrantsOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantPerm, setGrantPerm] = useState<GrantPermission>("view");
  const [grantAdding, setGrantAdding] = useState(false);

  const loadGrants = useCallback(async (linkId: string) => {
    try {
      const g = await listLinkGrants(linkId);
      setGrants(g);
    } catch {
      /* ignore — grantee may not have RLS visibility in some edge cases */
    }
  }, []);

  const handleAddGrant = async () => {
    if (!data?.linkId) return;
    const email = grantEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setGrantAdding(true);
    try {
      const g = await addLinkGrant({ linkId: data.linkId, email, permission: grantPerm });
      setGrants((prev) => [g, ...prev.filter((x) => x.id !== g.id)]);
      setGrantEmail("");
      toast.success("Access granted — we've emailed " + email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setGrantAdding(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    try {
      await revokeLinkGrant(grantId);
      setGrants((prev) => prev.filter((g) => g.id !== grantId));
      toast.success("Access revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke access");
    }
  };

  useEffect(() => {
    async function fetchSharedContent() {
      try {
        // Resolve the current user. In a fresh tab the Supabase client
        // sometimes hasn't hydrated the session from cookies yet by the
        // time this effect fires — racing to /login would then bounce
        // authenticated users through /login → /dashboard (since
        // middleware treats logged-in users on /login as "go home").
        // Retry once after a short delay to give the cookie-backed
        // session a chance to surface before we give up.
        const supabase = createClient();
        let {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          await new Promise((r) => setTimeout(r, 200));
          ({
            data: { user },
          } = await supabase.auth.getUser());
        }
        if (!user) {
          const next = encodeURIComponent(`/shared/${params.token}`);
          router.replace(`/login?next=${next}`);
          return;
        }

        const res = await fetch(`/api/collaboration/share/${params.token}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (res.status === 404) {
            setError("This shared link was not found or has been revoked.");
          } else if (res.status === 410) {
            setError("This shared link has expired.");
          } else {
            setError(json.error ?? "Something went wrong.");
          }
          return;
        }
        const json = await res.json();
        setData(json);

        // If the API just auto-joined this viewer (editor grant on a
        // non-member), they're now a workspace editor — redirect straight
        // to the in-app editor so they don't see a redundant read-only
        // preview.
        if (json.autoJoined) {
          const appUrl = ENTITY_APP_URL[json.entityType]?.((json.entity?.id as string) || "");
          if (appUrl) {
            toast.success("You now have editor access to this workspace");
            router.replace(appUrl);
            return;
          }
        }

        // If the current browser is signed in AND belongs to the workspace
        // that owns this share link, they can edit in the full app — show
        // an "Open full editor" button.
        if (json.workspaceId) {
          try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: membership } = await supabase
                .from("workspace_members")
                .select("role")
                .eq("workspace_id", json.workspaceId)
                .eq("user_id", user.id)
                .maybeSingle();
              if (membership) {
                setCanEditInApp(true);
                // Auto-redirect workspace members straight to the full in-app view
                // (they'd otherwise see the read-only preview unnecessarily).
                const appUrl = ENTITY_APP_URL[json.entityType]?.((json.entity?.id as string) || "");
                if (appUrl) {
                  router.replace(appUrl);
                  return;
                }
              }
            }
          } catch {
            /* ignore — fall back to read-only view */
          }
        }
      } catch {
        setError("Failed to load shared content.");
      } finally {
        setLoading(false);
      }
    }

    if (params.token) {
      fetchSharedContent();
    }
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="sr-only">Loading shared content…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Lock className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Cannot access
        </h2>
        <p className="max-w-sm text-center text-sm text-zinc-500 dark:text-zinc-400">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Shared banner */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <Globe className="h-4 w-4 text-indigo-500" />
        <span className="text-sm text-indigo-700 dark:text-indigo-300">
          Shared{data.workspaceName ? ` by ${data.workspaceName}` : ""}
        </span>
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
          {data.permission === "view"
            ? "Read only"
            : data.permission === "comment"
            ? "Can comment"
            : "Can edit"}
        </span>
        {data.viewerGrant && (
          <span
            title="You have a personal grant on this link"
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium",
              data.viewerGrant.permission === "editor"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
            )}
          >
            <UserCheck className="h-3 w-3" />
            {data.viewerGrant.permission === "editor" ? "Editor access" : "View access"}
          </span>
        )}
        {canEditInApp && ENTITY_APP_URL[data.entityType] && (
          <Link
            href={ENTITY_APP_URL[data.entityType]((data.entity.id as string) || "")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            <Pencil className="h-3 w-3" />
            Open full editor
          </Link>
        )}
      </div>

      {/* Delegation panel — view-grantees can forward access to others.
          Hidden for workspace members (they'd be auto-redirected above and
          manage grants from the in-app share dialog). */}
      {data.viewerGrant && data.linkId && !canEditInApp && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              const next = !grantsOpen;
              setGrantsOpen(next);
              if (next && grants.length === 0 && data.linkId) loadGrants(data.linkId);
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-500" />
              Share access with someone else
              {grants.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {grants.length}
                </span>
              )}
            </span>
            <span className="text-xs opacity-60">{grantsOpen ? "Hide" : "Manage"}</span>
          </button>

          {grantsOpen && (
            <div className="space-y-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                You can invite others to this {data.entityType}.
                {data.viewerGrant.permission === "editor"
                  ? " You hold editor access, so you can grant either level."
                  : " You hold view access, so you can only grant view."}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  placeholder="person@email.com"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="flex gap-1">
                  {(["view", "editor"] as const).map((p) => {
                    const canPick = p === "view" || data.viewerGrant?.permission === "editor";
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={!canPick}
                        onClick={() => canPick && setGrantPerm(p)}
                        title={canPick ? "" : "You only hold view access — can't issue editor grants"}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium capitalize transition",
                          !canPick && "cursor-not-allowed opacity-40",
                          grantPerm === p && canPick
                            ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <Button
                    size="sm"
                    onClick={handleAddGrant}
                    disabled={!grantEmail.trim() || grantAdding}
                    className="gap-1 px-2"
                  >
                    {grantAdding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Invite
                  </Button>
                </div>
              </div>

              {grants.length > 0 ? (
                <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                  {grants.map((g) => (
                    <li key={g.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                      <Mail className="h-3 w-3 shrink-0 text-zinc-400" />
                      <span className="truncate text-zinc-700 dark:text-zinc-300">{g.email}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                          g.permission === "editor"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
                        )}
                      >
                        {g.permission}
                      </span>
                      {g.first_used_at && (
                        <span title="Has opened the link" className="shrink-0 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => handleRevokeGrant(g.id)}
                        title="Revoke access"
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
                  No one else invited yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Entity type indicator */}
      <div className="mb-4 flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
        {ENTITY_ICONS[data.entityType] ?? <FileText className="h-5 w-5" />}
        <span className="text-sm font-medium">
          {ENTITY_LABELS[data.entityType] ?? "Content"}
        </span>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <SharedPageContent entity={data.entity} entityType={data.entityType} />
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <a
          href="/login"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Sign in to Trackify for full access
        </a>
      </div>
    </div>
  );
}
