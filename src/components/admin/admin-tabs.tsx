"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatIST } from "@/lib/utils/datetime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminCharts } from "@/components/admin/admin-charts";
import { addToWhitelist, removeFromWhitelist, approveWhitelistRequest, denyWhitelistRequest } from "@/lib/admin/email-actions";
import { updateFeedbackStatus } from "@/lib/feedback/actions";
import { renderWhitelistApproved, type RenderedEmail } from "@/lib/admin/preview-actions";
import { EmailPreviewDialog } from "@/components/admin/email-preview-dialog";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { TargetedEmailComposer } from "@/components/admin/targeted-email-composer";
import {
  Users, Shield, Mail, BarChart3, MessageSquare,
  Plus, Trash2, Check, Loader2, Eye, Star, Bug, Lightbulb, AlertTriangle, MessageCircle,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "whitelist", label: "Whitelist", icon: Shield },
  { id: "email", label: "Send Email", icon: Mail },
  { id: "requests", label: "Access Requests", icon: MessageSquare },
  { id: "feedback", label: "Feedback", icon: Star },
] as const;

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  type: "bug" | "feature" | "general" | "complaint";
  message: string;
  rating: number | null;
  status: "new" | "reviewed" | "resolved";
  created_at: string;
}

type TabId = (typeof TABS)[number]["id"];

interface AdminTabsProps {
  users: {
    id: string; name: string; email: string; avatarUrl: string | null;
    joinedAt: string; lastSignIn: string | null;
    lastActivityAt: string | null;
    lastActive: string | null;
    entryCount: number; taskStats: { total: number; done: number }; pageCount: number;
  }[];
  whitelist: { email: string; created_at: string }[];
  whitelistRequests: { id: string; email: string; name: string | null; reason: string | null; status: string; created_at: string }[];
  dailyActivity: { date: string; entries: number; tasks: number; avgScore: number }[];
  taskAnalytics: { statuses: Record<string, number>; priorities: Record<string, number>; avgCompletionHours: number; total: number };
  entryAnalytics: { statuses: Record<string, number>; avgScore: number; totalDaysTracked: number; activeUsers: number; total: number };
  feedback: FeedbackItem[];
}

export function AdminTabs({ users, whitelist: initialWhitelist, whitelistRequests: initialRequests, dailyActivity, taskAnalytics, entryAnalytics, feedback: initialFeedback }: AdminTabsProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [whitelist, setWhitelist] = useState(initialWhitelist);
  const [requests, setRequests] = useState(initialRequests);
  const [feedback, setFeedback] = useState(initialFeedback);
  const router = useRouter();

  // Whitelist state
  const [newEmail, setNewEmail] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Preview dialog state
  const [previewPayload, setPreviewPayload] = useState<RenderedEmail | null>(null);

  // User-selection state for targeted email
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const toggleUser = (id: string) =>
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedUserIds(new Set());
  const toggleAllUsers = () =>
    setSelectedUserIds((prev) => (prev.size === users.length ? new Set() : new Set(users.map((u) => u.id))));
  const selectedUsers = users
    .filter((u) => selectedUserIds.has(u.id))
    .map((u) => ({ id: u.id, email: u.email, name: u.name }));

  async function openWhitelistPreview(email: string, name = "") {
    try {
      const rendered = await renderWhitelistApproved(email, name);
      setPreviewPayload(rendered);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to render preview");
    }
  }

  function openComposerPreview(payload: RenderedEmail) {
    setPreviewPayload(payload);
  }

  async function handleAddWhitelist(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingEmail(true);
    try {
      const result = await addToWhitelist(newEmail);
      setWhitelist((prev) => [{ email: result.email, created_at: new Date().toISOString() }, ...prev]);
      setNewEmail("");
      toast.success(`Whitelisted ${result.email}. Opening invite email preview so you can copy and send it.`);
      openWhitelistPreview(result.email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to whitelist");
    }
    setAddingEmail(false);
  }

  async function handleRemoveWhitelist(email: string) {
    setActionLoading(email);
    try {
      await removeFromWhitelist(email);
      setWhitelist((prev) => prev.filter((w) => w.email !== email));
      toast.success(`Removed ${email} from whitelist`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
    setActionLoading(null);
  }

  async function handleApproveRequest(requestId: string) {
    setActionLoading(requestId);
    try {
      const result = await approveWhitelistRequest(requestId);
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "approved" } : r));
      setWhitelist((prev) => [{ email: result.email, created_at: new Date().toISOString() }, ...prev]);
      toast.success(`Approved ${result.email}. Opening invite email preview so you can send it manually.`);
      openWhitelistPreview(result.email, result.name ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
    setActionLoading(null);
  }

  // Reject counterpart — keeps the request in the list but marked "denied"
  // so the admin has an audit trail. No automatic email — admins can use
  // the targeted-email composer if they want to write a decline note.
  async function handleRejectRequest(requestId: string) {
    setActionLoading(requestId);
    try {
      const result = await denyWhitelistRequest(requestId);
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "denied" } : r));
      toast.success(`Rejected request from ${result.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    }
    setActionLoading(null);
  }


  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
              tab === t.id
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === "requests" && requests.filter((r) => r.status === "pending").length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {requests.filter((r) => r.status === "pending").length}
              </span>
            )}
            {t.id === "feedback" && feedback.filter((f) => f.status === "new").length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                {feedback.filter((f) => f.status === "new").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <AdminCharts
          dailyActivity={dailyActivity}
          taskStatuses={taskAnalytics.statuses}
          taskPriorities={taskAnalytics.priorities}
          entryStatuses={entryAnalytics.statuses}
        />
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-6">
          {selectedUsers.length > 0 && (
            <TargetedEmailComposer
              selected={selectedUsers}
              onPreview={openComposerPreview}
              onClear={clearSelection}
              onDeselect={toggleUser}
            />
          )}
        <Card>
          <CardHeader>
            <CardTitle>All Users ({users.length})</CardTitle>
            <CardDescription>Select users with the checkboxes to email them directly.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                    <th className="w-8 pb-3">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedUserIds.size === users.length}
                        ref={(el) => {
                          if (el) el.indeterminate = selectedUserIds.size > 0 && selectedUserIds.size < users.length;
                        }}
                        onChange={toggleAllUsers}
                        className="rounded"
                        aria-label="Select all users"
                      />
                    </th>
                    <th className="pb-3 font-medium text-zinc-500">Name</th>
                    <th className="pb-3 font-medium text-zinc-500">Email</th>
                    <th className="pb-3 font-medium text-zinc-500">Entries</th>
                    <th className="pb-3 font-medium text-zinc-500">Tasks</th>
                    <th className="pb-3 font-medium text-zinc-500">Last Active</th>
                    <th className="pb-3 font-medium text-zinc-500">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="rounded"
                          aria-label={`Select ${u.name}`}
                        />
                      </td>
                      <td className="py-3">
                        <Link href={`/admin/users/${u.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                          {u.name}
                        </Link>
                      </td>
                      <td className="py-3 text-zinc-500">{u.email}</td>
                      <td className="py-3">{u.entryCount}</td>
                      <td className="py-3">{u.taskStats.done}/{u.taskStats.total}</td>
                      <td
                        className="py-3 text-xs text-zinc-400"
                        title={
                          u.lastActive
                            ? `Last active ${formatIST(u.lastActive)} IST${
                                u.lastSignIn ? ` · last login ${formatIST(u.lastSignIn)} IST` : ""
                              }`
                            : "Never active"
                        }
                      >
                        {u.lastActive ? formatIST(u.lastActive, {
                          month: "short", day: "numeric",
                          hour: "numeric", minute: "2-digit", hour12: true,
                        }) : "Never"}
                      </td>
                      <td className="py-3 text-zinc-400 text-xs">{formatIST(u.joinedAt, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Whitelist Tab */}
      {tab === "whitelist" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add to Whitelist</CardTitle>
              <CardDescription>Whitelist an email to allow signup. After adding, the invite email opens in a preview dialog for you to copy and send manually.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddWhitelist} className="flex flex-wrap gap-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:text-sm"
                />
                <Button type="submit" disabled={addingEmail} size="sm">
                  {addingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Whitelisted Emails ({whitelist.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {whitelist.map((w) => (
                  <div key={w.email} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{w.email}</p>
                      <p className="text-xs text-zinc-400">Added {formatIST(w.created_at, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: undefined, minute: undefined, hour12: undefined,
                      })}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => openWhitelistPreview(w.email)}
                        className="rounded p-1.5 text-zinc-400 transition hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30"
                        title="Preview & copy invite email"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveWhitelist(w.email)}
                        disabled={actionLoading === w.email}
                        className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                        title="Remove from whitelist"
                      >
                        {actionLoading === w.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Tab */}
      {tab === "email" && (
        <div className="space-y-6">
          <BroadcastComposer
            previewRecipient={users[0]?.email ?? "preview@example.com"}
            onPreview={openComposerPreview}
          />
        </div>
      )}

      {/* Access Requests Tab */}
      {tab === "requests" && (
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Access Requests</CardTitle>
            <CardDescription>People who submitted the &quot;Request Access&quot; form. Approve to auto-whitelist and send invite.</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">No access requests yet</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-start justify-between rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{r.email}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : r.status === "denied" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      {r.name && <p className="mt-0.5 text-xs text-zinc-500">Name: {r.name}</p>}
                      {r.reason && <p className="mt-0.5 text-xs text-zinc-400">&quot;{r.reason}&quot;</p>}
                      <p className="mt-1 text-[11px] text-zinc-300">{formatIST(r.created_at)} IST</p>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(r.id)}
                          disabled={actionLoading === r.id}
                          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {actionLoading === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(r.id)}
                          disabled={actionLoading === r.id}
                        >
                          {actionLoading === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* Feedback Tab */}
      {tab === "feedback" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Feedback ({feedback.length})</CardTitle>
              <CardDescription>
                Bug reports, feature requests, complaints, and general feedback from users.
                Click status to cycle: new → reviewed → resolved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedback.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-400">No feedback yet.</p>
              ) : (
                <div className="space-y-2">
                  {feedback.map((f) => {
                    const Icon = f.type === "bug" ? Bug : f.type === "feature" ? Lightbulb : f.type === "complaint" ? AlertTriangle : MessageCircle;
                    const typeColor =
                      f.type === "bug" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                      : f.type === "feature" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30"
                      : f.type === "complaint" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                      : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800";
                    const statusColor =
                      f.status === "new" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : f.status === "reviewed" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";
                    const nextStatus = f.status === "new" ? "reviewed" : f.status === "reviewed" ? "resolved" : "new";

                    return (
                      <div
                        key={f.id}
                        className={`rounded-lg border border-zinc-200 p-3 transition dark:border-zinc-800 ${f.status === "new" ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor}`}>
                              <Icon className="h-3 w-3" />
                              {f.type}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {f.name || "Anonymous"}
                                {f.email && <span className="ml-1.5 text-xs font-normal text-zinc-500">· {f.email}</span>}
                              </p>
                              <p className="text-[11px] text-zinc-400">
                                {formatIST(f.created_at)} IST
                                {f.rating != null && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 text-amber-500">
                                    {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                                    <span className="ml-0.5 text-zinc-400">{f.rating}/5</span>
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await updateFeedbackStatus(f.id, nextStatus);
                                setFeedback((prev) => prev.map((x) => x.id === f.id ? { ...x, status: nextStatus } : x));
                              } catch {
                                /* silent */
                              }
                            }}
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition hover:opacity-80 ${statusColor}`}
                            title={`Click to mark as ${nextStatus}`}
                          >
                            {f.status}
                          </button>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                          {f.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <EmailPreviewDialog
        open={!!previewPayload}
        onOpenChange={(o) => !o && setPreviewPayload(null)}
        payload={previewPayload}
      />
    </div>
  );
}
