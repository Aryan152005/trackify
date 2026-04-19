"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Share2,
  Link2,
  Copy,
  Trash2,
  Loader2,
  X,
  Calendar,
  Shield,
  Send,
  Users,
  Mail,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { listWorkspaceTeammates, nudgeTeammate } from "@/lib/collaboration/nudge-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  getSharedLinks,
  createSharedLink,
  revokeSharedLink,
  listLinkGrants,
  addLinkGrant,
  revokeLinkGrant,
  type GrantPermission,
  type ShareLinkGrant,
} from "@/lib/collaboration/sharing-actions";
import type { SharedLink, SharedLinkPermission } from "@/lib/types/collaboration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildShareUrl(token: string): string {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";
  return baseUrl + "/shared/" + token;
}

const PERMISSION_OPTIONS: {
  value: SharedLinkPermission;
  label: string;
  description: string;
}[] = [
  { value: "view", label: "View", description: "Read-only preview" },
  { value: "comment", label: "Comment", description: "Workspace members get comment access in-app" },
  { value: "edit", label: "Edit", description: "Workspace members get full edit access in-app" },
];

// ---------------------------------------------------------------------------
// ShareDialog
// ---------------------------------------------------------------------------

interface ShareDialogProps {
  entityType: string;
  entityId: string;
  entityTitle: string;
  /** If provided, makes the dialog controlled externally */
  open?: boolean;
  /** Called when the dialog requests to close (controlled mode) */
  onClose?: () => void;
}

export function ShareDialog({
  entityType,
  entityId,
  entityTitle,
  open: controlledOpen,
  onClose,
}: ShareDialogProps) {
  const workspaceId = useWorkspaceId();
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled) {
      if (!value && onClose) onClose();
    } else {
      setInternalOpen(value);
    }
  };
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // New link form state
  const [permission, setPermission] = useState<SharedLinkPermission>("view");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Per-link grant state. Keyed by link.id.
  const [grantsByLink, setGrantsByLink] = useState<Record<string, ShareLinkGrant[]>>({});
  const [expandedGrants, setExpandedGrants] = useState<Record<string, boolean>>({});
  const [grantEmailInput, setGrantEmailInput] = useState<Record<string, string>>({});
  const [grantPermInput, setGrantPermInput] = useState<Record<string, GrantPermission>>({});
  const [grantAdding, setGrantAdding] = useState<Record<string, boolean>>({});

  // Direct teammate share
  interface Teammate { user_id: string; name: string; avatar_url: string | null; role: string }
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [pickedUserId, setPickedUserId] = useState<string>("");
  const [pickedAction, setPickedAction] = useState<"view" | "comment" | "edit">("view");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!workspaceId || !open) return;
    listWorkspaceTeammates(workspaceId).then(setTeammates).catch(() => setTeammates([]));
  }, [workspaceId, open]);

  const handleDirectShare = async () => {
    if (!workspaceId || !pickedUserId) return;
    setSending(true);
    try {
      await nudgeTeammate({
        toUserId: pickedUserId,
        workspaceId,
        entityType: entityType as "page" | "task" | "board" | "entry" | "drawing" | "mindmap" | "challenge",
        entityId,
        entityTitle,
        action: pickedAction,
      });
      const name = teammates.find((t) => t.user_id === pickedUserId)?.name ?? "teammate";
      toast.success(`Notification sent to ${name}`);
      setPickedUserId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send notification");
    } finally {
      setSending(false);
    }
  };

  const fetchLinks = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await getSharedLinks(workspaceId, entityType, entityId);
      setLinks(data ?? []);
    } catch {
      toast.error("Failed to load share links");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, entityType, entityId]);

  useEffect(() => {
    if (open) fetchLinks();
  }, [open, fetchLinks]);

  const handleCreate = async () => {
    if (!workspaceId) return;
    setCreating(true);
    try {
      await createSharedLink({
        workspaceId,
        entityType,
        entityId,
        permission,
        expiresAt: expiresAt || null,
      });
      await fetchLinks();
      setPermission("view");
      setExpiresAt("");
      toast.success("Share link created");
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    if (!workspaceId) return;
    try {
      await revokeSharedLink(linkId, workspaceId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke link");
    }
  };

  const handleCopy = async (token: string) => {
    const url = buildShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const toggleGrants = async (linkId: string) => {
    const nowOpen = !expandedGrants[linkId];
    setExpandedGrants((prev) => ({ ...prev, [linkId]: nowOpen }));
    if (nowOpen && !grantsByLink[linkId]) {
      try {
        const g = await listLinkGrants(linkId);
        setGrantsByLink((prev) => ({ ...prev, [linkId]: g }));
      } catch {
        toast.error("Failed to load grants");
      }
    }
  };

  const handleAddGrant = async (linkId: string) => {
    const email = (grantEmailInput[linkId] ?? "").trim().toLowerCase();
    const perm = grantPermInput[linkId] ?? "view";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setGrantAdding((prev) => ({ ...prev, [linkId]: true }));
    try {
      const grant = await addLinkGrant({ linkId, email, permission: perm });
      setGrantsByLink((prev) => ({
        ...prev,
        [linkId]: [grant, ...(prev[linkId] ?? []).filter((g) => g.id !== grant.id)],
      }));
      setGrantEmailInput((prev) => ({ ...prev, [linkId]: "" }));
      toast.success("Access granted — we've emailed " + email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setGrantAdding((prev) => ({ ...prev, [linkId]: false }));
    }
  };

  const handleRevokeGrant = async (linkId: string, grantId: string) => {
    try {
      await revokeLinkGrant(grantId);
      setGrantsByLink((prev) => ({
        ...prev,
        [linkId]: (prev[linkId] ?? []).filter((g) => g.id !== grantId),
      }));
      toast.success("Access revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke access");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <Dialog.Trigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Share &ldquo;{entityTitle}&rdquo;
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Anyone with the link can view this {entityType} — they&apos;ll need a free Trackify account to open it.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {/* Share directly with a teammate (no login dance, they get a notification) */}
            <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                Share with a workspace teammate
              </h4>
              <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                They already have workspace access — this just pings them so they open it in-app in real time.
              </p>
              <div className="space-y-2">
                <select
                  value={pickedUserId}
                  onChange={(e) => setPickedUserId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">{teammates.length === 0 ? "No other workspace members" : "Pick a teammate…"}</option>
                  {teammates.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.name} · {t.role}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {(["view", "comment", "edit"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPickedAction(k)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition",
                        pickedAction === k
                          ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handleDirectShare}
                  disabled={!pickedUserId || sending}
                  className="w-full gap-1.5"
                  size="sm"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Send invite notification
                </Button>
              </div>
            </div>

            {/* Create new link */}
            <div className="mb-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
              <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Create new link
              </h4>

              <div className="space-y-3">
                {/* Permission selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <Shield className="mr-1 inline h-3 w-3" />
                    Permission
                  </label>
                  <div className="flex gap-2">
                    {PERMISSION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPermission(opt.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                          permission === opt.value
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-500"
                        )}
                      >
                        <div className="font-medium">{opt.label}</div>
                        <div className="mt-0.5 text-[10px] opacity-70">
                          {opt.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiration date */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    Expires (optional)
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full gap-1.5"
                  size="sm"
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )}
                  Create share link
                </Button>
              </div>
            </div>

            {/* Existing links */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Active links
              </h4>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : links.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center dark:border-zinc-700">
                  <Link2 className="mx-auto mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No active share links
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {links.map((link) => {
                    const grants = grantsByLink[link.id] ?? [];
                    const isExpanded = !!expandedGrants[link.id];
                    const emailInput = grantEmailInput[link.id] ?? "";
                    const permInput: GrantPermission = grantPermInput[link.id] ?? "view";
                    const isAdding = !!grantAdding[link.id];
                    return (
                      <div
                        key={link.id}
                        className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                  link.permission === "edit"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : link.permission === "comment"
                                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                )}
                              >
                                {link.permission}
                              </span>
                              {link.expires_at && (
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                  Expires {formatDate(link.expires_at)}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                              {buildShareUrl(link.token)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopy(link.token)}
                              title="Copy link"
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleRevoke(link.id)}
                              title="Revoke link"
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Grant access by email — collapsible */}
                        <div className="border-t border-zinc-100 dark:border-zinc-700">
                          <button
                            type="button"
                            onClick={() => toggleGrants(link.id)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                          >
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              Grant access by email
                              {grants.length > 0 && (
                                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                  {grants.length}
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] opacity-60">{isExpanded ? "Hide" : "Manage"}</span>
                          </button>

                          {isExpanded && (
                            <div className="space-y-3 border-t border-zinc-100 px-3 py-3 dark:border-zinc-700">
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                By default the link is view-only. Add someone&apos;s email below to upgrade them — an <strong>editor</strong> grant auto-adds them to the workspace on first open.
                              </p>

                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="email"
                                  placeholder="teammate@email.com"
                                  value={emailInput}
                                  onChange={(e) =>
                                    setGrantEmailInput((prev) => ({ ...prev, [link.id]: e.target.value }))
                                  }
                                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                                <div className="flex gap-1">
                                  {(["view", "editor"] as const).map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() =>
                                        setGrantPermInput((prev) => ({ ...prev, [link.id]: p }))
                                      }
                                      className={cn(
                                        "rounded-md border px-2 py-1 text-xs font-medium capitalize transition",
                                        permInput === p
                                          ? "border-indigo-500 bg-indigo-100 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300"
                                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                                      )}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddGrant(link.id)}
                                    disabled={!emailInput.trim() || isAdding}
                                    className="gap-1 px-2"
                                  >
                                    {isAdding ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Plus className="h-3.5 w-3.5" />
                                    )}
                                    Add
                                  </Button>
                                </div>
                              </div>

                              {grants.length > 0 && (
                                <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-100 dark:divide-zinc-700 dark:border-zinc-700">
                                  {grants.map((g) => (
                                    <li
                                      key={g.id}
                                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                                    >
                                      <Mail className="h-3 w-3 shrink-0 text-zinc-400" />
                                      <span className="truncate text-zinc-700 dark:text-zinc-300">{g.email}</span>
                                      <span
                                        className={cn(
                                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                                          g.permission === "editor"
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                        )}
                                      >
                                        {g.permission}
                                      </span>
                                      {g.first_used_at && (
                                        <span
                                          title={"First used " + formatDate(g.first_used_at)}
                                          className="shrink-0 text-emerald-600 dark:text-emerald-400"
                                        >
                                          <CheckCircle2 className="h-3 w-3" />
                                        </span>
                                      )}
                                      <div className="flex-1" />
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeGrant(link.id, g.id)}
                                        title="Revoke access"
                                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
