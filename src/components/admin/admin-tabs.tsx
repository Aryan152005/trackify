"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AdminCharts } from "@/components/admin/admin-charts";
import { addToWhitelist, removeFromWhitelist, approveWhitelistRequest } from "@/lib/admin/email-actions";
import { renderWhitelistApproved, type RenderedEmail } from "@/lib/admin/preview-actions";
import { EmailPreviewDialog } from "@/components/admin/email-preview-dialog";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { TargetedEmailComposer } from "@/components/admin/targeted-email-composer";
import {
  Users, Shield, Mail, BarChart3, MessageSquare,
  Plus, Trash2, Check, Loader2, Eye,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "whitelist", label: "Whitelist", icon: Shield },
  { id: "email", label: "Send Email", icon: Mail },
  { id: "requests", label: "Access Requests", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AdminTabsProps {
  users: {
    id: string; name: string; email: string; avatarUrl: string | null;
    joinedAt: string; lastSignIn: string | null;
    entryCount: number; taskStats: { total: number; done: number }; pageCount: number;
  }[];
  whitelist: { email: string; created_at: string }[];
  whitelistRequests: { id: string; email: string; name: string | null; reason: string | null; status: string; created_at: string }[];
  dailyActivity: { date: string; entries: number; tasks: number; avgScore: number }[];
  taskAnalytics: { statuses: Record<string, number>; priorities: Record<string, number>; avgCompletionHours: number; total: number };
  entryAnalytics: { statuses: Record<string, number>; avgScore: number; totalDaysTracked: number; activeUsers: number; total: number };
}

export function AdminTabs({ users, whitelist: initialWhitelist, whitelistRequests: initialRequests, dailyActivity, taskAnalytics, entryAnalytics }: AdminTabsProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [whitelist, setWhitelist] = useState(initialWhitelist);
  const [requests, setRequests] = useState(initialRequests);
  const router = useRouter();

  // Whitelist state
  const [newEmail, setNewEmail] = useState("");
  const [addingEmail, setAddingEmail] = useState(false);
  const [whitelistMsg, setWhitelistMsg] = useState<{ type: "success" | "warn" | "error"; text: string } | null>(null);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<{ type: "success" | "warn" | "error"; text: string } | null>(null);

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
      setWhitelistMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to render preview",
      });
    }
  }

  function openComposerPreview(payload: RenderedEmail) {
    setPreviewPayload(payload);
  }

  async function handleAddWhitelist(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingEmail(true);
    setWhitelistMsg(null);
    try {
      const result = await addToWhitelist(newEmail);
      setWhitelist((prev) => [{ email: result.email, created_at: new Date().toISOString() }, ...prev]);
      setNewEmail("");
      setWhitelistMsg({
        type: "success",
        text: `Whitelisted ${result.email}. Opening invite email preview so you can copy and send it.`,
      });
      openWhitelistPreview(result.email);
    } catch (err) {
      setWhitelistMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to add to whitelist",
      });
    }
    setAddingEmail(false);
  }

  async function handleRemoveWhitelist(email: string) {
    setActionLoading(email);
    setWhitelistMsg(null);
    try {
      await removeFromWhitelist(email);
      setWhitelist((prev) => prev.filter((w) => w.email !== email));
    } catch (err) {
      setWhitelistMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to remove",
      });
    }
    setActionLoading(null);
  }

  async function handleApproveRequest(requestId: string) {
    setActionLoading(requestId);
    setRequestMsg(null);
    try {
      const result = await approveWhitelistRequest(requestId);
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "approved" } : r));
      setWhitelist((prev) => [{ email: result.email, created_at: new Date().toISOString() }, ...prev]);
      setRequestMsg({
        type: "success",
        text: `Approved ${result.email}. Opening invite email preview so you can send it manually.`,
      });
      openWhitelistPreview(result.email, result.name ?? "");
    } catch (err) {
      setRequestMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to approve",
      });
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
                      <td className="py-3 text-zinc-400 text-xs">
                        {u.lastSignIn ? format(new Date(u.lastSignIn), "MMM d, HH:mm") : "Never"}
                      </td>
                      <td className="py-3 text-zinc-400 text-xs">{format(new Date(u.joinedAt), "MMM d, yyyy")}</td>
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
          {whitelistMsg && <Alert type={whitelistMsg.type}>{whitelistMsg.text}</Alert>}
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
                      <p className="text-xs text-zinc-400">Added {format(new Date(w.created_at), "MMM d, yyyy")}</p>
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
          {requestMsg && <Alert type={requestMsg.type}>{requestMsg.text}</Alert>}
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
                      <p className="mt-1 text-[11px] text-zinc-300">{format(new Date(r.created_at), "MMM d, yyyy HH:mm")}</p>
                    </div>
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveRequest(r.id)}
                        disabled={actionLoading === r.id}
                      >
                        {actionLoading === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                        Approve
                      </Button>
                    )}
                  </div>
                ))}
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
